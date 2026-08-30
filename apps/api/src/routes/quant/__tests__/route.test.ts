import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quantRoutes } from '../index'

function createApp(session: unknown) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('auth', {
      api: { getSession: vi.fn().mockResolvedValue(session) },
    } as any)
    await next()
  })
  app.route('/api/quant', quantRoutes)
  return app
}

describe('quant route contract', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires an authenticated admin session', async () => {
    const response = await createApp(null).request('/api/quant/capabilities')
    expect(response.status).toBe(401)
  })

  it('requires authentication for valuation comparison', async () => {
    const response = await createApp(null).request('/api/quant/valuation/compare/601899.SH')
    expect(response.status).toBe(401)
  })

  it('requires authentication for financial quality', async () => {
    const response = await createApp(null).request('/api/quant/financial/601899.SH')
    expect(response.status).toBe(401)
  })

  it('requires authentication for the batch value-quality score', async () => {
    const response = await createApp(null).request('/api/quant/value-selection')
    expect(response.status).toBe(401)
  })

  it('requires authentication for factor configuration reads and writes', async () => {
    const read = await createApp(null).request('/api/quant/factor-config')
    const write = await createApp(null).request('/api/quant/factor-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 } }),
    })

    expect(read.status).toBe(401)
    expect(write.status).toBe(401)
  })

  it('requires authentication for shareholder returns', async () => {
    const response = await createApp(null).request('/api/quant/shareholder-returns')
    expect(response.status).toBe(401)
  })

  it('returns the source-backed investment knowledge catalog', async () => {
    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/knowledge')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        version: 'investment-knowledge-v3',
        sources: expect.arrayContaining([
          expect.objectContaining({ id: 'article-pingan-20260825', title: '2026半年报业绩增速创七年新高，再谈中国平安' }),
          expect.objectContaining({ id: 'article-key-point', access: 'preview' }),
        ]),
        factors: expect.arrayContaining([
          expect.objectContaining({ id: 'relative-valuation', status: 'active', eligibleInValueQuality: true }),
          expect.objectContaining({ id: 'business-resilience', status: 'active', currentDimension: 'resilience', eligibleInValueQuality: true }),
          expect.objectContaining({ id: 'cashflow-capex-coverage', status: 'partial', eligibleInValueQuality: false }),
        ]),
        aliases: expect.arrayContaining([
          expect.objectContaining({ alias: '变变', tsCode: '600089.SH' }),
          expect.objectContaining({ alias: '海狗', status: 'ambiguous' }),
        ]),
      },
    })
  })

  it('returns the default 120-point capability contract', async () => {
    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/capabilities', {}, {
      TUSHARE_POINTS_TIER: undefined,
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        tier: 120,
        provider: 'eastmoney',
        enabled: ['daily'],
      },
    })
  })

  it('fails closed for an invalid configured tier', async () => {
    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/capabilities', {}, {
      TUSHARE_POINTS_TIER: '-1',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { tier: null, enabled: [] },
    })
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

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/valuation/601899.SH')

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

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/valuation/601899.SH', {}, {
      EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test',
      EASTMONEY_TIMEOUT_MS: '2500',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('https://eastmoney.fixture.test/api/qt/stock/get')
  })

  it('returns a normalized stock identity from the configured Eastmoney origin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: { f57: '600000', f58: '浦发银行' },
    }), { status: 200 }))

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/stock-basic/600000.SH', {}, {
      EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { tsCode: '600000.SH', name: '浦发银行' },
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('fields=f57%2Cf58')
  })

  it('uses Tushare stock_basic when the Quant provider is Tushare', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      data: { fields: ['ts_code', 'name'], items: [['600000.SH', '浦发银行']] },
    }), { status: 200 }))

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/stock-basic/600000.SH', {}, {
      QUANT_DATA_PROVIDER: 'tushare',
      TUSHARE_TOKEN: 'fixture-token',
      TUSHARE_BASE_URL: 'https://tushare.fixture.test',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { tsCode: '600000.SH', name: '浦发银行' } })
    expect(fetchMock).toHaveBeenCalledWith('https://tushare.fixture.test', expect.objectContaining({ method: 'POST' }))
  })

  it('maps valuation upstream errors to the Quant route contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ rc: 0, data: null }), { status: 200 }))

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/valuation/601899.SH')

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

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/financial/601899.SH')

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

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/financial/601899.SH', {}, {
      EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test',
      EASTMONEY_TIMEOUT_MS: '2500',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('https://eastmoney.fixture.test/PC_HSF10/NewFinanceAnalysis/ZYZBAjaxNew')
  })

  it('returns recent financial history in report-date order', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        { SECURITY_CODE: '601899', REPORT_DATE: '2025-12-31 00:00:00', REPORT_TYPE: '年报' },
        { SECURITY_CODE: '601899', REPORT_DATE: '2026-06-30 00:00:00', REPORT_TYPE: '中报' },
      ],
    }), { status: 200 }))

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/financial/history/601899.SH?limit=2')

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

    const response = await createApp({ user: { role: 'admin' } }).request('/api/quant/financial/601899.SH')

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'QUANT_PROVIDER_INVALID_RESPONSE',
    })
  })
})
