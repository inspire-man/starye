import type { QuantAiProvider, QuantDecryptedAiConfig } from './ai-config'
import type { QuantDecisionProjection, QuantRecommendation, QuantReferencePriceRange, QuantResearchFactor, QuantResearchFactorKey } from './decision-recommendation'
import type { QuantResearchEvidence, QuantResearchReport, QuantResearchSource } from './research-report'
import { resolveQuantAiGenerationTimeout } from './ai-timeout'
import { requestQuantAiCompletion } from './ai-transport'
import { QuantError } from './errors'

export const QUANT_DECISION_ASSISTANT_VERSION = 'decision-assistant-v1' as const
export const QUANT_DECISION_ASSISTANT_AI_VERSION = 'decision-assistant-ai-v1' as const

export type QuantDecisionAssistantMode = 'buy' | 'holding'
export type QuantDecisionAssistantAction = 'consider-buy' | 'wait' | 'avoid' | 'hold' | 'reduce-review' | 'add-review' | 'verify-price' | 'review-data'
export type QuantDecisionAssistantPriceStatus = 'within' | 'below' | 'above' | 'unavailable'
export type QuantDecisionAssistantTrustLevel = 'high' | 'medium' | 'low'
export type QuantDecisionAssistantAiStatus = 'accepted' | 'rejected' | 'failed' | 'unavailable' | 'not-requested'
export type QuantDecisionAssistantAiRejectionReason = 'low-confidence' | 'deterministic-watch' | 'factor-review-incomplete' | 'factor-conflict' | 'missing-citation' | 'invalid-action'
export type QuantDecisionAssistantCurrentPriceSource = 'eastmoney-realtime' | 'local-daily-bars' | 'user-input'
export type QuantDecisionAssistantCurrentPriceStatus = 'realtime' | 'latest-close' | 'user-input'

export interface QuantDecisionAssistantScenarioInput {
  readonly mode: QuantDecisionAssistantMode
  readonly costBasis: number | null
  readonly quantity: number | null
}

export interface QuantDecisionAssistantScenario {
  readonly mode: QuantDecisionAssistantMode
  readonly currentPrice: number
  readonly costBasis: number | null
  readonly quantity: number | null
}

export interface QuantDecisionAssistantMarket {
  readonly currentPrice: number
  readonly currentPriceSource: QuantDecisionAssistantCurrentPriceSource
  readonly currentPriceStatus: QuantDecisionAssistantCurrentPriceStatus
  readonly currentPriceObservedAt: string
  readonly currentPriceChangePercent: number | null
  readonly quoteErrorCode: string | null
  readonly latestClose: number | null
  readonly latestTradeDate: string | null
  readonly latestCloseSource: 'local-daily-bars' | null
  readonly priceDeltaPercent: number | null
}

export interface QuantDecisionAssistantMarketInput {
  readonly currentPrice: number
  readonly currentPriceSource: Exclude<QuantDecisionAssistantCurrentPriceSource, 'user-input'>
  readonly currentPriceStatus: Exclude<QuantDecisionAssistantCurrentPriceStatus, 'user-input'>
  readonly currentPriceObservedAt: string
  readonly currentPriceChangePercent: number | null
  readonly quoteErrorCode: string | null
}

export interface QuantDecisionAssistantEvidenceSummary {
  readonly total: number
  readonly usable: number
  readonly missing: number
  readonly failed: number
}

export interface QuantDecisionAssistantTrust {
  readonly level: QuantDecisionAssistantTrustLevel
  readonly score: number
  readonly coverage: number
  readonly evidenceCoverage: number
  readonly sourceCount: number
  readonly latestObservedAt: string | null
  readonly freshnessDays: number | null
  readonly missingEvidenceCount: number
  readonly failedEvidenceCount: number
  readonly crossSourceAlertCount: number
  readonly reasons: readonly string[]
}

export interface QuantDecisionAssistantDeterministic {
  readonly recommendation: QuantRecommendation | null
  readonly label: '看多' | '看空' | '观望'
  readonly action: QuantDecisionAssistantAction
  readonly actionLabel: string
  readonly rationale: string
  readonly priceStatus: QuantDecisionAssistantPriceStatus
  readonly priceLabel: string
  readonly priceDetail: string
  readonly score: number | null
  readonly coverage: number
  readonly buyPriceRange: QuantReferencePriceRange | null
  readonly sellPriceRange: QuantReferencePriceRange | null
  readonly unrealizedPnlPercent: number | null
  readonly recoveryPercent: number | null
  readonly trust: QuantDecisionAssistantTrust
  readonly evidence: QuantDecisionAssistantEvidenceSummary
  readonly evidenceKeys: readonly string[]
  readonly sources: readonly QuantResearchSource[]
  readonly checks: readonly string[]
  readonly invalidationConditions: readonly string[]
}

export interface QuantDecisionAssistantAiFactorReview {
  readonly factor: QuantResearchFactorKey
  readonly stance: 'support' | 'caution' | 'oppose' | 'insufficient'
  readonly confidence: number
  readonly accepted: boolean
  readonly rationale: string
  readonly citedEvidenceKeys: readonly string[]
}

export interface QuantDecisionAssistantAiReview {
  readonly aiVersion: typeof QUANT_DECISION_ASSISTANT_AI_VERSION
  readonly status: QuantDecisionAssistantAiStatus
  readonly provider: QuantAiProvider | null
  readonly model: string | null
  readonly recommendation: QuantRecommendation | null
  readonly action: QuantDecisionAssistantAction | null
  readonly confidence: number | null
  readonly accepted: boolean
  readonly rejectionReason: QuantDecisionAssistantAiRejectionReason | null
  readonly factorReviewCoverage: number
  readonly rationale: string | null
  readonly risks: readonly string[]
  readonly invalidationConditions: readonly string[]
  readonly citedEvidenceKeys: readonly string[]
  readonly factorReviews: readonly QuantDecisionAssistantAiFactorReview[]
  readonly errorCode: string | null
}

export interface QuantDecisionAssistantFinal {
  readonly recommendation: QuantRecommendation | null
  readonly label: '看多' | '看空' | '观望'
  readonly action: QuantDecisionAssistantAction
  readonly actionLabel: string
  readonly confidence: number | null
  readonly source: 'ai' | 'deterministic'
  readonly rationale: string
}

export interface QuantDecisionAssistantSnapshot {
  readonly snapshotVersion: typeof QUANT_DECISION_ASSISTANT_VERSION
  readonly tsCode: string
  readonly name: string | null
  readonly researchRunId: string
  readonly assessedAt: string
  readonly reportGeneratedAt: string
  readonly scenario: QuantDecisionAssistantScenario
  readonly market: QuantDecisionAssistantMarket
  readonly evidence: QuantDecisionAssistantEvidenceSummary
  readonly sources: readonly QuantResearchSource[]
  readonly deterministic: QuantDecisionAssistantDeterministic
  readonly ai: QuantDecisionAssistantAiReview
  readonly final: QuantDecisionAssistantFinal
}

export interface QuantAiDecisionAssistantGenerated extends Omit<QuantDecisionAssistantAiReview, 'status' | 'provider' | 'model' | 'recommendation' | 'action' | 'confidence' | 'accepted' | 'rejectionReason' | 'factorReviewCoverage' | 'rationale' | 'errorCode'> {
  readonly status: 'rejected'
  readonly provider: null
  readonly model: null
  readonly recommendation: QuantRecommendation
  readonly action: QuantDecisionAssistantAction
  readonly confidence: number
  readonly accepted: false
  readonly rejectionReason: null
  readonly factorReviewCoverage: 0
  readonly rationale: string
  readonly errorCode: null
}

