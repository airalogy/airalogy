"""
AST (Abstract Syntax Tree) nodes for AIMD parser.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .tokens import Position


@dataclass
class ASTNode:
    """Base class for all AST nodes."""

    position: Position

    def to_dict(self) -> dict:
        """Convert to dictionary format."""
        result = {
            "start_line": self.position.start_line,
            "end_line": self.position.end_line,
            "start_col": self.position.start_col,
            "end_col": self.position.end_col,
        }
        return result


@dataclass
class VarNode(ASTNode):
    """
    Variable node: {{var|var_id}} or {{var|var_id: type = default, **kwargs}}
    """

    name: str
    type_annotation: Optional[str] = None
    default_value: Optional[Any] = None
    kwargs: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary format."""
        result = super().to_dict()
        result["name"] = self.name
        if self.type_annotation:
            result["type_annotation"] = self.type_annotation
        if self.default_value is not None:
            result["default_value"] = self.default_value
        if self.kwargs:
            result["kwargs"] = self.kwargs
        return result


@dataclass
class VarTableNode(VarNode):
    """
    Variable table node (a specialized var with list type and subvars).

    Examples:
    - legacy: {{var_table|table_id, subvars=[sub1, sub2, ...]}}
    - new simple: {{var|table_id, subvars = [subvar1: type, subvar2: type = default]}}
    - new with type: {{var|students: list[Student], title="Student Information", subvars=[name: str, age: int]}}
    - new without explicit type: {{var|users, title="User Info", subvars=[name: str, age: int]}}
    - new complex: {{var|table_id, subvars = [var(subvar1: type = default, **kwargs), var(subvar2: type = default, **kwargs)]}}
    - new multiple lines:
    {{var|table_id, subvars = [
        var(subvar1: type = default, **kwargs),
        var(subvar2: type = default, **kwargs)
    ]}}
    """

    # Override subvars to be required for VarTableNode
    subvars: List[VarNode] = field(default_factory=list)
    # Extracted list item type (e.g., "Student" from "list[Student]")
    list_item_type: Optional[str] = None
    # Auto-generated list item type if not specified (e.g., "UsersItem" from "users")
    auto_item_type: Optional[str] = None

    def __post_init__(self):
        """Post-initialization to derive list item type."""
        if self.list_item_type is None:
            # Derive from type_annotation if it's a list type
            if self.type_annotation and self.type_annotation.startswith("list["):
                # Extract type from list[Type]
                self.list_item_type = self.type_annotation[
                    5:-1
                ]  # Remove "list[" and "]"
            else:
                # Generate auto type name from var name
                # Convert snake_case to PascalCase and add "Item" suffix
                base_name = "".join(word.capitalize() for word in self.name.split("_"))
                self.auto_item_type = f"{base_name}Item"

    def get_item_type_name(self) -> str:
        """
        Get the name of the list item type for model generation.

        Returns:
            The explicit item type if specified, otherwise auto-generated type name.
        """
        if self.list_item_type:
            return self.list_item_type
        return self.auto_item_type

    def to_dict(self) -> dict:
        """Convert to dictionary format."""
        result = super().to_dict()
        result.update(
            {
                "subvars": [subvar.to_dict() for subvar in self.subvars],
                "list_item_type": self.list_item_type,
                "auto_item_type": self.auto_item_type,
            }
        )
        return result


@dataclass
class StepNode(ASTNode):
    """
    Step node: {{step|step_id, level, check=True, checked_message="..."}}
    """

    name: str
    level: int = 1
    check: bool = False
    checked_message: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary format."""
        result = {
            "name": self.name,
            "level": self.level,
            "start_line": self.position.start_line,
            "end_line": self.position.end_line,
            "start_col": self.position.start_col,
            "end_col": self.position.end_col,
        }
        if self.check:
            result["check"] = self.check
        if self.checked_message:
            result["checked_message"] = self.checked_message
        return result


@dataclass
class CheckNode(ASTNode):
    """
    Checkpoint node: {{check|check_id, checked_message="..."}}
    """

    name: str
    checked_message: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary format."""
        result = {
            "name": self.name,
            "start_line": self.position.start_line,
            "end_line": self.position.end_line,
            "start_col": self.position.start_col,
            "end_col": self.position.end_col,
        }
        if self.checked_message:
            result["checked_message"] = self.checked_message
        return result


@dataclass
class RefVarNode(ASTNode):
    """Reference to a variable: {{ref_var|var_id}}"""

    ref_id: str

    def to_dict(self) -> dict:
        result = super().to_dict()
        result.update({"ref_id": self.ref_id})
        return result


@dataclass
class RefStepNode(ASTNode):
    """Reference to a step: {{ref_step|step_id}}"""

    ref_id: str

    def to_dict(self) -> dict:
        result = super().to_dict()
        result.update({"ref_id": self.ref_id})
        return result


@dataclass
class RefFigNode(ASTNode):
    """Reference to a figure: {{ref_fig|fig_id}}"""

    ref_id: str

    def to_dict(self) -> dict:
        result = super().to_dict()
        result.update({"ref_id": self.ref_id})
        return result


@dataclass
class CiteNode(ASTNode):
    """Citation: {{cite|ref_id1,ref_id2,...}}"""

    ref_ids: List[str]

    def to_dict(self) -> dict:
        result = super().to_dict()
        result.update({"ref_ids": self.ref_ids})
        return result


@dataclass
class AssignerBlockNode(ASTNode):
    """Inline assigner block: ```assigner ... ```"""

    code: str

    def to_dict(self) -> dict:
        result = super().to_dict()
        result["code"] = self.code
        return result
