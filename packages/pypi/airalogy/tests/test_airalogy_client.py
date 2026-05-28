import pytest

from airalogy import Airalogy


def clear_airalogy_env(monkeypatch):
    for key in (
        "AIRALOGY_BASE_URL",
        "AIRALOGY_ENDPOINT",
        "AIRALOGY_API_KEY",
        "AIRALOGY_PROTOCOL_ID",
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
