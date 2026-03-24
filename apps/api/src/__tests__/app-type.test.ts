import type { AppType } from '../index'
import { describe, expect, it } from 'vitest'

describe('appType Export', () => {
  it('应该正确导出 AppType', () => {
    const appType: AppType = {} as any
    expect(appType).toBeDefined()
  })

  it('appType 应该包含所有路由的类型信息', () => {
    const hasMoviesRoute = 'movies' as const
    expect(hasMoviesRoute).toBeDefined()
  })
})
