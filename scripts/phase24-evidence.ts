import type {
  PlaybackArtifactReference,
  PlaybackEvidenceOutcome,
  PlaybackEvidenceRequest,
  PlaybackEvidenceSummary,
} from '../apps/api/src/domain/playback-evidence/types.ts'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import * as playbackEvidenceRedactionModule from '../apps/api/src/domain/playback-evidence/redaction.ts'

type PlaybackEvidenceRedactionExports = Pick<typeof playbackEvidenceRedactionModule, 'buildPlaybackEvidencePair' | 'findForbiddenPlaybackEvidenceMaterial'>

const playbackEvidenceRedaction = (
  (playbackEvidenceRedactionModule as unknown as { default?: PlaybackEvidenceRedactionExports }).default
  ?? playbackEvidenceRedactionModule
) as PlaybackEvidenceRedactionExports
const {
  buildPlaybackEvidencePair,
  findForbiddenPlaybackEvidenceMaterial,
} = playbackEvidenceRedaction

export type Phase24TerminalOutcome = Extract<PlaybackEvidenceOutcome, 'accepted' | 'failed' | 'checkpoint'>

export interface Phase24TerminalEvidenceInput extends PlaybackEvidenceRequest {
  readonly outcome: Phase24TerminalOutcome
}

export interface Phase24EvidencePair {
  readonly artifact: PlaybackArtifactReference
  readonly request: PlaybackEvidenceRequest
  readonly summary: PlaybackEvidenceSummary
  readonly json: string
  readonly markdown: string
}

export interface Phase24WrittenEvidencePair extends Phase24EvidencePair {
  readonly jsonPath: string
  readonly markdownPath: string
}

export interface Phase24EvidenceCheckpoint {
  readonly outcome: 'checkpoint'
  readonly reason: string
  readonly artifact?: PlaybackArtifactReference
  readonly jsonPath?: string
  readonly markdownPath?: string
}

export class Phase24EvidenceCheckpointError extends Error {
  readonly outcome = 'checkpoint' as const

