import type { Phase24TerminalEvidenceInput } from './phase24-evidence'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildPhase24EvidencePair, writePhase24EvidencePair } from './phase24-evidence'

const roots: string[] = []

function validInput(overrides: Partial<Phase24TerminalEvidenceInput> = {}): Phase24TerminalEvidenceInput {
  return {
    contentId: 'content-24',
    events: [
      { event: 'canplay', observed: true, observedAt: 101 },
      { event: 'playing', observed: true, observedAt: 102 },
      { event: 'waiting', observed: false, observedAt: null },
      { event: 'stalled', observed: false, observedAt: null },
      { event: 'error', observed: false, observedAt: null },
    ],
    observedAt: 103,
    outcome: 'accepted',
    playback: {
      canplay: true,
      error: false,
      playing: true,
      progress: { currentTimeAfter: 2.5, currentTimeBefore: 1.2, currentTimeDelta: 1.3 },
      status: 'playback_verified',
    },
    provider: { provider: 'github-actions', status: 'succeeded' },
    repair: { sourceRevision: 3, status: 'succeeded' },
    schemaVersion: 1,
    source: { revision: 3, sourceType: 'direct', status: 'ready' },
    sourceRevision: 3,
    tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-24', taskId: 'task-24' },
    viewer: { path: '/movie/MOVIE-24/play', targetLabel: 'selected-target' },
    ...overrides,
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('phase24 evidence artifact pair', () => {
  it('uses one redacted JSON source to derive deterministic Markdown and a tuple-bound hash', () => {
    const first = buildPhase24EvidencePair(validInput())
    const second = buildPhase24EvidencePair(validInput())

    expect(first.json).toBe(second.json)
    expect(first.markdown).toBe(second.markdown)
    expect(first.artifact.hash).toMatch(/^[a-f0-9]{64}$/u)
    expect(first.artifact.reference).toBe('phase24/task-24/run-24/attempt-1.json')
    expect(first.json).toContain('currentTimeDelta')
    expect(first.markdown).toContain('playing: observed at 102')
  })

  it('writes failed and checkpoint outcomes before any D1 submission path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'phase24-evidence-'))
    roots.push(root)
    const result = await writePhase24EvidencePair(validInput({
      outcome: 'failed',
      playback: {
        canplay: true,
        error: true,
        playing: false,
        progress: { currentTimeAfter: 0, currentTimeBefore: 0, currentTimeDelta: 0 },
        status: 'failed',
      },
    }), root)

    expect(result).toHaveProperty('jsonPath')
    if (!('jsonPath' in result))
      return
    expect(JSON.parse(await readFile(result.jsonPath, 'utf8'))).toMatchObject({ outcome: 'failed', playback: { error: true } })
    expect(await readFile(result.markdownPath, 'utf8')).toContain('- outcome: failed')
  })

  it('rejects a duplicate tuple without overwriting the first JSON artifact', async () => {
    const root = await mkdtemp(join(tmpdir(), 'phase24-evidence-'))
    roots.push(root)
    const first = await writePhase24EvidencePair(validInput(), root)
    const duplicate = await writePhase24EvidencePair(validInput(), root)

    expect(first).toHaveProperty('jsonPath')
    expect(duplicate).toMatchObject({ outcome: 'checkpoint' })
    if ('jsonPath' in first)
      expect(await readFile(first.jsonPath, 'utf8')).toBe(first.json)
  })

  it('keeps sensitive markers out of artifacts and fails closed on unexpected fields', () => {
    const input = { ...validInput(), token: 'TARGET_TOKEN', rawSource: 'https://TARGET/HOST' } as unknown as Phase24TerminalEvidenceInput
    expect(() => buildPhase24EvidencePair(input)).toThrow(/schema rejected|checkpoint/u)
  })

  it('requires an absolute evidence root and preserves the checkpoint outcome', async () => {
    const result = await writePhase24EvidencePair(validInput(), 'relative-evidence-root')
    expect(result).toMatchObject({ outcome: 'checkpoint' })
  })

  it('retains the JSON artifact when the Markdown half cannot be created', async () => {
    const root = await mkdtemp(join(tmpdir(), 'phase24-evidence-'))
    roots.push(root)
    const input = validInput({ tuple: { attemptNumber: 2, provider: 'github-actions', runId: 'run-25', taskId: 'task-25' } })
    const pair = buildPhase24EvidencePair(input)
    await writeFile(join(root, `${pair.artifact.stem}.md`), 'existing', 'utf8')
    const result = await writePhase24EvidencePair(input, root)

    expect(result).toMatchObject({ outcome: 'checkpoint' })
    expect(await readFile(join(root, `${pair.artifact.stem}.json`), 'utf8')).toBe(pair.json)
    expect(await readFile(join(root, `${pair.artifact.stem}.md`), 'utf8')).toBe('existing')
  })
})
