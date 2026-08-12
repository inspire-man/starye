import type {
  CrawlerPermissionResource,
  CrawlerTaskOperation,
  CrawlerTaskSnapshotUnion,
  CrawlerTaskTemplate,
  CrawlerTaskTemplateKey,
  ProviderSnapshot,
  RepairPlayersReason,
} from './types'
import { createProviderSnapshot } from './provider-association'
import { createCrawlerTaskSnapshot, getCrawlerTaskTemplate, isCrawlerTaskOperation, readCrawlerTaskSnapshot } from './template-registry'

const MAX_ID_LENGTH = 128
const MAX_POLICY_LENGTH = 128
const MAX_REFERENCE_LENGTH = 256
const MAX_JSON_BYTES = 16 * 1024

export const CRAWLER_OPERATION_INTENT_VALUES = ['crawl', 'repair_players'] as const
export type CrawlerOperationIntentKind = typeof CRAWLER_OPERATION_INTENT_VALUES[number]
export type CrawlerOperationTargetKind = 'movie' | 'manga'

export interface CrawlerOperationTarget {
  readonly kind: CrawlerOperationTargetKind
  readonly id: string
}

export interface CrawlerOperationIntent {
  readonly kind: CrawlerOperationIntentKind
  readonly reason?: RepairPlayersReason
  readonly sourceRevision?: number
  readonly targetIntent?: 'restore_playable_sources'
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
})

export const crawlerOperationRegistry: CrawlerOperationRegistry = operationRegistry

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
      : {
          kind: 'repair_players',
          reason: value.intent.reason as RepairPlayersReason,
          sourceRevision: boundedRevision(value.intent.sourceRevision, 'crawler_operation_intent_invalid'),
          targetIntent: 'restore_playable_sources',
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
  if (command.operation !== 'repair_players' && command.intent.kind !== 'crawl')
    throw new Error('crawler_operation_intent_mismatch')
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
        reason: command.intent.reason!,
        sourceRevision: command.intent.sourceRevision!,
        targetIntent: 'restore_playable_sources',
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
