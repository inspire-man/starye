import type {
  ChapterPageFindingReason,
  ChapterPageTaskOperation,
  ComicChapterFindingReason,
  ComicChapterTaskOperation,
  CrawlerPermissionResource,
  CrawlerTaskOperation,
  CrawlerTaskSnapshotUnion,
  CrawlerTaskTemplate,
  CrawlerTaskTemplateKey,
  ProviderSnapshot,
  RepairPlayersReason,
  VideoSourceFindingReason,
  VideoSourceKind,
  VideoSourceTaskOperation,
} from './types'
import { createProviderSnapshot } from './provider-association'
import { createCrawlerTaskSnapshot, getCrawlerTaskTemplate, isChapterPageFinding, isChapterPageOperation, isComicChapterFinding, isComicChapterOperation, isCrawlerTaskOperation, readCrawlerTaskSnapshot } from './template-registry'

const MAX_ID_LENGTH = 128
const MAX_POLICY_LENGTH = 128
const MAX_REFERENCE_LENGTH = 256
const MAX_JSON_BYTES = 16 * 1024
const MAX_SELECTIONS = 200

export const CRAWLER_OPERATION_INTENT_VALUES = ['crawl', 'repair_players', 'check_video_source', 'recheck_video_source', 'repair_video_source', 'check_comic_chapters', 'recheck_comic_chapters', 'repair_comic_chapters', 'check_chapter_pages', 'recheck_chapter_pages', 'repair_chapter_pages'] as const
export type CrawlerOperationIntentKind = typeof CRAWLER_OPERATION_INTENT_VALUES[number]
export type CrawlerOperationTargetKind = 'movie' | 'manga'

export interface CrawlerOperationTarget {
  readonly kind: CrawlerOperationTargetKind
  readonly id: string
}

export interface CrawlerOperationIntent {
  readonly kind: CrawlerOperationIntentKind
  readonly chapterId?: string
  readonly chapterIds?: readonly string[]
  readonly chapterUrl?: string
  readonly comicId?: string
  readonly finding?: ComicChapterFindingReason | ChapterPageFindingReason
  readonly pageIdentities?: readonly string[]
  readonly pageNumbers?: readonly number[]
  readonly reason?: RepairPlayersReason | VideoSourceFindingReason
  readonly sourceKind?: VideoSourceKind
  readonly sourceRevision?: number
  readonly targetIntent?: 'restore_playable_sources'
  readonly movieRevision?: number
  readonly policyVersion?: string
}

export interface CrawlerOperationActor {
  readonly id: string
  readonly kind: 'admin' | 'system' | 'runner'
}

/** Closed input accepted from a caller. Provider routing and workflow controls are intentionally absent. */
export interface CrawlerOperationCommandInput {
  readonly actor: CrawlerOperationActor
  readonly idempotencyKey: string
  readonly intent: CrawlerOperationIntent
  readonly operation: CrawlerTaskOperation
  readonly policyReference: string
  readonly policyVersion: string
  readonly target: CrawlerOperationTarget
}

export interface CrawlerOperationDefinition {
  readonly operation: CrawlerTaskOperation
  readonly permissionResource: CrawlerPermissionResource
  readonly targetKind: CrawlerOperationTargetKind
  readonly template: CrawlerTaskTemplate
  readonly provider: ProviderSnapshot
}

export type CrawlerOperationRegistry = Readonly<Record<CrawlerTaskOperation, CrawlerOperationDefinition>>

export interface CrawlerOperationServerSnapshot {
  readonly operation: CrawlerTaskOperation
  readonly target: CrawlerOperationTarget
  readonly policyReference: string
  readonly policyVersion: string
  readonly intent: CrawlerOperationIntent
  readonly actor: CrawlerOperationActor
  readonly idempotencyKey: string
  readonly template: CrawlerTaskSnapshotUnion
  readonly provider: ProviderSnapshot
}

export interface CrawlerOperationSnapshot extends CrawlerOperationServerSnapshot {
  readonly fingerprint: string
  readonly requestSnapshotJson: string
}

