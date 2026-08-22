import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QUANT_API_PREFIX, quantApi } from '../api-client'

describe('quantApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the quant API prefix and normalizes capability responses', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        tier: 120,
        enabled: ['daily'],
        capabilities: [
          { key: 'daily', enabled: true, reason: '可用' },
          { key: 'daily_basic', enabled: false, reason: '需要更高积分' },
        ],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await quantApi.getCapabilities()

    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/capabilities`, expect.objectContaining({
      credentials: 'include',
    }))
    expect(result.tier).toBe(120)
    expect(result.capabilities.find(item => item.key === 'daily_basic')?.reason).toBe('需要更高积分')
  })

  it('sends watchlist mutations without credentials in the request body', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'watch-1', ts_code: '000001.SZ', name: '平安银行' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.addWatchlist({ tsCode: '000001.SZ', name: '平安银行' })).resolves.toMatchObject({
      tsCode: '000001.SZ',
      name: '平安银行',
    })

    const [, init] = fetchMock.mock.calls[0] || []
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ ts_code: '000001.SZ', name: '平安银行' }))
    expect(init?.body).not.toContain('token')
  })

  it('keeps the server reason when a sync is rejected by an active lease', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      code: 'QUANT_SYNC_IN_PROGRESS',
      error: 'Quant daily sync is already running',
      details: null,
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })))

    await expect(quantApi.syncDaily()).resolves.toMatchObject({
      status: 'rejected',
      reason: 'Quant daily sync is already running',
    })
  })
})
