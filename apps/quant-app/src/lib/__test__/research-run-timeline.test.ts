import type { QuantResearchRun } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { buildResearchRunTimeline } from '../research-run-timeline'

function run(id: string, generatedAt: string | null, score: number | null, status: QuantResearchRun['status'] = 'partial', action: QuantResearchRun['report']['action'] = 'wait-confirmation'): QuantResearchRun {
  return {
    id,
    tsCode: '601899.SH',
    name: '紫金矿业',
    status,
    reportVersion: 'research-report-v2',
    sourceSnapshotId: null,
    generatedAt,
    createdAt: generatedAt,
    report: {
      reportVersion: 'research-report-v2',
      tsCode: '601899.SH',
      name: '紫金矿业',
      generatedAt: generatedAt || 'unknown',
      sourceSnapshotId: null,
      status,
      action,
      score,
      headline: `报告 ${id}`,
      strengths: [],
      risks: [],
      gaps: [],
      nextActions: [],
      evidence: [],
      sources: [],
    },
  }
}

describe('research run timeline', () => {
  it('orders newest first and compares adjacent finite scores', () => {
    const result = buildResearchRunTimeline([
      run('older', '2026-08-24T00:00:00.000Z', 48, 'partial', 'wait-confirmation'),
      run('newest', '2026-08-26T00:00:00.000Z', 62, 'ready', 'research-window'),
      run('middle', '2026-08-25T00:00:00.000Z', 55, 'partial', 'wait-confirmation'),
    ])

    expect(result.points.map(point => point.id)).toEqual(['newest', 'middle', 'older'])
    expect(result.points[0]).toMatchObject({ score: 62, previousScore: 55, scoreDelta: 7, scoreDirection: 'up', statusChanged: true, actionChanged: true })
    expect(result.points[1]).toMatchObject({ score: 55, previousScore: 48, scoreDelta: 7, scoreDirection: 'up', statusChanged: false, actionChanged: false })
    expect(result.points[2]).toMatchObject({ score: 48, previousScore: null, scoreDelta: null, scoreDirection: 'none' })
    expect(result).toMatchObject({ totalRunCount: 3, latestScore: 62, previousScore: 55, latestScoreDelta: 7, latestScoreDirection: 'up', statusChangeCount: 1, actionChangeCount: 1 })
  })

  it('keeps missing scores and timestamps without fabricating a delta', () => {
    const result = buildResearchRunTimeline([
      run('missing-score', null, null),
      run('finite-score', '2026-08-25T00:00:00.000Z', 40),
    ])

    expect(result.points.map(point => point.id)).toEqual(['finite-score', 'missing-score'])
    expect(result.points[0]).toMatchObject({ score: 40, previousScore: null, scoreDelta: null, scoreDirection: 'none' })
    expect(result.points[1]).toMatchObject({ generatedAt: null, score: null, previousScore: null, scoreDelta: null, scoreDirection: 'none' })
  })

  it('uses a deterministic id tie-breaker when timestamps are unavailable', () => {
    const result = buildResearchRunTimeline([
      run('run-a', null, 30),
      run('run-c', null, 32),
      run('run-b', null, 31),
    ])

    expect(result.points.map(point => point.id)).toEqual(['run-c', 'run-b', 'run-a'])
  })

  it('bounds visible points to five and identifies flat scores', () => {
    const result = buildResearchRunTimeline(Array.from({ length: 7 }, (_, index) => run(`run-${index}`, `2026-08-${String(20 + index).padStart(2, '0')}T00:00:00.000Z`, index === 6 ? 50 : 50)), 99)

    expect(result.totalRunCount).toBe(7)
    expect(result.points).toHaveLength(5)
    expect(result.points[0]).toMatchObject({ scoreDelta: 0, scoreDirection: 'flat' })
  })
})
