import type {
  VideoAvailabilityLayer,
  VideoAvailabilityReason,
  VideoAvailabilityStatus,
  VideoFinding,
} from './types'
import { VIDEO_PROBE_POLICY_V1 } from './probe-policy'

export type VideoActionKind = 'recheck' | 'repair' | 'configure_provider'

export interface VideoActionBinding {
  readonly movieRevision: number
  readonly policyVersion: string
  readonly sourceRevision: number
}

export interface VideoFindingAction extends VideoActionBinding {
  readonly kind: VideoActionKind
  readonly reason: VideoAvailabilityReason
}

export interface VideoLayerSummary {
  readonly abnormalCount: number
  readonly availableCount: number
  readonly bestStatus: VideoAvailabilityStatus
  readonly findings: readonly VideoFinding[]
  readonly freshness: 'fresh' | 'stale'
  readonly layer: VideoAvailabilityLayer
  readonly primaryAction: VideoFindingAction | null
}

function actionKindForReason(reason: VideoAvailabilityReason): VideoActionKind {
  switch (reason) {
    case 'provider_unconfigured':
    case 'provider_failed':
      return 'configure_provider'
    case 'no_source':
    case 'source_failed':
    case 'direct_blocked':
    case 'direct_content_invalid':
      return 'repair'
    case 'stale':
    case 'direct_transport_failed':
    case 'browser_inconclusive':
    case 'metadata_unresolved':
    case 'no_peer':
    case 'stalled':
    case 'stream_missing':
    case 'stream_failed':
    case 'playback_unverified':
    case 'playback_failed':
      return 'recheck'
  }
}

export function classifyVideoAction(input: VideoActionBinding & { readonly reason: VideoAvailabilityReason }): VideoFindingAction {
  return Object.freeze({
    kind: actionKindForReason(input.reason),
    movieRevision: input.movieRevision,
    policyVersion: input.policyVersion,
    reason: input.reason,
    sourceRevision: input.sourceRevision,
  })
}

export function validateActionBinding(action: VideoFindingAction, expected: VideoActionBinding): VideoFindingAction {
  if (action.movieRevision !== expected.movieRevision || action.sourceRevision !== expected.sourceRevision)
    throw new Error('video_action_revision_mismatch')
  if (action.policyVersion !== expected.policyVersion)
    throw new Error('video_action_policy_mismatch')
  return action
}

function statusRank(status: VideoAvailabilityStatus): number {
  switch (status) {
    case 'available': return 3
    case 'degraded': return 2
    case 'unavailable': return 1
    case 'unknown': return 0
  }
}

function ttlForLayer(layer: VideoAvailabilityLayer): number {
  return layer === 'magnet'
    ? VIDEO_PROBE_POLICY_V1.magnetTtlMs
    : VIDEO_PROBE_POLICY_V1.directTtlMs
}

export function aggregateVideoLayer(
  layer: VideoAvailabilityLayer,
  findings: readonly VideoFinding[],
  now: number,
): VideoLayerSummary {
  if (findings.some(finding => finding.layer !== layer))
    throw new Error('video_layer_finding_mismatch')

  const ordered = [...findings].sort((left, right) => {
    const rankDifference = statusRank(right.status) - statusRank(left.status)
    return rankDifference || right.observedAt - left.observedAt || left.sourceId.localeCompare(right.sourceId)
  })
  const best = ordered[0]
  const freshestObservedAt = findings.reduce((latest, finding) => Math.max(latest, finding.observedAt), 0)
  const freshness = findings.length > 0 && now - freshestObservedAt <= ttlForLayer(layer) ? 'fresh' : 'stale'
  const primaryFinding = freshness === 'stale'
    ? best
    : ordered.find(finding => finding.reason !== null)
  const primaryAction = primaryFinding
    ? classifyVideoAction({
        movieRevision: primaryFinding.sourceRevision,
        policyVersion: primaryFinding.policyVersion,
        reason: freshness === 'stale' ? 'stale' : primaryFinding.reason!,
        sourceRevision: primaryFinding.sourceRevision,
      })
    : null

  return Object.freeze({
    abnormalCount: findings.filter(finding => finding.status !== 'available').length,
    availableCount: findings.filter(finding => finding.status === 'available').length,
    bestStatus: best?.status ?? 'unknown',
    findings: Object.freeze(ordered),
    freshness,
    layer,
    primaryAction,
  })
}
