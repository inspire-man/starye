import type { Database } from '@starye/db'
import type { QuantCapitalStructureProvider, QuantCapitalStructureReport, QuantCashflowProvider, QuantCashflowReport, QuantDividendProvider, QuantDividendRecord, QuantInterestBearingDebtComponents, QuantInterestExpenseSourceField, QuantProviderName, QuantRepurchaseProvider, QuantRepurchaseReport } from './provider'
import type { DailyBar } from './types'
import { mapQuantProviderError, QuantDividendProviderChainError } from './provider'
import { getQuantWatchlistItem, listQuantDailyBars, listQuantWatchlist } from './repository'

export const QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION = 'shareholder-return-v1' as const
export const QUANT_SHAREHOLDER_RETURN_CONCURRENCY = 4

export type ShareholderReturnStatus = 'ready' | 'partial' | 'insufficient_data'

export interface QuantShareholderReturnDistribution {
  readonly endDate: string
  readonly annDate: string | null
  readonly cashDividendPerShare: number
  readonly exDate: string | null
  readonly payDate: string | null
}

export const QUANT_SHAREHOLDER_CASHFLOW_FORMULA_VERSION = 'shareholder-cashflow-v2' as const
export const QUANT_SHAREHOLDER_CASHFLOW_HISTORY_FORMULA_VERSION = 'shareholder-cashflow-history-v1' as const

export type QuantShareholderCashflowStatus = 'ready' | 'partial' | 'insufficient_data' | 'unavailable'

export interface QuantShareholderCashflowHistoryItem {
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_CASHFLOW_FORMULA_VERSION
  readonly status: QuantShareholderCashflowStatus
  readonly reportDate: string
  readonly reportType: string | null
  readonly reportDateName: string | null
  readonly noticeDate: string | null
  readonly operatingCashflow: number | null
  readonly capitalExpenditure: number | null
  readonly netProfit: number | null
  readonly cashDividendsPaid: number | null
  readonly freeCashflow: number | null
  readonly freeCashflowCoverage: number | null
  readonly interestExpense: number | null
  readonly interestExpenseSourceField: QuantInterestExpenseSourceField | null
  readonly interestExpenseProviderErrorCode: string | null
  readonly interestBearingDebt: number | null
  readonly interestBearingDebtComponents: QuantInterestBearingDebtComponents
  readonly interestBearingDebtProviderErrorCode: string | null
  readonly freeCashflowAfterInterest: number | null
  readonly payoutRatio: number | null
  readonly missingFields: readonly string[]
}

export interface QuantShareholderCashflowHistorySummary {
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_CASHFLOW_HISTORY_FORMULA_VERSION
  readonly status: QuantShareholderCashflowStatus
  readonly periodCount: number
  readonly coreReadyPeriodCount: number
  readonly positiveFreeCashflowPeriods: number
  readonly positiveFreeCashflowAfterInterestPeriods: number
  readonly coveredDividendPeriods: number
  readonly payoutRatioPeriodCount: number
  readonly latestReportDate: string | null
  readonly missingFields: readonly string[]
}

export interface QuantShareholderCashflowEvidence {
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_CASHFLOW_FORMULA_VERSION
  readonly status: QuantShareholderCashflowStatus
  readonly provider: QuantProviderName | null
  readonly providerErrorCode: string | null
  readonly observedAt: string
  readonly reportDate: string | null
  readonly reportType: string | null
  readonly reportDateName: string | null
  readonly noticeDate: string | null
  readonly operatingCashflow: number | null
  readonly capitalExpenditure: number | null
  readonly netProfit: number | null
  readonly cashDividendsPaid: number | null
  readonly freeCashflow: number | null
  readonly freeCashflowCoverage: number | null
  readonly interestExpense: number | null
  readonly interestExpenseSourceField: QuantInterestExpenseSourceField | null
  readonly interestExpenseProviderErrorCode: string | null
  readonly interestBearingDebt: number | null
  readonly interestBearingDebtComponents: QuantInterestBearingDebtComponents
  readonly interestBearingDebtProviderErrorCode: string | null
  readonly freeCashflowAfterInterest: number | null
  readonly payoutRatio: number | null
  readonly payoutRatioReportDate: string | null
  readonly missingFields: readonly string[]
  /** Optional on historical payloads written before multi-period evidence existed. */
  readonly history?: readonly QuantShareholderCashflowHistoryItem[]
  /** Optional on historical payloads written before multi-period evidence existed. */
  readonly historySummary?: QuantShareholderCashflowHistorySummary
}

export const QUANT_SHAREHOLDER_CAPITAL_FORMULA_VERSION = 'shareholder-capital-v1' as const

export type QuantShareholderCapitalStatus = 'ready' | 'partial' | 'insufficient_data' | 'unavailable'

export interface QuantShareholderCapitalChange {
  readonly reportDate: string
  readonly totalShares: number | null
  readonly changeReason: string | null
  readonly sharesOutstandingChange: number | null
  readonly sharesOutstandingChangeRatio: number | null
}

