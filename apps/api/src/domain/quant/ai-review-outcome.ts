export const QUANT_AI_REVIEW_OUTCOME_STATUSES = ['aligned', 'opposed', 'flat', 'pending', 'unavailable', 'not-directional'] as const
export type QuantAiReviewOutcomeStatus = typeof QUANT_AI_REVIEW_OUTCOME_STATUSES[number]

export interface QuantAiReviewBar {
  readonly tradeDate: string
  readonly close: number
}

export interface QuantAiReviewOutcomeSource {
  readonly tsCode: string
  readonly name: string | null
  readonly reviewedAt: string
  readonly accepted: boolean | null
  readonly recommendation: 'bullish' | 'bearish' | 'watch' | null
  readonly bars: readonly QuantAiReviewBar[]
}

export interface QuantAiReviewOutcome {
  readonly tsCode: string
  readonly name: string | null
  readonly reviewedAt: string
  readonly accepted: boolean | null
  readonly recommendation: 'bullish' | 'bearish' | 'watch' | null
  readonly baselineClose: number | null
  readonly baselineTradeDate: string | null
  readonly observationClose: number | null
  readonly observationTradeDate: string | null
  readonly changePercent: number | null
  readonly status: QuantAiReviewOutcomeStatus
  readonly label: string
  readonly detail: string
}

export interface QuantAiReviewOutcomeBoard {
  readonly headline: string
  readonly acceptedAgreementRate: number | null
  readonly unacceptedAgreementRate: number | null
  readonly acceptedDirectionalCount: number
  readonly unacceptedDirectionalCount: number
  readonly pendingCount: number
  readonly items: readonly QuantAiReviewOutcome[]
}

const STATUS_RANK: Record<QuantAiReviewOutcomeStatus, number> = {
  'opposed': 0,
  'aligned': 1,
  'flat': 2,
  'pending': 3,
  'unavailable': 4,
  'not-directional': 5,
}

function compactDate(value: string): string | null {
  const digits = value.replace(/\D/gu, '')
  return digits.length >= 8 ? digits.slice(0, 8) : null
}

