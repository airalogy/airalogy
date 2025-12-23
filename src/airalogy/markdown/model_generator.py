"""
VarModel generator - generates Pydantic models from parsed AIMD.
"""

import re
from typing import Any, Dict, List, Set, Tuple

from airalogy import types

from .ast_nodes import VarNode, VarTableNode
from .parser import AimdParser

# Mapping of standard library type names to (module, name) tuples for imports.
# These are types from Python's standard library that work with Pydantic
# and can be dumped to JSON schema via model_json_schema().
STANDARD_LIBRARY_TYPES: Dict[str, Tuple[str, str]] = {
    # datetime module
    "datetime": ("datetime", "datetime"),
    "date": ("datetime", "date"),
    "time": ("datetime", "time"),
    "timedelta": ("datetime", "timedelta"),
    # decimal module
    "Decimal": ("decimal", "Decimal"),
    # uuid module
    "UUID": ("uuid", "UUID"),
    # ipaddress module
    "IPv4Address": ("ipaddress", "IPv4Address"),
    "IPv6Address": ("ipaddress", "IPv6Address"),
}


def _type_matches(type_name: str, annotation: str) -> bool:
    """
    Check if a type name appears in a type annotation using word boundary matching.

    This prevents false matches like "date" matching in "datetime".

    Args:
        type_name: The type name to look for (e.g., "date", "datetime")
        annotation: The type annotation string to search in

    Returns:
        True if the type name is found as a whole word in the annotation
    """
    # Match whole word boundaries for the type name
    # This handles cases like:
    # - "date" matches "date" but not "datetime"
    # - "datetime" matches "datetime" or "list[datetime]" but not "datetime_date"
    pattern = r"\b" + re.escape(type_name) + r"\b"
    return re.search(pattern, annotation) is not None


