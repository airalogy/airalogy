import { mount } from "@vue/test-utils"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import AimdRequiredMarker from "../components/AimdRequiredMarker.vue"

const __dirname = dirname(fileURLToPath(import.meta.url))
const recorderStyles = readFileSync(resolve(__dirname, "../styles/recorder.css"), "utf8")

describe("AimdRequiredMarker", () => {
  it("renders a visible and accessible required indicator", () => {
    const wrapper = mount(AimdRequiredMarker, {
      props: { label: "Required" },
    })

    const marker = wrapper.get("[data-aimd-required-marker='true']")
    expect(marker.text()).toBe("*")
    expect(marker.attributes("role")).toBe("img")
    expect(marker.attributes("aria-label")).toBe("Required")
    expect(marker.attributes("title")).toBe("Required")
  })

  it("reserves space on both sides so host containers do not clip the indicator", () => {
    expect(recorderStyles).toMatch(/\.aimd-field__required-marker \{[\s\S]*?margin-inline-start: 0\.3rem;[\s\S]*?margin-inline-end: 0\.35rem;/)
  })

  it("keeps the indicator in an inline title row when metadata uses a stacked label", () => {
    expect(recorderStyles).toMatch(/\.aimd-field__title-row \{[\s\S]*?display: inline-flex;[\s\S]*?align-items: baseline;/)
  })
})
