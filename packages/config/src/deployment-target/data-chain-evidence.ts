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

export const dataChainReceiptSourceValues = ['local_runner', 'remote_provider', 'browser_observer'] as const
export type DataChainReceiptSource = (typeof dataChainReceiptSourceValues)[number]

export const dataChainReceiptCaptureValues = [
  'local_projection',
  'local_d1_readiness',
  'service_probe',
  'gateway_auth',
  'local_fixture_snapshot',
  'remote_preflight',
  'remote_fixture_snapshot',
  'canonical_api',
  'browser_navigation',
] as const
export type DataChainReceiptCapture = (typeof dataChainReceiptCaptureValues)[number]

export const dataChainCheckpointValues = [
  'target_projection_unmet',
  'projection-mismatch',
  'local-api-token-shadowing',
  'local_d1_unready',
  'local_d1_readiness_unmet',
  'fixture_seed_incomplete',
  'service_unavailable',
  'local_prerequisite_unmet',
  'gateway_auth_unavailable',
  'gateway_auth_timeout',
  'gateway_auth_fetch_failed',
  'gateway_auth_http_status_unaccepted',
  'gateway_auth_redirect_invalid',
  'target_preflight_unmet',
  'canonical_api_unavailable',
  'dashboard_auth_unavailable',
  'canonical_viewer_unavailable',
] as const
export type DataChainCheckpoint = (typeof dataChainCheckpointValues)[number]

/** Non-secret, tuple-bound proof derived from one controlled execution observation. */
export interface DataChainExecutionReceipt {
  source: DataChainReceiptSource
  capture: DataChainReceiptCapture
  mode: DataChainMode
  targetId: string
  runId: string
  itemCode: string
  itemId: string
  surface: DataChainSurface
  path?: string
  timestamp: string
  result: 'passed'
  integrity: string
}

export type CreateDataChainExecutionReceiptInput = Omit<DataChainExecutionReceipt, 'integrity' | 'result'>