class ModelGenerator:
    """
    Generates Pydantic VarModel code from parsed AIMD variables.

    This generator creates Python code for a Pydantic BaseModel based on
    the variable definitions found in an AIMD document.
    """

    def __init__(self, aimd_content: str):
        """
        Initialize generator with AIMD content.

        Args:
            aimd_content: AIMD document content
        """
        self.parser = AimdParser(aimd_content)
        self.parsed = self.parser.parse()
        self.airalogy_type_names = set(types.__all__)
        self.standard_library_types = set(STANDARD_LIBRARY_TYPES.keys())

    def _get_imports(self) -> Set[str]:
        """
        Determine required imports based on variable types.

        Returns:
            Set of import statements needed
        """
        imports = {"from pydantic import BaseModel"}
        has_field_usage = False
        airalogy_types_used = set()
        standard_library_types_used: Dict[str, Set[str]] = {}  # module -> set of types

        for var in self.parsed["vars"]:
            # Check if Field is needed (for any kwargs or special parameters)
            if isinstance(var, VarNode):
                if var.kwargs or var.default_value is not None:
                    has_field_usage = True

                # Check if any Airalogy types are used
                if var.type_annotation:
                    for airalogy_type in self.airalogy_type_names:
                        if _type_matches(airalogy_type, var.type_annotation):
                            airalogy_types_used.add(airalogy_type)

                    # Check for standard library types
                    for std_type in self.standard_library_types:
                        if _type_matches(std_type, var.type_annotation):
                            module, name = STANDARD_LIBRARY_TYPES[std_type]
                            if module not in standard_library_types_used:
                                standard_library_types_used[module] = set()
                            standard_library_types_used[module].add(name)

                # For VarTableNode, also check subvars for Field usage and types
                if isinstance(var, VarTableNode):
                    for subvar in var.subvars:
                        if subvar.kwargs or subvar.default_value is not None:
                            has_field_usage = True
                        if subvar.type_annotation:
                            for airalogy_type in self.airalogy_type_names:
                                if _type_matches(airalogy_type, subvar.type_annotation):
                                    airalogy_types_used.add(airalogy_type)

                            # Check for standard library types
                            for std_type in self.standard_library_types:
                                if _type_matches(std_type, subvar.type_annotation):
                                    module, name = STANDARD_LIBRARY_TYPES[std_type]
                                    if module not in standard_library_types_used:
                                        standard_library_types_used[module] = set()
                                    standard_library_types_used[module].add(name)

        if has_field_usage:
            imports.add("from pydantic import BaseModel, Field")
            imports.discard("from pydantic import BaseModel")

        if airalogy_types_used:
            # Create specific imports
            types_list = ", ".join(sorted(airalogy_types_used))
            imports.add(f"from airalogy.types import {types_list}")

        # Add standard library imports
        for module, type_names in sorted(standard_library_types_used.items()):
            types_list = ", ".join(sorted(type_names))
            imports.add(f"from {module} import {types_list}")

        return imports

    def _format_default_value(self, value: Any) -> str:
        """
        Format a default value for Python code.

        Args:
            value: Default value

        Returns:
            String representation for Python code
        """
        if isinstance(value, str):
            return f'"{value}"'
        elif value is None:
            return "None"
        else:
            return str(value)

    def _generate_field_definition(self, var: VarNode) -> str:
        """
        Generate a single field definition for VarModel.

        Args:
            var: VarNode to generate field for

        Returns:
            Python code for the field definition
        """
        name = var.name
        type_annotation = var.type_annotation or "str"

        # Simple case: no default or kwargs
        if var.default_value is None and not var.kwargs:
            return f"    {name}: {type_annotation}"

        # Need to use Field()
        field_args = []

        # Add default as first positional argument if present
        if var.default_value is not None:
            field_args.append(
                f"default={self._format_default_value(var.default_value)}"
            )

        # Add kwargs
        for key, value in var.kwargs.items():
            if isinstance(value, str):
                field_args.append(f'{key}="{value}"')
            else:
                field_args.append(f"{key}={value}")

        field_call = f"Field({', '.join(field_args)})"
        return f"    {name}: {type_annotation} = {field_call}"

    def _generate_table_model(self, var: VarTableNode, nested_models: List[str]) -> str:
        """
        Generate a nested model for a variable table.

        Args:
            var: VarTableNode to generate model for
            nested_models: List to append nested model definitions

        Returns:
            Field definition for the table in VarModel
        """
        # Get the proper item type name (explicit or auto-generated)
        item_type_name = var.get_item_type_name()

        # Check if the item type is a basic Python type that shouldn't have a model class
        basic_types = {"str", "int", "float", "bool", "list", "dict"}

        # Only generate nested model if it's not a basic type
        # For auto-generated types (from var name without explicit type), always generate class
        # For explicitly specified basic types (like list[int]), don't generate class
        # For explicitly specified complex types (like list[Employee]), generate class only if we have subvars
        should_generate_model = item_type_name not in basic_types and (
            var.auto_item_type is not None  # Auto-generated type, always generate
            or (
                var.list_item_type is not None and var.subvars
            )  # Explicit type with subvars
        )

        if should_generate_model:
            # Generate the nested model
            nested_model = f"class {item_type_name}(BaseModel):\n"
            nested_model += '    """Row model for variable table."""\n'

            for subvar in var.subvars:
                # Use the subvar's type annotation or default to str
                subvar_type_annotation = subvar.type_annotation or "str"

                # Check if default_value is a Field call (starts with "Field(")
                if (
                    subvar.default_value
                    and isinstance(subvar.default_value, str)
                    and subvar.default_value.startswith("Field(")
                ):
                    # Directly use the Field call as the field definition
                    field_def = f"    {subvar.name}: {subvar_type_annotation} = {subvar.default_value}"
                else:
                    # Generate regular field definition (already has 4 spaces indent)
                    field_def = self._generate_field_definition(subvar)

                nested_model += field_def + "\n"

            nested_models.append(nested_model)

        # Generate the field definition for VarModel
        # Start with the base field definition (including kwargs, title, description, etc.)
        if var.kwargs or var.default_value is not None:
            # Generate the field definition manually since we need the correct type
            name = var.name
            field_args = []

            # Add default as first positional argument if present
            if var.default_value is not None:
                field_args.append(
                    f"default={self._format_default_value(var.default_value)}"
                )

            # Add kwargs
            for key, value in var.kwargs.items():
                if isinstance(value, str):
                    field_args.append(f'{key}="{value}"')
                else:
                    field_args.append(f"{key}={value}")

            field_call = f"Field({', '.join(field_args)})"
            field_def = f"    {name}: list[{item_type_name}] = {field_call}"
        else:
            # Simple case: no kwargs or default
            field_def = f"    {var.name}: list[{item_type_name}]"

        return field_def

    def generate_model(self) -> str:
        """
        Generate complete VarModel Python code.

        Returns:
            Python code for VarModel class
        """
        imports = self._get_imports()
        nested_models = []
        fields = []

        for var in self.parsed["vars"]:
            if isinstance(var, VarTableNode):
                # Check VarTableNode first since it inherits from VarNode
                fields.append(self._generate_table_model(var, nested_models))
            elif isinstance(var, VarNode):
                fields.append(self._generate_field_definition(var))

        # Build the complete code
        code_lines = [
            '"""',
            "Generated VarModel from AIMD.",
            '"""',
            "",
        ]

        # Add imports
        code_lines.extend(sorted(imports))
        code_lines.append("")
        code_lines.append("")

        # Add nested models
        if nested_models:
            code_lines.extend(nested_models)
            code_lines.append("")

        # Add main VarModel
        code_lines.append("class VarModel(BaseModel):")
        code_lines.append('    """Main variable model."""')
        if fields:
            for field in fields:
                code_lines.append(field)
        else:
            code_lines.append("    pass")

        return "\n".join(code_lines)

    def get_model_schema(self) -> Dict:
        """
        Generate JSON schema for VarModel.

        Returns:
            Dictionary representing the JSON schema
        """
        # This would be implemented if needed
        # For now, focusing on code generation
        pass


def generate_model(aimd_content: str) -> str:
    """
    Generate VarModel code from AIMD content.

    Args:
        aimd_content: AIMD document content

    Returns:
        Python code for VarModel

    Example:
        >>> code = generate_model(aimd_content)
        >>> print(code)
    """
    generator = ModelGenerator(aimd_content)
    return generator.generate_model()