const operationRegistry: CrawlerOperationRegistry = Object.freeze({
  manga: Object.freeze({
    operation: 'manga',
    permissionResource: 'comic',
    targetKind: 'manga',
    template: Object.freeze(getCrawlerTaskTemplate('manga')),
    provider: createProviderSnapshot('manga'),
  }),
  movie: Object.freeze({
    operation: 'movie',
    permissionResource: 'movie',
    targetKind: 'movie',
    template: Object.freeze(getCrawlerTaskTemplate('movie')),
    provider: createProviderSnapshot('movie'),
  }),
  repair_players: Object.freeze({
    operation: 'repair_players',
    permissionResource: 'movie',
    targetKind: 'movie',
    template: Object.freeze(getCrawlerTaskTemplate('movie')),
    provider: createProviderSnapshot('movie'),
  }),
  check_video_source: Object.freeze({
    operation: 'check_video_source',
    permissionResource: 'movie',
    targetKind: 'movie',
    template: Object.freeze(getCrawlerTaskTemplate('movie')),
    provider: createProviderSnapshot('movie'),
  }),
  recheck_video_source: Object.freeze({
    operation: 'recheck_video_source',
    permissionResource: 'movie',
    targetKind: 'movie',
    template: Object.freeze(getCrawlerTaskTemplate('movie')),
    provider: createProviderSnapshot('movie'),
  }),
  repair_video_source: Object.freeze({
    operation: 'repair_video_source',
    permissionResource: 'movie',
    targetKind: 'movie',
    template: Object.freeze(getCrawlerTaskTemplate('movie')),
    provider: createProviderSnapshot('movie'),
  }),
  check_comic_chapters: Object.freeze({
    operation: 'check_comic_chapters',
    permissionResource: 'comic',
    targetKind: 'manga',
    template: Object.freeze(getCrawlerTaskTemplate('manga')),
    provider: createProviderSnapshot('manga'),
  }),
  recheck_comic_chapters: Object.freeze({
    operation: 'recheck_comic_chapters',
    permissionResource: 'comic',
    targetKind: 'manga',
    template: Object.freeze(getCrawlerTaskTemplate('manga')),
    provider: createProviderSnapshot('manga'),
  }),
  repair_comic_chapters: Object.freeze({
    operation: 'repair_comic_chapters',
    permissionResource: 'comic',
    targetKind: 'manga',
    template: Object.freeze(getCrawlerTaskTemplate('manga')),
    provider: createProviderSnapshot('manga'),
  }),
  check_chapter_pages: Object.freeze({
    operation: 'check_chapter_pages',
    permissionResource: 'comic',
    targetKind: 'manga',
    template: Object.freeze(getCrawlerTaskTemplate('manga')),
    provider: createProviderSnapshot('manga'),
  }),
  recheck_chapter_pages: Object.freeze({
    operation: 'recheck_chapter_pages',
    permissionResource: 'comic',
    targetKind: 'manga',
    template: Object.freeze(getCrawlerTaskTemplate('manga')),
    provider: createProviderSnapshot('manga'),
  }),
  repair_chapter_pages: Object.freeze({
    operation: 'repair_chapter_pages',
    permissionResource: 'comic',
    targetKind: 'manga',
    template: Object.freeze(getCrawlerTaskTemplate('manga')),
    provider: createProviderSnapshot('manga'),
  }),
})

export const crawlerOperationRegistry: CrawlerOperationRegistry = operationRegistry

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

function isBoundedHttpUrl(value: unknown): value is string {
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

function isStringSelection(value: unknown): value is readonly string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= MAX_SELECTIONS
    && value.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= MAX_ID_LENGTH)
}

function isOptionalStringSelection(value: unknown): value is readonly string[] | undefined {
  return value === undefined || isStringSelection(value)
}

function isPageNumberSelection(value: unknown): value is readonly number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= MAX_SELECTIONS
    && value.every(item => typeof item === 'number' && Number.isSafeInteger(item) && item >= 1 && item <= 10_000)
}

function isOptionalPageNumberSelection(value: unknown): value is readonly number[] | undefined {
  return value === undefined || isPageNumberSelection(value)
}

