"""Runtime helpers for protocol-declared Airalogy connectors."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Callable, Mapping
from urllib.parse import quote, urlparse

import httpx
import yaml

from .markdown import parse_aimd

INLINE_SECRET_KEYS = {
    "access_token",
    "api_key",
    "apikey",
    "bearer",
    "client_secret",
    "password",
    "refresh_token",
    "secret",
    "token",
}


class ConnectorRuntimeError(RuntimeError):
    """Raised when a declared connector cannot be loaded or executed."""


class _ConnectorYamlLoader(yaml.SafeLoader):
    """Safe YAML loader that rejects duplicate mapping keys."""


def _construct_unique_mapping(
    loader: _ConnectorYamlLoader,
    node: yaml.nodes.MappingNode,
    deep: bool = False,
) -> dict[Any, Any]:
    loader.flatten_mapping(node)
    mapping: dict[Any, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise yaml.constructor.ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                f"found duplicate key {key!r}",
                key_node.start_mark,
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


_ConnectorYamlLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_unique_mapping,
)


def _is_mapping(value: Any) -> bool:
    return isinstance(value, Mapping)


def _is_http_url(value: str) -> bool:
    return urlparse(value).scheme in {"http", "https"}


def _assert_no_inline_secrets(value: Any, path: str) -> None:
    if isinstance(value, list):
        for index, item in enumerate(value):
            _assert_no_inline_secrets(item, f"{path}[{index}]")
        return
    if not _is_mapping(value):
        return

    for key, nested_value in value.items():
        normalized_key = str(key).strip().lower()
        if normalized_key in INLINE_SECRET_KEYS and not normalized_key.endswith("_env"):
            raise ConnectorRuntimeError(
                f"{path}.{key} must not inline secret values; use an *_env field instead"
            )
        _assert_no_inline_secrets(nested_value, f"{path}.{key}")


def _parse_descriptor_text(text: str, location: str) -> dict[str, Any]:
    try:
        parsed = yaml.load(text, Loader=_ConnectorYamlLoader) if text.strip() else {}
    except yaml.YAMLError as exc:
        raise ConnectorRuntimeError(f"Invalid connector descriptor YAML at {location}: {exc}") from exc

    if not _is_mapping(parsed):
        raise ConnectorRuntimeError(f"Connector descriptor at {location} must be a mapping/object")

    descriptor = dict(parsed)
    _assert_no_inline_secrets(descriptor, f"connector descriptor {location}")
    return descriptor


def _read_descriptor_file(reference: str, base_dir: str | Path | None) -> str:
    path = Path(reference)
    if not path.is_absolute():
        if base_dir is None:
            raise ConnectorRuntimeError(
                f"Local connector descriptor {reference!r} requires base_dir"
            )
        path = Path(base_dir) / path

    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ConnectorRuntimeError(f"Cannot read connector descriptor {path}: {exc}") from exc


def _default_fetch_text(reference: str, headers: Mapping[str, str]) -> str:
    try:
        response = httpx.get(reference, headers=dict(headers), timeout=20)
        response.raise_for_status()
        return response.text
    except httpx.HTTPError as exc:
        raise ConnectorRuntimeError(f"Cannot fetch connector descriptor {reference}: {exc}") from exc


def _normalize_env(
    env: Mapping[str, str] | None = None,
    env_file: str | Path | None = None,
) -> dict[str, str]:
    merged = {} if env is not None else dict(os.environ)
    if env_file is not None:
        merged.update(load_connector_env_file(env_file))
    if env is not None:
        merged.update({str(key): str(value) for key, value in env.items()})
    return merged


def load_connector_env_file(path: str | Path) -> dict[str, str]:
    """Load a small dotenv-style file for connector secrets."""

    env: dict[str, str] = {}
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise ConnectorRuntimeError(f"Cannot read connector env file {path}: {exc}") from exc

    for line_number, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            raise ConnectorRuntimeError(
                f"Invalid connector env file line {line_number}: expected KEY=value"
            )
        key, value = line.split("=", 1)
        key = key.strip()
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
            raise ConnectorRuntimeError(
                f"Invalid connector env file line {line_number}: invalid variable name {key!r}"
            )
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        env[key] = value
    return env


def _auth_headers(auth: Any, env: Mapping[str, str]) -> dict[str, str]:
    if auth is None:
        return {}
    if not _is_mapping(auth):
        raise ConnectorRuntimeError("connector auth must be a mapping/object")

    auth_type = str(auth.get("type") or "bearer").strip().lower()
    if auth_type in {"none", "no_auth", "anonymous"}:
        return {}

    token_env = auth.get("token_env")
    if not isinstance(token_env, str) or not token_env.strip():
        return {}

    token_name = token_env.strip()
    token = env.get(token_name)
    if not token:
        raise ConnectorRuntimeError(
            f"Connector auth requires environment variable {token_name}"
        )

    if auth_type in {"bearer", "oauth2"}:
        return {"Authorization": f"Bearer {token}"}
    if auth_type in {"api_key", "api-key", "apikey"}:
        header_name = str(auth.get("header") or "X-API-Key").strip() or "X-API-Key"
        return {header_name: token}

    raise ConnectorRuntimeError(f"Unsupported connector auth type: {auth_type}")


def load_connector_descriptor(
    connector: Mapping[str, Any],
    *,
    base_dir: str | Path | None = None,
    fetch_text: Callable[[str, Mapping[str, str]], str] | None = None,
) -> dict[str, Any]:
    """
    Load and merge a connector descriptor.

    Connector metadata from AIMD takes precedence over descriptor metadata, so
    protocol-local `id`, `kind`, `entity`, and `auth` stay authoritative.
    """

    if not _is_mapping(connector):
        raise ConnectorRuntimeError("connector must be a mapping/object")

    connector_data = dict(connector)
    _assert_no_inline_secrets(connector_data, "connector")
    descriptor_data: dict[str, Any] = {}

    descriptor_ref = connector_data.get("descriptor")
    if descriptor_ref is not None:
        if not isinstance(descriptor_ref, str) or not descriptor_ref.strip():
            raise ConnectorRuntimeError("connector descriptor must be a non-empty string")
        descriptor_ref = descriptor_ref.strip()
        if fetch_text is not None:
            text = fetch_text(descriptor_ref, {})
        elif _is_http_url(descriptor_ref):
            text = _default_fetch_text(descriptor_ref, {})
        else:
            text = _read_descriptor_file(descriptor_ref, base_dir)
        descriptor_data = _parse_descriptor_text(text, descriptor_ref)

    descriptor_entity = descriptor_data.get("entity")
    connector_entity = connector_data.get("entity")
    if (
        isinstance(descriptor_entity, str)
        and isinstance(connector_entity, str)
        and descriptor_entity.strip()
        and connector_entity.strip()
        and descriptor_entity.strip() != connector_entity.strip()
    ):
        raise ConnectorRuntimeError(
            f"Connector descriptor entity {descriptor_entity!r} does not match connector entity {connector_entity!r}"
        )

    merged = {**descriptor_data, **connector_data}
    if _is_mapping(descriptor_data.get("auth")) or _is_mapping(connector_data.get("auth")):
        merged["auth"] = {
            **(dict(descriptor_data.get("auth")) if _is_mapping(descriptor_data.get("auth")) else {}),
            **(dict(connector_data.get("auth")) if _is_mapping(connector_data.get("auth")) else {}),
        }
        if "token_env" in merged["auth"] and not merged["auth"].get("type"):
            merged["auth"]["type"] = "bearer"
    return merged


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _first_string(value: Mapping[str, Any], keys: list[str | None]) -> str | None:
    for key in keys:
        if not key:
            continue
        text = _string_or_none(value.get(key))
        if text:
            return text
    return None


def _read_path(value: Any, path: str | None) -> Any:
    if not path:
        return value
    current = value
    for part in path.split("."):
        if not part:
            continue
        if not _is_mapping(current):
            return None
        current = current.get(part)
    return current


def _extract_items(response: Any, operation: Mapping[str, Any]) -> list[Any]:
    items_path = _string_or_none(operation.get("items_path"))
    if items_path:
        response = _read_path(response, items_path)

    if isinstance(response, list):
        return response

    if _is_mapping(response):
        for key in ("items", "results", "records", "data"):
            value = response.get(key)
            if isinstance(value, list):
                return value
            if _is_mapping(value):
                nested = _extract_items(value, {})
                if nested:
                    return nested
        return [response]

    if response is None:
        return []
    return [response]


def normalize_entity_ref_option(
    value: Any,
    *,
    entity: str,
    source: str | None = None,
    field_map: Mapping[str, str] | None = None,
) -> dict[str, Any] | None:
    """Normalize connector response data into an EntityRef-compatible object."""

    if isinstance(value, str):
        entity_id = value.strip()
        if not entity_id:
            return None
        return {
            "entity": entity,
            "source": source,
            "id": entity_id,
            "label": entity_id,
        }

    if not _is_mapping(value):
        return None

    field_map = field_map or {}
    id_keys = [
        field_map.get("id"),
        "id",
        "value",
        "key",
        "uuid",
    ]
    label_keys = [
        field_map.get("label"),
        "label",
        "name",
        "title",
        "display_name",
    ]
    version_keys = [
        field_map.get("version"),
        "version",
        "revision",
    ]

    entity_id = _first_string(value, id_keys)
    if not entity_id:
        return None

    label = _first_string(value, label_keys)
    version = _first_string(value, version_keys)
    normalized = dict(value)
    normalized["entity"] = _string_or_none(value.get("entity")) or entity
    normalized["source"] = _string_or_none(value.get("source")) or source
    normalized["id"] = entity_id
    normalized["label"] = label or entity_id
    if version is not None:
        normalized["version"] = version
    return normalized


def _format_url_template(url: str, values: Mapping[str, Any]) -> str:
    result = url
    for key, value in values.items():
        result = result.replace("{" + key + "}", quote(str(value), safe=""))
    return result


def _format_template_value(value: Any, values: Mapping[str, Any]) -> Any:
    if isinstance(value, str):
        result = value
        for key, replacement in values.items():
            result = result.replace("{" + key + "}", str(replacement))
        return result
    if isinstance(value, list):
        return [_format_template_value(item, values) for item in value]
    if _is_mapping(value):
        return {
            str(key): _format_template_value(nested_value, values)
            for key, nested_value in value.items()
        }
    return value


def _operation_mapping(config: Mapping[str, Any], key: str) -> dict[str, Any]:
    operation = config.get(key)
    if not _is_mapping(operation):
        raise ConnectorRuntimeError(f"connector {key} operation must be a mapping/object")
    url = _string_or_none(operation.get("url"))
    if not url:
        raise ConnectorRuntimeError(f"connector {key}.url is required")
    return dict(operation)


def _build_request(
    operation: Mapping[str, Any],
    *,
    query: str | None = None,
    entity_id: str | None = None,
    headers: Mapping[str, str] | None = None,
) -> tuple[str, str, dict[str, str], dict[str, Any], Any]:
    method = str(operation.get("method") or "GET").strip().upper()
    values: dict[str, Any] = {}
    if query is not None:
        values["query"] = query
    if entity_id is not None:
        values["id"] = entity_id

    url = _format_url_template(str(operation["url"]), values)
    params = (
        _format_template_value(operation.get("params"), values)
        if _is_mapping(operation.get("params"))
        else {}
    )
    params = dict(params)

    if query is not None:
        query_param = _string_or_none(operation.get("query_param")) or "q"
        if query_param not in params:
            params[query_param] = query
    if entity_id is not None and "{id}" not in str(operation["url"]):
        id_param = _string_or_none(operation.get("id_param"))
        if id_param:
            params[id_param] = entity_id

    request_headers = dict(headers or {})
    if _is_mapping(operation.get("headers")):
        request_headers.update(
            {
                str(key): str(_format_template_value(value, values))
                for key, value in dict(operation["headers"]).items()
            }
        )

    json_body = (
        _format_template_value(operation.get("json"), values)
        if _is_mapping(operation.get("json")) or isinstance(operation.get("json"), list)
        else None
    )
    return method, url, request_headers, params, json_body


def _default_request_json(
    method: str,
    url: str,
    *,
    headers: Mapping[str, str],
    params: Mapping[str, Any],
    json: Any,
    timeout: float,
) -> Any:
    try:
        response = httpx.request(
            method,
            url,
            headers=dict(headers),
            params=dict(params),
            json=json,
            timeout=timeout,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as exc:
        raise ConnectorRuntimeError(f"Connector request failed for {url}: {exc}") from exc
    except ValueError as exc:
        raise ConnectorRuntimeError(f"Connector response from {url} is not JSON") from exc


class EntitySourceConnector:
    """Executable entity_source connector."""

    def __init__(
        self,
        connector: Mapping[str, Any],
        *,
        base_dir: str | Path | None = None,
        env: Mapping[str, str] | None = None,
        env_file: str | Path | None = None,
        fetch_text: Callable[[str, Mapping[str, str]], str] | None = None,
        request_json: Callable[..., Any] | None = None,
        timeout: float = 20,
    ) -> None:
        self.env = _normalize_env(env, env_file)
        self.config = load_connector_descriptor(
            connector,
            base_dir=base_dir,
            fetch_text=fetch_text,
        )
        self.request_json = request_json or _default_request_json
        self.timeout = timeout

        if self.config.get("kind") != "entity_source":
            raise ConnectorRuntimeError("EntitySourceConnector requires kind='entity_source'")
        self.id = _string_or_none(self.config.get("id"))
        self.entity = _string_or_none(self.config.get("entity"))
        if not self.id:
            raise ConnectorRuntimeError("entity_source connector id is required")
        if not self.entity:
            raise ConnectorRuntimeError("entity_source connector entity is required")

    def _headers(self) -> dict[str, str]:
        return _auth_headers(self.config.get("auth"), self.env)

    def search(self, query: str, *, limit: int | None = None) -> list[dict[str, Any]]:
        """Search the connector and return EntityRef-compatible options."""

        operation = _operation_mapping(self.config, "search")
        method, url, headers, params, json_body = _build_request(
            operation,
            query=query,
            headers=self._headers(),
        )
        if limit is not None and "limit" not in params:
            params["limit"] = limit
        response = self.request_json(
            method,
            url,
            headers=headers,
            params=params,
            json=json_body,
            timeout=self.timeout,
        )
        field_map = operation.get("field_map") if _is_mapping(operation.get("field_map")) else None
        options = [
            normalize_entity_ref_option(item, entity=self.entity, source=self.id, field_map=field_map)
            for item in _extract_items(response, operation)
        ]
        return [option for option in options if option is not None]

    def resolve(self, entity_id: str) -> dict[str, Any] | None:
        """Resolve one entity id into an EntityRef-compatible option."""

        operation = _operation_mapping(self.config, "resolve")
        method, url, headers, params, json_body = _build_request(
            operation,
            entity_id=entity_id,
            headers=self._headers(),
        )
        response = self.request_json(
            method,
            url,
            headers=headers,
            params=params,
            json=json_body,
            timeout=self.timeout,
        )
        field_map = operation.get("field_map") if _is_mapping(operation.get("field_map")) else None
        for item in _extract_items(response, operation):
            option = normalize_entity_ref_option(item, entity=self.entity, source=self.id, field_map=field_map)
            if option is not None:
                return option
        return None


def create_entity_source_connector(
    connector: Mapping[str, Any],
    **kwargs: Any,
) -> EntitySourceConnector:
    """Create an executable entity_source connector from parsed AIMD metadata."""

    return EntitySourceConnector(connector, **kwargs)


def create_entity_source_connectors_from_aimd(
    content: str,
    *,
    base_dir: str | Path | None = None,
    env: Mapping[str, str] | None = None,
    env_file: str | Path | None = None,
    fetch_text: Callable[[str, Mapping[str, str]], str] | None = None,
    request_json: Callable[..., Any] | None = None,
    timeout: float = 20,
) -> dict[str, EntitySourceConnector]:
    """Parse AIMD content and create executable entity_source connectors."""

    parsed = parse_aimd(content)
    result: dict[str, EntitySourceConnector] = {}
    for block in parsed.get("templates", {}).get("connectors", []):
        for connector_id, connector in block.get("connectors", {}).items():
            if connector.get("kind") != "entity_source":
                continue
            resolver = EntitySourceConnector(
                connector,
                base_dir=base_dir,
                env=env,
                env_file=env_file,
                fetch_text=fetch_text,
                request_json=request_json,
                timeout=timeout,
            )
            result[str(connector_id)] = resolver
    return result


__all__ = [
    "ConnectorRuntimeError",
    "EntitySourceConnector",
    "create_entity_source_connector",
    "create_entity_source_connectors_from_aimd",
    "load_connector_descriptor",
    "load_connector_env_file",
    "normalize_entity_ref_option",
]
