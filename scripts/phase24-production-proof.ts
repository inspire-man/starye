import type {
  PlaybackArtifactReference,
  PlaybackEventName,
  PlaybackEvidenceRequest,
  PlaybackEvidenceSourceType,
  PlaybackEvidenceSummary,
  PlaybackEvidenceTuple,
} from '../apps/api/src/domain/playback-evidence/types.ts'
import type { TargetResolution } from '../packages/config/src/deployment-target/target-resolver.ts'
import type {
  Phase24EvidenceCheckpoint,
  Phase24TerminalEvidenceInput,
  Phase24WrittenEvidencePair,
} from './phase24-evidence.ts'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { resolveTargetProfile } from '../packages/config/src/deployment-target/target-resolver.ts'
import { writePhase24EvidencePair } from './phase24-evidence.ts'

export const PHASE24_GATEWAY_ORIGIN = 'http://localhost:8080'
export const PHASE24_DASHBOARD_PATH = '/dashboard/crawlers'
export const PHASE24_EVENT_NAMES: readonly PlaybackEventName[] = ['canplay', 'playing', 'waiting', 'stalled', 'error']
export const PHASE24_DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
export const PHASE24_DEFAULT_POLL_INTERVAL_MS = 2000

interface LocatorVisibilityOptions {
  readonly timeout?: number
}

interface PageWaitOptions {
  readonly timeout?: number
}

type PageWaitUntil = 'domcontentloaded' | 'load' | 'networkidle'

export interface Phase24Locator {
  readonly click: (options?: LocatorVisibilityOptions) => Promise<void>
  readonly count: () => Promise<number>
  readonly filter: (options: { readonly hasText?: string | RegExp }) => Phase24Locator
  readonly first: () => Phase24Locator
  readonly getAttribute: (name: string) => Promise<string | null>
  readonly isVisible: (options?: LocatorVisibilityOptions) => Promise<boolean>
  readonly textContent: () => Promise<string | null>
  readonly locator: (selector: string) => Phase24Locator
  readonly nth: (index: number) => Phase24Locator
}

export interface Phase24Page {
  readonly getByRole: (role: 'button' | 'link', options: { readonly name: string | RegExp }) => Phase24Locator
  readonly goto: (url: string, options?: { readonly timeout?: number, readonly waitUntil?: PageWaitUntil }) => Promise<unknown>
  readonly locator: (selector: string) => Phase24Locator
  readonly reload: (options?: { readonly timeout?: number, readonly waitUntil?: PageWaitUntil }) => Promise<unknown>
  readonly url: () => string
  readonly waitForLoadState: (state?: PageWaitUntil, options?: PageWaitOptions) => Promise<void>
  readonly waitForTimeout: (timeout: number) => Promise<void>
}

export interface Phase24ApiResponse {
  readonly json: <T = unknown>() => Promise<T>
  readonly status: () => number
}

export interface Phase24ApiRequestContext {
  readonly get: (url: string) => Promise<Phase24ApiResponse>
  readonly post: (url: string, options: { readonly data: unknown }) => Promise<Phase24ApiResponse>
}

export interface Phase24BrowserContext {
  readonly request?: Phase24ApiRequestContext
  readonly close?: () => Promise<void>
  readonly newPage: () => Promise<Phase24Page>
}

export interface Phase24BrowserSession {
  readonly context: Phase24BrowserContext
  readonly dashboardPage: Phase24Page
  readonly close?: () => Promise<void>
}

export interface Phase24BrowserFactoryInput {
  readonly browserProfile?: string
  readonly cdpUrl?: string
}

export type Phase24BrowserFactory = (input: Phase24BrowserFactoryInput) => Promise<Phase24BrowserSession>

export type Phase24CheckStatus = 'passed' | 'failed' | 'checkpoint' | 'pending'
export type Phase24MatrixOutcome = 'passed' | 'failed' | 'checkpoint'

export interface Phase24EvidenceLayers {
  readonly playback: Phase24CheckStatus
  readonly provider: Phase24CheckStatus
  readonly receipt: Phase24CheckStatus
  readonly repair: Phase24CheckStatus
  readonly source: Phase24CheckStatus
}

export interface Phase24ProofMatrix {
  readonly schemaVersion: 1
  readonly outcome: Phase24MatrixOutcome
  readonly target: string
  readonly gateway: typeof PHASE24_GATEWAY_ORIGIN
  readonly dashboardPath: typeof PHASE24_DASHBOARD_PATH
  readonly movieCode: string
  readonly tuple: PlaybackEvidenceTuple | null
  readonly contentId: string | null
  readonly sourceRevision: number | null
  readonly viewerPath: string | null
  readonly artifact: PlaybackArtifactReference | null
  readonly artifactJsonPath: string | null
  readonly artifactMarkdownPath: string | null
  readonly matrixPath?: string
  readonly layers: Phase24EvidenceLayers
  readonly checks: Readonly<Record<string, Phase24CheckStatus>>
  readonly sourceAttempts: readonly Phase24SourceAttempt[]
  readonly reason?: string
}

export interface Phase24SourceAttempt {
  readonly sourceType: string
  readonly attempt: number
  readonly retryCount: number
  readonly outcome: string
}

export interface Phase24ProofInput {
  readonly target: string
  readonly movieCode: string
  readonly evidenceRoot: string
  readonly browserProfile?: string
  readonly cdpUrl?: string
  readonly timeoutMs?: number
  readonly pollIntervalMs?: number
}

export interface Phase24ProofDependencies {
  readonly browserFactory?: Phase24BrowserFactory
  readonly now?: () => number
  readonly resolveTarget?: (targetId: string) => TargetResolution
  readonly sleep?: (milliseconds: number) => Promise<void>
  readonly writeEvidence?: typeof writePhase24EvidencePair
}

export class Phase24ProofCheckpointError extends Error {
  readonly outcome = 'checkpoint' as const

  constructor(message: string) {
    super(message)
    this.name = 'Phase24ProofCheckpointError'
  }
}

interface Phase24MovieIdentity {
  readonly code: string
  readonly id: string
  readonly title: string
}

