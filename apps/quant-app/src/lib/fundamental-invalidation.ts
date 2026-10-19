import type { QuantInvalidationCheck } from '../api/resources/research'
import type { QuantFinancialIndustry, QuantFinancialIndustryMetrics, QuantFinancialQualitySnapshot, QuantResearchEvidence, QuantValuationSnapshot } from './quant-view-models'

type EvidenceStatus = QuantInvalidationCheck['savedStatus']
type SourceState = 'pending' | 'ready' | 'failed'

const STATUS_RANK = { pass: 0, caution: 1, fail: 2, missing: 3 } as const

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function statusFor(value: number | null, pass: (value: number) => boolean, caution?: (value: number) => boolean): EvidenceStatus {
  if (value === null)
    return 'missing'
  if (pass(value))
    return 'pass'
  return caution?.(value) ? 'caution' : 'fail'
}

function changeFor(saved: EvidenceStatus, current: EvidenceStatus): QuantInvalidationCheck['change'] {
  if (saved === 'missing' || current === 'missing')
    return 'unavailable'
  if (saved === current)
    return 'unchanged'
  return STATUS_RANK[current] > STATUS_RANK[saved] ? 'triggered' : 'recovered'
}

function valuationStatus(key: string, valuation: Pick<QuantValuationSnapshot, 'peTtm' | 'pb' | 'ps' | 'peg'>): EvidenceStatus | null {
  if (key === 'valuation-pe')
    return statusFor(finite(valuation.peTtm), value => value > 0)
  if (key === 'valuation-pb')
    return statusFor(finite(valuation.pb), value => value > 0)
  if (key === 'valuation-ps')
    return statusFor(finite(valuation.ps), value => value > 0)
  if (key === 'valuation-peg')
    return statusFor(finite(valuation.peg), value => value > 0)
  return null
}

function qualityStatus(
  key: string,
  financial: Pick<QuantFinancialQualitySnapshot, 'industry' | 'revenueYoY' | 'netProfitYoY' | 'adjustedNetProfitYoY' | 'roe' | 'grossMargin' | 'netMargin' | 'operatingCashflowToRevenue' | 'debtAssetRatio' | 'industryMetrics'>,
  reportCount: number,
): EvidenceStatus | null {
  const industry: QuantFinancialIndustry = financial.industry ?? 'general'
  const metrics: QuantFinancialIndustryMetrics | undefined = financial.industryMetrics
  if (key === 'quality-revenue-growth')
    return statusFor(finite(financial.revenueYoY), value => value >= 0, value => value >= -10)
  if (key === 'quality-profit')
    return statusFor(finite(financial.netProfitYoY), value => value >= 0)
  if (key === 'quality-adjusted-profit')
    return statusFor(finite(financial.adjustedNetProfitYoY), value => value >= 0, value => value >= -10)
  if (key === 'quality-roe')
    return statusFor(finite(financial.roe), value => value >= 10, value => value >= 0)
  if (key === 'quality-gross-margin')
    return industry === 'general' ? statusFor(finite(financial.grossMargin), value => value > 0) : 'missing'
  if (key === 'quality-net-margin')
    return statusFor(finite(financial.netMargin), value => value > 0)
  if (key === 'quality-cashflow')
    return industry === 'general' ? statusFor(finite(financial.operatingCashflowToRevenue), value => value >= 0) : 'missing'
  if (key === 'quality-debt-asset')
    return industry === 'general' ? statusFor(finite(financial.debtAssetRatio), value => value <= 60, value => value <= 75) : 'missing'
  if (key === 'quality-history')
    return reportCount >= 2 ? 'pass' : reportCount === 1 ? 'caution' : 'missing'
  if (industry === 'insurance' && key === 'quality-insurance-solvency')
    return statusFor(finite(metrics?.insuranceSolvencyRatio), value => value >= 100, value => value >= 100)
  if (industry === 'insurance' && key === 'quality-insurance-net-investment-return')
    return statusFor(finite(metrics?.insuranceNetInvestmentReturn), value => value >= 0, value => value >= 0)
  if (industry === 'insurance' && key === 'quality-insurance-new-business-value')
    return statusFor(finite(metrics?.insuranceNewBusinessValueRate), value => value >= 0, value => value >= 0)
  if (industry === 'bank' && key === 'quality-bank-core-tier1')
    return statusFor(finite(metrics?.bankCoreTier1CapitalAdequacyRatio), value => value >= 8.5, value => value >= 8.5)
  if (industry === 'bank' && key === 'quality-bank-net-interest-margin')
    return statusFor(finite(metrics?.bankNetInterestMargin), value => value >= 0, value => value >= 0)
  if (industry === 'bank' && key === 'quality-bank-loan-provision')
    return statusFor(finite(metrics?.bankLoanProvisionRatio), value => value >= 0, value => value >= 0)
  return null
}

