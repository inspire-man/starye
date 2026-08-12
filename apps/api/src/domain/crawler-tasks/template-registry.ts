import type {
  CrawlerTaskOperation,
  CrawlerTaskSnapshot,
  CrawlerTaskSnapshotUnion,
  CrawlerTaskTemplate,
  CrawlerTaskTemplateKey,
  RepairPlayersReason,
  RepairPlayersTargetIntent,
  RepairPlayersTaskSnapshot,
  VideoSourceFindingReason,
  VideoSourceTaskOperation,
  VideoSourceTaskSnapshot,
} from './types'
import { CRAWLER_TASK_OPERATION_VALUES } from './types'

export const crawlerTaskTemplates = {
  manga: {
    entrypoint: 'manga-crawler',
    permissionResource: 'comic',
    templateKey: 'manga',
    templateVersion: 1,
  },
  movie: {
    entrypoint: 'movie-crawler',
    permissionResource: 'movie',
    templateKey: 'movie',
    templateVersion: 1,
  },
} as const satisfies Record<CrawlerTaskTemplateKey, CrawlerTaskTemplate>

export interface RepairPlayersSnapshotInput {
  readonly movieId: string
  readonly operation: 'repair_players'
  readonly reason: RepairPlayersReason
  readonly sourceRevision: number
  readonly targetIntent: RepairPlayersTargetIntent
}

export interface VideoSourceSnapshotInput {
  readonly movieId: string
  readonly movieRevision: number
  readonly operation: VideoSourceTaskOperation
  readonly policyVersion: string
  readonly reason: VideoSourceFindingReason
  readonly sourceRevision: number
}

export type ReadCrawlerTaskSnapshotResult
  = | {
    readonly ok: true
    readonly operation: CrawlerTaskOperation
    readonly snapshot: CrawlerTaskSnapshotUnion
    readonly template: CrawlerTaskTemplate
  }
  | {
    readonly ok: false
    readonly reason: 'invalid_snapshot' | 'operation_missing' | 'operation_mismatch'
  }

export function isCrawlerTaskTemplateKey(value: unknown): value is CrawlerTaskTemplateKey {
  return value === 'manga' || value === 'movie'
}

export function isCrawlerTaskOperation(value: unknown): value is CrawlerTaskOperation {
  return typeof value === 'string' && (CRAWLER_TASK_OPERATION_VALUES as readonly string[]).includes(value)
}

export function getCrawlerTaskTemplate(templateKey: CrawlerTaskTemplateKey): CrawlerTaskTemplate {
  return crawlerTaskTemplates[templateKey]
}

function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256
}

function validSourceRevision(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 1_000_000
}

function validPolicyVersion(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128
}

function ordinarySnapshot(templateKey: CrawlerTaskTemplateKey): CrawlerTaskSnapshot {
  return Object.freeze({ ...getCrawlerTaskTemplate(templateKey) })
}

function repairPlayersSnapshot(input: RepairPlayersSnapshotInput): RepairPlayersTaskSnapshot {
  const template = getCrawlerTaskTemplate('movie')
  return Object.freeze({
    ...template,
    movieId: input.movieId.trim(),
    operation: 'repair_players',
    reason: input.reason,
    sourceRevision: input.sourceRevision,
    targetIntent: 'restore_playable_sources',
    templateKey: 'movie',
  })
}

function videoSourceSnapshot(input: VideoSourceSnapshotInput): VideoSourceTaskSnapshot {
  const template = getCrawlerTaskTemplate('movie')
  return Object.freeze({
    ...template,
    movieId: input.movieId.trim(),
    movieRevision: input.movieRevision,
    operation: input.operation,
    policyVersion: input.policyVersion.trim(),
    reason: input.reason,
    sourceRevision: input.sourceRevision,
    templateKey: 'movie',
  })
}

function isVideoSourceOperation(value: unknown): value is VideoSourceTaskOperation {
  return value === 'check_video_source' || value === 'recheck_video_source' || value === 'repair_video_source'
}

function isVideoSourceReason(value: unknown): value is VideoSourceFindingReason {
  return typeof value === 'string' && [
    'no_source',
    'source_failed',
    'stale',
    'direct_blocked',
    'direct_transport_failed',
    'direct_content_invalid',
    'browser_inconclusive',
    'provider_unconfigured',
    'provider_failed',
    'metadata_unresolved',
    'no_peer',
    'stalled',
    'stream_missing',
    'stream_failed',
    'playback_unverified',
    'playback_failed',
  ].includes(value)
}

