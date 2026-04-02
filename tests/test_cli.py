"""
Tests for CLI module.
"""

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
