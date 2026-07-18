import type {
  DataChainCheckpoint,
  DataChainEvidence,
  DataChainMode,
  DataChainObservation,
  DataChainReceiptCapture,
  PreparedSmokeChildObservation,
  ProjectionValidationIssue,
} from '../packages/config/src/deployment-target/index'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  assertRemoteEligibility,
  buildLocalEnvProjectionPlan,
  buildTargetProjections,
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
  createDataChainExecutionReceipt,
  createPreIngestEvidence,
  createResolvedPendingEvidence,
  DATA_CHAIN_FIXTURE_COUNT,
  LOCAL_GATEWAY_ORIGIN,
  materializeTargetDeployConfig,
  parseAuditedPublicRuntimeInput,
  prepareTargetMutation,
  renderDataChainEvidenceMarkdown,
  resolveTargetProfile,
  runPreparedTargetMutation,
  runTargetPreflight,
  serializeDataChainEvidenceJson,
  validateDataChainEvidenceForExitCode,
  validateProjectedEnv,
} from '../packages/config/src/deployment-target/index'
import { createDataChainFixture, runDataChainFixture } from '../packages/crawler/src/smoke/data-chain-fixture'
import { ApiClient } from '../packages/crawler/src/utils/api-client'
import { packageManagerInvocation } from './package-manager-command.ts'

export const DATA_CHAIN_EVIDENCE_ROOT = path.resolve(import.meta.dirname, '../.planning/phases/13-full-chain-data-smoke/evidence')

export interface DataChainSmokeOptions {
  readonly mode: DataChainMode
  readonly target: string
  readonly runId: string
  readonly evidenceRoot: string
}

export interface DataChainSmokeCliOptions extends DataChainSmokeOptions {}

export interface LocalD1Inspection {
  readonly status: 'ready' | 'unready'
  readonly checkpoint?: Extract<DataChainCheckpoint, 'local_d1_readiness_unmet' | 'fixture_seed_incomplete'>
}

export interface LocalCommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface GatewayAuthResponse {
  readonly status: number
  readonly location?: string | null
}

export interface DataChainSmokeDependencies {
  readonly resolveTarget?: (target: string) => {
    id: string
    profile: {
      local?: { wranglerProfile: string }
      ci?: { githubEnvironment: string }
      urls?: { gateway: string }
    }
  }
  readonly collectProjectionIssues?: (target: string) => Promise<readonly ProjectionValidationIssue[]>
  readonly runPreflight?: (options: Parameters<typeof runTargetPreflight>[0]) => ReturnType<typeof runTargetPreflight>
  readonly inspectLocalD1?: (input: { targetId: string, runId: string, itemCode: string }) => Promise<LocalD1Inspection>
  readonly checkServices?: () => Promise<LocalCommandResult>
  readonly observeGatewayAuth?: () => Promise<GatewayAuthResponse>
  readonly runFixture?: (input: { targetId: string, runId: string, itemCode: string }) => Promise<{ itemCode: string, itemCount: typeof DATA_CHAIN_FIXTURE_COUNT }>
  readonly snapshot?: (input: { targetId: string, runId: string, itemCode: string }) => Promise<{ status: 'found' | 'not-found' | 'checkpoint', itemCode: string, itemId?: string, itemCount?: typeof DATA_CHAIN_FIXTURE_COUNT }>
  readonly fetchGatewayApi?: (input: { itemCode: string, itemId: string }) => Promise<{ status: number, itemCode?: string, itemId?: string, attempt?: number }>
  readonly read?: (file: string) => Promise<string | undefined>
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly executeReadOnly?: (argv: readonly string[]) => { exitCode: number, stdout?: string }
  readonly runPreparedFixture?: (input: { target: string, runId: string, executeReadOnly: (argv: readonly string[]) => { exitCode: number, stdout?: string } }) => Promise<Extract<PreparedSmokeChildObservation, { operation: 'crawler-smoke-fixture' }>>
  readonly runPreparedSnapshot?: (input: { target: string, runId: string, executeReadOnly: (argv: readonly string[]) => { exitCode: number, stdout?: string } }) => Promise<Extract<PreparedSmokeChildObservation, { operation: 'd1-smoke-snapshot' }>>
  readonly fetchCanonicalApi?: (input: { canonicalBase: string, path: string, itemCode: string, itemId: string }) => Promise<{ status: number, itemCode?: string, itemId?: string, attempt?: number }>
  readonly now?: () => string
  readonly write?: (file: string, contents: string) => Promise<void>
}

export interface DataChainSmokeResult {
  readonly exitCode: 0 | typeof CHECKPOINT_EXIT_CODE
  readonly evidence: DataChainEvidence
}

type RunnerReceiptSurface = Exclude<DataChainObservation['surface'], 'dashboard' | 'viewer'>

