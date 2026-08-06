import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { LocalTaskRunner } from '../packages/crawler/src/task-runner/local-runner'
import { createRepairPlayersAdapter } from '../packages/crawler/src/task-runner/repair-adapter'
import { RunnerClient } from '../packages/crawler/src/task-runner/runner-client'
import { writePhase19EvidencePair } from './phase19-evidence'

const LOCAL_GATEWAY_ORIGIN = 'http://localhost:8080'

type TemplateKey = 'manga' | 'movie'
type RunStatus = 'cancelled' | 'cancel_requested' | 'dispatching' | 'failed' | 'queued' | 'running' | 'succeeded'

interface LocalRunnerConfig {
  readonly apiBaseUrl: string
  readonly callbackKeyId: string
  readonly callbackSecret: string
  readonly crawler: { readonly manga: object, readonly movie: object }
}

interface LocalTaskRunnerE2eConfig {
  readonly runnerConfigPath: string
  readonly sessionConfigPath: string
  readonly evidencePath?: string
  readonly evidenceDir?: string
  readonly repairPlayers?: Partial<RepairPlayersFixture>
  readonly receiptFixtures?: Partial<Record<TemplateKey, { readonly contentId: string }>>
}

interface RepairSourceFixture {
  readonly health?: 'inactive' | 'unverified' | 'failed'
  readonly isActive?: boolean
  readonly quality?: string
  readonly reasonCode?: 'source_inactive' | 'source_unverified' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'
  readonly sortOrder?: number
  readonly sourceName: string
  readonly sourceType: 'direct' | 'magnet' | 'TorrServer'
  readonly sourceUrl: string
}

interface RepairPlayersFixture {
  readonly movieCode: string
  readonly sources: readonly RepairSourceFixture[]
}

interface CliOptions {
  readonly evidenceDir?: string
  readonly templates: readonly TemplateKey[]
}

interface SessionConfig {
  readonly cookieHeader: string
}

interface Receipt {
  readonly createdCount: number
  readonly primaryContentId: string
  readonly templateKey: TemplateKey
  readonly updatedCount: number
}

interface Run {
  readonly failureCode: string | null
  readonly id: string
  readonly receipt: Receipt | null
  readonly status: RunStatus
}

interface TaskDetail {
  readonly runs: readonly (Omit<Run, 'failureCode'> & { readonly failureCode?: string | null })[]
  readonly task: { readonly id: string, readonly templateKey: TemplateKey }
}

interface RepairSourceHealth {
  readonly eligible: boolean
  readonly health: 'inactive' | 'unverified' | 'failed'
  readonly observedAt: number
  readonly reasonCode: 'source_inactive' | 'source_unverified' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'
  readonly sourceType: 'direct' | 'magnet' | 'TorrServer'
}

interface RepairObservationResponse {
  readonly accepted: boolean
  readonly errorCode?: 'source_stale' | 'source_read_failed' | 'source_write_failed'
  readonly outcome?: string
  readonly readback?: {
    readonly movieId: string
    readonly observedAt: number
    readonly sourceRevision: number
    readonly sources: readonly RepairSourceHealth[]
    readonly summary: { readonly eligibleCount: number, readonly sourceCount: number }
  } | null
  readonly receipt?: {
    readonly movieId: string
    readonly observedAt: number
    readonly operation: 'repair_players'
    readonly sourceRevision: number
    readonly sourceSummary: readonly RepairSourceHealth[]
  } | null
}

interface RepairRun {
  readonly attemptNumber: number
  readonly failureCode: string | null
  readonly id: string
  readonly receipt?: RepairObservationResponse['receipt']
  readonly sourceRevision?: number
  readonly status: RunStatus
}

interface RepairTask {
  readonly allowedNextAction: 'none' | 'wait_for_observation' | 'create_new_task'
  readonly id: string
  readonly movie: { readonly id: string, readonly title: string }
  readonly operation: 'repair_players'
  readonly reason: 'no_source' | 'source_failed'
  readonly sourceRevision: number
  readonly targetIntent: 'restore_playable_sources'
}

