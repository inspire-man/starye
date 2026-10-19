export const QUANT_DAILY_ACTION_VERSION = 'daily-action-v4' as const
export const QUANT_DAILY_ACTIONS = ['buy', 'sell', 'hold', 'blocked'] as const
export type QuantDailyAction = typeof QUANT_DAILY_ACTIONS[number]
export type QuantDailyBlocker = 'report' | 'price' | 'range' | null
export type QuantDailyPriceFreshness = 'session' | 'prior-close' | 'missing'

export interface QuantDailyActionInput {
  readonly recommendation: 'bullish' | 'bearish' | 'watch' | null
  readonly price: number | null
  readonly priceDate: string | null
  readonly today: string
  readonly rangeLow: number | null
  readonly rangeHigh: number | null
  readonly openQuantity: number
  readonly trendExitLabels: readonly string[]
  readonly chaseRiskLabels: readonly string[]
}

export interface QuantDailyDecision {
  readonly action: QuantDailyAction
  readonly label: '买' | '卖' | '不动' | '先补数据'
  readonly reason: string
  readonly blocker: QuantDailyBlocker
  readonly priceFreshness: QuantDailyPriceFreshness
}

const LABELS = {
  buy: '买',
  sell: '卖',
  hold: '不动',
  blocked: '先补数据',
} as const

function finite(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function decision(action: QuantDailyAction, reason: string, blocker: QuantDailyBlocker = null, priceFreshness: QuantDailyPriceFreshness = 'missing'): QuantDailyDecision {
  return { action, label: LABELS[action], reason, blocker, priceFreshness }
}

export function quantMarketDate(value: Date | string): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value))
    return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime()))
    return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function buildQuantDailyAction(input: QuantDailyActionInput): QuantDailyDecision {
  const price = finite(input.price)
  const low = finite(input.rangeLow)
  const high = finite(input.rangeHigh)
  const holding = input.openQuantity > 0
  if (!input.recommendation)
    return decision('blocked', '缺报告', 'report')
  if (price === null || price <= 0)
    return decision('blocked', '缺价格', 'price', 'missing')
  const freshness: QuantDailyPriceFreshness = input.priceDate === input.today ? 'session' : 'prior-close'
  const priced = (action: QuantDailyAction, reason: string, blocker: QuantDailyBlocker = null) => decision(action, reason, blocker, freshness)
  if (input.recommendation === 'bullish' && (low === null || high === null || low <= 0 || high < low))
    return priced('blocked', '缺区间', 'range')

  const inRange = low !== null && high !== null && price >= low && price <= high
  const trendBroken = input.trendExitLabels.length > 0
  const chasing = input.chaseRiskLabels.length > 0
  if (holding && input.recommendation === 'bearish')
    return priced('sell', '看空')
  if (holding && trendBroken)
    return priced('hold', '持有')
  if (!holding && input.recommendation === 'bullish' && inRange && !trendBroken && !chasing)
    return priced('buy', '区间内')
  if (!holding && input.recommendation === 'bullish' && inRange && trendBroken)
    return priced('hold', `趋势转弱：${input.trendExitLabels.join('、')}`)
  if (!holding && input.recommendation === 'bullish' && inRange && chasing)
    return priced('hold', input.chaseRiskLabels.join('、'))
  if (holding && chasing)
    return priced('hold', input.chaseRiskLabels.join('、'))
  if (!holding && input.recommendation === 'bullish' && low !== null && high !== null) {
    const place = price < low ? '低于区间' : '高于区间'
    return priced('hold', place)
  }
  if (holding)
    return priced('hold', '持有')
  return priced('hold', '非看多')
}

export function compareQuantDailyActions(left: QuantDailyAction, right: QuantDailyAction): number {
  const rank: Record<QuantDailyAction, number> = { sell: 0, buy: 1, blocked: 2, hold: 3 }
  return rank[left] - rank[right]
}

export interface QuantDailyScoreInput {
  readonly closed: readonly { readonly pnl: number, readonly sameDay: boolean }[]
  readonly closedCount: number
  readonly winCount: number
  readonly lossCount: number
  readonly flatCount: number
  readonly winRate: number | null
  readonly payoffRatio: number | null
  readonly realizedPnl: number
  readonly dividendCash: number
  readonly passCount: number
}

export interface QuantDailyScore {
  readonly closedCount: number
  readonly winCount: number
  readonly lossCount: number
  readonly flatCount: number
  readonly winRate: number | null
  readonly payoffRatio: number | null
  readonly realizedPnl: number
  readonly dividendCash: number
  readonly passCount: number
  readonly minimumSample: number
  readonly swingClosedCount: number
  readonly swingRealizedPnl: number
  readonly swingPayoffRatio: number | null
  readonly sameDayClosedCount: number
  readonly sameDayRealizedPnl: number
}

export function buildQuantDailyScore(input: QuantDailyScoreInput): QuantDailyScore {
  const swing = input.closed.filter(item => !item.sameDay)
  const sameDay = input.closed.filter(item => item.sameDay)
  const swingWins = swing.filter(item => item.pnl > 0)
  const swingLosses = swing.filter(item => item.pnl < 0)
  const swingAverageWin = swingWins.length ? swingWins.reduce((total, item) => total + item.pnl, 0) / swingWins.length : null
  const swingAverageLoss = swingLosses.length ? Math.abs(swingLosses.reduce((total, item) => total + item.pnl, 0) / swingLosses.length) : null
  return {
    closedCount: input.closedCount,
    winCount: input.winCount,
    lossCount: input.lossCount,
    flatCount: input.flatCount,
    winRate: input.winRate,
    payoffRatio: input.payoffRatio,
    realizedPnl: input.realizedPnl,
    dividendCash: input.dividendCash,
    passCount: input.passCount,
    minimumSample: 6,
    swingClosedCount: swing.length,
    swingRealizedPnl: Number(swing.reduce((total, item) => total + item.pnl, 0).toFixed(4)),
    swingPayoffRatio: swingAverageWin !== null && swingAverageLoss ? Number((swingAverageWin / swingAverageLoss).toFixed(4)) : null,
    sameDayClosedCount: sameDay.length,
    sameDayRealizedPnl: Number(sameDay.reduce((total, item) => total + item.pnl, 0).toFixed(4)),
  }
}