interface Phase24ProviderSnapshot {
  readonly provider: string | null
  readonly providerConclusion: string | null
  readonly providerRunId: string | null
  readonly providerStatus: string | null
}

interface Phase24RunSnapshot {
  readonly attemptNumber: number
  readonly id: string
  readonly provider: Phase24ProviderSnapshot
  readonly raw: Record<string, unknown>
  readonly receipt: Record<string, unknown> | null
  readonly receiptValidation: Record<string, unknown> | null
  readonly repair: Record<string, unknown> | null
  readonly sourceReadback: Record<string, unknown> | null
  readonly sourceRevision: number | null
  readonly status: string
}

interface Phase24TaskSnapshot {
  readonly movie: Phase24MovieIdentity
  readonly operation: string
  readonly raw: Record<string, unknown>
  readonly reason: string | null
  readonly run: Phase24RunSnapshot | null
  readonly source: Record<string, unknown> | null
  readonly sourceRevision: number
  readonly taskId: string
}

interface Phase24DashboardSelection {
  readonly initialTaskIds: ReadonlySet<string>
  readonly movie: Phase24MovieIdentity
  readonly taskId: string
}

interface Phase24ViewerObservation {
  readonly events: readonly Phase24ObservedEvent[]
  readonly sourceAttempts: readonly Phase24SourceAttempt[]
  readonly sourceType: PlaybackEvidenceSourceType
  readonly contentId: string
  readonly sourceRevision: number
  readonly viewerPath: string
  readonly progress: {
    readonly currentTimeAfter: number
    readonly currentTimeBefore: number
    readonly currentTimeDelta: number
  }
  readonly outcome: 'accepted' | 'failed' | 'checkpoint'
  readonly reason?: string
}

interface Phase24ObservedEvent {
  readonly event: PlaybackEventName
  readonly observed: boolean
  readonly observedAt: number | null
}

interface Phase24DashboardTrace {
  readonly path: string
  readonly text: string
}

const repositoryRoot = resolve(import.meta.dirname, '..')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedIdentifier(value: unknown): string | null {
  return typeof value === 'string' && /^[\w.~-]{1,128}$/u.test(value.trim()) ? value.trim() : null
}

function boundedMovieCode(value: unknown): string | null {
  return typeof value === 'string' && /^[\w.~-]{1,128}$/u.test(value.trim()) ? value.trim() : null
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function recordValue(record: Record<string, unknown>, key: string): unknown {
  return record[key]
}

function recordString(record: Record<string, unknown>, key: string): string | null {
  return typeof record[key] === 'string' ? record[key] as string : null
}

function recordInteger(record: Record<string, unknown>, key: string): number | null {
  return nonNegativeInteger(record[key])
}

function nestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key]
  return isRecord(value) ? value : null
}

function parseMovieIdentity(value: unknown): Phase24MovieIdentity | null {
  if (!isRecord(value))
    return null
  const id = boundedIdentifier(value.id)
  const code = boundedMovieCode(value.code)
  const title = typeof value.title === 'string' && value.title.trim().length > 0 ? value.title.trim() : null
  return id && code && title ? { code, id, title } : null
}

function parseProvider(value: unknown): Phase24ProviderSnapshot {
  if (!isRecord(value)) {
    return { provider: null, providerConclusion: null, providerRunId: null, providerStatus: null }
  }
  return {
    provider: recordString(value, 'provider'),
    providerConclusion: recordString(value, 'providerConclusion'),
    providerRunId: boundedIdentifier(value.providerRunId),
    providerStatus: recordString(value, 'providerStatus'),
  }
}

function parseRun(value: unknown): Phase24RunSnapshot | null {
  if (!isRecord(value))
    return null
  const id = boundedIdentifier(value.id)
  const attemptNumber = nonNegativeInteger(value.attemptNumber ?? value.attempt_number)
  const status = recordString(value, 'status')
  if (!id || attemptNumber === null || attemptNumber < 1 || !status)
    return null
  return {
    attemptNumber,
    id,
    provider: parseProvider(value.provider),
    raw: value,
    receipt: nestedRecord(value, 'receipt'),
    receiptValidation: nestedRecord(value, 'receiptValidation'),
    repair: nestedRecord(value, 'repair'),
    sourceReadback: nestedRecord(value, 'sourceReadback'),
    sourceRevision: recordInteger(value, 'sourceRevision'),
    status,
  }
}

function parseTaskDetail(value: unknown): Phase24TaskSnapshot {
  if (!isRecord(value))
    throw new Phase24ProofCheckpointError('task detail is not an object')
  const task = nestedRecord(value, 'task')
  const movie = task ? parseMovieIdentity(task.movie) : null
  const taskId = task ? boundedIdentifier(task.id) : null
  const operation = task ? recordString(task, 'operation') : null
  if (!task || !movie || !taskId || !operation)
    throw new Phase24ProofCheckpointError('task detail is missing the server-owned repair identity')

  const currentAttempt = parseRun(recordValue(value, 'currentAttempt'))
  const runs = Array.isArray(value.runs)
    ? value.runs.map(parseRun).filter((run): run is Phase24RunSnapshot => run !== null)
    : []
  const latestRunId = boundedIdentifier(task.latestRunId ?? task.latest_run_id)
  const run = currentAttempt ?? runs.find(candidate => candidate.id === latestRunId) ?? runs[0] ?? null
  const source = nestedRecord(task, 'source')
  const sourceReadback = run?.sourceReadback ?? nestedRecord(task, 'sourceReadback')
  const sourceRevision = recordInteger(task, 'sourceRevision')
    ?? recordInteger(sourceReadback ?? {}, 'sourceRevision')
    ?? run?.sourceRevision
    ?? 0
  return {
    movie,
    operation,
    raw: value,
    reason: recordString(task, 'reason'),
    run,
    source,
    sourceRevision,
    taskId,
  }
}

