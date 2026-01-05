"""
前端触发机制 v2 - 优化版

关键改进：
1. 前端只需要调用一次 assign，后端会处理整个依赖链
2. 不需要前端递归触发下游
3. 使用"脏标记"批量处理
"""

from airalogy.assigner import DefaultAssigner, assigner, AssignerResult


# 清空注册
DefaultAssigner.assigned_info = {}
DefaultAssigner.dependent_info = {}


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
# 注册 assigner
# ============================================================

@assigner(assigned_fields=["b"], dependent_fields=["a"], mode="auto")
def calc_b(dep):
    return AssignerResult(assigned_fields={"b": dep["a"] * 2})

@assigner(assigned_fields=["c"], dependent_fields=["a"], mode="auto")
def calc_c(dep):
    return AssignerResult(assigned_fields={"c": dep["a"] * 3})

@assigner(assigned_fields=["d"], dependent_fields=["b", "c"], mode="auto")
def calc_d(dep):
    return AssignerResult(assigned_fields={"d": dep["b"] + dep["c"]})

@assigner(assigned_fields=["e"], dependent_fields=["d"], mode="auto")
def calc_e(dep):
    return AssignerResult(assigned_fields={"e": dep["d"] * 2})


def test_optimized():
    """测试优化版前端"""
    print("\n" + "=" * 60)
    print("测试 1: 优化版前端模拟器")
    print("a → b ─┐")
    print("a → c ─┼→ d → e")
    print("=" * 60)
    
    sim = OptimizedFrontendSimulator()
    sim.user_edit("a", 10)
    
    print("\n日志:")
    for log in sim.log:
        print(f"  {log}")
    
    print(f"\n计算调用次数: {sim.compute_count}")
    print(f"最终值: a={sim.values.get('a')}, b={sim.values.get('b')}, c={sim.values.get('c')}, d={sim.values.get('d')}, e={sim.values.get('e')}")


def test_batch():
    """测试批量处理版前端"""
    print("\n" + "=" * 60)
    print("测试 2: 批量处理版前端模拟器（推荐）")
    print("=" * 60)
    
    sim = BatchFrontendSimulator()
    
    # 用户可能快速编辑多个字段
    sim.user_edit("a", 10)
    
    # 统一计算
    sim.flush()
    
    print("\n日志:")
    for log in sim.log:
        print(f"  {log}")
    
    print(f"\n计算调用次数: {sim.compute_count}")
    print(f"最终值: a={sim.values.get('a')}, b={sim.values.get('b')}, c={sim.values.get('c')}, d={sim.values.get('d')}, e={sim.values.get('e')}")


def test_multiple_edits():
    """测试多次编辑"""
    print("\n" + "=" * 60)
    print("测试 3: 多次编辑后批量计算")
    print("=" * 60)
    
    sim = BatchFrontendSimulator()
    
    # 用户快速编辑多个字段（比如粘贴数据）
    sim.user_edit("a", 10)
    sim.user_edit("a", 20)  # 又改了
    sim.user_edit("a", 15)  # 最终值
    
    print("\n编辑后（未计算）:")
    for log in sim.log:
        print(f"  {log}")
    
    # 统一计算（比如 debounce 后）
    sim.flush()
    
    print("\n计算后:")
    for log in sim.log[-5:]:
        print(f"  {log}")
    
    print(f"\n计算调用次数: {sim.compute_count}")
    print(f"最终值: a={sim.values.get('a')}, b={sim.values.get('b')}, c={sim.values.get('c')}, d={sim.values.get('d')}, e={sim.values.get('e')}")


if __name__ == "__main__":
    print("=" * 60)
    print("🎯 前端触发机制最佳实践")
    print("=" * 60)
    
    test_optimized()
    test_batch()
    test_multiple_edits()
    
    print("\n" + "=" * 60)
    print("📋 最佳实践总结")
    print("=" * 60)
    print("""
1. 不要在前端递归触发
   - 后端 assign() 已经处理了整个依赖链
   - 前端只需要调用一次

2. 使用脏标记 + 批量计算
   - 用户编辑 → 标记脏
   - debounce 后 → 批量计算
   - 避免频繁触发

3. 值变化检测
   - old == new 时不触发
   - 避免无意义的计算

4. 计算锁
   - 计算过程中不接受新的触发
   - 防止循环

5. 信任后端的拓扑排序
   - 后端保证正确的计算顺序
   - 前端不需要关心依赖关系
""")
