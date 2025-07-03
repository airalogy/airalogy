import json
import hashlib


def get_data_sha1(airalogy_record: dict, print_data_str: bool = False) -> str:
    """
    Get the SHA-1 hash of the 'data' section of an Airalogy Record.

    ## Parameters
    - `airalogy_record`: The Airalogy Record.
    - `print_data_str`: Whether to print the serialized 'data' string.
    """
    data = airalogy_record["data"]
    data_str = json.dumps(
        data,
        sort_keys=True,  # Sort keys to ensure consistent hash
        separators=(",", ":"),  # Remove whitespace to ensure consistent hash
        ensure_ascii=False,  # Use UTF-8 encoding to ensure consistent hash
    )
    if print_data_str:
        print(data_str)
    return hashlib.sha1(data_str.encode("utf-8")).hexdigest()