export interface QuantShareholderCapitalEvidence {
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_CAPITAL_FORMULA_VERSION
  readonly status: QuantShareholderCapitalStatus
  readonly provider: QuantProviderName | null
  readonly providerErrorCode: string | null
  readonly observedAt: string
  readonly latestReportDate: string | null
  readonly latestTotalShares: number | null
  readonly latestChangeReason: string | null
  readonly previousReportDate: string | null
  readonly previousTotalShares: number | null
  readonly sharesOutstandingChange: number | null
  readonly sharesOutstandingChangeRatio: number | null
  readonly repurchaseSharesRetired: number | null
  readonly changes: readonly QuantShareholderCapitalChange[]
  readonly missingFields: readonly string[]
}

export const QUANT_SHAREHOLDER_REPURCHASE_FORMULA_VERSION = 'shareholder-repurchase-v1' as const

export type QuantShareholderRepurchaseStatus = 'ready' | 'partial' | 'insufficient_data' | 'unavailable'

export interface QuantShareholderRepurchaseRecord {
  readonly repurchaseCode: string | null
  readonly announcementDate: string | null
  readonly startDate: string | null
  readonly endDate: string | null
  readonly finishDate: string | null
  readonly progress: string | null
  readonly plannedAmountLower: number | null
  readonly plannedAmountUpper: number | null
  readonly repurchaseAmount: number | null
  readonly repurchaseShares: number | null
}

export interface QuantShareholderRepurchaseEvidence {
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_REPURCHASE_FORMULA_VERSION
  readonly status: QuantShareholderRepurchaseStatus
  readonly provider: QuantProviderName | null
  readonly providerErrorCode: string | null
  readonly observedAt: string
  readonly latestAnnouncementDate: string | null
  readonly latestProgress: string | null
  readonly repurchaseAmount: number | null
  readonly plannedAmountLower: number | null
  readonly plannedAmountUpper: number | null
  readonly records: readonly QuantShareholderRepurchaseRecord[]
  readonly missingFields: readonly string[]
}

export interface QuantShareholderReturnItem {
  readonly tsCode: string
  readonly name: string | null
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION
  readonly status: ShareholderReturnStatus
  readonly provider: QuantProviderName | null
  readonly providerChain: readonly QuantProviderName[]
  readonly fallbackUsed: boolean
  readonly fallbackReason: string | null
  readonly providerErrorCode: string | null
  readonly observedAt: string
  readonly latestClose: number | null
  readonly trailingCashDividendPerShare: number | null
  readonly trailingDividendYield: number | null
  readonly dividendYears: number
  readonly distributions: readonly QuantShareholderReturnDistribution[]
  readonly missingFields: readonly string[]
  readonly cashflowEvidence?: QuantShareholderCashflowEvidence
  readonly capitalStructureEvidence?: QuantShareholderCapitalEvidence
  readonly repurchaseEvidence?: QuantShareholderRepurchaseEvidence
}

export interface QuantShareholderReturnBatchResult {
  readonly formulaVersion: typeof QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION
  readonly observedAt: string
  readonly provider: QuantProviderName | null
  readonly providerChain: readonly QuantProviderName[]
  readonly sampleCount: number
  readonly readyCount: number
  readonly partialCount: number
  readonly insufficientCount: number
  readonly items: readonly QuantShareholderReturnItem[]
}

