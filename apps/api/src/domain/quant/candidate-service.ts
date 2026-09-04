import type { Database } from '@starye/db'
import type { QuantSignalHistoryCandidate, QuantSignalHistorySnapshot } from './signal-persistence'
import type { MomentumCandidate } from './types'
import { screenMomentum } from './factor'
import { ensureQuantStarterWatchlist, listQuantDailyBars, listQuantScanSnapshots, listQuantWatchlist } from './repository'
import { buildQuantSignalPersistence } from './signal-persistence'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface CurrentQuantCandidateView {
  readonly [key: string]: unknown
  readonly id: string
  readonly tsCode: string
  readonly factorVersion: string | null
  readonly name: string | null
  readonly score: number | null
  readonly changePercent: number | null
  readonly dataQuality: string
  readonly matchedFactors: readonly string[]
  readonly missingFactors: readonly string[]
  readonly factors: unknown
  readonly pendingSync: boolean
  readonly pendingReason: string | null
  readonly persistence?: ReturnType<typeof buildQuantSignalPersistence>
}

export interface CurrentQuantCandidateSnapshot {
  readonly id: string
  readonly factorVersion: string
  readonly generatedAt: Date | null
  readonly fromDate: string | null
  readonly toDate: string | null
  readonly inputTsCodes: readonly string[]
  readonly candidates: readonly CurrentQuantCandidateView[]
}

function parseStoredCandidates(snapshot: { readonly candidatesJson: string } | undefined): ReadonlyMap<string, Record<string, unknown>> {
  if (!snapshot)
    return new Map()
  try {
    const value: unknown = JSON.parse(snapshot.candidatesJson)
    if (!Array.isArray(value))
      return new Map()
    return new Map(value.filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.tsCode === 'string').map(item => [item.tsCode as string, item]))
  }
  catch {
    return new Map()
  }
}

function parseSignalHistoryCandidate(value: Record<string, unknown>): QuantSignalHistoryCandidate {
  const rawScore = value.score
  const score = typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : null
  const rawFactors = value.matchedFactors
  const matchedFactors = Array.isArray(rawFactors)
    ? rawFactors.filter((factor): factor is string => typeof factor === 'string')
    : []
  return { score, matchedFactors }
}

function parseSignalHistorySnapshot(snapshot: {
  readonly id: string
  readonly generatedAt: Date
  readonly candidatesJson: string
}): QuantSignalHistorySnapshot {
  const candidates = new Map([...parseStoredCandidates(snapshot)].map(([tsCode, candidate]) => [tsCode, parseSignalHistoryCandidate(candidate)] as const))
  return { id: snapshot.id, generatedAt: snapshot.generatedAt, candidates }
}

function parseSnapshotInputTsCodes(snapshot: { readonly inputTsCodesJson: string } | undefined): readonly string[] {
  if (!snapshot)
    return []
  try {
    const parsed: unknown = JSON.parse(snapshot.inputTsCodesJson)
    if (!Array.isArray(parsed))
      return []
    return [...new Set(parsed
      .filter((code): code is string => typeof code === 'string')
      .map(code => code.trim().toUpperCase())
      .filter(code => /^[A-Z0-9.-]{1,20}$/u.test(code)))]
  }
  catch {
    return []
  }
}

