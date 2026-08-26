import type { QuantResearchAction, QuantResearchRun, QuantResearchRunStatus } from './quant-types'

export type ResearchRunScoreDirection = 'up' | 'down' | 'flat' | 'none'

export interface ResearchRunTimelinePoint {
  id: string
  generatedAt: string | null
  status: QuantResearchRunStatus
  action: QuantResearchAction
  score: number | null
  previousScore: number | null
  scoreDelta: number | null
  scoreDirection: ResearchRunScoreDirection
  previousStatus: QuantResearchRunStatus | null
  previousAction: QuantResearchAction | null
  statusChanged: boolean
  actionChanged: boolean
  headline: string
  evidenceCount: number
}

export interface ResearchRunTimeline {
  points: ResearchRunTimelinePoint[]
  totalRunCount: number
  latestScore: number | null
  previousScore: number | null
  latestScoreDelta: number | null
  latestScoreDirection: ResearchRunScoreDirection
  statusChangeCount: number
  actionChangeCount: number
}

export const MAX_RESEARCH_RUN_TIMELINE_POINTS = 5

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function timestamp(run: QuantResearchRun): string | null {
  return run.generatedAt || run.createdAt || null
}

function timestampValue(run: QuantResearchRun): number {
  const value = timestamp(run)
  if (!value)
    return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

function orderedRuns(runs: QuantResearchRun[]): QuantResearchRun[] {
  return runs
    .map((run, index) => ({ run, index }))
    .sort((left, right) => {
      const rightTime = timestampValue(right.run)
      const leftTime = timestampValue(left.run)
      if (rightTime > leftTime)
        return 1
      if (rightTime < leftTime)
        return -1
      const timestampDelta = (timestamp(right.run) || '').localeCompare(timestamp(left.run) || '')
      if (timestampDelta !== 0)
        return timestampDelta
      const idDelta = right.run.id.localeCompare(left.run.id)
      return idDelta !== 0 ? idDelta : left.index - right.index
    })
    .map(item => item.run)
}

function scoreDirection(scoreDelta: number | null): ResearchRunScoreDirection {
  if (scoreDelta === null)
    return 'none'
  if (scoreDelta > 0)
    return 'up'
  if (scoreDelta < 0)
    return 'down'
  return 'flat'
}

function visibleLimit(limit: number): number {
  if (!Number.isFinite(limit))
    return MAX_RESEARCH_RUN_TIMELINE_POINTS
  return Math.max(1, Math.min(MAX_RESEARCH_RUN_TIMELINE_POINTS, Math.trunc(limit)))
}

export function buildResearchRunTimeline(runs: QuantResearchRun[], limit = MAX_RESEARCH_RUN_TIMELINE_POINTS): ResearchRunTimeline {
  const ordered = orderedRuns(runs)
  const visible = ordered.slice(0, visibleLimit(limit))
  const points = visible.map((run, index) => {
    const previous = visible[index + 1] || null
    const score = finite(run.report.score)
    const previousScore = finite(previous?.report.score)
    const scoreDelta = score !== null && previousScore !== null ? round(score - previousScore) : null
    const status = run.status
    const action = run.report.action

    return {
      id: run.id,
      generatedAt: timestamp(run),
      status,
      action,
      score,
      previousScore,
      scoreDelta,
      scoreDirection: scoreDirection(scoreDelta),
      previousStatus: previous?.status || null,
      previousAction: previous?.report.action || null,
      statusChanged: Boolean(previous && status !== previous.status),
      actionChanged: Boolean(previous && action !== previous.report.action),
      headline: run.report.headline,
      evidenceCount: run.report.evidence.length,
    }
  })

  const latest = points[0]
  return {
    points,
    totalRunCount: ordered.length,
    latestScore: latest?.score ?? null,
    previousScore: latest?.previousScore ?? null,
    latestScoreDelta: latest?.scoreDelta ?? null,
    latestScoreDirection: latest?.scoreDirection || 'none',
    statusChangeCount: points.filter(point => point.statusChanged).length,
    actionChangeCount: points.filter(point => point.actionChanged).length,
  }
}
