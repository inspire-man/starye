import type { QuantScheduledJob, QuantScheduledResearchPorts } from '../scheduled-research'
import { describe, expect, it, vi } from 'vitest'
import { QuantError } from '../errors'
import {
  collectScheduledDueReasons,
  nextScheduledReviewDate,
  QUANT_SCHEDULED_RESEARCH_BATCH_SIZE,

  runQuantScheduledResearchTick,
  shanghaiCalendarDate,
  shouldAdvanceReviewDate,
} from '../scheduled-research'

const now = new Date('2026-09-13T04:00:00.000Z')

function job(overrides: Partial<QuantScheduledJob> = {}): QuantScheduledJob {
  return {
    id: 'job-1',
    userId: 'user-1',
    status: 'running',
    dueCount: 1,
    processedCount: 0,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    cursorTsCode: null,
    leaseExpiresAt: new Date(now.getTime() + 60_000),
    startedAt: now,
    completedAt: null,
    items: [],
    ...overrides,
  }
}

function ports(overrides: Partial<QuantScheduledResearchPorts> = {}): QuantScheduledResearchPorts {
  const current = job()
  return {
    listUserIds: async () => ['user-1'],
    listWatchlist: async () => [{ tsCode: '601899.SH', name: '紫金矿业', barCount: 10, latestTradeDate: '20260901' }],
    listMarkers: async () => [{ tsCode: '601899.SH', status: 'unreviewed', note: null, reviewDate: '2026-09-01' }],
    latestReport: async () => null,
    latestJob: async () => null,
    createJob: async () => current,
    takeOverJob: async () => current,
    saveItem: async () => {},
    finishJob: async input => input,
    syncDaily: async () => ({ status: 'completed' }),
    generateResearch: async () => ({ id: 'run-1', status: 'ready' }),
    isAiReady: async () => false,
    generateAi: async () => {},
    updateReviewDate: async () => {},
    ...overrides,
  }
}

describe('scheduled research due reasons', () => {
  it('classifies overdue, stale daily and missing reports without paused markers', () => {
    expect(collectScheduledDueReasons({
      markerStatus: 'unreviewed',
      reviewDate: '2026-09-01',
      barCount: 0,
      latestTradeDate: null,
      latestReportStatus: null,
      now,
    })).toEqual(['overdue', 'stale-daily', 'insufficient-data'])

    expect(collectScheduledDueReasons({
      markerStatus: 'unreviewed',
      reviewDate: '2026-09-20',
      barCount: 120,
      latestTradeDate: '20260912',
      latestReportStatus: 'partial',
      now,
    })).toEqual([])

    expect(collectScheduledDueReasons({
      markerStatus: 'excluded',
      reviewDate: '2026-09-01',
      barCount: 0,
      latestTradeDate: null,
      latestReportStatus: null,
      now,
    })).toEqual([])
  })

  it('advances review date for overdue, today, and unset dates only', () => {
    expect(shouldAdvanceReviewDate(['overdue'], '2026-09-01')).toBe(true)
    expect(shouldAdvanceReviewDate(['stale-daily'], '2026-09-20')).toBe(false)
    expect(shouldAdvanceReviewDate(['stale-daily'], null)).toBe(true)
    expect(nextScheduledReviewDate(now)).toBe('2026-09-20')
    expect(shanghaiCalendarDate(now)).toBe('2026-09-13')
  })
})

