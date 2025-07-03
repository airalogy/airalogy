def all_var_ids_in_records(records: list[dict], var_ids: list[str]) -> bool:
    if not records:
        raise ValueError("The records list cannot be empty.")
    if not var_ids:
        raise ValueError("The var_ids list cannot be empty.")
    var_ids_set = set(var_ids)
    for record in records:
        try:
            var_dict = record["data"]["var"]
            if not isinstance(var_dict, dict):
                raise ValueError("The 'var' section must be a dictionary.")
        except (KeyError, TypeError) as exc:
            raise ValueError(
                "Each record must have a 'data' dict containing a 'var' dict."
            ) from exc
        if not var_ids_set.issubset(var_dict.keys()):
            return False
    return True
