"""Shared constants for the AIMD parser package."""

import re

NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")
BLANK_PLACEHOLDER_PATTERN = re.compile(r"\[\[([^\[\]\s]+)\]\]")
