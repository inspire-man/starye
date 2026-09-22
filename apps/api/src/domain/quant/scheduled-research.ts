import { QuantError } from './errors'

export const QUANT_SCHEDULED_RESEARCH_BATCH_SIZE = 3
export const QUANT_SCHEDULED_RESEARCH_INTERVAL_MS = 6 * 60 * 60 * 1000
export const QUANT_SCHEDULED_RESEARCH_LEASE_MS = 10 * 60 * 1000
export const QUANT_SCHEDULED_RESEARCH_STALE_DAYS = 7
export const QUANT_SCHEDULED_RESEARCH_REVIEW_HORIZON_DAYS = 7

export const QUANT_SCHEDULED_REASONS = ['overdue', 'today', 'stale-daily', 'insufficient-data'] as const
export type QuantScheduledReason = typeof QUANT_SCHEDULED_REASONS[number]
export type QuantScheduledStage = 'watchlist' | 'data' | 'research' | 'ai' | 'completed' | 'error' | 'skipped'
export type QuantScheduledAiStatus = 'pending' | 'running' | 'success' | 'skipped' | 'error'
export type QuantScheduledRunStatus = 'running' | 'completed' | 'partial' | 'failed'
export type QuantScheduledMarkerStatus = 'unreviewed' | 'priority' | 'paused' | 'excluded'

const REASON_RANK: Record<QuantScheduledReason, number> = {
  'overdue': 0,
  'today': 1,
  'insufficient-data': 2,
  'stale-daily': 3,
}

export interface QuantScheduledWatchlistRow {
  readonly tsCode: string
  readonly name: string | null
  readonly barCount: number
  readonly latestTradeDate: string | null
}

export interface QuantScheduledMarkerRow {
  readonly tsCode: string
  readonly status: QuantScheduledMarkerStatus
  readonly note: string | null
  readonly reviewDate: string | null
}

export interface QuantScheduledLatestReport {
  readonly id: string
  readonly status: 'ready' | 'partial' | 'insufficient_data'
}

export interface QuantScheduledDueItem {
  readonly tsCode: string
  readonly name: string | null
  readonly markerStatus: QuantScheduledMarkerStatus
  readonly note: string | null
  readonly reviewDate: string | null
  readonly reasons: readonly QuantScheduledReason[]
}

export interface QuantScheduledJobItem {
  readonly tsCode: string
  readonly name: string | null
  readonly reasons: readonly QuantScheduledReason[]
  readonly stage: QuantScheduledStage
  readonly aiStatus: QuantScheduledAiStatus
  readonly errorStage: 'watchlist' | 'data' | 'research' | 'ai' | null
  readonly errorCode: string | null
  readonly researchRunId: string | null
  readonly reviewDateBefore: string | null
  readonly reviewDateAfter: string | null
}

export interface QuantScheduledJob {
  readonly id: string
  readonly userId: string
  readonly status: QuantScheduledRunStatus
  readonly dueCount: number
  readonly processedCount: number
  readonly completedCount: number
  readonly failedCount: number
  readonly skippedCount: number
  readonly cursorTsCode: string | null
  readonly leaseExpiresAt: Date | null
  readonly startedAt: Date
  readonly completedAt: Date | null
  readonly items: readonly QuantScheduledJobItem[]
}

export interface QuantScheduledResearchPorts {
  readonly listUserIds: () => Promise<readonly string[]>
  readonly listWatchlist: (userId: string) => Promise<readonly QuantScheduledWatchlistRow[]>
  readonly listMarkers: (userId: string) => Promise<readonly QuantScheduledMarkerRow[]>
  readonly latestReport: (userId: string, tsCode: string) => Promise<QuantScheduledLatestReport | null>
  readonly latestJob: (userId: string) => Promise<QuantScheduledJob | null>
  readonly createJob: (input: { readonly userId: string, readonly dueCount: number, readonly now: Date, readonly leaseExpiresAt: Date }) => Promise<QuantScheduledJob>
  readonly takeOverJob: (jobId: string, now: Date, leaseExpiresAt: Date) => Promise<QuantScheduledJob>
  readonly saveItem: (jobId: string, userId: string, item: QuantScheduledJobItem, now: Date) => Promise<void>
  readonly finishJob: (job: QuantScheduledJob, now: Date) => Promise<QuantScheduledJob>
  readonly syncDaily: (userId: string, tsCode: string) => Promise<{ readonly status: string }>
  readonly generateResearch: (userId: string, tsCode: string) => Promise<{ readonly id: string, readonly status: 'ready' | 'partial' | 'insufficient_data' }>
  readonly isAiReady: (userId: string) => Promise<boolean>
  readonly generateAi: (userId: string, runId: string) => Promise<void>
  readonly updateReviewDate: (input: {
    readonly userId: string
    readonly tsCode: string
    readonly status: QuantScheduledMarkerStatus
    readonly note: string | null
    readonly reviewDate: string | null
  }) => Promise<void>
}

