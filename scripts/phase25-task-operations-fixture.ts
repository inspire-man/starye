export const PHASE25_GATEWAY_ORIGIN = 'http://localhost:8080'
export const PHASE25_DASHBOARD_PATH = '/dashboard/crawlers'
export type Phase25Provider = 'github-actions' | 'local-proof'

const IDENTIFIER = /^[A-Za-z0-9][\w.:-]{0,127}$/u
const FORBIDDEN_KEY = /^(?:authorization|cookie|command|html|media|rawresponse|secret|signedurl|sourceurl|token|url|workflow|providerrunurl|providerurl)$/iu
const FORBIDDEN_VALUE = /https?:\/\/|magnet:\?|bearer\s+|cookie\s*[:=]|authorization\s*[:=]|secret\s*[:=]/iu

export interface Phase25FreshTuple {
  attemptNumber: number
  contentId: string
  observationIdentity: string
  provider: Phase25Provider
  runId: string
  sourceRevision: number
  taskId: string
}

export interface Phase25FixtureSummary {
  readonly availability: {
    readonly historyOutcomes: readonly ['duplicate', 'conflict', 'stale', 'late']
    readonly latestStatus: 'available'
    readonly projectionVersion: number
  }
  readonly audit: { readonly count: number }
  readonly lifecycle: 'active'
  readonly tuple: Phase25FreshTuple
}

export function boundedPhase25Identifier(value: unknown): string | null {
  return typeof value === 'string' && IDENTIFIER.test(value) ? value : null
}

function fixtureSeed(seed: string): string {
  const normalized = seed.replace(/[^\w.:-]+/gu, '-').replace(/^-+/u, '').slice(0, 72)
  return normalized || 'phase25-fresh'
}

export function createPhase25TaskOperationsFixture(seed = `phase25-${Date.now()}`, provider: Phase25Provider = 'local-proof'): Phase25FixtureSummary {
  const prefix = fixtureSeed(seed)
  const tuple: Phase25FreshTuple = {
    attemptNumber: 1,
    contentId: `${prefix}-content`,
    observationIdentity: `${prefix}-observation-2`,
    provider,
    runId: `${prefix}-run`,
    sourceRevision: 1,
    taskId: `${prefix}-task`,
  }
  return {
    availability: {
      historyOutcomes: ['duplicate', 'conflict', 'stale', 'late'],
      latestStatus: 'available',
      projectionVersion: 2,
    },
    audit: { count: 7 },
    lifecycle: 'active',
    tuple,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function assertPhase25Redacted(value: unknown, path = '$'): void {
  if (typeof value === 'string') {
    if (value.length > 256 || FORBIDDEN_VALUE.test(value))
      throw new Error(`phase25_forbidden_or_unbounded_value:${path}`)
    return
  }
  if (Array.isArray(value)) {
    if (value.length > 50)
      throw new Error(`phase25_array_too_large:${path}`)
    value.forEach((item, index) => assertPhase25Redacted(item, `${path}[${index}]`))
    return
  }
  if (!isRecord(value))
    return
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key.replace(/[_-]/gu, '')))
      throw new Error(`phase25_forbidden_field:${path}.${key}`)
    assertPhase25Redacted(child, `${path}.${key}`)
  }
}

export function tupleFromPhase25TaskDetail(value: unknown): Phase25FreshTuple {
  if (!isRecord(value) || !isRecord(value.task))
    throw new Error('phase25_task_detail_missing')
  const task = value.task
  const taskId = boundedPhase25Identifier(task.id)
  const latestRunId = boundedPhase25Identifier(task.latestRunId ?? task.latest_run_id)
  const runs = Array.isArray(value.runs) ? value.runs : []
  const run = runs.find(candidate => isRecord(candidate) && candidate.id === latestRunId) ?? runs[0]
  if (!isRecord(run))
    throw new Error('phase25_task_run_missing')
  const runId = boundedPhase25Identifier(run.id)
  const attemptNumber = run.attemptNumber ?? run.attempt_number
  const availability = isRecord(value.availability) && isRecord(value.availability.current) ? value.availability.current : null
  const provider = isRecord(run.provider) ? run.provider.provider : null
  const contentId = availability?.contentId ?? (isRecord(task.movie) ? task.movie.id : null)
  const sourceRevision = availability?.sourceRevision ?? task.sourceRevision
  const observationIdentity = availability?.observationIdentity
  const boundedContentId = boundedPhase25Identifier(contentId)
  const boundedObservationIdentity = boundedPhase25Identifier(observationIdentity)
  if (!taskId || !runId || (provider !== 'github-actions' && provider !== 'local-proof') || typeof attemptNumber !== 'number'
    || !Number.isSafeInteger(attemptNumber) || attemptNumber < 1
    || !boundedContentId
    || typeof sourceRevision !== 'number' || !Number.isSafeInteger(sourceRevision) || sourceRevision < 0
    || !boundedObservationIdentity) {
    throw new Error('phase25_task_detail_tuple_invalid')
  }
  return {
    attemptNumber,
    contentId: boundedContentId,
    observationIdentity: boundedObservationIdentity,
    provider,
    runId,
    sourceRevision: sourceRevision as number,
    taskId,
  }
}

export function redactedPhase25Summary(tuple: Phase25FreshTuple, detail: unknown): Record<string, unknown> {
  const summary = {
    availability: isRecord(detail) && isRecord(detail.availability) && isRecord(detail.availability.current)
      ? {
          freshness: detail.availability.current.freshness,
          observationIdentity: detail.availability.current.observationIdentity,
          projectionVersion: detail.availability.current.projectionVersion,
          status: detail.availability.current.status,
        }
      : null,
    contentId: tuple.contentId,
    runId: tuple.runId,
    sourceRevision: tuple.sourceRevision,
    taskId: tuple.taskId,
  }
  assertPhase25Redacted(summary)
  return summary
}
