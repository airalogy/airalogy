from airalogy.aimd import (
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
