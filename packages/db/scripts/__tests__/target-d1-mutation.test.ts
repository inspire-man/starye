/// <reference types="node" />

import type { PreparedD1MigrationCommand } from '../target-d1-mutation'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTargetD1Mutation } from '../target-d1-mutation'

const roots: string[] = []
const targetId = 'starye-org'
const runId = 'snapshot-run'

async function createPreparedContext(): Promise<{ contextPath: string, apiConfigPath: string, gatewayConfigPath: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-d1-snapshot-'))
  roots.push(root)
  const contextPath = path.join(root, `prepared-context.${runId}.json`)
  const apiConfigPath = path.join(root, 'api.target.toml')
  const gatewayConfigPath = path.join(root, 'gateway.target.toml')
  await writeFile(contextPath, JSON.stringify({
    targetId,
    runId,
    preparedContextPath: contextPath,
    apiConfigPath,
    gatewayConfigPath,
    identity: {
      apiUrl: 'https://api.example.test',
      d1Name: 'starye-d1',
      r2Name: 'starye-r2',
      accountId: 'selected-account',
    },
    smokeItemCode: 'p13-smoke-starye-org-98bb7ab3',
  }), 'utf8')
  return { contextPath, apiConfigPath, gatewayConfigPath }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('prepared D1 smoke snapshot', () => {
  it('exports the selected D1 backup, uploads it to the selected R2 bucket, and applies migrations', async () => {
    const { contextPath, apiConfigPath, gatewayConfigPath } = await createPreparedContext()
    const executeMigration = vi.fn<(command: PreparedD1MigrationCommand) => { exitCode: number }>(() => ({ exitCode: 0 }))

    await expect(runTargetD1Mutation({
      STARYE_PREPARED_CONTEXT_PATH: contextPath,
      STARYE_PREPARED_ENTRY: 'd1-migrate',
      STARYE_PREPARED_OPERATION: 'migrate',
      STARYE_PREPARED_SECRET_KEYS: 'CLOUDFLARE_API_TOKEN',
      STARYE_API_CONFIG_PATH: apiConfigPath,
      STARYE_GATEWAY_CONFIG_PATH: gatewayConfigPath,
      CLOUDFLARE_ACCOUNT_ID: 'selected-account',
      CLOUDFLARE_API_TOKEN: 'cloudflare-token',
    }, { executeMigration })).resolves.toBeUndefined()

    expect(executeMigration.mock.calls.map(([command]) => command)).toEqual([
      expect.objectContaining({
        kind: 'export',
        accountId: 'selected-account',
        configPath: apiConfigPath,
        d1Name: 'starye-d1',
        r2Name: 'starye-r2',
        backupKey: 'ops/d1-backups/starye-org/snapshot-run.sql',
      }),
      expect.objectContaining({ kind: 'backup' }),
      expect.objectContaining({ kind: 'apply' }),
    ])
  })

  it('uses the selected prepared D1 identity with a fixed parameterized read-only snapshot query', async () => {
    const { contextPath, apiConfigPath, gatewayConfigPath } = await createPreparedContext()
    const execute = vi.fn(() => ({
      exitCode: 0,
      stdout: JSON.stringify([{ results: [{ id: 'movie-1', code: 'p13-smoke-starye-org-98bb7ab3', playerCount: 1 }] }]),
    }))

    const result = await runTargetD1Mutation({
      STARYE_PREPARED_CONTEXT_PATH: contextPath,
      STARYE_PREPARED_ENTRY: 'd1-smoke-snapshot',
      STARYE_PREPARED_OPERATION: 'smoke-snapshot',
      STARYE_PREPARED_SECRET_KEYS: 'CLOUDFLARE_API_TOKEN',
      STARYE_API_CONFIG_PATH: apiConfigPath,
      STARYE_GATEWAY_CONFIG_PATH: gatewayConfigPath,
      CLOUDFLARE_ACCOUNT_ID: 'selected-account',
      CLOUDFLARE_API_TOKEN: 'cloudflare-token',
    }, { execute })

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'selected-account',
      configPath: apiConfigPath,
      d1Name: 'starye-d1',
      sql: expect.stringContaining('WHERE movie.code = ?'),
      params: ['p13-smoke-starye-org-98bb7ab3'],
    }))
    expect(result).toEqual({
      operation: 'd1-smoke-snapshot',
      status: 'found',
      itemCode: 'p13-smoke-starye-org-98bb7ab3',
      itemId: 'movie-1',
    })
  })

  it('rejects direct, malformed, or wrong-operation execution before querying D1', async () => {
    const execute = vi.fn()

    await expect(runTargetD1Mutation({
      STARYE_PREPARED_ENTRY: 'd1-smoke-snapshot',
      STARYE_PREPARED_OPERATION: 'smoke-snapshot',
    }, { execute })).rejects.toThrow('registry-owned prepared context')
    expect(execute).not.toHaveBeenCalled()

    const { contextPath, apiConfigPath, gatewayConfigPath } = await createPreparedContext()
    await expect(runTargetD1Mutation({
      STARYE_PREPARED_CONTEXT_PATH: contextPath,
      STARYE_PREPARED_ENTRY: 'd1-smoke-snapshot',
      STARYE_PREPARED_OPERATION: 'different-operation',
      STARYE_PREPARED_SECRET_KEYS: 'CLOUDFLARE_API_TOKEN',
      STARYE_API_CONFIG_PATH: apiConfigPath,
      STARYE_GATEWAY_CONFIG_PATH: gatewayConfigPath,
      CLOUDFLARE_ACCOUNT_ID: 'selected-account',
      CLOUDFLARE_API_TOKEN: 'cloudflare-token',
    }, { execute })).rejects.toThrow('registry-owned operation')
    expect(execute).not.toHaveBeenCalled()
  })
})
