"""
Tests for CLI module.
"""

import json
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from airalogy import __version__


def test_cli_help():
    """Test CLI help command."""
    result = subprocess.run(
        [sys.executable, "-m", "airalogy.cli", "--help"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert "airalogy" in result.stdout
    assert "check" in result.stdout
    assert "generate_model" in result.stdout
    assert "generate_assigner" in result.stdout
    assert "pack" in result.stdout
    assert "unpack" in result.stdout
    assert "import-records" in result.stdout
    assert "record" in result.stdout


def test_cli_version():
    """Test CLI version command."""
    result = subprocess.run(
        [sys.executable, "-m", "airalogy.cli", "--version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert __version__ in result.stdout


def test_check_command_valid_file():
    """Test check command with valid AIMD file."""
    with TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "test.aimd"
        test_file.write_text("{{var|test_var}}\n{{step|test_step}}")

        result = subprocess.run(
            [sys.executable, "-m", "airalogy.cli", "check", str(test_file)],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "Syntax check passed" in result.stdout


def test_check_command_invalid_file():
    """Test check command with invalid AIMD file."""
    with TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "test.aimd"
        test_file.write_text("{{var|_invalid}}")  # Invalid: starts with underscore

        result = subprocess.run(
            [sys.executable, "-m", "airalogy.cli", "check", str(test_file)],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 1
        assert "Syntax check failed" in result.stderr
        assert "underscore" in result.stderr


def test_check_command_detects_model_py_mismatch():
    """Test check command validates protocol.aimd against model.py when present."""
    with TemporaryDirectory() as tmpdir:
        protocol_dir = Path(tmpdir)
        test_file = protocol_dir / "protocol.aimd"
        test_file.write_text("{{var|age: int}}\n")
        (protocol_dir / "model.py").write_text(
            "\n".join(
                [
                    "from pydantic import BaseModel",
                    "",
                    "class VarModel(BaseModel):",
                    "    age: str",
                ]
            )
        )

        result = subprocess.run(
            [sys.executable, "-m", "airalogy.cli", "check", str(test_file)],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 1
        assert "model.py: VarModel is incompatible" in result.stderr
        assert "field 'age' AIMD type is int" in result.stderr


def test_check_command_nonexistent_file():
    """Test check command with non-existent file."""
    result = subprocess.run(
        [sys.executable, "-m", "airalogy.cli", "check", "nonexistent.aimd"],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "not found" in result.stderr


def test_check_command_alias():
    """Test check command with alias 'c'."""
    with TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "test.aimd"
        test_file.write_text("{{var|test}}")

        result = subprocess.run(
            [sys.executable, "-m", "airalogy.cli", "c", str(test_file)],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0


def test_generate_command():
    """Test generate_model command."""
    with TemporaryDirectory() as tmpdir:
        input_file = Path(tmpdir) / "protocol.aimd"
        output_file = Path(tmpdir) / "model.py"

        input_file.write_text(
            """
{{var|name: str}}
{{var|age: int}}
{{var|user_id: UserName}}
"""
        )

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "generate_model",
                str(input_file),
                "-o",
                str(output_file),
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert output_file.exists()

        content = output_file.read_text()
        assert "class VarModel(BaseModel):" in content
        assert "class QuizModel(BaseModel):" not in content
        assert "name: str" in content
        assert "age: int" in content
        assert "user_id: UserName" in content
        assert "from airalogy.types import UserName" in content


def test_generate_command_overwrite_protection():
    """Test that generate_model doesn't overwrite existing files without -f."""
    with TemporaryDirectory() as tmpdir:
        input_file = Path(tmpdir) / "protocol.aimd"
        output_file = Path(tmpdir) / "model.py"

        input_file.write_text("{{var|test}}")
        output_file.write_text("# existing file")

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "generate_model",
                str(input_file),
                "-o",
                str(output_file),
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 1
        assert "already exists" in result.stderr
        assert "# existing file" == output_file.read_text()


def test_generate_command_force_overwrite():
    """Test that generate_model overwrites with -f flag."""
    with TemporaryDirectory() as tmpdir:
        input_file = Path(tmpdir) / "protocol.aimd"
        output_file = Path(tmpdir) / "model.py"

        input_file.write_text("{{var|test: str}}")
        output_file.write_text("# existing file")

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "generate_model",
                str(input_file),
                "-o",
                str(output_file),
                "-f",
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        content = output_file.read_text()
        assert "# existing file" not in content
        assert "class VarModel" in content


def test_generate_command_alias():
    """Test generate_model command with alias 'gm'."""
    with TemporaryDirectory() as tmpdir:
        input_file = Path(tmpdir) / "protocol.aimd"
        output_file = Path(tmpdir) / "model.py"

        input_file.write_text("{{var|test}}")

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "gm",
                str(input_file),
                "-o",
                str(output_file),
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert output_file.exists()


def test_generate_command_default_output():
    """Test generate_model with default output file name."""
    with TemporaryDirectory() as tmpdir:
        input_file = Path(tmpdir) / "protocol.aimd"
        input_file.write_text("{{var|test}}")

        # Change to temp directory
        original_cwd = Path.cwd()
        try:
            import os

            os.chdir(tmpdir)

            result = subprocess.run(
                [sys.executable, "-m", "airalogy.cli", "gm", str(input_file)],
                capture_output=True,
                text=True,
            )

            assert result.returncode == 0
            assert (Path(tmpdir) / "model.py").exists()
        finally:
            os.chdir(original_cwd)


def test_pack_and_unpack_protocol_commands():
    """Test pack/unpack commands with a protocol directory."""
    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        protocol_dir = tmp_path / "protocol_demo"
        protocol_dir.mkdir()
        (protocol_dir / "protocol.aimd").write_text("# Protocol Demo\n\n{{var|sample_name}}\n")
        (protocol_dir / "protocol.toml").write_text(
            "\n".join(
                [
                    "[airalogy_protocol]",
                    'id = "protocol_demo"',
                    'version = "0.0.1"',
                    'name = "Protocol Demo"',
                    "",
                ]
            )
        )
        (protocol_dir / ".env").write_text("API_KEY=secret\n")

        archive_path = tmp_path / "protocol_demo.aira"
        pack_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "pack",
                str(protocol_dir),
                "-o",
                str(archive_path),
            ],
            capture_output=True,
            text=True,
        )

        assert pack_result.returncode == 0
        assert archive_path.exists()

        unpack_dir = tmp_path / "unpacked"
        unpack_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "unpack",
                str(archive_path),
                "-o",
                str(unpack_dir),
            ],
            capture_output=True,
            text=True,
        )

        assert unpack_result.returncode == 0
        assert (unpack_dir / "protocol.aimd").exists()
        assert not (unpack_dir / ".env").exists()

        inspect_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "inspect",
                str(archive_path),
            ],
            capture_output=True,
            text=True,
        )
        assert inspect_result.returncode == 0
        assert "Kind: protocol" in inspect_result.stdout
        assert "Protocol ID: protocol_demo" in inspect_result.stdout

        validate_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "validate",
                str(archive_path),
            ],
            capture_output=True,
            text=True,
        )
        assert validate_result.returncode == 0
        assert "archive validation passed" in validate_result.stdout


def test_pack_multiple_protocol_directories_command():
    """Test pack command with multiple protocol directories and no records."""
    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        protocol_a = tmp_path / "protocol_a"
        protocol_b = tmp_path / "protocol_b"
        for protocol_dir, protocol_id, version, name in [
            (protocol_a, "protocol_a", "0.0.1", "Protocol A"),
            (protocol_b, "protocol_b", "0.0.2", "Protocol B"),
        ]:
            protocol_dir.mkdir()
            (protocol_dir / "protocol.aimd").write_text(f"# {name}\n\n{{{{var|sample_name}}}}\n")
            (protocol_dir / "protocol.toml").write_text(
                "\n".join(
                    [
                        "[airalogy_protocol]",
                        f'id = "{protocol_id}"',
                        f'version = "{version}"',
                        f'name = "{name}"',
                        "",
                    ]
                )
            )

        archive_path = tmp_path / "protocols.aira"
        pack_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "pack",
                str(protocol_a),
                str(protocol_b),
                "-o",
                str(archive_path),
            ],
            capture_output=True,
            text=True,
        )
        assert pack_result.returncode == 0
        assert "Packed protocols archive" in pack_result.stdout

        inspect_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "inspect",
                str(archive_path),
            ],
            capture_output=True,
            text=True,
        )
        assert inspect_result.returncode == 0
        assert "Kind: protocols" in inspect_result.stdout
        assert "Protocols: 2" in inspect_result.stdout
        assert "protocol_a" in inspect_result.stdout
        assert "protocol_b" in inspect_result.stdout

        validate_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "validate",
                str(archive_path),
            ],
            capture_output=True,
            text=True,
        )
        assert validate_result.returncode == 0
        assert "archive validation passed" in validate_result.stdout


