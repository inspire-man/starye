import type { QuantFinancialQualitySnapshot, QuantValuationSnapshot } from './provider'
import type { QuantShareholderReturnItem } from './shareholder-return'
import type { DailyBar, MomentumCandidate } from './types'

export const QUANT_RESEARCH_REPORT_VERSION = 'research-report-v1' as const

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
}

export interface QuantResearchSource {
  readonly id: string
  readonly name: string
  readonly observedAt: string | null
  readonly formulaVersion: string
}

export interface QuantResearchReport {
  readonly reportVersion: typeof QUANT_RESEARCH_REPORT_VERSION
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

function actionLabel(action: QuantResearchAction): string {
  return {
    'research-window': '进入研究窗口',
    'wait-confirmation': '等待确认',
    'reassess': '重新评估',
    'complete-data': '补齐数据',
  }[action]
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
    sources.push({
      id: 'eastmoney-financial',
      name: 'Eastmoney 财务报告',
      observedAt: input.financialReports[0]?.observedAt ?? null,
      formulaVersion: 'eastmoney-financial-v1',
    })
  }
  if (input.shareholderReturn) {
    sources.push({
      id: 'tushare-dividend',
      name: 'Tushare 实施分红',
      observedAt: input.shareholderReturn.observedAt,
      formulaVersion: input.shareholderReturn.formulaVersion,
    })
  }
  return sources
}

export function buildQuantResearchReport(input: QuantResearchReportInput): QuantResearchReport {
  const bars = sortedBars(input.dailyBars)
  const latest = bars.at(-1)
  const candidate = input.candidate
  const latestTradeDate = latest?.tradeDate ?? null
  const latestFinancial = input.financialReports[0] ?? null
  const evidenceItems: QuantResearchEvidence[] = []

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
    source: 'Eastmoney 估值',
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
    source: 'Eastmoney 估值',
    observedAt: input.valuation?.observedAt ?? null,
    formulaVersion: 'eastmoney-valuation-v1',
    detail: pb !== null && pb > 0 ? '已有当前 PB，不能单独证明低估' : '缺少有效 PB',
  }))

  const netProfitYoY = finite(latestFinancial?.netProfitYoY)
  const roe = finite(latestFinancial?.roe)
  const cashflowToRevenue = finite(latestFinancial?.operatingCashflowToRevenue)
  evidenceItems.push(evidence({
    key: 'quality-profit',
    dimension: 'quality',
    label: '净利润同比',
    status: statusForValue(netProfitYoY, value => value >= 0),
    value: netProfitYoY,
    threshold: '不低于 0%',
    source: 'Eastmoney 最新财报',
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: 'eastmoney-financial-v1',
    detail: netProfitYoY !== null && netProfitYoY >= 0 ? '最新报告期利润方向未转负' : '利润同比需要进一步核对',
  }))
  evidenceItems.push(evidence({
    key: 'quality-roe',
    dimension: 'quality',
    label: 'ROE',
    status: statusForValue(roe, value => value >= 10, value => value >= 0),
    value: roe,
    threshold: '至少 10%',
    source: 'Eastmoney 最新财报',
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: 'eastmoney-financial-v1',
    detail: roe !== null && roe >= 10 ? '资本回报达到研究门槛' : '资本回报仍需核对持续性',
  }))
  evidenceItems.push(evidence({
    key: 'quality-cashflow',
    dimension: 'quality',
    label: '经营现金流 / 营收',
    status: statusForValue(cashflowToRevenue, value => value >= 0),
    value: cashflowToRevenue,
    threshold: '不低于 0%',
    source: 'Eastmoney 最新财报',
    observedAt: latestFinancial?.reportDate ?? null,
    formulaVersion: 'eastmoney-financial-v1',
    detail: cashflowToRevenue !== null && cashflowToRevenue >= 0 ? '经营现金流未低于 0' : '利润需要现金流复核',
  }))
  evidenceItems.push(evidence({
    key: 'quality-history',
    dimension: 'quality',
    label: '财报连续性',
    status: input.financialReports.length >= 2 ? 'pass' : input.financialReports.length === 1 ? 'caution' : 'missing',
    value: input.financialReports.length,
    threshold: '至少 2 期报告',
    source: 'Eastmoney 财务报告',
    observedAt: latestFinancial?.observedAt ?? null,
    formulaVersion: 'eastmoney-financial-v1',
    detail: input.financialReports.length >= 2 ? '可以比较最近两期方向' : input.financialErrorCode ? `财报读取失败（${input.financialErrorCode}）` : '单期报告不能证明持续性',
  }))

  const dividendYield = finite(input.shareholderReturn?.trailingDividendYield)
  evidenceItems.push(evidence({
    key: 'shareholder-yield',
    dimension: 'shareholder-return',
    label: '近 12 个月股息率',
    status: statusForValue(dividendYield, value => value > 0),
    value: dividendYield,
    threshold: '有实施分红记录且大于 0%',
    source: 'Tushare 实施分红 + 本地最新收盘价',
    observedAt: input.shareholderReturn?.observedAt ?? null,
    formulaVersion: input.shareholderReturn?.formulaVersion ?? 'shareholder-return-v1',
    detail: input.shareholderReturn?.status === 'ready' ? '股东现金回报可核对' : '股东回报数据不完整，不以零值代替',
    optional: true,
  }))

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

  const required = evidenceItems.filter(item => !item.optional)
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
  const gaps = evidenceItems
    .filter(item => item.status === 'missing' || item.status === 'caution')
    .map(item => `${item.label}：${item.detail}`)
  const risks = evidenceItems
    .filter(item => item.status === 'fail')
    .map(item => `${item.label}：${item.detail}`)
  const strengths = evidenceItems
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
    : [...evidenceItems].some(item => item.status === 'caution' || item.status === 'fail')
        ? 'partial'
        : 'ready'

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
    evidence: evidenceItems,
    sources: buildSources(input, latestTradeDate),
  }
}