function createRunnerReceipt(input: {
  mode: DataChainMode
  targetId: string
  runId: string
  itemCode: string
  itemId: string
  surface: RunnerReceiptSurface
  timestamp: string
  path?: string
}) {
  const captureBySurface: Record<RunnerReceiptSurface, DataChainReceiptCapture | undefined> = {
    local_projection: input.mode === 'local' ? 'local_projection' : undefined,
    local_d1_readiness: input.mode === 'local' ? 'local_d1_readiness' : undefined,
    service_readiness: input.mode === 'local' ? 'service_probe' : undefined,
    gateway_auth: input.mode === 'local' ? 'gateway_auth' : undefined,
    remote_preflight: input.mode === 'remote' ? 'remote_preflight' : undefined,
    d1: input.mode === 'local' ? 'local_fixture_snapshot' : 'remote_fixture_snapshot',
    api: 'canonical_api',
  }
  const capture = captureBySurface[input.surface]
  if (!capture) {
    throw new Error(`Runner receipt surface ${input.surface} is invalid for ${input.mode} mode.`)
  }
  return createDataChainExecutionReceipt({
    source: input.mode === 'local' ? 'local_runner' : 'remote_provider',
    capture,
    mode: input.mode,
    targetId: input.targetId,
    runId: input.runId,
    itemCode: input.itemCode,
    itemId: input.itemId,
    surface: input.surface,
    ...(input.path ? { path: input.path } : {}),
    timestamp: input.timestamp,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRunId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function evidencePaths(options: Pick<DataChainSmokeOptions, 'mode' | 'target' | 'runId' | 'evidenceRoot'>): { json: string, markdown: string } {
  const directory = path.resolve(options.evidenceRoot, options.target, options.runId)
  return { json: path.join(directory, `${options.mode}.json`), markdown: path.join(directory, `${options.mode}.md`) }
}

export function getDataChainEvidencePaths(options: Pick<DataChainSmokeOptions, 'mode' | 'target' | 'runId' | 'evidenceRoot'>) {
  return evidencePaths(options)
}

function isFixedEvidenceRoot(value: string): boolean {
  return path.resolve(import.meta.dirname, '..', value) === DATA_CHAIN_EVIDENCE_ROOT
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`)
  }
  return value
}

export function parseDataChainSmokeArgs(argv: readonly string[], now: () => Date = () => new Date()): DataChainSmokeCliOptions {
  const values: Partial<Record<'mode' | 'target' | 'runId' | 'evidenceRoot', string>> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag !== '--mode' && flag !== '--target' && flag !== '--run-id' && flag !== '--evidence-dir') {
      throw new Error(`Unknown data-chain smoke argument: ${flag}.`)
    }
    const value = requireValue(argv, index, flag)
    index += 1
    const key = flag === '--evidence-dir' ? 'evidenceRoot' : flag.slice(2).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) as 'mode' | 'target' | 'runId'
    if (values[key] !== undefined) {
      throw new Error(`Duplicate data-chain smoke argument: ${flag}.`)
    }
    values[key] = value
  }
  if (values.mode !== 'local' && values.mode !== 'remote') {
    throw new Error('Data-chain smoke requires --mode local|remote.')
  }
  if (!isText(values.target)) {
    throw new Error('Data-chain smoke requires an explicit --target.')
  }
  const runId = values.runId ?? (values.mode === 'local' ? `local-${now().toISOString().replace(/[-:.]/g, '').toLowerCase()}` : undefined)
  if (!runId || !isRunId(runId)) {
    throw new Error('Data-chain smoke requires a validated --run-id; remote mode cannot generate one.')
  }
  const evidenceRoot = values.evidenceRoot ?? DATA_CHAIN_EVIDENCE_ROOT
  if (!isFixedEvidenceRoot(evidenceRoot)) {
    throw new Error('Data-chain smoke evidence directory must be the fixed Phase 13 evidence root.')
  }
  return { mode: values.mode, target: values.target, runId, evidenceRoot: DATA_CHAIN_EVIDENCE_ROOT }
}

function d1Rows(stdout: string): readonly Record<string, unknown>[] | undefined {
  try {
    const parsed = JSON.parse(stdout) as unknown
    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    for (const candidate of candidates) {
      if (isRecord(candidate) && Array.isArray(candidate.results) && candidate.results.every(isRecord)) {
        return candidate.results
      }
    }
  }
  catch {
    return undefined
  }
  return undefined
}

function snapshotRows(stdout: string): readonly Record<string, unknown>[] | undefined {
  try {
    const parsed = JSON.parse(stdout) as unknown
    const payloads = Array.isArray(parsed) ? parsed : [parsed]
    if (payloads.length !== 1) {
      return undefined
    }
    const payload = payloads[0]
    if (isRecord(payload) && Array.isArray(payload.results) && payload.results.every(isRecord)) {
      return payload.results
    }
  }
  catch {
    return undefined
  }
  return undefined
}

function executeLocalD1(configPath: string, command: string): LocalCommandResult {
  const invocation = packageManagerInvocation([
    'exec',
    'wrangler',
    'd1',
    'execute',
    'starye-db',
    '--local',
    '--config',
    configPath,
    '--command',
    command,
    '--json',
  ])
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: path.resolve(import.meta.dirname, '../apps/api'),
    encoding: 'utf8',
    shell: false,
  })
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const requiredMovieColumns = ['id', 'title', 'slug', 'code', 'is_r18', 'metadata_locked', 'view_count', 'crawl_status', 'total_players', 'crawled_players'] as const
const requiredPlayerColumns = ['id', 'movie_id', 'source_name', 'source_url', 'sort_order', 'is_active'] as const

function includesColumns(rows: readonly Record<string, unknown>[], columns: readonly string[]): boolean {
  const found = new Set(rows.map(row => row.name).filter(isText))
  return columns.every(column => found.has(column))
}

async function inspectLocalD1Default(input: { targetId: string, runId: string, itemCode: string }): Promise<LocalD1Inspection> {
  const root = path.resolve(import.meta.dirname, '..')
  let materialized: Awaited<ReturnType<typeof materializeTargetDeployConfig>>

  try {
    const resolution = resolveTargetProfile(input.targetId)
    materialized = await materializeTargetDeployConfig({
      deploy: buildTargetProjections(resolution).deploy,
      publicRuntimeInput: parseAuditedPublicRuntimeInput(resolution, { buildMode: 'local' }),
      runId: input.runId,
      appDirectories: {
        api: path.join(root, 'apps', 'api'),
        gateway: path.join(root, 'apps', 'gateway'),
      },
      runDirectory: path.join(root, '.target-runs'),
    })
  }
  catch {
    return { status: 'unready', checkpoint: 'local_d1_readiness_unmet' }
  }

  try {
    const tables = executeLocalD1(materialized.apiConfigPath, 'SELECT name FROM sqlite_master WHERE type=\'table\' AND name IN (\'movie\', \'player\') ORDER BY name;')
    const movieColumns = executeLocalD1(materialized.apiConfigPath, 'PRAGMA table_info(movie);')
    const playerColumns = executeLocalD1(materialized.apiConfigPath, 'PRAGMA table_info(player);')
    const movieIndexes = executeLocalD1(materialized.apiConfigPath, 'PRAGMA index_list(movie);')
    const escapedCode = input.itemCode.replaceAll('\'', '\'\'')
    const cardinality = executeLocalD1(materialized.apiConfigPath, `SELECT COUNT(DISTINCT movie.id) AS movieCount, COUNT(player.id) AS playerCount, MAX(movie.is_r18) AS isR18 FROM movie LEFT JOIN player ON player.movie_id = movie.id WHERE movie.code = '${escapedCode}';`)
    const all = [tables, movieColumns, playerColumns, movieIndexes, cardinality]
    if (all.some(result => result.exitCode !== 0)) {
      return { status: 'unready', checkpoint: 'local_d1_readiness_unmet' }
    }
    const tableRows = d1Rows(tables.stdout)
    const movieColumnRows = d1Rows(movieColumns.stdout)
    const playerColumnRows = d1Rows(playerColumns.stdout)
    const indexRows = d1Rows(movieIndexes.stdout)
    const cardinalityRows = d1Rows(cardinality.stdout)
    if (!tableRows || !movieColumnRows || !playerColumnRows || !indexRows || !cardinalityRows
      || !['movie', 'player'].every(table => tableRows.some(row => row.name === table))
      || !includesColumns(movieColumnRows, requiredMovieColumns)
      || !includesColumns(playerColumnRows, requiredPlayerColumns)
      || !indexRows.some(row => row.name === 'movie_code_unique')) {
      return { status: 'unready', checkpoint: 'local_d1_readiness_unmet' }
    }
    const row = cardinalityRows[0]
    const movieCount = Number(row?.movieCount)
    const playerCount = Number(row?.playerCount)
    const isR18 = Number(row?.isR18 ?? 0)
    if ((movieCount === 0 && playerCount === 0) || (movieCount === 1 && playerCount === 1 && isR18 === 0)) {
      return { status: 'ready' }
    }
    return { status: 'unready', checkpoint: 'fixture_seed_incomplete' }
  }
  finally {
    await materialized.cleanup()
  }
}

async function collectProjectionIssuesDefault(target: string): Promise<readonly ProjectionValidationIssue[]> {
  const plan = buildLocalEnvProjectionPlan(resolveTargetProfile(target))
  const contents: Partial<Record<ProjectionValidationIssue extends { file: infer File } ? File : never, string>> = {}
  for (const entry of plan.entries) {
    try {
      contents[entry.file] = await readFile(path.resolve(import.meta.dirname, '..', entry.file), 'utf8')
    }
    catch {
      return [{ kind: 'missing-projection-file', file: entry.file }]
    }
  }
  return validateProjectedEnv(plan, contents)
}

async function checkServicesDefault(): Promise<LocalCommandResult> {
  const invocation = packageManagerInvocation(['check:services'])
  const result = spawnSync(invocation.command, invocation.args, { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', shell: false })
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

async function observeGatewayAuthDefault(): Promise<GatewayAuthResponse> {
  const response = await fetch(`${LOCAL_GATEWAY_ORIGIN}/auth/`, { redirect: 'manual' })
  return { status: response.status, location: response.headers.get('location') }
}

function validGatewayAuth(response: GatewayAuthResponse): boolean {
  if (response.status >= 200 && response.status < 300) {
    return true
  }
  if (![301, 302, 303, 307, 308].includes(response.status) || !response.location) {
    return false
  }
  try {
    const location = new URL(response.location, LOCAL_GATEWAY_ORIGIN)
    return location.origin === LOCAL_GATEWAY_ORIGIN && location.pathname.startsWith('/auth/')
  }
  catch {
    return false
  }
}

async function runFixtureDefault(input: { targetId: string, runId: string, itemCode: string }): Promise<{ itemCode: string }> {
  const secret = await readLocalCrawlerSecret()
  if (!secret) {
    throw new Error('Local crawler service secret is unavailable.')
  }
  const fixture = createDataChainFixture({ targetId: input.targetId, runId: input.runId })
  if (fixture.code !== input.itemCode) {
    throw new Error('Local fixture tuple is invalid.')
  }
  return runDataChainFixture({
    targetId: input.targetId,
    runId: input.runId,
    apiClient: new ApiClient({ url: LOCAL_GATEWAY_ORIGIN, token: secret, timeout: 60000 }),
  })
}

async function readLocalCrawlerSecret(): Promise<string | undefined> {
  if (process.env.CRAWLER_SECRET?.trim()) {
    return process.env.CRAWLER_SECRET.trim()
  }
  try {
    const contents = await readFile(path.resolve(import.meta.dirname, '../packages/crawler/.env'), 'utf8')
    const value = contents.match(/^[ \t]*(?:export[ \t]+)?CRAWLER_SECRET[ \t]*=(.*)$/m)?.[1]
    if (!value) {
      return undefined
    }
    const trimmed = value.trim()
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
      return trimmed.slice(1, -1)
    }
    return trimmed
  }
  catch {
    return undefined
  }
}

async function snapshotDefault(input: { targetId: string, runId: string, itemCode: string }): Promise<{ status: 'found' | 'not-found' | 'checkpoint', itemCode: string, itemId?: string, itemCount?: typeof DATA_CHAIN_FIXTURE_COUNT }> {
  const root = path.resolve(import.meta.dirname, '..')
  let materialized: Awaited<ReturnType<typeof materializeTargetDeployConfig>>

  try {
    const resolution = resolveTargetProfile(input.targetId)
    materialized = await materializeTargetDeployConfig({
      deploy: buildTargetProjections(resolution).deploy,
      publicRuntimeInput: parseAuditedPublicRuntimeInput(resolution, { buildMode: 'local' }),
      runId: input.runId,
      appDirectories: {
        api: path.join(root, 'apps', 'api'),
        gateway: path.join(root, 'apps', 'gateway'),
      },
      runDirectory: path.join(root, '.target-runs'),
    })
  }
  catch {
    return { status: 'checkpoint', itemCode: input.itemCode }
  }

  try {
    const escapedCode = input.itemCode.replaceAll('\'', '\'\'')
    const result = executeLocalD1(materialized.apiConfigPath, [
      'SELECT movie.id AS id, movie.code AS code, movie.is_r18 AS isR18, COUNT(player.id) AS playerCount',
      'FROM movie',
      'LEFT JOIN player ON player.movie_id = movie.id AND player.is_active = 1',
      `WHERE movie.code = '${escapedCode}'`,
      'GROUP BY movie.id, movie.code, movie.is_r18',
      'LIMIT 2',
    ].join(' '))
    const rows = result.exitCode === 0 ? snapshotRows(result.stdout) : undefined
    if (!rows) {
      return { status: 'checkpoint', itemCode: input.itemCode }
    }
    if (rows.length === 0) {
      return { status: 'not-found', itemCode: input.itemCode }
    }
    const primary = rows[0]
    if (rows.length !== DATA_CHAIN_FIXTURE_COUNT
      || primary?.code !== input.itemCode
      || Number(primary.isR18) !== 0
      || Number(primary.playerCount) !== 1
      || !isText(primary.id)) {
      return { status: 'checkpoint', itemCode: input.itemCode }
    }
    return { status: 'found', itemCode: input.itemCode, itemId: primary.id, itemCount: DATA_CHAIN_FIXTURE_COUNT }
  }
  finally {
    await materialized.cleanup()
  }
}

async function fetchGatewayApiDefault(input: { itemCode: string, itemId: string }): Promise<{ status: number, itemCode?: string, itemId?: string, attempt?: number }> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${LOCAL_GATEWAY_ORIGIN}/api/public/movies/${encodeURIComponent(input.itemCode)}`)
      const body = await response.json().catch(() => undefined) as unknown
      const data = isRecord(body) && isRecord(body.data) ? body.data : undefined
      const result = { status: response.status, attempt, ...(isText(data?.code) ? { itemCode: data.code } : {}), ...(isText(data?.id) ? { itemId: data.id } : {}) }
      if (response.ok && result.itemCode === input.itemCode && result.itemId === input.itemId) {
        return result
      }
      if (attempt === 3) {
        return result
      }
    }
    catch {
      if (attempt === 3) {
        return { status: 502, attempt }
      }
    }
  }
  return { status: 502, attempt: 3 }
}

