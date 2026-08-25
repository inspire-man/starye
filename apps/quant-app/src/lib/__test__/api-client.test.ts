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
        provider: 'eastmoney',
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
    expect(result.provider).toBe('eastmoney')
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

  it('normalizes latest watchlist market stats for comparison', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [{
        id: 'watch-1',
        ts_code: '601899.SH',
        name: '紫金矿业',
        latest_trade_date: '20260821',
        bar_count: 120,
        latest_close: 34.74,
        latest_change_percent: 0.91,
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await expect(quantApi.getWatchlist()).resolves.toMatchObject([{
      tsCode: '601899.SH',
      latestClose: 34.74,
      latestChangePercent: 0.91,
    }])
  })

  it('normalizes research markers and sends the marker update contract', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ ts_code: '601899.SH', status: 'priority', note: '核对现金流', review_date: '2026-09-01', updated_at: '2026-08-24T00:00:00.000Z' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { ts_code: '601899.SH', status: 'paused', note: null, review_date: null },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getResearchMarkers()).resolves.toMatchObject([
      { tsCode: '601899.SH', status: 'priority', note: '核对现金流', reviewDate: '2026-09-01' },
    ])
    await expect(quantApi.updateResearchMarker('601899.SH', { status: 'paused', note: null, reviewDate: null })).resolves.toMatchObject({
      tsCode: '601899.SH',
      status: 'paused',
      note: null,
      reviewDate: null,
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${QUANT_API_PREFIX}/research/601899.SH`)
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ status: 'paused', note: null, review_date: null }))
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

  it('normalizes the selected stock valuation snapshot and keeps missing fields null', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        ts_code: '601899.SH',
        observed_at: '2026-08-23T00:00:00.000Z',
        dynamic_pe: 11.79,
        pe_ttm: 17.84,
        pe_static: 13.65,
        pb: 2.46,
        ps: null,
        peg: 1.46,
        market_cap: 923761425968.28,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getValuation('601899.SH')).resolves.toEqual({
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
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/valuation/601899.SH`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes observation-pool valuation comparison and keeps null peers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        target: {
          ts_code: '601899.SH',
          observed_at: '2026-08-23T00:00:00.000Z',
          dynamic_pe: 11.79,
          pe_ttm: 17.84,
          pe_static: 13.65,
          pb: 2.46,
          ps: null,
          peg: 1.46,
          market_cap: 923761425968.28,
        },
        peers: [
          { ts_code: '600089.SH', name: '特变电工', valuation: null },
        ],
        sample_count: 2,
        available_sample_count: 1,
        ttm_pe_sample_count: 1,
        pb_sample_count: 1,
        ttm_pe_higher_than_percent: null,
        pb_higher_than_percent: null,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getValuationComparison('601899.SH')).resolves.toMatchObject({
      target: { tsCode: '601899.SH', peTtm: 17.84 },
      peers: [{ tsCode: '600089.SH', valuation: null }],
      sampleCount: 2,
      availableSampleCount: 1,
      ttmPeHigherThanPercent: null,
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/valuation/compare/601899.SH`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes the latest financial quality snapshot and preserves missing metrics', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        ts_code: '601899.SH',
        observed_at: '2026-08-23T00:00:00.000Z',
        report_date: '2026-06-30',
        report_type: '中报',
        report_date_name: '2026中报',
        notice_date: '2026-08-30',
        revenue: '350000000000',
        revenue_yoy: 15.78,
        net_profit: 41000000000,
        net_profit_yoy: 68.17,
        adjusted_net_profit: null,
        adjusted_net_profit_yoy: null,
        roe: 19.6,
        gross_margin: 37.74,
        net_margin: 16.2,
        debt_asset_ratio: 49.55,
        operating_cashflow_to_revenue: 0.28,
        roic: 11.75,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getFinancialQuality('601899.SH')).resolves.toEqual({
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
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/financial/601899.SH`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes financial history and keeps reports in server order', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        ts_code: '601899.SH',
        observed_at: '2026-08-23T00:00:00.000Z',
        reports: [
          { ts_code: '601899.SH', observed_at: '2026-08-23T00:00:00.000Z', report_date: '2026-06-30', report_type: '中报', revenue_yoy: 15.78 },
          { ts_code: '601899.SH', observed_at: '2026-08-23T00:00:00.000Z', report_date: '2025-12-31', report_type: '年报', revenue_yoy: 3.48 },
        ],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getFinancialQualityHistory('601899.SH', 2)).resolves.toMatchObject({
      tsCode: '601899.SH',
      reports: [
        { reportDate: '2026-06-30', revenueYoY: 15.78 },
        { reportDate: '2025-12-31', revenueYoY: 3.48 },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/financial/history/601899.SH?limit=2`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes financial quality peer positions and nullable peers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        target: { ts_code: '601899.SH', observed_at: '2026-08-23T00:00:00.000Z', report_date: '2026-06-30', revenue_yoy: 20, roe: 18 },
        peers: [{ ts_code: '600089.SH', name: '特变电工', quality: null }],
        sample_count: 2,
        available_sample_count: 1,
        revenue_yoy_sample_count: 1,
        net_profit_yoy_sample_count: 0,
        roe_sample_count: 1,
        debt_asset_ratio_sample_count: 0,
        revenue_yoy_higher_than_percent: null,
        net_profit_yoy_higher_than_percent: null,
        roe_higher_than_percent: null,
        debt_asset_ratio_lower_than_percent: null,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getFinancialQualityComparison('601899.SH')).resolves.toMatchObject({
      target: { tsCode: '601899.SH', revenueYoY: 20 },
      peers: [{ tsCode: '600089.SH', quality: null }],
      availableSampleCount: 1,
      roeHigherThanPercent: null,
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/financial/compare/601899.SH`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes value-quality dimensions, null scores, and risk notes', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        formula_version: 'value-quality-v1',
        observed_at: '2026-08-25T00:00:00.000Z',
        sample_count: 4,
        ready_count: 2,
        partial_count: 1,
        insufficient_count: 1,
        items: [{
          ts_code: '601899.SH',
          name: '紫金矿业',
          status: 'ready',
          score: 72.5,
          valuation_status: 'ready',
          financial_status: 'ready',
          daily_status: 'ready',
          financial_report_date: '2026-06-30',
          dimensions: [{
            key: 'valuation',
            label: '估值',
            score: 28,
            max_score: 35,
            status: 'ready',
            metrics: [{ key: 'pe_ttm', label: 'TTM PE', value: 12.4, favorable_percentile: 66, sample_count: 4 }],
          }],
          risk_deduction: 3,
          risk_notes: ['净利润增长与经营现金流方向不一致'],
          missing_fields: [],
        }, {
          ts_code: '600089.SH',
          status: 'insufficient_data',
          score: null,
          dimensions: [],
          risk_notes: [],
          missing_fields: ['最近两期财务增长数据'],
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getValueSelection()).resolves.toMatchObject({
      formulaVersion: 'value-quality-v1',
      sampleCount: 4,
      readyCount: 2,
      items: [
        { tsCode: '601899.SH', score: 72.5, dimensions: [{ key: 'valuation', metrics: [{ favorablePercentile: 66 }] }] },
        { tsCode: '600089.SH', score: null, status: 'insufficient_data' },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/value-selection`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes the source-backed investment knowledge catalog', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        version: 'investment-knowledge-v1',
        observed_at: '2026-08-25T00:00:00.000Z',
        sources: [{ id: 'article-key-point', title: '重点来了', url: 'https://mp.weixin.qq.com/s/fNOk8LKIqNzdlo8Bm7qTaA', access: 'preview', summary: '公开试读' }],
        factors: [{ id: 'relative-valuation', category: '估值', title: '好公司还要有好价格', status: 'active', eligible_in_value_quality: true, current_dimension: 'valuation', required_fields: ['peTtm'], available_fields: ['peTtm'], missing_fields: [], source_ids: ['article-key-point'] }],
        aliases: [{ alias: '变变', status: 'mapped', confidence: 'high', ts_code: '600089.SH', name: '特变电工', candidates: [], note: '上下文' }],
        recommended_watchlist: [{ ts_code: '600089.SH', name: '特变电工' }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getInvestmentKnowledge()).resolves.toMatchObject({
      version: 'investment-knowledge-v1',
      sources: [{ id: 'article-key-point', access: 'preview' }],
      factors: [{ id: 'relative-valuation', status: 'active', eligibleInValueQuality: true }],
      aliases: [{ alias: '变变', tsCode: '600089.SH' }],
      recommendedWatchlist: [{ tsCode: '600089.SH', name: '特变电工' }],
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/knowledge`, expect.objectContaining({ credentials: 'include' }))
  })
})
