"""Reference parsing helpers for AIMD refs blocks."""

import re
from typing import Dict, List, Optional, Tuple

from ..ast_nodes import ReferenceNode
from ..tokens import Position


def _split_bibtex_entries(content: str) -> List[str]:
    entries: List[str] = []
    index = 0

    while index < len(content):
        at_index = content.find("@", index)
        if at_index == -1:
            break

        open_index = -1
        for cursor in range(at_index + 1, len(content)):
            char = content[cursor]
            if char in "{(":
                open_index = cursor
                break
            if not re.match(r"[\w\s-]", char):
                break

        if open_index == -1:
            index = at_index + 1
            continue

        open_char = content[open_index]
        close_char = "}" if open_char == "{" else ")"
        depth = 0
        quote = False
        escaped = False
        close_index = -1

        for cursor in range(open_index, len(content)):
            char = content[cursor]

            if escaped:
                escaped = False
                continue

            if char == "\\":
                escaped = True
                continue

            if char == '"':
                quote = not quote
                continue

            if quote:
                continue

            if char == open_char:
                depth += 1
                continue

            if char == close_char:
                depth -= 1
                if depth == 0:
                    close_index = cursor
                    break

        if close_index == -1:
            entries.append(content[at_index:].strip())
            break

        entries.append(content[at_index : close_index + 1].strip())
        index = close_index + 1

    return [entry for entry in entries if entry]


def _strip_bibtex_outer(value: str) -> str:
    trimmed = value.strip()
    while (
        (trimmed.startswith("{") and trimmed.endswith("}"))
        or (trimmed.startswith('"') and trimmed.endswith('"'))
    ):
        trimmed = trimmed[1:-1].strip()
    return trimmed


def _normalize_bibtex_value(value: str) -> str:
    stripped = _strip_bibtex_outer(value)
    stripped = re.sub(r"\\([\"'{}])", r"\1", stripped)
    stripped = stripped.replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", stripped).strip()


def _read_bibtex_value(body: str, start_index: int) -> Tuple[str, int]:
    index = start_index
    while index < len(body) and body[index].isspace():
        index += 1

    if index >= len(body):
        return "", index

    opener = body[index]
    if opener in '{"':
        closer = "}" if opener == "{" else '"'
        depth = 1 if opener == "{" else 0
        escaped = False
        cursor = index + 1

        while cursor < len(body):
            char = body[cursor]

            if escaped:
                escaped = False
                cursor += 1
                continue

            if char == "\\":
                escaped = True
                cursor += 1
                continue

            if opener == "{" and char == "{":
                depth += 1
                cursor += 1
                continue

            if char == closer:
                if opener == '"':
                    return body[index : cursor + 1], cursor + 1

                depth -= 1
                if depth == 0:
                    return body[index : cursor + 1], cursor + 1

            cursor += 1

        return body[index:], len(body)

    cursor = index
    while cursor < len(body) and body[cursor] != ",":
        cursor += 1
    return body[index:cursor], cursor


def _parse_bibtex_fields(body: str) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    index = 0

    while index < len(body):
        while index < len(body) and (body[index].isspace() or body[index] == ","):
            index += 1

        if index >= len(body):
            break

        key_match = re.match(r"([A-Za-z][\w-]*)\s*=", body[index:])
        if not key_match:
            break

        key = key_match.group(1).lower()
        index += len(key_match.group(0))
        raw_value, index = _read_bibtex_value(body, index)
        value = _normalize_bibtex_value(raw_value)
        if value:
            fields[key] = value

        while index < len(body) and body[index].isspace():
            index += 1
        if index < len(body) and body[index] == ",":
            index += 1

    return fields


def _parse_bibtex_entry(raw_entry: str, position: Position) -> Optional[ReferenceNode]:
    raw = raw_entry.strip()
    entry_match = re.match(r"^@([A-Za-z][\w-]*)\s*([({])", raw)
    if not entry_match:
        return None

    entry_type = entry_match.group(1).lower()
    open_index = raw.find(entry_match.group(2), len(entry_match.group(0)) - 1)
    close_index = len(raw) - 1
    if open_index == -1 or close_index <= open_index:
        return None

    body = raw[open_index + 1 : close_index].strip()
    comma_index = body.find(",")
    if comma_index == -1:
        return None

    ref_id = body[:comma_index].strip()
    if not ref_id:
        return None

    fields = _parse_bibtex_fields(body[comma_index + 1 :])
    return ReferenceNode(
        position=position,
        id=ref_id,
        entry_type=entry_type,
        raw=raw,
        fields=fields,
        title=fields.get("title"),
        author=fields.get("author"),
        year=fields.get("year"),
        journal=fields.get("journal"),
        booktitle=fields.get("booktitle"),
        publisher=fields.get("publisher"),
        doi=fields.get("doi"),
        url=fields.get("url"),
    )


def parse_refs_content(content: str, position: Position) -> List[ReferenceNode]:
    """Parse refs code block content in BibTeX format."""
    entries = []
    for raw_entry in _split_bibtex_entries(content):
        entry = _parse_bibtex_entry(raw_entry, position)
        if entry is not None:
            entries.append(entry)
    return entries
