export type JsonRecord = Record<string, unknown>

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value)
  return null
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

export function readString(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key])
    if (value)
      return value
  }
  return null
}

export function readNumber(record: JsonRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key])
    if (value !== null)
      return value
  }
  return null
}

export function readBoolean(record: JsonRecord, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = asBoolean(record[key])
    if (value !== null)
      return value
  }
  return null
}

export function readList(payload: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(payload))
    return payload
  if (!isRecord(payload))
    return []
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value))
      return value
    if (isRecord(value) && Array.isArray(value.items))
      return value.items
  }
  return []
}

export function readStringList(record: JsonRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    if (Array.isArray(record[key]))
      return record[key].filter((item): item is string => typeof item === 'string')
  }
  return []
}

export function readNullableBoundedString(record: JsonRecord, maxLength: number, ...keys: string[]): string | null | undefined {
  const key = keys.find(candidate => Object.hasOwn(record, candidate))
  if (!key || record[key] === null || record[key] === undefined)
    return null
  const value = asString(record[key])
  return value && value.length <= maxLength ? value : undefined
}
