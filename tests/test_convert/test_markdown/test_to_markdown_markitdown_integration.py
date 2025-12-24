import zipfile
from io import BytesIO

import pytest

import markitdown  # noqa: F401


def _escape_pdf_text(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def _build_simple_pdf_bytes(text: str) -> bytes:
    escaped = _escape_pdf_text(text)
    stream = f"BT /F1 24 Tf 72 120 Td ({escaped}) Tj ET"

    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    parts: list[bytes] = [header]
    offsets: dict[int, int] = {}

    def add_obj(obj_num: int, body: str) -> None:
        offsets[obj_num] = sum(len(p) for p in parts)
        parts.append(f"{obj_num} 0 obj\n{body}\nendobj\n".encode("utf-8"))

    add_obj(1, "<< /Type /Catalog /Pages 2 0 R >>")
    add_obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    add_obj(
        3,
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] "
        "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> >>",
    )
    add_obj(
        4,
        f"<< /Length {len(stream.encode('utf-8'))} >>\nstream\n{stream}\nendstream",
    )
    add_obj(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    xref_offset = sum(len(p) for p in parts)
    xref_lines = ["xref", "0 6", "0000000000 65535 f "]
    for i in range(1, 6):
        xref_lines.append(f"{offsets[i]:010d} 00000 n ")
    xref = ("\n".join(xref_lines) + "\n").encode("utf-8")
    trailer = (
        f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
    ).encode("utf-8")

    return b"".join(parts) + xref + trailer


def _build_simple_docx_bytes(text: str) -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
""",
        )
        zf.writestr(
            "_rels/.rels",
            """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
""",
        )
        zf.writestr(
            "word/document.xml",
            f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>{text}</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>
""",
        )
        zf.writestr(
            "word/_rels/document.xml.rels",
            """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>
""",
        )
    return buf.getvalue()


def test_to_markdown_pdf_integration():
    from airalogy.convert import to_markdown

    pdf_bytes = _build_simple_pdf_bytes("Hello PDF")
    result = to_markdown(pdf_bytes, filename="hello.pdf", backend="markitdown")
    assert "hello pdf" in result.text.lower()


def test_to_markdown_docx_integration():
    from airalogy.convert import to_markdown

    docx_bytes = _build_simple_docx_bytes("Hello DOCX")
    result = to_markdown(docx_bytes, filename="hello.docx", backend="markitdown")
    assert "hello docx" in result.text.lower()

