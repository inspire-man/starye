export type ErrorType = 'network' | 'permission' | 'validation' | 'server' | 'unknown'

export interface ParsedError {
  type: ErrorType
  message: string
  originalError: unknown
  statusCode?: number
  action?: string
}
