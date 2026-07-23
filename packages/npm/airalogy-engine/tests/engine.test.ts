import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assignVariable,
  migrateSchema,
  parseWorkflowContent,
  parseProtocol,
  runWorkflow,
  runWorkflowTransition,
  type SandboxOptions,
  validateVariables,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../..");
const EXAMPLE_PROTOCOL = path.join(MONOREPO_ROOT, "examples/airalogy-engine");
const EXAMPLE_WORKFLOW = path.join(MONOREPO_ROOT, "examples/aimd/protocol-workflow");
const DEFAULT_ROOTFS_PATH = path.join(
  MONOREPO_ROOT,
  "packages/runtime/airalogy-engine-image/airalogy-engine-image",
);
const SANDBOX_TEST_MODE = process.env.AIRALOGY_ENGINE_RUN_SANDBOX_TESTS;
const RUN_SANDBOX_TESTS =
  SANDBOX_TEST_MODE === "1" ||
  (SANDBOX_TEST_MODE !== "0" && fs.existsSync(path.join(DEFAULT_ROOTFS_PATH, "oci-layout")));
const itSandbox = RUN_SANDBOX_TESTS ? it : it.skip;
const describeSandbox = RUN_SANDBOX_TESTS ? describe : describe.skip;
const DEFAULT_IMAGE = "numbcoder/airalogy-engine:0.1";
const ENDPOINT = "https://api.example.test";
const VALID_VARIABLES = {
  seconds: "60",
  duration: "PT1M",
  user_name: "alice",
  current_time: "2025-01-01T00:00:00",
  endpoint: ENDPOINT,
};
const ASSIGN_DEBUG_LINES = [
  "This is debug log",
  "Converting 60 seconds to duration: 0:01:00",
];

describe("migrateSchema", () => {
  it("rejects a missing Protocol directory before starting a sandbox", async () => {
    await expect(
      migrateSchema(
        "/tmp/nonexistent_protocol_migration_12345",
        {},
        { version: "airalogy.migration.v1", from: "1.0.0", to: "2.0.0" },
      ),
    ).rejects.toThrow("protocol_path must be a directory");
  });
});

let envProtocolPath: string;
let fileBridgeProtocolPath: string;

function sandboxKwargs(): SandboxOptions {
  const defaultMode = fs.existsSync(path.join(DEFAULT_ROOTFS_PATH, "oci-layout")) ? "rootfs" : "image";
  const mode = process.env.SANDBOX_MODE ?? defaultMode;

  if (mode === "rootfs") {
    const rootfsPath = process.env.ROOTFS_PATH ?? DEFAULT_ROOTFS_PATH;
    if (!fs.existsSync(path.join(rootfsPath, "oci-layout"))) {
      throw new Error(`Local rootfs not found at ${rootfsPath}`);
    }
    return { rootfsPath };
  }

  return { image: process.env.SANDBOX_IMAGE ?? DEFAULT_IMAGE };
}

