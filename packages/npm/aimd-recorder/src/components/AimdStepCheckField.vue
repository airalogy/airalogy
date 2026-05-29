<script lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, nextTick, onBeforeUnmount, ref, watch, type PropType, type VNodeChild } from "vue"
import type { AimdStepNode, AimdCheckNode, AimdStepTimerMode } from "@airalogy/aimd-core/types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderScopeLabel } from "../locales"
import type { AimdCheckRecordItem, AimdStepDetailDisplay, AimdStepRecordItem } from "../types"
import {
  formatStepDuration,
  getStepElapsedMs,
  getStepRemainingMs,
  hasRecordedStepDuration,
  isStepTimerWarning,
  isStepTimerRunning,
  resolveStepTimerMode,
} from "../composables/useStepTimers"

const AimdMarkdownNoteField = defineAsyncComponent(() => import("./AimdMarkdownNoteField.vue"))

export const AimdStepField = defineComponent({
  name: "AimdStepField",
  props: {
    node: { type: Object as PropType<AimdStepNode>, required: true },
    state: { type: Object as PropType<AimdStepRecordItem>, required: true },
    bodyNodes: { type: Array as PropType<VNodeChild[]>, default: () => [] },
    disabled: { type: Boolean, default: false },
    extraClasses: { type: Array as PropType<string[]>, default: () => [] },
    detailDisplay: { type: String as PropType<AimdStepDetailDisplay>, default: "auto" },
    locale: { type: String, required: true },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
  },
  emits: ["check-change", "annotation-change", "timer-start", "timer-pause", "timer-reset", "blur"],
  setup(props, { emit }) {
    const nowMs = ref(Date.now())
    const rootEl = ref<HTMLElement | null>(null)
    const annotationDetailsEl = ref<HTMLElement | null>(null)
    const annotationExpanded = ref(false)
    const timerExpanded = ref(false)
    let liveTimer: ReturnType<typeof setInterval> | null = null
    let focusOutCheckTimer: ReturnType<typeof setTimeout> | null = null

    function syncLiveTimer() {
      if (liveTimer) {
        clearInterval(liveTimer)
        liveTimer = null
      }

      if (!isStepTimerRunning(props.state)) {
        return
      }

      liveTimer = setInterval(() => {
        nowMs.value = Date.now()
      }, 1000)
    }

    watch(() => props.state.timer_started_at_ms, () => {
      nowMs.value = Date.now()
      syncLiveTimer()
    }, { immediate: true })

    onBeforeUnmount(() => {
      if (liveTimer) {
        clearInterval(liveTimer)
      }
      if (focusOutCheckTimer) {
        clearTimeout(focusOutCheckTimer)
      }
    })

    const alwaysShowDetails = computed(() => props.detailDisplay === "always")
    const actualElapsedMs = computed(() => getStepElapsedMs(props.state, nowMs.value))
    const actualDurationLabel = computed(() => formatStepDuration(actualElapsedMs.value, props.locale))
    const estimatedDurationLabel = computed(() => (
      typeof props.node.estimated_duration_ms === "number"
        ? formatStepDuration(props.node.estimated_duration_ms, props.locale)
        : ""
    ))
    const timerMode = computed<AimdStepTimerMode>(() => resolveStepTimerMode(props.node))
    const timerRunning = computed(() => isStepTimerRunning(props.state))
    const hasRecordedDuration = computed(() => hasRecordedStepDuration(props.state))
    const hasAnnotation = computed(() => Boolean(props.state.annotation?.trim()))
    const remainingMs = computed(() => getStepRemainingMs(props.state, props.node.estimated_duration_ms, nowMs.value))
    const countdownEnabled = computed(() => timerMode.value === "countdown" || timerMode.value === "both")
    const showElapsedDetail = computed(() => timerMode.value === "elapsed" || timerMode.value === "both")
    const countdownWarning = computed(() => (
      (timerRunning.value || hasRecordedDuration.value)
      && isStepTimerWarning(remainingMs.value, props.node.estimated_duration_ms)
    ))
    const countdownOvertime = computed(() => typeof remainingMs.value === "number" && remainingMs.value < 0)
    const countdownLabel = computed(() => {
      if (remainingMs.value == null) {
        return ""
      }

      if (countdownOvertime.value) {
        return props.messages.step.overtimeBadge(formatStepDuration(Math.abs(remainingMs.value), props.locale))
      }

      return props.messages.step.remainingBadge(formatStepDuration(Math.max(0, remainingMs.value), props.locale))
    })
    const countdownTitle = computed(() => {
      if (remainingMs.value == null) {
        return ""
      }

      if (countdownOvertime.value) {
        return props.messages.step.overtimeDuration(formatStepDuration(Math.abs(remainingMs.value), props.locale))
      }

      return props.messages.step.remainingDuration(formatStepDuration(Math.max(0, remainingMs.value), props.locale))
    })
    const autoShowTimerDetails = computed(() => countdownEnabled.value)
    const showAnnotationEditor = computed(() => (
      alwaysShowDetails.value
      || hasAnnotation.value
      || annotationExpanded.value
    ))
    const showTimerDetails = computed(() => (
      alwaysShowDetails.value
      || autoShowTimerDetails.value
      || timerRunning.value
      || hasRecordedDuration.value
      || timerExpanded.value
    ))
    const showTimerSummary = computed(() => !showTimerDetails.value && (timerRunning.value || hasRecordedDuration.value))

    function clearPendingFocusOutCheck() {
      if (focusOutCheckTimer) {
        clearTimeout(focusOutCheckTimer)
        focusOutCheckTimer = null
      }
    }

    function collapseTransientDetails() {
      if (!hasAnnotation.value) {
        annotationExpanded.value = false
      }
      if (!autoShowTimerDetails.value && !timerRunning.value && !hasRecordedDuration.value) {
        timerExpanded.value = false
      }
    }

    function handleFocusIn() {
      clearPendingFocusOutCheck()
    }

    function handleFocusOut(event: FocusEvent) {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && rootEl.value?.contains(nextTarget)) {
        return
      }

      clearPendingFocusOutCheck()
      focusOutCheckTimer = setTimeout(() => {
        focusOutCheckTimer = null
        const activeElement = typeof document !== "undefined" ? document.activeElement : null
        if (activeElement instanceof Node && rootEl.value?.contains(activeElement)) {
          return
        }

        collapseTransientDetails()
      }, 0)
    }

    function openAnnotationDetail() {
      annotationExpanded.value = true
      scrollDetailsIntoView()
    }

    function openTimerDetail() {
      timerExpanded.value = true
      emit("timer-start", { id: props.node.id })
    }

    function preventToggleFocus(event: MouseEvent) {
      event.preventDefault()
    }

    function scrollDetailsIntoView() {
      void nextTick(() => {
        const target = annotationDetailsEl.value
        if (typeof target?.scrollIntoView !== "function") {
          return
        }

        target.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        })
      })
    }

    return () => {
      const node = props.node
      const id = node.id
      const state = props.state
      const stepNumber = node.step || "?"
      const hasCheck = Boolean(node.check)
      const hasBody = props.bodyNodes.length > 0
      const disabled = props.disabled
      const extraClasses = props.extraClasses
      const canResetTimer = hasRecordedDuration.value || timerRunning.value
      const startButtonLabel = timerRunning.value
        ? props.messages.step.pauseTimer
        : (hasRecordedDuration.value ? props.messages.step.resumeTimer : props.messages.step.startTimer)
      const timerDetailChildren: VNodeChild[] = []
      const annotationDetailChildren: VNodeChild[] = []
      const headerMetaChildren = []
      const headerActionChildren = []

      if (showTimerDetails.value) {
        const timerBadgeChildren: VNodeChild[] = []

        if (countdownEnabled.value && countdownLabel.value) {
          timerBadgeChildren.push(
            h("span", {
              class: [
                "aimd-step-timer__hero",
                countdownOvertime.value
                  ? "aimd-step-timer__hero--overtime"
                  : countdownWarning.value
                    ? "aimd-step-timer__hero--warning"
                    : "aimd-step-timer__hero--countdown",
              ],
              title: countdownTitle.value,
            }, countdownLabel.value),
          )
        }

        if (showElapsedDetail.value) {
          timerBadgeChildren.push(
            h("span", {
              class: [
                "aimd-step-timer__pill",
                "aimd-step-timer__pill--actual",
                timerRunning.value ? "aimd-step-timer__pill--running" : "",
              ],
              title: props.messages.step.recordedDuration(actualDurationLabel.value),
            }, props.messages.step.recordedBadge(actualDurationLabel.value)),
          )
        }

        timerDetailChildren.push(
          h("span", {
            class: "aimd-step-field__detail aimd-step-field__detail--timer",
          }, [
            ...timerBadgeChildren,
            !disabled
              ? h("span", { class: "aimd-step-timer__controls" }, [
                h("button", {
                  type: "button",
                  class: "aimd-step-timer__btn",
                  onClick: () => emit(timerRunning.value ? "timer-pause" : "timer-start", { id }),
                }, startButtonLabel),
                h("button", {
                  type: "button",
                  class: "aimd-step-timer__btn aimd-step-timer__btn--ghost",
                  disabled: !canResetTimer,
                  onClick: () => emit("timer-reset", { id }),
                }, props.messages.step.resetTimer),
              ])
              : null,
          ]),
        )
      }

      if (showAnnotationEditor.value) {
        annotationDetailChildren.push(
          h("span", {
            class: "aimd-step-field__detail aimd-step-field__detail--annotation",
          }, [
            h(AimdMarkdownNoteField, {
              class: "aimd-step-field__annotation-editor",
              disabled,
              locale: props.locale,
              modelValue: state.annotation || "",
              "onUpdate:modelValue": (value: string) => {
                emit("annotation-change", {
                  id,
                  value,
                })
              },
              onClose: () => {
                annotationExpanded.value = false
                emit("blur", { id })
              },
              onBlur: () => emit("blur", { id }),
            }),
          ]),
        )
      }

      headerMetaChildren.push(
        h(hasCheck ? "label" : "span", { class: "aimd-rec-inline__check-wrap" }, [
          hasCheck
            ? h("input", {
              "data-rec-focus-key": `step:${id}:checked`,
              type: "checkbox",
              disabled,
              checked: Boolean(state.checked),
              onChange: (event: Event) => {
                emit("check-change", {
                  id,
                  value: (event.target as HTMLInputElement).checked,
                })
              },
              onBlur: () => emit("blur", { id }),
            })
            : null,
          h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("step", props.messages)),
          h("span", { class: "aimd-rec-inline__step-num" }, stepNumber),
          h("span", { class: "aimd-field__name" }, id),
        ]),
      )

      if (estimatedDurationLabel.value) {
        headerMetaChildren.push(
          h("span", {
            class: "aimd-step-timer__pill aimd-step-timer__pill--estimate",
            title: props.messages.step.estimatedDuration(estimatedDurationLabel.value),
          }, props.messages.step.estimatedBadge(estimatedDurationLabel.value)),
        )
      }

      if (showTimerSummary.value) {
        headerMetaChildren.push(
          h("span", {
            class: [
              "aimd-step-timer__pill",
              "aimd-step-timer__pill--actual",
              timerRunning.value ? "aimd-step-timer__pill--running" : "",
            ],
            title: props.messages.step.recordedDuration(actualDurationLabel.value),
          }, props.messages.step.recordedBadge(actualDurationLabel.value)),
        )
      }

      if (!disabled && !hasBody && !showAnnotationEditor.value) {
        headerActionChildren.push(
          h("button", {
            type: "button",
            class: "aimd-step-timer__btn aimd-step-timer__btn--ghost aimd-step-field__toggle aimd-step-field__toggle--annotation",
            onMousedown: preventToggleFocus,
            onClick: openAnnotationDetail,
          }, props.messages.step.annotationToggle),
        )
      }

      if (!disabled && !showTimerDetails.value) {
        headerActionChildren.push(
          h("button", {
            type: "button",
            class: "aimd-step-timer__btn aimd-step-timer__btn--ghost aimd-step-field__toggle aimd-step-field__toggle--timer",
            onMousedown: preventToggleFocus,
            onClick: openTimerDetail,
          }, props.messages.step.timerToggle),
        )
      }

      const bodyChildren = props.bodyNodes.length > 0
        ? h("div", { key: "body", class: "aimd-step-field__body" }, props.bodyNodes.slice())
        : null
      const bodyAnnotationAction = hasBody && !disabled && !showAnnotationEditor.value
        ? h("div", {
          key: "body-annotation-actions",
          class: "aimd-step-field__body-actions",
        }, [
          h("button", {
            type: "button",
            class: "aimd-step-timer__btn aimd-step-timer__btn--ghost aimd-step-field__toggle aimd-step-field__toggle--annotation aimd-step-field__body-action",
            onMousedown: preventToggleFocus,
            onClick: openAnnotationDetail,
          }, props.messages.step.annotationToggle),
        ])
        : null
      const timerDetailSlot = timerDetailChildren.length > 0
        ? h("div", {
          key: "timer-details-slot",
          class: "aimd-step-field__details-slot aimd-step-field__details-slot--timer",
        }, [
          h("div", { class: "aimd-step-field__details" }, timerDetailChildren),
        ])
        : null
      const annotationDetailSlot = annotationDetailChildren.length > 0
        ? h("div", {
          key: "annotation-details-slot",
          ref: annotationDetailsEl,
          class: "aimd-step-field__details-slot aimd-step-field__details-slot--annotation",
        }, [
          h("div", { class: "aimd-step-field__details" }, annotationDetailChildren),
        ])
        : null

      return h("div", {
        ref: rootEl,
        class: ["aimd-rec-inline aimd-rec-inline--step aimd-field aimd-field--step", ...extraClasses],
        onFocusin: handleFocusIn,
        onFocusout: handleFocusOut,
      }, [
        h("div", {
          key: "main",
          class: "aimd-step-field__main",
        }, [
          h("div", {
            class: "aimd-step-field__main-meta",
          }, headerMetaChildren),
          headerActionChildren.length > 0
            ? h("div", {
              class: "aimd-step-field__main-actions",
            }, headerActionChildren)
            : null,
        ]),
        timerDetailSlot,
        bodyChildren,
        bodyAnnotationAction,
        annotationDetailSlot,
      ])
    }
  },
})

