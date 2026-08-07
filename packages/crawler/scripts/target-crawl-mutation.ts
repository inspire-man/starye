/// <reference types="node" />

import type { JavBusCrawlerConfig } from '../src/crawlers/javbus'
import type { CrawlerConfig } from '../src/lib/base-crawler'
import type { RepairPlayersReceipt, RepairRunnerSnapshot, RepairSourceObservationInput, RepairSourceObservationResponse, RunnerCandidate } from '../src/task-runner/runner-client'
import type { AdapterExecutionContext, AdapterExecutionResult } from '../src/task-runner/template-adapters'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createDataChainFixture, runDataChainFixture } from '../src/smoke/data-chain-fixture'
import { createActionsEventClientFromEnvironment } from '../src/task-runner/actions-event-client'
import { createMangaAdapter } from '../src/task-runner/manga-adapter'
import { createMovieAdapter } from '../src/task-runner/movie-adapter'
import { createRepairPlayersAdapter } from '../src/task-runner/repair-adapter'
import { createRunnerClientFromEnvironment } from '../src/task-runner/runner-client'
import { createTemplateAdapterRegistry } from '../src/task-runner/template-adapters'
import { GITHUB_ACTIONS_CONFIG } from '../src/types/config'
import { ApiClient } from '../src/utils/api-client'

interface PreparedCrawlerContext {
  readonly targetId: string
  readonly runId: string
  readonly preparedContextPath: string
  readonly smokeItemCode?: string
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
  readonly identity: Readonly<{
    apiUrl: string
    accountId: string
    r2Name?: string
  }>
}

interface CrawlerApiClient {
  syncMovie: (movieData: unknown) => Promise<unknown>
}

type ProductionTemplate = 'manga' | 'movie'

interface ProductionCrawlerResult {
  readonly attempt: number
  readonly contentIds: readonly string[]
  readonly itemCount: number
  readonly operation: 'manga-production' | 'movie-production'
  readonly providerRunId: string
  readonly runId: string
  readonly status: 'cancelled' | 'succeeded'
  readonly template: ProductionTemplate
}

interface ProductionActionsClient {
  providerStarted: (input: {
    readonly attempt: number
    readonly providerRunAttempt: number
    readonly providerRunId: string
    readonly runId: string
    readonly sha: string
  }) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  heartbeat: (sequence: number) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  log: (sequence: number, message: string) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  progress: (sequence: number, counts: Readonly<Record<string, number>>) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  succeeded: (sequence: number, contentIds: readonly string[], counts: { readonly createdCount?: number, readonly updatedCount?: number }) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  failed: (sequence: number, code: string) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  cancelled: (sequence: number) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
}

interface ProductionRunnerClient {
  cancelled: (candidate: RunnerCandidate, sequence: number) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  claim: (candidate: RunnerCandidate) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  failed: (candidate: RunnerCandidate, sequence: number, code: string) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  heartbeat: (candidate: RunnerCandidate, sequence: number) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  log: (candidate: RunnerCandidate, sequence: number, message: string) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  observeRepairSource: (candidate: RunnerCandidate, sequence: number, input: RepairSourceObservationInput) => Promise<RepairSourceObservationResponse>
  poll: () => Promise<RunnerCandidate | undefined>
  progress: (candidate: RunnerCandidate, sequence: number, counts: Readonly<Record<string, number>>) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  succeeded: (candidate: RunnerCandidate, sequence: number, contentIds: readonly string[]) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  succeededRepair: (candidate: RunnerCandidate, sequence: number, receipt: RepairPlayersReceipt) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
}

export const productionCrawlerEnvironmentKeys = [
  'ACTIONS_APPLICATION_ATTEMPT',
  'ACTIONS_APPLICATION_RUN_ID',
  'ACTIONS_CALLBACK_API_BASE_URL',
  'ACTIONS_PROVIDER_ENVIRONMENT',
  'ACTIONS_PROVIDER_REF',
  'ACTIONS_PROVIDER_REPOSITORY',
  'ACTIONS_PROVIDER_TARGET',
  'ACTIONS_PROVIDER_TEMPLATE',
  'ACTIONS_PROVIDER_WORKFLOW',
  'CRAWLER_SECRET',
  'GITHUB_RUN_ATTEMPT',
  'GITHUB_RUN_ID',
  'GITHUB_SHA',
  'R2_ACCESS_KEY_ID',
  'R2_PUBLIC_URL',
  'R2_SECRET_ACCESS_KEY',
  'TASK_RUNNER_CALLBACK_KEY_ID_CURRENT',
  'TASK_RUNNER_CALLBACK_SECRET_CURRENT',
] as const

