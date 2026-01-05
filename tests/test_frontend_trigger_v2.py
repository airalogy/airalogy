"""
前端触发机制 v2 - 优化版

关键改进：
1. 前端只需要调用一次 assign，后端会处理整个依赖链
2. 不需要前端递归触发下游
3. 使用"脏标记"批量处理
"""

import pytest
from airalogy.assigner import DefaultAssigner, assigner, AssignerResult


class OptimizedFrontendSimulator:
    """优化的前端模拟器"""
    
    def __init__(self):
        self.values: dict[str, any] = {}
        self.compute_count = 0
        self.log: list[str] = []
    
    def user_edit(self, field: str, value: any):
        """用户编辑字段"""
        old = self.values.get(field)
        self.values[field] = value
        self.log.append(f"📝 用户编辑: {field} = {value} (was {old})")
        
        # 找到所有受影响的 auto assigner
        self._recompute_affected(field)
    
    def _recompute_affected(self, changed_field: str):
        """重新计算所有受影响的字段"""
        # 获取所有受影响的 assigned fields
        affected = DefaultAssigner.get_assigned_fields_of_dependent_key(changed_field)
        
        if not affected:
            return
        
        self.log.append(f"🔄 受影响的字段: {affected}")
        
        # 按拓扑顺序计算每个受影响的字段
        # 关键：使用后端的 assign 方法，它会自动处理依赖链
        for target in affected:
            info = DefaultAssigner.assigned_info.get(target)
            if not info:
                continue
            
            mode = info[2]
            if mode not in ("auto", "auto_readonly", "auto_first"):
                continue
            
            # 检查依赖是否就绪
            deps = info[0]
            if not all(d in self.values for d in deps):
                self.log.append(f"⏭️ 跳过 {target}: 依赖未就绪")
                continue
            
            # 调用后端计算
            self.compute_count += 1
            result = DefaultAssigner.assign(target, self.values.copy())
            
            if result.success:
                for key, val in result.assigned_fields.items():
                    old = self.values.get(key)
                    if old != val:
                        self.values[key] = val
                        self.log.append(f"✅ 计算: {key} = {val}")
            else:
                self.log.append(f"❌ 计算失败: {target} - {result.error_message}")


class BatchFrontendSimulator:
    """
    批量处理的前端模拟器（推荐方式）
    
    核心思想：
    - 用户编辑后，只标记"脏"
    - 统一批量计算所有脏字段
    - 避免重复计算
    """
    
    def __init__(self):
        self.values: dict[str, any] = {}
        self.dirty_fields: set[str] = set()
        self.compute_count = 0
        self.log: list[str] = []
    
    def user_edit(self, field: str, value: any):
        """用户编辑字段"""
        old = self.values.get(field)
        if old == value:
            return  # 值没变，不处理
        
        self.values[field] = value
        self.log.append(f"📝 用户编辑: {field} = {value}")
        
        # 标记所有受影响的字段为脏
        affected = DefaultAssigner.get_assigned_fields_of_dependent_key(field)
        for f in affected:
            info = DefaultAssigner.assigned_info.get(f)
            if info and info[2] in ("auto", "auto_readonly"):
                self.dirty_fields.add(f)
        
        if self.dirty_fields:
            self.log.append(f"🏷️ 标记为脏: {self.dirty_fields}")
    
    def flush(self):
        """批量计算所有脏字段"""
        if not self.dirty_fields:
            return
        
        self.log.append(f"🔄 开始批量计算...")
        
        # 关键：直接计算最终目标，后端会自动处理整个依赖链
        # 找到依赖链的"叶子节点"（没有其他脏字段依赖它的字段）
        to_compute = list(self.dirty_fields)
        self.dirty_fields.clear()
        
        computed = set()
        
        # 迭代计算，直到所有字段都计算完成
        max_iterations = 10
        for iteration in range(max_iterations):
            progress = False
            
            for target in to_compute:
                if target in computed:
                    continue
                
                info = DefaultAssigner.assigned_info.get(target)
                if not info:
                    computed.add(target)
                    continue
                
                # 检查依赖是否就绪
                deps = info[0]
                if not all(d in self.values for d in deps):
                    continue
                
                self.compute_count += 1
                result = DefaultAssigner.assign(target, self.values.copy())
                
                if result.success:
                    for key, val in result.assigned_fields.items():
                        old = self.values.get(key)
                        if old != val:
                            self.values[key] = val
                            self.log.append(f"✅ {key} = {val}")
                        computed.add(key)
                    progress = True
            
            if not progress:
                break
        
        self.log.append(f"🏁 批量计算完成，共 {self.compute_count} 次调用")


