import type {
  CHECKPOINT_EXIT_CODE,
  DataChainEvidence,
  DataChainMode,
  ResolvedPendingDataChainEvidence,
} from '../packages/config/src/deployment-target/index'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  appendBrowserObservation,
  createDataChainExecutionReceipt,
  LOCAL_GATEWAY_ORIGIN,
  renderDataChainEvidenceMarkdown,
  resolveTargetProfile,
  serializeDataChainEvidenceJson,
  validateDataChainEvidenceForExitCode,
} from '../packages/config/src/deployment-target/index'
import { DATA_CHAIN_EVIDENCE_ROOT, getDataChainEvidencePaths } from './data-chain-smoke'

export interface DataChainSurfaceObservationOptions {
  readonly mode: DataChainMode
  readonly target: string
  readonly runId: string
}

export interface BrowserSurfaceObservationInput {
  readonly mode: DataChainMode
  readonly targetId: string
  readonly runId: string
  readonly itemCode: string
  readonly itemId: string
  readonly surface: 'dashboard' | 'viewer'
  readonly baseUrl: string
  readonly path: string
}

export interface BrowserSurfaceObservationResult {
  readonly status: 'passed' | 'unavailable'
  readonly itemCode?: string
  readonly itemId?: string
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
  readonly evidenceRoot?: string
  readonly read?: (file: string) => Promise<string | undefined>
  readonly write?: (file: string, contents: string) => Promise<void>
  readonly resolveTarget?: (target: string) => ObserverTargetResolution
  readonly observeSurface?: (input: BrowserSurfaceObservationInput) => Promise<BrowserSurfaceObservationResult>
  readonly now?: () => string
}

interface PuppeteerResponse {
  ok: () => boolean
}

interface PuppeteerPage {
  goto: (url: string, options: { waitUntil: 'domcontentloaded', timeout: number }) => Promise<PuppeteerResponse | null>
  url: () => string
  waitForFunction: <Args extends readonly unknown[]>(
    pageFunction: (...args: Args) => boolean,
    options: { polling: 'mutation', timeout: number },
    ...args: Args
  ) => Promise<unknown>
  evaluate: <T, Args extends readonly unknown[]>(pageFunction: (...args: Args) => T, ...args: Args) => Promise<T>
}

interface PuppeteerBrowser {
  newPage: () => Promise<PuppeteerPage>
  close: () => Promise<void>
}

interface PuppeteerModule {
  launch: (options: { headless: boolean, userDataDir: string }) => Promise<PuppeteerBrowser>
}

const controlledOptionKeys = ['mode', 'target', 'runId'] as const
const browserResultKeys = ['status', 'itemCode', 'itemId'] as const

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
  options: DataChainSurfaceObservationOptions,
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

function normalizeBrowserResult(value: unknown): BrowserSurfaceObservationResult | undefined {
  if (!isRecord(value) || Object.keys(value).some(key => !browserResultKeys.includes(key as (typeof browserResultKeys)[number]))) {
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

function crawlerPuppeteer(): PuppeteerModule {
  const crawlerPackage = path.resolve(import.meta.dirname, '../packages/crawler/package.json')
  return createRequire(crawlerPackage)('puppeteer') as PuppeteerModule
}

export async function observeSurfaceDefault(
  input: BrowserSurfaceObservationInput,
  puppeteer: PuppeteerModule = crawlerPuppeteer(),
): Promise<BrowserSurfaceObservationResult> {
  const endpoint = new URL(input.path, `${input.baseUrl}/`)
  const base = new URL(input.baseUrl)
  if (endpoint.origin !== base.origin || endpoint.pathname !== input.path) {
    return { status: 'unavailable' }
  }
  const browser = await puppeteer.launch({
    headless: process.env.CI === 'true',
    userDataDir: path.resolve(import.meta.dirname, `../.target-runs/phase13-browser-profile/${input.targetId}`),
  })
  try {
    const page = await browser.newPage()
    const response = await page.goto(endpoint.href, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const finalUrl = new URL(page.url())
    if (!response?.ok() || finalUrl.origin !== endpoint.origin || finalUrl.pathname !== endpoint.pathname) {
      return { status: 'unavailable' }
    }
    await page.waitForFunction((itemCode, itemId) => {
      const bodyText = document.body?.textContent ?? ''
      const documentHtml = document.documentElement?.outerHTML ?? ''
      return (bodyText.includes(itemCode) || documentHtml.includes(itemCode))
        && (bodyText.includes(itemId) || documentHtml.includes(itemId))
    }, { polling: 'mutation', timeout: 30_000 }, input.itemCode, input.itemId)
    const settledUrl = new URL(page.url())
    if (settledUrl.origin !== endpoint.origin || settledUrl.pathname !== endpoint.pathname) {
      return { status: 'unavailable' }
    }
    const tuple = await page.evaluate((itemCode, itemId) => {
      const bodyText = document.body?.textContent ?? ''
      const documentHtml = document.documentElement?.outerHTML ?? ''
      return {
        codeMatches: bodyText.includes(itemCode) || documentHtml.includes(itemCode),
        idMatches: bodyText.includes(itemId) || documentHtml.includes(itemId),
      }
    }, input.itemCode, input.itemId)
    return tuple.codeMatches && tuple.idMatches
      ? { status: 'passed', itemCode: input.itemCode, itemId: input.itemId }
      : { status: 'unavailable' }
  }
  finally {
    await browser.close()
  }
}

async function captureSurface(
  evidence: ResolvedPendingDataChainEvidence,
  surface: 'dashboard' | 'viewer',
  baseUrl: string,
  observeSurface: (input: BrowserSurfaceObservationInput) => Promise<BrowserSurfaceObservationResult>,
  now: () => string,
) {
  const routePath = surface === 'dashboard' ? '/dashboard/movies' : `/movie/${evidence.itemCode}`
  let observation: BrowserSurfaceObservationResult | undefined
  try {
    observation = normalizeBrowserResult(await observeSurface({
      mode: evidence.mode,
      targetId: evidence.targetId,
      runId: evidence.runId,
      itemCode: evidence.itemCode,
      itemId: evidence.itemId,
      surface,
      baseUrl,
      path: routePath,
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
  const evidenceRoot = dependencies.evidenceRoot ?? DATA_CHAIN_EVIDENCE_ROOT
  const read = dependencies.read ?? readDefault
  const write = dependencies.write ?? ((file, contents) => writeFile(file, contents, 'utf8'))
  const resolveTarget = dependencies.resolveTarget ?? (target => resolveTargetProfile(target) as ObserverTargetResolution)
  const observeSurface = dependencies.observeSurface ?? observeSurfaceDefault
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

  const dashboard = await captureSurface(evidence, 'dashboard', baseUrl, observeSurface, now)
  await writePair(options, evidenceRoot, dashboard.evidence, write)
  if (dashboard.evidence.aggregate !== 'pending') {
    return dashboard
  }
  if (dashboard.evidence.ingestState !== 'resolved_pending_observation') {
    throw new Error('Dashboard observation must retain pending evidence.')
  }

  const viewer = await captureSurface(dashboard.evidence, 'viewer', baseUrl, observeSurface, now)
  await writePair(options, evidenceRoot, viewer.evidence, write)
  return viewer
}

export async function runDataChainSurfaceObservationCli(argv: readonly string[] = process.argv.slice(2)): Promise<0 | typeof CHECKPOINT_EXIT_CODE> {
  const options = parseDataChainSurfaceObservationArgs(argv)
  const result = await observeDataChainSurfaces(options)
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
