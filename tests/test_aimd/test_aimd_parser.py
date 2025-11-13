"""
Tests for the AIMD parser.
"""

import pytest

from airalogy.aimd import (
    AimdParser,
    CheckNode,
    DuplicateNameError,
    InvalidNameError,
    Lexer,
    StepNode,
    TokenType,
    VarNode,
    VarTableNode,
    extract_vars,
)


class TestLexer:
    """Tests for the Lexer."""

    def test_tokenize_simple_var(self):
        content = "Name: {{var|name}}"
        lexer = Lexer(content)
        tokens = list(lexer.tokenize())

        assert len(tokens) == 2  # VAR + EOF
        assert tokens[0].type == TokenType.VAR
        assert tokens[0].value == "name"
        assert tokens[0].position.start_line == 1
        assert tokens[0].position.end_line == 1
        assert tokens[0].position.start_col == 7
        assert tokens[0].position.end_col == len(content)
        assert tokens[1].type == TokenType.EOF

    def test_tokenize_multiple_types(self):
        content = """
{{var|user}}
{{step|step_1, 1}}
{{check|check_1}}
{{ref_var|user}}
"""
        lexer = Lexer(content)
        tokens = list(lexer.tokenize())

        assert len(tokens) == 5  # 4 tokens + EOF
        assert tokens[0].type == TokenType.VAR
        assert tokens[1].type == TokenType.STEP
        assert tokens[2].type == TokenType.CHECK
        assert tokens[3].type == TokenType.REF_VAR

    def test_tokenize_with_position(self):
        content = "Line 1\n{{var|test}}\nLine 3"
        lexer = Lexer(content)
        tokens = list(lexer.tokenize())

        var_token = tokens[0]
        assert var_token.position.start_line == 2
        assert var_token.position.end_line == 2
        assert var_token.position.start_col == 1
        assert var_token.position.end_col == len("{{var|test}}")