export interface QuantAiDecisionAssistantRequest {
  readonly report: QuantResearchReport
  readonly deterministic: QuantDecisionAssistantDeterministic
  readonly scenario: QuantDecisionAssistantScenario
  readonly market: QuantDecisionAssistantMarket
  readonly config: QuantDecryptedAiConfig
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

const FACTOR_KEYS: readonly QuantResearchFactorKey[] = ['trend', 'valuation', 'quality', 'shareholder-return', 'risk']
const ACTIONS: readonly QuantDecisionAssistantAction[] = ['consider-buy', 'wait', 'avoid', 'hold', 'reduce-review', 'add-review', 'verify-price', 'review-data']

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function dateKey(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/gu, '').slice(0, 8) || ''
  return /^\d{8}$/u.test(digits) ? digits : null
}

function displayDate(value: string | null | undefined): string {
  const key = dateKey(value)
  return key ? `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}` : '日期未记录'
}

function dateAgeDays(value: string | null, now: Date): number | null {
  const key = dateKey(value)
  if (!key)
    return null
  const observed = Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)))
  const current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.max(0, Math.floor((current - observed) / 86_400_000))
}

function recommendationLabel(value: QuantRecommendation | null): '看多' | '看空' | '观望' {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : '观望'
}

function actionLabel(value: QuantDecisionAssistantAction): string {
  return {
    'consider-buy': '分批考虑买入',
    'wait': '等待，不追价',
    'avoid': '暂不买入',
    'hold': '继续持有观察',
    'reduce-review': '减仓复核',
    'add-review': '加仓复核',
    'verify-price': '先核对价格与数据',
    'review-data': '补齐数据后再判断',
  }[value]
}

function clonePriceRange(value: QuantReferencePriceRange | null | undefined): QuantReferencePriceRange | null {
  return value ? { ...value, evidenceKeys: [...value.evidenceKeys] } : null
}

function cloneSources(value: readonly QuantResearchSource[]): QuantResearchSource[] {
  return value.map(source => ({ ...source }))
}

function evidenceSummary(evidence: readonly QuantResearchEvidence[]): QuantDecisionAssistantEvidenceSummary {
  const missing = evidence.filter(item => item.status === 'missing').length
  const failed = evidence.filter(item => item.status === 'fail').length
  const usable = evidence.filter(item => item.status === 'pass' || item.status === 'caution').length
  return {
    total: evidence.length,
    usable,
    missing,
    failed,
  }
}

function crossSourceAlertCount(report: QuantResearchReport): number {
  const evidenceAlerts = report.evidence.filter(item => /回退|不同|相差|人工核对|失败|不可用|fallback|different|manual/iu.test(item.detail)).length
  const sourceAlerts = report.sources.filter(source => /回退|失败|不可用|quota|fallback/iu.test(source.name)).length
  return evidenceAlerts + sourceAlerts
}

function latestObservedAt(report: QuantResearchReport, latestTradeDate: string | null, currentPriceObservedAt: string | null): string | null {
  const values = [currentPriceObservedAt, latestTradeDate, ...report.evidence.map(item => item.observedAt), ...report.sources.map(source => source.observedAt)]
    .flatMap((value) => {
      const key = dateKey(value)
      return key ? [{ key, value: displayDate(value) }] : []
    })
    .sort((left, right) => left.key.localeCompare(right.key))
  return values.at(-1)?.value ?? null
}

function buildTrust(report: QuantResearchReport, latestTradeDate: string | null, now: Date, currentPriceObservedAt: string | null = null): QuantDecisionAssistantTrust {
  const evidence = evidenceSummary(report.evidence)
  const coverage = clamp(finite(report.decision?.coverage ?? report.factorModel?.coverage) ?? 0, 0, 100)
  const evidenceCoverage = evidence.total > 0 ? round(evidence.usable / evidence.total * 100) : 0
  const sourceCount = report.sources.length
  const freshnessDays = dateAgeDays(latestTradeDate, now)
  const freshnessScore = freshnessDays === null ? 0 : freshnessDays <= 3 ? 100 : freshnessDays <= 7 ? 75 : freshnessDays <= 14 ? 40 : 0
  const sourceScore = sourceCount >= 3 ? 100 : sourceCount === 2 ? 75 : sourceCount === 1 ? 50 : 0
  const crossSourceAlerts = crossSourceAlertCount(report)
  const sourceAlertPenalty = Math.min(30, crossSourceAlerts * 10)
  const score = round(clamp(coverage * 0.45 + evidenceCoverage * 0.25 + sourceScore * 0.15 + freshnessScore * 0.15 - sourceAlertPenalty, 0, 100))
  const reasons: string[] = []
  if (coverage < 80)
    reasons.push(`因子覆盖度仅 ${coverage.toFixed(0)}%，低于 80% 纳入线`)
  if (evidence.missing > 0)
    reasons.push(`${evidence.missing} 条证据缺失`)
  if (evidence.failed > 0)
    reasons.push(`${evidence.failed} 条证据来源失败`)
  if (sourceCount < 2)
    reasons.push('来源数量不足，交叉核对能力有限')
  if (freshnessDays === null)
    reasons.push('最新日线日期未记录')
  else if (freshnessDays > 7)
    reasons.push(`最新日线距今天 ${freshnessDays} 天，可能已过期`)
  if (crossSourceAlerts > 0)
    reasons.push(`${crossSourceAlerts} 条证据包含回退或跨源核对提示`)
  const level: QuantDecisionAssistantTrustLevel = coverage >= 80
    && evidenceCoverage >= 80
    && evidence.failed === 0
    && sourceCount >= 2
    && freshnessDays !== null
    && freshnessDays <= 7
    && crossSourceAlerts === 0
    ? 'high'
    : coverage >= 60 && evidenceCoverage >= 60 && sourceCount >= 1 && freshnessDays !== null && freshnessDays <= 14
      ? 'medium'
      : 'low'
  if (level === 'high' && !reasons.length)
    reasons.push('覆盖、来源、新鲜度和证据状态均达到当前纳入线')
  return {
    level,
    score,
    coverage,
    evidenceCoverage,
    sourceCount,
    latestObservedAt: latestObservedAt(report, latestTradeDate, currentPriceObservedAt),
    freshnessDays,
    missingEvidenceCount: evidence.missing,
    failedEvidenceCount: evidence.failed,
    crossSourceAlertCount: crossSourceAlerts,
    reasons,
  }
}

function priceStatus(currentPrice: number, range: QuantReferencePriceRange | null): QuantDecisionAssistantPriceStatus {
  if (!range)
    return 'unavailable'
  if (currentPrice < range.low)
    return 'below'
  if (currentPrice > range.high)
    return 'above'
  return 'within'
}

function priceLabel(status: QuantDecisionAssistantPriceStatus): string {
  return {
    within: '当前价在参考买入区间内',
    below: '当前价低于参考买入区间',
    above: '当前价高于参考买入区间',
    unavailable: '暂无完整参考买入区间',
  }[status]
}

function displayObservedAt(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? displayDate(value) : parsed.toISOString().replace('T', ' ').slice(0, 16)
}

function currentPriceSourceLabel(market: QuantDecisionAssistantMarketInput): string {
  return market.currentPriceSource === 'eastmoney-realtime' ? 'Eastmoney 实时行情' : '本地最新收盘回退'
}