const productionOperations = {
  'crawler-comic': {
    operation: 'manga-production',
    template: 'manga',
    workflow: '.github/workflows/daily-manga-crawl.yml',
  },
  'crawler-optimized': {
    operation: 'movie-production',
    template: 'movie',
    workflow: '.github/workflows/daily-movie-crawl.yml',
  },
} as const

const PRODUCTION_HEARTBEAT_INTERVAL_MS = 60_000

interface ProductionBinding {
  readonly attempt: number
  readonly providerRunAttempt: number
  readonly providerRunId: string
  readonly runId: string
  readonly sha: string
}

export interface TargetCrawlerMutationDependencies {
  readonly createApiClient?: (config: { url: string, token: string, timeout: number }) => CrawlerApiClient
  readonly createActionsEventClient?: (environment: NodeJS.ProcessEnv) => ProductionActionsClient
  readonly createRunnerClient?: (environment: NodeJS.ProcessEnv) => ProductionRunnerClient
  readonly discoverRepairSources?: (context: AdapterExecutionContext & { readonly snapshot: RepairRunnerSnapshot }) => Promise<RepairSourceObservationInput>
  readonly executeManga?: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>
  readonly executeMovie?: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>
}

function redactedDiagnostic(environment: NodeJS.ProcessEnv): {
  declaredSecretKeys: string[]
  declaredKeysPresent: boolean[]
} {
  const declaredKeys = (environment.STARYE_PREPARED_SECRET_KEYS ?? '').split(',').filter(Boolean)
  return {
    declaredSecretKeys: declaredKeys,
    declaredKeysPresent: declaredKeys.map(key => Boolean(environment[key])),
  }
}

function productionErrorDiagnostic(error: unknown, environment: NodeJS.ProcessEnv): string {
  const raw = error instanceof Error
    ? `${error.name}: ${error.message}`
    : `UnknownError: ${String(error)}`
  const secretValues = productionCrawlerEnvironmentKeys
    .map(key => environment[key])
    .filter((value): value is string => Boolean(value && value.length > 0))
  const redacted = secretValues.reduce((message, value) => message.split(value).join('[redacted]'), raw)
  return redacted.replace(/\s+/gu, ' ').slice(0, 400)
}

function isPreparedCrawlerContext(value: unknown, contextPath: string): value is PreparedCrawlerContext {
  if (!value || typeof value !== 'object') {
    return false
  }

  const context = value as Partial<PreparedCrawlerContext>
  return typeof context.targetId === 'string'
    && typeof context.runId === 'string'
    && typeof context.preparedContextPath === 'string'
    && path.resolve(context.preparedContextPath) === path.resolve(contextPath)
    && path.basename(contextPath) === `prepared-context.${context.runId}.json`
    && typeof context.apiConfigPath === 'string'
    && path.isAbsolute(context.apiConfigPath)
    && typeof context.gatewayConfigPath === 'string'
    && path.isAbsolute(context.gatewayConfigPath)
    && !!context.identity
    && typeof context.identity.apiUrl === 'string'
    && typeof context.identity.accountId === 'string'
}

function requireEnvironment(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim()
  if (!value)
    throw new Error(`target-crawl-mutation rejected a missing prepared environment value: ${key}.`)
  return value
}

function requirePositiveInteger(environment: NodeJS.ProcessEnv, key: string): number {
  const value = Number(requireEnvironment(environment, key))
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`target-crawl-mutation rejected an invalid prepared environment value: ${key}.`)
  return value
}

function productionOperation(entry: string | undefined, operation: string | undefined) {
  if (entry !== 'crawler-comic' && entry !== 'crawler-optimized')
    return undefined
  const production = productionOperations[entry]
  return operation === production.operation ? production : undefined
}

