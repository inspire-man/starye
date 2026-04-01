/**
 * 认证中间件单元测试
 *
 * 测试认证中间件的基本功能
 */

import { describe, expect, it } from 'vitest'
import { authMiddleware } from '../auth'

describe('authMiddleware', () => {
  it('应该返回一个中间件函数', () => {
    const middleware = authMiddleware()

    expect(middleware).toBeDefined()
    expect(typeof middleware).toBe('function')
  })

  it('中间件应该是可调用的', () => {
    const middleware = authMiddleware()

    // 中间件应该接受 context 和 next 参数
    expect(middleware.length).toBe(2)
  })
})
