import type { CrawlerTaskTemplateKey } from '../../../domain/crawler-tasks/types'
import type { SourceReadinessProjection } from '../../../domain/movies/source-contract'
import type { GitHubActionsClient } from '../../../lib/github-app/github-actions-client'
import type { AppEnv, SessionUser } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { HTTPException } from 'hono/http-exception'
import { createProviderDispatchInput, createProviderSnapshot } from '../../../domain/crawler-tasks/provider-association'
import { createCrawlerTaskRepository, decodeCrawlerTaskCursor, encodeCrawlerTaskCursor } from '../../../domain/crawler-tasks/repository'
import { getCrawlerTaskTemplate } from '../../../domain/crawler-tasks/template-registry'
import { createServerReadinessProjection } from '../../../domain/movies/source-contract'
import { createGitHubActionsClient } from '../../../lib/github-app/github-actions-client'
import { canAccessCrawler } from '../../../lib/permissions'
import {
  CrawlerTaskIdParamsSchema,
  CrawlerTaskLogsQuerySchema,
  CrawlerTaskRunParamsSchema,
  CreateCrawlerTaskSchema,
  ListCrawlerTasksQuerySchema,
  RetryCrawlerTaskSchema,
} from '../../../schemas/crawler-tasks'

interface D1Statement {
  all: <T>() => Promise<{ results?: T[] }>
  bind: (...values: unknown[]) => D1Statement
}

interface D1Client {
  prepare: (query: string) => D1Statement
}

type CrawlerRepository = ReturnType<typeof createCrawlerTaskRepository>

function createProviderClient(env: AppEnv['Bindings']): GitHubActionsClient | undefined {
  if (!env)
    return undefined
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY
    || !env.GITHUB_ACTIONS_OWNER || !env.GITHUB_ACTIONS_REPOSITORY || !env.GITHUB_ACTIONS_ENVIRONMENT) {
    return undefined
  }
  return createGitHubActionsClient({
    bindings: {
      appId: env.GITHUB_APP_ID,
      environment: env.GITHUB_ACTIONS_ENVIRONMENT,
      installationId: env.GITHUB_APP_INSTALLATION_ID,
      owner: env.GITHUB_ACTIONS_OWNER,
      privateKeyPem: env.GITHUB_APP_PRIVATE_KEY,
      repository: env.GITHUB_ACTIONS_REPOSITORY,
    },
  })
}

function projectProviderResult(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object' || Array.isArray(result))
    return { kind: 'provider_unavailable' }
  const value = result as Record<string, unknown>
  if (value.ok === true)
    return { accepted: true, kind: value.value && typeof value.value === 'object' ? (value.value as Record<string, unknown>).kind ?? 'provider_accepted' : 'provider_accepted' }
  return {
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
    ...(typeof value.retryable === 'boolean' ? { retryable: value.retryable } : {}),
    ...(typeof value.status === 'number' ? { status: value.status } : {}),
  }
}

async function dispatchCreatedRun(
  c: any,
  repository: CrawlerRepository,
  input: { readonly runId: string, readonly attempt: number, readonly template: CrawlerTaskTemplateKey },
): Promise<Record<string, unknown>> {
  const provider = createProviderClient(c.env as AppEnv['Bindings'])
  const association = await repository.ensureProviderAssociation?.({
    attempt: input.attempt,
    runId: input.runId,
    template: input.template,
  })
  const decision = await repository.claimDispatch?.(input.runId)
  if (!provider)
    return { kind: 'provider_not_configured', ...(decision ? { decision } : {}) }
  const snapshot = createProviderSnapshot(input.template)
  const result = await provider.dispatchWorkflow({
    dispatch: createProviderDispatchInput({ attempt: input.attempt, runId: input.runId, templateKey: input.template }),
    snapshot,
  })
  if (!result.ok && !result.retryable)
    await repository.failProviderReconciliation?.(input.runId, input.attempt, result.code)
  return {
    ...(association ? { association: { runId: association.runId, applicationAttempt: association.applicationAttempt } } : {}),
    ...(decision ? { decision } : {}),
    provider: projectProviderResult(result),
  }
}

interface TaskAccessRow {
  template_key: CrawlerTaskTemplateKey
}

interface SafeCrawlerReceipt {
  createdCount: number
  primaryContentId: string
  receiptSchemaVersion?: 2
  source?: SourceReadinessProjection
  templateKey: CrawlerTaskTemplateKey
  updatedCount: number
}

interface PersistedReceiptColumns {
  receipt_schema_version?: unknown
  receipt_primary_content_id?: unknown
  receipt_source_revision?: unknown
}

