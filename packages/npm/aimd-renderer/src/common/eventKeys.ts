/**
 * Event bus keys for AIMD system
 */
import type { InjectionKey } from "vue"

export const fieldEventKey: InjectionKey<{ name: "field-event" }> = Symbol("symbol-field-event-key")
export const protocolKey: InjectionKey<{ name: "protocol-key" }> = Symbol("symbol-protocol-key")
export const draftEventKey: InjectionKey<{ name: "draft-event" }> = Symbol("draft-event-key")
export const reportEventKey: InjectionKey<{ name: "report-event" }> = Symbol("symbol-report-event-key")
export const bubbleMenuEventKey: InjectionKey<{ name: "bubble-menu-event" }> = Symbol("symbol-bubble-menu-event-key")