def test_pack_records_command_with_file_payload():
    """Test pack command embeds record file payloads into blobs/."""
    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        file_id = "airalogy.id.file.11111111-1111-4111-8111-111111111111.txt"
        records_file = tmp_path / "records.json"
        records_file.write_text(
            json.dumps(
                {
                    "record_id": "01234567-0123-0123-0123-0123456789ab",
                    "record_version": 1,
                    "metadata": {"protocol_id": "protocol_demo"},
                    "data": {"var": {"sample_file": file_id}},
                }
            )
        )
        payload_file = tmp_path / "payload.txt"
        payload_file.write_text("payload")
        spec_dir = tmp_path / "specs"
        spec_dir.mkdir()
        file_payload_spec = spec_dir / "files.json"
        file_payload_spec.write_text(
            json.dumps(
                {
                    "files": [
                        {
                            "path": "../payload.txt",
                            "file_id": file_id,
                            "source_uri": "oss://airalogy-demo/payload.txt",
                            "mime_type": "text/plain",
                            "record_id": "01234567-0123-0123-0123-0123456789ab",
                            "field_path": "data.var.sample_file",
                        }
                    ]
                }
            )
        )
        archive_path = tmp_path / "records.aira"

        pack_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "pack",
                str(records_file),
                "-o",
                str(archive_path),
                "--file-payload",
                str(file_payload_spec),
            ],
            capture_output=True,
            text=True,
        )
        assert pack_result.returncode == 0
        assert archive_path.exists()

        inspect_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "inspect",
                str(archive_path),
            ],
            capture_output=True,
            text=True,
        )
        assert inspect_result.returncode == 0
        assert "File references: 1" in inspect_result.stdout
        assert "Offline blobs: 1" in inspect_result.stdout

        validate_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "validate",
                str(archive_path),
            ],
            capture_output=True,
            text=True,
        )
        assert validate_result.returncode == 0
        assert "archive validation passed" in validate_result.stdout


