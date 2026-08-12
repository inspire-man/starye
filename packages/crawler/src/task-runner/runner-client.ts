import process from 'node:process'
import { createRunnerEventId, signRunnerBody } from './event-signer'

export type RunnerOperation = 'manga' | 'movie' | 'repair_players' | VideoRunnerOperation
export type VideoRunnerOperation = 'check_video_source' | 'recheck_video_source' | 'repair_video_source'
export type VideoRunnerReason
  = | 'no_source' | 'source_failed' | 'stale' | 'direct_blocked' | 'direct_transport_failed'
    | 'direct_content_invalid' | 'browser_inconclusive' | 'provider_unconfigured' | 'provider_failed'
    | 'metadata_unresolved' | 'no_peer' | 'stalled' | 'stream_missing' | 'stream_failed'
    | 'playback_unverified' | 'playback_failed'
export type RunnerProvider = 'github-actions' | 'local-proof'
export type RunnerSourceType = 'direct' | 'magnet' | 'TorrServer'
export type RunnerSourceHealth = 'inactive' | 'unverified' | 'failed'
export type RunnerSourceReasonCode
  = | 'source_inactive'
    | 'source_unverified'
    | 'source_candidate_invalid'
    | 'source_read_failed'
    | 'source_write_failed'
export type RunnerFailureCode
  = | 'receipt_missing'
    | 'runner_failed'
    | 'source_stale'
    | 'source_read_failed'
    | 'source_write_failed'
export type RepairObservationErrorCode = 'source_stale' | 'source_read_failed' | 'source_write_failed'

export type RunnerAvailabilityFreshness = 'fresh' | 'stale' | 'late'
export type RunnerAvailabilityStatus = 'available' | 'unavailable' | 'degraded' | 'unknown'
export type RunnerAvailabilityReasonCode = 'available' | 'no_source' | 'source_failed' | 'transport_failed' | 'content_missing' | 'policy_mismatch' | 'cancelled' | 'provider_failed' | 'observation_invalid'
export type RunnerAvailabilityNextAction = 'none' | 'recheck' | 'repair' | 'retry' | 'ignore'

export interface RunnerAvailabilitySummary {
  readonly counts?: Readonly<Record<string, number>>
  readonly samples?: readonly string[]
}

export interface RunnerAvailabilityObservationInput {
  readonly expectedProjectionVersion?: number
  readonly freshness: RunnerAvailabilityFreshness
  readonly nextAction: RunnerAvailabilityNextAction
  readonly observationIdentity?: string
  readonly observedAt?: number
  readonly reasonCode: RunnerAvailabilityReasonCode
  readonly status: RunnerAvailabilityStatus
  readonly summary: RunnerAvailabilitySummary
}

export interface RunnerVideoAvailabilityObservationInput extends RunnerAvailabilityObservationInput {
  readonly sourceKind: 'direct' | 'magnet'
}

export interface RunnerAvailabilityObservationResponse {
  readonly accepted: boolean
  readonly current?: unknown
  readonly kind?: string
  readonly observation?: unknown
  readonly reason?: string
}

export interface RunnerSourceCandidate {
  readonly health?: RunnerSourceHealth
  readonly isActive?: boolean
  readonly quality?: string
  readonly reasonCode?: RunnerSourceReasonCode
  readonly sortOrder?: number
  readonly sourceName: string
  readonly sourceType?: RunnerSourceType
  readonly sourceUrl: string
}

export type RepairSourceCandidate = RunnerSourceCandidate

export interface RepairSourceObservationInput {
  readonly observedAt?: number
  readonly sources: readonly RunnerSourceCandidate[]
}

export interface RepairSourceHealthSummary {
  readonly eligible: boolean
  readonly health: RunnerSourceHealth
  readonly observedAt: number
  readonly reasonCode: RunnerSourceReasonCode
  readonly sourceType: RunnerSourceType
}

export interface RepairPlayersReceipt {
  readonly movieId: string
  readonly observedAt: number
  readonly operation: 'repair_players'
  readonly sourceRevision: number
  readonly sourceSummary: readonly RepairSourceHealthSummary[]
}