export const AimdCheckField = defineComponent({
  name: "AimdCheckField",
  props: {
    node: { type: Object as PropType<AimdCheckNode>, required: true },
    state: { type: Object as PropType<AimdCheckRecordItem>, required: true },
    bodyNodes: { type: Array as PropType<VNodeChild[]>, default: () => [] },
    disabled: { type: Boolean, default: false },
    extraClasses: { type: Array as PropType<string[]>, default: () => [] },
    locale: { type: String, default: "en-US" },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
  },
  emits: ["check-change", "annotation-change", "blur"],
  setup(props, { emit }) {
    const rootEl = ref<HTMLElement | null>(null)
    const detailsEl = ref<HTMLElement | null>(null)
    const annotationExpanded = ref(false)
    let focusOutCheckTimer: ReturnType<typeof setTimeout> | null = null

    const hasAnnotation = computed(() => Boolean(props.state.annotation?.trim()))
    const showAnnotationEditor = computed(() => hasAnnotation.value || annotationExpanded.value)

    function clearPendingFocusOutCheck() {
      if (focusOutCheckTimer) {
        clearTimeout(focusOutCheckTimer)
        focusOutCheckTimer = null
      }
    }

    function collapseTransientDetails() {
      if (!hasAnnotation.value) {
        annotationExpanded.value = false
      }
    }

    function handleFocusIn() {
      clearPendingFocusOutCheck()
    }

    function handleFocusOut(event: FocusEvent) {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && rootEl.value?.contains(nextTarget)) {
        return
      }

      clearPendingFocusOutCheck()
      focusOutCheckTimer = setTimeout(() => {
        focusOutCheckTimer = null
        const activeElement = typeof document !== "undefined" ? document.activeElement : null
        if (activeElement instanceof Node && rootEl.value?.contains(activeElement)) {
          return
        }

        collapseTransientDetails()
      }, 0)
    }

    function openAnnotationDetail() {
      annotationExpanded.value = true
      scrollDetailsIntoView()
    }

    function preventToggleFocus(event: MouseEvent) {
      event.preventDefault()
    }

    function scrollDetailsIntoView() {
      void nextTick(() => {
        const target = detailsEl.value
        if (typeof target?.scrollIntoView !== "function") {
          return
        }

        target.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        })
      })
    }

    onBeforeUnmount(() => {
      clearPendingFocusOutCheck()
    })

    return () => {
      const node = props.node
      const id = node.id
      const state = props.state
      const disabled = props.disabled
      const extraClasses = props.extraClasses
      const hasBody = props.bodyNodes.length > 0
      const showCheckedMessage = Boolean(state.checked && node.checked_message)
      const fallbackLabel = node.label || id
      const statusClass = state.checked ? "aimd-rec-inline--check-passed" : "aimd-rec-inline--check-open"
      const bodyClass = hasBody ? "aimd-rec-inline--check-with-body" : "aimd-rec-inline--check-bodyless"
      const headerActionChildren = !disabled && !showAnnotationEditor.value
        ? [
            h("button", {
              type: "button",
              class: "aimd-step-timer__btn aimd-step-timer__btn--ghost aimd-check-field__toggle-btn",
              onMousedown: preventToggleFocus,
              onClick: openAnnotationDetail,
            }, props.messages.check.annotationPlaceholder),
          ]
        : []
      const detailChildren = showAnnotationEditor.value
        ? [
            h("span", {
              class: "aimd-check-field__detail aimd-check-field__detail--annotation",
            }, [
              h(AimdMarkdownNoteField, {
                class: "aimd-check-field__annotation-editor",
                disabled,
                locale: props.locale,
                modelValue: state.annotation || "",
                "onUpdate:modelValue": (value: string) => {
                  emit("annotation-change", {
                    id,
                    value,
                  })
                },
                onClose: () => {
                  annotationExpanded.value = false
                  emit("blur", { id })
                },
                onBlur: () => emit("blur", { id }),
              }),
            ]),
          ]
        : []

      return h("div", {
        ref: rootEl,
        class: ["aimd-rec-inline aimd-rec-inline--check aimd-field aimd-field--check", statusClass, bodyClass, ...extraClasses],
        onFocusin: handleFocusIn,
        onFocusout: handleFocusOut,
      }, [
        h("div", { class: "aimd-check-field__main" }, [
          h("div", { class: "aimd-check-field__header" }, [
            h("label", { class: "aimd-rec-inline__check-wrap aimd-check-field__toggle" }, [
              h("input", {
                "data-rec-focus-key": `check:${id}:checked`,
                type: "checkbox",
                class: "aimd-checkbox",
                disabled,
                checked: Boolean(state.checked),
                onChange: (event: Event) => {
                  emit("check-change", {
                    id,
                    value: (event.target as HTMLInputElement).checked,
                  })
                },
                onBlur: () => emit("blur", { id }),
              }),
              h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("check", props.messages)),
              !hasBody
                ? h("span", { class: "aimd-field__name aimd-check-field__key" }, fallbackLabel)
                : null,
            ]),
            headerActionChildren.length > 0
              ? h("div", { class: "aimd-check-field__actions" }, headerActionChildren)
              : null,
          ]),
          hasBody
            ? h("div", {
              class: [
                "aimd-check-field__body",
                state.checked ? "aimd-check-field__body--checked" : "",
              ],
            }, props.bodyNodes.slice())
            : null,
        ]),
        showCheckedMessage
          ? h("div", { class: "aimd-check-field__banner" }, node.checked_message)
          : null,
        detailChildren.length > 0
          ? h("div", { ref: detailsEl, class: "aimd-check-field__details" }, detailChildren)
          : null,
      ])
    }
  },
})

export default AimdStepField
</script>
