"""
Comprehensive tests for VarModel generator.
"""

from airalogy.aimd import generate_model


class TestVarModelGenerator:
    """Tests for the VarModel generator."""

    def test_generate_simple_model(self):
        content = """
{{var|name}}
{{var|age}}
"""
        code = generate_model(content)

        assert "class VarModel(BaseModel):" in code
        assert "name: str" in code
        assert "age: str" in code

    def test_generate_typed_model(self):
        content = """
{{var|name: str}}
{{var|age: int}}
{{var|score: float}}
"""
        code = generate_model(content)

        assert "name: str" in code
        assert "age: int" in code
        assert "score: float" in code

    def test_generate_model_with_defaults(self):
        content = """
{{var|name: str = "Unknown"}}
{{var|age: int = 0}}
"""
        code = generate_model(content)

        assert 'Field(default="Unknown")' in code
        assert "Field(default=0)" in code

    def test_generate_model_with_field_kwargs(self):
        content = """
{{var|name: str = "Unknown", title = "User Name", max_length = 50}}
"""
        code = generate_model(content)

        assert "from pydantic import BaseModel, Field" in code
        assert 'title="User Name"' in code
        assert "max_length=50" in code

    def test_generate_model_with_airalogy_types(self):
        content = """
{{var|user_name: UserName}}
{{var|current_time: CurrentTime}}
{{var|avatar: FileIdJPG}}
"""
        code = generate_model(content)

        # Check that specific imports are used instead of import *
        assert "from airalogy.types import" in code
        assert "UserName" in code
        assert "CurrentTime" in code
        assert "FileIdJPG" in code
        # Should not use import *
        assert "from airalogy.types import *" not in code
        assert "user_name: UserName" in code
        assert "current_time: CurrentTime" in code
        assert "avatar: FileIdJPG" in code

    def test_generate_simple_var_table(self):
        """Test generating model from simple var table."""
        content = "{{var|students, subvars=[name, age]}}"
        code = generate_model(content)

        # Should generate nested model
        assert "class StudentsItem(BaseModel):" in code
        assert "name: str" in code
        assert "age: str" in code
        assert "students: list[StudentsItem]" in code

    def test_generate_explicit_type_var_table(self):
        """Test generating model from var table with explicit type."""
        content = '{{var|students: list[Student], title="Student Information", subvars=[name: str, age: int]}}'
        code = generate_model(content)

        # Should use explicit type
        assert "class Student(BaseModel):" in code
        assert "name: str" in code
        assert "age: int" in code
        assert 'students: list[Student] = Field(title="Student Information")' in code

    def test_generate_var_table_with_subvar_defaults(self):
        """Test generating model from var table with subvar defaults."""
        content = (
            '{{var|users, subvars=[name: str = "Unknown", age: int = 18, email: str]}}'
        )
        code = generate_model(content)

        assert "class UsersItem(BaseModel):" in code
        assert 'name: str = Field(default="Unknown")' in code
        assert "age: int = Field(default=18)" in code
        assert "email: str" in code

    def test_generate_var_table_with_subvar_field_params(self):
        """Test generating model from var table with subvar Field parameters."""
        content = """
{{var|participants, title="Participants", subvars=[
    name: str,
    age: int = Field(title="Age", ge=0, description="Age in years"),
    email: str = Field(title="Email", max_length=100)
]}}
"""
        code = generate_model(content)

        assert "class ParticipantsItem(BaseModel):" in code
        assert "name: str" in code
        assert 'age: int = Field(title="Age", ge=0, description="Age in years")' in code
        assert 'email: str = Field(title="Email", max_length=100)' in code
        assert (
            'participants: list[ParticipantsItem] = Field(title="Participants")' in code
        )

    def test_generate_var_table_with_airalogy_types(self):
        """Test generating model from var table with Airalogy types."""
        content = "{{var|records, subvars=[name: str, user_name: UserName, created: CurrentTime, avatar: FileIdJPG]}}"
        code = generate_model(content)

        assert "class RecordsItem(BaseModel):" in code
        assert "name: str" in code
        assert "user_name: UserName" in code
        assert "created: CurrentTime" in code
        assert "avatar: FileIdJPG" in code
        # Should include imports for Airalogy types
        assert "from airalogy.types import" in code
        assert "UserName" in code
        assert "CurrentTime" in code
        assert "FileIdJPG" in code

    def test_generate_var_table_with_description(self):
        """Test generating model from var table with description."""
        content = '{{var|employees, title="Employee List", description="List of all employees", subvars=[name: str, role: str]}}'
        code = generate_model(content)

        assert "class EmployeesItem(BaseModel):" in code
        assert "name: str" in code
        assert "role: str" in code
        assert (
            'employees: list[EmployeesItem] = Field(title="Employee List", description="List of all employees")'
            in code
        )

    def test_generate_snake_case_var_table(self):
        """Test generating model from snake_case var table name."""
        content = "{{var|test_participants, subvars=[name: str, age: int]}}"
        code = generate_model(content)

        # Should convert snake_case to PascalCase for class name
        assert "class TestParticipantsItem(BaseModel):" in code
        assert "name: str" in code
        assert "age: int" in code
        assert "test_participants: list[TestParticipantsItem]" in code

    def test_generate_complex_nested_var_table(self):
        """Test generating model with complex nested structure."""
        content = """
{{var|students: list[Student],
    title="Student Records",
    description="Complete student information",
    subvars=[
        name: str = Field(title="Full Name", max_length=100),
        age: int = Field(title="Age", ge=0, le=120),
        email: str = Field(title="Email", max_length=255),
        gpa: float = Field(title="GPA", ge=0.0, le=4.0),
        active: bool = Field(default=True, title="Active Status")
    ]
}}
"""
        code = generate_model(content)

        assert "class Student(BaseModel):" in code
        assert 'name: str = Field(title="Full Name", max_length=100)' in code
        assert 'age: int = Field(title="Age", ge=0, le=120)' in code
        assert 'email: str = Field(title="Email", max_length=255)' in code
        assert 'gpa: float = Field(title="GPA", ge=0.0, le=4.0)' in code
        assert 'active: bool = Field(default=True, title="Active Status")' in code
        assert (
            'students: list[Student] = Field(title="Student Records", description="Complete student information")'
            in code
        )

    def test_generate_legacy_var_table_syntax(self):
        """Test generating model from legacy var_table syntax."""
        content = "{{var_table|legacy_students, subvars=[name, age, grade]}}"
        code = generate_model(content)

        assert "class LegacyStudentsItem(BaseModel):" in code
        assert "name: str" in code
        assert "age: str" in code
        assert "grade: str" in code
        assert "legacy_students: list[LegacyStudentsItem]" in code

    def test_generate_multiple_var_tables(self):
        """Test generating model with multiple var tables."""
        content = """
{{var|students, title="Students", subvars=[name: str, age: int]}}
{{var|teachers, title="Teachers", subvars=[name: str, subject: str]}}
Regular: {{var|regular_var: str}}
"""
        code = generate_model(content)

        # Should generate both nested models
        assert "class StudentsItem(BaseModel):" in code
        assert "class TeachersItem(BaseModel):" in code
        assert "name: str" in code
        assert "age: int" in code
        assert "subject: str" in code
        assert "regular_var: str" in code

    def test_generate_empty_var_table(self):
        """Test generating model from var table with no subvars."""
        content = "{{var|empty_table, subvars=[]}}"
        code = generate_model(content)

        assert "class EmptyTableItem(BaseModel):" in code
        assert "empty_table: list[EmptyTableItem]" in code

    def test_generate_var_table_without_kwargs(self):
        """Test generating var table without any main kwargs."""
        content = "{{var|simple_table, subvars=[name: str, value: int]}}"
        code = generate_model(content)

        assert "class SimpleTableItem(BaseModel):" in code
        assert "name: str" in code
        assert "value: int" in code
        assert "simple_table: list[SimpleTableItem]" in code
        # Should not import Field if not used
        assert "from pydantic import Field" not in code

    def test_import_optimization(self):
        """Test that imports are optimized correctly."""
        content = """
{{var|users, subvars=[name: str, avatar: FileIdJPG, created: CurrentTime]}}
{{var|status: str = Field(title="Status", max_length=50)}}
"""
        code = generate_model(content)

        # Should include both BaseModel and Field imports
        assert "from pydantic import BaseModel, Field" in code
        # Should include specific Airalogy type imports
        assert "from airalogy.types import" in code
        assert "FileIdJPG" in code
        assert "CurrentTime" in code

    def test_model_structure_order(self):
        """Test that models are generated in correct order."""
        content = "{{var|students, subvars=[name: str, age: int]}}"
        generated_code = generate_model(content)

        lines = generated_code.split("\n")

        # Should have import section first
        import_line = next(i for i, line in enumerate(lines) if line.startswith("from"))
        assert "BaseModel" in lines[import_line]

        # Should have nested model before main model
        nested_model_line = next(
            i for i, line in enumerate(lines) if "class StudentsItem" in line
        )
        main_model_line = next(
            i for i, line in enumerate(lines) if "class VarModel" in line
        )

        assert nested_model_line < main_model_line

    def test_class_name_generation_edge_cases(self):
        """Test edge cases for auto-generated class names."""
        test_cases = [
            ("{{var|user, subvars=[name: str]}}", "UserItem"),
            ("{{var|data, subvars=[value: str]}}", "DataItem"),
            ("{{var|a, subvars=[value: str]}}", "AItem"),
            ("{{var|test_case, subvars=[value: str]}}", "TestCaseItem"),
            ("{{var|very_long_name, subvars=[value: str]}}", "VeryLongNameItem"),
        ]

        for content, expected_class in test_cases:
            code = generate_model(content)
            assert f"class {expected_class}(BaseModel):" in code

    def test_field_indentation(self):
        """Test that class fields have correct 4-space indentation."""
        content = "{{var|students, subvars=[name: str, age: int, active: bool = True]}}"
        code = generate_model(content)

        lines = code.split("\n")

        # Find the StudentsItem class and check field indentation
        class_start = next(
            i
            for i, line in enumerate(lines)
            if "class StudentsItem(BaseModel):" in line
        )

        # Check that fields are properly indented with exactly 4 spaces
        name_line = next(
            i
            for i, line in enumerate(lines[class_start + 1 :], class_start + 1)
            if "name: str" in line
        )
        age_line = next(
            i
            for i, line in enumerate(lines[class_start + 1 :], class_start + 1)
            if "age: int" in line
        )
        active_line = next(
            i
            for i, line in enumerate(lines[class_start + 1 :], class_start + 1)
            if "active: bool" in line
        )

        assert lines[name_line].startswith("    name: str"), (
            f"Line {name_line}: {lines[name_line]}"
        )
        assert lines[age_line].startswith("    age: int"), (
            f"Line {age_line}: {lines[age_line]}"
        )
        assert lines[active_line].startswith("    active: bool"), (
            f"Line {active_line}: {lines[active_line]}"
        )

        # Ensure they don't have 8 spaces (the bug we're fixing)
        assert not lines[name_line].startswith("        name: str")
        assert not lines[age_line].startswith("        age: int")
        assert not lines[active_line].startswith("        active: bool")

    def test_nested_model_field_with_complex_types(self):
        """Test nested model with various complex types and Field parameters."""
        content = """
{{var|employees: list[Employee],
    title="Employee Records",
    subvars=[
        id: int = Field(title="Employee ID", ge=1, description="Unique employee identifier"),
        name: str = Field(title="Full Name", max_length=100, min_length=1),
        email: str = Field(title="Email", max_length=255, regex=r'^[^@]+@[^@]+\\.[^@]+$'),
        hire_date: CurrentTime,
        salary: float = Field(title="Annual Salary", ge=0, description="Annual salary in USD"),
        manager: bool = Field(default=False, title="Is Manager"),
        skills: list[str] = Field(default=[], title="Skills List")
    ]
}}
"""
        code = generate_model(content)

        # Should generate Employee nested model with proper indentation
        assert "class Employee(BaseModel):" in code
        assert (
            'id: int = Field(title="Employee ID", ge=1, description="Unique employee identifier")'
            in code
        )
        assert (
            'name: str = Field(title="Full Name", max_length=100, min_length=1)' in code
        )
        assert (
            "email: str = Field(title=\"Email\", max_length=255, regex=r'^[^@]+@[^@]+\\.[^@]+$')"
            in code
        )
        assert "hire_date: CurrentTime" in code
        assert (
            'salary: float = Field(title="Annual Salary", ge=0, description="Annual salary in USD")'
            in code
        )
        assert 'manager: bool = Field(default=False, title="Is Manager")' in code
        assert 'skills: list[str] = Field(default=[], title="Skills List")' in code

        # Main field should be properly defined
        assert 'employees: list[Employee] = Field(title="Employee Records")' in code

        # Check indentation of complex fields
        lines = code.split("\n")
        for line in lines:
            if line.strip().startswith(
                (
                    "id:",
                    "name:",
                    "email:",
                    "hire_date:",
                    "salary:",
                    "manager:",
                    "skills:",
                )
            ):
                assert line.startswith("    "), f"Field not properly indented: {line}"
                assert not line.startswith("        "), (
                    f"Field has incorrect 8-space indentation: {line}"
                )

    def test_deeply_nested_structure(self):
        """Test code generation with multiple nested tables and complex structures."""
        content = """
{{var|company, title="Company Info", subvars=[
    name: str = Field(title="Company Name"),
    employees: list[Employee] = Field(title="Employee List")
]}}
{{var|Employee, subvars=[
    name: str,
    projects: list[Project] = Field(default=[])
]}}
{{var|Project, subvars=[
    title: str = Field(title="Project Title"),
    budget: float = Field(ge=0)
]}}
"""
        code = generate_model(content)

        # Should generate all three nested models
        assert "class CompanyItem(BaseModel):" in code
        assert (
            "class EmployeeItem(BaseModel):" in code
        )  # Auto-generated since Employee is used as list type
        assert (
            "class ProjectItem(BaseModel):" in code
        )  # Auto-generated since Project is used as list type

        # Check proper field definitions in nested models
        assert 'name: str = Field(title="Company Name")' in code
        assert (
            'employees: list[Employee] = Field(title="Employee List")' in code
        )  # Uses explicit Employee type
        assert "name: str" in code
        assert (
            "projects: list[Project] = Field(default=[])" in code
        )  # Uses explicit Project type
        assert 'title: str = Field(title="Project Title")' in code
        assert "budget: float = Field(ge=0)" in code

        # Check that main VarModel has all fields
        assert 'company: list[CompanyItem] = Field(title="Company Info")' in code
        assert "Employee: list[EmployeeItem]" in code
        assert "Project: list[ProjectItem]" in code

    def test_generated_code_valid_python(self):
        """Test that generated code is valid Python syntax."""
        import ast

        test_cases = [
            "{{var|simple, subvars=[name: str]}}",
            "{{var|complex, subvars=[name: str = Field(title='Name'), age: int = Field(ge=0)]}}",
            "{{var|mixed, subvars=[name: str, data: list[str], flag: bool = True]}}",
        ]

        for content in test_cases:
            code = generate_model(content)
            try:
                ast.parse(code)
            except SyntaxError as e:
                self.fail(
                    f"Generated invalid Python code for content '{content}': {e}\nCode:\n{code}"
                )

    def test_basic_types_no_class_generation(self):
        """Test that basic Python types don't generate unnecessary model classes."""
        basic_types = ["int", "str", "float", "bool"]

        for basic_type in basic_types:
            content = f"{{{{var|items: list[{basic_type}], title='Items'}}}}"
            code = generate_model(content)

            # Should NOT generate a class for basic types
            assert f"class {basic_type}(BaseModel):" not in code

            # Should generate the correct field (note: generated code uses double quotes)
            assert f'items: list[{basic_type}] = Field(title="Items")' in code

    def test_edge_case_empty_content(self):
        """Test handling of empty or minimal AIMD content."""
        # Empty content
        code = generate_model("")
        assert "class VarModel(BaseModel):" in code
        assert "pass" in code  # Should have pass when no fields

        # Only comments/whitespace
        code = generate_model("   \n  # Just a comment  \n   ")
        assert "class VarModel(BaseModel):" in code
