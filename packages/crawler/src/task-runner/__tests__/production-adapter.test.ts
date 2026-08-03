import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  productionCrawlerEnvironmentKeys,
  runTargetCrawlerMutation,
} from '../../../scripts/target-crawl-mutation'
import { ActionsEventClient } from '../actions-event-client'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(overrides: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-production-adapter-'))
  roots.push(root)
  const contextPath = path.join(root, 'prepared-context.run-1.json')
  await mkdir(path.dirname(contextPath), { recursive: true })
  await writeFile(contextPath, JSON.stringify({
    accountId: 'account-id',
    apiConfigPath: path.join(root, 'api.toml'),
    gatewayConfigPath: path.join(root, 'gateway.toml'),
    identity: { accountId: 'account-id', apiUrl: 'http://localhost:8080', r2Name: 'starye-media' },
    preparedContextPath: contextPath,
    runId: 'run-1',
    targetId: 'starye-org',
  }), 'utf8')
  const environment: NodeJS.ProcessEnv = {
    ACTIONS_APPLICATION_ATTEMPT: '2',
    ACTIONS_APPLICATION_RUN_ID: 'run-1',
    ACTIONS_CALLBACK_API_BASE_URL: 'http://localhost:8080',
    ACTIONS_PROVIDER_ENVIRONMENT: 'starye-org',
    ACTIONS_PROVIDER_REF: 'main',
    ACTIONS_PROVIDER_REPOSITORY: 'inspire-man/starye',
    ACTIONS_PROVIDER_TARGET: 'starye-org',
    ACTIONS_PROVIDER_TEMPLATE: 'movie',
    ACTIONS_PROVIDER_WORKFLOW: '.github/workflows/daily-movie-crawl.yml',
    CRAWLER_SECRET: 'crawler-secret-fixture',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_RUN_ID: '77',
    GITHUB_SHA: 'a'.repeat(40),
    R2_ACCESS_KEY_ID: 'r2-access-fixture',
    R2_PUBLIC_URL: 'https://cdn.example.test',
    R2_SECRET_ACCESS_KEY: 'r2-secret-fixture',
    STARYE_API_CONFIG_PATH: path.join(root, 'api.toml'),
    STARYE_GATEWAY_CONFIG_PATH: path.join(root, 'gateway.toml'),
    STARYE_PREPARED_CONTEXT_PATH: contextPath,
    STARYE_PREPARED_ENTRY: 'crawler-optimized',
    STARYE_PREPARED_OPERATION: 'movie-production',
    STARYE_PREPARED_SECRET_KEYS: productionCrawlerEnvironmentKeys.join(','),
    TASK_RUNNER_CALLBACK_KEY_ID_CURRENT: 'callback-key',
    TASK_RUNNER_CALLBACK_SECRET_CURRENT: 'callback-secret-fixture',
    ...overrides,
  }
  return { contextPath, environment }
}

function actionsFixture(options: { cancelOnStart?: boolean, cancelOnHeartbeat?: boolean, cancelOnSuccess?: boolean, acceptSuccess?: boolean } = {}) {
  const events: Array<{ type: string, args: unknown[] }> = []
  const client = {
    providerStarted: vi.fn(async (...args: unknown[]) => {
      events.push({ type: 'provider_started', args })
      return { accepted: true, cancel_requested: options.cancelOnStart === true }
    }),
    heartbeat: vi.fn(async (...args: unknown[]) => {
      events.push({ type: 'heartbeat', args })
      return { accepted: true, cancel_requested: options.cancelOnHeartbeat === true }
    }),
    log: vi.fn(async (...args: unknown[]) => {
      events.push({ type: 'log', args })
      return { accepted: true }
    }),
    progress: vi.fn(async (...args: unknown[]) => {
      events.push({ type: 'progress', args })
      return { accepted: true }
    }),
    succeeded: vi.fn(async (...args: unknown[]) => {
      events.push({ type: 'succeeded', args })
      return { accepted: options.acceptSuccess !== false, cancel_requested: options.cancelOnSuccess === true }
    }),
    failed: vi.fn(async (...args: unknown[]) => {
      events.push({ type: 'failed', args })
      return { accepted: true }
    }),
    cancelled: vi.fn(async (...args: unknown[]) => {
      events.push({ type: 'cancelled', args })
      return { accepted: true }
    }),
  }
  return { client, events }
}