export interface QuantScheduledTickResult {
  readonly userId: string | null
  readonly jobId: string | null
  readonly processedCount: number
  readonly skippedReason: 'no-users' | 'cooldown' | 'leased' | 'no-due' | null
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function shanghaiCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  if (!year || !month || !day)
    throw new QuantError('QUANT_INVALID_INPUT', 'Unable to resolve Asia/Shanghai date', 500)
  return `${year}-${month}-${day}`
}

export function addCalendarDays(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date)
  if (!match)
    throw new QuantError('QUANT_INVALID_INPUT', 'Review date must be YYYY-MM-DD', 400)
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)
  const next = new Date(utc)
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

export function nextScheduledReviewDate(now: Date, days = QUANT_SCHEDULED_RESEARCH_REVIEW_HORIZON_DAYS): string {
  return addCalendarDays(shanghaiCalendarDate(now), days)
}

function parseTradeDate(value: string | null): number | null {
  if (!value || !/^\d{8}$/u.test(value))
    return null
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)))
}

function parseReviewDate(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return null
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function isStaleDaily(latestTradeDate: string | null, barCount: number, now: Date): boolean {
  if (!barCount || !latestTradeDate)
    return true
  const trade = parseTradeDate(latestTradeDate)
  const today = parseReviewDate(shanghaiCalendarDate(now))
  if (trade === null || today === null)
    return true
  return today - trade > QUANT_SCHEDULED_RESEARCH_STALE_DAYS * 24 * 60 * 60 * 1000
}

export function collectScheduledDueReasons(input: {
  readonly markerStatus: QuantScheduledMarkerStatus
  readonly reviewDate: string | null
  readonly barCount: number
  readonly latestTradeDate: string | null
  readonly latestReportStatus: QuantScheduledLatestReport['status'] | null
  readonly now: Date
}): QuantScheduledReason[] {
  if (input.markerStatus === 'paused' || input.markerStatus === 'excluded')
    return []

  const today = shanghaiCalendarDate(input.now)
  const review = parseReviewDate(input.reviewDate)
  const todayStamp = parseReviewDate(today)
  const reasons: QuantScheduledReason[] = []
  if (review !== null && todayStamp !== null) {
    const deltaDays = Math.round((review - todayStamp) / (24 * 60 * 60 * 1000))
    if (deltaDays < 0)
      reasons.push('overdue')
    else if (deltaDays === 0)
      reasons.push('today')
  }
  if (isStaleDaily(input.latestTradeDate, input.barCount, input.now))
    reasons.push('stale-daily')
  if (input.latestReportStatus === null || input.latestReportStatus === 'insufficient_data')
    reasons.push('insufficient-data')
  return reasons
}

export function shouldAdvanceReviewDate(reasons: readonly QuantScheduledReason[], reviewDate: string | null): boolean {
  return reasons.includes('overdue') || reasons.includes('today') || reviewDate === null
}

function markerFor(tsCode: string, markers: readonly QuantScheduledMarkerRow[]): QuantScheduledMarkerRow {
  return markers.find(marker => marker.tsCode === tsCode) ?? {
    tsCode,
    status: 'unreviewed',
    note: null,
    reviewDate: null,
  }
}

export function collectScheduledDueItems(input: {
  readonly watchlist: readonly QuantScheduledWatchlistRow[]
  readonly markers: readonly QuantScheduledMarkerRow[]
  readonly latestReports: ReadonlyMap<string, QuantScheduledLatestReport | null>
  readonly now: Date
}): QuantScheduledDueItem[] {
  return input.watchlist.flatMap((item) => {
    const marker = markerFor(item.tsCode, input.markers)
    const reasons = collectScheduledDueReasons({
      markerStatus: marker.status,
      reviewDate: marker.reviewDate,
      barCount: item.barCount,
      latestTradeDate: item.latestTradeDate,
      latestReportStatus: input.latestReports.get(item.tsCode)?.status ?? null,
      now: input.now,
    })
    if (!reasons.length)
      return []
    return [{
      tsCode: item.tsCode,
      name: item.name,
      markerStatus: marker.status,
      note: marker.note,
      reviewDate: marker.reviewDate,
      reasons,
    } satisfies QuantScheduledDueItem]
  }).sort((left, right) => {
    const rank = Math.min(...left.reasons.map(reason => REASON_RANK[reason])) - Math.min(...right.reasons.map(reason => REASON_RANK[reason]))
    return rank || left.tsCode.localeCompare(right.tsCode)
  })
}

function errorCode(error: unknown): string {
  if (error instanceof QuantError)
    return error.code
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && error.code.trim())
    return error.code
  return 'QUANT_SCHEDULED_RESEARCH_FAILED'
}

