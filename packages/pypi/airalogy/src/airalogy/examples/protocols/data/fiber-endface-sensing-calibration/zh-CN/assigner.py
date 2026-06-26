import io

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

    required = ["stimulus", "resonance_nm"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")

    df["stimulus"] = pd.to_numeric(df["stimulus"], errors="coerce")
    df["resonance_nm"] = pd.to_numeric(df["resonance_nm"], errors="coerce")
    if "intensity_db" in df.columns:
        df["intensity_db"] = pd.to_numeric(df["intensity_db"], errors="coerce")

    df = df.dropna(subset=["stimulus", "resonance_nm"]).sort_values("stimulus")
    if len(df) < 2:
        raise ValueError("CSV must contain at least two valid calibration points.")
    return df.reset_index(drop=True)


def _linreg(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float]:
    slope, intercept = np.polyfit(x, y, deg=1)
    y_hat = slope * x + intercept
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    ss_res = float(np.sum((y - y_hat) ** 2))
    r2 = 1.0 - (ss_res / ss_tot if ss_tot > EPS else 0.0)
    return float(slope), float(intercept), float(r2)


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


@assigner(
    assigned_fields=[
        "point_count",
        "stimulus_min",
        "stimulus_max",
        "wavelength_shift_span_nm",
        "sensitivity_nm_per_unit",
        "intercept_nm",
        "r2",
        "lod_unit",
        "monotonic_pass",
        "qc_pass",
        "chart_calibration",
    ],
    dependent_fields=[
        "calibration_file",
        "baseline_noise_pm",
    ],
    mode="manual",
)
def compute_calibration(dependent_fields) -> AssignerResult:
    df = _ensure_cols(_read_csv_bytes(str(dependent_fields["calibration_file"])))

    x = df["stimulus"].astype(float).to_numpy()
    y = df["resonance_nm"].astype(float).to_numpy()
    slope, intercept, r2 = _linreg(x, y)

    stimulus_span = float(x.max() - x.min())
    wavelength_shift_span_nm = float(y.max() - y.min())
    point_count = int(len(df))

    diffs = np.diff(y)
    monotonic_pass = bool(np.all(diffs >= -EPS) or np.all(diffs <= EPS))

    baseline_noise_pm = float(dependent_fields.get("baseline_noise_pm", 0.0) or 0.0)
    baseline_noise_nm = max(baseline_noise_pm, 0.0) / 1000.0
    lod_unit = (3.0 * baseline_noise_nm / abs(slope)) if abs(slope) > EPS else 0.0

    qc_pass = (
        point_count >= 5
        and stimulus_span > EPS
        and abs(slope) > EPS
        and monotonic_pass
        and r2 >= 0.98
    )

    fig, ax = plt.subplots()
    ax.plot(x, y, marker="o", linestyle="none", label="Calibration data")

    fit_x = np.linspace(float(x.min()), float(x.max()), 100)
    fit_y = slope * fit_x + intercept
    ax.plot(
        fit_x,
        fit_y,
        label=f"fit: S={slope:.3g} nm/unit, R^2={r2:.4f}",
    )
    ax.set_xlabel("Stimulus")
    ax.set_ylabel("Resonance wavelength (nm)")
    ax.set_title("Fiber endface sensor calibration")
    ax.grid(True, linestyle="--", linewidth=0.5)
    ax.legend()

    chart_file = _client().upload_file_bytes(
        file_name="fiber_endface_sensor_calibration.svg",
        file_bytes=_fig_to_svg_bytes(fig),
    )

    return AssignerResult(
        assigned_fields={
            "point_count": point_count,
            "stimulus_min": round(float(x.min()), 6),
            "stimulus_max": round(float(x.max()), 6),
            "wavelength_shift_span_nm": round(wavelength_shift_span_nm, 4),
            "sensitivity_nm_per_unit": round(float(slope), 6),
            "intercept_nm": round(float(intercept), 6),
            "r2": round(float(r2), 5),
            "lod_unit": round(float(lod_unit), 8),
            "monotonic_pass": monotonic_pass,
            "qc_pass": bool(qc_pass),
            "chart_calibration": chart_file["id"],
        },
    )


@assigner(
    assigned_fields=["report"],
    dependent_fields=[
        "record_recorder",
        "record_time",
        "experiment_id",
        "device_name",
        "structure_type",
        "fiber_type",
        "measurand",
        "stimulus_unit",
        "readout_signal",
        "test_temperature_c",
        "baseline_noise_pm",
        "point_count",
        "stimulus_min",
        "stimulus_max",
        "wavelength_shift_span_nm",
        "sensitivity_nm_per_unit",
        "intercept_nm",
        "r2",
        "lod_unit",
        "monotonic_pass",
        "qc_pass",
    ],
    mode="manual",
)
def build_report(dependent_fields) -> AssignerResult:
    notes = []
    if not dependent_fields.get("monotonic_pass"):
        notes.append("共振峰位置未呈现单调变化，建议检查峰拟合、样品置换和温度漂移。")

    try:
        if float(dependent_fields.get("r2", 0.0)) < 0.98:
            notes.append("线性拟合优度低于 0.98，可能需要缩小线性工作区间或改用非线性标定模型。")
    except Exception:
        pass

    try:
        if abs(float(dependent_fields.get("sensitivity_nm_per_unit", 0.0))) <= EPS:
            notes.append("灵敏度接近 0，当前结构或读出方式无法提供稳定标定。")
    except Exception:
        pass

    if not notes:
        notes.append("当前标定数据满足展示协议的基本质控要求，可用于比较不同端面结构设计。")

    stimulus_unit = dependent_fields.get("stimulus_unit", "unit")
    md = []
    md.append(f"# 光纤端面传感标定报告 - {dependent_fields.get('device_name', '-')}")
    md.append("")
    md.append("## 器件与实验信息")
    md.append(f"- 记录人：{dependent_fields.get('record_recorder', '-')}")
    md.append(f"- 记录时间：{dependent_fields.get('record_time', '-')}")
    md.append(f"- 实验编号：{dependent_fields.get('experiment_id', '-')}")
    md.append(f"- 结构类型：{dependent_fields.get('structure_type', '-')}")
    md.append(f"- 光纤类型：{dependent_fields.get('fiber_type', '-')}")
    md.append(f"- 传感对象：{dependent_fields.get('measurand', '-')}")
    md.append(f"- 读出信号：{dependent_fields.get('readout_signal', '-')}")
    md.append(f"- 测试温度：{_fmt(dependent_fields.get('test_temperature_c'), 1)} ℃")
    md.append("")
    md.append("## 标定结果")
    md.append(f"- 标定点数量：{dependent_fields.get('point_count', '-')}")
    md.append(
        f"- 自变量范围：{_fmt(dependent_fields.get('stimulus_min'), 6)} - "
        f"{_fmt(dependent_fields.get('stimulus_max'), 6)} {stimulus_unit}"
    )
    md.append(
        f"- 共振峰漂移范围：{_fmt(dependent_fields.get('wavelength_shift_span_nm'), 4)} nm"
    )
    md.append(
        f"- 灵敏度：{_fmt(dependent_fields.get('sensitivity_nm_per_unit'), 6)} nm/{stimulus_unit}"
    )
    md.append(f"- 线性拟合优度 R^2：{_fmt(dependent_fields.get('r2'), 5)}")
    md.append(
        f"- 基于 {_fmt(dependent_fields.get('baseline_noise_pm'), 2)} pm 噪声估计的 LOD："
        f"{_fmt(dependent_fields.get('lod_unit'), 8)} {stimulus_unit}"
    )
    md.append(
        f"- 质控判定：{'通过 (QC Pass)' if dependent_fields.get('qc_pass') else '不通过 (QC Fail)'}"
    )
    md.append("")
    md.append("## 诊断与下一步")
    for note in notes:
        md.append(f"- {note}")
    md.append("- 可在下一轮实验中比较不同结构周期、金属厚度或表面功能化方案对灵敏度和漂移稳定性的影响。")

    return AssignerResult(
        assigned_fields={"report": "\n".join(md)},
    )