  constructor(message: string) {
    super(message)
    this.name = 'Phase24EvidenceCheckpointError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeIdentifier(value: string, field: string): string {
  if (!/^[\w.~-]{1,128}$/u.test(value))
    throw new Phase24EvidenceCheckpointError(`${field} is not a bounded server identifier`)
  return value
}

function normalizeRequest(input: Phase24TerminalEvidenceInput): PlaybackEvidenceRequest {
  const allowedKeys = new Set([
    'contentId',
    'events',
    'observedAt',
    'outcome',
    'playback',
    'provider',
    'repair',
    'schemaVersion',
    'source',
    'sourceRevision',
    'tuple',
    'viewer',
  ])
  const unexpectedKey = Object.keys(input).find(key => !allowedKeys.has(key))
  if (unexpectedKey)
    throw new Phase24EvidenceCheckpointError(`playback evidence schema rejected input: unexpected field ${unexpectedKey}`)

  const request: PlaybackEvidenceRequest = {
    contentId: input.contentId,
    events: input.events,
    observedAt: input.observedAt,
    playback: input.playback,
    provider: input.provider,
    repair: input.repair,
    schemaVersion: input.schemaVersion,
    source: input.source,
    sourceRevision: input.sourceRevision,
    tuple: input.tuple,
    viewer: input.viewer,
  }

  safeIdentifier(request.tuple.taskId, 'taskId')
  safeIdentifier(request.tuple.runId, 'runId')
  safeIdentifier(request.contentId, 'contentId')
  return request
}

function artifactFor(request: PlaybackEvidenceRequest): PlaybackArtifactReference {
  const requestJson = JSON.stringify(request)
  const hash = createHash('sha256').update(requestJson, 'utf8').digest('hex')
  const stem = `${request.tuple.taskId}_${request.tuple.runId}_attempt-${request.tuple.attemptNumber}`.slice(0, 192)
  return {
    hash,
    reference: `phase24/${request.tuple.taskId}/${request.tuple.runId}/attempt-${request.tuple.attemptNumber}.json`,
    stem,
  }
}

function assertPairStable(pair: Phase24EvidencePair): void {
  const rebuilt = buildPlaybackEvidencePair(pair.summary)
  if (rebuilt.json !== pair.json || rebuilt.markdown !== pair.markdown)
    throw new Phase24EvidenceCheckpointError('JSON/Markdown evidence pair is not deterministic')

  const parsedJson: unknown = JSON.parse(pair.json)
  if (JSON.stringify(parsedJson) !== JSON.stringify(pair.summary))
    throw new Phase24EvidenceCheckpointError('JSON evidence does not round-trip to the redacted summary')

  const forbiddenJson = findForbiddenPlaybackEvidenceMaterial(pair.json)
  const forbiddenMarkdown = findForbiddenPlaybackEvidenceMaterial(pair.markdown)
  if (forbiddenJson || forbiddenMarkdown)
    throw new Phase24EvidenceCheckpointError('serialized evidence contains forbidden material')
}

/** Builds the canonical JSON source and derives Markdown from the same redacted value. */
export function buildPhase24EvidencePair(input: Phase24TerminalEvidenceInput): Phase24EvidencePair {
  const requestCandidate = normalizeRequest(input)
  const provisional: PlaybackEvidenceSummary = {
    ...requestCandidate,
    artifact: {
      hash: '0'.repeat(64),
      reference: 'phase24/pending.json',
      stem: 'phase24-pending',
    },
    outcome: input.outcome,
  }
  const canonical = buildPlaybackEvidencePair(provisional).value
  const request: PlaybackEvidenceRequest = {
    contentId: canonical.contentId,
    events: canonical.events,
    observedAt: canonical.observedAt,
    playback: canonical.playback,
    provider: canonical.provider,
    repair: canonical.repair,
    schemaVersion: canonical.schemaVersion,
    source: canonical.source,
    sourceRevision: canonical.sourceRevision,
    tuple: canonical.tuple,
    viewer: canonical.viewer,
  }
  const artifact = artifactFor(request)
  const summaryCandidate: PlaybackEvidenceSummary = {
    ...request,
    artifact,
    outcome: input.outcome,
  }
  const pair = buildPlaybackEvidencePair(summaryCandidate)
  const result: Phase24EvidencePair = {
    artifact,
    json: pair.json,
    markdown: pair.markdown,
    request,
    summary: pair.value,
  }
  assertPairStable(result)
  return result
}

function checkpointFrom(error: unknown, partial: Partial<Phase24WrittenEvidencePair> = {}): Phase24EvidenceCheckpoint {
  return {
    artifact: partial.artifact,
    jsonPath: partial.jsonPath,
    markdownPath: partial.markdownPath,
    outcome: 'checkpoint',
    reason: error instanceof Error ? error.message : 'evidence artifact write failed',
  }
}

/** Writes immutable artifact files; a second write to the same tuple is a checkpoint. */
export async function writePhase24EvidencePair(
  input: Phase24TerminalEvidenceInput,
  evidenceRoot: string,
): Promise<Phase24WrittenEvidencePair | Phase24EvidenceCheckpoint> {
  let pair: Phase24EvidencePair
  try {
    if (!isAbsolute(evidenceRoot))
      throw new Phase24EvidenceCheckpointError('evidence root must be an explicit absolute path')
    pair = buildPhase24EvidencePair(input)
  }
  catch (error) {
    return checkpointFrom(error)
  }

  const root = resolve(evidenceRoot)
  const jsonPath = join(root, `${pair.artifact.stem}.json`)
  const markdownPath = join(root, `${pair.artifact.stem}.md`)
  try {
    await mkdir(root, { recursive: true })
    await writeFile(jsonPath, pair.json, { encoding: 'utf8', flag: 'wx' })
  }
  catch (error) {
    return checkpointFrom(error, { artifact: pair.artifact, jsonPath })
  }

  try {
    await writeFile(markdownPath, pair.markdown, { encoding: 'utf8', flag: 'wx' })
  }
  catch (error) {
    return checkpointFrom(error, { artifact: pair.artifact, jsonPath, markdownPath })
  }

  return { ...pair, jsonPath, markdownPath }
}

async function readInput(file: string): Promise<Phase24TerminalEvidenceInput> {
  const raw = await readFile(file, 'utf8')
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed))
    throw new Phase24EvidenceCheckpointError('phase24 evidence input must be an object')
  return parsed as unknown as Phase24TerminalEvidenceInput
}

function requireFlag(argv: readonly string[], flag: string): string {
  const index = argv.indexOf(flag)
  const value = index >= 0 ? argv[index + 1] : undefined
  if (!value || value.startsWith('--'))
    throw new Error(`Usage: tsx scripts/phase24-evidence.ts --input evidence.json --evidence-dir DIR`)
  return value
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const inputPath = requireFlag(argv, '--input')
  const evidenceRoot = argv.includes('--evidence-dir')
    ? requireFlag(argv, '--evidence-dir')
    : requireFlag(argv, '--output-dir')
  const result = await writePhase24EvidencePair(await readInput(inputPath), evidenceRoot)
  process.stdout.write(`${JSON.stringify({ input: basename(inputPath), result })}\n`)
  if ('outcome' in result && result.outcome === 'checkpoint')
    process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  })
}
