"""
Comprehensive tests for spec.aimd - testing all AIMD syntax variations.
"""

import pytest

from airalogy.aimd import (
    AimdParser,
    CheckNode,
    StepNode,
    VarNode,
    VarTableNode,
    extract_vars,
)


@pytest.fixture
def spec_content():
    """Load spec.aimd content."""
    with open("tests/test_aimd/spec.aimd") as f:
        return f.read()


@pytest.fixture
def parsed_result(spec_content):
    """Parse spec.aimd and return result."""
    parser = AimdParser(spec_content)
    return parser.parse()


@pytest.fixture
def extracted_result(spec_content):
    """Extract vars using extract_vars function."""
    return extract_vars(spec_content)


class TestSpecFile:
    """Test parsing of the comprehensive spec.aimd file."""

    def test_file_parses_without_errors(self, parsed_result):
        """Test that the entire spec file parses without errors."""
        assert parsed_result is not None
        assert "vars" in parsed_result
        assert "steps" in parsed_result
        assert "checks" in parsed_result
        assert "ref_vars" in parsed_result
        assert "ref_steps" in parsed_result
        assert "ref_figs" in parsed_result
        assert "cites" in parsed_result

    def test_extract_vars_parses_without_errors(self, extracted_result):
        """Test that extract_vars can parse the spec file."""
        assert extracted_result is not None
        assert "vars" in extracted_result
        assert "steps" in extracted_result
        assert "checks" in extracted_result
        assert "ref_vars" in extracted_result
        assert "ref_steps" in extracted_result
        assert "ref_figs" in extracted_result
        assert "cites" in extracted_result

    def test_simple_vars(self, parsed_result):
        """Test simple variable parsing."""
        var_names = {v.name for v in parsed_result["vars"]}
        assert "simple_var" in var_names
        assert "typed_var" in var_names
        assert "int_var" in var_names
        assert "float_var" in var_names
        assert "bool_var" in var_names

    def test_vars_with_types(self, parsed_result):
        """Test variables with type annotations."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        assert var_dict["typed_var"].type_annotation == "str"
        assert var_dict["int_var"].type_annotation == "int"
        assert var_dict["float_var"].type_annotation == "float"
        assert var_dict["bool_var"].type_annotation == "bool"

        # Test list types (should be VarTableNode)
        str_list = var_dict["str_list"]
        assert isinstance(str_list, VarTableNode)
        assert str_list.type_annotation == "list[str]"
        assert str_list.list_item_type == "str"

    def test_vars_with_defaults(self, parsed_result):
        """Test variables with default values."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        assert var_dict["var_with_default"].default_value == "default_value"
        assert var_dict["int_with_default"].default_value == 42
        assert var_dict["float_with_default"].default_value == 3.14
        assert var_dict["bool_with_default"].default_value is True

    def test_custom_types(self, parsed_result):
        """Test Airalogy custom types."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        # Test all custom types are present
        custom_types = [
            "user_name",
            "current_time",
            "protocol_id",
            "record_id",
            "atcg_sequence",
            "markdown_content",
            "image_png",
            "image_jpg",
            "document_pdf",
            "data_csv",
            "data_json",
            "doc_word",
            "spreadsheet",
            "presentation",
            "audio_mp3",
            "video_mp4",
            "vector_svg",
            "image_webp",
            "image_tiff",
            "text_md",
            "text_txt",
            "aimd_file",
            "dna_file",
        ]

        for var_name in custom_types:
            assert var_name in var_dict

    def test_vars_with_keword_args(self, parsed_result):
        """Test variables with keyword arguments (Field parameters)."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        # Test metadata
        var_meta = var_dict["var_with_metadata"]
        assert var_meta.kwargs["title"] == "Variable Title"
        assert var_meta.kwargs["description"] == "This is a description"

        # Test string constraints
        var_str = var_dict["constrained_str"]
        assert var_str.kwargs["max_length"] == 100
        assert var_str.kwargs["min_length"] == 5
        assert var_str.kwargs["pattern"] == "^[A-Z][a-z]+$"

        # Test numeric constraints
        var_int = var_dict["constrained_int"]
        assert var_int.kwargs["ge"] == 0
        assert var_int.kwargs["le"] == 100
        assert var_int.kwargs["multiple_of"] == 2

        var_float = var_dict["constrained_float"]
        assert var_float.kwargs["ge"] == 0.0
        assert var_float.kwargs["le"] == 1.0

    def test_legacy_var_tables(self, parsed_result):
        """Test legacy var_table syntax."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        # Legacy var_table should be VarTableNode
        legacy_simple = var_dict["legacy_table_simple"]
        assert isinstance(legacy_simple, VarTableNode)
        assert len(legacy_simple.subvars) == 3
        assert legacy_simple.subvars[0].name == "name"

        legacy_multiline = var_dict["legacy_table_multiline"]
        assert isinstance(legacy_multiline, VarTableNode)
        assert len(legacy_multiline.subvars) == 3

    def test_new_var_tables(self, parsed_result):
        """Test new var syntax with subvars."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        # Simple var table
        simple_table = var_dict["simple_table"]
        assert isinstance(simple_table, VarTableNode)
        assert len(simple_table.subvars) == 3

        # Typed table
        typed_table = var_dict["typed_table"]
        assert isinstance(typed_table, VarTableNode)
        assert typed_table.subvars[0].type_annotation == "str"
        assert typed_table.subvars[1].type_annotation == "int"

        # Table with defaults
        table_defaults = var_dict["table_with_defaults"]
        assert isinstance(table_defaults, VarTableNode)
        assert table_defaults.subvars[0].default_value == "Unknown"
        assert table_defaults.subvars[1].default_value == 18
        assert table_defaults.subvars[2].default_value is True

        # Explicit type table
        explicit_type = var_dict["explicit_type_table"]
        assert isinstance(explicit_type, VarTableNode)
        assert explicit_type.type_annotation == "list[CustomItem]"
        assert explicit_type.list_item_type == "CustomItem"

    def test_auto_detect_list_tables(self, parsed_result):
        """Test auto-detection of list types as var tables."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        # list without subvars
        auto_list = var_dict["auto_list_table"]
        assert isinstance(auto_list, VarTableNode)
        assert auto_list.type_annotation == "list"
        assert len(auto_list.subvars) == 0

        # list[str] without subvars
        auto_typed = var_dict["auto_typed_list"]
        assert isinstance(auto_typed, VarTableNode)
        assert auto_typed.type_annotation == "list[str]"
        assert auto_typed.list_item_type == "str"
        assert len(auto_typed.subvars) == 0

        # list[Student] without subvars
        auto_custom = var_dict["auto_custom_list"]
        assert isinstance(auto_custom, VarTableNode)
        assert auto_custom.type_annotation == "list[Student]"
        assert auto_custom.list_item_type == "Student"
        assert len(auto_custom.subvars) == 0

    def test_var_syntax_table(self, parsed_result):
        """Test var() syntax in subvars."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        var_syntax = var_dict["var_syntax_table"]
        assert isinstance(var_syntax, VarTableNode)
        assert len(var_syntax.subvars) == 2

        # Check first subvar has all properties
        subvar1 = var_syntax.subvars[0]
        assert subvar1.name == "name"
        assert subvar1.type_annotation == "str"
        assert subvar1.default_value == "Default"
        assert subvar1.kwargs["title"] == "Full Name"
        assert subvar1.kwargs["max_length"] == 100

    def test_mixed_table(self, parsed_result):
        """Test table with mixed parameters."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        mixed = var_dict["mixed_table"]
        assert isinstance(mixed, VarTableNode)
        assert mixed.type_annotation == "list[MixedItem]"
        assert mixed.list_item_type == "MixedItem"
        assert mixed.kwargs["title"] == "Mixed Table"
        assert mixed.kwargs["description"] == "A table with various features"
        assert len(mixed.subvars) == 2

    def test_empty_tables(self, parsed_result):
        """Test empty var tables."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        empty_table = var_dict["empty_table"]
        assert isinstance(empty_table, VarTableNode)
        assert len(empty_table.subvars) == 0

        another_empty = var_dict["another_empty"]
        assert isinstance(another_empty, VarTableNode)
        assert len(another_empty.subvars) == 0

    def test_steps(self, parsed_result):
        """Test step parsing."""
        step_dict = {s.name: s for s in parsed_result["steps"]}

        # Simple step
        simple = step_dict["simple_step"]
        assert simple.level == 1
        assert simple.check is False

        # Step with level
        level_2 = step_dict["step_level_2"]
        assert level_2.level == 2

        level_3 = step_dict["step_level_3"]
        assert level_3.level == 3

        # Step with check
        with_check = step_dict["step_with_check"]
        assert with_check.level == 1
        assert with_check.check is True
        assert with_check.checked_message is None

        # Step with check and message
        with_message = step_dict["step_with_message"]
        assert with_message.level == 2
        assert with_message.check is True
        assert with_message.checked_message == "This is a checked message"

    def test_checks(self, parsed_result):
        """Test checkpoint parsing."""
        check_dict = {c.name: c for c in parsed_result["checks"]}

        # Simple checkpoint
        simple = check_dict["simple_check"]
        assert simple.checked_message is None

        # Checkpoint with message
        with_message = check_dict["check_with_message"]
        assert with_message.checked_message == "Please verify this carefully"

    def test_references(self, parsed_result):
        """Test reference parsing."""
        # Check ref_vars
        ref_var_ids = {r.ref_id for r in parsed_result["ref_vars"]}
        assert "simple_var" in ref_var_ids
        assert "typed_var" in ref_var_ids

        # Check ref_steps
        ref_step_ids = {r.ref_id for r in parsed_result["ref_steps"]}
        assert "simple_step" in ref_step_ids
        assert "step_with_check" in ref_step_ids

        # Check ref_figs
        ref_fig_ids = {r.ref_id for r in parsed_result["ref_figs"]}
        assert "figure_1" in ref_fig_ids
        assert "figure_2" in ref_fig_ids

    def test_citations(self, parsed_result):
        """Test citation parsing."""
        cites = parsed_result["cites"]

        # Find the citation with ref1
        simple_cite = next(c for c in cites if "ref1" in c.ref_ids)
        assert "ref1" in simple_cite.ref_ids

        # Find multiple citations
        multi_cite = next(c for c in cites if len(c.ref_ids) > 1)
        assert "ref1" in multi_cite.ref_ids
        assert "ref2" in multi_cite.ref_ids
        assert "ref3" in multi_cite.ref_ids

    def test_multiple_tables(self, parsed_result):
        """Test multiple var tables in one document."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        assert "students" in var_dict
        assert "teachers" in var_dict
        assert "courses" in var_dict

        students = var_dict["students"]
        assert isinstance(students, VarTableNode)
        assert len(students.subvars) == 2

        teachers = var_dict["teachers"]
        assert isinstance(teachers, VarTableNode)
        assert len(teachers.subvars) == 3

    def test_mixed_vars_and_tables(self, parsed_result):
        """Test mixing regular vars and tables."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        # Should have both regular vars and tables
        assert "regular_var" in var_dict
        assert isinstance(var_dict["regular_var"], VarNode)
        assert var_dict["regular_var"].type_annotation == "str"

        assert "mixed_table2" in var_dict
        assert isinstance(var_dict["mixed_table2"], VarTableNode)

        assert "another_regular" in var_dict
        assert isinstance(var_dict["another_regular"], VarNode)
        assert var_dict["another_regular"].default_value == 42

    def test_extract_vars_format(self, extracted_result):
        """Test that extract_vars returns correct format."""
        # Check structure
        assert "vars" in extracted_result
        assert "steps" in extracted_result
        assert "checks" in extracted_result
        assert "ref_vars" in extracted_result
        assert "ref_steps" in extracted_result
        assert "ref_figs" in extracted_result
        assert "cites" in extracted_result

        # Check that all items have required fields
        for var in extracted_result["vars"]:
            assert "name" in var
            assert "start_line" in var
            assert "start_col" in var
            assert "end_col" in var

        for step in extracted_result["steps"]:
            assert "name" in step
            assert "level" in step
            assert "start_line" in step

        for check in extracted_result["checks"]:
            assert "name" in check
            assert "start_line" in check

    def test_extract_vars_content_correctness(self, extracted_result):
        """Test that extract_vars extracts correct content."""
        # Get var names
        var_names = {v["name"] for v in extracted_result["vars"]}

        # Check some key variables are present
        assert "simple_var" in var_names
        assert "typed_var" in var_names
        assert "simple_table" in var_names
        assert "legacy_table_simple" in var_names
        assert "auto_list_table" in var_names

        # Check a var table has subvars
        simple_table = next(v for v in extracted_result["vars"] if v["name"] == "simple_table")
        assert "subvars" in simple_table
        assert len(simple_table["subvars"]) == 3

        # Check a typed var has type_annotation
        typed_var = next(v for v in extracted_result["vars"] if v["name"] == "typed_var")
        assert typed_var["type_annotation"] == "str"

        # Check vars with defaults
        var_default = next(v for v in extracted_result["vars"] if v["name"] == "var_with_default")
        assert var_default["default_value"] == "default_value"

    def test_extract_vars_step_correctness(self, extracted_result):
        """Test that extract_vars correctly extracts steps."""
        step_names = {s["name"] for s in extracted_result["steps"]}

        assert "simple_step" in step_names
        assert "step_level_2" in step_names
        assert "step_with_check" in step_names
        assert "step_with_message" in step_names

        # Check step with check
        step_check = next(s for s in extracted_result["steps"] if s["name"] == "step_with_check")
        assert step_check["check"] is True

        # Check step with message
        step_msg = next(s for s in extracted_result["steps"] if s["name"] == "step_with_message")
        assert step_msg["check"] is True
        assert step_msg["checked_message"] == "This is a checked message"

    def test_extract_vars_check_correctness(self, extracted_result):
        """Test that extract_vars correctly extracts checkpoints."""
        check_names = {c["name"] for c in extracted_result["checks"]}

        assert "simple_check" in check_names
        assert "check_with_message" in check_names

        # Check with message
        check_msg = next(c for c in extracted_result["checks"] if c["name"] == "check_with_message")
        assert check_msg["checked_message"] == "Please verify this carefully"

    def test_extract_vars_ref_correctness(self, extracted_result):
        """Test that extract_vars correctly extracts references."""
        # Check ref_vars
        ref_var_ids = {r["ref_id"] for r in extracted_result["ref_vars"]}
        assert "simple_var" in ref_var_ids
        assert "typed_var" in ref_var_ids

        # Check ref_steps
        ref_step_ids = {r["ref_id"] for r in extracted_result["ref_steps"]}
        assert "simple_step" in ref_step_ids
        assert "step_with_check" in ref_step_ids

        # Check ref_figs
        ref_fig_ids = {r["ref_id"] for r in extracted_result["ref_figs"]}
        assert "figure_1" in ref_fig_ids
        assert "figure_2" in ref_fig_ids

    def test_extract_vars_cite_correctness(self, extracted_result):
        """Test that extract_vars correctly extracts citations."""
        cites = extracted_result["cites"]

        # Should have citations
        assert len(cites) > 0

        # Check for multi-ref citation
        multi_cite = next(c for c in cites if len(c["ref_ids"]) > 1)
        assert "ref1" in multi_cite["ref_ids"]
        assert "ref2" in multi_cite["ref_ids"]

    def test_real_world_example(self, parsed_result):
        """Test the real-world example section."""
        var_dict = {v.name: v for v in parsed_result["vars"]}

        # Check experimenter
        assert "experimenter" in var_dict
        assert var_dict["experimenter"].type_annotation == "UserName"

        # Check experiment_date
        assert "experiment_date" in var_dict
        assert var_dict["experiment_date"].type_annotation == "CurrentTime"

        # Check protocol
        assert "protocol" in var_dict
        assert var_dict["protocol"].type_annotation == "ProtocolId"

        # Check samples table
        assert "samples" in var_dict
        samples = var_dict["samples"]
        assert isinstance(samples, VarTableNode)
        assert len(samples.subvars) == 3
        assert samples.subvars[0].name == "sample_id"
        assert samples.subvars[1].name == "concentration"
        assert samples.subvars[2].name == "volume"

        # Check sample_quality checkpoint
        check_dict = {c.name: c for c in parsed_result["checks"]}
        assert "sample_quality" in check_dict
        assert check_dict["sample_quality"].checked_message == "All samples passed QC"


