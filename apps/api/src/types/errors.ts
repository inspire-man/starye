/**
 * 错误响应类型定义
 */

export interface ErrorResponse {
  success: false
  error: string
  code?: string
  details?: unknown
  requestId?: string
  timestamp: string
}

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 验证错误 (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // 认证错误 (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // 权限错误 (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // 资源错误 (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // 业务逻辑错误 (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // 限流错误 (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 数据库错误 (500)
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',

  // 服务器错误 (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  // 超时错误 (504)
  TIMEOUT = 'TIMEOUT',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
}

/**
 * Valibot 错误详情
 */
export interface ValidationErrorDetail {
  path: string[]
  message: string
  received?: unknown
}
