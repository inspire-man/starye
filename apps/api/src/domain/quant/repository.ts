import type { Database } from '@starye/db'
import type { QuantDecisionRecordAction } from './decision-record'
import type { QuantFactorConfiguration, QuantFactorWeights } from './factor-configuration'
import type { DailyBar, MomentumCandidate, QuantSyncStatus } from './types'
import {
  quantCandidateAiSessions,
  quantDailyBars,
  quantDecisionRecords,
  quantFactorConfigs,
  quantResearchMarkers,
  quantResearchRuns,
  quantResearchSummaries,
  quantScanSnapshots,
  quantSyncState,
  quantWatchlist,
} from '@starye/db/schema'
import { and, asc, desc, eq, gt, gte, lte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { QuantError } from './errors'
import { createQuantFactorConfiguration, defaultQuantFactorConfiguration, QUANT_FACTOR_CONFIGURATION_VERSION } from './factor-configuration'

export const QUANT_SYNC_STATE_ID = 'daily'
export const MAX_WATCHLIST_SIZE = 50
export const QUANT_SYNC_LEASE_DURATION_MS = 120_000
export const QUANT_SYNC_SNAPSHOT_RETENTION = 30
export const QUANT_RESEARCH_RUN_RETENTION = 30
export const QUANT_RESEARCH_SUMMARY_RETENTION = 10
export const QUANT_CANDIDATE_AI_SESSION_RETENTION = 10
export const QUANT_DECISION_RECORD_RETENTION = 30
export const QUANT_CANDIDATE_AI_QUESTION_RETENTION = 10
export const QUANT_RESEARCH_STATUSES = ['unreviewed', 'priority', 'paused', 'excluded'] as const
export type QuantResearchStatus = typeof QUANT_RESEARCH_STATUSES[number]

function parseQuantFactorWeights(value: string): QuantFactorWeights {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('weights must be an object')
  }
  catch {
    throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Stored factor configuration is invalid', 500)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Stored factor configuration is invalid', 500)
  const record = parsed as Record<string, unknown>
  try {
    return {
      'trend': record.trend as number,
      'valuation': record.valuation as number,
      'quality': record.quality as number,
      'shareholder-return': record['shareholder-return'] as number,
      'risk': record.risk as number,
    }
  }
  catch {
    throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Stored factor configuration is invalid', 500)
  }
}

function factorConfigView(row: typeof quantFactorConfigs.$inferSelect): QuantFactorConfiguration {
  try {
    if (row.version !== QUANT_FACTOR_CONFIGURATION_VERSION)
      throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Stored factor configuration version is invalid', 500)
    return createQuantFactorConfiguration({
      weights: parseQuantFactorWeights(row.weightsJson),
      source: 'user',
      updatedAt: row.updatedAt,
    })
  }
  catch (error) {
    if (error instanceof QuantError && error.code === 'QUANT_FACTOR_CONFIGURATION')
      throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Stored factor configuration is invalid', 500)
    throw error
  }
}

export async function getQuantFactorConfiguration(db: Database, userId: string): Promise<QuantFactorConfiguration> {
  const ownerId = normalizeQuantUserId(userId)
  const row = await db.select().from(quantFactorConfigs).where(eq(quantFactorConfigs.userId, ownerId)).get()
  return row ? factorConfigView(row) : defaultQuantFactorConfiguration()
}

export async function saveQuantFactorConfiguration(db: Database, input: {
  readonly userId: string
  readonly weights: QuantFactorWeights
}): Promise<QuantFactorConfiguration> {
  const ownerId = normalizeQuantUserId(input.userId)
  const configuration = createQuantFactorConfiguration({ weights: input.weights, source: 'user' })
  const existing = await db.select({ id: quantFactorConfigs.id }).from(quantFactorConfigs).where(eq(quantFactorConfigs.userId, ownerId)).get()
  const now = new Date()
  if (existing) {
    await db.update(quantFactorConfigs).set({
      version: configuration.version,
      weightsJson: JSON.stringify(configuration.weights),
      updatedAt: now,
    }).where(and(eq(quantFactorConfigs.id, existing.id), eq(quantFactorConfigs.userId, ownerId)))
  }
  else {
    await db.insert(quantFactorConfigs).values({
      id: nanoid(),
      userId: ownerId,
      version: configuration.version,
      weightsJson: JSON.stringify(configuration.weights),
      createdAt: now,
      updatedAt: now,
    })
  }
  const persisted = await db.select().from(quantFactorConfigs).where(eq(quantFactorConfigs.userId, ownerId)).get()
  if (!persisted)
    throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Factor configuration readback failed', 500)
  return factorConfigView(persisted)
}

