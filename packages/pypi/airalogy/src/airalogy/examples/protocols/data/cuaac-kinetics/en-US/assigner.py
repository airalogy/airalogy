import io
import math

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

from airalogy.assigner import AssignerResult, assigner
from airalogy import Airalogy

EPS = 1e-12
_AIRALOGY_CLIENT = None


def _client() -> Airalogy:
    global _AIRALOGY_CLIENT
    if _AIRALOGY_CLIENT is None:
        _AIRALOGY_CLIENT = Airalogy()
    return _AIRALOGY_CLIENT


def _read_csv_bytes(fid) -> pd.DataFrame:
    """Read a CSV from an Airalogy file ID and return it as a DataFrame."""
    raw_bytes = _client().download_file_bytes(fid)
    buf = io.BytesIO(raw_bytes)
    df = pd.read_csv(buf)
    return df


def _ensure_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure the CSV contains the required columns: t_min, area_a, area_p."""
    cols = [str(c) for c in df.columns]

    required = ["t_min", "area_a", "area_p"]
    missing = [c for c in required if c not in cols]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")
    return df


def _fig_to_svg_bytes(fig) -> bytes:
    """Save a Matplotlib figure to SVG bytes."""
    buf = io.BytesIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    fig.clf()
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


def _linreg(x: list[float], y: list[float]):
    """Least-squares linear regression with NumPy. Returns (slope, intercept, r2)."""
    if len(x) < 2:
        return None

    x_arr = np.asarray(x, dtype=float)
    y_arr = np.asarray(y, dtype=float)

    slope, intercept = np.polyfit(x_arr, y_arr, deg=1)
    y_hat = slope * x_arr + intercept
    ss_tot = float(np.sum((y_arr - y_arr.mean()) ** 2))
    ss_res = float(np.sum((y_arr - y_hat) ** 2))
    r2 = 1.0 - (ss_res / ss_tot if ss_tot > EPS else 0.0)

    return float(slope), float(intercept), float(r2)


def _fmt(v, nd=2, fallback="-"):
    """Friendly numeric formatting."""
    try:
        if v is None:
            return fallback
        return f"{float(v):.{nd}f}"
    except Exception:
        return fallback


# ======================
# Assigner implementation
# ======================


@assigner(
    assigned_fields=[
        "final_conv_pct",
        "k_obs",
        "t_half",
        "t_95",
        "r2",
        "qc_pass",
        "chart_conversion",
        "chart_lnfit",
    ],
    dependent_fields=[
        "kinetics_file",
    ],
    mode="manual",
)
def compute_and_plot(dependent_fields) -> AssignerResult:
    """
    Read CSV → compute conversion/kinetic parameters → generate two SVG plots (and upload) → QC decision.
    """
    # 1) Read & validate
    df = _ensure_cols(_read_csv_bytes(str(dependent_fields["kinetics_file"])))
    df = df.sort_values("t_min").reset_index(drop=True)

    # 2) Conversion (0–1)
    Ap = df["area_p"].astype(float)
    Aa = df["area_a"].astype(float)
    denom = (Ap + Aa).clip(lower=EPS)
    conv = (Ap / denom).clip(0.0, 0.999999)  # Avoid log(0)

    final_conv_pct = float(conv.iloc[-1] * 100.0)

    # 3) Pseudo-first-order linearization: y = -ln(1-Conv) = k_obs * t + b
    mask = (conv > 0) & (conv < 1)
    x = df.loc[mask, "t_min"].astype(float).tolist()
    y = (-(1.0 - conv.loc[mask]).clip(lower=EPS).apply(math.log)).tolist()

    lr = _linreg(x, y) if len(x) >= 2 else None
    if lr is None:
        k_obs, intercept, r2 = (
            0.0,
            0.0,
            0.0,
        )  # Fallback: not enough points → zeros and QC fails
    else:
        k_obs, intercept, r2 = lr

    t_half = math.log(2.0) / k_obs if k_obs > EPS else 0.0
    t_95 = math.log(1.0 / (1.0 - 0.95)) / k_obs if k_obs > EPS else 0.0

    # 4) Plot (SVG) and upload
    # Fig 1: Conversion vs Time
    fig1 = plt.figure()
    plt.plot(df["t_min"], conv * 100.0, marker="o")
    plt.xlabel("Time (min)")
    plt.ylabel("Conversion (%)")
    plt.title("Conversion vs Time")
    plt.grid(True, linestyle="--", linewidth=0.5)
    svg1_bytes = _fig_to_svg_bytes(fig1)
    file1 = _client().upload_file_bytes(
        file_name="conversion_curve.svg", file_bytes=svg1_bytes
    )

    # Fig 2: -ln(1-Conv) vs t (linear fit)
    fig2 = plt.figure()
    if lr is not None:
        yhat = [k_obs * xi + intercept for xi in x]
        plt.plot(x, y, marker="o", linestyle="none", label="actual")
        plt.plot(x, yhat, label=f"fit: k={k_obs:.4g}, R^2={r2:.3f}")
        plt.legend()
    else:
        plt.plot([0, 1], [0, 0])
    plt.xlabel("Time (min)")
    plt.ylabel("-ln(1-Conversion)")
    plt.title("Linearization: -ln(1-Conv) vs Time")
    plt.grid(True, linestyle="--", linewidth=0.5)
    svg2_bytes = _fig_to_svg_bytes(fig2)
    file2 = _client().upload_file_bytes(file_name="lnfit_curve.svg", file_bytes=svg2_bytes)

    # 5) QC rule (constants): final conversion ≥ 90 AND R^2 ≥ 0.95
    qc_pass = (final_conv_pct >= 90.0) and (r2 >= 0.95)

    return AssignerResult(
        assigned_fields={
            "final_conv_pct": round(final_conv_pct, 2),
            "k_obs": round(float(k_obs), 6),
            "t_half": round(float(t_half), 2),
            "t_95": round(float(t_95), 2),
            "r2": round(float(r2), 4),
            "qc_pass": qc_pass,
            "chart_conversion": file1["id"],
            "chart_lnfit": file2["id"],
        },
    )


@assigner(
    assigned_fields=["report"],
    dependent_fields=[
        # The report references these fields (from protocol and the previous step)
        "record_recorder",
        "record_time",
        "reaction_id",
        "reaction_name",
        "solvent",
        "temperature",
        "catalyst",
        "substrate_limit",
        "c0",
        "substrate_excess",
        "final_conv_pct",
        "k_obs",
        "t_half",
        "t_95",
        "r2",
        "qc_pass",
    ],
    mode="manual",
)
def build_report(dependent_fields) -> AssignerResult:
    """Generate a structured Markdown report."""
    md = []
    md.append(
        f"# Click-Reaction Kinetics Report — {dependent_fields.get('reaction_name', '-')}"
    )
    md.append("")
    md.append("## Basic Information & Conditions")
    md.append(f"- Recorder: {dependent_fields.get('record_recorder', '-')}")
    md.append(f"- Time: {dependent_fields.get('record_time', '-')}")
    md.append(f"- Reaction ID: {dependent_fields.get('reaction_id', '-')}")
    md.append(f"- Solvent: {dependent_fields.get('solvent', '-')}")
    md.append(f"- Temperature: {_fmt(dependent_fields.get('temperature'), 1)} °C")
    md.append(f"- Catalyst: {dependent_fields.get('catalyst', '-')}")
    md.append(
        f"- Limiting substrate A: {dependent_fields.get('substrate_limit', '-')}, A initial concentration: {_fmt(dependent_fields.get('c0'), 2)}"
    )
    md.append(f"- Excess substrate B: {dependent_fields.get('substrate_excess', '-')}")
    md.append("")
    md.append("## Results Summary")
    md.append(
        f"- Final conversion: {_fmt(dependent_fields.get('final_conv_pct'), 2)} %"
    )
    md.append(
        f"- Observed rate constant k_obs: {_fmt(dependent_fields.get('k_obs'), 6)} min^-1"
    )
    md.append(f"- Half-life t1/2: {_fmt(dependent_fields.get('t_half'), 2)} min")
    md.append(
        f"- Time to 95% conversion t95: {_fmt(dependent_fields.get('t_95'), 2)} min"
    )
    md.append(f"- Linear fit quality R^2: {_fmt(dependent_fields.get('r2'), 4)}")
    md.append(
        f"- QC decision: {'Pass (QC Pass)' if dependent_fields.get('qc_pass') else 'Fail (QC Fail)'}"
    )
    md.append("")
    md.append("## Diagnostics & Suggestions")
    r2_val = dependent_fields.get("r2")
    if isinstance(r2_val, (int, float)) and r2_val < 0.95:
        md.append(
            "- R^2 < 0.95: possible induction period / insufficient mixing / side reactions. Consider stronger stirring, ligand optimization, or mild heating."
        )
    final_conv_pct = dependent_fields.get("final_conv_pct")
    if isinstance(final_conv_pct, (int, float)) and final_conv_pct < 90.0:
        md.append(
            "- Final conversion below 90%: consider higher temperature, longer time, increased catalyst loading, or a larger excess of B."
        )
    k_obs_val = dependent_fields.get("k_obs")
    if isinstance(k_obs_val, (int, float)) and k_obs_val <= 0.0:
        md.append(
            "- Unable to reliably estimate k_obs: add more early/mid-time samples (e.g., every 2–5 minutes)."
        )
    if len(md) == 3:  # Only title and empty sections (rare)
        md.append("- Data quality looks good; no obvious anomalies.")
    md.append("")
    md_text = "\n".join(md)

    return AssignerResult(
        assigned_fields={"report": md_text},
    )
