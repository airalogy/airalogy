from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal, Optional

AssignerGraphRuntime = Literal["client", "server"]
CLIENT_ASSIGNER_FORBIDDEN_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(
            r"\b(?:import|export|class|new|async|await|yield|throw|try|catch|switch|while|for|do)\b"
        ),
        "contains unsupported control-flow or module syntax",
    ),
    (
        re.compile(r"=>"),
        "does not allow arrow functions",
    ),
    (
        re.compile(
            r"\b(?:window|document|globalThis|self|fetch|XMLHttpRequest|WebSocket|Function|eval|setTimeout|setInterval)\b"
        ),
        "uses blocked runtime globals",
    ),
    (
        re.compile(r"\b(?:__proto__|prototype|constructor|this)\b"),
        "uses blocked object metaprogramming features",
    ),
    (
        re.compile(r"\bMath\s*\.\s*random\b"),
        "must not use randomness",
    ),
    (
        re.compile(r"\bDate\b"),
        "must not use time-dependent APIs",
    ),
]
CODE_BLOCK_PATTERN = re.compile(
    r"```(?P<lang>[a-zA-Z0-9_]*)(?:[ \t]+(?P<meta>[^\n]*))?\n(?P<code>[\s\S]*?)```",
    re.MULTILINE | re.DOTALL,
)


@dataclass
class GraphPosition:
    start_line: int
    end_line: int
    start_col: int
    end_col: int


@dataclass
class AssignerGraphNode:
    id: str
    runtime: AssignerGraphRuntime
    mode: str
    dependent_fields: list[str]
    assigned_fields: list[str]
    position: GraphPosition
    source: str


class AssignerGraphValidationError(ValueError):
    def __init__(self, message: str, node: Optional[AssignerGraphNode] = None):
        super().__init__(message)
        self.node = node


def _position_from_offset(content: str, offset: int, length: int) -> GraphPosition:
    span_text = content[offset : offset + length]
    newlines_in_span = span_text.count("\n")
    start_line = content[:offset].count("\n") + 1
    end_line = start_line + newlines_in_span
    line_start = content.rfind("\n", 0, offset) + 1
    start_col = offset - line_start + 1

    if newlines_in_span > 0:
        last_newline_in_span = span_text.rfind("\n")
        end_col = length - last_newline_in_span - 1
    else:
        end_col = start_col + length - 1

    return GraphPosition(
        start_line=start_line,
        end_line=end_line,
        start_col=start_col,
        end_col=end_col,
    )


def _build_node_key(node: AssignerGraphNode) -> str:
    return f"{node.runtime}:{node.id}"


def _normalize_identifier_list(value: object, context: str) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a list of field ids")

    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f"{context} must contain only non-empty strings")
        field = item.strip()
        if field not in normalized:
            normalized.append(field)
    return normalized


def _parse_js_string_literal(expression: str, context: str) -> str:
    try:
        value = ast.literal_eval(expression)
    except (SyntaxError, ValueError) as exc:
        raise ValueError(f'{context} must be a quoted string literal') from exc
    if not isinstance(value, str):
        raise ValueError(f'{context} must be a quoted string literal')
    return value


def _parse_js_string_array_literal(expression: str, context: str) -> list[str]:
    try:
        value = ast.literal_eval(expression)
    except (SyntaxError, ValueError) as exc:
        raise ValueError(f"{context} must be an array of field ids") from exc
    return _normalize_identifier_list(value, context)


