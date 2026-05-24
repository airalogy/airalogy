import importlib
import importlib.util
import json
import logging
import os
import re
import sys
import tomllib
from contextlib import redirect_stdout
from datetime import timedelta
from typing import get_args, get_origin

from airalogy.assigner import DefaultAssigner
from airalogy.ingest import import_records as import_airalogy_records
from airalogy.markdown import extract_assigner_blocks, generate_model, parse_aimd
from airalogy.markdown.errors import AimdParseError
from pydantic import TypeAdapter, ValidationError, create_model

logger = logging.getLogger("protocol_executor_logger")
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

_DEBUG_LOG_PATH = "protocol_debug.log"
_debug_mode = os.environ.get("PROTOCOL_DEBUG", "0") == "1"
if _debug_mode:
    _file_handler = logging.FileHandler(_DEBUG_LOG_PATH)
    _file_handler.setLevel(logging.DEBUG)
    _file_handler.setFormatter(formatter)
    logger.addHandler(_file_handler)

timedelta_adapter = TypeAdapter(timedelta)

_PROTOCOL_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_\-]*$")


def _validate_protocol_name(protocol_name: str) -> str:
    """Validate protocol_name to prevent path traversal."""
    if not _PROTOCOL_NAME_RE.fullmatch(protocol_name):
        raise ValueError(f"Invalid protocol_name: {protocol_name!r}")
    return f"./{protocol_name}"


def deep_merge(dict1: dict, dict2: dict):
    """Merge two dictionaries recursively."""
    result = dict1.copy()
    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


# custom json encoder for timedelta
class RNJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, timedelta):
            return timedelta_adapter.dump_python(obj, mode="json")
        else:
            return json.JSONEncoder.default(self, obj)


class ProtocolStdoutLogger:
    """Capture protocol stdout and forward it into the debug logger."""

    encoding = "utf-8"

    def __init__(self, enabled: bool):
        self.enabled = enabled
        self._buffer = ""

    def write(self, value: str) -> int:
        if not value:
            return 0

        if not self.enabled:
            return len(value)

        self._buffer += value
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            logger.debug(f"protocol stdout: {line.rstrip('\r')}")
        return len(value)

    def flush(self) -> None:
        if self.enabled and self._buffer:
            logger.debug(f"protocol stdout: {self._buffer.rstrip('\r')}")
            self._buffer = ""


def import_module(module_name, force_reload=False):
    importlib.invalidate_caches()

    if not force_reload and module_name in sys.modules:
        return sys.modules[module_name]

    previous = sys.modules.pop(module_name, None)

    spec = importlib.util.find_spec(module_name)
    if spec is None or spec.loader is None:
        logger.warning(f"module {module_name} not found")
        return None

    try:
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module
    except SyntaxError as e:
        sys.modules.pop(module_name, None)
        filename = os.path.basename(e.filename) if e.filename else "<unknown>"
        error_msg = (
            f"Protocol module `{module_name.split('.')[-1]}` has syntax error: {e}"
        )
        error_msg += f"\nfile: {filename}, line: {e.lineno}, offset: {e.offset}"
        error_msg += f"\nerror code: {e.text}"
        logger.error(error_msg)
        raise ImportError(error_msg) from e
    except Exception as e:
        sys.modules.pop(module_name, None)
        error_msg = (
            f"Import protocol module `{module_name.split('.')[-1]}` fail, error: {e}"
        )
        logger.error(error_msg)
        raise ImportError(error_msg) from e


def _load_aimd_model(protocol_name: str):
    """Generate and load the AIMD model module for the protocol."""
    protocol_path = _validate_protocol_name(protocol_name)
    try:
        with open(f"{protocol_path}/protocol.aimd", encoding="utf-8") as aimd_file:
            aimd = aimd_file.read()
        aimd_model_code = generate_model(aimd)
        with open(f"{protocol_path}/aimd_model.py", "w", encoding="utf-8") as out_file:
            out_file.write(aimd_model_code)
    except AimdParseError as e:
        raise ValueError(f"Error parsing protocol.aimd: {e}") from e

    model = import_module(f"{protocol_name}.aimd_model", force_reload=True)
    if model is None or not hasattr(model, "VarModel"):
        raise ValueError(f"Failed to load AIMD model for protocol `{protocol_name}`")
    return model


