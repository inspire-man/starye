export const PLAYBACK_AVAILABILITY_STATUSES = [
  'none',
  'unverified',
  'verified',
  'failed',
  'magnet_only',
] as const

export type PlaybackAvailabilityStatus = typeof PLAYBACK_AVAILABILITY_STATUSES[number]
export type PlaybackAvailabilityAction = 'none' | 'recheck' | 'repair'

export const PLAYBACK_AVAILABILITY_STALE_SECONDS = 7 * 24 * 60 * 60

export interface PlaybackAvailability {
  readonly status: PlaybackAvailabilityStatus
  readonly hasPlayers: boolean
  readonly lastVerifiedAt: number | null
  readonly lastCheckedAt: number | null
  readonly stale: boolean
  readonly failureReason: string | null
  readonly nextAction: PlaybackAvailabilityAction
}

export interface PlaybackAvailabilityInput {
  readonly hasPlayers: boolean
  readonly hasEligibleDirect: boolean
  readonly hasEligibleMagnet: boolean
  readonly sourceDisposition?: 'ready' | 'no_source' | 'source_failed' | 'repairing' | null
  readonly playbackStatus?: 'playback_verified' | 'unverified' | null
  readonly lastVerifiedAt?: number | null
  readonly lastCheckedAt?: number | null
  readonly availabilityStatus?: 'available' | 'unavailable' | 'degraded' | 'unknown' | null
  readonly availabilityReason?: string | null
  readonly playerPlaybackFailed?: boolean
  readonly playerPlaybackFailureReason?: string | null
  readonly playerPlaybackFailedAt?: number | null
  readonly now?: number
}

const FAILED_REASONS = new Set([
  'source_failed',
  'playback_failed',
  'direct_blocked',
  'direct_content_invalid',
  'direct_transport_failed',
  'stream_failed',
  'stream_missing',
  'source_candidate_invalid',
])

export function isMagnetPlaybackUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.trim().toLowerCase().startsWith('magnet:')
}

export function derivePlaybackAvailability(input: PlaybackAvailabilityInput): PlaybackAvailability {
  const now = input.now ?? Math.floor(Date.now() / 1000)
  const lastVerifiedAt = typeof input.lastVerifiedAt === 'number' && Number.isFinite(input.lastVerifiedAt) ? input.lastVerifiedAt : null
  const playerFailureReason = input.playerPlaybackFailed
    ? (input.playerPlaybackFailureReason && FAILED_REASONS.has(input.playerPlaybackFailureReason)
        ? input.playerPlaybackFailureReason
        : 'playback_failed')
    : null
  const failureReason = playerFailureReason
    ?? (input.sourceDisposition === 'source_failed' || FAILED_REASONS.has(input.availabilityReason ?? '')
      ? input.availabilityReason ?? (input.sourceDisposition === 'source_failed' ? 'source_failed' : null)
      : null)
  const lastCheckedAt = [input.lastCheckedAt, input.playerPlaybackFailedAt, lastVerifiedAt]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .reduce((latest, value) => value > latest ? value : latest, Number.NEGATIVE_INFINITY)
  const resolvedLastCheckedAt = Number.isFinite(lastCheckedAt) ? lastCheckedAt : null
  const stale = resolvedLastCheckedAt === null || (now - resolvedLastCheckedAt) > PLAYBACK_AVAILABILITY_STALE_SECONDS
  const verifiedOutranksFailure = input.playbackStatus === 'playback_verified'
    && lastVerifiedAt !== null
    && (input.playerPlaybackFailedAt == null || lastVerifiedAt >= input.playerPlaybackFailedAt)

  let status: PlaybackAvailabilityStatus = 'none'
  if (verifiedOutranksFailure)
    status = 'verified'
  else if (input.playerPlaybackFailed || input.sourceDisposition === 'source_failed' || input.availabilityStatus === 'unavailable' || failureReason)
    status = 'failed'
  else if (input.hasEligibleMagnet && !input.hasEligibleDirect)
    status = 'magnet_only'
  else if (input.hasPlayers || input.sourceDisposition === 'ready' || input.sourceDisposition === 'repairing')
    status = 'unverified'

  const nextAction: PlaybackAvailabilityAction = status === 'verified'
    ? 'none'
    : status === 'failed' || status === 'none'
      ? 'repair'
      : 'recheck'

  return {
    status,
    hasPlayers: input.hasPlayers,
    lastVerifiedAt,
    lastCheckedAt: resolvedLastCheckedAt,
    stale: status !== 'verified' && stale,
    failureReason,
    nextAction,
  }
}
