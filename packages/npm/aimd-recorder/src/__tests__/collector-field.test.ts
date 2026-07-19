import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import AimdRecorder from "../components/AimdRecorder.vue"

vi.mock("../components/AimdCodeField.vue", () => ({
  __esModule: true,
  default: {
    name: "AimdCodeField",
    props: ["modelValue", "language", "disabled", "compact"],
    emits: ["update:modelValue", "blur"],
    template: "<textarea />",
  },
}))

function protocol(options: {
  mode?: "snapshot" | "polling" | "stream"
  interval?: string
  manualFallback?: boolean
  type?: string
} = {}): string {
  const mode = options.mode ?? "snapshot"
  const type = options.type ?? (mode === "snapshot" ? "Observation[float] | None" : "list[Observation[float]] | None")
  return `
\`\`\`connectors
sensor_gateway:
  kind: data_source
  descriptor: ./sensor.yaml
\`\`\`

\`\`\`collectors
temperature_sensor:
  connector: sensor_gateway
  channel: room.temperature
  mode: ${mode}
${mode === "polling" ? `  interval: ${options.interval ?? "10ms"}\n` : ""}  manual_fallback: ${options.manualFallback ?? false}
\`\`\`

Temperature: {{var|temperature: ${type}, title="Temperature", unit="Cel", collector="temperature_sensor"}}
`
}

async function settle(wrapper: ReturnType<typeof mount>): Promise<void> {
  await flushPromises()
  await wrapper.vm.$nextTick()
  await vi.dynamicImportSettled()
  await wrapper.vm.$nextTick()
}

function latestRecord(wrapper: ReturnType<typeof mount>) {
  const updates = wrapper.emitted("update:modelValue") ?? []
  return updates[updates.length - 1]?.[0] as { var: Record<string, unknown> } | undefined
}