def parse_protocol(protocol_name: str):
    protocol_path = _validate_protocol_name(protocol_name)
    # check protocol.aimd file
    if not os.path.isfile(f"{protocol_path}/protocol.aimd"):
        raise ValueError("protocol.aimd file not found in package")

    protocol_toml_path = f"{protocol_path}/protocol.toml"
    # check protocol.toml file
    if not os.path.isfile(protocol_toml_path):
        raise ValueError("protocol.toml file not found in package")

    try:
        with open(f"{protocol_path}/protocol.aimd", encoding="utf-8") as aimd_file:
            aimd = aimd_file.read()
        fields = parse_aimd(aimd)["templates"]
        aimd_model_code = generate_model(aimd)
        with open(f"{protocol_path}/aimd_model.py", "w", encoding="utf-8") as out_file:
            out_file.write(aimd_model_code)
        _ensure_assigner(protocol_name, aimd=aimd)
    except AimdParseError as e:
        raise ValueError(f"Error parsing protocol.aimd: {e}") from e
    var_names = {var["name"] for var in fields["var"]}
    steps = {step["name"] for step in fields["step"]}
    checks = {check["name"] for check in fields["check"]}

    # read metadata from protocol.toml
    try:
        with open(protocol_toml_path, "rb") as f:
            meta_data = tomllib.load(f)
    except Exception as e:
        raise ValueError(f"Error parsing protocol.toml: {e}") from e
    if "airalogy_protocol" not in meta_data:
        raise ValueError(
            "Invalid protocol.toml, error: airalogy_protocol not found in protocol.toml"
        )
    meta_data = meta_data["airalogy_protocol"]
    # check id, name, version
    if "id" not in meta_data:
        raise ValueError("Invalid protocol.toml, error: id not found in protocol.toml")
    if "name" not in meta_data:
        raise ValueError(
            "Invalid protocol.toml, error: name not found in protocol.toml"
        )
    if "version" not in meta_data:
        raise ValueError(
            "Invalid protocol.toml, error: version not found in protocol.toml"
        )

    # read env vars from .env file
    env_vars_str = ""
    env_file = f"{protocol_path}/.env"
    if os.path.isfile(env_file):
        with open(env_file, encoding="utf-8") as f:
            env_vars_str = f.read()

    schema = {
        "steps": {},
        "vars": {},
        "checks": {},
    }

    # load aimd model
    aimd_model = import_module(f"{protocol_name}.aimd_model", force_reload=True)
    if aimd_model and hasattr(aimd_model, "VarModel"):
        aimd_schema = aimd_model.VarModel.model_json_schema()
    else:
        aimd_schema = {"type": "object", "required": [], "properties": {}}

    # load var model
    var_model = import_module(f"{protocol_name}.model")
    if var_model and hasattr(var_model, "VarModel"):
        model_schema = var_model.VarModel.model_json_schema()
        # check model schema properties should be defined in AIMD
        errors = []
        for key in model_schema["properties"]:
            if key not in var_names:
                errors.append(f"Model field `{key}` not defined in AIMD file")
        if errors:
            raise ValueError("\n".join(errors))
    else:
        model_schema = {}

    schema["vars"] = deep_merge(aimd_schema, model_schema)

    assigners = {}
    assigner_graph = None
    assigner = import_module(f"{protocol_name}.assigner")
    if assigner:
        if hasattr(assigner, "Assigner"):
            assigners = assigner.Assigner.all_assigned_fields()
            assigner_graph = assigner.Assigner.export_dependency_graph_to_dict()
        else:
            assigners = DefaultAssigner.all_assigned_fields()
            assigner_graph = DefaultAssigner.export_dependency_graph_to_dict()

        errors = []
        for k, v in assigners.items():
            field_name = k.split(".")[0] if "." in k else k
            if (
                field_name not in var_names
                and field_name not in steps
                and field_name not in checks
            ):
                errors.append(f"Assigner field {k} not defined in protocol.aimd file")
            for j in v["dependent_fields"]:
                dep_name = j.split(".")[0] if "." in j else j
                if (
                    dep_name not in var_names
                    and dep_name not in steps
                    and dep_name not in checks
                ):
                    errors.append(
                        f"Assigner dependent field {j} not defined in protocol.aimd file"
                    )
        if errors:
            raise ValueError("\n".join(errors))

    return {
        "meta_data": meta_data,
        "fields": fields,
        "aimd": aimd,
        "json_schema": schema,
        "assigners": assigners,
        "assigner_graph": assigner_graph,
        "env_vars": env_vars_str,
    }


def _ensure_assigner(protocol_name: str, aimd: str | None = None) -> None:
    """Generate assigner.py from protocol.aimd if it doesn't exist."""
    protocol_path = _validate_protocol_name(protocol_name)
    assigner_path = f"{protocol_path}/assigner.py"
    if not os.path.isfile(assigner_path):
        try:
            if aimd is None:
                with open(
                    f"{protocol_path}/protocol.aimd", encoding="utf-8"
                ) as aimd_file:
                    aimd = aimd_file.read()
            assigner_code_blocks = [
                block.get("code", "") if isinstance(block, dict) else block
                for block in extract_assigner_blocks(aimd)
            ]
            assigner_code_blocks = [block for block in assigner_code_blocks if block]
            if len(assigner_code_blocks) > 0:
                with open(assigner_path, "w", encoding="utf-8") as out_file:
                    out_file.write("\n\n".join(assigner_code_blocks))
        except AimdParseError as e:
            raise ValueError(f"Error parsing protocol.aimd: {e}") from e


