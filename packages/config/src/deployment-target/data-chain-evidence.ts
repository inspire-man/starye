/** D-01, D-03, D-06: immutable, allowlisted data-chain evidence contract. */

export const CHECKPOINT_EXIT_CODE = 2
export const LOCAL_GATEWAY_ORIGIN = 'http://localhost:8080'
/** Phase 13's controlled ingest is exactly one item and never a corpus crawl. */
export const DATA_CHAIN_FIXTURE_COUNT = 1 as const

export const dataChainModeValues = ['local', 'remote'] as const
export type DataChainMode = (typeof dataChainModeValues)[number]

export const dataChainSurfaceValues = [
  'local_projection',
  'local_d1_readiness',
  'service_readiness',
  'gateway_auth',
  'remote_preflight',
  'd1',
  'api',
  'dashboard',
  'viewer',
] as const
export type DataChainSurface = (typeof dataChainSurfaceValues)[number]

export const dataChainObservationStatusValues = ['passed', 'failed', 'checkpoint'] as const
export type DataChainObservationStatus = (typeof dataChainObservationStatusValues)[number]

export const dataChainCheckpointValues = [
  'target_projection_unmet',
  'local_d1_unready',
  'local_d1_readiness_unmet',
  'fixture_seed_incomplete',
  'service_unavailable',
  'local_prerequisite_unmet',
  'gateway_auth_unavailable',
  'target_preflight_unmet',
  'canonical_api_unavailable',
  'dashboard_auth_unavailable',
  'canonical_viewer_unavailable',
] as const
export type DataChainCheckpoint = (typeof dataChainCheckpointValues)[number]

export interface DataChainObservation {
  surface: DataChainSurface
  status: DataChainObservationStatus
  checkpoint?: DataChainCheckpoint
  path?: string
  origin?: typeof LOCAL_GATEWAY_ORIGIN
  attempt?: number
  /** Present only for the successful, primary D1 row. */
  itemCount?: typeof DATA_CHAIN_FIXTURE_COUNT
}

interface DataChainEvidenceBase {
  version: 1
  mode: DataChainMode
  timestamp: string
  targetId: string
  runId: string
  itemCode: string
  observations: readonly DataChainObservation[]
}

export interface PreIngestDataChainEvidence extends DataChainEvidenceBase {
  ingestState: 'pre_ingest'
  aggregate: 'failed' | 'checkpoint'
  itemId: null
}

export interface ResolvedPendingDataChainEvidence extends DataChainEvidenceBase {
  ingestState: 'resolved_pending_observation'
  aggregate: 'pending' | 'failed' | 'checkpoint'
  itemId: string
}

export interface ResolvedDataChainEvidence extends DataChainEvidenceBase {
  ingestState: 'resolved'
  aggregate: 'passed'
  itemId: string
}

export type DataChainEvidence
  = | PreIngestDataChainEvidence
    | ResolvedPendingDataChainEvidence
    | ResolvedDataChainEvidence

export interface DataChainCandidate {
  itemCode: string
  fixture: {
    movies: readonly [{
      code: string
      title: string
      isAdult: false
      players: readonly [{ name: 'phase13-smoke' }]
    }]
  }
}

export interface CreateDataChainCandidateInput {
  targetId: string
  runId: string
}

export interface CreatePreIngestDataChainEvidenceInput {
  targetId: string
  runId: string
  candidateItemCode: string
  mode: DataChainMode
  timestamp: string
  observation: DataChainObservation
}

export interface CreateResolvedPendingDataChainEvidenceInput {
  targetId: string
  runId: string
  itemCode: string
  itemId: string
  mode: DataChainMode
  timestamp: string
  observations: readonly DataChainObservation[]
  aggregate?: ResolvedPendingDataChainEvidence['aggregate']
}

export interface BrowserObservationInput {
  targetId: string
  runId: string
  itemCode: string
  itemId: string
  surface: 'dashboard' | 'viewer'
  status: DataChainObservationStatus
  checkpoint?: DataChainCheckpoint
}

export interface BrowserObservationAppendResult {
  evidence: ResolvedPendingDataChainEvidence | ResolvedDataChainEvidence
  exitCode: 0 | typeof CHECKPOINT_EXIT_CODE
}

export interface RemoteEligibilityInput {
  targetId: string
  runId: string
  itemCode: string
  itemId: string
}

