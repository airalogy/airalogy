"""Parser for fenced AIMD collectors blocks."""

from __future__ import annotations

import re
from typing import Any, Dict, Mapping, Optional

import yaml

from ..ast_nodes import CollectorsNode
from ..errors import InvalidSyntaxError
from ..tokens import Position

COLLECTOR_ID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
DURATION_PART_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)", re.IGNORECASE
)
COLLECTOR_MODES = {"snapshot", "polling", "stream"}


class _CollectorsYamlLoader(yaml.SafeLoader):
    """Safe YAML loader that rejects duplicate mapping keys."""


def _construct_unique_mapping(
    loader: _CollectorsYamlLoader,
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


_CollectorsYamlLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_unique_mapping,
)


def _syntax_error(message: str, position: Optional[Position]) -> InvalidSyntaxError:
    return InvalidSyntaxError(message, position=position)


def _is_mapping(value: Any) -> bool:
    return isinstance(value, Mapping)


def _optional_string(
    value: Any, field_name: str, position: Optional[Position]
) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise _syntax_error(f"{field_name} must be a string", position)
    return value.strip() or None


def _required_string(value: Any, field_name: str, position: Optional[Position]) -> str:
    normalized = _optional_string(value, field_name, position)
    if not normalized:
        raise _syntax_error(f"{field_name} must be a non-empty string", position)
    return normalized


def _parse_duration_to_ms(value: str) -> Optional[int]:
    trimmed = value.strip()
    if not trimmed:
        return None

    total_ms = 0.0
    last_index = 0
    matched = False
    for match in DURATION_PART_PATTERN.finditer(trimmed):
        if trimmed[last_index : match.start()].strip():
            return None
        matched = True
        amount = float(match.group(1))
        unit = match.group(2).lower()
        multiplier = (
            24 * 60 * 60 * 1000
            if unit == "d"
            else 60 * 60 * 1000
            if unit == "h"
            else 60 * 1000
            if unit == "m"
            else 1000
            if unit == "s"
            else 1
        )
        total_ms += amount * multiplier
        last_index = match.end()

    if not matched or trimmed[last_index:].strip():
        return None
    return round(total_ms)


def _normalize_lifecycle_trigger(
    value: Any,
    phase: str,
    field_name: str,
    position: Optional[Position],
) -> str | Dict[str, str]:
    allowed_strings = {"manual", "record_start"} if phase == "start" else {
        "manual",
        "record_complete",
    }
    step_event = "step_start" if phase == "start" else "step_complete"

    if isinstance(value, str):
        normalized = value.strip()
        if normalized in allowed_strings:
            return normalized
        raise _syntax_error(
            f"{field_name} must be {' or '.join(sorted(allowed_strings))}", position
        )

    if not _is_mapping(value):
        raise _syntax_error(
            f"{field_name} must be a lifecycle event string or mapping/object",
            position,
        )

    event = _required_string(value.get("event"), f"{field_name}.event", position)
    if event != step_event:
        raise _syntax_error(f"{field_name}.event must be {step_event}", position)
    step = _required_string(value.get("step"), f"{field_name}.step", position)
    return {"event": event, "step": step}


def _normalize_lifecycle(
    value: Any, field_name: str, position: Optional[Position]
) -> Dict[str, Any]:
    if value is None:
        return {"start": "manual", "stop": "manual"}
    if not _is_mapping(value):
        raise _syntax_error(f"{field_name} must be a mapping/object", position)
    return {
        "start": _normalize_lifecycle_trigger(
            value.get("start", "manual"), "start", f"{field_name}.start", position
        ),
        "stop": _normalize_lifecycle_trigger(
            value.get("stop", "manual"), "stop", f"{field_name}.stop", position
        ),
    }


