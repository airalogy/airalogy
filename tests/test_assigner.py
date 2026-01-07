import pytest

from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    DefaultAssigner,
    assigner,
    load_inline_assigners,
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
    # Test for DIRECT dependencies only
    assert RvAssigner.get_dependent_fields_of_assigned_key("rv_01") == []
    assert RvAssigner.get_dependent_fields_of_assigned_key("rv_03") == [
        "rv_01",
        "rv_02",
    ]
    assert RvAssigner.get_dependent_fields_of_assigned_key("rv_07") == [
        "rv_04",
        "rv_06",
    ]

    assert RvAssigner2.get_dependent_fields_of_assigned_key("rv_03") == [
        "rv_01",
        "rv_02",
        "rv_09",
    ]


def test_get_all_dependent_fields_recursive():
    # Test for TRANSITIVE dependencies (what get_dependent_fields_of_assigned_key used to do)
    assert RvAssigner.get_all_dependent_fields_recursive("rv_01") == []
    assert sorted(RvAssigner.get_all_dependent_fields_recursive("rv_03")) == [
        "rv_01",
        "rv_02",
    ]
    assert sorted(RvAssigner.get_all_dependent_fields_recursive("rv_07")) == [
        "rv_01",
        "rv_02",
        "rv_03",
        "rv_04",
        "rv_05",
        "rv_06",
    ]


def test_build_dependency_graph():
    RvAssigner.build_dependency_graph()
    graph = RvAssigner.dependency_graph

    # Check assigner nodes exist
    assert "assign_rv03_and_04" in graph
    assert "assign_rv06" in graph

    # Check dependencies
    # assigner depends on inputs
    assert "rv_01" in graph["assign_rv03_and_04"]
    assert "rv_02" in graph["assign_rv03_and_04"]

    # assigned field depends on assigner
    assert "assign_rv03_and_04" in graph["rv_03"]
    assert "assign_rv03_and_04" in graph["rv_04"]


def test_validate_dependency_graph_no_cycle():
    # RvAssigner has no cycles, should pass
    RvAssigner.validate_dependency_graph()


def test_validate_dependency_graph_with_cycle():
    with pytest.raises(ValueError, match="Circular dependency detected"):

        class CycleAssigner(AssignerBase):
            @assigner(assigned_fields=["a"], dependent_fields=["b"])
            def assign_a(dep): ...

            @assigner(assigned_fields=["b"], dependent_fields=["a"])
            def assign_b(dep): ...


def test_export_dependency_graph_to_dict():
    data = RvAssigner.export_dependency_graph_to_dict()
    assert "nodes" in data
    assert "edges" in data

    nodes = data["nodes"]
    node_names = [n["name"] for n in nodes]
    assert "rv_01" in node_names
    assert "assign_rv03_and_04" in node_names
    assert "rv_03" in node_names

    node_dict = {n["name"]: n["type"] for n in nodes}
    assert node_dict["rv_01"] == "dependent_field"
    assert node_dict["assign_rv03_and_04"] == "assigner"
    assert node_dict["rv_03"] == "assigned_field"

    edges = data["edges"]
    # Check edge directions: dependent -> assigner -> assigned
    assert ("rv_01", "assign_rv03_and_04") in edges
    assert ("assign_rv03_and_04", "rv_03") in edges


def test_export_dependency_graph_to_mermaid():
    mermaid = RvAssigner.export_dependency_graph_to_mermaid()

    assert "flowchart LR" in mermaid

    # Check node shapes
    assert "rv_01([rv_01])" in mermaid  # input
    assert "assign_rv03_and_04{{assign_rv03_and_04}}" in mermaid  # assigner
    assert "rv_03[[rv_03]]" in mermaid  # assigned

    # Check edges
    assert "rv_01 --> assign_rv03_and_04" in mermaid
    assert "assign_rv03_and_04 --> rv_03" in mermaid


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

    assert sorted(rfs["rv_06"]["all_dependent_fields"]) == [
        "rv_01",
        "rv_02",
        "rv_03",
        "rv_05",
    ]
    assert sorted(rfs["rv_06"]["dependent_fields"]) == [
        "rv_03",
        "rv_05",
    ]
    assert rfs["rv_06"]["mode"] == "manual"

    assert sorted(rfs["rv_07"]["all_dependent_fields"]) == [
        "rv_01",
        "rv_02",
        "rv_03",
        "rv_04",
        "rv_05",
        "rv_06",
    ]
    assert sorted(rfs["rv_07"]["dependent_fields"]) == [
        "rv_04",
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
    assert not result.success
    assert result.assigned_fields is None
    assert "Missing dependent field: rv_03" in result.error_message

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
    depent_fields = DefaultAssigner.get_all_dependent_fields_recursive(
        "standalone_rv_net"
    )
    assert sorted(depent_fields) == sorted(
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
            "standalone_rv_total": 20,
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


def test_load_inline_assigners_executes_inline_var_blocks():
    content = """
```assigner
@assigner(
    assigned_fields=["inline_var_total"],
    dependent_fields=["inline_var_a", "inline_var_b"],
    mode="auto",
)
def inline_total(dep: dict) -> AssignerResult:
    return AssignerResult(
        assigned_fields={
            "inline_var_total": dep["inline_var_a"] + dep["inline_var_b"]
        }
    )
```
"""
    blocks = load_inline_assigners(content)
    assert len(blocks) == 1

    result = DefaultAssigner.assign(
        "inline_var_total",
        {"inline_var_a": 2, "inline_var_b": 3},
    )
    assert result.success
    assert result.assigned_fields == {"inline_var_total": 5}


def test_inline_assigner_rejected_when_assigner_py_exists_for_inline_var(tmp_path):
    content = """
```assigner
@assigner(
    assigned_fields=["inline_only"],
    dependent_fields=["inline_dep"],
    mode="auto",
)
def inline_only(dep: dict) -> AssignerResult:
    return AssignerResult(assigned_fields={"inline_only": dep["inline_dep"]})
```
"""
    protocol_dir = tmp_path / "protocol"
    protocol_dir.mkdir()
    aimd_path = protocol_dir / "protocol.aimd"
    aimd_path.write_text(content)
    (protocol_dir / "assigner.py").write_text("# placeholder")

    with pytest.raises(ValueError):
        load_inline_assigners(content, aimd_path=aimd_path)