export interface DataChainObservation {
  surface: DataChainSurface
  status: DataChainObservationStatus
  checkpoint?: DataChainCheckpoint
  path?: string
  origin?: typeof LOCAL_GATEWAY_ORIGIN
  attempt?: number
  /** Present only for the successful, primary D1 row. */
  itemCount?: typeof DATA_CHAIN_FIXTURE_COUNT
  receipt?: DataChainExecutionReceipt
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
  receipt?: DataChainExecutionReceipt
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

const observationKeys = ['surface', 'status', 'checkpoint', 'path', 'origin', 'attempt', 'itemCount', 'receipt'] as const
const browserInputKeys = ['targetId', 'runId', 'itemCode', 'itemId', 'surface', 'status', 'checkpoint', 'receipt'] as const
const receiptKeys = [
  'source',
  'capture',
  'mode',
  'targetId',
  'runId',
  'itemCode',
  'itemId',
  'surface',
  'path',
  'timestamp',
  'result',
  'integrity',
] as const
const receiptInputKeys = ['source', 'capture', 'mode', 'targetId', 'runId', 'itemCode', 'itemId', 'surface', 'path', 'timestamp'] as const

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

function receiptIntegrity(receipt: Omit<DataChainExecutionReceipt, 'integrity'>): string {
  return stableHash([
    receipt.source,
    receipt.capture,
    receipt.mode,
    receipt.targetId,
    receipt.runId,
    receipt.itemCode,
    receipt.itemId,
    receipt.surface,
    receipt.path ?? '',
    receipt.timestamp,
    receipt.result,
  ].join('\u0000'))
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

function expectedReceiptSource(mode: DataChainMode, surface: DataChainSurface): DataChainReceiptSource {
  if (surface === 'dashboard' || surface === 'viewer') {
    return 'browser_observer'
  }

  return mode === 'local' ? 'local_runner' : 'remote_provider'
}

function expectedReceiptCapture(mode: DataChainMode, surface: DataChainSurface): DataChainReceiptCapture | undefined {
  switch (surface) {
    case 'local_projection': return mode === 'local' ? 'local_projection' : undefined
    case 'local_d1_readiness': return mode === 'local' ? 'local_d1_readiness' : undefined
    case 'service_readiness': return mode === 'local' ? 'service_probe' : undefined
    case 'gateway_auth': return mode === 'local' ? 'gateway_auth' : undefined
    case 'remote_preflight': return mode === 'remote' ? 'remote_preflight' : undefined
    case 'd1': return mode === 'local' ? 'local_fixture_snapshot' : 'remote_fixture_snapshot'
    case 'api': return 'canonical_api'
    case 'dashboard':
    case 'viewer': return 'browser_navigation'
  }
}

function receiptPathIsExpected(surface: DataChainSurface, itemCode: string, path: unknown): boolean {
  if (surface === 'gateway_auth' || surface === 'api' || surface === 'dashboard' || surface === 'viewer') {
    return path === expectedCanonicalPath(surface, itemCode)
  }

  return path === undefined
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
    ...(observation.receipt ? { receipt: { ...observation.receipt } } : {}),
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

/** D-07: generates a deterministic integrity binding for allowlisted receipt metadata only. */
export function createDataChainExecutionReceipt(
  input: CreateDataChainExecutionReceiptInput,
): DataChainExecutionReceipt {
  assertInputKeys(input, receiptInputKeys, 'data-chain receipt input')

  const receipt: Omit<DataChainExecutionReceipt, 'integrity'> = {
    ...input,
    result: 'passed',
  }

  return {
    ...receipt,
    integrity: receiptIntegrity(receipt),
  }
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

      let parsedReceipt: DataChainExecutionReceipt | undefined
      if (observation.receipt !== undefined) {
        if (!isRecord(observation.receipt)) {
          issues.push(`Observation ${index} receipt must be an object.`)
        }
        else {
          const receipt = observation.receipt
          const unexpectedReceiptKey = Object.keys(receipt).find(key => !receiptKeys.includes(key as (typeof receiptKeys)[number]))
          if (unexpectedReceiptKey) {
            issues.push(`Observation ${index} receipt has an unexpected key: ${unexpectedReceiptKey}.`)
          }
          if (!hasValue(dataChainReceiptSourceValues, receipt.source)) {
            issues.push(`Observation ${index} receipt source is invalid.`)
          }
          if (!hasValue(dataChainReceiptCaptureValues, receipt.capture)) {
            issues.push(`Observation ${index} receipt capture is invalid.`)
          }
          if (!hasValue(dataChainModeValues, receipt.mode) || receipt.mode !== evidence.mode) {
            issues.push(`Observation ${index} receipt mode does not match evidence.`)
          }
          for (const key of ['targetId', 'runId', 'itemCode', 'itemId'] as const) {
            if (!hasText(receipt[key]) || receipt[key] !== evidence[key]) {
              issues.push(`Observation ${index} receipt ${key} does not match evidence.`)
            }
          }
          if (receipt.surface !== observation.surface) {
            issues.push(`Observation ${index} receipt surface does not match observation.`)
          }
          if (!hasText(receipt.timestamp) || !receipt.timestamp.endsWith('Z') || Number.isNaN(Date.parse(receipt.timestamp))) {
            issues.push(`Observation ${index} receipt timestamp must be a UTC instant.`)
          }
          if (receipt.result !== 'passed') {
            issues.push(`Observation ${index} receipt result must be passed.`)
          }
          if (!receiptPathIsExpected(observation.surface as DataChainSurface, String(evidence.itemCode), receipt.path)) {
            issues.push(`Observation ${index} receipt path is not canonical.`)
          }

          const expectedSource = hasValue(dataChainModeValues, evidence.mode) && hasValue(dataChainSurfaceValues, observation.surface)
            ? expectedReceiptSource(evidence.mode, observation.surface)
            : undefined
          const expectedCapture = hasValue(dataChainModeValues, evidence.mode) && hasValue(dataChainSurfaceValues, observation.surface)
            ? expectedReceiptCapture(evidence.mode, observation.surface)
            : undefined
          if (receipt.source !== expectedSource) {
            issues.push(`Observation ${index} receipt source is not allowed for this surface.`)
          }
          if (receipt.capture !== expectedCapture) {
            issues.push(`Observation ${index} receipt capture is not allowed for this surface.`)
          }
          if (observation.status !== 'passed') {
            issues.push(`Observation ${index} only passed rows may carry a receipt.`)
          }

          if (
            hasValue(dataChainReceiptSourceValues, receipt.source)
            && hasValue(dataChainReceiptCaptureValues, receipt.capture)
            && hasValue(dataChainModeValues, receipt.mode)
            && hasText(receipt.targetId)
            && hasText(receipt.runId)
            && hasText(receipt.itemCode)
            && hasText(receipt.itemId)
            && hasValue(dataChainSurfaceValues, receipt.surface)
            && (receipt.path === undefined || typeof receipt.path === 'string')
            && hasText(receipt.timestamp)
            && receipt.result === 'passed'
            && typeof receipt.integrity === 'string'
          ) {
            const withoutIntegrity: Omit<DataChainExecutionReceipt, 'integrity'> = {
              source: receipt.source,
              capture: receipt.capture,
              mode: receipt.mode,
              targetId: receipt.targetId,
              runId: receipt.runId,
              itemCode: receipt.itemCode,
              itemId: receipt.itemId,
              surface: receipt.surface,
              ...(receipt.path !== undefined ? { path: receipt.path } : {}),
              timestamp: receipt.timestamp,
              result: 'passed',
            }
            if (!/^[a-f0-9]{8}$/.test(receipt.integrity) || receipt.integrity !== receiptIntegrity(withoutIntegrity)) {
              issues.push(`Observation ${index} receipt integrity is invalid.`)
            }
            else {
              parsedReceipt = { ...withoutIntegrity, integrity: receipt.integrity }
            }
          }
        }
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
          ...(parsedReceipt ? { receipt: parsedReceipt } : {}),
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
      if (requiredResolvedSurfaces(evidence.mode).some(surface => !parsedObservations.some(row => (
        row.surface === surface && row.status === 'passed' && row.receipt !== undefined
      )))) {
        issues.push('Resolved evidence requires a provenance receipt for every passed required surface.')
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
  if (input.status === 'passed' && input.receipt === undefined) {
    throw new Error('Browser passed observation requires a controlled execution receipt.')
  }
  if (input.status !== 'passed' && input.receipt !== undefined) {
    throw new Error('Browser non-success observation cannot carry an execution receipt.')
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
    ...(input.receipt ? { receipt: { ...input.receipt } } : {}),
  }
  const observations = [...existingEvidence.observations.map(cloneObservation), observation]

  const receiptIssues = validateDataChainEvidence({
    ...existingEvidence,
    observations,
  })
  if (receiptIssues.length > 0) {
    throw new Error(`Browser observation receipt is invalid: ${receiptIssues.join(' ')}`)
  }

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
    '| Surface | Status | Count | Checkpoint | Path | Origin | Receipt source | Capture | Result | Captured at | Integrity |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...evidence.observations.map(row => [
      row.surface,
      row.status,
      row.itemCount ?? '',
      row.checkpoint ?? '',
      row.path ?? '',
      row.origin ?? '',
      row.receipt?.source ?? '',
      row.receipt?.capture ?? '',
      row.receipt?.result ?? '',
      row.receipt?.timestamp ?? '',
      row.receipt?.integrity ?? '',
    ].join(' | ').replace(/^/, '| ').concat(' |')),
    '',
  ]

  return lines.join('\n')
}

/** Phase 19 keeps local contract proof separate from credentialed provider sign-off. */
export const phase19EvidenceModeValues = ['local_contract', 'credentialed_provider'] as const
export type Phase19EvidenceMode = (typeof phase19EvidenceModeValues)[number]

export const phase19EvidenceStatusValues = ['passed', 'failed', 'checkpoint'] as const
export type Phase19EvidenceStatus = (typeof phase19EvidenceStatusValues)[number]

export const phase19EvidenceTemplateValues = ['movie', 'manga'] as const
export type Phase19EvidenceTemplate = (typeof phase19EvidenceTemplateValues)[number]

export const phase19EvidenceCrudStatusValues = ['passed', 'failed', 'checkpoint'] as const
export type Phase19EvidenceCrudStatus = (typeof phase19EvidenceCrudStatusValues)[number]

export const phase19EvidenceCommandValues = [
  'phase19-local-proof',
  'phase19-provider-signoff',
] as const
export type Phase19EvidenceCommand = (typeof phase19EvidenceCommandValues)[number]

export const PHASE19_LOCAL_TARGET = 'local-gateway'
export const PHASE19_LOCAL_WORKFLOW = 'local-contract'
export const PHASE19_LOCAL_REPOSITORY = 'local-contract'
export const PHASE19_LOCAL_REF = 'fixture'
export const PHASE19_LOCAL_ENVIRONMENT = 'local'
export const PHASE19_PROVIDER = 'github-actions'
export const PHASE19_PROVIDER_TARGET = 'starye-org'
export const PHASE19_PROVIDER_REPOSITORY = 'inspire-man/starye'
export const PHASE19_PROVIDER_REF = 'main'
export const PHASE19_PROVIDER_ENVIRONMENT = 'starye-org'
export const PHASE19_PROVIDER_WORKFLOW_VALUES = [
  '.github/workflows/daily-manga-crawl.yml',
  '.github/workflows/daily-movie-crawl.yml',
] as const

export interface Phase19ProviderFacts {
  runId: string
  attempt: number
  sha: string
  url: string
}

export interface Phase19ValidatedReceipt {
  validated: true
  source: 'local_runner' | 'remote_provider'
  template: Phase19EvidenceTemplate
  primaryContentId: string
  createdCount: number
  updatedCount: number
}

export interface Phase19CrudEvidence {
  mutation: Phase19EvidenceCrudStatus
  readback: Phase19EvidenceCrudStatus
  restore: Phase19EvidenceCrudStatus
}

export interface Phase19Evidence {
  version: 1
  mode: Phase19EvidenceMode
  status: Phase19EvidenceStatus
  target: string
  template: Phase19EvidenceTemplate
  workflow: string
  repository: string
  ref: string
  environment: string
  taskId: string
  runId: string
  attempt: number
  provider?: Phase19ProviderFacts
  callbackEventIds: readonly string[]
  callbackNonces: readonly string[]
  validatedReceipt?: Phase19ValidatedReceipt
  gatewayUrl: string
  crud: Phase19CrudEvidence
  command: Phase19EvidenceCommand
  timestamp: string
}

export type Phase19EvidenceInput = Omit<Phase19Evidence, 'version' | 'provider' | 'validatedReceipt'> & {
  provider?: Phase19ProviderFacts
  validatedReceipt?: Omit<Phase19ValidatedReceipt, 'validated' | 'source'> & Partial<Pick<Phase19ValidatedReceipt, 'validated' | 'source'>>
}

const phase19EvidenceKeys = [
  'version',
  'mode',
  'status',
  'target',
  'template',
  'workflow',
  'repository',
  'ref',
  'environment',
  'taskId',
  'runId',
  'attempt',
  'provider',
  'callbackEventIds',
  'callbackNonces',
  'validatedReceipt',
  'gatewayUrl',
  'crud',
  'command',
  'timestamp',
] as const

const phase19ProviderKeys = ['runId', 'attempt', 'sha', 'url'] as const
const phase19ReceiptKeys = ['validated', 'source', 'template', 'primaryContentId', 'createdCount', 'updatedCount'] as const
const phase19CrudKeys = ['mutation', 'readback', 'restore'] as const

function phase19HasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256
}

function phase19HasValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

function phase19IsPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function phase19IsUtcTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && !Number.isNaN(Date.parse(value))
}

