import functools
import threading
from typing import Callable, Literal

from airalogy.assigner.assigner_result import AssignerResult
from airalogy.assigner.dependency_graph import DependencyGraph, CyclicDependencyError


def flatten_list(lst):
    result = []
    for i in lst:
        if isinstance(i, list):
            result.extend(flatten_list(i))
        else:
            result.append(i)
    return result


def unique_list(lst):
    return list(set(lst))


AssignerMode = Literal[
    "manual",
    "manual_readonly",
    "auto_first",
    "auto",
    "auto_readonly",
]


def is_manual_assigner(mode: AssignerMode) -> bool:
    return mode in ("manual", "manual_readonly")


def _is_function_defined_in_class(func: Callable) -> bool:
    """Return True when `func` is declared directly inside a class body."""

    qualname = getattr(func, "__qualname__", "")
    if not qualname or "<locals>" in qualname:
        return False
    return "." in qualname


class AssignerBase:
    _lock = threading.Lock()
    assigned_info: dict[str, tuple[list[str], Callable, AssignerMode]] = {}
    dependent_info: dict[str, list[tuple[str, Callable, AssignerMode]]] = {}
    _dependency_graph: DependencyGraph | None = None

    def __init_subclass__(cls, **kwargs):
        with AssignerBase._lock:
            cls.assigned_info = AssignerBase.assigned_info
            cls.dependent_info = AssignerBase.dependent_info
            cls._dependency_graph = AssignerBase._dependency_graph
            AssignerBase.assigned_info = {}
            AssignerBase.dependent_info = {}
            AssignerBase._dependency_graph = None

    @classmethod
    def _get_or_create_graph(cls) -> DependencyGraph:
        """获取或创建依赖图"""
        if cls._dependency_graph is None:
            cls._dependency_graph = DependencyGraph()
        return cls._dependency_graph

    @classmethod
    def assigner(
        cls,
        assigned_fields: list[str],
        dependent_fields: list[str],
        mode: AssignerMode = "auto_first",
    ):
        def decorator(assign_func: Callable):
            if len(assigned_fields) == 0:
                raise ValueError(
                    f"assigned_fields must be not empty when using {assign_func.__name__}."
                )
            if len(dependent_fields) == 0 and not is_manual_assigner(mode):
                raise ValueError(
                    f"dependent_fields must be not empty when using {assign_func.__name__} in mode {mode}."
                )
            for key in assigned_fields:
                if key in cls.assigned_info:
                    raise ValueError(
                        f"assigned_fields: {key} has been defined in other assigner."
                    )
                cls.assigned_info[key] = (dependent_fields, assign_func, mode)
            for key in dependent_fields:
                if key not in cls.dependent_info:
                    cls.dependent_info[key] = []
                for assigned_key in assigned_fields:
                    cls.dependent_info[key].append((assigned_key, assign_func, mode))

            # 注册到依赖图
            graph = cls._get_or_create_graph()
            try:
                graph.register(assigned_fields, dependent_fields, assign_func, mode)
                # 验证是否有循环依赖
                graph.validate()
            except CyclicDependencyError as e:
                # 回滚注册
                for key in assigned_fields:
                    cls.assigned_info.pop(key, None)
                for key in dependent_fields:
                    if key in cls.dependent_info:
                        cls.dependent_info[key] = [
                            item for item in cls.dependent_info[key]
                            if item[0] not in assigned_fields
                        ]
                raise e

            @functools.wraps(assign_func)
            def wrapper(dependent_data: dict) -> AssignerResult:
                # check dependent_data type
                if not isinstance(dependent_data, dict):
                    return AssignerResult(
                        success=False,
                        assigned_fields=None,
                        error_message=f"The parameter of {assign_func.__name__} must be a dict type.",
                    )
                # 检查 dependent data 是否包含所有 dependent_fields
                missing_keys = [
                    key for key in dependent_fields if key not in dependent_data
                ]
                if len(missing_keys) > 0:
                    return AssignerResult(
                        success=False,
                        assigned_fields=None,
                        error_message=f"Missing dependent rfs: {missing_keys} for assigned_fields: {assigned_fields}, in {assign_func.__name__}",
                    )

                try:
                    result = assign_func(dependent_data)
                except Exception as e:
                    return AssignerResult(
                        success=False,
                        assigned_fields=None,
                        error_message=str(e),
                    )

                # 检查 assign_func 的返回值
                if not isinstance(result, AssignerResult):
                    return AssignerResult(
                        success=False,
                        assigned_fields=None,
                        error_message=f"The return value of {assign_func.__name__} must be a AssignerResult.",
                    )
                if result.success:
                    # 检查返回的 dict 是否包含所有 assigned_fields
                    missing_keys = [
                        key
                        for key in assigned_fields
                        if key not in result.assigned_fields
                    ]
                    if len(missing_keys) > 0:
                        return AssignerResult(
                            success=False,
                            assigned_fields=None,
                            error_message=f"Missing assigned rfs: {missing_keys} in the return value of {assign_func.__name__}",
                        )

                return result

            return staticmethod(wrapper)

        return decorator

    @classmethod
    def get_dependent_fields_of_assigned_key(cls, assigned_key: str) -> list[str]:
        if assigned_key in cls.assigned_info:
            # 创建副本，避免修改原始列表
            dependent_keys = list(cls.assigned_info[assigned_key][0])
            result = dependent_keys[:]
            for key in dependent_keys:
                result.extend(cls.get_dependent_fields_of_assigned_key(key))

            return unique_list(flatten_list(result))
        else:
            return []

    @classmethod
    def get_assigned_fields_of_dependent_key(cls, dependent_key: str) -> list[str]:
        if dependent_key in cls.dependent_info:
            assigned_fields = []
            for item in cls.dependent_info[dependent_key]:
                key = item[0]
                assigned_fields.append(key)
                assigned_fields.extend(cls.get_assigned_fields_of_dependent_key(key))

            return unique_list(flatten_list(assigned_fields))
        else:
            return []

    @classmethod
    def get_assign_func_of_assigned_key(cls, assigned_key: str) -> Callable | None:
        if assigned_key in cls.assigned_info:
            return cls.assigned_info[assigned_key][1]
        else:
            return None

    @classmethod
    def get_assign_funcs_of_dependent_key(cls, dependent_key: str) -> list[Callable]:
        if dependent_key in cls.dependent_info:
            return [item[1] for item in cls.dependent_info[dependent_key]]
        else:
            return []

    @classmethod
    def all_assigned_fields(cls) -> dict[str, dict[str, object]]:
        """
        获取所有 assigned fields 的信息
        
        Returns:
            dict: 每个 assigned field 的信息，包含：
                - direct_dependent_fields: 直接依赖的字段列表
                - all_dependent_fields: 全部依赖的字段列表（包括间接依赖）
                - dependent_fields: 同 all_dependent_fields（向后兼容）
                - mode: assigner 模式
        """
        return {
            k: {
                "direct_dependent_fields": list(v[0]),  # 直接依赖
                "all_dependent_fields": cls.get_dependent_fields_of_assigned_key(k),  # 全部依赖
                "dependent_fields": cls.get_dependent_fields_of_assigned_key(k),  # 向后兼容
                "mode": v[2],
            }
            for k, v in cls.assigned_info.items()
        }

    @classmethod
    def get_dependency_graph(cls) -> DependencyGraph | None:
        """获取依赖图（用于高级操作如可视化）"""
        return cls._dependency_graph

    @classmethod
    def assign(cls, rf_name: str, dependent_data: dict) -> AssignerResult:
        """
        计算指定字段的值
        
        使用拓扑排序确保正确的计算顺序，并防止重复计算
        """
        # 优先使用依赖图的执行顺序
        if cls._dependency_graph is not None:
            execution_order = cls._dependency_graph.get_execution_order(rf_name)
        else:
            execution_order = cls._get_execution_order(rf_name)
        
        # 记录已计算的字段，防止重复计算
        computed: set[str] = set()
        last_result: AssignerResult | None = None
        
        for rf in execution_order:
            if rf in computed:
                continue
                
            info = cls.assigned_info.get(rf)
            if not info:
                # 不是 assigned field，检查是否在 dependent_data 中
                if rf not in dependent_data:
                    return AssignerResult(
                        success=False,
                        assigned_fields=None,
                        error_message=f"Missing dependent rf: {rf} for assigned rf: {rf_name}",
                    )
                continue
            
            # 跳过 auto_first 模式（如果已有值）
            if info[2] == "auto_first" and rf in dependent_data:
                computed.add(rf)
                continue
            
            # 检查所有直接依赖是否就绪
            direct_deps = info[0]
            missing = [d for d in direct_deps if d not in dependent_data]
            if missing:
                return AssignerResult(
                    success=False,
                    assigned_fields=None,
                    error_message=f"Missing dependent rfs: {missing} for assigned rf: {rf}",
                )
            
            # 执行计算
            assign_func = info[1]
            res = assign_func(dependent_data)
            
            if res.success:
                # 更新 dependent_data
                for key, value in res.assigned_fields.items():
                    dependent_data[key] = value
                    computed.add(key)
                
                # 如果这是目标字段，保存结果
                if rf == rf_name or rf_name in res.assigned_fields:
                    last_result = res
            else:
                return res
        
        # 返回目标字段的结果
        if last_result is not None:
            return last_result
        
        return AssignerResult(
            success=False,
            assigned_fields=None,
            error_message=f"Cannot find assign function for rf: {rf_name}",
        )
    
    @classmethod
    def _get_execution_order(cls, target: str) -> list[str]:
        """
        获取计算目标字段所需的执行顺序（拓扑排序）
        
        Returns:
            按依赖顺序排列的字段列表（先计算的在前）
        """
        # 收集所有需要计算的 assigned fields
        needed: set[str] = set()
        all_deps: set[str] = set()
        
        def collect(field: str) -> None:
            if field in cls.assigned_info:
                if field not in needed:
                    needed.add(field)
                    for dep in cls.assigned_info[field][0]:
                        all_deps.add(dep)
                        collect(dep)
        
        collect(target)
        
        # 对 needed 进行拓扑排序
        # 计算入度（只考虑 needed 中的字段之间的依赖）
        in_degree: dict[str, int] = {f: 0 for f in needed}
        
        for field in needed:
            for dep in cls.assigned_info[field][0]:
                if dep in needed:
                    in_degree[field] += 1
        
        # Kahn's algorithm
        queue = [f for f in needed if in_degree[f] == 0]
        result: list[str] = []
        
        while queue:
            queue.sort()  # 保证确定性
            node = queue.pop(0)
            result.append(node)
            
            # 找依赖 node 的字段
            for field in needed:
                if node in cls.assigned_info[field][0]:
                    in_degree[field] -= 1
                    if in_degree[field] == 0:
                        queue.append(field)
        
        # 添加非 assigned 的依赖（输入字段）
        inputs = all_deps - needed
        return list(inputs) + result


class DefaultAssigner(AssignerBase):
    """Default assigner container for standalone @assigner functions."""


def assigner(
    assigned_fields: list[str],
    dependent_fields: list[str],
    mode: AssignerMode = "auto_first",
):
    def decorator(assign_func: Callable):
        if _is_function_defined_in_class(assign_func):
            class_decorator = AssignerBase.assigner(
                assigned_fields, dependent_fields, mode
            )
            return class_decorator(assign_func)

        default_decorator = DefaultAssigner.assigner(
            assigned_fields,
            dependent_fields,
            mode,
        )
        wrapped = default_decorator(assign_func)
        if isinstance(wrapped, staticmethod):
            return wrapped.__func__
        return wrapped

    return decorator