function parseFocalIdentity(text: string): { readonly movie: Phase24MovieIdentity | null, readonly runId: string | null, readonly taskId: string | null, readonly attemptNumber: number | null } {
  const taskId = text.match(/\btask\s+([\w.~-]{1,128})/u)?.[1] ?? null
  const runId = text.match(/\brun\s+([\w.~-]{1,128})/u)?.[1] ?? null
  const attempt = text.match(/attempt\s*#\s*(\d+)/iu)?.[1]
  const movieMatch = text.match(/\bmovie\s+([\w.~-]{1,128})\s*[·|]/u)
  const codeMatch = movieMatch ? text.match(new RegExp(`\\b${escapeRegExp(movieMatch[1])}\\s*[·|]\\s*([\\w.~-]{1,128})`, 'u')) : null
  const movie = movieMatch && codeMatch
    ? { code: codeMatch[1], id: movieMatch[1], title: movieMatch[1] }
    : null
  return {
    attemptNumber: attempt ? Number(attempt) : null,
    movie,
    runId,
    taskId,
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isLoginPath(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.endsWith('/login') || parsed.pathname.includes('/auth/login')
  }
  catch {
    return true
  }
}

function sourceStatusFor(task: Phase24TaskSnapshot): Phase24CheckStatus {
  const disposition = task.source ? recordString(task.source, 'disposition') : null
  if (disposition === 'ready')
    return 'passed'
  if (disposition === 'source_failed')
    return 'failed'
  return 'checkpoint'
}

function providerStatusFor(run: Phase24RunSnapshot | null): Phase24CheckStatus {
  if (!run)
    return 'pending'
  if (run.provider.provider === 'github-actions' && run.provider.providerStatus === 'completed' && run.provider.providerConclusion === 'success' && run.provider.providerRunId)
    return 'passed'
  if (run.provider.providerStatus === 'completed' || run.status === 'failed' || run.status === 'cancelled')
    return 'failed'
  return 'pending'
}

function receiptStatusFor(run: Phase24RunSnapshot | null, movieId: string, sourceRevision: number): Phase24CheckStatus {
  if (!run)
    return 'pending'
  const validation = run.receiptValidation
  const receipt = run.receipt
  const identity = receipt && recordString(receipt, 'movieId') === movieId && recordInteger(receipt, 'sourceRevision') === sourceRevision
  if (validation && recordString(validation, 'status') === 'validated' && identity)
    return 'passed'
  if (run.status === 'failed' || run.status === 'cancelled' || (validation && recordString(validation, 'status') === 'failed'))
    return 'failed'
  return 'pending'
}

function repairStatusFor(run: Phase24RunSnapshot | null, receiptStatus: Phase24CheckStatus): Phase24CheckStatus {
  if (!run)
    return 'pending'
  if (receiptStatus === 'passed' && run.repair && recordString(run.repair, 'status') === 'validated')
    return 'passed'
  if (run.status === 'failed' || run.status === 'cancelled' || receiptStatus === 'failed')
    return 'failed'
  return 'pending'
}

function isTerminalRun(run: Phase24RunSnapshot | null): boolean {
  return Boolean(run && ['succeeded', 'failed', 'cancelled'].includes(run.status))
}

function hasHistoricalCarrier(value: string): boolean {
  return /phase[-_]?13|p13|carrier/iu.test(value)
}

function tupleFromTask(task: Phase24TaskSnapshot): PlaybackEvidenceTuple | null {
  const run = task.run
  if (!run || !task.sourceRevision)
    return null
  if (run.provider.provider !== 'github-actions' || !run.provider.providerRunId)
    return null
  const tuple = {
    attemptNumber: run.attemptNumber,
    provider: 'github-actions' as const,
    runId: run.id,
    taskId: task.taskId,
  }
  if (hasHistoricalCarrier(tuple.taskId) || hasHistoricalCarrier(tuple.runId) || hasHistoricalCarrier(run.provider.providerRunId))
    throw new Phase24ProofCheckpointError('historical Phase 13 carrier is not a fresh production tuple')
  return tuple
}

function matrixBase(input: Phase24ProofInput, outcome: Phase24MatrixOutcome, checks: Readonly<Record<string, Phase24CheckStatus>>, reason?: string): Phase24ProofMatrix {
  return {
    artifact: null,
    artifactJsonPath: null,
    artifactMarkdownPath: null,
    checks,
    contentId: null,
    dashboardPath: PHASE24_DASHBOARD_PATH,
    gateway: PHASE24_GATEWAY_ORIGIN,
    layers: { playback: 'pending', provider: 'pending', receipt: 'pending', repair: 'pending', source: 'pending' },
    movieCode: input.movieCode,
    outcome,
    reason,
    schemaVersion: 1,
    sourceAttempts: [],
    sourceRevision: null,
    target: input.target,
    tuple: null,
    viewerPath: null,
  }
}

function withTaskMatrix(matrix: Phase24ProofMatrix, task: Phase24TaskSnapshot): Phase24ProofMatrix {
  const provider = providerStatusFor(task.run)
  const receipt = receiptStatusFor(task.run, task.movie.id, task.sourceRevision)
  const repair = repairStatusFor(task.run, receipt)
  const source = sourceStatusFor(task)
  const tuple = tupleFromTask(task)
  return {
    ...matrix,
    contentId: task.movie.id,
    layers: { ...matrix.layers, provider, receipt, repair, source },
    tuple,
    sourceRevision: task.sourceRevision,
  }
}

async function assertWritableEvidenceRoot(root: string): Promise<void> {
  if (!isAbsolute(root))
    throw new Phase24ProofCheckpointError('evidence root must be an absolute path')
  await mkdir(root, { recursive: true })
  const probe = join(root, `.phase24-write-probe-${Date.now()}.tmp`)
  try {
    await writeFile(probe, 'phase24-write-probe\n', { encoding: 'utf8', flag: 'wx' })
  }
  finally {
    await rm(probe, { force: true })
  }
}

function pathFor(pathname: string): string {
  return `${PHASE24_GATEWAY_ORIGIN}${pathname}`
}

async function jsonResponse(response: Phase24ApiResponse, action: string): Promise<unknown> {
  const status = response.status()
  if (status < 200 || status >= 300)
    throw new Phase24ProofCheckpointError(`${action} returned HTTP ${status}`)
  return response.json()
}

async function getTaskDetail(api: Phase24ApiRequestContext, taskId: string): Promise<Phase24TaskSnapshot> {
  const response = await api.get(pathFor(`/api/admin/crawler-tasks/${encodeURIComponent(taskId)}`))
  return parseTaskDetail(await jsonResponse(response, 'task detail'))
}

async function collectTaskIds(page: Phase24Page): Promise<Set<string>> {
  const cards = page.locator('.task-card')
  const ids = new Set<string>()
  const count = await cards.count()
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index)
    const text = (await card.textContent())?.trim() ?? ''
    const firstLine = text.split(/\r?\n/u).map(line => line.trim()).find(Boolean)
    if (firstLine && boundedIdentifier(firstLine))
      ids.add(firstLine)
  }
  return ids
}