export async function deleteQuantFactorConfiguration(db: Database, userId: string): Promise<QuantFactorConfiguration> {
  const ownerId = normalizeQuantUserId(userId)
  await db.delete(quantFactorConfigs).where(eq(quantFactorConfigs.userId, ownerId))
  const persisted = await db.select().from(quantFactorConfigs).where(eq(quantFactorConfigs.userId, ownerId)).get()
  if (persisted)
    throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Factor configuration reset failed', 500)
  return defaultQuantFactorConfiguration()
}

export const QUANT_STARTER_WATCHLIST = [
  { tsCode: '601899.SH', name: '紫金矿业' },
  { tsCode: '600089.SH', name: '特变电工' },
  { tsCode: '600938.SH', name: '中国海油' },
  { tsCode: '601318.SH', name: '中国平安' },
  { tsCode: '000001.SZ', name: '平安银行' },
  { tsCode: '600028.SH', name: '中国石化' },
  { tsCode: '601857.SH', name: '中国石油' },
  { tsCode: '601919.SH', name: '中远海控' },
  { tsCode: '600011.SH', name: '华能国际' },
  { tsCode: '600900.SH', name: '长江电力' },
  { tsCode: '600312.SH', name: '平高电气' },
  { tsCode: '603993.SH', name: '洛阳钼业' },
  { tsCode: '603986.SH', name: '兆易创新' },
] as const

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

function normalizeQuantUserId(value: string): string {
  const normalized = value.trim()
  if (!normalized)
    throw new QuantError('QUANT_INVALID_INPUT', 'Authenticated user id is required', 401)
  return normalized
}

export function quantSyncStateId(userId: string): string {
  return `${QUANT_SYNC_STATE_ID}:${normalizeQuantUserId(userId)}`
}

function toQuantWatchlistView(row: {
  readonly id: string
  readonly tsCode: string
  readonly name: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}) {
  return {
    id: row.id,
    tsCode: row.tsCode,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
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

export async function listQuantWatchlist(db: Database, userId: string) {
  const ownerId = normalizeQuantUserId(userId)
  return db.select().from(quantWatchlist).where(eq(quantWatchlist.userId, ownerId)).orderBy(asc(quantWatchlist.createdAt)).all()
}

export async function ensureQuantStarterWatchlist(db: Database, userId: string): Promise<void> {
  const ownerId = normalizeQuantUserId(userId)
  const existing = await db.select({ id: quantWatchlist.id })
    .from(quantWatchlist)
    .where(eq(quantWatchlist.userId, ownerId))
    .limit(1)
    .get()
  if (existing)
    return

  const now = new Date()
  await db.insert(quantWatchlist).values(QUANT_STARTER_WATCHLIST.map(item => ({
    id: nanoid(),
    userId: ownerId,
    tsCode: item.tsCode,
    name: item.name,
    createdAt: now,
    updatedAt: now,
  }))).onConflictDoNothing({ target: [quantWatchlist.userId, quantWatchlist.tsCode] })
}

export async function listQuantWatchlistWithStats(db: Database, userId: string) {
  const rows = await listQuantWatchlist(db, userId)
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
      ...toQuantWatchlistView(row),
      latestTradeDate: stats?.latestTradeDate ?? null,
      barCount: Number(stats?.barCount ?? 0),
      latestClose: latest?.close ?? null,
      latestChangePercent: latest?.pctChg ?? null,
    }
  }))
}

export async function getQuantWatchlistItem(db: Database, userId: string, tsCode: string) {
  const ownerId = normalizeQuantUserId(userId)
  return db.select().from(quantWatchlist).where(and(
    eq(quantWatchlist.userId, ownerId),
    eq(quantWatchlist.tsCode, normalizeTsCode(tsCode)),
  )).get()
}

