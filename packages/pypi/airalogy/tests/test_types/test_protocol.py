import pytest
from airalogy.types import VersionStr, SnakeStr, ProtocolId, RecordId


class TestVersionStr:
    """Tests for VersionStr type"""

    def test_valid_versions(self):
        assert VersionStr("1.2.3") == "1.2.3"
        assert isinstance(VersionStr("0.0.1"), VersionStr)
        assert VersionStr("10.20.30") == "10.20.30"
        assert isinstance(VersionStr("999.999.999"), VersionStr)

    def test_invalid_versions(self):
        with pytest.raises(ValueError):
            VersionStr("1.2")  # missing patch
        with pytest.raises(ValueError):
            VersionStr("a.b.c")  # non-numeric
        with pytest.raises(ValueError):
            VersionStr("1.2.3.4")  # too many parts
        with pytest.raises(ValueError):
            VersionStr("")  # empty string
        with pytest.raises(ValueError):
            VersionStr("1.2.3-alpha")  # with suffix

    def test_type_annotations(self):
        """Test that type annotations work correctly for VersionStr"""
        version: VersionStr = VersionStr("1.2.3")

        # Should work as normal strings
        assert version.replace(".", "-") == "1-2-3"
        assert len(version) == 5

        # Type checking should work (runtime)
        assert isinstance(version, VersionStr)
        assert isinstance(version, str)

    def test_pydantic_integration(self):
        """Test VersionStr with Pydantic models"""
        from pydantic import BaseModel, ValidationError

        class Model(BaseModel):
            version: VersionStr

        # Valid case
        m = Model(version="1.2.3")
        assert isinstance(m.version, VersionStr)
        assert m.version == "1.2.3"

        # Invalid case
        with pytest.raises(ValidationError):
            Model(version="invalid.version")

        # Schema should contain airalogy_type
        schema = Model.model_json_schema()
        assert schema["properties"]["version"]["airalogy_type"] == "VersionStr"
        assert schema["properties"]["version"]["pattern"] == r"^\d+\.\d+\.\d+$"


class TestSnakeStr:
    """Tests for SnakeStr type"""

    def test_valid_snake_case(self):
        assert SnakeStr("snake_case") == "snake_case"
        assert SnakeStr("snake_case_123") == "snake_case_123"
        assert isinstance(SnakeStr("snake1_case2"), SnakeStr)
        # Edge cases - valid
        assert SnakeStr("a") == "a"  # single letter
        assert SnakeStr("a1") == "a1"  # letter + digit
        assert SnakeStr("a1b2c3") == "a1b2c3"  # mixed letters and digits
        assert (
            SnakeStr("test_123_abc") == "test_123_abc"
        )  # multiple segments with digits
        assert SnakeStr("a_b_c_d_e") == "a_b_c_d_e"  # many segments

    def test_invalid_snake_case(self):
        with pytest.raises(ValueError):
            SnakeStr("CamelCase")  # camel case
        with pytest.raises(ValueError):
            SnakeStr("snake-case")  # hyphen instead of underscore
        with pytest.raises(ValueError):
            SnakeStr("snake__case")  # consecutive underscores
        with pytest.raises(ValueError):
            SnakeStr("snakeCase")  # mixed case

    def test_edge_cases_invalid(self):
        """Test edge cases that should be invalid"""
        with pytest.raises(ValueError):
            SnakeStr("")  # empty string
        with pytest.raises(ValueError):
            SnakeStr("1snake")  # starts with digit
        with pytest.raises(ValueError):
            SnakeStr("_snake")  # starts with underscore
        with pytest.raises(ValueError):
            SnakeStr("a_")  # ends with underscore
        with pytest.raises(ValueError):
            SnakeStr("snake_")  # ends with underscore
        with pytest.raises(ValueError):
            SnakeStr("snake___case")  # multiple consecutive underscores
        with pytest.raises(ValueError):
            SnakeStr("SNAKE_CASE")  # uppercase letters
        with pytest.raises(ValueError):
            SnakeStr("snake case")  # space
        with pytest.raises(ValueError):
            SnakeStr("snake.case")  # dot
        with pytest.raises(ValueError):
            SnakeStr("snake@case")  # special character

    def test_type_annotations(self):
        """Test that type annotations work correctly for SnakeStr"""
        a_str: SnakeStr = SnakeStr("snake_case")

        # Should work as normal strings
        assert a_str.upper() == "SNAKE_CASE"
        assert len(a_str) == 10

        # Type checking should work (runtime)
        assert isinstance(a_str, SnakeStr)
        assert isinstance(a_str, str)

    def test_pydantic_integration(self):
        """Test SnakeStr with Pydantic models"""
        from pydantic import BaseModel, ValidationError

        class Model(BaseModel):
            name: SnakeStr

        # Valid case
        m = Model(name="snake_case")
        assert isinstance(m.name, SnakeStr)
        assert m.name == "snake_case"

        # Invalid case
        with pytest.raises(ValidationError):
            Model(name="CamelCase")

        # Schema should contain airalogy_type
        schema = Model.model_json_schema()
        assert schema["properties"]["name"]["airalogy_type"] == "SnakeStr"


