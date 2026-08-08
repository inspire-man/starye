import * as v from 'valibot'

import { describe, expect, it } from 'vitest'
import {
  PlaybackEvidenceRequestSchema,
  PlaybackEvidenceSummarySchema,
} from '../../../schemas/playback-evidence'
import {
  buildPlaybackEvidencePair,
  buildRedactedPlaybackEvidence,
  findForbiddenPlaybackEvidenceMaterial,
  tryBuildRedactedPlaybackEvidence,
} from '../redaction'

const validRequest = {
  contentId: 'movie-24',
  events: [
    { event: 'canplay', observed: true, observedAt: 1_700_000_001 },
    { event: 'playing', observed: true, observedAt: 1_700_000_002 },
    { event: 'waiting', observed: false, observedAt: null },
    { event: 'stalled', observed: false, observedAt: null },
    { event: 'error', observed: false, observedAt: null },
  ],
  observedAt: 1_700_000_010,
  playback: {
    canplay: true,
    error: false,
    playing: true,
    progress: { currentTimeAfter: 3.2, currentTimeBefore: 1.9, currentTimeDelta: 1.3 },
    status: 'playback_verified',
  },
  provider: { provider: 'github-actions', status: 'succeeded' },
  repair: { sourceRevision: 7, status: 'succeeded' },
  schemaVersion: 1,
  source: { revision: 7, sourceType: 'direct', status: 'ready' },
  sourceRevision: 7,
  tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-24', taskId: 'task-24' },
  viewer: { path: '/movie/movie-24', targetLabel: 'selected-production-target' },
}

const validSummary = {
  ...validRequest,
  artifact: { hash: 'a'.repeat(64), reference: 'phase24/task-24/run-24/attempt-1', stem: 'task-24_run-24_attempt-1' },
  outcome: 'accepted',
}

describe('playback evidence contract', () => {
  it('accepts one closed tuple-bound terminal request with explicit unobserved events', () => {
    const result = v.safeParse(PlaybackEvidenceRequestSchema, validRequest)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output.tuple).toEqual(validRequest.tuple)
      expect(result.output.events).toHaveLength(5)
      expect(result.output.playback.progress.currentTimeDelta).toBe(1.3)
    }
  })

  it.each([
    ['target', { target: 'starye-org' }],
    ['workflow', { workflow: '.github/workflows/daily-movie-crawl.yml' }],
    ['command', { command: 'run' }],
    ['source URL', { sourceUrl: 'https://media.example/source' }],
    ['token', { token: 'secret' }],
  ])('rejects client-owned %s fields', (_name, extra) => {
    expect(v.safeParse(PlaybackEvidenceRequestSchema, { ...validRequest, ...extra }).success).toBe(false)
  })

  it('rejects non-finite progress, invalid source type, duplicate events, and oversized retries', () => {
    expect(v.safeParse(PlaybackEvidenceRequestSchema, {
      ...validRequest,
      playback: { ...validRequest.playback, progress: { ...validRequest.playback.progress, currentTimeAfter: Number.NaN } },
    }).success).toBe(false)
    expect(v.safeParse(PlaybackEvidenceRequestSchema, {
      ...validRequest,
      source: { ...validRequest.source, sourceType: 'magnet' },
    }).success).toBe(false)
    expect(v.safeParse(PlaybackEvidenceRequestSchema, {
      ...validRequest,
      events: validRequest.events.map(event => ({ ...event, event: 'playing' })),
    }).success).toBe(false)
    expect(v.safeParse(PlaybackEvidenceRequestSchema, {
      ...validRequest,
      tuple: { ...validRequest.tuple, attemptNumber: 3 },
    }).success).toBe(false)
  })

  it('requires artifact and bounded outcome only on the response summary', () => {
    expect(v.safeParse(PlaybackEvidenceSummarySchema, validRequest).success).toBe(false)
    expect(v.safeParse(PlaybackEvidenceSummarySchema, validSummary).success).toBe(true)
  })

  it('constructs a stable redacted JSON/Markdown pair from an allowlist', () => {
    const first = buildPlaybackEvidencePair(validSummary)
    const second = buildPlaybackEvidencePair(structuredClone(validSummary))

    expect(first.value).toEqual(second.value)
    expect(first.json).toBe(second.json)
    expect(first.markdown).toBe(second.markdown)
    expect(first.json).toContain('currentTimeDelta')
    expect(first.json).not.toContain('sourceUrl')
  })

  it.each([
    ['raw URL key', { sourceUrl: 'https://media.example/source' }],
    ['signed query value', { targetLabel: 'https://media.example/video?token=secret' }],
    ['session key', { session: 'session-value' }],
    ['runner payload key', { runnerJson: '{}' }],
    ['HTML value', { targetLabel: '<video src="media"></video>' }],
    ['exception value', { targetLabel: 'network log exception stack trace' }],
  ])('rejects %s before redaction', (_name, extra) => {
    const candidate = { ...validSummary, ...extra }

    expect(findForbiddenPlaybackEvidenceMaterial(candidate)).toBeDefined()
    expect(() => buildRedactedPlaybackEvidence(candidate)).toThrow(/forbidden|schema rejected/u)
    expect(tryBuildRedactedPlaybackEvidence(candidate)).toMatchObject({ ok: false, outcome: 'checkpoint' })
  })

  it('does not turn a redaction failure into accepted evidence', () => {
    const result = tryBuildRedactedPlaybackEvidence({ ...validSummary, token: 'secret' })

    expect(result).toEqual(expect.objectContaining({ ok: false, outcome: 'checkpoint' }))
  })
})