async function writeEvidencePair(options: DataChainSmokeOptions, evidence: DataChainEvidence, write: (file: string, contents: string) => Promise<void>): Promise<void> {
  const paths = evidencePaths(options)
  await write(paths.json, serializeDataChainEvidenceJson(evidence))
  await write(paths.markdown, renderDataChainEvidenceMarkdown(evidence))
}

async function writeDefault(file: string, contents: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, contents, 'utf8')
}

async function preIngestCheckpoint(
  options: DataChainSmokeOptions,
  candidateItemCode: string,
  observation: DataChainObservation,
  now: () => string,
  write: (file: string, contents: string) => Promise<void>,
): Promise<DataChainSmokeResult> {
  const evidence = createPreIngestEvidence({
    targetId: options.target,
    runId: options.runId,
    candidateItemCode,
    mode: options.mode,
    timestamp: now(),
    observation,
  })
  await writeEvidencePair(options, evidence, write)
  return { exitCode: CHECKPOINT_EXIT_CODE, evidence }
}

async function readEvidenceDefault(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8')
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

async function loadExactEvidencePair(
  options: DataChainSmokeOptions,
  mode: DataChainMode,
  read: (file: string) => Promise<string | undefined>,
): Promise<DataChainEvidence> {
  const paths = evidencePaths({ ...options, mode })
  const [json, markdown] = await Promise.all([read(paths.json), read(paths.markdown)])
  if (!json || !markdown) {
    throw new Error('Data-chain evidence pair is missing.')
  }
  let evidence: unknown
  try {
    evidence = JSON.parse(json)
  }
  catch {
    throw new Error('Data-chain evidence JSON is malformed.')
  }
  validateDataChainEvidenceForExitCode(evidence)
  const typed = evidence as DataChainEvidence
  if (typed.mode !== mode || typed.targetId !== options.target || typed.runId !== options.runId) {
    throw new Error('Data-chain evidence tuple does not match runner arguments.')
  }
  if (markdown !== renderDataChainEvidenceMarkdown(typed)) {
    throw new Error('Data-chain evidence Markdown does not match JSON.')
  }
  return typed
}

function hasPassedSurface(evidence: DataChainEvidence, surface: DataChainObservation['surface']): boolean {
  return evidence.observations.some(row => row.surface === surface && row.status === 'passed')
}

function assertRemoteLocalPrerequisite(
  evidence: DataChainEvidence,
  input: { targetId: string, runId: string, itemCode: string },
): void {
  if (evidence.itemCode !== input.itemCode || evidence.itemId === null) {
    throw new Error('Remote execution requires the deterministic local evidence tuple.')
  }
  assertRemoteEligibility(evidence, {
    targetId: input.targetId,
    runId: input.runId,
    itemCode: evidence.itemCode,
    itemId: evidence.itemId,
  })
  const requiredSurfaces: readonly DataChainObservation['surface'][] = [
    'local_projection',
    'local_d1_readiness',
    'service_readiness',
    'gateway_auth',
    'd1',
    'api',
    'dashboard',
    'viewer',
  ]
  if (!requiredSurfaces.every(surface => hasPassedSurface(evidence, surface))) {
    throw new Error('Remote execution requires every terminal local surface to pass.')
  }
}

function executeRemoteReadOnlyDefault(argv: readonly string[]): { exitCode: number, stdout?: string } {
  const invocation = packageManagerInvocation(['exec', 'wrangler', ...argv])
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: path.resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    shell: false,
    env: {
      PATH: process.env.PATH,
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    },
  })
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? '' }
}

