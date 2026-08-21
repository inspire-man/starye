import type { Database } from '@starye/db'
import { chapterPageAvailabilityCurrent, chapterPageAvailabilityObservations } from '@starye/db/schema'
import { and, eq, lt, or } from 'drizzle-orm'
import { probeChapterImage } from './image-probe'
import { pageIdentity, redactedPageUrl } from './page-identity'

export const CHAPTER_PAGE_POLICY_VERSION = 'chapter-page-probe/v1' as const
const MAX_PAGES_PER_PROBE = 200
const MAX_SAMPLES = 20
const MAX_FINDINGS = 100

interface PageRecord { readonly id: string, readonly imageUrl: string, readonly pageNumber: number }
type PageDatabase = Pick<Database, 'query' | 'insert' | 'update'> & Partial<Pick<Database, '$client'>>

interface NativeD1Statement {
  all: <T>() => Promise<{ readonly results?: readonly T[] }>
  bind: (...values: unknown[]) => NativeD1Statement
}

interface NativeD1Result {
  readonly meta?: { readonly changes?: number }
  readonly results?: readonly Record<string, unknown>[]
}

interface NativeD1Client {
  batch: (statements: readonly NativeD1Statement[]) => Promise<readonly NativeD1Result[]>
  prepare: (query: string) => NativeD1Statement
}

export interface PersistPageAvailabilityInput {
  readonly attemptNumber?: number
  readonly chapterId: string
  readonly observedAt?: number
  readonly policyVersion?: string
  readonly provider?: 'github-actions' | 'local-proof' | 'integrity'
  readonly runId?: string
  readonly sourceRevision: number
  readonly taskId?: string
  readonly expectedProjectionVersion?: number
  readonly eventSequence?: number
  readonly pageIdentities?: readonly string[]
  readonly pageNumbers?: readonly number[]
}

function nowSeconds(input?: number): number {
  return input ?? Math.floor(Date.now() / 1000)
}

