import type { CrawlerRunReceipt } from './types'

export const MAX_SAFE_LOG_BYTES = 4 * 1024

export interface StorageSafeRunnerEvent {
  readonly code?: string
  readonly counts?: Readonly<Record<string, number>>
  readonly level?: 'debug' | 'info' | 'warn' | 'error'
  readonly message?: string
  readonly receipt?: CrawlerRunReceipt
  readonly type: 'heartbeat' | 'progress' | 'log' | 'succeeded' | 'failed' | 'cancelled'
}

export function redactRunnerEventText(value: string): string {
  return value
    .replace(/authorization\s*[:=]\s*(?:bearer\s+)?[^\s,;]+(?:\s+[^\s,;]+)?/giu, 'Authorization: [REDACTED]')
    .replace(/(cookie\s*[:=]\s*)([^\s,;]+)/giu, '$1[REDACTED]')
    .replace(/\b(?:token|secret|signature|password|api[_-]?key)\s*[:=]\s*[^\s&]+/giu, '[REDACTED]')
    .replace(/https?:\/\/\S+/giu, '[REDACTED]')
}

export function truncateRunnerEventText(value: string, maxBytes = MAX_SAFE_LOG_BYTES): string {
  const encoder = new TextEncoder()
  if (encoder.encode(value).byteLength <= maxBytes)
    return value
  const suffix = ' [truncated]'
  let end = value.length
  while (end > 0 && encoder.encode(`${value.slice(0, end)}${suffix}`).byteLength > maxBytes) end--
  return `${value.slice(0, end)}${suffix}`
}

export function normalizeRunnerEventForStorage(event: StorageSafeRunnerEvent): {
  readonly log?: { readonly code: string, readonly counts?: Readonly<Record<string, number>>, readonly level: 'debug' | 'info' | 'warn' | 'error', readonly message: string }
  readonly receipt?: CrawlerRunReceipt
  readonly terminalSummary?: string
} {
  const message = event.message ? truncateRunnerEventText(redactRunnerEventText(event.message)) : undefined
  const log = message && event.code && event.level
    ? { code: event.code, counts: event.counts, level: event.level, message }
    : undefined
  const terminalSummary = event.type === 'failed' || event.type === 'succeeded' || event.type === 'cancelled'
    ? message ?? event.code
    : undefined
  return { log, receipt: event.receipt, terminalSummary }
}