function createCrawlerConfig(context: PreparedCrawlerContext, environment: NodeJS.ProcessEnv): CrawlerConfig {
  return {
    api: {
      token: requireEnvironment(environment, 'CRAWLER_SECRET'),
      url: context.identity.apiUrl,
    },
    r2: {
      accessKeyId: requireEnvironment(environment, 'R2_ACCESS_KEY_ID'),
      accountId: context.identity.accountId,
      bucketName: context.identity.r2Name ?? context.targetId,
      publicUrl: requireEnvironment(environment, 'R2_PUBLIC_URL'),
      secretAccessKey: requireEnvironment(environment, 'R2_SECRET_ACCESS_KEY'),
    },
  }
}

function assertProductionBinding(
  context: PreparedCrawlerContext,
  environment: NodeJS.ProcessEnv,
  production: { readonly template: ProductionTemplate, readonly workflow: string },
): ProductionBinding {
  const declared = environment.STARYE_PREPARED_SECRET_KEYS?.split(',').filter(Boolean) ?? []
  if (declared.length !== productionCrawlerEnvironmentKeys.length || declared.some((key, index) => key !== productionCrawlerEnvironmentKeys[index]))
    throw new Error('target-crawl-mutation rejected the declared production credential boundary.')
  const binding = {
    attempt: requirePositiveInteger(environment, 'ACTIONS_APPLICATION_ATTEMPT'),
    providerRunAttempt: requirePositiveInteger(environment, 'GITHUB_RUN_ATTEMPT'),
    providerRunId: requireEnvironment(environment, 'GITHUB_RUN_ID'),
    runId: requireEnvironment(environment, 'ACTIONS_APPLICATION_RUN_ID'),
    sha: requireEnvironment(environment, 'GITHUB_SHA'),
  }
  if (binding.runId !== context.runId
    || environment.ACTIONS_PROVIDER_ENVIRONMENT !== 'starye-org'
    || environment.ACTIONS_PROVIDER_REF !== 'main'
    || environment.ACTIONS_PROVIDER_REPOSITORY !== 'inspire-man/starye'
    || environment.ACTIONS_PROVIDER_TARGET !== context.targetId
    || environment.ACTIONS_PROVIDER_TEMPLATE !== production.template
    || environment.ACTIONS_PROVIDER_WORKFLOW !== production.workflow) {
    throw new Error('target-crawl-mutation rejected an invalid production binding.')
  }
  if (!/^\d{1,20}$/u.test(binding.providerRunId) || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(binding.sha))
    throw new Error('target-crawl-mutation rejected an invalid provider identity.')
  return binding
}