function isComicOperation(value: unknown): value is ComicChapterTaskOperation {
  return isComicChapterOperation(value)
}

function isPageOperation(value: unknown): value is ChapterPageTaskOperation {
  return isChapterPageOperation(value)
}

function validComicIntent(operation: ComicChapterTaskOperation, value: Record<string, unknown>, policyVersion: unknown): boolean {
  if (Object.keys(value).some(key => !['chapterIds', 'chapterUrl', 'comicId', 'finding', 'kind', 'policyVersion', 'sourceRevision'].includes(key)))
    return false
  if (typeof value.comicId !== 'string' || value.comicId.trim().length === 0 || value.comicId.length > MAX_ID_LENGTH)
    return false
  if (!isComicChapterFinding(value.finding) || !isOptionalStringSelection(value.chapterIds))
    return false
  if (value.chapterUrl !== undefined && !isBoundedHttpUrl(value.chapterUrl))
    return false
  if (typeof value.policyVersion !== 'string' || value.policyVersion.trim() !== String(policyVersion).trim())
    return false
  if (typeof value.sourceRevision !== 'number' || !Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 0 || value.sourceRevision > 1_000_000)
    return false
  return operation !== 'repair_comic_chapters' || isStringSelection(value.chapterIds)
}

function validPageIntent(operation: ChapterPageTaskOperation, value: Record<string, unknown>, policyVersion: unknown): boolean {
  if (Object.keys(value).some(key => !['chapterId', 'chapterUrl', 'comicId', 'finding', 'kind', 'pageIdentities', 'pageNumbers', 'policyVersion', 'sourceRevision'].includes(key)))
    return false
  if (typeof value.comicId !== 'string' || value.comicId.trim().length === 0 || value.comicId.length > MAX_ID_LENGTH)
    return false
  if (typeof value.chapterId !== 'string' || value.chapterId.trim().length === 0 || value.chapterId.length > MAX_ID_LENGTH)
    return false
  if (!isChapterPageFinding(value.finding) || !isOptionalStringSelection(value.pageIdentities) || !isOptionalPageNumberSelection(value.pageNumbers))
    return false
  if (value.chapterUrl !== undefined && !isBoundedHttpUrl(value.chapterUrl))
    return false
  if (typeof value.policyVersion !== 'string' || value.policyVersion.trim() !== String(policyVersion).trim())
    return false
  if (typeof value.sourceRevision !== 'number' || !Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 0 || value.sourceRevision > 1_000_000)
    return false
  return operation !== 'repair_chapter_pages' || isStringSelection(value.pageIdentities) || isPageNumberSelection(value.pageNumbers)
}

function validVideoOperationReason(operation: VideoSourceTaskOperation, reason: VideoSourceFindingReason): boolean {
  switch (operation) {
    case 'check_video_source':
      return reason === 'stale' || reason === 'browser_inconclusive'
    case 'recheck_video_source':
      return reason === 'stale'
        || reason === 'direct_transport_failed'
        || reason === 'browser_inconclusive'
        || reason === 'metadata_unresolved'
        || reason === 'no_peer'
        || reason === 'stalled'
        || reason === 'stream_missing'
        || reason === 'stream_failed'
        || reason === 'playback_unverified'
        || reason === 'playback_failed'
    case 'repair_video_source':
      return reason === 'no_source'
        || reason === 'source_failed'
        || reason === 'direct_blocked'
        || reason === 'direct_content_invalid'
        || reason === 'provider_unconfigured'
        || reason === 'provider_failed'
  }
}

