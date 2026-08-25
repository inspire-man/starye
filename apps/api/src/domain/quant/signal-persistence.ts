export const QUANT_SIGNAL_FACTOR_KEYS = [
  'ma5',
  'ma20',
  'new_high_20',
  'continuation',
  'volume_ratio',
  'relative_strength',
] as const

export const QUANT_SIGNAL_EVIDENCE_LIMIT = 5

export type QuantSignalFactor = typeof QUANT_SIGNAL_FACTOR_KEYS[number]
export type QuantSignalPersistenceState = 'first_seen' | 'confirming' | 'weakening' | 'not_in_latest' | 'insufficient_history'

export interface QuantSignalHistoryCandidate {
  readonly score: number | null
  readonly matchedFactors: readonly string[]
}

export interface QuantSignalHistorySnapshot {
  readonly id: string
  readonly generatedAt: Date
  readonly candidates: ReadonlyMap<string, QuantSignalHistoryCandidate>
}

export interface QuantFactorPersistence {
  readonly factor: QuantSignalFactor
  readonly appearances: number
  readonly rate: number | null
}

export interface QuantSignalEvidence {
  readonly snapshotId: string
  readonly generatedAt: string
  readonly present: boolean
  readonly score: number | null
  readonly matchedFactors: readonly string[]
}

export interface QuantSignalPersistence {
  readonly sampleSize: number
  readonly appearanceCount: number
  readonly persistenceRate: number | null
  readonly latestScore: number | null
  readonly previousScore: number | null
  readonly scoreDelta: number | null
  readonly scoreChange: number | null
  readonly state: QuantSignalPersistenceState
  readonly factorPersistence: readonly QuantFactorPersistence[]
  readonly evidence: readonly QuantSignalEvidence[]
}

function ratio(value: number, denominator: number): number | null {
  return denominator > 0 ? value / denominator : null
}

function scoreDifference(left: number | null, right: number | null): number | null {
  return left !== null && right !== null ? left - right : null
}

function sortSnapshots(snapshots: readonly QuantSignalHistorySnapshot[]): QuantSignalHistorySnapshot[] {
  return [...snapshots].sort((left, right) => {
    const dateDifference = right.generatedAt.getTime() - left.generatedAt.getTime()
    return dateDifference || right.id.localeCompare(left.id)
  })
}

export function buildQuantSignalPersistence(
  tsCode: string,
  inputSnapshots: readonly QuantSignalHistorySnapshot[],
): QuantSignalPersistence {
  const snapshots = sortSnapshots(inputSnapshots)
  const sampleSize = snapshots.length
  const latest = snapshots[0]
  const latestCandidate = latest?.candidates.get(tsCode)
  const previous = snapshots[1]?.candidates.get(tsCode)
  const appearanceCount = snapshots.reduce((count, snapshot) => count + (snapshot.candidates.has(tsCode) ? 1 : 0), 0)
  const oldestCandidate = [...snapshots].reverse().map(snapshot => snapshot.candidates.get(tsCode)).find(candidate => candidate !== undefined)
  const scoreDelta = scoreDifference(latestCandidate?.score ?? null, previous?.score ?? null)
  const scoreChange = appearanceCount >= 2
    ? scoreDifference(latestCandidate?.score ?? null, oldestCandidate?.score ?? null)
    : null

  let state: QuantSignalPersistenceState = 'insufficient_history'
  if (sampleSize > 0 && latestCandidate === undefined) {
    state = 'not_in_latest'
  }
  else if (sampleSize >= 2 && latestCandidate && previous && scoreDelta !== null) {
    state = scoreDelta < 0 ? 'weakening' : 'confirming'
  }
  else if (sampleSize >= 2 && latestCandidate && !previous) {
    state = 'first_seen'
  }

  const factorPersistence = QUANT_SIGNAL_FACTOR_KEYS.map((factor) => {
    const appearances = snapshots.reduce((count, snapshot) => {
      const candidate = snapshot.candidates.get(tsCode)
      return count + (candidate?.matchedFactors.includes(factor) ? 1 : 0)
    }, 0)
    return { factor, appearances, rate: ratio(appearances, sampleSize) }
  })

  const evidence = snapshots.slice(0, QUANT_SIGNAL_EVIDENCE_LIMIT).map((snapshot) => {
    const candidate = snapshot.candidates.get(tsCode)
    return {
      snapshotId: snapshot.id,
      generatedAt: snapshot.generatedAt.toISOString(),
      present: candidate !== undefined,
      score: candidate?.score ?? null,
      matchedFactors: candidate?.matchedFactors ?? [],
    }
  })

  return {
    sampleSize,
    appearanceCount,
    persistenceRate: ratio(appearanceCount, sampleSize),
    latestScore: latestCandidate?.score ?? null,
    previousScore: previous?.score ?? null,
    scoreDelta,
    scoreChange,
    state,
    factorPersistence,
    evidence,
  }
}