describe("AimdRecorder Collector fields", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("reads a snapshot through an injected provider and stores a normalized Observation", async () => {
    const read = vi.fn().mockResolvedValue({
      value: 23.4,
      observed_at: "2026-07-19T08:00:00+08:00",
      device_id: "thermometer-01",
      quality: "measured",
    })
    const requestCollectorPermission = vi.fn().mockResolvedValue("record")
    const wrapper = mount(AimdRecorder, {
      props: {
        content: protocol(),
        locale: "en-US",
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        collectorProviders: { sensor_gateway: { read } },
        requestCollectorPermission,
      },
    })
    await settle(wrapper)

    expect(wrapper.find("textarea[data-rec-focus-key='var:temperature']").exists()).toBe(false)
    const button = wrapper.find(".aimd-rec-collector__button--primary")
    expect(button.text()).toBe("Read now")
    await button.trigger("click")
    await settle(wrapper)

    expect(read).toHaveBeenCalledTimes(1)
    expect(requestCollectorPermission).toHaveBeenCalledTimes(1)
    const observation = latestRecord(wrapper)?.var.temperature as Record<string, any>
    expect(observation).toMatchObject({
      value: 23.4,
      observed_at: "2026-07-19T00:00:00.000Z",
      unit: "Cel",
      quality: "measured",
      source: {
        kind: "collector",
        connector: "sensor_gateway",
        collector: "temperature_sensor",
        device_id: "thermometer-01",
      },
    })
    expect(observation.received_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(wrapper.text()).toContain("23.4")
  })

  it("polls without overlapping reads and stops through the field control", async () => {
    vi.useFakeTimers()
    let value = 20
    const read = vi.fn(async () => ({ value: value += 1 }))
    const wrapper = mount(AimdRecorder, {
      props: {
        content: protocol({ mode: "polling", interval: "10ms" }),
        locale: "en-US",
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        collectorProviders: { sensor_gateway: { read } },
      },
    })
    await settle(wrapper)

    await wrapper.find(".aimd-rec-collector__button--primary").trigger("click")
    await flushPromises()
    await vi.advanceTimersByTimeAsync(25)
    await settle(wrapper)

    expect(read.mock.calls.length).toBeGreaterThanOrEqual(3)
    const observations = latestRecord(wrapper)?.var.temperature as Array<Record<string, unknown>>
    expect(observations.length).toBe(read.mock.calls.length)
    expect(observations.map(item => item.value)).toEqual(
      Array.from({ length: observations.length }, (_, index) => 21 + index),
    )

    const stop = wrapper.findAll("button").find(button => button.text() === "Stop")
    expect(stop).toBeTruthy()
    await stop!.trigger("click")
    await flushPromises()
    const callsAfterStop = read.mock.calls.length
    await vi.advanceTimersByTimeAsync(30)
    expect(read).toHaveBeenCalledTimes(callsAfterStop)
  })

  it("records an explicit manual fallback with provenance when no provider is available", async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: protocol({ manualFallback: true }),
        locale: "en-US",
        collectorActorId: "operator-17",
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })
    await settle(wrapper)

    expect(wrapper.text()).toContain("This data source is not available")
    const manual = wrapper.findAll("button").find(button => button.text() === "Enter manually")
    expect(manual).toBeTruthy()
    await manual!.trigger("click")

    await wrapper.find(".aimd-rec-collector__manual-value").setValue("21.75")
    await wrapper.find(".aimd-rec-collector__manual-reason").setValue("Device is being calibrated")
    const save = wrapper.findAll("button").find(button => button.text() === "Save observation")
    await save!.trigger("click")
    await settle(wrapper)

    expect(latestRecord(wrapper)?.var.temperature).toMatchObject({
      value: 21.75,
      unit: "Cel",
      source: {
        kind: "manual",
        collector: "temperature_sensor",
        actor_id: "operator-17",
        reason: "Device is being calibrated",
      },
    })
    expect((latestRecord(wrapper)?.var.temperature as any).source.connector).toBeUndefined()
  })

  it("does not call the provider when authorization is denied", async () => {
    const read = vi.fn().mockResolvedValue(18)
    const wrapper = mount(AimdRecorder, {
      props: {
        content: protocol(),
        locale: "en-US",
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        collectorProviders: { sensor_gateway: { read } },
        requestCollectorPermission: () => false,
      },
    })
    await settle(wrapper)

    await wrapper.find(".aimd-rec-collector__button--primary").trigger("click")
    await settle(wrapper)

    expect(read).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("Collector access was not authorized")
  })

  it("discards a pending authorization when the protocol context changes", async () => {
    let resolvePermission!: (decision: "record") => void
    const permission = new Promise<"record">((resolve) => {
      resolvePermission = resolve
    })
    const read = vi.fn().mockResolvedValue(18)
    const originalContent = protocol()
    const wrapper = mount(AimdRecorder, {
      props: {
        content: originalContent,
        locale: "en-US",
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        collectorProviders: { sensor_gateway: { read } },
        requestCollectorPermission: () => permission,
      },
    })
    await settle(wrapper)

    await wrapper.find(".aimd-rec-collector__button--primary").trigger("click")
    await flushPromises()
    expect(wrapper.text()).toContain("Waiting for permission")

    await wrapper.setProps({ content: `${originalContent}\nChanged.` })
    resolvePermission("record")
    await settle(wrapper)

    expect(read).not.toHaveBeenCalled()
  })

  it("does not write a snapshot that resolves after the user stops it", async () => {
    let resolveRead!: (value: number) => void
    const readResult = new Promise<number>((resolve) => {
      resolveRead = resolve
    })
    const wrapper = mount(AimdRecorder, {
      props: {
        content: protocol(),
        locale: "en-US",
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        collectorProviders: { sensor_gateway: { read: () => readResult } },
      },
    })
    await settle(wrapper)

    await wrapper.find(".aimd-rec-collector__button--primary").trigger("click")
    await flushPromises()
    const stop = wrapper.findAll("button").find(button => button.text() === "Stop")
    expect(stop).toBeTruthy()
    await stop!.trigger("click")
    resolveRead(99)
    await settle(wrapper)

    expect(latestRecord(wrapper)?.var.temperature).not.toMatchObject({ value: 99 })
    expect(wrapper.text()).toContain("Completed")
  })

  it("uses metadata-only protocol context for WYSIWYG single-field hosts", async () => {
    const full = protocol()
    const context = (full.match(/```(?:connectors|collectors)[\s\S]*?```/g) ?? []).join("\n\n")
    const field = 'Temperature: {{var|temperature: Observation[float] | None, unit="Cel", collector="temperature_sensor"}}'
    const wrapper = mount(AimdRecorder, {
      props: {
        content: field,
        protocolContext: context,
        locale: "en-US",
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        collectorProviders: { sensor_gateway: { read: () => 17.5 } },
      },
    })
    await settle(wrapper)

    expect(wrapper.find(".aimd-rec-collector").exists()).toBe(true)
    await wrapper.find(".aimd-rec-collector__button--primary").trigger("click")
    await settle(wrapper)
    expect(latestRecord(wrapper)?.var.temperature).toMatchObject({ value: 17.5 })
  })
})