function phase19ProviderUrl(runId: string): string {
  return `https://github.com/${PHASE19_PROVIDER_REPOSITORY}/actions/runs/${runId}`
}

function phase19WorkflowForTemplate(template: Phase19EvidenceTemplate): typeof PHASE19_PROVIDER_WORKFLOW_VALUES[number] {
  return template === 'movie'
    ? '.github/workflows/daily-movie-crawl.yml'
    : '.github/workflows/daily-manga-crawl.yml'
}

function phase19CloneEvidence(evidence: Phase19Evidence): Phase19Evidence {
  return {
    version: 1,
    mode: evidence.mode,
    status: evidence.status,
    target: evidence.target,
    template: evidence.template,
    workflow: evidence.workflow,
    repository: evidence.repository,
    ref: evidence.ref,
    environment: evidence.environment,
    taskId: evidence.taskId,
    runId: evidence.runId,
    attempt: evidence.attempt,
    ...(evidence.provider ? { provider: { ...evidence.provider } } : {}),
    callbackEventIds: [...evidence.callbackEventIds],
    callbackNonces: [...evidence.callbackNonces],
    ...(evidence.validatedReceipt ? { validatedReceipt: { ...evidence.validatedReceipt } } : {}),
    gatewayUrl: evidence.gatewayUrl,
    crud: { ...evidence.crud },
    command: evidence.command,
    timestamp: evidence.timestamp,
  }
}