interface RepairTaskDetail {
  readonly run: RepairRun | null
  readonly runs: readonly RepairRun[]
  readonly task: RepairTask
}

interface MovieReadback {
  readonly data: {
    readonly players: readonly unknown[]
    readonly primaryContentId: string
    readonly readiness: {
      readonly source: {
        readonly disposition: 'ready' | 'no_source' | 'source_failed' | 'repairing'
        readonly eligibleCount: number
        readonly observedAt: number
        readonly reasonCode: string | null
        readonly repairable: boolean
        readonly sourceRevision: number
      }
    }
  }
  readonly success: boolean
}

interface RepairStageIdentity {
  readonly attempt: number
  readonly runId: string
  readonly taskId: string
}

interface RepairEvidence {
  readonly commandAccepted: RepairStageIdentity & {
    readonly movieId: string
    readonly reason: 'no_source' | 'source_failed'
    readonly sourceRevision: number
    readonly status: 'passed'
  }
  readonly duplicate: RepairStageIdentity & {
    readonly kind: 'existing_active_run'
    readonly status: 'passed'
  }
  readonly failure: RepairStageIdentity & {
    readonly allowedNextAction: 'create_new_task'
    readonly failureCode: 'receipt_missing'
    readonly reason: 'no_source'
    readonly repairable: true
    readonly status: 'bounded_failure'
  }
  readonly repairReceipt: RepairStageIdentity & {
    readonly movieId: string
    readonly observedAt: number
    readonly sourceRevision: number
    readonly sourceSummary: readonly RepairSourceHealth[]
    readonly status: 'passed'
  }
  readonly sourceObservation: RepairStageIdentity & {
    readonly movieId: string
    readonly observedAt: number
    readonly sourceRevision: number
    readonly status: 'passed'
  }
  readonly authoritativeReadback: RepairStageIdentity & {
    readonly eligibleCount: number
    readonly movieId: string
    readonly observedAt: number
    readonly sourceCount: number
    readonly sourceRevision: number
    readonly status: 'passed'
  }
  readonly sameMovieReadback: RepairStageIdentity & {
    readonly disposition: 'ready'
    readonly eligibleCount: number
    readonly movieId: string
    readonly observedAt: number
    readonly players: number
    readonly reasonCode: string | null
    readonly sourceRevision: number
    readonly status: 'passed'
  }
  readonly stale: {
    readonly allowedNextAction: 'none'
    readonly reason: 'source_disposition_stale'
    readonly repairable: false
    readonly status: 'bounded_rejection'
  }
  readonly terminalResult: RepairStageIdentity & {
    readonly allowedNextAction: 'none'
    readonly status: 'succeeded'
  }
}

interface E2eEvidence {
  readonly cancellation: { readonly runId: string, readonly status: 'cancelled' }
  readonly gatewayOrigin: typeof LOCAL_GATEWAY_ORIGIN
  readonly repair: RepairEvidence
  readonly runs: readonly {
    readonly createdCount: number
    readonly primaryContentId: string
    readonly runId: string
    readonly taskId: string
    readonly template: TemplateKey
    readonly updatedCount: number
    readonly receiptSource: 'local_fixture' | 'real_crawler'
    readonly realCrawl: {
      readonly failureCode: string | null
      readonly runId: string
      readonly status: RunStatus
    }
  }[]
  readonly target: 'local'
}

const DEFAULT_REPAIR_PLAYERS_FIXTURE: RepairPlayersFixture = {
  movieCode: 'SUN-064',
  sources: [
    { isActive: true, sourceName: 'phase-21-direct', sourceType: 'direct', sourceUrl: 'https://fixture.invalid/phase-21/direct' },
    { isActive: true, sourceName: 'phase-21-magnet', sourceType: 'magnet', sourceUrl: 'magnet:?xt=urn:btih:PHASE21FIXTURE' },
    { isActive: false, sourceName: 'phase-21-inactive', sourceType: 'TorrServer', sourceUrl: 'https://fixture.invalid/phase-21/inactive' },
  ],
}

function requireLocalUrl(value: string, name: string): void {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    throw new Error(`${name} must be a loopback HTTP URL.`)
  }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`${name} must remain local; remote execution is not supported.`)
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

