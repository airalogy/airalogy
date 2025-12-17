from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    DefaultAssigner,
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
        mode="auto",
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
    assert rfs["rv_07"]["mode"] == "auto"


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


@assigner(
    assigned_fields=[
        "standalone_rv_total",
    ],
    dependent_fields=[
        "standalone_rv_a",
        "standalone_rv_b",
    ],
    mode="auto",
)
def assign_standalone_total(dependent_fields: dict) -> AssignerResult:
    total = dependent_fields["standalone_rv_a"] + dependent_fields["standalone_rv_b"]

    return AssignerResult(
        success=True,
        assigned_fields={"standalone_rv_total": total},
        error_message=None,
    )


@assigner(
    assigned_fields=[
        "standalone_rv_net",
    ],
    dependent_fields=[
        "standalone_rv_total",
        "standalone_rv_discount",
    ],
    mode="manual",
)
def assign_standalone_net(dependent_fields: dict) -> AssignerResult:
    net = (
        dependent_fields["standalone_rv_total"]
        - dependent_fields["standalone_rv_discount"]
    )

    return AssignerResult(
        success=True,
        assigned_fields={"standalone_rv_net": net},
        error_message=None,
    )


def test_standalone_assigner_registration_and_execution():
    assert (
        DefaultAssigner.get_assign_func_of_assigned_key("standalone_rv_total").__name__
        == assign_standalone_total.__name__
    )

    result = DefaultAssigner.assign(
        "standalone_rv_total",
        {
            "standalone_rv_a": 5,
            "standalone_rv_b": 7,
        },
    )
    assert result.success
    assert result.assigned_fields == {"standalone_rv_total": 12}

    result = DefaultAssigner.assign(
        "standalone_rv_total",
        {
            "standalone_rv_a": 5,
        },
    )
    assert not result.success
    assert result.assigned_fields is None
    assert "Missing dependent" in result.error_message


def test_standalone_manual_assigner():
    depent_files = DefaultAssigner.get_dependent_fields_of_assigned_key(
        "standalone_rv_net"
    )
    assert sorted(depent_files) == sorted(
        [
            "standalone_rv_a",
            "standalone_rv_b",
            "standalone_rv_discount",
            "standalone_rv_total",
        ]
    )
    # Manual assigners rely on caller-provided dependent data
    result = DefaultAssigner.assign(
        "standalone_rv_net",
        {
            "standalone_rv_a": 10,
            "standalone_rv_b": 10,
            "standalone_rv_discount": 3,
        },
    )

    assert result.success
    assert result.assigned_fields == {"standalone_rv_net": 17}


class ReadonlyRvAssigner(AssignerBase):
    @assigner(
        assigned_fields=["rv_readonly_auto"],
        dependent_fields=["rv_01"],
        mode="auto_readonly",
    )
    def assign_readonly_auto(dependent_fields: dict) -> AssignerResult:
        return AssignerResult(
            assigned_fields={"rv_readonly_auto": dependent_fields["rv_01"]}
        )

    @assigner(
        assigned_fields=["rv_readonly_manual"],
        dependent_fields=[],
        mode="manual_readonly",
    )
    def assign_readonly_manual(_dependent_fields: dict) -> AssignerResult:
        return AssignerResult(assigned_fields={"rv_readonly_manual": 1})


def test_readonly_modes_exposed_in_all_assigned_fields():
    rfs = ReadonlyRvAssigner.all_assigned_fields()

    assert rfs["rv_readonly_auto"]["mode"] == "auto_readonly"

    assert rfs["rv_readonly_manual"]["mode"] == "manual_readonly"
