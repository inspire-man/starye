import type { ContentfulStatusCode } from 'hono/utils/http-status'

export type QuantErrorCode
  = | 'QUANT_INVALID_INPUT'
    | 'QUANT_CAPABILITY_DISABLED'
    | 'QUANT_PROVIDER_CONFIGURATION'
    | 'QUANT_PROVIDER_UNKNOWN_API'
    | 'QUANT_PROVIDER_TIMEOUT'
    | 'QUANT_PROVIDER_QUOTA'
    | 'QUANT_PROVIDER_UPSTREAM'
    | 'QUANT_PROVIDER_INVALID_RESPONSE'
    | 'QUANT_WATCHLIST_LIMIT'
    | 'QUANT_NOT_FOUND'
    | 'QUANT_SYNC_IN_PROGRESS'
    | 'QUANT_SYNC_REJECTED'

export class QuantError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: QuantErrorCode
  readonly details?: unknown

  constructor(code: QuantErrorCode, message: string, status: ContentfulStatusCode = 400, details?: unknown) {
    super(message)
    this.name = 'QuantError'
    this.code = code
    this.status = status
    this.details = details
  }
}
