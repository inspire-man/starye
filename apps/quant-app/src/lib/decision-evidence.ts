import type {
  CandidateItem,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantShareholderReturnItem,
  QuantValuationComparison,
  QuantValuationSnapshot,
  QuantValueQualityItem,
} from './quant-view-models'
import type { TrendStructure } from './trend-analysis'

export const DECISION_EVIDENCE_VERSION = 'decision-evidence-v1' as const

export type DecisionEvidenceStatus = 'pass' | 'caution' | 'fail' | 'missing'
export type DecisionEvidenceDimension = 'trend' | 'valuation' | 'quality' | 'shareholder-return' | 'risk'
export type DecisionTimingAction = 'research-window' | 'wait-confirmation' | 'reassess' | 'complete-data'

export interface DecisionEvidenceItem {
  key: string
  dimension: DecisionEvidenceDimension
  label: string
  status: DecisionEvidenceStatus
  numericValue: number | null
  value: string
  threshold: string
  source: string
  observedAt: string | null
  detail: string
  optional?: boolean
}

export interface DecisionEvidenceInput {
  candidate: CandidateItem | null
  trend: TrendStructure
  latestTradeDate: string | null
  valuation: QuantValuationSnapshot | null
  valuationComparison: QuantValuationComparison | null
  financial: QuantFinancialQualitySnapshot | null
  financialHistory: QuantFinancialQualityHistory | null
  valueQuality: QuantValueQualityItem | null
  shareholderReturn: QuantShareholderReturnItem | null
}

export interface DecisionEvidence {
  formulaVersion: typeof DECISION_EVIDENCE_VERSION
  action: DecisionTimingAction
  label: string
  headline: string
  gateScore: number | null
  passedCount: number
  requiredCount: number
  cautionCount: number
  failedCount: number
  missingCount: number
  evidence: DecisionEvidenceItem[]
  waitConditions: string[]
  reassessmentConditions: string[]
}

function percent(value: number | null, ratio = false): string {
  if (value === null)
    return '--'
  return `${(ratio ? value * 100 : value).toFixed(2)}%`
}

function number(value: number | null, suffix = ''): string {
  return value === null ? '--' : `${value.toFixed(2)}${suffix}`
}

function metricStatus(value: number | null, predicate: (value: number) => boolean, cautionPredicate?: (value: number) => boolean): DecisionEvidenceStatus {
  if (value === null)
    return 'missing'
  if (predicate(value))
    return 'pass'
  return cautionPredicate?.(value) ? 'caution' : 'fail'
}

function evidence(input: Omit<DecisionEvidenceItem, 'value'> & { format?: (value: number | null) => string }): DecisionEvidenceItem {
  const { format = value => number(value), ...item } = input
  return { ...item, value: format(item.numericValue) }
}

function actionLabel(action: DecisionTimingAction): string {
  return {
    'research-window': '进入研究窗口',
    'wait-confirmation': '等待确认',
    'reassess': '重新评估',
    'complete-data': '补齐数据',
  }[action]
}

function buildWaitConditions(items: readonly DecisionEvidenceItem[]): string[] {
  const conditions: string[] = []
  const has = (key: string, ...statuses: DecisionEvidenceStatus[]) => {
    const item = items.find(entry => entry.key === key)
    return item ? statuses.includes(item.status) : false
  }

  if (items.some(item => !item.optional && item.status === 'missing'))
    conditions.push('补齐标记为“数据不足”的原始字段，再重新计算门槛通过率')
  if (has('trend-ma20', 'fail', 'missing') || has('trend-return20', 'fail', 'missing'))
    conditions.push('等待收盘价重新站上 20 日均线，并让 20 日收益回到 0% 以上')
  if (has('valuation-pe', 'fail') || has('valuation-pb', 'fail'))
    conditions.push('等待估值百分位回到观察池 67% 以下，或用新报告验证盈利增长能否覆盖估值')
  if (has('quality-cashflow', 'fail') || has('quality-profit', 'fail'))
    conditions.push('等待利润与经营现金流方向重新一致，并核对下一期报告')
  if (has('risk-volume', 'caution') || has('risk-streak', 'caution'))
    conditions.push('等待成交活跃度和连续上涨回落，避免把短期拥挤当作长期价值')
  return [...new Set(conditions)].slice(0, 4)
}

function buildReassessmentConditions(items: readonly DecisionEvidenceItem[]): string[] {
  const conditions = [
    '20 日收益转负、收盘价跌破 MA20，或 60 日回撤达到 -15%',
    'TTM PE 或 PB 进入观察池高位（高于样本 67%）且盈利没有同步改善',
    '净利润同比为负，或经营现金流 / 营收转为负并持续到下一期报告',
  ]
  if (items.some(item => item.key === 'shareholder-yield' && item.status === 'pass'))
    conditions.push('分红实施记录减少、股息率明显下降，需重新核对现金回报可持续性')
  return conditions.slice(0, 4)
}