function fingerprintJson(value: string): string {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function nativeClient(db: PageDatabase): NativeD1Client | undefined {
  const client = db.$client as unknown as NativeD1Client | undefined
  return client && typeof client.prepare === 'function' && typeof client.batch === 'function'
    ? client
    : undefined
}

function changes(result: NativeD1Result | undefined): number {
  return result?.meta?.changes ?? 0
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string')
    return value ?? fallback
  try {
    return JSON.parse(value)
  }
  catch {
    return fallback
  }
}

function currentFromRow(row: any): any {
  if (!row)
    return undefined
  return {
    availablePageCount: row.availablePageCount ?? row.available_page_count,
    chapterId: row.chapterId ?? row.chapter_id,
    expectedPageCount: row.expectedPageCount ?? row.expected_page_count,
    findingsJson: parseJson(row.findingsJson ?? row.findings_json, []),
    observationIdentity: row.observationIdentity ?? row.observation_identity,
    observedAt: row.observedAt ?? row.observed_at,
    policyVersion: row.policyVersion ?? row.policy_version,
    projectionVersion: row.projectionVersion ?? row.projection_version,
    samplesJson: parseJson(row.samplesJson ?? row.samples_json, []),
    sourceRevision: row.sourceRevision ?? row.source_revision,
    status: row.status,
    storedPageCount: row.storedPageCount ?? row.stored_page_count,
    unknownPageCount: row.unknownPageCount ?? row.unknown_page_count,
    unavailablePageCount: row.unavailablePageCount ?? row.unavailable_page_count,
    updatedAt: row.updatedAt ?? row.updated_at,
  }
}

function findingsForPages(pages: readonly PageRecord[], expectedPageCount: number) {
  const findings: Array<{ code: string, detail: string, pageNumbers?: number[] }> = []
  const pageNumbers = pages.map(page => page.pageNumber)
  const duplicatePageNumbers = [...new Set(pageNumbers.filter((pageNumber, index) => pageNumbers.indexOf(pageNumber) !== index))]
  if (duplicatePageNumbers.length > 0) {
    findings.push({ code: 'duplicate_page_number', detail: 'stored pages contain duplicate page numbers', pageNumbers: duplicatePageNumbers.slice(0, 20) })
  }
  const expectedNumbers = Array.from({ length: Math.min(expectedPageCount, 10_000) }, (_, index) => index + 1)
  const missingPageNumbers = expectedNumbers.filter(pageNumber => !pageNumbers.includes(pageNumber)).slice(0, 20)
  if (missingPageNumbers.length > 0) {
    findings.push({ code: 'missing_page', detail: 'expected page number is absent from stored pages', pageNumbers: missingPageNumbers })
  }
  if (pages.some((page, index) => index > 0 && page.pageNumber < pages[index - 1]!.pageNumber)) {
    findings.push({ code: 'page_order', detail: 'stored page numbers are not ordered' })
  }
  const extraPageNumbers = [...new Set(pageNumbers.filter(pageNumber => pageNumber > expectedPageCount))].slice(0, 20)
  if (extraPageNumbers.length > 0) {
    findings.push({ code: 'extra_page', detail: 'stored page number exceeds expected page count', pageNumbers: extraPageNumbers })
  }
  return findings
}

type PageProbeStatus = 'available' | 'unavailable' | 'unknown' | 'degraded'

async function readPreviousPageStatuses(
  client: NativeD1Client,
  chapterId: string,
  sourceRevision: number,
): Promise<Map<string, PageProbeStatus>> {
  const rows = await client.prepare(`
    SELECT page_identity, status
    FROM chapter_page_availability_observation
    WHERE chapter_id = ? AND source_revision = ?
    ORDER BY observed_at DESC, created_at DESC
  `).bind(chapterId, sourceRevision).all<{ page_identity: string, status: PageProbeStatus }>()
  const statuses = new Map<string, PageProbeStatus>()
  for (const row of rows.results ?? []) {
    if (!statuses.has(row.page_identity))
      statuses.set(row.page_identity, row.status)
  }
  return statuses
}

export function mergePageProbeStatuses(
  pages: readonly PageRecord[],
  previousStatuses: ReadonlyMap<string, PageProbeStatus>,
  observations: readonly { readonly pageIdentity: string, readonly status: PageProbeStatus }[],
): Map<string, PageProbeStatus> {
  const statuses = new Map<string, PageProbeStatus>()
  for (const page of pages) {
    const identity = pageIdentity(page.pageNumber, page.imageUrl)
    statuses.set(identity, previousStatuses.get(identity) ?? 'unknown')
  }
  for (const observation of observations) {
    const previous = statuses.get(observation.pageIdentity)
    statuses.set(observation.pageIdentity, observation.status === 'unknown' && previous === 'available' ? 'available' : observation.status)
  }
  return statuses
}

export async function persistChapterPageAvailability(
  db: PageDatabase,
  input: PersistPageAvailabilityInput,
  chapter: { readonly pages: readonly PageRecord[], readonly sourcePageCount?: number | null },
  options: { readonly fetch?: typeof fetch, readonly timeoutMs?: number } = {},
) {
  const observedAt = nowSeconds(input.observedAt)
  const policyVersion = input.policyVersion ?? CHAPTER_PAGE_POLICY_VERSION
  const storedPages = chapter.pages
  const requestedPageNumbers = new Set(input.pageNumbers ?? [])
  const requestedPageIdentities = new Set(input.pageIdentities ?? [])
  const selectedPages = input.pageNumbers || input.pageIdentities
    ? storedPages.filter((page) => {
        const identity = pageIdentity(page.pageNumber, page.imageUrl)
        return requestedPageNumbers.has(page.pageNumber) || requestedPageIdentities.has(identity)
      })
    : storedPages
  const pages = selectedPages.slice(0, MAX_PAGES_PER_PROBE)
  if ((input.pageNumbers || input.pageIdentities) && pages.length === 0)
    throw new Error('chapter_page_selection_empty')
  const client = nativeClient(db)
  const previousStatuses = client
    ? await readPreviousPageStatuses(client, input.chapterId, input.sourceRevision)
    : new Map<string, PageProbeStatus>()
  const expectedPageCount = Math.max(chapter.sourcePageCount ?? storedPages.length, 0)
  const pageFindings = findingsForPages(storedPages, expectedPageCount)
  const observations = await Promise.all(pages.map(async (page) => {
    const result = await probeChapterImage(page.imageUrl, options)
    const identity = pageIdentity(page.pageNumber, page.imageUrl)
    return {
      chapterId: input.chapterId,
      contentType: result.contentType ?? null,
      createdAt: new Date(observedAt * 1000),
      eventSequence: input.eventSequence ?? 0,
      httpStatus: result.httpStatus ?? null,
      id: `chapter-page-observation-${fingerprintJson(JSON.stringify({ attemptNumber: input.attemptNumber ?? null, chapterId: input.chapterId, eventSequence: input.eventSequence ?? null, pageNumber: page.pageNumber, runId: input.runId ?? null, sourceRevision: input.sourceRevision, url: result.urlIdentity }))}`.slice(0, 128),
      observationIdentity: `chapter-page:${fingerprintJson(JSON.stringify({ attemptNumber: input.attemptNumber ?? null, chapterId: input.chapterId, eventSequence: input.eventSequence ?? null, pageIdentity: identity, policyVersion, runId: input.runId ?? null, sourceRevision: input.sourceRevision }))}`.slice(0, 256),
      pageIdentity: identity,
      pageNumber: page.pageNumber,
      policyVersion,
      provider: input.provider ?? 'integrity',
      reasonCode: result.reason,
      runId: input.runId ?? null,
      sourceRevision: input.sourceRevision,
      status: result.status,
      summaryJson: {
        pageNumber: page.pageNumber,
        status: result.status,
        urlIdentity: result.urlIdentity,
      },
      taskId: input.taskId ?? null,
      urlIdentity: redactedPageUrl(page.imageUrl),
      observedAt: new Date(observedAt * 1000),
      attemptNumber: input.attemptNumber ?? null,
    }
  }))
  const statuses = mergePageProbeStatuses(storedPages, previousStatuses, observations.map(observation => ({ pageIdentity: observation.pageIdentity, status: observation.summaryJson.status as PageProbeStatus })))
  const availablePageCount = [...statuses.values()].filter(status => status === 'available').length
  const unavailablePageCount = [...statuses.values()].filter(status => status === 'unavailable').length
  const unknownProbeCount = [...statuses.values()].filter(status => status === 'unknown' || status === 'degraded').length
  const missingStoredCount = Math.max(expectedPageCount - storedPages.length, 0)
  const unprobedPageCount = Math.max(storedPages.length - pages.length, 0)
  const unknownPageCount = unknownProbeCount + missingStoredCount
  const status = storedPages.length === 0 && expectedPageCount > 0
    ? 'unknown' as const
    : unknownPageCount > 0 || pageFindings.some(finding => finding.code === 'extra_page')
      ? availablePageCount > 0 ? 'degraded' as const : 'unknown' as const
      : unavailablePageCount > 0
        ? availablePageCount > 0 ? 'degraded' as const : 'unavailable' as const
        : pageFindings.length > 0 ? 'degraded' as const : 'available' as const
  const samples = observations
    .filter(row => row.summaryJson.status !== 'available')
    .map(row => ({ pageNumber: row.pageNumber, reasonCode: row.reasonCode, status: row.summaryJson.status, urlIdentity: row.urlIdentity }))
    .slice(0, MAX_SAMPLES)
  const allFindings = [
    ...pageFindings,
    ...(unprobedPageCount > 0 ? [{ code: 'probe_bounded', detail: 'page probe was bounded; remaining stored pages were not probed' }] : []),
    ...samples.map(sample => ({ code: sample.reasonCode, detail: 'page probe finding', pageNumbers: [sample.pageNumber] })),
  ].slice(0, MAX_FINDINGS)
  const observationIdentity = `chapter-pages:${fingerprintJson(JSON.stringify({
    chapterId: input.chapterId,
    pages: storedPages.map(page => ({ pageNumber: page.pageNumber, url: pageIdentity(page.pageNumber, page.imageUrl) })),
    selectedPageIdentities: pages.map(page => pageIdentity(page.pageNumber, page.imageUrl)),
    policyVersion,
    sourceRevision: input.sourceRevision,
  }))}`.slice(0, 256)
  const existing = await db.query.chapterPageAvailabilityCurrent.findFirst({
    where: eq(chapterPageAvailabilityCurrent.chapterId, input.chapterId),
  })
  if (existing && existing.sourceRevision > input.sourceRevision)
    return existing
  if (existing && storedPages.length === 0 && existing.availablePageCount > 0)
    return existing

  const expectedProjectionVersion = input.expectedProjectionVersion ?? existing?.projectionVersion ?? 0

  const currentValues = {
    availablePageCount,
    chapterId: input.chapterId,
    expectedPageCount,
    findingsJson: allFindings,
    observationIdentity,
    observedAt: new Date(observedAt * 1000),
    policyVersion,
    projectionVersion: (existing?.projectionVersion ?? 0) + 1,
    sourceRevision: input.sourceRevision,
    status,
    storedPageCount: storedPages.length,
    unknownPageCount,
    unavailablePageCount,
    updatedAt: new Date(observedAt * 1000),
    samplesJson: samples,
  }

  if (client) {
    const statements: NativeD1Statement[] = []
    for (const observation of observations) {
      statements.push(client.prepare(`
        INSERT OR IGNORE INTO chapter_page_availability_observation (
          id, chapter_id, source_revision, policy_version, page_number, page_identity,
          status, reason_code, http_status, content_type, url_identity, summary_json,
          observation_identity, event_sequence, task_id, run_id, attempt_number,
          provider, observed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        observation.id,
        observation.chapterId,
        observation.sourceRevision,
        observation.policyVersion,
        observation.pageNumber,
        observation.pageIdentity,
        observation.status,
        observation.reasonCode,
        observation.httpStatus,
        observation.contentType,
        observation.urlIdentity,
        JSON.stringify(observation.summaryJson),
        observation.observationIdentity,
        observation.eventSequence,
        observation.taskId,
        observation.runId,
        observation.attemptNumber,
        observation.provider,
        observedAt,
        observedAt,
      ))
    }
    statements.push(client.prepare(`
      INSERT INTO chapter_page_availability_current (
        chapter_id, source_revision, policy_version, status, expected_page_count,
        stored_page_count, available_page_count, unavailable_page_count, unknown_page_count,
        findings_json, samples_json, observation_identity, projection_version,
        observed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(chapter_id) DO UPDATE SET
        source_revision = excluded.source_revision,
        policy_version = excluded.policy_version,
        status = excluded.status,
        expected_page_count = excluded.expected_page_count,
        stored_page_count = excluded.stored_page_count,
        available_page_count = excluded.available_page_count,
        unavailable_page_count = excluded.unavailable_page_count,
        unknown_page_count = excluded.unknown_page_count,
        findings_json = excluded.findings_json,
        samples_json = excluded.samples_json,
        observation_identity = excluded.observation_identity,
        projection_version = chapter_page_availability_current.projection_version + 1,
        observed_at = excluded.observed_at,
        updated_at = excluded.updated_at
      WHERE chapter_page_availability_current.projection_version = ?
        AND chapter_page_availability_current.source_revision <= excluded.source_revision
    `).bind(
      input.chapterId,
      input.sourceRevision,
      policyVersion,
      currentValues.status,
      expectedPageCount,
      storedPages.length,
      availablePageCount,
      unavailablePageCount,
      unknownPageCount,
      JSON.stringify(allFindings),
      JSON.stringify(samples),
      observationIdentity,
      observedAt,
      observedAt,
      expectedProjectionVersion,
    ))
    statements.push(client.prepare(`
      SELECT chapter_id, source_revision, policy_version, status, expected_page_count,
        stored_page_count, available_page_count, unavailable_page_count, unknown_page_count,
        findings_json, samples_json, observation_identity, projection_version,
        observed_at, updated_at
      FROM chapter_page_availability_current
      WHERE chapter_id = ?
      LIMIT 1
    `).bind(input.chapterId))
    const result = await client.batch(statements)
    const authoritative = currentFromRow(result.at(-1)?.results?.[0])
    if (!authoritative)
      throw new Error('chapter_page_availability_current_readback_missing')
    if (changes(result.at(-2)) === 0 && authoritative.observationIdentity !== observationIdentity)
      throw new Error('chapter_page_availability_projection_cas_failed')
    return authoritative
  }

  if (observations.length > 0) {
    const insert = db.insert(chapterPageAvailabilityObservations).values(observations)
    if (typeof insert.onConflictDoNothing === 'function')
      await insert.onConflictDoNothing()
    else
      await insert
  }
  if (!existing) {
    await db.insert(chapterPageAvailabilityCurrent).values(currentValues)
  }
  else {
    await db.update(chapterPageAvailabilityCurrent)
      .set(currentValues)
      .where(and(
        eq(chapterPageAvailabilityCurrent.chapterId, input.chapterId),
        or(
          lt(chapterPageAvailabilityCurrent.sourceRevision, input.sourceRevision),
          and(
            eq(chapterPageAvailabilityCurrent.sourceRevision, input.sourceRevision),
            eq(chapterPageAvailabilityCurrent.projectionVersion, expectedProjectionVersion),
          ),
        ),
      ))
  }
  const readback = await db.query.chapterPageAvailabilityCurrent.findFirst({
    where: eq(chapterPageAvailabilityCurrent.chapterId, input.chapterId),
  })
  return readback ?? currentValues
}
