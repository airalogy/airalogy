from datetime import datetime, timezone
import time
from typing import Any

from airalogy.assigner import AssignerResult, assigner


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@assigner(
    assigned_fields=["a3"],
    dependent_fields=["a1", "a2"],
    mode="auto",
)
def line_a3(dependent_fields: dict[str, Any]) -> AssignerResult:
    a1 = int(dependent_fields["a1"])
    a2 = int(dependent_fields["a2"])
    return AssignerResult(assigned_fields={"a3": a1 + a2})


@assigner(
    assigned_fields=["a4"],
    dependent_fields=["a3"],
    mode="auto",
)
def line_a4(dependent_fields: dict[str, Any]) -> AssignerResult:
    a3 = int(dependent_fields["a3"])
    return AssignerResult(assigned_fields={"a4": a3 * 3})


@assigner(
    assigned_fields=["a5"],
    dependent_fields=["a4"],
    mode="auto",
)
def line_a5(dependent_fields: dict[str, Any]) -> AssignerResult:
    a4 = int(dependent_fields["a4"])
    return AssignerResult(assigned_fields={"a5": a4 * a4})


@assigner(
    assigned_fields=["b5"],
    dependent_fields=["b1", "b2", "b3"],
    mode="manual",
)
def line_b5_manual(dependent_fields: dict[str, Any]) -> AssignerResult:
    b1 = int(dependent_fields["b1"])
    b2 = int(dependent_fields["b2"])
    b3 = int(dependent_fields["b3"])
    return AssignerResult(assigned_fields={"b5": b1 * b2 + b3})


@assigner(
    assigned_fields=["b6", "b7", "b8"],
    dependent_fields=["b5", "b4"],
    mode="auto",
)
def line_b_slow_auto(dependent_fields: dict[str, Any]) -> AssignerResult:
    b5 = int(dependent_fields["b5"])
    delay_seconds = int(dependent_fields.get("b4") or 0)

    if delay_seconds < 0:
        return AssignerResult(
            success=False,
            error_message="b4 (delay seconds) must be >= 0.",
        )
    if delay_seconds > 60:
        delay_seconds = 60

    started_at = _now_iso()
    time.sleep(delay_seconds)
    finished_at = _now_iso()

    return AssignerResult(
        assigned_fields={
            "b6": b5 * 2,
            "b7": started_at,
            "b8": finished_at,
        }
    )


@assigner(
    assigned_fields=["b9", "b10", "b11"],
    dependent_fields=["b5", "b6"],
    mode="manual",
)
def line_b_downstream_manual(dependent_fields: dict[str, Any]) -> AssignerResult:
    b5 = int(dependent_fields["b5"])
    b6 = int(dependent_fields["b6"])

    started_at = _now_iso()
    b9 = b5 + b6
    finished_at = _now_iso()

    return AssignerResult(
        assigned_fields={
            "b9": b9,
            "b10": started_at,
            "b11": finished_at,
        }
    )


@assigner(
    assigned_fields=["b12", "b13", "b14"],
    dependent_fields=["b5", "b6"],
    mode="auto",
)
def line_b_downstream_auto(dependent_fields: dict[str, Any]) -> AssignerResult:
    b5 = int(dependent_fields["b5"])
    b6 = int(dependent_fields["b6"])

    started_at = _now_iso()
    b12 = b5 * b6
    finished_at = _now_iso()

    return AssignerResult(
        assigned_fields={
            "b12": b12,
            "b13": started_at,
            "b14": finished_at,
        }
    )


@assigner(
    assigned_fields=["c3"],
    dependent_fields=["c1", "c2"],
    mode="auto_first",
)
def line_c_auto_first(dependent_fields: dict[str, Any]) -> AssignerResult:
    c1 = int(dependent_fields["c1"])
    c2 = int(dependent_fields["c2"])
    return AssignerResult(assigned_fields={"c3": c1 + c2})