export interface RepairSourceObservationResponse {
  readonly accepted: boolean
  readonly errorCode?: RepairObservationErrorCode
  readonly outcome?: string
  readonly readback?: {
    readonly movieId: string
    readonly observedAt: number
    readonly sourceRevision: number
    readonly sources: readonly RepairSourceHealthSummary[]
    readonly summary: { readonly eligibleCount: number, readonly sourceCount: number }
  } | null
  readonly receipt?: RepairPlayersReceipt | null
}

interface OrdinaryRunnerSnapshot {
  readonly entrypoint: 'movie-crawler' | 'manga-crawler'
  readonly permissionResource: 'comic' | 'movie'
  readonly templateKey: 'manga' | 'movie'
  readonly templateVersion: 1
  readonly operation?: 'manga' | 'movie'
}

export interface RepairRunnerSnapshot extends Omit<OrdinaryRunnerSnapshot, 'operation' | 'templateKey'> {
  readonly movieId: string
  readonly operation: 'repair_players'
  readonly reason: 'no_source' | 'source_failed'
  readonly sourceRevision: number
  readonly targetIntent: 'restore_playable_sources'
  readonly templateKey: 'movie'
}

export interface VideoRunnerSnapshot extends Omit<OrdinaryRunnerSnapshot, 'operation' | 'templateKey'> {
  readonly movieId: string
  readonly movieRevision: number
  readonly operation: VideoRunnerOperation
  readonly policyVersion: string
  readonly reason: VideoRunnerReason
  readonly sourceRevision: number
  readonly templateKey: 'movie'
}

export type RunnerSnapshot = OrdinaryRunnerSnapshot | RepairRunnerSnapshot | VideoRunnerSnapshot

export function isRepairRunnerSnapshot(snapshot: RunnerSnapshot): snapshot is RepairRunnerSnapshot {
  return snapshot.operation === 'repair_players'
}

export function isVideoRunnerSnapshot(snapshot: RunnerSnapshot): snapshot is VideoRunnerSnapshot {
  return snapshot.operation === 'check_video_source'
    || snapshot.operation === 'recheck_video_source'
    || snapshot.operation === 'repair_video_source'
}

export interface RunnerCandidate {
  readonly attempt: number
  readonly contentId?: string
  readonly expectedProjectionVersion?: number
  readonly policyReference?: string
  readonly policyVersion?: string
  readonly proofProfile?: 'phase25-movie-availability-v1'
  readonly provider?: RunnerProvider
  readonly runId: string
  readonly sequence: number
  readonly sourceRevision?: number
  readonly snapshot: RunnerSnapshot
  readonly target?: { readonly id: string, readonly kind: 'movie' | 'manga' }
  readonly taskId?: string
}

export interface RunnerClientConfig {
  readonly apiBaseUrl: string
  readonly applicationAttempt?: number
  readonly applicationRunId?: string
  readonly callbackKeyId: string
  readonly callbackSecret: string
  readonly fetch?: typeof fetch
  readonly providerMode?: RunnerProvider
  readonly now?: () => number
  readonly providerRunAttempt?: number
  readonly providerRunId?: string
  readonly timeoutMs?: number
}

/** Shared callback envelope builder used by local and provider-backed runners. */
export function createRunnerEnvelope(keyId: string, fields: Record<string, unknown> = {}, now = Date.now()): Record<string, unknown> {
  return {
    event_id: createRunnerEventId(),
    key_id: keyId,
    nonce: createRunnerEventId(),
    timestamp: now,
    ...fields,
  }
}

interface EventResult {
  readonly accepted: boolean
  readonly cancel_requested?: boolean
}

