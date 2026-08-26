import type { Database } from '@starye/db'
import type { QuantFinancialQualityProvider, QuantValuationProvider } from './provider'
import type { MomentumCandidate } from './types'
import type { ValueQualityBatchResult, ValueQualityInput } from './value-quality'
import { mapQuantProviderError } from './provider'
import { getLatestQuantScanSnapshot, listQuantDailyBars, listQuantWatchlist } from './repository'
import { buildValueQualityBatch } from './value-quality'

export const QUANT_VALUE_SELECTION_CONCURRENCY = 4

export interface QuantValueSelectionProviders {
  readonly valuation: QuantValuationProvider
  readonly financial: QuantFinancialQualityProvider
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCandidates(snapshot: { readonly candidatesJson: string } | undefined): ReadonlyMap<string, MomentumCandidate> {
  if (!snapshot)
    return new Map()
  try {
    const parsed: unknown = JSON.parse(snapshot.candidatesJson)
    if (!Array.isArray(parsed))
      return new Map()
    const candidates = parsed.filter((value): value is MomentumCandidate => {
      if (!isRecord(value) || typeof value.tsCode !== 'string' || !isRecord(value.factors))
        return false
      return typeof value.score === 'number' && typeof value.factorVersion === 'string'
    })
    return new Map(candidates.map(candidate => [candidate.tsCode, candidate]))
  }
  catch {
    return new Map()
  }
}

function providerErrorCode(error: unknown): string {
  return mapQuantProviderError(error).code
}

export async function readQuantValueSelection(
  db: Database,
  userId: string,
  providers: QuantValueSelectionProviders,
  now: () => Date = () => new Date(),
): Promise<ValueQualityBatchResult> {
  const observedAt = now().toISOString()
  const [watchlist, snapshot] = await Promise.all([
    listQuantWatchlist(db, userId),
    getLatestQuantScanSnapshot(db, userId),
  ])
  if (watchlist.length === 0)
    return buildValueQualityBatch([], observedAt)

  const candidateByCode = parseCandidates(snapshot)
  const dailyBars = await Promise.all(watchlist.map(async item => [
    item.tsCode,
    await listQuantDailyBars(db, { tsCode: item.tsCode }),
  ] as const))
  const barsByCode = new Map(dailyBars)
  const inputs: Array<ValueQualityInput | undefined> = Array.from({ length: watchlist.length })
  let nextIndex = 0
  const workerCount = Math.min(QUANT_VALUE_SELECTION_CONCURRENCY, watchlist.length)

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < watchlist.length) {
      const index = nextIndex++
      const item = watchlist[index]!
      const [valuationResult, financialResult] = await Promise.allSettled([
        providers.valuation.fetchValuation({ tsCode: item.tsCode }),
        providers.financial.fetchFinancialQualityHistory({ tsCode: item.tsCode, limit: 4 }),
      ])
      inputs[index] = {
        tsCode: item.tsCode,
        name: item.name,
        valuation: valuationResult.status === 'fulfilled' ? valuationResult.value : null,
        financialReports: financialResult.status === 'fulfilled' ? financialResult.value : [],
        dailyBars: barsByCode.get(item.tsCode) ?? [],
        candidate: candidateByCode.get(item.tsCode) ?? null,
        valuationErrorCode: valuationResult.status === 'rejected' ? providerErrorCode(valuationResult.reason) : null,
        financialErrorCode: financialResult.status === 'rejected' ? providerErrorCode(financialResult.reason) : null,
        observedAt,
      }
    }
  }))

  return buildValueQualityBatch(inputs.filter((input): input is ValueQualityInput => input !== undefined), observedAt)
}