function phase19UnexpectedKey(value: Record<string, unknown>, allowed: readonly string[], label: string, issues: string[]): void {
  const unexpected = Object.keys(value).find(key => !allowed.includes(key))
  if (unexpected) {
    issues.push(`Unexpected ${label} key: ${unexpected}.`)
  }
}

/** Deterministically builds a Phase 19 evidence record from an allowlisted input. */
export function buildPhase19Evidence(input: Phase19EvidenceInput): Phase19Evidence {
  if (!isRecord(input)) {
    throw new Error('Phase 19 evidence input must be an object.')
  }
  const inputKeys = Object.keys(input).filter(key => (input as Record<string, unknown>)[key] !== undefined)
  const unexpected = inputKeys.find(key => !phase19EvidenceKeys.includes(key as (typeof phase19EvidenceKeys)[number]))
  if (unexpected) {
    throw new Error(`Unexpected Phase 19 evidence key: ${unexpected}.`)
  }

  const source = input.validatedReceipt?.source ?? (input.mode === 'local_contract' ? 'local_runner' : 'remote_provider')
  const evidence: Phase19Evidence = {
    version: 1,
    mode: input.mode,
    status: input.status,
    target: input.target,
    template: input.template,
    workflow: input.workflow,
    repository: input.repository,
    ref: input.ref,
    environment: input.environment,
    taskId: input.taskId,
    runId: input.runId,
    attempt: input.attempt,
    ...(input.provider ? { provider: { ...input.provider } } : {}),
    callbackEventIds: [...input.callbackEventIds],
    callbackNonces: [...input.callbackNonces],
    ...(input.validatedReceipt ? { validatedReceipt: { ...input.validatedReceipt, validated: input.validatedReceipt.validated ?? true, source } } : {}),
    gatewayUrl: input.gatewayUrl,
    crud: { ...input.crud },
    command: input.command,
    timestamp: input.timestamp,
  }

  const issues = validatePhase19Evidence(evidence)
  if (issues.length > 0) {
    throw new Error(`Invalid Phase 19 evidence: ${issues.join(' ')}`)
  }
  return evidence
}