async function runClaimedProductionCrawlerMutation(
  context: PreparedCrawlerContext,
  environment: NodeJS.ProcessEnv,
  production: { readonly operation: 'manga-production' | 'movie-production', readonly template: ProductionTemplate, readonly workflow: string },
  dependencies: TargetCrawlerMutationDependencies,
  binding: ProductionBinding,
  actions: ProductionActionsClient,
  runner: ProductionRunnerClient,
): Promise<ProductionCrawlerResult> {
  const candidate = await runner.poll()
  if (!candidate
    || candidate.runId !== binding.runId
    || candidate.attempt !== binding.attempt
    || candidate.snapshot.templateKey !== production.template) {
    throw new Error('target-crawl-mutation rejected a candidate outside the prepared production binding.')
  }

  const claim = await runner.claim(candidate)
  if (!claim.accepted)
    throw new Error('target-crawl-mutation rejected an unclaimed production run.')

  const started = await actions.providerStarted(binding)
  if (!started.accepted)
    throw new Error('target-crawl-mutation rejected an unbound production provider.')

  let sequence = candidate.sequence + 1
  const contentIds = new Set<string>()
  const observeContentId = (value: string) => {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 128)
      throw new Error('target-crawl-mutation rejected an invalid content identifier.')
    contentIds.add(value.trim())
  }
  let cancelled = started.cancel_requested === true
  let terminalEmitted = false
  let heartbeatPromise: Promise<boolean> | undefined
  let heartbeatFailure: unknown
  const checkpoint = () => {
    if (cancelled)
      return Promise.resolve(true)
    if (!heartbeatPromise) {
      heartbeatPromise = runner.heartbeat(candidate, sequence++)
        .then((heartbeat) => {
          if (!heartbeat.accepted)
            throw new Error('Production runner lease was rejected.')
          cancelled = heartbeat.cancel_requested === true
          return cancelled
        })
        .finally(() => {
          heartbeatPromise = undefined
        })
    }
    return heartbeatPromise
  }
  const cancelledResult = (ids: readonly string[] = []): ProductionCrawlerResult => ({
    attempt: binding.attempt,
    contentIds: ids,
    itemCount: ids.length,
    operation: production.operation,
    providerRunId: binding.providerRunId,
    runId: binding.runId,
    status: 'cancelled',
    template: production.template,
  })

  if (cancelled) {
    await runner.cancelled(candidate, sequence++)
    return cancelledResult()
  }

  const config = createCrawlerConfig(context, environment)
  const repairAdapter = createRepairPlayersAdapter(dependencies.discoverRepairSources
    ? { discoverSources: dependencies.discoverRepairSources }
    : {})
  const adapters = createTemplateAdapterRegistry([
    createMovieAdapter({ ...GITHUB_ACTIONS_CONFIG, ...config } as JavBusCrawlerConfig, dependencies.executeMovie),
    createMangaAdapter(config, dependencies.executeManga),
    repairAdapter,
  ])

  try {
    // Claim precedes registry selection; the server-owned snapshot is the only operation authority.
    if (await checkpoint()) {
      await runner.cancelled(candidate, sequence++)
      terminalEmitted = true
      return cancelledResult()
    }
    await runner.log(candidate, sequence++, 'production crawler started')
    const heartbeatTimer = setInterval(() => {
      void checkpoint().catch((error: unknown) => {
        heartbeatFailure ??= error
      })
    }, PRODUCTION_HEARTBEAT_INTERVAL_MS)
    let result: AdapterExecutionResult
    try {
      const adapter = adapters.select(candidate.snapshot)
      result = await adapter.execute({
        candidate,
        checkpoint,
        client: runner,
        nextSequence: () => sequence++,
        observe: observeContentId,
      })
    }
    finally {
      clearInterval(heartbeatTimer)
      if (heartbeatPromise) {
        try {
          await heartbeatPromise
        }
        catch (error: unknown) {
          heartbeatFailure ??= error
        }
      }
    }
    if (heartbeatFailure)
      throw heartbeatFailure

    if (candidate.snapshot.operation !== 'repair_players') {
      for (const contentId of result.contentIds) observeContentId(contentId)
    }
    const progress = await runner.progress(candidate, sequence++, { observed: contentIds.size })
    if (!progress.accepted)
      throw new Error('target-crawl-mutation rejected an unvalidated production progress fact.')
    cancelled = progress.cancel_requested === true
    if (await checkpoint()) {
      await runner.cancelled(candidate, sequence++)
      terminalEmitted = true
      return cancelledResult([...contentIds])
    }

    if (candidate.snapshot.operation === 'repair_players') {
      if (!result.repairReceipt) {
        await runner.failed(candidate, sequence++, result.failureCode ?? 'receipt_missing')
        terminalEmitted = true
        throw new Error('target-crawl-mutation rejected an unvalidated repair receipt.')
      }
      const terminal = await runner.succeededRepair(candidate, sequence++, result.repairReceipt)
      if (!terminal.accepted)
        throw new Error('target-crawl-mutation rejected an unvalidated repair receipt.')
      terminalEmitted = true
      return {
        attempt: binding.attempt,
        contentIds: [],
        itemCount: 0,
        operation: production.operation,
        providerRunId: binding.providerRunId,
        runId: binding.runId,
        status: 'succeeded',
        template: production.template,
      }
    }

    if (contentIds.size === 0) {
      await runner.failed(candidate, sequence++, 'receipt_missing')
      terminalEmitted = true
      throw new Error('target-crawl-mutation rejected an empty production receipt.')
    }
    const terminal = await runner.succeeded(candidate, sequence++, [...contentIds])
    if (!terminal.accepted)
      throw new Error('target-crawl-mutation rejected an unvalidated production receipt.')
    terminalEmitted = true
    return {
      attempt: binding.attempt,
      contentIds: [...contentIds],
      itemCount: contentIds.size,
      operation: production.operation,
      providerRunId: binding.providerRunId,
      runId: binding.runId,
      status: 'succeeded',
      template: production.template,
    }
  }
  catch (error) {
    console.error(`Production crawler diagnostic: ${productionErrorDiagnostic(error, environment)}`)
    if (!terminalEmitted) {
      try {
        await runner.progress(candidate, sequence++, { observed: contentIds.size })
        await runner.failed(candidate, sequence++, contentIds.size > 0 ? 'partial_ingest' : 'runner_failed')
        terminalEmitted = true
      }
      catch {
        // The Actions API owns the durable audit trail. Never expose crawler errors while reporting it.
      }
    }
    throw new Error('Production crawler operation failed.')
  }
}