export async function createQuantWatchlistItem(db: Database, input: { readonly userId: string, readonly tsCode: string, readonly name?: string | null }) {
  const ownerId = normalizeQuantUserId(input.userId)
  const tsCode = normalizeTsCode(input.tsCode)
  const existing = await getQuantWatchlistItem(db, ownerId, tsCode)
  if (existing)
    return toQuantWatchlistView(existing)

  const countRows = await db.select({ count: sql<number>`count(*)` }).from(quantWatchlist).where(eq(quantWatchlist.userId, ownerId)).all()
  if (Number(countRows[0]?.count ?? 0) >= MAX_WATCHLIST_SIZE) {
    throw new QuantError('QUANT_WATCHLIST_LIMIT', 'Watchlist limit is 50 items', 409)
  }

  await db.insert(quantWatchlist).values({
    id: nanoid(),
    userId: ownerId,
    tsCode,
    name: input.name?.trim() || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing({ target: [quantWatchlist.userId, quantWatchlist.tsCode] })

  const persisted = await getQuantWatchlistItem(db, ownerId, tsCode)
  if (!persisted)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item readback failed', 500)
  return toQuantWatchlistView(persisted)
}

export async function updateQuantWatchlistItem(db: Database, userId: string, tsCode: string, name: string | null) {
  const ownerId = normalizeQuantUserId(userId)
  const normalizedCode = normalizeTsCode(tsCode)
  await db.update(quantWatchlist)
    .set({ name: name?.trim() || null, updatedAt: new Date() })
    .where(and(eq(quantWatchlist.userId, ownerId), eq(quantWatchlist.tsCode, normalizedCode)))
  const persisted = await getQuantWatchlistItem(db, ownerId, normalizedCode)
  if (!persisted)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)
  return toQuantWatchlistView(persisted)
}

export async function deleteQuantWatchlistItem(db: Database, userId: string, tsCode: string): Promise<boolean> {
  const ownerId = normalizeQuantUserId(userId)
  const normalizedCode = normalizeTsCode(tsCode)
  const existing = await getQuantWatchlistItem(db, ownerId, normalizedCode)
  if (!existing)
    return false

  await db.delete(quantResearchMarkers).where(and(
    eq(quantResearchMarkers.userId, ownerId),
    eq(quantResearchMarkers.tsCode, normalizedCode),
  ))
  await db.delete(quantWatchlist).where(and(
    eq(quantWatchlist.userId, ownerId),
    eq(quantWatchlist.tsCode, normalizedCode),
  ))
  return !(await getQuantWatchlistItem(db, ownerId, normalizedCode))
}

function isQuantResearchStatus(value: string): value is QuantResearchStatus {
  return (QUANT_RESEARCH_STATUSES as readonly string[]).includes(value)
}

export async function listQuantResearchMarkers(db: Database, userId: string) {
  const ownerId = normalizeQuantUserId(userId)
  const [watchlist, markers] = await Promise.all([
    listQuantWatchlist(db, ownerId),
    db.select().from(quantResearchMarkers).where(eq(quantResearchMarkers.userId, ownerId)).all(),
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
  readonly userId: string
  readonly tsCode: string
  readonly status: string
  readonly note: string | null
  readonly reviewDate: string | null
}) {
  const ownerId = normalizeQuantUserId(input.userId)
  const tsCode = normalizeTsCode(input.tsCode)
  if (!isQuantResearchStatus(input.status))
    throw new QuantError('QUANT_INVALID_RESEARCH_STATUS', 'Research status is invalid', 400)
  const watchlistItem = await getQuantWatchlistItem(db, ownerId, tsCode)
  if (!watchlistItem)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const now = new Date()
  await db.insert(quantResearchMarkers).values({
    id: `research:${ownerId}:${tsCode}`,
    userId: ownerId,
    tsCode,
    status: input.status,
    note: input.note?.trim() || null,
    reviewDate: input.reviewDate?.trim() || null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [quantResearchMarkers.userId, quantResearchMarkers.tsCode],
    set: {
      status: input.status,
      note: input.note?.trim() || null,
      reviewDate: input.reviewDate?.trim() || null,
      updatedAt: now,
    },
  })

  const persisted = await db.select().from(quantResearchMarkers).where(and(
    eq(quantResearchMarkers.userId, ownerId),
    eq(quantResearchMarkers.tsCode, tsCode),
  )).get()
  if (!persisted)
    throw new QuantError('QUANT_NOT_FOUND', 'Research marker readback failed', 500)
  return {
    tsCode: persisted.tsCode,
    status: persisted.status,
    note: persisted.note,
    reviewDate: persisted.reviewDate,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
  }
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

export async function getLatestQuantDailyBar(db: Database, tsCode: string): Promise<{ readonly close: number, readonly tradeDate: string } | null> {
  const row = await db.select({
    close: quantDailyBars.close,
    tradeDate: quantDailyBars.tradeDate,
  }).from(quantDailyBars).where(eq(quantDailyBars.tsCode, normalizeTsCode(tsCode))).orderBy(desc(quantDailyBars.tradeDate)).limit(1).get()
  return row ?? null
}

export async function saveQuantScanSnapshot(db: Database, input: {
  readonly userId: string
  readonly status: Extract<QuantSyncStatus, 'completed' | 'partial'>
  readonly runId: string
  readonly inputTsCodes: readonly string[]
  readonly fromDate: string
  readonly toDate: string
  readonly candidates: readonly MomentumCandidate[]
  readonly generatedAt: Date
}): Promise<string> {
  const ownerId = normalizeQuantUserId(input.userId)
  const stateId = quantSyncStateId(ownerId)
  const id = nanoid()
  const generatedAt = toUnixSeconds(input.generatedAt)
  const inserted = await db.run(sql`
    INSERT INTO quant_scan_snapshot (
      id, status, factor_version, input_ts_codes_json, from_date, to_date,
      candidate_count, candidates_json, generated_at, created_at, user_id
    )
    SELECT
      ${id}, ${input.status}, 'momentum-v1', ${JSON.stringify(input.inputTsCodes)},
      ${input.fromDate}, ${input.toDate}, ${input.candidates.length},
      ${JSON.stringify(input.candidates)}, ${generatedAt}, ${generatedAt}, ${ownerId}
    WHERE EXISTS (
      SELECT 1
      FROM quant_sync_state
      WHERE id = ${stateId}
        AND user_id = ${ownerId}
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
        WHERE user_id = ${ownerId}
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

export async function getLatestQuantScanSnapshot(db: Database, userId: string) {
  const ownerId = normalizeQuantUserId(userId)
  return db.select().from(quantScanSnapshots).where(eq(quantScanSnapshots.userId, ownerId)).orderBy(desc(quantScanSnapshots.generatedAt)).limit(1).get()
}

export async function listQuantScanSnapshots(db: Database, userId: string, limit = QUANT_SYNC_SNAPSHOT_RETENTION) {
  const ownerId = normalizeQuantUserId(userId)
  const boundedLimit = Math.min(QUANT_SYNC_SNAPSHOT_RETENTION, Math.max(1, Math.floor(limit)))
  return db
    .select()
    .from(quantScanSnapshots)
    .where(eq(quantScanSnapshots.userId, ownerId))
    .orderBy(desc(quantScanSnapshots.generatedAt), desc(quantScanSnapshots.id))
    .limit(boundedLimit)
    .all()
}

export async function createQuantResearchRun(db: Database, input: {
  readonly userId: string
  readonly tsCode: string
  readonly name: string | null
  readonly status: 'ready' | 'partial' | 'insufficient_data'
  readonly reportVersion: string
  readonly sourceSnapshotId: string | null
  readonly reportJson: string
  readonly generatedAt: Date
}): Promise<typeof quantResearchRuns.$inferSelect> {
  const ownerId = normalizeQuantUserId(input.userId)
  const tsCode = normalizeTsCode(input.tsCode)
  const id = nanoid()
  const createdAt = new Date()
  await db.insert(quantResearchRuns).values({
    id,
    userId: ownerId,
    tsCode,
    name: input.name,
    status: input.status,
    reportVersion: input.reportVersion,
    sourceSnapshotId: input.sourceSnapshotId,
    reportJson: input.reportJson,
    generatedAt: input.generatedAt,
    createdAt,
  })
  const persisted = await db.select().from(quantResearchRuns).where(and(
    eq(quantResearchRuns.id, id),
    eq(quantResearchRuns.userId, ownerId),
  )).get()
  if (!persisted)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run readback failed', 500)
  return persisted
}

export async function listQuantResearchRuns(db: Database, userId: string, tsCode: string, limit = 5) {
  const ownerId = normalizeQuantUserId(userId)
  const normalizedCode = normalizeTsCode(tsCode)
  const boundedLimit = Math.min(QUANT_RESEARCH_RUN_RETENTION, Math.max(1, Math.floor(limit)))
  return db.select().from(quantResearchRuns).where(and(
    eq(quantResearchRuns.userId, ownerId),
    eq(quantResearchRuns.tsCode, normalizedCode),
  )).orderBy(desc(quantResearchRuns.generatedAt), desc(quantResearchRuns.id)).limit(boundedLimit).all()
}

export async function getQuantResearchRun(db: Database, userId: string, id: string) {
  const ownerId = normalizeQuantUserId(userId)
  const normalizedId = id.trim()
  if (!normalizedId)
    throw new QuantError('QUANT_INVALID_INPUT', 'Research run id is required', 400)
  return db.select().from(quantResearchRuns).where(and(
    eq(quantResearchRuns.id, normalizedId),
    eq(quantResearchRuns.userId, ownerId),
  )).get()
}

export async function getQuantDecisionRecord(db: Database, userId: string, researchRunId: string) {
  const ownerId = normalizeQuantUserId(userId)
  const normalizedRunId = researchRunId.trim()
  if (!normalizedRunId)
    throw new QuantError('QUANT_INVALID_INPUT', 'Research run id is required', 400)
  return db.select().from(quantDecisionRecords).where(and(
    eq(quantDecisionRecords.userId, ownerId),
    eq(quantDecisionRecords.researchRunId, normalizedRunId),
  )).get()
}

export async function listQuantDecisionRecords(db: Database, userId: string, tsCode: string, limit = QUANT_DECISION_RECORD_RETENTION) {
  const ownerId = normalizeQuantUserId(userId)
  const normalizedCode = normalizeTsCode(tsCode)
  const boundedLimit = Math.min(QUANT_DECISION_RECORD_RETENTION, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : QUANT_DECISION_RECORD_RETENTION))
  return db.select().from(quantDecisionRecords).where(and(
    eq(quantDecisionRecords.userId, ownerId),
    eq(quantDecisionRecords.tsCode, normalizedCode),
  )).orderBy(desc(quantDecisionRecords.updatedAt), desc(quantDecisionRecords.id)).limit(boundedLimit).all()
}

export async function upsertQuantDecisionRecord(db: Database, input: {
  readonly userId: string
  readonly researchRunId: string
  readonly tsCode: string
  readonly action: QuantDecisionRecordAction
  readonly note: string | null
  readonly snapshotJson: string
}) {
  const ownerId = normalizeQuantUserId(input.userId)
  const normalizedRunId = input.researchRunId.trim()
  if (!normalizedRunId)
    throw new QuantError('QUANT_INVALID_INPUT', 'Research run id is required', 400)
  const normalizedCode = normalizeTsCode(input.tsCode)
  const now = new Date()
  await db.insert(quantDecisionRecords).values({
    id: nanoid(),
    userId: ownerId,
    researchRunId: normalizedRunId,
    tsCode: normalizedCode,
    action: input.action,
    note: input.note,
    snapshotJson: input.snapshotJson,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [quantDecisionRecords.userId, quantDecisionRecords.researchRunId],
    set: {
      tsCode: normalizedCode,
      action: input.action,
      note: input.note,
      snapshotJson: input.snapshotJson,
      updatedAt: now,
    },
  })
  const persisted = await getQuantDecisionRecord(db, ownerId, normalizedRunId)
  if (!persisted)
    throw new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', 'Decision record readback failed', 500)
  return persisted
}

export async function createQuantResearchSummary(db: Database, input: {
  readonly userId: string
  readonly researchRunId: string
  readonly summaryVersion: string
  readonly reportVersion: string
  readonly provider: 'openai_compatible' | 'deepseek' | 'qwen' | 'gemini' | 'ollama'
  readonly model: string
  readonly summaryJson: string
  readonly citedEvidenceKeys: readonly string[]
  readonly generatedAt: Date
}): Promise<typeof quantResearchSummaries.$inferSelect> {
  const ownerId = normalizeQuantUserId(input.userId)
  const researchRun = await getQuantResearchRun(db, ownerId, input.researchRunId)
  if (!researchRun)
    throw new QuantError('QUANT_NOT_FOUND', 'Research run not found', 404)
  const id = nanoid()
  await db.insert(quantResearchSummaries).values({
    id,
    userId: ownerId,
    researchRunId: researchRun.id,
    summaryVersion: input.summaryVersion,
    reportVersion: input.reportVersion,
    provider: input.provider,
    model: input.model,
    summaryJson: input.summaryJson,
    citedEvidenceKeysJson: JSON.stringify(input.citedEvidenceKeys),
    generatedAt: input.generatedAt,
    createdAt: new Date(),
  })
  const persisted = await db.select().from(quantResearchSummaries).where(and(
    eq(quantResearchSummaries.id, id),
    eq(quantResearchSummaries.userId, ownerId),
    eq(quantResearchSummaries.researchRunId, researchRun.id),
  )).get()
  if (!persisted)
    throw new QuantError('QUANT_NOT_FOUND', 'Research summary readback failed', 500)
  try {
    await db.run(sql`
      DELETE FROM quant_research_summary
      WHERE rowid IN (
        SELECT rowid
        FROM quant_research_summary
        WHERE user_id = ${ownerId} AND research_run_id = ${researchRun.id}
        ORDER BY generated_at DESC, rowid DESC
        LIMIT -1 OFFSET ${QUANT_RESEARCH_SUMMARY_RETENTION}
      )
    `)
  }
  catch {
    // The authoritative summary is already persisted; retention is best effort.
  }
  return persisted
}

export async function listQuantResearchSummaries(db: Database, userId: string, researchRunId: string, limit = QUANT_RESEARCH_SUMMARY_RETENTION) {
  const ownerId = normalizeQuantUserId(userId)
  const researchRun = await getQuantResearchRun(db, ownerId, researchRunId)
  if (!researchRun)
    return []
  const boundedLimit = Math.min(QUANT_RESEARCH_SUMMARY_RETENTION, Math.max(1, Math.floor(limit)))
  return db.select().from(quantResearchSummaries).where(and(
    eq(quantResearchSummaries.userId, ownerId),
    eq(quantResearchSummaries.researchRunId, researchRun.id),
  )).orderBy(desc(quantResearchSummaries.generatedAt), desc(quantResearchSummaries.id)).limit(boundedLimit).all()
}

function boundedCandidateAiSessionLimit(value: number): number {
  const normalized = Number.isFinite(value) ? Math.floor(value) : QUANT_CANDIDATE_AI_SESSION_RETENTION
  return Math.min(QUANT_CANDIDATE_AI_SESSION_RETENTION, Math.max(1, normalized))
}

function parseCandidateAiQuestions(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed))
      throw new Error('questions must be an array')
    return parsed
  }
  catch {
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Candidate AI session questions are invalid', 500)
  }
}

function parseCandidateAiQuestion(value: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new Error('question must be an object')
    return parsed
  }
  catch {
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INPUT', 'Candidate AI session question is invalid', 422)
  }
}

async function trimQuantCandidateAiSessions(db: Database, userId: string): Promise<void> {
  try {
    await db.run(sql`
        DELETE FROM quant_candidate_ai_session
        WHERE rowid IN (
          SELECT rowid
          FROM quant_candidate_ai_session
          WHERE user_id = ${userId}
          ORDER BY updated_at DESC, id DESC
          LIMIT -1 OFFSET ${QUANT_CANDIDATE_AI_SESSION_RETENTION}
        )
      `)
  }
  catch {
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Candidate AI session retention failed', 500)
  }
}

export async function createQuantCandidateAiSession(db: Database, input: {
  readonly userId: string
  readonly snapshotId: string
  readonly snapshotGeneratedAt: Date
  readonly fromDate: string
  readonly toDate: string
  readonly scopeKey: string
  readonly candidateCodesJson: string
  readonly briefingJson: string | null
  readonly questionsJson?: string
  readonly provider: 'openai_compatible' | 'deepseek' | 'qwen' | 'gemini' | 'ollama'
  readonly model: string
  readonly createdAt?: Date
}): Promise<typeof quantCandidateAiSessions.$inferSelect> {
  const ownerId = normalizeQuantUserId(input.userId)
  const snapshotId = input.snapshotId.trim()
  const scopeKey = input.scopeKey.trim()
  const model = input.model.trim()
  if (!snapshotId || !scopeKey || !model)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INPUT', 'Candidate AI session identity is incomplete', 422)

  const id = nanoid()
  const createdAt = input.createdAt ?? new Date()
  await db.insert(quantCandidateAiSessions).values({
    id,
    userId: ownerId,
    snapshotId,
    snapshotGeneratedAt: input.snapshotGeneratedAt,
    fromDate: input.fromDate,
    toDate: input.toDate,
    scopeKey,
    candidateCodesJson: input.candidateCodesJson,
    briefingJson: input.briefingJson ?? 'null',
    questionsJson: input.questionsJson ?? '[]',
    provider: input.provider,
    model,
    createdAt,
    updatedAt: createdAt,
  })
  const persisted = await db.select().from(quantCandidateAiSessions).where(and(
    eq(quantCandidateAiSessions.id, id),
    eq(quantCandidateAiSessions.userId, ownerId),
  )).get()
  if (!persisted)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Candidate AI session readback failed', 500)
  await trimQuantCandidateAiSessions(db, ownerId)
  return persisted
}

export async function getQuantCandidateAiSession(db: Database, userId: string, id: string) {
  const ownerId = normalizeQuantUserId(userId)
  const normalizedId = id.trim()
  if (!normalizedId)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INPUT', 'Candidate AI session id is required', 400)
  return db.select().from(quantCandidateAiSessions).where(and(
    eq(quantCandidateAiSessions.id, normalizedId),
    eq(quantCandidateAiSessions.userId, ownerId),
  )).get()
}

export async function listQuantCandidateAiSessions(db: Database, userId: string, limit = QUANT_CANDIDATE_AI_SESSION_RETENTION) {
  const ownerId = normalizeQuantUserId(userId)
  return db.select().from(quantCandidateAiSessions).where(eq(quantCandidateAiSessions.userId, ownerId)).orderBy(desc(quantCandidateAiSessions.updatedAt), desc(quantCandidateAiSessions.id)).limit(boundedCandidateAiSessionLimit(limit)).all()
}

export async function deleteQuantCandidateAiSession(db: Database, userId: string, id: string): Promise<boolean> {
  const ownerId = normalizeQuantUserId(userId)
  const normalizedId = id.trim()
  if (!normalizedId)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INPUT', 'Candidate AI session id is required', 400)
  const existing = await getQuantCandidateAiSession(db, ownerId, normalizedId)
  if (!existing)
    return false

  await db.delete(quantCandidateAiSessions).where(and(
    eq(quantCandidateAiSessions.id, normalizedId),
    eq(quantCandidateAiSessions.userId, ownerId),
  )).run()
  const persisted = await getQuantCandidateAiSession(db, ownerId, normalizedId)
  if (persisted)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Candidate AI session delete readback failed', 500)
  return true
}

export async function appendQuantCandidateAiSessionQuestion(db: Database, input: {
  readonly userId: string
  readonly sessionId: string
  readonly snapshotId: string
  readonly snapshotGeneratedAt: Date
  readonly fromDate: string
  readonly toDate: string
  readonly scopeKey: string
  readonly candidateCodesJson: string
  readonly questionJson: string
  readonly provider: 'openai_compatible' | 'deepseek' | 'qwen' | 'gemini' | 'ollama'
  readonly model: string
  readonly updatedAt?: Date
}): Promise<typeof quantCandidateAiSessions.$inferSelect> {
  const ownerId = normalizeQuantUserId(input.userId)
  const existing = await getQuantCandidateAiSession(db, ownerId, input.sessionId)
  if (!existing)
    throw new QuantError('QUANT_NOT_FOUND', 'Candidate AI session not found', 404)
  if (existing.snapshotId !== input.snapshotId
    || existing.snapshotGeneratedAt.getTime() !== input.snapshotGeneratedAt.getTime()
    || existing.fromDate !== input.fromDate
    || existing.toDate !== input.toDate
    || existing.scopeKey !== input.scopeKey
    || existing.candidateCodesJson !== input.candidateCodesJson) {
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_STALE', 'Candidate AI session scope no longer matches the current snapshot', 422)
  }

  const questions = [...parseCandidateAiQuestions(existing.questionsJson), parseCandidateAiQuestion(input.questionJson)]
  const updatedAt = input.updatedAt ?? new Date()
  await db.update(quantCandidateAiSessions).set({
    questionsJson: JSON.stringify(questions.slice(-QUANT_CANDIDATE_AI_QUESTION_RETENTION)),
    provider: input.provider,
    model: input.model.trim(),
    updatedAt,
  }).where(and(
    eq(quantCandidateAiSessions.id, existing.id),
    eq(quantCandidateAiSessions.userId, ownerId),
  )).run()
  const persisted = await getQuantCandidateAiSession(db, ownerId, existing.id)
  if (!persisted)
    throw new QuantError('QUANT_AI_CANDIDATE_SESSION_INVALID', 'Candidate AI session question readback failed', 500)
  return persisted
}

export async function getQuantSyncState(db: Database, userId: string) {
  const ownerId = normalizeQuantUserId(userId)
  return db.select().from(quantSyncState).where(and(
    eq(quantSyncState.id, quantSyncStateId(ownerId)),
    eq(quantSyncState.userId, ownerId),
  )).get()
}

export async function acquireQuantSyncLease(db: Database, input: {
  readonly userId: string
  readonly runId: string
  readonly fromDate: string
  readonly toDate: string
  readonly requestedCount: number
  readonly startedAt: Date
  readonly leaseDurationMs?: number
}): Promise<boolean> {
  const ownerId = normalizeQuantUserId(input.userId)
  const stateId = quantSyncStateId(ownerId)
  const leaseExpiresAt = leaseExpiry(input.startedAt, Math.max(QUANT_SYNC_LEASE_DURATION_MS, input.leaseDurationMs ?? 0))
  const nowSeconds = toUnixSeconds(input.startedAt)
  const result = await db.insert(quantSyncState).values({
    id: stateId,
    userId: ownerId,
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

export async function hasQuantSyncLease(db: Database, input: { readonly userId: string, readonly runId: string, readonly now: Date }): Promise<boolean> {
  const ownerId = normalizeQuantUserId(input.userId)
  const row = await db.select({ id: quantSyncState.id })
    .from(quantSyncState)
    .where(and(
      eq(quantSyncState.id, quantSyncStateId(ownerId)),
      eq(quantSyncState.userId, ownerId),
      eq(quantSyncState.status, 'running'),
      eq(quantSyncState.runId, input.runId),
      gt(quantSyncState.leaseExpiresAt, input.now),
    ))
    .get()
  return row !== undefined
}

export async function saveQuantSyncState(db: Database, input: {
  readonly userId: string
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
  const ownerId = normalizeQuantUserId(input.userId)
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
    eq(quantSyncState.id, quantSyncStateId(ownerId)),
    eq(quantSyncState.userId, ownerId),
    eq(quantSyncState.status, 'running'),
    eq(quantSyncState.runId, input.runId),
    gt(quantSyncState.leaseExpiresAt, input.completedAt),
  )).run()
  return changedRows(result) === 1
}

export async function releaseQuantSyncLease(db: Database, input: {
  readonly userId: string
  readonly runId: string
  readonly completedAt: Date
  readonly reason?: string
}): Promise<boolean> {
  const ownerId = normalizeQuantUserId(input.userId)
  const result = await db.update(quantSyncState).set({
    status: 'rejected',
    leaseExpiresAt: null,
    reasonCode: 'QUANT_SYNC_REJECTED',
    reason: input.reason ?? 'Quant sync ended before final state was persisted',
    snapshotId: null,
    completedAt: input.completedAt,
    updatedAt: input.completedAt,
  }).where(and(
    eq(quantSyncState.id, quantSyncStateId(ownerId)),
    eq(quantSyncState.userId, ownerId),
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
