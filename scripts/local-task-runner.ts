import type { RepairSourceCandidate } from '../packages/crawler/src/task-runner/runner-client'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createLocalProofAdapter } from '../packages/crawler/src/task-runner/local-proof-adapter'
import { LocalTaskRunner } from '../packages/crawler/src/task-runner/local-runner'
import { createMangaAdapter } from '../packages/crawler/src/task-runner/manga-adapter'
import { createMovieAdapter } from '../packages/crawler/src/task-runner/movie-adapter'
import { createRepairPlayersAdapter } from '../packages/crawler/src/task-runner/repair-adapter'
import { RunnerClient } from '../packages/crawler/src/task-runner/runner-client'
import { createTemplateAdapterRegistry } from '../packages/crawler/src/task-runner/template-adapters'

interface LocalRunnerConfig {
  readonly apiBaseUrl: string
  readonly callbackKeyId: string
  readonly callbackSecret: string
  readonly providerMode?: 'local-proof'
  readonly crawler: {
    readonly manga: object
    readonly movie: object
    readonly repairPlayers?: { readonly sources: readonly RepairSourceCandidate[] }
  }
}

async function loadLocalRunnerConfig(): Promise<LocalRunnerConfig> {
  const configPath = process.env.TASK_RUNNER_LOCAL_CONFIG
  if (!configPath) {
    throw new Error('TASK_RUNNER_LOCAL_CONFIG must point to an ignored local runner config file')
  }
  return JSON.parse(await readFile(configPath, 'utf8')) as LocalRunnerConfig
}

if (process.argv.includes('--help')) {
  console.log('Usage: pnpm --filter @starye/crawler run local:task-runner')
}
else {
  const config = await loadLocalRunnerConfig()
  const client = new RunnerClient(config)
  const adapters = createTemplateAdapterRegistry([
    createLocalProofAdapter(),
    createMovieAdapter(config.crawler.movie as never),
    createMangaAdapter(config.crawler.manga as never),
    createRepairPlayersAdapter({ sources: config.crawler.repairPlayers?.sources }),
  ])
  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort())
  process.once('SIGTERM', () => controller.abort())
  await new LocalTaskRunner({ adapters, client }).run(controller.signal)
}