export function createCrawlerTaskSnapshot(templateKey: CrawlerTaskTemplateKey): CrawlerTaskSnapshot
export function createCrawlerTaskSnapshot(input: RepairPlayersSnapshotInput): RepairPlayersTaskSnapshot
export function createCrawlerTaskSnapshot(input: VideoSourceSnapshotInput): VideoSourceTaskSnapshot
export function createCrawlerTaskSnapshot(input: CrawlerTaskTemplateKey | RepairPlayersSnapshotInput | VideoSourceSnapshotInput): CrawlerTaskSnapshotUnion {
  if (typeof input === 'string')
    return ordinarySnapshot(input)

  if (isVideoSourceOperation(input.operation)) {
    const videoInput = input as VideoSourceSnapshotInput
    if (!validIdentifier(videoInput.movieId)
      || !validSourceRevision(videoInput.movieRevision)
      || !validSourceRevision(videoInput.sourceRevision)
      || !validPolicyVersion(videoInput.policyVersion)
      || !isVideoSourceReason(videoInput.reason)) {
      throw new Error('video source snapshot is invalid')
    }
    return videoSourceSnapshot(videoInput)
  }

  if (input.operation !== 'repair_players')
    throw new Error('repair snapshot requires repair_players operation')
  if (!validIdentifier(input.movieId))
    throw new Error('repair snapshot requires one movie id')
  if (input.reason !== 'no_source' && input.reason !== 'source_failed')
    throw new Error('repair snapshot reason is invalid')
  if (input.targetIntent !== 'restore_playable_sources')
    throw new Error('repair snapshot target intent is invalid')
  if (!validSourceRevision(input.sourceRevision))
    throw new Error('repair snapshot source revision is invalid')

  return repairPlayersSnapshot(input)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function readCrawlerTaskSnapshot(
  value: unknown,
  expectedOperation?: CrawlerTaskOperation,
): ReadCrawlerTaskSnapshotResult {
  // 25-01 operation snapshots wrap the immutable crawler template. Keep the
  // legacy flat snapshot reader as the single validation boundary.
  if (isRecord(value) && isRecord(value.template))
    value = value.template
  if (!isRecord(value) || !isCrawlerTaskTemplateKey(value.templateKey) || value.templateVersion !== 1)
    return { ok: false, reason: 'invalid_snapshot' }

  const template = getCrawlerTaskTemplate(value.templateKey)
  if (value.entrypoint !== template.entrypoint || value.permissionResource !== template.permissionResource)
    return { ok: false, reason: 'invalid_snapshot' }

  const operation = value.operation
  if (operation === undefined) {
    if (expectedOperation === 'repair_players')
      return { ok: false, reason: 'operation_missing' }
    if (expectedOperation && expectedOperation !== value.templateKey)
      return { ok: false, reason: 'operation_mismatch' }
    return {
      ok: true,
      operation: value.templateKey,
      snapshot: ordinarySnapshot(value.templateKey),
      template,
    }
  }

  if (!isCrawlerTaskOperation(operation))
    return { ok: false, reason: 'invalid_snapshot' }
  if (expectedOperation && operation !== expectedOperation)
    return { ok: false, reason: 'operation_mismatch' }

  if (operation === 'repair_players') {
    if (value.templateKey !== 'movie'
      || !validIdentifier(value.movieId)
      || (value.reason !== 'no_source' && value.reason !== 'source_failed')
      || value.targetIntent !== 'restore_playable_sources'
      || !validSourceRevision(value.sourceRevision)) {
      return { ok: false, reason: 'invalid_snapshot' }
    }

    return {
      ok: true,
      operation,
      snapshot: repairPlayersSnapshot({
        movieId: value.movieId,
        operation,
        reason: value.reason,
        sourceRevision: value.sourceRevision,
        targetIntent: 'restore_playable_sources',
      }),
      template,
    }
  }

  if (isVideoSourceOperation(operation)) {
    if (value.templateKey !== 'movie'
      || !validIdentifier(value.movieId)
      || !validSourceRevision(value.movieRevision)
      || !validSourceRevision(value.sourceRevision)
      || !validPolicyVersion(value.policyVersion)
      || !isVideoSourceReason(value.reason)) {
      return { ok: false, reason: 'invalid_snapshot' }
    }
    return {
      ok: true,
      operation,
      snapshot: videoSourceSnapshot({
        movieId: value.movieId,
        movieRevision: value.movieRevision,
        operation,
        policyVersion: value.policyVersion,
        reason: value.reason,
        sourceRevision: value.sourceRevision,
      }),
      template,
    }
  }

  if (operation !== value.templateKey)
    return { ok: false, reason: 'operation_mismatch' }

  return {
    ok: true,
    operation,
    snapshot: ordinarySnapshot(value.templateKey),
    template,
  }
}