function parseTarget(argv: readonly string[]): CliOptions {
  let evidenceDir: string | undefined
  const templates: TemplateKey[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--target' && argv[index + 1] === 'local') {
      index += 1
      continue
    }
    if (flag === '--template' && (argv[index + 1] === 'movie' || argv[index + 1] === 'manga')) {
      templates.push(argv[index + 1] as TemplateKey)
      index += 1
      continue
    }
    if (flag === '--evidence-dir' && argv[index + 1]) {
      evidenceDir = argv[index + 1]
      index += 1
      continue
    }
    throw new Error('Usage: pnpm local:task-runner:e2e --target local [--template movie] [--template manga] [--evidence-dir DIR]')
  }
  return { evidenceDir, templates: templates.length > 0 ? [...new Set(templates)] : ['movie', 'manga'] }
}

async function requestJson<T>(session: SessionConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${LOCAL_GATEWAY_ORIGIN}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      cookie: session.cookieHeader,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok)
    throw new Error(`Local Gateway request failed: ${response.status} ${path}`)
  return response.json() as Promise<T>
}

async function requestJsonResult<T>(session: SessionConfig, path: string, init: RequestInit = {}): Promise<{ readonly body: T, readonly status: number }> {
  const response = await fetch(`${LOCAL_GATEWAY_ORIGIN}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      cookie: session.cookieHeader,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const text = await response.text()
  let body: T
  try {
    body = JSON.parse(text) as T
  }
  catch {
    throw new Error(`Local Gateway returned non-JSON response: ${response.status} ${path}`)
  }
  return { body, status: response.status }
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new Error(message)
}

function repairFixture(config: LocalTaskRunnerE2eConfig): RepairPlayersFixture {
  const fixture = config.repairPlayers ?? {}
  return {
    movieCode: fixture.movieCode ?? DEFAULT_REPAIR_PLAYERS_FIXTURE.movieCode,
    sources: fixture.sources ?? DEFAULT_REPAIR_PLAYERS_FIXTURE.sources,
  }
}

function gatewayRunnerClient(config: LocalRunnerConfig, observation?: { value?: RepairObservationResponse }): RunnerClient {
  return new RunnerClient({
    ...config,
    apiBaseUrl: LOCAL_GATEWAY_ORIGIN,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init)
      if (String(input).includes('/source-observation')) {
        try {
          observation!.value = await response.clone().json() as RepairObservationResponse
        }
        catch {
          observation!.value = undefined
        }
      }
      return response
    },
  })
}

function stageIdentity(detail: RepairTaskDetail): RepairStageIdentity {
  const run = detail.run ?? detail.runs[0]
  assertCondition(run, 'Repair task detail did not include a run.')
  return { attempt: run.attemptNumber, runId: run.id, taskId: detail.task.id }
}

function boundedSources(sources: readonly RepairSourceHealth[]): readonly RepairSourceHealth[] {
  return sources.map(source => ({
    eligible: source.eligible,
    health: source.health,
    observedAt: source.observedAt,
    reasonCode: source.reasonCode,
    sourceType: source.sourceType,
  }))
}

function assertEvidenceRedacted(evidence: E2eEvidence): void {
  const serialized = JSON.stringify(evidence)
  for (const forbidden of ['cookieHeader', 'callbackSecret', 'sourceUrl', 'rawRunner', 'rawSource', 'signature', 'exception']) {
    assertCondition(!serialized.includes(forbidden), `Repair evidence contains forbidden field: ${forbidden}`)
  }
  assertCondition(!serialized.includes('fixture.invalid'), 'Repair evidence contains raw fixture URL material.')
  assertCondition(!serialized.includes('PHASE21FIXTURE'), 'Repair evidence contains raw fixture source material.')
}

async function createTask(session: SessionConfig, template: TemplateKey): Promise<{ taskId: string, runId: string }> {
  const created = await requestJson<{ run: Run }>(session, '/api/admin/crawler-tasks', {
    body: JSON.stringify({ template }),
    method: 'POST',
  })
  const tasks = await requestJson<{ tasks: { id: string, latestRunId: string | null }[] }>(session, `/api/admin/crawler-tasks?template=${template}&limit=50`)
  const task = tasks.tasks.find(item => item.latestRunId === created.run.id)
  if (!task)
    throw new Error(`Created ${template} run was not selected by the local task read model.`)
  return { runId: created.run.id, taskId: task.id }
}

async function readRun(session: SessionConfig, taskId: string, runId: string): Promise<Run> {
  const detail = await requestJson<TaskDetail>(session, `/api/admin/crawler-tasks/${encodeURIComponent(taskId)}`)
  const rawRun = detail.runs.find(item => item.id === runId)
  if (!rawRun)
    throw new Error('Run disappeared from the local task read model.')
  return { ...rawRun, failureCode: rawRun.failureCode ?? null }
}

async function cancelRun(session: SessionConfig, taskId: string, runId: string): Promise<void> {
  await requestJson(session, `/api/admin/crawler-tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
}

async function runTemplate(
  session: SessionConfig,
  config: LocalRunnerConfig,
  template: TemplateKey,
  receiptFixture: { readonly contentId: string } | undefined,
): Promise<E2eEvidence['runs'][number]> {
  const [{ createMangaAdapter }, { createMovieAdapter }, { createTemplateAdapterRegistry }] = await Promise.all([
    import('../packages/crawler/src/task-runner/manga-adapter'),
    import('../packages/crawler/src/task-runner/movie-adapter'),
    import('../packages/crawler/src/task-runner/template-adapters'),
  ])
  const created = await createTask(session, template)
  const client = gatewayRunnerClient(config)
  const adapters = createTemplateAdapterRegistry([
    createMovieAdapter(config.crawler.movie as never),
    createMangaAdapter(config.crawler.manga as never),
  ])
  await new LocalTaskRunner({ adapters, client }).runOnce()
  const realRun = await readRun(session, created.taskId, created.runId)
  if (realRun.status === 'succeeded' && realRun.receipt && realRun.receipt.templateKey === template) {
    return {
      createdCount: realRun.receipt.createdCount,
      primaryContentId: realRun.receipt.primaryContentId,
      receiptSource: 'real_crawler',
      realCrawl: { failureCode: realRun.failureCode, runId: realRun.id, status: realRun.status },
      runId: realRun.id,
      taskId: created.taskId,
      template,
      updatedCount: realRun.receipt.updatedCount,
    }
  }

  // D-07/D-12: a real crawler that synced no verifiable aggregate remains
  // receipt_missing; a separate ignored fixture adapter proves the success
  // receipt and CRUD handoff without weakening the API validation contract.
  if (realRun.status !== 'failed' || realRun.failureCode !== 'receipt_missing') {
    throw new Error(`${template} real crawler run ended as ${realRun.status}:${realRun.failureCode ?? 'none'}.`)
  }
  if (!receiptFixture || !/^[\w-]{1,128}$/.test(receiptFixture.contentId)) {
    throw new Error(`${template} receipt_missing requires an ignored receiptFixtures.${template}.contentId.`)
  }

  const fixtureCreated = await createTask(session, template)
  const fixtureClient = gatewayRunnerClient(config)
  const fixtureAdapters = createTemplateAdapterRegistry([
    createMovieAdapter(config.crawler.movie as never, async () => ({ contentIds: template === 'movie' ? [receiptFixture.contentId] : [] })),
    createMangaAdapter(config.crawler.manga as never, async () => ({ contentIds: template === 'manga' ? [receiptFixture.contentId] : [] })),
  ])
  await new LocalTaskRunner({ adapters: fixtureAdapters, client: fixtureClient }).runOnce()
  const fixtureRun = await readRun(session, fixtureCreated.taskId, fixtureCreated.runId)
  if (fixtureRun.status !== 'succeeded' || !fixtureRun.receipt || fixtureRun.receipt.templateKey !== template) {
    throw new Error(`${template} local fixture adapter did not produce a validated receipt.`)
  }
  return {
    createdCount: fixtureRun.receipt.createdCount,
    primaryContentId: fixtureRun.receipt.primaryContentId,
    receiptSource: 'local_fixture',
    realCrawl: { failureCode: realRun.failureCode, runId: realRun.id, status: realRun.status },
    runId: fixtureRun.id,
    taskId: fixtureCreated.taskId,
    template,
    updatedCount: fixtureRun.receipt.updatedCount,
  }
}

async function readMovie(session: SessionConfig, movieCode: string): Promise<MovieReadback> {
  return requestJson<MovieReadback>(session, `/api/public/movies/${encodeURIComponent(movieCode)}`)
}

async function createRepairCommand(
  session: SessionConfig,
  movieId: string,
  reason: 'no_source' | 'source_failed',
): Promise<{ readonly kind: 'created' | 'existing_active_run', readonly run: RepairRun, readonly task: RepairTask }> {
  const response = await requestJson<{
    readonly kind: 'created' | 'existing_active_run'
    readonly run: RepairRun
    readonly task: RepairTask
  }>(session, '/api/admin/crawler-tasks/repair-players', {
    body: JSON.stringify({
      confirmed: true,
      movieId,
      reason,
      targetIntent: 'restore_playable_sources',
    }),
    method: 'POST',
  })
  assertCondition(response.task.operation === 'repair_players', 'Repair command did not return a repair_players task.')
  assertCondition(response.task.movie.id === movieId, 'Repair command movie identity changed at acceptance.')
  assertCondition(response.task.reason === reason, 'Repair command reason changed at acceptance.')
  assertCondition(response.task.targetIntent === 'restore_playable_sources', 'Repair command target intent was not server-owned.')
  assertCondition(response.run.attemptNumber === 1, 'Fresh repair command did not start at attempt 1.')
  return response
}

async function readRepairTask(session: SessionConfig, taskId: string): Promise<RepairTaskDetail> {
  return requestJson<RepairTaskDetail>(session, `/api/admin/crawler-tasks/${encodeURIComponent(taskId)}`)
}

async function driveRepairTask(
  session: SessionConfig,
  config: LocalRunnerConfig,
  taskId: string,
  sources: readonly RepairSourceFixture[],
  observation: { value?: RepairObservationResponse },
): Promise<RepairTaskDetail> {
  const [{ createMangaAdapter }, { createMovieAdapter }, { createTemplateAdapterRegistry }] = await Promise.all([
    import('../packages/crawler/src/task-runner/manga-adapter'),
    import('../packages/crawler/src/task-runner/movie-adapter'),
    import('../packages/crawler/src/task-runner/template-adapters'),
  ])
  const client = gatewayRunnerClient(config, observation)
  const adapters = createTemplateAdapterRegistry([
    createMovieAdapter(config.crawler.movie as never),
    createMangaAdapter(config.crawler.manga as never),
    createRepairPlayersAdapter({ sources }),
  ])
  const runner = new LocalTaskRunner({ adapters, client })
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const detail = await readRepairTask(session, taskId)
    const currentRun = detail.run ?? detail.runs[0]
    if (currentRun && (currentRun.status === 'failed' || currentRun.status === 'succeeded' || currentRun.status === 'cancelled'))
      return detail
    await runner.runOnce()
  }
  throw new Error(`Repair task ${taskId} did not reach a terminal state within the bounded local runner loop.`)
}