export function executePreparedRemoteCommand(
  command: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  workingDirectory = path.join(path.resolve(import.meta.dirname, '..'), 'packages/crawler'),
): { exitCode: number, stdout: string, stderr: string } {
  const invocation = command === 'pnpm'
    ? packageManagerInvocation(args)
    : { command, args }
  const child = spawnSync(invocation.command, invocation.args, {
    cwd: workingDirectory,
    encoding: 'utf8',
    shell: false,
    env: environment,
  })
  return { exitCode: child.status ?? 1, stdout: child.stdout ?? '', stderr: child.stderr ?? '' }
}

async function runPreparedRemoteEntry(
  input: {
    target: string
    runId: string
    ciEnvironment: string
    entry: 'crawler-smoke-fixture' | 'd1-smoke-snapshot'
    executeReadOnly: (argv: readonly string[]) => { exitCode: number, stdout?: string }
    environment: Readonly<Record<string, string | undefined>>
  },
): Promise<PreparedSmokeChildObservation> {
  const root = path.resolve(import.meta.dirname, '..')
  const prepared = await prepareTargetMutation({
    target: input.target,
    scope: 'remote',
    command: input.entry,
    ciEnvironment: input.ciEnvironment,
    environment: input.environment,
    runId: input.runId,
    appDirectories: { api: path.join(root, 'apps/api'), gateway: path.join(root, 'apps/gateway') },
    runDirectory: path.join(root, '.target-runs'),
  }, {
    executeReadOnly: input.executeReadOnly,
  })
  try {
    const result = await runPreparedTargetMutation({
      entry: input.entry,
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment: input.environment,
      execute: executePreparedRemoteCommand,
    })
    if (!result.observation) {
      throw new Error('Prepared smoke entry did not return an observation.')
    }
    return result.observation
  }
  finally {
    await prepared.cleanup()
  }
}

