import functools
import threading
from typing import Callable, Literal

from airalogy.assigner.assigner_result import AssignerResult


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


AssignerMode = Literal["manual", "auto_first", "auto", "auto_force"]


class AssignerBase:
    _lock = threading.Lock()
    assigned_info: dict[str, tuple[list[str], Callable, AssignerMode]] = {}
    dependent_info: dict[str, list[tuple[str, Callable, AssignerMode]]] = {}

    def __init_subclass__(cls, **kwargs):
        with AssignerBase._lock:
            cls.assigned_info = AssignerBase.assigned_info
            cls.dependent_info = AssignerBase.dependent_info
            AssignerBase.assigned_info = {}
            AssignerBase.dependent_info = {}

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
            if len(dependent_fields) == 0 and mode != "manual":
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
            dependent_keys = cls.assigned_info[assigned_key][0]
            for key in dependent_keys:
                dependent_keys.extend(cls.get_dependent_fields_of_assigned_key(key))

            return unique_list(flatten_list(dependent_keys))
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
    def all_assigned_fields(cls) -> dict[str, list[str]]:
        return {
            k: {
                "dependent_fields": cls.get_dependent_fields_of_assigned_key(k),
                "mode": v[2],
            }
            for k, v in cls.assigned_info.items()
        }

    @classmethod
    def assign(cls, rf_name: str, dependent_data: dict) -> AssignerResult:
        dep_rfs = cls.get_dependent_fields_of_assigned_key(rf_name)
        for rf in dep_rfs:
            info = cls.assigned_info.get(rf)
            if info and info[2] != "auto_first":
                res = cls.assign(rf, dependent_data)
                if res.success:
                    dependent_data[rf] = res.assigned_fields[rf]
                else:
                    return res
            if rf not in dependent_data:
                return AssignerResult(
                    success=False,
                    assigned_fields=None,
                    error_message=f"Missing dependent rf: {rf} for assigned rf: {rf_name}",
                )

        assign_func = cls.get_assign_func_of_assigned_key(rf_name)
        if assign_func is None:
            return AssignerResult(
                success=False,
                assigned_fields=None,
                error_message=f"Cannot find assign function for rf: {rf_name}",
            )

        return assign_func(dependent_data)


def assigner(
    assigned_fields: list[str],
    dependent_fields: list[str],
    mode: AssignerMode = "auto_first",
):
    return AssignerBase.assigner(assigned_fields, dependent_fields, mode)
