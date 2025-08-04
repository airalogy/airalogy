__all__ = ["VersionStr", "SnakeStr"]


import re


class VersionStr(str):
    _PATTERN = re.compile(r"^\d+\.\d+\.\d+$")  # 1.2.3

    def __new__(cls, value: str) -> "VersionStr":
        if not cls._PATTERN.fullmatch(value):
            raise ValueError(f"{value!r} is not a valid version number (x.y.z)")
        return super().__new__(cls, value)


_SNAKE = re.compile(
    r"^[a-z]([a-z\d_]*[a-z\d])?$"
)  # starts with letter, ends with letter or digit (not underscore), no consecutive underscores checked separately
_NO_CONSECUTIVE_UNDERSCORES = re.compile(r"__")  # check for consecutive underscores


class SnakeStr(str):
    def __new__(cls, value: str) -> "SnakeStr":
        if not _SNAKE.fullmatch(value) or _NO_CONSECUTIVE_UNDERSCORES.search(value):
            raise ValueError(f"{value!r} is not valid snake_case")
        return super().__new__(cls, value)