interface PostOptions {
  readonly allowNonOk?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function isVideoRunnerReason(value: unknown): value is VideoRunnerReason {
  return typeof value === 'string' && [
    'no_source',
    'source_failed',
    'stale',
    'direct_blocked',
    'direct_transport_failed',
    'direct_content_invalid',
    'browser_inconclusive',
    'provider_unconfigured',
    'provider_failed',
    'metadata_unresolved',
    'no_peer',
    'stalled',
    'stream_missing',
    'stream_failed',
    'playback_unverified',
    'playback_failed',
  ].includes(value)
}

function isRepairReceipt(value: unknown): value is RepairPlayersReceipt {
  if (!isRecord(value)
    || value.operation !== 'repair_players'
    || typeof value.movieId !== 'string'
    || value.movieId.trim().length === 0
    || typeof value.observedAt !== 'number'
    || !Number.isSafeInteger(value.observedAt)
    || value.observedAt < 0
    || typeof value.sourceRevision !== 'number'
    || !Number.isSafeInteger(value.sourceRevision)
    || value.sourceRevision < 0
    || value.sourceRevision > 1_000_000
    || !Array.isArray(value.sourceSummary)
    || value.sourceSummary.length < 1
    || value.sourceSummary.length > 50) {
    return false
  }

  return value.sourceSummary.every((source) => {
    if (!isRecord(source))
      return false
    return typeof source.eligible === 'boolean'
      && (source.health === 'inactive' || source.health === 'unverified' || source.health === 'failed')
      && typeof source.observedAt === 'number'
      && Number.isSafeInteger(source.observedAt)
      && source.observedAt >= 0
      && (source.reasonCode === 'source_inactive'
        || source.reasonCode === 'source_unverified'
        || source.reasonCode === 'source_candidate_invalid'
        || source.reasonCode === 'source_read_failed'
        || source.reasonCode === 'source_write_failed')
      && (source.sourceType === 'direct' || source.sourceType === 'magnet' || source.sourceType === 'TorrServer')
  })
}

function sanitizeRepairReceipt(value: unknown): RepairPlayersReceipt | undefined {
  if (!isRepairReceipt(value))
    return undefined
  return {
    movieId: value.movieId.trim(),
    observedAt: value.observedAt,
    operation: 'repair_players',
    sourceRevision: value.sourceRevision,
    sourceSummary: value.sourceSummary.map(source => ({
      eligible: source.eligible,
      health: source.health,
      observedAt: source.observedAt,
      reasonCode: source.reasonCode,
      sourceType: source.sourceType,
    })),
  }
}

function parseRunnerSnapshot(value: unknown): RunnerSnapshot {
  if (!isRecord(value)
    || (value.entrypoint !== 'movie-crawler' && value.entrypoint !== 'manga-crawler')
    || (value.permissionResource !== 'movie' && value.permissionResource !== 'comic')
    || (value.templateKey !== 'movie' && value.templateKey !== 'manga')
    || value.templateVersion !== 1) {
    throw new Error('Invalid runner snapshot')
  }

  if (value.operation === 'repair_players') {
    if (value.templateKey !== 'movie'
      || value.entrypoint !== 'movie-crawler'
      || value.permissionResource !== 'movie'
      || typeof value.movieId !== 'string'
      || value.movieId.trim().length === 0
      || (value.reason !== 'no_source' && value.reason !== 'source_failed')
      || typeof value.sourceRevision !== 'number'
      || !Number.isSafeInteger(value.sourceRevision)
      || value.sourceRevision < 0
      || value.sourceRevision > 1_000_000
      || value.targetIntent !== 'restore_playable_sources') {
      throw new Error('Invalid repair runner snapshot')
    }
    return {
      entrypoint: 'movie-crawler',
      movieId: value.movieId.trim(),
      operation: 'repair_players',
      permissionResource: 'movie',
      reason: value.reason,
      sourceRevision: value.sourceRevision,
      targetIntent: 'restore_playable_sources',
      templateKey: 'movie',
      templateVersion: 1,
    }
  }

  if (value.operation === 'check_video_source' || value.operation === 'recheck_video_source' || value.operation === 'repair_video_source') {
    if (!hasExactKeys(value, [
      'entrypoint',
      'movieId',
      'movieRevision',
      'operation',
      'permissionResource',
      'policyVersion',
      'reason',
      'sourceRevision',
      'templateKey',
      'templateVersion',
    ])
    || value.templateKey !== 'movie'
    || value.entrypoint !== 'movie-crawler'
    || value.permissionResource !== 'movie'
    || typeof value.movieId !== 'string'
    || value.movieId.trim().length === 0
    || typeof value.movieRevision !== 'number'
    || !Number.isSafeInteger(value.movieRevision)
    || value.movieRevision < 0
    || typeof value.sourceRevision !== 'number'
    || !Number.isSafeInteger(value.sourceRevision)
    || value.sourceRevision < 0
    || typeof value.policyVersion !== 'string'
    || value.policyVersion.trim().length === 0
    || value.policyVersion.length > 128
    || !isVideoRunnerReason(value.reason)) {
      throw new Error('Invalid video runner snapshot')
    }
    return {
      entrypoint: 'movie-crawler',
      movieId: value.movieId.trim(),
      movieRevision: value.movieRevision,
      operation: value.operation,
      permissionResource: 'movie',
      policyVersion: value.policyVersion.trim(),
      reason: value.reason,
      sourceRevision: value.sourceRevision,
      templateKey: 'movie',
      templateVersion: 1,
    }
  }

  if (value.operation !== undefined && value.operation !== value.templateKey)
    throw new Error('Runner snapshot operation does not match its template')
  if (value.templateKey === 'movie' && (value.entrypoint !== 'movie-crawler' || value.permissionResource !== 'movie'))
    throw new Error('Runner snapshot entrypoint does not match its template')
  if (value.templateKey === 'manga' && (value.entrypoint !== 'manga-crawler' || value.permissionResource !== 'comic'))
    throw new Error('Runner snapshot entrypoint does not match its template')

  return {
    entrypoint: value.entrypoint,
    operation: value.operation as 'manga' | 'movie' | undefined,
    permissionResource: value.permissionResource,
    templateKey: value.templateKey,
    templateVersion: 1,
  }
}

function parseRunnerCandidate(value: unknown): RunnerCandidate {
  if (!isRecord(value)
    || typeof value.run_id !== 'string'
    || value.run_id.trim().length === 0
    || value.run_id.length > 128
    || typeof value.attempt !== 'number'
    || !Number.isSafeInteger(value.attempt)
    || value.attempt < 1
    || typeof value.sequence !== 'number'
    || !Number.isSafeInteger(value.sequence)
    || value.sequence < 1) {
    throw new Error('Invalid runner candidate')
  }

  const provider = value.provider === undefined
    ? undefined
    : value.provider === 'github-actions' || value.provider === 'local-proof'
      ? value.provider
      : undefined
  if (value.provider !== undefined && provider === undefined)
    throw new Error('Invalid runner candidate provider')

  const target: RunnerCandidate['target'] = isRecord(value.target)
    && (value.target.kind === 'movie' || value.target.kind === 'manga')
    && typeof value.target.id === 'string'
    && /^[A-Za-z0-9][\w-]{0,127}$/u.test(value.target.id)
    ? { id: value.target.id.trim(), kind: value.target.kind === 'movie' ? 'movie' : 'manga' }
    : undefined
  if (value.target !== undefined && !target)
    throw new Error('Invalid runner candidate target')

  const optionalInteger = (candidate: unknown, max: number): number | undefined => {
    if (candidate === undefined)
      return undefined
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0 || candidate > max)
      throw new Error('Invalid runner candidate binding')
    return candidate
  }
  const contentId = value.contentId === undefined
    ? undefined
    : typeof value.contentId === 'string' && /^[A-Za-z0-9][\w-]{0,127}$/u.test(value.contentId)
      ? value.contentId.trim()
      : undefined
  if (value.contentId !== undefined && !contentId)
    throw new Error('Invalid runner candidate content binding')
  const policyReference = value.policyReference === undefined
    ? undefined
    : typeof value.policyReference === 'string' && value.policyReference.trim().length > 0 && value.policyReference.length <= 256
      ? value.policyReference.trim()
      : undefined
  const policyVersion = value.policyVersion === undefined
    ? undefined
    : typeof value.policyVersion === 'string' && value.policyVersion.trim().length > 0 && value.policyVersion.length <= 128
      ? value.policyVersion.trim()
      : undefined
  if ((value.policyReference !== undefined && !policyReference) || (value.policyVersion !== undefined && !policyVersion))
    throw new Error('Invalid runner candidate policy binding')
  const proofProfile = value.proofProfile === undefined
    ? undefined
    : value.proofProfile === 'phase25-movie-availability-v1'
      ? value.proofProfile
      : undefined
  if (value.proofProfile !== undefined && !proofProfile)
    throw new Error('Invalid runner candidate proof profile')
  const taskId = value.taskId === undefined
    ? undefined
    : typeof value.taskId === 'string' && /^[A-Za-z0-9][\w-]{0,127}$/u.test(value.taskId)
      ? value.taskId.trim()
      : undefined
  if (value.taskId !== undefined && !taskId)
    throw new Error('Invalid runner candidate task binding')