@assigner(
    assigned_fields=["d3"],
    dependent_fields=["d1", "d2"],
    mode="auto",
)
def line_d3(dependent_fields: dict[str, Any]) -> AssignerResult:
    d1 = int(dependent_fields["d1"])
    d2 = int(dependent_fields["d2"])
    return AssignerResult(assigned_fields={"d3": d1 + d2})


@assigner(
    assigned_fields=["d4"],
    dependent_fields=["d3"],
    mode="auto",
)
def line_d4(dependent_fields: dict[str, Any]) -> AssignerResult:
    d3 = int(dependent_fields["d3"])
    return AssignerResult(assigned_fields={"d4": d3 * 3})


@assigner(
    assigned_fields=["d5"],
    dependent_fields=["d4"],
    mode="auto",
)
def line_d5(dependent_fields: dict[str, Any]) -> AssignerResult:
    d4 = int(dependent_fields["d4"])
    return AssignerResult(assigned_fields={"d5": d4 * d4})


@assigner(
    assigned_fields=["e3"],
    dependent_fields=["e1", "e2"],
    mode="auto_first",
)
def line_e_auto_first_missing_defaults(
    dependent_fields: dict[str, Any],
) -> AssignerResult:
    e1 = int(dependent_fields["e1"])
    e2 = int(dependent_fields["e2"])
    return AssignerResult(assigned_fields={"e3": e1 + e2})


@assigner(
    assigned_fields=["f6"],
    dependent_fields=["f1", "f2"],
    mode="auto",
)
def line_f6(dependent_fields: dict[str, Any]) -> AssignerResult:
    f1 = int(dependent_fields["f1"])
    f2 = int(dependent_fields["f2"])
    return AssignerResult(assigned_fields={"f6": f1 + f2})


@assigner(
    assigned_fields=["f7"],
    dependent_fields=["f2", "f3"],
    mode="auto",
)
def line_f7(dependent_fields: dict[str, Any]) -> AssignerResult:
    f2 = int(dependent_fields["f2"])
    f3 = int(dependent_fields["f3"])
    return AssignerResult(assigned_fields={"f7": f2 * f3})


@assigner(
    assigned_fields=["f8"],
    dependent_fields=["f4", "f5"],
    mode="auto",
)
def line_f8(dependent_fields: dict[str, Any]) -> AssignerResult:
    f4 = int(dependent_fields["f4"])
    f5 = int(dependent_fields["f5"])
    return AssignerResult(assigned_fields={"f8": f4 - f5})


@assigner(
    assigned_fields=["f9"],
    dependent_fields=["f6", "f7"],
    mode="auto",
)
def line_f9(dependent_fields: dict[str, Any]) -> AssignerResult:
    f6 = int(dependent_fields["f6"])
    f7 = int(dependent_fields["f7"])
    return AssignerResult(assigned_fields={"f9": f6 * f7})


@assigner(
    assigned_fields=["f10"],
    dependent_fields=["f9", "f8"],
    mode="auto",
)
def line_f10(dependent_fields: dict[str, Any]) -> AssignerResult:
    f9 = int(dependent_fields["f9"])
    f8 = int(dependent_fields["f8"])
    return AssignerResult(assigned_fields={"f10": f9 + f8})


@assigner(
    assigned_fields=["f11"],
    dependent_fields=["f10"],
    mode="auto",
)
def line_f11(dependent_fields: dict[str, Any]) -> AssignerResult:
    f10 = int(dependent_fields["f10"])
    return AssignerResult(assigned_fields={"f11": f10 * 2})


@assigner(
    assigned_fields=["f12"],
    dependent_fields=["f11", "f6"],
    mode="auto",
)
def line_f12(dependent_fields: dict[str, Any]) -> AssignerResult:
    f11 = int(dependent_fields["f11"])
    f6 = int(dependent_fields["f6"])
    return AssignerResult(assigned_fields={"f12": f11 + f6})


@assigner(
    assigned_fields=["f13"],
    dependent_fields=["f12", "f7"],
    mode="auto",
)
def line_f13(dependent_fields: dict[str, Any]) -> AssignerResult:
    f12 = int(dependent_fields["f12"])
    f7 = int(dependent_fields["f7"])
    return AssignerResult(assigned_fields={"f13": f12 + f7})


