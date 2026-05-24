import json

import pytest

from airalogy.ingest import import_records


def test_import_records_from_csv_for_protocol(tmp_path):
    protocol_dir = tmp_path / "protocol_demo"
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text(
        """
{{var|sample_id: str}}
{{var|temperature_c: float}}
{{var|passed: bool}}
{{step|prepare, check=True}}
{{check|qc}}

```quiz
id: quiz_choice_1
type: choice
mode: single
stem: Pick one
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
```
""",
        encoding="utf-8",
    )
    (protocol_dir / "protocol.toml").write_text(
        "\n".join(
            [
                "[airalogy_protocol]",
                'id = "protocol_demo"',
                'version = "0.1.0"',
            ]
        ),
        encoding="utf-8",
    )
    input_path = tmp_path / "records.csv"
    input_path.write_text(
        "\n".join(
            [
                "sample_id,temperature_c,passed,quiz.quiz_choice_1,"
                "step.prepare.checked,check.qc.annotation",
                "S1,37.5,true,A,true,reviewed",
            ]
        ),
        encoding="utf-8",
    )

    result = import_records(protocol_dir=protocol_dir, input_path=input_path)

    assert result.ok is True
    assert len(result.records) == 1
    record = result.records[0]
    assert record["record_id"]
    assert record["record_version"] == 1
    assert record["metadata"]["protocol_id"] == "protocol_demo"
    assert record["metadata"]["protocol_version"] == "0.1.0"
    assert record["metadata"]["sha1"]
    assert record["data"]["var"] == {
        "sample_id": "S1",
        "temperature_c": 37.5,
        "passed": True,
    }
    assert record["data"]["quiz"] == {"quiz_choice_1": "A"}
    assert record["data"]["step"] == {
        "prepare": {"annotation": "", "checked": True}
    }
    assert record["data"]["check"] == {
        "qc": {"annotation": "reviewed", "checked": False}
    }


def test_import_records_reports_var_validation_errors():
    result = import_records(
        aimd_content="{{var|age: int}}",
        rows=[{"age": "not-an-int"}],
    )

    assert result.ok is False
    assert result.records == []
    assert len(result.errors) == 1
    assert result.errors[0].row_number == 1
    assert result.errors[0].column == "age"


def test_import_records_rejects_unknown_var_fields_by_default():
    result = import_records(
        aimd_content="{{var|age: int}}",
        rows=[{"age": "42", "extra": "value"}],
    )

    assert result.ok is False
    assert result.records == []
    assert result.errors[0].column == "extra"


def test_import_records_writes_jsonl(tmp_path):
    output_path = tmp_path / "records.jsonl"

    result = import_records(
        aimd_content="{{var|sample_id: str}}",
        rows=[{"sample_id": "S1"}, {"sample_id": "S2"}],
        output_path=output_path,
    )

    assert result.ok is True
    lines = output_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    assert [json.loads(line)["data"]["var"]["sample_id"] for line in lines] == [
        "S1",
        "S2",
    ]


def test_import_records_merges_aimd_vars_missing_from_model_py(tmp_path):
    protocol_dir = tmp_path / "protocol_demo"
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text(
        "{{var|name: str}}\n{{var|age: int}}\n",
        encoding="utf-8",
    )
    (protocol_dir / "model.py").write_text(
        "\n".join(
            [
                "from pydantic import BaseModel",
                "",
                "class VarModel(BaseModel):",
                "    name: str",
            ]
        ),
        encoding="utf-8",
    )

    result = import_records(
        protocol_dir=protocol_dir,
        rows=[{"name": "Alice", "age": "42"}],
    )

    assert result.ok is True
    assert result.records[0]["data"]["var"] == {
        "name": "Alice",
        "age": 42,
    }


def test_import_records_rejects_model_py_extra_fields(tmp_path):
    protocol_dir = tmp_path / "protocol_demo"
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text(
        "{{var|sample_id: str}}\n",
        encoding="utf-8",
    )
    (protocol_dir / "model.py").write_text(
        "\n".join(
            [
                "from pydantic import BaseModel",
                "",
                "class VarModel(BaseModel):",
                "    operator_id: int",
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="not AIMD vars: operator_id"):
        import_records(
            protocol_dir=protocol_dir,
            rows=[{"sample_id": "S1", "operator_id": "7"}],
        )


def test_import_records_rejects_model_py_type_mismatch(tmp_path):
    protocol_dir = tmp_path / "protocol_demo"
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text("{{var|age: int}}\n", encoding="utf-8")
    (protocol_dir / "model.py").write_text(
        "\n".join(
            [
                "from pydantic import BaseModel",
                "",
                "class VarModel(BaseModel):",
                "    age: str",
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="field 'age' AIMD type is int"):
        import_records(protocol_dir=protocol_dir, rows=[{"age": "42"}])


def test_import_records_can_skip_model_sync_check(tmp_path):
    protocol_dir = tmp_path / "protocol_demo"
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text("{{var|age: int}}\n", encoding="utf-8")
    (protocol_dir / "model.py").write_text(
        "\n".join(
            [
                "from pydantic import BaseModel",
                "",
                "class VarModel(BaseModel):",
                "    age: str",
            ]
        ),
        encoding="utf-8",
    )

    result = import_records(
        protocol_dir=protocol_dir,
        rows=[{"age": "42"}],
        validate_model_sync=False,
    )

    assert result.ok is True
    assert result.records[0]["data"]["var"]["age"] == "42"