function priceDetail(status: QuantDecisionAssistantPriceStatus, currentPrice: number, range: QuantReferencePriceRange | null, latestTradeDate: string | null, market: QuantDecisionAssistantMarketInput): string {
  const date = displayDate(latestTradeDate)
  const source = `${currentPriceSourceLabel(market)}（${displayObservedAt(market.currentPriceObservedAt)}）`
  const fallback = market.quoteErrorCode
    ? market.quoteErrorCode === 'QUANT_MARKET_QUOTE_STALE'
      ? `实时行情未更新到当日（${market.quoteErrorCode}），已回退到本地日线。`
      : `实时行情请求未完成（${market.quoteErrorCode}），已回退到本地日线。`
    : ''
  if (!range)
    return `${source} ${currentPrice.toFixed(2)} 元；研究报告没有完整参考买入区间，最近日线日期为 ${date}。${fallback}`
  const rangeText = `${range.low.toFixed(2)} - ${range.high.toFixed(2)} 元`
  if (status === 'below')
    return `${source} ${currentPrice.toFixed(2)} 元，低于确定性区间 ${rangeText}；先核对盘中波动和是否有新信息。${fallback}`
  if (status === 'above')
    return `${source} ${currentPrice.toFixed(2)} 元，高于确定性区间 ${rangeText}；看多不等于当前价立即追入。${fallback}`
  return `${source} ${currentPrice.toFixed(2)} 元，位于确定性区间 ${rangeText}；仍需通过可信度检查。${fallback}`
}

function deterministicAction(input: {
  readonly mode: QuantDecisionAssistantMode
  readonly recommendation: QuantRecommendation | null
  readonly priceStatus: QuantDecisionAssistantPriceStatus
  readonly trustLevel: QuantDecisionAssistantTrustLevel
}): QuantDecisionAssistantAction {
  if (input.trustLevel === 'low' || !input.recommendation)
    return 'review-data'
  if (input.mode === 'buy') {
    if (input.recommendation === 'bearish')
      return 'avoid'
    if (input.recommendation !== 'bullish')
      return 'wait'
    return input.priceStatus === 'within' ? 'consider-buy' : input.priceStatus === 'below' ? 'verify-price' : 'wait'
  }
  if (input.recommendation === 'bearish')
    return 'reduce-review'
  if (input.recommendation === 'bullish' && input.priceStatus === 'within' && input.trustLevel === 'high')
    return 'add-review'
  return 'hold'
}

function actionRationale(mode: QuantDecisionAssistantMode, recommendation: QuantRecommendation | null, action: QuantDecisionAssistantAction, trust: QuantDecisionAssistantTrust, currentPriceStatus: QuantDecisionAssistantPriceStatus): string {
  if (action === 'review-data')
    return `当前${mode === 'buy' ? '买入' : '持有'}判断先被数据可信度拦截：${trust.reasons.join('；')}`
  if (mode === 'buy') {
    if (action === 'consider-buy')
      return `确定性模型为${recommendationLabel(recommendation)}，现价满足区间条件；只进入分批研究动作，不代表自动下单。`
    if (action === 'verify-price')
      return `确定性模型为${recommendationLabel(recommendation)}，但服务端现价低于区间；先核对数据和盘中异常，再决定是否建立计划。`
    if (action === 'avoid')
      return '确定性模型为看空，当前不建立买入计划。'
    return `确定性模型为${recommendationLabel(recommendation)}，当前价格条件或方向不足以支持立即买入。`
  }
  if (action === 'reduce-review')
    return '确定性模型为看空，持仓应先进入减仓复核，结合个人风险承受能力执行。'
  if (action === 'add-review')
    return '确定性模型为看多且现价落入参考买入区间，但低价本身不是加仓理由，先检查报告新鲜度和风险条件。'
  if (mode === 'holding' && recommendation === 'bullish' && currentPriceStatus === 'below')
    return '模型偏多但服务端现价低于参考买入区间，先继续持有观察；不因下跌本身加仓，等待价格和趋势重新确认。'
  return `确定性模型为${recommendationLabel(recommendation)}，当前先继续持有观察，等待失效条件或新数据。`
}

export function buildQuantDecisionAssistant(input: {
  readonly report: QuantResearchReport
  readonly researchRunId: string
  readonly tsCode: string
  readonly name: string | null
  readonly scenario: QuantDecisionAssistantScenarioInput
  readonly market: QuantDecisionAssistantMarketInput
  readonly latestDailyBar?: { readonly close: number, readonly tradeDate: string } | null
  readonly assessedAt?: Date
}): QuantDecisionAssistantSnapshot {
  const assessedAt = input.assessedAt ?? new Date()
  const latestClose = finite(input.latestDailyBar?.close)
  const latestTradeDate = input.latestDailyBar?.tradeDate || null
  const reportDecision: QuantDecisionProjection | undefined = input.report.decision
  const recommendation = reportDecision?.recommendation ?? null
  const buyPriceRange = clonePriceRange(reportDecision?.buyPriceRange)
  const currentPrice = input.market.currentPrice
  const priceCondition = priceStatus(currentPrice, buyPriceRange)
  const trust = buildTrust(input.report, latestTradeDate, assessedAt, input.market.currentPriceObservedAt)
  const evidence = evidenceSummary(input.report.evidence)
  const action = deterministicAction({
    mode: input.scenario.mode,
    recommendation,
    priceStatus: priceCondition,
    trustLevel: trust.level,
  })
  const pnl = input.scenario.costBasis === null ? null : round((currentPrice - input.scenario.costBasis) / input.scenario.costBasis * 100)
  const recovery = input.scenario.costBasis === null || currentPrice >= input.scenario.costBasis
    ? input.scenario.costBasis === null ? null : 0
    : round((input.scenario.costBasis / currentPrice - 1) * 100)
  const deterministic: QuantDecisionAssistantDeterministic = {
    recommendation,
    label: recommendationLabel(recommendation),
    action,
    actionLabel: actionLabel(action),
    rationale: actionRationale(input.scenario.mode, recommendation, action, trust, priceCondition),
    priceStatus: priceCondition,
    priceLabel: priceLabel(priceCondition),
    priceDetail: priceDetail(priceCondition, currentPrice, buyPriceRange, latestTradeDate, input.market),
    score: finite(reportDecision?.deterministicScore ?? input.report.score),
    coverage: trust.coverage,
    buyPriceRange,
    sellPriceRange: clonePriceRange(reportDecision?.sellPriceRange),
    unrealizedPnlPercent: pnl,
    recoveryPercent: recovery,
    trust,
    evidence,
    evidenceKeys: [...new Set(input.report.evidence.map(item => item.key))],
    sources: cloneSources(input.report.sources),
    checks: [
      `可信度：${trust.level === 'high' ? '高' : trust.level === 'medium' ? '中' : '低'}（${trust.score.toFixed(0)} 分）`,
      `证据覆盖：${trust.coverage.toFixed(0)}% 因子覆盖，${trust.evidenceCoverage.toFixed(0)}% 证据可用`,
      `行情依据：${currentPriceSourceLabel(input.market)} ${currentPrice.toFixed(2)} 元（${displayObservedAt(input.market.currentPriceObservedAt)}），最近收盘 ${latestClose === null ? '--' : `${latestClose.toFixed(2)} 元`}（${displayDate(latestTradeDate)}）`,
      ...(input.market.quoteErrorCode ? [`实时行情回退：${input.market.quoteErrorCode}，当前价不是实时快照`] : []),
      `来源：${input.report.sources.length} 个，${trust.crossSourceAlertCount ? `有 ${trust.crossSourceAlertCount} 条跨源提示` : '未发现跨源提示'}`,
    ],
    invalidationConditions: [...new Set([
      ...((reportDecision?.invalidationConditions ?? [])),
      ...trust.reasons.filter(reason => !reason.startsWith('用户输入')),
    ])].slice(0, 8),
  }
  const ai = emptyAiReview('not-requested', null, null)
  return {
    snapshotVersion: QUANT_DECISION_ASSISTANT_VERSION,
    tsCode: input.tsCode,
    name: input.name,
    researchRunId: input.researchRunId,
    assessedAt: assessedAt.toISOString(),
    reportGeneratedAt: input.report.generatedAt,
    scenario: {
      mode: input.scenario.mode,
      currentPrice,
      costBasis: input.scenario.costBasis,
      quantity: input.scenario.quantity,
    },
    market: {
      currentPrice,
      currentPriceSource: input.market.currentPriceSource,
      currentPriceStatus: input.market.currentPriceStatus,
      currentPriceObservedAt: input.market.currentPriceObservedAt,
      currentPriceChangePercent: input.market.currentPriceChangePercent,
      quoteErrorCode: input.market.quoteErrorCode,
      latestClose,
      latestTradeDate,
      latestCloseSource: latestClose === null ? null : 'local-daily-bars',
      priceDeltaPercent: latestClose === null ? null : round((currentPrice - latestClose) / latestClose * 100),
    },
    evidence,
    sources: cloneSources(input.report.sources),
    deterministic,
    ai,
    final: {
      recommendation: deterministic.recommendation,
      label: deterministic.label,
      action: deterministic.action,
      actionLabel: deterministic.actionLabel,
      confidence: deterministic.trust.level === 'high' ? deterministic.trust.score : null,
      source: 'deterministic',
      rationale: deterministic.rationale,
    },
  }
}

