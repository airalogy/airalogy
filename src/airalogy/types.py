__all__ = ["VersionStr", "SnakeStr", "AiralogyProtocolId", "AiralogyRecordId"]


import re
from uuid import UUID


class VersionStr(str):
    _PATTERN = re.compile(r"^\d+\.\d+\.\d+$")  # 1.2.3

    def __new__(cls, value: str) -> "VersionStr":
        if not cls._PATTERN.fullmatch(value):
            raise ValueError(f"{value!r} is not a valid version number (x.y.z)")
        return super().__new__(cls, value)


_SNAKE = re.compile(
    r"^[a-z]([a-z\d_]*[a-z\d])?$"
)  # starts with letter, ends with letter or digit (not underscore), no consecutive underscores checked separately
_NO_CONSECUTIVE_UNDERSCORES = re.compile(r"__")  # check for consecutive underscores


class SnakeStr(str):
    def __new__(cls, value: str) -> "SnakeStr":
        if not _SNAKE.fullmatch(value) or _NO_CONSECUTIVE_UNDERSCORES.search(value):
            raise ValueError(f"{value!r} is not valid snake_case")
        return super().__new__(cls, value)


class AiralogyProtocolId(str):
    """Airalogy Protocol ID format: airalogy.id.lab.<SnakeStr>.project.<SnakeStr>.protocol.<SnakeStr>.v.<VersionStr>"""

    _PATTERN = re.compile(
        r"^airalogy\.id\.lab\.(.+?)\.project\.(.+?)\.protocol\.(.+?)\.v\.(.+)$"
    )

    def __new__(cls, value: str) -> "AiralogyProtocolId":
        match = cls._PATTERN.fullmatch(value)
        if not match:
            raise ValueError(f"{value!r} is not a valid AiralogyProtocolId format")

        lab, project, protocol, version = match.groups()

        # Validate each component using existing classes
        try:
            SnakeStr(lab)
            SnakeStr(project)
            SnakeStr(protocol)
            VersionStr(version)
        except ValueError as exc:
            raise ValueError(f"{value!r} contains invalid component: {exc}") from exc

        return super().__new__(cls, value)

    @classmethod
    def create(
        cls, lab_id: str, project_id: str, protocol_id: str, version: str
    ) -> "AiralogyProtocolId":
        """Create AiralogyProtocolId from components with validation"""
        # Validate components
        lab_snake = SnakeStr(lab_id)
        project_snake = SnakeStr(project_id)
        protocol_snake = SnakeStr(protocol_id)
        version_str = VersionStr(version)

        value = f"airalogy.id.lab.{lab_snake}.project.{project_snake}.protocol.{protocol_snake}.v.{version_str}"
        return cls(value)


class AiralogyRecordId(str):
    """Airalogy Record ID format: airalogy.id.lab.<UUID>.v.<positive_integer>"""

    _PATTERN = re.compile(
        r"^airalogy\.id\.lab\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.v\.(\d+)$"
    )

    def __new__(cls, value: str) -> "AiralogyRecordId":
        match = cls._PATTERN.fullmatch(value)
        if not match:
            raise ValueError(f"{value!r} is not a valid AiralogyRecordId format")

        uuid_str, version_str = match.groups()

        # Validate UUID format
        try:
            UUID(uuid_str)
        except ValueError as exc:
            raise ValueError(f"{value!r} contains invalid UUID: {uuid_str}") from exc

        # Validate version is >= 1
        version_int = int(version_str)
        if version_int < 1:
            raise ValueError(f"{value!r} version must be >= 1, got {version_int}")

        return super().__new__(cls, value)

    @classmethod
    def create(cls, lab_uuid: str, version: int) -> "AiralogyRecordId":
        """Create AiralogyRecordId from components with validation"""
        # Validate UUID
        uuid_obj = UUID(lab_uuid)

        # Validate version
        if version < 1:
            raise ValueError(f"Version must be >= 1, got {version}")

        value = f"airalogy.id.lab.{uuid_obj}.v.{version}"
        return cls(value)
