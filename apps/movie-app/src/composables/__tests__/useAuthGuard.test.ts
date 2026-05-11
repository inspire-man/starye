/**
 * useAuthGuard composable 单元测试
 * 覆盖：ACCESS-05（未登录收藏拦截跳转行为）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUserStore } from '../../stores/user'
import { useAuthGuard } from '../useAuthGuard'

// mock useUserStore
vi.mock('../../stores/user', () => ({
  useUserStore: vi.fn(),
}))

describe('useAuthGuard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // 重置 window.location
    vi.stubGlobal('window', {
      location: {
        href: '',
        pathname: '/movie/detail/123',
        search: '',
        origin: 'http://localhost:3001',
      },
    })
  })

  it('已登录时 requireLogin() 返回 true，不修改 location.href', () => {
    vi.mocked(useUserStore).mockReturnValue({ user: { id: '1', name: 'test' } } as any)
    const { requireLogin } = useAuthGuard()
    const result = requireLogin()
    expect(result).toBe(true)
    expect(window.location.href).toBe('')
  })

  it('未登录时 requireLogin() 返回 false，跳转到 /auth/login?next=<encoded_path>', () => {
    vi.mocked(useUserStore).mockReturnValue({ user: null } as any)
    const { requireLogin } = useAuthGuard()
    const result = requireLogin()
    expect(result).toBe(false)
    expect(window.location.href).toBe(
      `/auth/login?next=${encodeURIComponent('/movie/detail/123')}`,
    )
  })

  it('未登录时传入自定义 nextPath，跳转使用自定义路径', () => {
    vi.mocked(useUserStore).mockReturnValue({ user: null } as any)
    const { requireLogin } = useAuthGuard()
    const result = requireLogin('/movie/favorites')
    expect(result).toBe(false)
    expect(window.location.href).toBe(
      `/auth/login?next=${encodeURIComponent('/movie/favorites')}`,
    )
  })
})
