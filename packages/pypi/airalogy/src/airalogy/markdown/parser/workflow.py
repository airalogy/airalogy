"""Parser for fenced AIMD workflow blocks."""

from __future__ import annotations

import re
import textwrap
from typing import Any, Dict, List, Optional

import yaml

from ..ast_nodes import WorkflowNode
from ..errors import InvalidSyntaxError
from ..lexer import Lexer
from ..tokens import Position

WORKFLOW_VERSION = "airalogy.workflow.v1"
WORKFLOW_ID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
WORKFLOW_FIELD_PATH_PATTERN = re.compile(
    r"^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$"
)
WORKFLOW_REFERENCE_PATTERN = re.compile(
    r"^\$\{[A-Za-z][A-Za-z0-9_]*(?:(?:\.[A-Za-z][A-Za-z0-9_]*){2,}|\.(?:status|iteration))\}$"
)


class UniqueKeyLoader(yaml.SafeLoader):
    """YAML loader that rejects duplicate mapping keys."""


def _construct_mapping(
    loader: UniqueKeyLoader, node: yaml.Node, deep: bool = False
) -> dict:
    mapping = {}
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


UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_mapping,
)


def _default_position() -> Position:
    return Position(start_line=1, end_line=1, start_col=1, end_col=1)


def _syntax_error(message: str, position: Position) -> InvalidSyntaxError:
    return InvalidSyntaxError(message, position=position)


def _is_mapping(value: Any) -> bool:
    return isinstance(value, dict)


def _non_empty_string(value: Any, field_name: str, position: Position) -> str:
    if not isinstance(value, str) or not value.strip():
        raise _syntax_error(f"{field_name} must be a non-empty string", position)
    return value.strip()


def _optional_string(value: Any, field_name: str, position: Position) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise _syntax_error(f"{field_name} must be a string", position)
    normalized = value.strip()
    return normalized or None


def _normalize_id(value: Any, field_name: str, position: Position) -> str:
    item_id = _non_empty_string(value, field_name, position)
    if not WORKFLOW_ID_PATTERN.fullmatch(item_id):
        raise _syntax_error(
            f"{field_name} must start with a letter and contain only letters, "
            "digits, and underscores",
            position,
        )
    return item_id


def _normalize_id_list(value: Any, field_name: str, position: Position) -> List[str]:
    if isinstance(value, list):
        ids = [
            _normalize_id(item, f"{field_name}[{index}]", position)
            for index, item in enumerate(value)
        ]
    else:
        ids = [_normalize_id(value, field_name, position)]
    if not ids:
        raise _syntax_error(f"{field_name} must be a non-empty string or list", position)

    seen: set[str] = set()
    for item_id in ids:
        if item_id in seen:
            raise _syntax_error(
                f"{field_name} contains duplicate node id: {item_id}", position
            )
        seen.add(item_id)
    return ids


def _normalize_string_record(
    value: Any, field_name: str, position: Position
) -> Optional[Dict[str, str]]:
    if value is None:
        return None
    if not _is_mapping(value):
        raise _syntax_error(f"{field_name} must be a mapping/object", position)

    result: Dict[str, str] = {}
    for key, raw_value in value.items():
        if not isinstance(key, str) or not WORKFLOW_ID_PATTERN.fullmatch(key):
            raise _syntax_error(
                f"{field_name}.{key} must use an identifier key", position
            )
        result[key] = _non_empty_string(raw_value, f"{field_name}.{key}", position)
    return result


def _normalize_value_record(
    value: Any, field_name: str, position: Position
) -> Optional[Dict[str, Any]]:
    if value is None:
        return None
    if not _is_mapping(value):
        raise _syntax_error(f"{field_name} must be a mapping/object", position)

    result: Dict[str, Any] = {}
    for key, raw_value in value.items():
        if not isinstance(key, str) or not WORKFLOW_ID_PATTERN.fullmatch(key):
            raise _syntax_error(
                f"{field_name}.{key} must use an identifier key", position
            )
        result[key] = raw_value
    return result