async function runRepairPlayersFlow(
  session: SessionConfig,
  config: LocalRunnerConfig,
  e2eConfig: LocalTaskRunnerE2eConfig,
): Promise<RepairEvidence> {
  const fixture = repairFixture(e2eConfig)
  const initial = await readMovie(session, fixture.movieCode)
  assertCondition(initial.success, 'Fresh SUN-064 Gateway fixture did not return success.')
  assertCondition(initial.data.players.length === 0, 'Fresh SUN-064 fixture must start with players=0.')
  assertCondition(initial.data.readiness.source.disposition === 'no_source', 'Fresh SUN-064 fixture must start as no_source.')
  assertCondition(initial.data.readiness.source.repairable === true, 'Fresh SUN-064 fixture must be repairable.')

  const failedCommand = await createRepairCommand(session, initial.data.primaryContentId, 'no_source')
  const failedObservation: { value?: RepairObservationResponse } = {}
  const failedDetail = await driveRepairTask(session, config, failedCommand.task.id, [], failedObservation)
  const failedRun = failedDetail.run ?? failedDetail.runs[0]
  assertCondition(failedRun, 'Empty-source repair fixture did not return a run.')
  assertCondition(failedRun.status === 'failed', 'Empty-source repair fixture did not reach failed terminal state.')
  assertCondition(failedRun.failureCode === 'receipt_missing', 'Empty-source repair failure was not bounded as receipt_missing.')
  assertCondition(failedDetail.task.reason === 'no_source', 'Empty-source repair did not retain its bounded reason.')
  assertCondition(failedDetail.task.allowedNextAction === 'create_new_task', 'Failed repair did not expose create_new_task.')
  assertCondition(failedDetail.task.sourceRevision === initial.data.readiness.source.sourceRevision, 'Failed repair changed source revision.')

  const acceptedCommand = await createRepairCommand(session, initial.data.primaryContentId, 'no_source')
  const duplicateCommand = await createRepairCommand(session, initial.data.primaryContentId, 'no_source')
  assertCondition(duplicateCommand.kind === 'existing_active_run', 'Duplicate repair command was not idempotent.')
  assertCondition(duplicateCommand.task.id === acceptedCommand.task.id, 'Duplicate repair command changed task identity.')
  assertCondition(duplicateCommand.run.id === acceptedCommand.run.id, 'Duplicate repair command changed run identity.')

  const observation: { value?: RepairObservationResponse } = {}
  const succeededDetail = await driveRepairTask(session, config, acceptedCommand.task.id, fixture.sources, observation)
  const succeededRun = succeededDetail.run ?? succeededDetail.runs[0]
  assertCondition(succeededRun, 'Repair fixture did not return a run.')
  assertCondition(succeededRun.status === 'succeeded', 'Repair fixture did not reach succeeded terminal state.')
  assertCondition(succeededDetail.task.allowedNextAction === 'none', 'Succeeded repair did not terminate with no next action.')
  assertCondition(succeededRun.receipt?.operation === 'repair_players', 'Repair terminal result did not contain a dedicated receipt.')
  assertCondition(observation.value?.accepted === true, 'Source observation was not accepted.')
  assertCondition(observation.value?.outcome === 'accepted', 'Source observation outcome was not accepted.')
  assertCondition(observation.value.readback, 'Source observation did not return authoritative readback.')
  assertCondition(observation.value.receipt, 'Source observation did not return a dedicated repair receipt.')

  const observed = observation.value
  const readback = observed.readback
  const receipt = succeededRun.receipt
  assertCondition(observed && readback && observed.receipt && receipt, 'Repair evidence response was incomplete.')
  assertCondition(readback.movieId === initial.data.primaryContentId, 'Observation readback movie identity changed.')
  assertCondition(readback.sourceRevision === initial.data.readiness.source.sourceRevision + 1, 'Observation did not advance source revision exactly once.')
  assertCondition(observed.receipt.movieId === readback.movieId, 'Observation receipt identity did not match readback.')
  assertCondition(observed.receipt.sourceRevision === readback.sourceRevision, 'Observation receipt revision did not match readback.')
  assertCondition(readback.sources.length === fixture.sources.length, 'Authoritative readback source count changed from fixture.')
  assertCondition(readback.summary.sourceCount === readback.sources.length, 'Authoritative readback source summary count mismatched rows.')
  assertCondition(readback.summary.eligibleCount === readback.sources.filter(source => source.eligible).length, 'Authoritative readback eligible count mismatched rows.')
  assertCondition(readback.sources.some(source => source.sourceType === 'TorrServer' && source.health === 'inactive' && source.eligible === false), 'Inactive source eligibility semantics were not preserved.')
  assertCondition(receipt.movieId === readback.movieId && receipt.sourceRevision === readback.sourceRevision && receipt.observedAt === readback.observedAt, 'Dedicated repair receipt did not match authoritative readback.')

  const movie = await readMovie(session, fixture.movieCode)
  assertCondition(movie.success, 'Same-movie Gateway readback did not return success.')
  assertCondition(movie.data.primaryContentId === initial.data.primaryContentId, 'Same-movie Gateway readback changed movie identity.')
  assertCondition(movie.data.players.length === fixture.sources.length, 'Same-movie Gateway readback did not persist fixture source rows.')
  assertCondition(movie.data.readiness.source.sourceRevision === readback.sourceRevision, 'Same-movie source revision did not match observation readback.')
  assertCondition(movie.data.readiness.source.observedAt === readback.observedAt, 'Same-movie observedAt did not match observation readback.')
  assertCondition(movie.data.readiness.source.eligibleCount === readback.summary.eligibleCount, 'Same-movie eligible count did not match observation readback.')
  assertCondition(movie.data.readiness.source.disposition === 'ready', 'Same-movie source readiness did not become ready.')

  const stale = await requestJsonResult<{ readonly message?: string }>(session, '/api/admin/crawler-tasks/repair-players', {
    body: JSON.stringify({
      confirmed: true,
      movieId: initial.data.primaryContentId,
      reason: 'no_source',
      targetIntent: 'restore_playable_sources',
    }),
    method: 'POST',
  })
  assertCondition(stale.status === 409, 'Stale repair command was not rejected with 409.')

  const failureIdentity = stageIdentity(failedDetail)
  const acceptedIdentity = stageIdentity(succeededDetail)
  const evidence: RepairEvidence = {
    authoritativeReadback: {
      ...acceptedIdentity,
      eligibleCount: readback.summary.eligibleCount,
      movieId: readback.movieId,
      observedAt: readback.observedAt,
      sourceCount: readback.summary.sourceCount,
      sourceRevision: readback.sourceRevision,
      status: 'passed',
    },
    commandAccepted: {
      ...acceptedIdentity,
      movieId: initial.data.primaryContentId,
      reason: acceptedCommand.task.reason,
      sourceRevision: acceptedCommand.task.sourceRevision,
      status: 'passed',
    },
    duplicate: {
      ...acceptedIdentity,
      kind: duplicateCommand.kind,
      status: 'passed',
    },
    failure: {
      ...failureIdentity,
      allowedNextAction: failedDetail.task.allowedNextAction,
      failureCode: failedRun.failureCode as 'receipt_missing',
      reason: failedDetail.task.reason,
      repairable: true,
      status: 'bounded_failure',
    },
    repairReceipt: {
      ...acceptedIdentity,
      movieId: receipt.movieId,
      observedAt: receipt.observedAt,
      sourceRevision: receipt.sourceRevision,
      sourceSummary: boundedSources(receipt.sourceSummary),
      status: 'passed',
    },
    sameMovieReadback: {
      ...acceptedIdentity,
      disposition: movie.data.readiness.source.disposition,
      eligibleCount: movie.data.readiness.source.eligibleCount,
      movieId: movie.data.primaryContentId,
      observedAt: movie.data.readiness.source.observedAt,
      players: movie.data.players.length,
      reasonCode: movie.data.readiness.source.reasonCode,
      sourceRevision: movie.data.readiness.source.sourceRevision,
      status: 'passed',
    },
    sourceObservation: {
      ...acceptedIdentity,
      movieId: readback.movieId,
      observedAt: readback.observedAt,
      sourceRevision: readback.sourceRevision,
      status: 'passed',
    },
    stale: {
      allowedNextAction: 'none',
      reason: 'source_disposition_stale',
      repairable: false,
      status: 'bounded_rejection',
    },
    terminalResult: {
      ...acceptedIdentity,
      allowedNextAction: succeededDetail.task.allowedNextAction,
      status: 'succeeded',
    },
  }
  assertEvidenceRedacted({ cancellation: { runId: 'redacted', status: 'cancelled' }, gatewayOrigin: LOCAL_GATEWAY_ORIGIN, repair: evidence, runs: [], target: 'local' })
  return evidence
}