/** Validates tuple completeness, mode separation, provider binding and redaction boundaries. */
export function validatePhase19Evidence(value: unknown): readonly string[] {
  const issues: string[] = []
  if (!isRecord(value)) {
    return ['Phase 19 evidence must be an object.']
  }
  phase19UnexpectedKey(value, phase19EvidenceKeys, 'Phase 19 evidence', issues)

  if (value.version !== 1)
    issues.push('Phase 19 evidence version must be 1.')
  if (!phase19HasValue(phase19EvidenceModeValues, value.mode))
    issues.push('Phase 19 evidence mode is invalid.')
  if (!phase19HasValue(phase19EvidenceStatusValues, value.status))
    issues.push('Phase 19 evidence status is invalid.')
  if (!phase19HasValue(phase19EvidenceTemplateValues, value.template))
    issues.push('Phase 19 evidence template is invalid.')
  for (const key of ['target', 'workflow', 'repository', 'ref', 'environment', 'taskId', 'runId', 'gatewayUrl'] as const) {
    if (!phase19HasText(value[key]))
      issues.push(`Phase 19 evidence ${key} must be non-empty.`)
  }
  if (!phase19IsPositiveInteger(value.attempt))
    issues.push('Phase 19 evidence attempt must be a positive integer.')
  if (!phase19IsUtcTimestamp(value.timestamp))
    issues.push('Phase 19 evidence timestamp must be a UTC instant.')
  if (!phase19HasValue(phase19EvidenceCommandValues, value.command))
    issues.push('Phase 19 evidence command must be an allowlisted label.')

  if (value.mode === 'local_contract') {
    if (value.target !== PHASE19_LOCAL_TARGET)
      issues.push('Local contract evidence requires the local target label.')
    if (value.workflow !== PHASE19_LOCAL_WORKFLOW || value.repository !== PHASE19_LOCAL_REPOSITORY || value.ref !== PHASE19_LOCAL_REF || value.environment !== PHASE19_LOCAL_ENVIRONMENT) {
      issues.push('Local contract evidence requires local workflow, repository, ref and Environment labels.')
    }
    if (value.command !== 'phase19-local-proof')
      issues.push('Local contract evidence requires the local command label.')
  }

  if (value.mode === 'credentialed_provider') {
    if (value.target !== PHASE19_PROVIDER_TARGET)
      issues.push('Credentialed provider evidence requires the production target label.')
    if (value.workflow !== phase19WorkflowForTemplate(value.template as Phase19EvidenceTemplate))
      issues.push('Credentialed provider workflow does not match template.')
    if (value.repository !== PHASE19_PROVIDER_REPOSITORY || value.ref !== PHASE19_PROVIDER_REF || value.environment !== PHASE19_PROVIDER_ENVIRONMENT) {
      issues.push('Credentialed provider evidence requires the server-owned repository, ref and Environment.')
    }
    if (value.command !== 'phase19-provider-signoff')
      issues.push('Credentialed provider evidence requires the provider command label.')
  }

  if (!Array.isArray(value.callbackEventIds) || value.callbackEventIds.some(id => !phase19HasText(id))) {
    issues.push('Phase 19 callback event IDs must be a string array.')
  }
  if (!Array.isArray(value.callbackNonces) || value.callbackNonces.some(nonce => !phase19HasText(nonce))) {
    issues.push('Phase 19 callback nonces must be a string array.')
  }
  const callbackEventIds = Array.isArray(value.callbackEventIds) ? value.callbackEventIds : []
  const callbackNonces = Array.isArray(value.callbackNonces) ? value.callbackNonces : []

  if (value.mode === 'local_contract' && (callbackEventIds.length > 0 || callbackNonces.length > 0)) {
    issues.push('Local contract evidence must not contain provider callback facts.')
  }
  if (value.mode === 'credentialed_provider' && callbackEventIds.length !== callbackNonces.length) {
    issues.push('Provider callback event IDs and nonces must have matching cardinality.')
  }
  if (value.mode === 'credentialed_provider' && value.status === 'passed' && (callbackEventIds.length === 0 || callbackNonces.length === 0)) {
    issues.push('Credentialed provider success requires callback event IDs and nonces.')
  }

  const gateway = typeof value.gatewayUrl === 'string'
    ? (() => {
        try {
          return new URL(value.gatewayUrl)
        }
        catch {
          return undefined
        }
      })()
    : undefined
  if (!gateway || gateway.pathname !== '/' || gateway.search || gateway.hash) {
    issues.push('Phase 19 Gateway URL must be an origin URL.')
  }
  else if (value.mode === 'local_contract' && value.gatewayUrl !== LOCAL_GATEWAY_ORIGIN) {
    issues.push('Local contract evidence must use the canonical Gateway URL.')
  }
  else if (value.mode === 'credentialed_provider' && (gateway.protocol !== 'https:' || gateway.port !== '')) {
    issues.push('Credentialed provider evidence requires an HTTPS Gateway origin without a direct port.')
  }

  if (value.provider !== undefined) {
    if (!isRecord(value.provider)) {
      issues.push('Phase 19 provider facts must be an object.')
    }
    else {
      phase19UnexpectedKey(value.provider, phase19ProviderKeys, 'Phase 19 provider', issues)
      if (typeof value.provider.runId !== 'string' || !/^\d{1,20}$/u.test(value.provider.runId))
        issues.push('Provider run ID must be numeric.')
      if (!phase19IsPositiveInteger(value.provider.attempt))
        issues.push('Provider attempt must be a positive integer.')
      if (typeof value.provider.sha !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(value.provider.sha))
        issues.push('Provider SHA must be a lowercase 40 or 64 character hash.')
      if (typeof value.provider.url !== 'string' || value.provider.url !== phase19ProviderUrl(String(value.provider.runId)))
        issues.push('Provider URL must be derived from the server-owned repository and run ID.')
    }
  }
  if (value.mode === 'local_contract' && value.provider !== undefined)
    issues.push('Local contract evidence must not contain provider facts.')
  if (value.mode === 'credentialed_provider' && value.status === 'passed' && value.provider === undefined)
    issues.push('Credentialed provider success requires provider run facts.')

  if (value.validatedReceipt !== undefined) {
    if (!isRecord(value.validatedReceipt)) {
      issues.push('Validated receipt must be an object.')
    }
    else {
      phase19UnexpectedKey(value.validatedReceipt, phase19ReceiptKeys, 'Phase 19 validated receipt', issues)
      if (value.validatedReceipt.validated !== true)
        issues.push('Validated receipt must carry the literal validated=true marker.')
      if (value.validatedReceipt.source !== (value.mode === 'local_contract' ? 'local_runner' : 'remote_provider'))
        issues.push('Validated receipt source does not match evidence mode.')
      if (!phase19HasValue(phase19EvidenceTemplateValues, value.validatedReceipt.template) || value.validatedReceipt.template !== value.template)
        issues.push('Validated receipt template does not match evidence template.')
      if (!phase19HasText(value.validatedReceipt.primaryContentId))
        issues.push('Validated receipt primary content ID must be non-empty.')
      if (typeof value.validatedReceipt.createdCount !== 'number' || !Number.isSafeInteger(value.validatedReceipt.createdCount) || value.validatedReceipt.createdCount < 0)
        issues.push('Validated receipt created count is invalid.')
      if (typeof value.validatedReceipt.updatedCount !== 'number' || !Number.isSafeInteger(value.validatedReceipt.updatedCount) || value.validatedReceipt.updatedCount < 0)
        issues.push('Validated receipt updated count is invalid.')
    }
  }
  if (value.status === 'passed' && value.validatedReceipt === undefined)
    issues.push('Passed Phase 19 evidence requires a validated receipt.')
  if (value.status !== 'passed' && value.validatedReceipt !== undefined)
    issues.push('Failed/checkpoint Phase 19 evidence must not carry a validated receipt.')

  if (!isRecord(value.crud)) {
    issues.push('Phase 19 CRUD evidence must be an object.')
  }
  else {
    const crud = value.crud
    phase19UnexpectedKey(crud, phase19CrudKeys, 'Phase 19 CRUD', issues)
    for (const key of phase19CrudKeys) {
      if (!phase19HasValue(phase19EvidenceCrudStatusValues, crud[key]))
        issues.push(`Phase 19 CRUD ${key} status is invalid.`)
    }
    if (value.status === 'passed' && phase19CrudKeys.some(key => crud[key] !== 'passed'))
      issues.push('Passed Phase 19 evidence requires mutation, readback and restore to pass.')
  }

  return issues
}