def _normalize_collector(
    raw_collector: Any, collector_id: str, position: Optional[Position]
) -> Dict[str, Any]:
    if not COLLECTOR_ID_PATTERN.match(collector_id):
        raise _syntax_error(
            f"collectors.{collector_id} must use an identifier key", position
        )
    if not _is_mapping(raw_collector):
        raise _syntax_error(
            f"collectors.{collector_id} must be a mapping/object", position
        )

    field_name = f"collectors.{collector_id}"
    connector = _required_string(
        raw_collector.get("connector"), f"{field_name}.connector", position
    )
    mode = _optional_string(
        raw_collector.get("mode"), f"{field_name}.mode", position
    ) or "snapshot"
    if mode not in COLLECTOR_MODES:
        raise _syntax_error(
            f"{field_name}.mode must be snapshot, polling, or stream", position
        )

    interval = _optional_string(
        raw_collector.get("interval"), f"{field_name}.interval", position
    )
    interval_ms: Optional[int] = None
    if mode == "polling":
        if not interval:
            raise _syntax_error(
                f"{field_name}.interval is required for polling mode", position
            )
        interval_ms = _parse_duration_to_ms(interval)
        if interval_ms is None or interval_ms <= 0:
            raise _syntax_error(
                f"{field_name}.interval must be a positive duration such as 250ms, 5s, or 1min",
                position,
            )
    elif interval:
        raise _syntax_error(
            f"{field_name}.interval is only valid for polling mode", position
        )

    manual_fallback = raw_collector.get("manual_fallback", False)
    if not isinstance(manual_fallback, bool):
        raise _syntax_error(
            f"{field_name}.manual_fallback must be a boolean", position
        )

    collector = dict(raw_collector)
    collector.update(
        {
            "id": collector_id,
            "connector": connector,
            "mode": mode,
            "lifecycle": _normalize_lifecycle(
                raw_collector.get("lifecycle"), f"{field_name}.lifecycle", position
            ),
            "manual_fallback": manual_fallback,
        }
    )
    channel = _optional_string(
        raw_collector.get("channel"), f"{field_name}.channel", position
    )
    if channel:
        collector["channel"] = channel
    if interval and interval_ms is not None:
        collector["interval"] = interval
        collector["interval_ms"] = interval_ms
    title = _optional_string(
        raw_collector.get("title"), f"{field_name}.title", position
    )
    if title:
        collector["title"] = title
    return collector


def parse_collectors_content(
    content: str, position: Optional[Position] = None
) -> CollectorsNode:
    """Parse one fenced collectors block payload."""

    try:
        parsed = (
            yaml.load(content, Loader=_CollectorsYamlLoader) if content.strip() else {}
        )
    except yaml.YAMLError as exc:
        raise _syntax_error(f"Invalid collectors YAML: {exc}", position) from exc

    if not _is_mapping(parsed):
        raise _syntax_error(
            "collectors block must be a YAML mapping/object", position
        )

    version = parsed.get("version")
    if version is not None and not isinstance(version, (str, int, float)):
        raise _syntax_error("collectors.version must be a string or number", position)

    legacy_collectors = parsed.get("collectors")
    if legacy_collectors is not None:
        extra_keys = [key for key in parsed if key not in {"version", "collectors"}]
        if extra_keys:
            raise _syntax_error(
                "collectors block must not mix top-level collector ids with collectors.collectors",
                position,
            )
        if not _is_mapping(legacy_collectors):
            raise _syntax_error(
                "collectors.collectors must be a mapping/object", position
            )
        raw_collectors = legacy_collectors
    else:
        raw_collectors = {
            raw_id: raw_collector
            for raw_id, raw_collector in parsed.items()
            if raw_id != "version"
        }

    collectors: Dict[str, Dict[str, Any]] = {}
    for raw_id, raw_collector in raw_collectors.items():
        collector_id = str(raw_id)
        collectors[collector_id] = _normalize_collector(
            raw_collector, collector_id, position
        )

    if not collectors:
        raise _syntax_error(
            "collectors block must contain at least one collector", position
        )

    return CollectorsNode(
        position=position
        or Position(start_line=0, end_line=0, start_col=0, end_col=0),
        collectors=collectors,
        raw=content,
        version=version,
    )
