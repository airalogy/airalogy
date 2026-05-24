"""
Token definitions for AIMD parser.
"""

from dataclasses import dataclass
from enum import Enum, auto


class TokenType(Enum):
    """Token types for AIMD syntax."""

    # Template tokens
    VAR = auto()  # {{var|...}}
    VAR_TABLE = auto()  # {{var_table|...}}
    STEP = auto()  # {{step|...}}
    CHECK = auto()  # {{check|...}}
    REF_VAR = auto()  # {{ref_var|...}}
    REF_STEP = auto()  # {{ref_step|...}}
    REF_FIG = auto()  # {{ref_fig|...}}
    CITE = auto()  # {{cite|...}}

    # Text and special
    TEXT = auto()
    EOF = auto()


@dataclass
class Position:
    """Position information for a token or node."""

    start_line: int  # 1-indexed, starting line
    end_line: int  # 1-indexed, ending line
    start_col: int  # 1-indexed, starting column
    end_col: int  # 1-indexed (exclusive), ending column

    def __repr__(self) -> str:
        if self.start_line == self.end_line:
            return f"Line {self.start_line}, Col {self.start_col}-{self.end_col}"
        else:
            return f"Line {self.start_line}-{self.end_line}, Col {self.start_col}-{self.end_col}"


@dataclass
class Token:
    """A token in the AIMD document."""

    type: TokenType
    value: str  # Raw content between {{ and }}
    position: Position
    raw: str  # Full token text including delimiters

    def __repr__(self) -> str:
        return f"Token({self.type.name}, {self.value!r}, {self.position})"
