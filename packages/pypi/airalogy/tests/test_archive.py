import json
import zipfile
from pathlib import Path

import pytest

from airalogy.archive import (
    ARCHIVE_MANIFEST_PATH,
    ArchiveError,
    inspect_archive,
    load_file_payload_specs,
    pack_protocol_archive,
    pack_protocols_archive,
    pack_records_archive,
    validate_archive,
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
        assert manifest["protocol"]["file_hashes"]["protocol.aimd"]

    unpack_dir, manifest = unpack_archive(archive_path, tmp_path / "unpacked_protocol")
    assert manifest["kind"] == "protocol"
    assert (unpack_dir / "protocol.aimd").exists()
    assert (unpack_dir / "files" / "notes.txt").read_text() == "protocol asset"
    assert not (unpack_dir / ".env").exists()


def test_pack_protocol_archive_rejects_model_py_type_conflict(tmp_path: Path):
    protocol_dir = tmp_path / "protocol_demo"
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text("{{var|age: int}}\n")
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

    with pytest.raises(ArchiveError, match="VarModel is incompatible"):
        pack_protocol_archive(protocol_dir, tmp_path / "protocol_demo.aira")


def test_pack_protocols_archive_with_multiple_protocols_and_no_records(tmp_path: Path):
    protocol_a = tmp_path / "protocol_a"
    protocol_b = tmp_path / "protocol_b"
    _write_protocol(
        protocol_a,
        protocol_id="protocol_a",
        version="0.0.1",
        name="Protocol A",
    )
    _write_protocol(
        protocol_b,
        protocol_id="protocol_b",
        version="0.0.2",
        name="Protocol B",
    )

    archive_path = tmp_path / "protocols.aira"
    packed_path = pack_protocols_archive([protocol_a, protocol_b], archive_path)

    assert packed_path == archive_path
    assert archive_path.exists()

    with zipfile.ZipFile(archive_path, "r") as archive:
        manifest = json.loads(archive.read(ARCHIVE_MANIFEST_PATH).decode("utf-8"))
        names = set(archive.namelist())
        assert manifest["kind"] == "protocols"
        assert len(manifest["protocols"]) == 2
        roots = {protocol["archive_root"] for protocol in manifest["protocols"]}
        assert roots == {"protocols/protocol_a__0.0.1", "protocols/protocol_b__0.0.2"}
        assert "protocols/protocol_a__0.0.1/protocol.aimd" in names
        assert "protocols/protocol_b__0.0.2/protocol.aimd" in names
        assert "protocols/protocol_a__0.0.1/.env" not in names
        assert manifest["protocols"][0]["file_hashes"]["protocol.aimd"]

    summary = inspect_archive(archive_path)
    assert summary["kind"] == "protocols"
    assert summary["records"]["count"] == 0
    assert summary["protocols"]["count"] == 2
    assert summary["protocols"]["protocol_ids"] == ["protocol_a", "protocol_b"]

    ok, issues = validate_archive(archive_path)
    assert ok
    assert issues == []

    unpack_dir, manifest = unpack_archive(archive_path, tmp_path / "unpacked_protocols")
    assert manifest["kind"] == "protocols"
    assert (unpack_dir / "protocols" / "protocol_a__0.0.1" / "protocol.aimd").exists()
    assert (unpack_dir / "protocols" / "protocol_b__0.0.2" / "protocol.aimd").exists()


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
        assert manifest["records"][0]["sha256"]
        assert manifest["protocols"][0]["file_hashes"]["protocol.aimd"]
        embedded_root = manifest["records"][0]["embedded_protocol_root"]
        assert embedded_root == "protocols/protocol_demo__0.0.1"
        assert f"{embedded_root}/protocol.aimd" in set(archive.namelist())
        assert any(name.startswith("records/") for name in archive.namelist())

    unpack_dir, manifest = unpack_archive(archive_path, tmp_path / "unpacked_records")
    assert manifest["kind"] == "records"
    assert (unpack_dir / "records").is_dir()
    assert (unpack_dir / "protocols" / "protocol_demo__0.0.1" / "protocol.aimd").exists()

    summary = inspect_archive(archive_path)
    assert summary["kind"] == "records"
    assert summary["records"]["count"] == 2

    ok, issues = validate_archive(archive_path)
    assert ok
    assert issues == []


def test_pack_records_archive_with_file_payloads(tmp_path: Path):
    records_file = tmp_path / "records.json"
    file_id = "airalogy.id.file.11111111-1111-4111-8111-111111111111.png"
    records_file.write_text(
        json.dumps(
            {
                "record_id": "01234567-0123-0123-0123-0123456789ab",
                "record_version": 1,
                "metadata": {"protocol_id": "protocol_demo"},
                "data": {"var": {"sample_image": file_id}},
            }
        )
    )
    image_file = tmp_path / "image.png"
    image_file.write_bytes(b"fake png bytes")

    archive_path = tmp_path / "records-with-file.aira"
    pack_records_archive(
        [records_file],
        archive_path,
        file_payloads=[
            {
                "path": str(image_file),
                "file_id": file_id,
                "source_uri": "oss://airalogy-demo/images/image.png",
                "filename": "image.png",
                "mime_type": "image/png",
                "record_id": "01234567-0123-0123-0123-0123456789ab",
                "field_path": "data.var.sample_image",
            }
        ],
    )

    with zipfile.ZipFile(archive_path, "r") as archive:
        manifest = json.loads(archive.read(ARCHIVE_MANIFEST_PATH).decode("utf-8"))
        assert manifest["kind"] == "records"
        assert len(manifest["records"]) == 1
        assert len(manifest["blobs"]) == 1
        assert len(manifest["files"]) == 1

        blob = manifest["blobs"][0]
        assert blob["blob_id"] == f"sha256:{blob['sha256']}"
        assert blob["archive_path"].startswith("blobs/sha256/")
        assert archive.read(blob["archive_path"]) == b"fake png bytes"

        file_ref = manifest["files"][0]
        assert file_ref["file_id"] == file_id
        assert file_ref["source_uri"] == "oss://airalogy-demo/images/image.png"
        assert file_ref["blob_id"] == blob["blob_id"]
        assert file_ref["record_path"] == manifest["records"][0]["path"]
        assert file_ref["field_path"] == "data.var.sample_image"

    summary = inspect_archive(archive_path)
    assert summary["files"]["count"] == 1
    assert summary["files"]["offline_count"] == 1
    assert summary["blobs"]["count"] == 1
    assert summary["blobs"]["total_size"] == len(b"fake png bytes")

    ok, issues = validate_archive(archive_path)
    assert ok
    assert issues == []

    unpack_dir, manifest = unpack_archive(archive_path, tmp_path / "unpacked_files")
    assert manifest["kind"] == "records"
    blob_path = manifest["blobs"][0]["archive_path"]
    assert (unpack_dir / blob_path).read_bytes() == b"fake png bytes"


def test_load_file_payload_specs_resolves_paths_relative_to_spec_file(tmp_path: Path):
    payload_dir = tmp_path / "payloads"
    payload_dir.mkdir()
    payload_file = payload_dir / "sample.txt"
    payload_file.write_text("payload")

    spec_dir = tmp_path / "specs"
    spec_dir.mkdir()
    spec_path = spec_dir / "files.json"
    spec_path.write_text(
        json.dumps(
            {
                "files": [
                    {
                        "path": "../payloads/sample.txt",
                        "file_id": "airalogy.id.file.relative.txt",
                    }
                ]
            }
        )
    )

    specs = load_file_payload_specs(spec_path)

    assert Path(specs[0]["path"]) == payload_file.resolve()


def test_pack_records_archive_with_reference_only_file_payload(tmp_path: Path):
    records_file = tmp_path / "records.json"
    records_file.write_text(
        json.dumps(
            {
                "record_id": "01234567-0123-0123-0123-0123456789ab",
                "metadata": {"protocol_id": "protocol_demo"},
                "data": {"var": {"sample_image": "airalogy.id.file.reference.png"}},
            }
        )
    )

    archive_path = tmp_path / "records-reference-only.aira"
    pack_records_archive(
        [records_file],
        archive_path,
        file_payloads=[
            {
                "file_id": "airalogy.id.file.reference.png",
                "source_uri": "oss://airalogy-demo/images/reference.png",
                "record_id": "01234567-0123-0123-0123-0123456789ab",
                "field_path": "data.var.sample_image",
            }
        ],
    )

    with zipfile.ZipFile(archive_path) as archive:
        manifest = json.loads(archive.read(ARCHIVE_MANIFEST_PATH).decode("utf-8"))
    assert "blobs" not in manifest
    assert manifest["files"][0]["source_uri"] == "oss://airalogy-demo/images/reference.png"

    summary = inspect_archive(archive_path)
    assert summary["files"]["count"] == 1
    assert summary["files"]["offline_count"] == 0
    assert summary["blobs"]["count"] == 0

    ok, issues = validate_archive(archive_path)
    assert ok
    assert issues == []


def test_validate_archive_detects_blob_hash_mismatch(tmp_path: Path):
    records_file = tmp_path / "records.json"
    records_file.write_text(
        json.dumps(
            {
                "record_id": "01234567-0123-0123-0123-0123456789ab",
                "metadata": {"protocol_id": "protocol_demo"},
                "data": {"var": {"sample_file": "airalogy.id.file.payload.txt"}},
            }
        )
    )
    payload_file = tmp_path / "payload.txt"
    payload_file.write_text("original")
    archive_path = tmp_path / "records-with-blob.aira"
    pack_records_archive(
        [records_file],
        archive_path,
        file_payloads=[
            {
                "path": str(payload_file),
                "file_id": "airalogy.id.file.payload.txt",
                "record_id": "01234567-0123-0123-0123-0123456789ab",
            }
        ],
    )

    with zipfile.ZipFile(archive_path, "r") as archive:
        members = {
            info.filename: archive.read(info.filename)
            for info in archive.infolist()
            if not info.is_dir()
        }
        manifest = json.loads(members[ARCHIVE_MANIFEST_PATH].decode("utf-8"))
    members[manifest["blobs"][0]["archive_path"]] = b"tampered"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for member_name, payload in members.items():
            archive.writestr(member_name, payload)

    ok, issues = validate_archive(archive_path)
    assert not ok
    assert any("Blob file" in issue and "sha256 mismatch" in issue for issue in issues)


def test_validate_archive_detects_record_hash_mismatch(tmp_path: Path):
    records_file = tmp_path / "records.json"
    records_file.write_text(
        json.dumps(
            {
                "record_id": "01234567-0123-0123-0123-0123456789ab",
                "metadata": {"protocol_id": "protocol_demo"},
                "data": {"var": {"sample_name": "alpha"}},
            }
        )
    )
    archive_path = tmp_path / "records.aira"
    pack_records_archive([records_file], archive_path)

    with zipfile.ZipFile(archive_path, "r") as archive:
        members = {
            info.filename: archive.read(info.filename)
            for info in archive.infolist()
            if not info.is_dir()
        }
    members["records/01234567-0123-0123-0123-0123456789ab.json"] = (
        json.dumps({"record_id": "tampered"}) + "\n"
    ).encode("utf-8")
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for member_name, payload in members.items():
            archive.writestr(member_name, payload)

    ok, issues = validate_archive(archive_path)
    assert not ok
    assert any("sha256 mismatch" in issue for issue in issues)


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
