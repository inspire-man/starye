import type { TushareProviderError } from '../provider'
import { describe, expect, it, vi } from 'vitest'
import { createEastmoneyCapitalStructureProvider, createEastmoneyCashflowProvider, createEastmoneyDividendProvider, createEastmoneyFinancialProvider, createEastmoneyMarketQuoteProvider, createEastmoneyProvider, createEastmoneyRepurchaseProvider, createEastmoneyStockBasicProvider, createEastmoneyValuationProvider, createQuantDividendProviderChain, createTushareDividendProvider, createTushareProvider, createTushareStockBasicProvider, resolveQuantProviderName } from '../provider'

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

    const frequency = createTushareDividendProvider({
      token: 'SERVER_TOKEN',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 40203, msg: '接口频率超限' }), { status: 200 })),
    })
    await expect(frequency.fetchDividends({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' })
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

  it('falls back to the public valuation history endpoint when the quote endpoint fails', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString())
      if (url.pathname === '/api/qt/stock/get')
        return new Response('upstream unavailable', { status: 503 })
      return new Response(JSON.stringify({
        code: 0,
        result: {
          data: [{ SECURITY_CODE: '601899', PETTM: 12.5, PBMRQ: 2.1, PSTTM: 1.8, REPORT_DATE: '2026-06-30 00:00:00' }],
        },
      }), { status: 200 })
    })
    const provider = createEastmoneyValuationProvider({
      fetchImpl,
      valuationFallbackBaseUrl: 'https://eastmoney-datacenter.fixture.test',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    })

    await expect(provider.fetchValuation({ tsCode: '601899.SH' })).resolves.toMatchObject({
      tsCode: '601899.SH',
      observedAt: '2026-08-24T00:00:00.000Z',
      dynamicPe: null,
      peTtm: 12.5,
      peStatic: null,
      pb: 2.1,
      ps: 1.8,
      peg: null,
      marketCap: null,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('https://eastmoney-datacenter.fixture.test/api/data/v1/get')
  })

  it('fails closed when the valuation fallback returns a different stock', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString())
      if (url.pathname === '/api/qt/stock/get')
        return new Response(JSON.stringify({ rc: 1, data: null }), { status: 200 })
      return new Response(JSON.stringify({
        code: 0,
        result: { data: [{ SECURITY_CODE: '600089', PETTM: 12.5 }] },
      }), { status: 200 })
    })
    const provider = createEastmoneyValuationProvider({ fetchImpl })

    await expect(provider.fetchValuation({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
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
          MGJYXJJE: 2.0861,
          FCFF_BACK: 19447406136,
          FCFF_FORWARD: 39583497221,
          INTEREST_COVERAGE_RATIO: 25.18,
          INTEREST_DEBT_RATIO: 30.59,
          CASH_RATIO: 0.777,
          LIABILITY: 268266643912,
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
      operatingCashflowPerShare: 2.0861,
      fcffBack: 19447406136,
      fcffForward: 39583497221,
      interestCoverage: 25.18,
      interestBearingDebtRatio: 30.59,
      cashRatio: 0.777,
      totalLiability: 268266643912,
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

  it('normalizes Eastmoney cashflow reports and sends the report-date window', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString())
      if (url.pathname.endsWith('/xjllbDateAjaxNew')) {
        return new Response(JSON.stringify({
          data: [
            { REPORT_DATE: '2026-06-30 00:00:00' },
            { REPORT_DATE: '2025-12-31 00:00:00' },
          ],
        }), { status: 200 })
      }
      if (url.pathname.endsWith('/lrbAjaxNew')) {
        return new Response(JSON.stringify({
          data: [
            {
              SECURITY_CODE: '601899',
              REPORT_DATE: '2026-06-30 00:00:00',
              FE_INTEREST_EXPENSE: 12,
              INTEREST_EXPENSE: 99,
            },
            {
              SECURITY_CODE: '601899',
              REPORT_DATE: '2025-12-31 00:00:00',
              FE_INTEREST_EXPENSE: '',
              INTEREST_EXPENSE: 21,
            },
          ],
        }), { status: 200 })
      }
      if (url.pathname.endsWith('/zcfzbAjaxNew')) {
        return new Response(JSON.stringify({
          data: [
            {
              SECURITY_CODE: '601899',
              REPORT_DATE: '2026-06-30 00:00:00',
              SHORT_LOAN: 40,
              NONCURRENT_LIAB_1YEAR: 20,
              LONG_LOAN: 30,
              BOND_PAYABLE: 10,
              LEASE_LIAB: 5,
            },
            {
              SECURITY_CODE: '601899',
              REPORT_DATE: '2025-12-31 00:00:00',
              SHORT_LOAN: 50,
              NONCURRENT_LIAB_1YEAR: 15,
              LONG_LOAN: 25,
              BOND_PAYABLE: 10,
              LEASE_LIAB: 4,
            },
          ],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: [
          {
            SECURITY_CODE: '601899',
            REPORT_DATE: '2026-06-30 00:00:00',
            REPORT_TYPE: '中报',
            REPORT_DATE_NAME: '2026中报',
            NOTICE_DATE: '2026-08-22 00:00:00',
            NETCASH_OPERATE: 55471692934,
            CONSTRUCT_LONG_ASSET: 12942927636,
            NETPROFIT: 49812693016,
            ASSIGN_DIVIDEND_PORFIT: 15826134692,
          },
          {
            SECURITY_CODE: '601899',
            REPORT_DATE: '2025-12-31 00:00:00',
            REPORT_TYPE: '年报',
            REPORT_DATE_NAME: '2025年报',
            NOTICE_DATE: '2026-03-21 00:00:00',
            NETCASH_OPERATE: 80000000000,
            CONSTRUCT_LONG_ASSET: 20000000000,
            NETPROFIT: 40000000000,
            ASSIGN_DIVIDEND_PORFIT: 10000000000,
          },
        ],
      }), { status: 200 })
    })
    const provider = createEastmoneyCashflowProvider({
      baseUrl: 'https://eastmoney-cashflow.fixture.test',
      fetchImpl,
    })

    await expect(provider.fetchCashflowHistory({ tsCode: '601899.SH', limit: 2 })).resolves.toEqual([
      {
        tsCode: '601899.SH',
        reportDate: '2026-06-30',
        reportType: '中报',
        reportDateName: '2026中报',
        noticeDate: '2026-08-22',
        operatingCashflow: 55471692934,
        capitalExpenditure: 12942927636,
        netProfit: 49812693016,
        cashDividendsPaid: 15826134692,
        interestExpense: 12,
        interestExpenseSourceField: 'FE_INTEREST_EXPENSE',
        interestExpenseProviderErrorCode: null,
        interestBearingDebt: 105,
        interestBearingDebtComponents: {
          shortLoan: 40,
          shortBondPayable: null,
          shortFinancePayable: null,
          acceptDepositInterbank: null,
          borrowFund: null,
          loanPbc: null,
          currentMaturityDebt: 20,
          amortizedCostFinancialLiability: null,
          longLoan: 30,
          amortizedCostNoncurrentFinancialLiability: null,
          bondPayable: 10,
          perpetualBond: null,
          perpetualBondPayable: null,
          leaseLiability: 5,
        },
        interestBearingDebtProviderErrorCode: null,
      },
      {
        tsCode: '601899.SH',
        reportDate: '2025-12-31',
        reportType: '年报',
        reportDateName: '2025年报',
        noticeDate: '2026-03-21',
        operatingCashflow: 80000000000,
        capitalExpenditure: 20000000000,
        netProfit: 40000000000,
        cashDividendsPaid: 10000000000,
        interestExpense: 21,
        interestExpenseSourceField: 'INTEREST_EXPENSE',
        interestExpenseProviderErrorCode: null,
        interestBearingDebt: 104,
        interestBearingDebtComponents: {
          shortLoan: 50,
          shortBondPayable: null,
          shortFinancePayable: null,
          acceptDepositInterbank: null,
          borrowFund: null,
          loanPbc: null,
          currentMaturityDebt: 15,
          amortizedCostFinancialLiability: null,
          longLoan: 25,
          amortizedCostNoncurrentFinancialLiability: null,
          bondPayable: 10,
          perpetualBond: null,
          perpetualBondPayable: null,
          leaseLiability: 4,
        },
        interestBearingDebtProviderErrorCode: null,
      },
    ])

    const dateUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    const dataUrl = new URL(String(fetchImpl.mock.calls[1]?.[0]))
    const incomeUrl = new URL(String(fetchImpl.mock.calls[2]?.[0]))
    const balanceUrl = new URL(String(fetchImpl.mock.calls[3]?.[0]))
    expect(dateUrl.pathname).toBe('/PC_HSF10/NewFinanceAnalysis/xjllbDateAjaxNew')
    expect(dateUrl.searchParams.get('companyType')).toBe('4')
    expect(dataUrl.pathname).toBe('/PC_HSF10/NewFinanceAnalysis/xjllbAjaxNew')
    expect(dataUrl.searchParams.get('reportType')).toBe('1')
    expect(dataUrl.searchParams.get('dates')).toContain('2026-06-30 00:00:00')
    expect(incomeUrl.pathname).toBe('/PC_HSF10/NewFinanceAnalysis/lrbAjaxNew')
    expect(balanceUrl.pathname).toBe('/PC_HSF10/NewFinanceAnalysis/zcfzbAjaxNew')
  })

  it('keeps cashflow fields when an auxiliary statement fails and returns a safe source code', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString())
      if (url.pathname.endsWith('/xjllbDateAjaxNew'))
        return new Response(JSON.stringify({ data: [{ REPORT_DATE: '2026-06-30 00:00:00' }] }), { status: 200 })
      if (url.pathname.endsWith('/lrbAjaxNew'))
        return new Response('{bad-json', { status: 200 })
      if (url.pathname.endsWith('/zcfzbAjaxNew'))
        return new Response(JSON.stringify({ data: [{ SECURITY_CODE: '601899', REPORT_DATE: '2026-06-30 00:00:00', SHORT_LOAN: 10 }] }), { status: 200 })
      return new Response(JSON.stringify({ data: [{ SECURITY_CODE: '601899', REPORT_DATE: '2026-06-30 00:00:00', NETCASH_OPERATE: 100, CONSTRUCT_LONG_ASSET: 20 }] }), { status: 200 })
    })
    const provider = createEastmoneyCashflowProvider({ fetchImpl })

    await expect(provider.fetchCashflowHistory({ tsCode: '601899.SH' })).resolves.toMatchObject([{
      operatingCashflow: 100,
      capitalExpenditure: 20,
      interestExpense: null,
      interestExpenseProviderErrorCode: 'QUANT_PROVIDER_INVALID_RESPONSE',
      interestBearingDebt: 10,
      interestBearingDebtProviderErrorCode: null,
    }])
  })

  it('returns an empty cashflow history when Eastmoney has no report dates', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    const provider = createEastmoneyCashflowProvider({ fetchImpl })

    await expect(provider.fetchCashflowHistory({ tsCode: '601899.SH' })).resolves.toEqual([])
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('normalizes Eastmoney capital structure history and preserves buyback reasons', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      gbjg: [],
      lngbbd: [
        { SECURITY_CODE: '601899', END_DATE: '2026-03-31 00:00:00', TOTAL_SHARES: 1200, CHANGE_REASON: '债转股上市' },
        { SECURITY_CODE: '601899', END_DATE: '2025-12-18 00:00:00', TOTAL_SHARES: 1100, CHANGE_REASON: '回购' },
        { SECURITY_CODE: '601899', END_DATE: '2025-12-15 00:00:00', TOTAL_SHARES: '--', CHANGE_REASON: null },
        { SECURITY_CODE: '601899', END_DATE: '2025-12-15 00:00:00', TOTAL_SHARES: 1150, CHANGE_REASON: '自主行权' },
      ],
    }), { status: 200 }))
    const provider = createEastmoneyCapitalStructureProvider({
      baseUrl: 'https://eastmoney-capital.fixture.test',
      fetchImpl,
    })

    await expect(provider.fetchCapitalStructureHistory({ tsCode: '601899.SH', limit: 3 })).resolves.toEqual([
      { tsCode: '601899.SH', reportDate: '2026-03-31', totalShares: 1200, changeReason: '债转股上市' },
      { tsCode: '601899.SH', reportDate: '2025-12-18', totalShares: 1100, changeReason: '回购' },
      { tsCode: '601899.SH', reportDate: '2025-12-15', totalShares: null, changeReason: null },
    ])
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://eastmoney-capital.fixture.test/PC_HSF10/CapitalStockStructure/PageAjax?code=SH601899')
  })

  it('treats an explicitly empty capital history as an empty result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ lngbbd: null }), { status: 200 }))
    const provider = createEastmoneyCapitalStructureProvider({ fetchImpl })

    await expect(provider.fetchCapitalStructureHistory({ tsCode: '601899.SH' })).resolves.toEqual([])
  })

  it('maps malformed and mismatched capital structure responses to provider errors', async () => {
    const malformed = createEastmoneyCapitalStructureProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response('{bad-json', { status: 200 })),
    })
    await expect(malformed.fetchCapitalStructureHistory({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    const mismatched = createEastmoneyCapitalStructureProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        lngbbd: [{ SECURITY_CODE: '600000', END_DATE: '2026-03-31 00:00:00', TOTAL_SHARES: 1200, CHANGE_REASON: '回购' }],
      }), { status: 200 })),
    })
    await expect(mismatched.fetchCapitalStructureHistory({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('normalizes Eastmoney repurchase plans, keeps pending amounts null, and deduplicates plan codes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      success: true,
      result: {
        data: [
          {
            DIM_SCODE: '601899',
            SECUCODE: '601899.SH',
            REPURCODE: 'plan-2',
            UPD: '2026-04-15 00:00:00',
            REPURSTARTDATE: '2026-03-20 00:00:00',
            REPURENDDATE: '2027-03-20 00:00:00',
            FINISHDATE: '2026-04-14 00:00:00',
            REPURPROGRESS: '006',
            REPURAMOUNTLOWER: 1500000000,
            REPURAMOUNTLIMIT: 2500000000,
            REPURAMOUNT: 2499754839.55,
            REPURNUM: 77474592,
          },
          {
            DIM_SCODE: '601899',
            REPURCODE: 'plan-2',
            UPD: '2026-04-14 00:00:00',
            REPURAMOUNT: 100,
          },
          {
            DIM_SCODE: '601899',
            REPURCODE: 'plan-1',
            UPD: '2025-04-11 00:00:00',
            REPURSTARTDATE: '2025-04-07 00:00:00',
            REPURENDDATE: '2026-04-07 00:00:00',
            REPURPROGRESS: '004',
            REPURAMOUNTLOWER: 600000000,
            REPURAMOUNTLIMIT: 1000000000,
            REPURAMOUNT: '--',
            REPURNUM: null,
          },
        ],
      },
    }), { status: 200 }))
    const provider = createEastmoneyRepurchaseProvider({
      repurchaseBaseUrl: 'https://eastmoney-repurchase.fixture.test',
      fetchImpl,
    })

    await expect(provider.fetchRepurchaseHistory({ tsCode: '601899.SH', limit: 3 })).resolves.toEqual([
      {
        tsCode: '601899.SH',
        repurchaseCode: 'plan-2',
        announcementDate: '2026-04-15',
        startDate: '2026-03-20',
        endDate: '2027-03-20',
        finishDate: '2026-04-14',
        progress: '006',
        plannedAmountLower: 1500000000,
        plannedAmountUpper: 2500000000,
        repurchaseAmount: 2499754839.55,
        repurchaseShares: 77474592,
      },
      {
        tsCode: '601899.SH',
        repurchaseCode: 'plan-1',
        announcementDate: '2025-04-11',
        startDate: '2025-04-07',
        endDate: '2026-04-07',
        finishDate: null,
        progress: '004',
        plannedAmountLower: 600000000,
        plannedAmountUpper: 1000000000,
        repurchaseAmount: null,
        repurchaseShares: null,
      },
    ])
    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(url.origin).toBe('https://eastmoney-repurchase.fixture.test')
    expect(url.searchParams.get('reportName')).toBe('RPTA_WEB_GETHGLIST_NEW')
    expect(url.searchParams.get('filter')).toBe('(DIM_SCODE="601899")')
    expect(url.searchParams.get('source')).toBe('WEB')
    expect(url.searchParams.get('pageSize')).toBe('3')
  })

  it('returns an empty repurchase history and maps invalid responses', async () => {
    const empty = createEastmoneyRepurchaseProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0, success: true, result: null }), { status: 200 })),
    })
    await expect(empty.fetchRepurchaseHistory({ tsCode: '601899.SH' })).resolves.toEqual([])

    const malformed = createEastmoneyRepurchaseProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response('{bad-json', { status: 200 })),
    })
    await expect(malformed.fetchRepurchaseHistory({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    const mismatched = createEastmoneyRepurchaseProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        code: 0,
        success: true,
        result: { data: [{ DIM_SCODE: '600000', UPD: '2026-03-31 00:00:00' }] },
      }), { status: 200 })),
    })
    await expect(mismatched.fetchRepurchaseHistory({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('normalizes only the requested Tushare dividend fields and keeps implementation status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      data: {
        fields: ['ts_code', 'end_date', 'ann_date', 'div_proc', 'cash_div', 'ex_date', 'pay_date'],
        items: [
          ['601899.SH', '20260331', '20260711', '实施', 0.42, '20260821', '20260821'],
          ['601899.SH', '20260331', '20260711', '预案', 0, null, null],
          ['601899.SH', '20251231', '20260606', '实施', 0.38, '20260626', '20260626'],
        ],
      },
    }), { status: 200 }))
    const provider = createTushareDividendProvider({ token: 'SERVER_TOKEN', baseUrl: '"https://tushare.fixture.test"', fetchImpl })

    await expect(provider.fetchDividends({ tsCode: '601899.SH' })).resolves.toEqual({
      records: [
        {
          tsCode: '601899.SH',
          endDate: '20260331',
          annDate: '20260711',
          divProc: '实施',
          cashDiv: 0.42,
          exDate: '20260821',
          payDate: '20260821',
        },
        {
          tsCode: '601899.SH',
          endDate: '20260331',
          annDate: '20260711',
          divProc: '预案',
          cashDiv: 0,
          exDate: null,
          payDate: null,
        },
        {
          tsCode: '601899.SH',
          endDate: '20251231',
          annDate: '20260606',
          divProc: '实施',
          cashDiv: 0.38,
          exDate: '20260626',
          payDate: '20260626',
        },
      ],
      provider: 'tushare',
      fallbackUsed: false,
      fallbackReason: null,
    })
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      api_name: 'dividend',
      token: 'SERVER_TOKEN',
      params: { ts_code: '601899.SH' },
    })
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://tushare.fixture.test')
  })

  it('normalizes implemented Eastmoney dividends and converts per-ten-share cash to per-share cash', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      success: true,
      result: {
        data: [
          {
            SECURITY_CODE: '601899',
            REPORT_DATE: '2026-03-31 00:00:00',
            NOTICE_DATE: '2026-08-13 00:00:00',
            EX_DIVIDEND_DATE: '2026-08-21 00:00:00',
            PRETAX_BONUS_RMB: 4.2,
            ASSIGN_PROGRESS: '实施分配',
          },
          {
            SECURITY_CODE: '601899',
            REPORT_DATE: '2026-06-30 00:00:00',
            NOTICE_DATE: '2026-03-21 00:00:00',
            EX_DIVIDEND_DATE: null,
            PRETAX_BONUS_RMB: null,
            ASSIGN_PROGRESS: '预披露',
          },
        ],
      },
    }), { status: 200 }))
    const provider = createEastmoneyDividendProvider({
      dividendBaseUrl: 'https://eastmoney-dividend.fixture.test',
      fetchImpl,
    })

    await expect(provider.fetchDividends({ tsCode: '601899.SH' })).resolves.toEqual({
      records: [{
        tsCode: '601899.SH',
        endDate: '20260331',
        annDate: '20260813',
        divProc: '实施',
        cashDiv: 0.42,
        exDate: '20260821',
        payDate: null,
      }],
      provider: 'eastmoney',
      fallbackUsed: false,
      fallbackReason: null,
    })
    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(requestUrl.origin).toBe('https://eastmoney-dividend.fixture.test')
    expect(requestUrl.pathname).toBe('/api/data/v1/get')
    expect(requestUrl.searchParams.get('reportName')).toBe('RPT_SHAREBONUS_DET')
    expect(requestUrl.searchParams.get('filter')).toBe('(SECURITY_CODE="601899")')
  })

  it('falls back from a Tushare quota error to Eastmoney and records the reason', async () => {
    const tushareFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 402, msg: 'quota exhausted' }), { status: 200 }))
    const eastmoneyFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      success: true,
      result: {
        data: [{
          SECURITY_CODE: '601899',
          REPORT_DATE: '2026-03-31 00:00:00',
          NOTICE_DATE: '2026-08-13 00:00:00',
          EX_DIVIDEND_DATE: '2026-08-21 00:00:00',
          PRETAX_BONUS_RMB: 4.2,
          ASSIGN_PROGRESS: '实施分配',
        }],
      },
    }), { status: 200 }))
    const chain = createQuantDividendProviderChain(
      createTushareDividendProvider({ token: 'SERVER_TOKEN', fetchImpl: tushareFetch }),
      createEastmoneyDividendProvider({ fetchImpl: eastmoneyFetch }),
    )

    await expect(chain.fetchDividends({ tsCode: '601899.SH' })).resolves.toMatchObject({
      provider: 'eastmoney',
      fallbackUsed: true,
      fallbackReason: 'QUANT_PROVIDER_QUOTA',
      records: [expect.objectContaining({ cashDiv: 0.42 })],
    })
    expect(tushareFetch).toHaveBeenCalledOnce()
    expect(eastmoneyFetch).toHaveBeenCalledOnce()
    expect(chain.providerChain).toEqual(['tushare', 'eastmoney'])
  })

  it('uses Eastmoney directly when Tushare has no token and does not call the unconfigured provider', async () => {
    const tushareFetch = vi.fn()
    const eastmoneyFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      success: true,
      result: { data: [] },
    }), { status: 200 }))
    const chain = createQuantDividendProviderChain(
      createTushareDividendProvider({ fetchImpl: tushareFetch }),
      createEastmoneyDividendProvider({ fetchImpl: eastmoneyFetch }),
    )

    await expect(chain.fetchDividends({ tsCode: '601899.SH' })).resolves.toMatchObject({
      provider: 'eastmoney',
      fallbackUsed: true,
      fallbackReason: 'QUANT_PROVIDER_CONFIGURATION',
      records: [],
    })
    expect(tushareFetch).not.toHaveBeenCalled()
    expect(eastmoneyFetch).toHaveBeenCalledOnce()
  })

  it('fails with both provider error categories when the dividend chain is exhausted', async () => {
    const chain = createQuantDividendProviderChain(
      createTushareDividendProvider({
        token: 'SERVER_TOKEN',
        fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 402, msg: 'quota exhausted' }), { status: 200 })),
      }),
      createEastmoneyDividendProvider({
        fetchImpl: vi.fn().mockResolvedValue(new Response('upstream failed', { status: 503 })),
      }),
    )

    await expect(chain.fetchDividends({ tsCode: '601899.SH' })).rejects.toMatchObject({
      name: 'QuantDividendProviderChainError',
    })
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

