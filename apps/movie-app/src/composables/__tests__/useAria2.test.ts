import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../../lib/api-client'
import { useAria2 } from '../useAria2'

vi.mock('../../lib/api-client', () => ({
  authApi: {
    getSession: vi.fn(),
  },
}))

vi.mock('../useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('useAria2', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('does not request protected configuration without a session', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null)

    await useAria2().loadConfig()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads a signed-in configuration through the canonical API path', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 0,
        data: { rpcUrl: 'http://aria2.local:6800/jsonrpc', useProxy: true },
      }),
    } as Response)

    await useAria2().loadConfig()

    expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/aria2/config', {
      credentials: 'include',
    })
  })
})
