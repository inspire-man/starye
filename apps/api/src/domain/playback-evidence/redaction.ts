import type {
  PlaybackArtifactReference,
  PlaybackEventObservation,
  PlaybackEvidenceSummary,
  PlaybackEvidenceTuple,
  PlaybackProgressSamples,
} from './types'

import * as v from 'valibot'
import { PlaybackEvidenceSummarySchema } from '../../schemas/playback-evidence'

const FORBIDDEN_KEY_PARTS = [
  'authorization',
  'cookie',
  'exception',
  'html',
  'media',
  'network',
  'nonce',
  'password',
  'runner',
  'secret',
  'session',
  'signature',
  'token',
  'workflow',
  'command',
  'sourceurl',
  'mediaurl',
] as const

const FORBIDDEN_VALUE_PATTERNS = [
  /https?:\/\//iu,
  /magnet:\?/iu,
  /(?:bearer|basic)\s+[\w+/=-]+/iu,
  /(?:authorization|cookie|session|nonce|signature|token|secret)\s*[:=]/iu,
  /<\/?(?:html|script|video|audio|body)\b/iu,
  /(?:stack trace|exception|network log|runner payload)/iu,
] as const

export interface RedactedPlaybackEvidence extends PlaybackEvidenceSummary {}

export interface PlaybackEvidencePair {
  readonly json: string
  readonly markdown: string
  readonly value: RedactedPlaybackEvidence
}

export type PlaybackEvidenceRedactionResult
  = | { readonly ok: true, readonly value: RedactedPlaybackEvidence }
    | { readonly ok: false, readonly outcome: 'checkpoint', readonly reason: string }

export class PlaybackEvidenceRedactionError extends Error {
  readonly outcome = 'checkpoint' as const

  constructor(message: string) {
    super(message)
    this.name = 'PlaybackEvidenceRedactionError'
  }
}

function forbiddenKey(key: string): boolean {
  const normalized = key.replaceAll('_', '').replaceAll('-', '').toLowerCase()
  return FORBIDDEN_KEY_PARTS.some(part => normalized.includes(part))
}

function forbiddenValue(value: string): boolean {
  return FORBIDDEN_VALUE_PATTERNS.some(pattern => pattern.test(value))
}

function scanMaterial(value: unknown, path = '$'): string | undefined {
  if (typeof value === 'string') {
    return forbiddenValue(value) ? `${path} contains forbidden material` : undefined
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const result = scanMaterial(item, `${path}[${index}]`)
      if (result)
        return result
    }
    return undefined
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKey(key))
        return `${path}.${key} is forbidden`
      const result = scanMaterial(item, `${path}.${key}`)
      if (result)
        return result
    }
  }

  return undefined
}

/** Scans untrusted evidence before any allowlist projection or serialization. */
export function findForbiddenPlaybackEvidenceMaterial(value: unknown): string | undefined {
  return scanMaterial(value)
}

export function isSafePlaybackEvidence(value: unknown): value is PlaybackEvidenceSummary {
  return findForbiddenPlaybackEvidenceMaterial(value) === undefined
}

function copyTuple(tuple: PlaybackEvidenceTuple): PlaybackEvidenceTuple {
  return {
    attemptNumber: tuple.attemptNumber,
    provider: tuple.provider,
    runId: tuple.runId,
    taskId: tuple.taskId,
  }
}

function copyEvents(events: readonly PlaybackEventObservation[]): readonly PlaybackEventObservation[] {
  return events.map(event => ({
    event: event.event,
    observed: event.observed,
    observedAt: event.observedAt,
  }))
}

function copyProgress(progress: PlaybackProgressSamples): PlaybackProgressSamples {
  return {
    currentTimeAfter: progress.currentTimeAfter,
    currentTimeBefore: progress.currentTimeBefore,
    currentTimeDelta: progress.currentTimeDelta,
  }
}

function copyArtifact(artifact: PlaybackArtifactReference): PlaybackArtifactReference {
  return {
    hash: artifact.hash,
    reference: artifact.reference,
    stem: artifact.stem,
  }
}

