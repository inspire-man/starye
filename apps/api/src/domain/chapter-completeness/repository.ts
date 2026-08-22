import type { Database } from '@starye/db'
import type {
  ChapterCompletenessProjection,
  ChapterSourceSnapshot,
  ChapterSourceSnapshotInput,
  StoredChapterIdentity,
} from './types'
import {
  chapterCompletenessCurrent,
  chapterCompletenessObservations,
  chapters,
  comicChapterSourceRows,
  comicChapterSourceSnapshots,
} from '@starye/db/schema'
import { and, desc, eq, lt, or } from 'drizzle-orm'
import { compareChapterCompleteness } from './comparator'
import { normalizeChapterUrl, normalizeSourceChapterRow } from './identity'
import { MAX_SOURCE_CHAPTER_ROWS } from './types'

type ChapterCompletenessDatabase = Pick<Database, 'query' | 'insert' | 'update'> & Partial<Pick<Database, '$client'>>

interface NativeD1Statement {
  bind: (...values: unknown[]) => NativeD1Statement
  all: <T>() => Promise<{ readonly results?: readonly T[] }>
}

interface NativeD1Result {
  readonly meta?: { readonly changes?: number }
  readonly results?: readonly Record<string, unknown>[]
}

interface NativeD1Client {
  batch: (statements: readonly NativeD1Statement[]) => Promise<readonly NativeD1Result[]>
  prepare: (query: string) => NativeD1Statement
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${value}`.slice(0, 128)
}

function fingerprintJson(value: string): string {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function sourceFingerprint(
  input: ChapterSourceSnapshotInput,
  rows: readonly ReturnType<typeof normalizeSourceChapterRow>[],
): string {
  return fingerprintJson(JSON.stringify({
    comicId: input.comicId,
    rows: rows.map(row => ({
      chapterNumber: row.chapterNumber,
      identity: row.identity,
      slug: row.slug,
      sourceOrdinal: row.sourceOrdinal,
      sourceUrl: row.sourceUrl,
      title: row.title,
    })),
    sourceUrl: normalizeChapterUrl(input.sourceUrl) ?? null,
    terminalState: input.terminalState,
  }))
}

function nativeClient(db: ChapterCompletenessDatabase): NativeD1Client | undefined {
  const client = db.$client as unknown as NativeD1Client | undefined
  return client && typeof client.prepare === 'function' && typeof client.batch === 'function'
    ? client
    : undefined
}

function changes(result: NativeD1Result | undefined): number {
  return result?.meta?.changes ?? 0
}

function snapshotId(snapshotIdentity: string): string {
  return stableId('chapter-snapshot', snapshotIdentity)
}

function snapshotFromRow(row: any): ChapterSourceSnapshot {
  const rows = (row.rows ?? []).map((sourceRow: any) => ({
    chapterNumber: sourceRow.chapterNumber ?? null,
    identity: sourceRow.identity,
    slug: sourceRow.slug ?? null,
    sourceOrdinal: sourceRow.sourceOrdinal,
    sourceUrl: sourceRow.sourceUrl ?? null,
    title: sourceRow.title,
  }))
  const observedAt = row.observedAt instanceof Date
    ? Math.floor(row.observedAt.getTime() / 1000)
    : Number(row.observedAt)
  return {
    comicId: row.comicId,
    observedAt,
    rowCount: row.rowCount,
    rows,
    snapshotIdentity: row.snapshotIdentity,
    sourceFingerprint: row.sourceFingerprint,
    sourceCount: row.sourceCount,
    sourceRevision: row.sourceRevision,
    ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
    terminalState: row.terminalState,
  }
}

function projectionFromCurrentRow(row: any): ChapterCompletenessProjection {
  const parseJson = (value: unknown, fallback: unknown) => {
    if (typeof value !== 'string')
      return value ?? fallback
    try {
      return JSON.parse(value)
    }
    catch {
      return fallback
    }
  }
  return {
    counts: parseJson(row.countsJson ?? row.counts_json, {}) as ChapterCompletenessProjection['counts'],
    findings: parseJson(row.findingsJson ?? row.findings_json, []) as ChapterCompletenessProjection['findings'],
    observationIdentity: row.observationIdentity ?? row.observation_identity,
    reasonCode: row.reasonCode ?? row.reason_code,
    sourceRevision: row.sourceRevision ?? row.source_revision,
    status: row.status,
    terminalState: row.terminalState ?? row.terminal_state ?? row.status,
  }
}

export function buildChapterSourceSnapshot(
  input: ChapterSourceSnapshotInput,
  sourceRevision: number,
): ChapterSourceSnapshot {
  if (!Number.isSafeInteger(sourceRevision) || sourceRevision < 1 || sourceRevision > 1_000_000)
    throw new Error('chapter_source_revision_invalid')
  if (input.sourceRows.length > MAX_SOURCE_CHAPTER_ROWS)
    throw new Error('chapter_source_rows_too_large')
  const rows = input.sourceRows.map(normalizeSourceChapterRow)
  const fingerprint = sourceFingerprint(input, rows)
  return {
    comicId: input.comicId,
    observedAt: input.observedAt,
    rowCount: rows.length,
    rows,
    snapshotIdentity: `chapter-source:${input.comicId}:${sourceRevision}`,
    sourceFingerprint: fingerprint,
    sourceCount: rows.length,
    sourceRevision,
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    terminalState: input.terminalState,
  }
}

async function readExistingSnapshot(
  db: ChapterCompletenessDatabase,
  comicId: string,
  fingerprint: string,
): Promise<ChapterSourceSnapshot | undefined> {
  const row = await db.query.comicChapterSourceSnapshots.findFirst({
    where: and(
      eq(comicChapterSourceSnapshots.comicId, comicId),
      eq(comicChapterSourceSnapshots.sourceFingerprint, fingerprint),
    ),
    with: { rows: true },
  })
  return row ? snapshotFromRow(row) : undefined
}

async function readNextRevision(db: ChapterCompletenessDatabase, comicId: string): Promise<number> {
  const rows = await db.query.comicChapterSourceSnapshots.findMany({
    where: eq(comicChapterSourceSnapshots.comicId, comicId),
    columns: { sourceRevision: true },
    orderBy: [desc(comicChapterSourceSnapshots.sourceRevision)],
    limit: 1,
  })
  return (rows[0]?.sourceRevision ?? 0) + 1
}

export async function persistChapterSourceSnapshot(
  db: ChapterCompletenessDatabase,
  input: ChapterSourceSnapshotInput,
): Promise<ChapterSourceSnapshot> {
  const rows = input.sourceRows.map(normalizeSourceChapterRow)
  const fingerprint = sourceFingerprint(input, rows)
  const existing = await readExistingSnapshot(db, input.comicId, fingerprint)
  if (existing)
    return existing

  const client = nativeClient(db)
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = buildChapterSourceSnapshot(input, await readNextRevision(db, input.comicId))
    const id = snapshotId(snapshot.snapshotIdentity)
    if (!client) {
      await db.insert(comicChapterSourceSnapshots).values({
        comicId: snapshot.comicId,
        createdAt: new Date(snapshot.observedAt * 1000),
        id,
        observedAt: new Date(snapshot.observedAt * 1000),
        rowCount: snapshot.rowCount,
        snapshotIdentity: snapshot.snapshotIdentity,
        sourceCount: snapshot.sourceCount,
        sourceFingerprint: snapshot.sourceFingerprint,
        sourceRevision: snapshot.sourceRevision,
        sourceUrl: snapshot.sourceUrl ?? null,
        terminalState: snapshot.terminalState,
      })
      if (snapshot.rows.length > 0) {
        await db.insert(comicChapterSourceRows).values(snapshot.rows.map(row => ({
          chapterNumber: row.chapterNumber,
          comicId: snapshot.comicId,
          createdAt: new Date(snapshot.observedAt * 1000),
          id: stableId('chapter-source-row', `${snapshot.snapshotIdentity}-${row.sourceOrdinal}`),
          identity: row.identity,
          slug: row.slug,
          snapshotId: id,
          sourceOrdinal: row.sourceOrdinal,
          sourceUrl: row.sourceUrl,
          title: row.title,
        })))
      }
      return snapshot
    }

    try {
      const observedAt = snapshot.observedAt
      const statements: NativeD1Statement[] = [client.prepare(`
        INSERT INTO comic_chapter_source_snapshot (
          id, comic_id, source_revision, source_url, terminal_state, source_count,
          row_count, snapshot_identity, source_fingerprint, observed_at, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM comic_chapter_source_snapshot
          WHERE comic_id = ? AND source_fingerprint = ?
        )
      `).bind(
        id,
        snapshot.comicId,
        snapshot.sourceRevision,
        snapshot.sourceUrl ?? null,
        snapshot.terminalState,
        snapshot.sourceCount,
        snapshot.rowCount,
        snapshot.snapshotIdentity,
        snapshot.sourceFingerprint,
        observedAt,
        observedAt,
        snapshot.comicId,
        snapshot.sourceFingerprint,
      )]
      for (const row of snapshot.rows) {
        statements.push(client.prepare(`
          INSERT INTO comic_chapter_source_row (
            id, snapshot_id, comic_id, source_ordinal, identity, title, slug,
            chapter_number, source_url, created_at
          ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM comic_chapter_source_snapshot WHERE id = ?)
        `).bind(
          stableId('chapter-source-row', `${snapshot.snapshotIdentity}-${row.sourceOrdinal}`),
          id,
          snapshot.comicId,
          row.sourceOrdinal,
          row.identity,
          row.title,
          row.slug,
          row.chapterNumber,
          row.sourceUrl,
          observedAt,
          id,
        ))
      }
      const result = await client.batch(statements)
      if (changes(result[0]) === 1)
        return snapshot
      const raced = await readExistingSnapshot(db, input.comicId, fingerprint)
      if (raced)
        return raced
    }
    catch (error) {
      if (attempt === 2)
        throw error
    }
  }
  throw new Error('chapter_source_snapshot_write_race')
}

function storedRows(rows: readonly {
  readonly chapterNumber: number | null
  readonly id: string
  readonly slug: string
  readonly sortOrder: number
}[]): StoredChapterIdentity[] {
  return rows.map(row => ({
    chapterNumber: row.chapterNumber,
    id: row.id,
    slug: row.slug,
    sortOrder: row.sortOrder,
  }))
}

export async function persistChapterCompletenessProjection(
  db: ChapterCompletenessDatabase,
  snapshot: ChapterSourceSnapshot,
  stored: readonly {
    readonly chapterNumber: number | null
    readonly id: string
    readonly slug: string
    readonly sortOrder: number
  }[],
  options: {
    readonly allowSameRevision?: boolean
    readonly attemptNumber?: number
    readonly eventSequence?: number
    readonly provider?: 'github-actions' | 'local-proof' | 'sync'
    readonly runId?: string
    readonly taskId?: string
    readonly expectedProjectionVersion?: number
  } = {},
): Promise<ChapterCompletenessProjection> {
  const storedIdentities = storedRows(stored)
  const storedFingerprint = fingerprintJson(JSON.stringify(storedIdentities))
  const observationSuffix = options.runId
    ? `:${options.runId}:${options.attemptNumber ?? 0}:${options.eventSequence ?? 0}`
    : ''
  const projection = compareChapterCompleteness(
    snapshot,
    storedIdentities,
    `chapter-completeness:${snapshot.comicId}:${snapshot.sourceRevision}:${storedFingerprint}${observationSuffix}`,
  )
  const existing = await db.query.chapterCompletenessCurrent.findFirst({
    where: eq(chapterCompletenessCurrent.comicId, snapshot.comicId),
  })
  if (existing && (existing.sourceRevision > snapshot.sourceRevision
    || (existing.sourceRevision === snapshot.sourceRevision && !options.allowSameRevision))) {
    return projectionFromCurrentRow(existing)
  }

  const snapshotId = stableId('chapter-snapshot', snapshot.snapshotIdentity)
  const observationValues = {
    attemptNumber: options.attemptNumber ?? null,
    comicId: snapshot.comicId,
    countsJson: projection.counts,
    createdAt: new Date(snapshot.observedAt * 1000),
    eventSequence: options.eventSequence ?? 0,
    findingsJson: projection.findings,
    id: stableId('chapter-completeness-observation', projection.observationIdentity),
    observationIdentity: projection.observationIdentity,
    provider: options.provider ?? 'sync',
    reasonCode: projection.reasonCode,
    runId: options.runId ?? null,
    snapshotId,
    sourceRevision: snapshot.sourceRevision,
    status: projection.status,
    taskId: options.taskId ?? null,
    observedAt: new Date(snapshot.observedAt * 1000),
  }

  const client = nativeClient(db)
  if (client) {
    const observationId = stableId('chapter-completeness-observation', projection.observationIdentity)
    const currentRead = client.prepare(`
      SELECT comic_id, snapshot_id, source_revision, status, terminal_state, reason_code,
        counts_json, findings_json, observation_identity, projection_version,
        observed_at, updated_at
      FROM chapter_completeness_current
      WHERE comic_id = ?
      LIMIT 1
    `).bind(snapshot.comicId)
    const observationRead = client.prepare(`
      SELECT observation_identity
      FROM chapter_completeness_observation
      WHERE observation_identity = ?
      LIMIT 1
    `).bind(projection.observationIdentity)
    const result = await client.batch([
      client.prepare(`
        INSERT OR IGNORE INTO chapter_completeness_observation (
          id, comic_id, snapshot_id, source_revision, status, reason_code,
          counts_json, findings_json, observation_identity, event_sequence,
          task_id, run_id, attempt_number, provider, observed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        observationId,
        snapshot.comicId,
        snapshotId,
        snapshot.sourceRevision,
        projection.status,
        projection.reasonCode,
        JSON.stringify(projection.counts),
        JSON.stringify(projection.findings),
        projection.observationIdentity,
        observationValues.eventSequence,
        observationValues.taskId,
        observationValues.runId,
        observationValues.attemptNumber,
        observationValues.provider,
        snapshot.observedAt,
        snapshot.observedAt,
      ),
      client.prepare(`
        INSERT INTO chapter_completeness_current (
          comic_id, snapshot_id, source_revision, status, terminal_state, reason_code,
          counts_json, findings_json, observation_identity, projection_version,
          observed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(comic_id) DO UPDATE SET
          snapshot_id = excluded.snapshot_id,
          source_revision = excluded.source_revision,
          status = excluded.status,
          terminal_state = excluded.terminal_state,
          reason_code = excluded.reason_code,
          counts_json = excluded.counts_json,
          findings_json = excluded.findings_json,
          observation_identity = excluded.observation_identity,
          projection_version = chapter_completeness_current.projection_version + 1,
          observed_at = excluded.observed_at,
          updated_at = excluded.updated_at
        WHERE chapter_completeness_current.source_revision < excluded.source_revision
          OR (
            chapter_completeness_current.source_revision = excluded.source_revision
            AND chapter_completeness_current.projection_version = ?
          )
      `).bind(
        snapshot.comicId,
        snapshotId,
        snapshot.sourceRevision,
        projection.status,
        projection.terminalState,
        projection.reasonCode,
        JSON.stringify(projection.counts),
        JSON.stringify(projection.findings),
        projection.observationIdentity,
        snapshot.observedAt,
        snapshot.observedAt,
        options.expectedProjectionVersion ?? existing?.projectionVersion ?? 0,
      ),
      currentRead,
      observationRead,
    ])
    const currentRow = result[2]?.results?.[0]
    const observationRow = result[3]?.results?.[0]
    if (!observationRow) {
      throw new Error('chapter_completeness_observation_readback_missing')
    }
    if (!currentRow) {
      throw new Error('chapter_completeness_current_readback_missing')
    }
    const authoritative = projectionFromCurrentRow(currentRow)
    if (authoritative.observationIdentity !== projection.observationIdentity
      && authoritative.sourceRevision <= snapshot.sourceRevision) {
      throw new Error('chapter_completeness_current_readback_mismatch')
    }
    return authoritative
  }

  const observationInsert = db.insert(chapterCompletenessObservations).values(observationValues)
  if (typeof observationInsert.onConflictDoNothing === 'function')
    await observationInsert.onConflictDoNothing()
  else
    await observationInsert
  const currentValues = {
    comicId: snapshot.comicId,
    countsJson: projection.counts,
    findingsJson: projection.findings,
    observationIdentity: projection.observationIdentity,
    observedAt: new Date(snapshot.observedAt * 1000),
    projectionVersion: (existing?.projectionVersion ?? 0) + 1,
    reasonCode: projection.reasonCode,
    snapshotId,
    sourceRevision: snapshot.sourceRevision,
    status: projection.status,
    terminalState: projection.terminalState,
    updatedAt: new Date(snapshot.observedAt * 1000),
  }
  if (!existing) {
    await db.insert(chapterCompletenessCurrent).values(currentValues)
  }
  else {
    await db.update(chapterCompletenessCurrent)
      .set(currentValues)
      .where(and(
        eq(chapterCompletenessCurrent.comicId, snapshot.comicId),
        or(
          lt(chapterCompletenessCurrent.sourceRevision, snapshot.sourceRevision),
          and(
            eq(chapterCompletenessCurrent.sourceRevision, snapshot.sourceRevision),
            eq(chapterCompletenessCurrent.projectionVersion, options.expectedProjectionVersion ?? existing?.projectionVersion ?? 0),
          ),
        ),
      ))
  }
  const readback = await readChapterCompletenessCurrent(db, snapshot.comicId)
  if (readback && readback.sourceRevision >= snapshot.sourceRevision) {
    const authoritative = projectionFromCurrentRow(readback)
    if (authoritative.observationIdentity !== projection.observationIdentity
      && authoritative.sourceRevision <= snapshot.sourceRevision) {
      throw new Error('chapter_completeness_current_readback_mismatch')
    }
    return authoritative
  }
  return projection
}

export async function readChapterCompletenessCurrent(db: ChapterCompletenessDatabase, comicId: string) {
  return db.query.chapterCompletenessCurrent.findFirst({
    where: eq(chapterCompletenessCurrent.comicId, comicId),
  })
}

export async function readChapterSourceSnapshots(db: ChapterCompletenessDatabase, comicId: string, limit = 20) {
  return db.query.comicChapterSourceSnapshots.findMany({
    where: eq(comicChapterSourceSnapshots.comicId, comicId),
    orderBy: [desc(comicChapterSourceSnapshots.sourceRevision)],
    limit: Math.min(Math.max(limit, 1), 50),
    with: { rows: true },
  })
}

export async function readStoredChapterIdentities(db: ChapterCompletenessDatabase, comicId: string) {
  return db.query.chapters.findMany({
    where: eq(chapters.comicId, comicId),
    columns: { chapterNumber: true, id: true, slug: true, sortOrder: true },
  })
}