  const sourceRevision = optionalInteger(value.sourceRevision, 1_000_000)
  const expectedProjectionVersion = optionalInteger(value.expectedProjectionVersion, 1_000_000_000)
  if (provider === 'local-proof'
    && (!taskId || !target || !contentId || sourceRevision === undefined || expectedProjectionVersion === undefined
      || !policyReference || !policyVersion || proofProfile !== 'phase25-movie-availability-v1')) {
    throw new Error('Local proof runner candidate binding is incomplete')
  }

  const snapshot = parseRunnerSnapshot(value.snapshot)
  if (isVideoRunnerSnapshot(snapshot)
    && (sourceRevision !== snapshot.sourceRevision
      || policyVersion !== snapshot.policyVersion
      || contentId !== snapshot.movieId
      || target?.kind !== 'movie'
      || target.id !== snapshot.movieId)) {
    throw new Error('Runner video snapshot binding does not match the candidate')
  }

  return {
    attempt: value.attempt,
    ...(contentId ? { contentId } : {}),
    ...(expectedProjectionVersion !== undefined ? { expectedProjectionVersion } : {}),
    ...(policyReference ? { policyReference } : {}),
    ...(policyVersion ? { policyVersion } : {}),
    ...(proofProfile ? { proofProfile } : {}),
    ...(provider ? { provider } : {}),
    runId: value.run_id.trim(),
    sequence: value.sequence,
    ...(sourceRevision !== undefined ? { sourceRevision } : {}),
    snapshot,
    ...(target ? { target } : {}),
    ...(taskId ? { taskId } : {}),
  }
}

