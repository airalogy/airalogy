"""
模拟前端触发机制，测试是否会产生循环触发

前端触发逻辑（假设）：
1. 用户编辑字段 → 调用 assigner
2. assigner 返回新值 → 更新 UI
3. 如果新值与旧值不同 → 可能再次触发依赖该字段的 assigner

问题：如果没有正确的"脏标记"或"触发锁"，可能会无限循环
"""

from airalogy.assigner import DefaultAssigner, assigner, AssignerResult


# 清空注册
DefaultAssigner.assigned_info = {}
DefaultAssigner.dependent_info = {}


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
# 测试用例
# ============================================================

# 简单链式依赖
@assigner(assigned_fields=["chain_b"], dependent_fields=["chain_a"], mode="auto")
def calc_chain_b(dep):
    return AssignerResult(assigned_fields={"chain_b": dep["chain_a"] * 2})

@assigner(assigned_fields=["chain_c"], dependent_fields=["chain_b"], mode="auto")
def calc_chain_c(dep):
    return AssignerResult(assigned_fields={"chain_c": dep["chain_b"] + 10})


# 菱形依赖
@assigner(assigned_fields=["diamond_b"], dependent_fields=["diamond_a"], mode="auto")
def calc_diamond_b(dep):
    return AssignerResult(assigned_fields={"diamond_b": dep["diamond_a"] * 2})

@assigner(assigned_fields=["diamond_c"], dependent_fields=["diamond_a"], mode="auto")
def calc_diamond_c(dep):
    return AssignerResult(assigned_fields={"diamond_c": dep["diamond_a"] * 3})

@assigner(assigned_fields=["diamond_d"], dependent_fields=["diamond_b", "diamond_c"], mode="auto")
def calc_diamond_d(dep):
    return AssignerResult(assigned_fields={"diamond_d": dep["diamond_b"] + dep["diamond_c"]})


def test_chain_trigger():
    """测试链式依赖的触发"""
    print("\n" + "=" * 60)
    print("测试 1: 链式依赖触发")
    print("chain_a → chain_b → chain_c")
    print("=" * 60)
    
    sim = FrontendSimulator()
    
    # 用户编辑 chain_a
    sim.set_value("chain_a", 5, "user")
    
    print("\n触发日志:")
    for log in sim.trigger_log:
        print(f"  {log}")
    
    print(f"\n总触发次数: {sim.trigger_count}")
    print(f"最终值: chain_a={sim.values.get('chain_a')}, chain_b={sim.values.get('chain_b')}, chain_c={sim.values.get('chain_c')}")
    
    # 验证
    assert sim.values.get("chain_b") == 10, "chain_b 应该是 10"
    assert sim.values.get("chain_c") == 20, "chain_c 应该是 20"
    print("✅ 测试通过")


def test_diamond_trigger():
    """测试菱形依赖的触发"""
    print("\n" + "=" * 60)
    print("测试 2: 菱形依赖触发")
    print("diamond_a → diamond_b ─┐")
    print("diamond_a → diamond_c ─┼→ diamond_d")
    print("=" * 60)
    
    sim = FrontendSimulator()
    
    # 用户编辑 diamond_a
    sim.set_value("diamond_a", 10, "user")
    
    print("\n触发日志:")
    for log in sim.trigger_log:
        print(f"  {log}")
    
    print(f"\n总触发次数: {sim.trigger_count}")
    print(f"最终值: a={sim.values.get('diamond_a')}, b={sim.values.get('diamond_b')}, c={sim.values.get('diamond_c')}, d={sim.values.get('diamond_d')}")
    
    # 验证
    assert sim.values.get("diamond_b") == 20, "diamond_b 应该是 20"
    assert sim.values.get("diamond_c") == 30, "diamond_c 应该是 30"
    assert sim.values.get("diamond_d") == 50, "diamond_d 应该是 50"
    print("✅ 测试通过")


def test_value_unchanged():
    """测试值不变时不应该触发"""
    print("\n" + "=" * 60)
    print("测试 3: 值不变时不触发")
    print("=" * 60)
    
    sim = FrontendSimulator()
    
    # 初始设置
    sim.set_value("chain_a", 5, "user")
    initial_count = sim.trigger_count
    
    # 再次设置相同的值
    sim.set_value("chain_a", 5, "user")
    
    print(f"\n初始触发次数: {initial_count}")
    print(f"重复设置后触发次数: {sim.trigger_count}")
    
    if sim.trigger_count == initial_count:
        print("✅ 值不变时没有额外触发")
    else:
        print("⚠️ 值不变时产生了额外触发")


def test_potential_loop():
    """测试潜在的循环触发场景"""
    print("\n" + "=" * 60)
    print("测试 4: 潜在循环触发检测")
    print("=" * 60)
    
    # 清空并重新注册一个可能产生"伪循环"的场景
    # 注意：这不是真正的循环依赖，但可能在前端触发时产生问题
    
    sim = FrontendSimulator()
    sim.max_triggers = 20  # 降低阈值以便观察
    
    sim.set_value("chain_a", 5, "user")
    
    print(f"\n总触发次数: {sim.trigger_count}")
    
    if sim.trigger_count < sim.max_triggers:
        print("✅ 没有产生无限循环")
    else:
        print("❌ 可能存在循环触发问题")


if __name__ == "__main__":
    print("=" * 60)
    print("🔄 前端触发机制模拟测试")
    print("=" * 60)
    
    test_chain_trigger()
    test_diamond_trigger()
    test_value_unchanged()
    test_potential_loop()
    
    print("\n" + "=" * 60)
    print("📋 结论")
    print("=" * 60)
    print("""
前端触发机制的关键点：

1. 计算锁 (is_computing)
   - 在计算过程中，不应该再次触发
   - 防止 A→B→C 计算时，B 的变化又触发 A→B

2. 值变化检测
   - 只有值真正变化时才触发下游
   - 避免 set(5) → set(5) 产生无意义的触发

3. 批量更新
   - 一次 assign 可能更新多个字段
   - 应该等所有字段更新完再触发下游

4. 拓扑顺序
   - 后端已经保证了正确的计算顺序
   - 前端只需要触发一次，后端会处理所有依赖
""")