/** Reads the immutable server snapshot stored in a task without trusting provider fields from a runner. */
export function readCrawlerOperationServerSnapshot(value: unknown): CrawlerOperationServerSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.template) || !isRecord(value.target) || !isRecord(value.actor) || !isRecord(value.intent))
    return undefined
  if (!isCrawlerTaskOperation(value.operation)
    || typeof value.policyReference !== 'string'
    || value.policyReference.trim().length === 0
    || value.policyReference.length > MAX_REFERENCE_LENGTH
    || typeof value.policyVersion !== 'string'
    || value.policyVersion.trim().length === 0
    || value.policyVersion.length > MAX_POLICY_LENGTH
    || typeof value.idempotencyKey !== 'string'
    || value.idempotencyKey.trim().length === 0
    || value.idempotencyKey.length > MAX_ID_LENGTH
    || (value.actor.kind !== 'admin' && value.actor.kind !== 'system' && value.actor.kind !== 'runner')
    || typeof value.actor.id !== 'string'
    || value.actor.id.trim().length === 0
    || value.actor.id.length > MAX_ID_LENGTH
    || (value.target.kind !== 'movie' && value.target.kind !== 'manga')
    || typeof value.target.id !== 'string'
    || value.target.id.trim().length === 0
    || value.target.id.length > MAX_ID_LENGTH) {
    return undefined
  }
  const parsedTemplate = readCrawlerTaskSnapshot(value.template, value.operation)
  if (!parsedTemplate.ok)
    return undefined
  const definition = operationRegistry[value.operation]
  if (definition.targetKind !== value.target.kind)
    return undefined
  if (value.provider && typeof value.provider === 'object' && !Array.isArray(value.provider)) {
    const provider = value.provider as Record<string, unknown>
    if (provider.provider !== definition.provider.provider
      || provider.templateKey !== definition.provider.templateKey) {
      return undefined
    }
  }
  const intent = value.intent as Record<string, unknown>
  if (intent.kind === 'crawl') {
    if (Object.keys(intent).some(key => key !== 'kind'))
      return undefined
  }
  else if (intent.kind === 'repair_players') {
    if (intent.reason !== 'no_source' && intent.reason !== 'source_failed')
      return undefined
    if (intent.targetIntent !== 'restore_playable_sources'
      || typeof intent.sourceRevision !== 'number'
      || !Number.isSafeInteger(intent.sourceRevision)
      || intent.sourceRevision < 0
      || intent.sourceRevision > 1_000_000) {
      return undefined
    }
  }
  else if (isVideoSourceOperation(intent.kind)) {
    if (Object.keys(intent).some(key => !['kind', 'movieRevision', 'policyVersion', 'reason', 'sourceKind', 'sourceRevision'].includes(key))
      || !isVideoSourceReason(intent.reason)
      || (intent.sourceKind !== undefined && !isVideoSourceKind(intent.sourceKind))
      || !validVideoOperationReason(intent.kind, intent.reason)
      || typeof intent.movieRevision !== 'number'
      || !Number.isSafeInteger(intent.movieRevision)
      || intent.movieRevision < 0
      || intent.movieRevision > 1_000_000
      || typeof intent.sourceRevision !== 'number'
      || !Number.isSafeInteger(intent.sourceRevision)
      || intent.sourceRevision < 0
      || intent.sourceRevision > 1_000_000
      || typeof intent.policyVersion !== 'string'
      || intent.policyVersion.trim().length === 0
      || intent.policyVersion.length > MAX_POLICY_LENGTH
      || intent.policyVersion.trim() !== value.policyVersion.trim()) {
      return undefined
    }
  }
  else if (isComicOperation(intent.kind)) {
    if (definition.targetKind !== 'manga'
      || intent.comicId !== value.target.id
      || !validComicIntent(intent.kind, intent, value.policyVersion)) {
      return undefined
    }
  }
  else if (isPageOperation(intent.kind)) {
    if (definition.targetKind !== 'manga'
      || intent.comicId !== value.target.id
      || !validPageIntent(intent.kind, intent, value.policyVersion)) {
      return undefined
    }
  }
  else {
    return undefined
  }
  return deepFreeze({
    actor: { id: value.actor.id.trim(), kind: value.actor.kind },
    idempotencyKey: value.idempotencyKey.trim(),
    intent: intent.kind === 'repair_players'
      ? {
          kind: 'repair_players',
          reason: intent.reason,
          sourceRevision: intent.sourceRevision,
          targetIntent: 'restore_playable_sources',
        }
      : isVideoSourceOperation(intent.kind)
        ? {
            kind: intent.kind,
            movieRevision: intent.movieRevision as number,
            policyVersion: (intent.policyVersion as string).trim(),
            reason: intent.reason as VideoSourceFindingReason,
            ...(intent.sourceKind ? { sourceKind: intent.sourceKind } : {}),
            sourceRevision: intent.sourceRevision as number,
          }
        : isComicOperation(intent.kind)
          ? {
              kind: intent.kind,
              ...(intent.chapterIds ? { chapterIds: Object.freeze((intent.chapterIds as string[]).map(id => id.trim())) } : {}),
              ...(intent.chapterUrl ? { chapterUrl: (intent.chapterUrl as string).trim() } : {}),
              comicId: (intent.comicId as string).trim(),
              finding: intent.finding as ComicChapterFindingReason,
              policyVersion: (intent.policyVersion as string).trim(),
              sourceRevision: intent.sourceRevision as number,
            }
          : isPageOperation(intent.kind)
            ? {
                kind: intent.kind,
                ...(intent.chapterUrl ? { chapterUrl: (intent.chapterUrl as string).trim() } : {}),
                chapterId: (intent.chapterId as string).trim(),
                comicId: (intent.comicId as string).trim(),
                finding: intent.finding as ChapterPageFindingReason,
                ...(intent.pageIdentities ? { pageIdentities: Object.freeze((intent.pageIdentities as string[]).map(id => id.trim())) } : {}),
                ...(intent.pageNumbers ? { pageNumbers: Object.freeze([...(intent.pageNumbers as number[])]) } : {}),
                policyVersion: (intent.policyVersion as string).trim(),
                sourceRevision: intent.sourceRevision as number,
              }
            : { kind: 'crawl' },
    operation: value.operation,
    policyReference: value.policyReference.trim(),
    policyVersion: value.policyVersion.trim(),
    provider: definition.provider,
    target: { id: value.target.id.trim(), kind: value.target.kind },
    template: parsedTemplate.snapshot,
  }) as CrawlerOperationServerSnapshot
}

