from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    assigner,
)


class RvAssigner(AssignerBase):
    @assigner(
        assigned_fields=[
            "rv_table_1.subrv_3",
        ],
        dependent_fields=[
            "rv_01",
            "rv_table_1.subrv_1",
            "rv_table_1.subrv_2",
        ],
        mode="auto",
    )
    def assign_rv_table(dependent_fields: dict) -> AssignerResult:
        subrv_3 = (
            dependent_fields["rv_table_1.subrv_1"]
            + dependent_fields["rv_table_1.subrv_2"]
            + dependent_fields["rv_01"]
        )

        return AssignerResult(
            success=True,
            assigned_fields={
                "rv_table_1.subrv_3": subrv_3,
            },
            error_message=None,
        )

    @assigner(
        assigned_fields=[
            "rv_02",
        ],
        dependent_fields=[
            "rv_01",
            "rv_table_1",
        ],
        mode="auto",
    )
    def assign_rv_02(dependent_fields: dict) -> AssignerResult:
        sum = 0
        for row in dependent_fields["rv_table_1"]:
            sum += row["subrv_1"] + row["subrv_2"]
        rv_02 = dependent_fields["rv_01"] + sum

        return AssignerResult(
            success=True,
            assigned_fields={
                "rv_02": rv_02,
            },
            error_message=None,
        )


def test_rv_table_assigner():
    rfs = RvAssigner.all_assigned_fields()

    assert sorted(rfs.keys()) == ["rv_02", "rv_table_1.subrv_3"]

    assert sorted(rfs["rv_table_1.subrv_3"]["dependent_fields"]) == [
        "rv_01",
        "rv_table_1.subrv_1",
        "rv_table_1.subrv_2",
    ]
    assert sorted(rfs["rv_02"]["dependent_fields"]) == ["rv_01", "rv_table_1"]

    result = RvAssigner.assign(
        "rv_table_1.subrv_3",
        {"rv_01": 10, "rv_table_1.subrv_1": 20, "rv_table_1.subrv_2": 30},
    )
    assert result.success
    assert result.assigned_fields == {"rv_table_1.subrv_3": 60}

    result = RvAssigner.assign(
        "rv_02",
        {
            "rv_01": 10,
            "rv_table_1": [
                {"subrv_1": 10, "subrv_2": 20, "subrv_3": 60},
                {"subrv_1": 15, "subrv_2": 10, "subrv_3": 35},
            ],
        },
    )
    assert result.success
    assert result.assigned_fields == {"rv_02": 65}
