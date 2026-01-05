"""
测试 get_dependent_fields_of_assigned_key 不会修改内部状态

这个测试用于验证修复了以下 bug:
- 原始实现中，get_dependent_fields_of_assigned_key 直接修改了 assigned_info 中存储的依赖列表
- 每次调用都会导致依赖列表无限增长
- 在复杂的网状依赖中，这会导致"震荡"或重复计算
"""

import copy

from airalogy.assigner import AssignerBase, AssignerResult, assigner


class StateMutationTestAssigner(AssignerBase):
    """用于测试状态不变性的 Assigner"""

    @assigner(
        assigned_fields=["level1"],
        dependent_fields=["input_a", "input_b"],
        mode="auto",
    )
    def calc_level1(dependent_fields: dict) -> AssignerResult:
        return AssignerResult(
            assigned_fields={
                "level1": dependent_fields["input_a"] + dependent_fields["input_b"]
            }
        )

    @assigner(
        assigned_fields=["level2"],
        dependent_fields=["level1", "input_c"],
        mode="auto",
    )
    def calc_level2(dependent_fields: dict) -> AssignerResult:
        return AssignerResult(
            assigned_fields={
                "level2": dependent_fields["level1"] * dependent_fields["input_c"]
            }
        )

    @assigner(
        assigned_fields=["level3"],
        dependent_fields=["level2", "input_d"],
        mode="auto",
    )
    def calc_level3(dependent_fields: dict) -> AssignerResult:
        return AssignerResult(
            assigned_fields={
                "level3": dependent_fields["level2"] + dependent_fields["input_d"]
            }
        )


def test_get_dependent_fields_does_not_mutate_internal_state():
    """验证多次调用 get_dependent_fields_of_assigned_key 不会修改内部状态"""

    # 保存初始状态
    initial_states = {}
    for key in StateMutationTestAssigner.assigned_info:
        initial_states[key] = copy.deepcopy(
            StateMutationTestAssigner.assigned_info[key][0]
        )

    # 多次调用
    for _ in range(10):
        StateMutationTestAssigner.get_dependent_fields_of_assigned_key("level3")
        StateMutationTestAssigner.get_dependent_fields_of_assigned_key("level2")
        StateMutationTestAssigner.get_dependent_fields_of_assigned_key("level1")

    # 验证内部状态未被修改
    for key in StateMutationTestAssigner.assigned_info:
        current = StateMutationTestAssigner.assigned_info[key][0]
        original = initial_states[key]
        assert current == original, (
            f"Internal state for '{key}' was mutated: {original} -> {current}"
        )


def test_get_dependent_fields_returns_consistent_results():
    """验证多次调用返回一致的结果"""

    results = []
    for _ in range(5):
        deps = StateMutationTestAssigner.get_dependent_fields_of_assigned_key("level3")
        results.append(sorted(deps))

    # 所有结果应该相同
    for i, result in enumerate(results[1:], 1):
        assert result == results[0], (
            f"Call {i+1} returned different result: {result} vs {results[0]}"
        )


def test_get_dependent_fields_returns_complete_chain():
    """验证返回完整的依赖链"""

    deps = StateMutationTestAssigner.get_dependent_fields_of_assigned_key("level3")

    # level3 依赖 level2, input_d
    # level2 依赖 level1, input_c
    # level1 依赖 input_a, input_b
    expected = {"input_a", "input_b", "input_c", "input_d", "level1", "level2"}

    assert set(deps) == expected, f"Expected {expected}, got {set(deps)}"


class DiamondDependencyAssigner(AssignerBase):
    """菱形依赖测试"""

    @assigner(
        assigned_fields=["node_a"],
        dependent_fields=["root"],
        mode="auto",
    )
    def calc_a(dependent_fields: dict) -> AssignerResult:
        return AssignerResult(
            assigned_fields={"node_a": dependent_fields["root"] * 2}
        )

    @assigner(
        assigned_fields=["node_b"],
        dependent_fields=["root"],
        mode="auto",
    )
    def calc_b(dependent_fields: dict) -> AssignerResult:
        return AssignerResult(
            assigned_fields={"node_b": dependent_fields["root"] * 3}
        )

    @assigner(
        assigned_fields=["leaf"],
        dependent_fields=["node_a", "node_b"],
        mode="auto",
    )
    def calc_leaf(dependent_fields: dict) -> AssignerResult:
        return AssignerResult(
            assigned_fields={
                "leaf": dependent_fields["node_a"] + dependent_fields["node_b"]
            }
        )


def test_diamond_dependency_state_stability():
    """测试菱形依赖结构下的状态稳定性"""

    initial_states = {}
    for key in DiamondDependencyAssigner.assigned_info:
        initial_states[key] = copy.deepcopy(
            DiamondDependencyAssigner.assigned_info[key][0]
        )

    # 多次调用
    for _ in range(10):
        DiamondDependencyAssigner.get_dependent_fields_of_assigned_key("leaf")

    # 验证状态未被修改
    for key in DiamondDependencyAssigner.assigned_info:
        current = DiamondDependencyAssigner.assigned_info[key][0]
        original = initial_states[key]
        assert current == original, (
            f"Diamond dependency: state for '{key}' was mutated"
        )


def test_diamond_dependency_correct_deps():
    """测试菱形依赖返回正确的依赖列表"""

    deps = DiamondDependencyAssigner.get_dependent_fields_of_assigned_key("leaf")

    # leaf 依赖 node_a, node_b
    # node_a 和 node_b 都依赖 root
    # 所以 leaf 的完整依赖是 {node_a, node_b, root}
    expected = {"node_a", "node_b", "root"}

    assert set(deps) == expected, f"Expected {expected}, got {set(deps)}"
