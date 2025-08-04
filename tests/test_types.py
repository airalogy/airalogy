import pytest
from airalogy.types import VersionStr, SnakeStr


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
