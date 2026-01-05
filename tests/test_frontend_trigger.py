"""
模拟前端触发机制，测试是否会产生循环触发

前端触发逻辑（假设）：
1. 用户编辑字段 → 调用 assigner
2. assigner 返回新值 → 更新 UI
3. 如果新值与旧值不同 → 可能再次触发依赖该字段的 assigner

问题：如果没有正确的"脏标记"或"触发锁"，可能会无限循环
"""

import pytest
from airalogy.assigner import DefaultAssigner, assigner, AssignerResult


class FrontendSimulator:
    """模拟前端的触发机制"""
    
    def __init__(self):
        self.values: dict[str, any] = {}
        self.trigger_count = 0
        self.max_triggers = 100  # 防止真的无限循环
        self.trigger_log: list[str] = []
        self.is_computing = False  # 计算锁
    
    def set_value(self, field: str, value: any, source: str = "user"):
        """设置值，可能触发 assigner"""
        old_value = self.values.get(field)
        self.values[field] = value
        
        self.trigger_log.append(f"[{source}] {field} = {value} (was {old_value})")
        
        # 如果值变化了，触发依赖该字段的 assigner
        if old_value != value and not self.is_computing:
            self._trigger_dependents(field)
    
    def _trigger_dependents(self, changed_field: str):
        """触发依赖 changed_field 的所有 auto assigner"""
        if self.trigger_count >= self.max_triggers:
            self.trigger_log.append(f"⚠️ 达到最大触发次数 {self.max_triggers}，停止")
            return
        
        self.trigger_count += 1
        
        # 找到所有依赖 changed_field 的 assigned fields
        affected = DefaultAssigner.get_assigned_fields_of_dependent_key(changed_field)
        
        for assigned_field in affected:
            info = DefaultAssigner.assigned_info.get(assigned_field)
            if not info:
                continue
            
            mode = info[2]
            if mode not in ("auto", "auto_readonly"):
                continue  # 只处理 auto 模式
            
            # 检查所有依赖是否就绪
            deps = info[0]
            if not all(d in self.values for d in deps):
                continue
            
            # 设置计算锁，防止计算过程中的值变化再次触发
            self.is_computing = True
            
            try:
                result = DefaultAssigner.assign(assigned_field, self.values.copy())
                
                if result.success:
                    for key, value in result.assigned_fields.items():
                        old = self.values.get(key)
                        if old != value:
                            self.values[key] = value
                            self.trigger_log.append(f"[auto] {key} = {value} (was {old})")
            finally:
                self.is_computing = False
            
            # 计算完成后，检查是否需要触发下游
            # 注意：这里递归调用可能导致问题
            for key in result.assigned_fields.keys() if result.success else []:
                if self.values.get(key) != result.assigned_fields[key]:
                    continue  # 值没变，不触发
                # 触发下游（这里可能产生循环！）
                self._trigger_dependents(key)


# ============================================================
# Module-level registration with unique prefixes
# ============================================================

# 简单链式依赖: ft_chain_a → ft_chain_b → ft_chain_c
@assigner(assigned_fields=["ft_chain_b"], dependent_fields=["ft_chain_a"], mode="auto")
def calc_ft_chain_b(dep):
    return AssignerResult(assigned_fields={"ft_chain_b": dep["ft_chain_a"] * 2})

@assigner(assigned_fields=["ft_chain_c"], dependent_fields=["ft_chain_b"], mode="auto")
def calc_ft_chain_c(dep):
    return AssignerResult(assigned_fields={"ft_chain_c": dep["ft_chain_b"] + 10})

# 菱形依赖
@assigner(assigned_fields=["ft_diamond_b"], dependent_fields=["ft_diamond_a"], mode="auto")
def calc_ft_diamond_b(dep):
    return AssignerResult(assigned_fields={"ft_diamond_b": dep["ft_diamond_a"] * 2})

@assigner(assigned_fields=["ft_diamond_c"], dependent_fields=["ft_diamond_a"], mode="auto")
def calc_ft_diamond_c(dep):
    return AssignerResult(assigned_fields={"ft_diamond_c": dep["ft_diamond_a"] * 3})

@assigner(assigned_fields=["ft_diamond_d"], dependent_fields=["ft_diamond_b", "ft_diamond_c"], mode="auto")
def calc_ft_diamond_d(dep):
    return AssignerResult(assigned_fields={"ft_diamond_d": dep["ft_diamond_b"] + dep["ft_diamond_c"]})


# ============================================================
# 测试用例
# ============================================================

def test_chain_trigger():
    """测试链式依赖的触发"""
    sim = FrontendSimulator()
    
    # 用户编辑 ft_chain_a
    sim.set_value("ft_chain_a", 5, "user")
    
    # 验证
    assert sim.values.get("ft_chain_b") == 10, "ft_chain_b 应该是 10"
    assert sim.values.get("ft_chain_c") == 20, "ft_chain_c 应该是 20"


def test_diamond_trigger():
    """测试菱形依赖的触发"""
    sim = FrontendSimulator()
    
    # 用户编辑 ft_diamond_a
    sim.set_value("ft_diamond_a", 10, "user")
    
    # 验证
    assert sim.values.get("ft_diamond_b") == 20, "ft_diamond_b 应该是 20"
    assert sim.values.get("ft_diamond_c") == 30, "ft_diamond_c 应该是 30"
    assert sim.values.get("ft_diamond_d") == 50, "ft_diamond_d 应该是 50"


def test_value_unchanged():
    """测试值不变时不应该触发"""
    sim = FrontendSimulator()
    
    # 初始设置
    sim.set_value("ft_chain_a", 5, "user")
    initial_count = sim.trigger_count
    
    # 再次设置相同的值
    sim.set_value("ft_chain_a", 5, "user")
    
    # 值不变时不应该有额外触发
    assert sim.trigger_count == initial_count, "值不变时不应该有额外触发"


def test_potential_loop():
    """测试潜在的循环触发场景"""
    sim = FrontendSimulator()
    sim.max_triggers = 20  # 降低阈值以便观察
    
    sim.set_value("ft_chain_a", 5, "user")
    
    # 没有产生无限循环
    assert sim.trigger_count < sim.max_triggers, "可能存在循环触发问题"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