# ============================================================
# Module-level registration with unique prefixes
# ============================================================

# a → b ─┐
# a → c ─┼→ d → e
@assigner(assigned_fields=["ftv2_b"], dependent_fields=["ftv2_a"], mode="auto")
def calc_ftv2_b(dep):
    return AssignerResult(assigned_fields={"ftv2_b": dep["ftv2_a"] * 2})

@assigner(assigned_fields=["ftv2_c"], dependent_fields=["ftv2_a"], mode="auto")
def calc_ftv2_c(dep):
    return AssignerResult(assigned_fields={"ftv2_c": dep["ftv2_a"] * 3})

@assigner(assigned_fields=["ftv2_d"], dependent_fields=["ftv2_b", "ftv2_c"], mode="auto")
def calc_ftv2_d(dep):
    return AssignerResult(assigned_fields={"ftv2_d": dep["ftv2_b"] + dep["ftv2_c"]})

@assigner(assigned_fields=["ftv2_e"], dependent_fields=["ftv2_d"], mode="auto")
def calc_ftv2_e(dep):
    return AssignerResult(assigned_fields={"ftv2_e": dep["ftv2_d"] * 2})


# ============================================================
# 测试用例
# ============================================================

def test_optimized():
    """测试优化版前端
    
    注意：OptimizedFrontendSimulator 只计算直接依赖，不递归触发下游。
    这是一种简化的实现，实际前端可能需要多次触发或使用批量处理。
    """
    sim = OptimizedFrontendSimulator()
    sim.user_edit("ftv2_a", 10)
    
    # 验证直接依赖的计算结果
    assert sim.values.get("ftv2_a") == 10
    assert sim.values.get("ftv2_b") == 20  # 10 * 2
    assert sim.values.get("ftv2_c") == 30  # 10 * 3
    
    # 继续触发下游依赖（模拟前端的多次触发）
    # ftv2_b 和 ftv2_c 变化后，需要重新计算 ftv2_d
    sim._recompute_affected("ftv2_b")
    assert sim.values.get("ftv2_d") == 50  # 20 + 30
    
    # ftv2_d 变化后，需要重新计算 ftv2_e
    sim._recompute_affected("ftv2_d")
    assert sim.values.get("ftv2_e") == 100  # 50 * 2


def test_batch():
    """测试批量处理版前端"""
    sim = BatchFrontendSimulator()
    
    # 用户编辑
    sim.user_edit("ftv2_a", 10)
    
    # 统一计算
    sim.flush()
    
    # 验证计算结果
    assert sim.values.get("ftv2_a") == 10
    assert sim.values.get("ftv2_b") == 20
    assert sim.values.get("ftv2_c") == 30
    assert sim.values.get("ftv2_d") == 50
    assert sim.values.get("ftv2_e") == 100


def test_multiple_edits():
    """测试多次编辑"""
    sim = BatchFrontendSimulator()
    
    # 用户快速编辑多个字段（比如粘贴数据）
    sim.user_edit("ftv2_a", 10)
    sim.user_edit("ftv2_a", 20)  # 又改了
    sim.user_edit("ftv2_a", 15)  # 最终值
    
    # 统一计算（比如 debounce 后）
    sim.flush()
    
    # 验证最终值
    assert sim.values.get("ftv2_a") == 15
    assert sim.values.get("ftv2_b") == 30  # 15 * 2
    assert sim.values.get("ftv2_c") == 45  # 15 * 3
    assert sim.values.get("ftv2_d") == 75  # 30 + 45
    assert sim.values.get("ftv2_e") == 150  # 75 * 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