function jobWithItem(job: QuantScheduledJob, item: QuantScheduledJobItem): QuantScheduledJob {
  const items = [...job.items.filter(current => current.tsCode !== item.tsCode), item]
  const processedCount = items.filter(current => current.stage === 'completed' || current.stage === 'error' || current.stage === 'skipped').length
  const completedCount = items.filter(current => current.stage === 'completed').length
  const failedCount = items.filter(current => current.stage === 'error').length
  const skippedCount = items.filter(current => current.stage === 'skipped').length
  return {
    ...job,
    processedCount,
    completedCount,
    failedCount,
    skippedCount,
    cursorTsCode: item.tsCode,
    items,
  }
}

async function processDueItem(
  ports: QuantScheduledResearchPorts,
  userId: string,
  job: QuantScheduledJob,
  due: QuantScheduledDueItem,
  now: Date,
): Promise<QuantScheduledJob> {
  let item: QuantScheduledJobItem = {
    tsCode: due.tsCode,
    name: due.name,
    reasons: due.reasons,
    stage: 'data',
    aiStatus: 'pending',
    errorStage: null,
    errorCode: null,
    researchRunId: null,
    reviewDateBefore: due.reviewDate,
    reviewDateAfter: due.reviewDate,
  }
  try {
    await ports.saveItem(job.id, userId, item, now)
    const sync = await ports.syncDaily(userId, due.tsCode)
    if (sync.status !== 'completed') {
      item = {
        ...item,
        stage: 'error',
        errorStage: 'data',
        errorCode: 'QUANT_RESEARCH_DATA_INCOMPLETE',
      }
      await ports.saveItem(job.id, userId, item, now)
      return jobWithItem(job, item)
    }

    item = { ...item, stage: 'research' }
    await ports.saveItem(job.id, userId, item, now)
    const run = await ports.generateResearch(userId, due.tsCode)
    item = { ...item, researchRunId: run.id }

    const aiReady = await ports.isAiReady(userId)
    if (aiReady) {
      item = { ...item, stage: 'ai', aiStatus: 'running' }
      await ports.saveItem(job.id, userId, item, now)
      try {
        await ports.generateAi(userId, run.id)
        item = { ...item, aiStatus: 'success' }
      }
      catch (error) {
        item = { ...item, aiStatus: 'error', errorCode: errorCode(error) }
      }
    }
    else {
      item = { ...item, aiStatus: 'skipped' }
    }

    if ((run.status === 'ready' || run.status === 'partial') && shouldAdvanceReviewDate(due.reasons, due.reviewDate)) {
      const reviewDate = nextScheduledReviewDate(now)
      await ports.updateReviewDate({
        userId,
        tsCode: due.tsCode,
        status: due.markerStatus,
        note: due.note,
        reviewDate,
      })
      item = { ...item, reviewDateAfter: reviewDate }
    }

    item = { ...item, stage: 'completed' }
    await ports.saveItem(job.id, userId, item, now)
    return jobWithItem(job, item)
  }
  catch (error) {
    const errorStage = item.stage === 'ai' || item.stage === 'research' || item.stage === 'data' ? item.stage : 'research'
    item = {
      ...item,
      stage: 'error',
      errorStage,
      errorCode: errorCode(error),
      aiStatus: errorStage === 'ai' ? 'error' : item.aiStatus,
    }
    await ports.saveItem(job.id, userId, item, now)
    return jobWithItem(job, item)
  }
}

