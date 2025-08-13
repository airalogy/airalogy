__all__ = ["VersionStr", "SnakeStr", "ProtocolId", "RecordId"]


import re
from uuid import UUID
from pydantic_core import core_schema


class VersionStr(str):
    """Version string in format x.y.z (e.g., 1.2.3)"""

    _PATTERN = re.compile(r"^\d+\.\d+\.\d+$")  # 1.2.3

    def __new__(cls, value: str) -> "VersionStr":
        if not isinstance(value, str):
            raise TypeError("Version must be a string.")
        if not cls._PATTERN.fullmatch(value):
            raise ValueError(f"{value!r} is not a valid version number (x.y.z)")
        return super().__new__(cls, value)

    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        """
        Make Pydantic treat VersionStr as a string type for validation and schema generation.
        """

        def validate(value):
            return cls(value)

        return core_schema.no_info_after_validator_function(
            validate,
            core_schema.str_schema(),
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, handler):
        """
        Modify the generated JSON Schema to add the airalogy_type property.
        """
        json_schema = handler(schema)
        json_schema.update(
            {"airalogy_type": "VersionStr", "pattern": cls._PATTERN.pattern}
        )
        return json_schema


class SnakeStr(str):
    """Snake case string validation (e.g., my_variable_name)"""

    _PATTERN = re.compile(r"^(?!.*__)[a-z](?:[a-z\d_]*[a-z\d])?$")

    def __new__(cls, value: str) -> "SnakeStr":
        if not isinstance(value, str):
            raise TypeError("Snake case string must be a string.")
        if not cls._PATTERN.fullmatch(value):
            raise ValueError(f"{value!r} is not valid snake_case")
        return super().__new__(cls, value)

    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        """Make Pydantic treat SnakeStr as a string type for validation and schema generation."""

        def validate(value):
            return cls(value)

        return core_schema.no_info_after_validator_function(
            validate,
            core_schema.str_schema(),
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, handler):
        """Modify the generated JSON Schema to add the airalogy_type property."""
        json_schema = handler(schema)
        json_schema.update(
            {"airalogy_type": "SnakeStr", "pattern": cls._PATTERN.pattern}
        )
        return json_schema


class ProtocolId(str):
    """Airalogy Protocol ID format: airalogy.id.lab.<SnakeStr>.project.<SnakeStr>.protocol.<SnakeStr>.v.<VersionStr>"""

    _PATTERN = re.compile(
        r"^airalogy\.id\.lab\.(.+?)\.project\.(.+?)\.protocol\.(.+?)\.v\.(.+)$"
    )

    def __new__(cls, value: str) -> "ProtocolId":
        if not isinstance(value, str):
            raise TypeError("Protocol ID must be a string.")
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
    ) -> "ProtocolId":
        """Create AiralogyProtocolId from components with validation"""
        # Validate components
        lab_snake = SnakeStr(lab_id)
        project_snake = SnakeStr(project_id)
        protocol_snake = SnakeStr(protocol_id)
        version_str = VersionStr(version)

        value = f"airalogy.id.lab.{lab_snake}.project.{project_snake}.protocol.{protocol_snake}.v.{version_str}"
        return cls(value)

    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        """
        Make Pydantic treat ProtocolId as a string type for validation and schema generation.
        """

        def validate(value):
            return cls(value)

        return core_schema.no_info_after_validator_function(
            validate,
            core_schema.str_schema(),
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, handler):
        """
        Modify the generated JSON Schema to add the airalogy_type property.
        """
        json_schema = handler(schema)
        json_schema.update(
            {"airalogy_type": "ProtocolId"}
        )  # Here, we do not add the full pattern of ProtocolId into the JSON schema, because it is too complex and hard to understand at a glance. However, we include the basic structure for clarity.
        return json_schema


class RecordId(str):
    """Airalogy Record ID format: airalogy.id.record.<UUID>.v.<positive_integer>"""

    _PATTERN = re.compile(
        r"^airalogy\.id\.record\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.v\.(\d+)$"
    )

    def __new__(cls, value: str) -> "RecordId":
        if not isinstance(value, str):
            raise TypeError("Record ID must be a string.")
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
    def create(cls, record_uuid: str, version: int) -> "RecordId":
        """Create AiralogyRecordId from components with validation"""
        # Validate UUID
        uuid_obj = UUID(record_uuid)

        # Validate version
        if version < 1:
            raise ValueError(f"Version must be >= 1, got {version}")

        value = f"airalogy.id.record.{uuid_obj}.v.{version}"
        return cls(value)

    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        """
        Make Pydantic treat RecordId as a string type for validation and schema generation.
        """

        def validate(value):
            return cls(value)

        return core_schema.no_info_after_validator_function(
            validate,
            core_schema.str_schema(),
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, handler):
        """
        Modify the generated JSON Schema to add the airalogy_type property.
        """
        json_schema = handler(schema)
        json_schema.update(
            {"airalogy_type": "RecordId", "pattern": cls._PATTERN.pattern}
        )
        return json_schema