export class RunnerClient {
  private readonly fetch: typeof fetch
  private readonly now: () => number
  private readonly timeoutMs: number

  constructor(private readonly config: RunnerClientConfig) {
    this.fetch = config.fetch ?? globalThis.fetch
    this.now = config.now ?? (() => Date.now())
    this.timeoutMs = config.timeoutMs ?? 10_000
  }

  async poll(): Promise<RunnerCandidate | undefined> {
    const response = await this.post('/api/internal/crawler-runs/poll', this.controlEnvelope()) as {
      candidate: unknown
    }
    if (response.candidate === null || response.candidate === undefined)
      return undefined
    const candidate = parseRunnerCandidate(response.candidate)
    this.assertCandidateBinding(candidate)
    return candidate
  }

  async claim(candidate: RunnerCandidate): Promise<EventResult> {
    this.assertCandidateBinding(candidate)
    return this.post(`/api/internal/crawler-runs/${candidate.runId}/claim`, {
      ...this.controlEnvelope({
        attempt: candidate.attempt,
        run_id: candidate.runId,
        sequence: candidate.sequence,
      }),
    }) as Promise<EventResult>
  }

  async heartbeat(candidate: RunnerCandidate, sequence: number): Promise<EventResult> {
    return this.event(candidate, sequence, 'heartbeat')
  }

