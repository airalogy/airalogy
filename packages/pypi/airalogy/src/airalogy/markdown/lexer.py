"""
Lexer for AIMD syntax - tokenizes AIMD content.
"""

import re
from typing import Iterator

from .tokens import Position, Token, TokenType


class Lexer:
    """
    Lexer for AIMD syntax.

    Tokenizes AIMD content into a stream of tokens, identifying template
    expressions like {{var|...}}, {{step|...}}, etc.

    Code blocks (both inline with backticks and multi-line with triple backticks)
    are skipped and not parsed as template expressions.
    """

    # Template start pattern: {{type|content}}
    TEMPLATE_START_PATTERN = re.compile(
        r"\{\{\s*(var_table|var|step|check|ref_var|ref_step|ref_fig|cite)\s*\|",
        re.MULTILINE | re.DOTALL,
    )

    # Inline code pattern: `code` (not containing newlines)
    INLINE_CODE_PATTERN = re.compile(
        r"`[^`\n]+`",
        re.MULTILINE | re.DOTALL,
    )

    # Multi-line code block pattern: ```lang ... ``` or ```lang meta ... ``` or ``` ... ```
    CODE_BLOCK_PATTERN = re.compile(
        r"```(?P<lang>[a-zA-Z0-9_]*)(?:[ \t]+(?P<meta>[^\n]*))?\n(?P<code>[\s\S]*?)```",
        re.MULTILINE | re.DOTALL,
    )

    TOKEN_TYPE_MAP = {
        "var": TokenType.VAR,
        "var_table": TokenType.VAR_TABLE,
        "step": TokenType.STEP,
        "check": TokenType.CHECK,
        "ref_var": TokenType.REF_VAR,
        "ref_step": TokenType.REF_STEP,
        "ref_fig": TokenType.REF_FIG,
        "cite": TokenType.CITE,
    }

    def __init__(self, content: str):
        """
        Initialize lexer with AIMD content.

        Args:
            content: AIMD document content
        """
        self.content = content
        self.lines = content.splitlines(keepends=True)
        self._excluded_ranges = self._find_excluded_ranges()

    def _find_excluded_ranges(self) -> list[tuple[int, int]]:
        """
        Find all code block ranges that should be excluded from parsing.

        Returns:
            List of (start, end) tuples representing excluded ranges
        """
        excluded_ranges = []

        # Find multi-line code blocks
        for match in self.CODE_BLOCK_PATTERN.finditer(self.content):
            excluded_ranges.append((match.start(), match.end()))

        # Find inline code blocks
        for match in self.INLINE_CODE_PATTERN.finditer(self.content):
            excluded_ranges.append((match.start(), match.end()))

        # Sort ranges by start position and merge overlapping ones
        excluded_ranges.sort()
        merged_ranges = []
        for start, end in excluded_ranges:
            if merged_ranges and start <= merged_ranges[-1][1]:
                # Overlapping or adjacent ranges - merge them
                merged_ranges[-1] = (merged_ranges[-1][0], max(merged_ranges[-1][1], end))
            else:
                merged_ranges.append((start, end))

        return merged_ranges

    def _is_in_excluded_range(self, offset: int, length: int) -> bool:
        """
        Check if a given range is within any excluded code block.

        Args:
            offset: Start offset in content
            length: Length of the range

        Returns:
            True if the range is within an excluded range, False otherwise
        """
        end = offset + length
        for start, excl_end in self._excluded_ranges:
            if offset >= start and end <= excl_end:
                return True
        return False

    def _get_position(self, offset: int, length: int) -> Position:
        """
        Convert byte offset to line/column position.

        Args:
            offset: Start offset in content
            length: Length of the token

        Returns:
            Position object with row and column info
        """
        # Count newlines in the token to determine if it spans multiple lines
        token_text = self.content[offset : offset + length]
        newlines_in_token = token_text.count("\n")

        # Find the starting line (1-indexed)
        start_line = self.content[:offset].count("\n") + 1
        end_line = start_line + newlines_in_token

        # Find start of current line for start_col (1-indexed)
        line_start = self.content.rfind("\n", 0, offset) + 1
        start_col = offset - line_start + 1

        # Find end_col
        if newlines_in_token > 0:
            # If multi-line, end_col is from the last newline
            last_newline_in_token = token_text.rfind("\n")
            end_col = length - last_newline_in_token - 1
        else:
            # Single line
            end_col = start_col + length - 1

        return Position(
            start_line=start_line,
            end_line=end_line,
            start_col=start_col,
            end_col=end_col,
        )

    def _is_escaped(self, offset: int) -> bool:
        slash_count = 0
        cursor = offset - 1

        while cursor >= 0 and self.content[cursor] == "\\":
            slash_count += 1
            cursor -= 1

        return slash_count % 2 == 1

    def _find_template_end(self, content_start: int) -> int:
        quote = None
        offset = content_start

        while offset < len(self.content):
            char = self.content[offset]

            if quote is not None:
                if char == quote and not self._is_escaped(offset):
                    quote = None
                offset += 1
                continue

            if char in ('"', "'"):
                quote = char
                offset += 1
                continue

            if char == "}" and offset + 1 < len(self.content) and self.content[offset + 1] == "}":
                return offset + 2

            offset += 1

        return -1

    def tokenize(self) -> Iterator[Token]:
        """
        Tokenize the AIMD content.

        Yields:
            Token objects for each template found in the content
        """
        search_offset = 0

        while search_offset < len(self.content):
            match = self.TEMPLATE_START_PATTERN.search(self.content, search_offset)
            if match is None:
                break

            start_offset = match.start()
            content_start = match.end()
            end_offset = self._find_template_end(content_start)

            if end_offset == -1:
                search_offset = content_start
                continue

            raw = self.content[start_offset:end_offset]

            # Skip matches within code blocks
            if self._is_in_excluded_range(start_offset, len(raw)):
                search_offset = content_start
                continue

            type_name = match.group(1)
            value = self.content[content_start : end_offset - 2].strip()

            token_type = self.TOKEN_TYPE_MAP[type_name]
            position = self._get_position(start_offset, len(raw))

            yield Token(type=token_type, value=value, position=position, raw=raw)

            search_offset = end_offset

        # Yield EOF token
        end_offset = len(self.content)
        yield Token(
            type=TokenType.EOF,
            value="",
            position=self._get_position(end_offset, 0),
            raw="",
        )