async function fetchCanonicalApiDefault(input: { canonicalBase: string, path: string, itemCode: string, itemId: string }): Promise<{ status: number, itemCode?: string, itemId?: string, attempt?: number }> {
  let endpoint: URL
  try {
    const canonical = new URL(input.canonicalBase)
    endpoint = new URL(input.path, canonical)
    if (canonical.protocol !== 'https:' || canonical.port || endpoint.origin !== canonical.origin || endpoint.port || endpoint.pathname !== input.path) {
      return { status: 502, attempt: 1 }
    }
  }
  catch {
    return { status: 502, attempt: 1 }
  }
  try {
    const response = await fetch(endpoint)
    const body = await response.json().catch(() => undefined) as unknown
    const data = isRecord(body) && isRecord(body.data) ? body.data : undefined
    return {
      status: response.status,
      attempt: 1,
      ...(isText(data?.code) ? { itemCode: data.code } : {}),
      ...(isText(data?.id) ? { itemId: data.id } : {}),
    }
  }
  catch {
    return { status: 502, attempt: 1 }
  }
}

async function runRemoteDataChainSmoke(options: DataChainSmokeOptions, dependencies: DataChainSmokeDependencies): Promise<DataChainSmokeResult> {
  const now = dependencies.now ?? (() => new Date().toISOString())
  const write = dependencies.write ?? writeDefault
  const resolve = dependencies.resolveTarget ?? resolveTargetProfile
  let resolution: ReturnType<typeof resolveTargetProfile>
  try {
    resolution = resolve(options.target) as ReturnType<typeof resolveTargetProfile>
  }
  catch {
    const candidate = createDataChainCandidate({ targetId: options.target, runId: options.runId })
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'local_projection', status: 'checkpoint', checkpoint: 'local_prerequisite_unmet' }, now, write)
  }
  const candidate = createDataChainCandidate({ targetId: resolution.id, runId: options.runId })
  try {
    const localEvidence = await loadExactEvidencePair({ ...options, target: resolution.id }, 'local', dependencies.read ?? readEvidenceDefault)
    assertRemoteLocalPrerequisite(localEvidence, { targetId: resolution.id, runId: options.runId, itemCode: candidate.itemCode })
  }
  catch {
    return preIngestCheckpoint({ ...options, target: resolution.id }, candidate.itemCode, { surface: 'local_projection', status: 'checkpoint', checkpoint: 'local_prerequisite_unmet' }, now, write)
  }

  const environment = dependencies.environment ?? process.env
  if (!['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CRAWLER_SECRET'].every(key => isText(environment[key]))) {
    return preIngestCheckpoint({ ...options, target: resolution.id }, candidate.itemCode, { surface: 'remote_preflight', status: 'checkpoint', checkpoint: 'target_preflight_unmet' }, now, write)
  }
  const executeReadOnly = dependencies.executeReadOnly ?? executeRemoteReadOnlyDefault
  const preflight = dependencies.runPreflight ?? runTargetPreflight
  const preflightResult = preflight({
    target: resolution.id,
    scope: 'remote',
    command: 'smoke',
    ciEnvironment: resolution.profile.ci.githubEnvironment,
    environment,
    live: true,
    liveCheckExecutor: { execute: executeReadOnly },
  })
  if (!preflightResult.ok) {
    return preIngestCheckpoint({ ...options, target: resolution.id }, candidate.itemCode, { surface: 'remote_preflight', status: 'checkpoint', checkpoint: 'target_preflight_unmet' }, now, write)
  }

  const runFixture = dependencies.runPreparedFixture ?? (input => runPreparedRemoteEntry({
    ...input,
    ciEnvironment: resolution.profile.ci.githubEnvironment,
    entry: 'crawler-smoke-fixture',
    environment,
  }))
  const runSnapshot = dependencies.runPreparedSnapshot ?? (input => runPreparedRemoteEntry({
    ...input,
    ciEnvironment: resolution.profile.ci.githubEnvironment,
    entry: 'd1-smoke-snapshot',
    environment,
  }))
  try {
    const fixture = await runFixture({ target: resolution.id, runId: options.runId, executeReadOnly })
    if (fixture.itemCode !== candidate.itemCode || fixture.itemCount !== DATA_CHAIN_FIXTURE_COUNT) {
      throw new Error('Remote fixture tuple does not match the deterministic candidate.')
    }
  }
  catch {
    return preIngestCheckpoint({ ...options, target: resolution.id }, candidate.itemCode, { surface: 'remote_preflight', status: 'checkpoint', checkpoint: 'target_preflight_unmet' }, now, write)
  }
  let snapshot: Extract<PreparedSmokeChildObservation, { operation: 'd1-smoke-snapshot' }>
  try {
    snapshot = await runSnapshot({ target: resolution.id, runId: options.runId, executeReadOnly })
  }
  catch {
    return preIngestCheckpoint({ ...options, target: resolution.id }, candidate.itemCode, { surface: 'remote_preflight', status: 'checkpoint', checkpoint: 'target_preflight_unmet' }, now, write)
  }
  if (snapshot.status !== 'found'
    || snapshot.itemCode !== candidate.itemCode
    || snapshot.itemCount !== DATA_CHAIN_FIXTURE_COUNT
    || !isText(snapshot.itemId)) {
    return preIngestCheckpoint({ ...options, target: resolution.id }, candidate.itemCode, { surface: 'remote_preflight', status: 'checkpoint', checkpoint: 'target_preflight_unmet' }, now, write)
  }

  const canonicalBase = resolution.profile.urls.gateway
  const canonicalPath = `/api/public/movies/${candidate.itemCode}`
  const fetchCanonicalApi = dependencies.fetchCanonicalApi ?? fetchCanonicalApiDefault
  const api = await fetchCanonicalApi({ canonicalBase, path: canonicalPath, itemCode: candidate.itemCode, itemId: snapshot.itemId })
  const apiPassed = api.status >= 200 && api.status < 300 && api.itemCode === candidate.itemCode && api.itemId === snapshot.itemId
  const evidenceTimestamp = now()
  const receipt = (surface: RunnerReceiptSurface, routePath?: string) => createRunnerReceipt({
    mode: 'remote',
    targetId: resolution.id,
    runId: options.runId,
    itemCode: candidate.itemCode,
    itemId: snapshot.itemId,
    surface,
    timestamp: evidenceTimestamp,
    ...(routePath ? { path: routePath } : {}),
  })
  const evidence = createResolvedPendingEvidence({
    targetId: resolution.id,
    runId: options.runId,
    itemCode: candidate.itemCode,
    itemId: snapshot.itemId,
    mode: 'remote',
    timestamp: evidenceTimestamp,
    aggregate: apiPassed ? 'pending' : 'checkpoint',
    observations: [
      { surface: 'remote_preflight', status: 'passed', receipt: receipt('remote_preflight') },
      { surface: 'd1', status: 'passed', itemCount: DATA_CHAIN_FIXTURE_COUNT, receipt: receipt('d1') },
      {
        surface: 'api',
        status: apiPassed ? 'passed' : 'checkpoint',
        ...(apiPassed ? {} : { checkpoint: 'canonical_api_unavailable' as const }),
        path: canonicalPath,
        ...(api.attempt ? { attempt: api.attempt } : {}),
        ...(apiPassed ? { receipt: receipt('api', canonicalPath) } : {}),
      },
    ],
  })
  await writeEvidencePair({ ...options, target: resolution.id }, evidence, write)
  return { exitCode: CHECKPOINT_EXIT_CODE, evidence }
}