def _split_top_level_segments(source: str, delimiter: str) -> list[str]:
    segments: list[str] = []
    current: list[str] = []
    quote: Optional[str] = None
    depth_paren = 0
    depth_bracket = 0
    depth_brace = 0

    for index, char in enumerate(source):
        prev = source[index - 1] if index > 0 else ""

        if quote is not None:
            current.append(char)
            if char == quote and prev != "\\":
                quote = None
            continue

        if char in ('"', "'"):
            quote = char
            current.append(char)
            continue

        if char == "(":
            depth_paren += 1
            current.append(char)
            continue
        if char == ")":
            depth_paren = max(0, depth_paren - 1)
            current.append(char)
            continue
        if char == "[":
            depth_bracket += 1
            current.append(char)
            continue
        if char == "]":
            depth_bracket = max(0, depth_bracket - 1)
            current.append(char)
            continue
        if char == "{":
            depth_brace += 1
            current.append(char)
            continue
        if char == "}":
            depth_brace = max(0, depth_brace - 1)
            current.append(char)
            continue

        if (
            char == delimiter
            and depth_paren == 0
            and depth_bracket == 0
            and depth_brace == 0
        ):
            segment = "".join(current).strip()
            if segment:
                segments.append(segment)
            current = []
            continue

        current.append(char)

    segment = "".join(current).strip()
    if segment:
        segments.append(segment)
    return segments


def _split_top_level_property(source: str) -> tuple[str, str] | None:
    quote: Optional[str] = None
    depth_paren = 0
    depth_bracket = 0
    depth_brace = 0

    for index, char in enumerate(source):
        prev = source[index - 1] if index > 0 else ""

        if quote is not None:
            if char == quote and prev != "\\":
                quote = None
            continue

        if char in ('"', "'"):
            quote = char
            continue

        if char == "(":
            depth_paren += 1
            continue
        if char == ")":
            depth_paren = max(0, depth_paren - 1)
            continue
        if char == "[":
            depth_bracket += 1
            continue
        if char == "]":
            depth_bracket = max(0, depth_bracket - 1)
            continue
        if char == "{":
            depth_brace += 1
            continue
        if char == "}":
            depth_brace = max(0, depth_brace - 1)
            continue

        if (
            char == ":"
            and depth_paren == 0
            and depth_bracket == 0
            and depth_brace == 0
        ):
            return source[:index].strip(), source[index + 1 :].strip()

    return None


def _parse_config_object_literal(source: str) -> dict[str, str]:
    trimmed = source.strip()
    if not trimmed.startswith("{") or not trimmed.endswith("}"):
        raise ValueError("client assigner config must be an object literal")

    body = trimmed[1:-1].strip()
    if not body:
        raise ValueError("client assigner config must not be empty")

    config: dict[str, str] = {}
    for segment in _split_top_level_segments(body, ","):
        property_parts = _split_top_level_property(segment)
        if property_parts is None:
            raise ValueError("client assigner config entries must use key: value syntax")
        raw_key, raw_value = property_parts
        key = raw_key.strip()
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
            normalized_key = key
        else:
            normalized_key = _parse_js_string_literal(key, 'client assigner "config key"')
        if normalized_key in config:
            raise ValueError(
                f'client assigner config defines "{normalized_key}" more than once'
            )
        config[normalized_key] = raw_value

    return config


def _find_matching_delimiter(
    source: str, start_index: int, open_char: str, close_char: str
) -> int:
    quote: Optional[str] = None
    depth = 0

    for index in range(start_index, len(source)):
        char = source[index]
        prev = source[index - 1] if index > 0 else ""

        if quote is not None:
            if char == quote and prev != "\\":
                quote = None
            continue

        if char in ('"', "'"):
            quote = char
            continue

        if char == open_char:
            depth += 1
            continue
        if char == close_char:
            depth -= 1
            if depth == 0:
                return index

    return -1


def _parse_client_assigner_invocation(code: str) -> tuple[str, str]:
    trimmed = code.strip()
    match = re.match(r"^assigner\s*\(", trimmed)
    if not match:
        raise ValueError(
            "client assigner block must contain exactly one assigner(...) call"
        )

    open_paren_index = trimmed.find("(", match.start())
    close_paren_index = _find_matching_delimiter(trimmed, open_paren_index, "(", ")")
    if close_paren_index == -1:
        raise ValueError('client assigner call is missing a closing ")"')

    trailing = trimmed[close_paren_index + 1 :].strip()
    if trailing and trailing != ";":
        raise ValueError(
            "client assigner block must contain exactly one assigner(...) call"
        )

    args_source = trimmed[open_paren_index + 1 : close_paren_index].strip()
    args = _split_top_level_segments(args_source, ",")
    if len(args) != 2:
        raise ValueError(
            "client assigner call must receive exactly two arguments: config and function"
        )

    return args[0], args[1]