describe('runQuantScheduledResearchTick', () => {
  it('syncs, generates a deterministic report, skips AI, and advances overdue review dates', async () => {
    const updateReviewDate = vi.fn(async () => {})
    const saveItem = vi.fn(async () => {})
    const result = await runQuantScheduledResearchTick(ports({ updateReviewDate, saveItem }), now)

    expect(result.processedCount).toBe(1)
    expect(updateReviewDate).toHaveBeenCalledWith({
      userId: 'user-1',
      tsCode: '601899.SH',
      status: 'unreviewed',
      note: null,
      reviewDate: '2026-09-20',
    })
    expect(saveItem.mock.calls.at(-1)?.[2]).toMatchObject({
      stage: 'completed',
      aiStatus: 'skipped',
      researchRunId: 'run-1',
      reviewDateAfter: '2026-09-20',
    })
  })

  it('keeps a ready report when AI fails and still advances the review date', async () => {
    const updateReviewDate = vi.fn(async () => {})
    const saveItem = vi.fn(async () => {})
    await runQuantScheduledResearchTick(ports({
      isAiReady: async () => true,
      generateAi: async () => {
        throw new QuantError('QUANT_AI_SUMMARY_UPSTREAM', 'upstream failed', 502)
      },
      updateReviewDate,
      saveItem,
    }), now)

    expect(updateReviewDate).toHaveBeenCalledOnce()
    expect(saveItem.mock.calls.at(-1)?.[2]).toMatchObject({
      stage: 'completed',
      aiStatus: 'error',
      errorCode: 'QUANT_AI_SUMMARY_UPSTREAM',
      researchRunId: 'run-1',
    })
  })

  it('records a data-stage error when daily sync is incomplete', async () => {
    const updateReviewDate = vi.fn(async () => {})
    const saveItem = vi.fn(async () => {})
    await runQuantScheduledResearchTick(ports({
      syncDaily: async () => ({ status: 'partial' }),
      updateReviewDate,
      saveItem,
    }), now)

    expect(updateReviewDate).not.toHaveBeenCalled()
    expect(saveItem.mock.calls.at(-1)?.[2]).toMatchObject({
      stage: 'error',
      errorStage: 'data',
      errorCode: 'QUANT_RESEARCH_DATA_INCOMPLETE',
    })
  })

  it('processes at most three due items in one tick', async () => {
    const generateResearch = vi.fn(async (userId: string, tsCode: string) => ({ id: `run-${tsCode}`, status: 'ready' as const }))
    const watchlist = ['AAA.SH', 'BBB.SH', 'CCC.SH', 'DDD.SH'].map(tsCode => ({
      tsCode,
      name: tsCode,
      barCount: 0,
      latestTradeDate: null,
    }))
    await runQuantScheduledResearchTick(ports({
      listWatchlist: async () => watchlist,
      listMarkers: async () => watchlist.map(item => ({ tsCode: item.tsCode, status: 'unreviewed', note: null, reviewDate: '2026-09-01' })),
      generateResearch,
    }), now)
    expect(generateResearch).toHaveBeenCalledTimes(QUANT_SCHEDULED_RESEARCH_BATCH_SIZE)
  })

  it('checkpoints the item before AI generation', async () => {
    const order: string[] = []
    await runQuantScheduledResearchTick(ports({
      isAiReady: async () => true,
      saveItem: async (_jobId, _userId, item) => {
        order.push(`save:${item.stage}:${item.aiStatus}`)
      },
      generateAi: async () => {
        order.push('ai')
      },
    }), now)
    const aiIndex = order.indexOf('ai')
    expect(aiIndex).toBeGreaterThan(0)
    expect(order.slice(0, aiIndex)).toContain('save:ai:running')
  })

  it('advances overdue review dates for partial reports but not insufficient_data', async () => {
    const updatePartial = vi.fn(async () => {})
    await runQuantScheduledResearchTick(ports({
      generateResearch: async () => ({ id: 'run-partial', status: 'partial' }),
      updateReviewDate: updatePartial,
    }), now)
    expect(updatePartial).toHaveBeenCalledWith(expect.objectContaining({
      tsCode: '601899.SH',
      reviewDate: '2026-09-20',
    }))

    const updateMissing = vi.fn(async () => {})
    await runQuantScheduledResearchTick(ports({
      latestJob: async () => null,
      generateResearch: async () => ({ id: 'run-missing', status: 'insufficient_data' }),
      updateReviewDate: updateMissing,
    }), now)
    expect(updateMissing).not.toHaveBeenCalled()
  })
})