export async function readCurrentQuantCandidates(db: Database, userId: string): Promise<CurrentQuantCandidateSnapshot> {
  const [watchlist, snapshotHistory] = await Promise.all([
    listQuantWatchlist(db, userId),
    listQuantScanSnapshots(db, userId),
  ])
  const snapshot = snapshotHistory[0]
  const barsByCode = Object.fromEntries(await Promise.all(watchlist.map(async item => [
    item.tsCode,
    await listQuantDailyBars(db, { tsCode: item.tsCode }),
  ] as const)))
  const recalculated = new Map(screenMomentum(barsByCode).map(candidate => [candidate.tsCode, candidate]))
  const stored = parseStoredCandidates(snapshot)
  const signalHistory = snapshotHistory.map(parseSignalHistorySnapshot)
  const persistenceByCode = new Map(watchlist.map(item => [item.tsCode, buildQuantSignalPersistence(item.tsCode, signalHistory)] as const))
  const candidates = watchlist.map((item) => {
    const snapshotCandidate = stored.get(item.tsCode)
    if (snapshotCandidate) {
      return {
        ...snapshotCandidate,
        id: `snapshot-${item.tsCode}`,
        tsCode: item.tsCode,
        factorVersion: typeof snapshotCandidate.factorVersion === 'string' ? snapshotCandidate.factorVersion : snapshot?.factorVersion ?? 'momentum-v1',
        name: item.name ?? (typeof snapshotCandidate.name === 'string' ? snapshotCandidate.name : null),
        score: typeof snapshotCandidate.score === 'number' && Number.isFinite(snapshotCandidate.score) ? snapshotCandidate.score : null,
        changePercent: typeof snapshotCandidate.changePercent === 'number' && Number.isFinite(snapshotCandidate.changePercent) ? snapshotCandidate.changePercent : null,
        dataQuality: typeof snapshotCandidate.dataQuality === 'string' ? snapshotCandidate.dataQuality : 'insufficient_data',
        matchedFactors: Array.isArray(snapshotCandidate.matchedFactors) ? snapshotCandidate.matchedFactors.filter((factor): factor is string => typeof factor === 'string') : [],
        missingFactors: Array.isArray(snapshotCandidate.missingFactors) ? snapshotCandidate.missingFactors.filter((factor): factor is string => typeof factor === 'string') : [],
        factors: isRecord(snapshotCandidate.factors) ? snapshotCandidate.factors : null,
        pendingSync: false,
        pendingReason: null,
        persistence: persistenceByCode.get(item.tsCode),
      } satisfies CurrentQuantCandidateView
    }

    const candidate = recalculated.get(item.tsCode) as MomentumCandidate | undefined
    return {
      ...(candidate ?? {
        tsCode: item.tsCode,
        factorVersion: 'momentum-v1',
        factors: {
          ma5: null,
          ma20: null,
          isNewHigh20: null,
          consecutiveUpDays: null,
          volumeRatio: null,
          return20: null,
          relativeStrength: null,
        },
        matchedFactors: [],
        missingFactors: ['ma5', 'ma20', 'new_high_20', 'continuation', 'volume_ratio', 'relative_strength'],
        dataQuality: 'insufficient_data' as const,
        score: 0,
      }),
      id: `watchlist-${item.tsCode}`,
      tsCode: item.tsCode,
      name: item.name,
      score: candidate?.score ?? 0,
      changePercent: null,
      dataQuality: candidate?.dataQuality ?? 'insufficient_data',
      matchedFactors: candidate?.matchedFactors ?? [],
      missingFactors: candidate?.missingFactors ?? ['ma5', 'ma20', 'new_high_20', 'continuation', 'volume_ratio', 'relative_strength'],
      factorVersion: candidate?.factorVersion ?? 'momentum-v1',
      factors: candidate?.factors ?? {
        ma5: null,
        ma20: null,
        isNewHigh20: null,
        consecutiveUpDays: null,
        volumeRatio: null,
        return20: null,
        relativeStrength: null,
      },
      pendingSync: true,
      pendingReason: '尚未进入最近一次候选快照，请更新观察池',
      persistence: persistenceByCode.get(item.tsCode),
    } satisfies CurrentQuantCandidateView
  })

  return {
    id: snapshot?.id ?? 'pending',
    factorVersion: snapshot?.factorVersion ?? 'momentum-v1',
    generatedAt: snapshot?.generatedAt ?? null,
    fromDate: snapshot?.fromDate ?? null,
    toDate: snapshot?.toDate ?? null,
    inputTsCodes: parseSnapshotInputTsCodes(snapshot),
    candidates,
  }
}

export async function readQuantCandidateWorkspace(db: Database, userId: string): Promise<CurrentQuantCandidateSnapshot> {
  await ensureQuantStarterWatchlist(db, userId)
  return readCurrentQuantCandidates(db, userId)
}