async function runProductionCrawlerMutation(
  context: PreparedCrawlerContext,
  environment: NodeJS.ProcessEnv,
  production: { readonly operation: 'manga-production' | 'movie-production', readonly template: ProductionTemplate, readonly workflow: string },
  dependencies: TargetCrawlerMutationDependencies,
): Promise<ProductionCrawlerResult> {
  const binding = assertProductionBinding(context, environment, production)
  const client = dependencies.createActionsEventClient?.(environment) ?? createActionsEventClientFromEnvironment(environment)
  const runner = dependencies.createRunnerClient?.(environment)
    ?? (!dependencies.createActionsEventClient ? createRunnerClientFromEnvironment(environment) : undefined)
  if (runner)
    return runClaimedProductionCrawlerMutation(context, environment, production, dependencies, binding, client, runner)

  const started = await client.providerStarted(binding)
  if (!started.accepted)
    throw new Error('target-crawl-mutation rejected an unbound production provider.')
  // The control-plane dispatch claim consumes sequence 1 before the provider starts.
  let sequence = 2
  const contentIds = new Set<string>()
  const observeContentId = (value: string) => {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 128)
      throw new Error('target-crawl-mutation rejected an invalid content identifier.')
    contentIds.add(value.trim())
  }
  let cancelled = started.cancel_requested === true
  let terminalEmitted = false
  let heartbeatPromise: Promise<boolean> | undefined
  let heartbeatFailure: unknown
  const checkpoint = () => {
    if (cancelled)
      return Promise.resolve(true)
    if (!heartbeatPromise) {
      heartbeatPromise = client.heartbeat(sequence++)
        .then((heartbeat) => {
          if (!heartbeat.accepted)
            throw new Error('Production runner lease was rejected.')
          cancelled = heartbeat.cancel_requested === true
          return cancelled
        })
        .finally(() => {
          heartbeatPromise = undefined
        })
    }
    return heartbeatPromise
  }

  if (cancelled) {
    await client.cancelled(sequence++)
    return {
      attempt: binding.attempt,
      contentIds: [],
      itemCount: 0,
      operation: production.operation,
      providerRunId: binding.providerRunId,
      runId: binding.runId,
      status: 'cancelled',
      template: production.template,
    }
  }

  const config = createCrawlerConfig(context, environment)
  const adapter = production.template === 'movie'
    ? createMovieAdapter({ ...GITHUB_ACTIONS_CONFIG, ...config } as JavBusCrawlerConfig, dependencies.executeMovie)
    : createMangaAdapter(config, dependencies.executeManga)
  try {
    // Dispatch claim leaves the run in dispatching; heartbeat first to enter running before log/progress events.
    if (await checkpoint()) {
      await client.cancelled(sequence++)
      return {
        attempt: binding.attempt,
        contentIds: [],
        itemCount: 0,
        operation: production.operation,
        providerRunId: binding.providerRunId,
        runId: binding.runId,
        status: 'cancelled',
        template: production.template,
      }
    }
    await client.log(sequence++, 'production crawler started')
    const heartbeatTimer = setInterval(() => {
      void checkpoint().catch((error: unknown) => {
        heartbeatFailure ??= error
      })
    }, PRODUCTION_HEARTBEAT_INTERVAL_MS)
    let result: AdapterExecutionResult
    try {
      result = await adapter.execute({
        candidate: {
          attempt: binding.attempt,
          runId: binding.runId,
          sequence: 0,
          snapshot: {
            entrypoint: production.template === 'movie' ? 'movie-crawler' : 'manga-crawler',
            permissionResource: production.template === 'movie' ? 'movie' : 'comic',
            templateKey: production.template,
            templateVersion: 1,
          },
        },
        checkpoint,
        observe: observeContentId,
      })
    }
    finally {
      clearInterval(heartbeatTimer)
      if (heartbeatPromise) {
        try {
          await heartbeatPromise
        }
        catch (error: unknown) {
          heartbeatFailure ??= error
        }
      }
    }
    if (heartbeatFailure)
      throw heartbeatFailure
    for (const contentId of result.contentIds) observeContentId(contentId)
    await client.progress(sequence++, { observed: contentIds.size })
    if (await checkpoint()) {
      await client.cancelled(sequence++)
      return {
        attempt: binding.attempt,
        contentIds: [...contentIds],
        itemCount: contentIds.size,
        operation: production.operation,
        providerRunId: binding.providerRunId,
        runId: binding.runId,
        status: 'cancelled',
        template: production.template,
      }
    }
    if (contentIds.size === 0) {
      await client.failed(sequence++, 'receipt_missing')
      terminalEmitted = true
      throw new Error('target-crawl-mutation rejected an empty production receipt.')
    }
    const terminal = await client.succeeded(sequence++, [...contentIds], { createdCount: contentIds.size })
    if (!terminal.accepted)
      throw new Error('target-crawl-mutation rejected an unvalidated production receipt.')
    return {
      attempt: binding.attempt,
      contentIds: [...contentIds],
      itemCount: contentIds.size,
      operation: production.operation,
      providerRunId: binding.providerRunId,
      runId: binding.runId,
      status: 'succeeded',
      template: production.template,
    }
  }
  catch (error) {
    console.error(`Production crawler diagnostic: ${productionErrorDiagnostic(error, environment)}`)
    if (!terminalEmitted) {
      try {
        await client.progress(sequence++, { observed: contentIds.size })
        await client.failed(sequence++, contentIds.size > 0 ? 'partial_ingest' : 'crawler_failed')
      }
      catch {
        // The Actions API owns the durable audit trail. Never expose crawler errors while reporting it.
      }
    }
    throw new Error('Production crawler operation failed.')
  }
}

