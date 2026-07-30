import type { RunnerCandidate } from './runner-client'

export interface AdapterExecutionContext {
  readonly checkpoint: () => Promise<boolean>
  readonly candidate: RunnerCandidate
  readonly observe: (contentId: string) => void
}

export interface AdapterExecutionResult {
  readonly contentIds: readonly string[]
}

export interface TaskRunnerAdapter {
  readonly templateKey: RunnerCandidate['snapshot']['templateKey']
  execute: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>
}

export function createTemplateAdapterRegistry(adapters: readonly TaskRunnerAdapter[]) {
  const registry = new Map(adapters.map(adapter => [adapter.templateKey, adapter]))
  return Object.freeze({
    select(snapshot: RunnerCandidate['snapshot']): TaskRunnerAdapter {
      if ((snapshot.templateKey === 'movie' && snapshot.entrypoint !== 'movie-crawler')
        || (snapshot.templateKey === 'manga' && snapshot.entrypoint !== 'manga-crawler')) {
        throw new Error('Runner snapshot entrypoint does not match its template')
      }
      const adapter = registry.get(snapshot.templateKey)
      if (!adapter) {
        throw new Error(`Unsupported runner template: ${snapshot.templateKey}`)
      }
      return adapter
    },
  })
}