export async function runDataChainSmoke(options: DataChainSmokeOptions, dependencies: DataChainSmokeDependencies = {}): Promise<DataChainSmokeResult> {
  if (options.mode === 'remote') {
    return runRemoteDataChainSmoke(options, dependencies)
  }
  if (options.mode !== 'local') {
    throw new Error('Data-chain smoke mode is invalid.')
  }
  if (!isFixedEvidenceRoot(options.evidenceRoot) && dependencies.write === undefined) {
    throw new Error('Data-chain smoke evidence directory must be the fixed Phase 13 evidence root.')
  }
  if (!isText(options.target) || !isRunId(options.runId)) {
    throw new Error('Data-chain smoke requires explicit validated target and run id.')
  }
  const now = dependencies.now ?? (() => new Date().toISOString())
  const write = dependencies.write ?? writeDefault
  const candidate = createDataChainCandidate({ targetId: options.target, runId: options.runId })
  const resolve = dependencies.resolveTarget ?? resolveTargetProfile
  const collectProjectionIssues = dependencies.collectProjectionIssues ?? collectProjectionIssuesDefault
  const preflight = dependencies.runPreflight ?? runTargetPreflight

  let resolution: { id: string, profile: { local?: { wranglerProfile: string } } }
  let projectionIssues: readonly ProjectionValidationIssue[]
  try {
    resolution = resolve(options.target)
    projectionIssues = await collectProjectionIssues(options.target)
  }
  catch {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'local_projection', status: 'checkpoint', checkpoint: 'target_projection_unmet' }, now, write)
  }
  if (!resolution.profile.local) {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'local_projection', status: 'checkpoint', checkpoint: 'target_projection_unmet' }, now, write)
  }
  const preflightResult = preflight({
    target: options.target,
    scope: 'local',
    command: 'validate',
    wranglerProfile: resolution.profile.local.wranglerProfile,
    projectionIssues,
    environment: process.env,
  })
  if (!preflightResult.ok) {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'local_projection', status: 'checkpoint', checkpoint: 'target_projection_unmet' }, now, write)
  }

  const inspectLocalD1 = dependencies.inspectLocalD1 ?? (input => inspectLocalD1Default(input))
  const d1 = await inspectLocalD1({ targetId: resolution.id, runId: options.runId, itemCode: candidate.itemCode })
  if (d1.status !== 'ready') {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'local_d1_readiness', status: 'checkpoint', checkpoint: d1.checkpoint ?? 'local_d1_readiness_unmet' }, now, write)
  }

  const checkServices = dependencies.checkServices ?? checkServicesDefault
  const service = await checkServices()
  if (service.exitCode !== 0 || /^\s*\[!!\](?:\s|$)/m.test(`${service.stdout}\n${service.stderr}`)) {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'service_readiness', status: 'checkpoint', checkpoint: 'local_prerequisite_unmet' }, now, write)
  }

  const observeGatewayAuth = dependencies.observeGatewayAuth ?? observeGatewayAuthDefault
  let auth: GatewayAuthResponse
  try {
    auth = await observeGatewayAuth()
  }
  catch {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'gateway_auth', status: 'checkpoint', checkpoint: 'gateway_auth_unavailable', path: '/auth/', origin: LOCAL_GATEWAY_ORIGIN }, now, write)
  }
  if (!validGatewayAuth(auth)) {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'gateway_auth', status: 'checkpoint', checkpoint: 'gateway_auth_unavailable', path: '/auth/', origin: LOCAL_GATEWAY_ORIGIN }, now, write)
  }

  const runFixture = dependencies.runFixture ?? runFixtureDefault
  const snapshot = dependencies.snapshot ?? snapshotDefault
  try {
    const fixture = await runFixture({ targetId: resolution.id, runId: options.runId, itemCode: candidate.itemCode })
    if (fixture.itemCode !== candidate.itemCode || fixture.itemCount !== DATA_CHAIN_FIXTURE_COUNT) {
      throw new Error('Fixture tuple does not match the deterministic candidate.')
    }
  }
  catch {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'service_readiness', status: 'checkpoint', checkpoint: 'local_prerequisite_unmet' }, now, write)
  }
  const snapshotResult = await snapshot({ targetId: resolution.id, runId: options.runId, itemCode: candidate.itemCode })
  if (snapshotResult.status !== 'found'
    || snapshotResult.itemCode !== candidate.itemCode
    || snapshotResult.itemCount !== DATA_CHAIN_FIXTURE_COUNT
    || !isText(snapshotResult.itemId)) {
    return preIngestCheckpoint(options, candidate.itemCode, { surface: 'local_d1_readiness', status: 'checkpoint', checkpoint: 'fixture_seed_incomplete' }, now, write)
  }

  const fetchGatewayApi = dependencies.fetchGatewayApi ?? fetchGatewayApiDefault
  const api = await fetchGatewayApi({ itemCode: candidate.itemCode, itemId: snapshotResult.itemId })
  const apiPassed = api.status >= 200 && api.status < 300 && api.itemCode === candidate.itemCode && api.itemId === snapshotResult.itemId
  const evidenceTimestamp = now()
  const receipt = (surface: RunnerReceiptSurface, routePath?: string) => createRunnerReceipt({
    mode: 'local',
    targetId: resolution.id,
    runId: options.runId,
    itemCode: candidate.itemCode,
    itemId: snapshotResult.itemId,
    surface,
    timestamp: evidenceTimestamp,
    ...(routePath ? { path: routePath } : {}),
  })
  const prerequisiteObservations: readonly DataChainObservation[] = [
    { surface: 'local_projection', status: 'passed', receipt: receipt('local_projection') },
    { surface: 'local_d1_readiness', status: 'passed', receipt: receipt('local_d1_readiness') },
    { surface: 'service_readiness', status: 'passed', receipt: receipt('service_readiness') },
    { surface: 'gateway_auth', status: 'passed', path: '/auth/', origin: LOCAL_GATEWAY_ORIGIN, receipt: receipt('gateway_auth', '/auth/') },
  ]
  const evidence = createResolvedPendingEvidence({
    targetId: resolution.id,
    runId: options.runId,
    itemCode: candidate.itemCode,
    itemId: snapshotResult.itemId,
    mode: 'local',
    timestamp: evidenceTimestamp,
    aggregate: apiPassed ? 'pending' : 'checkpoint',
    observations: [
      ...prerequisiteObservations,
      { surface: 'd1', status: 'passed', itemCount: DATA_CHAIN_FIXTURE_COUNT, receipt: receipt('d1') },
      {
        surface: 'api',
        status: apiPassed ? 'passed' : 'checkpoint',
        ...(apiPassed ? {} : { checkpoint: 'canonical_api_unavailable' as const }),
        path: `/api/public/movies/${candidate.itemCode}`,
        origin: LOCAL_GATEWAY_ORIGIN,
        ...(api.attempt ? { attempt: api.attempt } : {}),
        ...(apiPassed ? { receipt: receipt('api', `/api/public/movies/${candidate.itemCode}`) } : {}),
      },
    ],
  })
  await writeEvidencePair(options, evidence, write)
  return { exitCode: CHECKPOINT_EXIT_CODE, evidence }
}

export async function runDataChainSmokeCli(argv: readonly string[] = process.argv.slice(2)): Promise<0 | typeof CHECKPOINT_EXIT_CODE> {
  const options = parseDataChainSmokeArgs(argv)
  const result = await runDataChainSmoke(options)
  console.log(JSON.stringify({ mode: options.mode, target: options.target, runId: options.runId, itemCode: result.evidence.itemCode, itemId: result.evidence.itemId, state: result.evidence.ingestState, aggregate: result.evidence.aggregate }))
  return result.exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runDataChainSmokeCli().then((exitCode) => {
    process.exitCode = exitCode
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
