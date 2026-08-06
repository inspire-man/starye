import { createRunnerEventId, signRunnerBody } from './event-signer'

export type RunnerOperation = 'manga' | 'movie' | 'repair_players'
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

export type RunnerSnapshot = OrdinaryRunnerSnapshot | RepairRunnerSnapshot

export function isRepairRunnerSnapshot(snapshot: RunnerSnapshot): snapshot is RepairRunnerSnapshot {
  return snapshot.operation === 'repair_players'
}

export interface RunnerCandidate {
  readonly attempt: number
  readonly runId: string
  readonly sequence: number
  readonly snapshot: RunnerSnapshot
}

export interface RunnerClientConfig {
  readonly apiBaseUrl: string
  readonly callbackKeyId: string
  readonly callbackSecret: string
  readonly fetch?: typeof fetch
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

export class RunnerClient {
  private readonly fetch: typeof fetch
  private readonly timeoutMs: number

  constructor(private readonly config: RunnerClientConfig) {
    this.fetch = config.fetch ?? globalThis.fetch
    this.timeoutMs = config.timeoutMs ?? 10_000
  }

  async poll(): Promise<RunnerCandidate | undefined> {
    const response = await this.post('/api/internal/crawler-runs/poll', this.controlEnvelope()) as {
      candidate: { attempt: number, run_id: string, sequence: number, snapshot: unknown } | null
    }
    return response.candidate
      ? { attempt: response.candidate.attempt, runId: response.candidate.run_id, sequence: response.candidate.sequence, snapshot: parseRunnerSnapshot(response.candidate.snapshot) }
      : undefined
  }

  async claim(candidate: RunnerCandidate): Promise<EventResult> {
    return this.post(`/api/internal/crawler-runs/${candidate.runId}/claim`, {
      ...this.controlEnvelope(),
      attempt: candidate.attempt,
      run_id: candidate.runId,
      sequence: candidate.sequence,
    }) as Promise<EventResult>
  }

  async heartbeat(candidate: RunnerCandidate, sequence: number): Promise<EventResult> {
    return this.event(candidate, sequence, 'heartbeat')
  }

  async log(candidate: RunnerCandidate, sequence: number, message: string): Promise<EventResult> {
    return this.event(candidate, sequence, 'log', { code: 'runner_progress', level: 'info', message })
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
    const observedAt = input.observedAt ?? Math.floor(Date.now() / 1000)
    return this.post(`/api/internal/crawler-runs/${encodeURIComponent(candidate.runId)}/source-observation`, {
      ...this.controlEnvelope(),
      attempt: candidate.attempt,
      observed_at: observedAt,
      operation: 'repair_players',
      run_id: candidate.runId,
      sequence,
      source_revision: candidate.snapshot.sourceRevision,
      sources: input.sources,
      type: 'source_observation',
    }) as Promise<RepairSourceObservationResponse>
  }

  async repairSourceObservation(candidate: RunnerCandidate, sequence: number, input: RepairSourceObservationInput): Promise<RepairSourceObservationResponse> {
    return this.observeRepairSource(candidate, sequence, input)
  }

  async failed(candidate: RunnerCandidate, sequence: number, code: string): Promise<EventResult> {
    return this.event(candidate, sequence, 'failed', { code })
  }

  private controlEnvelope() {
    return createRunnerEnvelope(this.config.callbackKeyId)
  }

  private async event(candidate: RunnerCandidate, sequence: number, type: 'cancelled' | 'failed' | 'heartbeat' | 'log' | 'succeeded', extra: Record<string, unknown> = {}): Promise<EventResult> {
    return this.post(`/api/internal/crawler-runs/${candidate.runId}/events`, {
      ...this.controlEnvelope(),
      ...extra,
      attempt: candidate.attempt,
      run_id: candidate.runId,
      sequence,
      type,
    }) as Promise<EventResult>
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<unknown> {
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
    if (!response.ok) {
      throw new Error(`Runner control request failed: ${response.status}`)
    }
    return response.json()
  }
}
