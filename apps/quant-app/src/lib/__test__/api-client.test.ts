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

  it('reads a stock identity for code-only watchlist additions', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: { ts_code: '600000.SH', name: '浦发银行', observed_at: '2026-08-25T00:00:00.000Z' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getStockBasic('600000.SH')).resolves.toEqual({
      tsCode: '600000.SH',
      name: '浦发银行',
      observedAt: '2026-08-25T00:00:00.000Z',
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/stock-basic/600000.SH`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes a pending candidate and keeps its watchlist name', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        id: 'pending',
        factor_version: 'momentum-v1',
        generated_at: null,
        candidates: [{
          id: 'watch-600000.SH',
          ts_code: '600000.SH',
          name: '浦发银行',
          factor_version: 'momentum-v1',
          data_quality: 'insufficient_data',
          score: 0,
          pending_sync: true,
          pending_reason: '尚未进入最近一次候选快照，请更新观察池',
          factors: {},
          matched_factors: [],
          missing_factors: ['ma20'],
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await expect(quantApi.getCandidates()).resolves.toMatchObject({
      id: 'pending',
      candidates: [{ tsCode: '600000.SH', name: '浦发银行', pendingSync: true, pendingReason: '尚未进入最近一次候选快照，请更新观察池' }],
    })
  })

  it('normalizes candidate signal persistence and evidence', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        candidates: [{
          ts_code: '601899.SH',
          score: 4,
          matched_factors: ['ma20'],
          persistence: {
            sample_size: 5,
            appearance_count: 4,
            persistence_rate: 0.8,
            latest_score: 4,
            previous_score: 3,
            score_delta: 1,
            score_change: 2,
            state: 'confirming',
            factor_persistence: [{ factor: 'ma20', appearances: 4, rate: 0.8 }],
            evidence: [{ snapshot_id: 'snapshot-1', generated_at: '2026-08-25T09:00:00.000Z', present: true, score: 4, matched_factors: ['ma20'] }],
          },
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await expect(quantApi.getCandidates()).resolves.toMatchObject({
      candidates: [{
        tsCode: '601899.SH',
        persistence: {
          sampleSize: 5,
          appearanceCount: 4,
          persistenceRate: 0.8,
          state: 'confirming',
          scoreDelta: 1,
          factorPersistence: [{ factor: 'ma20', appearances: 4, rate: 0.8 }],
          evidence: [{ snapshotId: 'snapshot-1', present: true, score: 4, matchedFactors: ['ma20'] }],
        },
      }],
    })
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

  it('reads persisted sync state and preserves an empty state', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          status: 'completed',
          from_date: '20260301',
          to_date: '20260828',
          requested_count: 14,
          written_count: 1680,
          skipped_count: 0,
          snapshot_id: 'snapshot-1',
          started_at: '2026-08-28T09:58:29.000Z',
          completed_at: '2026-08-28T09:58:31.000Z',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getSyncState()).resolves.toMatchObject({
      status: 'completed',
      requested: 14,
      written: 1680,
      skipped: 0,
      snapshotId: 'snapshot-1',
      completedAt: '2026-08-28T09:58:31.000Z',
    })
    await expect(quantApi.getSyncState()).resolves.toBeNull()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${QUANT_API_PREFIX}/sync`)
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ credentials: 'include' }))
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
        operating_cashflow_per_share: 2.0861,
        fcff_back: 19447406136,
        fcff_forward: 39583497221,
        interest_coverage: 25.18,
        interest_bearing_debt_ratio: 30.59,
        cash_ratio: 0.777,
        total_liability: 268266643912,
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
      operatingCashflowPerShare: 2.0861,
      fcffBack: 19447406136,
      fcffForward: 39583497221,
      interestCoverage: 25.18,
      interestBearingDebtRatio: 30.59,
      cashRatio: 0.777,
      totalLiability: 268266643912,
      roic: 11.75,
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/financial/601899.SH`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes shareholder return status, distributions, and missing fields', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        formula_version: 'shareholder-return-v1',
        observed_at: '2026-08-25T00:00:00.000Z',
        provider: 'tushare',
        provider_chain: ['tushare', 'eastmoney'],
        sample_count: 1,
        ready_count: 1,
        partial_count: 0,
        insufficient_count: 0,
        items: [{
          ts_code: '601899.SH',
          name: '紫金矿业',
          status: 'ready',
          provider: 'eastmoney',
          provider_chain: ['tushare', 'eastmoney'],
          fallback_used: true,
          fallback_reason: 'QUANT_PROVIDER_QUOTA',
          provider_error_code: null,
          latest_close: 34.54,
          trailing_cash_dividend_per_share: 0.42,
          trailing_dividend_yield: 1.22,
          dividend_years: 4,
          distributions: [{ end_date: '20260331', cash_dividend_per_share: 0.42, pay_date: '20260821' }],
          missing_fields: [],
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getShareholderReturns()).resolves.toMatchObject({
      formulaVersion: 'shareholder-return-v1',
      provider: 'tushare',
      providerChain: ['tushare', 'eastmoney'],
      items: [{
        tsCode: '601899.SH',
        provider: 'eastmoney',
        fallbackUsed: true,
        fallbackReason: 'QUANT_PROVIDER_QUOTA',
        trailingDividendYield: 1.22,
        distributions: [{ endDate: '20260331', cashDividendPerShare: 0.42 }],
      }],
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/shareholder-returns`, expect.objectContaining({ credentials: 'include' }))
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
        formula_version: 'value-quality-v2',
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
            max_score: 30,
            status: 'ready',
            metrics: [{ key: 'pe_ttm', label: 'TTM PE', value: 12.4, favorable_percentile: 66, sample_count: 4 }],
          }, {
            key: 'resilience',
            label: '资产负债表韧性',
            score: 12,
            max_score: 15,
            status: 'ready',
            metrics: [{ key: 'interest_coverage', label: '利息覆盖倍数', value: 12, favorable_percentile: 80, sample_count: 4 }],
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
      formulaVersion: 'value-quality-v2',
      sampleCount: 4,
      readyCount: 2,
      items: [
        { tsCode: '601899.SH', score: 72.5, dimensions: expect.arrayContaining([
          expect.objectContaining({ key: 'valuation', metrics: expect.arrayContaining([expect.objectContaining({ favorablePercentile: 66 })]) }),
          expect.objectContaining({ key: 'resilience', maxScore: 15, metrics: expect.arrayContaining([expect.objectContaining({ favorablePercentile: 80 })]) }),
        ]) },
        { tsCode: '600089.SH', score: null, status: 'insufficient_data' },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/value-selection`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes the source-backed investment knowledge catalog', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        version: 'investment-knowledge-v3',
        observed_at: '2026-08-25T00:00:00.000Z',
        sources: [{ id: 'article-key-point', title: '重点来了', url: 'https://mp.weixin.qq.com/s/fNOk8LKIqNzdlo8Bm7qTaA', access: 'preview', summary: '公开试读' }],
        factors: [
          { id: 'relative-valuation', category: '估值', title: '好公司还要有好价格', status: 'active', eligible_in_value_quality: true, current_dimension: 'valuation', required_fields: ['peTtm'], available_fields: ['peTtm'], missing_fields: [], source_ids: ['article-key-point'] },
          { id: 'business-resilience', category: '逆境韧性', title: '先问公司能否熬过逆风期', status: 'active', eligible_in_value_quality: true, current_dimension: 'resilience', required_fields: ['cashRatio'], available_fields: ['cashRatio'], missing_fields: [], source_ids: ['article-key-point'] },
        ],
        aliases: [{ alias: '变变', status: 'mapped', confidence: 'high', ts_code: '600089.SH', name: '特变电工', candidates: [], note: '上下文' }],
        recommended_watchlist: [{ ts_code: '600089.SH', name: '特变电工' }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getInvestmentKnowledge()).resolves.toMatchObject({
      version: 'investment-knowledge-v3',
      sources: [{ id: 'article-key-point', access: 'preview' }],
      factors: [
        { id: 'relative-valuation', status: 'active', eligibleInValueQuality: true },
        { id: 'business-resilience', status: 'active', currentDimension: 'resilience', eligibleInValueQuality: true },
      ],
      aliases: [{ alias: '变变', tsCode: '600089.SH' }],
      recommendedWatchlist: [{ tsCode: '600089.SH', name: '特变电工' }],
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/knowledge`, expect.objectContaining({ credentials: 'include' }))
  })

  it('normalizes user-scoped AI config and never sends a stored key on read', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: 'ai-1',
        provider: 'openai_compatible',
        model: 'gpt-5.5',
        base_url: 'https://ai.example.test/v1',
        has_api_key: true,
        api_key_hint: '1234',
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: 'ai-1',
        provider: 'deepseek',
        model: 'deepseek-chat',
        base_url: null,
        has_api_key: true,
        api_key_hint: '5678',
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { deleted: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getAiConfig()).resolves.toMatchObject({
      provider: 'openai_compatible',
      model: 'gpt-5.5',
      hasApiKey: true,
      apiKeyHint: '1234',
    })
    await expect(quantApi.updateAiConfig({
      provider: 'deepseek',
      model: 'deepseek-chat',
      clearApiKey: false,
    })).resolves.toMatchObject({ provider: 'deepseek', model: 'deepseek-chat' })
    await expect(quantApi.deleteAiConfig()).resolves.toBe(true)
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain('stored')
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({
      provider: 'deepseek',
      model: 'deepseek-chat',
      base_url: undefined,
      api_key: undefined,
      clear_api_key: false,
    }))
  })

  it('normalizes factor configuration reads, updates, and resets', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        version: 'research-factor-config-v1',
        weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
        source: 'default',
        updated_at: null,
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        version: 'research-factor-config-v1',
        weights: { 'trend': 0.4, 'valuation': 0.1, 'quality': 0.2, 'shareholder-return': 0.1, 'risk': 0.2 },
        source: 'user',
        updated_at: '2026-08-30T00:00:00.000Z',
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        version: 'research-factor-config-v1',
        weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
        source: 'default',
        updatedAt: null,
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getFactorConfiguration()).resolves.toMatchObject({ source: 'default', updatedAt: null })
    await expect(quantApi.updateFactorConfiguration({ 'trend': 0.4, 'valuation': 0.1, 'quality': 0.2, 'shareholder-return': 0.1, 'risk': 0.2 })).resolves.toMatchObject({
      source: 'user',
      weights: { 'trend': 0.4, 'valuation': 0.1, 'quality': 0.2, 'shareholder-return': 0.1, 'risk': 0.2 },
    })
    await expect(quantApi.resetFactorConfiguration()).resolves.toMatchObject({ source: 'default', updatedAt: null })
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ weights: { 'trend': 0.4, 'valuation': 0.1, 'quality': 0.2, 'shareholder-return': 0.1, 'risk': 0.2 } }))
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('DELETE')
  })

  it('normalizes AI connection test metadata without sending a client-side key', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      tested_at: '2026-08-28T12:00:00.000Z',
      latency_ms: 42,
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.testAiConfig()).resolves.toEqual({
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      testedAt: '2026-08-28T12:00:00.000Z',
      latencyMs: 42,
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/ai-config/test`, expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain('api_key')
  })

  it('requests the candidate AI briefing without sending candidate facts', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      briefing_version: 'candidate-briefing-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generated_at: '2026-08-29T03:00:00.000Z',
      overview: '当前候选先核对数据完整性，再按研究优先级继续检查。',
      focus_items: [{
        ts_code: '601899.SH',
        name: '紫金矿业',
        priority_level: 'high',
        priority_score: 72,
        action_label: '核对风险',
        reasons: ['近日日线回撤达到 3%'],
        explanation: '先回看当前候选的风险事实和数据日期。',
      }],
      next_checks: ['核对数据截至日期'],
      cited_candidate_codes: ['601899.SH'],
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.generateCandidateAiBriefing(['601899.SH', '000001.SZ'])).resolves.toMatchObject({
      briefingVersion: 'candidate-briefing-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      focusItems: [{ tsCode: '601899.SH', priorityLevel: 'high', priorityScore: 72 }],
      nextChecks: ['核对数据截至日期'],
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/candidates/ai-briefing`, expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ ts_codes: ['601899.SH', '000001.SZ'] }))
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain('priorityScore')
  })

  it('requests a candidate briefing follow-up with only scope codes and the question', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      question_version: 'candidate-briefing-question-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generated_at: '2026-08-29T03:30:00.000Z',
      question: '当前范围内先核对什么？',
      answer: '先核对当前候选的已有数据事实。',
      cited_candidate_codes: ['601899.SH', '601899.SH'],
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.askCandidateAiBriefingQuestion(['601899.SH', '000001.SZ'], '  当前范围内先核对什么？  ')).resolves.toEqual({
      questionVersion: 'candidate-briefing-question-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generatedAt: '2026-08-29T03:30:00.000Z',
      question: '当前范围内先核对什么？',
      answer: '先核对当前候选的已有数据事实。',
      citedCandidateCodes: ['601899.SH'],
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/candidates/ai-briefing/question`, expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ ts_codes: ['601899.SH', '000001.SZ'], question: '当前范围内先核对什么？' }))
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain('priorityScore')
  })

  it('carries the active session id when appending a candidate briefing follow-up', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      session_id: 'session-1',
      question_version: 'candidate-briefing-question-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generated_at: '2026-08-29T03:40:00.000Z',
      question: '当前范围内先核对什么？',
      answer: '先核对当前候选的已有数据事实。',
      cited_candidate_codes: ['601899.SH'],
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.askCandidateAiBriefingQuestion(['601899.SH'], '问题', ' session-1 ')).resolves.toMatchObject({
      sessionId: 'session-1',
      question: '当前范围内先核对什么？',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      ts_codes: ['601899.SH'],
      question: '问题',
      session_id: 'session-1',
    })
  })

  it('normalizes candidate AI session history and keeps nested content versioned', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      items: [{
        id: 'session-1',
        snapshot_id: 'snapshot-1',
        snapshot_generated_at: '2026-08-29T03:00:00.000Z',
        from_date: '20260801',
        to_date: '20260829',
        scope_key: '000001.SZ|601899.SH',
        candidate_codes: ['601899.SH', '000001.SZ', '601899.SH'],
        briefing: {
          briefing_version: 'candidate-briefing-v1',
          provider: 'openai_compatible',
          model: 'gpt-5.4',
          generated_at: '2026-08-29T03:10:00.000Z',
          overview: '历史简报',
          focus_items: [],
          next_checks: [],
          cited_candidate_codes: [],
        },
        questions: [{
          question_version: 'candidate-briefing-question-v1',
          provider: 'openai_compatible',
          model: 'gpt-5.4',
          generated_at: '2026-08-29T03:20:00.000Z',
          question: '问题',
          answer: '回答',
          cited_candidate_codes: ['601899.SH'],
        }],
        provider: 'openai_compatible',
        model: 'gpt-5.4',
        created_at: '2026-08-29T03:10:00.000Z',
        updated_at: '2026-08-29T03:20:00.000Z',
      }],
      limit: 5,
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getCandidateAiSessions()).resolves.toEqual({
      limit: 5,
      items: [expect.objectContaining({
        id: 'session-1',
        snapshotId: 'snapshot-1',
        candidateCodes: ['601899.SH', '000001.SZ'],
        briefing: expect.objectContaining({ overview: '历史简报' }),
        questions: [expect.objectContaining({ question: '问题' })],
      })],
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${QUANT_API_PREFIX}/candidates/ai-sessions?limit=5`)
  })

  it('deletes a candidate AI session through the scoped endpoint and validates the returned id', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      deleted: true,
      session_id: 'session-1',
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.deleteCandidateAiSession(' session-1 ')).resolves.toEqual({
      deleted: true,
      sessionId: 'session-1',
    })
    expect(fetchMock).toHaveBeenCalledWith(`${QUANT_API_PREFIX}/candidates/ai-sessions/session-1`, expect.objectContaining({
      method: 'DELETE',
      credentials: 'include',
    }))
  })

  it('rejects malformed candidate AI session deletion responses', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      deleted: true,
      session_id: 'other-session',
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await expect(quantApi.deleteCandidateAiSession('session-1')).rejects.toMatchObject({
      status: 502,
      code: 'QUANT_AI_CANDIDATE_BRIEFING_INVALID_RESPONSE',
    })
  })

  it('normalizes structured research runs and requests history by stock code', async () => {
    const run = {
      id: 'run-1',
      ts_code: '601899.SH',
      name: '紫金矿业',
      status: 'partial',
      report_version: 'research-report-v1',
      source_snapshot_id: 'snapshot-1',
      generated_at: '2026-08-26T00:00:00.000Z',
      created_at: '2026-08-26T00:00:00.000Z',
      report: {
        report_version: 'research-report-v1',
        ts_code: '601899.SH',
        name: '紫金矿业',
        generated_at: '2026-08-26T00:00:00.000Z',
        source_snapshot_id: 'snapshot-1',
        status: 'partial',
        action: 'wait-confirmation',
        score: 72.7,
        headline: '等待确认：部分证据可用',
        strengths: ['ROE 达到研究门槛'],
        risks: ['TTM PE 需要结合行业'],
        gaps: ['财报连续性仍需补齐'],
        next_actions: ['等待下一期报告'],
        evidence: [{
          key: 'quality-roe',
          dimension: 'quality',
          label: 'ROE',
          status: 'pass',
          value: 18,
          threshold: '至少 10%',
          source: 'Eastmoney 最新财报',
          observed_at: '2026-06-30',
          formula_version: 'eastmoney-financial-v1',
          detail: '资本回报达到研究门槛',
        }],
        sources: [{ id: 'eastmoney-financial', name: 'Eastmoney 财务报告', observed_at: '2026-08-26T00:00:00.000Z', formula_version: 'eastmoney-financial-v1' }],
        factor_model: {
          model_version: 'research-factors-v1',
          total_weight: 1,
          covered_weight: 1,
          coverage: 100,
          score: 78,
          factors: [{
            key: 'quality',
            label: '盈利质量',
            weight: 0.2,
            source_id: 'eastmoney-financial',
            source: 'Eastmoney 最新财报',
            status: 'ready',
            score: 78,
            evidence_keys: ['quality-roe'],
            missing_evidence_keys: [],
          }],
        },
        decision: {
          decision_version: 'research-decision-v1',
          recommendation: 'bullish',
          label: '看多',
          deterministic_score: 78,
          confidence: 78,
          coverage: 100,
          buy_price_range: null,
          sell_price_range: null,
          evidence_keys: ['quality-roe'],
          invalidation_conditions: ['趋势转弱后复核'],
          headline: '看多：正向证据占优',
        },
      },
    }
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: run }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [run] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.generateResearchRun('601899.SH')).resolves.toMatchObject({
      id: 'run-1',
      tsCode: '601899.SH',
      report: {
        action: 'wait-confirmation',
        evidence: [{ key: 'quality-roe', status: 'pass', value: 18 }],
        factorModel: { modelVersion: 'research-factors-v1', coverage: 100 },
        decision: { recommendation: 'bullish', label: '看多', coverage: 100 },
      },
    })
    await expect(quantApi.getResearchRuns('601899.SH', 3)).resolves.toMatchObject([{ id: 'run-1', reportVersion: 'research-report-v1' }])
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ ts_code: '601899.SH' }))
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${QUANT_API_PREFIX}/research/runs/601899.SH?limit=3`)
  })

  it('reads, saves, and lists user-scoped decision records without accepting client snapshots', async () => {
    const record = {
      id: 'decision-1',
      research_run_id: 'run-1',
      ts_code: '601899.SH',
      action: 'plan-buy',
      note: '等待价格回到参考区间',
      created_at: '2026-08-30T00:00:00.000Z',
      updated_at: '2026-08-30T00:05:00.000Z',
      snapshot: {
        snapshotVersion: 'decision-record-v1',
        reportVersion: 'research-report-v2',
        generatedAt: '2026-08-29T00:00:00.000Z',
        recommendation: 'bullish',
        confidence: 82,
        coverage: 92,
        evidenceKeys: ['quality-roe'],
        currentPrice: 34.54,
        currentPriceObservedAt: '20260829',
        buyPriceRange: {
          low: 32.1,
          high: 33.6,
          currency: 'CNY',
          formulaVersion: 'reference-price-v1',
          source: 'deterministic-research',
          observedAt: '2026-08-29T00:00:00.000Z',
          evidenceKeys: ['quality-roe'],
        },
        sellPriceRange: null,
        aiDecisionReview: {
          decisionVersion: 'ai-decision-v1',
          recommendation: 'bullish',
          confidence: 82,
          accepted: true,
          rejectionReason: null,
          rationale: '正向证据占优。',
          invalidationConditions: ['趋势转弱后复核'],
          citedEvidenceKeys: ['quality-roe'],
        },
        factorConfiguration: {
          version: 'research-factor-config-v1',
          source: 'user',
          updatedAt: '2026-08-28T00:00:00.000Z',
          weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
        },
      },
    }
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: record }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [record] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [record] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.getResearchDecisionRecord('run-1')).resolves.toBeNull()
    await expect(quantApi.saveResearchDecisionRecord('run-1', 'plan-buy', '等待价格回到参考区间')).resolves.toMatchObject({
      id: 'decision-1',
      action: 'plan-buy',
      snapshot: {
        currentPrice: 34.54,
        currentPriceObservedAt: '20260829',
        buyPriceRange: { low: 32.1, high: 33.6 },
        aiDecisionReview: { accepted: true, recommendation: 'bullish' },
        factorConfiguration: { source: 'user', weights: { trend: 0.25 } },
      },
    })
    await expect(quantApi.getResearchDecisionRecords('601899.SH', 10)).resolves.toMatchObject([{ id: 'decision-1', tsCode: '601899.SH' }])
    await expect(quantApi.getResearchDecisionQueue(20)).resolves.toMatchObject([{ id: 'decision-1', tsCode: '601899.SH' }])

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${QUANT_API_PREFIX}/research/runs/run-1/decision`)
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${QUANT_API_PREFIX}/research/runs/run-1/decision`)
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT')
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ action: 'plan-buy', note: '等待价格回到参考区间' }))
    expect(fetchMock.mock.calls[1]?.[1]?.body).not.toContain('snapshot')
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`${QUANT_API_PREFIX}/research/decisions/601899.SH?limit=10`)
    expect(fetchMock.mock.calls[3]?.[0]).toBe(`${QUANT_API_PREFIX}/research/decisions?limit=20`)
  })

  it('normalizes saved AI research summaries and keeps generation separate from report history', async () => {
    const summary = {
      id: 'summary-1',
      research_run_id: 'run-1',
      summary_version: 'research-summary-v1',
      report_version: 'research-report-v2',
      provider: 'deepseek',
      model: 'deepseek-chat',
      generated_at: '2026-08-26T00:00:00.000Z',
      created_at: '2026-08-26T00:00:00.000Z',
      cited_evidence_keys: ['quality-roe'],
      summary: {
        summary_version: 'research-summary-v1',
        overview: '基本面有一项明确支持，但仍应继续核对。',
        supports: ['ROE 达到报告门槛'],
        concerns: ['当前证据范围仍有限'],
        next_checks: ['等待下一期财报并复核'],
        cited_evidence_keys: ['quality-roe'],
      },
    }
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: summary }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [summary] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.generateResearchSummary('run-1')).resolves.toMatchObject({
      id: 'summary-1',
      researchRunId: 'run-1',
      provider: 'deepseek',
      summary: { overview: '基本面有一项明确支持，但仍应继续核对。', nextChecks: ['等待下一期财报并复核'] },
      citedEvidenceKeys: ['quality-roe'],
    })
    await expect(quantApi.getResearchSummaries('run-1', 1)).resolves.toMatchObject([{ id: 'summary-1', reportVersion: 'research-report-v2' }])
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${QUANT_API_PREFIX}/research/runs/run-1/summary`)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${QUANT_API_PREFIX}/research/runs/run-1/summary?limit=1`)
  })

  it('normalizes the server-computed factor impact audit without requiring it on legacy summaries', async () => {
    const summary = {
      id: 'summary-impact-1',
      research_run_id: 'run-impact-1',
      summary_version: 'research-summary-v2',
      report_version: 'research-report-v2',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generated_at: '2026-09-01T00:00:00.000Z',
      created_at: '2026-09-01T00:00:00.000Z',
      cited_evidence_keys: ['quality-roe'],
      factor_impact: {
        model_version: 'research-factors-v1',
        freshness_version: 'quant-factor-freshness-v1',
        freshness_blocked_factors: ['valuation'],
        total_weight: 1,
        deterministic_score: 82,
        scored_weight: 1,
        reviewed_weight: 0.5,
        review_coverage: 50,
        support_weight: 0.5,
        caution_weight: 0,
        oppose_weight: 0,
        unaccepted_weight: 0.5,
        factors: [{
          factor: 'quality',
          label: '盈利质量',
          weight: 0.5,
          deterministic_score: 90,
          deterministic_stance: 'support',
          deterministic_contribution: 45,
          ai_stance: 'support',
          ai_confidence: 88,
          ai_accepted: true,
          ai_weight: 0.5,
          freshness: {
            version: 'quant-factor-freshness-v1',
            status: 'fresh',
            observed_at: '2026-08-29',
            age_days: 3,
            fresh_within_days: 180,
            aging_within_days: 365,
            detail: '3 天前观测，处于 180 天最新窗口',
            missing_evidence_keys: [],
            unverifiable_evidence_keys: [],
          },
          ai_freshness_eligible: true,
        }, {
          factor: 'valuation',
          label: '估值',
          weight: 0.5,
          deterministic_score: 74,
          deterministic_stance: 'support',
          deterministic_contribution: 37,
          ai_stance: null,
          ai_confidence: null,
          ai_accepted: false,
          ai_weight: 0,
          freshness: {
            version: 'quant-factor-freshness-v1',
            status: 'stale',
            observed_at: '2026-06-01',
            age_days: 92,
            fresh_within_days: 14,
            aging_within_days: 60,
            detail: '92 天前观测，超过 60 天复核窗口，先刷新数据',
            missing_evidence_keys: [],
            unverifiable_evidence_keys: [],
          },
          ai_freshness_eligible: false,
        }],
      },
      summary: {
        summary_version: 'research-summary-v2',
        overview: 'AI 已完成部分因子核对。',
        supports: [],
        concerns: [],
        next_checks: [],
        cited_evidence_keys: ['quality-roe'],
      },
    }
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: summary }), { status: 201, headers: { 'Content-Type': 'application/json' } })))

    await expect(quantApi.generateResearchSummary('run-impact-1')).resolves.toMatchObject({
      factorImpact: {
        reviewCoverage: 50,
        unacceptedWeight: 0.5,
        factors: [
          { factor: 'quality', deterministicContribution: 45, aiAccepted: true, aiWeight: 0.5, freshness: { status: 'fresh' }, aiFreshnessEligible: true },
          { factor: 'valuation', aiAccepted: false, aiWeight: 0, freshness: { status: 'stale' }, aiFreshnessEligible: false },
        ],
      },
    })
  })

  it('normalizes an accepted AI decision review without accepting model-generated prices', async () => {
    const summary = {
      id: 'summary-decision-1',
      research_run_id: 'run-decision-1',
      summary_version: 'research-summary-v2',
      report_version: 'research-report-v2',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generated_at: '2026-08-29T00:00:00.000Z',
      created_at: '2026-08-29T00:00:00.000Z',
      cited_evidence_keys: ['quality-roe'],
      summary: {
        summary_version: 'research-summary-v2',
        overview: 'AI 复核完成。',
        supports: [],
        concerns: [],
        next_checks: [],
        cited_evidence_keys: ['quality-roe'],
        decision_review: {
          decision_version: 'ai-decision-v1',
          recommendation: 'bearish',
          confidence: 82,
          accepted: true,
          rejection_reason: null,
          rationale: '风险证据更值得优先核对。',
          invalidation_conditions: ['下一期财报改善后复核'],
          cited_evidence_keys: ['quality-roe'],
        },
      },
    }
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: summary }), { status: 201, headers: { 'Content-Type': 'application/json' } })))

    await expect(quantApi.generateResearchSummary('run-decision-1')).resolves.toMatchObject({
      summaryVersion: 'research-summary-v2',
      summary: {
        decisionReview: {
          recommendation: 'bearish',
          confidence: 82,
          accepted: true,
          citedEvidenceKeys: ['quality-roe'],
        },
      },
    })
  })

  it('normalizes an evidence-grounded AI research comparison and rejects malformed items', async () => {
    const comparison = {
      comparison_version: 'research-comparison-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generated_at: '2026-08-29T00:00:00.000Z',
      overview: '两份报告都有可核对证据。',
      common_ground: ['都有已保存的财务证据'],
      differences: [{ ts_code: '601899.SH', point: 'ROE 证据可用', evidence_keys: ['quality-roe'] }],
      risks: ['报告期需要人工核对'],
      next_checks: ['复核来源日期'],
      cited_evidence: [{ ts_code: '601899.SH', evidence_key: 'quality-roe' }],
    }
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: comparison }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        ...comparison,
        differences: [null],
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.generateResearchComparison(['run-a', 'run-b'])).resolves.toEqual({
      comparisonVersion: 'research-comparison-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generatedAt: '2026-08-29T00:00:00.000Z',
      overview: '两份报告都有可核对证据。',
      commonGround: ['都有已保存的财务证据'],
      differences: [{ tsCode: '601899.SH', point: 'ROE 证据可用', evidenceKeys: ['quality-roe'] }],
      risks: ['报告期需要人工核对'],
      nextChecks: ['复核来源日期'],
      citedEvidence: [{ tsCode: '601899.SH', evidenceKey: 'quality-roe' }],
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${QUANT_API_PREFIX}/research/comparison`)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ run_ids: ['run-a', 'run-b'] })

    await expect(quantApi.generateResearchComparison(['run-a', 'run-b'])).rejects.toMatchObject({
      code: 'QUANT_AI_COMPARISON_INVALID_RESPONSE',
      status: 502,
    })
  })

  it('normalizes a report-grounded AI research question and posts only the question', async () => {
    const question = {
      question_version: 'research-question-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generated_at: '2026-08-29T01:00:00.000Z',
      question: 'ROE 是否达到报告门槛？',
      answer: '报告中的 ROE 为 18%，高于报告列出的至少 10% 门槛。',
      cited_evidence_keys: ['quality-roe'],
    }
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: question }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...question, answer: '' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.askResearchQuestion('run-1', 'ROE 是否达到报告门槛？')).resolves.toEqual({
      questionVersion: 'research-question-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generatedAt: '2026-08-29T01:00:00.000Z',
      question: 'ROE 是否达到报告门槛？',
      answer: '报告中的 ROE 为 18%，高于报告列出的至少 10% 门槛。',
      citedEvidenceKeys: ['quality-roe'],
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${QUANT_API_PREFIX}/research/runs/run-1/question`)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ question: 'ROE 是否达到报告门槛？' }))

    await expect(quantApi.askResearchQuestion('run-1', 'ROE 是否达到报告门槛？')).rejects.toMatchObject({
      code: 'QUANT_AI_QUESTION_INVALID_RESPONSE',
      status: 502,
    })
  })

  it('normalizes a research change explanation and posts the previous run id', async () => {
    const explanation = {
      change_explanation_version: 'research-change-explanation-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generated_at: '2026-08-29T02:00:00.000Z',
      current_generated_at: '2026-08-29T00:00:00.000Z',
      previous_generated_at: '2026-08-28T00:00:00.000Z',
      overview: 'ROE 状态由注意变为通过。',
      changes: [{ evidence_key: 'quality-roe', label: 'ROE', kind: 'improved', kind_label: '状态改善', explanation: '数值上升，按报告事实回看。' }],
      next_checks: ['复核来源日期'],
      cited_evidence_keys: ['quality-roe'],
    }
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: explanation }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...explanation, changes: [null] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.generateResearchChangeExplanation('run-current', 'run-previous')).resolves.toEqual({
      changeExplanationVersion: 'research-change-explanation-v1',
      provider: 'openai_compatible',
      model: 'gpt-5.4',
      generatedAt: '2026-08-29T02:00:00.000Z',
      currentGeneratedAt: '2026-08-29T00:00:00.000Z',
      previousGeneratedAt: '2026-08-28T00:00:00.000Z',
      overview: 'ROE 状态由注意变为通过。',
      changes: [{ evidenceKey: 'quality-roe', label: 'ROE', kind: 'improved', kindLabel: '状态改善', explanation: '数值上升，按报告事实回看。' }],
      nextChecks: ['复核来源日期'],
      citedEvidenceKeys: ['quality-roe'],
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${QUANT_API_PREFIX}/research/runs/run-current/change-explanation`)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ previous_run_id: 'run-previous' }))

    await expect(quantApi.generateResearchChangeExplanation('run-current', 'run-previous')).rejects.toMatchObject({
      code: 'QUANT_AI_CHANGE_EXPLANATION_INVALID_RESPONSE',
      status: 502,
    })
  })
})
