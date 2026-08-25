import type { Database } from '@starye/db'
import type { DailyBar, MomentumCandidate, QuantSyncStatus } from './types'
import {
  quantDailyBars,
  quantResearchMarkers,
  quantScanSnapshots,
  quantSyncState,
  quantWatchlist,
} from '@starye/db/schema'
import { and, asc, desc, eq, gt, gte, lte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { QuantError } from './errors'

export const QUANT_SYNC_STATE_ID = 'daily'
export const MAX_WATCHLIST_SIZE = 50
export const QUANT_SYNC_LEASE_DURATION_MS = 120_000
export const QUANT_SYNC_SNAPSHOT_RETENTION = 30
export const QUANT_RESEARCH_STATUSES = ['unreviewed', 'priority', 'paused', 'excluded'] as const
export type QuantResearchStatus = typeof QUANT_RESEARCH_STATUSES[number]

type PersistedQuantSyncStatus = QuantSyncStatus | 'running'

function changedRows(result: unknown): number {
  if (!result || typeof result !== 'object')
    return 0
  const candidate = result as {
    readonly meta?: { readonly changes?: unknown }
    readonly rowsAffected?: unknown
  }
  if (typeof candidate.meta?.changes === 'number')
    return candidate.meta.changes
  return typeof candidate.rowsAffected === 'number' ? candidate.rowsAffected : 0
}

function toUnixSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1000)
}

function leaseExpiry(now: Date, durationMs: number): Date {
  const durationSeconds = Math.max(1, Math.ceil(durationMs / 1000))
  return new Date((Math.ceil(now.getTime() / 1000) + durationSeconds) * 1000)
}

export function normalizeTsCode(value: string): string {
  const normalized = value.trim().toUpperCase()
  if (!/^[A-Z0-9.-]{1,20}$/u.test(normalized))
    throw new QuantError('QUANT_INVALID_INPUT', 'ts_code is invalid', 400)
  return normalized
}

export function normalizeTradeDate(value: string, field = 'date'): string {
  const normalized = value.trim()
  if (!/^\d{8}$/u.test(normalized))
    throw new QuantError('QUANT_INVALID_INPUT', `${field} must be YYYYMMDD`, 400)
  return normalized
}

export async function listQuantWatchlist(db: Database) {
  return db.select().from(quantWatchlist).orderBy(asc(quantWatchlist.createdAt)).all()
}

export async function listQuantWatchlistWithStats(db: Database) {
  const rows = await listQuantWatchlist(db)
  return Promise.all(rows.map(async (row) => {
    const stats = await db
      .select({
        barCount: sql<number>`count(*)`,
        latestTradeDate: sql<string | null>`max(${quantDailyBars.tradeDate})`,
      })
      .from(quantDailyBars)
      .where(eq(quantDailyBars.tsCode, row.tsCode))
      .get()
    const latest = await db
      .select({
        close: quantDailyBars.close,
        pctChg: quantDailyBars.pctChg,
      })
      .from(quantDailyBars)
      .where(eq(quantDailyBars.tsCode, row.tsCode))
      .orderBy(desc(quantDailyBars.tradeDate))
      .limit(1)
      .get()
    return {
      ...row,
      latestTradeDate: stats?.latestTradeDate ?? null,
      barCount: Number(stats?.barCount ?? 0),
      latestClose: latest?.close ?? null,
      latestChangePercent: latest?.pctChg ?? null,
    }
  }))
}

export async function getQuantWatchlistItem(db: Database, tsCode: string) {
  return db.select().from(quantWatchlist).where(eq(quantWatchlist.tsCode, normalizeTsCode(tsCode))).get()
}

