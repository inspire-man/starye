import type { QuantResearchEvidence, QuantResearchSource } from './research-report'
import { QuantError } from './errors'

export const QUANT_AKSHARE_BRIDGE_VERSION = 'quant-akshare-v1' as const

export type QuantAkshareBridgeStatus = 'ready' | 'partial' | 'unavailable' | 'invalid'
export type QuantAkshareBridgeErrorCode = 'CONFIGURATION' | 'TIMEOUT' | 'UNAUTHORIZED' | 'UPSTREAM' | 'INVALID_RESPONSE'

export interface QuantAkshareBridgeEvidence {
  readonly key: string
  readonly dimension: QuantResearchEvidence['dimension']
  readonly label: string
  readonly status: QuantResearchEvidence['status']
  readonly value: number | null
  readonly threshold: string
  readonly source: string
  readonly observedAt: string | null
  readonly formulaVersion: string
  readonly detail: string
}

export interface QuantAkshareBridgeResult {
  readonly schemaVersion: typeof QUANT_AKSHARE_BRIDGE_VERSION
  readonly provider: 'akshare'
  readonly requestId: string
  readonly tsCode: string
  readonly observedAt: string
  readonly status: QuantAkshareBridgeStatus
  readonly source: QuantResearchSource
  readonly identity: { readonly name?: string }
  readonly dailyBars: readonly Record<string, unknown>[]
  readonly financials: readonly Record<string, unknown>[]
  readonly evidence: readonly QuantAkshareBridgeEvidence[]
  readonly errors: readonly { readonly code: string, readonly message: string, readonly source?: string | null }[]
}

export interface QuantAkshareBridgeOptions {
  readonly baseUrl?: string | null
  readonly token?: string | null
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

export class QuantAkshareBridgeError extends Error {
  readonly code: QuantAkshareBridgeErrorCode
  readonly status: number

