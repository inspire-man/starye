/**
 * 错误处理器测试
 *
 * 验证分层错误处理功能
 */

import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import { describe, expect, it } from 'vitest'
import { ErrorCode } from '../../types/errors'
import { errorHandler } from '../error-handler'

describe('错误处理器', () => {
  it('应该处理 HTTP 异常', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      throw new HTTPException(404, { message: 'Resource not found' })
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any as any

    expect(res.status).toBe(404)
    expect(json).toMatchObject({
      success: false,
      error: 'Resource not found',
      code: ErrorCode.NOT_FOUND,
    })
    expect(json.requestId).toBeDefined()
    expect(json.timestamp).toBeDefined()
  })

  it('应该处理 401 未授权错误', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      throw new HTTPException(401, { message: 'Unauthorized' })
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(res.status).toBe(401)
    expect(json.code).toBe(ErrorCode.UNAUTHORIZED)
  })

  it('应该处理 403 禁止访问错误', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      throw new HTTPException(403, { message: 'Forbidden' })
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(res.status).toBe(403)
    expect(json.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('应该处理 Valibot 验证错误', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      const valibotError = new Error('Validation failed')
      valibotError.name = 'ValiError'
      ;(valibotError as any).issues = [
        {
          path: [{ key: 'email' }],
          message: 'Invalid email format',
          received: 'invalid-email',
        },
      ]
      throw valibotError
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(res.status).toBe(400)
    expect(json).toMatchObject({
      success: false,
      error: 'Validation failed',
      code: ErrorCode.VALIDATION_ERROR,
    })
    expect(json.details).toHaveLength(1)
    expect(json.details[0]).toMatchObject({
      path: ['email'],
      message: 'Invalid email format',
    })
  })

  it('应该处理数据库唯一约束错误', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      const dbError = new Error('UNIQUE constraint failed: users.email')
      dbError.name = 'DrizzleError'
      throw dbError
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(res.status).toBe(409)
    expect(json).toMatchObject({
      success: false,
      error: 'Resource already exists',
      code: ErrorCode.DUPLICATE_RESOURCE,
    })
    expect(json.details).toBeDefined()
  })

  it('应该处理数据库外键约束错误', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      const dbError = new Error('FOREIGN KEY constraint failed: posts.authorId')
      dbError.name = 'DrizzleError'
      throw dbError
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(res.status).toBe(400)
    expect(json).toMatchObject({
      success: false,
      error: 'Referenced resource not found',
      code: ErrorCode.CONSTRAINT_VIOLATION,
    })
  })

  it('应该处理 NOT NULL 约束错误', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      const dbError = new Error('NOT NULL constraint failed: users.name')
      dbError.name = 'DrizzleError'
      throw dbError
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(res.status).toBe(400)
    expect(json.code).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it('应该处理 Better Auth 错误', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      const authError = new Error('Invalid session token')
      authError.name = 'AuthError'
      throw authError
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(res.status).toBe(401)
    expect(json.code).toBe(ErrorCode.UNAUTHORIZED)
  })

  it('应该处理未知错误', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      throw new Error('Something went wrong')
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(res.status).toBe(500)
    expect(json).toMatchObject({
      success: false,
      error: 'Internal Server Error',
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    })
    expect(json.requestId).toBeDefined()
    expect(json.timestamp).toBeDefined()
  })

  it('所有错误响应应该包含 requestId', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      throw new HTTPException(400, { message: 'Bad Request' })
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(json.requestId).toBeDefined()
    expect(typeof json.requestId).toBe('string')
    expect(json.requestId.length).toBeGreaterThan(0)
  })

  it('所有错误响应应该包含 timestamp', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    app.onError(errorHandler)

    app.get('/test', () => {
      throw new Error('Test error')
    })

    const res = await app.fetch(new Request('http://localhost/test'))
    const json = await res.json() as any

    expect(json.timestamp).toBeDefined()
    expect(new Date(json.timestamp).getTime()).toBeGreaterThan(0)
  })
})