describe('registry-owned production crawler adapters', () => {
  it('runs movie production with the same run/attempt/provider binding and a non-empty receipt', async () => {
    const { environment } = await fixture()
    const { client, events } = actionsFixture({ acceptSuccess: true })
    const result = await runTargetCrawlerMutation(environment, {
      createActionsEventClient: () => client,
      executeMovie: async (context) => {
        context.observe('MOV-001')
        return { contentIds: ['MOV-001'] }
      },
    })

    expect(result).toMatchObject({ attempt: 2, contentIds: ['MOV-001'], operation: 'movie-production', providerRunId: '77', runId: 'run-1', status: 'succeeded', template: 'movie' })
    expect(events.map(event => event.type)).toEqual(['provider_started', 'log', 'heartbeat', 'progress', 'heartbeat', 'succeeded'])
    expect(client.providerStarted).toHaveBeenCalledWith(expect.objectContaining({ attempt: 2, providerRunAttempt: 1, providerRunId: '77', runId: 'run-1', sha: 'a'.repeat(40) }))
    expect(client.succeeded).toHaveBeenCalledWith(6, ['MOV-001'], { createdCount: 1 })
  })

  it('runs manga production through the fixed entry and stops before crawler work when cancellation is requested', async () => {
    const { environment } = await fixture({
      ACTIONS_PROVIDER_TEMPLATE: 'manga',
      ACTIONS_PROVIDER_WORKFLOW: '.github/workflows/daily-manga-crawl.yml',
      STARYE_PREPARED_ENTRY: 'crawler-comic',
      STARYE_PREPARED_OPERATION: 'manga-production',
    })
    const { client, events } = actionsFixture({ cancelOnStart: true })
    const executeManga = vi.fn()

    await expect(runTargetCrawlerMutation(environment, { createActionsEventClient: () => client, executeManga })).resolves.toMatchObject({ operation: 'manga-production', status: 'cancelled', template: 'manga' })
    expect(executeManga).not.toHaveBeenCalled()
    expect(events.map(event => event.type)).toEqual(['provider_started', 'cancelled'])
    expect(client.cancelled).toHaveBeenCalledWith(2)
  })

  it('retains partial-ingest audit counts while redacting crawler errors from signed event details', async () => {
    const { environment } = await fixture()
    const { client, events } = actionsFixture()
    const leakedError = 'crawler-secret-fixture-from-source-body'

    await expect(runTargetCrawlerMutation(environment, {
      createActionsEventClient: () => client,
      executeMovie: async (context) => {
        await context.checkpoint()
        context.observe('MOV-PARTIAL')
        throw new Error(leakedError)
      },
    })).rejects.toThrow('Production crawler operation failed.')

    const serializedEvents = JSON.stringify(events)
    expect(serializedEvents).not.toContain(leakedError)
    expect(serializedEvents).not.toContain('crawler-secret-fixture')
    expect(events.map(event => event.type)).toEqual(['provider_started', 'log', 'heartbeat', 'heartbeat', 'progress', 'failed'])
    expect(events.at(-1)?.args).toEqual([6, 'partial_ingest'])
  })

  it('rejects free-form operation, provider identity, template, and empty receipt inputs before success', async () => {
    const base = await fixture()
    const client = actionsFixture().client

    await expect(runTargetCrawlerMutation({ ...base.environment, STARYE_PREPARED_OPERATION: 'movie', STARYE_PREPARED_ENTRY: 'crawler-optimized' }, { createActionsEventClient: () => client })).rejects.toThrow('registry-owned smoke operation')
    await expect(runTargetCrawlerMutation({ ...base.environment, GITHUB_RUN_ID: 'provider-opaque' }, { createActionsEventClient: () => client })).rejects.toThrow('invalid provider identity')
    await expect(runTargetCrawlerMutation({ ...base.environment, ACTIONS_PROVIDER_TEMPLATE: 'manga' }, { createActionsEventClient: () => client })).rejects.toThrow('invalid production binding')
    await expect(runTargetCrawlerMutation(base.environment, {
      createActionsEventClient: () => client,
      executeMovie: async () => ({ contentIds: [] }),
    })).rejects.toThrow('Production crawler operation failed.')
    expect(client.failed).toHaveBeenCalledWith(6, 'receipt_missing')
  })

  it('records a successful receipt when cancellation is observed after the provider already accepted it', async () => {
    const { environment } = await fixture()
    const { client, events } = actionsFixture({ cancelOnSuccess: true })
    const result = await runTargetCrawlerMutation(environment, {
      createActionsEventClient: () => client,
      executeMovie: async (context) => {
        context.observe('MOV-LATE-CANCEL')
        return { contentIds: ['MOV-LATE-CANCEL'] }
      },
    })

    expect(result).toMatchObject({ status: 'succeeded', contentIds: ['MOV-LATE-CANCEL'] })
    expect(events.at(-1)?.type).toBe('succeeded')
    expect(events.some(event => event.type === 'cancelled')).toBe(false)
  })

  it('rejects invalid attempt and content identifier shapes before reporting success', async () => {
    const base = await fixture()
    const client = actionsFixture().client

    await expect(runTargetCrawlerMutation({ ...base.environment, ACTIONS_APPLICATION_ATTEMPT: '0' }, { createActionsEventClient: () => client })).rejects.toThrow('invalid prepared environment value')
    await expect(runTargetCrawlerMutation(base.environment, {
      createActionsEventClient: () => client,
      executeMovie: async () => ({ contentIds: [42 as unknown as string] }),
    })).rejects.toThrow('Production crawler operation failed.')
    expect(client.succeeded).not.toHaveBeenCalled()
  })

  it('binds a retried attempt to its new provider run tuple', async () => {
    const { environment } = await fixture({ ACTIONS_APPLICATION_ATTEMPT: '3', GITHUB_RUN_ID: '88' })
    const { client } = actionsFixture()
    const result = await runTargetCrawlerMutation(environment, {
      createActionsEventClient: () => client,
      executeMovie: async () => ({ contentIds: ['MOV-RETRY-3'] }),
    })

    expect(result).toMatchObject({ attempt: 3, providerRunId: '88', status: 'succeeded' })
    expect(client.providerStarted).toHaveBeenCalledWith(expect.objectContaining({ attempt: 3, providerRunId: '88' }))
  })

  it('keeps source body, credentials, and Authorization-shaped values out of signed callback payloads', async () => {
    const { environment } = await fixture()
    const requests: RequestInit[] = []
    const callback = new ActionsEventClient({
      apiBaseUrl: environment.ACTIONS_CALLBACK_API_BASE_URL!,
      attempt: 2,
      callbackKeyId: environment.TASK_RUNNER_CALLBACK_KEY_ID_CURRENT!,
      callbackSecret: environment.TASK_RUNNER_CALLBACK_SECRET_CURRENT!,
      environment: 'starye-org',
      fetch: vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        if (init)
          requests.push(init)
        return new Response(JSON.stringify({ accepted: true }), { status: 200 })
      }),
      providerRunAttempt: 1,
      providerRunId: environment.GITHUB_RUN_ID!,
      ref: 'main',
      repository: 'inspire-man/starye',
      runId: environment.ACTIONS_APPLICATION_RUN_ID!,
      sha: environment.GITHUB_SHA!,
      target: 'starye-org',
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })

    await runTargetCrawlerMutation(environment, {
      createActionsEventClient: () => callback,
      executeMovie: async () => ({ contentIds: ['MOV-REDACTED'] }),
    })

    const serialized = JSON.stringify(requests)
    expect(serialized).not.toContain(environment.CRAWLER_SECRET!)
    expect(serialized).not.toContain(environment.TASK_RUNNER_CALLBACK_SECRET_CURRENT!)
    expect(serialized).not.toContain('Authorization')
    expect(serialized).not.toContain('source body')
    expect((requests[0]?.headers as Record<string, string>)['x-runner-signature']).not.toContain(environment.TASK_RUNNER_CALLBACK_SECRET_CURRENT!)
  })
})
