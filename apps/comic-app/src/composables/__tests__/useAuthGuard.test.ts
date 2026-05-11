/**
 * useAuthGuard composable 单元测试（comic-app）
 * 覆盖：ACCESS-05（未登录收藏拦截跳转行为）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUserStore } from '../../stores/user'
import { useAuthGuard } from '../useAuthGuard'

// mock useUserStore
vi.mock('../../stores/user', () => ({
  useUserStore: vi.fn(),
}))

describe('useAuthGuard (comic-app)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('window', {
      location: {
        href: '',
        pathname: '/comic/detail/456',
        search: '',
        origin: 'http://localhost:3000',
      },
    })
  })

  it('已登录时 requireLogin() 返回 true，不修改 location.href', () => {
    vi.mocked(useUserStore).mockReturnValue({ user: { id: '1', name: 'test' } } as any)
    const { requireLogin } = useAuthGuard()
    expect(requireLogin()).toBe(true)
    expect(window.location.href).toBe('')
  })

  it('未登录时 requireLogin() 返回 false 并跳转', () => {
    vi.mocked(useUserStore).mockReturnValue({ user: null } as any)
    const { requireLogin } = useAuthGuard()
    expect(requireLogin()).toBe(false)
    expect(window.location.href).toBe(
      `/auth/login?next=${encodeURIComponent('/comic/detail/456')}`,
    )
  })

  it('未登录时传入自定义 nextPath，跳转使用自定义路径', () => {
    vi.mocked(useUserStore).mockReturnValue({ user: null } as any)
    const { requireLogin } = useAuthGuard()
    const result = requireLogin('/comic/favorites')
    expect(result).toBe(false)
    expect(window.location.href).toBe(
      `/auth/login?next=${encodeURIComponent('/comic/favorites')}`,
    )
  })
})
