export const QUANT_PRICE_LOCATION_STATUSES = ['inside', 'below', 'above', 'not-buying', 'missing-range', 'missing-price', 'missing-report'] as const
export type QuantPriceLocationStatus = typeof QUANT_PRICE_LOCATION_STATUSES[number]

export interface QuantPriceLocationSource {
  readonly tsCode: string
  readonly name: string | null
  readonly latestClose: number | null
  readonly latestTradeDate: string | null
  readonly reportGeneratedAt: string | null
  readonly recommendation: 'bullish' | 'bearish' | 'watch' | null
  readonly rangeLow: number | null
  readonly rangeHigh: number | null
}

export interface QuantPriceLocation {
  readonly tsCode: string
  readonly name: string | null
  readonly latestClose: number | null
  readonly latestTradeDate: string | null
  readonly reportGeneratedAt: string | null
  readonly recommendation: 'bullish' | 'bearish' | 'watch' | null
  readonly recommendationLabel: string | null
  readonly rangeLow: number | null
  readonly rangeHigh: number | null
  readonly status: QuantPriceLocationStatus
  readonly label: string
  readonly distancePercent: number | null
  readonly detail: string
}

const STATUS_RANK: Record<QuantPriceLocationStatus, number> = {
  'inside': 0,
  'below': 1,
  'above': 2,
  'not-buying': 3,
  'missing-range': 4,
  'missing-price': 5,
  'missing-report': 6,
}

function finite(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function recommendationLabel(value: QuantPriceLocationSource['recommendation']): string | null {
  if (value === 'bullish')
    return '看多'
  if (value === 'bearish')
    return '看空'
  if (value === 'watch')
    return '观望'
  return null
}

function percent(close: number, boundary: number): number {
  return (close / boundary - 1) * 100
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object')
    return null
  return Object.fromEntries(Object.entries(value))
}

export function buildQuantPriceLocation(source: QuantPriceLocationSource): QuantPriceLocation {
  const close = finite(source.latestClose)
  const low = finite(source.rangeLow)
  const high = finite(source.rangeHigh)
  const recommendation = source.recommendation
  const base = {
    tsCode: source.tsCode,
    name: source.name,
    latestClose: close,
    latestTradeDate: source.latestTradeDate,
    reportGeneratedAt: source.reportGeneratedAt,
    recommendation,
    recommendationLabel: recommendationLabel(recommendation),
    rangeLow: low,
    rangeHigh: high,
  }

  if (!source.reportGeneratedAt || !recommendation) {
    return { ...base, status: 'missing-report', label: '还没有研究报告', distancePercent: null, detail: '生成研究报告后，才能比较最近收盘和参考买入区间。' }
  }
  if (recommendation !== 'bullish') {
    return {
      ...base,
      status: 'not-buying',
      label: '当前不是看多',
      distancePercent: null,
      detail: `当前推荐${recommendationLabel(recommendation)}。参考买入区间只在看多时作为价格条件，不表示现在要动作。`,
    }
  }
  if (close === null) {
    return { ...base, status: 'missing-price', label: '缺少最近收盘', distancePercent: null, detail: '观察池还没有这只股票的最近收盘，先更新日线。' }
  }
  if (low === null || high === null || low <= 0 || high < low) {
    return { ...base, status: 'missing-range', label: '看多但缺少参考区间', distancePercent: null, detail: '报告是看多，但没有完整的参考买入区间。' }
  }
  if (close < low) {
    const distancePercent = percent(close, low)
    return { ...base, status: 'below', label: '收盘低于参考区间', distancePercent, detail: `最近收盘 ${close.toFixed(2)} 元，低于 ${low.toFixed(2)} - ${high.toFixed(2)} 元 ${Math.abs(distancePercent).toFixed(1)}%。这只说明价格条件未到。` }
  }
  if (close > high) {
    const distancePercent = percent(close, high)
    return { ...base, status: 'above', label: '收盘高于参考区间', distancePercent, detail: `最近收盘 ${close.toFixed(2)} 元，高于 ${low.toFixed(2)} - ${high.toFixed(2)} 元 ${distancePercent.toFixed(1)}%。看多不等于当前价已经满足价格条件。` }
  }
  return { ...base, status: 'inside', label: '收盘在参考区间内', distancePercent: 0, detail: `最近收盘 ${close.toFixed(2)} 元，位于 ${low.toFixed(2)} - ${high.toFixed(2)} 元。这只表示价格条件满足，还要核对数据和失效条件。` }
}

export function buildQuantPriceLocations(sources: readonly QuantPriceLocationSource[]): readonly QuantPriceLocation[] {
  return sources.map(buildQuantPriceLocation).sort((left, right) => {
    const rank = STATUS_RANK[left.status] - STATUS_RANK[right.status]
    if (rank !== 0)
      return rank
    const leftDistance = Math.abs(left.distancePercent ?? Number.POSITIVE_INFINITY)
    const rightDistance = Math.abs(right.distancePercent ?? Number.POSITIVE_INFINITY)
    if (leftDistance !== rightDistance)
      return leftDistance - rightDistance
    return left.tsCode.localeCompare(right.tsCode)
  })
}

export function readQuantPriceLocationDecision(reportJson: string): { readonly recommendation: QuantPriceLocationSource['recommendation'], readonly rangeLow: number | null, readonly rangeHigh: number | null } {
  try {
    const parsed = readObject(JSON.parse(reportJson))
    const decision = parsed ? readObject(parsed.decision) : null
    if (!decision)
      return { recommendation: null, rangeLow: null, rangeHigh: null }
    const recommendationValue = decision.recommendation
    const recommendation = recommendationValue === 'bullish' || recommendationValue === 'bearish' || recommendationValue === 'watch'
      ? recommendationValue
      : null
    const range = readObject(decision.buyPriceRange)
    return {
      recommendation,
      rangeLow: range && typeof range.low === 'number' ? finite(range.low) : null,
      rangeHigh: range && typeof range.high === 'number' ? finite(range.high) : null,
    }
  }
  catch {
    return { recommendation: null, rangeLow: null, rangeHigh: null }
  }
}
