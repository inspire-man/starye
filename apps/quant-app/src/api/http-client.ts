import type { QuantApiEnvelope } from './quant-dtos'
import { isRecord, readString } from './payload'

export const QUANT_API_PREFIX = '/api/quant'

export interface QuantRequestOptions {
  readonly signal?: AbortSignal
}

export class QuantApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'QuantApiError'
    this.status = status
    this.code = code
  }
}

export async function requestJson(path: string, init?: RequestInit, options: { readonly allowErrorResponse?: boolean } = {}): Promise<unknown> {
  const response = await fetch(`${QUANT_API_PREFIX}${path}`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })
  let payload: unknown = null
  try {
    payload = await response.json() as QuantApiEnvelope
  }
  catch {
    payload = null
  }
  if (!response.ok && !options.allowErrorResponse) {
    const record = isRecord(payload) ? payload : {}
    throw new QuantApiError(
      readString(record, 'error', 'message') || `量化接口请求失败（${response.status}）`,
      response.status,
      readString(record, 'code'),
    )
  }
  return payload
}

export function unwrapData(payload: unknown, allowErrorPayload = false): unknown {
  if (!isRecord(payload))
    return payload
  if (payload.success === false && !allowErrorPayload)
    throw new QuantApiError(readString(payload, 'error', 'message') || '量化接口返回失败', 422, readString(payload, 'code'))
  return 'data' in payload ? payload.data : payload
}