def _normalize_permissions(
    value: Any, position: Position
) -> Optional[Dict[str, List[str]]]:
    if value is None:
        return None
    if not _is_mapping(value):
        raise _syntax_error("assigner permissions must be a mapping/object", position)

    permissions: Dict[str, List[str]] = {}
    for key in ("network", "secrets"):
        raw_list = value.get(key)
        if raw_list is None:
            continue
        if not isinstance(raw_list, list) or not all(
            isinstance(item, str) and item.strip() for item in raw_list
        ):
            raise _syntax_error(
                f"permissions.{key} must be a list of non-empty strings",
                position,
            )
        permissions[key] = [item.strip() for item in raw_list]
    return permissions or None


def _normalize_node(raw_node: Any, index: int, position: Position) -> Dict[str, Any]:
    if not _is_mapping(raw_node):
        raise _syntax_error(f"nodes[{index}] must be a mapping/object", position)

    node: Dict[str, Any] = {
        "id": _normalize_id(raw_node.get("id"), f"nodes[{index}].id", position),
    }
    protocol = _optional_string(
        raw_node.get("protocol"), f"nodes[{index}].protocol", position
    )
    protocol_id = _optional_string(
        raw_node.get("protocol_id"), f"nodes[{index}].protocol_id", position
    )
    if not protocol and not protocol_id:
        raise _syntax_error(f"nodes[{index}] must define protocol or protocol_id", position)
    if protocol:
        node["protocol"] = protocol
    if protocol_id:
        node["protocol_id"] = protocol_id

    for key in ("protocol_version", "title", "description"):
        value = _optional_string(raw_node.get(key), f"nodes[{index}].{key}", position)
        if value:
            node[key] = value
    return node


def _normalize_assigner(
    raw_assigner: Any, index: int, position: Position
) -> Dict[str, Any]:
    if not _is_mapping(raw_assigner):
        raise _syntax_error(f"assigners[{index}] must be a mapping/object", position)

    assigner: Dict[str, Any] = {
        "id": _normalize_id(raw_assigner.get("id"), f"assigners[{index}].id", position),
        "runtime": _non_empty_string(
            raw_assigner.get("runtime"), f"assigners[{index}].runtime", position
        ),
    }
    entrypoint = _optional_string(
        raw_assigner.get("entrypoint"), f"assigners[{index}].entrypoint", position
    )
    if assigner["runtime"] == "python" and not entrypoint:
        raise _syntax_error(
            f"assigners[{index}].entrypoint is required for python runtime",
            position,
        )
    if entrypoint:
        assigner["entrypoint"] = entrypoint

    description = _optional_string(
        raw_assigner.get("description"), f"assigners[{index}].description", position
    )
    if description:
        assigner["description"] = description

    outputs = _normalize_string_record(
        raw_assigner.get("outputs"), f"assigners[{index}].outputs", position
    )
    if outputs:
        assigner["outputs"] = outputs

    permissions = _normalize_permissions(raw_assigner.get("permissions"), position)
    if permissions:
        assigner["permissions"] = permissions

    return assigner


def _normalize_field_assignment_record(
    value: Any, field_name: str, position: Position
) -> Dict[str, Any]:
    if not _is_mapping(value):
        raise _syntax_error(f"{field_name} must be a mapping/object", position)

    result: Dict[str, Any] = {}
    for field_path, raw_value in value.items():
        if not isinstance(field_path, str) or not WORKFLOW_FIELD_PATH_PATTERN.fullmatch(
            field_path
        ):
            raise _syntax_error(
                f"{field_name}.{field_path} must be a workflow field path like var.sample_id",
                position,
            )
        result[field_path] = raw_value
    return result