function writeProtocolToml(protocolPath: string, id: string, name: string): void {
  fs.writeFileSync(
    path.join(protocolPath, "protocol.toml"),
    [
      "[airalogy_protocol]",
      `id = "${id}"`,
      `name = "${name}"`,
      'version = "0.0.1"',
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeEnvProtocol(protocolPath: string): void {
  writeProtocolToml(protocolPath, "env_protocol", "Env Protocol");

  fs.writeFileSync(
    path.join(protocolPath, "protocol.aimd"),
    [
      "## Env Protocol AIMD example",
      "",
      "秒：{{var|seconds}}",
      "将上值以`duration`格式表示：{{var|duration}}",
      "",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(protocolPath, "model.py"),
    [
      "import os",
      "from datetime import timedelta",
      "",
      "from pydantic import BaseModel, Field",
      "",
      'SECONDS_DESCRIPTION = os.environ.get("SECONDS_DESCRIPTION", "default seconds description")',
      'MIN_SECONDS = int(os.environ.get("MIN_SECONDS", "0"))',
      "",
      "class VarModel(BaseModel):",
      "    seconds: int = Field(description=SECONDS_DESCRIPTION, ge=MIN_SECONDS)",
      "    duration: timedelta",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(protocolPath, "assigner.py"),
    [
      "import os",
      "from datetime import timedelta",
      "",
      "from airalogy.assigner import AssignerResult, assigner",
      "from airalogy.iso import timedelta_to_iso",
      "",
      "@assigner(",
      '    assigned_fields=["duration"],',
      '    dependent_fields=["seconds"],',
      '    mode="auto",',
      ")",
      "def convert_seconds_to_duration(dependent_fields: dict) -> AssignerResult:",
      '    extra_seconds = int(os.environ.get("EXTRA_SECONDS", "0"))',
      '    seconds = dependent_fields["seconds"] + extra_seconds',
      '    print("This is debug log")',
      '    print(f"Converting {seconds} seconds to duration: {timedelta(seconds=seconds)}")',
      "    return AssignerResult(",
      "        assigned_fields={",
      '            "duration": timedelta_to_iso(timedelta(seconds=seconds)),',
      "        },",
      "    )",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeFileBridgeProtocol(protocolPath: string): void {
  writeProtocolToml(protocolPath, "file_bridge_protocol", "File Bridge Protocol");

  fs.writeFileSync(
    path.join(protocolPath, "protocol.aimd"),
    [
      "## File Bridge Protocol AIMD example",
      "",
      "输入文件：{{var|input_file}}",
      "字节数：{{var|bytes_len}}",
      "输出文件：{{var|generated_file}}",
      "",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(protocolPath, "model.py"),
    [
      "from pydantic import BaseModel",
      "",
      "class VarModel(BaseModel):",
      "    input_file: str",
      "    bytes_len: int | None = None",
      "    generated_file: str | None = None",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(protocolPath, "assigner.py"),
    [
      "import json",
      "import os",
      "import pathlib",
      "import uuid",
      "",
      "from airalogy.assigner import AssignerResult, assigner",
      "",
      "@assigner(",
      '    assigned_fields=["bytes_len", "generated_file"],',
      '    dependent_fields=["input_file"],',
      '    mode="auto",',
      ")",
      "def read_bridged_file(dependent_fields: dict) -> AssignerResult:",
      '    file_id = dependent_fields["input_file"]',
      '    file_map = json.loads(os.environ["AIRALOGY_LOCAL_FILE_MAP_JSON"])',
      '    data = pathlib.Path(file_map[file_id]["path"]).read_bytes()',
      '    out_dir = pathlib.Path(os.environ["AIRALOGY_LOCAL_FILE_OUTPUT_DIR"])',
      '    out_dir.mkdir(parents=True, exist_ok=True)',
      '    out_id = f"airalogy.id.file.{uuid.uuid4()}"',
      '    metadata = {"id": out_id, "file_name": "summary.txt", "name": "summary.txt", "content_type": "text/plain", "size": len(data)}',
      '    (out_dir / f"{out_id}.bin").write_bytes(data)',
      '    (out_dir / f"{out_id}.json").write_text(json.dumps(metadata), encoding="utf8")',
      '    return AssignerResult(assigned_fields={"bytes_len": len(data), "generated_file": out_id})',
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeWorkflowProject(workflowBody: string, assignerCode = ""): string {
  const workflowRoot = fs.mkdtempSync(path.join(os.tmpdir(), "airalogy-workflow-"));
  fs.writeFileSync(
    path.join(workflowRoot, "workflow.aimd"),
    `# Test Workflow\n\n\`\`\`workflow\n${workflowBody.trim()}\n\`\`\`\n`,
    "utf8",
  );

  if (assignerCode.length > 0) {
    const assignerDir = path.join(workflowRoot, "assigners");
    fs.mkdirSync(assignerDir, { recursive: true });
    fs.writeFileSync(path.join(assignerDir, "workflow_assigners.py"), assignerCode, "utf8");
  }

  return workflowRoot;
}

beforeAll(() => {
  envProtocolPath = fs.mkdtempSync(path.join(os.tmpdir(), "airalogy-env-protocol-"));
  writeEnvProtocol(envProtocolPath);
  fileBridgeProtocolPath = fs.mkdtempSync(path.join(os.tmpdir(), "airalogy-file-bridge-protocol-"));
  writeFileBridgeProtocol(fileBridgeProtocolPath);
});

afterAll(() => {
  fs.rmSync(envProtocolPath, { recursive: true, force: true });
  fs.rmSync(fileBridgeProtocolPath, { recursive: true, force: true });
});

describe("parseProtocol", () => {
  itSandbox("returns expected schema, metadata, and fields", async () => {
    const result = await parseProtocol(EXAMPLE_PROTOCOL, sandboxKwargs());

    expect(result.success).toBe(true);
    const data = result.data!;

    const metaData = data.meta_data as Record<string, unknown>;
    expect(metaData.id).toBe("alice_s_protocol");
    expect(metaData.name).toBe("Alice's Protocol");
    expect(metaData.version).toBe("0.0.1");

    const fields = data.fields as Record<string, unknown[]>;
    const varNames = new Set((fields.var as Array<{ name: string }>).map((v) => v.name));
    expect(varNames).toContain("seconds");
    expect(varNames).toContain("duration");
    expect(varNames).toContain("user_name");
    expect(varNames).toContain("current_time");
    expect(varNames).toContain("endpoint");

    const jsonSchema = data.json_schema as Record<string, Record<string, unknown>>;
    expect(jsonSchema.vars).toBeDefined();
    const schemaProps = (jsonSchema.vars.properties ?? {}) as Record<string, unknown>;
    expect(schemaProps.seconds).toBeDefined();
    expect(schemaProps.duration).toBeDefined();
    expect(schemaProps.endpoint).toBeDefined();

    const assigners = data.assigners as Record<string, Record<string, unknown>>;
    expect(assigners.duration).toBeDefined();
    expect(assigners.endpoint).toBeDefined();
    expect((assigners.duration as { dependent_fields: string[] }).dependent_fields).toContain(
      "seconds",
    );
    expect((assigners.endpoint as { dependent_fields: string[] }).dependent_fields).toContain(
      "seconds",
    );

    const assignerGraph = data.assigner_graph as Record<string, unknown>;
    expect(typeof assignerGraph).toBe("object");
    expect(Object.keys(assignerGraph).length).toBeGreaterThan(0);

    expect(data.aimd as string).toContain("{{var|seconds}}");
    expect(data.aimd as string).toContain("{{var|duration}}");
    expect(data.aimd as string).toContain("{{var|endpoint}}");
  }, 120_000);

  itSandbox("uses env vars inside the sandbox during parse", async () => {
    const result = await parseProtocol(
      envProtocolPath,
      { SECONDS_DESCRIPTION: "seconds from env" },
      sandboxKwargs(),
    );

    expect(result.success).toBe(true);
    const jsonSchema = result.data?.json_schema as Record<string, Record<string, unknown>>;
    const varsSchema = jsonSchema.vars as Record<string, unknown>;
    const properties = varsSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.seconds?.description).toBe("seconds from env");
  }, 120_000);

  it("throws for non-existent directory", async () => {
    await expect(parseProtocol("/tmp/nonexistent_protocol_dir_12345")).rejects.toThrow(
      "must be a directory",
    );
  });

  it("throws when protocol.aimd is missing", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "empty_protocol_"));
    try {
      await expect(parseProtocol(tmpDir)).rejects.toThrow("protocol.aimd not found");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("throws for an invalid rootfs directory", async () => {
    await expect(
      parseProtocol(EXAMPLE_PROTOCOL, { rootfsPath: "/tmp/nonexistent_rootfs_dir_12345" }),
    ).rejects.toThrow("rootfs_path must be an OCI layout directory");
  });
});

describe("workflow parsing", () => {
  it("normalizes single-target assign syntax", () => {
    const workflow = parseWorkflowContent(`
version: airalogy.workflow.v1
id: copy_workflow
nodes:
  - id: measurement
    protocol: ./measurement/protocol.aimd
  - id: analysis
    protocol: ./analysis/protocol.aimd
transitions:
  - id: copy_measurement
    from: measurement
    to: analysis
    assign:
      var.raw_data: \${measurement.var.raw_data}
`);

    expect(workflow.transitions[0]?.assign).toEqual({
      analysis: {
        "var.raw_data": "${measurement.var.raw_data}",
      },
    });
  });
});

describe("runWorkflowTransition", () => {
  it("copies source Record fields into target Record drafts without an assigner", async () => {
    const workflowRoot = writeWorkflowProject(`
version: airalogy.workflow.v1
id: copy_workflow
nodes:
  - id: measurement
    protocol: ./measurement/protocol.aimd
  - id: analysis
    protocol: ./analysis/protocol.aimd
transitions:
  - id: copy_measurement
    from: measurement
    to: analysis
    assign:
      analysis:
        var.raw_data: \${measurement.var.raw_data}
        check.pass_qc.checked: true
        check.pass_qc.annotation: \${measurement.var.note}
`);

    try {
      const result = await runWorkflowTransition(
        workflowRoot,
        "copy_measurement",
        {
          measurement: {
            record_id: "measurement-record-001",
            version: 2,
            data: {
              var: {
                raw_data: [1, 2, 3],
                note: "ready",
              },
            },
          },
        },
      );

      expect(result.success).toBe(true);
      const records = result.data?.records as Record<string, Record<string, unknown>>;
      const analysis = records.analysis as Record<string, Record<string, unknown>>;
      const data = analysis.data as Record<string, Record<string, unknown>>;
      expect(data.var.raw_data).toEqual([1, 2, 3]);
      expect((data.check.pass_qc as Record<string, unknown>).checked).toBe(true);
      expect((data.check.pass_qc as Record<string, unknown>).annotation).toBe("ready");
      expect(result.data?.node_iterations).toEqual({ analysis: 1 });
      const workflowData = result.data?.workflow_data as Record<string, unknown>;
      const pathData = workflowData.path_data as Record<string, unknown>;
      const pathSteps = pathData.steps as Array<Record<string, unknown>>;
      expect(pathData.path_status).toBe("waiting_for_record");
      expect(pathSteps.map((step) => step.step)).toEqual([
        "record_protocol",
        "add_next_protocol",
        "add_initial_values_for_fields_in_next_protocol",
      ]);
      expect(pathSteps.map((step) => step.path_index)).toEqual([1, 2, 2]);
      expect((pathSteps[0]?.data as Record<string, unknown>).node_id).toBe("measurement");
      expect((pathSteps[0]?.data as Record<string, unknown>).record_id).toBe("measurement-record-001");
      expect((pathSteps[0]?.data as Record<string, unknown>).record_version).toBe(2);
      expect((pathSteps[1]?.data as Record<string, unknown>).node_id).toBe("analysis");
      expect((pathSteps[2]?.data as Record<string, unknown>).values).toEqual({
        "var.raw_data": [1, 2, 3],
        "check.pass_qc.checked": true,
        "check.pass_qc.annotation": "ready",
      });
    } finally {
      fs.rmSync(workflowRoot, { recursive: true, force: true });
    }
  });

  it("skips a transition when its condition is false", async () => {
    const workflowRoot = writeWorkflowProject(`
version: airalogy.workflow.v1
id: branch_workflow
nodes:
  - id: analysis
    protocol: ./analysis/protocol.aimd
  - id: report
    protocol: ./report/protocol.aimd
transitions:
  - id: analysis_to_report
    from: analysis
    to: report
    when: \${analysis.check.pass_qc.checked} == true
    assign:
      report:
        var.summary: \${analysis.var.summary}
`);

    try {
      const result = await runWorkflowTransition(
        workflowRoot,
        "analysis_to_report",
        {
          analysis: {
            data: {
              check: {
                pass_qc: {
                  checked: false,
                },
              },
              var: {
                summary: "needs retry",
              },
            },
          },
        },
      );

      expect(result.success).toBe(true);
      const records = result.data?.records as Record<string, unknown> | undefined;
      expect(records?.report).toBeUndefined();
      expect(result.data?.skipped_transitions).toEqual([{ id: "analysis_to_report", reason: "when_false" }]);
      expect(result.data?.executed_transitions).toEqual([]);
    } finally {
      fs.rmSync(workflowRoot, { recursive: true, force: true });
    }
  });
});

describe("runWorkflow local assigner runtime", () => {
  it("runs the packaged protocol workflow example without a sandbox", async () => {
    const records = JSON.parse(
      fs.readFileSync(path.join(EXAMPLE_WORKFLOW, "records.initial.json"), "utf8"),
    ) as Record<string, unknown>;
    const result = await runWorkflow(
      EXAMPLE_WORKFLOW,
      records,
      { assignerRuntime: "local" },
    );

    expect(result.success).toBe(true);
    const recordsOut = result.data?.records as Record<string, Record<string, unknown>>;
    const measurement = recordsOut.measurement as Record<string, Record<string, unknown>>;
    const analysis = recordsOut.analysis as Record<string, Record<string, unknown>>;
    const prep = recordsOut.prep as Record<string, Record<string, unknown>>;
    const measurementData = measurement.data as Record<string, Record<string, unknown>>;
    const analysisData = analysis.data as Record<string, Record<string, unknown>>;
    const prepData = prep.data as Record<string, Record<string, unknown>>;

    expect(measurementData.var.sample_id).toBe("SAMPLE-001");
    expect(analysisData.var.raw_data_summary).toBe("3 points captured by uv-vis-alpha.");
    expect(analysisData.var.measurement_quality).toBe("review");
    expect(prepData.var.target_temperature_c).toBe(24);
    expect(prepData.var.target_concentration_m).toBe(0.05);
    expect(prepData.var.retry_note).toBe("QC failed for: baseline_noise, peak_width");
    const executedTransitions = result.data?.executed_transitions as Array<Record<string, unknown>>;
    expect(executedTransitions.map((transition) => transition.id)).toEqual([
      "pass_sample_to_measurement",
      "summarize_measurement_for_analysis",
      "retry_after_qc_failure",
    ]);
    expect(executedTransitions[0]).toMatchObject({
      from: ["prep"],
      to: ["measurement"],
    });
    expect(executedTransitions[1]).toMatchObject({
      from: ["measurement"],
      to: ["analysis"],
      run: "summarize_measurement",
    });
    expect(executedTransitions[2]).toMatchObject({
      from: ["analysis"],
      to: ["prep"],
      run: "optimize_parameters",
    });
    expect(result.data?.skipped_transitions).toEqual([
      { id: "finish_when_qc_passes", reason: "when_false" },
    ]);
    const workflowData = result.data?.workflow_data as Record<string, unknown>;
    const pathData = workflowData.path_data as Record<string, unknown>;
    const pathSteps = pathData.steps as Array<Record<string, unknown>>;
    expect(pathData.path_status).toBe("waiting_for_record");
    expect(pathSteps.map((step) => step.path_index)).toEqual([1, 2, 3, 4, 4, 5, 5, 6, 6]);
    expect((workflowData.protocols_info as unknown[]).length).toBe(4);
    expect(pathSteps.filter((step) => step.step === "record_protocol")
      .map((step) => (step.data as Record<string, unknown>).node_id)).toEqual([
      "prep",
      "measurement",
      "analysis",
    ]);
    expect(pathSteps.filter((step) => step.step === "add_next_protocol")
      .map((step) => (step.data as Record<string, unknown>).node_id)).toEqual([
      "measurement",
      "analysis",
      "prep",
    ]);
    const prepInitialValues = pathSteps.find((step) =>
      step.step === "add_initial_values_for_fields_in_next_protocol" &&
      (step.data as Record<string, unknown>).node_id === "prep")?.data as Record<string, unknown>;
    expect(prepInitialValues.values).toEqual({
      "var.target_temperature_c": 24,
      "var.target_concentration_m": 0.05,
      "var.retry_note": "QC failed for: baseline_noise, peak_width",
    });
  });
});

describeSandbox("runWorkflow", () => {
  it("runs a sandboxed workflow assigner and assigns outputs by transition id", async () => {
    const workflowRoot = writeWorkflowProject(
      `
version: airalogy.workflow.v1
id: analysis_workflow
nodes:
  - id: measurement
    protocol: ./measurement/protocol.aimd
  - id: literature_review
    protocol: ./literature-review/protocol.aimd
  - id: analysis
    protocol: ./analysis/protocol.aimd
assigners:
  - id: build_analysis_inputs
    runtime: python
    entrypoint: ./assigners/workflow_assigners.py:build_analysis_inputs
    outputs:
      raw_data_summary: str
      background_summary: str
transitions:
  - id: prepare_analysis_inputs
    from:
      - measurement
      - literature_review
    to:
      - analysis
    run: build_analysis_inputs
    inputs:
      raw_data: \${measurement.var.raw_data}
      background_summary: \${literature_review.var.summary}
    assign:
      analysis:
        var.raw_data_summary: \${prepare_analysis_inputs.outputs.raw_data_summary}
        var.background_summary: \${prepare_analysis_inputs.outputs.background_summary}
`,
      [
        "def build_analysis_inputs(raw_data, background_summary):",
        "    return {",
        "        'raw_data_summary': f'n={len(raw_data)}',",
        "        'background_summary': background_summary.upper(),",
        "    }",
        "",
      ].join("\n"),
    );

    try {
      const result = await runWorkflow(
        workflowRoot,
        {
          measurement: {
            data: {
              var: {
                raw_data: [10, 20, 30],
              },
            },
          },
          literature_review: {
            data: {
              var: {
                summary: "prior context",
              },
            },
          },
        },
        sandboxKwargs(),
      );

      expect(result.success).toBe(true);
      const records = result.data?.records as Record<string, Record<string, unknown>>;
      const analysis = records.analysis as Record<string, Record<string, unknown>>;
      const data = analysis.data as Record<string, Record<string, unknown>>;
      expect(data.var.raw_data_summary).toBe("n=3");
      expect(data.var.background_summary).toBe("PRIOR CONTEXT");
      expect(result.data?.transition_outputs).toEqual({
        prepare_analysis_inputs: {
          raw_data_summary: "n=3",
          background_summary: "PRIOR CONTEXT",
        },
      });
      expect(result.data?.executed_transitions).toEqual([{
        id: "prepare_analysis_inputs",
        from: ["measurement", "literature_review"],
        to: ["analysis"],
        run: "build_analysis_inputs",
      }]);
    } finally {
      fs.rmSync(workflowRoot, { recursive: true, force: true });
    }
  }, 120_000);
});

describeSandbox("assignVariable", () => {
  it("converts seconds to duration via assigner", async () => {
    const result = await assignVariable(
      EXAMPLE_PROTOCOL,
      "duration",
      { seconds: 3600 },
      sandboxKwargs(),
    );

    expect(result.success).toBe(true);
    const data = result.data!;
    const assignedFields = data.assigned_fields as Record<string, unknown>;
    expect(assignedFields).toBeDefined();
    expect(assignedFields.duration).toBe("PT1H");
  }, 120_000);

  it("uses env vars inside the sandbox during assignment", async () => {
    const result = await assignVariable(
      EXAMPLE_PROTOCOL,
      "endpoint",
      { seconds: 60 },
      { ENDPOINT },
      sandboxKwargs(),
    );

    expect(result.success).toBe(true);
    const data = result.data!;
    const assignedFields = data.assigned_fields as Record<string, unknown>;
    expect(assignedFields.duration).toBe("PT1M");
    expect(assignedFields.endpoint).toBe(ENDPOINT);
  }, 120_000);

  it("returns a timeout result when execution exceeds the configured timeout", async () => {
    const started = Date.now();
    const result = await assignVariable(
      EXAMPLE_PROTOCOL,
      "duration",
      { seconds: 60 },
      { PROTOCOL_SLEEP_TIME: "2" },
      { ...sandboxKwargs(), timeout: 1 },
    );
    const elapsedMs = Date.now() - started;

    expect(result).toEqual({
      success: false,
      message: "Execution timed out after 1 seconds",
      output: "",
    });
    expect(elapsedMs).toBeLessThan(6_000);
  }, 120_000);

  it("allows the slow protocol to finish when timeout is long enough", async () => {
    const result = await assignVariable(
      EXAMPLE_PROTOCOL,
      "duration",
      { seconds: 60 },
      { PROTOCOL_SLEEP_TIME: "2" },
      { ...sandboxKwargs(), timeout: 5 },
    );

    expect(result.success).toBe(true);
    const assignedFields = result.data?.assigned_fields as Record<string, unknown>;
    expect(assignedFields.duration).toBe("PT1M");
  }, 120_000);

  it("bridges local input and output files into sandboxed assigners", async () => {
    const fileId = "airalogy.id.file.22222222-2222-2222-2222-222222222222";
    const inputFile = path.join(os.tmpdir(), `airalogy-bridge-input-${Date.now()}.csv`);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "airalogy-bridge-output-"));
    const inputContent = "x,y\n1,2\n";

    try {
      fs.writeFileSync(inputFile, inputContent, "utf8");
      const result = await assignVariable(
        fileBridgeProtocolPath,
        "bytes_len",
        { input_file: fileId },
        {
          ...sandboxKwargs(),
          fileBridge: {
            inputs: [{
              id: fileId,
              path: inputFile,
              fileName: "input.csv",
              contentType: "text/csv",
            }],
            outputDir,
          },
        },
      );

      expect(result.success).toBe(true);
      const assignedFields = result.data?.assigned_fields as Record<string, unknown>;
      expect(assignedFields.bytes_len).toBe(Buffer.byteLength(inputContent));
      expect(typeof assignedFields.generated_file).toBe("string");
      expect(result.files?.[0]?.id).toBe(assignedFields.generated_file);
      expect(fs.readFileSync(path.join(outputDir, `${assignedFields.generated_file}.bin`), "utf8")).toBe(
        inputContent,
      );
    } finally {
      fs.rmSync(inputFile, { force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  }, 120_000);

  it("copies partial debug logs after killing a timed-out guest process", async () => {
    const logFile = path.join(os.tmpdir(), `airalogy-slow-debug-${Date.now()}.log`);

    try {
      const started = Date.now();
      const result = await assignVariable(
        EXAMPLE_PROTOCOL,
        "duration",
        { seconds: 60 },
        { PROTOCOL_SLEEP_TIME: "2" },
        { ...sandboxKwargs(), timeout: 1, debug: true, logFile },
      );
      const elapsedMs = Date.now() - started;

      expect(result).toEqual({
        success: false,
        message: "Execution timed out after 1 seconds",
        output: "",
      });
      expect(elapsedMs).toBeLessThan(6_000);
      expect(fs.existsSync(logFile)).toBe(true);
      const logContent = fs.readFileSync(logFile, "utf8");
      expect(logContent).toContain("action: assign_variable");
    } finally {
      fs.rmSync(logFile, { force: true });
    }
  }, 120_000);
});

describeSandbox("validateVariables", () => {
  it("accepts correct variable values", async () => {
    const result = await validateVariables(
      EXAMPLE_PROTOCOL,
      VALID_VARIABLES,
      sandboxKwargs(),
    );

    expect(result.success).toBe(true);
    const data = result.data!;
    expect(data.data).toBeDefined();
    expect(data.errors).toBeUndefined();
  }, 120_000);

  it("reports errors for invalid values and missing required fields", async () => {
    const result = await validateVariables(
      EXAMPLE_PROTOCOL,
      {
        seconds: "not_a_number",
        duration: "PT1M",
        user_name: "alice",
        current_time: "2025-01-01T00:00:00",
      },
      sandboxKwargs(),
    );

    expect(result.success).toBe(true);
    const errors = result.data?.errors as Array<{ loc?: string[] }>;
    expect(errors.some((error) => error.loc?.[0] === "seconds")).toBe(true);
    expect(errors.some((error) => error.loc?.[0] === "endpoint")).toBe(true);
  }, 120_000);

  it("uses env vars inside the sandbox during validation", async () => {
    const validResult = await validateVariables(
      envProtocolPath,
      { seconds: "61", duration: "PT1M1S" },
      { MIN_SECONDS: "61" },
      sandboxKwargs(),
    );

    expect(validResult.success).toBe(true);
    expect(validResult.data?.errors).toBeUndefined();

    const invalidResult = await validateVariables(
      envProtocolPath,
      { seconds: "60", duration: "PT1M" },
      { MIN_SECONDS: "61" },
      sandboxKwargs(),
    );

    expect(invalidResult.success).toBe(true);
    const invalidErrors = invalidResult.data?.errors as unknown[] | undefined;
    expect(invalidErrors?.length ?? 0).toBeGreaterThan(0);
  }, 120_000);
});

describeSandbox("debugMode", () => {
  it("creates and appends debug logs for parseProtocol", async () => {
    const logFile = path.join(os.tmpdir(), `airalogy-parse-debug-${Date.now()}.log`);
    try {
      const firstResult = await parseProtocol(EXAMPLE_PROTOCOL, {
        ...sandboxKwargs(),
        debug: true,
        logFile,
      });

      expect(firstResult.success).toBe(true);
      expect(fs.existsSync(logFile)).toBe(true);
      const firstContent = fs.readFileSync(logFile, "utf8");
      expect(firstContent).toContain("action: parse_protocol");
      const firstSize = fs.statSync(logFile).size;
      expect(firstSize).toBeGreaterThan(0);

      const secondResult = await parseProtocol(EXAMPLE_PROTOCOL, {
        ...sandboxKwargs(),
        debug: true,
        logFile,
      });

      expect(secondResult.success).toBe(true);
      expect(fs.statSync(logFile).size).toBeGreaterThan(firstSize);
    } finally {
      fs.rmSync(logFile, { force: true });
    }
  }, 120_000);

  it("creates debug logs for assignVariable and validateVariables", async () => {
    const assignLog = path.join(os.tmpdir(), `airalogy-assign-debug-${Date.now()}.log`);
    const validateLog = path.join(os.tmpdir(), `airalogy-validate-debug-${Date.now()}.log`);

    try {
      const assignResult = await assignVariable(
        EXAMPLE_PROTOCOL,
        "duration",
        { seconds: 60 },
        {
          ...sandboxKwargs(),
          debug: true,
          logFile: assignLog,
        },
      );

      expect(assignResult.success).toBe(true);
      expect(fs.existsSync(assignLog)).toBe(true);
      const assignContent = fs.readFileSync(assignLog, "utf8");
      expect(assignContent).toContain("action: assign_variable");
      for (const line of ASSIGN_DEBUG_LINES) {
        expect(assignContent).toContain(line);
      }

      const validateResult = await validateVariables(
        EXAMPLE_PROTOCOL,
        VALID_VARIABLES,
        {
          ...sandboxKwargs(),
          debug: true,
          logFile: validateLog,
        },
      );

      expect(validateResult.success).toBe(true);
      expect(fs.existsSync(validateLog)).toBe(true);
      const validateContent = fs.readFileSync(validateLog, "utf8");
      expect(validateContent).toContain("action: validate_variables");
      expect(validateContent).toContain("output:");
    } finally {
      fs.rmSync(assignLog, { force: true });
      fs.rmSync(validateLog, { force: true });
    }
  }, 120_000);

  it("does not create a log file when debug is false", async () => {
    const logFile = path.join(os.tmpdir(), `airalogy-no-debug-${Date.now()}.log`);
    try {
      const result = await parseProtocol(EXAMPLE_PROTOCOL, {
        ...sandboxKwargs(),
        debug: false,
        logFile,
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(logFile)).toBe(false);
    } finally {
      fs.rmSync(logFile, { force: true });
    }
  }, 120_000);
});
