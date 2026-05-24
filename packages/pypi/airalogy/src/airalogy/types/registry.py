"""
Registry for Airalogy type descriptors and pluggable type packages.
"""

from __future__ import annotations

import inspect
from collections import OrderedDict
from collections.abc import Callable, Iterable, Iterator, Mapping
from dataclasses import dataclass, field
from importlib.metadata import entry_points

PLUGIN_ENTRY_POINT_GROUP = "airalogy.types"


def _type_matches(type_name: str, annotation: str) -> bool:
    """
    Check whether a type token appears as a whole word in a type annotation.
    """
    import re

    pattern = r"\b" + re.escape(type_name) + r"\b"
    return re.search(pattern, annotation) is not None


@dataclass(frozen=True, slots=True)
class AiralogyTypeDescriptor:
    """
    Describes how a public Airalogy type token maps to a Python import.

    These descriptors let Airalogy keep its official built-in types and also
    discover or register third-party types without changing AIMD syntax rules.
    """

    type_name: str
    import_from: str = "airalogy.types"
    aliases: tuple[str, ...] = ()
    storage_kind: str | None = None
    ui_kind: str | None = None
    schema_extra: Mapping[str, object] = field(default_factory=dict)
    source: str = "manual"

    def lookup_names(self) -> tuple[str, ...]:
        return (self.type_name, *self.aliases)


class AiralogyTypeRegistry:
    """
    Registry of known AIMD / Airalogy type tokens.
    """

    def __init__(self) -> None:
        self._descriptors: "OrderedDict[str, AiralogyTypeDescriptor]" = OrderedDict()
        self._lookup_to_type: dict[str, str] = {}
        self._plugins_loaded = False

    def register(
        self,
        descriptor: AiralogyTypeDescriptor,
        *,
        replace: bool = False,
    ) -> AiralogyTypeDescriptor:
        if not descriptor.type_name:
            raise ValueError("Airalogy type name cannot be empty.")

        existing = self._descriptors.get(descriptor.type_name)
        if existing is not None and existing != descriptor and not replace:
            raise ValueError(
                f"Airalogy type '{descriptor.type_name}' is already registered."
            )

        if existing is not None:
            for token in existing.lookup_names():
                self._lookup_to_type.pop(token, None)

        for token in descriptor.lookup_names():
            owner = self._lookup_to_type.get(token)
            if owner is not None and owner != descriptor.type_name and not replace:
                raise ValueError(
                    f"Airalogy type token '{token}' is already registered by '{owner}'."
                )

        self._descriptors[descriptor.type_name] = descriptor
        for token in descriptor.lookup_names():
            self._lookup_to_type[token] = descriptor.type_name

        return descriptor

    def unregister(self, type_name: str) -> AiralogyTypeDescriptor | None:
        descriptor = self._descriptors.pop(type_name, None)
        if descriptor is None:
            return None

        for token in descriptor.lookup_names():
            self._lookup_to_type.pop(token, None)

        return descriptor

    def get(self, token: str) -> AiralogyTypeDescriptor | None:
        type_name = self._lookup_to_type.get(token)
        if type_name is None:
            return None
        return self._descriptors.get(type_name)

    def iter_descriptors(self) -> Iterator[AiralogyTypeDescriptor]:
        return iter(self._descriptors.values())

    def iter_lookup_names(self) -> Iterator[str]:
        return iter(self._lookup_to_type.keys())

    def collect_imports_from_annotation(self, annotation: str) -> dict[str, set[str]]:
        imports: dict[str, set[str]] = {}

        for token in self._lookup_to_type:
            if not _type_matches(token, annotation):
                continue

            descriptor = self.get(token)
            if descriptor is None:
                continue

            imports.setdefault(descriptor.import_from, set()).add(token)

        return imports

    def mark_plugins_loaded(self) -> None:
        self._plugins_loaded = True

    @property
    def plugins_loaded(self) -> bool:
        return self._plugins_loaded


_REGISTRY = AiralogyTypeRegistry()


def _coerce_plugin_descriptors(
    value: object,
) -> list[AiralogyTypeDescriptor]:
    if value is None:
        return []

    if isinstance(value, AiralogyTypeDescriptor):
        return [value]

    if callable(value):
        signature = inspect.signature(value)
        parameters = [
            parameter
            for parameter in signature.parameters.values()
            if parameter.kind
            in (
                inspect.Parameter.POSITIONAL_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
            )
        ]

        if len(parameters) > 1:
            raise TypeError(
                "Airalogy type plugin factories must accept zero or one positional argument."
            )

        result = value(_REGISTRY) if parameters else value()
        return _coerce_plugin_descriptors(result)

    if isinstance(value, Iterable) and not isinstance(value, (str, bytes, Mapping)):
        descriptors = []
        for item in value:
            if not isinstance(item, AiralogyTypeDescriptor):
                raise TypeError(
                    "Airalogy type plugins must return AiralogyTypeDescriptor values."
                )
            descriptors.append(item)
        return descriptors

    raise TypeError(
        "Airalogy type plugins must be descriptors, iterables of descriptors, "
        "or callables returning those values."
    )


def discover_airalogy_type_plugins(*, force: bool = False) -> list[AiralogyTypeDescriptor]:
    """
    Load installed type plugins from Python entry points.

    Entry points should live under the ``airalogy.types`` group and return one
    descriptor, an iterable of descriptors, or a callable that does so. A
    callable may also accept the registry and register types directly.
    """

    if _REGISTRY.plugins_loaded and not force:
        return list(_REGISTRY.iter_descriptors())

    loaded_descriptors: list[AiralogyTypeDescriptor] = []
    for entry_point in entry_points(group=PLUGIN_ENTRY_POINT_GROUP):
        loaded = entry_point.load()
        descriptors = _coerce_plugin_descriptors(loaded)
        for descriptor in descriptors:
            _REGISTRY.register(
                AiralogyTypeDescriptor(
                    type_name=descriptor.type_name,
                    import_from=descriptor.import_from,
                    aliases=descriptor.aliases,
                    storage_kind=descriptor.storage_kind,
                    ui_kind=descriptor.ui_kind,
                    schema_extra=descriptor.schema_extra,
                    source=f"entrypoint:{entry_point.name}",
                ),
                replace=True,
            )
            loaded_descriptors.append(descriptor)

    _REGISTRY.mark_plugins_loaded()
    return list(_REGISTRY.iter_descriptors())


def get_airalogy_type_registry(*, load_plugins: bool = True) -> AiralogyTypeRegistry:
    if load_plugins:
        discover_airalogy_type_plugins()
    return _REGISTRY


def register_airalogy_type(
    descriptor: AiralogyTypeDescriptor,
    *,
    replace: bool = False,
) -> AiralogyTypeDescriptor:
    return _REGISTRY.register(descriptor, replace=replace)


def unregister_airalogy_type(type_name: str) -> AiralogyTypeDescriptor | None:
    return _REGISTRY.unregister(type_name)