function projectReceipt(status: unknown, raw: unknown, persisted: PersistedReceiptColumns = {}): SafeCrawlerReceipt | null {
  if (status !== 'succeeded' || typeof raw !== 'string') {
    return status === 'succeeded' && raw && typeof raw === 'object' && !Array.isArray(raw)
      ? projectReceipt(status, JSON.stringify(raw), persisted)
      : null
  }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null
    const receipt = value as Record<string, unknown>
    if ((receipt.templateKey !== 'movie' && receipt.templateKey !== 'manga')
      || typeof receipt.primaryContentId !== 'string'
      || !/^\w[\w-]{0,127}$/u.test(receipt.primaryContentId)
      || receipt.primaryContentId.length === 0
      || typeof receipt.createdCount !== 'number'
      || !Number.isInteger(receipt.createdCount)
      || receipt.createdCount < 0
      || typeof receipt.updatedCount !== 'number'
      || !Number.isInteger(receipt.updatedCount)) {
      return null
    }
    if (receipt.updatedCount < 0
      || (receipt.receiptSchemaVersion !== undefined && receipt.receiptSchemaVersion !== 2)
      || (persisted.receipt_schema_version !== undefined
        && persisted.receipt_schema_version !== null
        && persisted.receipt_schema_version !== 2)
      || (typeof persisted.receipt_primary_content_id === 'string'
        && persisted.receipt_primary_content_id.length > 0
        && persisted.receipt_primary_content_id !== receipt.primaryContentId)) {
      return null
    }

    let source: SourceReadinessProjection | undefined
    if (receipt.source !== undefined) {
      if (!receipt.source || typeof receipt.source !== 'object' || Array.isArray(receipt.source))
        return null
      const candidate = receipt.source as Record<string, unknown>
      const reasonCodes = ['no_eligible_source', 'repair_requested', 'source_candidate_invalid', 'source_read_failed', 'source_write_failed']
      const validReason = candidate.reasonCode === null
        || (typeof candidate.reasonCode === 'string' && reasonCodes.includes(candidate.reasonCode))
      if ((candidate.disposition !== 'ready'
        && candidate.disposition !== 'no_source'
        && candidate.disposition !== 'source_failed'
        && candidate.disposition !== 'repairing')
      || typeof candidate.eligibleCount !== 'number'
      || !Number.isSafeInteger(candidate.eligibleCount)
      || candidate.eligibleCount < 0
      || typeof candidate.observedAt !== 'number'
      || !Number.isSafeInteger(candidate.observedAt)
      || candidate.observedAt < 0
      || typeof candidate.repairable !== 'boolean'
      || !validReason
      || typeof candidate.sourceRevision !== 'number'
      || !Number.isSafeInteger(candidate.sourceRevision)
      || candidate.sourceRevision < 0
      || (typeof persisted.receipt_source_revision === 'number'
        && persisted.receipt_source_revision !== candidate.sourceRevision)) {
        return null
      }
      source = {
        disposition: candidate.disposition,
        eligibleCount: candidate.eligibleCount,
        observedAt: candidate.observedAt,
        reasonCode: candidate.reasonCode,
        repairable: candidate.repairable,
        sourceRevision: candidate.sourceRevision,
      } as SourceReadinessProjection
    }

    return {
      createdCount: receipt.createdCount,
      primaryContentId: receipt.primaryContentId,
      ...(receipt.receiptSchemaVersion === 2 || persisted.receipt_schema_version === 2 ? { receiptSchemaVersion: 2 as const } : {}),
      ...(source ? { source } : {}),
      templateKey: receipt.templateKey,
      updatedCount: receipt.updatedCount,
    }
  }
  catch {
    return null
  }
}

function projectReadiness(row: Record<string, unknown>, receipt: SafeCrawlerReceipt | null): ReturnType<typeof createServerReadinessProjection> | null {
  if (!receipt)
    return null
  const observedAt = row.terminal_at ?? row.terminalAt ?? row.updated_at ?? row.updatedAt ?? row.created_at ?? row.createdAt
  const source = receipt.source ?? {
    disposition: 'source_failed' as const,
    eligibleCount: 0,
    observedAt: typeof observedAt === 'number' && Number.isSafeInteger(observedAt) && observedAt >= 0 ? observedAt : 0,
    reasonCode: 'source_read_failed' as const,
    repairable: true,
    sourceRevision: typeof row.receipt_source_revision === 'number' && Number.isSafeInteger(row.receipt_source_revision) && row.receipt_source_revision >= 0
      ? row.receipt_source_revision
      : 0,
  }
  return createServerReadinessProjection({
    contentId: receipt.primaryContentId,
    metadataObservedAt: observedAt as number | null | undefined,
    receipt: {
      persisted: true,
      primaryContentId: receipt.primaryContentId,
      schemaVersion: receipt.receiptSchemaVersion ?? null,
    },
    sourceState: source,
  })
}