const preIngestSurfaceValues = [
  'local_projection',
  'local_d1_readiness',
  'service_readiness',
  'gateway_auth',
  'remote_preflight',
] as const satisfies readonly DataChainSurface[]

const localResolvedSurfaceValues = [
  'local_projection',
  'local_d1_readiness',
  'service_readiness',
  'gateway_auth',
  'd1',
  'api',
  'dashboard',
  'viewer',
] as const satisfies readonly DataChainSurface[]

const remoteResolvedSurfaceValues = [
  'remote_preflight',
  'd1',
  'api',
  'dashboard',
  'viewer',
] as const satisfies readonly DataChainSurface[]

const evidenceKeys = [
  'version',
  'mode',
  'timestamp',
  'targetId',
  'runId',
  'itemCode',
  'itemId',
  'ingestState',
  'aggregate',
  'observations',
] as const

const observationKeys = ['surface', 'status', 'checkpoint', 'path', 'origin', 'attempt', 'itemCount'] as const
const browserInputKeys = ['targetId', 'runId', 'itemCode', 'itemId', 'surface', 'status', 'checkpoint'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

function stableHash(value: string): string {
  let hash = 0x811C9DC5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function codeSegment(value: string): string {
  const segment = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return segment || 'target'
}

function expectedCanonicalPath(surface: 'gateway_auth' | 'api' | 'dashboard' | 'viewer', itemCode: string): string {
  switch (surface) {
    case 'gateway_auth': return '/auth/'
    case 'api': return `/api/public/movies/${itemCode}`
    case 'dashboard': return '/dashboard/movies'
    case 'viewer': return `/movie/${itemCode}`
  }
}

function isCanonicalRouteSurface(value: unknown): value is 'gateway_auth' | 'api' | 'dashboard' | 'viewer' {
  return value === 'gateway_auth' || value === 'api' || value === 'dashboard' || value === 'viewer'
}

function requiredResolvedSurfaces(mode: DataChainMode): readonly DataChainSurface[] {
  return mode === 'local' ? localResolvedSurfaceValues : remoteResolvedSurfaceValues
}

function isPreIngestSurface(value: unknown): value is (typeof preIngestSurfaceValues)[number] {
  return hasValue(preIngestSurfaceValues, value)
}

function assertValidEvidence(evidence: unknown): asserts evidence is DataChainEvidence {
  const issues = validateDataChainEvidence(evidence)

  if (issues.length > 0) {
    throw new Error(`Invalid data-chain evidence: ${issues.join(' ')}`)
  }
}

function assertInputKeys(value: unknown, allowedKeys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`)
  }

  const unexpected = Object.keys(value).find(key => !allowedKeys.includes(key))

  if (unexpected) {
    throw new Error(`Unexpected ${label} key: ${unexpected}.`)
  }
}

function cloneObservation(observation: DataChainObservation): DataChainObservation {
  return {
    surface: observation.surface,
    status: observation.status,
    ...(observation.checkpoint ? { checkpoint: observation.checkpoint } : {}),
    ...(observation.path ? { path: observation.path } : {}),
    ...(observation.origin ? { origin: observation.origin } : {}),
    ...(observation.attempt ? { attempt: observation.attempt } : {}),
    ...(observation.itemCount !== undefined ? { itemCount: observation.itemCount } : {}),
  }
}

function cloneEvidence(evidence: DataChainEvidence): DataChainEvidence {
  return {
    version: evidence.version,
    mode: evidence.mode,
    timestamp: evidence.timestamp,
    targetId: evidence.targetId,
    runId: evidence.runId,
    itemCode: evidence.itemCode,
    itemId: evidence.itemId,
    ingestState: evidence.ingestState,
    aggregate: evidence.aggregate,
    observations: evidence.observations.map(cloneObservation),
  } as DataChainEvidence
}

/** D-01: only explicit target/run input may derive the one-item fixture identity. */
export function createDataChainCandidate(input: CreateDataChainCandidateInput): DataChainCandidate {
  if (!hasText(input.targetId) || !hasText(input.runId)) {
    throw new Error('Data-chain fixture identity requires explicit targetId and runId.')
  }

  const itemCode = `p13-smoke-${codeSegment(input.targetId)}-${stableHash(`phase13:${input.targetId}:${input.runId}`)}`

  return {
    itemCode,
    fixture: {
      movies: [{
        code: itemCode,
        title: `Phase 13 smoke ${itemCode}`,
        isAdult: false,
        players: [{ name: 'phase13-smoke' }],
      }],
    },
  }
}

/** D-01: expose the one primary code derived solely from the explicit identity. */
export function createDataChainFixtureCodes(input: CreateDataChainCandidateInput): readonly string[] {
  const primaryCode = createDataChainCandidate(input).itemCode
  return [primaryCode]
}

/** D-03: pre-ingest evidence is terminal only for an unmet prerequisite. */
export function createPreIngestEvidence(
  input: CreatePreIngestDataChainEvidenceInput,
): PreIngestDataChainEvidence {
  const evidence: PreIngestDataChainEvidence = {
    version: 1,
    mode: input.mode,
    timestamp: input.timestamp,
    targetId: input.targetId,
    runId: input.runId,
    itemCode: input.candidateItemCode,
    itemId: null,
    ingestState: 'pre_ingest',
    aggregate: input.observation.status === 'failed' ? 'failed' : 'checkpoint',
    observations: [cloneObservation(input.observation)],
  }

  assertValidEvidence(evidence)
  return evidence
}

/** D-01, D-06: snapshot-resolved tuples remain immutable while observations are pending. */
export function createResolvedPendingEvidence(
  input: CreateResolvedPendingDataChainEvidenceInput,
): ResolvedPendingDataChainEvidence {
  const evidence: ResolvedPendingDataChainEvidence = {
    version: 1,
    mode: input.mode,
    timestamp: input.timestamp,
    targetId: input.targetId,
    runId: input.runId,
    itemCode: input.itemCode,
    itemId: input.itemId,
    ingestState: 'resolved_pending_observation',
    aggregate: input.aggregate ?? 'pending',
    observations: input.observations.map(cloneObservation),
  }

  assertValidEvidence(evidence)
  return evidence
}

/** D-06: validates lifecycle, tuple, canonical-path, and allowlist invariants without changing state. */
export function validateDataChainEvidence(evidence: unknown): readonly string[] {
  const issues: string[] = []

  if (!isRecord(evidence)) {
    return ['Evidence must be an object.']
  }

  const unexpectedEvidenceKey = Object.keys(evidence).find(key => !evidenceKeys.includes(key as (typeof evidenceKeys)[number]))
  if (unexpectedEvidenceKey) {
    issues.push(`Unexpected evidence key: ${unexpectedEvidenceKey}.`)
  }

  if (evidence.version !== 1) {
    issues.push('Evidence version must be 1.')
  }
  if (!hasValue(dataChainModeValues, evidence.mode)) {
    issues.push('Evidence mode is invalid.')
  }
  if (!hasText(evidence.timestamp) || Number.isNaN(Date.parse(evidence.timestamp))) {
    issues.push('Evidence timestamp is invalid.')
  }
  for (const key of ['targetId', 'runId', 'itemCode'] as const) {
    if (!hasText(evidence[key])) {
      issues.push(`Evidence ${key} must be non-empty.`)
    }
  }
  if (
    hasText(evidence.targetId)
    && hasText(evidence.runId)
    && hasText(evidence.itemCode)
    && evidence.itemCode !== createDataChainCandidate({ targetId: evidence.targetId, runId: evidence.runId }).itemCode
  ) {
    issues.push('Evidence itemCode must match the target/run-derived primary code.')
  }

  const observations = evidence.observations
  if (!Array.isArray(observations) || observations.length === 0 || observations.length > 12) {
    issues.push('Evidence observations must contain between 1 and 12 rows.')
  }

  const parsedObservations: DataChainObservation[] = []
  if (Array.isArray(observations)) {
    observations.forEach((observation, index) => {
      if (!isRecord(observation)) {
        issues.push(`Observation ${index} must be an object.`)
        return
      }

      const unexpectedObservationKey = Object.keys(observation).find(key => !observationKeys.includes(key as (typeof observationKeys)[number]))
      if (unexpectedObservationKey) {
        issues.push(`Unexpected observation key: ${unexpectedObservationKey}.`)
      }
      if (!hasValue(dataChainSurfaceValues, observation.surface)) {
        issues.push(`Observation ${index} surface is invalid.`)
      }
      if (!hasValue(dataChainObservationStatusValues, observation.status)) {
        issues.push(`Observation ${index} status is invalid.`)
      }
      if (observation.checkpoint !== undefined && !hasValue(dataChainCheckpointValues, observation.checkpoint)) {
        issues.push(`Observation ${index} checkpoint is invalid.`)
      }
      if (observation.status === 'checkpoint' && observation.checkpoint === undefined) {
        issues.push(`Observation ${index} checkpoint status requires a checkpoint code.`)
      }
      if (observation.attempt !== undefined && (typeof observation.attempt !== 'number' || !Number.isInteger(observation.attempt) || observation.attempt < 1)) {
        issues.push(`Observation ${index} attempt must be a positive integer.`)
      }
      if (observation.itemCount !== undefined && (
        observation.surface !== 'd1'
        || observation.status !== 'passed'
        || observation.itemCount !== DATA_CHAIN_FIXTURE_COUNT
      )) {
        issues.push(`Observation ${index} itemCount is only allowed for the exact successful primary D1 row.`)
      }
      if (observation.surface === 'd1' && observation.status === 'passed' && observation.itemCount !== DATA_CHAIN_FIXTURE_COUNT) {
        issues.push(`Observation ${index} passed D1 row requires itemCount ${DATA_CHAIN_FIXTURE_COUNT}.`)
      }
      if (observation.path !== undefined && (typeof observation.path !== 'string' || !observation.path.startsWith('/') || observation.path.startsWith('//'))) {
        issues.push(`Observation ${index} path must be target-relative.`)
      }
      if (observation.origin !== undefined && observation.origin !== LOCAL_GATEWAY_ORIGIN) {
        issues.push(`Observation ${index} origin must be the local Gateway.`)
      }
      if (observation.origin !== undefined && evidence.mode !== 'local') {
        issues.push(`Observation ${index} remote evidence must not persist an origin.`)
      }
      const canonicalSurface = isCanonicalRouteSurface(observation.surface) ? observation.surface : undefined
      if (!canonicalSurface && (observation.path !== undefined || observation.origin !== undefined)) {
        issues.push(`Observation ${index} only Gateway route surfaces may contain a path or origin.`)
      }
      if (canonicalSurface && observation.path !== undefined && observation.path !== expectedCanonicalPath(canonicalSurface, String(evidence.itemCode))) {
        issues.push(`Observation ${index} Gateway route path is not canonical.`)
      }

      if (hasValue(dataChainSurfaceValues, observation.surface) && hasValue(dataChainObservationStatusValues, observation.status)) {
        parsedObservations.push({
          surface: observation.surface,
          status: observation.status,
          ...(hasValue(dataChainCheckpointValues, observation.checkpoint) ? { checkpoint: observation.checkpoint } : {}),
          ...(typeof observation.path === 'string' ? { path: observation.path } : {}),
          ...(observation.origin === LOCAL_GATEWAY_ORIGIN ? { origin: observation.origin } : {}),
          ...(typeof observation.attempt === 'number' ? { attempt: observation.attempt } : {}),
          ...(observation.itemCount === DATA_CHAIN_FIXTURE_COUNT ? { itemCount: observation.itemCount } : {}),
        })
      }
    })
  }

  const browserObservations = parsedObservations.filter(row => row.surface === 'dashboard' || row.surface === 'viewer')
  if (browserObservations.length > 2) {
    issues.push('Browser observation history may contain only Dashboard then viewer.')
  }
  if (browserObservations[0]?.surface === 'viewer') {
    issues.push('Viewer observation requires a preceding Dashboard observation.')
  }
  if (browserObservations[0]?.surface === 'dashboard' && browserObservations[1]?.surface === 'viewer' && browserObservations[0].status !== 'passed') {
    issues.push('Viewer observation cannot follow a non-success Dashboard observation.')
  }
  if (browserObservations.some(row => row.surface === 'dashboard' && row.path !== undefined && row.path !== expectedCanonicalPath('dashboard', String(evidence.itemCode)))) {
    issues.push('Dashboard path is invalid.')
  }
  if (browserObservations.some(row => row.surface === 'viewer' && row.path !== undefined && row.path !== expectedCanonicalPath('viewer', String(evidence.itemCode)))) {
    issues.push('Viewer path is invalid.')
  }

  if (evidence.mode === 'local' && parsedObservations.some(row => row.surface === 'remote_preflight')) {
    issues.push('Local evidence cannot contain remote preflight observations.')
  }
  const remoteLocalPrerequisiteCheckpoint = evidence.mode === 'remote'
    && evidence.ingestState === 'pre_ingest'
    && parsedObservations.length === 1
    && parsedObservations[0]?.surface === 'local_projection'
    && parsedObservations[0]?.status === 'checkpoint'
    && parsedObservations[0]?.checkpoint === 'local_prerequisite_unmet'
  if (evidence.mode === 'remote' && parsedObservations.some(row => isPreIngestSurface(row.surface) && row.surface !== 'remote_preflight' && !remoteLocalPrerequisiteCheckpoint)) {
    issues.push('Remote evidence cannot repeat local prerequisite observations.')
  }

  if (evidence.ingestState === 'pre_ingest') {
    if (evidence.itemId !== null) {
      issues.push('Pre-ingest evidence must have itemId null.')
    }
    if (evidence.aggregate !== 'failed' && evidence.aggregate !== 'checkpoint') {
      issues.push('Pre-ingest aggregate must be failed or checkpoint.')
    }
    if (parsedObservations.length !== 1 || !isPreIngestSurface(parsedObservations[0]?.surface)) {
      issues.push('Pre-ingest evidence requires exactly one prerequisite observation.')
    }
    if (parsedObservations.some(row => row.status === 'passed')) {
      issues.push('Pre-ingest evidence cannot contain passed observations.')
    }
    if (browserObservations.length > 0) {
      issues.push('Pre-ingest evidence cannot contain data-surface observations.')
    }
  }
  else if (evidence.ingestState === 'resolved_pending_observation') {
    if (!hasText(evidence.itemId)) {
      issues.push('Resolved pending evidence requires a non-empty itemId.')
    }
    if (!['pending', 'failed', 'checkpoint'].includes(String(evidence.aggregate))) {
      issues.push('Resolved pending aggregate must be pending, failed, or checkpoint.')
    }
    if (evidence.aggregate === 'passed') {
      issues.push('Resolved pending evidence cannot be passed.')
    }
  }
  else if (evidence.ingestState === 'resolved') {
    if (!hasText(evidence.itemId)) {
      issues.push('Resolved evidence requires a non-empty itemId.')
    }
    if (evidence.aggregate !== 'passed') {
      issues.push('Resolved evidence aggregate must be passed.')
    }

    if (hasValue(dataChainModeValues, evidence.mode)) {
      for (const surface of requiredResolvedSurfaces(evidence.mode)) {
        if (!parsedObservations.some(row => row.surface === surface && row.status === 'passed')) {
          issues.push(`Resolved evidence requires passed ${surface}.`)
        }
      }
    }
  }
  else {
    issues.push('Evidence ingestState is invalid.')
  }

  return issues
}

/** D-06: appends only the fixed Dashboard-then-viewer observation grammar. */
export function appendBrowserObservation(
  existingEvidence: ResolvedPendingDataChainEvidence,
  input: BrowserObservationInput & { surface: 'dashboard' },
): {
  evidence: ResolvedPendingDataChainEvidence
  exitCode: typeof CHECKPOINT_EXIT_CODE
}
export function appendBrowserObservation(
  existingEvidence: ResolvedPendingDataChainEvidence,
  input: BrowserObservationInput & { surface: 'viewer' },
): BrowserObservationAppendResult
export function appendBrowserObservation(
  existingEvidence: ResolvedPendingDataChainEvidence,
  input: BrowserObservationInput,
): BrowserObservationAppendResult {
  assertValidEvidence(existingEvidence)
  assertInputKeys(input, browserInputKeys, 'browser observation input')

  if (existingEvidence.ingestState !== 'resolved_pending_observation') {
    throw new Error('Browser observation requires resolved_pending_observation evidence.')
  }
  if (existingEvidence.aggregate !== 'pending') {
    throw new Error('Browser observation cannot follow a non-success result.')
  }
  if (
    input.targetId !== existingEvidence.targetId
    || input.runId !== existingEvidence.runId
    || input.itemCode !== existingEvidence.itemCode
    || input.itemId !== existingEvidence.itemId
  ) {
    throw new Error('Browser observation tuple does not match pending evidence.')
  }
  if (input.surface !== 'dashboard' && input.surface !== 'viewer') {
    throw new Error('Browser observation surface is invalid.')
  }
  if (!hasValue(dataChainObservationStatusValues, input.status)) {
    throw new Error('Browser observation status is invalid.')
  }
  if (input.status === 'checkpoint' && !hasValue(dataChainCheckpointValues, input.checkpoint)) {
    throw new Error('Browser checkpoint requires an allowlisted checkpoint code.')
  }
  if (input.status !== 'checkpoint' && input.checkpoint !== undefined) {
    throw new Error('Browser observation may only include a checkpoint code for checkpoint status.')
  }

  const existingBrowserRows = existingEvidence.observations.filter(row => row.surface === 'dashboard' || row.surface === 'viewer')
  const dashboard = existingBrowserRows.find(row => row.surface === 'dashboard')
  const viewer = existingBrowserRows.find(row => row.surface === 'viewer')

  if (input.surface === 'dashboard' && dashboard) {
    throw new Error('Browser observation rejects duplicate Dashboard rows.')
  }
  if (input.surface === 'viewer' && viewer) {
    throw new Error('Browser observation rejects duplicate viewer rows.')
  }
  if (input.surface === 'viewer' && !dashboard) {
    throw new Error('Viewer observation requires Dashboard first.')
  }
  if (input.surface === 'viewer' && dashboard?.status !== 'passed') {
    throw new Error('Viewer observation cannot follow a non-success Dashboard row.')
  }

  const observation: DataChainObservation = {
    surface: input.surface,
    status: input.status,
    path: expectedCanonicalPath(input.surface, existingEvidence.itemCode),
    ...(existingEvidence.mode === 'local' ? { origin: LOCAL_GATEWAY_ORIGIN } : {}),
    ...(input.checkpoint ? { checkpoint: input.checkpoint } : {}),
  }
  const observations = [...existingEvidence.observations.map(cloneObservation), observation]

  if (input.surface === 'viewer' && input.status === 'passed') {
    const resolved: ResolvedDataChainEvidence = {
      ...existingEvidence,
      ingestState: 'resolved',
      aggregate: 'passed',
      observations,
    }
    assertValidEvidence(resolved)
    return { evidence: resolved, exitCode: 0 }
  }

  const pending: ResolvedPendingDataChainEvidence = {
    ...existingEvidence,
    aggregate: input.status === 'passed' ? 'pending' : input.status,
    observations,
  }
  assertValidEvidence(pending)
  return { evidence: pending, exitCode: CHECKPOINT_EXIT_CODE }
}

/** D-03, D-06: remote work may use only the exact terminal local evidence tuple. */
export function assertRemoteEligibility(
  localEvidence: unknown,
  expected: RemoteEligibilityInput,
): ResolvedDataChainEvidence {
  assertValidEvidence(localEvidence)

  if (
    localEvidence.mode !== 'local'
    || localEvidence.ingestState !== 'resolved'
    || localEvidence.aggregate !== 'passed'
  ) {
    throw new Error('Remote execution requires terminal passed local evidence.')
  }
  if (
    localEvidence.targetId !== expected.targetId
    || localEvidence.runId !== expected.runId
    || localEvidence.itemCode !== expected.itemCode
    || localEvidence.itemId !== expected.itemId
  ) {
    throw new Error('Remote execution requires the exact local evidence tuple.')
  }

  return localEvidence
}

/** D-06: schema validation reports valid pending/checkpoint artifacts as successful validation. */
export function validateDataChainEvidenceForExitCode(evidence: unknown): 0 {
  assertValidEvidence(evidence)
  return 0
}

/** D-06: writes only a validated, typed projection with no ambient runtime inputs. */
export function serializeDataChainEvidenceJson(evidence: unknown): string {
  assertValidEvidence(evidence)
  return `${JSON.stringify(cloneEvidence(evidence), null, 2)}\n`
}

/** D-06: renders the same allowlisted projection without remote origins or free-form input. */
export function renderDataChainEvidenceMarkdown(evidence: unknown): string {
  assertValidEvidence(evidence)
  const lines = [
    '# Data Chain Smoke Evidence',
    '',
    `- Target: ${evidence.targetId}`,
    `- Run: ${evidence.runId}`,
    `- Mode: ${evidence.mode}`,
    `- Timestamp: ${evidence.timestamp}`,
    `- Item code: ${evidence.itemCode}`,
    `- Item id: ${evidence.itemId ?? 'unresolved'}`,
    `- State: ${evidence.ingestState}`,
    `- Aggregate: ${evidence.aggregate}`,
    '',
    '| Surface | Status | Count | Checkpoint | Path | Origin |',
    '| --- | --- | --- | --- | --- | --- |',
    ...evidence.observations.map(row => [
      row.surface,
      row.status,
      row.itemCount ?? '',
      row.checkpoint ?? '',
      row.path ?? '',
      row.origin ?? '',
    ].join(' | ').replace(/^/, '| ').concat(' |')),
    '',
  ]

  return lines.join('\n')
}
