import type { QuantAkshareBridgeResult, QuantAkshareProfitForecast } from './akshare-bridge'
import type { QuantDecisionProjection, QuantFactorModel } from './decision-recommendation'
import type { QuantFactorConfiguration } from './factor-configuration'
import type { QuantFinancialQualitySnapshot, QuantValuationSnapshot } from './provider'
import type { QuantShareholderReturnItem } from './shareholder-return'
import type { DailyBar, MomentumCandidate } from './types'
import { buildQuantDecisionProjection } from './decision-recommendation'

export const QUANT_RESEARCH_REPORT_V1_VERSION = 'research-report-v1' as const
export const QUANT_RESEARCH_REPORT_VERSION = 'research-report-v2' as const

export type QuantResearchReportStatus = 'ready' | 'partial' | 'insufficient_data'
export type QuantResearchEvidenceStatus = 'pass' | 'caution' | 'fail' | 'missing'
export type QuantResearchDimension = 'trend' | 'valuation' | 'quality' | 'shareholder-return' | 'risk'
export type QuantResearchAction = 'research-window' | 'wait-confirmation' | 'reassess' | 'complete-data'

export interface QuantResearchEvidence {
  readonly key: string
  readonly dimension: QuantResearchDimension
  readonly label: string
  readonly status: QuantResearchEvidenceStatus
  readonly value: number | null
  readonly threshold: string
  readonly source: string
  readonly observedAt: string | null
  readonly formulaVersion: string
  readonly detail: string
  readonly optional?: boolean
  readonly applicability?: 'applicable' | 'not_applicable'
}

export interface QuantResearchSource {
  readonly id: string
  readonly name: string
  readonly observedAt: string | null
  readonly formulaVersion: string
}

export interface QuantResearchReport {
  readonly reportVersion: typeof QUANT_RESEARCH_REPORT_V1_VERSION | typeof QUANT_RESEARCH_REPORT_VERSION
  readonly tsCode: string
  readonly name: string | null
  readonly generatedAt: string
  readonly sourceSnapshotId: string | null
  readonly status: QuantResearchReportStatus
  readonly action: QuantResearchAction
  readonly score: number | null
  readonly headline: string
  readonly strengths: readonly string[]
  readonly risks: readonly string[]
  readonly gaps: readonly string[]
  readonly nextActions: readonly string[]
  readonly evidence: readonly QuantResearchEvidence[]
  readonly sources: readonly QuantResearchSource[]
  /** Optional for historical research-report-v1/v2 rows; always present on newly generated reports. */
  readonly factorModel?: QuantFactorModel
  /** Optional for historical research-report-v1/v2 rows; always present on newly generated reports. */
  readonly decision?: QuantDecisionProjection
}

