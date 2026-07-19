import json
from pathlib import Path

from airalogy.markdown import generate_model
from airalogy.types.registry import (
    AiralogyTypeDescriptor,
    export_airalogy_type_metadata,
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

    code_descriptor = registry.get("CodeStr")
    assert code_descriptor is not None
    assert code_descriptor.import_from == "airalogy.types"
    assert code_descriptor.storage_kind == "scalar"
    assert code_descriptor.ui_kind == "code"

    blood_type_descriptor = registry.get("BloodType")
    assert blood_type_descriptor is not None
    assert blood_type_descriptor.import_from == "airalogy.types"
    assert blood_type_descriptor.storage_kind == "scalar"
    assert blood_type_descriptor.ui_kind is None

    entity_ref_descriptor = registry.get("EntityRef")
    assert entity_ref_descriptor is not None
    assert entity_ref_descriptor.import_from == "airalogy.types"
    assert entity_ref_descriptor.storage_kind == "reference"
    assert entity_ref_descriptor.ui_kind == "entity-ref"


def test_export_airalogy_type_metadata_includes_builtin_enums():
    metadata = export_airalogy_type_metadata(load_plugins=False)
    blood_type = metadata["types"]["BloodType"]
    entity_ref = metadata["types"]["EntityRef"]

    assert metadata["version"] == 1
    assert entity_ref["import_from"] == "airalogy.types"
    assert entity_ref["storage_kind"] == "reference"
    assert entity_ref["ui_kind"] == "entity-ref"

    assert blood_type["import_from"] == "airalogy.types"
    assert blood_type["storage_kind"] == "scalar"
    assert blood_type["title"] == "Blood type"
    assert "Rh positive or Rh negative" in blood_type["description"]
    assert blood_type["enum"] == [
        "A",
        "B",
        "AB",
        "O",
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
        "Rh+",
        "Rh-",
    ]

    assert entity_ref["type"] == "object"


def test_generated_npm_type_metadata_matches_python_export():
    metadata_path = (
        Path(__file__).resolve().parents[4]
        / "npm/aimd-core/src/types/airalogy-built-in-type-metadata.generated.json"
    )

    assert json.loads(metadata_path.read_text(encoding="utf-8")) == (
        export_airalogy_type_metadata(load_plugins=False)
    )


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
