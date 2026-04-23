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

    def test_validate_valid_quizs(self):
        content = """
```quiz
id: quiz_q1
type: choice
mode: single
score: 2
stem: Pick one
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
```
```quiz
id: quiz_q2
type: choice
mode: multiple
stem: Pick all
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
  - key: C
    text: Option C
```
```quiz
id: quiz_blank_1
type: blank
stem: Fill [[b1]]
blanks:
  - key: b1
    answer: test
```
```quiz
id: quiz_open_1
type: open
stem: Explain
rubric: Include 2 points
```
Reference {{ref_var|quiz_q1}}
"""
        is_valid, errors = validate_aimd(content)

        assert is_valid
        assert len(errors) == 0

    def test_validate_quiz_with_multiline_stem(self):
        content = """
```quiz
id: quiz_q_multiline
type: choice
mode: single
stem: |
  Line 1
  Line 2
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
```
"""
        is_valid, errors = validate_aimd(content)

        assert is_valid
        assert len(errors) == 0

    def test_validate_quiz_with_multi_paragraph_stem(self):
        content = """
```quiz
id: quiz_open_multi_paragraph
type: open
stem: |
  Paragraph 1.

  Paragraph 2.
rubric: Mention at least two factors
```
"""
        is_valid, errors = validate_aimd(content)

        assert is_valid
        assert len(errors) == 0

    def test_validate_quiz_with_invalid_yaml(self):
        content = """
```quiz
id: quiz_q_yaml_error
type: choice
mode: single
default: [A
stem: Pick one
options:
  - key: A
    text: Option A
```
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert "Invalid quiz YAML syntax" in errors[0].message

    def test_validate_invalid_quiz(self):
        content = """
```quiz
id: quiz_q1
type: choice
mode: single
stem: Missing options
```
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert "options must be a non-empty list" in errors[0].message

    def test_validate_invalid_blank_placeholder(self):
        content = """
```quiz
id: quiz_blank_1
type: blank
stem: Fill [[b2]]
blanks:
  - key: b1
    answer: test
```
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert "blank stem contains undefined placeholders: b2" in errors[0].message

    def test_validate_invalid_choice_mode_alias(self):
        content = """
```quiz
id: quiz_q1
type: choice
mode: radio
stem: Pick one
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
```
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert (
            "Invalid choice mode, expected one of: single, multiple"
            in errors[0].message
        )

    def test_validate_invalid_quiz_type_alias(self):
        content = """
```quiz
id: quiz_q1
type: single_choice
mode: single
stem: Pick one
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
```
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert "Invalid quiz type, expected one of: choice, true_false, blank, open, scale" in errors[
            0
        ].message


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

    def test_validate_duplicate_assigned_field_across_runtimes(self):
        content = """
{{var|source_value: int}}
{{var|total_value: int}}

```assigner
from airalogy.assigner import AssignerResult, assigner

@assigner(
    assigned_fields=["total_value"],
    dependent_fields=["source_value"],
    mode="auto",
)
def assign_total_value(dep: dict) -> AssignerResult:
    return AssignerResult(assigned_fields={"total_value": dep["source_value"]})
```

```assigner runtime=client
assigner(
    {
        mode: "auto",
        dependent_fields: ["source_value"],
        assigned_fields: ["total_value"],
    },
    function assign_total_value_client({ source_value }) {
        return {
            total_value: source_value,
        };
    }
);
```
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert (
            'assigned field "total_value" is already handled by server assigner "assign_total_value"'
            in errors[0].message
        )

    def test_validate_cross_runtime_assigner_cycle(self):
        content = """
{{var|field_a: int}}
{{var|field_b: int}}

```assigner
from airalogy.assigner import AssignerResult, assigner

@assigner(
    assigned_fields=["field_a"],
    dependent_fields=["field_b"],
    mode="auto",
)
def assign_field_a(dep: dict) -> AssignerResult:
    return AssignerResult(assigned_fields={"field_a": dep["field_b"]})
```

```assigner runtime=client
assigner(
    {
        mode: "auto",
        dependent_fields: ["field_a"],
        assigned_fields: ["field_b"],
    },
    function assign_field_b({ field_a }) {
        return {
            field_b: field_a,
        };
    }
);
```
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert (
            "Circular dependency detected: server:assign_field_a -> client:assign_field_b -> server:assign_field_a"
            in errors[0].message
        )

    def test_validate_client_assigner_against_external_assigner_file(self, tmp_path):
        content = """
{{var|source_value: int}}
{{var|total_value: int}}

```assigner runtime=client
assigner(
    {
        mode: "auto",
        dependent_fields: ["source_value"],
        assigned_fields: ["total_value"],
    },
    function assign_total_value_client({ source_value }) {
        return {
            total_value: source_value,
        };
    }
);
```
"""
        protocol_dir = tmp_path / "protocol"
        protocol_dir.mkdir()
        (protocol_dir / "assigner.py").write_text(
            """
from airalogy.assigner import AssignerResult, assigner

@assigner(
    assigned_fields=["total_value"],
    dependent_fields=["source_value"],
    mode="auto",
)
def assign_total_value(dep: dict) -> AssignerResult:
    return AssignerResult(assigned_fields={"total_value": dep["source_value"]})
""",
            encoding="utf-8",
        )

        is_valid, errors = validate_aimd(content, protocol_dir=protocol_dir)

        assert not is_valid
        assert len(errors) == 1
        assert (
            'assigner.py: assigned field "total_value" is already handled by client assigner "assign_total_value_client"'
            in errors[0].message
        )

    def test_validate_client_assigner_requires_single_input_parameter(self):
        content = """
{{var|refresh_token: str}}

```assigner runtime=client
assigner(
    {
        mode: "manual",
        dependent_fields: [],
        assigned_fields: ["refresh_token"],
    },
    function issue_refresh_token(a, b) {
        return {
            refresh_token: a,
        };
    }
);
```
"""
        is_valid, errors = validate_aimd(content)

        assert not is_valid
        assert len(errors) == 1
        assert (
            'client assigner "issue_refresh_token" function must accept exactly one dependent_fields parameter'
            in errors[0].message
        )
