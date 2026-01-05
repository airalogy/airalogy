"""
Assigner 依赖图管理器

提供：
1. 循环依赖检测
2. 拓扑排序（保证计算顺序）
3. 防止重复计算
4. 菱形依赖处理
"""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class DependencyNode:
    """依赖图中的节点"""
    name: str
    dependent_fields: list[str] = field(default_factory=list)
    assign_func: Callable | None = None
    mode: str = "auto"
    
    # 计算时的状态
    is_dirty: bool = True
    last_value: object = None


class CyclicDependencyError(Exception):
    """循环依赖错误"""
    def __init__(self, cycle: list[str]):
        self.cycle = cycle
        cycle_str = " → ".join(cycle)
        super().__init__(f"Cyclic dependency detected: {cycle_str}")


class DependencyGraph:
    """
    依赖图管理器
    
    使用方法：
    ```python
    graph = DependencyGraph()
    
    # 注册 assigner
    graph.register("c", ["a", "b"], calc_c, "auto")
    graph.register("d", ["c"], calc_d, "auto")
    
    # 验证（检测循环依赖）
    graph.validate()
    
    # 获取计算顺序
    order = graph.get_execution_order("d")  # ["c", "d"]
    
    # 当字段变化时，获取需要更新的字段
    affected = graph.get_affected_fields("a")  # ["c", "d"]
    ```
    """
    
    def __init__(self):
        # assigned_field -> DependencyNode
        self._nodes: dict[str, DependencyNode] = {}
        
        # dependent_field -> list of assigned_fields that depend on it
        self._reverse_deps: dict[str, set[str]] = defaultdict(set)
        
        # 缓存
        self._topo_order_cache: list[str] | None = None
        self._all_deps_cache: dict[str, set[str]] = {}
    
    def register(
        self,
        assigned_fields: list[str],
        dependent_fields: list[str],
        assign_func: Callable,
        mode: str = "auto",
    ) -> None:
        """注册一个 assigner"""
        self._invalidate_cache()
        
        for assigned in assigned_fields:
            if assigned in self._nodes:
                raise ValueError(
                    f"Field '{assigned}' is already registered as an assigned field"
                )
            
            self._nodes[assigned] = DependencyNode(
                name=assigned,
                dependent_fields=list(dependent_fields),
                assign_func=assign_func,
                mode=mode,
            )
            
            for dep in dependent_fields:
                self._reverse_deps[dep].add(assigned)
    
    def validate(self) -> None:
        """
        验证依赖图，检测循环依赖
        
        Raises:
            CyclicDependencyError: 如果存在循环依赖
        """
        # 使用 DFS 检测环
        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[str, int] = defaultdict(int)
        path: list[str] = []
        
        def dfs(node: str) -> None:
            if color[node] == BLACK:
                return
            if color[node] == GRAY:
                # 找到环
                cycle_start = path.index(node)
                cycle = path[cycle_start:] + [node]
                raise CyclicDependencyError(cycle)
            
            color[node] = GRAY
            path.append(node)
            
            # 遍历该节点依赖的字段
            if node in self._nodes:
                for dep in self._nodes[node].dependent_fields:
                    dfs(dep)
            
            path.pop()
            color[node] = BLACK
        
        for node in self._nodes:
            if color[node] == WHITE:
                dfs(node)
    
    def get_all_dependencies(self, field: str) -> set[str]:
        """
        获取字段的所有依赖（包括间接依赖）
        
        Args:
            field: 字段名
            
        Returns:
            所有依赖字段的集合
        """
        if field in self._all_deps_cache:
            return self._all_deps_cache[field]
        
        result: set[str] = set()
        visited: set[str] = set()
        
        def collect(f: str) -> None:
            if f in visited:
                return
            visited.add(f)
            
            if f in self._nodes:
                for dep in self._nodes[f].dependent_fields:
                    result.add(dep)
                    collect(dep)
        
        collect(field)
        self._all_deps_cache[field] = result
        return result
    
    def get_affected_fields(self, changed_field: str) -> list[str]:
        """
        获取当某个字段变化时，所有受影响的 assigned fields（按拓扑顺序）
        
        Args:
            changed_field: 变化的字段名
            
        Returns:
            受影响的字段列表，按计算顺序排列
        """
        affected: set[str] = set()
        
        def collect(f: str) -> None:
            for assigned in self._reverse_deps.get(f, []):
                if assigned not in affected:
                    affected.add(assigned)
                    collect(assigned)
        
        collect(changed_field)
        
        # 按拓扑顺序排序
        topo_order = self.get_topological_order()
        return [f for f in topo_order if f in affected]
    
    def get_execution_order(self, target_field: str) -> list[str]:
        """
        获取计算目标字段所需的执行顺序
        
        Args:
            target_field: 目标字段名
            
        Returns:
            需要计算的字段列表，按执行顺序排列
        """
        if target_field not in self._nodes:
            return []
        
        # 收集所有需要计算的字段
        needed: set[str] = {target_field}
        
        def collect(f: str) -> None:
            if f in self._nodes:
                for dep in self._nodes[f].dependent_fields:
                    if dep in self._nodes:
                        needed.add(dep)
                        collect(dep)
        
        collect(target_field)
        
        # 按拓扑顺序排序
        topo_order = self.get_topological_order()
        return [f for f in topo_order if f in needed]
    
    def get_topological_order(self) -> list[str]:
        """
        获取所有 assigned fields 的拓扑排序
        
        Returns:
            按依赖顺序排列的字段列表（先计算的在前）
        """
        if self._topo_order_cache is not None:
            return self._topo_order_cache
        
        # Kahn's algorithm
        in_degree: dict[str, int] = defaultdict(int)
        
        # 计算入度（只考虑 assigned fields 之间的依赖）
        for node_name, node in self._nodes.items():
            for dep in node.dependent_fields:
                if dep in self._nodes:
                    in_degree[node_name] += 1
        
        # 入度为 0 的节点
        queue = [n for n in self._nodes if in_degree[n] == 0]
        result: list[str] = []
        
        while queue:
            # 按字母顺序处理，保证确定性
            queue.sort()
            node = queue.pop(0)
            result.append(node)
            
            # 减少依赖该节点的字段的入度
            for dependent in self._reverse_deps.get(node, []):
                if dependent in self._nodes:
                    in_degree[dependent] -= 1
                    if in_degree[dependent] == 0:
                        queue.append(dependent)
        
        if len(result) != len(self._nodes):
            # 存在环（理论上 validate() 应该已经检测到了）
            missing = set(self._nodes.keys()) - set(result)
            raise CyclicDependencyError(list(missing))
        
        self._topo_order_cache = result
        return result
    
    def get_node(self, field: str) -> DependencyNode | None:
        """获取节点信息"""
        return self._nodes.get(field)
    
    def get_all_nodes(self) -> dict[str, DependencyNode]:
        """获取所有节点"""
        return dict(self._nodes)
    
    def mark_dirty(self, field: str) -> None:
        """标记字段为脏（需要重新计算）"""
        if field in self._nodes:
            self._nodes[field].is_dirty = True
        
        # 标记所有依赖该字段的节点为脏
        for affected in self.get_affected_fields(field):
            if affected in self._nodes:
                self._nodes[affected].is_dirty = True
    
    def is_dirty(self, field: str) -> bool:
        """检查字段是否需要重新计算"""
        node = self._nodes.get(field)
        return node.is_dirty if node else False
    
    def clear_dirty(self, field: str) -> None:
        """清除脏标记"""
        if field in self._nodes:
            self._nodes[field].is_dirty = False
    
    def _invalidate_cache(self) -> None:
        """清除缓存"""
        self._topo_order_cache = None
        self._all_deps_cache.clear()
    
    def visualize(self) -> str:
        """
        生成 Mermaid 格式的依赖图
        
        Returns:
            Mermaid flowchart 字符串
        """
        lines = ["flowchart TD"]
        
        # 收集所有输入字段（不是 assigned field 的依赖）
        inputs: set[str] = set()
        for node in self._nodes.values():
            for dep in node.dependent_fields:
                if dep not in self._nodes:
                    inputs.add(dep)
        
        # 输入节点
        for inp in sorted(inputs):
            lines.append(f"    {inp}([{inp}])")
        
        # Assigned 节点
        for name in sorted(self._nodes.keys()):
            lines.append(f"    {name}{{{{{name}}}}}")
        
        # 边
        for name, node in sorted(self._nodes.items()):
            for dep in node.dependent_fields:
                lines.append(f"    {dep} --> {name}")
        
        return "\n".join(lines)


