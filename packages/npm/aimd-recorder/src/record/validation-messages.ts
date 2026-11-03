import type { AimdRecorderLocale, AimdRecorderMessages } from "../locales"

export const validationMessages: Record<AimdRecorderLocale, AimdRecorderMessages["validation"]> = {
  "en-US": {
    required: label => `${label} is required.`,
    pattern: label => `${label} has an invalid format.`,
    enum: label => `${label} must use one of the allowed values.`,
    numeric: (label, detail) => `${label}: ${detail}`,
    type: (label, expected) => `${label} must be ${expected}.`,
    format: (label, format) => `${label} must use ${format} format.`,
    resource: (label, detail) => `${label}: ${detail}`,
    resourceInvalid: "Select a valid resource.",
    resourceContainerRequired: "A container must be selected.",
    resourceBookingRequired: "An equipment booking must be selected.",
    schema: (label, detail) => `${label}: ${detail}`,
    tableCell: (row, column) => `Row ${row}, ${column}`,
  },
  "zh-CN": {
    required: label => `${label}为必填项。`,
    pattern: label => `${label}格式不正确。`,
    enum: label => `${label}必须使用允许的选项。`,
    numeric: (label, detail) => `${label}：${detail}`,
    type: (label, expected) => `${label}必须是${expected}类型。`,
    format: (label, format) => `${label}必须使用 ${format} 格式。`,
    resource: (label, detail) => `${label}：${detail}`,
    resourceInvalid: "请选择有效资源。",
    resourceContainerRequired: "必须选择容器。",
    resourceBookingRequired: "必须选择设备预约时段。",
    schema: (label, detail) => `${label}：${detail}`,
    tableCell: (row, column) => `第 ${row} 行，${column}`,
  },
}
