"""Parser for fenced AIMD connectors blocks."""

from __future__ import annotations

import re
from typing import Any, Dict, Mapping, Optional

import yaml

from ..ast_nodes import ConnectorsNode
from ..errors import InvalidSyntaxError
from ..tokens import Position

CONNECTOR_ID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
ENTITY_NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
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


class _ConnectorsYamlLoader(yaml.SafeLoader):
    """Safe YAML loader that rejects duplicate mapping keys."""


def _construct_unique_mapping(
    loader: _ConnectorsYamlLoader,
    node: yaml.nodes.MappingNode,
    deep: bool = False,
) -> Dict[Any, Any]:
    loader.flatten_mapping(node)
    mapping: Dict[Any, Any] = {}
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


_ConnectorsYamlLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_unique_mapping,
)


def _syntax_error(message: str, position: Optional[Position]) -> InvalidSyntaxError:
    return InvalidSyntaxError(message, position=position)


def _is_mapping(value: Any) -> bool:
    return isinstance(value, Mapping)


def _optional_string(value: Any, field_name: str, position: Optional[Position]) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise _syntax_error(f"{field_name} must be a string", position)
    stripped = value.strip()
    return stripped or None


def _non_empty_string(value: Any, field_name: str, position: Optional[Position]) -> str:
    stripped = _optional_string(value, field_name, position)
    if not stripped:
        raise _syntax_error(f"{field_name} must be a non-empty string", position)
    return stripped


def _assert_no_inline_secrets(value: Any, path: str, position: Optional[Position]) -> None:
    if isinstance(value, list):
        for index, item in enumerate(value):
            _assert_no_inline_secrets(item, f"{path}[{index}]", position)
        return
    if not _is_mapping(value):
        return

    for key, nested_value in value.items():
        normalized_key = str(key).strip().lower()
        if normalized_key in INLINE_SECRET_KEYS and not normalized_key.endswith("_env"):
            raise _syntax_error(
                f"{path}.{key} must not inline secret values; use an *_env field instead",
                position,
            )
        _assert_no_inline_secrets(nested_value, f"{path}.{key}", position)


def _normalize_auth(value: Any, field_name: str, position: Optional[Position]) -> Optional[Dict[str, Any]]:
    if value is None:
        return None
    if not _is_mapping(value):
        raise _syntax_error(f"{field_name} must be a mapping/object", position)

    _assert_no_inline_secrets(value, field_name, position)
    auth = dict(value)
    auth_type = _optional_string(value.get("type"), f"{field_name}.type", position)
    auth["type"] = auth_type or "bearer"
    token_env = _optional_string(value.get("token_env"), f"{field_name}.token_env", position)
    if token_env:
        auth["token_env"] = token_env
    return auth


def _normalize_connector(raw_connector: Any, connector_id: str, position: Optional[Position]) -> Dict[str, Any]:
    if not CONNECTOR_ID_PATTERN.match(connector_id):
        raise _syntax_error(f"connectors.{connector_id} must use an identifier key", position)
    if not _is_mapping(raw_connector):
        raise _syntax_error(f"connectors.{connector_id} must be a mapping/object", position)

    _assert_no_inline_secrets(raw_connector, f"connectors.{connector_id}", position)

    kind = _non_empty_string(raw_connector.get("kind"), f"connectors.{connector_id}.kind", position)
    connector = dict(raw_connector)
    connector["id"] = connector_id
    connector["kind"] = kind

    entity = _optional_string(raw_connector.get("entity"), f"connectors.{connector_id}.entity", position)
    if entity:
        if not ENTITY_NAME_PATTERN.match(entity):
            raise _syntax_error(
                f"connectors.{connector_id}.entity must start with a letter and contain only letters, digits, underscores, or hyphens",
                position,
            )
        connector["entity"] = entity

    for key in ("descriptor", "title", "description"):
        value = _optional_string(raw_connector.get(key), f"connectors.{connector_id}.{key}", position)
        if value:
            connector[key] = value

    auth = _normalize_auth(raw_connector.get("auth"), f"connectors.{connector_id}.auth", position)
    if auth:
        connector["auth"] = auth

    if kind == "entity_source":
        if not connector.get("entity"):
            raise _syntax_error(
                f"connectors.{connector_id}.entity is required for entity_source connectors",
                position,
            )
        if not connector.get("descriptor") and "search" not in connector and "resolve" not in connector:
            raise _syntax_error(
                f"connectors.{connector_id} must define descriptor, search, or resolve for entity_source connectors",
                position,
            )

    return connector


def parse_connectors_content(content: str, position: Optional[Position] = None) -> ConnectorsNode:
    """Parse one fenced connectors block payload."""

    try:
        parsed = yaml.load(content, Loader=_ConnectorsYamlLoader) if content.strip() else {}
    except yaml.YAMLError as exc:
        raise _syntax_error(f"Invalid connectors YAML: {exc}", position) from exc

    if not _is_mapping(parsed):
        raise _syntax_error("connectors block must be a YAML mapping/object", position)

    version = parsed.get("version", 1)
    if version is None:
        version = 1
    if version is not None and not isinstance(version, (str, int, float)):
        raise _syntax_error("connectors.version must be a string or number", position)

    legacy_raw_connectors = parsed.get("connectors")
    if legacy_raw_connectors is not None:
        extra_keys = [key for key in parsed if key not in {"version", "connectors"}]
        if extra_keys:
            raise _syntax_error(
                "connectors block must not mix top-level connector ids with connectors.connectors",
                position,
            )
        if not _is_mapping(legacy_raw_connectors):
            raise _syntax_error("connectors.connectors must be a mapping/object", position)
        raw_connectors = legacy_raw_connectors
    else:
        raw_connectors = {
            raw_id: raw_connector
            for raw_id, raw_connector in parsed.items()
            if raw_id != "version"
        }

    connectors: Dict[str, Dict[str, Any]] = {}
    for raw_id, raw_connector in raw_connectors.items():
        connector_id = str(raw_id)
        connectors[connector_id] = _normalize_connector(raw_connector, connector_id, position)

    if not connectors:
        raise _syntax_error("connectors block must contain at least one connector", position)

    return ConnectorsNode(
        position=position or Position(start_line=0, end_line=0, start_col=0, end_col=0),
        connectors=connectors,
        raw=content,
        version=version,
    )