function emptyAiReview(status: QuantDecisionAssistantAiStatus, provider: QuantAiProvider | null, model: string | null, errorCode: string | null = null): QuantDecisionAssistantAiReview {
  return {
    aiVersion: QUANT_DECISION_ASSISTANT_AI_VERSION,
    status,
    provider,
    model,
    recommendation: null,
    action: null,
    confidence: null,
    accepted: false,
    rejectionReason: null,
    factorReviewCoverage: 0,
    rationale: null,
    risks: [],
    invalidationConditions: [],
    citedEvidenceKeys: [],
    factorReviews: [],
    errorCode,
  }
}

export function buildQuantDecisionAssistantAiUnavailable(config?: Pick<QuantDecryptedAiConfig, 'provider' | 'model'> | null, errorCode = 'QUANT_DECISION_ASSISTANT_CONFIGURATION'): QuantDecisionAssistantAiReview {
  return emptyAiReview('unavailable', config?.provider ?? null, config?.model ?? null, errorCode)
}

export function buildQuantDecisionAssistantAiFailure(error: unknown, config?: Pick<QuantDecryptedAiConfig, 'provider' | 'model'> | null): QuantDecisionAssistantAiReview {
  const errorCode = error instanceof QuantError ? error.code : 'QUANT_DECISION_ASSISTANT_UPSTREAM'
  const status: QuantDecisionAssistantAiStatus = errorCode === 'QUANT_DECISION_ASSISTANT_CONFIGURATION' ? 'unavailable' : 'failed'
  return emptyAiReview(status, config?.provider ?? null, config?.model ?? null, errorCode)
}

function mergeFinal(snapshot: QuantDecisionAssistantSnapshot, ai: QuantDecisionAssistantAiReview): QuantDecisionAssistantFinal {
  if (ai.accepted && ai.recommendation && ai.action && ai.rationale) {
    return {
      recommendation: ai.recommendation,
      label: recommendationLabel(ai.recommendation),
      action: ai.action,
      actionLabel: actionLabel(ai.action),
      confidence: ai.confidence,
      source: 'ai',
      rationale: ai.rationale,
    }
  }
  return {
    recommendation: snapshot.deterministic.recommendation,
    label: snapshot.deterministic.label,
    action: snapshot.deterministic.action,
    actionLabel: snapshot.deterministic.actionLabel,
    confidence: snapshot.deterministic.trust.level === 'high' ? snapshot.deterministic.trust.score : null,
    source: 'deterministic',
    rationale: snapshot.deterministic.rationale,
  }
}

