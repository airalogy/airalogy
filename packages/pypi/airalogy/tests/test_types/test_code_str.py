from pydantic import BaseModel

from airalogy.types import CodeStr, PyStr


class CodeStrModel(BaseModel):
    generic_code: CodeStr
    python_code: PyStr


def test_code_str_stores_plain_string_values():
    model = CodeStrModel(generic_code="echo hello", python_code="print('hello')")

    assert model.generic_code == "echo hello"
    assert model.python_code == "print('hello')"


def test_code_str_schema_uses_plaintext_code_metadata():
    schema = CodeStrModel.model_json_schema()
    generic_code_schema = schema["properties"]["generic_code"]
    python_code_schema = schema["properties"]["python_code"]

    assert generic_code_schema["type"] == "string"
    assert generic_code_schema["airalogy_type"] == "CodeStr"
    assert generic_code_schema["language"] == "plaintext"
    assert python_code_schema["airalogy_type"] == "CodeStr"
    assert python_code_schema["language"] == "python"
