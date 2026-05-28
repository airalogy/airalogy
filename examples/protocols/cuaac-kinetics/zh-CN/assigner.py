import io
import math


import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

from airalogy.assigner import AssignerResult, assigner
from airalogy import Airalogy

EPS = 1e-12
client = Airalogy()


def _read_csv_bytes(fid) -> pd.DataFrame:
    """从 Airalogy 文件 ID 读取 CSV 为 DataFrame。"""
    raw_bytes = client.download_file_bytes(fid)
    buf = io.BytesIO(raw_bytes)
    df = pd.read_csv(buf)
    return df


def _ensure_cols(df: pd.DataFrame) -> pd.DataFrame:
    """包含 t_min, area_a, area_p 三列。"""
    cols = [str(c) for c in df.columns]

    required = ["t_min", "area_a", "area_p"]
    missing = [c for c in required if c not in cols]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")
    return df


def _fig_to_svg_bytes(fig) -> bytes:
    """将 Matplotlib 图保存为 SVG 字节。"""
    buf = io.BytesIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    fig.clf()
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


def _linreg(x: list[float], y: list[float]):
    """使用 NumPy 进行最小二乘直线拟合，返回 (slope, intercept, r2)。"""
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
    """数字友好格式化。"""
    try:
        if v is None:
            return fallback
        return f"{float(v):.{nd}f}"
    except Exception:
        return fallback


# ======================
# Assigner 实现
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
    读取 CSV → 计算转化率/动力学参数 → 生成两张 SVG 图（并上传） → 质控判定。
    """
    # 1) 读取与校验
    df = _ensure_cols(_read_csv_bytes(str(dependent_fields["kinetics_file"])))
    df = df.sort_values("t_min").reset_index(drop=True)

    # 2) 计算转化率（0~1）
    Ap = df["area_p"].astype(float)
    Aa = df["area_a"].astype(float)
    denom = (Ap + Aa).clip(lower=EPS)
    conv = (Ap / denom).clip(0.0, 0.999999)  # 防止 log(0)

    final_conv_pct = float(conv.iloc[-1] * 100.0)

    # 3) 拟一级线性化：y = -ln(1-Conv) = k_obs * t + b
    mask = (conv > 0) & (conv < 1)
    x = df.loc[mask, "t_min"].astype(float).tolist()
    y = (-(1.0 - conv.loc[mask]).clip(lower=EPS).apply(math.log)).tolist()

    lr = _linreg(x, y) if len(x) >= 2 else None
    if lr is None:
        k_obs, intercept, r2 = 0.0, 0.0, 0.0  # 回退策略：不可拟合时置零并判定不通过
    else:
        k_obs, intercept, r2 = lr

    t_half = math.log(2.0) / k_obs if k_obs > EPS else 0.0
    t_95 = math.log(1.0 / (1.0 - 0.95)) / k_obs if k_obs > EPS else 0.0

    # 4) 绘图（SVG）并上传
    # 图 1：转化率-时间
    fig1 = plt.figure()
    plt.plot(df["t_min"], conv * 100.0, marker="o")
    plt.xlabel("Time (min)")
    plt.ylabel("Conversion (%)")
    plt.title("Conversion vs Time")
    plt.grid(True, linestyle="--", linewidth=0.5)
    svg1_bytes = _fig_to_svg_bytes(fig1)
    file1 = client.upload_file_bytes(
        file_name="conversion_curve.svg", file_bytes=svg1_bytes
    )

    # 图 2：-ln(1-Conv) vs t 线性拟合
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
    file2 = client.upload_file_bytes(file_name="lnfit_curve.svg", file_bytes=svg2_bytes)

    # 5) 质控规则（常量）：末端转化率 ≥ 90 且 R^2 ≥ 0.95
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
        # 报告会引用以下字段（来自 protocol 与上一步计算）
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
    """生成结构化 Markdown 报告"""
    md = []
    md.append(f"# 点击化学动力学报告 — {dependent_fields.get('reaction_name', '-')}")
    md.append("")
    md.append("## 基本信息与条件")
    md.append(f"- 记录人：{dependent_fields.get('record_recorder', '-')}")
    md.append(f"- 记录时间：{dependent_fields.get('record_time', '-')}")
    md.append(f"- 反应编号：{dependent_fields.get('reaction_id', '-')}")
    md.append(f"- 溶剂：{dependent_fields.get('solvent', '-')}")
    md.append(f"- 温度：{_fmt(dependent_fields.get('temperature'), 1)} ℃")
    md.append(f"- 催化剂：{dependent_fields.get('catalyst', '-')}")
    md.append(
        f"- 限量底物 A：{dependent_fields.get('substrate_limit', '-')}, A 初始浓度：{_fmt(dependent_fields.get('c0'), 2)}"
    )
    md.append(f"- 过量底物 B：{dependent_fields.get('substrate_excess', '-')}")
    md.append("")
    md.append("## 结果摘要")
    md.append(f"- 末端转化率：{_fmt(dependent_fields.get('final_conv_pct'), 2)} %")
    md.append(f"- 观测速率常数 k_obs：{_fmt(dependent_fields.get('k_obs'), 6)} min^-1")
    md.append(f"- 半衰期 t1/2：{_fmt(dependent_fields.get('t_half'), 2)} min")
    md.append(f"- 达 95% 转化时间 t95：{_fmt(dependent_fields.get('t_95'), 2)} min")
    md.append(f"- 线性拟合优度 R^2：{_fmt(dependent_fields.get('r2'), 4)}")
    md.append(
        f"- 质控判定：{'通过 (QC Pass)' if dependent_fields.get('qc_pass') else '不通过 (QC Fail)'}"
    )
    md.append("")
    md.append("## 诊断与建议")
    r2_val = dependent_fields.get("r2")
    if isinstance(r2_val, (int, float)) and r2_val < 0.95:
        md.append(
            "- R^2 低于 0.95：可能存在诱导期/混合不充分/副反应，建议增强搅拌、优化配体或适度升温。"
        )
    final_conv_pct = dependent_fields.get("final_conv_pct")
    if isinstance(final_conv_pct, (int, float)) and final_conv_pct < 90.0:
        md.append(
            "- 末端转化率不足：可提高温度、延长时间、增加催化剂用量或提高 B 的过量倍数。"
        )
    k_obs_val = dependent_fields.get("k_obs")
    if isinstance(k_obs_val, (int, float)) and k_obs_val <= 0.0:
        md.append(
            "- 无法稳定估计速率常数：建议增加中早期采样点（例如每 2–5 分钟取样一次）。"
        )
    if len(md) == 3:  # 仅标题与空段落时（极少见）
        md.append("- 数据质量良好，无明显异常。")
    md.append("")
    md_text = "\n".join(md)

    return AssignerResult(
        assigned_fields={"report": md_text},
    )
