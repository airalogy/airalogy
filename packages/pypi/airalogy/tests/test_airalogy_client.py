import json

import pytest

from airalogy import Airalogy


def clear_airalogy_env(monkeypatch):
    for key in (
        "AIRALOGY_BASE_URL",
        "AIRALOGY_ENDPOINT",
        "AIRALOGY_API_KEY",
        "AIRALOGY_PROTOCOL_ID",
        "AIRALOGY_LOCAL_FILE_MAP_JSON",
        "AIRALOGY_LOCAL_FILE_OUTPUT_DIR",
    ):
        monkeypatch.delenv(key, raising=False)


def test_client_accepts_explicit_base_url(monkeypatch):
    clear_airalogy_env(monkeypatch)

    client = Airalogy(
        base_url="https://api.example.test/",
        api_key="test-key",
        protocol_id="protocol-1",
    )

    assert client._airalogy_base_url == "https://api.example.test"
    assert client._airalogy_api_key == "test-key"
    assert client._airalogy_protocol_id == "protocol-1"


def test_client_uses_base_url_env_before_legacy_endpoint(monkeypatch):
    clear_airalogy_env(monkeypatch)
    monkeypatch.setenv("AIRALOGY_BASE_URL", "https://base-url.example")
    monkeypatch.setenv("AIRALOGY_ENDPOINT", "https://endpoint.example")
    monkeypatch.setenv("AIRALOGY_API_KEY", "test-key")

    client = Airalogy()

    assert client._airalogy_base_url == "https://base-url.example"


def test_client_warns_for_legacy_endpoint_env(monkeypatch):
    clear_airalogy_env(monkeypatch)
    monkeypatch.setenv("AIRALOGY_ENDPOINT", "https://endpoint.example")
    monkeypatch.setenv("AIRALOGY_API_KEY", "test-key")

    with pytest.warns(DeprecationWarning, match="AIRALOGY_ENDPOINT is deprecated"):
        client = Airalogy()

    assert client._airalogy_base_url == "https://endpoint.example"


def test_upload_requires_protocol_id(monkeypatch):
    clear_airalogy_env(monkeypatch)
    client = Airalogy(base_url="https://api.example.test", api_key="test-key")

    with pytest.raises(ValueError, match="AIRALOGY_PROTOCOL_ID"):
        client.upload_file_bytes("data.csv", b"a,b\n1,2\n")


def test_client_downloads_from_local_file_bridge(monkeypatch, tmp_path):
    clear_airalogy_env(monkeypatch)
    file_path = tmp_path / "input.csv"
    file_path.write_bytes(b"a,b\n1,2\n")
    file_id = "airalogy.id.file.11111111-1111-1111-1111-111111111111"
    monkeypatch.setenv(
        "AIRALOGY_LOCAL_FILE_MAP_JSON",
        json.dumps({file_id: {"path": str(file_path), "file_name": "input.csv"}}),
    )

    client = Airalogy(base_url="https://api.example.test", api_key="test-key")

    assert client.download_file_bytes(file_id) == b"a,b\n1,2\n"


def test_client_uploads_to_local_file_bridge(monkeypatch, tmp_path):
    clear_airalogy_env(monkeypatch)
    output_dir = tmp_path / "outputs"
    monkeypatch.setenv("AIRALOGY_LOCAL_FILE_OUTPUT_DIR", str(output_dir))
    client = Airalogy(base_url="https://api.example.test", api_key="test-key")

    result = client.upload_file_bytes("plot.svg", b"<svg />")

    assert str(result["id"]).startswith("airalogy.id.file.")
    assert result["file_name"] == "plot.svg"
    assert (output_dir / f"{result['id']}.bin").read_bytes() == b"<svg />"
    metadata = json.loads((output_dir / f"{result['id']}.json").read_text("utf8"))
    assert metadata["content_type"] == "image/svg+xml"