function projectRun(row: Record<string, unknown>): Record<string, unknown> {
  const {
    receipt: rawReceipt,
    receipt_primary_content_id: _receiptPrimaryContentId,
    receipt_schema_version: _receiptSchemaVersion,
    receipt_source_revision: _receiptSourceRevision,
    receipt_summary_json: receiptSummary,
    ...safeRun
  } = row
  const receipt = projectReceipt(row.status, receiptSummary ?? rawReceipt, {
    receipt_primary_content_id: row.receipt_primary_content_id,
    receipt_schema_version: row.receipt_schema_version,
    receipt_source_revision: row.receipt_source_revision,
  })
  return {
    ...safeRun,
    receipt,
    ...(receipt ? { readiness: projectReadiness(row, receipt) } : {}),
  }
}

function projectTaskDetail(detail: { task: unknown, runs: readonly unknown[] }): Record<string, unknown> {
  return {
    runs: detail.runs.map(run => projectRun(run as Record<string, unknown>)),
    task: detail.task,
  }
}

function getD1(c: { get: (key: 'db') => unknown }): D1Client {
  return (c.get('db') as { $client: D1Client }).$client
}

async function requireSessionUser(c: { get: (key: 'auth') => any, req: { raw: Request } }): Promise<SessionUser> {
  const session = await c.get('auth')?.api?.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    throw new HTTPException(401, { message: 'Unauthorized: Please login first' })
  }
  return session.user as SessionUser
}

function requireTemplateAccess(user: SessionUser, templateKey: CrawlerTaskTemplateKey): void {
  const template = getCrawlerTaskTemplate(templateKey)
  if (!canAccessCrawler(user, template.permissionResource)) {
    throw new HTTPException(403, { message: 'Forbidden for crawler task template' })
  }
}

async function requireTaskAccess(c: any, user: SessionUser, taskId: string): Promise<TaskAccessRow> {
  const row = await getD1(c).prepare(`
    SELECT template_key FROM crawler_task WHERE id = ?
  `).bind(taskId).all<TaskAccessRow>()
  const task = row.results?.[0]
  if (!task) {
    throw new HTTPException(404, { message: 'Crawler task not found' })
  }
  requireTemplateAccess(user, task.template_key)
  return task
}

async function requireTaskRunAccess(c: any, user: SessionUser, taskId: string, runId: string): Promise<void> {
  await requireTaskAccess(c, user, taskId)
  const row = await getD1(c).prepare(`
    SELECT run.id
    FROM crawler_run AS run
    INNER JOIN crawler_task AS task ON task.id = run.task_id
    WHERE task.id = ? AND run.id = ?
  `).bind(taskId, runId).all<{ id: string }>()
  if (!row.results?.[0]) {
    throw new HTTPException(404, { message: 'Crawler run not found for task' })
  }
}

function parseTaskCursor(value: string | undefined) {
  if (!value)
    return undefined
  try {
    return decodeCrawlerTaskCursor(value)
  }
  catch {
    throw new HTTPException(400, { message: 'Invalid crawler task cursor' })
  }
}

export const adminCrawlerTasksRoutes = new Hono<AppEnv>()

adminCrawlerTasksRoutes.post('/', validator('json', CreateCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { template } = c.req.valid('json')
  requireTemplateAccess(user, template)

  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.createOrGetActiveRun({
    requestedByUserId: user.id,
    templateKey: template,
  })
  const dispatch = result.kind === 'created'
    ? await dispatchCreatedRun(c, repository, { attempt: result.run.attemptNumber, runId: result.run.id, template })
    : { kind: 'existing_active_run' }

  return c.json({ dispatch, kind: result.kind, run: result.run, template })
})

adminCrawlerTasksRoutes.get('/', validator('query', ListCrawlerTasksQuerySchema), async (c) => {
  const user = await requireSessionUser(c)
  const { cursor, limit, template } = c.req.valid('query')
  if (template)
    requireTemplateAccess(user, template)
  const repository = createCrawlerTaskRepository(c.get('db'))
  const decodedCursor = parseTaskCursor(cursor)
  if (repository.listTasks) {
    const page = await repository.listTasks({ cursor: decodedCursor, limit, templateKey: template })
    if (page)
      return c.json(page)
  }
  const rows = await getD1(c).prepare(`
    SELECT id, template_key, latest_run_id, created_at, updated_at
    FROM crawler_task
    WHERE (? IS NULL OR template_key = ?)
      AND (? IS NULL OR updated_at < ? OR (updated_at = ? AND id < ?))
    ORDER BY updated_at DESC, id DESC LIMIT ?
  `).bind(
    template ?? null,
    template ?? null,
    decodedCursor ? decodedCursor.updatedAt : null,
    decodedCursor ? decodedCursor.updatedAt : null,
    decodedCursor ? decodedCursor.updatedAt : null,
    decodedCursor?.id ?? null,
    limit + 1,
  ).all<Record<string, unknown>>()
  const pageRows = rows.results ?? []
  const visible = pageRows.slice(0, limit).filter((task) => {
    const key = task.template_key as CrawlerTaskTemplateKey
    return canAccessCrawler(user, getCrawlerTaskTemplate(key).permissionResource)
  })
  const last = visible.at(-1)
  return c.json({
    nextCursor: pageRows.length > limit && last
      ? encodeCrawlerTaskCursor({ id: String(last.id), updatedAt: Number(last.updated_at) })
      : null,
    tasks: visible,
  })
})

