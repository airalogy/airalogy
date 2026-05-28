from __future__ import annotations

from typing import Any

from airalogy import Airalogy
from airalogy.assigner import AssignerResult, assigner


AIRALOGY_CLIENT = Airalogy()

_DEFAULT_BACKEND = "markitdown"

def _to_markdown(file_id: str) -> tuple[str, str, list[str]]:
    try:
        from airalogy.convert import to_markdown
    except ImportError as exc:
        raise RuntimeError(
            "Document conversion API is unavailable in this runtime. "
            "Please upgrade Airalogy to a version that provides `airalogy.convert.to_markdown`, "
            "and install `airalogy[markitdown]` for PDF/DOCX support. "
            f"Import error: {exc}"
        ) from exc

    result = to_markdown(file_id, backend=_DEFAULT_BACKEND, client=AIRALOGY_CLIENT)
    source_filename = result.source_filename or file_id
    warnings: list[str] = list(getattr(result, "warnings", None) or [])
    text = (result.text or "").strip()
    return text, source_filename, warnings


@assigner(
    assigned_fields=["docx_markdown_text", "docx_source_filename", "docx_warnings"],
    dependent_fields=["docx_file_id"],
    mode="manual",
)
def convert_docx(dependent_fields: dict[str, Any]) -> AssignerResult:
    docx_file_id = (dependent_fields.get("docx_file_id") or "").strip()

    if not docx_file_id:
        return AssignerResult(
            success=False,
            error_message="No DOCX uploaded. Please upload a `.docx` document.",
        )

    try:
        text, source_filename, warnings = _to_markdown(docx_file_id)
    except Exception as exc:
        return AssignerResult(
            success=False,
            error_message=(
                f"DOCX conversion failed for {docx_file_id} with backend={_DEFAULT_BACKEND!r}: {exc}"
            ),
        )

    return AssignerResult(
        assigned_fields={
            "docx_markdown_text": text,
            "docx_source_filename": source_filename,
            "docx_warnings": warnings,
        }
    )


@assigner(
    assigned_fields=["pdf_markdown_text", "pdf_source_filename", "pdf_warnings"],
    dependent_fields=["pdf_file_id"],
    mode="manual",
)
def convert_pdf(dependent_fields: dict[str, Any]) -> AssignerResult:
    pdf_file_id = (dependent_fields.get("pdf_file_id") or "").strip()

    if not pdf_file_id:
        return AssignerResult(
            success=False,
            error_message="No PDF uploaded. Please upload a `.pdf` document.",
        )

    try:
        text, source_filename, warnings = _to_markdown(pdf_file_id)
    except Exception as exc:
        return AssignerResult(
            success=False,
            error_message=(
                f"PDF conversion failed for {pdf_file_id} with backend={_DEFAULT_BACKEND!r}: {exc}"
            ),
        )

    return AssignerResult(
        assigned_fields={
            "pdf_markdown_text": text,
            "pdf_source_filename": source_filename,
            "pdf_warnings": warnings,
        }
    )
