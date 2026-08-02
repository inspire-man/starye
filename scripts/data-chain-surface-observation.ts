import type {
  DataChainEvidence,
  DataChainMode,
  ResolvedPendingDataChainEvidence,
} from '../packages/config/src/deployment-target/index'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  appendBrowserObservation,
  CHECKPOINT_EXIT_CODE,
  createDataChainExecutionReceipt,
  LOCAL_GATEWAY_ORIGIN,
  renderDataChainEvidenceMarkdown,
  resolveTargetProfile,
  serializeDataChainEvidenceJson,
  validateDataChainEvidenceForExitCode,
  validatePhase19Evidence,
} from '../packages/config/src/deployment-target/index'
import { DATA_CHAIN_EVIDENCE_ROOT, getDataChainEvidencePaths } from './data-chain-smoke'

export interface DataChainSurfaceObservationOptions {
  readonly mode: DataChainMode
  readonly target: string
  readonly runId: string
}

export interface RootIabDashboardProbeInput {
  readonly mode: DataChainMode
  readonly targetId: string
  readonly baseUrl: string
  readonly path: '/dashboard/movies'
}

export interface RootIabDashboardProbeResult {
  readonly status: 'ready' | 'unavailable'
}

export const ROOT_IAB_SURFACE_TUPLE_ATTRIBUTES = {
  itemCode: 'data-phase13-item-code',
  itemId: 'data-phase13-item-id',
} as const

export type RootIabSurfaceTupleAttributes = Readonly<typeof ROOT_IAB_SURFACE_TUPLE_ATTRIBUTES>

export interface RootIabSurfaceObservationInput {
  readonly mode: DataChainMode
  readonly targetId: string
  readonly itemCode: string
  readonly itemId: string
  readonly baseUrl: string
  readonly path: string
  readonly tupleAttributes: RootIabSurfaceTupleAttributes
}

export interface RootIabSurfaceObservationResult {
  readonly status: 'passed' | 'unavailable'
  readonly itemCode?: string
  readonly itemId?: string
}

export interface RootIabSurfaceObserver {
  readonly owner: 'root_iab'
  readonly probeDashboard: (input: RootIabDashboardProbeInput) => Promise<RootIabDashboardProbeResult>
  readonly observeSurface: (input: RootIabSurfaceObservationInput) => Promise<RootIabSurfaceObservationResult>
}

export interface RootIabObservationReadinessOptions {
  readonly mode: DataChainMode
  readonly target: string
}

interface ObserverTargetResolution {
  readonly id: string
  readonly profile: {
    readonly urls: {
      readonly gateway: string
    }
  }
}

export interface DataChainSurfaceObservationDependencies {
  readonly rootIab?: RootIabSurfaceObserver
  readonly evidenceRoot?: string
  readonly read?: (file: string) => Promise<string | undefined>
  readonly write?: (file: string, contents: string) => Promise<void>
  readonly resolveTarget?: (target: string) => ObserverTargetResolution
  readonly now?: () => string
}

interface Phase19LocalObservationOptions {
  readonly evidenceDir: string
  readonly gateway: string
}

