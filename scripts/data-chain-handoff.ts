import type { TargetResolution } from '../packages/config/src/deployment-target/target-resolver.ts'
import { isTargetProfileId, resolveTargetProfile } from '../packages/config/src/deployment-target/target-resolver.ts'

export type DataChainHandoffMode = 'local' | 'remote'

type DataChainHandoffRefusal
  = | 'invalid_target'
    | 'invalid_evidence_path'
    | 'evidence_pair_exists'
    | 'evidence_pair_partial'
    | 'evidence_pair_state_unavailable'
    | 'attempt_already_reserved'
    | 'attempt_reservation_unavailable'
    | 'handoff_not_ready'

export interface DataChainHandoffParsedArgs {
  readonly mode: DataChainHandoffMode
  readonly target: string
  readonly runId: string
}

export interface ResolvedDataChainHandoffRequest {
  readonly mode: DataChainHandoffMode
  readonly runId: string
  readonly resolution: TargetResolution
}

export interface DataChainHandoffPaths {
  readonly root: string
  readonly directory: string
  readonly json: string
  readonly markdown: string
  readonly attempt: string
}

export interface DataChainHandoffEvidencePair {
  readonly json: string
  readonly markdown: string
}

export interface DataChainHandoffPairInspection {
  readonly json: 'missing' | 'exists' | 'unavailable'
  readonly markdown: 'missing' | 'exists' | 'unavailable'
}

export interface DataChainHandoffStorageAdapter {
  readonly inspectPair: (paths: DataChainHandoffPaths) => Promise<DataChainHandoffPairInspection>
  readonly readPair: (paths: DataChainHandoffPaths) => Promise<DataChainHandoffEvidencePair | undefined>
  readonly writePair: (paths: DataChainHandoffPaths, pair: DataChainHandoffEvidencePair) => Promise<'written' | 'unavailable'>
  readonly reserveAttempt: (paths: DataChainHandoffPaths) => Promise<'reserved' | 'exists' | 'unavailable'>
}

export type DataChainRemotePreflightStatus = 'not_applicable' | 'passed' | 'unmet'

export interface DataChainHandoffVerificationResult {
  readonly exitCode: 0 | 2
  readonly outcome: 'terminal_passed' | 'pending' | 'failed' | 'checkpoint'
  readonly provesExternalChain: boolean
  readonly evidence: {
    readonly mode: DataChainHandoffMode
    readonly targetId: string
    readonly runId: string
    readonly itemCode: string
    readonly itemId: string | null
    readonly ingestState: 'pre_ingest' | 'resolved_pending_observation' | 'resolved'
    readonly aggregate: 'pending' | 'checkpoint' | 'failed' | 'passed'
  }
}

export interface DataChainHandoffResult {
  readonly exitCode: 0 | 1
  readonly outcome: 'pending' | DataChainHandoffRefusal
  readonly handoffReady: boolean
  readonly preflightStatus: DataChainRemotePreflightStatus
  readonly runnerInvocations: 0 | 1
  readonly itemCode?: string
  readonly itemId?: string
}

export interface DataChainHandoffDependencies {
  readonly storage: DataChainHandoffStorageAdapter
  readonly invokeRemotePreflight: (request: ResolvedDataChainHandoffRequest) => Promise<'passed' | 'unmet'>
  readonly invokeRunner: (request: ResolvedDataChainHandoffRequest) => Promise<void>
  readonly invokeVerifier: (request: ResolvedDataChainHandoffRequest, paths: DataChainHandoffPaths) => Promise<DataChainHandoffVerificationResult>
  readonly now?: () => string
  readonly resultSink?: (result: DataChainHandoffResult) => void
}

export interface DataChainHandoffCliDependencies {
  readonly createDependencies?: (request: ResolvedDataChainHandoffRequest) => Promise<DataChainHandoffDependencies> | DataChainHandoffDependencies
  readonly resultSink?: (result: DataChainHandoffResult) => void
}

interface NodePathModule {
  readonly default: {
    resolve: (...parts: readonly string[]) => string
    join: (...parts: readonly string[]) => string
    dirname: (value: string) => string
    relative: (from: string, to: string) => string
    isAbsolute: (value: string) => boolean
    readonly posix: { isAbsolute: (value: string) => boolean }
    readonly win32: { isAbsolute: (value: string) => boolean }
  }
}

