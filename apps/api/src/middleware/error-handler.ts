import type { Context } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import type { AppEnv } from '../types'
import type { ErrorResponse, ValidationErrorDetail } from '../types/errors'
import { HTTPException } from 'hono/http-exception'
import { ErrorCode } from '../types/errors'

/**
 * 全局错误处理器
 *
 * 支持多种错误类型的分层处理:
 * - Valibot 验证错误
 * - Better Auth 认证错误
 * - Drizzle ORM 数据库错误
 * - Hono HTTP 异常
 * - 未知错误
 */
export function errorHandler(err: Error, c: Context<AppEnv>) {
  const requestId = c.get('requestId')
  const timestamp = new Date().toISOString()

  // 基础错误响应
  const baseResponse: ErrorResponse = {
    success: false,
    error: 'Unknown error',
    requestId,
    timestamp,
  }

  // 1️⃣ Valibot 验证错误
  if (isValibotError(err)) {
    console.error('[Valibot Error]', { requestId, error: err })

    return c.json({
      ...baseResponse,
      error: 'Validation failed',
      code: ErrorCode.VALIDATION_ERROR,
      details: formatValibotError(err),
    }, 400)
  }

  // 2️⃣ Drizzle 数据库错误 (优先于 Auth 错误检查)
  if (isDrizzleError(err)) {
    console.error('[Database Error]', { requestId, error: err })

    const dbError = formatDrizzleError(err)
    const response = {
      ...baseResponse,
      error: dbError.message,
      code: dbError.code,
      details: dbError.details,
    }

    // 使用类型断言避免 StatusCode 类型问题
    switch (dbError.status) {
      case 400:
        return c.json(response, 400)
      case 409:
        return c.json(response, 409)
      default:
        return c.json(response, 500)
    }
  }

  // 3️⃣ Better Auth 错误
  if (isBetterAuthError(err)) {
    console.error('[Auth Error]', { requestId, error: err })

    return c.json({
      ...baseResponse,
      error: err.message || 'Authentication failed',
      code: ErrorCode.UNAUTHORIZED,
    }, 401)
  }

  // 4️⃣ Hono HTTP 异常
  if (err instanceof HTTPException) {
    console.error('[HTTP Exception]', { requestId, status: err.status, message: err.message })

    return c.json({
      ...baseResponse,
      error: err.message,
      code: getHttpErrorCode(err.status),
    }, err.status)
  }

  // 5️⃣ 未知错误 (500)
  console.error('[Unknown Error]', {
    requestId,
    error: err,
    stack: err.stack,
    name: err.name,
    message: err.message,
  })

  return c.json({
    ...baseResponse,
    error: 'Internal Server Error',
    code: ErrorCode.INTERNAL_SERVER_ERROR,
  }, 500)
}

/**
 * 检查是否为 Valibot 验证错误
 */
function isValibotError(err: Error): boolean {
  return err.name === 'ValiError' || 'issues' in err
}

/**
 * 格式化 Valibot 错误
 */
function formatValibotError(err: Error): ValidationErrorDetail[] {
  const issues = (err as any).issues || []

  return issues.map((issue: any) => ({
    path: issue.path?.map((p: any) => p.key).filter(Boolean) || [],
    message: issue.message || 'Validation failed',
    received: issue.received,
  }))
}

/**
 * 检查是否为 Better Auth 错误
 */
function isBetterAuthError(err: Error): boolean {
  return err.name === 'AuthError'
    || err.message.includes('auth')
    || err.message.includes('token')
    || err.message.includes('session')
}

/**
 * 检查是否为 Drizzle 数据库错误
 */
function isDrizzleError(err: Error): boolean {
  return err.name === 'DrizzleError'
    || err.message.includes('UNIQUE constraint')
    || err.message.includes('FOREIGN KEY constraint')
    || err.message.includes('NOT NULL constraint')
    || err.message.includes('database')
    || err.message.includes('SQL')
}

/**
 * 格式化 Drizzle 错误
 */
function formatDrizzleError(err: Error): {
  message: string
  code: ErrorCode
  details?: unknown
  status: StatusCode
} {
  const message = err.message

  // 唯一约束冲突
  if (message.includes('UNIQUE constraint')) {
    return {
      message: 'Resource already exists',
      code: ErrorCode.DUPLICATE_RESOURCE,
      details: { constraint: extractConstraintName(message) },
      status: 409 as StatusCode,
    }
  }

  // 外键约束冲突
  if (message.includes('FOREIGN KEY constraint')) {
    return {
      message: 'Referenced resource not found',
      code: ErrorCode.CONSTRAINT_VIOLATION,
      details: { constraint: extractConstraintName(message) },
      status: 400 as StatusCode,
    }
  }

  // NOT NULL 约束
  if (message.includes('NOT NULL constraint')) {
    return {
      message: 'Required field missing',
      code: ErrorCode.VALIDATION_ERROR,
      details: { constraint: extractConstraintName(message) },
      status: 400 as StatusCode,
    }
  }

  // 通用数据库错误
  return {
    message: 'Database operation failed',
    code: ErrorCode.DATABASE_ERROR,
    status: 500 as StatusCode,
  }
}

/**
 * 从错误消息中提取约束名称
 */
function extractConstraintName(message: string): string | undefined {
  const match = message.match(/constraint failed: (\w+)/)
  return match?.[1]
}

/**
 * 根据 HTTP 状态码获取错误码
 */
function getHttpErrorCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ErrorCode.UNAUTHORIZED
    case 403:
      return ErrorCode.FORBIDDEN
    case 404:
      return ErrorCode.NOT_FOUND
    case 409:
      return ErrorCode.CONFLICT
    case 429:
      return ErrorCode.RATE_LIMIT_EXCEEDED
    case 504:
      return ErrorCode.GATEWAY_TIMEOUT
    default:
      return ErrorCode.INTERNAL_SERVER_ERROR
  }
}