export interface ShareholderReturnInput {
  readonly tsCode: string
  readonly name: string | null
  readonly dividends: readonly QuantDividendRecord[]
  readonly dailyBars: readonly DailyBar[]
  readonly dividendErrorCode: string | null
  readonly dividendProvider?: QuantProviderName | null
  readonly providerChain?: readonly QuantProviderName[]
  readonly fallbackUsed?: boolean
  readonly fallbackReason?: string | null
  readonly cashflowReports?: readonly QuantCashflowReport[]
  readonly cashflowProvider?: QuantProviderName | null
  readonly cashflowErrorCode?: string | null
  readonly capitalStructureReports?: readonly QuantCapitalStructureReport[]
  readonly capitalStructureProvider?: QuantProviderName | null
  readonly capitalStructureErrorCode?: string | null
  readonly repurchaseReports?: readonly QuantRepurchaseReport[]
  readonly repurchaseProvider?: QuantProviderName | null
  readonly repurchaseErrorCode?: string | null
  readonly observedAt: string
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function latestClose(bars: readonly DailyBar[]): number | null {
  const sorted = [...bars]
    .filter(bar => Number.isFinite(bar.close) && bar.close > 0)
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
  return finite(sorted.at(-1)?.close)
}

function effectiveDate(record: QuantDividendRecord): string | null {
  return record.payDate ?? record.exDate
}

function dateValue(value: string): number | null {
  const normalized = value.length === 8
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value
  const timestamp = Date.parse(`${normalized}T00:00:00.000Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function implementedDistributions(records: readonly QuantDividendRecord[]): readonly QuantDividendRecord[] {
  return records
    .filter(record => record.divProc === '实施' && (record.cashDiv ?? 0) > 0 && effectiveDate(record) !== null)
    .sort((left, right) => (dateValue(effectiveDate(right)!) ?? 0) - (dateValue(effectiveDate(left)!) ?? 0))
}

function buildDistributions(records: readonly QuantDividendRecord[]): readonly QuantShareholderReturnDistribution[] {
  return records.slice(0, 12).map(record => ({
    endDate: record.endDate,
    annDate: record.annDate,
    cashDividendPerShare: record.cashDiv!,
    exDate: record.exDate,
    payDate: record.payDate,
  }))
}

function isAnnualReport(report: QuantCashflowReport): boolean {
  return report.reportDate.endsWith('-12-31')
}

function emptyInterestBearingDebtComponents(): QuantInterestBearingDebtComponents {
  return {
    shortLoan: null,
    shortBondPayable: null,
    shortFinancePayable: null,
    acceptDepositInterbank: null,
    borrowFund: null,
    loanPbc: null,
    currentMaturityDebt: null,
    amortizedCostFinancialLiability: null,
    longLoan: null,
    amortizedCostNoncurrentFinancialLiability: null,
    bondPayable: null,
    perpetualBond: null,
    perpetualBondPayable: null,
    leaseLiability: null,
  }
}

function sortedCashflowReports(reports: readonly QuantCashflowReport[]): readonly QuantCashflowReport[] {
  return [...new Map(reports.map(report => [report.reportDate, report] as const)).values()]
    .sort((left, right) => right.reportDate.localeCompare(left.reportDate))
    .slice(0, 8)
}

function buildCashflowHistoryItem(report: QuantCashflowReport, cashflowErrorCode: string | null): QuantShareholderCashflowHistoryItem {
  const operatingCashflow = finite(report.operatingCashflow)
  const capitalExpenditure = finite(report.capitalExpenditure)
  const netProfit = finite(report.netProfit)
  const cashDividendsPaid = finite(report.cashDividendsPaid)
  const interestExpense = finite(report.interestExpense)
  const interestBearingDebt = finite(report.interestBearingDebt)
  const freeCashflow = operatingCashflow !== null && capitalExpenditure !== null
    ? round(operatingCashflow - capitalExpenditure, 2)
    : null
  const freeCashflowCoverage = freeCashflow !== null && cashDividendsPaid !== null && cashDividendsPaid > 0
    ? round(freeCashflow / cashDividendsPaid, 2)
    : null
  const freeCashflowAfterInterest = freeCashflow !== null && interestExpense !== null
    ? round(freeCashflow - interestExpense, 2)
    : null
  const payoutRatio = isAnnualReport(report) && netProfit !== null && netProfit > 0 && cashDividendsPaid !== null
    ? round(cashDividendsPaid / netProfit * 100, 2)
    : null
  const missingFields: string[] = []

  if (cashflowErrorCode)
    missingFields.push(`现金流量表暂不可用（${cashflowErrorCode}）`)
  if (operatingCashflow === null)
    missingFields.push('经营活动净现金流')
  if (capitalExpenditure === null)
    missingFields.push('购建长期资产支出')
  if (netProfit === null)
    missingFields.push('现金流量表净利润')
  if (cashDividendsPaid === null)
    missingFields.push('同报告期已分配现金股利')
  if (interestExpense === null)
    missingFields.push('利息支出')
  if (report.interestExpenseProviderErrorCode)
    missingFields.push(`利息支出来源暂不可用（${report.interestExpenseProviderErrorCode}）`)
  if (interestBearingDebt === null)
    missingFields.push('有息负债')
  if (report.interestBearingDebtProviderErrorCode)
    missingFields.push(`有息负债来源暂不可用（${report.interestBearingDebtProviderErrorCode}）`)
  if (isAnnualReport(report) && payoutRatio === null)
    missingFields.push('年度分红支付率')

  const status: QuantShareholderCashflowStatus = cashflowErrorCode
    ? 'unavailable'
    : operatingCashflow !== null && capitalExpenditure !== null
      ? 'ready'
      : 'partial'

  return {
    formulaVersion: QUANT_SHAREHOLDER_CASHFLOW_FORMULA_VERSION,
    status,
    reportDate: report.reportDate,
    reportType: report.reportType,
    reportDateName: report.reportDateName,
    noticeDate: report.noticeDate,
    operatingCashflow,
    capitalExpenditure,
    netProfit,
    cashDividendsPaid,
    freeCashflow,
    freeCashflowCoverage,
    interestExpense,
    interestExpenseSourceField: report.interestExpenseSourceField,
    interestExpenseProviderErrorCode: report.interestExpenseProviderErrorCode,
    interestBearingDebt,
    interestBearingDebtComponents: report.interestBearingDebtComponents,
    interestBearingDebtProviderErrorCode: report.interestBearingDebtProviderErrorCode,
    freeCashflowAfterInterest,
    payoutRatio,
    missingFields: [...new Set(missingFields)],
  }
}

function buildCashflowHistorySummary(
  history: readonly QuantShareholderCashflowHistoryItem[],
  cashflowErrorCode: string | null,
): QuantShareholderCashflowHistorySummary {
  const missingFields: string[] = []
  if (cashflowErrorCode)
    missingFields.push(`现金流历史暂不可用（${cashflowErrorCode}）`)
  if (history.length < 2)
    missingFields.push('至少两期现金流报告')
  if (history.filter(item => item.freeCashflow !== null).length < 2)
    missingFields.push('至少两期自由现金流')
  if (history.filter(item => item.freeCashflowAfterInterest !== null).length < 2)
    missingFields.push('至少两期利息后自由现金流')
  if (history.filter(item => item.freeCashflowCoverage !== null).length < 2)
    missingFields.push('至少两期同报告期分红覆盖')
  if (history.filter(item => item.payoutRatio !== null).length < 1)
    missingFields.push('至少一个完整年度分红支付率')

  const status: QuantShareholderCashflowStatus = cashflowErrorCode
    ? 'unavailable'
    : history.length === 0
      ? 'insufficient_data'
      : history.length >= 2 && history.filter(item => item.status === 'ready').length >= 2
        ? 'ready'
        : 'partial'

  return {
    formulaVersion: QUANT_SHAREHOLDER_CASHFLOW_HISTORY_FORMULA_VERSION,
    status,
    periodCount: history.length,
    coreReadyPeriodCount: history.filter(item => item.status === 'ready').length,
    positiveFreeCashflowPeriods: history.filter(item => item.freeCashflow !== null && item.freeCashflow >= 0).length,
    positiveFreeCashflowAfterInterestPeriods: history.filter(item => item.freeCashflowAfterInterest !== null && item.freeCashflowAfterInterest >= 0).length,
    coveredDividendPeriods: history.filter(item => item.freeCashflowCoverage !== null && item.freeCashflowCoverage >= 1).length,
    payoutRatioPeriodCount: history.filter(item => item.payoutRatio !== null).length,
    latestReportDate: history[0]?.reportDate ?? null,
    missingFields: [...new Set(missingFields)],
  }
}

function buildCashflowEvidence(input: ShareholderReturnInput): QuantShareholderCashflowEvidence {
  const reports = sortedCashflowReports(input.cashflowReports ?? [])
  const history = reports.map(report => buildCashflowHistoryItem(report, input.cashflowErrorCode ?? null))
  const historySummary = buildCashflowHistorySummary(history, input.cashflowErrorCode ?? null)
  const latest = reports[0]
  const latestPeriod = history[0]
  const operatingCashflow = latestPeriod?.operatingCashflow ?? null
  const capitalExpenditure = latestPeriod?.capitalExpenditure ?? null
  const netProfit = finite(latest?.netProfit)
  const cashDividendsPaid = finite(latest?.cashDividendsPaid)
  const interestExpense = finite(latest?.interestExpense)
  const interestBearingDebt = finite(latest?.interestBearingDebt)
  const interestBearingDebtComponents = latest?.interestBearingDebtComponents ?? emptyInterestBearingDebtComponents()
  const freeCashflow = operatingCashflow !== null && capitalExpenditure !== null
    ? round(operatingCashflow - capitalExpenditure, 2)
    : null
  const freeCashflowCoverage = freeCashflow !== null && cashDividendsPaid !== null && cashDividendsPaid > 0
    ? round(freeCashflow / cashDividendsPaid, 2)
    : null
  const freeCashflowAfterInterest = operatingCashflow !== null && capitalExpenditure !== null && interestExpense !== null
    ? round(operatingCashflow - capitalExpenditure - interestExpense, 2)
    : null
  const annualPayoutReport = reports.find((report) => {
    const annualProfit = finite(report.netProfit)
    const annualDividends = finite(report.cashDividendsPaid)
    return isAnnualReport(report) && annualProfit !== null && annualProfit > 0 && annualDividends !== null
  })
  const payoutRatio = annualPayoutReport
    ? round(annualPayoutReport.cashDividendsPaid! / annualPayoutReport.netProfit! * 100, 2)
    : null
  const missingFields: string[] = []

  if (input.cashflowErrorCode)
    missingFields.push(`现金流量表暂不可用（${input.cashflowErrorCode}）`)
  if (!latest)
    missingFields.push('现金流量表报告')
  if (operatingCashflow === null)
    missingFields.push('经营活动净现金流')
  if (capitalExpenditure === null)
    missingFields.push('购建长期资产支出')
  if (netProfit === null)
    missingFields.push('现金流量表净利润')
  if (cashDividendsPaid === null)
    missingFields.push('同报告期已分配现金股利')
  if (interestExpense === null)
    missingFields.push('利息支出')
  if (latest?.interestExpenseProviderErrorCode)
    missingFields.push(`利息支出来源暂不可用（${latest.interestExpenseProviderErrorCode}）`)
  if (interestBearingDebt === null)
    missingFields.push('有息负债')
  if (latest?.interestBearingDebtProviderErrorCode)
    missingFields.push(`有息负债来源暂不可用（${latest.interestBearingDebtProviderErrorCode}）`)
  if (payoutRatio === null)
    missingFields.push('最近完整年度分红支付率')

  let status: QuantShareholderCashflowStatus
  if (input.cashflowErrorCode)
    status = 'unavailable'
  else if (!latest)
    status = 'insufficient_data'
  else if (operatingCashflow !== null && capitalExpenditure !== null)
    status = 'ready'
  else
    status = 'partial'

  return {
    formulaVersion: QUANT_SHAREHOLDER_CASHFLOW_FORMULA_VERSION,
    status,
    provider: input.cashflowProvider ?? null,
    providerErrorCode: input.cashflowErrorCode ?? null,
    observedAt: input.observedAt,
    reportDate: latest?.reportDate ?? null,
    reportType: latest?.reportType ?? null,
    reportDateName: latest?.reportDateName ?? null,
    noticeDate: latest?.noticeDate ?? null,
    operatingCashflow,
    capitalExpenditure,
    netProfit,
    cashDividendsPaid,
    freeCashflow,
    freeCashflowCoverage,
    interestExpense,
    interestExpenseSourceField: latest?.interestExpenseSourceField ?? null,
    interestExpenseProviderErrorCode: latest?.interestExpenseProviderErrorCode ?? null,
    interestBearingDebt,
    interestBearingDebtComponents,
    interestBearingDebtProviderErrorCode: latest?.interestBearingDebtProviderErrorCode ?? null,
    freeCashflowAfterInterest,
    payoutRatio,
    payoutRatioReportDate: annualPayoutReport?.reportDate ?? null,
    missingFields: [...new Set(missingFields)],
    history,
    historySummary,
  }
}

function buildCapitalStructureEvidence(input: ShareholderReturnInput): QuantShareholderCapitalEvidence {
  const reports = input.capitalStructureReports ?? []
  const latest = reports[0]
  const previous = reports[1]
  const latestTotalShares = finite(latest?.totalShares)
  const previousTotalShares = finite(previous?.totalShares)
  const change = latestTotalShares !== null && previousTotalShares !== null
    ? round(latestTotalShares - previousTotalShares, 0)
    : null
  const changeRatio = change !== null && previousTotalShares !== null && previousTotalShares > 0
    ? round(change / previousTotalShares * 100, 2)
    : null
  const changes = reports.map((report, index) => {
    const prior = reports[index + 1]
    const totalShares = finite(report.totalShares)
    const priorTotalShares = finite(prior?.totalShares)
    const sharesOutstandingChange = totalShares !== null && priorTotalShares !== null
      ? round(totalShares - priorTotalShares, 0)
      : null
    return {
      reportDate: report.reportDate,
      totalShares,
      changeReason: report.changeReason,
      sharesOutstandingChange,
      sharesOutstandingChangeRatio: sharesOutstandingChange !== null && priorTotalShares !== null && priorTotalShares > 0
        ? round(sharesOutstandingChange / priorTotalShares * 100, 2)
        : null,
    }
  })
  const repurchaseSharesRetired = reports.length > 0
    ? round(changes.reduce((total, item) => total + (item.changeReason?.includes('回购') && item.sharesOutstandingChange !== null && item.sharesOutstandingChange < 0 ? Math.abs(item.sharesOutstandingChange) : 0), 0), 0)
    : null
  const missingFields: string[] = []

  if (input.capitalStructureErrorCode)
    missingFields.push(`股本结构暂不可用（${input.capitalStructureErrorCode}）`)
  if (!latest)
    missingFields.push('股本变动报告')
  if (latestTotalShares === null)
    missingFields.push('最新总股本')
  if (!previous)
    missingFields.push('上一条股本变动报告')
  if (previousTotalShares === null)
    missingFields.push('上一条总股本')
  if (change === null)
    missingFields.push('相邻股本变化')
  if (latest?.changeReason === null || latest?.changeReason === undefined)
    missingFields.push('最新股本变动原因')

  let status: QuantShareholderCapitalStatus
  if (input.capitalStructureErrorCode)
    status = 'unavailable'
  else if (!latest)
    status = 'insufficient_data'
  else if (latestTotalShares !== null && previousTotalShares !== null && latest.changeReason !== null)
    status = 'ready'
  else
    status = 'partial'

  return {
    formulaVersion: QUANT_SHAREHOLDER_CAPITAL_FORMULA_VERSION,
    status,
    provider: input.capitalStructureProvider ?? null,
    providerErrorCode: input.capitalStructureErrorCode ?? null,
    observedAt: input.observedAt,
    latestReportDate: latest?.reportDate ?? null,
    latestTotalShares,
    latestChangeReason: latest?.changeReason ?? null,
    previousReportDate: previous?.reportDate ?? null,
    previousTotalShares,
    sharesOutstandingChange: change,
    sharesOutstandingChangeRatio: changeRatio,
    repurchaseSharesRetired,
    changes,
    missingFields: [...new Set(missingFields)],
  }
}

function sumFinite(values: readonly (number | null | undefined)[]): number | null {
  const numbers = values.flatMap((value) => {
    const numeric = finite(value)
    return numeric === null ? [] : [numeric]
  })
  return numbers.length ? round(numbers.reduce((total, value) => total + value, 0), 2) : null
}

function buildRepurchaseEvidence(input: ShareholderReturnInput): QuantShareholderRepurchaseEvidence {
  const reports = input.repurchaseReports ?? []
  const records = reports.map(report => ({
    repurchaseCode: report.repurchaseCode,
    announcementDate: report.announcementDate,
    startDate: report.startDate,
    endDate: report.endDate,
    finishDate: report.finishDate,
    progress: report.progress,
    plannedAmountLower: finite(report.plannedAmountLower),
    plannedAmountUpper: finite(report.plannedAmountUpper),
    repurchaseAmount: finite(report.repurchaseAmount),
    repurchaseShares: finite(report.repurchaseShares),
  } satisfies QuantShareholderRepurchaseRecord))
  const repurchaseAmount = sumFinite(records.map(record => record.repurchaseAmount))
  const plannedAmountLower = sumFinite(records.map(record => record.plannedAmountLower))
  const plannedAmountUpper = sumFinite(records.map(record => record.plannedAmountUpper))
  const latest = records[0]
  const missingFields: string[] = []

  if (input.repurchaseErrorCode)
    missingFields.push(`回购计划暂不可用（${input.repurchaseErrorCode}）`)
  if (!records.length)
    missingFields.push('回购计划记录')
  if (repurchaseAmount === null)
    missingFields.push('已实施回购金额')
  if (plannedAmountLower === null || plannedAmountUpper === null)
    missingFields.push('回购计划金额区间')

  let status: QuantShareholderRepurchaseStatus
  if (input.repurchaseErrorCode)
    status = 'unavailable'
  else if (!records.length)
    status = 'insufficient_data'
  else if (repurchaseAmount !== null)
    status = 'ready'
  else
    status = 'partial'

  return {
    formulaVersion: QUANT_SHAREHOLDER_REPURCHASE_FORMULA_VERSION,
    status,
    provider: input.repurchaseProvider ?? null,
    providerErrorCode: input.repurchaseErrorCode ?? null,
    observedAt: input.observedAt,
    latestAnnouncementDate: latest?.announcementDate ?? null,
    latestProgress: latest?.progress ?? null,
    repurchaseAmount,
    plannedAmountLower,
    plannedAmountUpper,
    records,
    missingFields: [...new Set(missingFields)],
  }
}

export function buildShareholderReturnResult(input: ShareholderReturnInput): QuantShareholderReturnItem {
  const now = Date.parse(input.observedAt)
  const cutoff = Number.isFinite(now) ? now - 365 * 24 * 60 * 60 * 1000 : null
  const implemented = implementedDistributions(input.dividends)
  const trailing = implemented.filter((record) => {
    const date = effectiveDate(record)
    const timestamp = date ? dateValue(date) : null
    return timestamp !== null && cutoff !== null && timestamp > cutoff && timestamp <= now
  })
  const close = latestClose(input.dailyBars)
  const trailingCashDividendPerShare = trailing.length > 0
    ? round(trailing.reduce((total, record) => total + (record.cashDiv ?? 0), 0))
    : null
  const trailingDividendYield = trailingCashDividendPerShare !== null && close !== null && close > 0
    ? round(trailingCashDividendPerShare / close * 100, 2)
    : null
  const currentYear = Number.parseInt(input.observedAt.slice(0, 4), 10)
  const dividendYears = new Set(
    implemented
      .map(record => Number.parseInt(record.endDate.slice(0, 4), 10))
      .filter(year => Number.isFinite(year) && year >= currentYear - 4 && year <= currentYear),
  ).size
  const missingFields: string[] = []

  if (input.dividendErrorCode)
    missingFields.push(`分红数据暂不可用（${input.dividendErrorCode}）`)
  if (!implemented.length)
    missingFields.push('已实施现金分红记录')
  if (!trailing.length)
    missingFields.push('近 12 个月已实施现金分红')
  if (close === null)
    missingFields.push('观察池最新正收盘价')

  const status: ShareholderReturnStatus = input.dividendErrorCode
    ? 'partial'
    : trailingDividendYield !== null
      ? 'ready'
      : implemented.length || close !== null
        ? 'partial'
        : 'insufficient_data'

  const cashflowEvidence = input.cashflowReports !== undefined || input.cashflowErrorCode !== undefined
    ? buildCashflowEvidence(input)
    : undefined
  const capitalStructureEvidence = input.capitalStructureReports !== undefined || input.capitalStructureErrorCode !== undefined
    ? buildCapitalStructureEvidence(input)
    : undefined
  const repurchaseEvidence = input.repurchaseReports !== undefined || input.repurchaseErrorCode !== undefined
    ? buildRepurchaseEvidence(input)
    : undefined

  return {
    tsCode: input.tsCode,
    name: input.name,
    formulaVersion: QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION,
    status,
    provider: input.dividendProvider ?? null,
    providerChain: input.providerChain ?? (input.dividendProvider ? [input.dividendProvider] : []),
    fallbackUsed: input.fallbackUsed ?? false,
    fallbackReason: input.fallbackReason ?? null,
    providerErrorCode: input.dividendErrorCode,
    observedAt: input.observedAt,
    latestClose: close,
    trailingCashDividendPerShare,
    trailingDividendYield,
    dividendYears,
    distributions: buildDistributions(implemented),
    missingFields: [...new Set(missingFields)],
    ...(cashflowEvidence ? { cashflowEvidence } : {}),
    ...(capitalStructureEvidence ? { capitalStructureEvidence } : {}),
    ...(repurchaseEvidence ? { repurchaseEvidence } : {}),
  }
}

function providerErrorCode(error: unknown): string {
  if (error instanceof QuantDividendProviderChainError) {
    const primary = mapQuantProviderError(error.primaryError).code
    const fallback = error.fallbackError ? mapQuantProviderError(error.fallbackError).code : 'QUANT_PROVIDER_CONFIGURATION'
    return `${primary}|${fallback}`
  }
  return mapQuantProviderError(error).code
}

async function readShareholderReturnInput(
  item: { readonly tsCode: string, readonly name: string | null },
  dailyBars: readonly DailyBar[],
  provider: QuantDividendProvider,
  cashflowProvider: QuantCashflowProvider | undefined,
  capitalStructureProvider: QuantCapitalStructureProvider | undefined,
  repurchaseProvider: QuantRepurchaseProvider | undefined,
  observedAt: string,
): Promise<ShareholderReturnInput> {
  const dividendTask = provider.isConfigured
    ? provider.fetchDividends({ tsCode: item.tsCode })
        .then(result => ({
          dividends: result.records,
          dividendErrorCode: null as string | null,
          dividendProvider: result.provider as QuantProviderName | null,
          fallbackUsed: result.fallbackUsed,
          fallbackReason: result.fallbackReason,
        }))
        .catch(error => ({
          dividends: [] as readonly QuantDividendRecord[],
          dividendErrorCode: providerErrorCode(error),
          dividendProvider: null as QuantProviderName | null,
          fallbackUsed: false,
          fallbackReason: null as string | null,
        }))
    : Promise.resolve({
        dividends: [] as readonly QuantDividendRecord[],
        dividendErrorCode: 'QUANT_PROVIDER_CONFIGURATION',
        dividendProvider: null as QuantProviderName | null,
        fallbackUsed: false,
        fallbackReason: null as string | null,
      })

  const cashflowTask = cashflowProvider
    ? cashflowProvider.isConfigured
      ? cashflowProvider.fetchCashflowHistory({ tsCode: item.tsCode, limit: 8 })
          .then(cashflowReports => ({
            cashflowReports,
            cashflowProvider: cashflowProvider.name as QuantProviderName | null,
            cashflowErrorCode: null as string | null,
          }))
          .catch(error => ({
            cashflowReports: [] as readonly QuantCashflowReport[],
            cashflowProvider: cashflowProvider.name as QuantProviderName | null,
            cashflowErrorCode: mapQuantProviderError(error).code,
          }))
      : Promise.resolve({
          cashflowReports: [] as readonly QuantCashflowReport[],
          cashflowProvider: null as QuantProviderName | null,
          cashflowErrorCode: 'QUANT_PROVIDER_CONFIGURATION',
        })
    : Promise.resolve(null)

  const capitalStructureTask = capitalStructureProvider
    ? capitalStructureProvider.isConfigured
      ? capitalStructureProvider.fetchCapitalStructureHistory({ tsCode: item.tsCode, limit: 12 })
          .then(capitalStructureReports => ({
            capitalStructureReports,
            capitalStructureProvider: capitalStructureProvider.name as QuantProviderName | null,
            capitalStructureErrorCode: null as string | null,
          }))
          .catch(error => ({
            capitalStructureReports: [] as readonly QuantCapitalStructureReport[],
            capitalStructureProvider: capitalStructureProvider.name as QuantProviderName | null,
            capitalStructureErrorCode: mapQuantProviderError(error).code,
          }))
      : Promise.resolve({
          capitalStructureReports: [] as readonly QuantCapitalStructureReport[],
          capitalStructureProvider: null as QuantProviderName | null,
          capitalStructureErrorCode: 'QUANT_PROVIDER_CONFIGURATION',
        })
    : Promise.resolve(null)

  const repurchaseTask = repurchaseProvider
    ? repurchaseProvider.isConfigured
      ? repurchaseProvider.fetchRepurchaseHistory({ tsCode: item.tsCode, limit: 12 })
          .then(repurchaseReports => ({
            repurchaseReports,
            repurchaseProvider: repurchaseProvider.name as QuantProviderName | null,
            repurchaseErrorCode: null as string | null,
          }))
          .catch(error => ({
            repurchaseReports: [] as readonly QuantRepurchaseReport[],
            repurchaseProvider: repurchaseProvider.name as QuantProviderName | null,
            repurchaseErrorCode: mapQuantProviderError(error).code,
          }))
      : Promise.resolve({
          repurchaseReports: [] as readonly QuantRepurchaseReport[],
          repurchaseProvider: null as QuantProviderName | null,
          repurchaseErrorCode: 'QUANT_PROVIDER_CONFIGURATION',
        })
    : Promise.resolve(null)

  const [dividend, cashflow, capitalStructure, repurchase] = await Promise.all([dividendTask, cashflowTask, capitalStructureTask, repurchaseTask])

  return {
    tsCode: item.tsCode,
    name: item.name,
    dividends: dividend.dividends,
    dailyBars,
    dividendErrorCode: dividend.dividendErrorCode,
    dividendProvider: dividend.dividendProvider,
    providerChain: provider.providerChain,
    fallbackUsed: dividend.fallbackUsed,
    fallbackReason: dividend.fallbackReason,
    ...(cashflow
      ? {
          cashflowReports: cashflow.cashflowReports,
          cashflowProvider: cashflow.cashflowProvider,
          cashflowErrorCode: cashflow.cashflowErrorCode,
        }
      : {}),
    ...(capitalStructure
      ? {
          capitalStructureReports: capitalStructure.capitalStructureReports,
          capitalStructureProvider: capitalStructure.capitalStructureProvider,
          capitalStructureErrorCode: capitalStructure.capitalStructureErrorCode,
        }
      : {}),
    ...(repurchase
      ? {
          repurchaseReports: repurchase.repurchaseReports,
          repurchaseProvider: repurchase.repurchaseProvider,
          repurchaseErrorCode: repurchase.repurchaseErrorCode,
        }
      : {}),
    observedAt,
  }
}

type ShareholderNow = () => Date

function isShareholderNow(value: unknown): value is ShareholderNow {
  return typeof value === 'function'
}

export async function readQuantShareholderReturn(
  db: Database,
  userId: string,
  tsCode: string,
  provider: QuantDividendProvider,
  cashflowProviderOrNow?: QuantCashflowProvider | ShareholderNow,
  capitalStructureProviderOrNow?: QuantCapitalStructureProvider | ShareholderNow,
  repurchaseProviderOrNow?: QuantRepurchaseProvider | ShareholderNow,
  now: ShareholderNow = () => new Date(),
): Promise<QuantShareholderReturnItem | null> {
  const cashflowProvider = isShareholderNow(cashflowProviderOrNow) ? undefined : cashflowProviderOrNow
  const capitalStructureProvider = isShareholderNow(cashflowProviderOrNow) || isShareholderNow(capitalStructureProviderOrNow)
    ? undefined
    : capitalStructureProviderOrNow
  const repurchaseProvider = isShareholderNow(cashflowProviderOrNow) || isShareholderNow(capitalStructureProviderOrNow) || isShareholderNow(repurchaseProviderOrNow)
    ? undefined
    : repurchaseProviderOrNow
  const resolvedNow = isShareholderNow(cashflowProviderOrNow)
    ? cashflowProviderOrNow
    : isShareholderNow(capitalStructureProviderOrNow)
      ? capitalStructureProviderOrNow
      : isShareholderNow(repurchaseProviderOrNow) ? repurchaseProviderOrNow : now
  const item = await getQuantWatchlistItem(db, userId, tsCode)
  if (!item)
    return null
  const observedAt = resolvedNow().toISOString()
  const dailyBars = await listQuantDailyBars(db, { tsCode: item.tsCode })
  return buildShareholderReturnResult(await readShareholderReturnInput(item, dailyBars, provider, cashflowProvider, capitalStructureProvider, repurchaseProvider, observedAt))
}

export async function readQuantShareholderReturns(
  db: Database,
  userId: string,
  provider: QuantDividendProvider,
  cashflowProviderOrNow?: QuantCashflowProvider | ShareholderNow,
  capitalStructureProviderOrNow?: QuantCapitalStructureProvider | ShareholderNow,
  repurchaseProviderOrNow?: QuantRepurchaseProvider | ShareholderNow,
  now: ShareholderNow = () => new Date(),
): Promise<QuantShareholderReturnBatchResult> {
  const cashflowProvider = isShareholderNow(cashflowProviderOrNow) ? undefined : cashflowProviderOrNow
  const capitalStructureProvider = isShareholderNow(cashflowProviderOrNow) || isShareholderNow(capitalStructureProviderOrNow)
    ? undefined
    : capitalStructureProviderOrNow
  const repurchaseProvider = isShareholderNow(cashflowProviderOrNow) || isShareholderNow(capitalStructureProviderOrNow) || isShareholderNow(repurchaseProviderOrNow)
    ? undefined
    : repurchaseProviderOrNow
  const resolvedNow = isShareholderNow(cashflowProviderOrNow)
    ? cashflowProviderOrNow
    : isShareholderNow(capitalStructureProviderOrNow)
      ? capitalStructureProviderOrNow
      : isShareholderNow(repurchaseProviderOrNow) ? repurchaseProviderOrNow : now
  const observedAt = resolvedNow().toISOString()
  const watchlist = await listQuantWatchlist(db, userId)
  if (watchlist.length === 0) {
    return {
      formulaVersion: QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION,
      observedAt,
      provider: provider.isConfigured ? provider.name : null,
      providerChain: provider.providerChain,
      sampleCount: 0,
      readyCount: 0,
      partialCount: 0,
      insufficientCount: 0,
      items: [],
    }
  }

  const dailyBars = await Promise.all(watchlist.map(async item => [
    item.tsCode,
    await listQuantDailyBars(db, { tsCode: item.tsCode }),
  ] as const))
  const barsByCode = new Map(dailyBars)
  const inputs: Array<ShareholderReturnInput | undefined> = Array.from({ length: watchlist.length })
  let nextIndex = 0
  const workerCount = Math.min(QUANT_SHAREHOLDER_RETURN_CONCURRENCY, watchlist.length)

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < watchlist.length) {
      const index = nextIndex++
      const item = watchlist[index]!
      inputs[index] = await readShareholderReturnInput(item, barsByCode.get(item.tsCode) ?? [], provider, cashflowProvider, capitalStructureProvider, repurchaseProvider, observedAt)
    }
  }))

  const items = inputs
    .filter((input): input is ShareholderReturnInput => input !== undefined)
    .map(buildShareholderReturnResult)
  return {
    formulaVersion: QUANT_SHAREHOLDER_RETURN_FORMULA_VERSION,
    observedAt,
    provider: provider.isConfigured ? provider.name : null,
    providerChain: provider.providerChain,
    sampleCount: items.length,
    readyCount: items.filter(item => item.status === 'ready').length,
    partialCount: items.filter(item => item.status === 'partial').length,
    insufficientCount: items.filter(item => item.status === 'insufficient_data').length,
    items,
  }
}