def _parse_client_assigner_function(source: str) -> tuple[str, str]:
    trimmed = source.strip()
    match = re.match(r"^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", trimmed)
    if not match:
        raise ValueError(
            "client assigner second argument must be a named function"
        )

    assigner_id = match.group(1)
    open_paren_index = trimmed.find("(", match.start())
    close_paren_index = _find_matching_delimiter(trimmed, open_paren_index, "(", ")")
    if close_paren_index == -1:
        raise ValueError(
            f'client assigner "{assigner_id}" function parameters are missing a closing ")"'
        )
    params_source = trimmed[open_paren_index + 1 : close_paren_index].strip()
    params = _split_top_level_segments(params_source, ",") if params_source else []
    if len(params) != 1:
        raise ValueError(
            f'client assigner "{assigner_id}" function must accept exactly one dependent_fields parameter'
        )

    body_start = close_paren_index + 1
    while body_start < len(trimmed) and trimmed[body_start].isspace():
        body_start += 1
    if body_start >= len(trimmed) or trimmed[body_start] != "{":
        raise ValueError(
            f'client assigner "{assigner_id}" function must be followed by a body'
        )

    body_end = _find_matching_delimiter(trimmed, body_start, "{", "}")
    if body_end == -1:
        raise ValueError(
            f'client assigner "{assigner_id}" function body is missing a closing "}}"'
        )

    trailing = trimmed[body_end + 1 :].strip()
    if trailing:
        raise ValueError(
            f'client assigner "{assigner_id}" function must not contain trailing statements'
        )

    return assigner_id, trimmed


def _validate_client_assigner_function_source(
    function_source: str, assigner_id: str
) -> None:
    matches = re.findall(r"\bfunction\b", function_source)
    if len(matches) != 1:
        raise ValueError(
            f'client assigner "{assigner_id}" must contain exactly one function definition'
        )

    for pattern, message in CLIENT_ASSIGNER_FORBIDDEN_PATTERNS:
        if pattern.search(function_source):
            raise ValueError(f'client assigner "{assigner_id}" {message}')

    if not re.search(r"\breturn\b", function_source):
        raise ValueError(
            f'client assigner "{assigner_id}" must return an object containing assigned field values'
        )


def _parse_client_assigner_block(
    code: str, position: GraphPosition, source: str
) -> AssignerGraphNode:
    config_source, function_source = _parse_client_assigner_invocation(code)
    assigner_id, normalized_function_source = _parse_client_assigner_function(
        function_source
    )
    _validate_client_assigner_function_source(
        normalized_function_source, assigner_id
    )
    config = _parse_config_object_literal(config_source)

    allowed_keys = {"mode", "dependent_fields", "assigned_fields"}
    for key in config:
        if key not in allowed_keys:
            raise ValueError(
                f'client assigner "{assigner_id}" does not support config key "{key}"'
            )

    mode = _parse_js_string_literal(
        config.get("mode", ""),
        f'client assigner "{assigner_id}" mode',
    )
    if mode not in ("auto", "auto_first", "manual"):
        raise ValueError(
            f'client assigner "{assigner_id}" only supports mode "auto", "auto_first", or "manual"'
        )

    assigned_fields = _parse_js_string_array_literal(
        config.get("assigned_fields", ""),
        f'client assigner "{assigner_id}" assigned_fields',
    )
    dependent_fields = _parse_js_string_array_literal(
        config.get("dependent_fields", ""),
        f'client assigner "{assigner_id}" dependent_fields',
    )

    if not assigned_fields:
        raise ValueError(
            f'client assigner "{assigner_id}" must define at least one assigned field'
        )
    if not dependent_fields and mode != "manual":
        raise ValueError(
            f'client assigner "{assigner_id}" must define at least one dependent field'
        )

    return AssignerGraphNode(
        id=assigner_id,
        runtime="client",
        mode=mode,
        dependent_fields=dependent_fields,
        assigned_fields=assigned_fields,
        position=position,
        source=source,
    )