/** Builds the only object allowed to cross the artifact/D1 evidence boundary. */
export function buildRedactedPlaybackEvidence(input: PlaybackEvidenceSummary): RedactedPlaybackEvidence {
  const parsed = v.safeParse(PlaybackEvidenceSummarySchema, input)
  if (!parsed.success)
    throw new PlaybackEvidenceRedactionError('playback evidence schema rejected input')

  const forbidden = findForbiddenPlaybackEvidenceMaterial(input)
  if (forbidden)
    throw new PlaybackEvidenceRedactionError(forbidden)

  return {
    artifact: copyArtifact(parsed.output.artifact),
    contentId: parsed.output.contentId,
    events: copyEvents(parsed.output.events),
    observedAt: parsed.output.observedAt,
    outcome: parsed.output.outcome,
    playback: {
      canplay: parsed.output.playback.canplay,
      error: parsed.output.playback.error,
      playing: parsed.output.playback.playing,
      progress: copyProgress(parsed.output.playback.progress),
      status: parsed.output.playback.status,
    },
    provider: {
      provider: parsed.output.provider.provider,
      status: parsed.output.provider.status,
    },
    repair: {
      sourceRevision: parsed.output.repair.sourceRevision,
      status: parsed.output.repair.status,
    },
    schemaVersion: parsed.output.schemaVersion,
    source: {
      revision: parsed.output.source.revision,
      sourceType: parsed.output.source.sourceType,
      status: parsed.output.source.status,
    },
    sourceRevision: parsed.output.sourceRevision,
    tuple: copyTuple(parsed.output.tuple),
    viewer: {
      path: parsed.output.viewer.path,
      targetLabel: parsed.output.viewer.targetLabel,
    },
  }
}

export function tryBuildRedactedPlaybackEvidence(input: unknown): PlaybackEvidenceRedactionResult {
  try {
    return { ok: true, value: buildRedactedPlaybackEvidence(input as PlaybackEvidenceSummary) }
  }
  catch (error) {
    return {
      ok: false,
      outcome: 'checkpoint',
      reason: error instanceof Error ? error.message : 'playback evidence redaction failed',
    }
  }
}

function stableJson(value: RedactedPlaybackEvidence): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function stableMarkdown(value: RedactedPlaybackEvidence): string {
  const progress = value.playback.progress
  const events = value.events.map(event => `- ${event.event}: ${event.observed ? `observed at ${event.observedAt}` : 'not observed'}`).join('\n')
  return [
    '# Playback Evidence',
    '',
    `- schemaVersion: ${value.schemaVersion}`,
    `- taskId: ${value.tuple.taskId}`,
    `- runId: ${value.tuple.runId}`,
    `- attemptNumber: ${value.tuple.attemptNumber}`,
    `- provider: ${value.tuple.provider}`,
    `- contentId: ${value.contentId}`,
    `- sourceRevision: ${value.sourceRevision}`,
    `- sourceType: ${value.source.sourceType}`,
    `- viewerPath: ${value.viewer.path}`,
    `- outcome: ${value.outcome}`,
    `- currentTimeBefore: ${progress.currentTimeBefore}`,
    `- currentTimeAfter: ${progress.currentTimeAfter}`,
    `- currentTimeDelta: ${progress.currentTimeDelta}`,
    '',
    '## Events',
    '',
    events,
    '',
    '## Artifact',
    '',
    `- reference: ${value.artifact.reference}`,
    `- stem: ${value.artifact.stem}`,
    `- hash: ${value.artifact.hash}`,
    '',
  ].join('\n')
}

export function buildPlaybackEvidencePair(input: PlaybackEvidenceSummary): PlaybackEvidencePair {
  const value = buildRedactedPlaybackEvidence(input)
  return {
    json: stableJson(value),
    markdown: stableMarkdown(value),
    value,
  }
}

export const redactPlaybackEvidence = buildRedactedPlaybackEvidence
export const assertSafePlaybackEvidence = findForbiddenPlaybackEvidenceMaterial
