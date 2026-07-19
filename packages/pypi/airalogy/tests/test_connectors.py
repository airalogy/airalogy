from pathlib import Path

import pytest

from airalogy.connectors import (
    ConnectorRuntimeError,
    EntitySourceConnector,
    create_entity_source_connectors_from_aimd,
    load_connector_env_file,
)


def test_entity_source_connector_loads_local_descriptor_and_executes_search(tmp_path: Path):
    descriptor_dir = tmp_path / "connectors"
    descriptor_dir.mkdir()
    (descriptor_dir / "plasmid.yaml").write_text(
        """
entity: plasmid
search:
  method: GET
  url: https://lims.example.com/api/plasmids
  query_param: q
  field_map:
    id: plasmid_id
    label: display
resolve:
  method: GET
  url: https://lims.example.com/api/plasmids/{id}
""".strip(),
        encoding="utf-8",
    )
    calls = []

    def request_json(method, url, *, headers, params, json, timeout):
        calls.append(
            {
                "method": method,
                "url": url,
                "headers": headers,
                "params": params,
                "json": json,
                "timeout": timeout,
            }
        )
        return {
            "items": [
                {
                    "plasmid_id": "pUC19",
                    "display": "pUC19 cloning vector",
                    "description": "High-copy cloning vector",
                }
            ]
        }

    connector = EntitySourceConnector(
        {
            "id": "lab_plasmid_registry",
            "kind": "entity_source",
            "entity": "plasmid",
            "descriptor": "./connectors/plasmid.yaml",
            "auth": {"type": "bearer", "token_env": "LAB_PLASMID_TOKEN"},
        },
        base_dir=tmp_path,
        env={"LAB_PLASMID_TOKEN": "secret-token"},
        request_json=request_json,
    )

    result = connector.search("puc", limit=10)

    assert calls == [
        {
            "method": "GET",
            "url": "https://lims.example.com/api/plasmids",
            "headers": {"Authorization": "Bearer secret-token"},
            "params": {"q": "puc", "limit": 10},
            "json": None,
            "timeout": 20,
        }
    ]
    assert result == [
        {
            "plasmid_id": "pUC19",
            "display": "pUC19 cloning vector",
            "description": "High-copy cloning vector",
            "entity": "plasmid",
            "source": "lab_plasmid_registry",
            "id": "pUC19",
            "label": "pUC19 cloning vector",
        }
    ]


def test_entity_source_connector_resolves_id_with_encoded_url(tmp_path: Path):
    (tmp_path / "descriptor.yaml").write_text(
        """
entity: plasmid
search:
  url: https://lims.example.com/api/plasmids
resolve:
  url: https://lims.example.com/api/plasmids/{id}
""".strip(),
        encoding="utf-8",
    )
    calls = []

    def request_json(method, url, *, headers, params, json, timeout):
        calls.append((method, url, params))
        return {"id": "pUC 19", "name": "pUC 19 vector"}

    connector = EntitySourceConnector(
        {
            "id": "lab_plasmid_registry",
            "kind": "entity_source",
            "entity": "plasmid",
            "descriptor": "./descriptor.yaml",
        },
        base_dir=tmp_path,
        request_json=request_json,
    )

    assert connector.resolve("pUC 19") == {
        "id": "pUC 19",
        "name": "pUC 19 vector",
        "entity": "plasmid",
        "source": "lab_plasmid_registry",
        "label": "pUC 19 vector",
    }
    assert calls == [
        ("GET", "https://lims.example.com/api/plasmids/pUC%2019", {})
    ]


def test_connector_auth_secret_is_required_only_when_executing(tmp_path: Path):
    (tmp_path / "descriptor.yaml").write_text(
        """
entity: plasmid
search:
  url: https://lims.example.com/api/plasmids
""".strip(),
        encoding="utf-8",
    )

    connector = EntitySourceConnector(
        {
            "id": "lab_plasmid_registry",
            "kind": "entity_source",
            "entity": "plasmid",
            "descriptor": "./descriptor.yaml",
            "auth": {"token_env": "LAB_PLASMID_TOKEN"},
        },
        base_dir=tmp_path,
        env={},
        request_json=lambda *args, **kwargs: [],
    )

    with pytest.raises(ConnectorRuntimeError, match="LAB_PLASMID_TOKEN"):
        connector.search("puc")


def test_create_entity_source_connectors_from_aimd(tmp_path: Path):
    (tmp_path / "plasmid.yaml").write_text(
        """
entity: plasmid
search:
  url: https://lims.example.com/api/plasmids
""".strip(),
        encoding="utf-8",
    )
    content = """
```connectors
lab_plasmid_registry:
  kind: entity_source
  entity: plasmid
  descriptor: ./plasmid.yaml
```

Parent plasmid: {{var|parent_plasmid: EntityRef | None, entity="plasmid", source="lab_plasmid_registry"}}
"""

    connectors = create_entity_source_connectors_from_aimd(
        content,
        base_dir=tmp_path,
        request_json=lambda *args, **kwargs: [],
    )

    assert list(connectors) == ["lab_plasmid_registry"]
    assert connectors["lab_plasmid_registry"].entity == "plasmid"


def test_load_connector_env_file(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        """
# local secrets
export LAB_PLASMID_TOKEN="abc123"
SECOND_TOKEN='def456'
""".strip(),
        encoding="utf-8",
    )

    assert load_connector_env_file(env_file) == {
        "LAB_PLASMID_TOKEN": "abc123",
        "SECOND_TOKEN": "def456",
    }
