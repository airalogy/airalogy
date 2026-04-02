import json
import zipfile
from pathlib import Path

import pytest

from airalogy.archive import (
    ARCHIVE_MANIFEST_PATH,
    ArchiveError,
    pack_protocol_archive,
    pack_records_archive,
    unpack_archive,
)


def _write_protocol(protocol_dir: Path, *, protocol_id: str, version: str, name: str) -> None:
    protocol_dir.mkdir(parents=True, exist_ok=True)
    (protocol_dir / "protocol.aimd").write_text(f"# {name}\n\n{{{{var|sample_name}}}}\n")
    (protocol_dir / "model.py").write_text("from pydantic import BaseModel\n\nclass VarModel(BaseModel):\n    sample_name: str\n")
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
    (protocol_dir / "files").mkdir(exist_ok=True)
    (protocol_dir / "files" / "notes.txt").write_text("protocol asset")
    (protocol_dir / ".env").write_text("API_KEY=secret\n")
    (protocol_dir / "__pycache__").mkdir(exist_ok=True)
    (protocol_dir / "__pycache__" / "model.cpython-313.pyc").write_bytes(b"compiled")


def test_pack_protocol_archive_round_trip(tmp_path: Path):
    protocol_dir = tmp_path / "protocol_demo"
    _write_protocol(
        protocol_dir,
        protocol_id="protocol_demo",
        version="0.0.1",
        name="Protocol Demo",
    )

    archive_path = tmp_path / "protocol_demo.aira"
    packed_path = pack_protocol_archive(protocol_dir, archive_path)

    assert packed_path == archive_path
    assert archive_path.exists()

    with zipfile.ZipFile(archive_path, "r") as archive:
        names = set(archive.namelist())
        assert ARCHIVE_MANIFEST_PATH in names
        assert "protocol.aimd" in names
        assert "model.py" in names
        assert "protocol.toml" in names
        assert "files/notes.txt" in names
        assert ".env" not in names
        assert "__pycache__/model.cpython-313.pyc" not in names

        manifest = json.loads(archive.read(ARCHIVE_MANIFEST_PATH).decode("utf-8"))
        assert manifest["kind"] == "protocol"
        assert manifest["protocol"]["protocol_id"] == "protocol_demo"
        assert manifest["protocol"]["protocol_version"] == "0.0.1"
        assert manifest["protocol"]["protocol_name"] == "Protocol Demo"

    unpack_dir, manifest = unpack_archive(archive_path, tmp_path / "unpacked_protocol")
    assert manifest["kind"] == "protocol"
    assert (unpack_dir / "protocol.aimd").exists()
    assert (unpack_dir / "files" / "notes.txt").read_text() == "protocol asset"
    assert not (unpack_dir / ".env").exists()


def test_pack_records_archive_with_embedded_protocol_and_record_list(tmp_path: Path):
    protocol_dir = tmp_path / "protocol_demo"
    _write_protocol(
        protocol_dir,
        protocol_id="protocol_demo",
        version="0.0.1",
        name="Protocol Demo",
    )

    records_file = tmp_path / "records.json"
    records_file.write_text(
        json.dumps(
            [
                {
                    "record_id": "01234567-0123-0123-0123-0123456789ab",
                    "record_version": 1,
                    "metadata": {
                        "protocol_id": "protocol_demo",
                        "protocol_version": "0.0.1",
                        "sha1": "sha-one",
                    },
                    "data": {
                        "var": {"sample_name": "alpha"},
                        "step": {},
                        "check": {},
                        "quiz": {},
                    },
                },
                {
                    "record_id": "89abcdef-0123-0123-0123-0123456789ab",
                    "record_version": 2,
                    "metadata": {
                        "protocol_id": "protocol_demo",
                        "protocol_version": "0.0.1",
                        "sha1": "sha-two",
                    },
                    "data": {
                        "var": {"sample_name": "beta"},
                        "step": {},
                        "check": {},
                        "quiz": {},
                    },
                },
            ],
            ensure_ascii=False,
        )
    )

    archive_path = tmp_path / "records.aira"
    packed_path = pack_records_archive(
        [records_file],
        archive_path,
        protocol_dirs=[protocol_dir],
    )

    assert packed_path == archive_path
    assert archive_path.exists()

    with zipfile.ZipFile(archive_path, "r") as archive:
        manifest = json.loads(archive.read(ARCHIVE_MANIFEST_PATH).decode("utf-8"))
        assert manifest["kind"] == "records"
        assert len(manifest["records"]) == 2
        assert len(manifest["protocols"]) == 1
        embedded_root = manifest["records"][0]["embedded_protocol_root"]
        assert embedded_root == "protocols/protocol_demo__0.0.1"
        assert f"{embedded_root}/protocol.aimd" in set(archive.namelist())
        assert any(name.startswith("records/") for name in archive.namelist())

    unpack_dir, manifest = unpack_archive(archive_path, tmp_path / "unpacked_records")
    assert manifest["kind"] == "records"
    assert (unpack_dir / "records").is_dir()
    assert (unpack_dir / "protocols" / "protocol_demo__0.0.1" / "protocol.aimd").exists()


def test_unpack_archive_rejects_zip_slip(tmp_path: Path):
    archive_path = tmp_path / "bad.aira"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            ARCHIVE_MANIFEST_PATH,
            json.dumps(
                {
                    "format": "airalogy.archive",
                    "version": 1,
                    "kind": "protocol",
                    "created_at": "2026-04-01T00:00:00+00:00",
                    "protocol": {
                        "protocol_id": "bad",
                        "protocol_version": "0.0.1",
                        "protocol_name": "Bad",
                        "entrypoint": "protocol.aimd",
                        "files": ["protocol.aimd"],
                    },
                }
            ),
        )
        archive.writestr("../evil.txt", "evil")

    with pytest.raises(ArchiveError, match="escapes the output directory"):
        unpack_archive(archive_path, tmp_path / "out")