class AssignerExecutor:
    """
    Assigner 执行器
    
    基于依赖图，正确地执行 assigner 计算
    """
    
    def __init__(self, graph: DependencyGraph):
        self.graph = graph
        self._values: dict[str, object] = {}
    
    def set_value(self, field: str, value: object) -> None:
        """设置字段值"""
        old_value = self._values.get(field)
        if old_value != value:
            self._values[field] = value
            self.graph.mark_dirty(field)
    
    def get_value(self, field: str) -> object:
        """获取字段值"""
        return self._values.get(field)
    
    def compute(self, target_field: str) -> object:
        """
        计算目标字段的值
        
        会自动计算所有依赖，按正确的顺序执行，避免重复计算
        
        Args:
            target_field: 目标字段名
            
        Returns:
            计算结果
        """
        execution_order = self.graph.get_execution_order(target_field)
        
        for field in execution_order:
            node = self.graph.get_node(field)
            if node is None:
                continue
            
            # 检查是否需要计算
            if not node.is_dirty and field in self._values:
                continue
            
            # 收集依赖值
            dep_values = {}
            for dep in node.dependent_fields:
                if dep not in self._values:
                    raise ValueError(f"Missing dependency '{dep}' for field '{field}'")
                dep_values[dep] = self._values[dep]
            
            # 执行计算
            if node.assign_func:
                result = node.assign_func(dep_values)
                if hasattr(result, 'success') and result.success:
                    if hasattr(result, 'assigned_fields') and result.assigned_fields:
                        for k, v in result.assigned_fields.items():
                            self._values[k] = v
                            if k in self.graph._nodes:
                                self.graph.clear_dirty(k)
                elif hasattr(result, 'success') and not result.success:
                    raise RuntimeError(
                        f"Assigner for '{field}' failed: {getattr(result, 'error_message', 'Unknown error')}"
                    )
        
        return self._values.get(target_field)
    
    def compute_affected(self, changed_field: str) -> dict[str, object]:
        """
        当某个字段变化后，计算所有受影响的字段
        
        Args:
            changed_field: 变化的字段名
            
        Returns:
            所有更新的字段及其新值
        """
        affected = self.graph.get_affected_fields(changed_field)
        results = {}
        
        for field in affected:
            node = self.graph.get_node(field)
            if node is None or node.mode in ("manual", "manual_readonly"):
                continue
            
            try:
                value = self.compute(field)
                results[field] = value
            except Exception as e:
                # 记录错误但继续处理其他字段
                results[field] = e
        
        return results