const controlledOptionKeys = ['mode', 'target', 'runId'] as const
const readinessOptionKeys = ['mode', 'target'] as const
const rootIabProbeResultKeys = ['status'] as const
const rootIabObservationResultKeys = ['status', 'itemCode', 'itemId'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRunId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`)
  }
  return value
}

export function parseDataChainSurfaceObservationArgs(argv: readonly string[]): DataChainSurfaceObservationOptions {
  const values: Partial<Record<'mode' | 'target' | 'runId', string>> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag !== '--mode' && flag !== '--target' && flag !== '--run-id') {
      throw new Error(`Unsupported data-chain observer argument: ${flag}.`)
    }
    const value = requireValue(argv, index, flag)
    index += 1
    const key = flag === '--run-id' ? 'runId' : flag.slice(2) as 'mode' | 'target'
    if (values[key] !== undefined) {
      throw new Error(`Duplicate data-chain observer argument: ${flag}.`)
    }
    values[key] = value
  }
  if (values.mode !== 'local' && values.mode !== 'remote') {
    throw new Error('Data-chain observer requires --mode local|remote.')
  }
  if (!hasText(values.target)) {
    throw new Error('Data-chain observer requires an explicit --target.')
  }
  if (!hasText(values.runId) || !isRunId(values.runId)) {
    throw new Error('Data-chain observer requires a validated --run-id.')
  }
  return { mode: values.mode, target: values.target, runId: values.runId }
}

function parsePhase19LocalObservationArgs(argv: readonly string[]): Phase19LocalObservationOptions | undefined {
  if (!argv.includes('--evidence-dir'))
    return undefined
  let evidenceDir: string | undefined
  let gateway = LOCAL_GATEWAY_ORIGIN
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--evidence-dir') {
      evidenceDir = requireValue(argv, index, flag)
      index += 1
      continue
    }
    if (flag === '--gateway') {
      gateway = requireValue(argv, index, flag)
      index += 1
      continue
    }
    if (flag === '--mode' || flag === '--target') {
      index += 1
      continue
    }
    throw new Error(`Unsupported Phase 19 local observer argument: ${flag}.`)
  }
  if (!evidenceDir)
    throw new Error('Phase 19 local observer requires --evidence-dir.')
  if (gateway !== LOCAL_GATEWAY_ORIGIN)
    throw new Error('Phase 19 local observer requires the canonical Gateway http://localhost:8080.')
  return { evidenceDir, gateway }
}

export async function observePhase19LocalEvidence(options: Phase19LocalObservationOptions): Promise<0 | typeof CHECKPOINT_EXIT_CODE> {
  const files = (await readdir(options.evidenceDir)).filter(file => file.endsWith('.json'))
  if (files.length === 0)
    return CHECKPOINT_EXIT_CODE
  let validTemplates = 0
  for (const file of files) {
    const parsed = JSON.parse(await readFile(`${options.evidenceDir}/${file}`, 'utf8')) as Record<string, unknown>
    const issues = validatePhase19Evidence(parsed)
    if (issues.length > 0 || parsed.gatewayUrl !== options.gateway || parsed.mode !== 'local_contract')
      return CHECKPOINT_EXIT_CODE
    if (parsed.template === 'movie' || parsed.template === 'manga')
      validTemplates += 1
  }
  return validTemplates >= 2 ? 0 : CHECKPOINT_EXIT_CODE
}

function assertControlledOptions(options: unknown): asserts options is DataChainSurfaceObservationOptions {
  if (!isRecord(options)) {
    throw new Error('Data-chain observer options must be an object.')
  }
  const unexpected = Object.keys(options).find(key => !controlledOptionKeys.includes(key as (typeof controlledOptionKeys)[number]))
  if (unexpected) {
    throw new Error(`Unsupported data-chain observer option: ${unexpected}.`)
  }
  if ((options.mode !== 'local' && options.mode !== 'remote') || !hasText(options.target) || !hasText(options.runId) || !isRunId(options.runId)) {
    throw new Error('Data-chain observer requires mode, target, and a validated run id.')
  }
}

function assertReadinessOptions(options: unknown): asserts options is RootIabObservationReadinessOptions {
  if (!isRecord(options)) {
    throw new Error('Root IAB readiness options must be an object.')
  }
  const unexpected = Object.keys(options).find(key => !readinessOptionKeys.includes(key as (typeof readinessOptionKeys)[number]))
  if (unexpected) {
    throw new Error(`Unsupported root IAB readiness option: ${unexpected}.`)
  }
  if ((options.mode !== 'local' && options.mode !== 'remote') || !hasText(options.target)) {
    throw new Error('Root IAB readiness requires mode and target.')
  }
}

function requireRootIabSurfaceObserver(value: unknown): RootIabSurfaceObserver {
  if (!isRecord(value)
    || value.owner !== 'root_iab'
    || typeof value.probeDashboard !== 'function'
    || typeof value.observeSurface !== 'function') {
    throw new Error('root_iab_adapter_required')
  }
  return value as RootIabSurfaceObserver
}

async function readDefault(file: string): Promise<string | undefined> {
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

async function loadEvidencePair(
  options: DataChainSurfaceObservationOptions,
  evidenceRoot: string,
  read: (file: string) => Promise<string | undefined>,
): Promise<ResolvedPendingDataChainEvidence> {
  const paths = getDataChainEvidencePaths({ ...options, evidenceRoot })
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
  if (typed.mode !== options.mode || typed.targetId !== options.target || typed.runId !== options.runId) {
    throw new Error('Data-chain observer tuple does not match the exact evidence pair.')
  }
  if (markdown !== renderDataChainEvidenceMarkdown(typed)) {
    throw new Error('Data-chain evidence Markdown does not match JSON.')
  }
  if (typed.ingestState !== 'resolved_pending_observation' || typed.aggregate !== 'pending') {
    throw new Error('Data-chain observer requires pending post-snapshot evidence.')
  }
  if (typed.observations.some(row => row.surface === 'dashboard' || row.surface === 'viewer')) {
    throw new Error('Data-chain observer requires an unobserved pending artifact.')
  }
  const requiredRunnerSurfaces = typed.mode === 'local'
    ? ['local_projection', 'local_d1_readiness', 'service_readiness', 'gateway_auth', 'd1', 'api'] as const
    : ['remote_preflight', 'd1', 'api'] as const
  if (!requiredRunnerSurfaces.every(surface => typed.observations.some(row => (
    row.surface === surface && row.status === 'passed' && row.receipt !== undefined
  )))) {
    throw new Error('Data-chain observer requires receipt-backed runner evidence.')
  }
  return typed
}

async function writePair(
  options: DataChainSurfaceObservationOptions,
  evidenceRoot: string,
  evidence: DataChainEvidence,
  write: (file: string, contents: string) => Promise<void>,
): Promise<void> {
  const paths = getDataChainEvidencePaths({ ...options, evidenceRoot })
  await write(paths.json, serializeDataChainEvidenceJson(evidence))
  await write(paths.markdown, renderDataChainEvidenceMarkdown(evidence))
}

function resolveObserverBase(
  options: Pick<DataChainSurfaceObservationOptions, 'mode' | 'target'>,
  resolveTarget: (target: string) => ObserverTargetResolution,
): string {
  const resolution = resolveTarget(options.target)
  if (resolution.id !== options.target) {
    throw new Error('Data-chain observer target does not match the selected profile.')
  }
  if (options.mode === 'local') {
    return LOCAL_GATEWAY_ORIGIN
  }
  let gateway: URL
  try {
    gateway = new URL(resolution.profile.urls.gateway)
  }
  catch {
    throw new Error('Selected target canonical Gateway is invalid.')
  }
  if (gateway.protocol !== 'https:' || gateway.port || gateway.username || gateway.password || gateway.search || gateway.hash || !['', '/'].includes(gateway.pathname)) {
    throw new Error('Selected target canonical Gateway must be an HTTPS origin without a direct port.')
  }
  return gateway.origin
}

function normalizeRootIabProbeResult(value: unknown): RootIabDashboardProbeResult | undefined {
  if (!isRecord(value) || Object.keys(value).some(key => !rootIabProbeResultKeys.includes(key as (typeof rootIabProbeResultKeys)[number]))) {
    return undefined
  }
  if (value.status !== 'ready' && value.status !== 'unavailable') {
    return undefined
  }
  return { status: value.status }
}

function normalizeRootIabObservationResult(value: unknown): RootIabSurfaceObservationResult | undefined {
  if (!isRecord(value) || Object.keys(value).some(key => !rootIabObservationResultKeys.includes(key as (typeof rootIabObservationResultKeys)[number]))) {
    return undefined
  }
  if (value.status !== 'passed' && value.status !== 'unavailable') {
    return undefined
  }
  if (value.status === 'passed' && (!hasText(value.itemCode) || !hasText(value.itemId))) {
    return undefined
  }
  return {
    status: value.status,
    ...(hasText(value.itemCode) ? { itemCode: value.itemCode } : {}),
    ...(hasText(value.itemId) ? { itemId: value.itemId } : {}),
  }
}

export async function verifyRootIabObservationReadiness(
  options: RootIabObservationReadinessOptions,
  dependencies: Pick<DataChainSurfaceObservationDependencies, 'rootIab' | 'resolveTarget'> = {},
): Promise<RootIabDashboardProbeResult> {
  assertReadinessOptions(options)
  const rootIab = requireRootIabSurfaceObserver(dependencies.rootIab)
  const resolveTarget = dependencies.resolveTarget ?? (target => resolveTargetProfile(target) as ObserverTargetResolution)
  let baseUrl: string
  try {
    baseUrl = resolveObserverBase(options, resolveTarget)
  }
  catch {
    return { status: 'unavailable' }
  }
  try {
    return normalizeRootIabProbeResult(await rootIab.probeDashboard({
      mode: options.mode,
      targetId: options.target,
      baseUrl,
      path: '/dashboard/movies',
    })) ?? { status: 'unavailable' }
  }
  catch {
    return { status: 'unavailable' }
  }
}

async function captureSurface(
  evidence: ResolvedPendingDataChainEvidence,
  surface: 'dashboard' | 'viewer',
  baseUrl: string,
  rootIab: RootIabSurfaceObserver,
  now: () => string,
) {
  const routePath = surface === 'dashboard' ? '/dashboard/movies' : `/movie/${evidence.itemCode}`
  let observation: RootIabSurfaceObservationResult | undefined
  try {
    observation = normalizeRootIabObservationResult(await rootIab.observeSurface({
      mode: evidence.mode,
      targetId: evidence.targetId,
      itemCode: evidence.itemCode,
      itemId: evidence.itemId,
      baseUrl,
      path: routePath,
      tupleAttributes: ROOT_IAB_SURFACE_TUPLE_ATTRIBUTES,
    }))
  }
  catch {
    observation = undefined
  }
  const passed = observation?.status === 'passed'
    && observation.itemCode === evidence.itemCode
    && observation.itemId === evidence.itemId
  if (!passed) {
    const checkpoint = surface === 'dashboard' ? 'dashboard_auth_unavailable' : 'canonical_viewer_unavailable'
    return appendBrowserObservation(evidence, {
      targetId: evidence.targetId,
      runId: evidence.runId,
      itemCode: evidence.itemCode,
      itemId: evidence.itemId,
      surface,
      status: 'checkpoint',
      checkpoint,
    })
  }
  const receipt = createDataChainExecutionReceipt({
    source: 'browser_observer',
    capture: 'browser_navigation',
    mode: evidence.mode,
    targetId: evidence.targetId,
    runId: evidence.runId,
    itemCode: evidence.itemCode,
    itemId: evidence.itemId,
    surface,
    path: routePath,
    timestamp: now(),
  })
  return appendBrowserObservation(evidence, {
    targetId: evidence.targetId,
    runId: evidence.runId,
    itemCode: evidence.itemCode,
    itemId: evidence.itemId,
    surface,
    status: 'passed',
    receipt,
  })
}

export async function observeDataChainSurfaces(
  options: DataChainSurfaceObservationOptions,
  dependencies: DataChainSurfaceObservationDependencies = {},
): Promise<{ exitCode: 0 | typeof CHECKPOINT_EXIT_CODE, evidence: DataChainEvidence }> {
  assertControlledOptions(options)
  const rootIab = requireRootIabSurfaceObserver(dependencies.rootIab)
  const evidenceRoot = dependencies.evidenceRoot ?? DATA_CHAIN_EVIDENCE_ROOT
  const read = dependencies.read ?? readDefault
  const write = dependencies.write ?? ((file, contents) => writeFile(file, contents, 'utf8'))
  const resolveTarget = dependencies.resolveTarget ?? (target => resolveTargetProfile(target) as ObserverTargetResolution)
  const now = dependencies.now ?? (() => new Date().toISOString())
  const evidence = await loadEvidencePair(options, evidenceRoot, read)
  let baseUrl: string
  try {
    baseUrl = resolveObserverBase(options, resolveTarget)
  }
  catch {
    const dashboard = appendBrowserObservation(evidence, {
      targetId: evidence.targetId,
      runId: evidence.runId,
      itemCode: evidence.itemCode,
      itemId: evidence.itemId,
      surface: 'dashboard',
      status: 'checkpoint',
      checkpoint: 'dashboard_auth_unavailable',
    })
    await writePair(options, evidenceRoot, dashboard.evidence, write)
    return dashboard
  }

  const dashboard = await captureSurface(evidence, 'dashboard', baseUrl, rootIab, now)
  await writePair(options, evidenceRoot, dashboard.evidence, write)
  if (dashboard.evidence.aggregate !== 'pending') {
    return dashboard
  }
  if (dashboard.evidence.ingestState !== 'resolved_pending_observation') {
    throw new Error('Dashboard observation must retain pending evidence.')
  }

  const viewer = await captureSurface(dashboard.evidence, 'viewer', baseUrl, rootIab, now)
  await writePair(options, evidenceRoot, viewer.evidence, write)
  return viewer
}

export async function runDataChainSurfaceObservationCli(
  argv: readonly string[] = process.argv.slice(2),
  dependencies: DataChainSurfaceObservationDependencies = {},
): Promise<0 | typeof CHECKPOINT_EXIT_CODE> {
  const phase19Options = parsePhase19LocalObservationArgs(argv)
  if (phase19Options)
    return observePhase19LocalEvidence(phase19Options)
  const options = parseDataChainSurfaceObservationArgs(argv)
  const result = await observeDataChainSurfaces(options, dependencies)
  return result.exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runDataChainSurfaceObservationCli().then((exitCode) => {
    process.exitCode = exitCode
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