function invalidArgs(): never {
  throw new Error('invalid_handoff_arguments')
}

function validRunId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function validSegment(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    && !value.includes('%')
    && !value.includes('/')
    && !value.includes('\\')
}

function strictDescendant(
  path: NodePathModule['default'],
  parent: string,
  child: string,
): boolean {
  const relative = path.relative(parent, child)
  return relative.length > 0
    && !relative.startsWith('..')
    && !path.isAbsolute(relative)
    && !path.posix.isAbsolute(relative)
    && !path.win32.isAbsolute(relative)
}

function refusal(
  outcome: DataChainHandoffRefusal,
  preflightStatus: DataChainRemotePreflightStatus,
  runnerInvocations: 0 | 1,
): DataChainHandoffResult {
  return {
    exitCode: 1,
    outcome,
    handoffReady: false,
    preflightStatus,
    runnerInvocations,
  }
}

function emit(
  result: DataChainHandoffResult,
  sink?: (result: DataChainHandoffResult) => void,
): DataChainHandoffResult {
  sink?.(result)
  return result
}

/**
 * Parses only the closed handoff argv vocabulary. Path and filesystem modules
 * intentionally do not appear in this import-safe prelude.
 */
export function parseDataChainHandoffArgs(argv: readonly string[]): DataChainHandoffParsedArgs {
  const values: Partial<Record<'mode' | 'target' | 'runId', string>> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag !== '--mode' && flag !== '--target' && flag !== '--run-id') {
      invalidArgs()
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      invalidArgs()
    }
    index += 1
    const key = flag === '--run-id' ? 'runId' : flag.slice(2) as 'mode' | 'target'
    if (values[key] !== undefined) {
      invalidArgs()
    }
    values[key] = value
  }

  if ((values.mode !== 'local' && values.mode !== 'remote')
    || !values.target
    || !values.runId
    || !validRunId(values.runId)) {
    invalidArgs()
  }

  return {
    mode: values.mode,
    target: values.target,
    runId: values.runId,
  }
}

export function validateResolvedDataChainHandoffRequest(
  input: DataChainHandoffParsedArgs,
  resolution: TargetResolution,
): ResolvedDataChainHandoffRequest | undefined {
  if (!validSegment(input.target)
    || !validRunId(input.runId)
    || !isTargetProfileId(resolution.id)
    || resolution.id !== input.target
    || resolution.profile.id !== resolution.id) {
    return undefined
  }

  return Object.freeze({
    mode: input.mode,
    runId: input.runId,
    resolution,
  })
}

/**
 * Compares a candidate against the one recomputed fixed-root bundle. The core
 * never accepts a caller-provided candidate; this export exists for pure tests.
 */
export async function assertExactDataChainHandoffPaths(
  request: ResolvedDataChainHandoffRequest,
  root: string,
  candidate: DataChainHandoffPaths,
): Promise<void> {
  if (!isTargetProfileId(request.resolution.id)
    || request.resolution.profile.id !== request.resolution.id
    || !validSegment(request.resolution.id)
    || !validRunId(request.runId)) {
    throw new Error('invalid_evidence_path')
  }

  const { default: path } = await import('node:path') as NodePathModule
  const resolvedRoot = path.resolve(root)
  const directory = path.join(resolvedRoot, request.resolution.id, request.runId)
  const expected: DataChainHandoffPaths = {
    root: resolvedRoot,
    directory,
    json: path.join(directory, `${request.mode}.json`),
    markdown: path.join(directory, `${request.mode}.md`),
    attempt: path.join(directory, `${request.mode}.attempt`),
  }

  const values = [candidate.root, candidate.directory, candidate.json, candidate.markdown, candidate.attempt]
  if (values.some(value => typeof value !== 'string')
    || candidate.root !== expected.root
    || candidate.directory !== expected.directory
    || candidate.json !== expected.json
    || candidate.markdown !== expected.markdown
    || candidate.attempt !== expected.attempt
    || !strictDescendant(path, expected.root, candidate.directory)
    || !strictDescendant(path, expected.directory, candidate.json)
    || !strictDescendant(path, expected.directory, candidate.markdown)
    || !strictDescendant(path, expected.directory, candidate.attempt)) {
    throw new Error('invalid_evidence_path')
  }
}

