from typing import Annotated, Literal

from pydantic import Field


BloodType = Annotated[
    Literal[
        "A",
        "B",
        "AB",
        "O",
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
        "Rh+",
        "Rh-",
    ],
    Field(
        title="Blood type",
        description=(
            "Common ABO blood group values. Values such as A+ or A- combine "
            "an ABO group with Rh positive or Rh negative status. Rh+ and Rh- "
            "are allowed when only Rh factor is recorded."
        ),
    ),
]
