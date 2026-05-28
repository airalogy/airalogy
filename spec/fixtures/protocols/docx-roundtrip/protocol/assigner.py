from __future__ import annotations

import io
from typing import Any

from airalogy import Airalogy
from airalogy.assigner import AssignerResult, assigner

AIRALOGY_CLIENT = Airalogy()
_DEFAULT_BACKEND = "markitdown"


def _to_markdown(file_id: str) -> str:
    try:
        from airalogy.convert import to_markdown
    except ImportError as exc:
        raise RuntimeError(
            "Document conversion API is unavailable in this runtime. "
            "Please upgrade Airalogy to a version that provides `airalogy.convert.to_markdown`, "
            "and install `airalogy[markitdown]` for DOCX support. "
            f"Import error: {exc}"
        ) from exc

    result = to_markdown(file_id, backend=_DEFAULT_BACKEND, client=AIRALOGY_CLIENT)
    return (result.text or "").strip()


def _process_text(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""

    upper_text = text.upper()
    lines = upper_text.splitlines()
    processed_lines = []
    for line in lines:
        processed_lines.append("*".join(list(line)) if line else "")

    return "[PROCESSED]\n" + "\n".join(processed_lines)


def _build_docx_bytes(text: str) -> bytes:
    try:
        from docx import Document
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency `python-docx`. Install it to enable DOCX export."
        ) from exc

    doc = Document()
    lines = text.splitlines() or [""]
    for line in lines:
        doc.add_paragraph(line)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _build_pdf_bytes(text: str) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency `reportlab`. Install it to enable PDF export."
        ) from exc

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    _width, height = A4
    x = 72
    y = height - 72
    line_height = 14

    for line in text.splitlines() or [""]:
        if y < 72:
            c.showPage()
            y = height - 72
        c.drawString(x, y, line)
        y -= line_height

    c.save()
    return buf.getvalue()


@assigner(
    assigned_fields=["extracted_text"],
    dependent_fields=["source_docx"],
    mode="auto",
)
def extract_docx_text(dependent_fields: dict[str, Any]) -> AssignerResult:
    docx_file_id = (dependent_fields.get("source_docx") or "").strip()

    if not docx_file_id:
        return AssignerResult(
            success=False,
            error_message="No DOCX uploaded. Please upload a `.docx` document.",
        )

    try:
        text = _to_markdown(docx_file_id)
    except Exception as exc:
        return AssignerResult(
            success=False,
            error_message=(
                f"DOCX conversion failed for {docx_file_id} with backend={_DEFAULT_BACKEND!r}: {exc}"
            ),
        )

    return AssignerResult(
        assigned_fields={
            "extracted_text": text,
        }
    )


@assigner(
    assigned_fields=["processed_text", "output_docx", "output_pdf"],
    dependent_fields=["extracted_text"],
    mode="auto",
)
def process_and_export(dependent_fields: dict[str, Any]) -> AssignerResult:
    extracted_text = (dependent_fields.get("extracted_text") or "").strip()

    if not extracted_text:
        return AssignerResult(
            success=False,
            error_message="Extracted text is empty. Please upload a DOCX with readable text.",
        )

    processed_text = _process_text(extracted_text)

    try:
        docx_bytes = _build_docx_bytes(processed_text)
        docx_file = AIRALOGY_CLIENT.upload_file_bytes(
            file_name="processed_text.docx", file_bytes=docx_bytes
        )

        pdf_bytes = _build_pdf_bytes(processed_text)
        pdf_file = AIRALOGY_CLIENT.upload_file_bytes(
            file_name="processed_text.pdf", file_bytes=pdf_bytes
        )
    except Exception as exc:
        return AssignerResult(
            success=False,
            error_message=f"Export failed: {exc}",
        )

    return AssignerResult(
        assigned_fields={
            "processed_text": processed_text,
            "output_docx": docx_file["id"],
            "output_pdf": pdf_file["id"],
        }
    )