export async function deriveDataChainHandoffPaths(
  request: ResolvedDataChainHandoffRequest,
): Promise<DataChainHandoffPaths> {
  const [{ DATA_CHAIN_EVIDENCE_ROOT }, { default: path }] = await Promise.all([
    import('./data-chain-smoke.ts'),
    import('node:path') as Promise<NodePathModule>,
  ])
  const root = path.resolve(DATA_CHAIN_EVIDENCE_ROOT)
  const directory = path.join(root, request.resolution.id, request.runId)
  const paths = Object.freeze({
    root,
    directory,
    json: path.join(directory, `${request.mode}.json`),
    markdown: path.join(directory, `${request.mode}.md`),
    attempt: path.join(directory, `${request.mode}.attempt`),
  })
  await assertExactDataChainHandoffPaths(request, root, paths)
  return paths
}

function classifyPair(inspection: DataChainHandoffPairInspection): DataChainHandoffRefusal | undefined {
  if (inspection.json === 'unavailable' || inspection.markdown === 'unavailable') {
    return 'evidence_pair_state_unavailable'
  }
  if (inspection.json === 'exists' && inspection.markdown === 'exists') {
    return 'evidence_pair_exists'
  }
  if (inspection.json === 'exists' || inspection.markdown === 'exists') {
    return 'evidence_pair_partial'
  }
  return undefined
}

function isHandoffReady(
  request: ResolvedDataChainHandoffRequest,
  result: DataChainHandoffVerificationResult,
): result is DataChainHandoffVerificationResult & { evidence: { itemId: string } } {
  const { evidence } = result
  return result.exitCode === 2
    && result.outcome === 'pending'
    && result.provesExternalChain === false
    && evidence.mode === request.mode
    && evidence.targetId === request.resolution.id
    && evidence.runId === request.runId
    && evidence.ingestState === 'resolved_pending_observation'
    && evidence.aggregate === 'pending'
    && typeof evidence.itemCode === 'string'
    && evidence.itemCode.length > 0
    && typeof evidence.itemId === 'string'
    && evidence.itemId.length > 0
}

