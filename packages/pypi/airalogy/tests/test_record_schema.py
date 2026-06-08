import json
from pathlib import Path

from airalogy.record.schema import (
    RECORD_FORMAT,
    RECORD_SCHEMA_VERSION,
    inspect_record_file,
    validate_record_file,
)


def _write_protocol(protocol_dir: Path) -> None:
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text(
        "# Sample Protocol\n\n{{var|sample_id: str}}\n{{var|amount: int}}\n",
        encoding="utf-8",
    )
    (protocol_dir / "protocol.toml").write_text(
        "\n".join(
            [
                "[airalogy_protocol]",
                'id = "sample_protocol"',
                'version = "0.1.0"',
                "",
            ]
        ),
        encoding="utf-8",
    )


def _write_other_protocol(protocol_dir: Path) -> None:
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text(
        "# Other Protocol\n\n{{var|operator: str}}\n",
        encoding="utf-8",
    )
    (protocol_dir / "protocol.toml").write_text(
        "\n".join(
            [
                "[airalogy_protocol]",
                'id = "other_protocol"',
                'version = "0.1.0"',
                "",
            ]
        ),
        encoding="utf-8",
    )


def test_validate_record_file_against_protocol(tmp_path: Path):
    protocol_dir = tmp_path / "protocol"
    _write_protocol(protocol_dir)
    record_path = tmp_path / "record.json"
    record_path.write_text(
        json.dumps(
            {
                "format": RECORD_FORMAT,
                "schema_version": RECORD_SCHEMA_VERSION,
                "record_id": "11111111-1111-4111-8111-111111111111",
                "record_version": 1,
                "metadata": {
                    "protocol_id": "sample_protocol",
                    "protocol_version": "0.1.0",
                },
                "data": {
                    "var": {"sample_id": "S1", "amount": 12},
                    "step": {},
                    "check": {},
                    "quiz": {},
                },
            }
        ),
        encoding="utf-8",
    )

    result = validate_record_file(record_path, protocol_dir=protocol_dir)

    assert result.ok
    assert result.issues == []


def test_validate_record_file_matches_multiple_protocol_dirs(tmp_path: Path):
    protocol_a = tmp_path / "protocol_a"
    protocol_b = tmp_path / "protocol_b"
    _write_protocol(protocol_a)
    _write_other_protocol(protocol_b)
    record_path = tmp_path / "records.json"
    record_path.write_text(
        json.dumps(
            [
                {
                    "metadata": {
                        "protocol_id": "sample_protocol",
                        "protocol_version": "0.1.0",
                    },
                    "data": {"var": {"sample_id": "S1", "amount": 12}},
                },
                {
                    "metadata": {
                        "protocol_id": "other_protocol",
                        "protocol_version": "0.1.0",
                    },
                    "data": {"var": {"operator": "Ada"}},
                },
            ]
        ),
        encoding="utf-8",
    )

    result = validate_record_file(record_path, protocol_dir=[protocol_a, protocol_b])

    assert result.ok
    assert result.issues == []


def test_validate_record_file_reports_protocol_mismatch(tmp_path: Path):
    protocol_dir = tmp_path / "protocol"
    _write_protocol(protocol_dir)
    record_path = tmp_path / "record.json"
    record_path.write_text(
        json.dumps(
            {
                "metadata": {
                    "protocol_id": "sample_protocol",
                    "protocol_version": "0.1.0",
                },
                "data": {
                    "var": {"sample_id": "S1", "extra": "not in protocol"},
                },
            }
        ),
        encoding="utf-8",
    )

    result = validate_record_file(record_path, protocol_dir=protocol_dir)

    assert not result.ok
    assert any("amount" in issue and "Field required" in issue for issue in result.issues)
    assert any("unknown fields" in issue and "extra" in issue for issue in result.issues)


def test_inspect_record_file_summary(tmp_path: Path):
    record_path = tmp_path / "records.json"
    record_path.write_text(
        json.dumps(
            {
                "records": [
                    {
                        "record_id": "11111111-1111-4111-8111-111111111111",
                        "record_version": 1,
                        "metadata": {
                            "protocol_id": "sample_protocol",
                            "protocol_version": "0.1.0",
                        },
                        "data": {"var": {"sample_id": "S1"}},
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    summary = inspect_record_file(record_path)

    assert summary["record_count"] == 1
    assert summary["record_ids"] == ["11111111-1111-4111-8111-111111111111"]
    assert summary["protocol_ids"] == ["sample_protocol"]
    assert summary["data_sections"] == ["var"]