class TestExtractVarsBackwardCompatibility:
    """Test that extract_vars maintains backward compatibility."""

    def test_extract_vars_old_format_fields(self):
        """Test that extract_vars output has backward compatible field names."""
        with open("tests/test_aimd/spec.aimd") as f:
            content = f.read()

        result = extract_vars(content)
        var = result["vars"][0]

        # Should have both new and old field names for compatibility
        assert "name" in var
        assert "start_line" in var
        assert "start_col" in var
        assert "end_col" in var

    def test_extract_vars_structure(self):
        """Test extract_vars returns correct structure."""
        with open("tests/test_aimd/spec.aimd") as f:
            content = f.read()

        result = extract_vars(content)

        # Should have exactly these keys
        expected_keys = {"vars", "steps", "checks", "ref_vars", "ref_steps", "ref_figs", "cites"}
        assert set(result.keys()) == expected_keys

        # All values should be lists
        for key, value in result.items():
            assert isinstance(value, list), f"{key} should be a list"


class TestPerformance:
    """Performance tests for large spec file."""

    def test_parse_performance(self, spec_content):
        """Test parsing performance."""
        import time

        start_time = time.time()
        parser = AimdParser(spec_content)
        result = parser.parse()
        parse_time = time.time() - start_time

        # Should parse in reasonable time (< 1 second for this file)
        assert parse_time < 1.0
        assert len(result["vars"]) > 50  # Should have many variables

    def test_extract_vars_performance(self, spec_content):
        """Test extract_vars performance."""
        import time

        start_time = time.time()
        result = extract_vars(spec_content)
        extract_time = time.time() - start_time

        # Should extract in reasonable time (< 1 second)
        assert extract_time < 1.0
        assert len(result["vars"]) > 50