function finitePositive(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function agreementRate(aligned: number, opposed: number): number | null {
  const sample = aligned + opposed
  return sample >= 3 ? round(aligned / sample * 100) : null
}

export function buildQuantAiReviewOutcome(source: QuantAiReviewOutcomeSource): QuantAiReviewOutcome {
  const reviewDate = compactDate(source.reviewedAt)
  const bars = source.bars
    .flatMap((bar) => {
      const tradeDate = compactDate(bar.tradeDate)
      const close = finitePositive(bar.close)
      return tradeDate && close !== null ? [{ tradeDate, close, rawDate: bar.tradeDate }] : []
    })
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
  const base = {
    tsCode: source.tsCode,
    name: source.name,
    reviewedAt: source.reviewedAt,
    accepted: source.accepted,
    recommendation: source.recommendation,
    baselineClose: null,
    baselineTradeDate: null,
    observationClose: null,
    observationTradeDate: null,
    changePercent: null,
  }
  if (!reviewDate || source.accepted === null || !source.recommendation) {
    return { ...base, status: 'unavailable', label: '复核快照不完整', detail: '这次 AI 复核没有可回看的决策结论。' }
  }
  if (source.recommendation === 'watch') {
    return { ...base, status: 'not-directional', label: '复核是观望', detail: '观望没有方向，不计入后续一致率。' }
  }
  const baseline = [...bars].reverse().find(bar => bar.tradeDate <= reviewDate) ?? null
  if (!baseline) {
    return { ...base, status: 'unavailable', label: '缺少复核前收盘', detail: '复核日之前没有可用收盘，不能判断后来的方向。' }
  }
  const observation = [...bars].reverse().find(bar => bar.tradeDate > baseline.tradeDate) ?? null
  if (!observation) {
    return {
      ...base,
      baselineClose: baseline.close,
      baselineTradeDate: baseline.rawDate,
      status: 'pending',
      label: '等待后续收盘',
      detail: `复核前收盘 ${baseline.close.toFixed(2)} 元（${baseline.rawDate}），还没有更晚的收盘。`,
    }
  }
  const changePercent = round((observation.close / baseline.close - 1) * 100)
  const expectedUp = source.recommendation === 'bullish'
  const status: QuantAiReviewOutcomeStatus = changePercent === 0
    ? 'flat'
    : (changePercent > 0) === expectedUp ? 'aligned' : 'opposed'
  const label = status === 'aligned' ? '后续方向一致' : status === 'opposed' ? '后续方向相反' : '后续价格未变'
  const acceptance = source.accepted ? '已接受' : '未接受'
  return {
    ...base,
    baselineClose: baseline.close,
    baselineTradeDate: baseline.rawDate,
    observationClose: observation.close,
    observationTradeDate: observation.rawDate,
    changePercent,
    status,
    label,
    detail: `${acceptance}${source.recommendation === 'bullish' ? '看多' : '看空'}。${baseline.rawDate} 收盘 ${baseline.close.toFixed(2)} 元，${observation.rawDate} 收盘 ${observation.close.toFixed(2)} 元，变化 ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%。这不是收益。`,
  }
}

function cohortRate(items: readonly QuantAiReviewOutcome[], accepted: boolean): { readonly rate: number | null, readonly count: number } {
  const directional = items.filter(item => item.accepted === accepted && (item.status === 'aligned' || item.status === 'opposed'))
  const aligned = directional.filter(item => item.status === 'aligned').length
  return { rate: agreementRate(aligned, directional.length - aligned), count: directional.length }
}

function boardHeadline(acceptedRate: number | null, acceptedCount: number, unacceptedRate: number | null, unacceptedCount: number, pendingCount: number): string {
  const side = (label: string, rate: number | null, count: number) => rate === null
    ? `${label}方向样本 ${count} 条，不足 3 条`
    : `${label}后续方向一致 ${rate.toFixed(0)}%（${count} 条）`
  let comparison = '样本还不能比较 AI 复核有没有提高方向参考价值。'
  if (acceptedRate !== null && unacceptedRate !== null) {
    if (acceptedRate > unacceptedRate)
      comparison = '目前已接受复核的后续方向一致率更高，仍不能当成胜率。'
    else if (acceptedRate < unacceptedRate)
      comparison = '目前未接受复核的后续方向一致率更高，接受门槛还没有表现出优势。'
    else
      comparison = '目前两边的后续方向一致率相同，不能当成胜率。'
  }
  return `每只股票只用最近一次 AI 复核。${side('已接受', acceptedRate, acceptedCount)}；${side('未接受', unacceptedRate, unacceptedCount)}。${comparison}${pendingCount ? `另有 ${pendingCount} 只在等后续收盘。` : ''}这不是收益。`
}

export function buildQuantAiReviewOutcomeBoard(sources: readonly QuantAiReviewOutcomeSource[]): QuantAiReviewOutcomeBoard {
  const items = sources.map(buildQuantAiReviewOutcome).sort((left, right) => {
    const rank = STATUS_RANK[left.status] - STATUS_RANK[right.status]
    if (rank !== 0)
      return rank
    return Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0) || left.tsCode.localeCompare(right.tsCode)
  })
  const accepted = cohortRate(items, true)
  const unaccepted = cohortRate(items, false)
  const pendingCount = items.filter(item => item.status === 'pending').length
  return {
    headline: boardHeadline(accepted.rate, accepted.count, unaccepted.rate, unaccepted.count, pendingCount),
    acceptedAgreementRate: accepted.rate,
    unacceptedAgreementRate: unaccepted.rate,
    acceptedDirectionalCount: accepted.count,
    unacceptedDirectionalCount: unaccepted.count,
    pendingCount,
    items,
  }
}

export function readQuantAiSummaryDecision(summaryJson: string): { readonly accepted: boolean | null, readonly recommendation: 'bullish' | 'bearish' | 'watch' | null } {
  try {
    const parsed: unknown = JSON.parse(summaryJson)
    if (!parsed || typeof parsed !== 'object' || !('decisionReview' in parsed))
      return { accepted: null, recommendation: null }
    const review: unknown = parsed.decisionReview
    if (!review || typeof review !== 'object')
      return { accepted: null, recommendation: null }
    const recommendation = 'recommendation' in review ? review.recommendation : null
    const accepted = 'accepted' in review ? review.accepted : null
    return {
      accepted: typeof accepted === 'boolean' ? accepted : null,
      recommendation: recommendation === 'bullish' || recommendation === 'bearish' || recommendation === 'watch' ? recommendation : null,
    }
  }
  catch {
    return { accepted: null, recommendation: null }
  }
}
