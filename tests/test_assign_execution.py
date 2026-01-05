"""
测试 assign 方法的执行行为：
1. 拓扑排序（正确的计算顺序）
2. 防止重复计算
3. 菱形依赖处理
"""

from airalogy.assigner import AssignerBase, AssignerResult, assigner


class ExecutionTracker:
    """追踪 assigner 执行次数"""
    def __init__(self):
        self.call_counts: dict[str, int] = {}
    
    def track(self, name: str):
        self.call_counts[name] = self.call_counts.get(name, 0) + 1
    
    def reset(self):
        self.call_counts.clear()


tracker = ExecutionTracker()


class ChainAssigner(AssignerBase):
    """线性链测试: a -> b -> c -> d"""
    
    @assigner(
        assigned_fields=["chain_b"],
        dependent_fields=["chain_a"],
        mode="auto",
    )
    def calc_b(dep: dict) -> AssignerResult:
        tracker.track("chain_b")
        return AssignerResult(assigned_fields={"chain_b": dep["chain_a"] * 2})
    
    @assigner(
        assigned_fields=["chain_c"],
        dependent_fields=["chain_b"],
        mode="auto",
    )
    def calc_c(dep: dict) -> AssignerResult:
        tracker.track("chain_c")
        return AssignerResult(assigned_fields={"chain_c": dep["chain_b"] + 10})
    
    @assigner(
        assigned_fields=["chain_d"],
        dependent_fields=["chain_c"],
        mode="auto",
    )
    def calc_d(dep: dict) -> AssignerResult:
        tracker.track("chain_d")
        return AssignerResult(assigned_fields={"chain_d": dep["chain_c"] * dep["chain_c"]})


class DiamondAssigner(AssignerBase):
    """菱形依赖测试: a -> b, a -> c, b+c -> d"""
    
    @assigner(
        assigned_fields=["diamond_b"],
        dependent_fields=["diamond_a"],
        mode="auto",
    )
    def calc_b(dep: dict) -> AssignerResult:
        tracker.track("diamond_b")
        return AssignerResult(assigned_fields={"diamond_b": dep["diamond_a"] * 2})
    
    @assigner(
        assigned_fields=["diamond_c"],
        dependent_fields=["diamond_a"],
        mode="auto",
    )
    def calc_c(dep: dict) -> AssignerResult:
        tracker.track("diamond_c")
        return AssignerResult(assigned_fields={"diamond_c": dep["diamond_a"] * 3})
    
    @assigner(
        assigned_fields=["diamond_d"],
        dependent_fields=["diamond_b", "diamond_c"],
        mode="auto",
    )
    def calc_d(dep: dict) -> AssignerResult:
        tracker.track("diamond_d")
        return AssignerResult(assigned_fields={"diamond_d": dep["diamond_b"] + dep["diamond_c"]})


class ComplexAssigner(AssignerBase):
    """复杂网状依赖（简化版 Line F）"""
    
    @assigner(
        assigned_fields=["cx_f6"],
        dependent_fields=["cx_f1", "cx_f2"],
        mode="auto",
    )
    def calc_f6(dep: dict) -> AssignerResult:
        tracker.track("cx_f6")
        return AssignerResult(assigned_fields={"cx_f6": dep["cx_f1"] + dep["cx_f2"]})
    
    @assigner(
        assigned_fields=["cx_f7"],
        dependent_fields=["cx_f2", "cx_f3"],
        mode="auto",
    )
    def calc_f7(dep: dict) -> AssignerResult:
        tracker.track("cx_f7")
        return AssignerResult(assigned_fields={"cx_f7": dep["cx_f2"] * dep["cx_f3"]})
    
    @assigner(
        assigned_fields=["cx_f9"],
        dependent_fields=["cx_f6", "cx_f7"],
        mode="auto",
    )
    def calc_f9(dep: dict) -> AssignerResult:
        tracker.track("cx_f9")
        return AssignerResult(assigned_fields={"cx_f9": dep["cx_f6"] * dep["cx_f7"]})
    
    @assigner(
        assigned_fields=["cx_f12"],
        dependent_fields=["cx_f9", "cx_f6"],
        mode="auto",
    )
    def calc_f12(dep: dict) -> AssignerResult:
        tracker.track("cx_f12")
        return AssignerResult(assigned_fields={"cx_f12": dep["cx_f9"] + dep["cx_f6"]})


def test_chain_no_redundant_computation():
    """测试线性链不会重复计算"""
    tracker.reset()
    
    data = {"chain_a": 5}
    result = ChainAssigner.assign("chain_d", data)
    
    assert result.success
    # a=5 -> b=10 -> c=20 -> d=400
    assert result.assigned_fields["chain_d"] == 400
    
    # 每个 assigner 只应该被调用一次
    assert tracker.call_counts.get("chain_b", 0) == 1
    assert tracker.call_counts.get("chain_c", 0) == 1
    assert tracker.call_counts.get("chain_d", 0) == 1


def test_diamond_no_redundant_computation():
    """测试菱形依赖不会重复计算"""
    tracker.reset()
    
    data = {"diamond_a": 10}
    result = DiamondAssigner.assign("diamond_d", data)
    
    assert result.success
    # a=10 -> b=20, c=30 -> d=50
    assert result.assigned_fields["diamond_d"] == 50
    
    # 每个 assigner 只应该被调用一次
    assert tracker.call_counts.get("diamond_b", 0) == 1
    assert tracker.call_counts.get("diamond_c", 0) == 1
    assert tracker.call_counts.get("diamond_d", 0) == 1


def test_complex_no_redundant_computation():
    """测试复杂网状依赖不会重复计算"""
    tracker.reset()
    
    data = {"cx_f1": 3, "cx_f2": 4, "cx_f3": 5}
    result = ComplexAssigner.assign("cx_f12", data)
    
    assert result.success
    # f6 = 3 + 4 = 7
    # f7 = 4 * 5 = 20
    # f9 = 7 * 20 = 140
    # f12 = 140 + 7 = 147
    assert result.assigned_fields["cx_f12"] == 147
    
    # 每个 assigner 只应该被调用一次
    assert tracker.call_counts.get("cx_f6", 0) == 1
    assert tracker.call_counts.get("cx_f7", 0) == 1
    assert tracker.call_counts.get("cx_f9", 0) == 1
    assert tracker.call_counts.get("cx_f12", 0) == 1


def test_correct_execution_order():
    """测试执行顺序正确（使用 ChainAssigner）"""
    execution_order = []
    
    # 使用已有的 ChainAssigner，通过 tracker 验证顺序
    tracker.reset()
    
    data = {"chain_a": 5}
    result = ChainAssigner.assign("chain_d", data)
    
    assert result.success
    
    # 验证所有依赖都被计算了
    assert "chain_b" in tracker.call_counts
    assert "chain_c" in tracker.call_counts
    assert "chain_d" in tracker.call_counts
    
    # 验证结果正确（间接验证顺序正确）
    # a=5 -> b=10 -> c=20 -> d=400
    assert result.assigned_fields["chain_d"] == 400


def test_intermediate_result_computation():
    """测试计算中间结果"""
    tracker.reset()
    
    data = {"chain_a": 5}
    
    # 只计算 chain_c（不需要 chain_d）
    result = ChainAssigner.assign("chain_c", data)
    
    assert result.success
    assert result.assigned_fields["chain_c"] == 20
    
    # chain_d 不应该被计算
    assert tracker.call_counts.get("chain_b", 0) == 1
    assert tracker.call_counts.get("chain_c", 0) == 1
    assert tracker.call_counts.get("chain_d", 0) == 0
