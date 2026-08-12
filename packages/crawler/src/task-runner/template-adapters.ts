import type { RepairRunnerSnapshot, RepairSourceObservationInput, RepairSourceObservationResponse, RunnerAvailabilityObservationInput, RunnerCandidate, RunnerFailureCode, RunnerSnapshot } from './runner-client'

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
  readonly availabilityObservation?: RunnerAvailabilityObservationInput
  readonly contentIds: readonly string[]
  readonly failureCode?: RunnerFailureCode
  readonly repairReceipt?: import('./runner-client').RepairPlayersReceipt
}

export interface TaskRunnerAdapter {
  readonly operation?: 'repair_players' | 'video_direct' | 'video_magnet'
  readonly proofProfile?: RunnerCandidate['proofProfile']
  readonly templateKey: RunnerCandidate['snapshot']['templateKey']
  execute: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>
}

function isValidRepairSnapshot(snapshot: RunnerSnapshot): snapshot is RepairRunnerSnapshot {
  return snapshot.operation === 'repair_players'
    && snapshot.templateVersion === 1
    && snapshot.templateKey === 'movie'
    && snapshot.entrypoint === 'movie-crawler'
    && snapshot.permissionResource === 'movie'
    && typeof snapshot.movieId === 'string'
    && snapshot.movieId.trim().length > 0
    && (snapshot.reason === 'no_source' || snapshot.reason === 'source_failed')
    && Number.isSafeInteger(snapshot.sourceRevision)
    && snapshot.sourceRevision >= 0
    && snapshot.sourceRevision <= 1_000_000
    && snapshot.targetIntent === 'restore_playable_sources'
}

const directVideoReasons = new Set(['direct_blocked', 'direct_transport_failed', 'direct_content_invalid', 'browser_inconclusive'])
const magnetVideoReasons = new Set(['provider_unconfigured', 'provider_failed', 'metadata_unresolved', 'no_peer', 'stalled', 'stream_missing', 'stream_failed'])

export function createTemplateAdapterRegistry(adapters: readonly TaskRunnerAdapter[]) {
  const registry = new Map(adapters.filter(adapter => !adapter.operation).map(adapter => [adapter.templateKey, adapter]))
  const repairAdapter = adapters.find(adapter => adapter.operation === 'repair_players')
  const directVideoAdapter = adapters.find(adapter => adapter.operation === 'video_direct')
  const magnetVideoAdapter = adapters.find(adapter => adapter.operation === 'video_magnet')
  const proofAdapters = new Map(adapters.filter(adapter => adapter.proofProfile).map(adapter => [adapter.proofProfile!, adapter]))
  return Object.freeze({
    select(snapshot: RunnerSnapshot, proofProfile?: RunnerCandidate['proofProfile']): TaskRunnerAdapter {
      if (proofProfile) {
        const adapter = proofAdapters.get(proofProfile)
        if (!adapter || adapter.templateKey !== snapshot.templateKey)
          throw new Error(`Unsupported runner proof profile: ${proofProfile}`)
        return adapter
      }
      if (snapshot.operation === 'repair_players') {
        if (!isValidRepairSnapshot(snapshot))
          throw new Error('Repair runner snapshot contract is invalid')
        if (!repairAdapter)
          throw new Error('Unsupported runner operation: repair_players')
        return repairAdapter
      }
      if (snapshot.operation === 'check_video_source'
        || snapshot.operation === 'recheck_video_source'
        || snapshot.operation === 'repair_video_source') {
        if (magnetVideoReasons.has(snapshot.reason)) {
          if (!magnetVideoAdapter)
            throw new Error('Unsupported runner operation: video_magnet')
          return magnetVideoAdapter
        }
        if (directVideoReasons.has(snapshot.reason)) {
          if (!directVideoAdapter)
            throw new Error('Unsupported runner source kind: video_direct')
          return directVideoAdapter
        }
        throw new Error(`Unsupported runner video source kind: ${snapshot.reason}`)
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
