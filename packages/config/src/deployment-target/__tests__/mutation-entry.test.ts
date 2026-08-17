/// <reference types="node" />

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  prepareTargetMutation,
  productionCrawlerOptionalEnvironmentKeys,
  productionCrawlerRequiredEnvironmentKeys,
  runPreparedTargetMutation,
  targetRemoteEntryDefinitions,
} from '../mutation-entry'

const roots: string[] = []

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-mutation-entry-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function readOnlyExecutor(argv: readonly string[]) {
  return {
    exitCode: 0,
    stdout: argv[0] === 'kv' ? 'acf49df06ae0447b82a092cf238714d8' : argv.at(-1) ?? '',
  }
}

describe('target mutation preparation', () => {
  it('exposes only fixed movie and manga production child operations with the declared environment boundary', () => {
    expect(targetRemoteEntryDefinitions.filter(definition => definition.id === 'crawler-comic' || definition.id === 'crawler-optimized')).toEqual([
      expect.objectContaining({
        id: 'crawler-comic',
        childOperation: 'manga-production',
        allowedOptions: [],
        requiredSecretKeys: productionCrawlerRequiredEnvironmentKeys,
        optionalEnvironmentKeys: productionCrawlerOptionalEnvironmentKeys,
      }),
      expect.objectContaining({
        id: 'crawler-optimized',
        childOperation: 'movie-production',
        allowedOptions: [],
        requiredSecretKeys: productionCrawlerRequiredEnvironmentKeys,
        optionalEnvironmentKeys: productionCrawlerOptionalEnvironmentKeys,
      }),
    ])
    expect(productionCrawlerRequiredEnvironmentKeys).not.toContain('target_url')
    expect(productionCrawlerRequiredEnvironmentKeys).not.toContain('COMMAND')
  })

  it('serializes the contained Pages redirect input without secrets and preserves cleanup ownership', async () => {
    const root = await createRoot()
    const runDirectory = path.join(root, 'run')
    const redirectInputPath = path.join(runDirectory, 'pages-redirects.ci-pages.dashboard.txt')
    const cleanup = vi.fn(async () => rm(redirectInputPath, { force: true }))
    const materialize = vi.fn(async () => {
      await mkdir(runDirectory, { recursive: true })
      await writeFile(redirectInputPath, 'generated redirect input\n', 'utf8')
      return {
        apiConfigPath: path.join(root, 'api', '.target-wrangler.ci-pages.toml'),
        gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.ci-pages.toml'),
        pages: {
          surface: 'dashboard' as const,
          project: 'starye-dashboard',
          buildEnvPath: path.join(runDirectory, 'pages-build-env.ci-pages.dashboard.env'),
          redirectInputPath,
        },
        cleanup,
      }
    })
    const githubOutput = path.join(root, 'github-output')

    const prepared = await prepareTargetMutation({
      target: 'starye-org',
      scope: 'ci',
      command: 'pages-deploy',
      ciEnvironment: 'starye-org',
      pagesSurface: 'dashboard',
      environment: {
        CLOUDFLARE_API_TOKEN: 'fixture-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
      },
      githubOutput,
      runId: 'ci-pages',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory,
    }, {
      executeReadOnly: argv => argv[0] === 'pages'
        ? { exitCode: 0, stdout: 'starye-dashboard' }
        : readOnlyExecutor(argv),
      materialize,
    })

    expect(prepared.pages).toMatchObject({
      surface: 'dashboard',
      project: 'starye-dashboard',
      redirectInputPath,
    })
    const serialized = JSON.parse(await readFile(prepared.preparedContextPath, 'utf8')) as { pages?: { redirectInputPath?: string } }
    expect(serialized.pages?.redirectInputPath).toBe(redirectInputPath)
    const output = await readFile(githubOutput, 'utf8')
    expect(output).toContain(`pages_redirect_input_path=${redirectInputPath}`)
    expect(output).not.toMatch(/fixture-token|account_id|project_map/)

    await prepared.cleanup()
    expect(cleanup).toHaveBeenCalledTimes(1)
    await expect(readFile(redirectInputPath, 'utf8')).rejects.toThrow()
  })

  it('rejects an external fake Pages redirect path and cleans it up after output failure', async () => {
    const root = await createRoot()
    const runDirectory = path.join(root, 'run')
    const externalRedirectPath = path.join(root, 'external.redirects')
    const cleanup = vi.fn(async () => rm(externalRedirectPath, { force: true }))
    const materialize = vi.fn(async () => {
      await writeFile(externalRedirectPath, 'generated redirect input\n', 'utf8')
      return {
        apiConfigPath: path.join(root, 'api', '.target-wrangler.invalid-pages.toml'),
        gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.invalid-pages.toml'),
        pages: {
          surface: 'dashboard' as const,
          project: 'starye-dashboard',
          buildEnvPath: path.join(runDirectory, 'pages-build-env.invalid-pages.dashboard.env'),
          redirectInputPath: externalRedirectPath,
        },
        cleanup,
      }
    })

    await expect(prepareTargetMutation({
      target: 'starye-org',
      scope: 'ci',
      command: 'pages-deploy',
      ciEnvironment: 'starye-org',
      pagesSurface: 'dashboard',
      environment: {
        CLOUDFLARE_API_TOKEN: 'fixture-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
      },
      githubOutput: path.join(root, 'github-output'),
      runId: 'invalid-pages',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory,
    }, {
      executeReadOnly: argv => argv[0] === 'pages'
        ? { exitCode: 0, stdout: 'starye-dashboard' }
        : readOnlyExecutor(argv),
      materialize,
    })).rejects.toThrow('Pages redirect input path is outside')

    expect(cleanup).toHaveBeenCalledTimes(1)
    await expect(readFile(externalRedirectPath, 'utf8')).rejects.toThrow()
  })

  it('prepares CI from explicit profile identity without local projection files and emits only fixed output keys', async () => {
    const root = await createRoot()
    const materialize = vi.fn(async () => ({
      apiConfigPath: path.join(root, 'api', '.target-wrangler.ci-run.toml'),
      gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.ci-run.toml'),
      cleanup: async () => {},
    }))
    const githubOutput = path.join(root, 'github-output')

    const prepared = await prepareTargetMutation({
      target: 'starye-org',
      scope: 'ci',
      command: 'worker-deploy',
      ciEnvironment: 'starye-org',
      environment: {
        CLOUDFLARE_API_TOKEN: 'fixture-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
      },
      githubOutput,
      runId: 'ci-run',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
    }, {
      executeReadOnly: readOnlyExecutor,
      materialize,
    })

    expect(materialize).toHaveBeenCalledTimes(1)
    expect(prepared.targetId).toBe('starye-org')
    expect(prepared.githubEnvironment).toBe('starye-org')
    expect(await (await import('node:fs/promises')).readFile(githubOutput, 'utf8')).toMatch(/target_id=starye-org/)
    expect(await (await import('node:fs/promises')).readFile(githubOutput, 'utf8')).not.toMatch(/fixture-token|account_id|project_map/)
  })

  it('blocks remote ambient identity and bad resource output before materialization or child execution', async () => {
    const root = await createRoot()
    const materialize = vi.fn(async () => ({
      apiConfigPath: path.join(root, 'api', '.target-wrangler.blocked-run.toml'),
      gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.blocked-run.toml'),
      cleanup: async () => {},
    }))
    const execute = vi.fn()

    await expect(prepareTargetMutation({
      target: 'starye-org',
      scope: 'remote',
      command: 'd1-migrate',
      environment: {
        API_URL: 'https://attacker.example',
        CLOUDFLARE_API_TOKEN: 'fixture-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
      },
      runId: 'blocked-run',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
    }, { executeReadOnly: readOnlyExecutor, materialize })).rejects.toThrow('Ambient target identity')
    expect(materialize).not.toHaveBeenCalled()

    await expect(runPreparedTargetMutation({
      entry: 'd1-migrate-movies-metadata',
      preparedContextPath: path.join(root, 'missing.json'),
      execute,
    })).rejects.toThrow('Prepared context')
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'missing Cloudflare credential',
      environment: {
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
        CRAWLER_SECRET: 'crawler-service-secret',
      },
      executeReadOnly: readOnlyExecutor,
    },
    {
      name: 'wrong Cloudflare account',
      environment: {
        CLOUDFLARE_API_TOKEN: 'cloudflare-token',
        CLOUDFLARE_ACCOUNT_ID: 'not-the-selected-account',
        CRAWLER_SECRET: 'crawler-service-secret',
      },
      executeReadOnly: readOnlyExecutor,
    },
    {
      name: 'failed read-only ownership check',
      environment: {
        CLOUDFLARE_API_TOKEN: 'cloudflare-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
        CRAWLER_SECRET: 'crawler-service-secret',
      },
      executeReadOnly: () => ({ exitCode: 1 }),
    },
  ])('fails $name before fixture context materialization or child execution', async ({ environment, executeReadOnly }) => {
    const root = await createRoot()
    const materialize = vi.fn(async () => ({
      apiConfigPath: path.join(root, 'api', '.target-wrangler.blocked-smoke.toml'),
      gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.blocked-smoke.toml'),
      cleanup: async () => {},
    }))
    const execute = vi.fn()

    await expect(prepareTargetMutation({
      target: 'starye-org',
      scope: 'remote',
      command: 'crawler-smoke-fixture',
      ciEnvironment: 'starye-org',
      environment,
      runId: 'blocked-smoke',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
    }, { executeReadOnly, materialize })).rejects.toThrow('Target mutation preflight failed')

    expect(materialize).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('preserves the selected resource in a failed remote preflight diagnostic', async () => {
    const root = await createRoot()
    const materialize = vi.fn(async () => ({
      apiConfigPath: path.join(root, 'api', '.target-wrangler.diagnostic.toml'),
      gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.diagnostic.toml'),
      cleanup: async () => {},
    }))

    await expect(prepareTargetMutation({
      target: 'starye-org',
      scope: 'ci',
      command: 'worker-deploy',
      ciEnvironment: 'starye-org',
      environment: {
        CLOUDFLARE_API_TOKEN: 'cloudflare-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
      },
      githubOutput: path.join(root, 'github-output'),
      runId: 'diagnostic-run',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
    }, {
      executeReadOnly: () => ({ exitCode: 1, stderr: 'temporary Cloudflare response' }),
      materialize,
    })).rejects.toThrow(/Target mutation preflight failed.*starye-db.*temporary Cloudflare response/)

    expect(materialize).not.toHaveBeenCalled()
  })

  it('allows only the two fixed smoke entries, forwards declared secrets without serializing them, and returns allowlisted child observations', async () => {
    const root = await createRoot()
    const crawlerSecret = 'crawler-service-secret'
    const materialize = vi.fn(async () => ({
      apiConfigPath: path.join(root, 'api', '.target-wrangler.smoke-run.toml'),
      gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.smoke-run.toml'),
      cleanup: async () => {},
    }))
    const prepared = await prepareTargetMutation({
      target: 'starye-org',
      scope: 'remote',
      command: 'crawler-smoke-fixture',
      ciEnvironment: 'starye-org',
      environment: {
        CLOUDFLARE_API_TOKEN: 'cloudflare-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
        CRAWLER_SECRET: crawlerSecret,
      },
      runId: 'smoke-run',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
    }, { executeReadOnly: readOnlyExecutor, materialize })
    if (!prepared.smokeItemCode) {
      throw new Error('Smoke prepared context is missing its primary code.')
    }
    const itemCode = prepared.smokeItemCode
    const execute = vi.fn((_command: string, _args: readonly string[], _environment: NodeJS.ProcessEnv) => ({
      exitCode: 0,
      stdout: JSON.stringify({
        operation: 'crawler-smoke-fixture',
        status: 'synced',
        itemCode,
        itemCount: 1,
      }),
    }))

    const result = await runPreparedTargetMutation({
      entry: 'crawler-smoke-fixture',
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment: {
        CLOUDFLARE_API_TOKEN: 'cloudflare-token',
        CRAWLER_SECRET: crawlerSecret,
      },
      execute,
    })

    expect(targetRemoteEntryDefinitions.filter(definition => definition.id.endsWith('smoke-fixture') || definition.id.endsWith('smoke-snapshot'))).toEqual([
      expect.objectContaining({
        id: 'crawler-smoke-fixture',
        childModule: 'packages/crawler/scripts/target-crawl-mutation.ts',
        childOperation: 'smoke-fixture',
        allowedOptions: [],
        requiredSecretKeys: ['CRAWLER_SECRET'],
      }),
      expect.objectContaining({
        id: 'd1-smoke-snapshot',
        childModule: 'packages/db/scripts/target-d1-mutation.ts',
        childOperation: 'smoke-snapshot',
        mode: 'read-only',
        allowedOptions: [],
        requiredSecretKeys: ['CLOUDFLARE_API_TOKEN'],
      }),
    ])
    expect(await (await import('node:fs/promises')).readFile(prepared.preparedContextPath, 'utf8')).not.toMatch(crawlerSecret)
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]?.[1]).toEqual([
      'exec',
      'tsx',
      path.resolve(import.meta.dirname, '../../../../../packages/crawler/scripts/target-crawl-mutation.ts'),
    ])
    expect(execute.mock.calls[0]?.[2]).toEqual(expect.objectContaining({
      CRAWLER_SECRET: crawlerSecret,
      STARYE_PREPARED_ENTRY: 'crawler-smoke-fixture',
      STARYE_PREPARED_OPERATION: 'smoke-fixture',
    }))
    expect(execute.mock.calls[0]?.[2]).not.toHaveProperty('CLOUDFLARE_API_TOKEN')
    expect(result).toEqual({
      observation: {
        operation: 'crawler-smoke-fixture',
        status: 'synced',
        itemCode,
        itemCount: 1,
      },
    })

    await expect(runPreparedTargetMutation({
      entry: 'crawler-smoke-fixture',
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment: {
        CLOUDFLARE_API_TOKEN: 'cloudflare-token',
        CRAWLER_SECRET: crawlerSecret,
      },
      execute: () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          operation: 'crawler-smoke-fixture',
          status: 'synced',
          itemCode: `${itemCode}-sibling`,
          itemCount: 1,
        }),
      }),
    })).rejects.toThrow('Prepared child observation is invalid.')
  })

  it('fails closed before the child when a declared secret is missing or child JSON includes a non-allowlisted field', async () => {
    const root = await createRoot()
    const materialize = vi.fn(async () => ({
      apiConfigPath: path.join(root, 'api', '.target-wrangler.d1-smoke.toml'),
      gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.d1-smoke.toml'),
      cleanup: async () => {},
    }))
    const prepared = await prepareTargetMutation({
      target: 'starye-org',
      scope: 'remote',
      command: 'd1-smoke-snapshot',
      ciEnvironment: 'starye-org',
      environment: {
        CLOUDFLARE_API_TOKEN: 'cloudflare-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
      },
      runId: 'd1-smoke',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
    }, { executeReadOnly: readOnlyExecutor, materialize })
    const missingSecretExecute = vi.fn()

    await expect(runPreparedTargetMutation({
      entry: 'd1-smoke-snapshot',
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment: {},
      execute: missingSecretExecute,
    })).rejects.toThrow('required credential key')
    expect(missingSecretExecute).not.toHaveBeenCalled()

    const leakedValue = 'do-not-return-this-secret'
    const leakedOutputExecute = vi.fn(() => ({
      exitCode: 0,
      stdout: JSON.stringify({
        operation: 'd1-smoke-snapshot',
        status: 'found',
        itemCode: 'phase13-smoke-starye-org-d1-smoke',
        itemId: 'movie-1',
        token: leakedValue,
      }),
    }))
    await expect(runPreparedTargetMutation({
      entry: 'd1-smoke-snapshot',
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment: { CLOUDFLARE_API_TOKEN: 'cloudflare-token' },
      execute: leakedOutputExecute,
    })).rejects.toThrow('Prepared child observation is invalid.')
    await expect(runPreparedTargetMutation({
      entry: 'd1-smoke-snapshot',
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment: { CLOUDFLARE_API_TOKEN: 'cloudflare-token' },
      execute: leakedOutputExecute,
    })).rejects.not.toThrow(leakedValue)
  })

  it('surfaces a bounded, redacted diagnostic when a prepared child fails', async () => {
    const root = await createRoot()
    const materialize = vi.fn(async () => ({
      apiConfigPath: path.join(root, 'api', '.target-wrangler.failed-child.toml'),
      gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.failed-child.toml'),
      cleanup: async () => {},
    }))
    const prepared = await prepareTargetMutation({
      target: 'starye-org',
      scope: 'remote',
      command: 'd1-smoke-snapshot',
      ciEnvironment: 'starye-org',
      environment: {
        CLOUDFLARE_API_TOKEN: 'cloudflare-token',
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
      },
      runId: 'failed-child',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
    }, { executeReadOnly: readOnlyExecutor, materialize })

    const failure = runPreparedTargetMutation({
      entry: 'd1-smoke-snapshot',
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment: { CLOUDFLARE_API_TOKEN: 'cloudflare-token' },
      execute: () => ({ exitCode: 1, stderr: 'Cloudflare rejected cloudflare-token for this request.' }),
    })

    await expect(failure).rejects.toThrow('Prepared target entry failed: d1-smoke-snapshot. Cloudflare rejected [redacted] for this request.')
    await expect(failure).rejects.not.toThrow('cloudflare-token')
  })
})

