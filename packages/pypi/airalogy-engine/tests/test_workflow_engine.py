"""Unit tests for AiralogyWorkflowEngine."""

from __future__ import annotations

import shutil
import tempfile
from copy import deepcopy
from pathlib import Path

import pytest

from airalogy_engine import AiralogyWorkflowEngine


def _write_workflow_project(tmp_path: Path, workflow_body: str, assigner_code: str) -> Path:
    workflow_path = tmp_path / "workflow.aimd"
    workflow_path.write_text(
        f"# Test Workflow\n\n```workflow\n{workflow_body.strip()}\n```\n",
        encoding="utf-8",
    )
    assigner_dir = tmp_path / "assigners"
    assigner_dir.mkdir()
    (assigner_dir / "workflow_assigners.py").write_text(assigner_code, encoding="utf-8")
    return workflow_path


@pytest.mark.asyncio
async def test_run_executes_assigner_and_assigns_outputs(tmp_path: Path) -> None:
    workflow_path = _write_workflow_project(
        tmp_path,
        """
version: airalogy.workflow.v1
id: analysis_workflow
nodes:
  - id: measurement
    protocol: ./protocols/measurement/protocol.aimd
  - id: literature_review
    protocol: ./protocols/literature-review/protocol.aimd
  - id: analysis
    protocol: ./protocols/analysis/protocol.aimd
assigners:
  - id: build_analysis_inputs
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:build_analysis_inputs
transitions:
  - id: prepare_analysis_inputs
    from:
      - measurement
      - literature_review
    to:
      - analysis
    run: build_analysis_inputs
    inputs:
      raw_data: ${measurement.var.raw_data}
      background_summary: ${literature_review.var.summary}
    assign:
      analysis:
        var.raw_data_summary: ${prepare_analysis_inputs.outputs.raw_data_summary}
        var.background_summary: ${prepare_analysis_inputs.outputs.background_summary}
""",
        """
def build_analysis_inputs(raw_data, background_summary):
    return {
        "raw_data_summary": f"points={len(raw_data)}",
        "background_summary": background_summary,
    }
""",
    )
    records = {
        "measurement": {"data": {"var": {"raw_data": [1, 2, 3]}}},
        "literature_review": {"data": {"var": {"summary": "known background"}}},
    }

    engine = AiralogyWorkflowEngine(str(workflow_path), assigner_runtime="local")
    result = await engine.run(records)

    assert result["success"] is True, result
    data = result["data"]
    analysis_var = data["records"]["analysis"]["data"]["var"]
    assert analysis_var["raw_data_summary"] == "points=3"
    assert analysis_var["background_summary"] == "known background"
    assert data["transition_outputs"]["prepare_analysis_inputs"] == {
        "raw_data_summary": "points=3",
        "background_summary": "known background",
    }
    assert data["attempts"][0]["status"] == "succeeded"


@pytest.mark.asyncio
async def test_assigns_source_fields_without_assigner_and_preserves_inputs(
    tmp_path: Path,
) -> None:
    workflow_path = _write_workflow_project(
        tmp_path,
        """
version: airalogy.workflow.v1
id: copy_workflow
nodes:
  - id: prep
    protocol: ./protocols/prep/protocol.aimd
  - id: measurement
    protocol: ./protocols/measurement/protocol.aimd
transitions:
  - id: pass_sample_to_measurement
    from: prep
    to: measurement
    assign:
      measurement:
        var.sample_id: ${prep.var.sample_id}
        var.note: copied from prep
""",
        "def unused():\n    return {}\n",
    )
    records = {"prep": {"data": {"var": {"sample_id": "S-001"}}}}
    original = deepcopy(records)

    engine = AiralogyWorkflowEngine(str(workflow_path), assigner_runtime="local")
    result = await engine.run(records)

    assert result["success"] is True, result
    measurement_var = result["data"]["records"]["measurement"]["data"]["var"]
    assert measurement_var == {"sample_id": "S-001", "note": "copied from prep"}
    assert records == original