export async function invokeOfficialDataChainRemotePreflight(
  request: ResolvedDataChainHandoffRequest,
): Promise<'passed' | 'unmet'> {
  const [{ spawnSync }, { packageManagerInvocation }, { pickRuntimeEnvironment }, processModule] = await Promise.all([
    import('node:child_process'),
    import('./package-manager-command.ts'),
    import('./target-profile.ts'),
    import('node:process'),
  ])
  const process = processModule.default
  const environment = pickRuntimeEnvironment(process.env, request.resolution.profile.account.id)
  if (process.env.CLOUDFLARE_API_TOKEN) {
    environment.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
  }
  const invocation = packageManagerInvocation([
    'target-profile',
    'preflight',
    '--target',
    request.resolution.id,
    '--scope',
    'remote',
    '--command',
    'smoke',
    '--ci-environment',
    request.resolution.profile.ci.githubEnvironment,
    '--live',
  ])
  const child = spawnSync(invocation.command, invocation.args, {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...environment,
      CI: process.env.CI ?? 'true',
      WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS ?? 'false',
      NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER ?? '1',
    },
    shell: false,
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  return child.status === 0 ? 'passed' : 'unmet'
}

export async function writeDataChainRemotePreflightCheckpointPair(
  request: ResolvedDataChainHandoffRequest,
  paths: DataChainHandoffPaths,
  dependencies: Pick<DataChainHandoffDependencies, 'storage' | 'now'>,
): Promise<'written' | 'unavailable'> {
  const {
    createDataChainCandidate,
    createPreIngestEvidence,
    renderDataChainEvidenceMarkdown,
    serializeDataChainEvidenceJson,
  } = await import('../packages/config/src/deployment-target/data-chain-evidence.ts')
  const evidence = createPreIngestEvidence({
    targetId: request.resolution.id,
    runId: request.runId,
    candidateItemCode: createDataChainCandidate({ targetId: request.resolution.id, runId: request.runId }).itemCode,
    mode: request.mode,
    timestamp: dependencies.now?.() ?? new Date().toISOString(),
    observation: {
      surface: 'remote_preflight',
      status: 'checkpoint',
      checkpoint: 'target_preflight_unmet',
    },
  })
  return dependencies.storage.writePair(paths, {
    json: serializeDataChainEvidenceJson(evidence),
    markdown: renderDataChainEvidenceMarkdown(evidence),
  })
}

export async function runDataChainHandoffCore(
  request: ResolvedDataChainHandoffRequest,
  dependencies: DataChainHandoffDependencies,
): Promise<DataChainHandoffResult> {
  if (!isTargetProfileId(request.resolution.id)
    || request.resolution.profile.id !== request.resolution.id
    || !validRunId(request.runId)) {
    return emit(refusal('invalid_target', 'not_applicable', 0), dependencies.resultSink)
  }

  let paths: DataChainHandoffPaths
  try {
    paths = await deriveDataChainHandoffPaths(request)
  }
  catch {
    return emit(refusal('invalid_evidence_path', 'not_applicable', 0), dependencies.resultSink)
  }

  let pair: DataChainHandoffPairInspection
  try {
    pair = await dependencies.storage.inspectPair(paths)
  }
  catch {
    return emit(refusal('evidence_pair_state_unavailable', 'not_applicable', 0), dependencies.resultSink)
  }
  const pairRefusal = classifyPair(pair)
  if (pairRefusal) {
    return emit(refusal(pairRefusal, 'not_applicable', 0), dependencies.resultSink)
  }

  let reservation: 'reserved' | 'exists' | 'unavailable'
  try {
    reservation = await dependencies.storage.reserveAttempt(paths)
  }
  catch {
    reservation = 'unavailable'
  }
  if (reservation === 'exists') {
    return emit(refusal('attempt_already_reserved', 'not_applicable', 0), dependencies.resultSink)
  }
  if (reservation !== 'reserved') {
    return emit(refusal('attempt_reservation_unavailable', 'not_applicable', 0), dependencies.resultSink)
  }

  if (request.mode === 'remote') {
    let preflight: 'passed' | 'unmet'
    try {
      preflight = await dependencies.invokeRemotePreflight(request)
    }
    catch {
      preflight = 'unmet'
    }
    if (preflight === 'unmet') {
      const wrote = await writeDataChainRemotePreflightCheckpointPair(request, paths, dependencies)
        .catch(() => 'unavailable' as const)
      if (wrote === 'written') {
        try {
          await dependencies.invokeVerifier(request, paths)
        }
        catch {
          // The persistent marker intentionally prevents retry after verifier failure.
        }
      }
      return emit(refusal('handoff_not_ready', 'unmet', 0), dependencies.resultSink)
    }

    try {
      await dependencies.invokeRunner(request)
    }
    catch {
      return emit(refusal('handoff_not_ready', 'passed', 1), dependencies.resultSink)
    }
    try {
      const verification = await dependencies.invokeVerifier(request, paths)
      if (isHandoffReady(request, verification)) {
        return emit({
          exitCode: 0,
          outcome: 'pending',
          handoffReady: true,
          preflightStatus: 'passed',
          runnerInvocations: 1,
          itemCode: verification.evidence.itemCode,
          itemId: verification.evidence.itemId,
        }, dependencies.resultSink)
      }
    }
    catch {
      // The marker remains the permanent owner after any verifier failure.
    }
    return emit(refusal('handoff_not_ready', 'passed', 1), dependencies.resultSink)
  }

  try {
    await dependencies.invokeRunner(request)
    const verification = await dependencies.invokeVerifier(request, paths)
    if (isHandoffReady(request, verification)) {
      return emit({
        exitCode: 0,
        outcome: 'pending',
        handoffReady: true,
        preflightStatus: 'not_applicable',
        runnerInvocations: 1,
        itemCode: verification.evidence.itemCode,
        itemId: verification.evidence.itemId,
      }, dependencies.resultSink)
    }
  }
  catch {
    // Any runner or verifier failure remains closed and leaves the marker intact.
  }
  return emit(refusal('handoff_not_ready', 'not_applicable', 1), dependencies.resultSink)
}

export async function createProductionDataChainHandoffDependencies(
  _request: ResolvedDataChainHandoffRequest,
): Promise<DataChainHandoffDependencies> {
  const [{ lstat, mkdir, open, readFile, writeFile }, { default: path }, { DATA_CHAIN_EVIDENCE_ROOT, runDataChainSmoke }, { inspectDataChainSmokeVerification }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path') as Promise<NodePathModule>,
    import('./data-chain-smoke.ts'),
    import('./verify-data-chain-smoke.ts'),
  ])
  const storage: DataChainHandoffStorageAdapter = {
    async inspectPair(paths) {
      const inspect = async (file: string): Promise<'missing' | 'exists' | 'unavailable'> => {
        try {
          await lstat(file)
          return 'exists'
        }
        catch (error) {
          return error instanceof Error && 'code' in error && error.code === 'ENOENT'
            ? 'missing'
            : 'unavailable'
        }
      }
      const [json, markdown] = await Promise.all([inspect(paths.json), inspect(paths.markdown)])
      return { json, markdown }
    },
    async readPair(paths) {
      try {
        const [json, markdown] = await Promise.all([readFile(paths.json, 'utf8'), readFile(paths.markdown, 'utf8')])
        return { json, markdown }
      }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return undefined
        }
        throw error
      }
    },
    async writePair(paths, pair) {
      try {
        await mkdir(path.dirname(paths.json), { recursive: true })
        await writeFile(paths.json, pair.json, 'utf8')
        await writeFile(paths.markdown, pair.markdown, 'utf8')
        return 'written'
      }
      catch {
        return 'unavailable'
      }
    },
    async reserveAttempt(paths) {
      try {
        await mkdir(path.dirname(paths.attempt), { recursive: true })
        const handle = await open(paths.attempt, 'wx')
        await handle.close()
        return 'reserved'
      }
      catch (error) {
        return error instanceof Error && 'code' in error && error.code === 'EEXIST'
          ? 'exists'
          : 'unavailable'
      }
    },
  }

  return {
    storage,
    invokeRemotePreflight: invokeOfficialDataChainRemotePreflight,
    async invokeRunner(input) {
      await runDataChainSmoke({
        mode: input.mode,
        target: input.resolution.id,
        runId: input.runId,
        evidenceRoot: DATA_CHAIN_EVIDENCE_ROOT,
      })
    },
    async invokeVerifier(input, paths) {
      const verification = await inspectDataChainSmokeVerification({
        mode: input.mode,
        target: input.resolution.id,
        runId: input.runId,
        evidenceRoot: DATA_CHAIN_EVIDENCE_ROOT,
      }, {
        read: async (file) => {
          if (file !== paths.json && file !== paths.markdown) {
            return undefined
          }
          const pair = await storage.readPair(paths)
          return file === paths.json ? pair?.json : pair?.markdown
        },
      })
      return verification
    },
  }
}

