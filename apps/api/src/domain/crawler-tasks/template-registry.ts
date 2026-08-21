import type {
  ChapterPageFindingReason,
  ChapterPageTaskOperation,
  ChapterPageTaskSnapshot,
  ComicChapterFindingReason,
  ComicChapterTaskOperation,
  ComicChapterTaskSnapshot,
  CrawlerTaskOperation,
  CrawlerTaskSnapshot,
  CrawlerTaskSnapshotUnion,
  CrawlerTaskTemplate,
  CrawlerTaskTemplateKey,
  RepairPlayersReason,
  RepairPlayersTargetIntent,
  RepairPlayersTaskSnapshot,
  VideoSourceFindingReason,
  VideoSourceKind,
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

const comicChapterOperations = ['check_comic_chapters', 'recheck_comic_chapters', 'repair_comic_chapters'] as const
const chapterPageOperations = ['check_chapter_pages', 'recheck_chapter_pages', 'repair_chapter_pages'] as const
const comicChapterFindings = ['missing', 'duplicate', 'extra', 'order', 'sequence_gap', 'source_unavailable', 'source_partial', 'source_inconclusive'] as const
const chapterPageFindings = ['missing_page', 'duplicate_page_number', 'page_order', 'url_invalid', 'http_failure', 'redirect', 'challenge_html', 'content_type_invalid', 'content_type_missing', 'timeout', 'probe_failed', 'unknown'] as const
const MAX_SELECTIONS = 200

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
  readonly sourceKind?: VideoSourceKind
  readonly sourceRevision: number
}

export interface ComicChapterSnapshotInput {
  readonly chapterIds?: readonly string[]
  readonly chapterUrl?: string
  readonly comicId: string
  readonly finding: ComicChapterFindingReason
  readonly operation: ComicChapterTaskOperation
  readonly policyVersion: string
  readonly sourceRevision: number
}

export interface ChapterPageSnapshotInput {
  readonly chapterId: string
  readonly chapterUrl?: string
  readonly comicId: string
  readonly finding: ChapterPageFindingReason
  readonly operation: ChapterPageTaskOperation
  readonly pageIdentities?: readonly string[]
  readonly pageNumbers?: readonly number[]
  readonly policyVersion: string
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

export function isComicChapterOperation(value: unknown): value is ComicChapterTaskOperation {
  return (comicChapterOperations as readonly string[]).includes(value as string)
}

export function isChapterPageOperation(value: unknown): value is ChapterPageTaskOperation {
  return (chapterPageOperations as readonly string[]).includes(value as string)
}

export function isComicChapterFinding(value: unknown): value is ComicChapterFindingReason {
  return (comicChapterFindings as readonly string[]).includes(value as string)
}

export function isChapterPageFinding(value: unknown): value is ChapterPageFindingReason {
  return (chapterPageFindings as readonly string[]).includes(value as string)
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

function validHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 1024)
    return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password && !url.hash
  }
  catch {
    return false
  }
}

function validStringSelection(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_SELECTIONS && value.every(item => validIdentifier(item))
}

function validOptionalStringSelection(value: unknown): value is readonly string[] | undefined {
  return value === undefined || validStringSelection(value)
}

function validPageNumberSelection(value: unknown): value is readonly number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= MAX_SELECTIONS
    && value.every(item => typeof item === 'number' && Number.isSafeInteger(item) && item >= 1 && item <= 10_000)
}

function validOptionalPageNumberSelection(value: unknown): value is readonly number[] | undefined {
  return value === undefined || validPageNumberSelection(value)
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
    ...(input.sourceKind ? { sourceKind: input.sourceKind } : {}),
    sourceRevision: input.sourceRevision,
    templateKey: 'movie',
  })
}

function comicChapterSnapshot(input: ComicChapterSnapshotInput): ComicChapterTaskSnapshot {
  const template = getCrawlerTaskTemplate('manga')
  return Object.freeze({
    ...template,
    comicId: input.comicId.trim(),
    ...(input.chapterIds ? { chapterIds: Object.freeze([...input.chapterIds].map(id => id.trim())) } : {}),
    ...(input.chapterUrl ? { chapterUrl: input.chapterUrl.trim() } : {}),
    finding: input.finding,
    operation: input.operation,
    policyVersion: input.policyVersion.trim(),
    sourceRevision: input.sourceRevision,
    templateKey: 'manga',
  })
}

