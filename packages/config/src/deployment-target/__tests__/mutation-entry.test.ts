/// <reference types="node" />

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { prepareTargetMutation, runPreparedTargetMutation } from '../mutation-entry'

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
    stdout: argv[0] === 'kv' ? 'f7f6a8c2bff84a1d89da528eab4eb559' : argv.at(-1) ?? '',
  }
}

describe('target mutation preparation', () => {
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
        CLOUDFLARE_ACCOUNT_ID: '27c162f54c8f59fff74224775a59937e',
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
        CLOUDFLARE_ACCOUNT_ID: '27c162f54c8f59fff74224775a59937e',
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
})
