import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import { flushPromises, mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import AimdRecorder from "../components/AimdRecorder.vue"
import { createAimdRecorderMessages } from "../locales"
import { getAimdRequiredFieldKeys, validateAimdField, validateAimdRecord } from "../record/validation"
import { createEmptyProtocolRecordData } from "../types"

const EMPTY_FIELDS: ExtractedAimdFields = {
  var: [],
  var_definitions: [],
  var_table: [],
  client_assigner: [],
  quiz: [],
  step: [],
  check: [],
  ref_step: [],
  ref_var: [],
}

const messages = createAimdRecorderMessages("en-US").validation

describe("AimdRecorder validation", () => {
  it("resolves required UI selectors from the same schema and AIMD rules used for validation", () => {
    const fields: ExtractedAimdFields = {
      ...EMPTY_FIELDS,
      var: ["schema_name", "aimd_name", "optional_name"],
      var_definitions: [
        { id: "schema_name", type: "str", default: "" },
        { id: "aimd_name", type: "str" },
        { id: "optional_name", type: "str", default: "" },
      ],
      var_table: [{
        id: "samples",
        scope: "var_table",
        subvars: [
          { id: "sample_id", type: "str" },
          { id: "note", type: "str", default: "" },
        ],
      }],
    }

    const required = getAimdRequiredFieldKeys(fields, {
      schema: {
        vars: {
          type: "object",
          required: ["schema_name", "samples"],
          properties: {
            schema_name: { type: "string" },
            samples: {
              type: "array",
              items: {
                type: "object",
                required: ["sample_id"],
                properties: {
                  sample_id: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
      },
    })

    expect([...required]).toEqual([
      "var:schema_name",
      "var:aimd_name",
      "var_table:samples",
      "var_table:samples:sample_id",
    ])
  })

  it("marks schema-required fields and table columns before validation errors are shown", async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: [
          'Required: {{var|required_name: str = "", title = "Required name"}}',
          'Optional: {{var|optional_name: str | None = "", title = "Optional name"}}',
          "{{var_table|samples, subvars=[sample_id: str, note: str | None]}}",
        ].join("\n\n"),
        validationSchema: {
          vars: {
            type: "object",
            required: ["required_name", "samples"],
            properties: {
              required_name: { type: "string" },
              optional_name: { type: ["string", "null"] },
              samples: {
                type: "array",
                items: {
                  type: "object",
                  required: ["sample_id"],
                  properties: {
                    sample_id: { type: "string" },
                    note: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
        },
        showSearch: false,
      },
    })
    await flushPromises()

    const markers = wrapper.findAll(".aimd-field__required-marker")
    expect(markers).toHaveLength(3)
    expect(markers.every(marker => marker.attributes("aria-label") === "Required")).toBe(true)
    expect(wrapper.text()).toContain("Required name")
    expect(wrapper.text()).toContain("sample_id")
  })

  it("accepts the unfilled option for nullable built-in enum fields", async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: "性别：{{var|sex: ChineseGender | None}}",
        showSearch: false,
      },
    })
    await flushPromises()

    expect(wrapper.find(".aimd-field__required-marker").exists()).toBe(false)
    expect(wrapper.get<HTMLSelectElement>('select[data-rec-focus-key="var:sex"]').element.value).toBe("")

    const recorder = wrapper.vm as unknown as {
      validate: (options?: { focus?: boolean }) => Promise<{ valid: boolean }>
    }
    expect((await recorder.validate({ focus: false })).valid).toBe(true)
    expect(wrapper.find(".aimd-rec-validation-message").exists()).toBe(false)
    wrapper.unmount()
  })

  it("treats nullable AIMD fields and table columns as optional unless explicitly required", () => {
    const fields: ExtractedAimdFields = {
      ...EMPTY_FIELDS,
      var: ["sex", "count", "forced"],
      var_definitions: [
        { id: "sex", type: "ChineseGender | None" },
        { id: "count", type: "Optional[int]" },
        { id: "forced", type: "str | None", kwargs: { required: true } },
      ],
      var_table: [
        {
          id: "optional_rows",
          scope: "var_table",
          type_annotation: "list[OptionalRow] | None",
          subvars: [{ id: "value", type: "str" }],
        },
        {
          id: "samples",
          scope: "var_table",
          default: [],
          subvars: [
            { id: "note", type: "str | None" },
            { id: "code", type: "str | None", kwargs: { required: true } },
          ],
        },
      ],
    }
    const record = createEmptyProtocolRecordData()
    record.var.sex = null
    record.var.count = null
    record.var.forced = null
    record.var.optional_rows = null
    record.var.samples = [{ note: null, code: null }]

    expect([...getAimdRequiredFieldKeys(fields)]).toEqual([
      "var:forced",
      "var_table:optional_rows:value",
      "var_table:samples:code",
    ])

    const result = validateAimdRecord(fields, record, { messages })
    expect(result.issues.map(issue => [issue.fieldKey, issue.code])).toEqual([
      ["var:forced", "required"],
      ["var_table:samples:0:code", "required"],
    ])
  })

  it("accepts null for schema-required nullable fields and table columns", () => {
    const fields: ExtractedAimdFields = {
      ...EMPTY_FIELDS,
      var: ["sex"],
      var_definitions: [{ id: "sex", type: "ChineseGender | None" }],
      var_table: [{
        id: "samples",
        scope: "var_table",
        type_annotation: "list[Sample] | None",
        subvars: [{ id: "note", type: "str | None" }],
      }],
    }
    const schema = {
      vars: {
        type: "object",
        required: ["sex", "samples"],
        properties: {
          sex: {
            anyOf: [
              { enum: ["male", "female"] },
              { type: "null" },
            ],
          },
          samples: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  required: ["note"],
                  properties: { note: { type: ["string", "null"] } },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
    }
    const record = createEmptyProtocolRecordData()
    record.var.sex = null
    record.var.samples = null

    expect([...getAimdRequiredFieldKeys(fields, { schema })]).toEqual([])
    expect(validateAimdRecord(fields, record, { schema, messages })).toEqual({
      valid: true,
      issues: [],
      fieldState: {},
    })

    record.var.samples = [{ note: null }]
    expect(validateAimdRecord(fields, record, { schema, messages }).valid).toBe(true)
  })

  it("validates inferred required, pattern, numeric, and every table cell constraint", () => {
    const record = createEmptyProtocolRecordData()
    record.var.code = "bad"
    record.var.temperature = 12
    record.var.samples = [{ concentration: "", sample_id: "" }]

    const result = validateAimdRecord({
      ...EMPTY_FIELDS,
      var: ["name", "code", "temperature"],
      var_definitions: [
        { id: "name", title: "Name" },
        { id: "code", title: "Code", kwargs: { pattern: "^[A-Z]+$" } },
        { id: "temperature", title: "Temperature", type: "float", kwargs: { lt: 10 } },
      ],
      var_table: [{
        id: "samples",
        scope: "var_table",
        subvars: [
          { id: "concentration", title: "Concentration" },
          { id: "sample_id", title: "Sample ID" },
        ],
      }],
    }, record, {
      fieldMeta: {
        "var_table:samples:concentration": { required: true },
        "var_table:samples:sample_id": { required: true },
      },
      messages,
    })

    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => [issue.fieldKey, issue.code])).toEqual([
      ["var:name", "required"],
      ["var:code", "pattern"],
      ["var:temperature", "numeric"],
      ["var_table:samples:0:concentration", "required"],
      ["var_table:samples:0:sample_id", "required"],
    ])
    expect(result.fieldState["var_table:samples:0:concentration"]?.validationError).toContain("Row 1")
  })

  it("consumes Pydantic JSON Schema as the authoritative validation contract", () => {
    const record = createEmptyProtocolRecordData()
    record.var.name = ""
    record.var.age = "17"
    record.var.started_at = "not-a-date"
    record.var.status = "unknown"
    record.var.samples = [{ concentration: "bad", code: "" }]

    const fields: ExtractedAimdFields = {
      ...EMPTY_FIELDS,
      var: ["name", "age", "started_at", "status"],
      var_definitions: [
        { id: "name", title: "Name", type: "str" },
        { id: "age", title: "Age", type: "int" },
        { id: "started_at", title: "Started at", type: "datetime" },
        { id: "status", title: "Status", type: "str" },
      ],
      var_table: [{
        id: "samples",
        scope: "var_table",
        subvars: [
          { id: "concentration", title: "Concentration", type: "float" },
          { id: "code", title: "Code", type: "str" },
        ],
      }],
    }

    const result = validateAimdRecord(fields, record, {
      schema: {
        vars: {
          type: "object",
          required: ["name", "age", "started_at", "status", "samples"],
          properties: {
            name: { type: "string", minLength: 1 },
            age: { type: "integer", minimum: 18 },
            started_at: { type: "string", format: "date-time" },
            status: { enum: ["draft", "complete"] },
            samples: {
              type: "array",
              items: {
                type: "object",
                required: ["concentration", "code"],
                properties: {
                  concentration: { type: "number", exclusiveMinimum: 0 },
                  code: { type: "string", pattern: "^[A-Z]+$" },
                },
              },
            },
          },
        },
      },
      messages,
    })

    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldKey: "var:name", code: "required" }),
      expect.objectContaining({ fieldKey: "var:age", code: "numeric" }),
      expect.objectContaining({ fieldKey: "var:started_at", code: "format" }),
      expect.objectContaining({ fieldKey: "var:status", code: "enum" }),
      expect.objectContaining({ fieldKey: "var_table:samples:0:concentration", code: "type" }),
      expect.objectContaining({ fieldKey: "var_table:samples:0:code", code: "required" }),
    ]))
  })

  it("resolves required table columns through Pydantic local references", () => {
    const record = createEmptyProtocolRecordData()
    record.var.samples = [{ code: "" }]
    const fields: ExtractedAimdFields = {
      ...EMPTY_FIELDS,
      var_table: [{
        id: "samples",
        scope: "var_table",
        subvars: [{ id: "code", type: "str" }],
      }],
    }

    const result = validateAimdRecord(fields, record, {
      schema: {
        vars: {
          type: "object",
          required: ["samples"],
          properties: {
            samples: { type: "array", items: { $ref: "#/$defs/Sample" } },
          },
          $defs: {
            Sample: {
              type: "object",
              required: ["code"],
              properties: { code: { type: "string" } },
            },
          },
        },
      },
      messages,
    })

    expect(result.issues).toEqual([
      expect.objectContaining({
        fieldKey: "var_table:samples:0:code",
        code: "required",
      }),
    ])
  })

  it("reports an empty schema-required numeric input as required instead of a type error", () => {
    const record = createEmptyProtocolRecordData()
    record.var.count = ""

    const result = validateAimdRecord({
      ...EMPTY_FIELDS,
      var: ["count"],
      var_definitions: [{ id: "count", type: "int" }],
    }, record, {
      schema: {
        vars: {
          type: "object",
          required: ["count"],
          properties: { count: { type: "integer" } },
        },
      },
      messages,
    })

    expect(result.issues).toEqual([
      expect.objectContaining({ fieldKey: "var:count", code: "required" }),
    ])
  })

  it("lets a supplied schema override an AIMD annotation without duplicating Python rules", () => {
    const record = createEmptyProtocolRecordData()
    record.var.age = "custom-model-string"

    const result = validateAimdRecord({
      ...EMPTY_FIELDS,
      var: ["age"],
      var_definitions: [{ id: "age", type: "int", kwargs: { ge: 18 } }],
    }, record, {
      schema: {
        research_variable: {
          type: "object",
          required: ["age"],
          properties: { age: { type: "string" } },
        },
      },
      messages,
    })

    expect(result).toEqual({ valid: true, issues: [], fieldState: {} })
  })

  it("normalizes file wrappers and validates ordinary array and object values with the schema", () => {
    const record = createEmptyProtocolRecordData()
    record.var.attachment = { airalogy_file_id: "airalogy.id.file.report.pdf" }
    record.var.tags = ["alpha", "beta"]
    record.var.settings = { enabled: true }

    const result = validateAimdRecord({
      ...EMPTY_FIELDS,
      var: ["attachment", "tags", "settings"],
      var_definitions: [
        { id: "attachment", type: "FileIdPDF" },
        { id: "tags", type: "list[str]" },
        { id: "settings", type: "dict" },
      ],
    }, record, {
      schema: {
        vars: {
          type: "object",
          required: ["attachment", "tags", "settings"],
          properties: {
            attachment: { type: "string", pattern: "^airalogy\\.id\\.file\\." },
            tags: { type: "array", minItems: 2, items: { type: "string" } },
            settings: {
              type: "object",
              required: ["enabled"],
              properties: { enabled: { type: "boolean" } },
            },
          },
        },
      },
      messages,
    })

    expect(result.valid).toBe(true)
  })

  it("normalizes host upload lists into scalar file ids for Pydantic schemas", () => {
    const record = createEmptyProtocolRecordData()
    record.var.attachment = [{
      id: "temporary-upload-id",
      airalogyId: "airalogy.id.file.report.pdf",
      status: "finished",
    }]

    const result = validateAimdRecord({
      ...EMPTY_FIELDS,
      var: ["attachment"],
      var_definitions: [{ id: "attachment", type: "FileIdPDF" }],
    }, record, {
      schema: {
        research_variable: {
          type: "object",
          required: ["attachment"],
          properties: {
            attachment: {
              type: "string",
              pattern: "^airalogy\\.id\\.file\\.",
            },
          },
        },
      },
      messages,
    })

    expect(result.valid).toBe(true)
  })

  it("can validate and clear one exact table cell without collapsing to the table key", () => {
    const record = createEmptyProtocolRecordData()
    record.var.samples = [{ concentration: "", sample_id: "" }]
    const fields: ExtractedAimdFields = {
      ...EMPTY_FIELDS,
      var_table: [{
        id: "samples",
        scope: "var_table",
        subvars: [{ id: "concentration" }, { id: "sample_id" }],
      }],
    }

    const result = validateAimdField(fields, record, "var_table:samples:0:sample_id", {
      fieldMeta: {
        "var_table:samples:concentration": { required: true },
        "var_table:samples:sample_id": { required: true },
      },
      messages,
    })

    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      fieldKey: "var_table:samples:0:sample_id",
      rowIndex: 0,
      column: "sample_id",
    })
    expect(result.validatedFieldKeys).toEqual(["var_table:samples:0:sample_id"])
  })

  it("validates on change and preserves errors belonging to other fields", async () => {
    const wrapper = mount(AimdRecorder, {
      attachTo: document.body,
      props: {
        content: "First: {{var|first: str}}\n\nSecond: {{var|second: str}}",
        validationSchema: {
          vars: {
            type: "object",
            required: ["first", "second"],
            properties: {
              first: { type: "string" },
              second: { type: "string" },
            },
          },
        },
        showSearch: false,
      },
    })
    await flushPromises()

    const recorder = wrapper.vm as unknown as {
      validate: (options?: { focus?: boolean }) => Promise<{ valid: boolean }>
    }
    expect((await recorder.validate({ focus: false })).valid).toBe(false)
    await flushPromises()
    expect(wrapper.findAll(".aimd-rec-validation-message")).toHaveLength(2)

    await wrapper.get('textarea[data-rec-focus-key="var:first"]').setValue("Alice")
    await flushPromises()

    const errors = wrapper.findAll(".aimd-rec-validation-message")
    expect(errors).toHaveLength(1)
    expect(errors[0].text()).toContain("second is required")
    wrapper.unmount()
  })

  it("supports blur-only and submit-only immediate validation policies", async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: "{{var|name: str}}",
        validationTriggers: ["blur"],
        showSearch: false,
      },
    })
    await flushPromises()

    const input = wrapper.get('textarea[data-rec-focus-key="var:name"]')
    await input.setValue("Alice")
    await input.setValue("")
    await flushPromises()
    expect(wrapper.find(".aimd-rec-validation-message").exists()).toBe(false)

    await input.trigger("blur")
    await flushPromises()
    expect(wrapper.find(".aimd-rec-validation-message").exists()).toBe(true)

    await wrapper.setProps({ validationTriggers: ["submit"] })
    const recorder = wrapper.vm as unknown as {
      clearValidation: () => void
      validate: (options?: { focus?: boolean }) => Promise<{ valid: boolean }>
    }
    recorder.clearValidation()
    await flushPromises()
    await input.setValue("Bob")
    await input.setValue("")
    await input.trigger("blur")
    await flushPromises()
    expect(wrapper.find(".aimd-rec-validation-message").exists()).toBe(false)
    expect((await recorder.validate({ focus: false })).valid).toBe(false)
    wrapper.unmount()
  })

  it("renders and focuses the exact invalid table cell", async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn()
    const wrapper = mount(AimdRecorder, {
      attachTo: document.body,
      props: {
        content: "{{var_table|samples, subvars=[concentration: float, sample_id: str]}}",
        fieldMeta: {
          "var_table:samples:concentration": { required: true },
          "var_table:samples:sample_id": { required: true },
        },
        showSearch: false,
      },
    })
    await flushPromises()

    const recorder = wrapper.vm as unknown as {
      validate: (options?: { focus?: boolean }) => Promise<{ valid: boolean }>
    }
    expect((await recorder.validate()).valid).toBe(false)
    await flushPromises()

    expect(wrapper.find('[data-aimd-validation-field="var_table:samples:0:concentration"] .aimd-rec-validation-message').exists()).toBe(true)
    expect(document.activeElement?.getAttribute("data-rec-focus-key")).toBe("var_table:samples:0:concentration")
    wrapper.unmount()
  })
})