def test_record_validate_and_inspect_commands():
    """Test standalone record inspect/validate commands."""
    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        protocol_dir = tmp_path / "protocol_demo"
        protocol_dir.mkdir()
        (protocol_dir / "protocol.aimd").write_text(
            "{{var|sample_id: str}}\n{{var|amount: int}}\n",
            encoding="utf-8",
        )
        (protocol_dir / "protocol.toml").write_text(
            "\n".join(
                [
                    "[airalogy_protocol]",
                    'id = "protocol_demo"',
                    'version = "0.1.0"',
                    "",
                ]
            ),
            encoding="utf-8",
        )
        record_path = tmp_path / "record.json"
        record_path.write_text(
            json.dumps(
                {
                    "format": "airalogy.record",
                    "schema_version": 1,
                    "record_id": "01234567-0123-0123-0123-0123456789ab",
                    "record_version": 1,
                    "metadata": {
                        "protocol_id": "protocol_demo",
                        "protocol_version": "0.1.0",
                    },
                    "data": {
                        "var": {"sample_id": "S1", "amount": 3},
                        "step": {},
                        "check": {},
                        "quiz": {},
                    },
                }
            ),
            encoding="utf-8",
        )

        inspect_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "record",
                "inspect",
                str(record_path),
            ],
            capture_output=True,
            text=True,
        )
        assert inspect_result.returncode == 0
        assert "Records: 1" in inspect_result.stdout
        assert "Protocol IDs: protocol_demo" in inspect_result.stdout

        validate_result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "record",
                "validate",
                str(record_path),
                "--protocol-dir",
                str(protocol_dir),
            ],
            capture_output=True,
            text=True,
        )
        assert validate_result.returncode == 0
        assert "record validation passed" in validate_result.stdout


def test_record_validate_command_reports_errors():
    """Test standalone record validate command reports structural errors."""
    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        record_path = tmp_path / "bad-record.json"
        record_path.write_text(
            json.dumps({"record_version": 0, "data": {"var": "not an object"}}),
            encoding="utf-8",
        )

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "record",
                "validate",
                str(record_path),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 1
        assert "record_version must be a positive integer" in result.stderr
        assert "data.var must be an object" in result.stderr


def test_import_records_command():
    """Test import-records command with a protocol directory and CSV input."""
    with TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        protocol_dir = tmp_path / "protocol_demo"
        protocol_dir.mkdir()
        (protocol_dir / "protocol.aimd").write_text(
            "{{var|sample_id: str}}\n{{var|amount: int}}\n"
        )
        input_file = tmp_path / "records.csv"
        input_file.write_text("sample_id,amount\nS1,12\n")
        output_file = tmp_path / "records.json"

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "import-records",
                str(protocol_dir),
                "-i",
                str(input_file),
                "-o",
                str(output_file),
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "Imported 1 records" in result.stdout
        assert output_file.exists()


def test_generate_assigner_command():
    """Test generate_assigner command."""
    with TemporaryDirectory() as tmpdir:
        input_file = Path(tmpdir) / "protocol.aimd"
        output_file = Path(tmpdir) / "assigner.py"

        input_file.write_text(
            """
{{var|x: int}}

```assigner
from airalogy.assigner import AssignerResult, assigner

@assigner(
    assigned_fields=["y"],
    dependent_fields=["x"],
    mode="auto",
)
def assign_y(dep: dict) -> AssignerResult:
    return AssignerResult(assigned_fields={"y": dep["x"] + 1})
```
"""
        )

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "airalogy.cli",
                "ga",
                str(input_file),
                "-o",
                str(output_file),
            ],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert output_file.exists()
        assert "def assign_y" in output_file.read_text()
        assert "```assigner" not in input_file.read_text()
