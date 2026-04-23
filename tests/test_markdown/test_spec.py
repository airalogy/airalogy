"""
Comprehensive tests for spec.aimd - testing all AIMD syntax variations.
"""

import pytest

from airalogy.markdown import (
    AimdParser,
    QuizNode,
    VarNode,
    VarTableNode,
    parse_aimd,
)


@pytest.fixture
def spec_content():
    """Load spec.aimd content."""
    with open("tests/test_markdown/spec.aimd") as f:
        return f.read()


@pytest.fixture
def parsed_result(spec_content):
    """Parse spec.aimd and return result."""
    parser = AimdParser(spec_content)
    return parser.parse()


@pytest.fixture
def extracted_result(spec_content):
    """Extract vars using parse_aimd function."""
    return parse_aimd(spec_content)


class TestSpecFile:
    """Test parsing of the comprehensive spec.aimd file."""

    def test_file_parses_without_errors(self, parsed_result):
        """Test that the entire spec file parses without errors."""
        assert parsed_result is not None
        assert "templates" in parsed_result

    def test_parse_aimd_parses_without_errors(self, extracted_result):
        """Test that parse_aimd can parse the spec file."""
        assert extracted_result is not None
        assert "templates" in extracted_result

    def test_simple_vars(self, parsed_result):
        """Test simple variable parsing."""
        var_names = {v.name for v in parsed_result["templates"]["var"]}
        assert "simple_var" in var_names
        assert "typed_var" in var_names
        assert "int_var" in var_names
        assert "float_var" in var_names
        assert "bool_var" in var_names

    def test_vars_with_types(self, parsed_result):
        """Test variables with type annotations."""
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

        assert var_dict["var_with_default"].default_value == "default_value"
        assert var_dict["int_with_default"].default_value == 42
        assert var_dict["float_with_default"].default_value == 3.14
        assert var_dict["bool_with_default"].default_value is True

    def test_quizs(self, parsed_result):
        """Test quiz syntax parsing."""
        quiz_dict = {v.id: v for v in parsed_result["templates"]["quiz"]}

        q1 = quiz_dict["quiz_q1"]
        assert isinstance(q1, QuizNode)
        assert q1.stem == "Which option is correct?"
        assert q1.quiz_type == "choice"
        assert q1.options == [
            {"key": "A", "text": "Option A"},
            {"key": "B", "text": "Option B"},
            {"key": "C", "text": "Option C"},
        ]
        assert q1.mode == "single"
        assert q1.score == 5

        q2 = quiz_dict["quiz_q2"]
        assert isinstance(q2, QuizNode)
        assert q2.default == ["A", "C"]
        assert q2.stem == "Select all correct options"
        assert q2.mode == "multiple"

        true_false = quiz_dict["quiz_true_false_1"]
        assert isinstance(true_false, QuizNode)
        assert true_false.quiz_type == "true_false"
        assert true_false.answer is False

        blank = quiz_dict["quiz_blank_1"]
        assert isinstance(blank, QuizNode)
        assert blank.quiz_type == "blank"
        assert blank.blanks == [
            {"key": "b1", "answer": "21%"}
        ]

        open_q = quiz_dict["quiz_open_1"]
        assert isinstance(open_q, QuizNode)
        assert open_q.quiz_type == "open"
        assert open_q.rubric == "Mention at least two factors"

    def test_custom_types(self, parsed_result):
        """Test Airalogy custom types."""
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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

        # list[Student] with subvars
        auto_custom = var_dict["auto_custom_list"]
        assert isinstance(auto_custom, VarTableNode)
        assert auto_custom.type_annotation == "list[Student]"
        assert auto_custom.list_item_type == "Student"
        assert len(auto_custom.subvars) == 2
        # Check the subvars have the expected structure
        subvar_names = [sv.name for sv in auto_custom.subvars]
        assert "name" in subvar_names
        assert "age" in subvar_names

    def test_var_syntax_table(self, parsed_result):
        """Test var() syntax in subvars."""
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

        mixed = var_dict["mixed_table"]
        assert isinstance(mixed, VarTableNode)
        assert mixed.type_annotation == "list[MixedItem]"
        assert mixed.list_item_type == "MixedItem"
        assert mixed.kwargs["title"] == "Mixed Table"
        assert mixed.kwargs["description"] == "A table with various features"
        assert len(mixed.subvars) == 2

    def test_empty_tables(self, parsed_result):
        """Test empty var tables."""
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

        empty_table = var_dict["empty_table"]
        assert isinstance(empty_table, VarTableNode)
        assert len(empty_table.subvars) == 0

        another_empty = var_dict["another_empty"]
        assert isinstance(another_empty, VarTableNode)
        assert len(another_empty.subvars) == 0

    def test_steps(self, parsed_result):
        """Test step parsing."""
        step_dict = {s.name: s for s in parsed_result["templates"]["step"]}

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

        with_duration = step_dict["step_with_duration"]
        assert with_duration.duration == "1h30m"
        assert with_duration.estimated_duration_ms == 5_400_000

        with_timer = step_dict["step_with_timer"]
        assert with_timer.duration == "30s"
        assert with_timer.estimated_duration_ms == 30_000
        assert with_timer.timer == "both"

    def test_checks(self, parsed_result):
        """Test checkpoint parsing."""
        check_dict = {c.name: c for c in parsed_result["templates"]["check"]}

        # Simple checkpoint
        simple = check_dict["simple_check"]
        assert simple.checked_message is None

        # Checkpoint with message
        with_message = check_dict["check_with_message"]
        assert with_message.checked_message == "Please verify this carefully"

    def test_references(self, parsed_result):
        """Test reference parsing."""
        # Check ref_vars
        ref_var_ids = {r.ref_id for r in parsed_result["templates"]["ref_var"]}
        assert "simple_var" in ref_var_ids
        assert "typed_var" in ref_var_ids

        # Check ref_steps
        ref_step_ids = {r.ref_id for r in parsed_result["templates"]["ref_step"]}
        assert "simple_step" in ref_step_ids
        assert "step_with_check" in ref_step_ids

        # Check ref_figs
        ref_fig_ids = {r.ref_id for r in parsed_result["templates"]["ref_fig"]}
        assert "figure_1" in ref_fig_ids
        assert "figure_2" in ref_fig_ids

    def test_citations(self, parsed_result):
        """Test citation parsing."""
        cites = parsed_result["templates"]["cite"]

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
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

        # Should have both regular vars and tables
        assert "regular_var" in var_dict
        assert isinstance(var_dict["regular_var"], VarNode)
        assert var_dict["regular_var"].type_annotation == "str"

        assert "mixed_table2" in var_dict
        assert isinstance(var_dict["mixed_table2"], VarTableNode)

        assert "another_regular" in var_dict
        assert isinstance(var_dict["another_regular"], VarNode)
        assert var_dict["another_regular"].default_value == 42

    def test_parse_aimd_format(self, extracted_result):
        """Test that parse_aimd returns correct format."""
        # Check structure
        assert "templates" in extracted_result

        # Check that all items have required fields
        for var in extracted_result["templates"]["var"]:
            assert "name" in var
            assert "start_line" in var
            assert "start_col" in var
            assert "end_col" in var

        for quiz in extracted_result["templates"]["quiz"]:
            assert "id" in quiz
            assert "start_line" in quiz
            assert "start_col" in quiz
            assert "end_col" in quiz

        for step in extracted_result["templates"]["step"]:
            assert "name" in step
            assert "level" in step
            assert "start_line" in step

        for check in extracted_result["templates"]["check"]:
            assert "name" in check
            assert "start_line" in check

        templates = extracted_result["templates"]
        assert isinstance(templates, dict)
        assert "var" in templates
        assert "quiz" in templates
        assert "step" in templates
        assert "check" in templates
        assert "ref_var" in templates
        assert "ref_step" in templates
        assert "ref_fig" in templates
        assert "cite" in templates
        assert "assigner" in templates
        for value in templates.values():
            assert isinstance(value, list)

    def test_parse_aimd_content_correctness(self, extracted_result):
        """Test that parse_aimd extracts correct content."""
        # Get var names
        var_names = {v["name"] for v in extracted_result["templates"]["var"]}

        # Check some key variables are present
        assert "simple_var" in var_names
        assert "typed_var" in var_names
        assert "simple_table" in var_names
        assert "legacy_table_simple" in var_names
        assert "auto_list_table" in var_names
        assert "quiz_q1" not in var_names
        assert "quiz_q2" not in var_names
        assert "quiz_true_false_1" not in var_names
        assert "quiz_blank_1" not in var_names
        assert "quiz_open_1" not in var_names

        quiz_names = {q["id"] for q in extracted_result["templates"]["quiz"]}
        assert "quiz_q1" in quiz_names
        assert "quiz_q2" in quiz_names
        assert "quiz_true_false_1" in quiz_names
        assert "quiz_blank_1" in quiz_names
        assert "quiz_open_1" in quiz_names

        # Check a var table has subvars
        simple_table = next(
            v for v in extracted_result["templates"]["var"] if v["name"] == "simple_table"
        )
        assert "subvars" in simple_table
        assert len(simple_table["subvars"]) == 3

        # Check a typed var has type_annotation
        typed_var = next(
            v for v in extracted_result["templates"]["var"] if v["name"] == "typed_var"
        )
        assert typed_var["type_annotation"] == "str"

        # Check vars with defaults
        var_default = next(
            v for v in extracted_result["templates"]["var"] if v["name"] == "var_with_default"
        )
        assert var_default["default_value"] == "default_value"

    def test_parse_aimd_step_correctness(self, extracted_result):
        """Test that parse_aimd correctly extracts steps."""
        step_names = {s["name"] for s in extracted_result["templates"]["step"]}

        assert "simple_step" in step_names
        assert "step_level_2" in step_names
        assert "step_with_check" in step_names
        assert "step_with_message" in step_names
        assert "step_with_duration" in step_names

        # Check step with check
        step_check = next(
            s for s in extracted_result["templates"]["step"] if s["name"] == "step_with_check"
        )
        assert step_check["check"] is True

        # Check step with message
        step_msg = next(
            s for s in extracted_result["templates"]["step"] if s["name"] == "step_with_message"
        )
        assert step_msg["check"] is True
        assert step_msg["checked_message"] == "This is a checked message"

        step_duration = next(
            s for s in extracted_result["templates"]["step"] if s["name"] == "step_with_duration"
        )
        assert step_duration["duration"] == "1h30m"
        assert step_duration["estimated_duration_ms"] == 5_400_000

        step_timer = next(
            s for s in extracted_result["templates"]["step"] if s["name"] == "step_with_timer"
        )
        assert step_timer["duration"] == "30s"
        assert step_timer["estimated_duration_ms"] == 30_000
        assert step_timer["timer"] == "both"

    def test_parse_aimd_check_correctness(self, extracted_result):
        """Test that parse_aimd correctly extracts checkpoints."""
        check_names = {c["name"] for c in extracted_result["templates"]["check"]}

        assert "simple_check" in check_names
        assert "check_with_message" in check_names

        # Check with message
        check_msg = next(
            c for c in extracted_result["templates"]["check"] if c["name"] == "check_with_message"
        )
        assert check_msg["checked_message"] == "Please verify this carefully"

    def test_parse_aimd_ref_correctness(self, extracted_result):
        """Test that parse_aimd correctly extracts references."""
        # Check ref_vars
        ref_var_ids = {r["ref_id"] for r in extracted_result["templates"]["ref_var"]}
        assert "simple_var" in ref_var_ids
        assert "typed_var" in ref_var_ids

        # Check ref_steps
        ref_step_ids = {r["ref_id"] for r in extracted_result["templates"]["ref_step"]}
        assert "simple_step" in ref_step_ids
        assert "step_with_check" in ref_step_ids

        # Check ref_figs
        ref_fig_ids = {r["ref_id"] for r in extracted_result["templates"]["ref_fig"]}
        assert "figure_1" in ref_fig_ids
        assert "figure_2" in ref_fig_ids

    def test_parse_aimd_cite_correctness(self, extracted_result):
        """Test that parse_aimd correctly extracts citations."""
        cites = extracted_result["templates"]["cite"]

        # Should have citations
        assert len(cites) > 0

        # Check for multi-ref citation
        multi_cite = next(c for c in cites if len(c["ref_ids"]) > 1)
        assert "ref1" in multi_cite["ref_ids"]
        assert "ref2" in multi_cite["ref_ids"]

    def test_real_world_example(self, parsed_result):
        """Test the real-world example section."""
        var_dict = {v.name: v for v in parsed_result["templates"]["var"]}

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
        check_dict = {c.name: c for c in parsed_result["templates"]["check"]}
        assert "sample_quality" in check_dict
        assert check_dict["sample_quality"].checked_message == "All samples passed QC"


