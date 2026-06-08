"""
Command-line interface for Airalogy.
"""

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .archive import (
    ArchiveError,
    inspect_archive,
    pack_protocol_archive,
    pack_records_archive,
    validate_archive,
    unpack_archive,
)
from .assigner.inline_assigner import (
    extract_inline_assigner_code_blocks,
    strip_inline_assigner_blocks,
)
from .ingest import import_records
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


def inspect_archive_command(args):
    """Inspect an Airalogy archive without extracting it."""
    try:
        summary = inspect_archive(args.archive)
    except ArchiveError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0

    print(f"Archive: {summary['path']}")
    print(f"Format: {summary['format']} v{summary['version']}")
    print(f"Kind: {summary['kind']}")
    print(f"Created at: {summary.get('created_at') or 'unknown'}")
    print(f"Members: {summary['member_count']}")
    if summary["kind"] == "protocol":
        protocol = summary["protocol"]
        print(f"Protocol ID: {protocol.get('protocol_id') or 'unknown'}")
        print(f"Protocol version: {protocol.get('protocol_version') or 'unversioned'}")
        print(f"Protocol name: {protocol.get('protocol_name') or 'unknown'}")
        print(f"Entrypoint: {protocol.get('entrypoint') or 'protocol.aimd'}")
        print(f"Protocol files: {protocol.get('file_count', 0)}")
    elif summary["kind"] == "records":
        records = summary["records"]
        protocols = summary["protocols"]
        print(f"Records: {records['count']}")
        print(f"Record protocol IDs: {', '.join(records['protocol_ids']) or 'none'}")
        print(f"Embedded protocols: {protocols['count']}")
        print(f"Embedded protocol IDs: {', '.join(protocols['protocol_ids']) or 'none'}")
    return 0


def validate_archive_command(args):
    """Validate an Airalogy archive without extracting it."""
    ok, issues = validate_archive(args.archive)
    if args.json:
        print(json.dumps({"ok": ok, "issues": issues}, indent=2, ensure_ascii=False))
    elif ok:
        print(f"✓ {args.archive}: archive validation passed")
    else:
        print(
            f"✗ {args.archive}: archive validation failed, {len(issues)} issue(s) found:",
            file=sys.stderr,
        )
        for index, issue in enumerate(issues, start=1):
            print(f"{index}. {issue}", file=sys.stderr)
    return 0 if ok else 1


def import_records_command(args):
    """Import batch row data into Airalogy Record JSON."""
    try:
        result = import_records(
            protocol_dir=args.protocol_dir,
            input_path=args.input,
            input_format=args.input_format,
            output_path=args.output,
            output_format=args.output_format,
            force=args.force,
            allow_extra_var_fields=args.allow_extra_var_fields,
            require_complete_quiz=args.require_complete_quiz,
            include_template_defaults=not args.no_template_defaults,
            generate_record_ids=not args.no_record_ids,
            validate_model_sync=not args.skip_model_sync_check,
        )
    except (FileExistsError, OSError, ValueError, TypeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if not result.ok:
        print(
            f"Error: failed to import {len(result.errors)} row issue(s).",
            file=sys.stderr,
        )
        for error in result.errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    if args.output:
        print(f"✓ Imported {len(result.records)} records: {args.output}")
    else:
        import json

        print(json.dumps(result.records, ensure_ascii=False, indent=2))
    return 0


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

    # Inspect archive command
    inspect_parser = subparsers.add_parser(
        "inspect",
        help="Inspect an Airalogy archive",
        description="Inspect a .aira archive without extracting it.",
    )
    inspect_parser.add_argument(
        "archive",
        help="Archive file to inspect.",
    )
    inspect_parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable JSON.",
    )
    inspect_parser.set_defaults(func=inspect_archive_command)

    # Validate archive command
    validate_parser = subparsers.add_parser(
        "validate",
        help="Validate an Airalogy archive",
        description="Validate a .aira archive manifest, members, JSON payloads, and hashes.",
    )
    validate_parser.add_argument(
        "archive",
        help="Archive file to validate.",
    )
    validate_parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable JSON.",
    )
    validate_parser.set_defaults(func=validate_archive_command)

    # Import records command
    import_parser = subparsers.add_parser(
        "import-records",
        aliases=["ir"],
        help="Import batch data into Airalogy Record JSON",
        description=(
            "Import CSV, TSV, JSON, or JSONL rows into Record JSON for a protocol."
        ),
    )
    import_parser.add_argument(
        "protocol_dir",
        help="Protocol directory containing protocol.aimd.",
    )
    import_parser.add_argument(
        "-i",
        "--input",
        required=True,
        help="Input CSV, TSV, JSON, or JSONL file.",
    )
    import_parser.add_argument(
        "-o",
        "--output",
        help="Output record file. Defaults to printing a JSON array to stdout.",
    )
    import_parser.add_argument(
        "--input-format",
        choices=["auto", "csv", "tsv", "json", "jsonl"],
        default="auto",
        help="Input format (default: auto).",
    )
    import_parser.add_argument(
        "--output-format",
        choices=["auto", "json", "jsonl"],
        default="auto",
        help="Output format (default: auto from output suffix).",
    )
    import_parser.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Overwrite the output file if it already exists.",
    )
    import_parser.add_argument(
        "--allow-extra-var-fields",
        action="store_true",
        help="Keep unrecognized variable fields instead of failing the row.",
    )
    import_parser.add_argument(
        "--require-complete-quiz",
        action="store_true",
        help="Require every quiz item in the protocol to have an imported answer.",
    )
    import_parser.add_argument(
        "--no-template-defaults",
        action="store_true",
        help="Do not add default step/check data from the protocol template.",
    )
    import_parser.add_argument(
        "--no-record-ids",
        action="store_true",
        help="Do not generate record_id values for imported records.",
    )
    import_parser.add_argument(
        "--skip-model-sync-check",
        action="store_true",
        help=(
            "Do not check compatibility between protocol.aimd vars and "
            "model.py::VarModel."
        ),
    )
    import_parser.set_defaults(func=import_records_command)

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    # Execute command
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