def _normalize_transition_assign(
    value: Any, target_ids: List[str], field_name: str, position: Position
) -> Optional[Dict[str, Dict[str, Any]]]:
    if value is None:
        return None
    if not _is_mapping(value):
        raise _syntax_error(f"{field_name} must be a mapping/object", position)

    target_set = set(target_ids)
    result: Dict[str, Dict[str, Any]] = {}
    if len(target_ids) == 1:
        only_target = target_ids[0]
        grouped_keys = [key for key in value.keys() if key in target_set]
        if grouped_keys:
            for target_id, raw_assignments in value.items():
                if target_id not in target_set:
                    raise _syntax_error(
                        f"{field_name}.{target_id} must reference a transition target node",
                        position,
                    )
                result[target_id] = _normalize_field_assignment_record(
                    raw_assignments, f"{field_name}.{target_id}", position
                )
        else:
            result[only_target] = _normalize_field_assignment_record(
                value, f"{field_name}.{only_target}", position
            )
        return result

    for target_id, raw_assignments in value.items():
        if target_id not in target_set:
            raise _syntax_error(
                f"{field_name}.{target_id} must reference a transition target node",
                position,
            )
        result[target_id] = _normalize_field_assignment_record(
            raw_assignments, f"{field_name}.{target_id}", position
        )
    return result


def _normalize_transition(
    raw_transition: Any,
    index: int,
    node_ids: set[str],
    assigner_ids: set[str],
    position: Position,
) -> Dict[str, Any]:
    if not _is_mapping(raw_transition):
        raise _syntax_error(f"transitions[{index}] must be a mapping/object", position)

    transition_id = _normalize_id(
        raw_transition.get("id"), f"transitions[{index}].id", position
    )
    from_ids = _normalize_id_list(
        raw_transition.get("from"), f"transitions[{index}].from", position
    )
    to_ids = _normalize_id_list(
        raw_transition.get("to"), f"transitions[{index}].to", position
    )
    for from_id in from_ids:
        if from_id not in node_ids:
            raise _syntax_error(
                f"transitions[{index}].from references unknown node: {from_id}",
                position,
            )
    for to_id in to_ids:
        if to_id not in node_ids:
            raise _syntax_error(
                f"transitions[{index}].to references unknown node: {to_id}",
                position,
            )

    transition: Dict[str, Any] = {"id": transition_id, "from": from_ids, "to": to_ids}
    for key in ("when", "label"):
        value = _optional_string(
            raw_transition.get(key), f"transitions[{index}].{key}", position
        )
        if value:
            transition[key] = value

    run = _optional_string(raw_transition.get("run"), f"transitions[{index}].run", position)
    if run:
        if run not in assigner_ids:
            raise _syntax_error(
                f"transitions[{index}].run references unknown assigner: {run}",
                position,
            )
        transition["run"] = run

    inputs = _normalize_value_record(
        raw_transition.get("inputs"), f"transitions[{index}].inputs", position
    )
    if inputs:
        transition["inputs"] = inputs

    max_iterations = raw_transition.get("max_iterations")
    if max_iterations is not None:
        if (
            not isinstance(max_iterations, int)
            or isinstance(max_iterations, bool)
            or max_iterations <= 0
        ):
            raise _syntax_error(
                f"transitions[{index}].max_iterations must be a positive integer",
                position,
            )
        transition["max_iterations"] = max_iterations

    assign = _normalize_transition_assign(
        raw_transition.get("assign"), to_ids, f"transitions[{index}].assign", position
    )
    if assign:
        transition["assign"] = assign

    return transition


def _collect_duplicate_ids(
    items: List[Dict[str, Any]], field_name: str, position: Position
) -> None:
    seen: set[str] = set()
    for item in items:
        item_id = item["id"]
        if item_id in seen:
            raise _syntax_error(f"{field_name} contains duplicate id: {item_id}", position)
        seen.add(item_id)


def _parse_yaml_mapping(content: str, position: Position) -> Dict[str, Any]:
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    try:
        value = yaml.load(normalized, Loader=UniqueKeyLoader) if normalized.strip() else {}
    except yaml.YAMLError as exc:
        raise _syntax_error(f"Invalid workflow YAML: {exc}", position) from exc

    if not _is_mapping(value):
        raise _syntax_error("workflow block must be a YAML mapping/object", position)
    return value