class TestProtocolId:
    """Tests for ProtocolId type"""

    def test_valid_protocol_ids(self):
        valid_id = (
            "airalogy.id.lab.my_lab.project.test_project.protocol.data_analysis.v.1.2.3"
        )
        protocol_id = ProtocolId(valid_id)
        assert protocol_id == valid_id
        assert isinstance(protocol_id, ProtocolId)

        # Test with numbers in components
        valid_id2 = "airalogy.id.lab.lab1.project.proj2.protocol.proto3.v.0.0.1"
        protocol_id2 = ProtocolId(valid_id2)
        assert protocol_id2 == valid_id2

    def test_create_method(self):
        protocol_id = ProtocolId.create(
            "my_lab", "test_project", "data_analysis", "1.2.3"
        )
        expected = (
            "airalogy.id.lab.my_lab.project.test_project.protocol.data_analysis.v.1.2.3"
        )
        assert protocol_id == expected

    def test_invalid_protocol_ids(self):
        # Wrong format
        with pytest.raises(ValueError):
            ProtocolId("wrong.format")

        # Invalid snake_case components
        with pytest.raises(ValueError):
            ProtocolId.create("Invalid-Lab", "test_project", "data_analysis", "1.2.3")

        # Invalid version
        with pytest.raises(ValueError):
            ProtocolId.create(
                "my_lab", "test_project", "data_analysis", "invalid.version"
            )

        # Consecutive underscores
        with pytest.raises(ValueError):
            ProtocolId(
                "airalogy.id.lab.my__lab.project.test_project.protocol.data_analysis.v.1.2.3"
            )

    def test_pydantic_integration(self):
        """Test ProtocolId with Pydantic models"""
        from pydantic import BaseModel, ValidationError

        class Model(BaseModel):
            protocol_id: ProtocolId

        # Valid case
        valid_id = (
            "airalogy.id.lab.my_lab.project.test_project.protocol.data_analysis.v.1.2.3"
        )
        m = Model(protocol_id=valid_id)
        assert isinstance(m.protocol_id, ProtocolId)
        assert m.protocol_id == valid_id

        # Invalid case
        with pytest.raises(ValidationError):
            Model(protocol_id="invalid.protocol.id")

        # Schema should contain airalogy_type
        schema = Model.model_json_schema()
        assert schema["properties"]["protocol_id"]["airalogy_type"] == "ProtocolId"


class TestRecordId:
    """Tests for RecordId type"""

    def test_valid_record_ids(self):
        valid_id = "airalogy.id.record.550e8400-e29b-41d4-a716-446655440000.v.1"
        record_id = RecordId(valid_id)
        assert record_id == valid_id
        assert isinstance(record_id, RecordId)

        # Test with higher version
        valid_id2 = "airalogy.id.record.550e8400-e29b-41d4-a716-446655440000.v.999"
        record_id2 = RecordId(valid_id2)
        assert record_id2 == valid_id2

    def test_create_method(self):
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        record_id = RecordId.create(uuid_str, 1)
        expected = f"airalogy.id.record.{uuid_str}.v.1"
        assert record_id == expected

        # Test with higher version
        record_id2 = RecordId.create(uuid_str, 999)
        expected2 = f"airalogy.id.record.{uuid_str}.v.999"
        assert record_id2 == expected2

    def test_create_method_invalid(self):
        """Test invalid inputs to create method"""
        # Invalid version in create method
        with pytest.raises(ValueError):
            RecordId.create("550e8400-e29b-41d4-a716-446655440000", 0)

        # Invalid UUID in create method
        with pytest.raises(ValueError):
            RecordId.create("invalid-uuid", 1)

        # Negative version
        with pytest.raises(ValueError):
            RecordId.create("550e8400-e29b-41d4-a716-446655440000", -1)

    def test_invalid_record_ids(self):
        # Wrong format
        with pytest.raises(ValueError):
            RecordId("wrong.format")

        # Invalid UUID
        with pytest.raises(ValueError):
            RecordId("airalogy.id.record.invalid-uuid.v.1")

        # Version < 1
        with pytest.raises(ValueError):
            RecordId("airalogy.id.record.550e8400-e29b-41d4-a716-446655440000.v.0")

        # Negative version
        with pytest.raises(ValueError):
            RecordId("airalogy.id.record.550e8400-e29b-41d4-a716-446655440000.v.-1")

    def test_pydantic_integration(self):
        """Test RecordId with Pydantic models"""
        from pydantic import BaseModel, ValidationError

        class Model(BaseModel):
            record_id: RecordId

        # Valid case
        valid_id = "airalogy.id.record.550e8400-e29b-41d4-a716-446655440000.v.1"
        m = Model(record_id=valid_id)
        assert isinstance(m.record_id, RecordId)
        assert m.record_id == valid_id

        # Invalid case
        with pytest.raises(ValidationError):
            Model(record_id="invalid.record.id")

        # Schema should contain airalogy_type
        schema = Model.model_json_schema()
        assert schema["properties"]["record_id"]["airalogy_type"] == "RecordId"
        assert (
            schema["properties"]["record_id"]["pattern"]
            == r"^airalogy\.id\.record\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.v\.(\d+)$"
        )
