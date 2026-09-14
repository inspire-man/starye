import type { Database } from '@starye/db'
import type {
  QuantScheduledAiStatus,
  QuantScheduledJob,
  QuantScheduledJobItem,
  QuantScheduledLatestReport,
  QuantScheduledMarkerRow,
  QuantScheduledReason,
  QuantScheduledRunStatus,
  QuantScheduledStage,
  QuantScheduledWatchlistRow,
} from './scheduled-research'
import {
  quantScheduledResearchItems,
  quantScheduledResearchRuns,
  quantWatchlist,
} from '@starye/db/schema'
import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { listQuantResearchMarkers, listQuantResearchRuns, listQuantWatchlistWithStats } from './repository'
import { QUANT_SCHEDULED_REASONS } from './scheduled-research'

function asReason(value: unknown): QuantScheduledReason | null {
  return typeof value === 'string' && (QUANT_SCHEDULED_REASONS as readonly string[]).includes(value)
    ? value as QuantScheduledReason
    : null
}

function parseReasons(value: string): QuantScheduledReason[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.flatMap(item => asReason(item) ? [item] : []) : []
  }
  catch {
    return []
  }
}

function toJobItem(row: typeof quantScheduledResearchItems.$inferSelect): QuantScheduledJobItem {
  return {
    tsCode: row.tsCode,
    name: row.name,
    reasons: parseReasons(row.reasonsJson),
    stage: row.stage as QuantScheduledStage,
    aiStatus: row.aiStatus as QuantScheduledAiStatus,
    errorStage: row.errorStage === 'watchlist' || row.errorStage === 'data' || row.errorStage === 'research' || row.errorStage === 'ai' ? row.errorStage : null,
    errorCode: row.errorCode,
    researchRunId: row.researchRunId,
    reviewDateBefore: row.reviewDateBefore,
    reviewDateAfter: row.reviewDateAfter,
  }
}

async function jobFromRow(db: Database, row: typeof quantScheduledResearchRuns.$inferSelect): Promise<QuantScheduledJob> {
  const items = await db.select().from(quantScheduledResearchItems).where(eq(quantScheduledResearchItems.runId, row.id)).orderBy(quantScheduledResearchItems.tsCode).all()
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as QuantScheduledRunStatus,
    dueCount: row.dueCount,
    processedCount: row.processedCount,
    completedCount: row.completedCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    cursorTsCode: row.cursorTsCode,
    leaseExpiresAt: row.leaseExpiresAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    items: items.map(toJobItem),
  }
}

export async function listQuantScheduledResearchUserIds(db: Database): Promise<string[]> {
  const rows = await db.select({ userId: quantWatchlist.userId }).from(quantWatchlist).all()
  return [...new Set(rows.flatMap(row => row.userId ? [row.userId] : []))].sort()
}

export async function listQuantScheduledWatchlist(db: Database, userId: string): Promise<QuantScheduledWatchlistRow[]> {
  const rows = await listQuantWatchlistWithStats(db, userId)
  return rows.map(row => ({
    tsCode: row.tsCode,
    name: row.name,
    barCount: row.barCount,
    latestTradeDate: row.latestTradeDate,
  }))
}

export async function listQuantScheduledMarkers(db: Database, userId: string): Promise<QuantScheduledMarkerRow[]> {
  const rows = await listQuantResearchMarkers(db, userId)
  return rows.map(row => ({
    tsCode: row.tsCode,
    status: row.status,
    note: row.note,
    reviewDate: row.reviewDate,
  }))
}

export async function readLatestQuantScheduledReport(db: Database, userId: string, tsCode: string): Promise<QuantScheduledLatestReport | null> {
  const [latest] = await listQuantResearchRuns(db, userId, tsCode, 1)
  return latest ? { id: latest.id, status: latest.status } : null
}

export async function readLatestQuantScheduledJob(db: Database, userId: string): Promise<QuantScheduledJob | null> {
  const row = await db.select().from(quantScheduledResearchRuns).where(eq(quantScheduledResearchRuns.userId, userId)).orderBy(desc(quantScheduledResearchRuns.startedAt), desc(quantScheduledResearchRuns.id)).limit(1).get()
  return row ? jobFromRow(db, row) : null
}

