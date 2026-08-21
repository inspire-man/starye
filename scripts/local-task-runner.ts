import type { RepairSourceCandidate } from '../packages/crawler/src/task-runner/runner-client'
import type { ServerVideoAvailabilityConfig } from '../packages/crawler/src/task-runner/video-runner-wiring'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createChapterAvailabilityAdapter } from '../packages/crawler/src/task-runner/chapter-availability-adapter'
import { createLocalProofAdapter } from '../packages/crawler/src/task-runner/local-proof-adapter'
import { LocalTaskRunner } from '../packages/crawler/src/task-runner/local-runner'
import { createMangaAdapter } from '../packages/crawler/src/task-runner/manga-adapter'
import { createMovieAdapter } from '../packages/crawler/src/task-runner/movie-adapter'
import { createRepairPlayersAdapter } from '../packages/crawler/src/task-runner/repair-adapter'
import { RunnerClient } from '../packages/crawler/src/task-runner/runner-client'
import { createTemplateAdapterRegistry } from '../packages/crawler/src/task-runner/template-adapters'
import { createServerVideoAvailabilityAdapters } from '../packages/crawler/src/task-runner/video-runner-wiring'

export interface LocalRunnerConfig {
  readonly apiBaseUrl: string
  readonly callbackKeyId: string
  readonly callbackSecret: string
  readonly providerMode?: 'local-proof'
  readonly crawler: {
    readonly manga: object
    readonly movie: object
    readonly repairPlayers?: { readonly sources: readonly RepairSourceCandidate[] }
  }
  readonly videoAvailability?: ServerVideoAvailabilityConfig
}

export async function loadLocalRunnerConfig(): Promise<LocalRunnerConfig> {
  const configPath = process.env.TASK_RUNNER_LOCAL_CONFIG
  if (!configPath) {
    throw new Error('TASK_RUNNER_LOCAL_CONFIG must point to an ignored local runner config file')
  }
  return JSON.parse(await readFile(configPath, 'utf8')) as LocalRunnerConfig
}

export function createLocalRunnerAdapterRegistry(config: LocalRunnerConfig) {
  return createTemplateAdapterRegistry([
    createLocalProofAdapter(),
    createMovieAdapter(config.crawler.movie as never),
    createMangaAdapter(config.crawler.manga as never),
    { ...createChapterAvailabilityAdapter(), operation: 'chapter_availability' as const },
    createRepairPlayersAdapter({ sources: config.crawler.repairPlayers?.sources }),
    ...createServerVideoAvailabilityAdapters(config.videoAvailability),
  ])
}

export async function runLocalTaskRunner(): Promise<void> {
  const config = await loadLocalRunnerConfig()
  const client = new RunnerClient(config)
  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort())
  process.once('SIGTERM', () => controller.abort())
  await new LocalTaskRunner({ adapters: createLocalRunnerAdapterRegistry(config), client }).run(controller.signal)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--help'))
    console.log('Usage: pnpm --filter @starye/crawler run local:task-runner')
  else
    await runLocalTaskRunner()
}
