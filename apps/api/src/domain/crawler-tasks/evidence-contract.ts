export const AVAILABILITY_EVIDENCE_MAX_CODES = 32
export const AVAILABILITY_EVIDENCE_MAX_SAMPLES = 20
export const AVAILABILITY_EVIDENCE_MAX_CODE_LENGTH = 64
export const AVAILABILITY_EVIDENCE_MAX_LABEL_LENGTH = 128

export interface AvailabilityEvidenceSample {
  readonly code: string
  readonly label?: string
  readonly count?: number
}

export interface BoundedAvailabilityEvidence {
  readonly counts: Readonly<Record<string, number>>
  readonly samples: readonly AvailabilityEvidenceSample[]
}

export type AvailabilityEvidenceRejectionCode
  = 'unknown_field'
    | 'invalid_shape'
    | 'sensitive_material'
    | 'too_many_codes'
    | 'too_many_samples'
    | 'text_too_long'
    | 'count_invalid'

export interface AvailabilityEvidenceRejection {
  readonly code: AvailabilityEvidenceRejectionCode
  readonly path: string
  readonly reason: string
}

export type AvailabilityEvidenceRedactionResult
  = | { readonly ok: true, readonly value: BoundedAvailabilityEvidence }
    | { readonly ok: false, readonly rejection: AvailabilityEvidenceRejection }

const SENSITIVE_KEYS = new Set([
  'authorization', 'cookie', 'command', 'html', 'media', 'rawresponse', 'secret', 'signedurl',
  'sourceurl', 'token', 'url', 'workflow',
])
const SENSITIVE_VALUE = /https?:\/\/|magnet:\?|bearer\s+|cookie\s*[:=]|authorization\s*[:=]|secret\s*[:=]/iu

function rejection(code: AvailabilityEvidenceRejectionCode, path: string, reason: string): AvailabilityEvidenceRejection {
  return { code, path, reason }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function checkText(value: unknown, max: number, path: string): AvailabilityEvidenceRejection | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > max)
    return rejection('text_too_long', path, 'bounded evidence text is invalid')
  if (SENSITIVE_VALUE.test(value))
    return rejection('sensitive_material', path, 'sensitive provider material is forbidden')
  return undefined
}

function validateInput(value: unknown): AvailabilityEvidenceRejection | undefined {
  if (!isRecord(value))
    return rejection('invalid_shape', '$', 'evidence must be an object')
  const keys = Object.keys(value)
  if (keys.some(key => SENSITIVE_KEYS.has(key.replaceAll('_', '').replaceAll('-', '').toLowerCase()))) {
    const key = keys.find(candidate => SENSITIVE_KEYS.has(candidate.replaceAll('_', '').replaceAll('-', '').toLowerCase()))!
    return rejection('sensitive_material', `$.${key}`, 'sensitive provider material is forbidden')
  }
  if (keys.some(key => key !== 'counts' && key !== 'samples'))
    return rejection('unknown_field', '$', 'evidence fields are closed')
  if (value.counts !== undefined) {
    if (!isRecord(value.counts))
      return rejection('invalid_shape', '$.counts', 'counts must be an object')
    const countKeys = Object.keys(value.counts)
    if (countKeys.length > AVAILABILITY_EVIDENCE_MAX_CODES)
      return rejection('too_many_codes', '$.counts', 'evidence code count exceeds the bound')
    for (const key of countKeys) {
      const keyError = checkText(key, AVAILABILITY_EVIDENCE_MAX_CODE_LENGTH, `$.counts.${key}`)
      if (keyError)
        return keyError
      const count = value.counts[key]
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 1_000_000)
        return rejection('count_invalid', `$.counts.${key}`, 'evidence counts must be bounded nonnegative integers')
    }
  }
  if (value.samples !== undefined) {
    if (!Array.isArray(value.samples))
      return rejection('invalid_shape', '$.samples', 'samples must be an array')
    if (value.samples.length > AVAILABILITY_EVIDENCE_MAX_SAMPLES)
      return rejection('too_many_samples', '$.samples', 'evidence sample count exceeds the bound')
    for (const [index, sample] of value.samples.entries()) {
      if (!isRecord(sample))
        return rejection('invalid_shape', `$.samples[${index}]`, 'sample must be an object')
      const sampleKeys = Object.keys(sample)
      if (sampleKeys.some(key => !['code', 'count', 'label'].includes(key)))
        return rejection('unknown_field', `$.samples[${index}]`, 'sample fields are closed')
      const codeError = checkText(sample.code, AVAILABILITY_EVIDENCE_MAX_CODE_LENGTH, `$.samples[${index}].code`)
      if (codeError)
        return codeError
      if (sample.label !== undefined) {
        const labelError = checkText(sample.label, AVAILABILITY_EVIDENCE_MAX_LABEL_LENGTH, `$.samples[${index}].label`)
        if (labelError)
          return labelError
      }
      if (sample.count !== undefined && (typeof sample.count !== 'number' || !Number.isSafeInteger(sample.count) || sample.count < 0 || sample.count > 1_000_000))
        return rejection('count_invalid', `$.samples[${index}].count`, 'sample counts must be bounded nonnegative integers')
    }
  }
  return undefined
}

export function validateBoundedAvailabilityEvidence(value: unknown): BoundedAvailabilityEvidence {
  const error = validateInput(value)
  if (error)
    throw new Error(`${error.code}:${error.path}`)
  const record = value as Record<string, unknown>
  const counts = Object.fromEntries(Object.entries((record.counts ?? {}) as Record<string, number>).sort(([left], [right]) => left.localeCompare(right)))
  const samples = ((record.samples ?? []) as readonly Record<string, unknown>[]).map(sample => ({
    code: sample.code as string,
    ...(sample.label !== undefined ? { label: sample.label as string } : {}),
    ...(sample.count !== undefined ? { count: sample.count as number } : {}),
  }))
  return Object.freeze({ counts: Object.freeze(counts), samples: Object.freeze(samples) })
}

export function redactAvailabilityEvidence(value: unknown): AvailabilityEvidenceRedactionResult {
  const error = validateInput(value)
  return error
    ? { ok: false, rejection: error }
    : { ok: true, value: validateBoundedAvailabilityEvidence(value) }
}
