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
    | 'QUANT_AI_CONFIGURATION'
    | 'QUANT_AI_SUMMARY_CONFIGURATION'
    | 'QUANT_AI_SUMMARY_TIMEOUT'
    | 'QUANT_AI_SUMMARY_UPSTREAM'
    | 'QUANT_AI_SUMMARY_INVALID_RESPONSE'
    | 'QUANT_AI_COMPARISON_CONFIGURATION'
    | 'QUANT_AI_COMPARISON_TIMEOUT'
    | 'QUANT_AI_COMPARISON_UPSTREAM'
    | 'QUANT_AI_COMPARISON_INVALID_RESPONSE'
    | 'QUANT_AI_QUESTION_CONFIGURATION'
    | 'QUANT_AI_QUESTION_TIMEOUT'
    | 'QUANT_AI_QUESTION_UPSTREAM'
    | 'QUANT_AI_QUESTION_INVALID_RESPONSE'
    | 'QUANT_WATCHLIST_LIMIT'
    | 'QUANT_INVALID_RESEARCH_STATUS'
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
