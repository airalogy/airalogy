"""Step, checkpoint, reference, and citation parsing helpers for AIMD."""

import ast
import re
from typing import List, Optional

from ..ast_nodes import CheckNode, CiteNode, RefFigNode, RefStepNode, RefVarNode, StepNode
from ..errors import InvalidSyntaxError
from ..tokens import Token

_DURATION_PART_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)", re.IGNORECASE)
_STEP_TIMER_MODES = {"elapsed", "countdown", "both"}


def _extract_quoted_param_value(value: str, name: str) -> tuple[Optional[str], str]:
    pattern = re.compile(
        rf"{name}\s*=\s*(?:\"((?:[^\"\\]|\\.)*)\"|'((?:[^'\\]|\\.)*)')",
        re.DOTALL,
    )
    match = pattern.search(value)
    if not match:
        return None, value

    extracted_value = match.group(1) if match.group(1) is not None else match.group(2)
    return extracted_value, pattern.sub("", value, count=1)

def _strip_optional_quotes(value: str) -> str:
    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {"'", '"'}:
        return stripped[1:-1]
    return stripped

def _parse_duration_to_ms(value: str) -> Optional[int]:
    trimmed = value.strip()
    if not trimmed:
        return None

    total_ms = 0.0
    last_index = 0
    matched = False

    for match in _DURATION_PART_PATTERN.finditer(trimmed):
        if trimmed[last_index : match.start()].strip():
            return None

        matched = True
        amount = float(match.group(1))
        unit = match.group(2).lower()
        multiplier = (
            24 * 60 * 60 * 1000
            if unit == "d"
            else 60 * 60 * 1000
            if unit == "h"
            else 60 * 1000
            if unit == "m"
            else 1000
            if unit == "s"
            else 1
        )
        total_ms += amount * multiplier
        last_index = match.end()

    if not matched or trimmed[last_index:].strip():
        return None

    return round(total_ms)

def _parse_step_timer_mode(value: str) -> Optional[str]:
    normalized = value.strip().lower()
    if not normalized:
        return None
    if normalized in _STEP_TIMER_MODES:
        return normalized
    return None


class StepParserMixin:
    def _parse_step(self, token: Token) -> StepNode:
        """
        Parse a step token.

        Syntax: {{step|step_id, level, duration="10m", timer="countdown", check=True, checked_message="..."}}

        Args:
            token: STEP token

        Returns:
            StepNode

        Raises:
            InvalidSyntaxError: If syntax is invalid
        """
        value = token.value.strip()

        # Extract quoted params first so commas inside checked_message do not break splitting.
        checked_message, value = _extract_quoted_param_value(value, "checked_message")
        duration, value = _extract_quoted_param_value(value, "duration")
        timer, value = _extract_quoted_param_value(value, "timer")
        estimated_duration_ms = (
            _parse_duration_to_ms(duration) if duration is not None else None
        )
        if duration is not None and estimated_duration_ms is None:
            raise InvalidSyntaxError(
                f"Invalid duration value: {duration}", position=token.position
            )
        timer_mode = _parse_step_timer_mode(timer) if timer is not None else None
        if timer is not None and timer_mode is None:
            raise InvalidSyntaxError(
                f"Invalid timer mode: {timer}", position=token.position
            )

        # Split by comma
        parts = [p.strip() for p in value.split(",") if p.strip()]

        if not parts:
            raise InvalidSyntaxError("Empty step definition", position=token.position)

        # First part is the step name
        step_name = parts[0]
        self._validate_name(step_name, "step", token)

        # Parse optional parameters
        level = 1
        check = False

        for part in parts[1:]:
            # Check if it's a level (number)
            if part.isdigit():
                level = int(part)
                if level < 1:
                    raise InvalidSyntaxError(
                        f"Step level must be positive: {level}",
                        position=token.position,
                    )
            # Check if it's check=True/False
            elif re.fullmatch(r"check\s*=\s*(True|False)", part):
                check_value = part.split("=", 1)[1].strip()
                if check_value == "True":
                    check = True
                elif check_value == "False":
                    check = False
                else:
                    raise InvalidSyntaxError(
                        f"Invalid check value: {check_value}",
                        position=token.position,
                    )
            elif re.fullmatch(r"duration\s*=\s*.+", part, flags=re.DOTALL):
                duration = _strip_optional_quotes(part.split("=", 1)[1])
                estimated_duration_ms = _parse_duration_to_ms(duration)
                if estimated_duration_ms is None:
                    raise InvalidSyntaxError(
                        f"Invalid duration value: {duration}",
                        position=token.position,
                    )
            elif re.fullmatch(r"timer\s*=\s*.+", part, flags=re.DOTALL):
                timer = _strip_optional_quotes(part.split("=", 1)[1])
                timer_mode = _parse_step_timer_mode(timer)
                if timer_mode is None:
                    raise InvalidSyntaxError(
                        f"Invalid timer mode: {timer}",
                        position=token.position,
                    )
            # Ignore checked_message here (already extracted)
            elif not part.startswith("checked_message"):
                raise InvalidSyntaxError(
                    f"Unknown step parameter: {part}", position=token.position
                )

        return StepNode(
            position=token.position,
            name=step_name,
            level=level,
            check=check,
            duration=duration,
            estimated_duration_ms=estimated_duration_ms,
            timer=timer_mode,
            checked_message=checked_message,
        )

    def _parse_check(self, token: Token) -> CheckNode:
        """
        Parse a checkpoint token.

        Syntax: {{check|check_id, checked_message="..."}}

        Args:
            token: CHECK token

        Returns:
            CheckNode

        Raises:
            InvalidSyntaxError: If syntax is invalid
        """
        value = token.value.strip()

        checked_message, value = _extract_quoted_param_value(value, "checked_message")

        # Clean up remaining value
        check_name = value.split(",")[0].strip()

        if not check_name:
            raise InvalidSyntaxError("Empty check definition", position=token.position)

        self._validate_name(check_name, "check", token)

        return CheckNode(
            position=token.position,
            name=check_name,
            checked_message=checked_message,
        )

    def _parse_ref_var(self, token: Token) -> RefVarNode:
        """Parse a variable reference: {{ref_var|var_id}}"""
        ref_id = token.value.strip()
        return RefVarNode(position=token.position, ref_id=ref_id)

    def _parse_ref_step(self, token: Token) -> RefStepNode:
        """Parse a step reference: {{ref_step|step_id}}"""
        ref_id = token.value.strip()
        return RefStepNode(position=token.position, ref_id=ref_id)

    def _parse_ref_fig(self, token: Token) -> RefFigNode:
        """Parse a figure reference: {{ref_fig|fig_id}}"""
        ref_id = token.value.strip()
        return RefFigNode(position=token.position, ref_id=ref_id)

    def _parse_cite(self, token: Token) -> CiteNode:
        """Parse a citation: {{cite|ref_id1,ref_id2,...}}"""
        value = token.value.strip()
        ref_ids = [ref.strip() for ref in value.split(",") if ref.strip()]
        return CiteNode(position=token.position, ref_ids=ref_ids)