async function selectDashboardCandidate(page: Phase24Page, input: Phase24ProofInput, now: () => number = Date.now): Promise<Phase24DashboardSelection> {
  await page.goto(pathFor(PHASE24_DASHBOARD_PATH), { waitUntil: 'domcontentloaded', timeout: input.timeoutMs })
  await page.waitForLoadState('domcontentloaded', { timeout: input.timeoutMs })
  if (isLoginPath(page.url()))
    throw new Phase24ProofCheckpointError('authenticated Dashboard session is missing')
  const panel = page.locator('.local-task-panel')
  if (!await panel.isVisible({ timeout: Math.min(input.timeoutMs ?? PHASE24_DEFAULT_TIMEOUT_MS, 10000) }))
    throw new Phase24ProofCheckpointError('Dashboard crawler task panel is not visible')

  const cards = page.locator('.task-card')
  const initialTaskIds = await collectTaskIds(page)
  const count = await cards.count()
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index)
    await card.click({ timeout: input.timeoutMs })
    const focal = page.locator('[data-current-attempt-focal]')
    if (!await focal.isVisible({ timeout: Math.min(input.timeoutMs ?? PHASE24_DEFAULT_TIMEOUT_MS, 5000) }))
      continue
    const focalText = (await focal.textContent()) ?? ''
    const identity = parseFocalIdentity(focalText)
    if (!identity.movie || identity.movie.code !== input.movieCode || !identity.taskId)
      continue
    const repairButton = page.locator('[data-repair-action="open"]').first()
    if (!await repairButton.isVisible({ timeout: 1000 }))
      throw new Phase24ProofCheckpointError('selected movie is not currently repairable from Dashboard')
    await repairButton.click({ timeout: input.timeoutMs })
    const confirmButton = page.getByRole('button', { name: '确认恢复可播放源' })
    if (!await confirmButton.isVisible({ timeout: 3000 }))
      throw new Phase24ProofCheckpointError('Dashboard repair confirmation is not visible')
    await confirmButton.click({ timeout: input.timeoutMs })

    const deadline = now() + (input.timeoutMs ?? PHASE24_DEFAULT_TIMEOUT_MS)
    while (now() <= deadline) {
      const currentFocal = page.locator('[data-current-attempt-focal]')
      const currentText = (await currentFocal.textContent()) ?? ''
      const currentIdentity = parseFocalIdentity(currentText)
      if (currentIdentity.taskId && currentIdentity.movie?.id === identity.movie.id
        && currentIdentity.taskId !== identity.taskId
        && !initialTaskIds.has(currentIdentity.taskId)
        && currentText.includes('repair_players')) {
        return { initialTaskIds, movie: identity.movie, taskId: currentIdentity.taskId }
      }
      await page.waitForTimeout(Math.min(input.pollIntervalMs ?? PHASE24_DEFAULT_POLL_INTERVAL_MS, 1000))
    }
    throw new Phase24ProofCheckpointError('Dashboard did not expose a new repair task tuple')
  }
  throw new Phase24ProofCheckpointError(`repairable movie ${input.movieCode} was not visible in Dashboard task history`)
}

async function waitForFreshRepair(
  api: Phase24ApiRequestContext,
  selection: Phase24DashboardSelection,
  input: Phase24ProofInput,
  dependencies: Phase24ProofDependencies,
): Promise<Phase24TaskSnapshot> {
  const now = dependencies.now ?? Date.now
  const deadline = now() + (input.timeoutMs ?? PHASE24_DEFAULT_TIMEOUT_MS)
  let latest: Phase24TaskSnapshot | null = null
  while (now() <= deadline) {
    latest = await getTaskDetail(api, selection.taskId)
    if (latest.taskId !== selection.taskId || latest.movie.id !== selection.movie.id)
      throw new Phase24ProofCheckpointError('server task detail changed movie identity')
    if (latest.operation !== 'repair_players')
      throw new Phase24ProofCheckpointError('Dashboard command did not allocate repair_players')
    if (isTerminalRun(latest.run))
      return latest
    await (dependencies.sleep ?? defaultSleep)(input.pollIntervalMs ?? PHASE24_DEFAULT_POLL_INTERVAL_MS)
  }
  if (!latest)
    throw new Phase24ProofCheckpointError('fresh repair task detail was never allocated')
  throw new Phase24ProofCheckpointError('fresh repair task did not reach a bounded terminal state')
}

function tupleQuery(tuple: PlaybackEvidenceTuple): string {
  return new URLSearchParams({
    attemptNumber: String(tuple.attemptNumber),
    provider: tuple.provider,
    runId: tuple.runId,
    taskId: tuple.taskId,
  }).toString()
}

