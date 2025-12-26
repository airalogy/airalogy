"""
Command-line interface for Airalogy.
"""

import argparse
import sys
from pathlib import Path

from . import __version__
from .assigner.inline_assigner import (
    extract_inline_assigner_code_blocks,
    strip_inline_assigner_blocks,
)
from .markdown import generate_model, validate_aimd


def check_command(args):
    """Check AIMD syntax."""
    file_path = Path(args.file)

    if not file_path.exists():
        print(f"Error: File '{file_path}' not found.", file=sys.stderr)
        sys.exit(1)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        is_valid, errors = validate_aimd(content)

        if is_valid:
            print(f"✓ {file_path}: Syntax check passed")
            return 0
        else:
            print(
                f"✗ {file_path}: Syntax check failed, {len(errors)} errors found:\n",
                file=sys.stderr,
            )
            for index, error in enumerate(errors):
                print(f"{index + 1}. {error}", file=sys.stderr)
            return 1

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def generate_command(args):
    """Generate VarModel from AIMD file."""
    input_file = Path(args.file)
    output_file = Path(args.output)

    if not input_file.exists():
        print(f"Error: File '{input_file}' not found.", file=sys.stderr)
        sys.exit(1)

    if output_file.exists() and not args.force:
        print(
            f"Error: File '{output_file}' already exists. Use -f/--force to overwrite.",
            file=sys.stderr,
        )
        sys.exit(1)
    if output_file.resolve() == input_file.resolve():
        print("Error: Output file cannot be the same as input file.", file=sys.stderr)
        sys.exit(1)

    try:
        with open(input_file, "r", encoding="utf-8") as f:
            content = f.read()

        model_code = generate_model(content)

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(model_code)

        print(f"✓ Generated VarModel: {output_file}")
        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def generate_assigner_command(args):
    """Generate assigner.py from inline assigner blocks."""
    input_file = Path(args.file)
    output_file = Path(args.output)

    if not input_file.exists():
        print(f"Error: File '{input_file}' not found.", file=sys.stderr)
        sys.exit(1)

    if output_file.exists() and not args.force:
        print(
            f"Error: File '{output_file}' already exists. Use -f/--force to overwrite.",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        with open(input_file, "r", encoding="utf-8") as f:
            content = f.read()

        code_blocks = extract_inline_assigner_code_blocks(content)
        if not code_blocks:
            print(
                f"Error: No inline assigner blocks found in '{input_file}'.",
                file=sys.stderr,
            )
            sys.exit(1)

        assigner_code = "\n\n".join(code_blocks).rstrip() + "\n"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(assigner_code)

        updated_content, removed = strip_inline_assigner_blocks(content)
        if removed:
            with open(input_file, "w", encoding="utf-8") as f:
                f.write(updated_content)

        print(f"✓ Generated Assigner: {output_file}")
        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="airalogy",
        description="Airalogy CLI - Tools for Airalogy",
    )

    parser.add_argument(
        "-v", "--version", action="version", version=f"airalogy {__version__}"
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Check command
    check_parser = subparsers.add_parser(
        "check",
        aliases=["c"],
        help="Check AIMD syntax",
        description="Validate syntax of an AIMD file",
    )
    check_parser.add_argument(
        "file",
        nargs="?",
        default="protocol.aimd",
        help="AIMD file to check (default: protocol.aimd)",
    )
    check_parser.set_defaults(func=check_command)

    # Generate command
    generate_parser = subparsers.add_parser(
        "generate_model",
        aliases=["gm"],
        help="Generate VarModel",
        description="Generate a Pydantic VarModel from an AIMD file",
    )
    generate_parser.add_argument(
        "file",
        nargs="?",
        default="protocol.aimd",
        help="AIMD file to process (default: protocol.aimd)",
    )
    generate_parser.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Force overwrite if output file exists",
    )
    generate_parser.add_argument(
        "-o",
        "--output",
        default="model.py",
        help="Output file name (default: model.py)",
    )

    generate_parser.set_defaults(func=generate_command)

    # Generate assigner command
    assigner_parser = subparsers.add_parser(
        "generate_assigner",
        aliases=["ga"],
        help="Generate Assigner",
        description="Extract inline assigner blocks into assigner.py",
    )
    assigner_parser.add_argument(
        "file",
        nargs="?",
        default="protocol.aimd",
        help="AIMD file to process (default: protocol.aimd)",
    )
    assigner_parser.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Force overwrite if output file exists",
    )
    assigner_parser.add_argument(
        "-o",
        "--output",
        default="assigner.py",
        help="Output file name (default: assigner.py)",
    )
    assigner_parser.set_defaults(func=generate_assigner_command)

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    # Execute command
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