export function buildFundamentalInvalidationChecks(input: {
  readonly evidence: readonly Pick<QuantResearchEvidence, 'key' | 'label' | 'status'>[]
  readonly valuation: Pick<QuantValuationSnapshot, 'peTtm' | 'pb' | 'ps' | 'peg'> | null
  readonly valuationState: SourceState
  readonly financial: Pick<QuantFinancialQualitySnapshot, 'industry' | 'revenueYoY' | 'netProfitYoY' | 'adjustedNetProfitYoY' | 'roe' | 'grossMargin' | 'netMargin' | 'operatingCashflowToRevenue' | 'debtAssetRatio' | 'industryMetrics'> | null
  readonly financialCount: number
  readonly financialState: SourceState
}): QuantInvalidationCheck[] {
  return input.evidence.flatMap((item): QuantInvalidationCheck[] => {
    const valuationKey = item.key.startsWith('valuation-')
    const qualityKey = item.key.startsWith('quality-')
    if (!valuationKey && !qualityKey)
      return []
    const state = valuationKey ? input.valuationState : input.financialState
    if (state === 'pending')
      return []
    const current = state === 'failed'
      ? 'missing'
      : valuationKey
        ? (input.valuation ? valuationStatus(item.key, input.valuation) : 'missing')
        : (input.financial ? qualityStatus(item.key, input.financial, input.financialCount) : 'missing')
    if (current === null)
      return []
    const change = changeFor(item.status, current)
    if (change === 'unchanged' || (change === 'unavailable' && item.status === 'missing'))
      return []
    return [{
      key: item.key,
      label: item.label,
      savedStatus: item.status,
      currentStatus: current,
      change,
    }]
  })
}

function shareholderStatus(key: string, shareholder: {
  readonly trailingDividendYield: number | null
  readonly cashflowEvidence?: {
    readonly freeCashflow: number | null
    readonly freeCashflowCoverage: number | null
    readonly interestExpense: number | null
    readonly interestBearingDebt: number | null
    readonly freeCashflowAfterInterest: number | null
    readonly payoutRatio: number | null
    readonly historySummary?: { readonly status: 'ready' | 'partial' | 'insufficient_data' | 'unavailable' } | null
  } | null
  readonly capitalStructureEvidence?: {
    readonly sharesOutstandingChange: number | null
    readonly repurchaseSharesRetired: number | null
  } | null
  readonly repurchaseEvidence?: { readonly repurchaseAmount: number | null } | null
}): EvidenceStatus | null {
  const cashflow = shareholder.cashflowEvidence
  const capital = shareholder.capitalStructureEvidence
  const repurchase = shareholder.repurchaseEvidence
  if (key === 'shareholder-yield')
    return statusFor(finite(shareholder.trailingDividendYield), value => value > 0)
  if (key === 'shareholder-free-cashflow')
    return cashflow ? statusFor(finite(cashflow.freeCashflow), value => value >= 0, value => value < 0) : 'missing'
  if (key === 'shareholder-cashflow-coverage')
    return cashflow ? statusFor(finite(cashflow.freeCashflowCoverage), value => value >= 1, value => value >= 0) : 'missing'
  if (key === 'shareholder-interest-expense')
    return cashflow ? statusFor(finite(cashflow.interestExpense), () => true) : 'missing'
  if (key === 'shareholder-interest-bearing-debt')
    return cashflow ? statusFor(finite(cashflow.interestBearingDebt), () => true) : 'missing'
  if (key === 'shareholder-free-cashflow-after-interest')
    return cashflow ? statusFor(finite(cashflow.freeCashflowAfterInterest), value => value >= 0, value => value < 0) : 'missing'
  if (key === 'shareholder-payout-ratio')
    return cashflow ? statusFor(finite(cashflow.payoutRatio), value => value >= 0 && value <= 100, value => value <= 120) : 'missing'
  if (key === 'shareholder-cashflow-history') {
    if (!cashflow)
      return 'missing'
    const historyStatus = cashflow.historySummary?.status
    return historyStatus === 'ready' ? 'pass' : historyStatus === 'partial' ? 'caution' : 'missing'
  }
  if (key === 'shareholder-shares-outstanding-change')
    return capital ? statusFor(finite(capital.sharesOutstandingChange), () => true) : 'missing'
  if (key === 'shareholder-repurchase-shares')
    return capital ? statusFor(finite(capital.repurchaseSharesRetired), value => value >= 0) : 'missing'
  if (key === 'shareholder-repurchase-amount')
    return repurchase ? statusFor(finite(repurchase.repurchaseAmount), value => value >= 0, value => value >= 0) : 'missing'
  return null
}

export function buildShareholderInvalidationChecks(input: {
  readonly evidence: readonly Pick<QuantResearchEvidence, 'key' | 'label' | 'status'>[]
  readonly shareholder: Parameters<typeof shareholderStatus>[1] | null
  readonly shareholderState: SourceState
}): QuantInvalidationCheck[] {
  return input.evidence.flatMap((item): QuantInvalidationCheck[] => {
    if (!item.key.startsWith('shareholder-') || input.shareholderState === 'pending')
      return []
    const current = input.shareholderState === 'failed' || !input.shareholder
      ? 'missing'
      : shareholderStatus(item.key, input.shareholder)
    if (current === null)
      return []
    const change = changeFor(item.status, current)
    if (change === 'unchanged' || (change === 'unavailable' && item.status === 'missing'))
      return []
    return [{
      key: item.key,
      label: item.label,
      savedStatus: item.status,
      currentStatus: current,
      change,
    }]
  })
}
