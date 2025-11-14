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
