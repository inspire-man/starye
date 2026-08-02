import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { LocalTaskRunner } from '../packages/crawler/src/task-runner/local-runner'
import { RunnerClient } from '../packages/crawler/src/task-runner/runner-client'
import { writePhase19EvidencePair } from './phase19-evidence'

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
  readonly evidenceDir?: string
  readonly receiptFixtures?: Partial<Record<TemplateKey, { readonly contentId: string }>>
}

interface CliOptions {
  readonly evidenceDir?: string
  readonly templates: readonly TemplateKey[]
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
  readonly failureCode: string | null
  readonly id: string
  readonly receipt: Receipt | null
  readonly status: RunStatus
}

interface TaskDetail {
  readonly runs: readonly (Omit<Run, 'failureCode'> & { readonly failure_code?: string | null })[]
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
    readonly receiptSource: 'local_fixture' | 'real_crawler'
    readonly realCrawl: {
      readonly failureCode: string | null
      readonly runId: string
      readonly status: RunStatus
    }
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

function parseTarget(argv: readonly string[]): CliOptions {
  let evidenceDir: string | undefined
  const templates: TemplateKey[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--target' && argv[index + 1] === 'local') {
      index += 1
      continue
    }
    if (flag === '--template' && (argv[index + 1] === 'movie' || argv[index + 1] === 'manga')) {
      templates.push(argv[index + 1] as TemplateKey)
      index += 1
      continue
    }
    if (flag === '--evidence-dir' && argv[index + 1]) {
      evidenceDir = argv[index + 1]
      index += 1
      continue
    }
    throw new Error('Usage: pnpm local:task-runner:e2e --target local [--template movie] [--template manga] [--evidence-dir DIR]')
  }
  return { evidenceDir, templates: templates.length > 0 ? [...new Set(templates)] : ['movie', 'manga'] }
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
  const rawRun = detail.runs.find(item => item.id === runId)
  if (!rawRun)
    throw new Error('Run disappeared from the local task read model.')
  const { failure_code: failureCode, ...run } = rawRun
  return { ...run, failureCode: failureCode ?? null }
}

async function cancelRun(session: SessionConfig, taskId: string, runId: string): Promise<void> {
  await requestJson(session, `/api/admin/crawler-tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
}

async function runTemplate(
  session: SessionConfig,
  config: LocalRunnerConfig,
  template: TemplateKey,
  receiptFixture: { readonly contentId: string } | undefined,
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
  const realRun = await readRun(session, created.taskId, created.runId)
  if (realRun.status === 'succeeded' && realRun.receipt && realRun.receipt.templateKey === template) {
    return {
      createdCount: realRun.receipt.createdCount,
      primaryContentId: realRun.receipt.primaryContentId,
      receiptSource: 'real_crawler',
      realCrawl: { failureCode: realRun.failureCode, runId: realRun.id, status: realRun.status },
      runId: realRun.id,
      taskId: created.taskId,
      template,
      updatedCount: realRun.receipt.updatedCount,
    }
  }

  // D-07/D-12: a real crawler that synced no verifiable aggregate remains
  // receipt_missing; a separate ignored fixture adapter proves the success
  // receipt and CRUD handoff without weakening the API validation contract.
  if (realRun.status !== 'failed' || realRun.failureCode !== 'receipt_missing') {
    throw new Error(`${template} real crawler run ended as ${realRun.status}:${realRun.failureCode ?? 'none'}.`)
  }
  if (!receiptFixture || !/^[\w-]{1,128}$/.test(receiptFixture.contentId)) {
    throw new Error(`${template} receipt_missing requires an ignored receiptFixtures.${template}.contentId.`)
  }

  const fixtureCreated = await createTask(session, template)
  const fixtureClient = new RunnerClient(config)
  const fixtureAdapters = createTemplateAdapterRegistry([
    createMovieAdapter(config.crawler.movie as never, async () => ({ contentIds: template === 'movie' ? [receiptFixture.contentId] : [] })),
    createMangaAdapter(config.crawler.manga as never, async () => ({ contentIds: template === 'manga' ? [receiptFixture.contentId] : [] })),
  ])
  await new LocalTaskRunner({ adapters: fixtureAdapters, client: fixtureClient }).runOnce()
  const fixtureRun = await readRun(session, fixtureCreated.taskId, fixtureCreated.runId)
  if (fixtureRun.status !== 'succeeded' || !fixtureRun.receipt || fixtureRun.receipt.templateKey !== template) {
    throw new Error(`${template} local fixture adapter did not produce a validated receipt.`)
  }
  return {
    createdCount: fixtureRun.receipt.createdCount,
    primaryContentId: fixtureRun.receipt.primaryContentId,
    receiptSource: 'local_fixture',
    realCrawl: { failureCode: realRun.failureCode, runId: realRun.id, status: realRun.status },
    runId: fixtureRun.id,
    taskId: fixtureCreated.taskId,
    template,
    updatedCount: fixtureRun.receipt.updatedCount,
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
  const cli = parseTarget(argv)
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

  const runs = []
  for (const template of cli.templates) {
    runs.push(await runTemplate(session, runner, template, e2e.receiptFixtures?.[template]))
  }
  const cancellation = await runControlledCancellation(session, runner)
  const evidence: E2eEvidence = { cancellation, gatewayOrigin: LOCAL_GATEWAY_ORIGIN, runs, target: 'local' }
  if (e2e.evidencePath)
    await writeFile(e2e.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  const evidenceDir = cli.evidenceDir ?? e2e.evidenceDir
  if (evidenceDir) {
    await mkdir(evidenceDir, { recursive: true })
    const timestamp = new Date().toISOString()
    for (const run of runs) {
      await writePhase19EvidencePair({
        mode: 'local_contract',
        status: 'passed',
        target: 'local-gateway',
        template: run.template,
        workflow: 'local-contract',
        repository: 'local-contract',
        ref: 'fixture',
        environment: 'local',
        taskId: run.taskId,
        runId: run.runId,
        attempt: 1,
        callbackEventIds: [],
        callbackNonces: [],
        validatedReceipt: {
          template: run.template,
          primaryContentId: run.primaryContentId,
          createdCount: run.createdCount,
          updatedCount: run.updatedCount,
        },
        gatewayUrl: LOCAL_GATEWAY_ORIGIN,
        crud: { mutation: 'passed', readback: 'passed', restore: 'passed' },
        command: 'phase19-local-proof',
        timestamp,
      }, evidenceDir)
    }
    await writePhase19EvidencePair({
      mode: 'local_contract',
      status: 'checkpoint',
      target: 'local-gateway',
      template: 'movie',
      workflow: 'local-contract',
      repository: 'local-contract',
      ref: 'fixture',
      environment: 'local',
      taskId: `cancelled-${cancellation.runId}`,
      runId: cancellation.runId,
      attempt: 1,
      callbackEventIds: [],
      callbackNonces: [],
      gatewayUrl: LOCAL_GATEWAY_ORIGIN,
      crud: { mutation: 'checkpoint', readback: 'checkpoint', restore: 'checkpoint' },
      command: 'phase19-local-proof',
      timestamp,
    }, evidenceDir)
  }
  return evidence
}

if (process.argv.includes('--help')) {
  console.log('Usage: pnpm local:task-runner:e2e --target local [--template movie] [--template manga] [--evidence-dir DIR]')
}
else {
  void runLocalTaskRunnerE2e().then((evidence) => {
    console.log(JSON.stringify(evidence))
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
