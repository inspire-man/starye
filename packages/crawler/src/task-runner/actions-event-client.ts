import { signRunnerBody } from './event-signer'
import { createRunnerEnvelope } from './runner-client'

export interface ActionsEventClientConfig {
  readonly apiBaseUrl: string
  readonly callbackKeyId: string
  readonly callbackSecret: string
  readonly environment: 'starye-org'
  readonly fetch?: typeof fetch
  readonly now?: () => number
  readonly ref: 'main'
  readonly repository: 'inspire-man/starye'
  readonly retryDelaysMs?: readonly number[]
  readonly runId?: string
  readonly attempt?: number
  readonly providerRunId?: string
  readonly providerRunAttempt?: number
  readonly sha?: string
  readonly target: 'starye-org'
  readonly template: 'movie' | 'manga'
  readonly timeoutMs?: number
  readonly workflow: '.github/workflows/daily-manga-crawl.yml' | '.github/workflows/daily-movie-crawl.yml'
}

export interface ActionsEventResponse {
  readonly accepted: boolean
  readonly attempt?: number
  readonly cancel_requested?: boolean
  readonly reason?: string
  readonly run_id?: string
}

interface ScheduleRegisterInput {
  readonly scheduleBucket: string
  readonly scheduledAt: string
}

interface ProviderStartedInput {
  readonly attempt: number
  readonly providerRunAttempt: number
  readonly providerRunId: string
  readonly runId: string
  readonly sha: string
}

type TerminalType = 'cancelled' | 'failed' | 'succeeded'

export class ActionsEventClient {
  private readonly fetch: typeof fetch
  private readonly now: () => number
  private readonly retryDelaysMs: readonly number[]
  private readonly timeoutMs: number

  constructor(private readonly config: ActionsEventClientConfig) {
    this.fetch = config.fetch ?? globalThis.fetch
    this.now = config.now ?? (() => Date.now())
    this.retryDelaysMs = config.retryDelaysMs ?? [250, 1_000]
    this.timeoutMs = config.timeoutMs ?? 10_000
  }

  async scheduleRegister(input: ScheduleRegisterInput): Promise<ActionsEventResponse> {
    return this.request('/api/internal/crawler-runs/schedule-register', {
      environment: this.config.environment,
      ref: this.config.ref,
      repository: this.config.repository,
      schedule_bucket: input.scheduleBucket,
      scheduled_at: input.scheduledAt,
      target: this.config.target,
      template: this.config.template,
      type: 'schedule_register',
      workflow: this.config.workflow,
    }, true)
  }

  async providerStarted(input: ProviderStartedInput): Promise<ActionsEventResponse> {
    return this.request(`/api/internal/crawler-runs/${encodeURIComponent(input.runId)}/provider-started`, {
      ...this.providerEnvelope(input.runId, input.attempt, {
        environment: this.config.environment,
        provider_run_attempt: input.providerRunAttempt,
        provider_run_id: input.providerRunId,
        ref: this.config.ref,
        repository: this.config.repository,
        run_id: input.runId,
        sha: input.sha,
        target: this.config.target,
        template: this.config.template,
        type: 'provider_started',
        workflow: this.config.workflow,
      }),
    }, false)
  }

  async heartbeat(sequence: number): Promise<ActionsEventResponse> {
    return this.lifecycle(sequence, 'heartbeat')
  }

  async progress(sequence: number, counts?: Readonly<Record<string, number>>): Promise<ActionsEventResponse> {
    return this.lifecycle(sequence, 'progress', counts ? { counts } : {})
  }

  async log(sequence: number, message: string): Promise<ActionsEventResponse> {
    return this.lifecycle(sequence, 'log', { code: 'actions_log', level: 'info', message })
  }

  async terminal(sequence: number, type: TerminalType, extra: Record<string, unknown> = {}): Promise<ActionsEventResponse> {
    return this.lifecycle(sequence, type, extra)
  }

  async succeeded(sequence: number, contentIds: readonly string[], counts: { readonly createdCount?: number, readonly updatedCount?: number } = {}): Promise<ActionsEventResponse> {
    return this.terminal(sequence, 'succeeded', {
      receipt: { contentIds, templateKey: this.config.template, ...counts },
    })
  }

  async failed(sequence: number, code: string): Promise<ActionsEventResponse> {
    return this.terminal(sequence, 'failed', { code })
  }

  async cancelled(sequence: number): Promise<ActionsEventResponse> {
    return this.terminal(sequence, 'cancelled', { code: 'cancelled_at_safe_checkpoint' })
  }

  private lifecycle(sequence: number, type: 'cancelled' | 'failed' | 'heartbeat' | 'log' | 'progress' | 'succeeded', extra: Record<string, unknown> = {}): Promise<ActionsEventResponse> {
    if (!this.config.runId || !this.config.attempt)
      throw new Error('Actions callback run binding missing')
    return this.request(`/api/internal/crawler-runs/${encodeURIComponent(this.config.runId)}/events`, {
      ...this.providerEnvelope(this.config.runId, this.config.attempt, {
        ...extra,
        attempt: this.config.attempt,
        run_id: this.config.runId,
        sequence,
        type,
      }),
    }, false)
  }

  private providerEnvelope(runId: string, attempt: number, fields: Record<string, unknown>): Record<string, unknown> {
    return createRunnerEnvelope(this.config.callbackKeyId, {
      attempt,
      ...fields,
      run_id: runId,
    }, this.now())
  }

  private async request(path: string, fields: Record<string, unknown>, retryable: boolean): Promise<ActionsEventResponse> {
    const body = JSON.stringify(fields)
    const attempts = retryable ? this.retryDelaysMs.length + 1 : 1
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
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
        if (response.ok)
          return await response.json() as ActionsEventResponse
        if (!retryable || response.status < 500 || attempt === attempts - 1)
          throw new Error(`Actions callback request failed: ${response.status}`)
      }
      catch (error) {
        const retryableError = error instanceof DOMException && error.name === 'AbortError'
        if (!retryable || (!retryableError && attempt === attempts - 1))
          throw error
      }
      const delay = this.retryDelaysMs[attempt] ?? 0
      if (delay > 0)
        await new Promise(resolve => setTimeout(resolve, delay))
    }
    throw new Error('Actions callback request exhausted retries')
  }
}