function chapterPageSnapshot(input: ChapterPageSnapshotInput): ChapterPageTaskSnapshot {
  const template = getCrawlerTaskTemplate('manga')
  return Object.freeze({
    ...template,
    chapterId: input.chapterId.trim(),
    ...(input.chapterUrl ? { chapterUrl: input.chapterUrl.trim() } : {}),
    comicId: input.comicId.trim(),
    finding: input.finding,
    operation: input.operation,
    ...(input.pageIdentities ? { pageIdentities: Object.freeze([...input.pageIdentities].map(identity => identity.trim())) } : {}),
    ...(input.pageNumbers ? { pageNumbers: Object.freeze([...input.pageNumbers]) } : {}),
    policyVersion: input.policyVersion.trim(),
    sourceRevision: input.sourceRevision,
    templateKey: 'manga',
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

function isVideoSourceKind(value: unknown): value is VideoSourceKind {
  return value === 'direct' || value === 'magnet'
}

export function createCrawlerTaskSnapshot(templateKey: CrawlerTaskTemplateKey): CrawlerTaskSnapshot
export function createCrawlerTaskSnapshot(input: RepairPlayersSnapshotInput): RepairPlayersTaskSnapshot
export function createCrawlerTaskSnapshot(input: VideoSourceSnapshotInput): VideoSourceTaskSnapshot
export function createCrawlerTaskSnapshot(input: ComicChapterSnapshotInput): ComicChapterTaskSnapshot
export function createCrawlerTaskSnapshot(input: ChapterPageSnapshotInput): ChapterPageTaskSnapshot
export function createCrawlerTaskSnapshot(input: CrawlerTaskTemplateKey | RepairPlayersSnapshotInput | VideoSourceSnapshotInput | ComicChapterSnapshotInput | ChapterPageSnapshotInput): CrawlerTaskSnapshotUnion {
  if (typeof input === 'string')
    return ordinarySnapshot(input)

  if (isVideoSourceOperation(input.operation)) {
    const videoInput = input as VideoSourceSnapshotInput
    if (!validIdentifier(videoInput.movieId) || !validSourceRevision(videoInput.movieRevision) || !validSourceRevision(videoInput.sourceRevision) || !validPolicyVersion(videoInput.policyVersion) || !isVideoSourceReason(videoInput.reason) || (videoInput.sourceKind !== undefined && !isVideoSourceKind(videoInput.sourceKind)))
      throw new Error('video source snapshot is invalid')
    return videoSourceSnapshot(videoInput)
  }

  if (isComicChapterOperation(input.operation)) {
    const comicInput = input as ComicChapterSnapshotInput
    if (!validIdentifier(comicInput.comicId) || !validSourceRevision(comicInput.sourceRevision) || !validPolicyVersion(comicInput.policyVersion) || !isComicChapterFinding(comicInput.finding) || !validOptionalStringSelection(comicInput.chapterIds) || (comicInput.chapterUrl !== undefined && !validHttpUrl(comicInput.chapterUrl)) || (comicInput.operation === 'repair_comic_chapters' && !comicInput.chapterIds?.length))
      throw new Error('comic chapter snapshot is invalid')
    return comicChapterSnapshot(comicInput)
  }

  if (isChapterPageOperation(input.operation)) {
    const pageInput = input as ChapterPageSnapshotInput
    if (!validIdentifier(pageInput.comicId) || !validIdentifier(pageInput.chapterId) || !validSourceRevision(pageInput.sourceRevision) || !validPolicyVersion(pageInput.policyVersion) || !isChapterPageFinding(pageInput.finding) || !validOptionalStringSelection(pageInput.pageIdentities) || !validOptionalPageNumberSelection(pageInput.pageNumbers) || (pageInput.chapterUrl !== undefined && !validHttpUrl(pageInput.chapterUrl)) || (pageInput.operation === 'repair_chapter_pages' && !pageInput.pageIdentities?.length && !pageInput.pageNumbers?.length))
      throw new Error('chapter page snapshot is invalid')
    return chapterPageSnapshot(pageInput)
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

export function readCrawlerTaskSnapshot(value: unknown, expectedOperation?: CrawlerTaskOperation): ReadCrawlerTaskSnapshotResult {
  if (isRecord(value) && isRecord(value.template))
    value = value.template
  if (!isRecord(value) || !isCrawlerTaskTemplateKey(value.templateKey) || value.templateVersion !== 1)
    return { ok: false, reason: 'invalid_snapshot' }

  const template = getCrawlerTaskTemplate(value.templateKey)
  if (value.entrypoint !== template.entrypoint || value.permissionResource !== template.permissionResource)
    return { ok: false, reason: 'invalid_snapshot' }

  const operation = value.operation
  if (operation === undefined) {
    if (expectedOperation === 'repair_players' || (expectedOperation && expectedOperation !== value.templateKey))
      return { ok: false, reason: expectedOperation === 'repair_players' ? 'operation_missing' : 'operation_mismatch' }
    return { ok: true, operation: value.templateKey, snapshot: ordinarySnapshot(value.templateKey), template }
  }
  if (!isCrawlerTaskOperation(operation))
    return { ok: false, reason: 'invalid_snapshot' }
  if (expectedOperation && operation !== expectedOperation)
    return { ok: false, reason: 'operation_mismatch' }

  if (operation === 'repair_players') {
    if (value.templateKey !== 'movie' || !validIdentifier(value.movieId) || (value.reason !== 'no_source' && value.reason !== 'source_failed') || value.targetIntent !== 'restore_playable_sources' || !validSourceRevision(value.sourceRevision))
      return { ok: false, reason: 'invalid_snapshot' }
    return { ok: true, operation, snapshot: repairPlayersSnapshot({ movieId: value.movieId, operation, reason: value.reason, sourceRevision: value.sourceRevision, targetIntent: 'restore_playable_sources' }), template }
  }

  if (isVideoSourceOperation(operation)) {
    if (value.templateKey !== 'movie' || !validIdentifier(value.movieId) || !validSourceRevision(value.movieRevision) || !validSourceRevision(value.sourceRevision) || !validPolicyVersion(value.policyVersion) || !isVideoSourceReason(value.reason) || (value.sourceKind !== undefined && !isVideoSourceKind(value.sourceKind)))
      return { ok: false, reason: 'invalid_snapshot' }
    return { ok: true, operation, snapshot: videoSourceSnapshot({ movieId: value.movieId, movieRevision: value.movieRevision, operation, policyVersion: value.policyVersion, reason: value.reason, ...(value.sourceKind ? { sourceKind: value.sourceKind } : {}), sourceRevision: value.sourceRevision }), template }
  }

  if (isComicChapterOperation(operation)) {
    if (value.templateKey !== 'manga' || !validIdentifier(value.comicId) || !validSourceRevision(value.sourceRevision) || !validPolicyVersion(value.policyVersion) || !isComicChapterFinding(value.finding) || !validOptionalStringSelection(value.chapterIds) || (value.chapterUrl !== undefined && !validHttpUrl(value.chapterUrl)) || (operation === 'repair_comic_chapters' && !value.chapterIds))
      return { ok: false, reason: 'invalid_snapshot' }
    return { ok: true, operation, snapshot: comicChapterSnapshot({ comicId: value.comicId, ...(value.chapterIds ? { chapterIds: value.chapterIds } : {}), ...(value.chapterUrl ? { chapterUrl: value.chapterUrl } : {}), finding: value.finding, operation, policyVersion: value.policyVersion, sourceRevision: value.sourceRevision }), template }
  }

  if (isChapterPageOperation(operation)) {
    if (value.templateKey !== 'manga' || !validIdentifier(value.comicId) || !validIdentifier(value.chapterId) || !validSourceRevision(value.sourceRevision) || !validPolicyVersion(value.policyVersion) || !isChapterPageFinding(value.finding) || !validOptionalStringSelection(value.pageIdentities) || !validOptionalPageNumberSelection(value.pageNumbers) || (value.chapterUrl !== undefined && !validHttpUrl(value.chapterUrl)) || (operation === 'repair_chapter_pages' && !value.pageIdentities && !value.pageNumbers))
      return { ok: false, reason: 'invalid_snapshot' }
    return { ok: true, operation, snapshot: chapterPageSnapshot({ chapterId: value.chapterId, ...(value.chapterUrl ? { chapterUrl: value.chapterUrl } : {}), comicId: value.comicId, finding: value.finding, operation, ...(value.pageIdentities ? { pageIdentities: value.pageIdentities } : {}), ...(value.pageNumbers ? { pageNumbers: value.pageNumbers } : {}), policyVersion: value.policyVersion, sourceRevision: value.sourceRevision }), template }
  }

  if (operation !== value.templateKey)
    return { ok: false, reason: 'operation_mismatch' }
  return { ok: true, operation, snapshot: ordinarySnapshot(value.templateKey), template }
}