export async function createQuantScheduledJob(db: Database, input: {
  readonly userId: string
  readonly dueCount: number
  readonly now: Date
  readonly leaseExpiresAt: Date
}): Promise<QuantScheduledJob> {
  const id = nanoid()
  await db.insert(quantScheduledResearchRuns).values({
    id,
    userId: input.userId,
    status: 'running',
    dueCount: input.dueCount,
    processedCount: 0,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    cursorTsCode: null,
    leaseExpiresAt: input.leaseExpiresAt,
    startedAt: input.now,
    completedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  })
  const persisted = await db.select().from(quantScheduledResearchRuns).where(eq(quantScheduledResearchRuns.id, id)).get()
  if (!persisted)
    throw new Error('Scheduled research run readback failed')
  return jobFromRow(db, persisted)
}

export async function takeOverQuantScheduledJob(db: Database, jobId: string, now: Date, leaseExpiresAt: Date): Promise<QuantScheduledJob> {
  await db.update(quantScheduledResearchRuns)
    .set({ leaseExpiresAt, updatedAt: now, status: 'running' })
    .where(eq(quantScheduledResearchRuns.id, jobId))
  const persisted = await db.select().from(quantScheduledResearchRuns).where(eq(quantScheduledResearchRuns.id, jobId)).get()
  if (!persisted)
    throw new Error('Scheduled research run not found')
  return jobFromRow(db, persisted)
}

export async function saveQuantScheduledJobItem(db: Database, jobId: string, userId: string, item: QuantScheduledJobItem, now: Date): Promise<void> {
  await db.insert(quantScheduledResearchItems).values({
    id: `${jobId}:${item.tsCode}`,
    runId: jobId,
    userId,
    tsCode: item.tsCode,
    name: item.name,
    reasonsJson: JSON.stringify(item.reasons),
    stage: item.stage,
    aiStatus: item.aiStatus,
    errorStage: item.errorStage,
    errorCode: item.errorCode,
    researchRunId: item.researchRunId,
    reviewDateBefore: item.reviewDateBefore,
    reviewDateAfter: item.reviewDateAfter,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [quantScheduledResearchItems.runId, quantScheduledResearchItems.tsCode],
    set: {
      name: item.name,
      reasonsJson: JSON.stringify(item.reasons),
      stage: item.stage,
      aiStatus: item.aiStatus,
      errorStage: item.errorStage,
      errorCode: item.errorCode,
      researchRunId: item.researchRunId,
      reviewDateBefore: item.reviewDateBefore,
      reviewDateAfter: item.reviewDateAfter,
      updatedAt: now,
    },
  })
}

export async function finishQuantScheduledJob(db: Database, job: QuantScheduledJob, now: Date): Promise<QuantScheduledJob> {
  await db.update(quantScheduledResearchRuns)
    .set({
      status: job.status,
      dueCount: job.dueCount,
      processedCount: job.processedCount,
      completedCount: job.completedCount,
      failedCount: job.failedCount,
      skippedCount: job.skippedCount,
      cursorTsCode: job.cursorTsCode,
      leaseExpiresAt: job.leaseExpiresAt,
      completedAt: job.completedAt,
      updatedAt: now,
    })
    .where(eq(quantScheduledResearchRuns.id, job.id))
  const persisted = await db.select().from(quantScheduledResearchRuns).where(eq(quantScheduledResearchRuns.id, job.id)).get()
  if (!persisted)
    throw new Error('Scheduled research run readback failed')
  return jobFromRow(db, persisted)
}

export function scheduledResearchView(job: QuantScheduledJob) {
  return {
    id: job.id,
    status: job.status,
    dueCount: job.dueCount,
    processedCount: job.processedCount,
    completedCount: job.completedCount,
    failedCount: job.failedCount,
    skippedCount: job.skippedCount,
    startedAt: job.startedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    items: job.items.map(item => ({
      tsCode: item.tsCode,
      name: item.name,
      reasons: item.reasons,
      stage: item.stage,
      aiStatus: item.aiStatus,
      errorStage: item.errorStage,
      errorCode: item.errorCode,
      researchRunId: item.researchRunId,
      reviewDateBefore: item.reviewDateBefore,
      reviewDateAfter: item.reviewDateAfter,
    })),
  }
}