def assign_variable(protocol_name: str, params: dict) -> dict:
    _validate_protocol_name(protocol_name)
    _ensure_assigner(protocol_name)

    # load assigner
    assigner_module = import_module(f"{protocol_name}.assigner")
    if assigner_module is None:
        raise ValueError("Protocol Package does not have assigner")

    if hasattr(assigner_module, "Assigner"):
        assigner = assigner_module.Assigner
    else:
        assigner = DefaultAssigner

    # load aimd_model
    aimd_model = _load_aimd_model(protocol_name)
    fields = aimd_model.VarModel.model_fields

    # load model
    var_model = import_module(f"{protocol_name}.model")
    if var_model is not None and hasattr(var_model, "VarModel"):
        fields = deep_merge(fields, var_model.VarModel.model_fields)

    try:
        # dependent_data validation and type convert
        attrs = {}
        for k, v in params["dependent_data"].items():
            if k in fields:
                attrs[k] = (fields[k].annotation, fields[k].default)
            elif "." in k:
                var_table_name, sub_var_name = k.split(".", 1)
                if var_table_name not in fields:
                    raise ValueError(f"Var: {var_table_name} not defined in VarModel")
                if get_origin(fields[var_table_name].annotation) is not list:
                    raise ValueError(
                        f"Var table variable: {var_table_name} must be a list"
                    )
                table_type = get_args(fields[var_table_name].annotation)[0]
                if sub_var_name in table_type.model_fields:
                    attrs[k] = (
                        table_type.model_fields[sub_var_name].annotation,
                        table_type.model_fields[sub_var_name].default,
                    )
                else:
                    attrs[k] = (str, ...)
            else:
                attrs[k] = (str, ...)
        ParamsModel = create_model("ParamsModel", **attrs)
        logger.info(f"ParamsModel: {ParamsModel.model_json_schema()}")
        try:
            dependent_data = ParamsModel(**params["dependent_data"])
        except ValidationError as e:
            raise ValueError(f"Dependent data validation failed: {e}") from e
        res = assigner.assign(params["var_name"], dict(dependent_data))
        return res.model_dump()
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Assigner function execute fail, error: {e}") from e


def validate_variables(protocol_name: str, variables: dict) -> dict:
    _validate_protocol_name(protocol_name)
    data = {"data": variables}

    # validate by aimd model
    aimd_model = _load_aimd_model(protocol_name)
    try:
        aimd_model.VarModel(**variables)
    except ValidationError as exc:
        data["errors"] = exc.errors()

    # validate by custom model
    model = import_module(f"{protocol_name}.model")
    if model is not None and hasattr(model, "VarModel"):
        try:
            model.VarModel(**variables)
        except ValidationError as exc:
            existing = data.get("errors", [])
            existing.extend(exc.errors())
            data["errors"] = existing

    return data


def import_records(protocol_name: str, params: dict) -> dict:
    protocol_path = os.path.abspath(_validate_protocol_name(protocol_name))
    input_filename = params.get("input_filename")
    if not isinstance(input_filename, str) or input_filename == "":
        raise ValueError("input_filename is required")

    input_path = os.path.abspath(os.path.join(protocol_path, input_filename))
    if not input_path.startswith(f"{protocol_path}{os.sep}"):
        raise ValueError("input_filename must point inside the protocol package")
    if not os.path.isfile(input_path):
        raise ValueError("input file not found")

    result = import_airalogy_records(
        protocol_dir=protocol_path,
        input_path=input_path,
        input_format=params.get("input_format", "auto"),
        allow_extra_var_fields=bool(params.get("allow_extra_var_fields", False)),
        require_complete_quiz=bool(params.get("require_complete_quiz", False)),
        include_template_defaults=bool(params.get("include_template_defaults", True)),
        generate_record_ids=True,
        validate_model_sync=bool(params.get("validate_model_sync", True)),
        record_version=1,
    )

    return {
        "records": result.records,
        "errors": [
            {
                "row_number": error.row_number,
                "column": error.column,
                "message": error.message,
            }
            for error in result.errors
        ],
    }


def main(action: str, protocol_name: str, input_params: str):
    logger.info(
        f"action: {action}, protocol_name: {protocol_name}, input_params: {input_params}"
    )
    stdout_capture = ProtocolStdoutLogger(enabled=_debug_mode)
    try:
        with redirect_stdout(stdout_capture):
            params = json.loads(input_params)

            if action == "parse_protocol":
                result = parse_protocol(protocol_name)
            elif action == "assign_variable":
                result = assign_variable(protocol_name, params)
            elif action == "validate_variables":
                result = validate_variables(protocol_name, params)
            elif action == "import_records":
                result = import_records(protocol_name, params)
            else:
                raise ValueError(f"Unknown action: {action}")

        result = {
            "success": True,
            "message": "",
            "data": result,
        }
        output = json.dumps(
            result, cls=RNJSONEncoder, separators=(",", ":"), ensure_ascii=False
        )
    except Exception as e:
        logger.exception(e)
        result = {"success": False, "message": repr(e), "error_type": type(e).__name__}
        output = json.dumps(result, separators=(",", ":"), ensure_ascii=False)
    finally:
        stdout_capture.flush()

    logger.info(f"output: {output}")
    print(output)


if __name__ == "__main__":
    action = sys.argv[1]
    protocol_name = sys.argv[2]
    params = sys.argv[3] if len(sys.argv) > 3 else "{}"
    main(action, protocol_name, params)