  async log(candidate: RunnerCandidate, sequence: number, message: string): Promise<EventResult> {
    return this.event(candidate, sequence, 'log', { code: 'runner_progress', level: 'info', message })
  }

  async progress(candidate: RunnerCandidate, sequence: number, counts: Readonly<Record<string, number>> = {}): Promise<EventResult> {
    return this.event(candidate, sequence, 'progress', { counts })
  }

  async cancelled(candidate: RunnerCandidate, sequence: number): Promise<EventResult> {
    return this.event(candidate, sequence, 'cancelled', { code: 'cancelled_at_safe_checkpoint' })
  }

  async succeeded(candidate: RunnerCandidate, sequence: number, contentIds: readonly string[]): Promise<EventResult> {
    return this.event(candidate, sequence, 'succeeded', {
      receipt: { contentIds, templateKey: candidate.snapshot.templateKey },
    })
  }

  async succeededRepair(candidate: RunnerCandidate, sequence: number, receipt: RepairPlayersReceipt): Promise<EventResult> {
    if (!isRepairRunnerSnapshot(candidate.snapshot))
      throw new Error('Repair receipt requires a repair runner snapshot')
    const sanitizedReceipt = sanitizeRepairReceipt(receipt)
    if (!sanitizedReceipt
      || sanitizedReceipt.movieId !== candidate.snapshot.movieId
      || sanitizedReceipt.sourceRevision <= candidate.snapshot.sourceRevision) {
      throw new Error('Repair receipt does not match its runner snapshot')
    }
    return this.event(candidate, sequence, 'succeeded', { receipt: sanitizedReceipt })
  }

  async observeRepairSource(
    candidate: RunnerCandidate,
    sequence: number,
    input: RepairSourceObservationInput,
  ): Promise<RepairSourceObservationResponse> {
    if (!isRepairRunnerSnapshot(candidate.snapshot))
      throw new Error('Source observation requires a repair runner snapshot')
    this.assertCandidateBinding(candidate)
    const observedAt = input.observedAt ?? Math.floor(this.now() / 1000)
    return this.post(`/api/internal/crawler-runs/${encodeURIComponent(candidate.runId)}/source-observation`, {
      ...this.boundEnvelope(),
      attempt: candidate.attempt,
      observed_at: observedAt,
      operation: 'repair_players',
      run_id: candidate.runId,
      sequence,
      source_revision: candidate.snapshot.sourceRevision,
      sources: input.sources,
      type: 'source_observation',
    }, { allowNonOk: true }) as Promise<RepairSourceObservationResponse>
  }

  async repairSourceObservation(candidate: RunnerCandidate, sequence: number, input: RepairSourceObservationInput): Promise<RepairSourceObservationResponse> {
    return this.observeRepairSource(candidate, sequence, input)
  }

  async observeAvailability(
    candidate: RunnerCandidate,
    sequence: number,
    input: RunnerAvailabilityObservationInput,
  ): Promise<RunnerAvailabilityObservationResponse> {
    this.assertCandidateBinding(candidate)
    const binding = this.availabilityBinding(candidate)
    const observedAt = input.observedAt ?? Math.floor(this.now() / 1000)
    const expectedProjectionVersion = input.expectedProjectionVersion ?? binding.expectedProjectionVersion
    const observationIdentity = input.observationIdentity ?? `availability-${createRunnerEventId()}`
    const summary = boundedAvailabilitySummary(input.summary)
    return this.post(`/api/internal/crawler-runs/${encodeURIComponent(candidate.runId)}/availability-observation`, {
      ...this.boundEnvelope(),
      attempt: candidate.attempt,
      content_id: binding.contentId,
      expected_projection_version: expectedProjectionVersion,
      freshness: input.freshness,
      next_action: input.nextAction,
      observation_identity: observationIdentity,
      observed_at: observedAt,
      policy_reference: binding.policyReference,
      policy_version: binding.policyVersion,
      provider: binding.provider,
      reason_code: input.reasonCode,
      run_id: candidate.runId,
      sequence,
      source_revision: binding.sourceRevision,
      status: input.status,
      summary,
      target: binding.target,
      task_id: binding.taskId,
      timestamp: this.now(),
      type: 'availability_observation',
    }, { allowNonOk: true }) as Promise<RunnerAvailabilityObservationResponse>
  }

