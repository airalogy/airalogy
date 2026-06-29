def assign(summary, failed_metrics):
    """Recommend retry parameters after QC fails."""
    failed_metrics = failed_metrics or []
    retry_reason = "QC failed"

    if failed_metrics:
        retry_reason = "QC failed for: " + ", ".join(map(str, failed_metrics))

    return {
        "recommended_temperature_c": 24.0,
        "recommended_concentration_m": 0.05,
        "retry_reason": retry_reason,
        "optimizer_note": f"Input summary: {summary or 'not provided'}",
    }
