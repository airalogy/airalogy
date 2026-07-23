import hashlib
from unittest.mock import AsyncMock

import pytest

from airalogy_engine import AiralogyEngine
from airalogy_engine.protocol_executor import migrate_schema


def test_protocol_executor_applies_verified_transform(tmp_path, monkeypatch):
    protocol_dir = tmp_path / "protocol"
    migration_dir = protocol_dir / "migrations"
    migration_dir.mkdir(parents=True)
    source = migration_dir / "normalize.py"
    source.write_text(
        "def migrate(data):\n"
        "    data['var']['normalized'] = data['var']['name'].upper()\n"
        "    return data\n",
        encoding="utf-8",
    )
    manifest = {
        "version": "airalogy.migration.v1",
        "from": "1.0.0",
        "to": "2.0.0",
        "operations": [
            {"op": "rename", "from": "var.old_name", "to": "var.name"}
        ],
        "transform": {
            "entrypoint": "migrations/normalize.py:migrate",
            "code_hash": hashlib.sha256(source.read_bytes()).hexdigest(),
        },
    }
    monkeypatch.chdir(tmp_path)

    result = migrate_schema(
        "protocol",
        {"manifest": manifest, "data": {"var": {"old_name": "puc19"}}},
    )

    assert result["status"] == "completed"
    assert result["data"]["var"] == {"name": "puc19", "normalized": "PUC19"}
    assert result["code_hash"] == manifest["transform"]["code_hash"]


def test_protocol_executor_rejects_transform_hash_mismatch(tmp_path, monkeypatch):
    protocol_dir = tmp_path / "protocol"
    migration_dir = protocol_dir / "migrations"
    migration_dir.mkdir(parents=True)
    (migration_dir / "normalize.py").write_text(
        "def migrate(data):\n    return data\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)

    with pytest.raises(ValueError, match="code_hash"):
        migrate_schema(
            "protocol",
            {
                "manifest": {
                    "version": "airalogy.migration.v1",
                    "from": "1.0.0",
                    "to": "2.0.0",
                    "transform": {
                        "entrypoint": "migrations/normalize.py:migrate",
                        "code_hash": "0" * 64,
                    },
                },
                "data": {},
            },
        )


@pytest.mark.asyncio
async def test_engine_migration_never_injects_environment(tmp_path):
    protocol_dir = tmp_path / "protocol"
    protocol_dir.mkdir()
    (protocol_dir / "protocol.aimd").write_text("# Test", encoding="utf-8")
    engine = AiralogyEngine(str(protocol_dir))
    engine._execute_in_sandbox = AsyncMock(  # type: ignore[method-assign]
        return_value={"success": True, "data": {}}
    )

    await engine.migrate_schema(
        {"var": {}},
        {
            "version": "airalogy.migration.v1",
            "from": "1.0.0",
            "to": "2.0.0",
        },
    )

    engine._execute_in_sandbox.assert_awaited_once()
    assert engine._execute_in_sandbox.await_args.kwargs["env_vars"] == {}
