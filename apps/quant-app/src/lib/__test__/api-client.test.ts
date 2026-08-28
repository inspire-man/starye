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
        sample_count: 1,
        ready_count: 1,
        partial_count: 0,
        insufficient_count: 0,
        items: [{
          ts_code: '601899.SH',
          name: '紫金矿业',
          status: 'ready',
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
      items: [{
        tsCode: '601899.SH',
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

    await expect(quantApi.generateCandidateAiBriefing()).resolves.toMatchObject({
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
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined()
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
      },
    }
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: run }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [run] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(quantApi.generateResearchRun('601899.SH')).resolves.toMatchObject({
      id: 'run-1',
      tsCode: '601899.SH',
      report: { action: 'wait-confirmation', evidence: [{ key: 'quality-roe', status: 'pass', value: 18 }] },
    })
    await expect(quantApi.getResearchRuns('601899.SH', 3)).resolves.toMatchObject([{ id: 'run-1', reportVersion: 'research-report-v1' }])
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ ts_code: '601899.SH' }))
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${QUANT_API_PREFIX}/research/runs/601899.SH?limit=3`)
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
