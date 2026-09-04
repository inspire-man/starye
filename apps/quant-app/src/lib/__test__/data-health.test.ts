import type { QuantShareholderReturnSelection, QuantValueSelection, SyncResult, WatchlistItem } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildQuantDataHealth, classifyQuantDataHealthFreshness, mergeQuantDataHealthFreshness } from '../data-health'

function watchlist(tsCode: string, covered = true): WatchlistItem {
  return {
    id: tsCode,
    tsCode,
    name: tsCode,
    latestTradeDate: covered ? '20260828' : null,
    barCount: covered ? 120 : 0,
    latestClose: covered ? 10 : null,
    latestChangePercent: covered ? 1 : null,
    createdAt: null,
  }
}

function sync(status: SyncResult['status'] = 'completed', overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    status,
    requestedCount: 3,
    writtenCount: 360,
    skippedCount: 0,
    requested: 3,
    processed: 360,
    written: 360,
    skipped: 0,
    reason: null,
    snapshotId: 'snapshot-1',
    startedAt: '2026-08-28T09:58:29.000Z',
    completedAt: '2026-08-28T09:58:31.000Z',
    ...overrides,
  }
}

function valueSelection(overrides: Partial<QuantValueSelection> = {}): QuantValueSelection {
  return {
    formulaVersion: 'value-quality-v2',
    observedAt: '2026-08-28T10:00:00.000Z',
    sampleCount: 3,
    readyCount: 3,
    partialCount: 0,
    insufficientCount: 0,
    items: [],
    ...overrides,
  }
}

function shareholderReturns(overrides: Partial<QuantShareholderReturnSelection> = {}): QuantShareholderReturnSelection {
  return {
    formulaVersion: 'shareholder-return-v1',
    observedAt: '2026-08-28T10:00:00.000Z',
    provider: 'tushare',
    providerChain: ['tushare', 'eastmoney'],
    sampleCount: 3,
    readyCount: 3,
    partialCount: 0,
    insufficientCount: 0,
    items: [],
    ...overrides,
  }
}

