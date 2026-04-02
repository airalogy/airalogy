"""
Command-line interface for Airalogy.
"""

import argparse
import sys
from pathlib import Path

from . import __version__
from .archive import (
    ArchiveError,
    pack_protocol_archive,
    pack_records_archive,
    unpack_archive,
)
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

        is_valid, errors = validate_aimd(content, protocol_dir=file_path.parent)

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

        print(f"✓ Generated models: {output_file}")
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


def pack_command(args):
    """Pack a protocol directory or record JSON files into an archive."""
    input_paths = [Path(item) for item in args.inputs]
    if not input_paths:
        print("Error: At least one input path is required.", file=sys.stderr)
        sys.exit(1)

    try:
        if len(input_paths) == 1 and input_paths[0].is_dir():
            output_path = pack_protocol_archive(
                input_paths[0],
                output_path=args.output,
                force=args.force,
            )
            print(f"✓ Packed protocol archive: {output_path}")
            return 0

        if any(path.is_dir() for path in input_paths):
            print(
                "Error: When packing records, all inputs must be JSON files. "
                "To pack a protocol, pass exactly one protocol directory.",
                file=sys.stderr,
            )
            return 1

        output_path = pack_records_archive(
            input_paths,
            output_path=args.output,
            protocol_dirs=args.protocol_dir,
            force=args.force,
        )
        print(f"✓ Packed records archive: {output_path}")
        return 0
    except ArchiveError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


def unpack_command(args):
    """Unpack an Airalogy archive."""
    try:
        output_dir, manifest = unpack_archive(
            args.archive,
            output_dir=args.output,
            force=args.force,
        )
        print(f"✓ Unpacked {manifest['kind']} archive: {output_dir}")
        return 0
    except ArchiveError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


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
        help="Generate models",
        description="Generate Pydantic VarModel from an AIMD file",
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

    # Pack command
    pack_parser = subparsers.add_parser(
        "pack",
        help="Pack a protocol directory or record JSON files into a single-file archive",
        description=(
            "Pack a protocol directory or one/more record JSON files into a "
            ".aira archive."
        ),
    )
    pack_parser.add_argument(
        "inputs",
        nargs="+",
        help=(
            "Either one protocol directory, or one/more record JSON files "
            "(each file may contain a single record object or a list of records)."
        ),
    )
    pack_parser.add_argument(
        "-o",
        "--output",
        help="Output archive path. Defaults to <protocol>.aira or <record>.aira.",
    )
    pack_parser.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Overwrite the output archive if it already exists.",
    )
    pack_parser.add_argument(
        "--protocol-dir",
        action="append",
        default=[],
        help=(
            "Embed a related protocol directory when packing records. "
            "Can be passed multiple times."
        ),
    )
    pack_parser.set_defaults(func=pack_command)

    # Unpack command
    unpack_parser = subparsers.add_parser(
        "unpack",
        help="Unpack an Airalogy archive",
        description="Extract a .aira archive into a directory.",
    )
    unpack_parser.add_argument(
        "archive",
        help="Archive file to unpack.",
    )
    unpack_parser.add_argument(
        "-o",
        "--output",
        help="Output directory. Defaults to the archive name without its suffix.",
    )
    unpack_parser.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Allow extraction into an existing directory.",
    )
    unpack_parser.set_defaults(func=unpack_command)

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    # Execute command
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
