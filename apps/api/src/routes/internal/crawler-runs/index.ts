import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as v from 'valibot'
import { normalizeRunnerEventForStorage } from '../../../domain/crawler-tasks/log-redaction'
import { createProviderSnapshot } from '../../../domain/crawler-tasks/provider-association'
import { createCrawlerTaskRepository } from '../../../domain/crawler-tasks/repository'
import { verifyRunnerEventSignature } from '../../../domain/crawler-tasks/runner-event-auth'
import {
  CrawlerRunClaimRequestSchema,
  CrawlerRunEventSchema,
  CrawlerRunPollRequestSchema,
} from '../../../schemas/crawler-run-events'

const MAX_EVENT_AGE_MS = 5 * 60_000

function previousValidity(env: AppEnv['Bindings']): number | undefined {
  if (!env.TASK_RUNNER_CALLBACK_SECRET_PREVIOUS || !env.TASK_RUNNER_CALLBACK_KEY_ID_PREVIOUS || !env.TASK_RUNNER_CALLBACK_PREVIOUS_ROTATED_AT)
    return undefined
  const rotatedAt = Date.parse(env.TASK_RUNNER_CALLBACK_PREVIOUS_ROTATED_AT)
  return Number.isFinite(rotatedAt) ? rotatedAt + 24 * 60 * 60_000 : undefined
}

type LifecycleEvent = Extract<v.InferOutput<typeof CrawlerRunEventSchema>, { type: 'heartbeat' | 'progress' | 'log' | 'succeeded' | 'failed' | 'cancelled' }>

