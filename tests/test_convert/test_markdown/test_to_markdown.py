import pytest


def test_to_markdown_unknown_backend():
    from airalogy.convert import to_markdown

    with pytest.raises(ValueError, match="Unknown backend"):
        to_markdown(b"hello", filename="note.txt", backend="nope")


def test_to_markdown_markitdown_missing(monkeypatch):
    import airalogy.convert.markdown as markdown_module

    def raise_import_error(_: str):
        raise ImportError("No module named markitdown")

    monkeypatch.setattr(markdown_module.importlib, "import_module", raise_import_error)

    with pytest.raises(ImportError) as exc_info:
        markdown_module.to_markdown(b"hello", filename="note.txt", backend="markitdown")

    message = str(exc_info.value)
    assert "airalogy[markitdown]" in message
