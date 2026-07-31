import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { LocalTaskRunner } from '../packages/crawler/src/task-runner/local-runner'
import { RunnerClient } from '../packages/crawler/src/task-runner/runner-client'

const LOCAL_GATEWAY_ORIGIN = 'http://localhost:8080'

type TemplateKey = 'manga' | 'movie'
type RunStatus = 'cancelled' | 'cancel_requested' | 'dispatching' | 'failed' | 'queued' | 'running' | 'succeeded'

interface LocalRunnerConfig {
  readonly apiBaseUrl: string
  readonly callbackKeyId: string
  readonly callbackSecret: string
  readonly crawler: { readonly manga: object, readonly movie: object }
}

interface LocalTaskRunnerE2eConfig {
  readonly runnerConfigPath: string
  readonly sessionConfigPath: string
  readonly evidencePath?: string
}

interface SessionConfig {
  readonly cookieHeader: string
}

interface Receipt {
  readonly createdCount: number
  readonly primaryContentId: string
  readonly templateKey: TemplateKey
  readonly updatedCount: number
}

interface Run {
  readonly id: string
  readonly receipt: Receipt | null
  readonly status: RunStatus
}

interface TaskDetail {
  readonly runs: readonly Run[]
  readonly task: { readonly id: string, readonly template_key: TemplateKey }
}

interface E2eEvidence {
  readonly cancellation: { readonly runId: string, readonly status: 'cancelled' }
  readonly gatewayOrigin: typeof LOCAL_GATEWAY_ORIGIN
  readonly runs: readonly {
    readonly createdCount: number
    readonly primaryContentId: string
    readonly runId: string
    readonly taskId: string
    readonly template: TemplateKey
    readonly updatedCount: number
  }[]
  readonly target: 'local'
}

function requireLocalUrl(value: string, name: string): void {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    throw new Error(`${name} must be a loopback HTTP URL.`)
  }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`${name} must remain local; remote execution is not supported.`)
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

function parseTarget(argv: readonly string[]): void {
  if (argv.length === 0)
    return
  if (argv.length === 2 && argv[0] === '--target' && argv[1] === 'local')
    return
  throw new Error('Usage: pnpm local:task-runner:e2e --target local')
}

async function requestJson<T>(session: SessionConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${LOCAL_GATEWAY_ORIGIN}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      cookie: session.cookieHeader,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok)
    throw new Error(`Local Gateway request failed: ${response.status}`)
  return response.json() as Promise<T>
}

async function createTask(session: SessionConfig, template: TemplateKey): Promise<{ taskId: string, runId: string }> {
  const created = await requestJson<{ run: Run }>(session, '/api/admin/crawler-tasks', {
    body: JSON.stringify({ template }),
    method: 'POST',
  })
  const tasks = await requestJson<{ tasks: { id: string, latest_run_id: string | null }[] }>(session, `/api/admin/crawler-tasks?template=${template}&limit=1`)
  const task = tasks.tasks.find(item => item.latest_run_id === created.run.id)
  if (!task)
    throw new Error(`Created ${template} run was not selected by the local task read model.`)
  return { runId: created.run.id, taskId: task.id }
}

async function readRun(session: SessionConfig, taskId: string, runId: string): Promise<Run> {
  const detail = await requestJson<TaskDetail>(session, `/api/admin/crawler-tasks/${encodeURIComponent(taskId)}`)
  const run = detail.runs.find(item => item.id === runId)
  if (!run)
    throw new Error('Run disappeared from the local task read model.')
  return run
}

async function cancelRun(session: SessionConfig, taskId: string, runId: string): Promise<void> {
  await requestJson(session, `/api/admin/crawler-tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
}

async function runTemplate(
  session: SessionConfig,
  config: LocalRunnerConfig,
  template: TemplateKey,
): Promise<E2eEvidence['runs'][number]> {
  const [{ createMangaAdapter }, { createMovieAdapter }, { createTemplateAdapterRegistry }] = await Promise.all([
    import('../packages/crawler/src/task-runner/manga-adapter'),
    import('../packages/crawler/src/task-runner/movie-adapter'),
    import('../packages/crawler/src/task-runner/template-adapters'),
  ])
  const created = await createTask(session, template)
  const client = new RunnerClient(config)
  const adapters = createTemplateAdapterRegistry([
    createMovieAdapter(config.crawler.movie as never),
    createMangaAdapter(config.crawler.manga as never),
  ])
  await new LocalTaskRunner({ adapters, client }).runOnce()
  const run = await readRun(session, created.taskId, created.runId)
  if (run.status !== 'succeeded' || !run.receipt || run.receipt.templateKey !== template) {
    throw new Error(`${template} local runner execution did not produce a validated receipt.`)
  }
  return {
    createdCount: run.receipt.createdCount,
    primaryContentId: run.receipt.primaryContentId,
    runId: run.id,
    taskId: created.taskId,
    template,
    updatedCount: run.receipt.updatedCount,
  }
}

async function runControlledCancellation(session: SessionConfig, config: LocalRunnerConfig): Promise<E2eEvidence['cancellation']> {
  const created = await createTask(session, 'movie')
  const client = new RunnerClient(config)
  const adapters = {
    select: () => ({
      templateKey: 'movie' as const,
      execute: async (context: { checkpoint: () => Promise<boolean> }) => {
        await cancelRun(session, created.taskId, created.runId)
        if (!await context.checkpoint())
          throw new Error('Controlled cancellation was not acknowledged by the runner heartbeat.')
        return { contentIds: [] }
      },
    }),
  }
  await new LocalTaskRunner({ adapters, client }).runOnce()
  const run = await readRun(session, created.taskId, created.runId)
  if (run.status !== 'cancelled')
    throw new Error('Controlled local cancellation did not reach the cancelled terminal state.')
  return { runId: run.id, status: 'cancelled' }
}

export async function runLocalTaskRunnerE2e(argv: readonly string[] = process.argv.slice(2)): Promise<E2eEvidence> {
  parseTarget(argv)
  const configPath = process.env.TASK_RUNNER_E2E_CONFIG
  if (!configPath)
    throw new Error('TASK_RUNNER_E2E_CONFIG must point to an ignored local E2E config file.')
  const e2e = await readJson<LocalTaskRunnerE2eConfig>(configPath)
  const [runner, session] = await Promise.all([
    readJson<LocalRunnerConfig>(e2e.runnerConfigPath),
    readJson<SessionConfig>(e2e.sessionConfigPath),
  ])
  requireLocalUrl(runner.apiBaseUrl, 'runner apiBaseUrl')
  if (!session.cookieHeader.trim())
    throw new Error('The local E2E session config must contain a session cookie header.')

  const runs = [
    await runTemplate(session, runner, 'movie'),
    await runTemplate(session, runner, 'manga'),
  ]
  const cancellation = await runControlledCancellation(session, runner)
  const evidence: E2eEvidence = { cancellation, gatewayOrigin: LOCAL_GATEWAY_ORIGIN, runs, target: 'local' }
  if (e2e.evidencePath)
    await writeFile(e2e.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  return evidence
}

if (process.argv.includes('--help')) {
  console.log('Usage: pnpm local:task-runner:e2e --target local')
}
else {
  void runLocalTaskRunnerE2e().then((evidence) => {
    console.log(JSON.stringify(evidence))
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
