import functools
import threading
from graphlib import CycleError, TopologicalSorter
from typing import Any, Callable, Literal

from airalogy.assigner.assigner_result import AssignerResult

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
    if not qualname:
        return False
    # Remove <locals> markers and check if nested in a class
    # e.g. "test.<locals>.MyClass.method" -> "test.MyClass.method" -> has "." after class
    parts = [p for p in qualname.split(".") if p != "<locals>"]
    # Need at least 2 parts: ClassName.method_name
    return len(parts) >= 2


class AssignerBase:
    _lock = threading.Lock()
    assigned_info: dict[str, tuple[list[str], Callable, AssignerMode]] = {}
    dependent_info: dict[str, list[tuple[str, Callable, AssignerMode]]] = {}
    dependency_graph: dict[str, set[str]] = {}

    def __init_subclass__(cls, **kwargs):
        with AssignerBase._lock:
            cls.assigned_info = AssignerBase.assigned_info
            cls.dependent_info = AssignerBase.dependent_info
            cls.dependency_graph = AssignerBase.dependency_graph
            AssignerBase.assigned_info = {}
            AssignerBase.dependent_info = {}
            AssignerBase.dependency_graph = {}

    @classmethod
    def assigner(
        cls,
        assigned_fields: list[str],
        dependent_fields: list[str],
        mode: AssignerMode = "auto_first",
    ):
        def decorator(assign_func: Callable[[dict[str, Any]], AssignerResult]):
            assigner_name = assign_func.__name__
            if len(assigned_fields) == 0:
                raise ValueError(
                    f"assigned_fields must be not empty when using {assigner_name}."
                )
            if len(dependent_fields) == 0 and not is_manual_assigner(mode):
                raise ValueError(
                    f"dependent_fields must be not empty when using {assigner_name} in mode {mode}."
                )
            for key in assigned_fields:
                if key in cls.assigned_info:
                    raise ValueError(
                        f"assigned_fields: {key} has been defined in other assigner."
                    )
                cls.assigned_info[key] = (dependent_fields, assign_func, mode)
            if assigner_name in cls.dependency_graph:
                raise ValueError(f"assigner_name: {assigner_name} is not unique.")
            for key in dependent_fields:
                if key not in cls.dependent_info:
                    cls.dependent_info[key] = []
                for assigned_key in assigned_fields:
                    cls.dependent_info[key].append((assigned_key, assign_func, mode))

            # Build dependency_graph
            cls.build_dependency_graph()
            cls.validate_dependency_graph()

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
                    if result.assigned_fields is None:
                        return AssignerResult(
                            success=False,
                            assigned_fields=None,
                            error_message=f"The return value of {assign_func.__name__} must contain assigned_fields.",
                        )
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
    def build_dependency_graph(cls) -> None:
        """Build dependency graph and cache it in cls.dependency_graph.

        Graph structure:
            - dependent_field -> assigner (assigner depends on input field)
            - assigner -> assigned_field (assigned_field depends on assigner)
        """
        cls.dependency_graph = {}
        graph = cls.dependency_graph

        for assigned_key, (
            dependent_fields,
            assign_func,
            _,
        ) in cls.assigned_info.items():
            assigner_name = assign_func.__name__

            # assigned_field depends on assigner
            if assigned_key not in graph:
                graph[assigned_key] = set()
            graph[assigned_key].add(assigner_name)

            # assigner depends on dependent_fields
            if assigner_name not in graph:
                graph[assigner_name] = set()
            for dep_field in dependent_fields:
                graph[assigner_name].add(dep_field)
                if dep_field not in graph:
                    graph[dep_field] = set()

    @classmethod
    def validate_dependency_graph(cls) -> None:
        """Validate the dependency graph is a valid DAG (no cycles).

        Raises:
            ValueError: If a cycle is detected.
        """

        # Use cached graph
        graph = cls.dependency_graph
        sorter = TopologicalSorter(graph)
        try:
            sorter.prepare()
        except CycleError as e:
            cycle = e.args[1]
            raise ValueError(
                f"Circular dependency detected: {' -> '.join(cycle)}"
            ) from e

    @classmethod
    def export_dependency_graph_to_dict(cls) -> dict:
        """Export dependency graph as dict with 'nodes' and 'edges'.

        Returns:
            dict with:
                - nodes: list of dicts with 'name' and 'type' keys
                  - type: 'assigned_field', 'assigner', or 'dependent_field'
                - edges: list of (source, target) tuples
        """
        graph = cls.dependency_graph
        assigned_keys = set(cls.assigned_info.keys())
        assigner_names = {v[1].__name__ for v in cls.assigned_info.values()}

        nodes = []
        for node in graph.keys():
            if node in assigner_names:
                node_type = "assigner"
            elif node in assigned_keys:
                node_type = "assigned_field"
            else:
                node_type = "dependent_field"
            nodes.append({"name": node, "type": node_type})

        edges = []
        for target, sources in graph.items():
            for source in sources:
                edges.append((source, target))
        return {"nodes": nodes, "edges": edges}

    @classmethod
    def export_dependency_graph_to_mermaid(cls) -> str:
        """Export dependency graph as Mermaid flowchart.

        Shapes:
            - Assigner: {name} (rhombus)
            - Assigned Field: [[name]] (stadium)
            - Dependent-only Field: ([name]) (rounded rect)
        """
        graph = cls.dependency_graph
        assigned_keys = set(cls.assigned_info.keys())
        assigner_names = {v[1].__name__ for v in cls.assigned_info.values()}

        lines = ["flowchart LR"]

        for node in sorted(graph.keys()):
            if node in assigner_names:
                lines.append(f"    {node}{{{{{node}}}}}")
            elif node in assigned_keys:
                lines.append(f"    {node}[[{node}]]")
            else:
                lines.append(f"    {node}([{node}])")

        for target in sorted(graph.keys()):
            for source in sorted(graph[target]):
                lines.append(f"    {source} --> {target}")

        return "\n".join(lines)

    @classmethod
    def get_dependent_fields_of_assigned_key(cls, assigned_key: str) -> list[str]:
        """Get direct dependent fields for an assigned key."""
        if assigned_key in cls.assigned_info:
            return list(cls.assigned_info[assigned_key][0])
        return []

    @classmethod
    def get_assigned_fields_of_dependent_key(cls, dependent_key: str) -> list[str]:
        """Get direct assigned fields that depend on a given field."""
        if dependent_key in cls.dependent_info:
            return [item[0] for item in cls.dependent_info[dependent_key]]
        return []

    @classmethod
    def get_all_dependent_fields_recursive(cls, assigned_key: str) -> list[str]:
        """Get all dependent fields recursively using BFS traversal."""
        if assigned_key not in cls.assigned_info:
            return []

        visited: set[str] = set()
        result: list[str] = []
        queue = list(cls.assigned_info[assigned_key][0])

        while queue:
            field = queue.pop(0)
            if field in visited:
                continue
            visited.add(field)
            result.append(field)
            # If this field is also an assigned field, add its dependencies
            if field in cls.assigned_info:
                for dep in cls.assigned_info[field][0]:
                    if dep not in visited:
                        queue.append(dep)

        return result

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
        return {
            k: {
                "all_dependent_fields": cls.get_all_dependent_fields_recursive(k),
                "dependent_fields": cls.get_dependent_fields_of_assigned_key(k),
                "mode": v[2],
            }
            for k, v in cls.assigned_info.items()
        }

    @classmethod
    def assign(cls, assigned_key: str, dependent_data: dict) -> AssignerResult:
        dep_fields = cls.get_dependent_fields_of_assigned_key(assigned_key)
        for df in dep_fields:
            if df not in dependent_data:
                return AssignerResult(
                    success=False,
                    assigned_fields=None,
                    error_message=f"Missing dependent field: {df} for assigned field: {assigned_key}",
                )

        assign_func = cls.get_assign_func_of_assigned_key(assigned_key)
        if assign_func is None:
            return AssignerResult(
                success=False,
                assigned_fields=None,
                error_message=f"Cannot find assign function for field: {assigned_key}",
            )

        return assign_func(dependent_data)


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