export function applyQuantDecisionAssistantAiReview(snapshot: QuantDecisionAssistantSnapshot, ai: QuantDecisionAssistantAiReview): QuantDecisionAssistantSnapshot {
  return {
    ...snapshot,
    ai: {
      ...ai,
      risks: [...ai.risks],
      invalidationConditions: [...ai.invalidationConditions],
      citedEvidenceKeys: [...ai.citedEvidenceKeys],
      factorReviews: ai.factorReviews.map(review => ({ ...review, citedEvidenceKeys: [...review.citedEvidenceKeys] })),
    },
    final: mergeFinal(snapshot, ai),
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringList(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some(item => typeof item !== 'string' || !item.trim() || item.length > maxLength))
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', `AI decision assistant field ${field} is invalid`, 502)
  return [...new Set(value.map(item => (item as string).trim()))]
}

function assistantEvidenceKeys(value: unknown, report: QuantResearchReport): string[] {
  const keys = stringList(value, 'citedEvidenceKeys', 16, 128)
  const allowed = new Set(report.evidence.map(item => item.key))
  if (keys.some(key => !allowed.has(key)))
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI decision assistant cited an unknown evidence key', 502)
  return keys
}

function factorKey(value: unknown): value is QuantResearchFactorKey {
  return FACTOR_KEYS.includes(value as QuantResearchFactorKey)
}

function factorReviews(value: unknown, report: QuantResearchReport): QuantDecisionAssistantAiFactorReview[] {
  if (!Array.isArray(value) || value.length > 5)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI factor reviews are invalid', 502)
  const factors = new Map<QuantResearchFactorKey, QuantResearchFactor>((report.factorModel?.factors ?? []).map(factor => [factor.key, factor]))
  const seen = new Set<QuantResearchFactorKey>()
  return value.map((item) => {
    const parsed = record(item)
    const factor = parsed?.factor
    const stance = parsed?.stance
    const confidence = finite(parsed?.confidence)
    if (!parsed || !factorKey(factor) || seen.has(factor) || (stance !== 'support' && stance !== 'caution' && stance !== 'oppose' && stance !== 'insufficient') || confidence === null || confidence < 0 || confidence > 100)
      throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI factor review values are invalid', 502)
    const modelFactor = factors.get(factor)
    if (!modelFactor)
      throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI factor review references an unknown factor', 502)
    const rationale = text(parsed.rationale)
    if (!rationale || rationale.length > 600)
      throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI factor review rationale is invalid', 502)
    const cited = assistantEvidenceKeys(parsed.citedEvidenceKeys, report)
    const allowed = new Set(modelFactor.evidenceKeys)
    if (cited.some(key => !allowed.has(key)))
      throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI factor review cited evidence from another factor', 502)
    seen.add(factor)
    return { factor, stance: stance as QuantDecisionAssistantAiFactorReview['stance'], confidence, accepted: false, rationale, citedEvidenceKeys: cited }
  })
}

function assistantError(code: 'QUANT_DECISION_ASSISTANT_CONFIGURATION' | 'QUANT_DECISION_ASSISTANT_TIMEOUT' | 'QUANT_DECISION_ASSISTANT_UPSTREAM' | 'QUANT_DECISION_ASSISTANT_INVALID_RESPONSE' | 'QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', message: string, status: 500 | 502 | 503 | 504): QuantError {
  return new QuantError(code, message, status)
}

function assistantAction(value: unknown): QuantDecisionAssistantAction {
  if (ACTIONS.includes(value as QuantDecisionAssistantAction))
    return value as QuantDecisionAssistantAction
  throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI decision assistant action is invalid', 502)
}

function assistantRecommendation(value: unknown): QuantRecommendation {
  if (value === 'bullish' || value === 'bearish' || value === 'watch')
    return value
  throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI decision assistant recommendation is invalid', 502)
}

export function parseQuantAiDecisionAssistant(value: unknown, report: QuantResearchReport): QuantAiDecisionAssistantGenerated {
  const parsed = record(value)
  if (!parsed)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI decision assistant response is not an object', 502)
  const recommendation = assistantRecommendation(parsed.recommendation)
  const action = assistantAction(parsed.action)
  const confidence = finite(parsed.confidence)
  if (confidence === null || confidence < 0 || confidence > 100)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI decision assistant confidence is invalid', 502)
  const rationale = text(parsed.rationale)
  if (!rationale || rationale.length > 800)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI decision assistant rationale is invalid', 502)
  const risks = stringList(parsed.risks, 'risks', 6, 360)
  const invalidationConditions = stringList(parsed.invalidationConditions, 'invalidationConditions', 6, 360)
  const citedEvidenceKeys = assistantEvidenceKeys(parsed.citedEvidenceKeys, report)
  const parsedFactorReviews = factorReviews(parsed.factorReviews, report)
  const allText = [rationale, ...risks, ...invalidationConditions].join('\n')
  if (/目标价|收益预测|未来收益|建议(?:买入|卖出)|直接(?:买入|卖出)|立即(?:买入|卖出)|price\s*target|return\s+forecast/iu.test(allText))
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI decision assistant contains unsupported price or return forecast', 502)
  return {
    aiVersion: QUANT_DECISION_ASSISTANT_AI_VERSION,
    status: 'rejected',
    provider: null,
    model: null,
    recommendation,
    action,
    confidence,
    accepted: false,
    rejectionReason: null,
    factorReviewCoverage: 0,
    rationale,
    risks,
    invalidationConditions,
    citedEvidenceKeys,
    factorReviews: parsedFactorReviews,
    errorCode: null,
  }
}

function factorAssessment(report: QuantResearchReport, reviews: readonly QuantDecisionAssistantAiFactorReview[], recommendation: QuantRecommendation): { readonly coverage: number, readonly incomplete: boolean, readonly conflict: boolean, readonly reviews: readonly QuantDecisionAssistantAiFactorReview[] } {
  const factors = report.factorModel?.factors ?? []
  const totalWeight = factors.reduce((total, factor) => total + factor.weight, 0)
  const reviewed = reviews.map((review) => {
    const factor = factors.find(item => item.key === review.factor)
    const citedUsable = review.citedEvidenceKeys.some((key) => {
      const item = report.evidence.find(evidenceItem => evidenceItem.key === key)
      return item?.status === 'pass' || item?.status === 'caution'
    })
    const accepted = Boolean(factor && factor.status === 'ready' && factor.score !== null && review.confidence >= 60 && review.citedEvidenceKeys.length > 0 && citedUsable && review.stance !== 'insufficient')
    return { ...review, accepted }
  })
  const acceptedReviews = reviewed.filter(review => review.accepted)
  const reviewedWeight = acceptedReviews.reduce((total, review) => total + (factors.find(factor => factor.key === review.factor)?.weight ?? 0), 0)
  const supportWeight = acceptedReviews.reduce((total, review) => total + (review.stance === 'support' ? factors.find(factor => factor.key === review.factor)?.weight ?? 0 : 0), 0)
  const opposeWeight = acceptedReviews.reduce((total, review) => total + (review.stance === 'oppose' ? factors.find(factor => factor.key === review.factor)?.weight ?? 0 : 0), 0)
  const coverage = totalWeight > 0 ? round(reviewedWeight / totalWeight * 100) : 0
  return {
    coverage,
    incomplete: !factors.length || acceptedReviews.length === 0 || coverage < 60,
    conflict: recommendation === 'bullish' ? opposeWeight > supportWeight : recommendation === 'bearish' ? supportWeight > opposeWeight : true,
    reviews: reviewed,
  }
}

export function buildQuantDecisionAssistantAiReview(input: {
  readonly generated: QuantAiDecisionAssistantGenerated
  readonly config: Pick<QuantDecryptedAiConfig, 'provider' | 'model'>
  readonly report: QuantResearchReport
  readonly deterministic: QuantDecisionAssistantDeterministic
  readonly scenario: QuantDecisionAssistantScenario
}): QuantDecisionAssistantAiReview {
  const generated = input.generated
  const factor = factorAssessment(input.report, generated.factorReviews, generated.recommendation)
  const allowedAction = input.scenario.mode === 'buy'
    ? ['consider-buy', 'wait', 'avoid', 'verify-price', 'review-data'].includes(generated.action)
    : ['hold', 'reduce-review', 'add-review', 'wait', 'review-data'].includes(generated.action)
  const deterministicWatch = input.deterministic.recommendation === null || input.deterministic.recommendation === 'watch' || input.deterministic.coverage < 80
  const citedUsable = generated.citedEvidenceKeys.some((key) => {
    const item = input.report.evidence.find(evidenceItem => evidenceItem.key === key)
    return item?.status === 'pass' || item?.status === 'caution'
  })
  const conflict = generated.recommendation !== input.deterministic.recommendation || factor.conflict
  const accepted = !deterministicWatch
    && input.deterministic.trust.level !== 'low'
    && input.deterministic.evidence.failed === 0
    && allowedAction
    && generated.confidence >= 60
    && generated.citedEvidenceKeys.length > 0
    && citedUsable
    && !factor.incomplete
    && !conflict
  const rejectionReason: QuantDecisionAssistantAiRejectionReason | null = accepted
    ? null
    : deterministicWatch
      ? 'deterministic-watch'
      : !allowedAction
          ? 'invalid-action'
          : generated.citedEvidenceKeys.length === 0 || !citedUsable
            ? 'missing-citation'
            : factor.conflict || conflict
              ? 'factor-conflict'
              : factor.incomplete
                ? 'factor-review-incomplete'
                : 'low-confidence'
  return {
    ...generated,
    provider: input.config.provider,
    model: input.config.model,
    status: accepted ? 'accepted' : 'rejected',
    accepted,
    rejectionReason,
    factorReviewCoverage: factor.coverage,
    factorReviews: factor.reviews,
  }
}

function assistantPromptFacts(report: QuantResearchReport, deterministic: QuantDecisionAssistantDeterministic, scenario: QuantDecisionAssistantScenario, market: QuantDecisionAssistantMarket): string {
  const facts = {
    reportVersion: report.reportVersion,
    tsCode: report.tsCode,
    name: report.name,
    reportGeneratedAt: report.generatedAt,
    status: report.status,
    deterministic: {
      recommendation: deterministic.recommendation,
      action: deterministic.action,
      coverage: deterministic.coverage,
      score: deterministic.score,
      priceStatus: deterministic.priceStatus,
      buyPriceRange: deterministic.buyPriceRange,
      sellPriceRange: deterministic.sellPriceRange,
      trust: deterministic.trust,
      evidence: deterministic.evidence,
    },
    market,
    scenario,
    factorModel: report.factorModel ?? null,
    evidence: report.evidence.slice(0, 32).map(item => ({
      key: item.key,
      dimension: item.dimension,
      label: item.label,
      status: item.status,
      value: item.value,
      threshold: item.threshold,
      source: item.source,
      observedAt: item.observedAt,
      detail: item.detail.slice(0, 360),
    })),
  }
  return JSON.stringify(facts).slice(0, 15_000)
}

export function buildQuantAiDecisionAssistantPrompt(input: Pick<QuantAiDecisionAssistantRequest, 'report' | 'deterministic' | 'scenario' | 'market'>): string {
  return [
    '你是 Quant 的证据交叉核对器。请针对用户场景复核确定性研究结果，只能使用给定 JSON 中的报告、因子、证据和场景数字。',
    '返回 JSON 对象，字段必须是 recommendation、action、confidence、rationale、risks、invalidationConditions、citedEvidenceKeys、factorReviews。',
    'recommendation 只能是 bullish、bearish、watch；confidence 是 0-100 数字；action 必须与 mode 匹配：buy 可用 consider-buy/wait/avoid/verify-price/review-data，holding 可用 hold/reduce-review/add-review/wait/review-data。',
    'factorReviews 逐项使用 factorModel 中存在的因子，字段为 factor、stance、confidence、rationale、citedEvidenceKeys；stance 只能是 support、caution、oppose、insufficient。引用只能来自对应因子的 evidenceKeys。',
    '不要输出 accepted，服务端会根据覆盖、引用、置信度和方向冲突重新计算；不要改变原始分数、因子权重、证据状态或参考买卖区间。',
    'currentPrice 由服务端 market 快照提供，必须结合 currentPriceSource、currentPriceStatus 和 currentPriceObservedAt 判断新鲜度；costBasis 是用户场景输入，不是来源证据。不要生成目标价、收益预测或自动下单指令。',
    `事实包：${assistantPromptFacts(input.report, input.deterministic, input.scenario, input.market)}`,
  ].join('\n')
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim()
  return trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '').trim()
    : trimmed
}

