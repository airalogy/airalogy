from typing import Any

from airalogy.assigner import AssignerResult, assigner


def build_downstream_aimd(dependent_fields: dict[str, Any]) -> str:
    upstream_aimd_1 = (dependent_fields.get("upstream_aimd_1") or "").strip()
    upstream_aimd_2 = (dependent_fields.get("upstream_aimd_2") or "").strip()

    return f"""
# Downstream AIMD (Auto-Assembled)

## Upstream AIMD #1
{upstream_aimd_1}

---

## Upstream AIMD #2
{upstream_aimd_2}
""".strip()


@assigner(
    assigned_fields=["downstream_aimd"],
    dependent_fields=["upstream_aimd_1", "upstream_aimd_2"],
    mode="auto",
)
def assemble_downstream_aimd(dependent_fields: dict[str, Any]) -> AssignerResult:
    downstream_aimd = build_downstream_aimd(dependent_fields)
    return AssignerResult(assigned_fields={"downstream_aimd": downstream_aimd})
