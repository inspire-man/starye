/// <reference types="node" />

import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
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
import { resolveTargetProfile } from '../target-resolver'

const roots: string[] = []

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-production-workflow-'))
  roots.push(root)
  return root
}

function readOnlyExecutor(argv: readonly string[]) {
  return {
    exitCode: 0,
    stdout: argv[0] === 'kv' ? 'acf49df06ae0447b82a092cf238714d8' : argv.at(-1) ?? '',
  }
}

function productionSecrets(): Record<string, string> {
  return Object.fromEntries(productionCrawlerRequiredEnvironmentKeys.map(key => [key, `fixture-${key.toLowerCase()}`]))
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('production target/workflow integration boundary', () => {
  it('resolves the explicit starye-org profile and maps it to the GitHub Environment', () => {
    const resolution = resolveTargetProfile(' starye-org ')

    expect(resolution.id).toBe('starye-org')
    expect(resolution.profile.ci.githubEnvironment).toBe('starye-org')
    expect(resolution.profile.urls.gateway).toMatch(/^https:\/\//u)
    expect(resolution.profile.urls.api).toMatch(/^https:\/\//u)
  })

  it('prepares fixed production entries with secret-free context and forwards only declared credentials', async () => {
    const root = await createRoot()
    const runDirectory = path.join(root, 'run')
    const materialize = vi.fn(async () => {
      await mkdir(runDirectory, { recursive: true })
      return {
        apiConfigPath: path.join(root, 'api', '.target-wrangler.ci-production.toml'),
        gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.ci-production.toml'),
        cleanup: async () => {},
      }
    })
    const prepared = await prepareTargetMutation({
      target: 'starye-org',
      scope: 'ci',
      command: 'crawler-optimized',
      ciEnvironment: 'starye-org',
      environment: {
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
        CLOUDFLARE_API_TOKEN: 'fixture-cloudflare-token',
        ...productionSecrets(),
      },
      githubOutput: path.join(root, 'github-output'),
      runId: 'production-fixture-run',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory,
    }, {
      executeReadOnly: readOnlyExecutor,
      materialize,
    })

    expect(prepared.targetId).toBe('starye-org')
    expect(prepared.githubEnvironment).toBe('starye-org')
    const context = await readFile(prepared.preparedContextPath, 'utf8')
    expect(context).not.toContain('fixture-cloudflare-token')
    expect(context).not.toContain('fixture-actions_application')
    expect(context).toContain('production-fixture-run')
    const output = await readFile(path.join(root, 'github-output'), 'utf8')
    expect(output).toContain('target_id=starye-org')
    expect(output).toContain('github_environment=starye-org')
    expect(output).not.toContain('fixture-cloudflare-token')

    const execute = vi.fn((_command: string, _args: readonly string[], _environment: NodeJS.ProcessEnv) => ({
      exitCode: 0,
      stdout: 'production child completed',
    }))
    await expect(runPreparedTargetMutation({
      entry: 'crawler-optimized',
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment: productionSecrets(),
      execute,
    })).resolves.toEqual({})

    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]?.[0]).toBe('pnpm')
    expect(execute.mock.calls[0]?.[1]).toEqual([
      'exec',
      'tsx',
      path.resolve(import.meta.dirname, '../../../../../packages/crawler/scripts/target-crawl-mutation.ts'),
    ])
    expect(execute.mock.calls[0]?.[2]).toEqual(expect.objectContaining({
      STARYE_PREPARED_ENTRY: 'crawler-optimized',
      STARYE_PREPARED_OPERATION: 'movie-production',
      CRAWLER_SECRET: productionSecrets().CRAWLER_SECRET,
      STARYE_PREPARED_SECRET_KEYS: productionCrawlerRequiredEnvironmentKeys.join(','),
      STARYE_PREPARED_OPTIONAL_ENVIRONMENT_KEYS: '',
    }))
    expect(execute.mock.calls[0]?.[2]).not.toHaveProperty('target_url')
    expect(execute.mock.calls[0]?.[2]).not.toHaveProperty('COMMAND')
    expect(execute.mock.calls[0]?.[2]).not.toHaveProperty('CLOUDFLARE_API_TOKEN')
  })

  it('forwards declared optional video configuration without making it a required credential', async () => {
    const root = await createRoot()
    const runDirectory = path.join(root, 'run')
    const materialize = vi.fn(async () => {
      await mkdir(runDirectory, { recursive: true })
      return {
        apiConfigPath: path.join(root, 'api', '.target-wrangler.ci-production.toml'),
        gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.ci-production.toml'),
        cleanup: async () => {},
      }
    })
    const prepared = await prepareTargetMutation({
      target: 'starye-org',
      scope: 'ci',
      command: 'crawler-comic',
      ciEnvironment: 'starye-org',
      environment: {
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
        CLOUDFLARE_API_TOKEN: 'fixture-cloudflare-token',
        ...productionSecrets(),
        STARYE_VIDEO_DIRECT_SOURCES: '["https://video.example.test/direct"]',
      },
      githubOutput: path.join(root, 'github-output'),
      runId: 'production-optional-fixture-run',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory,
    }, {
      executeReadOnly: readOnlyExecutor,
      materialize,
    })

    const execute = vi.fn((_command: string, _args: readonly string[], _environment: NodeJS.ProcessEnv) => ({
      exitCode: 0,
      stdout: 'production child completed',
    }))
    const authorizedEnvironment = {
      ...productionSecrets(),
      STARYE_VIDEO_DIRECT_SOURCES: '["https://video.example.test/direct"]',
    }
    await expect(runPreparedTargetMutation({
      entry: 'crawler-comic',
      preparedContextPath: prepared.preparedContextPath,
      authorizedEnvironment,
      execute,
    })).resolves.toEqual({})

    expect(execute.mock.calls[0]?.[2]).toEqual(expect.objectContaining({
      STARYE_PREPARED_SECRET_KEYS: productionCrawlerRequiredEnvironmentKeys.join(','),
      STARYE_PREPARED_OPTIONAL_ENVIRONMENT_KEYS: productionCrawlerOptionalEnvironmentKeys[0],
      STARYE_VIDEO_DIRECT_SOURCES: '["https://video.example.test/direct"]',
    }))
  })

  it('keeps production operation registry closed and rejects environment drift before materialization', async () => {
    const productionEntries = targetRemoteEntryDefinitions.filter(definition => definition.id === 'crawler-comic' || definition.id === 'crawler-optimized')
    expect(productionEntries).toEqual([
      expect.objectContaining({ id: 'crawler-comic', childOperation: 'manga-production', allowedOptions: [] }),
      expect.objectContaining({ id: 'crawler-optimized', childOperation: 'movie-production', allowedOptions: [] }),
    ])
    expect(productionCrawlerRequiredEnvironmentKeys).not.toContain('target_url')
    expect(productionCrawlerRequiredEnvironmentKeys).not.toContain('COMMAND')

    const root = await createRoot()
    const materialize = vi.fn(async () => ({
      apiConfigPath: path.join(root, 'api', '.target-wrangler.invalid.toml'),
      gatewayConfigPath: path.join(root, 'gateway', '.target-wrangler.invalid.toml'),
      cleanup: async () => {},
    }))
    await expect(prepareTargetMutation({
      target: 'starye-org',
      scope: 'ci',
      command: 'crawler-comic',
      ciEnvironment: 'foreign-environment',
      environment: {
        CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
        CLOUDFLARE_API_TOKEN: 'fixture-cloudflare-token',
      },
      githubOutput: path.join(root, 'github-output'),
      runId: 'invalid-production-run',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
    }, { executeReadOnly: readOnlyExecutor, materialize })).rejects.toThrow('ci-environment-mismatch')
    expect(materialize).not.toHaveBeenCalled()
  })
})
