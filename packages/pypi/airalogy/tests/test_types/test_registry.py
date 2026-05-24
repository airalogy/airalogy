from airalogy.markdown import generate_model
from airalogy.types.registry import (
    AiralogyTypeDescriptor,
    get_airalogy_type_registry,
    register_airalogy_type,
    unregister_airalogy_type,
)


def test_builtin_type_registry_contains_official_types():
    registry = get_airalogy_type_registry(load_plugins=False)

    descriptor = registry.get("DNASequence")
    assert descriptor is not None
    assert descriptor.import_from == "airalogy.types"
    assert descriptor.storage_kind == "structured"
    assert descriptor.ui_kind == "dna-sequence"


def test_register_and_unregister_custom_type_descriptor():
    descriptor = AiralogyTypeDescriptor(
        type_name="MicroscopeCapture",
        import_from="my_lab.airalogy_types",
        storage_kind="structured",
        ui_kind="microscope-capture",
    )

    register_airalogy_type(descriptor, replace=True)
    try:
        registry = get_airalogy_type_registry(load_plugins=False)
        registered = registry.get("MicroscopeCapture")
        assert registered == descriptor
        assert registry.collect_imports_from_annotation("list[MicroscopeCapture]") == {
            "my_lab.airalogy_types": {"MicroscopeCapture"}
        }
    finally:
        unregister_airalogy_type("MicroscopeCapture")


def test_generate_model_imports_registered_external_types():
    descriptor = AiralogyTypeDescriptor(
        type_name="SpecimenMatrix",
        import_from="my_lab.airalogy_types",
        storage_kind="structured",
        ui_kind="specimen-matrix",
    )

    register_airalogy_type(descriptor, replace=True)
    try:
        code = generate_model("{{var|sample_matrix: SpecimenMatrix}}")
        assert "from my_lab.airalogy_types import SpecimenMatrix" in code
        assert "sample_matrix: SpecimenMatrix" in code
    finally:
        unregister_airalogy_type("SpecimenMatrix")
