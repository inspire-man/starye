export const PLAYBACK_EVIDENCE_SCHEMA_VERSION = 1 as const

export const PLAYBACK_PROVIDER_VALUES = ['github-actions'] as const
export type PlaybackEvidenceProvider = typeof PLAYBACK_PROVIDER_VALUES[number]

export const PLAYBACK_SOURCE_TYPE_VALUES = ['direct', 'TorrServer', 'Aria2'] as const
export type PlaybackEvidenceSourceType = typeof PLAYBACK_SOURCE_TYPE_VALUES[number]

export const PLAYBACK_EVENT_VALUES = ['canplay', 'playing', 'waiting', 'stalled', 'error'] as const
export type PlaybackEventName = typeof PLAYBACK_EVENT_VALUES[number]

export const PLAYBACK_OUTCOME_VALUES = [
  'accepted',
  'checkpoint',
  'failed',
  'duplicate',
  'conflict',
  'stale',
  'late',
  'ignored',
] as const
export type PlaybackEvidenceOutcome = typeof PLAYBACK_OUTCOME_VALUES[number]

export const PLAYBACK_PROVIDER_STATUS_VALUES = ['pending', 'succeeded', 'failed', 'checkpoint'] as const
export type PlaybackProviderStatus = typeof PLAYBACK_PROVIDER_STATUS_VALUES[number]

export const PLAYBACK_REPAIR_STATUS_VALUES = ['pending', 'validated', 'succeeded', 'failed', 'checkpoint'] as const
export type PlaybackRepairStatus = typeof PLAYBACK_REPAIR_STATUS_VALUES[number]

export const PLAYBACK_SOURCE_STATUS_VALUES = ['ready', 'failed', 'checkpoint'] as const
export type PlaybackSourceStatus = typeof PLAYBACK_SOURCE_STATUS_VALUES[number]

export const PLAYBACK_STATUS_VALUES = ['playback_verified', 'failed', 'checkpoint'] as const
export type PlaybackEvidenceStatus = typeof PLAYBACK_STATUS_VALUES[number]

export const PLAYBACK_REJECTION_VALUES = ['duplicate', 'conflict', 'stale', 'late', 'ignored'] as const
export type PlaybackRejectionOutcome = typeof PLAYBACK_REJECTION_VALUES[number]

export interface PlaybackEvidenceTuple {
  readonly taskId: string
  readonly runId: string
  readonly attemptNumber: number
  readonly provider: PlaybackEvidenceProvider
}

export interface PlaybackProviderProjection {
  readonly provider: PlaybackEvidenceProvider
  readonly status: PlaybackProviderStatus
}

export interface PlaybackRepairProjection {
  readonly status: PlaybackRepairStatus
  readonly sourceRevision: number
}

export interface PlaybackSourceProjection {
  readonly revision: number
  readonly sourceType: PlaybackEvidenceSourceType
  readonly status: PlaybackSourceStatus
}

export interface PlaybackViewerProjection {
  readonly path: string
  readonly targetLabel: string
}

export interface PlaybackEventObservation {
  readonly event: PlaybackEventName
  readonly observed: boolean
  readonly observedAt: number | null
}

export interface PlaybackProgressSamples {
  readonly currentTimeBefore: number
  readonly currentTimeAfter: number
  readonly currentTimeDelta: number
}

export interface PlaybackTerminalProjection {
  readonly canplay: boolean
  readonly error: boolean
  readonly playing: boolean
  readonly status: PlaybackEvidenceStatus
  readonly progress: PlaybackProgressSamples
}

export interface PlaybackArtifactReference {
  readonly hash: string
  readonly reference: string
  readonly stem: string
}

export interface PlaybackEvidenceSummary {
  readonly schemaVersion: typeof PLAYBACK_EVIDENCE_SCHEMA_VERSION
  readonly tuple: PlaybackEvidenceTuple
  readonly contentId: string
  readonly sourceRevision: number
  readonly source: PlaybackSourceProjection
  readonly provider: PlaybackProviderProjection
  readonly repair: PlaybackRepairProjection
  readonly viewer: PlaybackViewerProjection
  readonly events: readonly PlaybackEventObservation[]
  readonly playback: PlaybackTerminalProjection
  readonly artifact: PlaybackArtifactReference
  readonly outcome: PlaybackEvidenceOutcome
  readonly observedAt: number
}

export type PlaybackEvidenceRequest = Omit<PlaybackEvidenceSummary, 'artifact' | 'outcome'>

export interface PlaybackRejectionHistory {
  readonly outcome: PlaybackRejectionOutcome
  readonly observedAt: number
  readonly tuple: PlaybackEvidenceTuple
  readonly contentId: string
  readonly sourceRevision: number
}

export interface PlaybackProofBinding {
  readonly taskId?: string
  readonly runId?: string
  readonly attemptNumber?: number
  readonly provider?: PlaybackEvidenceProvider
  readonly contentId?: string
  readonly sourceRevision?: number
  readonly now?: number
  readonly windowStartedAt?: number
  readonly windowEndsAt?: number
}
