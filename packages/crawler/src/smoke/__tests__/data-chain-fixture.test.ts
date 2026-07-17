/// <reference types="node" />

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { runTargetCrawlerMutation } from '../../../scripts/target-crawl-mutation'
import { createDataChainFixture, createDataChainFixtureBatch, runDataChainFixture } from '../data-chain-fixture'

const roots: string[] = []
const targetId = 'starye-org'
const runId = 'fixture-run'

async function createPreparedContext(): Promise<{ contextPath: string, apiConfigPath: string, gatewayConfigPath: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-data-chain-fixture-'))
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
    smokeItemCode: createDataChainFixture({ targetId, runId }).code,
  }), 'utf8')
  return { contextPath, apiConfigPath, gatewayConfigPath }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function acknowledgedSync() {
  return {
    message: 'Sync completed',
    result: { success: 1, failed: 0, skipped: 0, errors: [] },
  }
}

describe('phase 13 data-chain fixture', () => {
  it('builds and syncs exactly ten deterministic non-R18 movies with one player each through ApiClient', async () => {
    const syncMovie = vi.fn(async () => acknowledgedSync())
    const fixtures = createDataChainFixtureBatch({ targetId, runId })

    const result = await runDataChainFixture({
      targetId,
      runId,
      apiClient: { syncMovie },
    })

    expect(fixtures).toHaveLength(10)
    expect(fixtures[0]?.code).toBe(result.itemCode)
    for (const fixture of fixtures) {
      expect(fixture).toEqual(expect.objectContaining({
        isR18: false,
        players: [{
          sourceName: 'phase13-smoke',
          sourceUrl: expect.stringContaining(fixture.code),
          sortOrder: 0,
        }],
      }))
      expect(fixture).not.toHaveProperty('actors')
      expect(fixture).not.toHaveProperty('publisher')
    }
    expect(syncMovie).toHaveBeenCalledTimes(10)
    expect(result).toEqual({
      operation: 'crawler-smoke-fixture',
      status: 'synced',
      itemCode: fixtures[0]?.code,
      itemCount: 10,
    })
  })

  it.each([
    ['an incomplete item array', (fixtures: ReturnType<typeof createDataChainFixtureBatch>) => fixtures.slice(0, 9)],
    ['an R18 item', (fixtures: ReturnType<typeof createDataChainFixtureBatch>) => [{ ...fixtures[0]!, isR18: true }, ...fixtures.slice(1)]],
    ['no player', (fixtures: ReturnType<typeof createDataChainFixtureBatch>) => [{ ...fixtures[0]!, players: [] }, ...fixtures.slice(1)]],
    ['multiple players', (fixtures: ReturnType<typeof createDataChainFixtureBatch>) => [{ ...fixtures[0]!, players: [...fixtures[0]!.players, fixtures[0]!.players[0]] }, ...fixtures.slice(1)]],
    ['a mismatched code', (fixtures: ReturnType<typeof createDataChainFixtureBatch>) => [{ ...fixtures[0]!, code: 'other-item' }, ...fixtures.slice(1)]],
  ])('rejects %s before the service-auth transport', async (_name, createFixtures) => {
    const syncMovie = vi.fn(async () => acknowledgedSync())

    await expect(runDataChainFixture({
      targetId,
      runId,
      apiClient: { syncMovie },
      createFixtures: input => createFixtures(createDataChainFixtureBatch(input)),
    })).rejects.toThrow('Data-chain fixture')

    expect(syncMovie).not.toHaveBeenCalled()
  })

  it('never reports a synced batch when one service acknowledgement fails', async () => {
    let calls = 0
    const syncMovie = vi.fn(async () => {
      calls += 1
      return calls === 6 ? { message: 'Sync completed', result: { success: 0, failed: 1 } } : acknowledgedSync()
    })

    await expect(runDataChainFixture({ targetId, runId, apiClient: { syncMovie } }))
      .rejects
      .toThrow('Data-chain fixture sync was not acknowledged.')
    expect(syncMovie).toHaveBeenCalledTimes(6)
  })

  it('runs only the registry-owned prepared crawler operation and never constructs an API client for rejected input', async () => {
    const { contextPath, apiConfigPath, gatewayConfigPath } = await createPreparedContext()
    const createApiClient = vi.fn(() => ({ syncMovie: vi.fn(async () => acknowledgedSync()) }))
    const environment = {
      STARYE_PREPARED_CONTEXT_PATH: contextPath,
      STARYE_PREPARED_ENTRY: 'crawler-smoke-fixture',
      STARYE_PREPARED_OPERATION: 'smoke-fixture',
      STARYE_PREPARED_SECRET_KEYS: 'CRAWLER_SECRET',
      STARYE_API_CONFIG_PATH: apiConfigPath,
      STARYE_GATEWAY_CONFIG_PATH: gatewayConfigPath,
      CRAWLER_SECRET: 'service-token',
    }

    await expect(runTargetCrawlerMutation({
      ...environment,
      STARYE_PREPARED_OPERATION: 'other-operation',
    }, { createApiClient })).rejects.toThrow('registry-owned smoke operation')
    expect(createApiClient).not.toHaveBeenCalled()

    await expect(runTargetCrawlerMutation({
      ...environment,
      STARYE_PREPARED_ENTRY: 'crawler-check-config',
      STARYE_PREPARED_OPERATION: 'smoke-fixture',
    }, { createApiClient })).rejects.toThrow('registry-owned smoke operation')
    expect(createApiClient).not.toHaveBeenCalled()

    const result = await runTargetCrawlerMutation(environment, { createApiClient })
    expect(createApiClient).toHaveBeenCalledWith({
      url: 'https://api.example.test',
      token: 'service-token',
      timeout: 60000,
    })
    expect(result).toEqual(expect.objectContaining({
      operation: 'crawler-smoke-fixture',
      status: 'synced',
    }))
  })
})