export async function createQuantWatchlistItem(db: Database, input: { readonly tsCode: string, readonly name?: string | null }) {
  const tsCode = normalizeTsCode(input.tsCode)
  const existing = await getQuantWatchlistItem(db, tsCode)
  if (existing)
    return existing

  const countRows = await db.select({ count: sql<number>`count(*)` }).from(quantWatchlist).all()
  if (Number(countRows[0]?.count ?? 0) >= MAX_WATCHLIST_SIZE) {
    throw new QuantError('QUANT_WATCHLIST_LIMIT', 'Watchlist limit is 50 items', 409)
  }

  await db.insert(quantWatchlist).values({
    id: nanoid(),
    tsCode,
    name: input.name?.trim() || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing({ target: quantWatchlist.tsCode })

  const persisted = await getQuantWatchlistItem(db, tsCode)
  if (!persisted)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item readback failed', 500)
  return persisted
}

export async function updateQuantWatchlistItem(db: Database, tsCode: string, name: string | null) {
  const normalizedCode = normalizeTsCode(tsCode)
  await db.update(quantWatchlist)
    .set({ name: name?.trim() || null, updatedAt: new Date() })
    .where(eq(quantWatchlist.tsCode, normalizedCode))
  const persisted = await getQuantWatchlistItem(db, normalizedCode)
  if (!persisted)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)
  return persisted
}

export async function deleteQuantWatchlistItem(db: Database, tsCode: string): Promise<boolean> {
  const normalizedCode = normalizeTsCode(tsCode)
  const existing = await getQuantWatchlistItem(db, normalizedCode)
  if (!existing)
    return false

  await db.delete(quantResearchMarkers).where(eq(quantResearchMarkers.tsCode, normalizedCode))
  await db.delete(quantWatchlist).where(eq(quantWatchlist.tsCode, normalizedCode))
  return !(await getQuantWatchlistItem(db, normalizedCode))
}

function isQuantResearchStatus(value: string): value is QuantResearchStatus {
  return (QUANT_RESEARCH_STATUSES as readonly string[]).includes(value)
}

export async function listQuantResearchMarkers(db: Database) {
  const [watchlist, markers] = await Promise.all([
    listQuantWatchlist(db),
    db.select().from(quantResearchMarkers).all(),
  ])
  const markerByCode = new Map(markers.map(marker => [marker.tsCode, marker]))
  return watchlist.map((item) => {
    const marker = markerByCode.get(item.tsCode)
    return {
      tsCode: item.tsCode,
      status: marker?.status ?? 'unreviewed' as const,
      note: marker?.note ?? null,
      reviewDate: marker?.reviewDate ?? null,
      createdAt: marker?.createdAt ?? item.createdAt,
      updatedAt: marker?.updatedAt ?? item.updatedAt,
    }
  })
}

export async function upsertQuantResearchMarker(db: Database, input: {
  readonly tsCode: string
  readonly status: string
  readonly note: string | null
  readonly reviewDate: string | null
}) {
  const tsCode = normalizeTsCode(input.tsCode)
  if (!isQuantResearchStatus(input.status))
    throw new QuantError('QUANT_INVALID_RESEARCH_STATUS', 'Research status is invalid', 400)
  const watchlistItem = await getQuantWatchlistItem(db, tsCode)
  if (!watchlistItem)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const now = new Date()
  await db.insert(quantResearchMarkers).values({
    id: `research:${tsCode}`,
    tsCode,
    status: input.status,
    note: input.note?.trim() || null,
    reviewDate: input.reviewDate?.trim() || null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: quantResearchMarkers.tsCode,
    set: {
      status: input.status,
      note: input.note?.trim() || null,
      reviewDate: input.reviewDate?.trim() || null,
      updatedAt: now,
    },
  })

  const persisted = await db.select().from(quantResearchMarkers).where(eq(quantResearchMarkers.tsCode, tsCode)).get()
  if (!persisted)
    throw new QuantError('QUANT_NOT_FOUND', 'Research marker readback failed', 500)
  return persisted
}

export async function upsertQuantDailyBars(db: Database, bars: readonly DailyBar[]): Promise<number> {
  if (bars.length === 0)
    return 0

  const now = new Date()
  // D1 deployments can enforce a smaller bind-variable limit than local SQLite.
  // Five rows keeps the 14-column upsert portable across both runtimes.
  for (let offset = 0; offset < bars.length; offset += 5) {
    const chunk = bars.slice(offset, offset + 5)
    await db.insert(quantDailyBars).values(chunk.map(bar => ({
      id: `daily:${bar.tsCode}:${bar.tradeDate}`,
      tsCode: bar.tsCode,
      tradeDate: bar.tradeDate,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      preClose: bar.preClose,
      change: bar.change,
      pctChg: bar.pctChg,
      volume: bar.volume,
      amount: bar.amount,
      createdAt: now,
      updatedAt: now,
    }))).onConflictDoUpdate({
      target: [quantDailyBars.tsCode, quantDailyBars.tradeDate],
      set: {
        open: sql`excluded.open`,
        high: sql`excluded.high`,
        low: sql`excluded.low`,
        close: sql`excluded.close`,
        preClose: sql`excluded.pre_close`,
        change: sql`excluded.change`,
        pctChg: sql`excluded.pct_chg`,
        volume: sql`excluded.volume`,
        amount: sql`excluded.amount`,
        updatedAt: now,
      },
    })
  }
  return bars.length
}

export async function listQuantDailyBars(db: Database, options: {
  readonly tsCode: string
  readonly fromDate?: string
  readonly toDate?: string
}): Promise<readonly DailyBar[]> {
  const conditions = [eq(quantDailyBars.tsCode, normalizeTsCode(options.tsCode))]
  if (options.fromDate)
    conditions.push(gte(quantDailyBars.tradeDate, normalizeTradeDate(options.fromDate, 'from_date')))
  if (options.toDate)
    conditions.push(lte(quantDailyBars.tradeDate, normalizeTradeDate(options.toDate, 'to_date')))

  const rows = await db.select().from(quantDailyBars).where(and(...conditions)).orderBy(asc(quantDailyBars.tradeDate)).all()
  return rows.map(row => ({
    tsCode: row.tsCode,
    tradeDate: row.tradeDate,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    preClose: row.preClose,
    change: row.change,
    pctChg: row.pctChg,
    volume: row.volume,
    amount: row.amount,
  }))
}

export async function saveQuantScanSnapshot(db: Database, input: {
  readonly status: Extract<QuantSyncStatus, 'completed' | 'partial'>
  readonly runId: string
  readonly inputTsCodes: readonly string[]
  readonly fromDate: string
  readonly toDate: string
  readonly candidates: readonly MomentumCandidate[]
  readonly generatedAt: Date
}): Promise<string> {
  const id = nanoid()
  const generatedAt = toUnixSeconds(input.generatedAt)
  const inserted = await db.run(sql`
    INSERT INTO quant_scan_snapshot (
      id, status, factor_version, input_ts_codes_json, from_date, to_date,
      candidate_count, candidates_json, generated_at, created_at
    )
    SELECT
      ${id}, ${input.status}, 'momentum-v1', ${JSON.stringify(input.inputTsCodes)},
      ${input.fromDate}, ${input.toDate}, ${input.candidates.length},
      ${JSON.stringify(input.candidates)}, ${generatedAt}, ${generatedAt}
    WHERE EXISTS (
      SELECT 1
      FROM quant_sync_state
      WHERE id = ${QUANT_SYNC_STATE_ID}
        AND status = 'running'
        AND run_id = ${input.runId}
        AND lease_expires_at > ${generatedAt}
    )
  `)
  if (changedRows(inserted) !== 1)
    throw new QuantError('QUANT_SYNC_REJECTED', 'Quant sync lease is no longer owned', 409)

  try {
    await db.run(sql`
      DELETE FROM quant_scan_snapshot
      WHERE rowid IN (
        SELECT rowid
        FROM quant_scan_snapshot
        ORDER BY generated_at DESC, rowid DESC
        LIMIT -1 OFFSET ${QUANT_SYNC_SNAPSHOT_RETENTION}
      )
    `)
  }
  catch {
    // The authoritative snapshot is already persisted; retention is best effort.
  }
  return id
}

export async function getLatestQuantScanSnapshot(db: Database) {
  return db.select().from(quantScanSnapshots).orderBy(desc(quantScanSnapshots.generatedAt)).limit(1).get()
}

export async function listQuantScanSnapshots(db: Database, limit = QUANT_SYNC_SNAPSHOT_RETENTION) {
  const boundedLimit = Math.min(QUANT_SYNC_SNAPSHOT_RETENTION, Math.max(1, Math.floor(limit)))
  return db
    .select()
    .from(quantScanSnapshots)
    .orderBy(desc(quantScanSnapshots.generatedAt), desc(quantScanSnapshots.id))
    .limit(boundedLimit)
    .all()
}

export async function getQuantSyncState(db: Database) {
  return db.select().from(quantSyncState).where(eq(quantSyncState.id, QUANT_SYNC_STATE_ID)).get()
}

export async function acquireQuantSyncLease(db: Database, input: {
  readonly runId: string
  readonly fromDate: string
  readonly toDate: string
  readonly requestedCount: number
  readonly startedAt: Date
  readonly leaseDurationMs?: number
}): Promise<boolean> {
  const leaseExpiresAt = leaseExpiry(input.startedAt, Math.max(QUANT_SYNC_LEASE_DURATION_MS, input.leaseDurationMs ?? 0))
  const nowSeconds = toUnixSeconds(input.startedAt)
  const result = await db.insert(quantSyncState).values({
    id: QUANT_SYNC_STATE_ID,
    status: 'running',
    runId: input.runId,
    leaseExpiresAt,
    fromDate: input.fromDate,
    toDate: input.toDate,
    requestedCount: input.requestedCount,
    writtenCount: 0,
    skippedCount: 0,
    reasonCode: null,
    reason: null,
    snapshotId: null,
    startedAt: input.startedAt,
    completedAt: null,
    updatedAt: input.startedAt,
  }).onConflictDoUpdate({
    target: quantSyncState.id,
    set: {
      status: 'running',
      runId: input.runId,
      leaseExpiresAt,
      fromDate: input.fromDate,
      toDate: input.toDate,
      requestedCount: input.requestedCount,
      writtenCount: 0,
      skippedCount: 0,
      reasonCode: null,
      reason: null,
      snapshotId: null,
      startedAt: input.startedAt,
      completedAt: null,
      updatedAt: input.startedAt,
    },
    where: sql`(
      ${quantSyncState.status} <> 'running'
      OR ${quantSyncState.leaseExpiresAt} IS NULL
      OR ${quantSyncState.leaseExpiresAt} <= ${nowSeconds}
    )`,
  }).run()
  return changedRows(result) === 1
}

export async function hasQuantSyncLease(db: Database, input: { readonly runId: string, readonly now: Date }): Promise<boolean> {
  const row = await db.select({ id: quantSyncState.id })
    .from(quantSyncState)
    .where(and(
      eq(quantSyncState.id, QUANT_SYNC_STATE_ID),
      eq(quantSyncState.status, 'running'),
      eq(quantSyncState.runId, input.runId),
      gt(quantSyncState.leaseExpiresAt, input.now),
    ))
    .get()
  return row !== undefined
}

export async function saveQuantSyncState(db: Database, input: {
  readonly status: Exclude<PersistedQuantSyncStatus, 'running'>
  readonly runId: string
  readonly fromDate: string
  readonly toDate: string
  readonly requestedCount: number
  readonly writtenCount: number
  readonly skippedCount: number
  readonly reasonCode?: string
  readonly reason?: string
  readonly snapshotId?: string
  readonly startedAt: Date
  readonly completedAt: Date
}): Promise<boolean> {
  const result = await db.update(quantSyncState).set({
    status: input.status,
    runId: input.runId,
    leaseExpiresAt: null,
    fromDate: input.fromDate,
    toDate: input.toDate,
    requestedCount: input.requestedCount,
    writtenCount: input.writtenCount,
    skippedCount: input.skippedCount,
    reasonCode: input.reasonCode ?? null,
    reason: input.reason ?? null,
    snapshotId: input.snapshotId ?? null,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    updatedAt: input.completedAt,
  }).where(and(
    eq(quantSyncState.id, QUANT_SYNC_STATE_ID),
    eq(quantSyncState.status, 'running'),
    eq(quantSyncState.runId, input.runId),
    gt(quantSyncState.leaseExpiresAt, input.completedAt),
  )).run()
  return changedRows(result) === 1
}

export async function releaseQuantSyncLease(db: Database, input: {
  readonly runId: string
  readonly completedAt: Date
  readonly reason?: string
}): Promise<boolean> {
  const result = await db.update(quantSyncState).set({
    status: 'rejected',
    leaseExpiresAt: null,
    reasonCode: 'QUANT_SYNC_REJECTED',
    reason: input.reason ?? 'Quant sync ended before final state was persisted',
    snapshotId: null,
    completedAt: input.completedAt,
    updatedAt: input.completedAt,
  }).where(and(
    eq(quantSyncState.id, QUANT_SYNC_STATE_ID),
    eq(quantSyncState.status, 'running'),
    eq(quantSyncState.runId, input.runId),
  )).run()
  return changedRows(result) === 1
}

export async function readBarsByCode(db: Database, codes: readonly string[], fromDate: string, toDate: string) {
  const results = await Promise.all(codes.map(async tsCode => [
    tsCode,
    await listQuantDailyBars(db, { tsCode, fromDate, toDate }),
  ] as const))
  return Object.fromEntries(results) as Record<string, readonly DailyBar[]>
}