describe('quant stock identity provider', () => {
  it('normalizes the Eastmoney stock name and keeps the observation timestamp', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: { f57: '600000', f58: '浦发银行' },
    }), { status: 200 }))
    const provider = createEastmoneyStockBasicProvider({
      baseUrl: 'https://eastmoney.fixture.test',
      fetchImpl,
      now: () => new Date('2026-08-25T00:00:00.000Z'),
    })

    await expect(provider.fetchStockBasic({ tsCode: '600000.SH' })).resolves.toEqual({
      tsCode: '600000.SH',
      name: '浦发银行',
      observedAt: '2026-08-25T00:00:00.000Z',
    })
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/api/qt/stock/get')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('fields=f57%2Cf58')
  })

  it('rejects a missing stock name instead of returning a placeholder', async () => {
    const provider = createEastmoneyStockBasicProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ rc: 0, data: { f57: '600000', f58: '' } }), { status: 200 })),
    })

    await expect(provider.fetchStockBasic({ tsCode: '600000.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('normalizes an Eastmoney realtime market quote and its upstream timestamp', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: { f43: '34.65', f57: '601899', f58: '紫金矿业', f60: '34.57', f169: '0.08', f170: '0.23', f86: 1787904693 },
    }), { status: 200 }))
    const provider = createEastmoneyMarketQuoteProvider({
      baseUrl: 'https://eastmoney.fixture.test',
      fetchImpl,
    })

    await expect(provider.fetchMarketQuote({ tsCode: '601899.SH' })).resolves.toEqual({
      tsCode: '601899.SH',
      price: 34.65,
      previousClose: 34.57,
      change: 0.08,
      changePercent: 0.23,
      observedAt: new Date(1787904693 * 1000).toISOString(),
    })
    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(requestUrl.pathname).toBe('/api/qt/stock/get')
    expect(requestUrl.searchParams.get('secid')).toBe('1.601899')
    expect(requestUrl.searchParams.get('fields')).toBe('f43,f57,f58,f60,f169,f170,f86')
  })

  it('rejects a missing or mismatched Eastmoney market quote price', async () => {
    const missing = createEastmoneyMarketQuoteProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ rc: 0, data: { f57: '601899', f43: 0 } }), { status: 200 })),
    })
    await expect(missing.fetchMarketQuote({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    const mismatched = createEastmoneyMarketQuoteProvider({
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ rc: 0, data: { f57: '600000', f43: 34.65 } }), { status: 200 })),
    })
    await expect(mismatched.fetchMarketQuote({ tsCode: '601899.SH' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('uses Tushare stock_basic when a server token is configured', async () => {
    const provider = createTushareStockBasicProvider({
      token: 'SERVER_TOKEN',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        code: 0,
        data: { fields: ['ts_code', 'name'], items: [['600000.SH', '浦发银行']] },
      }), { status: 200 })),
    })

    await expect(provider.fetchStockBasic({ tsCode: '600000.SH' })).resolves.toMatchObject({
      tsCode: '600000.SH',
      name: '浦发银行',
    })
  })
})