function remainingDue(dueItems: readonly QuantScheduledDueItem[], job: QuantScheduledJob): QuantScheduledDueItem[] {
  const processed = new Set(job.items.filter((item) => {
    if (item.stage === 'error' || item.stage === 'skipped')
      return true
    if (item.stage !== 'completed')
      return false
    const overdueStuck = item.reasons.includes('overdue') && item.reviewDateAfter === item.reviewDateBefore
    return !overdueStuck
  }).map(item => item.tsCode))
  return dueItems.filter(item => !processed.has(item.tsCode))
}

export async function runQuantScheduledResearchTick(
  ports: QuantScheduledResearchPorts,
  now = new Date(),
  onlyUserId?: string,
): Promise<QuantScheduledTickResult> {
  const userIds = onlyUserId ? [onlyUserId] : await ports.listUserIds()
  if (!userIds.length)
    return { userId: null, jobId: null, processedCount: 0, skippedReason: 'no-users' }

  for (const userId of userIds) {
    const watchlist = await ports.listWatchlist(userId)
    if (!watchlist.length)
      continue
    const markers = await ports.listMarkers(userId)
    const latestReports = new Map<string, QuantScheduledLatestReport | null>()
    for (const item of watchlist)
      latestReports.set(item.tsCode, await ports.latestReport(userId, item.tsCode))
    const dueItems = collectScheduledDueItems({ watchlist, markers, latestReports, now })
    const latestJob = await ports.latestJob(userId)
    const remaining = latestJob ? remainingDue(dueItems, latestJob) : dueItems

    if (latestJob?.status === 'running' && latestJob.leaseExpiresAt && latestJob.leaseExpiresAt.getTime() > now.getTime())
      continue

    let job: QuantScheduledJob | null = null
    if (latestJob?.status === 'running') {
      job = await ports.takeOverJob(latestJob.id, now, new Date(now.getTime() + QUANT_SCHEDULED_RESEARCH_LEASE_MS))
    }
    else if (!remaining.length) {
      continue
    }
    else if (latestJob?.completedAt && now.getTime() - latestJob.completedAt.getTime() < QUANT_SCHEDULED_RESEARCH_INTERVAL_MS) {
      continue
    }
    else {
      job = await ports.createJob({
        userId,
        dueCount: dueItems.length,
        now,
        leaseExpiresAt: new Date(now.getTime() + QUANT_SCHEDULED_RESEARCH_LEASE_MS),
      })
    }

    if (!job)
      continue

    const batch = remainingDue(dueItems, job).slice(0, QUANT_SCHEDULED_RESEARCH_BATCH_SIZE)
    if (!batch.length) {
      const finished = await ports.finishJob({
        ...job,
        status: job.failedCount > 0 ? 'partial' : 'completed',
        completedAt: now,
      }, now)
      return { userId, jobId: finished.id, processedCount: 0, skippedReason: 'no-due' }
    }

    for (const due of batch)
      job = await processDueItem(ports, userId, job, due, now)

    const leftover = remainingDue(dueItems, job)
    const status: QuantScheduledRunStatus = leftover.length
      ? 'running'
      : job.failedCount > 0
        ? 'partial'
        : 'completed'
    const finished = await ports.finishJob({
      ...job,
      status,
      dueCount: dueItems.length,
      completedAt: leftover.length ? null : now,
      leaseExpiresAt: leftover.length ? new Date(now.getTime() + QUANT_SCHEDULED_RESEARCH_LEASE_MS) : null,
    }, now)
    return { userId, jobId: finished.id, processedCount: batch.length, skippedReason: null }
  }

  return { userId: null, jobId: null, processedCount: 0, skippedReason: 'cooldown' }
}