@assigner(
    assigned_fields=["f14"],
    dependent_fields=["f13", "f8"],
    mode="auto",
)
def line_f14(dependent_fields: dict[str, Any]) -> AssignerResult:
    f13 = int(dependent_fields["f13"])
    f8 = int(dependent_fields["f8"])
    return AssignerResult(assigned_fields={"f14": f13 + f8})


@assigner(
    assigned_fields=["f15"],
    dependent_fields=["f14", "f1"],
    mode="auto",
)
def line_f15(dependent_fields: dict[str, Any]) -> AssignerResult:
    f14 = int(dependent_fields["f14"])
    f1 = int(dependent_fields["f1"])
    return AssignerResult(assigned_fields={"f15": f14 - f1})


@assigner(
    assigned_fields=["g5", "g6"],
    dependent_fields=["g1", "g2"],
    mode="auto",
)
def line_g_stage1a(dependent_fields: dict[str, Any]) -> AssignerResult:
    g1 = int(dependent_fields["g1"])
    g2 = int(dependent_fields["g2"])
    return AssignerResult(
        assigned_fields={
            "g5": g1 + g2,
            "g6": g1 * g2,
        }
    )


@assigner(
    assigned_fields=["g7", "g8"],
    dependent_fields=["g2", "g3"],
    mode="auto",
)
def line_g_stage1b(dependent_fields: dict[str, Any]) -> AssignerResult:
    g2 = int(dependent_fields["g2"])
    g3 = int(dependent_fields["g3"])
    return AssignerResult(
        assigned_fields={
            "g7": g2 + g3,
            "g8": g2 * g3,
        }
    )


@assigner(
    assigned_fields=["g9", "g10"],
    dependent_fields=["g3", "g4"],
    mode="auto",
)
def line_g_stage1c(dependent_fields: dict[str, Any]) -> AssignerResult:
    g3 = int(dependent_fields["g3"])
    g4 = int(dependent_fields["g4"])
    return AssignerResult(
        assigned_fields={
            "g9": g3 + g4,
            "g10": g3 * g4,
        }
    )


@assigner(
    assigned_fields=["g11", "g12"],
    dependent_fields=["g5", "g7", "g9"],
    mode="auto",
)
def line_g_stage2a(dependent_fields: dict[str, Any]) -> AssignerResult:
    g5 = int(dependent_fields["g5"])
    g7 = int(dependent_fields["g7"])
    g9 = int(dependent_fields["g9"])
    return AssignerResult(
        assigned_fields={
            "g11": g5 + g7 + g9,
            "g12": g5 * g7 + g9,
        }
    )


@assigner(
    assigned_fields=["g13", "g14"],
    dependent_fields=["g6", "g8", "g10"],
    mode="auto",
)
def line_g_stage2b(dependent_fields: dict[str, Any]) -> AssignerResult:
    g6 = int(dependent_fields["g6"])
    g8 = int(dependent_fields["g8"])
    g10 = int(dependent_fields["g10"])
    return AssignerResult(
        assigned_fields={
            "g13": g6 + g8 + g10,
            "g14": g6 * g8 + g10,
        }
    )


@assigner(
    assigned_fields=["g15", "g16", "g17"],
    dependent_fields=["g11", "g12", "g13", "g14"],
    mode="auto",
)
def line_g_stage3(dependent_fields: dict[str, Any]) -> AssignerResult:
    g11 = int(dependent_fields["g11"])
    g12 = int(dependent_fields["g12"])
    g13 = int(dependent_fields["g13"])
    g14 = int(dependent_fields["g14"])
    return AssignerResult(
        assigned_fields={
            "g15": g11 + g13,
            "g16": g12 + g14,
            "g17": g11 + g12 + g13 + g14,
        }
    )