@pytest.mark.asyncio
async def test_when_false_skips_transition(tmp_path: Path) -> None:
    workflow_path = _write_workflow_project(
        tmp_path,
        """
version: airalogy.workflow.v1
id: branch_workflow
nodes:
  - id: analysis
    protocol: ./protocols/analysis/protocol.aimd
  - id: report
    protocol: ./protocols/report/protocol.aimd
transitions:
  - id: finish_when_qc_passes
    from: analysis
    to: report
    when: ${analysis.check.pass_qc.checked} == true
    assign:
      report:
        var.summary: ready
""",
        "def unused():\n    return {}\n",
    )
    records = {
        "analysis": {"data": {"check": {"pass_qc": {"checked": False}}}},
    }

    engine = AiralogyWorkflowEngine(str(workflow_path), assigner_runtime="local")
    result = await engine.run(records)

    assert result["success"] is True
    assert "report" not in result["data"]["records"]
    assert result["data"]["skipped_transitions"] == [
        {"id": "finish_when_qc_passes", "reason": "when_false"}
    ]


@pytest.mark.asyncio
async def test_same_assigner_outputs_are_namespaced_by_transition_id(
    tmp_path: Path,
) -> None:
    workflow_path = _write_workflow_project(
        tmp_path,
        """
version: airalogy.workflow.v1
id: reuse_workflow
nodes:
  - id: source
    protocol: ./protocols/source/protocol.aimd
  - id: report
    protocol: ./protocols/report/protocol.aimd
  - id: archive
    protocol: ./protocols/archive/protocol.aimd
assigners:
  - id: summarize
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:summarize
transitions:
  - id: prepare_report
    from: source
    to: report
    run: summarize
    inputs:
      value: ${source.var.report_text}
    assign:
      report:
        var.summary: ${prepare_report.outputs.summary}
  - id: prepare_archive
    from: source
    to: archive
    run: summarize
    inputs:
      value: ${source.var.archive_text}
    assign:
      archive:
        var.summary: ${prepare_archive.outputs.summary}
""",
        """
def summarize(value):
    return {"summary": value.upper()}
""",
    )
    records = {
        "source": {
            "data": {"var": {"report_text": "report", "archive_text": "archive"}}
        }
    }

    engine = AiralogyWorkflowEngine(str(workflow_path), assigner_runtime="local")
    result = await engine.run(records)

    assert result["success"] is True
    data = result["data"]
    assert data["records"]["report"]["data"]["var"]["summary"] == "REPORT"
    assert data["records"]["archive"]["data"]["var"]["summary"] == "ARCHIVE"
    assert data["transition_outputs"]["prepare_report"]["summary"] == "REPORT"
    assert data["transition_outputs"]["prepare_archive"]["summary"] == "ARCHIVE"


@pytest.mark.asyncio
async def test_missing_output_reference_returns_failure(tmp_path: Path) -> None:
    workflow_path = _write_workflow_project(
        tmp_path,
        """
version: airalogy.workflow.v1
id: missing_output_workflow
nodes:
  - id: source
    protocol: ./protocols/source/protocol.aimd
  - id: target
    protocol: ./protocols/target/protocol.aimd
assigners:
  - id: produce
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:produce
transitions:
  - id: prepare_target
    from: source
    to: target
    run: produce
    assign:
      target:
        var.value: ${prepare_target.outputs.value}
""",
        """
def produce():
    return {"other": "not requested"}
""",
    )

    engine = AiralogyWorkflowEngine(str(workflow_path), assigner_runtime="local")
    result = await engine.run({"source": {"data": {"var": {}}}})

    assert result["success"] is False
    assert "missing value" in result["message"]
    assert result["data"]["attempts"][0]["status"] == "succeeded"


@pytest.mark.asyncio
async def test_sandbox_runtime_executes_assigner(
    tmp_path: Path,
    sandbox_kwargs: dict,
) -> None:
    workflow_path = _write_workflow_project(
        tmp_path,
        """
version: airalogy.workflow.v1
id: sandbox_workflow
nodes:
  - id: source
    protocol: ./protocols/source/protocol.aimd
  - id: target
    protocol: ./protocols/target/protocol.aimd
assigners:
  - id: double
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:double
transitions:
  - id: prepare_target
    from: source
    to: target
    run: double
    inputs:
      value: ${source.var.value}
    assign:
      target:
        var.value: ${prepare_target.outputs.value}
""",
        """
def double(value):
    return {"value": value * 2}
""",
    )
    boxlite_home = tempfile.mkdtemp(prefix="aewf-", dir="/tmp")
    engine = AiralogyWorkflowEngine(
        str(workflow_path),
        boxlite_home=boxlite_home,
        **sandbox_kwargs,
    )
    try:
        result = await engine.run({"source": {"data": {"var": {"value": 21}}}})
    finally:
        await engine.close()
        shutil.rmtree(boxlite_home, ignore_errors=True)

    assert result["success"] is True, result
    assert result["data"]["records"]["target"]["data"]["var"]["value"] == 42
