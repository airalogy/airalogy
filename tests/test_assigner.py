from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    assigner,
)
from airalogy.models.check import CheckValue


class RvAssigner(AssignerBase):
    @assigner(
        assigned_fields=[
            "rv_03",
            "rv_04",
        ],
        dependent_fields=[
            "rv_01",
            "rv_02",
        ],
        mode="auto",
    )
    def assign_rv03_and_04(dependent_fields: dict) -> AssignerResult:
        rv_01 = dependent_fields["rv_01"]
        rv_02 = dependent_fields["rv_02"]

        rv_03 = rv_01 + rv_02

        if rv_01 > rv_02:
            rv_04 = rv_01 - rv_02
            return AssignerResult(
                assigned_fields={
                    "rv_03": rv_03,
                    "rv_04": rv_04,
                },
            )
        else:
            return AssignerResult(
                success=False,
                error_message="rv_01 must be greater than rv_02",
            )

    @assigner(
        assigned_fields=[
            "rv_06",
        ],
        dependent_fields=[
            "rv_03",
            "rv_05",
        ],
        mode="manual",
    )
    def assign_rv06(dependent_fields: dict) -> AssignerResult:
        rv_03 = dependent_fields["rv_03"]
        rv_05 = dependent_fields["rv_05"]

        rv_06 = rv_03 - rv_05

        return AssignerResult(
            success=True,
            assigned_fields={
                "rv_06": rv_06,
            },
            error_message=None,
        )

    @assigner(
        assigned_fields=[
            "rv_07",
        ],
        dependent_fields=[
            "rv_04",
            "rv_06",
        ],
        mode="auto_force",
    )
    def assign_rv07(dependent_fields: dict) -> AssignerResult:
        rv_07 = dependent_fields["rv_04"] + dependent_fields["rv_07"]

        return AssignerResult(
            success=True,
            assigned_fields={
                "rv_07": rv_07,
            },
            error_message=None,
        )


class RvAssigner2(AssignerBase):
    @assigner(
        assigned_fields=[
            "rv_03",
            "rc_04",
        ],
        dependent_fields=[
            "rv_01",
            "rv_02",
            "rv_09",
        ],
        mode="auto",
    )
    def assign_rv03_and_04(dependent_fields: dict) -> AssignerResult:
        rv_03 = (
            dependent_fields["rv_01"]
            + dependent_fields["rv_02"]
            + dependent_fields["rv_09"]
        )
        rc_04 = (
            dependent_fields["rv_01"]
            + dependent_fields["rv_02"]
            - dependent_fields["rv_09"]
        )

        return AssignerResult(
            success=True,
            assigned_fields={
                "rv_03": rv_03,
                "rc_04": CheckValue(
                    checked=True,
                    annotation=f"rc_04 = rv_01 + rv_02 - rv_09, value is: {rc_04}",
                ),
            },
            error_message=None,
        )


def test_get_dependent_fields_of_assigned_key():
    assert RvAssigner.get_dependent_fields_of_assigned_key("rv_01") == []
    assert RvAssigner.get_dependent_fields_of_assigned_key("rv_02") == []
    assert sorted(RvAssigner.get_dependent_fields_of_assigned_key("rv_03")) == [
        "rv_01",
        "rv_02",
    ]
    assert sorted(RvAssigner.get_dependent_fields_of_assigned_key("rv_04")) == [
        "rv_01",
        "rv_02",
    ]
    assert sorted(RvAssigner.get_dependent_fields_of_assigned_key("rv_07")) == [
        "rv_01",
        "rv_02",
        "rv_03",
        "rv_04",
        "rv_05",
        "rv_06",
    ]

    assert RvAssigner2.get_dependent_fields_of_assigned_key("rv_01") == []
    assert RvAssigner2.get_dependent_fields_of_assigned_key("rv_02") == []
    assert sorted(RvAssigner2.get_dependent_fields_of_assigned_key("rv_03")) == [
        "rv_01",
        "rv_02",
        "rv_09",
    ]
    assert sorted(RvAssigner2.get_dependent_fields_of_assigned_key("rv_03")) == sorted(
        RvAssigner2.get_dependent_fields_of_assigned_key("rc_04")
    )


def test_get_assign_func_of_assigned_key():
    assert RvAssigner.get_assign_func_of_assigned_key("rv_01") is None
    assert RvAssigner.get_assign_func_of_assigned_key("rv_02") is None
    assert (
        RvAssigner.get_assign_func_of_assigned_key("rv_03").__name__
        == RvAssigner.assign_rv03_and_04.__name__
    )
    assert (
        RvAssigner.get_assign_func_of_assigned_key("rv_04").__name__
        == RvAssigner.assign_rv03_and_04.__name__
    )
    assert (
        RvAssigner.get_assign_func_of_assigned_key("rv_06").__name__
        == RvAssigner.assign_rv06.__name__
    )


def test_all_assigned_fields():
    rfs = RvAssigner.all_assigned_fields()
    assert sorted(rfs.keys()) == ["rv_03", "rv_04", "rv_06", "rv_07"]

    assert sorted(rfs["rv_03"]["dependent_fields"]) == ["rv_01", "rv_02"]
    assert rfs["rv_03"]["mode"] == "auto"

    assert sorted(rfs["rv_04"]["dependent_fields"]) == ["rv_01", "rv_02"]
    assert rfs["rv_04"]["mode"] == "auto"

    assert sorted(rfs["rv_06"]["dependent_fields"]) == [
        "rv_01",
        "rv_02",
        "rv_03",
        "rv_05",
    ]
    assert rfs["rv_06"]["mode"] == "manual"

    assert sorted(rfs["rv_07"]["dependent_fields"]) == [
        "rv_01",
        "rv_02",
        "rv_03",
        "rv_04",
        "rv_05",
        "rv_06",
    ]
    assert rfs["rv_07"]["mode"] == "auto_force"


def test_rv_assigner():
    dependent_data = {
        "rv_01": 20,
        "rv_02": 10,
        "rv_05": 15,
        "rv_09": 3,
    }

    result = RvAssigner.assign("rv_01", dependent_data)
    assert not result.success
    assert result.assigned_fields is None

    result = RvAssigner.assign("rv_03", dependent_data)
    assert result.success
    assert result.assigned_fields == {"rv_03": 30, "rv_04": 10}

    result = RvAssigner.assign("rv_03", {"rv_01": 10, "rv_02": 20})
    assert not result.success
    assert result.assigned_fields is None

    result = RvAssigner.assign("rv_04", dependent_data)
    assert result.success
    assert result.assigned_fields == {"rv_03": 30, "rv_04": 10}

    result = RvAssigner.assign("rv_06", dependent_data)
    assert result.success
    assert result.assigned_fields == {"rv_06": 15}

    result = RvAssigner2.assign("rv_03", dependent_data)
    assert result.success
    assert result.assigned_fields == {
        "rv_03": 33,
        "rc_04": CheckValue(
            checked=True, annotation="rc_04 = rv_01 + rv_02 - rv_09, value is: 27"
        ),
    }