export async function generateQuantAiDecisionAssistant(input: QuantAiDecisionAssistantRequest): Promise<QuantAiDecisionAssistantGenerated> {
  if (!input.config.apiKey && input.config.provider !== 'ollama')
    throw assistantError('QUANT_DECISION_ASSISTANT_CONFIGURATION', 'AI API key is not configured', 503)
  const timeoutMs = resolveQuantAiGenerationTimeout(input.timeoutMs)
  const { content } = await requestQuantAiCompletion({
    config: input.config,
    timeoutMs,
    fetchImpl: input.fetchImpl,
    maxCompletionTokens: 3_500,
    maxResponseLength: 8_000,
    temperature: 0.1,
    responseFormat: 'json_object',
    messages: [
      { role: 'system', content: '你只返回符合要求的 JSON，并且只解释已有证据。' },
      { role: 'user', content: buildQuantAiDecisionAssistantPrompt(input) },
    ],
    errorCodes: {
      configuration: 'QUANT_DECISION_ASSISTANT_CONFIGURATION',
      timeout: 'QUANT_DECISION_ASSISTANT_TIMEOUT',
      upstream: 'QUANT_DECISION_ASSISTANT_UPSTREAM',
      invalid_response: 'QUANT_DECISION_ASSISTANT_INVALID_RESPONSE',
    },
  })
  try {
    return parseQuantAiDecisionAssistant(JSON.parse(stripJsonFence(content)), input.report)
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_RESPONSE', 'AI decision assistant content is not valid JSON', 502)
  }
}

function parseSnapshotNumber(value: unknown, field = 'value', nullable = false): number | null {
  if ((value === null || value === undefined) && nullable)
    return null
  const parsed = finite(value)
  if (parsed === null)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', `Persisted decision assistant ${field} is invalid`, 500)
  return parsed
}

function parseSnapshotText(value: unknown, field = 'value', nullable = false): string | null {
  if ((value === null || value === undefined) && nullable)
    return null
  const parsed = text(value)
  if (!parsed)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', `Persisted decision assistant ${field} is invalid`, 500)
  return parsed
}

function parseSnapshotStringList(value: unknown, field: string, maxItems = 16): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some(item => typeof item !== 'string' || !item.trim()))
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', `Persisted decision assistant ${field} is invalid`, 500)
  return value.map(item => (item as string).trim())
}

function parseSnapshotPriceRange(value: unknown): QuantReferencePriceRange | null {
  if (value === null)
    return null
  const parsed = record(value)
  if (!parsed)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant price range is invalid', 500)
  const low = parseSnapshotNumber(parsed.low, 'priceRange.low')!
  const high = parseSnapshotNumber(parsed.high, 'priceRange.high')!
  const currency = parseSnapshotText(parsed.currency, 'priceRange.currency')
  const formulaVersion = parseSnapshotText(parsed.formulaVersion, 'priceRange.formulaVersion')
  const source = parseSnapshotText(parsed.source, 'priceRange.source')
  const observedAt = parseSnapshotText(parsed.observedAt, 'priceRange.observedAt')
  const evidenceKeys = parseSnapshotStringList(parsed.evidenceKeys, 'priceRange.evidenceKeys')
  if (low < 0 || high < low || currency !== 'CNY' || formulaVersion !== 'reference-price-v1' || !source || !observedAt)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant price range values are invalid', 500)
  return { low, high, currency: 'CNY', formulaVersion, source, observedAt, evidenceKeys }
}

function parseSnapshotTrust(value: unknown): QuantDecisionAssistantTrust {
  const parsed = record(value)
  if (!parsed)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant trust is invalid', 500)
  const level = parsed.level
  if (level !== 'high' && level !== 'medium' && level !== 'low')
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant trust level is invalid', 500)
  const score = parseSnapshotNumber(parsed.score)!
  const coverage = parseSnapshotNumber(parsed.coverage)!
  const evidenceCoverage = parseSnapshotNumber(parsed.evidenceCoverage)!
  const sourceCount = parseSnapshotNumber(parsed.sourceCount)!
  const freshnessDays = parseSnapshotNumber(parsed.freshnessDays, 'trust.freshnessDays', true)
  const latestObservedAt = parseSnapshotText(parsed.latestObservedAt, 'trust.latestObservedAt', true)
  const missingEvidenceCount = parseSnapshotNumber(parsed.missingEvidenceCount)!
  const failedEvidenceCount = parseSnapshotNumber(parsed.failedEvidenceCount)!
  const crossSourceAlertCount = parseSnapshotNumber(parsed.crossSourceAlertCount)!
  const reasons = parseSnapshotStringList(parsed.reasons, 'trust.reasons', 16)
  if (score < 0 || score > 100 || coverage < 0 || coverage > 100 || evidenceCoverage < 0 || evidenceCoverage > 100 || sourceCount < 0 || (freshnessDays !== null && freshnessDays < 0) || missingEvidenceCount < 0 || failedEvidenceCount < 0 || crossSourceAlertCount < 0)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant trust values are invalid', 500)
  return { level, score, coverage, evidenceCoverage, sourceCount, latestObservedAt, freshnessDays, missingEvidenceCount, failedEvidenceCount, crossSourceAlertCount, reasons }
}

function parseSnapshotEvidence(value: unknown): QuantDecisionAssistantEvidenceSummary {
  const parsed = record(value)
  if (!parsed)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant evidence is invalid', 500)
  const total = parseSnapshotNumber(parsed.total)!
  const usable = parseSnapshotNumber(parsed.usable)!
  const missing = parseSnapshotNumber(parsed.missing)!
  const failed = parseSnapshotNumber(parsed.failed)!
  if (total < 0 || usable < 0 || usable > total || missing < 0 || failed < 0 || missing + usable + failed !== total)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant evidence values are invalid', 500)
  return { total, usable, missing, failed }
}

