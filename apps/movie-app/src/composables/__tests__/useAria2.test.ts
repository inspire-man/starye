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

  it('silently restores a saved proxy connection after loading configuration', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null)
    localStorage.setItem('aria2-config', JSON.stringify({
      rpcUrl: 'http://127.0.0.1:6800/jsonrpc',
      useProxy: true,
    }))
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 0,
        data: { result: { version: '1.37.0' } },
      }),
    } as Response)

    const aria2 = useAria2()
    await aria2.loadConfig()

    expect(aria2.isConnected.value).toBe(true)
    expect(aria2.version.value).toEqual({ version: '1.37.0' })
    expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/aria2/proxy', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('omits the optional addUri options parameter when no options are provided', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null)
    localStorage.setItem('aria2-config', JSON.stringify({
      rpcUrl: 'http://127.0.0.1:6800/jsonrpc',
      useProxy: true,
    }))
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 0,
        data: { result: 'test-gid' },
      }),
    } as Response)

    const aria2 = useAria2()
    await aria2.loadConfig()
    await aria2.addMagnetTask('magnet:?xt=urn:btih:TEST')

    const request = vi.mocked(fetch).mock.calls.at(-1)?.[1]
    expect(JSON.parse(String(request?.body))).toMatchObject({
      method: 'aria2.addUri',
      params: [['magnet:?xt=urn:btih:TEST']],
    })
  })
})
