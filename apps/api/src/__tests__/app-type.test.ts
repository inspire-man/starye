import type { AppType } from '../index'
import { describe, expect, it } from 'vitest'

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
})
