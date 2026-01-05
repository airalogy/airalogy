"""
测试依赖图管理器
"""

import pytest

from airalogy.assigner.dependency_graph import (
    CyclicDependencyError,
    DependencyGraph,
    AssignerExecutor,
)
from airalogy.assigner import AssignerResult


# ============================================================
# 测试用的 mock assigner 函数
# ============================================================

def make_adder(*fields):
    """创建一个加法 assigner"""
    def adder(dep: dict) -> AssignerResult:
        total = sum(dep[f] for f in fields)
        return AssignerResult(assigned_fields={f"sum_{'_'.join(fields)}": total})
    return adder


def make_multiplier(field_a, field_b, output):
    """创建一个乘法 assigner"""
    def multiplier(dep: dict) -> AssignerResult:
        result = dep[field_a] * dep[field_b]
        return AssignerResult(assigned_fields={output: result})
    return multiplier


# ============================================================
# 循环依赖检测测试
# ============================================================

class TestCyclicDependencyDetection:
    
    def test_no_cycle(self):
        """测试无循环的情况"""
        graph = DependencyGraph()
        graph.register(["b"], ["a"], lambda x: None, "auto")
        graph.register(["c"], ["b"], lambda x: None, "auto")
        graph.register(["d"], ["c"], lambda x: None, "auto")
        
        # 不应该抛出异常
        graph.validate()
    
    def test_direct_cycle(self):
        """测试直接循环 A -> B -> A"""
        graph = DependencyGraph()
        graph.register(["b"], ["a"], lambda x: None, "auto")
        graph.register(["a"], ["b"], lambda x: None, "auto")
        
        with pytest.raises(CyclicDependencyError) as exc_info:
            graph.validate()
        
        assert "a" in exc_info.value.cycle
        assert "b" in exc_info.value.cycle
    
    def test_indirect_cycle(self):
        """测试间接循环 A -> B -> C -> A"""
        graph = DependencyGraph()
        graph.register(["b"], ["a"], lambda x: None, "auto")
        graph.register(["c"], ["b"], lambda x: None, "auto")
        graph.register(["a"], ["c"], lambda x: None, "auto")
        
        with pytest.raises(CyclicDependencyError):
            graph.validate()
    
    def test_self_reference(self):
        """测试自引用 A -> A"""
        graph = DependencyGraph()
        graph.register(["a"], ["a"], lambda x: None, "auto")
        
        with pytest.raises(CyclicDependencyError) as exc_info:
            graph.validate()
        
        assert exc_info.value.cycle == ["a", "a"]


# ============================================================
# 拓扑排序测试
# ============================================================

class TestTopologicalSort:
    
    def test_linear_chain(self):
        """测试线性链 a -> b -> c -> d"""
        graph = DependencyGraph()
        graph.register(["b"], ["a"], lambda x: None, "auto")
        graph.register(["c"], ["b"], lambda x: None, "auto")
        graph.register(["d"], ["c"], lambda x: None, "auto")
        
        order = graph.get_topological_order()
        
        assert order.index("b") < order.index("c")
        assert order.index("c") < order.index("d")
    
    def test_diamond_dependency(self):
        """测试菱形依赖"""
        graph = DependencyGraph()
        graph.register(["b"], ["a"], lambda x: None, "auto")
        graph.register(["c"], ["a"], lambda x: None, "auto")
        graph.register(["d"], ["b", "c"], lambda x: None, "auto")
        
        order = graph.get_topological_order()
        
        # b 和 c 都应该在 d 之前
        assert order.index("b") < order.index("d")
        assert order.index("c") < order.index("d")
    
    def test_complex_graph(self):
        """测试复杂图（Line F 结构）"""
        graph = DependencyGraph()
        
        # Line F 的依赖关系
        graph.register(["f6"], ["f1", "f2"], lambda x: None, "auto")
        graph.register(["f7"], ["f2", "f3"], lambda x: None, "auto")
        graph.register(["f8"], ["f4", "f5"], lambda x: None, "auto")
        graph.register(["f9"], ["f6", "f7"], lambda x: None, "auto")
        graph.register(["f10"], ["f9", "f8"], lambda x: None, "auto")
        graph.register(["f11"], ["f10"], lambda x: None, "auto")
        graph.register(["f12"], ["f11", "f6"], lambda x: None, "auto")
        graph.register(["f13"], ["f12", "f7"], lambda x: None, "auto")
        graph.register(["f14"], ["f13", "f8"], lambda x: None, "auto")
        graph.register(["f15"], ["f14", "f1"], lambda x: None, "auto")
        
        graph.validate()  # 不应该有循环
        order = graph.get_topological_order()
        
        # 验证关键顺序约束
        assert order.index("f6") < order.index("f9")
        assert order.index("f7") < order.index("f9")
        assert order.index("f9") < order.index("f10")
        assert order.index("f10") < order.index("f11")
        assert order.index("f11") < order.index("f12")
        assert order.index("f6") < order.index("f12")
        assert order.index("f12") < order.index("f13")
        assert order.index("f13") < order.index("f14")
        assert order.index("f14") < order.index("f15")