def is_aimd_workflow_reference(value: Any) -> bool:
    """Return whether a value is a workflow reference expression."""
    return isinstance(value, str) and bool(
        WORKFLOW_REFERENCE_PATTERN.fullmatch(value.strip())
    )


def parse_workflow_content(content: str, position: Optional[Position] = None) -> WorkflowNode:
    """Parse one fenced workflow block payload."""
    node_position = position or _default_position()
    data = _parse_yaml_mapping(content, node_position)
    version = _non_empty_string(data.get("version"), "workflow.version", node_position)
    if version != WORKFLOW_VERSION:
        raise _syntax_error(f"workflow.version must be {WORKFLOW_VERSION}", node_position)

    raw_nodes = data.get("nodes")
    if not isinstance(raw_nodes, list) or len(raw_nodes) == 0:
        raise _syntax_error("workflow.nodes must be a non-empty list", node_position)
    nodes = [
        _normalize_node(raw_node, index, node_position)
        for index, raw_node in enumerate(raw_nodes)
    ]
    _collect_duplicate_ids(nodes, "workflow.nodes", node_position)
    node_ids = {node["id"] for node in nodes}

    raw_assigners = data.get("assigners")
    if raw_assigners is None:
        assigners: List[Dict[str, Any]] = []
    elif isinstance(raw_assigners, list):
        assigners = [
            _normalize_assigner(raw_assigner, index, node_position)
            for index, raw_assigner in enumerate(raw_assigners)
        ]
    else:
        raise _syntax_error("workflow.assigners must be a list", node_position)
    _collect_duplicate_ids(assigners, "workflow.assigners", node_position)
    assigner_ids = {assigner["id"] for assigner in assigners}

    raw_transitions = data.get("transitions")
    if not isinstance(raw_transitions, list) or len(raw_transitions) == 0:
        raise _syntax_error("workflow.transitions must be a non-empty list", node_position)
    transitions = [
        _normalize_transition(raw_transition, index, node_ids, assigner_ids, node_position)
        for index, raw_transition in enumerate(raw_transitions)
    ]
    _collect_duplicate_ids(transitions, "workflow.transitions", node_position)

    workflow = WorkflowNode(
        position=node_position,
        id=_normalize_id(data.get("id"), "workflow.id", node_position),
        version=version,
        nodes=nodes,
        assigners=assigners,
        transitions=transitions,
        raw=content,
    )

    for key in (
        "title",
        "description",
        "logic",
        "default_research_purpose",
        "default_research_strategy",
    ):
        value = _optional_string(data.get(key), f"workflow.{key}", node_position)
        if value:
            setattr(workflow, key, value)

    default_initial_node = _optional_string(
        data.get("default_initial_node"), "workflow.default_initial_node", node_position
    )
    if default_initial_node:
        if default_initial_node not in node_ids:
            raise _syntax_error(
                f"workflow.default_initial_node references unknown node: {default_initial_node}",
                node_position,
            )
        workflow.default_initial_node = default_initial_node

    return workflow


class WorkflowParserMixin:
    """Mixin that extracts fenced workflow blocks from AIMD content."""

    def _parse_workflow_blocks(self) -> List[WorkflowNode]:
        workflows: List[WorkflowNode] = []
        for match in Lexer.CODE_BLOCK_PATTERN.finditer(self.content):
            lang = (match.group("lang") or "").strip().lower()
            if lang != "workflow":
                continue

            raw = match.group(0)
            code = textwrap.dedent(match.group("code").rstrip("\n\r"))
            position = self._get_position_from_offset(match.start(), len(raw))
            try:
                workflows.append(parse_workflow_content(code, position))
            except InvalidSyntaxError as exc:
                self._handle_error(exc)
        return workflows