def _decorator_target_is_assigner(node: ast.AST) -> bool:
    if isinstance(node, ast.Name):
        return node.id == "assigner"
    if isinstance(node, ast.Attribute):
        return node.attr == "assigner"
    return False


def _parse_string_list_literal(node: ast.AST, context: str) -> list[str]:
    if not isinstance(node, (ast.List, ast.Tuple)):
        raise ValueError(f"{context} must be a Python list of string field ids")

    values: list[str] = []
    for element in node.elts:
        if not isinstance(element, ast.Constant) or not isinstance(element.value, str):
            raise ValueError(f"{context} must contain only string field ids")
        value = element.value.strip()
        if not value:
            raise ValueError(f"{context} must not contain empty field ids")
        if value not in values:
            values.append(value)
    return values


def _parse_string_literal(node: ast.AST, context: str) -> str:
    if not isinstance(node, ast.Constant) or not isinstance(node.value, str):
        raise ValueError(f"{context} must be a string literal")
    return node.value


def _iter_server_assigner_nodes_from_module(
    module: ast.Module,
    *,
    code_start_line: int,
    source: str,
) -> Iterable[AssignerGraphNode]:
    class Visitor(ast.NodeVisitor):
        def __init__(self):
            self.class_stack: list[str] = []
            self.nodes: list[AssignerGraphNode] = []

        def visit_ClassDef(self, node: ast.ClassDef):
            self.class_stack.append(node.name)
            self.generic_visit(node)
            self.class_stack.pop()

        def visit_FunctionDef(self, node: ast.FunctionDef):
            self._maybe_collect(node)
            self.generic_visit(node)

        def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
            self._maybe_collect(node)
            self.generic_visit(node)

        def _maybe_collect(self, node: ast.FunctionDef | ast.AsyncFunctionDef):
            for decorator in node.decorator_list:
                if not isinstance(decorator, ast.Call):
                    continue
                if not _decorator_target_is_assigner(decorator.func):
                    continue

                keywords = {
                    keyword.arg: keyword.value
                    for keyword in decorator.keywords
                    if keyword.arg
                }
                assigner_id = ".".join([*self.class_stack, node.name])
                assigned_fields = _parse_string_list_literal(
                    keywords.get("assigned_fields", ast.List(elts=[], ctx=ast.Load())),
                    f'server assigner "{assigner_id}" assigned_fields',
                )
                dependent_fields = _parse_string_list_literal(
                    keywords.get(
                        "dependent_fields",
                        ast.List(elts=[], ctx=ast.Load()),
                    ),
                    f'server assigner "{assigner_id}" dependent_fields',
                )
                mode = (
                    _parse_string_literal(
                        keywords["mode"],
                        f'server assigner "{assigner_id}" mode',
                    )
                    if "mode" in keywords
                    else "auto_first"
                )

                if not assigned_fields:
                    raise ValueError(
                        f'server assigner "{assigner_id}" must define at least one assigned field'
                    )
                if not dependent_fields and mode not in ("manual", "manual_readonly"):
                    raise ValueError(
                        f'server assigner "{assigner_id}" must define at least one dependent field'
                    )

                start_line = code_start_line + getattr(node, "lineno", 1)
                end_line = code_start_line + getattr(
                    node, "end_lineno", getattr(node, "lineno", 1)
                )
                start_col = getattr(node, "col_offset", 0) + 1
                end_col = getattr(node, "end_col_offset", start_col) or start_col

                self.nodes.append(
                    AssignerGraphNode(
                        id=assigner_id,
                        runtime="server",
                        mode=mode,
                        dependent_fields=dependent_fields,
                        assigned_fields=assigned_fields,
                        position=GraphPosition(
                            start_line=start_line,
                            end_line=end_line,
                            start_col=start_col,
                            end_col=end_col,
                        ),
                        source=source,
                    )
                )
                break

    visitor = Visitor()
    visitor.visit(module)
    return visitor.nodes


