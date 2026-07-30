import type { CrawlerTaskTemplateKey } from '../../../domain/crawler-tasks/types'
import type { AppEnv, SessionUser } from '../../../types'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import { HTTPException } from 'hono/http-exception'
import { createCrawlerTaskRepository } from '../../../domain/crawler-tasks/repository'
import { getCrawlerTaskTemplate } from '../../../domain/crawler-tasks/template-registry'
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

interface TaskAccessRow {
  template_key: CrawlerTaskTemplateKey
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

export const adminCrawlerTasksRoutes = new Hono<AppEnv>()

adminCrawlerTasksRoutes.post('/', validator('json', CreateCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { template } = c.req.valid('json')
  requireTemplateAccess(user, template)

  const result = await createCrawlerTaskRepository(c.get('db')).createOrGetActiveRun({
    requestedByUserId: user.id,
    templateKey: template,
  })

  return c.json({ kind: result.kind, run: result.run, template })
})

adminCrawlerTasksRoutes.get('/', validator('query', ListCrawlerTasksQuerySchema), async (c) => {
  const user = await requireSessionUser(c)
  const { cursor, limit, template } = c.req.valid('query')
  if (template)
    requireTemplateAccess(user, template)
  const rows = await getD1(c).prepare(`
    SELECT id, template_key, latest_run_id, created_at, updated_at
    FROM crawler_task
    WHERE (? IS NULL OR template_key = ?) AND (? IS NULL OR id < ?)
    ORDER BY id DESC LIMIT ?
  `).bind(template ?? null, template ?? null, cursor ?? null, cursor ?? null, limit).all<Record<string, unknown>>()
  const tasks = (rows.results ?? []).filter((task) => {
    const key = task.template_key as CrawlerTaskTemplateKey
    return canAccessCrawler(user, getCrawlerTaskTemplate(key).permissionResource)
  })
  return c.json({ tasks })
})

adminCrawlerTasksRoutes.get('/:taskId', validator('param', CrawlerTaskIdParamsSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId } = c.req.valid('param')
  await requireTaskAccess(c, user, taskId)
  const d1 = getD1(c)
  const [task, runs] = await Promise.all([
    d1.prepare('SELECT id, template_key, latest_run_id, created_at, updated_at FROM crawler_task WHERE id = ?').bind(taskId).all<Record<string, unknown>>(),
    d1.prepare('SELECT id, attempt_number, status, state_version, failure_code, receipt_summary_json, created_at, terminal_at FROM crawler_run WHERE task_id = ? ORDER BY attempt_number DESC').bind(taskId).all<Record<string, unknown>>(),
  ])
  return c.json({ runs: runs.results ?? [], task: task.results?.[0] })
})

adminCrawlerTasksRoutes.get('/:taskId/runs/:runId/logs', validator('param', CrawlerTaskRunParamsSchema), validator('query', CrawlerTaskLogsQuerySchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  const { cursor, limit } = c.req.valid('query')
  await requireTaskAccess(c, user, taskId)
  const logs = await getD1(c).prepare(`
    SELECT sequence, level, code, safe_message, counts_json, created_at
    FROM crawler_run_log WHERE run_id = ? AND (? IS NULL OR sequence > ?)
    ORDER BY sequence ASC LIMIT ?
  `).bind(runId, cursor ?? null, cursor ?? null, limit).all<Record<string, unknown>>()
  return c.json({ logs: logs.results ?? [] })
})

adminCrawlerTasksRoutes.post('/:taskId/runs/:runId/cancel', validator('param', CrawlerTaskRunParamsSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  await requireTaskAccess(c, user, taskId)
  const result = await createCrawlerTaskRepository(c.get('db')).applyTransition(runId, {
    actor: 'admin',
    type: 'admin_cancel',
  })
  return c.json({ decision: result })
})

adminCrawlerTasksRoutes.post('/:taskId/runs/:runId/retry', validator('param', CrawlerTaskRunParamsSchema), validator('json', RetryCrawlerTaskSchema), async (c) => {
  const user = await requireSessionUser(c)
  const { taskId, runId } = c.req.valid('param')
  await requireTaskAccess(c, user, taskId)
  const result = await createCrawlerTaskRepository(c.get('db')).retryRun(runId)
  return c.json({ kind: result.kind, run: result.run })
})