export function assertValidPhase19Evidence(value: unknown): asserts value is Phase19Evidence {
  const issues = validatePhase19Evidence(value)
  if (issues.length > 0)
    throw new Error(`Invalid Phase 19 evidence: ${issues.join(' ')}`)
}

export function serializePhase19EvidenceJson(value: unknown): string {
  assertValidPhase19Evidence(value)
  return `${JSON.stringify(phase19CloneEvidence(value), null, 2)}\n`
}

export function renderPhase19EvidenceMarkdown(value: unknown): string {
  assertValidPhase19Evidence(value)
  const evidence = phase19CloneEvidence(value)
  const lines = [
    '# Phase 19 Evidence',
    '',
    `- Mode: ${evidence.mode}`,
    `- Status: ${evidence.status}`,
    `- Target: ${evidence.target}`,
    `- Template: ${evidence.template}`,
    `- Workflow: ${evidence.workflow}`,
    `- Repository: ${evidence.repository}`,
    `- Ref: ${evidence.ref}`,
    `- Environment: ${evidence.environment}`,
    `- Task: ${evidence.taskId}`,
    `- D1 run/attempt: ${evidence.runId} / ${evidence.attempt}`,
    `- Gateway: ${evidence.gatewayUrl}`,
    `- Command: ${evidence.command}`,
    `- Timestamp: ${evidence.timestamp}`,
    '',
    '| Provider run | Provider attempt | SHA | Provider URL | Callback event IDs | Callback nonces | Receipt | Mutation | Readback | Restore |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    [
      evidence.provider?.runId ?? '',
      evidence.provider?.attempt ?? '',
      evidence.provider?.sha ?? '',
      evidence.provider?.url ?? '',
      evidence.callbackEventIds.join(', '),
      evidence.callbackNonces.join(', '),
      evidence.validatedReceipt?.primaryContentId ?? '',
      evidence.crud.mutation,
      evidence.crud.readback,
      evidence.crud.restore,
    ].join(' | ').replace(/^/, '| ').concat(' |'),
    '',
  ]
  return lines.join('\n')
}