@assigner(
    assigned_fields=["g18", "g19"],
    dependent_fields=["g15", "g16", "g17"],
    mode="auto",
)
def line_g_stage4(dependent_fields: dict[str, Any]) -> AssignerResult:
    g15 = int(dependent_fields["g15"])
    g16 = int(dependent_fields["g16"])
    g17 = int(dependent_fields["g17"])
    return AssignerResult(
        assigned_fields={
            "g18": g15 + g16,
            "g19": g17 - g15,
        }
    )


@assigner(
    assigned_fields=["g20"],
    dependent_fields=["g18", "g19"],
    mode="auto",
)
def line_g_stage5(dependent_fields: dict[str, Any]) -> AssignerResult:
    g18 = int(dependent_fields["g18"])
    g19 = int(dependent_fields["g19"])
    return AssignerResult(assigned_fields={"g20": g18 + g19})


@assigner(
    assigned_fields=["h9", "h10", "h11"],
    dependent_fields=["h1", "h2", "h3", "h4", "h5", "h6"],
    mode="auto",
)
def line_h_piece_builder(dependent_fields: dict[str, Any]) -> AssignerResult:
    h1 = str(dependent_fields["h1"])
    h2 = str(dependent_fields["h2"])
    h3 = str(dependent_fields["h3"])
    h4 = str(dependent_fields["h4"])
    h5 = str(dependent_fields["h5"])
    delay_seconds = int(dependent_fields.get("h6") or 0)

    if delay_seconds < 0:
        return AssignerResult(
            success=False,
            error_message="h6 (piece builder delay seconds) must be >= 0.",
        )
    if delay_seconds > 5:
        delay_seconds = 5

    time.sleep(delay_seconds)

    return AssignerResult(
        assigned_fields={
            "h9": f"{h1}-{h2}",
            "h10": f"{h2.upper()}_{h3}",
            "h11": f"{h4}:{h5}",
        }
    )


@assigner(
    assigned_fields=["h12", "h13"],
    dependent_fields=["h9", "h10", "h11", "h7"],
    mode="auto",
)
def line_h_joiner(dependent_fields: dict[str, Any]) -> AssignerResult:
    h9 = str(dependent_fields["h9"])
    h10 = str(dependent_fields["h10"])
    h11 = str(dependent_fields["h11"])
    delay_seconds = int(dependent_fields.get("h7") or 0)

    if delay_seconds < 0:
        return AssignerResult(
            success=False,
            error_message="h7 (joiner delay seconds) must be >= 0.",
        )
    if delay_seconds > 5:
        delay_seconds = 5

    time.sleep(delay_seconds)

    h12 = f"{h9}|{h10}"
    h13 = f"[{h12}]<{h11}>"

    return AssignerResult(
        assigned_fields={
            "h12": h12,
            "h13": h13,
        }
    )


@assigner(
    assigned_fields=["h14", "h15", "h16", "h17"],
    dependent_fields=["h13", "h8"],
    mode="auto",
)
def line_h_splitter(dependent_fields: dict[str, Any]) -> AssignerResult:
    h13 = str(dependent_fields["h13"])
    delay_seconds = int(dependent_fields.get("h8") or 0)

    if delay_seconds < 0:
        return AssignerResult(
            success=False,
            error_message="h8 (splitter delay seconds) must be >= 0.",
        )
    if delay_seconds > 5:
        delay_seconds = 5

    time.sleep(delay_seconds)

    return AssignerResult(
        assigned_fields={
            "h14": h13[0:5],
            "h15": h13[5:10],
            "h16": h13[10:15],
            "h17": h13[15:],
        }
    )


@assigner(
    assigned_fields=["h18", "h19"],
    dependent_fields=["h14", "h15", "h16", "h17"],
    mode="auto",
)
def line_h_recombine(dependent_fields: dict[str, Any]) -> AssignerResult:
    h14 = str(dependent_fields["h14"])
    h15 = str(dependent_fields["h15"])
    h16 = str(dependent_fields["h16"])
    h17 = str(dependent_fields["h17"])

    h18 = f"{h14}{h15}{h16}{h17}"

    return AssignerResult(
        assigned_fields={
            "h18": h18,
            "h19": f"len={len(h18)}",
        }
    )