export async function runTargetCrawlerMutation(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: TargetCrawlerMutationDependencies = {},
): Promise<Awaited<ReturnType<typeof runDataChainFixture>> | ProductionCrawlerResult | void> {
  const contextPath = environment.STARYE_PREPARED_CONTEXT_PATH
  const entry = environment.STARYE_PREPARED_ENTRY
  const operation = environment.STARYE_PREPARED_OPERATION
  if (!contextPath || !entry?.startsWith('crawler-') || !operation) {
    throw new Error('target-crawl-mutation requires a registry-owned prepared context.')
  }
  if (!path.isAbsolute(contextPath) || !path.basename(contextPath).startsWith('prepared-context.')) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context path.')
  }
  const context = JSON.parse(await readFile(contextPath, 'utf8')) as unknown
  if (!isPreparedCrawlerContext(context, contextPath)) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  const production = productionOperation(entry, operation)
  if (production) {
    if (environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
      throw new Error('target-crawl-mutation rejected an invalid prepared context.')
    }
    return runProductionCrawlerMutation(context, environment, production, dependencies)
  }
  if (entry === 'crawler-check-config' && operation === 'check-config') {
    console.log(JSON.stringify(redactedDiagnostic(environment)))
    return
  }
  if (entry !== 'crawler-smoke-fixture' || operation !== 'smoke-fixture') {
    throw new Error('target-crawl-mutation requires the registry-owned smoke operation.')
  }
  if (environment.STARYE_PREPARED_SECRET_KEYS !== 'CRAWLER_SECRET' || !environment.CRAWLER_SECRET) {
    throw new Error('target-crawl-mutation rejected the declared smoke credential boundary.')
  }
  if (environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  if (typeof context.smokeItemCode !== 'string' || !context.smokeItemCode.trim()) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  if (context.smokeItemCode !== createDataChainFixture({ targetId: context.targetId, runId: context.runId }).code) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }

  const createApiClient = dependencies.createApiClient ?? (config => new ApiClient(config))
  return runDataChainFixture({
    targetId: context.targetId,
    runId: context.runId,
    apiClient: createApiClient({
      url: context.identity.apiUrl,
      token: environment.CRAWLER_SECRET,
      timeout: 60000,
    }),
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runTargetCrawlerMutation().then((result) => {
    if (result) {
      console.log(JSON.stringify(result))
    }
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
