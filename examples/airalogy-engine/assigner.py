import os
import time
from datetime import timedelta

from airalogy.assigner import AssignerResult, assigner
from airalogy.iso import timedelta_to_iso


@assigner(
    assigned_fields=["duration", "endpoint"],
    dependent_fields=["seconds"],
    mode="auto",
)
def convert_seconds_to_duration(dependent_fields: dict) -> AssignerResult:
    seconds = dependent_fields["seconds"]
    duration = timedelta(seconds=seconds)
    if os.environ.get("PROTOCOL_SLEEP_TIME"):
        time.sleep(float(os.environ.get("PROTOCOL_SLEEP_TIME", 0)))

    print("This is debug log")
    print(f"Converting {seconds} seconds to duration: {duration}")
    return AssignerResult(
        assigned_fields={
            "duration": timedelta_to_iso(duration),
            "endpoint": os.environ.get("ENDPOINT", ""),
        },
    )
