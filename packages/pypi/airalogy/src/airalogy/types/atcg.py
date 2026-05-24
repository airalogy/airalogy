"""
ATCG: Manages DNA ATCG sequences, only supports the four letters A, T, C, G.
"""

import re


class ATCG(str):
    """
    Only allows strings containing the four letters A, T, C, G.
    """

    _PATTERN = re.compile(r"^[ATCG]*$")

    def __new__(cls, value: str):
        """
        Create a new ATCG sequence. Only accepts strings containing A, T, C, G.
        """
        if not isinstance(value, str):
            raise TypeError("ATCG sequence must be a string.")
        if not cls._PATTERN.fullmatch(value):
            raise ValueError("ATCG sequence can only contain the letters A, T, C, G.")
        return str.__new__(cls, value)

    def complement(self) -> "ATCG":
        """
        Return the complementary DNA strand (A<->T, C<->G).
        """
        comp = str.maketrans("ATCG", "TAGC")
        return ATCG(self.translate(comp))

    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        """
        Make Pydantic treat ATCG as a string type for validation and schema generation.
        """
        from pydantic_core import core_schema

        def validate(value):
            return cls(value)

        return core_schema.no_info_after_validator_function(
            validate,
            core_schema.str_schema(),
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        """
        Modify the generated JSON Schema to add the airalogy_type property.
        """
        json_schema = handler(core_schema)
        json_schema.update(
            {
                "airalogy_type": "ATCG",
                "pattern": cls._PATTERN.pattern,
            }
        )
        return json_schema
