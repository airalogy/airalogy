from __future__ import annotations

from pathlib import Path
from typing import Optional

from airalogy.markdown import AimdParser, AssignerBlockNode, Lexer

from .assigner_base import assigner
from .assigner_result import AssignerResult


def _resolve_protocol_dir(
    aimd_path: Optional[str | Path], protocol_dir: Optional[str | Path]
) -> Optional[Path]:
    if protocol_dir is not None:
        return Path(protocol_dir)
    if aimd_path is None:
        return None
    path = Path(aimd_path)
    if path.is_dir():
        return path
    return path.parent


def load_inline_assigners(
    aimd_content: str,
    namespace: Optional[dict] = None,
    aimd_path: Optional[str | Path] = None,
    protocol_dir: Optional[str | Path] = None,
) -> list[AssignerBlockNode]:
    """
    Execute inline `assigner` code blocks found in AIMD content.

    Args:
        aimd_content: AIMD document content.
        namespace: Optional globals dict for exec. When omitted, a new namespace
            is created and populated with `assigner` and `AssignerResult`.
        aimd_path: Optional AIMD file path used to locate a sibling
            `assigner.py` for conflict detection.
        protocol_dir: Optional protocol directory used to detect `assigner.py`.
            Overrides `aimd_path` when provided.

    Returns:
        List of parsed AssignerBlockNode objects.
    """
    base_dir = _resolve_protocol_dir(aimd_path, protocol_dir)
    if base_dir is not None and (base_dir / "assigner.py").exists():
        raise ValueError(
            "Inline assigner blocks are not allowed when assigner.py exists."
        )

    parser = AimdParser(aimd_content)
    blocks = parser.parse().get("assigners", [])

    exec_globals = {} if namespace is None else namespace
    if "__builtins__" not in exec_globals:
        exec_globals["__builtins__"] = __builtins__

    exec_globals.setdefault("assigner", assigner)
    exec_globals.setdefault("AssignerResult", AssignerResult)

    for index, block in enumerate(blocks, start=1):
        if not block.code.strip():
            continue
        compiled = compile(block.code, f"<aimd-assigner-{index}>", "exec")
        exec(compiled, exec_globals)

    return blocks


def extract_inline_assigner_code_blocks(aimd_content: str) -> list[str]:
    """
    Extract inline assigner code blocks from AIMD content.

    Args:
        aimd_content: AIMD document content.

    Returns:
        List of dedented code strings.
    """
    parser = AimdParser(aimd_content)
    blocks = parser.parse().get("assigners", [])
    return [block.code for block in blocks if block.code.strip()]


def strip_inline_assigner_blocks(aimd_content: str) -> tuple[str, int]:
    """
    Remove inline assigner blocks from AIMD content.

    Args:
        aimd_content: AIMD document content.

    Returns:
        Tuple of (updated_content, removed_block_count).
    """
    removed = 0

    def replacer(match) -> str:
        nonlocal removed
        lang = match.group("lang") or ""
        if lang == "assigner":
            removed += 1
            return ""
        return match.group(0)

    updated = Lexer.CODE_BLOCK_PATTERN.sub(replacer, aimd_content)
    return updated, removed
