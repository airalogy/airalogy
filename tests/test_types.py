import pytest
from airalogy.types import VersionStr, SnakeStr, AiralogyProtocolId, AiralogyRecordId


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


class TestAiralogyProtocolId:
    """Tests for AiralogyProtocolId type"""

    def test_valid_protocol_ids(self):
        valid_id = (
            "airalogy.id.lab.my_lab.project.test_project.protocol.data_analysis.v.1.2.3"
        )
        protocol_id = AiralogyProtocolId(valid_id)
        assert protocol_id == valid_id
        assert isinstance(protocol_id, AiralogyProtocolId)

        # Test with numbers in components
        valid_id2 = "airalogy.id.lab.lab1.project.proj2.protocol.proto3.v.0.0.1"
        protocol_id2 = AiralogyProtocolId(valid_id2)
        assert protocol_id2 == valid_id2

    def test_create_method(self):
        protocol_id = AiralogyProtocolId.create(
            "my_lab", "test_project", "data_analysis", "1.2.3"
        )
        expected = (
            "airalogy.id.lab.my_lab.project.test_project.protocol.data_analysis.v.1.2.3"
        )
        assert protocol_id == expected

    def test_invalid_protocol_ids(self):
        # Wrong format
        with pytest.raises(ValueError):
            AiralogyProtocolId("wrong.format")

        # Invalid snake_case components
        with pytest.raises(ValueError):
            AiralogyProtocolId.create(
                "Invalid-Lab", "test_project", "data_analysis", "1.2.3"
            )

        # Invalid version
        with pytest.raises(ValueError):
            AiralogyProtocolId.create(
                "my_lab", "test_project", "data_analysis", "invalid.version"
            )

        # Consecutive underscores
        with pytest.raises(ValueError):
            AiralogyProtocolId(
                "airalogy.id.lab.my__lab.project.test_project.protocol.data_analysis.v.1.2.3"
            )


class TestAiralogyRecordId:
    """Tests for AiralogyRecordId type"""

    def test_valid_record_ids(self):
        valid_id = "airalogy.id.lab.550e8400-e29b-41d4-a716-446655440000.v.1"
        record_id = AiralogyRecordId(valid_id)
        assert record_id == valid_id
        assert isinstance(record_id, AiralogyRecordId)

        # Test with higher version
        valid_id2 = "airalogy.id.lab.550e8400-e29b-41d4-a716-446655440000.v.999"
        record_id2 = AiralogyRecordId(valid_id2)
        assert record_id2 == valid_id2

    def test_create_method(self):
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        record_id = AiralogyRecordId.create(uuid_str, 1)
        expected = f"airalogy.id.lab.{uuid_str}.v.1"
        assert record_id == expected

        # Test with higher version
        record_id2 = AiralogyRecordId.create(uuid_str, 999)
        expected2 = f"airalogy.id.lab.{uuid_str}.v.999"
        assert record_id2 == expected2

    def test_create_method_invalid(self):
        """Test invalid inputs to create method"""
        # Invalid version in create method
        with pytest.raises(ValueError):
            AiralogyRecordId.create("550e8400-e29b-41d4-a716-446655440000", 0)

        # Invalid UUID in create method
        with pytest.raises(ValueError):
            AiralogyRecordId.create("invalid-uuid", 1)

        # Negative version
        with pytest.raises(ValueError):
            AiralogyRecordId.create("550e8400-e29b-41d4-a716-446655440000", -1)

    def test_invalid_record_ids(self):
        # Wrong format
        with pytest.raises(ValueError):
            AiralogyRecordId("wrong.format")

        # Invalid UUID
        with pytest.raises(ValueError):
            AiralogyRecordId("airalogy.id.lab.invalid-uuid.v.1")

        # Version < 1
        with pytest.raises(ValueError):
            AiralogyRecordId("airalogy.id.lab.550e8400-e29b-41d4-a716-446655440000.v.0")

        # Negative version
        with pytest.raises(ValueError):
            AiralogyRecordId(
                "airalogy.id.lab.550e8400-e29b-41d4-a716-446655440000.v.-1"
            )
