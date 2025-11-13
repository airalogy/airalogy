"""
AIMD parser and utilities.

This module provides comprehensive parsing, validation, and model generation
for AIMD documents.
"""

# Backwards compatibility: export from old parser
from .ast_nodes import (
    CheckNode,
    CiteNode,
    RefFigNode,
    RefStepNode,
    RefVarNode,
    StepNode,
    VarNode,
    VarTableNode,
)
from .errors import (
    DuplicateNameError,
    InvalidNameError,
    InvalidSyntaxError,
    TypeAnnotationError,
)
from .lexer import Lexer

# But use new parser for extract_vars to support typed syntax
# New parser exports
from .parser import AimdParser, extract_vars
from .tokens import Position, Token, TokenType
from .validator import AimdValidator, ValidationError, validate_aimd

__all__ = [
    "extract_vars",
    # New parser API
    "AimdParser",
    "Lexer",
    "Token",
    "TokenType",
    "Position",
    # AST nodes
    "VarNode",
    "VarTableNode",
    "StepNode",
    "CheckNode",
    "RefVarNode",
    "RefStepNode",
    "RefFigNode",
    "CiteNode",
    # Errors
    "InvalidNameError",
    "DuplicateNameError",
    "InvalidSyntaxError",
    "TypeAnnotationError",
    # Validation
    "AimdValidator",
    "ValidationError",
    "validate_aimd",
]