adminCrawlerTasksRoutes.get('/:taskId', validator('param', CrawlerTaskIdParamsSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId } = c.req.valid('param')
  await requireTaskAccess(c, user, taskId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  if (repository.getTaskDetail) {
    const detail = await repository.getTaskDetail(taskId)
    if (detail)
      return c.json(projectTaskDetail(detail))
  }
  const d1 = getD1(c)
  const [task, runs] = await Promise.all([
    d1.prepare('SELECT id, template_key, latest_run_id, created_at, updated_at FROM crawler_task WHERE id = ?').bind(taskId).all<Record<string, unknown>>(),
    d1.prepare('SELECT id, attempt_number, status, state_version, failure_code, receipt_summary_json, receipt_schema_version, receipt_primary_content_id, receipt_source_revision, created_at, terminal_at FROM crawler_run WHERE task_id = ? ORDER BY attempt_number DESC').bind(taskId).all<Record<string, unknown>>(),
  ])
  return c.json({ runs: (runs.results ?? []).map(projectRun), task: task.results?.[0] })
})

adminCrawlerTasksRoutes.get('/:taskId/runs/:runId/logs', validator('param', CrawlerTaskRunParamsSchema), validator('query', CrawlerTaskLogsQuerySchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  const { cursor, limit } = c.req.valid('query')
  await requireTaskRunAccess(c, user, taskId, runId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  if (repository.listRunLogs) {
    const page = await repository.listRunLogs({ cursor, limit, runId, taskId })
    if (page)
      return c.json(page)
  }
  const logs = await getD1(c).prepare(`
    SELECT log.sequence, log.level, log.code, log.safe_message, log.counts_json, log.created_at
    FROM crawler_run_log AS log
    INNER JOIN crawler_run AS run ON run.id = log.run_id
    WHERE run.task_id = ? AND log.run_id = ? AND (? IS NULL OR log.sequence < ?)
    ORDER BY log.sequence DESC LIMIT ?
  `).bind(taskId, runId, cursor ?? null, cursor ?? null, limit).all<Record<string, unknown>>()
  const rows = logs.results ?? []
  return c.json({
    logs: rows,
    nextCursor: rows.length === limit ? Number(rows[rows.length - 1]?.sequence) : null,
  })
})

adminCrawlerTasksRoutes.post('/:taskId/runs/:runId/cancel', validator('param', CrawlerTaskRunParamsSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  await requireTaskRunAccess(c, user, taskId, runId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.applyTransition(runId, {
    actor: 'admin',
    type: 'admin_cancel',
  })
  let provider: Record<string, unknown> = { kind: 'not_requested' }
  if (result.kind === 'transition' && result.nextStatus === 'cancel_requested') {
    const association = await repository.getProviderAssociation?.(runId)
    const client = createProviderClient(c.env as AppEnv['Bindings'])
    if (association?.providerRunId && client) {
      provider = projectProviderResult(await client.cancelWorkflowRun({
        providerRunId: association.providerRunId,
        snapshot: createProviderSnapshot(association.template),
      }))
    }
    else if (!association?.providerRunId) {
      provider = { kind: 'provider_binding_pending' }
    }
    else {
      provider = { kind: 'provider_not_configured' }
    }
  }
  return c.json({ decision: result, provider })
})

adminCrawlerTasksRoutes.post('/:taskId/runs/:runId/retry', validator('param', CrawlerTaskRunParamsSchema), validator('json', RetryCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  await requireTaskRunAccess(c, user, taskId, runId)
  const repository = createCrawlerTaskRepository(c.get('db'))
  const result = await repository.retryRun(runId)
  const dispatch = result.kind === 'created'
    ? await dispatchCreatedRun(c, repository, { attempt: result.run.attemptNumber, runId: result.run.id, template: result.snapshot.templateKey })
    : { kind: 'existing_active_run' }
  return c.json({ dispatch, kind: result.kind, run: result.run })
})
