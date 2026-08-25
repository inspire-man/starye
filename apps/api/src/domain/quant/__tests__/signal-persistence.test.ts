import type { QuantSignalHistorySnapshot } from '../signal-persistence'
import { describe, expect, it } from 'vitest'
import { buildQuantSignalPersistence } from '../signal-persistence'

function snapshot(id: string, generatedAt: string, candidates: Record<string, { score: number | null, matchedFactors?: string[] }>): QuantSignalHistorySnapshot {
  return {
    id,
    generatedAt: new Date(generatedAt),
    candidates: new Map(Object.entries(candidates).map(([tsCode, candidate]) => [tsCode, {
      score: candidate.score,
      matchedFactors: candidate.matchedFactors ?? [],
    }])),
  }
}

describe('buildQuantSignalPersistence', () => {
  it('returns an explicit insufficient state without snapshots', () => {
    expect(buildQuantSignalPersistence('601899.SH', [])).toMatchObject({
      sampleSize: 0,
      appearanceCount: 0,
      persistenceRate: null,
      state: 'insufficient_history',
      scoreDelta: null,
      scoreChange: null,
      evidence: [],
    })
  })

  it('marks a candidate as first seen when it is absent from the adjacent snapshot', () => {
    const result = buildQuantSignalPersistence('601899.SH', [
      snapshot('new', '2026-08-25T09:00:00.000Z', { '601899.SH': { score: 4, matchedFactors: ['ma20', 'relative_strength'] } }),
      snapshot('old', '2026-08-24T09:00:00.000Z', {}),
    ])

    expect(result).toMatchObject({
      sampleSize: 2,
      appearanceCount: 1,
      persistenceRate: 0.5,
      state: 'first_seen',
      latestScore: 4,
      previousScore: null,
      scoreDelta: null,
      scoreChange: null,
    })
    expect(result.factorPersistence.find(item => item.factor === 'ma20')).toEqual({ factor: 'ma20', appearances: 1, rate: 0.5 })
  })

  it('reports confirmation, adjacent score change, long-window change and factor frequency', () => {
    const result = buildQuantSignalPersistence('601899.SH', [
      snapshot('new', '2026-08-25T09:00:00.000Z', { '601899.SH': { score: 4, matchedFactors: ['ma20', 'continuation'] } }),
      snapshot('middle', '2026-08-24T09:00:00.000Z', { '601899.SH': { score: 3, matchedFactors: ['ma20'] } }),
      snapshot('old', '2026-08-23T09:00:00.000Z', { '601899.SH': { score: 2, matchedFactors: ['ma20'] } }),
    ])

    expect(result).toMatchObject({
      sampleSize: 3,
      appearanceCount: 3,
      persistenceRate: 1,
      state: 'confirming',
      latestScore: 4,
      previousScore: 3,
      scoreDelta: 1,
      scoreChange: 2,
    })
    expect(result.factorPersistence.find(item => item.factor === 'ma20')).toEqual({ factor: 'ma20', appearances: 3, rate: 1 })
    expect(result.factorPersistence.find(item => item.factor === 'continuation')).toEqual({ factor: 'continuation', appearances: 1, rate: 1 / 3 })
    expect(result.evidence).toHaveLength(3)
    expect(result.evidence[0]).toMatchObject({ snapshotId: 'new', present: true, score: 4 })
  })

  it('marks a falling adjacent score as weakening and caps evidence at five snapshots', () => {
    const snapshots = Array.from({ length: 6 }, (_, index) => snapshot(
      `snapshot-${index}`,
      `2026-08-${String(25 - index).padStart(2, '0')}T09:00:00.000Z`,
      { '601899.SH': { score: index === 0 ? 2 : 3, matchedFactors: ['ma20'] } },
    ))

    const result = buildQuantSignalPersistence('601899.SH', snapshots)

    expect(result.state).toBe('weakening')
    expect(result.scoreDelta).toBe(-1)
    expect(result.scoreChange).toBe(-1)
    expect(result.evidence).toHaveLength(5)
  })

  it('distinguishes a stock missing from the latest snapshot', () => {
    const result = buildQuantSignalPersistence('601899.SH', [
      snapshot('new', '2026-08-25T09:00:00.000Z', {}),
      snapshot('old', '2026-08-24T09:00:00.000Z', { '601899.SH': { score: 3 } }),
    ])

    expect(result).toMatchObject({
      state: 'not_in_latest',
      appearanceCount: 1,
      latestScore: null,
      previousScore: 3,
      scoreDelta: null,
    })
    expect(result.evidence[0]).toMatchObject({ snapshotId: 'new', present: false, score: null })
  })
})