  constructor(code: QuantAkshareBridgeErrorCode, message: string, status = 502) {
    super(message)
    this.name = 'QuantAkshareBridgeError'
    this.code = code
    this.status = status
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function bridgeStatus(value: unknown): QuantAkshareBridgeStatus | null {
  return value === 'ready' || value === 'partial' || value === 'unavailable' || value === 'invalid' ? value : null
}

function evidenceStatus(value: unknown): QuantResearchEvidence['status'] | null {
  return value === 'pass' || value === 'caution' || value === 'fail' || value === 'missing' ? value : null
}

function evidenceDimension(value: unknown): QuantResearchEvidence['dimension'] | null {
  return value === 'trend' || value === 'valuation' || value === 'quality' || value === 'shareholder-return' || value === 'risk' ? value : null
}

function normalizeEvidence(value: unknown): QuantAkshareBridgeEvidence | null {
  const record = asRecord(value)
  if (!record)
    return null
  const key = asString(record.key)
  const dimension = evidenceDimension(record.dimension)
  const label = asString(record.label)
  const status = evidenceStatus(record.status)
  const threshold = asString(record.threshold)
  const source = asString(record.source)
  const formulaVersion = asString(record.formula_version ?? record.formulaVersion)
  const detail = asString(record.detail)
  if (!key || !dimension || !label || !status || !threshold || !source || !formulaVersion || !detail)
    return null
  return {
    key,
    dimension,
    label,
    status,
    value: asNumber(record.value),
    threshold,
    source,
    observedAt: asString(record.observed_at ?? record.observedAt),
    formulaVersion,
    detail,
  }
}

function normalizeSource(value: unknown): QuantResearchSource | null {
  const record = asRecord(value)
  if (!record)
    return null
  const adapter = asString(record.adapter)
  const formulaVersion = asString(record.formula_version ?? record.formulaVersion)
  const endpoints = Array.isArray(record.endpoints) ? record.endpoints.filter((item): item is string => typeof item === 'string').slice(0, 10) : []
  if (!adapter || !formulaVersion)
    return null
  return {
    id: 'akshare-bridge',
    name: endpoints.length ? `AkShare bridge · ${adapter} · ${endpoints.join(', ')}` : `AkShare bridge · ${adapter}`,
    observedAt: null,
    formulaVersion,
  }
}

function normalizeRows(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => asRecord(item) !== null).slice(0, 250)
    : []
}

function parseBridgeResponse(payload: unknown, requestedTsCode: string): QuantAkshareBridgeResult {
  const record = asRecord(payload)
  const schemaVersion = asString(record?.schema_version ?? record?.schemaVersion)
  const provider = asString(record?.provider)
  const requestId = asString(record?.request_id ?? record?.requestId)
  const tsCode = asString(record?.ts_code ?? record?.tsCode)
  const observedAt = asString(record?.observed_at ?? record?.observedAt)
  const status = bridgeStatus(record?.status)
  const source = normalizeSource(record?.source)
  if (schemaVersion !== QUANT_AKSHARE_BRIDGE_VERSION || provider !== 'akshare' || !requestId || tsCode !== requestedTsCode || !observedAt || !status || !source)
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare bridge contract is invalid', 502)

  const rawEvidence = Array.isArray(record?.evidence) ? record.evidence : []
  const evidence = rawEvidence.slice(0, 32).map(normalizeEvidence).filter((item): item is QuantAkshareBridgeEvidence => item !== null)
  if (rawEvidence.length !== evidence.length)
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare bridge evidence is invalid', 502)
  const errors = Array.isArray(record?.errors)
    ? record.errors.slice(0, 16).flatMap((item) => {
        const error = asRecord(item)
        const code = asString(error?.code)
        const message = asString(error?.message)
        return code && message ? [{ code, message, source: asString(error?.source) }] : []
      })
    : []
  const identityRecord = asRecord(record?.identity)
  const name = asString(identityRecord?.name)
  return {
    schemaVersion: QUANT_AKSHARE_BRIDGE_VERSION,
    provider: 'akshare',
    requestId,
    tsCode,
    observedAt,
    status,
    source: { ...source, observedAt },
    identity: name ? { name } : {},
    dailyBars: normalizeRows(record?.daily_bars ?? record?.dailyBars),
    financials: normalizeRows(record?.financials),
    evidence,
    errors,
  }
}

function normalizedBaseUrl(value: string | null | undefined): string | null {
  const input = value?.trim() || ''
  if (!input)
    return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return null
    return url.toString().replace(/\/+$/u, '')
  }
  catch {
    return null
  }
}

export function createQuantAkshareBridge(options: QuantAkshareBridgeOptions = {}) {
  const baseUrl = normalizedBaseUrl(options.baseUrl)
  const token = options.token?.trim() || null
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0 ? Math.min(options.timeoutMs!, 30_000) : 12_000
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  async function fetchEvidence(input: { readonly tsCode: string, readonly startDate?: string, readonly endDate?: string }): Promise<QuantAkshareBridgeResult> {
    if (!baseUrl || !token)
      throw new QuantAkshareBridgeError('CONFIGURATION', 'AkShare bridge is not configured', 503)
    const tsCode = input.tsCode.trim().toUpperCase()
    const url = new URL('/v1/evidence', baseUrl)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ ts_code: tsCode, start_date: input.startDate, end_date: input.endDate, include_financials: true }),
        signal: controller.signal,
      })
    }
    catch {
      if (controller.signal.aborted)
        throw new QuantAkshareBridgeError('TIMEOUT', 'AkShare bridge request timed out', 504)
      throw new QuantAkshareBridgeError('UPSTREAM', 'AkShare bridge request failed', 502)
    }
    finally {
      clearTimeout(timer)
    }

    if (response.status === 401 || response.status === 403)
      throw new QuantAkshareBridgeError('UNAUTHORIZED', 'AkShare bridge rejected the configured token', 502)
    if (!response.ok)
      throw new QuantAkshareBridgeError(response.status === 408 || response.status === 504 ? 'TIMEOUT' : 'UPSTREAM', `AkShare bridge HTTP ${response.status}`, response.status === 408 || response.status === 504 ? 504 : 502)

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare bridge response is not JSON', 502)
    }
    return parseBridgeResponse(payload, tsCode)
  }

  return { isConfigured: Boolean(baseUrl && token), fetchEvidence }
}

export function mapQuantAkshareBridgeError(error: unknown): QuantError {
  if (error instanceof QuantAkshareBridgeError) {
    if (error.code === 'CONFIGURATION')
      return new QuantError('QUANT_PROVIDER_CONFIGURATION', error.message, 503)
    if (error.code === 'TIMEOUT')
      return new QuantError('QUANT_PROVIDER_TIMEOUT', error.message, 504)
    if (error.code === 'INVALID_RESPONSE')
      return new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', error.message, 502)
  }
  return new QuantError('QUANT_PROVIDER_UPSTREAM', 'AkShare bridge request failed', 502)
}