function eventForTransition(event: LifecycleEvent) {
  switch (event.type) {
    case 'heartbeat': return { actor: 'runner' as const, sequence: event.sequence, type: 'runner_heartbeat' as const }
    case 'progress': return { actor: 'runner' as const, sequence: event.sequence, type: 'runner_progress' as const }
    case 'log': return { actor: 'runner' as const, sequence: event.sequence, type: 'runner_log' as const }
    case 'succeeded': return { actor: 'runner' as const, receipt: event.receipt!, sequence: event.sequence, type: 'runner_succeeded' as const }
    case 'failed': return { actor: 'runner' as const, sequence: event.sequence, type: 'runner_failed' as const }
    case 'cancelled': return { actor: 'runner' as const, sequence: event.sequence, type: 'runner_cancelled' as const }
  }
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', value))
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function claimResponse(outcome: Readonly<Record<string, unknown>>): { accepted: boolean, reason?: string } {
  if (outcome.accepted === true) {
    return { accepted: true }
  }
  return {
    accepted: false,
    reason: typeof outcome.reason === 'string' ? outcome.reason : 'invalid_transition',
  }
}

interface ScheduleRegisterResult {
  readonly accepted: boolean
  readonly attempt: number
  readonly runId: string
}

interface ProviderStartedResult {
  readonly accepted: boolean
  readonly cancelRequested: boolean
}

interface RunnerEventRepository {
  readonly claimDispatch: ReturnType<typeof createCrawlerTaskRepository>['claimDispatch']
  readonly getRun: ReturnType<typeof createCrawlerTaskRepository>['getRun']
  readonly pollDispatch: ReturnType<typeof createCrawlerTaskRepository>['pollDispatch']
  readonly processRunnerEvent: ReturnType<typeof createCrawlerTaskRepository>['processRunnerEvent']
  readonly providerStarted?: (input: Record<string, unknown>) => Promise<ProviderStartedResult>
  readonly scheduleRegister?: (input: Record<string, unknown>) => Promise<ScheduleRegisterResult>
}

function providerSnapshotMatches(event: Extract<v.InferOutput<typeof CrawlerRunEventSchema>, { type: 'schedule_register' | 'provider_started' }>): boolean {
  try {
    const snapshot = createProviderSnapshot(event.template)
    return snapshot.workflow === event.workflow
      && snapshot.repository === event.repository
      && snapshot.ref === event.ref
      && snapshot.environment === event.environment
      && snapshot.target === event.target
  }
  catch {
    return false
  }
}

export function createCrawlerRunsRoutes(options: {
  readonly createRepository?: (database: AppEnv['Variables']['db']) => RunnerEventRepository
  readonly now?: () => number
} = {}) {
  const createRepository = options.createRepository ?? (database => createCrawlerTaskRepository(database) as unknown as RunnerEventRepository)
  const now = options.now ?? (() => Date.now())
  const crawlerRunsRoutes = new Hono<AppEnv>()

  async function verifySignedRequest(c: Context<AppEnv>, rawBody: ArrayBuffer, currentNow: number) {
    const keys = {
      current: { id: c.env.TASK_RUNNER_CALLBACK_KEY_ID_CURRENT, secret: c.env.TASK_RUNNER_CALLBACK_SECRET_CURRENT },
      previous: c.env.TASK_RUNNER_CALLBACK_SECRET_PREVIOUS && c.env.TASK_RUNNER_CALLBACK_KEY_ID_PREVIOUS
        ? { id: c.env.TASK_RUNNER_CALLBACK_KEY_ID_PREVIOUS, secret: c.env.TASK_RUNNER_CALLBACK_SECRET_PREVIOUS, validUntil: previousValidity(c.env) }
        : undefined,
    }
    const signature = await verifyRunnerEventSignature({
      body: rawBody,
      keyId: c.req.header('x-runner-key-id') ?? '',
      keys,
      now: currentNow,
      signature: c.req.header('x-runner-signature') ?? '',
    })
    if (!signature.valid) {
      throw new HTTPException(401, { message: 'Invalid runner signature' })
    }
    return signature
  }

  async function parseRawJson(rawBody: ArrayBuffer): Promise<unknown> {
    try {
      return await new Response(rawBody).json()
    }
    catch {
      throw new HTTPException(400, { message: 'Invalid runner request envelope' })
    }
  }

  crawlerRunsRoutes.post('/poll', async (c) => {
    const rawBody = await c.req.arrayBuffer()
    const currentNow = now()
    const signature = await verifySignedRequest(c, rawBody, currentNow)
    const parsed = v.safeParse(CrawlerRunPollRequestSchema, await parseRawJson(rawBody))
    if (!parsed.success || parsed.output.key_id !== signature.keyId || Math.abs(currentNow - parsed.output.timestamp) > MAX_EVENT_AGE_MS) {
      throw new HTTPException(400, { message: 'Invalid runner poll envelope' })
    }

    const candidate = await createRepository(c.get('db')).pollDispatch()
    return c.json({
      candidate: candidate
        ? {
            attempt: candidate.attempt,
            run_id: candidate.runId,
            sequence: candidate.sequence,
            snapshot: candidate.snapshot,
          }
        : null,
    })
  })

  crawlerRunsRoutes.post('/:runId/claim', async (c) => {
    const rawBody = await c.req.arrayBuffer()
    const currentNow = now()
    const signature = await verifySignedRequest(c, rawBody, currentNow)
    const parsed = v.safeParse(CrawlerRunClaimRequestSchema, await parseRawJson(rawBody))
    if (!parsed.success || parsed.output.key_id !== signature.keyId || parsed.output.run_id !== c.req.param('runId') || Math.abs(currentNow - parsed.output.timestamp) > MAX_EVENT_AGE_MS) {
      throw new HTTPException(400, { message: 'Invalid runner claim envelope' })
    }

    const result = await createRepository(c.get('db')).claimDispatch({
      attempt: parsed.output.attempt,
      bodySha256: await sha256Hex(rawBody),
      eventId: parsed.output.event_id,
      keyId: parsed.output.key_id,
      nonce: parsed.output.nonce,
      runId: parsed.output.run_id,
      sequence: parsed.output.sequence,
    })
    if (result.kind === 'not_found') {
      throw new HTTPException(404, { message: 'Crawler run not found' })
    }
    if (result.kind === 'conflict') {
      throw new HTTPException(409, { message: 'Conflicting runner claim replay' })
    }
    if (result.kind === 'attempt_mismatch') {
      return c.json({ accepted: false, reason: 'attempt_mismatch' }, 409)
    }
    if (result.kind === 'duplicate') {
      const outcome = claimResponse(result.outcome)
      return c.json(outcome, (outcome.accepted ? 200 : 409) as 200 | 409)
    }
    if (result.kind === 'accepted' && result.outcome) {
      return c.json(claimResponse(result.outcome))
    }
    if (result.kind === 'rejected' && result.outcome) {
      return c.json(claimResponse(result.outcome), 409)
    }

    const decision = result as unknown as { kind: string, nextStatus?: string, reasonCode?: string }
    return c.json(
      decision.kind === 'transition'
        ? { accepted: true }
        : { accepted: false, reason: decision.reasonCode ?? 'invalid_transition' },
      decision.kind === 'transition' ? 200 : 409,
    )
  })

  crawlerRunsRoutes.post('/schedule-register', async (c) => {
    const rawBody = await c.req.arrayBuffer()
    const currentNow = now()
    const signature = await verifySignedRequest(c, rawBody, currentNow)
    const parsed = v.safeParse(CrawlerRunEventSchema, await parseRawJson(rawBody))
    if (!parsed.success || parsed.output.type !== 'schedule_register')
      throw new HTTPException(400, { message: 'Invalid schedule registration envelope' })
    const event = parsed.output as Extract<v.InferOutput<typeof CrawlerRunEventSchema>, { type: 'schedule_register' }>
    if (event.key_id !== signature.keyId || Math.abs(currentNow - Date.parse(event.scheduled_at)) > MAX_EVENT_AGE_MS)
      throw new HTTPException(400, { message: 'Invalid schedule registration identity' })
    if (!providerSnapshotMatches(event))
      throw new HTTPException(400, { message: 'Schedule provider snapshot mismatch' })
    const repository = createRepository(c.get('db'))
    if (!repository.scheduleRegister)
      throw new HTTPException(503, { message: 'Schedule registration unavailable' })

    const result = await repository.scheduleRegister({
      bodySha256: await sha256Hex(rawBody),
      environment: event.environment,
      eventId: event.event_id,
      keyId: event.key_id,
      nonce: event.nonce,
      ref: event.ref,
      repository: event.repository,
      scheduleBucket: event.schedule_bucket ?? event.scheduled_at,
      scheduledAt: event.scheduled_at,
      target: event.target,
      template: event.template,
      workflow: event.workflow,
    })
    return c.json({
      accepted: result.accepted,
      attempt: result.attempt,
      run_id: result.runId,
    }, result.accepted ? 200 : 409)
  })

  crawlerRunsRoutes.post('/:runId/provider-started', async (c) => {
    const rawBody = await c.req.arrayBuffer()
    const currentNow = now()
    const signature = await verifySignedRequest(c, rawBody, currentNow)
    const parsed = v.safeParse(CrawlerRunEventSchema, await parseRawJson(rawBody))
    if (!parsed.success || parsed.output.type !== 'provider_started')
      throw new HTTPException(400, { message: 'Invalid provider start envelope' })
    const event = parsed.output as Extract<v.InferOutput<typeof CrawlerRunEventSchema>, { type: 'provider_started' }>
    if (event.key_id !== signature.keyId || event.run_id !== c.req.param('runId'))
      throw new HTTPException(400, { message: 'Provider start identity mismatch' })
    if (Math.abs(currentNow - event.timestamp) > MAX_EVENT_AGE_MS || !providerSnapshotMatches(event))
      throw new HTTPException(400, { message: 'Provider start snapshot mismatch' })
    const repository = createRepository(c.get('db'))
    if (!repository.providerStarted)
      throw new HTTPException(503, { message: 'Provider start unavailable' })

    const result = await repository.providerStarted({
      attempt: event.attempt,
      bodySha256: await sha256Hex(rawBody),
      environment: event.environment,
      eventId: event.event_id,
      keyId: event.key_id,
      nonce: event.nonce,
      providerRunAttempt: event.provider_run_attempt,
      providerRunId: event.provider_run_id,
      ref: event.ref,
      repository: event.repository,
      runId: event.run_id,
      sha: event.sha,
      target: event.target,
      template: event.template,
      workflow: event.workflow,
    })
    return c.json({
      accepted: result.accepted,
      cancel_requested: result.cancelRequested,
    }, result.accepted ? 200 : 409)
  })

  crawlerRunsRoutes.post('/:runId/events', async (c) => {
    const rawBody = await c.req.arrayBuffer()
    const currentNow = now()
    const signature = await verifySignedRequest(c, rawBody, currentNow)

    const parsed = v.safeParse(CrawlerRunEventSchema, await parseRawJson(rawBody))
    if (!parsed.success || (parsed.output.type !== 'heartbeat' && parsed.output.type !== 'progress' && parsed.output.type !== 'log' && parsed.output.type !== 'succeeded' && parsed.output.type !== 'failed' && parsed.output.type !== 'cancelled'))
      throw new HTTPException(400, { message: 'Invalid runner event envelope' })
    const event = parsed.output as LifecycleEvent
    if (event.key_id !== signature.keyId || event.run_id !== c.req.param('runId'))
      throw new HTTPException(400, { message: 'Runner event identity mismatch' })
    if (Math.abs(currentNow - event.timestamp) > MAX_EVENT_AGE_MS)
      throw new HTTPException(400, { message: 'Runner event timestamp expired' })
    if (event.type === 'succeeded' && !event.receipt)
      throw new HTTPException(400, { message: 'Success receipt required' })
    if (event.type !== 'succeeded' && event.receipt)
      throw new HTTPException(400, { message: 'Only success events may include a receipt' })

    const normalized = normalizeRunnerEventForStorage({
      code: event.code,
      counts: event.counts,
      level: event.level,
      message: event.message,
      receipt: event.receipt,
      type: event.type,
    })
    const result = await createRepository(c.get('db')).processRunnerEvent({
      attempt: event.attempt,
      bodySha256: await sha256Hex(rawBody),
      event: eventForTransition(event),
      eventId: event.event_id,
      keyId: event.key_id,
      log: normalized.log ? { ...normalized.log, runId: event.run_id, sequence: event.sequence } : undefined,
      nonce: event.nonce,
      receipt: normalized.receipt,
      runId: event.run_id,
      safeSummary: normalized.terminalSummary ?? normalized.log?.message,
      sequence: event.sequence,
    })
    if (result.kind === 'not_found')
      throw new HTTPException(404, { message: 'Crawler run not found' })
    if (result.kind === 'attempt_mismatch' || result.kind === 'receipt_template_mismatch') {
      throw new HTTPException(400, { message: 'Runner event binding mismatch' })
    }
    if (result.kind === 'conflict')
      throw new HTTPException(409, { message: 'Conflicting runner event replay' })
    const run = await createRepository(c.get('db')).getRun(event.run_id)
    return c.json({
      ...result.outcome,
      cancel_requested: run?.status === 'cancel_requested',
    })
  })

  return crawlerRunsRoutes
}

export const crawlerRunsRoutes = createCrawlerRunsRoutes()
