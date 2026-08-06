import type { RepairSourceObservationInput, RepairSourceObservationResponse, RunnerCandidate, RunnerFailureCode, RunnerSnapshot } from './runner-client'

export interface AdapterExecutionContext {
  readonly checkpoint: () => Promise<boolean>
  readonly candidate: RunnerCandidate
  readonly client?: {
    readonly observeRepairSource?: (candidate: RunnerCandidate, sequence: number, input: RepairSourceObservationInput) => Promise<RepairSourceObservationResponse>
  }
  readonly nextSequence?: () => number
  readonly observe: (contentId: string) => void
}

export interface AdapterExecutionResult {
  readonly contentIds: readonly string[]
  readonly failureCode?: RunnerFailureCode
  readonly repairReceipt?: import('./runner-client').RepairPlayersReceipt
}

export interface TaskRunnerAdapter {
  readonly operation?: 'repair_players'
  readonly templateKey: RunnerCandidate['snapshot']['templateKey']
  execute: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>
}

export function createTemplateAdapterRegistry(adapters: readonly TaskRunnerAdapter[]) {
  const registry = new Map(adapters.filter(adapter => !adapter.operation).map(adapter => [adapter.templateKey, adapter]))
  const repairAdapter = adapters.find(adapter => adapter.operation === 'repair_players')
  return Object.freeze({
    select(snapshot: RunnerSnapshot): TaskRunnerAdapter {
      if (snapshot.operation === 'repair_players') {
        if (snapshot.templateKey !== 'movie'
          || snapshot.entrypoint !== 'movie-crawler'
          || snapshot.permissionResource !== 'movie'
          || !snapshot.movieId.trim()
          || !Number.isSafeInteger(snapshot.sourceRevision)
          || snapshot.sourceRevision < 0
          || snapshot.targetIntent !== 'restore_playable_sources') {
          throw new Error('Repair runner snapshot does not match its operation')
        }
        if (!repairAdapter)
          throw new Error('Unsupported runner operation: repair_players')
        return repairAdapter
      }

      if (('movieId' in snapshot) || ('sourceRevision' in snapshot) || ('targetIntent' in snapshot)) {
        throw new Error('Runner snapshot operation is missing')
      }
      if ((snapshot.templateKey === 'movie' && snapshot.entrypoint !== 'movie-crawler')
        || (snapshot.templateKey === 'manga' && snapshot.entrypoint !== 'manga-crawler')
        || (snapshot.templateKey === 'manga' && snapshot.permissionResource !== 'comic')
        || (snapshot.templateKey === 'movie' && snapshot.permissionResource !== 'movie')) {
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
