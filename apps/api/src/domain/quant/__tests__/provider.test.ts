import type { TushareProviderError } from '../provider'
import { describe, expect, it, vi } from 'vitest'
import { createTushareProvider } from '../provider'

describe('tushare daily provider', () => {
  it('normalizes the declared daily response and keeps the token server-side', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      data: {
        fields: ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol'],
        items: [['000001.SZ', '20260821', 10, 11, 9.5, 10.5, 1200]],
      },
    }), { status: 200 }))
    const provider = createTushareProvider({ token: 'SERVER_TOKEN', fetchImpl })

    await expect(provider.fetchDaily({
      tsCode: '000001.sz',
      startDate: '20260801',
      endDate: '20260821',
    })).resolves.toEqual([expect.objectContaining({
      tsCode: '000001.SZ',
      tradeDate: '20260821',
      close: 10.5,
      volume: 1200,
    })])

    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      api_name: 'daily',
      token: 'SERVER_TOKEN',
      params: { ts_code: '000001.SZ' },
    })
  })

  it('rejects unknown api names before making an HTTP request', async () => {
    const fetchImpl = vi.fn()
    const provider = createTushareProvider({ token: 'SERVER_TOKEN', fetchImpl })

    await expect(provider.request({ apiName: 'daily_basic', params: {} })).rejects.toMatchObject({
      code: 'UNKNOWN_API',
    } satisfies Partial<TushareProviderError>)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails closed when the token is missing or the upstream quota is exhausted', async () => {
    const missing = createTushareProvider({ fetchImpl: vi.fn() })
    await expect(missing.fetchDaily({ tsCode: '000001.SZ', startDate: '20260801', endDate: '20260821' })).rejects.toMatchObject({ code: 'TOKEN_MISSING' })

    const quota = createTushareProvider({
      token: 'SERVER_TOKEN',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 402, msg: 'quota exhausted' }), { status: 200 })),
    })
    await expect(quota.fetchDaily({ tsCode: '000001.SZ', startDate: '20260801', endDate: '20260821' })).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' })
  })
})
