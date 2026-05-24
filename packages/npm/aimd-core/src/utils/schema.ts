/**
 * AIMD Schema Utilities
 *
 * JSON Schema to input type mapping and number formatting helpers.
 */

import Big from "big.js"

// ===== Schema to Input Type =====

export interface SchemaToInputType {
  [key: string]: (format?: string | (Record<string, string>[])) => string
}

export const schemaToInputType: SchemaToInputType = {
  string: (format) => {
    switch (format) {
      case "email":
        return "email"
      case "password":
        return "password"
      case "date":
        return "date"
      case "time":
        return "time"
      case "datetime":
      case "date-time":
        return "datetime"
      case "uri":
        return "url"
      case "duration":
        return "duration"
      default:
        return "textarea"
    }
  },
  number: () => "float",
  integer: () => "integer",
  boolean: () => "boolean",
  array: () => "array",
  object: () => "text",
  anyOf: (format) => {
    if (!format || typeof format === "string") {
      return "text"
    }

    const firstWithFormat = format.find(it => Boolean(it.format || it.type))

    const fn = firstWithFormat?.type ? schemaToInputType[firstWithFormat.type] : undefined

    return fn
      ? fn(firstWithFormat?.format)
      : "text"
  },
}

// ===== Big Number Utilities =====

// eslint-disable-next-line regexp/no-unused-capturing-group
const SCIENTIFIC_NOTATION_REGEX = /^[+-]?(\d+(\.\d*)?|\.\d+)e[+-]?\d+$/i

export function parser(value: string): Big.Big | number | null {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    return null
  }

  try {
    const bigValue = new Big(value.replace(/,/g, ""))
    return bigValue
  }
  catch {
    return Number.NaN
  }
}

export function formatter(value: Big.Big | number | null, precision?: number, displayedValue?: string, fromStepper = false): string {
  if (typeof value === "undefined" || value === null) {
    return ""
  }

  try {
    const bigValue = value instanceof Big ? value : new Big(value)

    if (displayedValue) {
      return convertToScientificString(bigValue, displayedValue, fromStepper)
    }
    return bigValue.toString()
  }
  catch {
    return String(value)
  }
}

export function validator(value: Big.Big | number | null): boolean {
  try {
    const valueType = typeof value
    if (valueType === "undefined" || value === null)
      return true
    if ((valueType === "number" || valueType === "bigint") && Number.isNaN(value))
      return false

    return value instanceof Big
  }
  catch {
    return false
  }
}

export function convertToScientificString(
  bigValue: Big,
  displayedValue: string,
  fromStepper = false,
): string {
  const replaced = displayedValue.replace(/[,\s]/g, "")
  const isScientific = SCIENTIFIC_NOTATION_REGEX.test(replaced)

  if (!isScientific && !fromStepper) {
    return replaced
  }

  if (bigValue.c.length <= bigValue.e) {
    const base = /\d+[.e]/i.exec(replaced)?.[0]
    if (base && Math.abs(Number(base)) > 10) {
      return bigValue.toExponential()
    }

    if (fromStepper) {
      if (isScientific) {
        return bigValue.toExponential()
      }

      return bigValue.toString()
    }

    return replaced
  }

  if (bigValue.c.length === bigValue.e + 1) {
    return bigValue.toString()
  }

  const exponentValue = bigValue.toExponential()
  const exponent = exponentValue.split(/e/i)[1]
  if (Number(exponent) === 0) {
    return bigValue.toString()
  }

  return exponentValue
}

export function isWipValue(value: string) {
  return value.includes(".") && (/^-?\d.*\.|0$/.test(value) || /^\.\d+$/.test(value))
}

export function formatRawValue(sourceValue: any, type: string | number) {
  try {
    if (type === "number" || type === "integer" || type === "float") {
      if (typeof sourceValue === "number") {
        return {
          value: new Big(sourceValue),
          displayedValue: formatter(sourceValue),
          type,
        }
      }
    }

    return sourceValue
  }
  catch {
    return sourceValue
  }
}