function parseNumberAttribute(value: string | null): number | null {
  if (value === null || value === 'pending' || value.trim() === '')
    return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function parseObservedAt(text: string, observed: boolean): number | null {
  if (!observed)
    return null
  const match = text.match(/(\d+(?:\.\d+)?)ms/u)
  return match ? Number(match[1]) : 0
}

async function collectPlaybackEvents(page: Phase24Page): Promise<readonly Phase24ObservedEvent[]> {
  const events: Phase24ObservedEvent[] = []
  for (const event of PHASE24_EVENT_NAMES) {
    const row = page.locator(`[data-playback-event="${event}"]`).first()
    if (await row.count() !== 1)
      throw new Phase24ProofCheckpointError(`Player event row ${event} is missing`)
    const observed = (await row.getAttribute('data-observed')) === 'true'
    events.push({ event, observed, observedAt: parseObservedAt((await row.textContent()) ?? '', observed) })
  }
  return events
}

async function collectSourceAttempts(page: Phase24Page): Promise<readonly Phase24SourceAttempt[]> {
  const rows = page.locator('[data-source-attempt-row]')
  const count = await rows.count()
  const result: Phase24SourceAttempt[] = []
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index)
    const parts = ((await row.textContent()) ?? '').trim().split('·').map(part => part.trim())
    const attempt = parts[1]?.match(/^attempt[ \t]+(\d+)$/u)
    const retry = parts[2]?.match(/^retry[ \t]+(\d+)\/\d+$/u)
    const outcome = parts[3]
    if (parts.length === 4 && parts[0] && attempt && retry && outcome) {
      result.push({ attempt: Number(attempt[1]), outcome: outcome.includes('失败') ? 'failed' : 'progressed', retryCount: Number(retry[1]), sourceType: parts[0] })
    }
  }
  return result
}

async function observeViewer(
  page: Phase24Page,
  tuple: PlaybackEvidenceTuple,
  selection: Phase24DashboardSelection,
  sourceRevision: number,
  input: Phase24ProofInput,
  now: () => number = Date.now,
): Promise<Phase24ViewerObservation> {
  const detailPath = `/movie/${encodeURIComponent(selection.movie.code)}?${tupleQuery(tuple)}`
  const viewerPath = `/movie/${encodeURIComponent(selection.movie.code)}/play`
  await page.goto(pathFor(detailPath), { waitUntil: 'domcontentloaded', timeout: input.timeoutMs })
  await page.waitForLoadState('domcontentloaded', { timeout: input.timeoutMs })
  const readiness = page.locator('[data-readiness-summary]')
  if (!await readiness.isVisible({ timeout: 10000 }))
    throw new Phase24ProofCheckpointError('same-movie MovieDetail readiness summary is not visible')

  const directGroup = page.locator('[data-source-group="eligible-direct"]')
  if (await directGroup.count() < 1)
    throw new Phase24ProofCheckpointError('no eligible direct source is visible for the fresh repair')
  const sourceCard = directGroup.locator('[data-source-card]').first()
  if (!await sourceCard.isVisible({ timeout: 10000 }))
    throw new Phase24ProofCheckpointError('eligible direct source card is not visible')
  const contentId = await sourceCard.getAttribute('data-content-id')
  const cardRevision = parseNumberAttribute(await sourceCard.getAttribute('data-source-revision'))
  const sourceType = await sourceCard.getAttribute('data-source-type')
  if (!contentId || cardRevision === null || sourceType !== 'direct')
    throw new Phase24ProofCheckpointError('source card did not expose bounded content/source revision/type')
  if (cardRevision !== sourceRevision || contentId !== selection.movie.id)
    throw new Phase24ProofCheckpointError('MovieDetail source card identity does not match repair readback')
  const sourcePlay = sourceCard.locator('[data-source-action="play"]').first()
  if (!await sourcePlay.isVisible({ timeout: 5000 }))
    throw new Phase24ProofCheckpointError('eligible direct source has no visible Play action')
  await sourcePlay.click({ timeout: input.timeoutMs })
  await page.waitForLoadState('domcontentloaded', { timeout: input.timeoutMs })

  const container = page.locator('#player-container')
  if (!await container.isVisible({ timeout: 10000 }))
    throw new Phase24ProofCheckpointError('Player container is not visible')
  if (await container.getAttribute('data-autoplay') !== 'false')
    throw new Phase24ProofCheckpointError('Player autoplay contract is not disabled')
  const play = page.locator('[data-player-action="play"]').first()
  if (!await play.isVisible({ timeout: 10000 }))
    throw new Phase24ProofCheckpointError('visible Play control is missing')
  await play.click({ timeout: input.timeoutMs })

  const status = page.locator('[data-playback-status]').first()
  const deadline = now() + Math.min(input.timeoutMs ?? PHASE24_DEFAULT_TIMEOUT_MS, 30000)
  let events = await collectPlaybackEvents(page)
  let before = parseNumberAttribute(await page.locator('[data-current-time-before]').first().getAttribute('data-current-time-before'))
  let after = parseNumberAttribute(await page.locator('[data-current-time-after]').first().getAttribute('data-current-time-after'))
  let delta = parseNumberAttribute(await page.locator('[data-current-time-delta]').first().getAttribute('data-current-time-delta'))
  let statusText = (await status.textContent()) ?? ''
  while (now() <= deadline) {
    events = await collectPlaybackEvents(page)
    before = parseNumberAttribute(await page.locator('[data-current-time-before]').first().getAttribute('data-current-time-before'))
    after = parseNumberAttribute(await page.locator('[data-current-time-after]').first().getAttribute('data-current-time-after'))
    delta = parseNumberAttribute(await page.locator('[data-current-time-delta]').first().getAttribute('data-current-time-delta'))
    statusText = (await status.textContent()) ?? ''
    const hasError = events.some(event => event.event === 'error' && event.observed)
    const canplay = events.some(event => event.event === 'canplay' && event.observed)
    const playing = events.some(event => event.event === 'playing' && event.observed)
    if (canplay && playing && !hasError && before !== null && after !== null && delta !== null && delta >= 1) {
      return {
        contentId,
        events,
        outcome: 'accepted',
        progress: { currentTimeAfter: after, currentTimeBefore: before, currentTimeDelta: delta },
        sourceAttempts: await collectSourceAttempts(page),
        sourceRevision: cardRevision,
        sourceType: 'direct',
        viewerPath,
      }
    }
    if (hasError || /播放失败/u.test(statusText)) {
      return {
        contentId,
        events,
        outcome: 'failed',
        progress: { currentTimeAfter: after ?? 0, currentTimeBefore: before ?? 0, currentTimeDelta: delta ?? 0 },
        reason: 'terminal media error or Player failure state',
        sourceAttempts: await collectSourceAttempts(page),
        sourceRevision: cardRevision,
        sourceType: 'direct',
        viewerPath,
      }
    }
    await page.waitForTimeout(Math.min(input.pollIntervalMs ?? PHASE24_DEFAULT_POLL_INTERVAL_MS, 1000))
  }
  const hasCanplay = events.some(event => event.event === 'canplay' && event.observed)
  const hasPlaying = events.some(event => event.event === 'playing' && event.observed)
  const deltaBelowGate = hasCanplay && hasPlaying && before !== null && after !== null && delta !== null && delta < 1
  return {
    contentId,
    events,
    outcome: deltaBelowGate ? 'failed' : 'checkpoint',
    progress: { currentTimeAfter: after ?? 0, currentTimeBefore: before ?? 0, currentTimeDelta: delta ?? 0 },
    reason: deltaBelowGate
      ? 'currentTime delta remained below the one-second playback gate'
      : 'bounded playback observation window expired before canplay/playing/progress gate',
    sourceAttempts: await collectSourceAttempts(page),
    sourceRevision: cardRevision,
    sourceType: 'direct',
    viewerPath,
  }
}

