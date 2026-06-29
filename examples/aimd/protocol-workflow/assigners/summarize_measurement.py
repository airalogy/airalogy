def assign(raw_data):
    """Summarize raw measurement data before the analysis node runs."""
    if raw_data is None:
        return {
            "raw_data_summary": "No raw measurement data was provided.",
            "measurement_quality": "missing",
        }

    if isinstance(raw_data, dict):
        point_count = len(raw_data.get("points", []))
        instrument = raw_data.get("instrument", "unknown instrument")
        return {
            "raw_data_summary": f"{point_count} points captured by {instrument}.",
            "measurement_quality": "review",
        }

    return {
        "raw_data_summary": str(raw_data),
        "measurement_quality": "review",
    }