  async observeVideoAvailability(
    candidate: RunnerCandidate,
    sequence: number,
    input: RunnerVideoAvailabilityObservationInput,
  ): Promise<RunnerAvailabilityObservationResponse> {
    if (!isVideoRunnerSnapshot(candidate.snapshot))
      throw new Error('Video observation requires a video runner snapshot')
    const directReasons: readonly VideoRunnerReason[] = ['direct_blocked', 'direct_transport_failed', 'direct_content_invalid', 'browser_inconclusive']
    const magnetReasons: readonly VideoRunnerReason[] = ['provider_unconfigured', 'provider_failed', 'metadata_unresolved', 'no_peer', 'stalled', 'stream_missing', 'stream_failed']
    if ((input.sourceKind === 'direct' && magnetReasons.includes(candidate.snapshot.reason))
      || (input.sourceKind === 'magnet' && directReasons.includes(candidate.snapshot.reason))) {
      throw new Error('Runner video source variant does not match its snapshot')
    }
    return this.observeAvailability(candidate, sequence, input)
  }

  async failed(candidate: RunnerCandidate, sequence: number, code: string): Promise<EventResult> {
    return this.event(candidate, sequence, 'failed', { code })
  }

  private controlEnvelope(fields: Record<string, unknown> = {}) {
    return createRunnerEnvelope(this.config.callbackKeyId, fields, this.now())
  }

  private boundEnvelope(fields: Record<string, unknown> = {}) {
    return this.controlEnvelope({
      ...(this.config.applicationAttempt !== undefined ? { attempt: this.config.applicationAttempt } : {}),
      ...(this.config.applicationRunId ? { run_id: this.config.applicationRunId } : {}),
      ...(this.config.providerRunAttempt !== undefined ? { provider_run_attempt: this.config.providerRunAttempt } : {}),
      ...(this.config.providerRunId ? { provider_run_id: this.config.providerRunId } : {}),
      ...fields,
    })
  }

  private async event(candidate: RunnerCandidate, sequence: number, type: 'cancelled' | 'failed' | 'heartbeat' | 'log' | 'progress' | 'succeeded', extra: Record<string, unknown> = {}): Promise<EventResult> {
    this.assertCandidateBinding(candidate)
    return this.post(`/api/internal/crawler-runs/${candidate.runId}/events`, {
      ...this.boundEnvelope(),
      ...extra,
      attempt: candidate.attempt,
      run_id: candidate.runId,
      sequence,
      type,
      ...this.repairSourceRevision(candidate),
    }) as Promise<EventResult>
  }

  private repairSourceRevision(candidate: RunnerCandidate): Record<string, number> {
    return isRepairRunnerSnapshot(candidate.snapshot)
      ? { source_revision: candidate.snapshot.sourceRevision }
      : {}
  }

  private assertCandidateBinding(candidate: RunnerCandidate): void {
    if ((this.config.applicationRunId && candidate.runId !== this.config.applicationRunId)
      || (this.config.applicationAttempt !== undefined && candidate.attempt !== this.config.applicationAttempt)) {
      throw new Error('Runner candidate does not match the configured run binding')
    }
    if (candidate.provider === 'local-proof' && this.config.providerMode !== 'local-proof')
      throw new Error('Local proof runner mode is not enabled')
    if (this.config.providerMode === 'local-proof' && candidate.provider !== 'local-proof')
      throw new Error('Runner candidate provider does not match local proof mode')
  }

