import re

html_comment_pattern = re.compile(r"<!--(.*?)-->")
var_name_pattern = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")

# one-line var pattern (previously rnv)
var_pattern = re.compile(r"\{\{var\|(.*?)\}\}")

# one-line var_table pattern (keep as is)
var_table_pattern = re.compile(r"\{\{var_table\|([^|]+?),\s*subvars=\[(.+?)\]\s*\}\}")
var_table_subvar_pattern = re.compile(
    r'subvar="([^"]+)",\s*subvar_title="([^"]+)",\s*subvar_explanation="([^"]+)"'
)
# multi-line var_table pattern
var_table_start_pattern = re.compile(r"\{\{var_table\|")
var_table_end_pattern = re.compile(r".*\}\}")

# one-line step pattern (previously rns)
step_pattern = re.compile(r"\{\{step\|(.*?)\}\}")
step_level_pattern = re.compile(r"^([1-9][0-9]?)$")
step_check_pattern = re.compile(r"check=(True|False)")
checked_message_pattern = re.compile(r'.*?,\s*checked_message="([^"]+)"')

# one-line check pattern (previously rnc)
check_pattern = re.compile(r"\{\{check\|(.*?)\}\}")


class AimdParseError(Exception):
    def __init__(self, message: str, line_number: int):
        super().__init__(f"{message} at line {line_number}.")
        self.line_number = line_number


def validate_var_name(type: str, var_name: str, line_number: int):
    if re.match(var_name_pattern, var_name):
        return True
    else:
        raise AimdParseError(f"Invalid {type} name definition: {var_name}", line_number)


def parse_step(step_str: str, line_number: int) -> dict:
    # step definition: {{step|<step_name>, <step_level>, check=True, checked_message="<message>"}}
    step = {"line_number": line_number, "level": 1}
    checked_message_match = re.match(checked_message_pattern, step_str)
    if checked_message_match is not None:
        step["checked_message"] = checked_message_match.group(1)

    args = [str.strip() for str in step_str.split(",")]
    if len(args) < 1:
        raise AimdParseError("Invalid step definition", line_number)

    step_name = args[0]
    validate_var_name("step", step_name, line_number)
    step["name"] = step_name

    current_arg_index = 1
    if len(args) >= 2 and re.match(step_level_pattern, args[current_arg_index]):
        step["level"] = int(args[current_arg_index])
        current_arg_index += 1

    if current_arg_index < len(args):
        check_match = re.match(step_check_pattern, args[current_arg_index])
        if check_match is None:
            raise AimdParseError("Invalid step check definition", line_number)
        step["check"] = check_match.group(1) == "True"

    return step


def parse_check(check_str: str, line_number: int) -> dict:
    # check definition: {{check|<check_name>, checked_message="<message>"}}
    check = {"line_number": line_number}
    checked_message_match = re.match(checked_message_pattern, check_str)
    if checked_message_match is not None:
        check["checked_message"] = checked_message_match.group(1)

    args = [str.strip() for str in check_str.split(",")]
    if len(args) < 1:
        raise AimdParseError("Invalid check definition", line_number)

    check_name = args[0]
    validate_var_name("check", check_name, line_number)
    check["name"] = check_name
    return check


def parse_variable(var_name: str, line_number: int) -> dict:
    # variable definition: {{var|<variable_name>}}
    var = {"line_number": line_number}
    validate_var_name("var", var_name, line_number)
    var["name"] = var_name
    return var


def parse_var_table(rv_str_matches: tuple[str, str], line_number: int) -> dict:
    # research_variable_table definition: {{var_table|<var_table_name>, subvars=[<subvar_name_1>, <subvar_name_2>, ...]}}
    rv_name, subvars_str = rv_str_matches
    validate_var_name("var_table", rv_name, line_number)
    subvars = []
    for str in subvars_str.split(","):
        subvar_name = str.strip()
        validate_var_name("subvar", subvar_name, line_number)
        subvars.append(subvar_name)
    return {
        "name": rv_name,
        "subvars": subvars,
        "type": "table",
        "line_number": line_number,
    }


def validate_var_name_unique(
    steps: list[dict], variables: list[dict], checks: list[dict]
):
    step_names = set()
    [step_names.add(step["name"]) for step in steps]
    var_names = set()
    for var in variables:
        if var["name"] in step_names:
            raise AimdParseError(
                f"Duplicate variable name: {var['name']}", var["line_number"]
            )
        var_names.add(var["name"])
    for check in checks:
        if check["name"] in step_names or check["name"] in var_names:
            raise AimdParseError(
                f"Duplicate variable name: {check['name']}", check["line_number"]
            )
    return True


# extract variable from aimd file
def extract_vars(aimd_content: str) -> dict:
    steps = []
    vars = []
    checks = []
    line_number = 0
    in_block = False
    block_start_line_number = 0
    block_lines = ""
    lines = aimd_content.splitlines()
    for line in lines:
        line = line.strip()
        line_number += 1
        # skip comment
        if line == "" or re.match(html_comment_pattern, line):
            continue
        # multi-line var_table
        if (
            re.match(var_table_start_pattern, line) is not None
            and re.match(var_table_end_pattern, line) is None
        ):
            in_block = True
            block_start_line_number = line_number
            block_lines = line
            continue
        if in_block:
            if re.match(var_table_start_pattern, line) is not None:
                raise AimdParseError(
                    "Nested var_table block not supported", line_number
                )

            block_lines += line + " "
            if re.match(var_table_end_pattern, line) is not None:
                in_block = False
                match = re.match(var_table_pattern, block_lines)
                if match is not None:
                    vars.append(
                        parse_var_table(match.groups(), block_start_line_number)
                    )
                block_lines = ""
            continue
        # step
        step_matches = re.findall(step_pattern, line)
        step_matches_len = len(step_matches)
        if step_matches_len > 1:
            raise AimdParseError("Invalid step definition", line_number)
        if step_matches_len == 1:
            step = parse_step(step_matches[0], line_number)
            steps.append(step)
        # var_table
        var_table_matches = re.findall(var_table_pattern, line)
        if len(var_table_matches) > 0:
            [
                vars.append(parse_var_table(var, line_number))
                for var in var_table_matches
            ]
        # variable
        var_matches = re.findall(var_pattern, line)
        if len(var_matches) > 0:
            [vars.append(parse_variable(var, line_number)) for var in var_matches]
        # check
        check_matches = re.findall(check_pattern, line)
        if len(check_matches) > 0:
            [checks.append(parse_check(check, line_number)) for check in check_matches]
    validate_var_name_unique(steps, vars, checks)
    return {
        "steps": steps,
        "vars": vars,
        "checks": checks,
    }