async function runControlledCancellation(session: SessionConfig, config: LocalRunnerConfig): Promise<E2eEvidence['cancellation']> {
  const created = await createTask(session, 'movie')
  const client = gatewayRunnerClient(config)
  const adapters = {
    select: () => ({
      templateKey: 'movie' as const,
      execute: async (context: { checkpoint: () => Promise<boolean> }) => {
        await cancelRun(session, created.taskId, created.runId)
        if (!await context.checkpoint())
          throw new Error('Controlled cancellation was not acknowledged by the runner heartbeat.')
        return { contentIds: [] }
      },
    }),
  }
  await new LocalTaskRunner({ adapters, client }).runOnce()
  const run = await readRun(session, created.taskId, created.runId)
  if (run.status !== 'cancelled')
    throw new Error('Controlled local cancellation did not reach the cancelled terminal state.')
  return { runId: run.id, status: 'cancelled' }
}

export async function runLocalTaskRunnerE2e(argv: readonly string[] = process.argv.slice(2)): Promise<E2eEvidence> {
  const cli = parseTarget(argv)
  const configPath = process.env.TASK_RUNNER_E2E_CONFIG
  if (!configPath)
    throw new Error('TASK_RUNNER_E2E_CONFIG must point to an ignored local E2E config file.')
  const e2e = await readJson<LocalTaskRunnerE2eConfig>(configPath)
  const [runner, session] = await Promise.all([
    readJson<LocalRunnerConfig>(e2e.runnerConfigPath),
    readJson<SessionConfig>(e2e.sessionConfigPath),
  ])
  requireLocalUrl(runner.apiBaseUrl, 'runner apiBaseUrl')
  if (!session.cookieHeader.trim())
    throw new Error('The local E2E session config must contain a session cookie header.')

  const repair = await runRepairPlayersFlow(session, runner, e2e)
  const runs = []
  for (const template of cli.templates) {
    runs.push(await runTemplate(session, runner, template, e2e.receiptFixtures?.[template]))
  }
  const cancellation = await runControlledCancellation(session, runner)
  const evidence: E2eEvidence = { cancellation, gatewayOrigin: LOCAL_GATEWAY_ORIGIN, repair, runs, target: 'local' }
  assertEvidenceRedacted(evidence)
  if (e2e.evidencePath)
    await writeFile(e2e.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  const evidenceDir = cli.evidenceDir ?? e2e.evidenceDir
  if (evidenceDir) {
    await mkdir(evidenceDir, { recursive: true })
    const timestamp = new Date().toISOString()
    for (const run of runs) {
      await writePhase19EvidencePair({
        mode: 'local_contract',
        status: 'passed',
        target: 'local-gateway',
        template: run.template,
        workflow: 'local-contract',
        repository: 'local-contract',
        ref: 'fixture',
        environment: 'local',
        taskId: run.taskId,
        runId: run.runId,
        attempt: 1,
        callbackEventIds: [],
        callbackNonces: [],
        validatedReceipt: {
          template: run.template,
          primaryContentId: run.primaryContentId,
          createdCount: run.createdCount,
          updatedCount: run.updatedCount,
        },
        gatewayUrl: LOCAL_GATEWAY_ORIGIN,
        crud: { mutation: 'passed', readback: 'passed', restore: 'passed' },
        command: 'phase19-local-proof',
        timestamp,
      }, evidenceDir)
    }
    await writePhase19EvidencePair({
      mode: 'local_contract',
      status: 'checkpoint',
      target: 'local-gateway',
      template: 'movie',
      workflow: 'local-contract',
      repository: 'local-contract',
      ref: 'fixture',
      environment: 'local',
      taskId: `cancelled-${cancellation.runId}`,
      runId: cancellation.runId,
      attempt: 1,
      callbackEventIds: [],
      callbackNonces: [],
      gatewayUrl: LOCAL_GATEWAY_ORIGIN,
      crud: { mutation: 'checkpoint', readback: 'checkpoint', restore: 'checkpoint' },
      command: 'phase19-local-proof',
      timestamp,
    }, evidenceDir)
  }
  return evidence
}

if (process.argv.includes('--help')) {
  console.log('Usage: pnpm local:task-runner:e2e --target local [--template movie] [--template manga] [--evidence-dir DIR]')
}
else {
  void runLocalTaskRunnerE2e().then((evidence) => {
    console.log(JSON.stringify(evidence))
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