  private availabilityBinding(candidate: RunnerCandidate): {
    readonly contentId: string
    readonly expectedProjectionVersion: number
    readonly policyReference: string
    readonly policyVersion: string
    readonly provider: RunnerProvider
    readonly sourceRevision: number
    readonly target: { readonly id: string, readonly kind: 'movie' | 'manga' }
    readonly taskId: string
  } {
    if (!candidate.provider || !candidate.taskId || !candidate.target || !candidate.contentId
      || candidate.expectedProjectionVersion === undefined || !candidate.policyReference || !candidate.policyVersion
      || candidate.sourceRevision === undefined) {
      throw new Error('Runner candidate availability binding is incomplete')
    }
    return {
      contentId: candidate.contentId,
      expectedProjectionVersion: candidate.expectedProjectionVersion,
      policyReference: candidate.policyReference,
      policyVersion: candidate.policyVersion,
      provider: candidate.provider,
      sourceRevision: candidate.sourceRevision,
      target: candidate.target,
      taskId: candidate.taskId,
    }
  }

  private async post(path: string, payload: Record<string, unknown>, options: PostOptions = {}): Promise<unknown> {
    const body = JSON.stringify(payload)
    const response = await this.fetch(`${this.config.apiBaseUrl.replace(/\/$/u, '')}${path}`, {
      body,
      headers: {
        'content-type': 'application/json',
        'x-runner-key-id': this.config.callbackKeyId,
        'x-runner-signature': signRunnerBody(body, this.config.callbackSecret),
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (!response.ok && !options.allowNonOk) {
      throw new Error(`Runner control request failed: ${response.status}`)
    }
    return response.json()
  }
}

function environmentRequired(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim()
  if (!value)
    throw new Error(`Missing runner environment: ${name}`)
  return value
}

function environmentPositiveInteger(environment: NodeJS.ProcessEnv, name: string): number {
  const value = Number(environmentRequired(environment, name))
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`Invalid runner environment: ${name}`)
  return value
}

export function createRunnerClientFromEnvironment(environment: NodeJS.ProcessEnv = process.env): RunnerClient {
  return new RunnerClient({
    apiBaseUrl: environmentRequired(environment, 'ACTIONS_CALLBACK_API_BASE_URL'),
    applicationAttempt: environmentPositiveInteger(environment, 'ACTIONS_APPLICATION_ATTEMPT'),
    applicationRunId: environmentRequired(environment, 'ACTIONS_APPLICATION_RUN_ID'),
    callbackKeyId: environmentRequired(environment, 'TASK_RUNNER_CALLBACK_KEY_ID_CURRENT'),
    callbackSecret: environmentRequired(environment, 'TASK_RUNNER_CALLBACK_SECRET_CURRENT'),
    ...(environment.CRAWLER_LOCAL_PROOF_ENABLED === 'true' ? { providerMode: 'local-proof' as const } : {}),
    providerRunAttempt: environmentPositiveInteger(environment, 'GITHUB_RUN_ATTEMPT'),
    providerRunId: environmentRequired(environment, 'GITHUB_RUN_ID'),
  })
}

interface BoundedRunnerAvailabilitySummary {
  readonly counts?: Readonly<Record<string, number>>
  readonly samples?: readonly { readonly code: string }[]
}

function boundedAvailabilitySummary(summary: RunnerAvailabilitySummary): BoundedRunnerAvailabilitySummary {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary))
    throw new Error('Availability summary is invalid')
  const counts = summary.counts === undefined
    ? undefined
    : Object.fromEntries(Object.entries(summary.counts).slice(0, 20).map(([key, value]) => {
        if (!/^[\w.:-]{1,64}$/u.test(key) || typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000)
          throw new Error('Availability summary counts are invalid')
        return [key, value]
      }))
  const samples = summary.samples === undefined
    ? undefined
    : summary.samples.slice(0, 20).map((sample) => {
        if (typeof sample !== 'string' || sample.length === 0 || sample.length > 128 || /https?:\/\/|magnet:\?/iu.test(sample))
          throw new Error('Availability summary samples are invalid')
        return { code: sample }
      })
  return {
    ...(counts ? { counts } : {}),
    ...(samples ? { samples } : {}),
  }
}