export interface QuantResearchReportInput {
  readonly tsCode: string
  readonly name: string | null
  readonly generatedAt: Date
  readonly sourceSnapshotId: string | null
  readonly candidate: MomentumCandidate | null
  readonly dailyBars: readonly DailyBar[]
  readonly valuation: QuantValuationSnapshot | null
  readonly financialReports: readonly QuantFinancialQualitySnapshot[]
  readonly shareholderReturn: QuantShareholderReturnItem | null
  readonly valuationErrorCode?: string | null
  readonly financialErrorCode?: string | null
  readonly akshare?: QuantAkshareBridgeResult | null
  readonly akshareConfigured?: boolean
  readonly akshareErrorCode?: string | null
  readonly factorConfiguration?: QuantFactorConfiguration
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function sortedBars(input: readonly DailyBar[]): readonly DailyBar[] {
  return [...input]
    .filter(bar => Number.isFinite(bar.close) && bar.close > 0)
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
}

function evidence(input: Omit<QuantResearchEvidence, 'value'> & { readonly value?: number | null }): QuantResearchEvidence {
  return { ...input, value: input.value ?? null }
}

function statusForValue(value: number | null, pass: (value: number) => boolean, caution?: (value: number) => boolean): QuantResearchEvidenceStatus {
  if (value === null)
    return 'missing'
  if (pass(value))
    return 'pass'
  return caution?.(value) ? 'caution' : 'fail'
}

function financialIndustry(input: QuantResearchReportInput): 'general' | 'bank' | 'insurance' | 'securities' | 'other' {
  return input.financialReports[0]?.industry ?? 'general'
}

function financialIndustryLabel(industry: ReturnType<typeof financialIndustry>): string {
  return industry === 'insurance' ? '保险' : industry === 'bank' ? '银行' : industry === 'securities' ? '证券' : industry === 'other' ? '专用行业' : '通用行业'
}

function genericFinancialMetricApplicable(input: QuantResearchReportInput): boolean {
  return financialIndustry(input) === 'general'
}

function financialSourceFor(report: QuantFinancialQualitySnapshot | null, errorCode: string | null = null): { readonly id: string, readonly name: string, readonly formulaVersion: string } {
  const provider = report?.provider
  const primaryProvider = provider === 'tushare' ? 'Tushare' : provider === 'akshare' ? 'AkShare' : 'Eastmoney'
  const primaryId = provider === 'tushare' ? 'tushare-financial' : provider === 'akshare' ? 'akshare-financial' : 'eastmoney-financial'
  const primaryFormulaVersion = provider === 'tushare' ? 'tushare-fina-indicator-v1' : provider === 'akshare' ? 'akshare-adapter-v1' : 'eastmoney-financial-v1'
  const supplement = report?.supplementUsed && report.supplementalProvider
    ? `，字段补充：${report.supplementalProvider === 'tushare' ? 'Tushare' : report.supplementalProvider === 'akshare' ? 'AkShare' : 'Eastmoney'}`
    : ''
  const fallback = report?.fallbackUsed && report.fallbackReason ? `，主源回退：${report.fallbackReason}` : ''
  const unavailable = !report && errorCode ? `，来源不可用：${errorCode}` : ''
  return {
    id: primaryId,
    name: `${primaryProvider} 财务报告${supplement}${fallback}${unavailable}`,
    formulaVersion: primaryFormulaVersion,
  }
}

function compactDate(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized.replace(/-/gu, '').slice(0, 8) : null
}

function forecastStatus(average: number | null, low: number | null, high: number | null): QuantResearchEvidenceStatus {
  if (average !== null)
    return 'pass'
  return low !== null || high !== null ? 'caution' : 'missing'
}

function forecastNumber(value: number | null): string {
  return value === null ? '待补' : value.toFixed(2)
}

function forecastSourceName(input: QuantResearchReportInput, row: QuantAkshareProfitForecast): string {
  return row.source ? `AkShare ${row.source}` : input.akshare?.source.name ?? 'AkShare 盈利预测'
}

function appendProfitForecastEvidence(evidenceItems: QuantResearchEvidence[], input: QuantResearchReportInput): void {
  const rows = input.akshare?.profitForecasts ?? []
  for (const row of rows) {
    const source = forecastSourceName(input, row)
    const observedAt = input.akshare?.observedAt ?? null
    const formulaVersion = input.akshare?.source.formulaVersion ?? 'akshare-adapter-v1'
    const epsStatus = forecastStatus(row.forecastEpsAverage, row.forecastEpsLow, row.forecastEpsHigh)
    if (row.forecastEpsAverage !== null || row.forecastEpsLow !== null || row.forecastEpsHigh !== null) {
      evidenceItems.push(evidence({
        key: `akshare-profit-forecast-eps-${row.forecastYear}`,
        dimension: 'valuation',
        label: `${row.forecastYear} 年预测每股收益`,
        status: epsStatus,
        value: row.forecastEpsAverage,
        threshold: '仅记录分析师预测原始字段，不进入价值质量评分',
        source,
        observedAt,
        formulaVersion,
        detail: `预测 EPS 均值 ${forecastNumber(row.forecastEpsAverage)}，区间 ${forecastNumber(row.forecastEpsLow)} - ${forecastNumber(row.forecastEpsHigh)}；预测机构数 ${forecastNumber(row.analystCount)}；行业平均 EPS ${forecastNumber(row.industryAverageEps)}`,
        optional: true,
      }))
    }
    const netProfitStatus = forecastStatus(row.forecastNetProfit100mAverage, row.forecastNetProfit100mLow, row.forecastNetProfit100mHigh)
    if (row.forecastNetProfit100mAverage !== null || row.forecastNetProfit100mLow !== null || row.forecastNetProfit100mHigh !== null) {
      evidenceItems.push(evidence({
        key: `akshare-profit-forecast-net-profit-${row.forecastYear}`,
        dimension: 'quality',
        label: `${row.forecastYear} 年预测净利润`,
        status: netProfitStatus,
        value: row.forecastNetProfit100mAverage,
        threshold: '仅记录分析师预测原始字段，单位为亿元，不进入实际财报口径',
        source,
        observedAt,
        formulaVersion,
        detail: `预测净利润均值 ${forecastNumber(row.forecastNetProfit100mAverage)} 亿元，区间 ${forecastNumber(row.forecastNetProfit100mLow)} - ${forecastNumber(row.forecastNetProfit100mHigh)} 亿元；该值不是已实现净利润`,
        optional: true,
      }))
    }
  }
}

function appendWorkingCapitalEvidence(evidenceItems: QuantResearchEvidence[], latestFinancial: QuantFinancialQualitySnapshot | null, financialSource: ReturnType<typeof financialSourceFor>): void {
  const fields = [
    { key: 'accountsReceivable', evidenceKey: 'operating-driver-accounts-receivable', label: '应收账款', detailLabel: '应收账款' },
    { key: 'inventory', evidenceKey: 'operating-driver-inventory', label: '存货', detailLabel: '存货' },
    { key: 'contractLiabilities', evidenceKey: 'operating-driver-contract-liabilities', label: '合同负债', detailLabel: '合同负债' },
  ] as const
  for (const field of fields) {
    const value = finite(latestFinancial?.[field.key])
    const source = financialSource.name
    evidenceItems.push(evidence({
      key: field.evidenceKey,
      dimension: 'quality',
      label: field.label,
      status: value === null ? 'missing' : 'pass',
      value,
      threshold: '仅记录同报告期资产负债表原始字段，不进入价值质量评分或交易判断',
      source,
      observedAt: latestFinancial?.reportDate ?? null,
      formulaVersion: financialSource.formulaVersion,
      detail: value === null
        ? latestFinancial?.workingCapitalErrorCode
          ? `${field.detailLabel}来源暂不可用（${latestFinancial.workingCapitalErrorCode}）`
          : `当前报告期未返回${field.detailLabel}原始字段，需继续核验来源状态`
        : `${field.detailLabel} ${value.toFixed(2)} 元；用于经营驱动上下文，订单、销量与未来利润另行核验`,
      optional: true,
    }))
  }
}

function appendBusinessSegmentEvidence(evidenceItems: QuantResearchEvidence[], latestFinancial: QuantFinancialQualitySnapshot | null, financialSource: ReturnType<typeof financialSourceFor>): void {
  const segments = latestFinancial?.businessSegments?.slice(0, 12) ?? []
  if (!segments.length) {
    evidenceItems.push(evidence({
      key: 'operating-driver-segment-revenue',
      dimension: 'quality',
      label: '分部主营收入',
      status: 'missing',
      value: null,
      threshold: '仅记录同报告期主营构成原始字段，不进入价值质量评分或交易判断',
      source: latestFinancial?.businessSegmentSource ? `${financialSource.name} · ${latestFinancial.businessSegmentSource}` : financialSource.name,
      observedAt: latestFinancial?.reportDate ?? null,
      formulaVersion: financialSource.formulaVersion,
      detail: latestFinancial?.businessSegmentErrorCode
        ? `分部来源暂不可用（${latestFinancial.businessSegmentErrorCode}）`
        : '当前报告期未返回分部主营构成原始字段，需继续核验来源状态',
      optional: true,
    }))
    return
  }

  for (const [index, segment] of segments.entries()) {
    const suffix = String(index + 1)
    const ratio = segment.revenueRatio === null ? '待补' : `${(segment.revenueRatio * 100).toFixed(2)}%`
    const grossMargin = segment.grossMargin === null ? '待补' : `${(segment.grossMargin * 100).toFixed(2)}%`
    const cost = finite(segment.cost)
    const costRatio = finite(segment.costRatio)
    const profit = finite(segment.profit)
    const profitRatio = finite(segment.profitRatio)
    evidenceItems.push(evidence({
      key: `operating-driver-segment-revenue-${suffix}`,
      dimension: 'quality',
      label: `${segment.name}主营收入`,
      status: segment.revenue === null ? 'missing' : 'pass',
      value: segment.revenue,
      threshold: '仅记录同报告期主营构成原始字段，不进入价值质量评分或交易判断',
      source: latestFinancial?.businessSegmentSource ? `${financialSource.name} · ${latestFinancial.businessSegmentSource}` : financialSource.name,
      observedAt: segment.reportDate,
      formulaVersion: financialSource.formulaVersion,
      detail: `分类 ${segment.category}；收入占比 ${ratio}；毛利率 ${grossMargin}；成本 ${cost === null ? '待补' : `${cost.toFixed(2)} 元`}；利润 ${profit === null ? '待补' : `${profit.toFixed(2)} 元`}；订单、销量和实现价格另行核验`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: `operating-driver-segment-gross-margin-${suffix}`,
      dimension: 'quality',
      label: `${segment.name}分部毛利率`,
      status: segment.grossMargin === null ? 'missing' : 'pass',
      value: segment.grossMargin,
      threshold: '仅记录源站披露的分部毛利率，不用收入或比例推导',
      source: latestFinancial?.businessSegmentSource ? `${financialSource.name} · ${latestFinancial.businessSegmentSource}` : financialSource.name,
      observedAt: segment.reportDate,
      formulaVersion: financialSource.formulaVersion,
      detail: `分类 ${segment.category}；主营收入 ${segment.revenue === null ? '待补' : `${segment.revenue.toFixed(2)} 元`}`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: `operating-driver-segment-cost-${suffix}`,
      dimension: 'quality',
      label: `${segment.name}主营成本`,
      status: cost === null ? 'missing' : 'pass',
      value: cost,
      threshold: '仅记录同报告期源站披露的主营成本，不由收入或比例推导',
      source: latestFinancial?.businessSegmentSource ? `${financialSource.name} · ${latestFinancial.businessSegmentSource}` : financialSource.name,
      observedAt: segment.reportDate,
      formulaVersion: financialSource.formulaVersion,
      detail: `分类 ${segment.category}；成本占比 ${costRatio === null ? '待补' : `${(costRatio * 100).toFixed(2)}%`}`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: `operating-driver-segment-profit-${suffix}`,
      dimension: 'quality',
      label: `${segment.name}主营利润`,
      status: profit === null ? 'missing' : 'pass',
      value: profit,
      threshold: '仅记录同报告期源站披露的主营利润，不由收入或成本推导',
      source: latestFinancial?.businessSegmentSource ? `${financialSource.name} · ${latestFinancial.businessSegmentSource}` : financialSource.name,
      observedAt: segment.reportDate,
      formulaVersion: financialSource.formulaVersion,
      detail: `分类 ${segment.category}；利润占比 ${profitRatio === null ? '待补' : `${(profitRatio * 100).toFixed(2)}%`}`,
      optional: true,
    }))
  }
}

function withAkshareCrossSourceCheck(item: QuantResearchEvidence, latestFinancial: QuantFinancialQualitySnapshot | null): QuantResearchEvidence {
  const existingValues: Record<string, number | null | undefined> = {
    'akshare-roe': latestFinancial?.roe,
    'akshare-revenue-yoy': latestFinancial?.revenueYoY,
    'akshare-net-profit-yoy': latestFinancial?.netProfitYoY,
    'akshare-adjusted-net-profit-yoy': latestFinancial?.adjustedNetProfitYoY,
    'akshare-gross-margin': latestFinancial?.grossMargin,
    'akshare-net-margin': latestFinancial?.netMargin,
    'akshare-debt-asset-ratio': latestFinancial?.debtAssetRatio,
  }
  const existingValue = finite(existingValues[item.key])
  if (item.value === null || existingValue === null || !latestFinancial)
    return item

  const bridgeDate = compactDate(item.observedAt)
  const existingDate = compactDate(latestFinancial.reportDate)
  if (!bridgeDate || !existingDate)
    return item
  if (bridgeDate !== existingDate) {
    return {
      ...item,
      status: item.status === 'fail' ? 'fail' : 'caution',
      detail: `${item.detail}；与 ${financialSourceFor(latestFinancial).name} 报告期不同（AkShare ${bridgeDate}，${financialSourceFor(latestFinancial).name} ${existingDate}），仅供交叉核对`,
    }
  }

  const difference = round(Math.abs(item.value - existingValue))
  const existingSource = financialSourceFor(latestFinancial).name
  return {
    ...item,
    status: difference <= 2 || item.status === 'fail' ? item.status : 'caution',
    detail: difference <= 2
      ? `${item.detail}；与 ${existingSource} 同期值接近（相差 ${difference} 个百分点）`
      : `${item.detail}；与 ${existingSource} 同期值相差 ${difference} 个百分点，需要人工核对`,
  }
}

function actionLabel(action: QuantResearchAction): string {
  return {
    'research-window': '进入研究窗口',
    'wait-confirmation': '等待确认',
    'reassess': '重新评估',
    'complete-data': '补齐数据',
  }[action]
}

function shareholderDividendSource(item: QuantShareholderReturnItem | null): { readonly id: string, readonly name: string } {
  const providerLabel = item?.provider === 'eastmoney' ? 'Eastmoney' : item?.provider === 'tushare' ? 'Tushare' : item?.provider === 'akshare' ? 'AkShare' : 'Quant'
  const providerId = item?.provider === 'eastmoney' ? 'eastmoney-dividend' : item?.provider === 'tushare' ? 'tushare-dividend' : item?.provider === 'akshare' ? 'akshare-dividend' : 'quant-dividend-provider'
  const chain = item?.providerChain?.length ? `，回退链：${item.providerChain.join(' -> ')}` : ''
  const reason = item?.fallbackUsed && item.fallbackReason ? `，主源失败：${item.fallbackReason}` : ''
  const unavailable = item?.providerErrorCode && !item.provider ? `，来源不可用：${item.providerErrorCode}` : ''
  return {
    id: providerId,
    name: `${providerLabel} 实施分红${chain}${reason}${unavailable}`,
  }
}

function shareholderCashflowSource(item: QuantShareholderReturnItem | null): { readonly id: string, readonly name: string } {
  const provider = item?.cashflowEvidence?.provider === 'tushare' ? 'Tushare' : item?.cashflowEvidence?.provider === 'akshare' ? 'AkShare' : item?.cashflowEvidence?.provider === 'eastmoney' ? 'Eastmoney' : 'Quant'
  const unavailable = item?.cashflowEvidence?.providerErrorCode ? `，来源不可用：${item.cashflowEvidence.providerErrorCode}` : ''
  const supplement = item?.cashflowEvidence?.supplementalProvider ? `，字段补充：${item.cashflowEvidence.supplementalProvider === 'tushare' ? 'Tushare' : item.cashflowEvidence.supplementalProvider === 'akshare' ? 'AkShare' : 'Eastmoney'}` : ''
  const fallback = item?.cashflowEvidence?.fallbackUsed && item.cashflowEvidence.fallbackReason ? `，主源回退：${item.cashflowEvidence.fallbackReason}` : ''
  return {
    id: item?.cashflowEvidence?.provider === 'tushare' ? 'tushare-cashflow' : item?.cashflowEvidence?.provider === 'akshare' ? 'akshare-cashflow' : item?.cashflowEvidence?.provider === 'eastmoney' ? 'eastmoney-cashflow' : 'quant-cashflow-provider',
    name: `${provider} 现金流量表${supplement}${fallback}${unavailable}`,
  }
}

function shareholderCapitalSource(item: QuantShareholderReturnItem | null): { readonly id: string, readonly name: string } {
  const provider = item?.capitalStructureEvidence?.provider === 'tushare' ? 'Tushare' : item?.capitalStructureEvidence?.provider === 'akshare' ? 'AkShare' : item?.capitalStructureEvidence?.provider === 'eastmoney' ? 'Eastmoney' : 'Quant'
  const unavailable = item?.capitalStructureEvidence?.providerErrorCode ? `，来源不可用：${item.capitalStructureEvidence.providerErrorCode}` : ''
  return {
    id: item?.capitalStructureEvidence?.provider === 'akshare' ? 'akshare-capital-structure' : item?.capitalStructureEvidence?.provider === 'eastmoney' ? 'eastmoney-capital-structure' : 'quant-capital-structure-provider',
    name: `${provider} 股本结构${unavailable}`,
  }
}

function shareholderRepurchaseSource(item: QuantShareholderReturnItem | null): { readonly id: string, readonly name: string } {
  const provider = item?.repurchaseEvidence?.provider === 'tushare' ? 'Tushare' : item?.repurchaseEvidence?.provider === 'akshare' ? 'AkShare' : item?.repurchaseEvidence?.provider === 'eastmoney' ? 'Eastmoney' : 'Quant'
  const unavailable = item?.repurchaseEvidence?.providerErrorCode ? `，来源不可用：${item.repurchaseEvidence.providerErrorCode}` : ''
  const fallback = item?.repurchaseEvidence?.fallbackUsed && item.repurchaseEvidence.fallbackReason ? `，回退：${item.repurchaseEvidence.fallbackReason}` : ''
  return {
    id: item?.repurchaseEvidence?.provider === 'akshare' ? 'akshare-repurchase' : item?.repurchaseEvidence?.provider === 'eastmoney' ? 'eastmoney-repurchase' : 'quant-repurchase-provider',
    name: `${provider} 回购计划${fallback}${unavailable}`,
  }
}

function buildSources(input: QuantResearchReportInput, latestTradeDate: string | null): readonly QuantResearchSource[] {
  const sources: QuantResearchSource[] = [
    {
      id: 'local-daily-bars',
      name: '本地 Quant 日线库',
      observedAt: latestTradeDate,
      formulaVersion: input.candidate?.factorVersion ?? 'daily-bars-v1',
    },
  ]
  if (input.valuation || input.valuationErrorCode) {
    sources.push({
      id: 'eastmoney-valuation',
      name: 'Eastmoney 估值',
      observedAt: input.valuation?.observedAt ?? null,
      formulaVersion: 'eastmoney-valuation-v1',
    })
  }
  if (input.financialReports.length || input.financialErrorCode) {
    const source = financialSourceFor(input.financialReports[0] ?? null, input.financialErrorCode ?? null)
    sources.push({
      id: source.id,
      name: source.name,
      observedAt: input.financialReports[0]?.observedAt ?? null,
      formulaVersion: source.formulaVersion,
    })
    const supplementalProvider = input.financialReports[0]?.supplementalProvider
    if (input.financialReports[0]?.supplementUsed && supplementalProvider) {
      const providerLabel = supplementalProvider === 'tushare' ? 'Tushare' : supplementalProvider === 'akshare' ? 'AkShare' : 'Eastmoney'
      const providerId = supplementalProvider === 'tushare' ? 'tushare-financial-supplement' : supplementalProvider === 'akshare' ? 'akshare-financial-supplement' : 'eastmoney-financial-supplement'
      const formulaVersion = supplementalProvider === 'tushare' ? 'tushare-fina-indicator-v1' : supplementalProvider === 'akshare' ? 'akshare-adapter-v1' : 'eastmoney-financial-v1'
      sources.push({
        id: providerId,
        name: `${providerLabel} 财务字段补充`,
        observedAt: input.financialReports[0]?.observedAt ?? null,
        formulaVersion,
      })
    }
  }
  if (input.shareholderReturn) {
    const source = shareholderDividendSource(input.shareholderReturn)
    sources.push({
      id: source.id,
      name: source.name,
      observedAt: input.shareholderReturn.observedAt,
      formulaVersion: input.shareholderReturn.formulaVersion,
    })
  }
  if (input.shareholderReturn?.cashflowEvidence && genericFinancialMetricApplicable(input)) {
    const source = shareholderCashflowSource(input.shareholderReturn)
    sources.push({
      id: source.id,
      name: source.name,
      observedAt: input.shareholderReturn.cashflowEvidence.observedAt,
      formulaVersion: input.shareholderReturn.cashflowEvidence.formulaVersion,
    })
  }
  if (input.shareholderReturn?.capitalStructureEvidence) {
    const source = shareholderCapitalSource(input.shareholderReturn)
    sources.push({
      id: source.id,
      name: source.name,
      observedAt: input.shareholderReturn.capitalStructureEvidence.observedAt,
      formulaVersion: input.shareholderReturn.capitalStructureEvidence.formulaVersion,
    })
  }
  if (input.shareholderReturn?.repurchaseEvidence) {
    const source = shareholderRepurchaseSource(input.shareholderReturn)
    sources.push({
      id: source.id,
      name: source.name,
      observedAt: input.shareholderReturn.repurchaseEvidence.observedAt,
      formulaVersion: input.shareholderReturn.repurchaseEvidence.formulaVersion,
    })
  }
  if (input.akshare || input.akshareConfigured || input.akshareErrorCode) {
    const bridgeErrors = input.akshare?.errors ?? []
    const errorSuffix = bridgeErrors.length
      ? `，${input.akshare?.status === 'partial' ? '部分端点失败' : '来源异常'}：${[...new Set(bridgeErrors.map(error => error.code))].slice(0, 3).join('、')}`
      : ''
    sources.push({
      id: 'akshare-bridge',
      name: `${input.akshare?.source.name ?? 'AkShare bridge'}${errorSuffix}`,
      observedAt: input.akshare?.observedAt ?? null,
      formulaVersion: input.akshare?.source.formulaVersion ?? 'akshare-adapter-v1',
    })
    const forecastErrors = bridgeErrors.filter(error => /profit[_-]?forecast/iu.test(`${error.code} ${error.source ?? ''}`))
    const forecastSources = [...new Set((input.akshare?.profitForecasts ?? []).map(row => row.source).filter((value): value is string => Boolean(value)))]
    if ((input.akshare?.profitForecasts?.length ?? 0) > 0 || forecastErrors.length > 0) {
      sources.push({
        id: 'akshare-profit-forecast',
        name: `AkShare 盈利预测${forecastSources.length ? ` · ${forecastSources.join(' / ')}` : ''}${forecastErrors.length ? `，来源异常：${[...new Set(forecastErrors.map(error => error.code))].slice(0, 3).join('、')}` : ''}`,
        observedAt: input.akshare?.observedAt ?? null,
        formulaVersion: input.akshare?.source.formulaVersion ?? 'akshare-adapter-v1',
      })
    }
  }
  return sources
}

export function buildQuantResearchReport(input: QuantResearchReportInput): QuantResearchReport {
  const bars = sortedBars(input.dailyBars)
  const latest = bars.at(-1)
  const candidate = input.candidate
  const latestTradeDate = latest?.tradeDate ?? null
  const latestFinancial = input.financialReports[0] ?? null
  const financialSource = financialSourceFor(latestFinancial, input.financialErrorCode ?? null)
  const valuationSource = input.valuationErrorCode ? `Eastmoney 估值（来源不可用：${input.valuationErrorCode}）` : 'Eastmoney 估值'
  const genericMetricApplicable = genericFinancialMetricApplicable(input)
  const evidenceItems: QuantResearchEvidence[] = []
  appendWorkingCapitalEvidence(evidenceItems, latestFinancial, financialSource)
  appendBusinessSegmentEvidence(evidenceItems, latestFinancial, financialSource)

  evidenceItems.push(evidence({
    key: 'trend-sample',
    dimension: 'trend',
    label: '日线样本',
    status: bars.length >= 60 ? 'pass' : bars.length >= 20 ? 'caution' : 'missing',
    value: bars.length,
    threshold: '至少 60 根有效日线',
    source: '本地 Quant 日线库',
    observedAt: latestTradeDate,
    formulaVersion: candidate?.factorVersion ?? 'daily-bars-v1',
    detail: bars.length >= 60 ? '具备中长线趋势窗口' : '样本不足以稳定判断中长线结构',
  }))
  const ma20Gap = latest && candidate?.factors.ma20 !== null && candidate?.factors.ma20 !== undefined
    ? latest.close / candidate.factors.ma20 - 1
    : null
  evidenceItems.push(evidence({
    key: 'trend-ma20',
    dimension: 'trend',
    label: '收盘价 / MA20',
    status: statusForValue(ma20Gap, value => value >= 0),
    value: ma20Gap === null ? null : round(ma20Gap * 100),
    threshold: '不低于 MA20',
    source: '本地 Quant 日线因子',
    observedAt: latestTradeDate,
    formulaVersion: candidate?.factorVersion ?? 'momentum-v1',
    detail: ma20Gap !== null && ma20Gap >= 0 ? '收盘价位于 20 日均线之上' : '等待价格重新站回 20 日均线',
  }))
  const return20 = finite(candidate?.factors.return20)
  evidenceItems.push(evidence({
    key: 'trend-return20',
    dimension: 'trend',
    label: '20 日收益',
    status: statusForValue(return20, value => value >= 0),
    value: return20 === null ? null : round(return20 * 100),
    threshold: '不低于 0%',
    source: '本地 Quant 日线因子',
    observedAt: latestTradeDate,
    formulaVersion: candidate?.factorVersion ?? 'momentum-v1',
    detail: return20 !== null && return20 >= 0 ? '近一个月价格方向未走弱' : '近一个月价格方向偏弱',
  }))

  const peTtm = finite(input.valuation?.peTtm)
  const pb = finite(input.valuation?.pb)
  evidenceItems.push(evidence({
    key: 'valuation-pe',
    dimension: 'valuation',
    label: 'TTM PE',
    status: statusForValue(peTtm, value => value > 0),
    value: peTtm,
    threshold: '有效且大于 0；需结合行业比较',
    source: valuationSource,
    observedAt: input.valuation?.observedAt ?? null,
    formulaVersion: 'eastmoney-valuation-v1',
    detail: peTtm !== null && peTtm > 0 ? '已有当前估值值，仍需结合行业与历史区间' : input.valuationErrorCode ? `估值读取失败（${input.valuationErrorCode}）` : '缺少有效 TTM PE',
  }))
  evidenceItems.push(evidence({
    key: 'valuation-pb',
    dimension: 'valuation',
    label: 'PB',
    status: statusForValue(pb, value => value > 0),
    value: pb,
    threshold: '有效且大于 0；需结合资产质量',
    source: valuationSource,
    observedAt: input.valuation?.observedAt ?? null,
    formulaVersion: 'eastmoney-valuation-v1',
    detail: pb !== null && pb > 0 ? '已有当前 PB，不能单独证明低估' : '缺少有效 PB',
  }))
  const ps = finite(input.valuation?.ps)
  const peg = finite(input.valuation?.peg)
  evidenceItems.push(evidence({
    key: 'valuation-ps',
    dimension: 'valuation',
    label: 'PS',
    status: statusForValue(ps, value => value > 0),
    value: ps,
    threshold: '有效且大于 0；需结合行业比较',
    source: valuationSource,
    observedAt: input.valuation?.observedAt ?? null,
    formulaVersion: 'eastmoney-valuation-v1',
    detail: ps !== null && ps > 0 ? '已有当前 PS，仍需结合行业与历史区间' : '缺少有效 PS',
    optional: true,
  }))
  evidenceItems.push(evidence({
    key: 'valuation-peg',
    dimension: 'valuation',
    label: 'PEG',
    status: statusForValue(peg, value => value > 0),
    value: peg,
    threshold: '有效且大于 0；需结合增长口径比较',
    source: valuationSource,
    observedAt: input.valuation?.observedAt ?? null,
    formulaVersion: 'eastmoney-valuation-v1',
    detail: peg === null
      ? '缺少有效 PEG'
      : peg > 0
        ? '已有当前 PEG，仍需核对增长口径'
        : 'PEG 为负，增长口径不满足正值比较，仅保留源站原始值，不触发刷新',
    optional: true,
  }))

  const revenueYoY = finite(latestFinancial?.revenueYoY)
  const netProfitYoY = finite(latestFinancial?.netProfitYoY)
  const adjustedNetProfitYoY = finite(latestFinancial?.adjustedNetProfitYoY)
  const roe = finite(latestFinancial?.roe)
  const grossMargin = finite(latestFinancial?.grossMargin)
  const netMargin = finite(latestFinancial?.netMargin)
  const cashflowToRevenue = finite(latestFinancial?.operatingCashflowToRevenue)
  const debtAssetRatio = finite(latestFinancial?.debtAssetRatio)
  evidenceItems.push(evidence({
    key: 'quality-revenue-growth',
    dimension: 'quality',
    label: '营收同比',
    status: statusForValue(revenueYoY, value => value >= 0, value => value >= -10),
    value: revenueYoY,
    threshold: '不低于 0%，低于 -10% 为未通过',
    source: financialSource.name,
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: revenueYoY !== null && revenueYoY >= 0 ? '最新报告期营收方向未转负' : '营收同比需要进一步核对',
  }))
  evidenceItems.push(evidence({
    key: 'quality-profit',
    dimension: 'quality',
    label: '净利润同比',
    status: statusForValue(netProfitYoY, value => value >= 0),
    value: netProfitYoY,
    threshold: '不低于 0%',
    source: financialSource.name,
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: netProfitYoY !== null && netProfitYoY >= 0 ? '最新报告期利润方向未转负' : '利润同比需要进一步核对',
  }))
  evidenceItems.push(evidence({
    key: 'quality-adjusted-profit',
    dimension: 'quality',
    label: '扣非净利润同比',
    status: statusForValue(adjustedNetProfitYoY, value => value >= 0, value => value >= -10),
    value: adjustedNetProfitYoY,
    threshold: '不低于 0%，低于 -10% 为未通过',
    source: financialSource.name,
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: adjustedNetProfitYoY !== null && adjustedNetProfitYoY >= 0 ? '扣非利润方向未转负' : '扣非利润同比需要进一步核对',
  }))
  evidenceItems.push(evidence({
    key: 'quality-roe',
    dimension: 'quality',
    label: 'ROE',
    status: statusForValue(roe, value => value >= 10, value => value >= 0),
    value: roe,
    threshold: '至少 10%',
    source: financialSource.name,
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: roe !== null && roe >= 10 ? '资本回报达到研究门槛' : '资本回报仍需核对持续性',
  }))
  evidenceItems.push(evidence({
    key: 'quality-gross-margin',
    dimension: 'quality',
    label: '毛利率',
    status: statusForValue(grossMargin, value => value > 0),
    value: grossMargin,
    threshold: '有效且大于 0%',
    source: financialSource.name,
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: !genericMetricApplicable
      ? `${financialIndustry(input) === 'insurance' ? '保险' : financialIndustry(input) === 'bank' ? '银行' : '该行业'}财报不适用通用毛利率，使用行业专用指标核对`
      : grossMargin !== null && grossMargin > 0 ? '毛利率为正，可继续核对稳定性' : '缺少有效毛利率',
    ...(genericMetricApplicable ? {} : { applicability: 'not_applicable' as const, value: null }),
  }))
  evidenceItems.push(evidence({
    key: 'quality-net-margin',
    dimension: 'quality',
    label: '净利率',
    status: statusForValue(netMargin, value => value > 0),
    value: netMargin,
    threshold: '有效且大于 0%',
    source: financialSource.name,
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: netMargin !== null && netMargin > 0 ? '净利率为正，可继续核对稳定性' : '缺少有效净利率',
  }))
  evidenceItems.push(evidence({
    key: 'quality-cashflow',
    dimension: 'quality',
    label: '经营现金流 / 营收',
    status: genericMetricApplicable ? statusForValue(cashflowToRevenue, value => value >= 0) : 'missing',
    value: genericMetricApplicable ? cashflowToRevenue : null,
    threshold: '不低于 0%',
    source: financialSource.name,
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: genericMetricApplicable
      ? cashflowToRevenue !== null && cashflowToRevenue >= 0 ? '经营现金流未低于 0' : '利润需要现金流复核'
      : `${financialIndustry(input) === 'insurance' ? '保险' : financialIndustry(input) === 'bank' ? '银行' : '该行业'}不使用通用经营现金流 / 营收阈值，改看行业专用指标`,
    ...(genericMetricApplicable ? {} : { applicability: 'not_applicable' as const }),
  }))
  evidenceItems.push(evidence({
    key: 'quality-debt-asset',
    dimension: 'quality',
    label: '资产负债率',
    status: genericMetricApplicable ? statusForValue(debtAssetRatio, value => value <= 60, value => value <= 75) : 'missing',
    value: debtAssetRatio,
    threshold: '不高于 60%，高于 75% 为未通过',
    source: financialSource.name,
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: !genericMetricApplicable
      ? `${financialIndustry(input) === 'insurance' ? '保险' : financialIndustry(input) === 'bank' ? '银行' : '该行业'}资产负债率受业务结构影响，不使用通用阈值`
      : debtAssetRatio !== null && debtAssetRatio <= 60 ? '资产负债率处于当前研究门槛内' : '资产负债率需要结合行业结构核对',
    ...(genericMetricApplicable ? {} : { applicability: 'not_applicable' as const, value: null }),
  }))

  const industryMetrics = latestFinancial?.industryMetrics
  if (financialIndustry(input) === 'insurance') {
    const solvencyRatio = finite(industryMetrics?.insuranceSolvencyRatio)
    const netInvestmentReturn = finite(industryMetrics?.insuranceNetInvestmentReturn)
    const newBusinessValueRate = finite(industryMetrics?.insuranceNewBusinessValueRate)
    evidenceItems.push(evidence({
      key: 'quality-insurance-solvency',
      dimension: 'quality',
      label: '偿付能力充足率',
      status: statusForValue(solvencyRatio, value => value >= 100, value => value >= 100),
      value: solvencyRatio,
      threshold: '至少 100%；行业监管口径',
      source: `${financialSource.name} · 保险专用指标`,
      observedAt: latestFinancial?.reportDate ?? null,
      formulaVersion: financialSource.formulaVersion,
      detail: solvencyRatio === null ? '保险专用偿付能力指标未返回' : `偿付能力充足率 ${solvencyRatio.toFixed(2)}%`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'quality-insurance-net-investment-return',
      dimension: 'quality',
      label: '净投资收益率',
      status: statusForValue(netInvestmentReturn, value => value >= 0, value => value >= 0),
      value: netInvestmentReturn,
      threshold: '不低于 0%；保险投资收益口径',
      source: `${financialSource.name} · 保险专用指标`,
      observedAt: latestFinancial?.reportDate ?? null,
      formulaVersion: financialSource.formulaVersion,
      detail: netInvestmentReturn === null ? '保险专用净投资收益率未返回' : `净投资收益率 ${netInvestmentReturn.toFixed(2)}%`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'quality-insurance-new-business-value',
      dimension: 'quality',
      label: '新业务价值率',
      status: statusForValue(newBusinessValueRate, value => value >= 0, value => value >= 0),
      value: newBusinessValueRate,
      threshold: '保险新业务价值专用口径',
      source: `${financialSource.name} · 保险专用指标`,
      observedAt: latestFinancial?.reportDate ?? null,
      formulaVersion: financialSource.formulaVersion,
      detail: newBusinessValueRate === null ? '保险专用新业务价值率未返回' : `新业务价值率 ${newBusinessValueRate.toFixed(2)}%`,
      optional: true,
    }))
  }
  if (financialIndustry(input) === 'bank') {
    const coreTier1Ratio = finite(industryMetrics?.bankCoreTier1CapitalAdequacyRatio)
    const netInterestMargin = finite(industryMetrics?.bankNetInterestMargin)
    const loanProvisionRatio = finite(industryMetrics?.bankLoanProvisionRatio)
    evidenceItems.push(evidence({
      key: 'quality-bank-core-tier1',
      dimension: 'quality',
      label: '核心一级资本充足率',
      status: statusForValue(coreTier1Ratio, value => value >= 8.5, value => value >= 8.5),
      value: coreTier1Ratio,
      threshold: '至少 8.5%；银行监管口径',
      source: `${financialSource.name} · 银行专用指标`,
      observedAt: latestFinancial?.reportDate ?? null,
      formulaVersion: financialSource.formulaVersion,
      detail: coreTier1Ratio === null ? '银行专用核心一级资本充足率未返回' : `核心一级资本充足率 ${coreTier1Ratio.toFixed(2)}%`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'quality-bank-net-interest-margin',
      dimension: 'quality',
      label: '净息差',
      status: statusForValue(netInterestMargin, value => value >= 0, value => value >= 0),
      value: netInterestMargin,
      threshold: '不低于 0%；银行经营指标口径',
      source: `${financialSource.name} · 银行专用指标`,
      observedAt: latestFinancial?.reportDate ?? null,
      formulaVersion: financialSource.formulaVersion,
      detail: netInterestMargin === null ? '银行专用净息差未返回' : `净息差 ${netInterestMargin.toFixed(2)}%`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'quality-bank-loan-provision',
      dimension: 'quality',
      label: '贷款拨备率',
      status: statusForValue(loanProvisionRatio, value => value >= 0, value => value >= 0),
      value: loanProvisionRatio,
      threshold: '银行风险覆盖专用口径',
      source: `${financialSource.name} · 银行专用指标`,
      observedAt: latestFinancial?.reportDate ?? null,
      formulaVersion: financialSource.formulaVersion,
      detail: loanProvisionRatio === null ? '银行专用贷款拨备率未返回' : `贷款拨备率 ${loanProvisionRatio.toFixed(2)}%`,
      optional: true,
    }))
  }
  evidenceItems.push(evidence({
    key: 'quality-history',
    dimension: 'quality',
    label: '财报连续性',
    status: input.financialReports.length >= 2 ? 'pass' : input.financialReports.length === 1 ? 'caution' : 'missing',
    value: input.financialReports.length,
    threshold: '至少 2 期报告',
    source: financialSource.name,
    observedAt: latestFinancial?.observedAt ?? null,
    formulaVersion: financialSource.formulaVersion,
    detail: input.financialReports.length >= 2 ? '可以比较最近两期方向' : input.financialErrorCode ? `财报读取失败（${input.financialErrorCode}）` : '单期报告不能证明持续性',
  }))

  const dividendYield = finite(input.shareholderReturn?.trailingDividendYield)
  const dividendSource = shareholderDividendSource(input.shareholderReturn)
  evidenceItems.push(evidence({
    key: 'shareholder-yield',
    dimension: 'shareholder-return',
    label: '近 12 个月股息率',
    status: statusForValue(dividendYield, value => value > 0),
    value: dividendYield,
    threshold: '有实施分红记录且大于 0%',
    source: `${dividendSource.name} + 本地最新收盘价`,
    observedAt: input.shareholderReturn?.observedAt ?? null,
    formulaVersion: input.shareholderReturn?.formulaVersion ?? 'shareholder-return-v1',
    detail: input.shareholderReturn?.status === 'ready'
      ? input.shareholderReturn.fallbackUsed && input.shareholderReturn.fallbackReason
        ? `股东现金回报可核对，已使用回退源（${input.shareholderReturn.fallbackReason}）`
        : '股东现金回报可核对'
      : '股东回报数据不完整，不以零值代替',
    optional: true,
  }))

  const cashflowEvidence = input.shareholderReturn?.cashflowEvidence
  if (cashflowEvidence) {
    const cashflowSource = shareholderCashflowSource(input.shareholderReturn)
    const freeCashflow = finite(cashflowEvidence.freeCashflow)
    const coverage = finite(cashflowEvidence.freeCashflowCoverage)
    const payoutRatio = finite(cashflowEvidence.payoutRatio)
    evidenceItems.push(evidence({
      key: 'shareholder-free-cashflow',
      dimension: 'shareholder-return',
      label: '自由现金流',
      status: statusForValue(freeCashflow, value => value >= 0, value => value < 0),
      value: freeCashflow,
      threshold: '经营活动净现金流减购建长期资产支出',
      source: cashflowSource.name,
      observedAt: cashflowEvidence.reportDate,
      formulaVersion: cashflowEvidence.formulaVersion,
      detail: cashflowEvidence.status === 'ready'
        ? freeCashflow !== null && freeCashflow >= 0 ? '经营现金流覆盖当前资本开支' : '自由现金流为负，需要复核再投资压力'
        : '自由现金流字段尚未完整返回',
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'shareholder-cashflow-coverage',
      dimension: 'shareholder-return',
      label: '自由现金流分红覆盖',
      status: statusForValue(coverage, value => value >= 1, value => value >= 0),
      value: coverage,
      threshold: '自由现金流 / 同报告期现金分红，至少 1 倍为覆盖',
      source: cashflowSource.name,
      observedAt: cashflowEvidence.reportDate,
      formulaVersion: cashflowEvidence.formulaVersion,
      detail: coverage === null ? '同报告期没有可计算的现金分红覆盖倍数' : coverage >= 1 ? '自由现金流覆盖同报告期现金分红' : '自由现金流未完全覆盖同报告期现金分红',
      optional: true,
    }))
    const interestExpense = finite(cashflowEvidence.interestExpense)
    const interestBearingDebt = finite(cashflowEvidence.interestBearingDebt)
    const freeCashflowAfterInterest = finite(cashflowEvidence.freeCashflowAfterInterest)
    evidenceItems.push(evidence({
      key: 'shareholder-interest-expense',
      dimension: 'shareholder-return',
      label: '利息支出',
      status: statusForValue(interestExpense, () => true),
      value: interestExpense,
      threshold: '同报告期利润表披露的利息支出',
      source: cashflowSource.name,
      observedAt: cashflowEvidence.reportDate,
      formulaVersion: cashflowEvidence.formulaVersion,
      detail: interestExpense === null
        ? cashflowEvidence.interestExpenseProviderErrorCode
          ? `利息支出来源暂不可用（${cashflowEvidence.interestExpenseProviderErrorCode}）`
          : '缺少同报告期的利息支出'
        : `同报告期利息支出为 ${interestExpense.toFixed(2)} 元${cashflowEvidence.interestExpenseSourceField ? `（${cashflowEvidence.interestExpenseSourceField}）` : ''}`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'shareholder-interest-bearing-debt',
      dimension: 'shareholder-return',
      label: '有息负债',
      status: statusForValue(interestBearingDebt, () => true),
      value: interestBearingDebt,
      threshold: '明确借款、债券、租赁及一年内到期非流动负债行项目合计',
      source: cashflowSource.name,
      observedAt: cashflowEvidence.reportDate,
      formulaVersion: cashflowEvidence.formulaVersion,
      detail: interestBearingDebt === null
        ? cashflowEvidence.interestBearingDebtProviderErrorCode
          ? `有息负债来源暂不可用（${cashflowEvidence.interestBearingDebtProviderErrorCode}）`
          : '缺少可核对的有息负债行项目'
        : `同报告期有息负债合计为 ${interestBearingDebt.toFixed(2)} 元`,
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'shareholder-free-cashflow-after-interest',
      dimension: 'shareholder-return',
      label: '利息后自由现金流',
      status: statusForValue(freeCashflowAfterInterest, value => value >= 0, value => value < 0),
      value: freeCashflowAfterInterest,
      threshold: '经营活动净现金流 - 资本开支 - 利息支出，不低于 0 为正向观察',
      source: cashflowSource.name,
      observedAt: cashflowEvidence.reportDate,
      formulaVersion: cashflowEvidence.formulaVersion,
      detail: freeCashflowAfterInterest === null ? '缺少经营现金流、资本开支或利息支出，暂不能计算' : freeCashflowAfterInterest >= 0 ? '利息后自由现金流保持为正' : '利息后自由现金流为负，需要复核现金安全边际',
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'shareholder-payout-ratio',
      dimension: 'shareholder-return',
      label: '年度分红支付率',
      status: statusForValue(payoutRatio, value => value >= 0 && value <= 100, value => value <= 120),
      value: payoutRatio,
      threshold: '最近完整年度已分配股利 / 净利润，0% - 100% 为常规观察区间',
      source: cashflowSource.name,
      observedAt: cashflowEvidence.payoutRatioReportDate,
      formulaVersion: cashflowEvidence.formulaVersion,
      detail: payoutRatio === null ? '缺少最近完整年度的支付率计算条件' : payoutRatio <= 100 ? `最近完整年度支付率为 ${payoutRatio.toFixed(2)}%` : '支付率高于 100%，需要复核利润与分红时点',
      optional: true,
    }))
    const historySummary = cashflowEvidence.historySummary
    const historyPeriodCount = historySummary?.periodCount ?? cashflowEvidence.history?.length ?? 0
    const historyEvidenceStatus: QuantResearchEvidenceStatus = historySummary?.status === 'ready'
      ? 'pass'
      : historySummary?.status === 'partial'
        ? 'caution'
        : 'missing'
    const historyDetail = historySummary
      ? `已读取 ${historySummary.periodCount} 期；现金流核心完整 ${historySummary.coreReadyPeriodCount} 期，正自由现金流 ${historySummary.positiveFreeCashflowPeriods} 期，正利息后自由现金流 ${historySummary.positiveFreeCashflowAfterInterestPeriods} 期，分红覆盖 ${historySummary.coveredDividendPeriods} 期，可计算支付率 ${historySummary.payoutRatioPeriodCount} 期`
      : '历史现金流覆盖统计尚未生成'
    evidenceItems.push(evidence({
      key: 'shareholder-cashflow-history',
      dimension: 'shareholder-return',
      label: '多期现金流覆盖',
      status: historyEvidenceStatus,
      value: historyPeriodCount,
      threshold: '至少两期报告用于观察现金流连续性',
      source: cashflowSource.name,
      observedAt: historySummary?.latestReportDate ?? cashflowEvidence.reportDate,
      formulaVersion: historySummary?.formulaVersion ?? 'shareholder-cashflow-history-v1',
      detail: historySummary?.missingFields.length
        ? `${historyDetail}；待补：${historySummary.missingFields.join('、')}`
        : historyDetail,
      optional: true,
    }))
  }

  const capitalStructureEvidence = input.shareholderReturn?.capitalStructureEvidence
  if (capitalStructureEvidence) {
    const capitalSource = shareholderCapitalSource(input.shareholderReturn)
    const sharesOutstandingChange = finite(capitalStructureEvidence.sharesOutstandingChange)
    const repurchaseSharesRetired = finite(capitalStructureEvidence.repurchaseSharesRetired)
    const changeDetail = sharesOutstandingChange === null
      ? '最近相邻股本变化暂时无法计算'
      : sharesOutstandingChange < 0
        ? `最近相邻事件总股本减少 ${Math.abs(sharesOutstandingChange).toFixed(0)} 股`
        : sharesOutstandingChange > 0
          ? `最近相邻事件总股本增加 ${sharesOutstandingChange.toFixed(0)} 股`
          : '最近相邻事件总股本未变化'
    evidenceItems.push(evidence({
      key: 'shareholder-shares-outstanding-change',
      dimension: 'shareholder-return',
      label: '相邻股本变化',
      status: statusForValue(sharesOutstandingChange, () => true),
      value: sharesOutstandingChange,
      threshold: '最近两条股本事件均有有效总股本',
      source: capitalSource.name,
      observedAt: capitalStructureEvidence.latestReportDate,
      formulaVersion: capitalStructureEvidence.formulaVersion,
      detail: capitalStructureEvidence.status === 'ready' ? `${changeDetail}；${capitalStructureEvidence.latestChangeReason || '变动原因待补'}` : '股本事件字段尚未完整返回',
      optional: true,
    }))
    evidenceItems.push(evidence({
      key: 'shareholder-repurchase-shares',
      dimension: 'shareholder-return',
      label: '回购注销股数',
      status: statusForValue(repurchaseSharesRetired, value => value >= 0),
      value: repurchaseSharesRetired,
      threshold: '仅累计原因含回购且总股本下降的事件',
      source: capitalSource.name,
      observedAt: capitalStructureEvidence.latestReportDate,
      formulaVersion: capitalStructureEvidence.formulaVersion,
      detail: repurchaseSharesRetired === null ? '暂无可核对的股本事件' : repurchaseSharesRetired > 0 ? `样本内识别到 ${repurchaseSharesRetired.toFixed(0)} 股回购导致的总股本减少` : '样本内未识别到回购导致的总股本减少',
      optional: true,
    }))
  }

  const repurchaseEvidence = input.shareholderReturn?.repurchaseEvidence
  if (repurchaseEvidence) {
    const repurchaseSource = shareholderRepurchaseSource(input.shareholderReturn)
    const repurchaseAmount = finite(repurchaseEvidence.repurchaseAmount)
    evidenceItems.push(evidence({
      key: 'shareholder-repurchase-amount',
      dimension: 'shareholder-return',
      label: '已实施回购金额',
      status: statusForValue(repurchaseAmount, value => value >= 0, value => value >= 0),
      value: repurchaseAmount,
      threshold: '仅汇总回购计划已实施金额，计划区间单独观察',
      source: repurchaseSource.name,
      observedAt: repurchaseEvidence.latestAnnouncementDate,
      formulaVersion: repurchaseEvidence.formulaVersion,
      detail: repurchaseAmount === null
        ? '回购计划存在，但已实施金额暂未返回'
        : `样本内已实施回购金额为 ${repurchaseAmount.toFixed(2)} 元`,
      optional: true,
    }))
  }

  const akshareErrors = input.akshare?.errors ?? []
  if (input.akshare?.evidence.length) {
    evidenceItems.push(...input.akshare.evidence.map(item => withAkshareCrossSourceCheck({
      ...item,
      observedAt: item.observedAt ?? input.akshare!.observedAt,
    }, latestFinancial)).map(item => ({
      ...item,
      optional: true,
    })))
  }
  if (akshareErrors.length) {
    evidenceItems.push(...akshareErrors.map((error, index) => {
      const endpoint = error.source?.trim() || 'bridge'
      const endpointKey = endpoint.replace(/[^\w-]/gu, '-').slice(0, 40) || 'bridge'
      const dimension: QuantResearchDimension = /cashflow|cash/u.test(endpoint) ? 'shareholder-return' : /daily|hist/u.test(endpoint) ? 'trend' : /forecast|expect|profit/iu.test(`${endpoint} ${error.code}`) ? 'valuation' : 'quality'
      return evidence({
        key: `akshare-error-${endpointKey}-${index}`,
        dimension,
        label: `AkShare ${endpoint} 来源`,
        status: 'missing',
        value: null,
        threshold: '端点返回有效标准化数据',
        source: `AkShare bridge · ${endpoint}`,
        observedAt: input.akshare?.observedAt ?? null,
        formulaVersion: input.akshare?.source.formulaVersion ?? 'akshare-adapter-v1',
        detail: `端点暂不可用（${error.code}），可重试 bridge 或检查该来源配置`,
        optional: true,
      })
    }))
  }
  else if (!input.akshare?.evidence.length && (input.akshareConfigured || input.akshareErrorCode)) {
    evidenceItems.push(evidence({
      key: 'akshare-bridge',
      dimension: 'quality',
      label: 'AkShare bridge',
      status: 'missing',
      value: null,
      threshold: 'bridge 返回有效标准化证据',
      source: 'AkShare bridge',
      observedAt: input.akshare?.observedAt ?? null,
      formulaVersion: input.akshare?.source.formulaVersion ?? 'akshare-adapter-v1',
      detail: input.akshareErrorCode ? `bridge 读取失败（${input.akshareErrorCode}）` : 'bridge 尚未返回有效证据',
      optional: true,
    }))
  }
  appendProfitForecastEvidence(evidenceItems, input)

  const volumeRatio = finite(candidate?.factors.volumeRatio)
  const upStreak = finite(candidate?.factors.consecutiveUpDays)
  evidenceItems.push(evidence({
    key: 'risk-volume',
    dimension: 'risk',
    label: '成交量比',
    status: statusForValue(volumeRatio, value => value < 2, value => value < 3),
    value: volumeRatio,
    threshold: '小于 2 倍',
    source: '本地 Quant 日线因子',
    observedAt: latestTradeDate,
    formulaVersion: candidate?.factorVersion ?? 'momentum-v1',
    detail: volumeRatio !== null && volumeRatio < 2 ? '未见明显异常放量' : '成交活跃度偏高，先核对波动原因',
  }))
  evidenceItems.push(evidence({
    key: 'risk-streak',
    dimension: 'risk',
    label: '连续上涨天数',
    status: statusForValue(upStreak, value => value < 5, value => value < 7),
    value: upStreak,
    threshold: '小于 5 天',
    source: '本地 Quant 日线因子',
    observedAt: latestTradeDate,
    formulaVersion: candidate?.factorVersion ?? 'momentum-v1',
    detail: upStreak !== null && upStreak < 5 ? '未处于连续上涨过热区' : '连续上涨较久，避免追逐短期强势',
  }))

  const genericCashflowEvidenceKeys = new Set([
    'shareholder-free-cashflow',
    'shareholder-cashflow-coverage',
    'shareholder-interest-expense',
    'shareholder-interest-bearing-debt',
    'shareholder-free-cashflow-after-interest',
    'shareholder-payout-ratio',
    'shareholder-cashflow-history',
  ])
  const finalEvidenceItems = evidenceItems.map((item) => {
    if (genericMetricApplicable || !genericCashflowEvidenceKeys.has(item.key))
      return item
    return {
      ...item,
      status: 'missing' as const,
      value: null,
      applicability: 'not_applicable' as const,
      source: `${financialSource.name} · ${financialIndustryLabel(financialIndustry(input))}通用现金流不适用`,
      observedAt: latestFinancial?.reportDate ?? null,
      detail: `${financialIndustryLabel(financialIndustry(input))}不使用通用自由现金流、利息覆盖和支付率口径，保留分红、股本和回购证据`,
    }
  })
  const required = finalEvidenceItems.filter(item => !item.optional && item.applicability !== 'not_applicable')
  const passedCount = required.filter(item => item.status === 'pass').length
  const cautionCount = required.filter(item => item.status === 'caution').length
  const failedCount = required.filter(item => item.status === 'fail').length
  const missingCount = required.filter(item => item.status === 'missing').length
  const score = required.length > 0 ? round(passedCount / required.length * 100) : null
  const action: QuantResearchAction = missingCount > 0
    ? 'complete-data'
    : failedCount >= 2 || required.some(item => item.key.startsWith('risk-') && item.status === 'fail')
      ? 'reassess'
      : failedCount > 0 || cautionCount > 0
        ? 'wait-confirmation'
        : 'research-window'
  const gaps = finalEvidenceItems
    .filter(item => item.applicability !== 'not_applicable' && (item.status === 'missing' || item.status === 'caution'))
    .map(item => `${item.label}：${item.detail}`)
  const risks = finalEvidenceItems
    .filter(item => item.applicability !== 'not_applicable' && item.status === 'fail')
    .map(item => `${item.label}：${item.detail}`)
  const strengths = finalEvidenceItems
    .filter(item => item.status === 'pass')
    .map(item => `${item.label}：${item.detail}`)
  const nextActions = missingCount > 0
    ? ['先补齐缺失的日线、估值或财报字段，再重新运行研究报告']
    : action === 'reassess'
      ? ['先核对风险项和估值，再决定是否继续深入基本面研究']
      : action === 'wait-confirmation'
        ? ['等待下一期日线或财报确认，避免把单次信号当成趋势']
        : ['结合行业位置、竞争格局和管理层信息，继续人工研究']
  const status: QuantResearchReportStatus = missingCount > 0
    ? 'insufficient_data'
    : required.some(item => item.status === 'caution' || item.status === 'fail')
      ? 'partial'
      : 'ready'
  const { factorModel, decision } = buildQuantDecisionProjection({
    evidence: finalEvidenceItems,
    dailyBars: input.dailyBars,
    factorConfiguration: input.factorConfiguration,
  })

  return {
    reportVersion: QUANT_RESEARCH_REPORT_VERSION,
    tsCode: input.tsCode,
    name: input.name,
    generatedAt: input.generatedAt.toISOString(),
    sourceSnapshotId: input.sourceSnapshotId,
    status,
    action,
    score,
    headline: `${actionLabel(action)}：${status === 'ready' ? '当前硬证据链完整，可进入更深的公司研究。' : status === 'partial' ? '部分证据可用，先处理需要确认的事项。' : '证据链尚未完整，暂不做时机判断。'}`,
    strengths: strengths.slice(0, 6),
    risks: risks.slice(0, 6),
    gaps: gaps.slice(0, 8),
    nextActions,
    evidence: finalEvidenceItems,
    sources: buildSources(input, latestTradeDate),
    factorModel,
    decision,
  }
}