export function buildDecisionEvidence(input: DecisionEvidenceInput): DecisionEvidence | null {
  if (!input.candidate)
    return null

  if (input.candidate.pendingSync) {
    const pending = evidence({
      key: 'pending-sync',
      dimension: 'trend',
      label: '日线快照',
      status: 'missing',
      numericValue: null,
      threshold: '至少 60 根日线，并进入最新候选快照',
      source: '本地 Quant 日线库',
      observedAt: input.latestTradeDate,
      detail: input.candidate.pendingReason || '尚未完成观察池同步',
    })
    return {
      formulaVersion: DECISION_EVIDENCE_VERSION,
      action: 'complete-data',
      label: actionLabel('complete-data'),
      headline: '证据链不完整：股票已加入观察池，但还没有可复核的日线快照。',
      gateScore: null,
      passedCount: 0,
      requiredCount: 1,
      cautionCount: 0,
      failedCount: 0,
      missingCount: 1,
      evidence: [pending],
      waitConditions: ['先到观察池更新日线，完成后再判断趋势、估值和时机'],
      reassessmentConditions: buildReassessmentConditions([pending]),
    }
  }

  const items: DecisionEvidenceItem[] = [
    evidence({
      key: 'trend-bars',
      dimension: 'trend',
      label: '日线样本',
      status: input.trend.availableBars >= 60 ? 'pass' : input.trend.availableBars >= 20 ? 'caution' : 'missing',
      numericValue: input.trend.availableBars,
      threshold: '≥ 60 根',
      source: '本地 Quant 日线库',
      observedAt: input.latestTradeDate,
      detail: input.trend.availableBars >= 60 ? '具备中长线趋势窗口' : '样本不足以稳定判断 60 日结构',
      format: value => value === null ? '--' : `${value.toFixed(0)} 根`,
    }),
    evidence({
      key: 'trend-ma20',
      dimension: 'trend',
      label: '收盘价 / MA20',
      status: metricStatus(input.trend.ma20Gap, value => value >= 0),
      numericValue: input.trend.ma20Gap,
      threshold: '≥ 0%，收盘价不低于 MA20',
      source: '本地 Quant 日线库',
      observedAt: input.latestTradeDate,
      detail: input.trend.ma20Gap !== null && input.trend.ma20Gap >= 0 ? '中期趋势确认' : '等待重新站回均线',
      format: value => percent(value),
    }),
    evidence({
      key: 'trend-return20',
      dimension: 'trend',
      label: '20 日收益',
      status: metricStatus(input.trend.return20, value => value >= 0),
      numericValue: input.trend.return20,
      threshold: '≥ 0%',
      source: '本地 Quant 日线库',
      observedAt: input.latestTradeDate,
      detail: input.trend.return20 !== null && input.trend.return20 >= 0 ? '近一个月价格方向未走弱' : '近一个月价格方向偏弱',
      format: value => percent(value, true),
    }),
    evidence({
      key: 'trend-drawdown60',
      dimension: 'trend',
      label: '60 日回撤',
      status: metricStatus(input.trend.drawdown60, value => value > -0.15),
      numericValue: input.trend.drawdown60,
      threshold: '> -15%',
      source: '本地 Quant 日线库',
      observedAt: input.latestTradeDate,
      detail: input.trend.drawdown60 !== null && input.trend.drawdown60 > -0.15 ? '回撤仍在研究阈值内' : '回撤已触发重新评估',
      format: value => percent(value, true),
    }),
    evidence({
      key: 'valuation-pe',
      dimension: 'valuation',
      label: 'TTM PE 池内位置',
      status: input.valuationComparison?.ttmPeHigherThanPercent === null || input.valuationComparison?.ttmPeHigherThanPercent === undefined
        ? input.valuation?.peTtm === null || input.valuation?.peTtm === undefined ? 'missing' : 'caution'
        : input.valuationComparison.ttmPeHigherThanPercent <= 67 ? 'pass' : 'fail',
      numericValue: input.valuationComparison?.ttmPeHigherThanPercent ?? null,
      threshold: '高于样本 ≤ 67%',
      source: 'Eastmoney 估值 + 当前观察池比较',
      observedAt: input.valuation?.observedAt ?? null,
      detail: input.valuationComparison?.ttmPeHigherThanPercent === null || input.valuationComparison?.ttmPeHigherThanPercent === undefined ? '缺少可比样本' : input.valuationComparison.ttmPeHigherThanPercent <= 67 ? '估值未处于池内高位' : '估值处于池内高位',
      format: value => value === null ? '--' : `${value.toFixed(0)}%`,
    }),
    evidence({
      key: 'valuation-pb',
      dimension: 'valuation',
      label: 'PB 池内位置',
      status: input.valuationComparison?.pbHigherThanPercent === null || input.valuationComparison?.pbHigherThanPercent === undefined
        ? input.valuation?.pb === null || input.valuation?.pb === undefined ? 'missing' : 'caution'
        : input.valuationComparison.pbHigherThanPercent <= 67 ? 'pass' : 'fail',
      numericValue: input.valuationComparison?.pbHigherThanPercent ?? null,
      threshold: '高于样本 ≤ 67%',
      source: 'Eastmoney 估值 + 当前观察池比较',
      observedAt: input.valuation?.observedAt ?? null,
      detail: input.valuationComparison?.pbHigherThanPercent === null || input.valuationComparison?.pbHigherThanPercent === undefined ? '缺少可比样本' : input.valuationComparison.pbHigherThanPercent <= 67 ? 'PB 未处于池内高位' : 'PB 处于池内高位',
      format: value => value === null ? '--' : `${value.toFixed(0)}%`,
    }),
    evidence({
      key: 'quality-history',
      dimension: 'quality',
      label: '财报连续性',
      status: (input.financialHistory?.reports.length ?? 0) >= 2 ? 'pass' : (input.financialHistory?.reports.length ?? 0) === 1 ? 'caution' : 'missing',
      numericValue: input.financialHistory?.reports.length ?? 0,
      threshold: '≥ 2 期报告',
      source: 'Eastmoney 财务报告',
      observedAt: input.financial?.noticeDate ?? input.financial?.observedAt ?? null,
      detail: (input.financialHistory?.reports.length ?? 0) >= 2 ? '可以比较最近两期方向' : '单期报告不能证明持续性',
      format: value => value === null ? '--' : `${value.toFixed(0)} 期`,
    }),
    evidence({
      key: 'quality-profit',
      dimension: 'quality',
      label: '净利润同比',
      status: metricStatus(input.financial?.netProfitYoY ?? null, value => value >= 0),
      numericValue: input.financial?.netProfitYoY ?? null,
      threshold: '≥ 0%',
      source: 'Eastmoney 最新财报',
      observedAt: input.financial?.reportDate ?? null,
      detail: input.financial?.netProfitYoY !== null && input.financial?.netProfitYoY !== undefined && input.financial.netProfitYoY >= 0 ? '利润方向未转负' : '利润同比未通过门槛',
      format: value => percent(value),
    }),
    evidence({
      key: 'quality-roe',
      dimension: 'quality',
      label: 'ROE',
      status: metricStatus(input.financial?.roe ?? null, value => value >= 10, value => value >= 0),
      numericValue: input.financial?.roe ?? null,
      threshold: '≥ 10%',
      source: 'Eastmoney 最新财报',
      observedAt: input.financial?.reportDate ?? null,
      detail: input.financial?.roe !== null && input.financial?.roe !== undefined && input.financial.roe >= 10 ? '资本回报达到研究门槛' : '资本回报仍需核对',
      format: value => percent(value),
    }),
    evidence({
      key: 'quality-cashflow',
      dimension: 'quality',
      label: '经营现金流 / 营收',
      status: metricStatus(input.financial?.operatingCashflowToRevenue ?? null, value => value >= 0),
      numericValue: input.financial?.operatingCashflowToRevenue ?? null,
      threshold: '≥ 0%',
      source: 'Eastmoney 最新财报',
      observedAt: input.financial?.reportDate ?? null,
      detail: input.financial?.operatingCashflowToRevenue !== null && input.financial?.operatingCashflowToRevenue !== undefined && input.financial.operatingCashflowToRevenue >= 0 ? '经营现金流未低于 0' : '利润需要现金流复核',
      format: value => percent(value, true),
    }),
    evidence({
      key: 'shareholder-yield',
      dimension: 'shareholder-return',
      label: '近 12 个月股息率',
      status: input.shareholderReturn?.trailingDividendYield === null || input.shareholderReturn?.trailingDividendYield === undefined ? 'missing' : input.shareholderReturn.trailingDividendYield > 0 ? 'pass' : 'caution',
      numericValue: input.shareholderReturn?.trailingDividendYield ?? null,
      threshold: '有实施分红记录且股息率 > 0',
      source: 'Tushare 实施分红 + 本地最新收盘价',
      observedAt: input.shareholderReturn?.observedAt ?? null,
      detail: input.shareholderReturn?.status === 'ready' ? '股东现金回报可核对' : '股东回报数据不完整，不以零值代替',
      format: value => percent(value),
      optional: true,
    }),
    evidence({
      key: 'shareholder-history',
      dimension: 'shareholder-return',
      label: '连续分红年数',
      status: input.shareholderReturn === null ? 'missing' : input.shareholderReturn.dividendYears >= 3 ? 'pass' : input.shareholderReturn.dividendYears > 0 ? 'caution' : 'missing',
      numericValue: input.shareholderReturn?.dividendYears ?? null,
      threshold: '≥ 3 年实施记录',
      source: 'Tushare 实施分红记录',
      observedAt: input.shareholderReturn?.observedAt ?? null,
      detail: input.shareholderReturn?.dividendYears !== undefined && input.shareholderReturn.dividendYears >= 3 ? '分红连续性较好' : '连续性仍需更多年度记录',
      format: value => value === null ? '--' : `${value.toFixed(0)} 年`,
      optional: true,
    }),
    evidence({
      key: 'risk-volume',
      dimension: 'risk',
      label: '成交量比',
      status: metricStatus(input.candidate.volumeRatio, value => value < 2, value => value < 3),
      numericValue: input.candidate.volumeRatio,
      threshold: '< 2 倍',
      source: '本地 Quant 日线因子',
      observedAt: input.latestTradeDate,
      detail: input.candidate.volumeRatio !== null && input.candidate.volumeRatio < 2 ? '未见异常放量' : '成交活跃度偏高，先核对波动原因',
      format: value => number(value, ' 倍'),
    }),
    evidence({
      key: 'risk-streak',
      dimension: 'risk',
      label: '连续上涨天数',
      status: metricStatus(input.candidate.upStreak, value => value < 5, value => value < 7),
      numericValue: input.candidate.upStreak,
      threshold: '< 5 天',
      source: '本地 Quant 日线因子',
      observedAt: input.latestTradeDate,
      detail: input.candidate.upStreak !== null && input.candidate.upStreak < 5 ? '未处于连续上涨过热区' : '连续上涨较久，避免追逐短期强势',
      format: value => value === null ? '--' : `${value.toFixed(0)} 天`,
    }),
    evidence({
      key: 'risk-deduction',
      dimension: 'risk',
      label: '价值质量风险扣分',
      status: input.valueQuality === null ? 'missing' : input.valueQuality.riskDeduction <= 0 ? 'pass' : input.valueQuality.riskDeduction >= 5 ? 'fail' : 'caution',
      numericValue: input.valueQuality?.riskDeduction ?? null,
      threshold: '= 0 分',
      source: 'Quant value-quality-v2',
      observedAt: input.valueQuality?.observedAt ?? null,
      detail: input.valueQuality === null ? '价值质量尚未返回' : input.valueQuality.riskDeduction <= 0 ? '暂无风险扣分' : `存在 ${input.valueQuality.riskDeduction.toFixed(1)} 分风险扣分`,
      format: value => value === null ? '--' : `-${value.toFixed(1)} 分`,
    }),
  ]

  const required = items.filter(item => !item.optional)
  const passedCount = required.filter(item => item.status === 'pass').length
  const cautionCount = required.filter(item => item.status === 'caution').length
  const failedCount = required.filter(item => item.status === 'fail').length
  const missingCount = required.filter(item => item.status === 'missing').length
  const gateScore = required.length ? Math.round((passedCount / required.length) * 100) : null
  const action: DecisionTimingAction = missingCount > 0
    ? 'complete-data'
    : failedCount >= 2 || items.some(item => item.key === 'risk-deduction' && item.status === 'fail')
      ? 'reassess'
      : failedCount > 0 || cautionCount > 0
        ? 'wait-confirmation'
        : 'research-window'

  return {
    formulaVersion: DECISION_EVIDENCE_VERSION,
    action,
    label: actionLabel(action),
    headline: action === 'research-window'
      ? '关键门槛均已通过，可以进入分批研究窗口。'
      : action === 'wait-confirmation'
        ? '部分证据通过，但仍有门槛需要等待确认。'
        : action === 'reassess'
          ? '已有证据触发重新评估，先处理风险或估值问题。'
          : '证据链还不完整，暂不判断研究时机。',
    gateScore,
    passedCount,
    requiredCount: required.length,
    cautionCount,
    failedCount,
    missingCount,
    evidence: items,
    waitConditions: buildWaitConditions(items),
    reassessmentConditions: buildReassessmentConditions(items),
  }
}
