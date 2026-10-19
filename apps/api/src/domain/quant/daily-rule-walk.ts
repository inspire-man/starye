import type { DailyBar } from './types'
import { buildQuantDailyAction } from './daily-action'
import { calculateMomentumFactors } from './factor'

const BUY_FEE = 0.00025
const SELL_FEE = 0.00075

export interface QuantDailyRuleWalk {
  readonly from: string
  readonly to: string
  readonly bars: number
  readonly trades: number
  readonly wins: number
  readonly losses: number
  readonly payoffRatio: number | null
  readonly strategyReturn: number
  readonly buyHoldReturn: number
  readonly maxDrawdown: number
}

export function walkQuantDailyPriceRule(bars: readonly DailyBar[]): QuantDailyRuleWalk | null {
  const ordered = [...bars].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
  if (ordered.length < 41)
    return null
  let cash = 1
  let shares = 0
  let entryCapital = 0
  const closed: number[] = []
  const equity: number[] = []
  for (let index = 20; index < ordered.length; index += 1) {
    const factors = calculateMomentumFactors(ordered.slice(0, index + 1))
    const close = ordered[index].close
    const ma20 = factors.ma20
    if (ma20 === null || ma20 <= 0 || close <= 0)
      continue
    const action = buildQuantDailyAction({
      recommendation: 'bullish',
      price: close,
      priceDate: ordered[index].tradeDate,
      today: ordered[index].tradeDate,
      rangeLow: ma20 * 0.98,
      rangeHigh: ma20 * 1.02,
      openQuantity: shares,
      trendExitLabels: [
        ...(close < ma20 ? ['20日均线'] : []),
        ...(factors.return20 !== null && factors.return20 < 0 ? ['20日收益'] : []),
      ],
      chaseRiskLabels: [
        ...(factors.volumeRatio !== null && factors.volumeRatio >= 2 ? ['量比'] : []),
        ...(factors.consecutiveUpDays !== null && factors.consecutiveUpDays >= 5 ? ['连涨'] : []),
      ],
    })
    if (action.action === 'buy' && shares === 0 && cash > 0) {
      entryCapital = cash
      shares = cash * (1 - BUY_FEE) / close
      cash = 0
    }
    else if (action.action === 'sell' && shares > 0 && entryCapital > 0) {
      const proceeds = shares * close * (1 - SELL_FEE)
      closed.push(proceeds / entryCapital - 1)
      cash = proceeds
      shares = 0
      entryCapital = 0
    }
    equity.push(cash + shares * close)
  }
  if (shares > 0 && entryCapital > 0) {
    const close = ordered.at(-1)!.close
    const proceeds = shares * close * (1 - SELL_FEE)
    closed.push(proceeds / entryCapital - 1)
    cash = proceeds
    equity.push(cash)
  }
  const start = ordered[20].close
  const end = ordered.at(-1)!.close
  const wins = closed.filter(item => item > 0)
  const losses = closed.filter(item => item < 0)
  const averageWin = wins.length ? wins.reduce((total, item) => total + item, 0) / wins.length : null
  const averageLoss = losses.length ? Math.abs(losses.reduce((total, item) => total + item, 0) / losses.length) : null
  let peak = 0
  let maxDrawdown = 0
  for (const value of equity) {
    peak = Math.max(peak, value)
    if (peak > 0)
      maxDrawdown = Math.min(maxDrawdown, value / peak - 1)
  }
  return {
    from: ordered[0].tradeDate,
    to: ordered.at(-1)!.tradeDate,
    bars: ordered.length,
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    payoffRatio: averageWin !== null && averageLoss ? Number((averageWin / averageLoss).toFixed(4)) : null,
    strategyReturn: Number((cash - 1).toFixed(4)),
    buyHoldReturn: Number((end * (1 - SELL_FEE) / (start * (1 + BUY_FEE)) - 1).toFixed(4)),
    maxDrawdown: Number(maxDrawdown.toFixed(4)),
  }
}
