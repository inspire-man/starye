import { createRunnerEventId, signRunnerBody } from './event-signer'

export interface RunnerSnapshot {
  readonly entrypoint: 'movie-crawler' | 'manga-crawler'
  readonly permissionResource: 'comic' | 'movie'
  readonly templateKey: 'manga' | 'movie'
  readonly templateVersion: 1
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

interface EventResult {
  readonly accepted: boolean
  readonly cancel_requested?: boolean
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
      candidate: { attempt: number, run_id: string, sequence: number, snapshot: RunnerSnapshot } | null
    }
    return response.candidate
      ? { attempt: response.candidate.attempt, runId: response.candidate.run_id, sequence: response.candidate.sequence, snapshot: response.candidate.snapshot }
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

  async failed(candidate: RunnerCandidate, sequence: number, code: string): Promise<EventResult> {
    return this.event(candidate, sequence, 'failed', { code })
  }

  private controlEnvelope() {
    return {
      event_id: createRunnerEventId(),
      key_id: this.config.callbackKeyId,
      nonce: createRunnerEventId(),
      timestamp: Date.now(),
    }
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
    const response = await this.fetch(`${this.config.apiBaseUrl}${path}`, {
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
