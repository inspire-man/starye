import type { TushareProviderError } from '../provider'
import { describe, expect, it, vi } from 'vitest'
import { createEastmoneyFinancialProvider, createEastmoneyProvider, createEastmoneyValuationProvider, createTushareProvider, resolveQuantProviderName } from '../provider'

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

  it('rejects whitespace-only Eastmoney daily values instead of coercing them to zero', async () => {
    const provider = createEastmoneyProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        rc: 0,
        data: {
          code: '601899',
          market: 1,
          klines: ['2026-08-21,34.25, ,34.87,33.60,3007017,10338560003.00,3.75,0.91,0.32,1.46'],
        },
      }), { status: 200 })),
    })

    await expect(provider.fetchDaily({
      tsCode: '601899.SH',
      startDate: '20260801',
      endDate: '20260831',
    })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('normalizes Eastmoney valuation fields and preserves nullable values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: {
        f57: '601899',
        f162: 11.79,
        f163: '17.84',
        f164: 13.65,
        f165: 2.46,
        f166: '   ',
        f168: 1.46,
        f116: 923761425968.28,
      },
    }), { status: 200 }))
    const provider = createEastmoneyValuationProvider({
      fetchImpl,
      now: () => new Date('2026-08-23T00:00:00.000Z'),
    })

    await expect(provider.fetchValuation({ tsCode: '601899.SH' })).resolves.toEqual({
      tsCode: '601899.SH',
      observedAt: '2026-08-23T00:00:00.000Z',
      dynamicPe: 11.79,
      peTtm: 17.84,
      peStatic: 13.65,
      pb: 2.46,
      ps: null,
      peg: 1.46,
      marketCap: 923761425968.28,
    })
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('secid=1.601899')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('f162')
  })

  it('fails closed when Eastmoney valuation has no stock body', async () => {
    const provider = createEastmoneyValuationProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ rc: 0, data: null }), { status: 200 })),
    })

    await expect(provider.fetchValuation({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('maps Eastmoney valuation requests to SH, SZ, and BJ markets', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const code = new URL(input.toString()).searchParams.get('secid')?.split('.')[1] || ''
      return new Response(JSON.stringify({ rc: 0, data: { f57: code } }), { status: 200 })
    })
    const provider = createEastmoneyValuationProvider({ fetchImpl })

    await provider.fetchValuation({ tsCode: '601899.SH' })
    await provider.fetchValuation({ tsCode: '000001.SZ' })
    await provider.fetchValuation({ tsCode: '430047.BJ' })

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('secid=1.601899')
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('secid=0.000001')
    expect(String(fetchImpl.mock.calls[2]?.[0])).toContain('secid=0.430047')
  })

  it('returns a timeout error when the Eastmoney valuation request is aborted', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }))
      const provider = createEastmoneyValuationProvider({ fetchImpl, timeoutMs: 20 })
      const pending = provider.fetchValuation({ tsCode: '601899.SH' })
      const expectation = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' })

      await vi.advanceTimersByTimeAsync(20)
      await expectation
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('normalizes the latest Eastmoney financial report and preserves nullable metrics', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      pages: 2,
      data: [
        {
          SECURITY_CODE: '601899',
          REPORT_DATE: '2025-12-31 00:00:00',
          REPORT_TYPE: '年报',
          REPORT_DATE_NAME: '2025年报',
          NOTICE_DATE: '2026-03-21 00:00:00',
          TOTALOPERATEREVE: 303639957153,
          TOTALOPERATEREVETZ: 3.48,
          PARENTNETPROFIT: 32050602437,
          PARENTNETPROFITTZ: 51.75,
          KCFJCXSYJLR: 31692529659,
          KCFJCXSYJLRTZ: 46.61,
          ROEJQ: 25.89,
          XSMLL: 20.37,
          XSJLL: 12.97,
          ZCFZL: 55.18,
          JYXJLYYSR: 0.16,
          ROIC: '-',
        },
        {
          SECURITY_CODE: '601899',
          REPORT_DATE: '2026-06-30 00:00:00',
          REPORT_TYPE: '中报',
          REPORT_DATE_NAME: '2026中报',
          NOTICE_DATE: '2026-08-30 00:00:00',
          TOTALOPERATEREVE: '350000000000',
          TOTALOPERATEREVETZ: '15.78',
          PARENTNETPROFIT: '41000000000',
          PARENTNETPROFITTZ: '68.17',
          KCFJCXSYJLR: null,
          KCFJCXSYJLRTZ: null,
          ROEJQ: 19.6,
          XSMLL: 37.74,
          XSJLL: 16.2,
          ZCFZL: 49.55,
          JYXJLYYSR: 0.28,
          ROIC: 11.75,
        },
      ],
      count: 2,
    }), { status: 200 }))
    const provider = createEastmoneyFinancialProvider({
      fetchImpl,
      now: () => new Date('2026-08-23T00:00:00.000Z'),
    })

    await expect(provider.fetchFinancialQuality({ tsCode: '601899.SH' })).resolves.toEqual({
      tsCode: '601899.SH',
      observedAt: '2026-08-23T00:00:00.000Z',
      reportDate: '2026-06-30',
      reportType: '中报',
      reportDateName: '2026中报',
      noticeDate: '2026-08-30',
      revenue: 350000000000,
      revenueYoY: 15.78,
      netProfit: 41000000000,
      netProfitYoY: 68.17,
      adjustedNetProfit: null,
      adjustedNetProfitYoY: null,
      roe: 19.6,
      grossMargin: 37.74,
      netMargin: 16.2,
      debtAssetRatio: 49.55,
      operatingCashflowToRevenue: 0.28,
      roic: 11.75,
    })
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('code=SH601899')
  })

  it('returns recent Eastmoney financial reports in descending report-date order', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { SECURITY_CODE: '601899', REPORT_DATE: '2025-12-31 00:00:00', REPORT_TYPE: '年报' },
        { SECURITY_CODE: '601899', REPORT_DATE: '2026-06-30 00:00:00', REPORT_TYPE: '中报' },
      ],
    }), { status: 200 }))
    const provider = createEastmoneyFinancialProvider({ fetchImpl })

    await expect(provider.fetchFinancialQualityHistory({ tsCode: '601899.SH', limit: 2 })).resolves.toMatchObject([
      { reportDate: '2026-06-30', reportType: '中报' },
      { reportDate: '2025-12-31', reportType: '年报' },
    ])
  })

  it('maps Eastmoney financial requests to SH, SZ, and BJ markets', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const code = new URL(input.toString()).searchParams.get('code') || ''
      return new Response(JSON.stringify({
        data: [{ SECURITY_CODE: code.slice(2), REPORT_DATE: '2026-06-30 00:00:00' }],
      }), { status: 200 })
    })
    const provider = createEastmoneyFinancialProvider({ fetchImpl })

    await provider.fetchFinancialQuality({ tsCode: '601899.SH' })
    await provider.fetchFinancialQuality({ tsCode: '000001.SZ' })
    await provider.fetchFinancialQuality({ tsCode: '430047.BJ' })

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('code=SH601899')
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('code=SZ000001')
    expect(String(fetchImpl.mock.calls[2]?.[0])).toContain('code=BJ430047')
  })

  it('fails closed for empty, malformed, and mismatched Eastmoney financial responses', async () => {
    const empty = createEastmoneyFinancialProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 })),
    })
    await expect(empty.fetchFinancialQuality({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    const malformed = createEastmoneyFinancialProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response('{bad-json', { status: 200 })),
    })
    await expect(malformed.fetchFinancialQuality({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    const mismatched = createEastmoneyFinancialProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        data: [{ SECURITY_CODE: '600000', REPORT_DATE: '2026-06-30 00:00:00' }],
      }), { status: 200 })),
    })
    await expect(mismatched.fetchFinancialQuality({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('returns a timeout error when the Eastmoney financial request is aborted', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }))
      const provider = createEastmoneyFinancialProvider({ fetchImpl, timeoutMs: 20 })
      const pending = provider.fetchFinancialQuality({ tsCode: '601899.SH' })
      const expectation = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' })

      await vi.advanceTimersByTimeAsync(20)
      await expectation
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('selects Tushare only when configured, otherwise uses the free source', () => {
    expect(resolveQuantProviderName({ TUSHARE_TOKEN: 'SERVER_TOKEN' })).toBe('tushare')
    expect(resolveQuantProviderName({})).toBe('eastmoney')
    expect(resolveQuantProviderName({ QUANT_DATA_PROVIDER: 'eastmoney', TUSHARE_TOKEN: 'SERVER_TOKEN' })).toBe('eastmoney')
    expect(resolveQuantProviderName({ QUANT_DATA_PROVIDER: 'unknown' })).toBeNull()
  })
})
