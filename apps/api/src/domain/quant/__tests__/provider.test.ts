import type { TushareProviderError } from '../provider'
import { describe, expect, it, vi } from 'vitest'
import { createEastmoneyProvider, createTushareProvider, resolveQuantProviderName } from '../provider'

describe('quant daily providers', () => {
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

  it('normalizes Eastmoney history K-lines without a token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: {
        code: '601899',
        market: 1,
        klines: [
          '2026-08-20,34.10,34.50,34.66,33.45,4115787,14178910927.00,3.74,1.49,0.50,2.00',
          '2026-08-21,34.25,34.74,34.87,33.60,3007017,10338560003.00,3.75,0.91,0.32,1.46',
        ],
      },
    }), { status: 200 }))
    const provider = createEastmoneyProvider({ fetchImpl })

    await expect(provider.fetchDaily({
      tsCode: '601899.SH',
      startDate: '20260801',
      endDate: '20260831',
    })).resolves.toEqual([
      expect.objectContaining({ tsCode: '601899.SH', tradeDate: '20260820', close: 34.5, pctChg: 1.49 }),
      expect.objectContaining({ tsCode: '601899.SH', tradeDate: '20260821', close: 34.74, pctChg: 0.91 }),
    ])

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('secid=1.601899')
  })

  it('rejects malformed Eastmoney payloads', async () => {
    const provider = createEastmoneyProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ rc: 0, data: null }), { status: 200 })),
    })

    await expect(provider.fetchDaily({
      tsCode: '601899.SH',
      startDate: '20260801',
      endDate: '20260831',
    })).resolves.toEqual([])
  })

  it('selects Tushare only when configured, otherwise uses the free source', () => {
    expect(resolveQuantProviderName({ TUSHARE_TOKEN: 'SERVER_TOKEN' })).toBe('tushare')
    expect(resolveQuantProviderName({})).toBe('eastmoney')
    expect(resolveQuantProviderName({ QUANT_DATA_PROVIDER: 'eastmoney', TUSHARE_TOKEN: 'SERVER_TOKEN' })).toBe('eastmoney')
    expect(resolveQuantProviderName({ QUANT_DATA_PROVIDER: 'unknown' })).toBeNull()
  })
})