class TestParseAimdStructure:
    """Tests for parse_aimd output structure."""

    def test_parse_aimd_var_item_fields(self):
        """Test that parse_aimd output includes expected var item fields."""
        with open("tests/test_markdown/spec.aimd") as f:
            content = f.read()

        result = parse_aimd(content)
        var = result["templates"]["var"][0]

        # Should expose expected fields for serialized var items
        assert "name" in var
        assert "start_line" in var
        assert "start_col" in var
        assert "end_col" in var

    def test_parse_aimd_structure(self):
        """Test parse_aimd returns correct structure."""
        with open("tests/test_markdown/spec.aimd") as f:
            content = f.read()

        result = parse_aimd(content)

        # Should have exactly this key
        expected_keys = {"templates"}
        assert set(result.keys()) == expected_keys

        # Top-level value is templates (dict of lists)
        for key, value in result.items():
            if key == "templates":
                assert isinstance(value, dict), "templates should be a dict"
                for template_values in value.values():
                    assert isinstance(template_values, list), "template value should be a list"


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
        assert len(result["templates"]["var"]) > 50  # Should have many variables

    def test_parse_aimd_performance(self, spec_content):
        """Test parse_aimd performance."""
        import time

        start_time = time.time()
        result = parse_aimd(spec_content)
        extract_time = time.time() - start_time

        # Should extract in reasonable time (< 1 second)
        assert extract_time < 1.0
        assert len(result["templates"]["var"]) > 50
