import asyncio
import shutil
import tempfile
from pathlib import Path

import pytest

from airalogy_engine import AiralogyEngine

_MONOREPO_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_ROOTFS_PATH = str(
    _MONOREPO_ROOT / "packages/runtime/airalogy-engine-image/airalogy-engine-image"
)
_EXAMPLE_PROTOCOL = str(_MONOREPO_ROOT / "examples/airalogy-engine")
_DEFAULT_IMAGE = "numbcoder/airalogy-engine:latest"


def pytest_addoption(parser):
    parser.addoption(
        "--sandbox-mode",
        choices=["rootfs", "image"],
        default="rootfs",
        help="Sandbox backend: 'rootfs' uses a local OCI rootfs directory, 'image' pulls a Docker image.",
    )
    parser.addoption(
        "--rootfs-path",
        default=_DEFAULT_ROOTFS_PATH,
        help="Path to the local OCI rootfs directory (used when --sandbox-mode=rootfs).",
    )
    parser.addoption(
        "--sandbox-image",
        default=_DEFAULT_IMAGE,
        help="Docker image name (used when --sandbox-mode=image).",
    )
    parser.addoption(
        "--boxlite-home",
        default="auto",
        help="BoxLite runtime home for tests. Use 'auto' for an isolated temporary directory.",
    )


@pytest.fixture(scope="session")
def sandbox_kwargs(request):
    """Return AiralogyEngine sandbox kwargs based on the chosen sandbox mode."""
    mode = request.config.getoption("--sandbox-mode")
    if mode == "rootfs":
        rootfs_path = request.config.getoption("--rootfs-path")
        if not Path(rootfs_path).is_dir():
            pytest.skip(f"Local rootfs not found at {rootfs_path}")
        return {"rootfs_path": rootfs_path}
    else:
        return {"image": request.config.getoption("--sandbox-image")}


@pytest.fixture(scope="session")
def boxlite_home(request):
    configured_home = request.config.getoption("--boxlite-home")
    if configured_home == "auto":
        home = tempfile.mkdtemp(prefix="aebl-", dir="/tmp")
        yield home
        shutil.rmtree(home, ignore_errors=True)
    else:
        yield configured_home


@pytest.fixture(scope="session")
def engine(sandbox_kwargs, boxlite_home):
    engine = AiralogyEngine(
        protocol_path=_EXAMPLE_PROTOCOL,
        boxlite_home=boxlite_home,
        **sandbox_kwargs,
    )
    yield engine
    asyncio.run(engine.close())
