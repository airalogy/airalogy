import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import AimdRequiredMarker from "../components/AimdRequiredMarker.vue"

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
})
