"""
AIMD parser and utilities.

This module provides comprehensive parsing, validation, and model generation
for AIMD documents.
"""

from .ast_nodes import (
    AssignerBlockNode,
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
    ErrorCollector,
    InvalidNameError,
    InvalidSyntaxError,
    TypeAnnotationError,
)
from .lexer import Lexer
from .model_generator import generate_model
from .parser import AimdParser, extract_assigner_blocks, extract_vars
from .tokens import Position, Token, TokenType
from .get import get_airalogy_image_ids
from .validator import AimdValidator, ValidationError, validate_aimd

__all__ = [
    # Parser
    "AimdParser",
    "Lexer",
    "Token",
    "TokenType",
    "Position",
    "extract_vars",
    "extract_assigner_blocks",
    # AST nodes
    "VarNode",
    "VarTableNode",
    "StepNode",
    "CheckNode",
    "RefVarNode",
    "RefStepNode",
    "RefFigNode",
    "CiteNode",
    "AssignerBlockNode",
    # Errors
    "InvalidNameError",
    "DuplicateNameError",
    "InvalidSyntaxError",
    "TypeAnnotationError",
    "ErrorCollector",
    # Validation
    "AimdValidator",
    "ValidationError",
    "validate_aimd",
    # Model generation
    "generate_model",
    # Markdown helpers
    "get_airalogy_image_ids",
]