# ============================================================
# 依赖查询测试
# ============================================================

class TestDependencyQueries:
    
    def test_get_all_dependencies(self):
        """测试获取所有依赖"""
        graph = DependencyGraph()
        graph.register(["b"], ["a"], lambda x: None, "auto")
        graph.register(["c"], ["b"], lambda x: None, "auto")
        graph.register(["d"], ["c", "x"], lambda x: None, "auto")
        
        deps = graph.get_all_dependencies("d")
        
        assert deps == {"a", "b", "c", "x"}
    
    def test_get_affected_fields(self):
        """测试获取受影响的字段"""
        graph = DependencyGraph()
        graph.register(["b"], ["a"], lambda x: None, "auto")
        graph.register(["c"], ["b"], lambda x: None, "auto")
        graph.register(["d"], ["c"], lambda x: None, "auto")
        graph.register(["e"], ["x"], lambda x: None, "auto")  # 独立的链
        
        affected = graph.get_affected_fields("a")
        
        assert set(affected) == {"b", "c", "d"}
        assert "e" not in affected
        
        # 验证顺序
        assert affected.index("b") < affected.index("c")
        assert affected.index("c") < affected.index("d")
    
    def test_get_execution_order(self):
        """测试获取执行顺序"""
        graph = DependencyGraph()
        graph.register(["b"], ["a"], lambda x: None, "auto")
        graph.register(["c"], ["b"], lambda x: None, "auto")
        graph.register(["d"], ["c"], lambda x: None, "auto")
        graph.register(["e"], ["x"], lambda x: None, "auto")  # 独立的链
        
        order = graph.get_execution_order("d")
        
        assert set(order) == {"b", "c", "d"}
        assert "e" not in order
        
        # 验证顺序
        assert order.index("b") < order.index("c")
        assert order.index("c") < order.index("d")


# ============================================================
# 执行器测试
# ============================================================