function parseSnapshotSources(value: unknown): QuantResearchSource[] {
  if (!Array.isArray(value) || value.length > 16)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant sources are invalid', 500)
  return value.map((item) => {
    const parsed = record(item)
    if (!parsed)
      throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant source is invalid', 500)
    return {
      id: parseSnapshotText(parsed.id, 'source.id')!,
      name: parseSnapshotText(parsed.name, 'source.name')!,
      observedAt: parseSnapshotText(parsed.observedAt, 'source.observedAt', true),
      formulaVersion: parseSnapshotText(parsed.formulaVersion, 'source.formulaVersion')!,
    }
  })
}

function parseSnapshotAi(value: unknown): QuantDecisionAssistantAiReview {
  const parsed = record(value)
  if (!parsed || parsed.aiVersion !== QUANT_DECISION_ASSISTANT_AI_VERSION)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant AI version is invalid', 500)
  const status = parsed.status
  if (status !== 'accepted' && status !== 'rejected' && status !== 'failed' && status !== 'unavailable' && status !== 'not-requested')
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant AI status is invalid', 500)
  const provider = parsed.provider === null ? null : parseSnapshotText(parsed.provider, 'ai.provider') as QuantAiProvider
  if (provider !== null && !['openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama'].includes(provider))
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant AI provider is invalid', 500)
  const model = parseSnapshotText(parsed.model, 'ai.model', true)
  const recommendation = parsed.recommendation === null ? null : assistantRecommendation(parsed.recommendation)
  const action = parsed.action === null ? null : assistantAction(parsed.action)
  const confidence = parseSnapshotNumber(parsed.confidence, 'ai.confidence', true)
  const rejectionReason = parsed.rejectionReason === null ? null : parsed.rejectionReason as QuantDecisionAssistantAiRejectionReason
  if (rejectionReason !== null && !['low-confidence', 'deterministic-watch', 'factor-review-incomplete', 'factor-conflict', 'missing-citation', 'invalid-action'].includes(rejectionReason))
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant AI rejection reason is invalid', 500)
  const factorReviewCoverage = parseSnapshotNumber(parsed.factorReviewCoverage)!
  const rationale = parseSnapshotText(parsed.rationale, 'ai.rationale', true)
  const risks = parseSnapshotStringList(parsed.risks, 'ai.risks', 6)
  const invalidationConditions = parseSnapshotStringList(parsed.invalidationConditions, 'ai.invalidationConditions', 6)
  const citedEvidenceKeys = parseSnapshotStringList(parsed.citedEvidenceKeys, 'ai.citedEvidenceKeys')
  const errorCode = parseSnapshotText(parsed.errorCode, 'ai.errorCode', true)
  if (typeof parsed.accepted !== 'boolean' || factorReviewCoverage < 0 || factorReviewCoverage > 100 || (confidence !== null && (confidence < 0 || confidence > 100)))
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant AI values are invalid', 500)
  if (!Array.isArray(parsed.factorReviews) || parsed.factorReviews.length > 5)
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant factor reviews are invalid', 500)
  const reviews = parsed.factorReviews.map((item) => {
    const review = record(item)
    if (!review || !factorKey(review.factor) || (review.stance !== 'support' && review.stance !== 'caution' && review.stance !== 'oppose' && review.stance !== 'insufficient') || typeof review.accepted !== 'boolean')
      throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant factor review is invalid', 500)
    const reviewConfidence = parseSnapshotNumber(review.confidence)!
    const reviewRationale = parseSnapshotText(review.rationale, 'ai.factorReviews.rationale')!
    const reviewEvidence = parseSnapshotStringList(review.citedEvidenceKeys, 'ai.factorReviews.citedEvidenceKeys')
    if (reviewConfidence < 0 || reviewConfidence > 100 || reviewRationale.length > 600)
      throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant factor review values are invalid', 500)
    return { factor: review.factor, stance: review.stance as QuantDecisionAssistantAiFactorReview['stance'], confidence: reviewConfidence, accepted: review.accepted, rationale: reviewRationale, citedEvidenceKeys: reviewEvidence }
  })
  return {
    aiVersion: QUANT_DECISION_ASSISTANT_AI_VERSION,
    status,
    provider,
    model,
    recommendation,
    action,
    confidence,
    accepted: parsed.accepted,
    rejectionReason,
    factorReviewCoverage,
    rationale,
    risks,
    invalidationConditions,
    citedEvidenceKeys,
    factorReviews: reviews,
    errorCode,
  }
}

function validateSnapshotEvidenceReferences(snapshot: QuantDecisionAssistantSnapshot, report: QuantResearchReport): void {
  const evidenceByKey = new Map(report.evidence.map(item => [item.key, item] as const))
  const assertKeys = (keys: readonly string[], label: string): void => {
    if (keys.some(key => !evidenceByKey.has(key)))
      throw new Error(`invalid ${label} evidence reference`)
  }
  assertKeys(snapshot.deterministic.evidenceKeys, 'deterministic')
  assertKeys(snapshot.deterministic.buyPriceRange?.evidenceKeys ?? [], 'buy range')
  assertKeys(snapshot.deterministic.sellPriceRange?.evidenceKeys ?? [], 'sell range')
  assertKeys(snapshot.ai.citedEvidenceKeys, 'AI')
  for (const review of snapshot.ai.factorReviews) {
    const factor = report.factorModel?.factors.find(item => item.key === review.factor)
    if (!factor || review.citedEvidenceKeys.some(key => !factor.evidenceKeys.includes(key)))
      throw new Error('invalid AI factor evidence reference')
  }
}

