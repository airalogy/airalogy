from airalogy.markdown import (
    validate_aimd,
)


class TestValidator:
    """Tests for AIMD validator."""

    def test_validate_valid_content(self):
        content = """
{{var|name}}
{{step|step_1}}
{{check|check_1}}
"""
        is_valid, errors = validate_aimd(content)

        assert is_valid
        assert len(errors) == 0

    def test_validate_invalid_name(self):
        content = "{{var|_invalid}}"
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert "underscore" in errors[0].message

    def test_validate_duplicate_name(self):
        content = """
{{var|test}}
{{var|test}}
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert "Duplicate" in errors[0].message

    def test_validate_undefined_ref_var(self):
        content = "{{ref_var|undefined}}"
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert "undefined variable" in errors[0].message

    def test_validate_undefined_ref_step(self):
        content = "{{ref_step|undefined}}"
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert "undefined step" in errors[0].message

    def test_validate_valid_references(self):
        content = """
{{var|user}}
{{step|step_1}}
According to {{ref_var|user}} and {{ref_step|step_1}}
"""
        is_valid, errors = validate_aimd(content)

        assert is_valid
        assert len(errors) == 0


class TestValidatorMultipleErrors:
    """Tests for collecting multiple errors at once."""

    def test_multiple_invalid_names(self):
        """Test that multiple invalid names are all collected."""
        content = """
{{var|_invalid1}}
{{var| invalid name}}
{{step|_invalid2}}
{{check| invalid check}}
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 4

        error_messages = [error.message for error in errors]
        assert any(
            "cannot start with underscore" in msg and "_invalid1" in msg
            for msg in error_messages
        )
        assert any("Invalid variable name" in msg for msg in error_messages)
        assert any(
            "cannot start with underscore" in msg and "_invalid2" in msg
            for msg in error_messages
        )
        assert any("Invalid check name" in msg for msg in error_messages)

    def test_duplicate_names_and_invalid_names(self):
        """Test that duplicate names and invalid names are all collected."""
        content = """
{{var|test}}
{{var|_invalid}}
{{var|test}}
{{step|test}}
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 3  # 2 duplicate errors + 1 invalid name error

        error_messages = [error.message for error in errors]
        duplicate_count = sum(
            1 for msg in error_messages if "Duplicate var name" in msg
        )
        invalid_count = sum(
            1 for msg in error_messages if "cannot start with underscore" in msg
        )

        assert duplicate_count == 2
        assert invalid_count == 1

    def test_multiple_custom_type_errors(self):
        """Test that multiple custom type errors are collected."""
        content = """
{{var|students: list[Student]}}
{{var|teachers: list[Teacher]}}
{{var|courses: list[Course]}}
{{var|valid_names: list[str]}}
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 3  # 3 custom type errors, 1 valid type

        error_messages = [error.message for error in errors]
        custom_type_count = sum(
            1
            for msg in error_messages
            if "Custom type" in msg and "requires explicit subvars definition" in msg
        )

        assert custom_type_count == 3
        assert any("Student" in msg for msg in error_messages)
        assert any("Teacher" in msg for msg in error_messages)
        assert any("Course" in msg for msg in error_messages)

    def test_undefined_references_and_invalid_names(self):
        """Test that undefined references and invalid names are all collected."""
        content = """
{{var|valid_user}}
{{var|_invalid_user}}
{{ref_var|nonexistent_var}}
{{step|valid_step}}
{{ref_step|nonexistent_step}}
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 3  # 1 invalid name + 2 undefined references

        error_messages = [error.message for error in errors]
        invalid_name_count = sum(
            1 for msg in error_messages if "cannot start with underscore" in msg
        )
        undefined_ref_count = sum(
            1 for msg in error_messages if "Reference to undefined" in msg
        )

        assert invalid_name_count == 1
        assert undefined_ref_count == 2

    def test_complex_multiple_error_scenario(self):
        """Test a complex scenario with multiple types of errors."""
        content = """
{{var|_invalid1}}
{{var|valid1}}
{{var|duplicate_name}}
{{var|students: list[Student]}}
{{var|duplicate_name}}
{{step|_invalid2}}
{{step|valid_step}}
{{ref_var|nonexistent_var}}
{{ref_step|valid_step}}
{{ref_var|another_nonexistent}}
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert (
            len(errors) == 6
        )  # 2 invalid names + 1 duplicate + 1 custom type + 2 undefined refs

        error_messages = [error.message for error in errors]

        # Count error types
        invalid_name_count = sum(
            1 for msg in error_messages if "cannot start with underscore" in msg
        )
        duplicate_count = sum(
            1 for msg in error_messages if "Duplicate var name" in msg
        )
        custom_type_count = sum(
            1
            for msg in error_messages
            if "Custom type" in msg and "requires explicit subvars definition" in msg
        )
        undefined_ref_count = sum(
            1 for msg in error_messages if "Reference to undefined" in msg
        )

        assert invalid_name_count == 2
        assert duplicate_count == 1
        assert custom_type_count == 1
        assert undefined_ref_count == 2

    def test_error_positions(self):
        """Test that error positions are correctly reported."""
        content = """
{{var|_invalid}}
{{var|good_name}}
{{step|_invalid}}
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 2

        # First error should be on line 2 (var|_invalid)
        # Second error should be on line 4 (step|_invalid)
        error_lines = [error.start_line for error in errors]
        assert 2 in error_lines
        assert 4 in error_lines

        # Check that errors have valid position information
        for error in errors:
            assert error.start_line > 0
            assert error.end_line >= error.start_line
            assert error.start_col > 0
            assert error.end_col >= error.start_col

    def test_no_errors_valid_content(self):
        """Test that valid content produces no errors."""
        content = """
{{var|name: str}}
{{var|ages: list[int]}}
{{step|prepare_sample, 1}}
{{check|quality_check}}
{{ref_var|name}}
{{ref_step|prepare_sample}}
"""
        is_valid, errors = validate_aimd(content)

        assert is_valid
        assert len(errors) == 0

    def test_error_sorting(self):
        """Test that errors are returned in the correct order (by line, then column)."""
        content = """
{{var|good_name}}
{{var|_error1}}
{{step|_error2}}
{{var|_error3}}
{{check|_error4}}
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 4

        # Check that errors are in the correct order
        # Line 3: _error1
        # Line 4: _error2
        # Line 5: _error3
        # Line 6: _error4
        expected_order = ["_error1", "_error2", "_error3", "_error4"]
        actual_order = []

        for error in errors:
            # Extract the invalid name from the error message
            if "cannot start with underscore" in error.message:
                # Find the name in the message
                for name in expected_order:
                    if name in error.message:
                        actual_order.append(name)
                        break

        assert actual_order == expected_order

        # Also verify the line numbers are in ascending order
        line_numbers = [error.start_line for error in errors]
        assert line_numbers == sorted(line_numbers)

    def test_error_sorting_same_line(self):
        """Test that errors on the same line are sorted by column."""
        content = "{{var|_error1}}{{var|_error2}}"
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 2

        # Check that errors are sorted by column position
        column_positions = [error.start_col for error in errors]
        assert column_positions == sorted(column_positions)

        # First error should be _error1 (appears first)
        assert "_error1" in errors[0].message
        assert "_error2" in errors[1].message
