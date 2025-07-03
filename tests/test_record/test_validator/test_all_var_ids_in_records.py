from airalogy.record.validator import (
    all_var_ids_in_records,
)

import pytest


def test_all_var_ids_present():
    """
    Test when all records contain all the specified variable IDs.
    """
    records = [
        {
            "data": {
                "var": {
                    "var1": "value1",
                    "var2": "value2",
                }
            }
        },
        {
            "data": {
                "var": {
                    "var1": "value3",
                    "var2": "value4",
                }
            }
        },
    ]
    var_ids = ["var1", "var2"]
    assert all_var_ids_in_records(records, var_ids) is True


def test_some_var_ids_missing():
    """
    Test when some records are missing some of the specified variable IDs.
    """
    records = [
        {
            "data": {
                "var": {
                    "var1": "value1",
                }
            }
        },
        {
            "data": {
                "var": {
                    "var1": "value3",
                    "var2": "value4",
                }
            }
        },
    ]
    var_ids = ["var1", "var2"]
    assert all_var_ids_in_records(records, var_ids) is False


def test_empty_var_ids():
    """
    Test when the var_ids list is empty. Should raise a ValueError.
    """
    records = [
        {
            "data": {
                "var": {
                    "var1": "value1",
                }
            }
        },
        {
            "data": {
                "var": {
                    "var2": "value4",
                }
            }
        },
    ]
    var_ids = []
    with pytest.raises(ValueError):
        all_var_ids_in_records(records, var_ids)


def test_empty_records():
    """
    Test when the records list is empty. Should raise a ValueError.
    """
    records = []
    var_ids = ["var1", "var2"]
    with pytest.raises(ValueError):
        all_var_ids_in_records(records, var_ids)


def test_missing_data_key():
    """
    Test when a record is missing the 'data' key.
    """
    records = [
        {
            # 'data' key is missing
        },
        {
            "data": {
                "var": {
                    "var1": "value3",
                    "var2": "value4",
                }
            }
        },
    ]
    var_ids = ["var1", "var2"]
    with pytest.raises(ValueError):
        all_var_ids_in_records(records, var_ids)


def test_missing_var_key():
    """
    Test when a record's 'data' dictionary is missing the 'var' key.
    """
    records = [
        {
            "data": {
                # 'var' key is missing
            }
        },
        {
            "data": {
                "var": {
                    "var1": "value3",
                    "var2": "value4",
                }
            }
        },
    ]
    var_ids = ["var1", "var2"]
    with pytest.raises(ValueError):
        all_var_ids_in_records(records, var_ids)


def test_var_is_not_dict():
    """
    Test when the 'var' key in 'data' is not a dictionary.
    """
    records = [
        {"data": {"var": "not a dict"}},
        {
            "data": {
                "var": {
                    "var1": "value3",
                    "var2": "value4",
                }
            }
        },
    ]
    var_ids = ["var1", "var2"]
    with pytest.raises(ValueError):
        all_var_ids_in_records(records, var_ids)


def test_data_is_not_dict():
    """
    Test when the 'data' key is not a dictionary.
    """
    records = [
        {"data": "not a dict"},
        {
            "data": {
                "var": {
                    "var1": "value3",
                    "var2": "value4",
                }
            }
        },
    ]
    var_ids = ["var1", "var2"]
    with pytest.raises(ValueError):
        all_var_ids_in_records(records, var_ids)


def test_var_contains_extra_ids():
    """
    Test when 'var' contains extra variable IDs beyond those specified.
    Should still return True as long as specified IDs are present.
    """
    records = [
        {
            "data": {
                "var": {
                    "var1": "value1",
                    "var2": "value2",
                    "var_extra": "value_extra",
                }
            }
        },
        {
            "data": {
                "var": {
                    "var1": "value3",
                    "var2": "value4",
                    "var_extra": "value_extra",
                }
            }
        },
    ]
    var_ids = ["var1", "var2"]
    assert all_var_ids_in_records(records, var_ids) is True


def test_records_with_none():
    """
    Test when records contain None values.
    """
    records = [
        None,
        {
            "data": {
                "var": {
                    "var1": "value3",
                    "var2": "value4",
                }
            }
        },
    ]
    var_ids = ["var1", "var2"]
    with pytest.raises(ValueError):
        all_var_ids_in_records(records, var_ids)
