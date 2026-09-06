import type { AppEnv } from '../../../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuantRouteTestApp } from './route-test-helpers'

describe('quant market route contract', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires authentication for valuation comparison', async () => {
    const response = await createQuantRouteTestApp(null).request('/api/quant/valuation/compare/601899.SH')
    expect(response.status).toBe(401)
  })

  it('requires authentication for financial quality', async () => {
    const response = await createQuantRouteTestApp(null).request('/api/quant/financial/601899.SH')
    expect(response.status).toBe(401)
  })

  it('requires authentication for the batch value-quality score', async () => {
    const response = await createQuantRouteTestApp(null).request('/api/quant/value-selection')
    expect(response.status).toBe(401)
  })

  it('requires authentication for shareholder returns', async () => {
    const response = await createQuantRouteTestApp(null).request('/api/quant/shareholder-returns')
    expect(response.status).toBe(401)
  })

  it('returns a normalized valuation snapshot for an authenticated admin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: {
        f57: '601899',
        f162: 11.79,
        f163: 17.84,
        f164: 13.65,
        f165: 2.46,
        f166: 9.05,
        f168: 1.46,
        f116: 923761425968.28,
      },
    }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/valuation/601899.SH')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        tsCode: '601899.SH',
        dynamicPe: 11.79,
        peTtm: 17.84,
        pb: 2.46,
        peg: 1.46,
        marketCap: 923761425968.28,
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('passes the configured Eastmoney origin to valuation reads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: { f57: '601899', f162: 11.79 },
    }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/valuation/601899.SH', {}, {
      EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test',
      EASTMONEY_TIMEOUT_MS: '2500',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('https://eastmoney.fixture.test/api/qt/stock/get')
  })

  it('maps valuation upstream errors to the Quant route contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ rc: 0, data: null }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/valuation/601899.SH')

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'QUANT_PROVIDER_INVALID_RESPONSE',
    })
  })

  it('returns a normalized financial quality snapshot for an authenticated admin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{
        SECURITY_CODE: '601899',
        REPORT_DATE: '2026-06-30 00:00:00',
        REPORT_TYPE: '中报',
        REPORT_DATE_NAME: '2026中报',
        NOTICE_DATE: '2026-08-30 00:00:00',
        TOTALOPERATEREVE: 350000000000,
        TOTALOPERATEREVETZ: 15.78,
        PARENTNETPROFIT: 41000000000,
        PARENTNETPROFITTZ: 68.17,
        KCFJCXSYJLR: null,
        KCFJCXSYJLRTZ: null,
        ROEJQ: 19.6,
        XSMLL: 37.74,
        XSJLL: 16.2,
        ZCFZL: 49.55,
        JYXJLYYSR: 0.28,
        ROIC: 11.75,
      }],
    }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/financial/601899.SH')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        tsCode: '601899.SH',
        reportDate: '2026-06-30',
        revenueYoY: 15.78,
        netProfitYoY: 68.17,
        adjustedNetProfit: null,
        roe: 19.6,
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('passes the configured Eastmoney origin to financial reads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ SECURITY_CODE: '601899', REPORT_DATE: '2026-06-30 00:00:00' }],
    }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/financial/601899.SH', {}, {
      EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test',
      EASTMONEY_TIMEOUT_MS: '2500',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('https://eastmoney.fixture.test/PC_HSF10/NewFinanceAnalysis/ZYZBAjaxNew')
  })

  it('uses Tushare financial indicators when explicitly selected and supplements them with Eastmoney', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === 'https://tushare.fixture.test') {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            fields: ['ts_code', 'ann_date', 'end_date', 'roe'],
            items: [['601899.SH', '20260830', '20260630', 12.5]],
          },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: [{
          SECURITY_CODE: '601899',
          REPORT_DATE: '2026-06-30 00:00:00',
          XSMLL: 30,
          XSJLL: 12,
          ZCFZL: 45,
        }],
      }), { status: 200 })
    })

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/financial/601899.SH', {}, {
      QUANT_DATA_PROVIDER: 'tushare',
      TUSHARE_TOKEN: 'fixture-token',
      TUSHARE_BASE_URL: 'https://tushare.fixture.test',
      EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        provider: 'tushare',
        supplementalProvider: 'eastmoney',
        supplementUsed: true,
        roe: 12.5,
        grossMargin: 30,
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses configured AkShare bridge rows to supplement an Eastmoney financial report', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input))
      if (url.origin === 'https://bridge.fixture.test') {
        return new Response(JSON.stringify({
          schema_version: 'quant-akshare-v1',
          provider: 'akshare',
          request_id: 'bridge-request-1',
          ts_code: '601899.SH',
          observed_at: '2026-09-06T00:00:00.000Z',
          status: 'partial',
          source: { adapter: 'akshare-adapter-v1', endpoints: ['stock_financial_analysis_indicator'], formula_version: 'akshare-adapter-v1' },
          identity: { name: '紫金矿业' },
          daily_bars: [],
          financials: [{ ts_code: '601899.SH', report_date: '20260630', gross_margin: 28, roe: 16 }],
          cashflows: [],
          evidence: [],
          errors: [{ code: 'AKSHARE_CASHFLOW_UNAVAILABLE', message: 'AkShare cashflow data is unavailable', source: 'cashflow' }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        data: [{
          SECURITY_CODE: '601899',
          REPORT_DATE: '2026-06-30 00:00:00',
          ROEJQ: null,
          XSMLL: null,
        }],
      }), { status: 200 })
    })

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/financial/601899.SH', {}, {
      EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test',
      QUANT_AKSHARE_BRIDGE_URL: 'https://bridge.fixture.test',
      QUANT_AKSHARE_BRIDGE_TOKEN: 'bridge-token',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        provider: 'eastmoney',
        supplementalProvider: 'akshare',
        supplementUsed: true,
        grossMargin: 28,
        roe: 16,
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const bridgeCall = fetchMock.mock.calls.find(call => String(call[0]).startsWith('https://bridge.fixture.test/'))
    expect((bridgeCall?.[1] as RequestInit | undefined)?.headers).toMatchObject({ authorization: 'Bearer bridge-token' })
  })

  it('returns recent financial history in report-date order', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        { SECURITY_CODE: '601899', REPORT_DATE: '2025-12-31 00:00:00', REPORT_TYPE: '年报' },
        { SECURITY_CODE: '601899', REPORT_DATE: '2026-06-30 00:00:00', REPORT_TYPE: '中报' },
      ],
    }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/financial/history/601899.SH?limit=2')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        tsCode: '601899.SH',
        reports: [
          { reportDate: '2026-06-30', reportType: '中报' },
          { reportDate: '2025-12-31', reportType: '年报' },
        ],
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('maps a financial upstream failure to the Quant route contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/financial/601899.SH')

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'QUANT_PROVIDER_INVALID_RESPONSE',
    })
  })
})