function terminalEvidenceInput(
  input: Phase24ProofInput,
  target: TargetResolution,
  task: Phase24TaskSnapshot,
  tuple: PlaybackEvidenceTuple,
  observation: Phase24ViewerObservation,
  nowSeconds: number,
): Phase24TerminalEvidenceInput {
  const provider = providerStatusFor(task.run)
  const receipt = receiptStatusFor(task.run, task.movie.id, task.sourceRevision)
  const repair = repairStatusFor(task.run, receipt)
  const source = sourceStatusFor(task)
  const canplay = observation.events.some(event => event.event === 'canplay' && event.observed)
  const playing = observation.events.some(event => event.event === 'playing' && event.observed)
  const error = observation.events.some(event => event.event === 'error' && event.observed)
  const accepted = observation.outcome === 'accepted'
    && provider === 'passed'
    && receipt === 'passed'
    && repair === 'passed'
    && source === 'passed'
    && canplay
    && playing
    && !error
    && observation.progress.currentTimeDelta >= 1
  const outcome = accepted ? 'accepted' : observation.outcome === 'failed' ? 'failed' : 'checkpoint'
  return {
    contentId: observation.contentId,
    events: observation.events,
    observedAt: nowSeconds,
    outcome,
    playback: {
      canplay,
      error,
      playing,
      progress: observation.progress,
      status: accepted ? 'playback_verified' : outcome === 'failed' ? 'failed' : 'checkpoint',
    },
    provider: { provider: 'github-actions', status: provider === 'passed' ? 'succeeded' : provider === 'failed' ? 'failed' : 'checkpoint' },
    repair: { sourceRevision: task.sourceRevision, status: repair === 'passed' ? 'validated' : repair === 'failed' ? 'failed' : 'checkpoint' },
    schemaVersion: 1,
    source: { revision: task.sourceRevision, sourceType: observation.sourceType, status: source === 'passed' ? 'ready' : source === 'failed' ? 'failed' : 'checkpoint' },
    sourceRevision: task.sourceRevision,
    tuple,
    viewer: { path: observation.viewerPath, targetLabel: target.id },
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalJson).join(',')}]`
  if (!isRecord(value))
    return JSON.stringify(value)
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}

async function submitEvidence(api: Phase24ApiRequestContext, tuple: PlaybackEvidenceTuple, request: PlaybackEvidenceRequest): Promise<{ readonly body: unknown, readonly status: number }> {
  const response = await api.post(pathFor(`/api/admin/crawler-tasks/${encodeURIComponent(tuple.taskId)}/runs/${encodeURIComponent(tuple.runId)}/playback-evidence`), { data: request })
  return { body: await response.json(), status: response.status() }
}

function summaryFromDetail(detail: Phase24TaskSnapshot): PlaybackEvidenceSummary | null {
  const evidence = detail.raw.playbackEvidence
  if (!isRecord(evidence) || !isRecord(evidence.current) || !isRecord(evidence.current.summary))
    return null
  return evidence.current.summary as unknown as PlaybackEvidenceSummary
}

function responseKind(value: unknown): string | null {
  return isRecord(value) && typeof value.kind === 'string' ? value.kind : null
}

function responseArtifact(value: unknown): PlaybackArtifactReference | null {
  if (!isRecord(value) || !isRecord(value.artifact))
    return null
  const artifact = value.artifact
  return typeof artifact.hash === 'string' && typeof artifact.reference === 'string' && typeof artifact.stem === 'string'
    ? { hash: artifact.hash, reference: artifact.reference, stem: artifact.stem }
    : null
}

async function readDashboardTrace(page: Phase24Page, taskId: string, input: Phase24ProofInput, expected: PlaybackEvidenceSummary): Promise<Phase24DashboardTrace> {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: input.timeoutMs })
  await page.waitForLoadState('domcontentloaded', { timeout: input.timeoutMs })
  const cards = page.locator('.task-card')
  const count = await cards.count()
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index)
    const text = (await card.textContent()) ?? ''
    if (text.includes(taskId)) {
      await card.click({ timeout: input.timeoutMs })
      break
    }
  }
  const focal = page.locator('[data-current-attempt-focal]')
  const actualPlayback = page.locator('[data-evidence-block="actual-playback"]')
  if (!await focal.isVisible({ timeout: 10000 }) || !await actualPlayback.isVisible({ timeout: 10000 }))
    throw new Phase24ProofCheckpointError('Dashboard did not render the fresh current-attempt playback trace')
  const text = (await actualPlayback.textContent()) ?? ''
  const required = [
    expected.tuple.taskId,
    expected.tuple.runId,
    String(expected.tuple.attemptNumber),
    expected.contentId,
    String(expected.sourceRevision),
    expected.viewer.path,
    expected.artifact.reference,
  ]
  if (!required.every(value => text.includes(value)))
    throw new Phase24ProofCheckpointError('Dashboard playback trace does not match the accepted evidence summary')
  return { path: page.url(), text }
}

async function writeMatrix(root: string, matrix: Phase24ProofMatrix): Promise<string> {
  const tupleStem = matrix.tuple
    ? `${matrix.tuple.taskId}_${matrix.tuple.runId}_attempt-${matrix.tuple.attemptNumber}`
    : `checkpoint-${Date.now()}`
  const stem = `phase24-production-${tupleStem}`.replace(/[^\w.-]+/gu, '-').slice(0, 192)
  const path = join(root, `${stem}.matrix.json`)
  await writeFile(path, `${JSON.stringify(matrix, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  return path
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise<void>(resolvePromise => setTimeout(resolvePromise, milliseconds))
}

interface Phase24ConnectedBrowser {
  readonly close: () => Promise<void>
  readonly contexts: () => Phase24BrowserContext[]
}

interface Phase24Chromium {
  readonly connectOverCDP: (endpoint: string) => Promise<Phase24ConnectedBrowser>
  readonly launchPersistentContext: (userDataDir: string, options: { readonly headless: boolean }) => Promise<Phase24BrowserContext>
}

function resolveChromium(value: unknown): Phase24Chromium {
  if (!isRecord(value) || !isRecord(value.chromium))
    throw new Error('Playwright chromium module is unavailable')
  return value.chromium as unknown as Phase24Chromium
}

async function loadChromium(): Promise<Phase24Chromium> {
  const entries = [
    join(repositoryRoot, 'node_modules', '.pnpm', 'playwright@1.59.1', 'node_modules', 'playwright', 'index.js'),
    join(repositoryRoot, 'apps', 'dashboard', 'node_modules', '@playwright', 'test', 'node_modules', 'playwright', 'index.js'),
  ]
  const entry = entries.find(existsSync)
  if (!entry)
    throw new Phase24ProofCheckpointError('Playwright runtime is not installed')
  const loaded: unknown = await import(pathToFileURL(entry).href)
  return resolveChromium(loaded)
}

export const defaultBrowserFactory: Phase24BrowserFactory = async (input) => {
  const chromium = await loadChromium()
  if (input.cdpUrl) {
    const browser = await chromium.connectOverCDP(input.cdpUrl)
    const context = browser.contexts()[0]
    if (!context)
      throw new Phase24ProofCheckpointError('CDP browser has no authenticated context')
    return {
      close: async () => undefined,
      context,
      dashboardPage: await context.newPage(),
    }
  }
  if (!input.browserProfile)
    throw new Phase24ProofCheckpointError('an authenticated CDP URL or browser profile is required')
  const context = await chromium.launchPersistentContext(input.browserProfile, { headless: false })
  return {
    close: () => context.close?.() ?? Promise.resolve(),
    context,
    dashboardPage: await context.newPage(),
  }
}

async function finalizeMatrix(root: string | null, matrix: Phase24ProofMatrix): Promise<Phase24ProofMatrix> {
  if (!root)
    return matrix
  try {
    return { ...matrix, matrixPath: await writeMatrix(root, matrix) }
  }
  catch (error) {
    return {
      ...matrix,
      outcome: 'checkpoint',
      reason: `machine-readable matrix write failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function matrixWithEvidence(matrix: Phase24ProofMatrix, pair: Phase24WrittenEvidencePair | Phase24EvidenceCheckpoint): Phase24ProofMatrix {
  if ('outcome' in pair)
    return matrix
  return {
    ...matrix,
    artifact: pair.artifact,
    artifactJsonPath: pair.jsonPath,
    artifactMarkdownPath: pair.markdownPath,
  }
}

export async function runPhase24ProductionProof(input: Phase24ProofInput, dependencies: Phase24ProofDependencies = {}): Promise<Phase24ProofMatrix> {
  const now = dependencies.now ?? (() => Date.now())
  let root: string | null = null
  let session: Phase24BrowserSession | null = null
  let matrix = matrixBase(input, 'checkpoint', { evidenceRoot: 'pending', selectedTarget: 'pending', dashboardSession: 'pending', runAllocation: 'pending', viewer: 'pending', artifact: 'pending', d1: 'pending', dashboardTrace: 'pending' })
  try {
    if (!boundedIdentifier(input.target))
      throw new Phase24ProofCheckpointError('target id is missing or unbounded')
    if (!boundedMovieCode(input.movieCode))
      throw new Phase24ProofCheckpointError('movie code is missing or unbounded')
    const target = (dependencies.resolveTarget ?? resolveTargetProfile)(input.target)
    matrix = { ...matrix, checks: { ...matrix.checks, selectedTarget: 'passed' } }
    await assertWritableEvidenceRoot(input.evidenceRoot)
    root = resolve(input.evidenceRoot)
    matrix = { ...matrix, checks: { ...matrix.checks, evidenceRoot: 'passed' } }

    session = await (dependencies.browserFactory ?? defaultBrowserFactory)({ browserProfile: input.browserProfile, cdpUrl: input.cdpUrl })
    const api = session.context.request
    if (!api)
      throw new Phase24ProofCheckpointError('authenticated browser context request boundary is unavailable')
    const selection = await selectDashboardCandidate(session.dashboardPage, input, now)
    matrix = { ...matrix, checks: { ...matrix.checks, dashboardSession: 'passed' } }
    const task = await waitForFreshRepair(api, selection, input, dependencies)
    matrix = withTaskMatrix({ ...matrix, checks: { ...matrix.checks, runAllocation: 'passed' } }, task)
    if (!task.run)
      throw new Phase24ProofCheckpointError('fresh repair task has no run allocation')
    const tuple = tupleFromTask(task)
    if (!tuple)
      throw new Phase24ProofCheckpointError('fresh repair task has no completed provider tuple')
    if (task.run.status !== 'succeeded') {
      matrix = { ...matrix, outcome: 'failed', reason: `repair run ended with ${task.run.status}`, layers: { ...matrix.layers, playback: 'failed' } }
      return await finalizeMatrix(root, matrix)
    }
    if (providerStatusFor(task.run) !== 'passed' || receiptStatusFor(task.run, task.movie.id, task.sourceRevision) !== 'passed' || repairStatusFor(task.run, 'passed') !== 'passed' || sourceStatusFor(task) !== 'passed')
      throw new Phase24ProofCheckpointError('provider, receipt, repair and source readback did not converge')

    const viewerPage = await session.context.newPage()
    const observation = await observeViewer(viewerPage, tuple, selection, task.sourceRevision, input, now)
    matrix = { ...matrix, checks: { ...matrix.checks, viewer: observation.outcome === 'checkpoint' ? 'checkpoint' : 'passed' }, sourceAttempts: observation.sourceAttempts, viewerPath: observation.viewerPath, layers: { ...matrix.layers, playback: observation.outcome === 'accepted' ? 'passed' : observation.outcome === 'failed' ? 'failed' : 'checkpoint' } }
    const evidenceInput = terminalEvidenceInput(input, target, task, tuple, observation, Math.floor(now() / 1000))
    const writer = dependencies.writeEvidence ?? writePhase24EvidencePair
    const pair = await writer(evidenceInput, input.evidenceRoot)
    matrix = matrixWithEvidence(matrix, pair)
    if ('outcome' in pair)
      throw new Phase24ProofCheckpointError(`evidence artifact pair write failed: ${pair.reason}`)
    matrix = { ...matrix, checks: { ...matrix.checks, artifact: 'passed' } }
    const submitted = await submitEvidence(api, tuple, pair.request)
    if (submitted.status < 200 || submitted.status >= 300)
      throw new Phase24ProofCheckpointError(`playback evidence submission returned HTTP ${submitted.status}`)
    const kind = responseKind(submitted.body)
    const responseArtifactValue = responseArtifact(submitted.body)
    if (responseArtifactValue && responseArtifactValue.hash !== pair.artifact.hash)
      throw new Phase24ProofCheckpointError('server playback evidence artifact hash differs from local pair')
    if (kind !== 'accepted') {
      matrix = { ...matrix, outcome: observation.outcome === 'failed' ? 'failed' : 'checkpoint', reason: `playback evidence endpoint returned ${kind ?? 'unknown'}` }
      return await finalizeMatrix(root, matrix)
    }
    const persisted = await getTaskDetail(api, tuple.taskId)
    const persistedSummary = summaryFromDetail(persisted)
    if (!persistedSummary || canonicalJson(JSON.parse(await readFile(pair.jsonPath, 'utf8')) as unknown) !== canonicalJson(persistedSummary))
      throw new Phase24ProofCheckpointError('D1 playback summary does not equal the canonical JSON artifact')
    matrix = { ...matrix, checks: { ...matrix.checks, d1: 'passed' } }
    const dashboardTrace = await readDashboardTrace(session.dashboardPage, tuple.taskId, input, persistedSummary)
    void dashboardTrace
    matrix = { ...matrix, checks: { ...matrix.checks, dashboardTrace: 'passed' }, outcome: 'passed', layers: { ...matrix.layers, playback: 'passed' } }
    return await finalizeMatrix(root, matrix)
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    matrix = { ...matrix, outcome: error instanceof Phase24ProofCheckpointError ? 'checkpoint' : 'checkpoint', reason }
    return await finalizeMatrix(root, matrix)
  }
  finally {
    await session?.close?.()
  }
}

export interface Phase24CliOptions extends Phase24ProofInput {
  readonly help: boolean
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  const value = index >= 0 ? argv[index + 1] : undefined
  return value && !value.startsWith('--') ? value : undefined
}

export function parsePhase24CliArgs(argv: readonly string[]): Phase24CliOptions {
  if (argv.includes('--help'))
    return { evidenceRoot: '', help: true, movieCode: '', target: '' }
  const target = flagValue(argv, '--target')
  const movieCode = flagValue(argv, '--movie-code')
  const evidenceRoot = flagValue(argv, '--evidence-dir')
  if (!target || !movieCode || !evidenceRoot)
    throw new Error('Usage: tsx scripts/phase24-production-proof.ts --target TARGET --movie-code MOVIE_CODE --evidence-dir ABSOLUTE_DIR [--cdp-url URL | --browser-profile DIR]')
  const timeoutText = flagValue(argv, '--timeout-ms')
  const pollText = flagValue(argv, '--poll-ms')
  const timeoutMs = timeoutText ? Number(timeoutText) : undefined
  const pollIntervalMs = pollText ? Number(pollText) : undefined
  if (timeoutMs !== undefined && (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000))
    throw new Error('--timeout-ms must be a bounded integer >= 1000')
  if (pollIntervalMs !== undefined && (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 50))
    throw new Error('--poll-ms must be a bounded integer >= 50')
  return {
    browserProfile: flagValue(argv, '--browser-profile'),
    cdpUrl: flagValue(argv, '--cdp-url'),
    evidenceRoot,
    help: false,
    movieCode,
    pollIntervalMs,
    target,
    timeoutMs,
  }
}

export function phase24CliHelp(): string {
  return [
    'Phase 24 fresh production proof:',
    '  tsx scripts/phase24-production-proof.ts --target TARGET --movie-code MOVIE_CODE --evidence-dir ABSOLUTE_DIR [--cdp-url URL | --browser-profile DIR]',
    '  --cdp-url attaches to an existing browser context with its signed Dashboard session.',
    '  --browser-profile launches a visible persistent Playwright profile that must already be signed in.',
    '  The verifier only treats http://localhost:8080 as the canonical Gateway route.',
  ].join('\n')
}

async function main(): Promise<void> {
  const options = parsePhase24CliArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(`${phase24CliHelp()}\n`)
    return
  }
  const matrix = await runPhase24ProductionProof(options)
  process.stdout.write(`${JSON.stringify(matrix)}\n`)
  process.exitCode = matrix.outcome === 'passed' ? 0 : matrix.outcome === 'failed' ? 1 : 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  })
}