export function parseQuantDecisionAssistantSnapshot(value: string, report?: QuantResearchReport): QuantDecisionAssistantSnapshot {
  try {
    const parsed: unknown = JSON.parse(value)
    const root = record(parsed)
    if (!root || root.snapshotVersion !== QUANT_DECISION_ASSISTANT_VERSION)
      throw new Error('version')
    const tsCode = parseSnapshotText(root.tsCode, 'tsCode')!
    const name = parseSnapshotText(root.name, 'name', true)
    const researchRunId = parseSnapshotText(root.researchRunId, 'researchRunId')!
    const assessedAt = parseSnapshotText(root.assessedAt, 'assessedAt')!
    const reportGeneratedAt = parseSnapshotText(root.reportGeneratedAt, 'reportGeneratedAt')!
    const scenarioValue = record(root.scenario)
    if (!scenarioValue || (scenarioValue.mode !== 'buy' && scenarioValue.mode !== 'holding'))
      throw new Error('scenario')
    const scenario: QuantDecisionAssistantScenario = {
      mode: scenarioValue.mode,
      currentPrice: parseSnapshotNumber(scenarioValue.currentPrice, 'scenario.currentPrice')!,
      costBasis: parseSnapshotNumber(scenarioValue.costBasis, 'scenario.costBasis', true),
      quantity: parseSnapshotNumber(scenarioValue.quantity, 'scenario.quantity', true),
    }
    if (scenario.currentPrice <= 0 || (scenario.costBasis !== null && scenario.costBasis <= 0) || (scenario.quantity !== null && scenario.quantity <= 0) || (scenario.mode === 'holding' && scenario.costBasis === null))
      throw new Error('scenario values')
    const marketValue = record(root.market)
    if (!marketValue)
      throw new Error('market')
    const currentPriceSource = marketValue.currentPriceSource === 'eastmoney-realtime' || marketValue.currentPriceSource === 'local-daily-bars' || marketValue.currentPriceSource === 'user-input'
      ? marketValue.currentPriceSource
      : marketValue.currentPriceSource === undefined ? 'user-input' : (() => { throw new Error('market source') })()
    const currentPriceStatus = marketValue.currentPriceStatus === 'realtime' || marketValue.currentPriceStatus === 'latest-close' || marketValue.currentPriceStatus === 'user-input'
      ? marketValue.currentPriceStatus
      : marketValue.currentPriceStatus === undefined ? 'user-input' : (() => { throw new Error('market status') })()
    const currentPriceObservedAt = parseSnapshotText(marketValue.currentPriceObservedAt, 'market.currentPriceObservedAt', true) ?? assessedAt
    const market: QuantDecisionAssistantMarket = {
      currentPrice: parseSnapshotNumber(marketValue.currentPrice, 'market.currentPrice')!,
      currentPriceSource,
      currentPriceStatus,
      currentPriceObservedAt,
      currentPriceChangePercent: parseSnapshotNumber(marketValue.currentPriceChangePercent, 'market.currentPriceChangePercent', true),
      quoteErrorCode: parseSnapshotText(marketValue.quoteErrorCode, 'market.quoteErrorCode', true),
      latestClose: parseSnapshotNumber(marketValue.latestClose, 'market.latestClose', true),
      latestTradeDate: parseSnapshotText(marketValue.latestTradeDate, 'market.latestTradeDate', true),
      latestCloseSource: marketValue.latestCloseSource === null ? null : marketValue.latestCloseSource === 'local-daily-bars' ? 'local-daily-bars' : (() => { throw new Error('latest source') })(),
      priceDeltaPercent: parseSnapshotNumber(marketValue.priceDeltaPercent, 'market.priceDeltaPercent', true),
    }
    if (market.currentPrice !== scenario.currentPrice
      || (market.currentPriceSource === 'eastmoney-realtime' && market.currentPriceStatus !== 'realtime')
      || (market.currentPriceSource === 'local-daily-bars' && market.currentPriceStatus !== 'latest-close')
      || (market.currentPriceSource === 'user-input' && market.currentPriceStatus !== 'user-input')) {
      throw new Error('market scenario mismatch')
    }
    const evidence = parseSnapshotEvidence(root.evidence)
    const sources = parseSnapshotSources(root.sources)
    const deterministicValue = record(root.deterministic)
    if (!deterministicValue)
      throw new Error('deterministic')
    const recommendation = deterministicValue.recommendation === null ? null : assistantRecommendation(deterministicValue.recommendation)
    const deterministicAction = assistantAction(deterministicValue.action)
    const deterministic: QuantDecisionAssistantDeterministic = {
      recommendation,
      label: deterministicValue.label === '看多' || deterministicValue.label === '看空' || deterministicValue.label === '观望' ? deterministicValue.label : (() => { throw new Error('label') })(),
      action: deterministicAction,
      actionLabel: parseSnapshotText(deterministicValue.actionLabel, 'deterministic.actionLabel')!,
      rationale: parseSnapshotText(deterministicValue.rationale, 'deterministic.rationale')!,
      priceStatus: deterministicValue.priceStatus === 'within' || deterministicValue.priceStatus === 'below' || deterministicValue.priceStatus === 'above' || deterministicValue.priceStatus === 'unavailable' ? deterministicValue.priceStatus : (() => { throw new Error('price status') })(),
      priceLabel: parseSnapshotText(deterministicValue.priceLabel, 'deterministic.priceLabel')!,
      priceDetail: parseSnapshotText(deterministicValue.priceDetail, 'deterministic.priceDetail')!,
      score: parseSnapshotNumber(deterministicValue.score, 'deterministic.score', true),
      coverage: parseSnapshotNumber(deterministicValue.coverage, 'deterministic.coverage')!,
      buyPriceRange: parseSnapshotPriceRange(deterministicValue.buyPriceRange),
      sellPriceRange: parseSnapshotPriceRange(deterministicValue.sellPriceRange),
      unrealizedPnlPercent: parseSnapshotNumber(deterministicValue.unrealizedPnlPercent, 'deterministic.unrealizedPnlPercent', true),
      recoveryPercent: parseSnapshotNumber(deterministicValue.recoveryPercent, 'deterministic.recoveryPercent', true),
      trust: parseSnapshotTrust(deterministicValue.trust),
      evidence: parseSnapshotEvidence(deterministicValue.evidence),
      evidenceKeys: parseSnapshotStringList(deterministicValue.evidenceKeys, 'deterministic.evidenceKeys', 64),
      sources: parseSnapshotSources(deterministicValue.sources),
      checks: parseSnapshotStringList(deterministicValue.checks, 'deterministic.checks', 16),
      invalidationConditions: parseSnapshotStringList(deterministicValue.invalidationConditions, 'deterministic.invalidationConditions', 16),
    }
    const sourcesMatch = sources.length === deterministic.sources.length && sources.every((source, index) => {
      const deterministicSource = deterministic.sources[index]
      return deterministicSource?.id === source.id && deterministicSource.name === source.name && deterministicSource.observedAt === source.observedAt && deterministicSource.formulaVersion === source.formulaVersion
    })
    if (deterministic.coverage < 0 || deterministic.coverage > 100 || (deterministic.score !== null && (deterministic.score < 0 || deterministic.score > 100)) || deterministic.evidence.total !== evidence.total || deterministic.evidence.usable !== evidence.usable || deterministic.evidence.missing !== evidence.missing || deterministic.evidence.failed !== evidence.failed || !sourcesMatch)
      throw new Error('deterministic values')
    const ai = parseSnapshotAi(root.ai)
    const finalValue = record(root.final)
    if (!finalValue)
      throw new Error('final')
    const finalAction = assistantAction(finalValue.action)
    const finalRecommendation = finalValue.recommendation === null ? null : assistantRecommendation(finalValue.recommendation)
    const finalSource = finalValue.source === 'ai' || finalValue.source === 'deterministic' ? finalValue.source : null
    if (!finalSource)
      throw new Error('final source')
    const final: QuantDecisionAssistantFinal = {
      recommendation: finalRecommendation,
      label: finalValue.label === '看多' || finalValue.label === '看空' || finalValue.label === '观望' ? finalValue.label : (() => { throw new Error('final label') })(),
      action: finalAction,
      actionLabel: parseSnapshotText(finalValue.actionLabel, 'final.actionLabel')!,
      confidence: parseSnapshotNumber(finalValue.confidence, 'final.confidence', true),
      source: finalSource,
      rationale: parseSnapshotText(finalValue.rationale, 'final.rationale')!,
    }
    if ((final.source === 'ai' && !ai.accepted) || (final.source === 'deterministic' && ai.accepted))
      throw new Error('final source mismatch')
    const snapshot = { snapshotVersion: QUANT_DECISION_ASSISTANT_VERSION, tsCode, name, researchRunId, assessedAt, reportGeneratedAt, scenario, market, evidence, sources, deterministic, ai, final }
    if (report)
      validateSnapshotEvidenceReferences(snapshot, report)
    return snapshot
  }
  catch (error) {
    if (error instanceof QuantError)
      throw error
    throw assistantError('QUANT_DECISION_ASSISTANT_INVALID_SNAPSHOT', 'Persisted decision assistant snapshot is invalid', 500)
  }
}