class TestParser:
    """Tests for the main parser."""

    def test_parse_simple_var(self):
        content = "{{var|test_var}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var = result["vars"][0]
        assert isinstance(var, VarNode)
        assert var.name == "test_var"
        assert var.type_annotation is None

    def test_parse_typed_var(self):
        content = "{{var|age: int}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var = result["vars"][0]
        assert var.name == "age"
        assert var.type_annotation == "int"

    def test_parse_typed_var_with_default(self):
        content = '{{var|name: str = "Unknown"}}'
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var = result["vars"][0]
        assert var.name == "name"
        assert var.type_annotation == "str"
        assert var.default_value == "Unknown"

    def test_parse_typed_var_with_kwargs(self):
        content = '{{var|name: str = "Unknown", title = "User Name", max_length = 50}}'
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var = result["vars"][0]
        assert var.name == "name"
        assert var.type_annotation == "str"
        assert var.default_value == "Unknown"
        assert var.kwargs["title"] == "User Name"
        assert var.kwargs["max_length"] == 50

    def test_parse_var_table(self):
        content = "{{var_table|students, subvars=[name, age, grade]}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "students"
        assert len(var_table.subvars) == 3
        assert isinstance(var_table.subvars[0], VarNode)
        assert var_table.subvars[0].name == "name"
        assert var_table.subvars[1].name == "age"
        assert var_table.subvars[2].name == "grade"

    def test_parse_multiline_var_table(self):
        content = """
{{var_table|students,
subvars=[
    name,
    age,
    grade
]}}
"""
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert var_table.name == "students"
        assert len(var_table.subvars) == 3
        assert var_table.subvars[0].name == "name"
        assert var_table.subvars[1].name == "age"
        assert var_table.subvars[2].name == "grade"

    def test_parse_new_var_table_syntax(self):
        """Test new var table syntax using {{var|...}} instead of {{var_table|...}}"""
        content = "{{var|students, subvars=[name, age, grade]}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "students"
        assert len(var_table.subvars) == 3
        assert var_table.subvars[0].name == "name"
        assert var_table.subvars[1].name == "age"
        assert var_table.subvars[2].name == "grade"

    def test_parse_new_var_table_with_typed_subvars(self):
        """Test new var table syntax with typed subvars"""
        content = "{{var|students, subvars=[name: str, age: int, grade: float]}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "students"
        assert len(var_table.subvars) == 3

        # Check subvar types
        assert var_table.subvars[0].name == "name"
        assert var_table.subvars[0].type_annotation == "str"
        assert var_table.subvars[1].name == "age"
        assert var_table.subvars[1].type_annotation == "int"
        assert var_table.subvars[2].name == "grade"
        assert var_table.subvars[2].type_annotation == "float"

    def test_parse_new_var_table_with_defaults(self):
        """Test new var table syntax with default values"""
        content = '{{var|students, subvars=[name: str = "Unknown", age: int = 18, grade: str = "A"]}}'
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "students"
        assert len(var_table.subvars) == 3

        # Check subvar defaults
        assert var_table.subvars[0].name == "name"
        assert var_table.subvars[0].default_value == "Unknown"
        assert var_table.subvars[1].name == "age"
        assert var_table.subvars[1].default_value == 18
        assert var_table.subvars[2].name == "grade"
        assert var_table.subvars[2].default_value == "A"

    def test_parse_new_var_table_with_explicit_list_type(self):
        """Test new var table syntax with explicit list type"""
        content = "{{var|students: list[Student], subvars=[name: str, age: int]}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "students"
        assert var_table.type_annotation == "list[Student]"
        assert var_table.list_item_type == "Student"
        # Note: The main var type annotation will be handled during model generation

    def test_parse_new_var_table_with_var_syntax(self):
        """Test new var table syntax using var() calls"""
        content = """
{{var|students, subvars=[
    var(name: str = "ZHANG San", title="Student Name", max_length=50),
    var(age: int = 18, title="Student Age", ge=0)
]}}
"""
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "students"
        assert len(var_table.subvars) == 2

        # Check first subvar
        assert var_table.subvars[0].name == "name"
        assert var_table.subvars[0].type_annotation == "str"
        assert var_table.subvars[0].default_value == "ZHANG San"
        assert var_table.subvars[0].kwargs["title"] == "Student Name"
        assert var_table.subvars[0].kwargs["max_length"] == 50

        # Check second subvar
        assert var_table.subvars[1].name == "age"
        assert var_table.subvars[1].type_annotation == "int"
        assert var_table.subvars[1].default_value == 18
        assert var_table.subvars[1].kwargs["ge"] == 0

    def test_parse_list_type_as_var_table(self):
        """Test that list type without subvars is treated as var table"""
        content = "{{var|user_ids: list}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "user_ids"
        assert var_table.type_annotation == "list"
        assert len(var_table.subvars) == 0  # Empty subvars list

    def test_parse_list_with_item_type_as_var_table(self):
        """Test that list[Type] without subvars is treated as var table"""
        content = "{{var|user_names: list[str]}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "user_names"
        assert var_table.type_annotation == "list[str]"
        assert var_table.list_item_type == "str"
        assert len(var_table.subvars) == 0

    def test_parse_list_with_explicit_item_type_as_var_table(self):
        """Test that list[CustomType] without subvars is treated as var table"""
        content = "{{var|students: list[Student]}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["vars"]) == 1
        var_table = result["vars"][0]
        assert isinstance(var_table, VarTableNode)
        assert var_table.name == "students"
        assert var_table.type_annotation == "list[Student]"
        assert var_table.list_item_type == "Student"
        assert len(var_table.subvars) == 0

    def test_parse_step(self):
        content = "{{step|prepare_sample}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["steps"]) == 1
        step = result["steps"][0]
        assert isinstance(step, StepNode)
        assert step.name == "prepare_sample"
        assert step.level == 1
        assert step.check is False

    def test_parse_step_with_level(self):
        content = "{{step|add_buffer, 2}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["steps"]) == 1
        step = result["steps"][0]
        assert step.name == "add_buffer"
        assert step.level == 2

    def test_parse_step_with_check(self):
        content = "{{step|incubate, 2, check=True}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["steps"]) == 1
        step = result["steps"][0]
        assert step.name == "incubate"
        assert step.level == 2
        assert step.check is True

    def test_parse_step_with_checked_message(self):
        content = (
            '{{step|cleanup, 1, check=True, checked_message="Workspace cleaned."}}'
        )
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["steps"]) == 1
        step = result["steps"][0]
        assert step.name == "cleanup"
        assert step.check is True
        assert step.checked_message == "Workspace cleaned."

    def test_parse_check(self):
        content = "{{check|quality_check}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["checks"]) == 1
        check = result["checks"][0]
        assert isinstance(check, CheckNode)
        assert check.name == "quality_check"

    def test_parse_check_with_message(self):
        content = '{{check|pcr_on_ice, checked_message="Avoid condensation dripping."}}'
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["checks"]) == 1
        check = result["checks"][0]
        assert check.name == "pcr_on_ice"
        assert check.checked_message == "Avoid condensation dripping."

    def test_parse_ref_var(self):
        content = "{{var|user}}\nAccording to {{ref_var|user}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["ref_vars"]) == 1
        assert result["ref_vars"][0].ref_id == "user"

    def test_parse_ref_step(self):
        content = "{{step|step_1}}\nAccording to {{ref_step|step_1}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["ref_steps"]) == 1
        assert result["ref_steps"][0].ref_id == "step_1"

    def test_parse_cite(self):
        content = "{{cite|ref1,ref2,ref3}}"
        parser = AimdParser(content)
        result = parser.parse()

        assert len(result["cites"]) == 1
        cite = result["cites"][0]
        assert cite.ref_ids == ["ref1", "ref2", "ref3"]

    def test_invalid_name_starting_with_underscore(self):
        content = "{{var|_invalid}}"
        parser = AimdParser(content)

        with pytest.raises(InvalidNameError) as exc_info:
            parser.parse()
        assert "cannot start with underscore" in str(exc_info.value)

    def test_invalid_name_with_spaces(self):
        content = "{{var|invalid name}}"
        parser = AimdParser(content)

        with pytest.raises(InvalidNameError) as exc_info:
            parser.parse()
        assert "Invalid variable name" in str(exc_info.value)

    def test_duplicate_names(self):
        content = """
{{var|test}}
{{var|test}}
"""
        parser = AimdParser(content)

        with pytest.raises(DuplicateNameError) as exc_info:
            parser.parse()
        assert "Duplicate name" in str(exc_info.value)

    def test_duplicate_names_normalized(self):
        """Test that user_a and user__a are treated as duplicates."""
        content = """
{{var|user_a}}
{{var|user__a}}
"""
        parser = AimdParser(content)

        with pytest.raises(DuplicateNameError) as exc_info:
            parser.parse()
        assert "Duplicate name" in str(exc_info.value)

    def test_duplicate_across_types(self):
        """Test that duplicate names are caught across var/step/check."""
        content = """
{{var|test}}
{{step|test}}
"""
        parser = AimdParser(content)

        with pytest.raises(DuplicateNameError) as exc_info:
            parser.parse()
        assert "Duplicate name" in str(exc_info.value)


class TestExtractVars:
    """Tests for backwards compatible extract_vars function."""

    def test_extract_vars_backwards_compatible(self):
        """Test that extract_vars returns data in old format."""
        content = """
{{var|user}}
{{step|step_1}}
{{check|check_1}}
"""
        result = extract_vars(content)

        assert "vars" in result
        assert "steps" in result
        assert "checks" in result

        # Check old format structure
        assert result["vars"][0]["name"] == "user"
        assert result["vars"][0]["start_line"] == 2

        assert result["steps"][0]["name"] == "step_1"
        assert result["steps"][0]["start_line"] == 3

        assert result["checks"][0]["name"] == "check_1"
        assert result["checks"][0]["start_line"] == 4

    def test_extract_vars_with_typed_syntax(self):
        """Test extract_vars with typed syntax."""
        content = '{{var|name: str = "Test"}}'
        result = extract_vars(content)

        assert len(result["vars"]) == 1
        var = result["vars"][0]
        assert var["name"] == "name"
        assert var["type_annotation"] == "str"
        assert var["default_value"] == "Test"