describe('buildQuantDataHealth', () => {
  it('reports all data domains as ready when coverage and results are complete', () => {
    const result = buildQuantDataHealth({
      watchlist: [watchlist('A'), watchlist('B'), watchlist('C')],
      sync: sync(),
      syncLoading: false,
      syncError: false,
      valueSelection: valueSelection(),
      valueLoading: false,
      valueError: false,
      shareholderReturns: shareholderReturns(),
      shareholderLoading: false,
      shareholderError: false,
    })

    expect(result).toMatchObject({
      formulaVersion: 'quant-data-health-v3',
      status: 'ready',
      label: '数据完整',
    })
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'daily', status: 'ready', readyCount: 3, totalCount: 3, action: null, actionLabel: null }),
      expect.objectContaining({ key: 'value-quality', status: 'ready', readyCount: 3, totalCount: 3, action: null, actionLabel: null }),
      expect.objectContaining({ key: 'shareholder-returns', status: 'ready', readyCount: 3, totalCount: 3, action: null, actionLabel: null }),
    ]))
  })

  it('keeps partial coverage and insufficient counts visible', () => {
    const result = buildQuantDataHealth({
      watchlist: [watchlist('A'), watchlist('B', false)],
      sync: sync('partial'),
      syncLoading: false,
      syncError: false,
      valueSelection: valueSelection({ readyCount: 1, partialCount: 0, insufficientCount: 2 }),
      valueLoading: false,
      valueError: false,
      shareholderReturns: shareholderReturns({ readyCount: 0, partialCount: 3, insufficientCount: 0 }),
      shareholderLoading: false,
      shareholderError: false,
    })

    expect(result.status).toBe('partial')
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'daily', status: 'partial', readyCount: 1, totalCount: 2, detail: '最近一次同步部分完成 · 1 / 2 只', action: 'open-watchlist', actionLabel: '去更新日线' }),
      expect.objectContaining({ key: 'value-quality', status: 'partial', detail: '1 / 3 只完整 · 0 只部分 · 2 只数据不足', action: 'refresh-value-quality', actionLabel: '重新读取价值质量' }),
      expect.objectContaining({ key: 'shareholder-returns', status: 'partial', detail: '0 / 3 只完整 · 3 只部分 · 0 只数据不足', action: 'refresh-shareholder-returns', actionLabel: '重新读取股东回报' }),
    ]))
  })

  it('prioritizes loading and failure without hiding resolved domains', () => {
    const loading = buildQuantDataHealth({
      watchlist: [watchlist('A')],
      sync: sync(),
      syncLoading: false,
      syncError: false,
      valueSelection: null,
      valueLoading: true,
      valueError: false,
      shareholderReturns: shareholderReturns({ sampleCount: 1 }),
      shareholderLoading: false,
      shareholderError: false,
    })
    expect(loading).toMatchObject({ status: 'loading', label: '读取中' })
    expect(loading.items.find(item => item.key === 'value-quality')).toMatchObject({ status: 'loading', detail: '正在读取当前数据', action: null, actionLabel: null })
    expect(loading.items.find(item => item.key === 'daily')).toMatchObject({ status: 'ready', action: null, actionLabel: null })

    const failed = buildQuantDataHealth({
      watchlist: [watchlist('A')],
      sync: sync(),
      syncLoading: false,
      syncError: false,
      valueSelection: valueSelection({ sampleCount: 1 }),
      valueLoading: false,
      valueError: false,
      shareholderReturns: null,
      shareholderLoading: false,
      shareholderError: true,
    })
    expect(failed).toMatchObject({ status: 'error', label: '读取失败' })
    expect(failed.items.find(item => item.key === 'shareholder-returns')).toMatchObject({ status: 'error', detail: '数据读取失败，点击下一步重试', action: 'refresh-shareholder-returns', actionLabel: '重新读取股东回报' })
    expect(failed.items.find(item => item.key === 'value-quality')).toMatchObject({ status: 'ready', action: null, actionLabel: null })
  })

  it('exposes a retry action for each failed data domain', () => {
    const result = buildQuantDataHealth({
      watchlist: [watchlist('A', false)],
      sync: sync('rejected'),
      syncLoading: false,
      syncError: true,
      valueSelection: null,
      valueLoading: false,
      valueError: true,
      shareholderReturns: null,
      shareholderLoading: false,
      shareholderError: true,
    })

    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'daily', action: 'open-watchlist', actionLabel: '去更新日线' }),
      expect.objectContaining({ key: 'value-quality', action: 'refresh-value-quality', actionLabel: '重新读取价值质量' }),
      expect.objectContaining({ key: 'shareholder-returns', action: 'refresh-shareholder-returns', actionLabel: '重新读取股东回报' }),
    ]))
  })

  it('classifies fresh, aging, stale, and unknown observations without changing completeness', () => {
    const result = buildQuantDataHealth({
      watchlist: [watchlist('A')],
      sync: sync('completed', { completedAt: '2026-09-01T12:00:00.000Z' }),
      syncLoading: false,
      syncError: false,
      valueSelection: valueSelection({ observedAt: '2026-08-30T11:59:00.000Z' }),
      valueLoading: false,
      valueError: false,
      shareholderReturns: shareholderReturns({ observedAt: '2026-08-24T12:00:00.000Z' }),
      shareholderLoading: false,
      shareholderError: false,
      now: '2026-09-01T12:00:00.000Z',
    })

    expect(result).toMatchObject({ status: 'ready', freshness: 'stale', freshnessLabel: '已过期' })
    expect(result.freshnessDetail).toContain('1 个数据域已超过 7 天')
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'daily', freshness: 'fresh', freshnessLabel: '最新', freshnessDetail: '刚刚观测' }),
      expect.objectContaining({ key: 'value-quality', freshness: 'aging', freshnessLabel: '需复核' }),
      expect.objectContaining({ key: 'shareholder-returns', freshness: 'stale', freshnessLabel: '已过期' }),
    ]))

    const unknown = buildQuantDataHealth({
      watchlist: [watchlist('A')],
      sync: sync('completed', { completedAt: '20260901' }),
      syncLoading: false,
      syncError: false,
      valueSelection: valueSelection({ observedAt: '2026-09-02T12:00:00.000Z' }),
      valueLoading: false,
      valueError: false,
      shareholderReturns: null,
      shareholderLoading: false,
      shareholderError: false,
      now: '2026-09-01T12:00:00.000Z',
    })

    expect(unknown.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'daily', freshness: 'fresh', freshnessLabel: '最新' }),
      expect.objectContaining({ key: 'value-quality', freshness: 'unknown', freshnessLabel: '时间未知', freshnessDetail: '观察时间晚于当前时间，暂不判断' }),
    ]))
    expect(unknown.freshness).toBe('unknown')
  })

  it('retains the previous observation time while a refresh is loading or has failed', () => {
    const loading = buildQuantDataHealth({
      watchlist: [watchlist('A')],
      sync: sync('completed', { completedAt: '2026-09-01T11:00:00.000Z' }),
      syncLoading: true,
      syncError: false,
      valueSelection: valueSelection({ observedAt: '2026-08-31T12:00:00.000Z' }),
      valueLoading: true,
      valueError: false,
      shareholderReturns: shareholderReturns({ observedAt: '2026-08-31T12:00:00.000Z' }),
      shareholderLoading: false,
      shareholderError: false,
      now: '2026-09-01T12:00:00.000Z',
    })
    expect(loading.items.find(item => item.key === 'value-quality')).toMatchObject({
      status: 'loading',
      readyCount: 3,
      totalCount: 3,
      observedAt: '2026-08-31T12:00:00.000Z',
      freshness: 'fresh',
      detail: '正在刷新 · 上次 3 / 3 只完整',
    })

    const failed = buildQuantDataHealth({
      watchlist: [watchlist('A')],
      sync: sync('completed', { completedAt: '2026-09-01T11:00:00.000Z' }),
      syncLoading: false,
      syncError: true,
      valueSelection: valueSelection({ observedAt: '2026-08-24T12:00:00.000Z' }),
      valueLoading: false,
      valueError: true,
      shareholderReturns: shareholderReturns({ observedAt: '2026-08-31T12:00:00.000Z' }),
      shareholderLoading: false,
      shareholderError: false,
      now: '2026-09-01T12:00:00.000Z',
    })
    expect(failed.items.find(item => item.key === 'daily')).toMatchObject({
      status: 'error',
      observedAt: '2026-09-01T11:00:00.000Z',
      freshness: 'fresh',
      detail: '同步状态读取失败 · 保留最近一次结果 · 当前覆盖 1 / 1 只',
    })
    expect(failed.items.find(item => item.key === 'value-quality')).toMatchObject({
      status: 'error',
      readyCount: 3,
      totalCount: 3,
      observedAt: '2026-08-24T12:00:00.000Z',
      freshness: 'stale',
      detail: '本次读取失败 · 保留上次 3 / 3 只完整',
    })
  })

  it('reuses the same freshness policy when combining base data and report snapshots', () => {
    expect(classifyQuantDataHealthFreshness('2026-08-30T12:00:00.000Z', '2026-09-01T12:00:00.000Z')).toMatchObject({ freshness: 'fresh' })
    expect(mergeQuantDataHealthFreshness('fresh', 'aging')).toBe('aging')
    expect(mergeQuantDataHealthFreshness('aging', 'unknown')).toBe('unknown')
    expect(mergeQuantDataHealthFreshness('aging', 'stale')).toBe('stale')
    expect(mergeQuantDataHealthFreshness('stale', 'unknown')).toBe('stale')
    expect(mergeQuantDataHealthFreshness('fresh', 'unknown')).toBe('unknown')
  })

  it('does not invent coverage for an empty watchlist or invalid counts', () => {
    const empty = buildQuantDataHealth({
      watchlist: [],
      sync: null,
      syncLoading: false,
      syncError: false,
      valueSelection: null,
      valueLoading: false,
      valueError: false,
      shareholderReturns: null,
      shareholderLoading: false,
      shareholderError: false,
    })
    expect(empty).toMatchObject({ status: 'missing', label: '待补数据', headline: '加入观察池后开始同步' })
    expect(empty.items.every(item => item.readyCount === 0 && item.totalCount === 0)).toBe(true)

    const bounded = buildQuantDataHealth({
      watchlist: [watchlist('A'), watchlist('B')],
      sync: sync(),
      syncLoading: false,
      syncError: false,
      valueSelection: valueSelection({ sampleCount: 2, readyCount: 1.9, partialCount: 2, insufficientCount: -1 }),
      valueLoading: false,
      valueError: false,
      shareholderReturns: shareholderReturns({ sampleCount: 2 }),
      shareholderLoading: false,
      shareholderError: false,
    })
    expect(bounded.items.find(item => item.key === 'value-quality')).toMatchObject({
      status: 'partial',
      readyCount: 1,
      totalCount: 2,
      detail: '1 / 2 只完整 · 1 只部分 · 0 只数据不足',
    })
  })
})
