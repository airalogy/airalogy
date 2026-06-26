import io
import math

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from airalogy import Airalogy
from airalogy.assigner import AssignerResult, assigner

EPS = 1e-12
_AIRALOGY_CLIENT = None


def _client() -> Airalogy:
    global _AIRALOGY_CLIENT
    if _AIRALOGY_CLIENT is None:
        _AIRALOGY_CLIENT = Airalogy()
    return _AIRALOGY_CLIENT


def _read_csv_bytes(fid) -> pd.DataFrame:
    raw_bytes = _client().download_file_bytes(fid)
    return pd.read_csv(io.BytesIO(raw_bytes))


def _ensure_cols(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    required = ["concentration_um", "signal_mean"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")

    df["concentration_um"] = pd.to_numeric(df["concentration_um"], errors="coerce")
    df["signal_mean"] = pd.to_numeric(df["signal_mean"], errors="coerce")
    if "signal_sd" in df.columns:
        df["signal_sd"] = pd.to_numeric(df["signal_sd"], errors="coerce")
    if "n" in df.columns:
        df["n"] = pd.to_numeric(df["n"], errors="coerce")

    df = df.dropna(subset=["concentration_um", "signal_mean"])
    df = df[df["concentration_um"] > 0].sort_values("concentration_um")
    if len(df) < 2:
        raise ValueError("CSV must contain at least two positive concentration points.")
    return df.reset_index(drop=True)


def _fig_to_svg_bytes(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    fig.clf()
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


def _fmt(v, nd=2, fallback="-"):
    try:
        if v is None:
            return fallback
        return f"{float(v):.{nd}f}"
    except Exception:
        return fallback


def _estimate_ic50(conc: np.ndarray, viability: np.ndarray, threshold: float = 50.0):
    """Estimate IC50 by linear interpolation on log10 concentration."""
    order = np.argsort(conc)
    conc = conc[order]
    viability = viability[order]

    for c, y in zip(conc, viability):
        if abs(float(y) - threshold) <= EPS:
            log_ic50 = math.log10(float(c))
            return float(c), log_ic50, True

    for i in range(len(conc) - 1):
        y1 = float(viability[i])
        y2 = float(viability[i + 1])
        if (y1 - threshold) * (y2 - threshold) > 0 or abs(y2 - y1) <= EPS:
            continue

        x1 = math.log10(float(conc[i]))
        x2 = math.log10(float(conc[i + 1]))
        frac = (threshold - y1) / (y2 - y1)
        log_ic50 = x1 + frac * (x2 - x1)
        return float(10**log_ic50), float(log_ic50), True

    return 0.0, 0.0, False


@assigner(
    assigned_fields=[
        "point_count",
        "min_viability_pct",
        "max_inhibition_pct",
        "ic50_um",
        "log_ic50",
        "ic50_in_range",
        "auc_inhibition",
        "max_cv_pct",
        "qc_pass",
        "chart_dose_response",
    ],
    dependent_fields=[
        "dose_response_file",
        "vehicle_control_mean",
        "blank_mean",
    ],
    mode="manual",
)
def compute_dose_response(dependent_fields) -> AssignerResult:
    df = _ensure_cols(_read_csv_bytes(str(dependent_fields["dose_response_file"])))

    vehicle = float(dependent_fields.get("vehicle_control_mean", 0.0))
    blank = float(dependent_fields.get("blank_mean", 0.0))
    if vehicle <= blank:
        raise ValueError("vehicle_control_mean must be greater than blank_mean.")

    denom = max(vehicle - blank, EPS)
    signal = df["signal_mean"].astype(float)
    viability = ((signal - blank) / denom * 100.0).clip(lower=0.0, upper=200.0)
    inhibition = (100.0 - viability).clip(lower=0.0, upper=100.0)

    conc = df["concentration_um"].astype(float).to_numpy()
    viability_arr = viability.to_numpy(dtype=float)
    inhibition_arr = inhibition.to_numpy(dtype=float)

    ic50_um, log_ic50, ic50_in_range = _estimate_ic50(conc, viability_arr)

    log_conc = np.log10(conc)
    log_span = float(log_conc.max() - log_conc.min())
    if log_span > EPS:
        auc_inhibition = float(np.trapezoid(inhibition_arr, log_conc) / log_span)
    else:
        auc_inhibition = 0.0

    max_cv_pct = 0.0
    viability_sd = None
    if "signal_sd" in df.columns:
        signal_sd = df["signal_sd"].astype(float)
        cv = (signal_sd / signal.abs().clip(lower=EPS) * 100.0).replace(
            [np.inf, -np.inf], np.nan
        )
        max_cv_pct = float(cv.max(skipna=True)) if not cv.dropna().empty else 0.0
        viability_sd = signal_sd / denom * 100.0

    point_count = int(len(df))
    min_viability_pct = float(viability.min())
    max_inhibition_pct = float(inhibition.max())
    qc_pass = (
        point_count >= 6
        and ic50_in_range
        and vehicle > blank
        and (max_cv_pct <= 20.0 if "signal_sd" in df.columns else True)
    )

    fig, ax = plt.subplots()
    if viability_sd is not None:
        ax.errorbar(
            conc,
            viability,
            yerr=viability_sd,
            marker="o",
            linestyle="-",
            capsize=3,
            label="Normalized viability",
        )
    else:
        ax.plot(conc, viability, marker="o", label="Normalized viability")

    ax.axhline(50.0, color="gray", linestyle="--", linewidth=1.0, label="50% viability")
    if ic50_in_range:
        ax.axvline(
            ic50_um,
            color="crimson",
            linestyle="--",
            linewidth=1.0,
            label=f"IC50 = {ic50_um:.3g} uM",
        )
    ax.set_xscale("log")
    ax.set_xlabel("Concentration (uM)")
    ax.set_ylabel("Normalized viability (%)")
    ax.set_title("Dose-response curve")
    ax.set_ylim(0, max(110.0, float(viability.max()) + 10.0))
    ax.grid(True, which="both", linestyle="--", linewidth=0.5)
    ax.legend()

    chart_file = _client().upload_file_bytes(
        file_name="dose_response_curve.svg",
        file_bytes=_fig_to_svg_bytes(fig),
    )

    return AssignerResult(
        assigned_fields={
            "point_count": point_count,
            "min_viability_pct": round(min_viability_pct, 2),
            "max_inhibition_pct": round(max_inhibition_pct, 2),
            "ic50_um": round(float(ic50_um), 6),
            "log_ic50": round(float(log_ic50), 4),
            "ic50_in_range": bool(ic50_in_range),
            "auc_inhibition": round(float(auc_inhibition), 2),
            "max_cv_pct": round(float(max_cv_pct), 2),
            "qc_pass": bool(qc_pass),
            "chart_dose_response": chart_file["id"],
        },
    )


@assigner(
    assigned_fields=["report"],
    dependent_fields=[
        "record_recorder",
        "record_time",
        "study_id",
        "project_name",
        "therapeutic_area",
        "compound_name",
        "positive_control",
        "cell_model",
        "assay_type",
        "incubation_h",
        "seeding_density",
        "culture_condition",
        "point_count",
        "min_viability_pct",
        "max_inhibition_pct",
        "ic50_um",
        "log_ic50",
        "ic50_in_range",
        "auc_inhibition",
        "max_cv_pct",
        "qc_pass",
    ],
    mode="manual",
)
def build_report(dependent_fields) -> AssignerResult:
    notes = []
    if not dependent_fields.get("ic50_in_range"):
        notes.append(
            "剂量范围未跨过 50% 细胞活性，IC50 不能在当前实验范围内可靠估算；建议扩展浓度范围。"
        )
    if dependent_fields.get("max_cv_pct") is not None:
        try:
            if float(dependent_fields.get("max_cv_pct")) > 20.0:
                notes.append("最大重复孔 CV 超过 20%，建议复查加样、边缘孔效应或读板稳定性。")
        except Exception:
            pass
    if not notes:
        notes.append("当前数据满足展示协议的基本质控要求，可用于后续机制验证或复测设计。")

    md = []
    md.append(f"# 生物医药剂量-反应分析报告 - {dependent_fields.get('compound_name', '-')}")
    md.append("")
    md.append("## 研究信息")
    md.append(f"- 记录人：{dependent_fields.get('record_recorder', '-')}")
    md.append(f"- 记录时间：{dependent_fields.get('record_time', '-')}")
    md.append(f"- 研究编号：{dependent_fields.get('study_id', '-')}")
    md.append(f"- 项目名称：{dependent_fields.get('project_name', '-')}")
    md.append(f"- 适应症方向：{dependent_fields.get('therapeutic_area', '-')}")
    md.append(f"- 候选药物：{dependent_fields.get('compound_name', '-')}")
    md.append(f"- 阳性对照：{dependent_fields.get('positive_control', '-')}")
    md.append("")
    md.append("## 实验条件")
    md.append(f"- 细胞或模型：{dependent_fields.get('cell_model', '-')}")
    md.append(f"- 实验方法：{dependent_fields.get('assay_type', '-')}")
    md.append(f"- 处理时间：{_fmt(dependent_fields.get('incubation_h'), 1)} h")
    md.append(f"- 接种密度：{dependent_fields.get('seeding_density', '-')} cells/well")
    md.append(f"- 培养基条件：{dependent_fields.get('culture_condition', '-')}")
    md.append("")
    md.append("## 结果摘要")
    md.append(f"- 有效剂量点数量：{dependent_fields.get('point_count', '-')}")
    md.append(f"- 最低归一化细胞活性：{_fmt(dependent_fields.get('min_viability_pct'), 2)} %")
    md.append(f"- 最高抑制率：{_fmt(dependent_fields.get('max_inhibition_pct'), 2)} %")
    if dependent_fields.get("ic50_in_range"):
        md.append(
            f"- 估算 IC50：{_fmt(dependent_fields.get('ic50_um'), 4)} μM，log10(IC50) = {_fmt(dependent_fields.get('log_ic50'), 4)}"
        )
    else:
        md.append("- 估算 IC50：未落在当前实验浓度范围内")
    md.append(f"- 平均 log-dose 抑制面积 AUC：{_fmt(dependent_fields.get('auc_inhibition'), 2)} %")
    md.append(f"- 最大重复孔 CV：{_fmt(dependent_fields.get('max_cv_pct'), 2)} %")
    md.append(
        f"- 质控判定：{'通过 (QC Pass)' if dependent_fields.get('qc_pass') else '不通过 (QC Fail)'}"
    )
    md.append("")
    md.append("## 诊断与建议")
    for note in notes:
        md.append(f"- {note}")
    md.append("")
    md.append("## 后续实验建议")
    md.append("- 对 IC50 附近剂量增加采样点，用独立批次细胞复测。")
    md.append("- 若候选药物显示明确活性，可进一步开展时间依赖性、靶点通路和选择性毒性实验。")

    return AssignerResult(assigned_fields={"report": "\n".join(md)})
