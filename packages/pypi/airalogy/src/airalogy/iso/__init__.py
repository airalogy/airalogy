__all__ = ["timedelta_to_iso"]

from datetime import timedelta
import isodate


def timedelta_to_iso(timedelta: timedelta) -> str:
    """Convert a `timedelta` object to an ISO 8601 duration string.

    ## Example

    >>> from datetime import timedelta
    >>> from airalogy.iso import timedelta_to_iso
    >>> timedelta_to_iso(timedelta(days=1, hours=2, minutes=30))
    'P1DT2H30M'
    """
    return isodate.duration_isoformat(timedelta)
