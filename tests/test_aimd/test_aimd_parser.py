import pytest

from airalogy.aimd.parser import AimdParseError, extract_vars


def test_extract_vars():
    excepted_result = {
        "steps": [
            {"line_number": 10, "name": "step_1", "level": 1},
            {"line_number": 11, "name": "step_1_1", "level": 2},
            {
                "line_number": 12,
                "name": "step_1_2",
                "level": 2,
                "check": True,
            },
            {
                "line_number": 13,
                "checked_message": "The next step is very important, please be careful.",
                "name": "step_1_3",
                "level": 2,
                "check": True,
            },
            {"line_number": 15, "name": "step_2", "level": 1},
            {"line_number": 39, "name": "step_3", "level": 1, "check": True},
            {"line_number": 40, "name": "step_3_1", "level": 2},
            {"line_number": 41, "name": "step_3_2", "level": 2},
        ],
        "vars": [
            {"line_number": 5, "name": "user"},
            {"line_number": 6, "name": "current_time"},
            {"line_number": 18, "name": "rv_image"},
            {"line_number": 21, "name": "rv_image_flip"},
            {"line_number": 24, "name": "rv_enum_01"},
            {"line_number": 30, "name": "pcr_temp_denaturation_pre"},
            {"line_number": 30, "name": "pcr_time_denaturation_pre"},
            {"line_number": 31, "name": "pcr_temp_denaturation"},
            {"line_number": 31, "name": "pcr_time_denaturation"},
            {"line_number": 32, "name": "pcr_temp_annealing"},
            {"line_number": 32, "name": "pcr_time_annealing"},
            {"line_number": 33, "name": "pcr_temp_extension"},
            {"line_number": 33, "name": "pcr_time_extension"},
            {"line_number": 34, "name": "pcr_temp_extension_post"},
            {"line_number": 34, "name": "pcr_time_extension_post"},
            {"line_number": 35, "name": "pcr_temp_keep"},
            {"line_number": 35, "name": "pcr_time_keep"},
            {"line_number": 37, "name": "pcr_cycle"},
            {
                "name": "pcr_dna_groups",
                "subvars": [
                    "pcr_identifier",
                    "forward_primer_sequence",
                    "reverse_primer_sequence",
                    "template_dna_sequence",
                    "template_dna_concentration",
                ],
                "type": "table",
                "line_number": 44,
            },
            {
                "name": "pcr_dna_groups_2",
                "subvars": [
                    "pcr_identifier",
                    "forward_primer_sequence",
                    "reverse_primer_sequence",
                    "template_dna_sequence",
                    "template_dna_concentration",
                ],
                "type": "table",
                "line_number": 47,
            },
            {"line_number": 52, "name": "var_01"},
            {"line_number": 53, "name": "var_02"},
            {"line_number": 54, "name": "var_03"},
            {"line_number": 55, "name": "var_04"},
            {"line_number": 56, "name": "var_05"},
            {"line_number": 57, "name": "var_06"},
            {"line_number": 66, "name": "pcr_result"},
        ],
        "checks": [
            {"line_number": 60, "name": "check_1"},
            {"line_number": 61, "name": "check_2"},
            {
                "line_number": 62,
                "checked_message": "Please be careful not to let the condensation on the PCR tube wall drop into the PCR reaction system.",
                "name": "check_3",
            },
        ],
    }
    with open("tests/test_aimd/test.aimd") as f:
        aimd_content = f.read()
        result = extract_vars(aimd_content)
        assert result == excepted_result


def test_extract_vars_invalid_step_definition():
    aimd_content = """
        {{step|Step 1, 1, check=True, checked_message="Step 1 is checked"}}
        {{step|Step 2, 2, check=True, checked_message="Step 2 is checked"}}
    """

    with pytest.raises(AimdParseError):
        extract_vars(aimd_content)


def test_extract_vars_duplicate_variable_name():
    aimd_content = """
        {{step|Step 1, 1, check=True, checked_message="Step 1 is checked"}}
        {{var|Variable 1, input_type=image}}
        {{var|Variable 1, input_type=audio}}
    """

    with pytest.raises(AimdParseError):
        extract_vars(aimd_content)
