import type { Database } from '@starye/db'
import type { QuantResearchRun as QuantResearchRunRecord } from '@starye/db/schema'
import type { AppEnv } from '../../../types'
import { createQuantAkshareBridge } from '../../../domain/quant/akshare-bridge'
import { QuantError } from '../../../domain/quant/errors'
import { screenMomentum } from '../../../domain/quant/factor'
import { createEastmoneyValuationProvider, mapQuantProviderError } from '../../../domain/quant/provider'
import {
  createQuantResearchRun,
  getQuantFactorConfiguration,
  getQuantWatchlistItem,
  listQuantDailyBars,
  listQuantScanSnapshots,
  normalizeTsCode,
} from '../../../domain/quant/repository'
import { buildQuantResearchReport } from '../../../domain/quant/research-report'
import { readQuantShareholderReturn } from '../../../domain/quant/shareholder-return'
import { eastmoneyProviderOptions } from '../route-context'
import { capitalStructureProvider, cashflowProvider, dividendProvider, financialProvider, repurchaseProvider } from './market-support'
import { akshareBridgeErrorCode, akshareBridgeOptions } from './summary-runtime'

function snapshotIncludesCode(snapshot: { readonly inputTsCodesJson: string }, tsCode: string): boolean {
  try {
    const parsed: unknown = JSON.parse(snapshot.inputTsCodesJson)
    return Array.isArray(parsed) && parsed.some(code => typeof code === 'string' && code.trim().toUpperCase() === tsCode)
  }
  catch {
    return false
  }
}

export async function generateQuantResearchRunForUser(input: {
  readonly db: Database
  readonly env: AppEnv['Bindings']
  readonly userId: string
  readonly tsCode: string
  readonly now?: Date
}): Promise<QuantResearchRunRecord> {
  const tsCode = normalizeTsCode(input.tsCode)
  const watchlistItem = await getQuantWatchlistItem(input.db, input.userId, tsCode)
  if (!watchlistItem)
    throw new QuantError('QUANT_NOT_FOUND', 'Watchlist item not found', 404)

  const [dailyBars, snapshots] = await Promise.all([
    listQuantDailyBars(input.db, { tsCode }),
    listQuantScanSnapshots(input.db, input.userId, 1),
  ])
  const sourceSnapshotId = snapshots[0] && snapshotIncludesCode(snapshots[0], tsCode)
    ? snapshots[0].id
    : null
  const candidate = screenMomentum({ [tsCode]: dailyBars }).find(item => item.tsCode === tsCode) ?? null
  const factorConfiguration = await getQuantFactorConfiguration(input.db, input.userId)
  const valuationProvider = createEastmoneyValuationProvider(eastmoneyProviderOptions(input.env))
  const financialSourceProvider = financialProvider(input.env)
  const dividendSourceProvider = dividendProvider(input.env)
  const cashflowSourceProvider = cashflowProvider(input.env)
  const akshareBridge = createQuantAkshareBridge(akshareBridgeOptions(input.env))
  const [valuationResult, financialResult, shareholderResult, akshareResult] = await Promise.allSettled([
    valuationProvider.fetchValuation({ tsCode }),
    financialSourceProvider.fetchFinancialQualityHistory({ tsCode, limit: 4 }),
    readQuantShareholderReturn(input.db, input.userId, tsCode, dividendSourceProvider, cashflowSourceProvider, capitalStructureProvider(input.env), repurchaseProvider(input.env)),
    akshareBridge.isConfigured ? akshareBridge.fetchEvidence({ tsCode }) : Promise.resolve(null),
  ])
  const generatedAt = input.now ?? new Date()
  const report = buildQuantResearchReport({
    tsCode,
    name: watchlistItem.name,
    generatedAt,
    sourceSnapshotId,
    candidate,
    dailyBars,
    valuation: valuationResult.status === 'fulfilled' ? valuationResult.value : null,
    financialReports: financialResult.status === 'fulfilled' ? financialResult.value : [],
    shareholderReturn: shareholderResult.status === 'fulfilled' ? shareholderResult.value : null,
    valuationErrorCode: valuationResult.status === 'rejected' ? mapQuantProviderError(valuationResult.reason).code : null,
    financialErrorCode: financialResult.status === 'rejected' ? mapQuantProviderError(financialResult.reason).code : null,
    akshare: akshareResult.status === 'fulfilled' ? akshareResult.value : null,
    akshareConfigured: akshareBridge.isConfigured,
    akshareErrorCode: akshareResult.status === 'rejected' ? akshareBridgeErrorCode(akshareResult.reason) : null,
    factorConfiguration,
  })
  return createQuantResearchRun(input.db, {
    userId: input.userId,
    tsCode,
    name: watchlistItem.name,
    status: report.status,
    reportVersion: report.reportVersion,
    sourceSnapshotId: report.sourceSnapshotId,
    reportJson: JSON.stringify(report),
    generatedAt,
  })
}