def extract_server_assigner_graph_nodes_from_python(
    code: str,
    *,
    code_start_line: int = 0,
    source: str = "assigner",
) -> list[AssignerGraphNode]:
    try:
        module = ast.parse(code)
    except SyntaxError as exc:
        raise ValueError(f"Invalid Python assigner syntax in {source}: {exc.msg}") from exc

    return list(
        _iter_server_assigner_nodes_from_module(
            module,
            code_start_line=code_start_line,
            source=source,
        )
    )


def extract_assigner_graph_nodes_from_aimd(aimd_content: str) -> list[AssignerGraphNode]:
    nodes: list[AssignerGraphNode] = []

    for match in CODE_BLOCK_PATTERN.finditer(aimd_content):
        lang = (match.group("lang") or "").strip().lower()
        if lang != "assigner":
            continue

        meta = (match.group("meta") or "").strip()
        code = match.group("code").rstrip("\n\r")
        position = _position_from_offset(aimd_content, match.start(), len(match.group(0)))
        code_start_line = position.start_line

        if re.search(
            r"""(?:^|\s)runtime\s*=\s*(?:"client"|'client'|client)(?:\s|$)""",
            meta,
        ):
            nodes.append(
                _parse_client_assigner_block(
                    code,
                    position,
                    "protocol.aimd",
                )
            )
            continue

        nodes.extend(
            extract_server_assigner_graph_nodes_from_python(
                code,
                code_start_line=code_start_line,
                source="protocol.aimd",
            )
        )

    return nodes


def extract_server_assigner_graph_nodes_from_file(path: str | Path) -> list[AssignerGraphNode]:
    file_path = Path(path)
    code = file_path.read_text(encoding="utf-8")
    return extract_server_assigner_graph_nodes_from_python(
        code,
        source=str(file_path.name),
    )


def validate_assigner_graph(nodes: list[AssignerGraphNode]) -> None:
    assigner_keys: set[str] = set()
    assigned_field_owners: dict[str, AssignerGraphNode] = {}

    for node in nodes:
        node_key = _build_node_key(node)
        if node_key in assigner_keys:
            raise AssignerGraphValidationError(
                f'duplicate {node.runtime} assigner id: {node.id}',
                node,
            )
        assigner_keys.add(node_key)

        for field in node.assigned_fields:
            existing_owner = assigned_field_owners.get(field)
            if existing_owner is not None:
                raise AssignerGraphValidationError(
                    f'assigned field "{field}" is already handled by {existing_owner.runtime} assigner "{existing_owner.id}"',
                    node,
                )
            assigned_field_owners[field] = node

    dependency_graph: dict[str, set[str]] = {}
    node_by_key = {_build_node_key(node): node for node in nodes}

    for node in nodes:
        node_key = _build_node_key(node)
        dependencies: set[str] = set()
        for field in node.dependent_fields:
            owner = assigned_field_owners.get(field)
            if owner is not None and _build_node_key(owner) != node_key:
                dependencies.add(_build_node_key(owner))
        dependency_graph[node_key] = dependencies

    visiting: set[str] = set()
    visited: set[str] = set()

    def dfs(node_key: str, trail: list[str]) -> None:
        if node_key in visited:
            return
        if node_key in visiting:
            cycle_start = trail.index(node_key)
            cycle = [*trail[cycle_start:], node_key]
            cycle_str = " -> ".join(cycle)
            raise AssignerGraphValidationError(
                f"Circular dependency detected: {cycle_str}",
                node_by_key.get(node_key),
            )

        visiting.add(node_key)
        next_trail = [*trail, node_key]
        for dependency in dependency_graph.get(node_key, set()):
            dfs(dependency, next_trail)
        visiting.remove(node_key)
        visited.add(node_key)

    for node in nodes:
        dfs(_build_node_key(node), [])