function defaultResultSink(result: DataChainHandoffResult): void {
  console.log(JSON.stringify({
    outcome: result.outcome,
    handoffReady: result.handoffReady,
    preflightStatus: result.preflightStatus,
    runnerInvocations: result.runnerInvocations,
    ...(result.handoffReady ? { itemCode: result.itemCode, itemId: result.itemId } : {}),
  }))
}

export async function runDataChainHandoffCli(
  argv: readonly string[],
  dependencies: DataChainHandoffCliDependencies = {},
): Promise<0 | 1> {
  const sink = dependencies.resultSink ?? defaultResultSink
  let parsed: DataChainHandoffParsedArgs
  try {
    parsed = parseDataChainHandoffArgs(argv)
  }
  catch {
    sink(refusal('invalid_target', 'not_applicable', 0))
    return 1
  }

  let request: ResolvedDataChainHandoffRequest | undefined
  try {
    request = validateResolvedDataChainHandoffRequest(parsed, resolveTargetProfile(parsed.target))
  }
  catch {
    request = undefined
  }
  if (!request) {
    sink(refusal('invalid_target', 'not_applicable', 0))
    return 1
  }

  const coreDependencies = await (dependencies.createDependencies
    ? dependencies.createDependencies(request)
    : createProductionDataChainHandoffDependencies(request))
  const result = await runDataChainHandoffCore(request, {
    ...coreDependencies,
    resultSink: sink,
  })
  return result.exitCode
}
