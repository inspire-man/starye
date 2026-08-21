import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTargetCrawlerMutation } from '../../../scripts/target-crawl-mutation'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createActorEnvironment(): Promise<NodeJS.ProcessEnv> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-actor-entry-'))
  roots.push(root)
  const contextPath = path.join(root, 'prepared-context.actor-run.json')
  await mkdir(root, { recursive: true })
  await writeFile(contextPath, JSON.stringify({
    apiConfigPath: path.join(root, 'api.toml'),
    gatewayConfigPath: path.join(root, 'gateway.toml'),
    identity: {
      accountId: 'account-id',
      apiUrl: 'http://localhost:8080',
      r2Name: 'starye-media',
    },
    preparedContextPath: contextPath,
    runId: 'actor-run',
    targetId: 'starye-org',
  }), 'utf8')

  return {
    CRAWLER_SECRET: 'crawler-secret',
    R2_ACCESS_KEY_ID: 'r2-access',
    R2_PUBLIC_URL: 'https://cdn.example.test',
    R2_SECRET_ACCESS_KEY: 'r2-secret',
    STARYE_API_CONFIG_PATH: path.join(root, 'api.toml'),
    STARYE_GATEWAY_CONFIG_PATH: path.join(root, 'gateway.toml'),
    STARYE_PREPARED_CONTEXT_PATH: contextPath,
    STARYE_PREPARED_ENTRY: 'crawler-actor',
    STARYE_PREPARED_OPERATION: 'actor',
  }
}

describe('registry-owned actor crawler entry', () => {
  it('runs ActorCrawler through the prepared context and forwards the target media config', async () => {
    const environment = await createActorEnvironment()
    const run = vi.fn(async () => {})
    const createActorCrawler = vi.fn(() => ({ run }))

    await expect(runTargetCrawlerMutation(environment, { createActorCrawler })).resolves.toBeUndefined()

    expect(createActorCrawler).toHaveBeenCalledWith({
      apiConfig: { token: 'crawler-secret', url: 'http://localhost:8080' },
      browserConfig: {},
      r2Config: {
        accessKeyId: 'r2-access',
        accountId: 'account-id',
        bucketName: 'starye-media',
        publicUrl: 'https://cdn.example.test',
        secretAccessKey: 'r2-secret',
      },
    })
    expect(run).toHaveBeenCalledOnce()
  })
})
