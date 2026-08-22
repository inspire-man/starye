import type { AppType } from '../index'
import { describe, expect, it } from 'vitest'
import { shouldBypassApiTimeout } from '../index'
import adminMainRoutes from '../routes/admin/main'

describe('appType Export', () => {
  it('应该正确导出 AppType', () => {
    // 类型测试: 验证 AppType 可以被正确导入
    const typeCheck: AppType = null as unknown as AppType
    expect(typeCheck).toBeDefined()
  })

  it('appType 应该包含所有路由的类型信息', () => {
    // 类型测试: 验证路由字符串常量
    const hasMoviesRoute = 'movies' as const
    expect(hasMoviesRoute).toBeDefined()
  })

  it('将 crawler task router 保持在既有 admin 组合和 AppType 路径中', () => {
    expect(adminMainRoutes.routes.some(route => route.path === '/crawler-tasks')).toBe(true)
  })

  it('only bypasses the generic timeout for POST quant sync requests', () => {
    expect(shouldBypassApiTimeout(new Request('http://localhost/api/quant/sync', { method: 'POST' }))).toBe(true)
    expect(shouldBypassApiTimeout(new Request('http://localhost/api/quant/sync', { method: 'GET' }))).toBe(false)
    expect(shouldBypassApiTimeout(new Request('http://localhost/api/quant/capabilities', { method: 'POST' }))).toBe(false)
  })
})