export type CrawlerOperationIdentityResult
  = | {
    readonly kind: 'new'
    readonly fingerprint: string
    readonly idempotencyKey: string
  }
  | {
    readonly kind: 'duplicate'
    readonly fingerprint: string
    readonly idempotencyKey: string
    readonly taskId: string
  }
  | {
    readonly kind: 'conflict'
    readonly existingFingerprint: string
    readonly fingerprint: string
    readonly idempotencyKey: string
    readonly taskId: string
  }

export interface CrawlerOperationExistingIdentity {
  readonly fingerprint: string
  readonly taskId: string
}

export interface CrawlerOperationIdentityInput {
  readonly candidate: Pick<CrawlerOperationSnapshot, 'fingerprint' | 'idempotencyKey'>
  readonly existing: CrawlerOperationExistingIdentity | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], code: string): void {
  if (Object.keys(value).some(key => !keys.includes(key)))
    throw new Error(code)
}

function boundedString(value: unknown, max: number, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max)
    throw new Error(code)
  return value.trim()
}

function boundedRevision(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000)
    throw new Error(code)
  return value
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value
  for (const child of Object.values(value as Record<string, unknown>))
    deepFreeze(child)
  return Object.freeze(value)
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    )
  }
  return value
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

function fingerprintJson(value: string): string {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function parseCommand(value: unknown): CrawlerOperationCommandInput {
  if (!isRecord(value))
    throw new Error('crawler_operation_command_invalid')
  exactKeys(value, ['actor', 'idempotencyKey', 'intent', 'operation', 'policyReference', 'policyVersion', 'target'], 'crawler_operation_command_unknown_field')
  if (!isCrawlerTaskOperation(value.operation))
    throw new Error('crawler_operation_unknown')

  if (!isRecord(value.actor))
    throw new Error('crawler_operation_actor_invalid')
  exactKeys(value.actor, ['id', 'kind'], 'crawler_operation_actor_unknown_field')
  const actorKind = value.actor.kind
  if (actorKind !== 'admin' && actorKind !== 'system' && actorKind !== 'runner')
    throw new Error('crawler_operation_actor_invalid')

  if (!isRecord(value.target))
    throw new Error('crawler_operation_target_invalid')
  exactKeys(value.target, ['id', 'kind'], 'crawler_operation_target_unknown_field')
  const targetKind = value.target.kind
  if (targetKind !== 'movie' && targetKind !== 'manga')
    throw new Error('crawler_operation_target_invalid')

  if (!isRecord(value.intent))
    throw new Error('crawler_operation_intent_invalid')
  const intentKind = value.intent.kind
  if (intentKind === 'crawl') {
    exactKeys(value.intent, ['kind'], 'crawler_operation_intent_unknown_field')
  }
  else if (intentKind === 'repair_players') {
    exactKeys(value.intent, ['kind', 'reason', 'sourceRevision', 'targetIntent'], 'crawler_operation_intent_unknown_field')
    if (value.intent.reason !== 'no_source' && value.intent.reason !== 'source_failed')
      throw new Error('crawler_operation_intent_invalid')
    if (value.intent.targetIntent !== 'restore_playable_sources')
      throw new Error('crawler_operation_intent_invalid')
    boundedRevision(value.intent.sourceRevision, 'crawler_operation_intent_invalid')
  }
  else if (isVideoSourceOperation(intentKind)) {
    exactKeys(value.intent, ['kind', 'movieRevision', 'policyVersion', 'reason', 'sourceKind', 'sourceRevision'], 'crawler_operation_intent_unknown_field')
    if (!isVideoSourceReason(value.intent.reason)
      || (value.intent.sourceKind !== undefined && !isVideoSourceKind(value.intent.sourceKind))
      || !validVideoOperationReason(intentKind, value.intent.reason)) {
      throw new Error('crawler_operation_intent_invalid')
    }
    boundedRevision(value.intent.movieRevision, 'crawler_operation_intent_invalid')
    boundedRevision(value.intent.sourceRevision, 'crawler_operation_intent_invalid')
    if (boundedString(value.intent.policyVersion, MAX_POLICY_LENGTH, 'crawler_operation_intent_invalid')
      !== boundedString(value.policyVersion, MAX_POLICY_LENGTH, 'crawler_operation_policy_invalid')) {
      throw new Error('crawler_operation_intent_invalid')
    }
  }
  else if (isComicOperation(intentKind)) {
    exactKeys(value.intent, ['chapterIds', 'chapterUrl', 'comicId', 'finding', 'kind', 'policyVersion', 'sourceRevision'], 'crawler_operation_intent_unknown_field')
    if (!validComicIntent(intentKind, value.intent, value.policyVersion))
      throw new Error('crawler_operation_intent_invalid')
  }
  else if (isPageOperation(intentKind)) {
    exactKeys(value.intent, ['chapterId', 'chapterUrl', 'comicId', 'finding', 'kind', 'pageIdentities', 'pageNumbers', 'policyVersion', 'sourceRevision'], 'crawler_operation_intent_unknown_field')
    if (!validPageIntent(intentKind, value.intent, value.policyVersion))
      throw new Error('crawler_operation_intent_invalid')
  }
  else {
    throw new Error('crawler_operation_intent_invalid')
  }

  const command: CrawlerOperationCommandInput = {
    actor: {
      id: boundedString(value.actor.id, MAX_ID_LENGTH, 'crawler_operation_actor_invalid'),
      kind: actorKind,
    },
    idempotencyKey: boundedString(value.idempotencyKey, MAX_ID_LENGTH, 'crawler_operation_idempotency_invalid'),
    intent: intentKind === 'crawl'
      ? { kind: 'crawl' }
      : intentKind === 'repair_players'
        ? {
            kind: 'repair_players',
            reason: value.intent.reason as RepairPlayersReason,
            sourceRevision: boundedRevision(value.intent.sourceRevision, 'crawler_operation_intent_invalid'),
            targetIntent: 'restore_playable_sources',
          }
        : isVideoSourceOperation(intentKind)
          ? {
              kind: intentKind,
              movieRevision: boundedRevision(value.intent.movieRevision, 'crawler_operation_intent_invalid'),
              policyVersion: boundedString(value.intent.policyVersion, MAX_POLICY_LENGTH, 'crawler_operation_intent_invalid'),
              reason: value.intent.reason as VideoSourceFindingReason,
              ...(value.intent.sourceKind ? { sourceKind: value.intent.sourceKind as VideoSourceKind } : {}),
              sourceRevision: boundedRevision(value.intent.sourceRevision, 'crawler_operation_intent_invalid'),
            }
          : isComicOperation(intentKind)
            ? {
                kind: intentKind,
                ...(value.intent.chapterIds ? { chapterIds: [...value.intent.chapterIds as string[]].map(id => id.trim()) } : {}),
                ...(value.intent.chapterUrl ? { chapterUrl: boundedString(value.intent.chapterUrl, 1024, 'crawler_operation_intent_invalid') } : {}),
                comicId: boundedString(value.intent.comicId, MAX_ID_LENGTH, 'crawler_operation_intent_invalid'),
                finding: value.intent.finding as ComicChapterFindingReason,
                policyVersion: boundedString(value.intent.policyVersion, MAX_POLICY_LENGTH, 'crawler_operation_intent_invalid'),
                sourceRevision: boundedRevision(value.intent.sourceRevision, 'crawler_operation_intent_invalid'),
              }
            : {
                kind: intentKind as ChapterPageTaskOperation,
                ...(value.intent.chapterUrl ? { chapterUrl: boundedString(value.intent.chapterUrl, 1024, 'crawler_operation_intent_invalid') } : {}),
                chapterId: boundedString(value.intent.chapterId, MAX_ID_LENGTH, 'crawler_operation_intent_invalid'),
                comicId: boundedString(value.intent.comicId, MAX_ID_LENGTH, 'crawler_operation_intent_invalid'),
                finding: value.intent.finding as ChapterPageFindingReason,
                ...(value.intent.pageIdentities ? { pageIdentities: [...value.intent.pageIdentities as string[]].map(id => id.trim()) } : {}),
                ...(value.intent.pageNumbers ? { pageNumbers: [...value.intent.pageNumbers as number[]] } : {}),
                policyVersion: boundedString(value.intent.policyVersion, MAX_POLICY_LENGTH, 'crawler_operation_intent_invalid'),
                sourceRevision: boundedRevision(value.intent.sourceRevision, 'crawler_operation_intent_invalid'),
              },
    operation: value.operation,
    policyReference: boundedString(value.policyReference, MAX_REFERENCE_LENGTH, 'crawler_operation_policy_invalid'),
    policyVersion: boundedString(value.policyVersion, MAX_POLICY_LENGTH, 'crawler_operation_policy_invalid'),
    target: {
      id: boundedString(value.target.id, MAX_ID_LENGTH, 'crawler_operation_target_invalid'),
      kind: targetKind,
    },
  }

  const definition = operationRegistry[command.operation]
  if (definition.targetKind !== command.target.kind)
    throw new Error('crawler_operation_target_mismatch')
  if (command.operation === 'repair_players' && command.intent.kind !== 'repair_players')
    throw new Error('crawler_operation_intent_mismatch')
  if (isVideoSourceOperation(command.operation) && command.intent.kind !== command.operation)
    throw new Error('crawler_operation_intent_mismatch')
  if ((isComicOperation(command.operation) || isPageOperation(command.operation)) && command.intent.kind !== command.operation)
    throw new Error('crawler_operation_intent_mismatch')
  if ((isComicOperation(command.operation) || isPageOperation(command.operation)) && command.intent.comicId !== command.target.id)
    throw new Error('crawler_operation_target_mismatch')
  if (command.operation !== 'repair_players'
    && !isVideoSourceOperation(command.operation)
    && !isComicOperation(command.operation)
    && !isPageOperation(command.operation)
    && command.intent.kind !== 'crawl') {
    throw new Error('crawler_operation_intent_mismatch')
  }
  return deepFreeze(command)
}

export function canonicalizeOperationCommand(value: unknown): CrawlerOperationCommandInput {
  return parseCommand(deepClone(value))
}

export function fingerprintOperationCommand(value: unknown): string {
  const command = canonicalizeOperationCommand(value)
  return fingerprintJson(stableJson(command))
}

export function buildCrawlerOperationSnapshot(value: unknown): CrawlerOperationSnapshot {
  const command = canonicalizeOperationCommand(value)
  const definition = operationRegistry[command.operation]
  const template = command.operation === 'repair_players'
    ? createCrawlerTaskSnapshot({
        movieId: command.target.id,
        operation: 'repair_players',
        reason: command.intent.reason as RepairPlayersReason,
        sourceRevision: command.intent.sourceRevision!,
        targetIntent: 'restore_playable_sources',
      })
    : isVideoSourceOperation(command.operation)
      ? createCrawlerTaskSnapshot({
          movieId: command.target.id,
          movieRevision: command.intent.movieRevision!,
          operation: command.operation,
          policyVersion: command.intent.policyVersion!,
          reason: command.intent.reason as VideoSourceFindingReason,
          ...(command.intent.sourceKind ? { sourceKind: command.intent.sourceKind } : {}),
          sourceRevision: command.intent.sourceRevision!,
        })
      : isComicOperation(command.operation)
        ? createCrawlerTaskSnapshot({
            chapterIds: command.intent.chapterIds,
            chapterUrl: command.intent.chapterUrl,
            comicId: command.target.id,
            finding: command.intent.finding as ComicChapterFindingReason,
            operation: command.operation,
            policyVersion: command.intent.policyVersion!,
            sourceRevision: command.intent.sourceRevision!,
          })
        : isPageOperation(command.operation)
          ? createCrawlerTaskSnapshot({
              chapterId: command.intent.chapterId!,
              chapterUrl: command.intent.chapterUrl,
              comicId: command.target.id,
              finding: command.intent.finding as ChapterPageFindingReason,
              operation: command.operation,
              pageIdentities: command.intent.pageIdentities,
              pageNumbers: command.intent.pageNumbers,
              policyVersion: command.intent.policyVersion!,
              sourceRevision: command.intent.sourceRevision!,
            })
          : createCrawlerTaskSnapshot(command.operation as CrawlerTaskTemplateKey)
  const serverSnapshot: CrawlerOperationServerSnapshot = {
    actor: command.actor,
    idempotencyKey: command.idempotencyKey,
    intent: command.intent,
    operation: command.operation,
    policyReference: command.policyReference,
    policyVersion: command.policyVersion,
    provider: definition.provider,
    target: command.target,
    template,
  }
  const fingerprint = fingerprintJson(stableJson(command))
  const requestSnapshotJson = stableJson(serverSnapshot)
  if (new TextEncoder().encode(requestSnapshotJson).byteLength > MAX_JSON_BYTES)
    throw new Error('crawler_operation_snapshot_too_large')
  return deepFreeze({
    ...serverSnapshot,
    fingerprint,
    requestSnapshotJson,
  })
}

export function classifyIdempotentOperation(input: CrawlerOperationIdentityInput): CrawlerOperationIdentityResult {
  const candidateKey = boundedString(input.candidate.idempotencyKey, MAX_ID_LENGTH, 'crawler_operation_idempotency_invalid')
  const candidateFingerprint = boundedString(input.candidate.fingerprint, MAX_ID_LENGTH, 'crawler_operation_fingerprint_invalid')
  if (!input.existing) {
    return { kind: 'new', fingerprint: candidateFingerprint, idempotencyKey: candidateKey }
  }
  const taskId = boundedString(input.existing.taskId, MAX_ID_LENGTH, 'crawler_operation_task_invalid')
  if (input.existing.fingerprint === candidateFingerprint)
    return { kind: 'duplicate', fingerprint: candidateFingerprint, idempotencyKey: candidateKey, taskId }
  return {
    existingFingerprint: boundedString(input.existing.fingerprint, MAX_ID_LENGTH, 'crawler_operation_fingerprint_invalid'),
    fingerprint: candidateFingerprint,
    idempotencyKey: candidateKey,
    kind: 'conflict',
    taskId,
  }
}
