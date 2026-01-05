"""
测试 DependencyGraph 模块

包括：
1. 循环依赖检测
2. 拓扑排序
3. 受影响字段计算
4. 可视化
"""

import pytest
from airalogy.assigner import AssignerBase, AssignerResult, assigner
from airalogy.assigner.dependency_graph import (
    DependencyGraph,
    CyclicDependencyError,
    DependencyNode,
    AssignerExecutor,
)


class TestDependencyGraph:
    """测试 DependencyGraph 类"""
    
    def test_register_and_validate(self):
        """测试注册和验证"""
        graph = DependencyGraph()
        
        def dummy_func(dep):
            return AssignerResult(assigned_fields={})
        
        graph.register(["b"], ["a"], dummy_func, "auto")
        graph.register(["c"], ["b"], dummy_func, "auto")
        
        # 应该不抛出异常
        graph.validate()
    
    def test_cyclic_dependency_detection(self):
        """测试循环依赖检测"""
        graph = DependencyGraph()
        
        def dummy_func(dep):
            return AssignerResult(assigned_fields={})
        
        graph.register(["b"], ["a"], dummy_func, "auto")
        graph.register(["c"], ["b"], dummy_func, "auto")
        graph.register(["a"], ["c"], dummy_func, "auto")  # 形成环: a -> b -> c -> a
        
        with pytest.raises(CyclicDependencyError) as exc_info:
            graph.validate()
        
        # 验证错误信息包含环的信息
        assert "a" in str(exc_info.value)
    
    def test_topological_order(self):
        """测试拓扑排序"""
        graph = DependencyGraph()
        
        def dummy_func(dep):
            return AssignerResult(assigned_fields={})
        
        # d -> c -> b -> a (d 依赖 c，c 依赖 b，b 依赖 a)
        graph.register(["b"], ["a"], dummy_func, "auto")
        graph.register(["c"], ["b"], dummy_func, "auto")
        graph.register(["d"], ["c"], dummy_func, "auto")
        
        order = graph.get_topological_order()
        
        # b 应该在 c 之前，c 应该在 d 之前
        assert order.index("b") < order.index("c")
        assert order.index("c") < order.index("d")
    
    def test_execution_order(self):
        """测试执行顺序"""
        graph = DependencyGraph()
        
        def dummy_func(dep):
            return AssignerResult(assigned_fields={})
        
        graph.register(["b"], ["a"], dummy_func, "auto")
        graph.register(["c"], ["b"], dummy_func, "auto")
        graph.register(["d"], ["c"], dummy_func, "auto")
        
        # 计算 d 需要先计算 b, c
        order = graph.get_execution_order("d")
        
        assert "b" in order
        assert "c" in order
        assert "d" in order
        assert order.index("b") < order.index("c")
        assert order.index("c") < order.index("d")
    
    def test_affected_fields(self):
        """测试受影响字段"""
        graph = DependencyGraph()
        
        def dummy_func(dep):
            return AssignerResult(assigned_fields={})
        
        # a -> b -> d
        # a -> c -> d
        graph.register(["b"], ["a"], dummy_func, "auto")
        graph.register(["c"], ["a"], dummy_func, "auto")
        graph.register(["d"], ["b", "c"], dummy_func, "auto")
        
        # 当 a 变化时，b, c, d 都受影响
        affected = graph.get_affected_fields("a")
        
        assert set(affected) == {"b", "c", "d"}
    
    def test_all_dependencies(self):
        """测试获取所有依赖"""
        graph = DependencyGraph()
        
        def dummy_func(dep):
            return AssignerResult(assigned_fields={})
        
        graph.register(["b"], ["a"], dummy_func, "auto")
        graph.register(["c"], ["b"], dummy_func, "auto")
        graph.register(["d"], ["c", "x"], dummy_func, "auto")
        
        # d 的所有依赖应该是 a, b, c, x
        deps = graph.get_all_dependencies("d")
        
        assert deps == {"a", "b", "c", "x"}
    
    def test_visualize(self):
        """测试可视化"""
        graph = DependencyGraph()
        
        def dummy_func(dep):
            return AssignerResult(assigned_fields={})
        
        graph.register(["b"], ["a"], dummy_func, "auto")
        graph.register(["c"], ["a"], dummy_func, "auto")
        graph.register(["d"], ["b", "c"], dummy_func, "auto")
        
        mermaid = graph.visualize()
        
        assert "flowchart TD" in mermaid
        assert "a" in mermaid
        assert "b" in mermaid
        assert "c" in mermaid
        assert "d" in mermaid
        assert "-->" in mermaid


class TestCyclicDependencyInAssigner:
    """测试 AssignerBase 中的循环依赖检测"""
    
    def test_cyclic_dependency_raises_error(self):
        """测试注册循环依赖时抛出错误"""
        
        class CyclicAssigner(AssignerBase):
            pass
        
        # 注册第一个 assigner
        @CyclicAssigner.assigner(
            assigned_fields=["cyc_b"],
            dependent_fields=["cyc_a"],
            mode="auto",
        )
        def calc_b(dep):
            return AssignerResult(assigned_fields={"cyc_b": dep["cyc_a"]})
        
        # 注册第二个 assigner
        @CyclicAssigner.assigner(
            assigned_fields=["cyc_c"],
            dependent_fields=["cyc_b"],
            mode="auto",
        )
        def calc_c(dep):
            return AssignerResult(assigned_fields={"cyc_c": dep["cyc_b"]})
        
        # 尝试注册形成环的 assigner
        with pytest.raises(CyclicDependencyError):
            @CyclicAssigner.assigner(
                assigned_fields=["cyc_a"],
                dependent_fields=["cyc_c"],
                mode="auto",
            )
            def calc_a(dep):
                return AssignerResult(assigned_fields={"cyc_a": dep["cyc_c"]})


class TestAssignerExecutor:
    """测试 AssignerExecutor"""
    
    def test_compute(self):
        """测试计算"""
        graph = DependencyGraph()
        
        def calc_b(dep):
            return AssignerResult(
                success=True,
                assigned_fields={"exec_b": dep["exec_a"] * 2}
            )
        
        def calc_c(dep):
            return AssignerResult(
                success=True,
                assigned_fields={"exec_c": dep["exec_b"] + 10}
            )
        
        graph.register(["exec_b"], ["exec_a"], calc_b, "auto")
        graph.register(["exec_c"], ["exec_b"], calc_c, "auto")
        
        executor = AssignerExecutor(graph)
        executor.set_value("exec_a", 5)
        
        result = executor.compute("exec_c")
        
        assert result == 20  # (5 * 2) + 10
    
    def test_dirty_tracking(self):
        """测试脏标记追踪"""
        graph = DependencyGraph()
        
        def calc_b(dep):
            return AssignerResult(
                success=True,
                assigned_fields={"dirty_b": dep["dirty_a"] * 2}
            )
        
        graph.register(["dirty_b"], ["dirty_a"], calc_b, "auto")
        
        executor = AssignerExecutor(graph)
        executor.set_value("dirty_a", 5)
        
        # 初始时 dirty_b 应该是脏的
        assert graph.is_dirty("dirty_b")
        
        # 计算后应该不脏了
        executor.compute("dirty_b")
        assert not graph.is_dirty("dirty_b")
        
        # 修改 dirty_a 后，dirty_b 又变脏
        executor.set_value("dirty_a", 10)
        assert graph.is_dirty("dirty_b")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
