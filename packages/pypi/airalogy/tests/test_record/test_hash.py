import json
import hashlib

from airalogy.record.hash import get_data_sha1


def compute_expected_sha1(data: dict) -> str:
    """
    Compute the expected SHA-1 hash for the given data using the same serialization rules.
    """
    data_str = json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha1(data_str.encode("utf-8")).hexdigest()


def test_empty_data():
    """
    Test the case when 'data' is an empty dictionary.
    """
    record = {"data": {}}
    expected = compute_expected_sha1({})
    assert get_data_sha1(record) == expected


def test_simple_data():
    """
    Test the case when 'data' is a simple dictionary.
    """
    data = {"name": "Alice爱丽丝", "age": 30}
    record = {"data": data}
    expected = compute_expected_sha1(data)
    assert get_data_sha1(record, print_data_str=True) == expected


def test_nested_data():
    """
    Test the case when 'data' contains nested structures.
    """
    data = {
        "user": {"name": "Bob", "languages": ["Python", "JavaScript"]},
        "active": True,
    }
    record = {"data": data}
    expected = compute_expected_sha1(data)
    assert get_data_sha1(record) == expected