class TestAssignerExecutor:
    
    def test_simple_computation(self):
        """测试简单计算"""
        graph = DependencyGraph()
        
        def calc_c(dep):
            return AssignerResult(assigned_fields={"c": dep["a"] + dep["b"]})
        
        graph.register(["c"], ["a", "b"], calc_c, "auto")
        
        executor = AssignerExecutor(graph)
        executor.set_value("a", 10)
        executor.set_value("b", 20)
        
        result = executor.compute("c")
        
        assert result == 30
    
    def test_chain_computation(self):
        """测试链式计算"""
        graph = DependencyGraph()
        
        def calc_b(dep):
            return AssignerResult(assigned_fields={"b": dep["a"] * 2})
        
        def calc_c(dep):
            return AssignerResult(assigned_fields={"c": dep["b"] + 10})
        
        def calc_d(dep):
            return AssignerResult(assigned_fields={"d": dep["c"] * dep["c"]})
        
        graph.register(["b"], ["a"], calc_b, "auto")
        graph.register(["c"], ["b"], calc_c, "auto")
        graph.register(["d"], ["c"], calc_d, "auto")
        
        executor = AssignerExecutor(graph)
        executor.set_value("a", 5)
        
        result = executor.compute("d")
        
        # a=5 -> b=10 -> c=20 -> d=400
        assert result == 400
    
    def test_diamond_computation(self):
        """测试菱形依赖计算"""
        graph = DependencyGraph()
        
        def calc_b(dep):
            return AssignerResult(assigned_fields={"b": dep["a"] * 2})
        
        def calc_c(dep):
            return AssignerResult(assigned_fields={"c": dep["a"] * 3})
        
        def calc_d(dep):
            return AssignerResult(assigned_fields={"d": dep["b"] + dep["c"]})
        
        graph.register(["b"], ["a"], calc_b, "auto")
        graph.register(["c"], ["a"], calc_c, "auto")
        graph.register(["d"], ["b", "c"], calc_d, "auto")
        
        executor = AssignerExecutor(graph)
        executor.set_value("a", 10)
        
        result = executor.compute("d")
        
        # a=10 -> b=20, c=30 -> d=50
        assert result == 50
    
    def test_no_redundant_computation(self):
        """测试不会重复计算"""
        call_count = {"b": 0, "c": 0}
        
        graph = DependencyGraph()
        
        def calc_b(dep):
            call_count["b"] += 1
            return AssignerResult(assigned_fields={"b": dep["a"] * 2})
        
        def calc_c(dep):
            call_count["c"] += 1
            return AssignerResult(assigned_fields={"c": dep["b"] + 10})
        
        graph.register(["b"], ["a"], calc_b, "auto")
        graph.register(["c"], ["b"], calc_c, "auto")
        
        executor = AssignerExecutor(graph)
        executor.set_value("a", 5)
        
        # 第一次计算
        executor.compute("c")
        assert call_count == {"b": 1, "c": 1}
        
        # 再次计算（不应该重复执行）
        executor.compute("c")
        assert call_count == {"b": 1, "c": 1}
        
        # 修改输入后重新计算
        executor.set_value("a", 10)
        executor.compute("c")
        assert call_count == {"b": 2, "c": 2}
    
    def test_line_f_computation(self):
        """测试 Line F 复杂网状依赖"""
        graph = DependencyGraph()
        
        # 注册所有 assigner
        graph.register(["f6"], ["f1", "f2"], 
            lambda d: AssignerResult(assigned_fields={"f6": d["f1"] + d["f2"]}), "auto")
        graph.register(["f7"], ["f2", "f3"], 
            lambda d: AssignerResult(assigned_fields={"f7": d["f2"] * d["f3"]}), "auto")
        graph.register(["f8"], ["f4", "f5"], 
            lambda d: AssignerResult(assigned_fields={"f8": d["f4"] - d["f5"]}), "auto")
        graph.register(["f9"], ["f6", "f7"], 
            lambda d: AssignerResult(assigned_fields={"f9": d["f6"] * d["f7"]}), "auto")
        graph.register(["f10"], ["f9", "f8"], 
            lambda d: AssignerResult(assigned_fields={"f10": d["f9"] + d["f8"]}), "auto")
        graph.register(["f11"], ["f10"], 
            lambda d: AssignerResult(assigned_fields={"f11": d["f10"] * 2}), "auto")
        graph.register(["f12"], ["f11", "f6"], 
            lambda d: AssignerResult(assigned_fields={"f12": d["f11"] + d["f6"]}), "auto")
        graph.register(["f13"], ["f12", "f7"], 
            lambda d: AssignerResult(assigned_fields={"f13": d["f12"] + d["f7"]}), "auto")
        graph.register(["f14"], ["f13", "f8"], 
            lambda d: AssignerResult(assigned_fields={"f14": d["f13"] + d["f8"]}), "auto")
        graph.register(["f15"], ["f14", "f1"], 
            lambda d: AssignerResult(assigned_fields={"f15": d["f14"] - d["f1"]}), "auto")
        
        graph.validate()
        
        executor = AssignerExecutor(graph)
        executor.set_value("f1", 3)
        executor.set_value("f2", 4)
        executor.set_value("f3", 5)
        executor.set_value("f4", 20)
        executor.set_value("f5", 7)
        
        result = executor.compute("f15")
        
        # 期望值（根据 protocol.aimd）
        # f6 = 3 + 4 = 7
        # f7 = 4 * 5 = 20
        # f8 = 20 - 7 = 13
        # f9 = 7 * 20 = 140
        # f10 = 140 + 13 = 153
        # f11 = 153 * 2 = 306
        # f12 = 306 + 7 = 313
        # f13 = 313 + 20 = 333
        # f14 = 333 + 13 = 346
        # f15 = 346 - 3 = 343
        assert result == 343


# ============================================================
# 可视化测试
# ============================================================

class TestVisualization:
    
    def test_mermaid_output(self):
        """测试 Mermaid 输出"""
        graph = DependencyGraph()
        graph.register(["c"], ["a", "b"], lambda x: None, "auto")
        graph.register(["d"], ["c"], lambda x: None, "auto")
        
        mermaid = graph.visualize()
        
        assert "flowchart TD" in mermaid
        assert "a([a])" in mermaid
        assert "b([b])" in mermaid
        assert "c{{c}}" in mermaid
        assert "d{{d}}" in mermaid
        assert "a --> c" in mermaid
        assert "b --> c" in mermaid
        assert "c --> d" in mermaid
