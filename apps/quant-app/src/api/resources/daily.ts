import { QuantApiError, requestJson, unwrapData } from '../http-client'
import { isRecord, readNumber, readString } from '../payload'

export interface QuantDailyItem {
  tsCode: string
  name: string | null
  action: 'buy' | 'sell' | 'hold' | 'blocked'
  label: '买' | '卖' | '不动' | '先补数据'
  reason: string
  blocker: 'report' | 'price' | 'range' | null
  priceFreshness: 'session' | 'prior-close' | 'missing'
  price: number | null
  priceDate: string | null
  priceSource: 'eastmoney-realtime' | 'local-daily-bars' | null
  recommendation: 'bullish' | 'bearish' | 'watch' | null
  rangeLow: number | null
  rangeHigh: number | null
  openQuantity: number
  cost: number | null
}

export interface QuantDailyBoard {
  formulaVersion: string
  today: string
  items: QuantDailyItem[]
  score: {
    closedCount: number
    winCount: number
    lossCount: number
    flatCount: number
    winRate: number | null
    payoffRatio: number | null
    realizedPnl: number
    dividendCash: number
    passCount: number
    minimumSample: number
    swingClosedCount: number
    swingRealizedPnl: number
    swingPayoffRatio: number | null
    sameDayClosedCount: number
    sameDayRealizedPnl: number
  }
}

function parseItem(value: unknown): QuantDailyItem {
  if (!isRecord(value))
    throw new QuantApiError('每日结论格式无效', 502, 'QUANT_DAILY_INVALID')
  const action = readString(value, 'action')
  const label = readString(value, 'label')
  const blocker = readString(value, 'blocker')
  if (action !== 'buy' && action !== 'sell' && action !== 'hold' && action !== 'blocked')
    throw new QuantApiError('每日结论动作无效', 502, 'QUANT_DAILY_INVALID')
  if (label !== '买' && label !== '卖' && label !== '不动' && label !== '先补数据')
    throw new QuantApiError('每日结论文案无效', 502, 'QUANT_DAILY_INVALID')
  return {
    tsCode: readString(value, 'tsCode', 'ts_code') ?? '',
    name: readString(value, 'name'),
    action,
    label,
    reason: readString(value, 'reason') ?? '',
    blocker: blocker === 'report' || blocker === 'price' || blocker === 'range' ? blocker : null,
    priceFreshness: value.priceFreshness === 'session' || value.priceFreshness === 'prior-close' || value.priceFreshness === 'missing' ? value.priceFreshness : 'missing',
    price: readNumber(value, 'price'),
    priceDate: readString(value, 'priceDate', 'price_date'),
    priceSource: value.priceSource === 'eastmoney-realtime' || value.priceSource === 'local-daily-bars' ? value.priceSource : null,
    recommendation: value.recommendation === 'bullish' || value.recommendation === 'bearish' || value.recommendation === 'watch' ? value.recommendation : null,
    rangeLow: readNumber(value, 'rangeLow', 'range_low'),
    rangeHigh: readNumber(value, 'rangeHigh', 'range_high'),
    openQuantity: readNumber(value, 'openQuantity', 'open_quantity') ?? 0,
    cost: readNumber(value, 'cost'),
  }
}

export const quantDailyApi = {
  async getDailyBoard(options?: { signal?: AbortSignal }): Promise<QuantDailyBoard> {
    const data = unwrapData(await requestJson(`/daily?refresh=${Date.now()}`, { cache: 'no-store', signal: options?.signal }))
    if (!isRecord(data) || !Array.isArray(data.items) || !isRecord(data.score))
      throw new QuantApiError('每日结论格式无效', 502, 'QUANT_DAILY_INVALID')
    return {
      formulaVersion: readString(data, 'formulaVersion', 'formula_version') ?? '',
      today: readString(data, 'today') ?? '',
      items: data.items.map(parseItem),
      score: {
        closedCount: readNumber(data.score, 'closedCount', 'closed_count') ?? 0,
        winCount: readNumber(data.score, 'winCount', 'win_count') ?? 0,
        lossCount: readNumber(data.score, 'lossCount', 'loss_count') ?? 0,
        flatCount: readNumber(data.score, 'flatCount', 'flat_count') ?? 0,
        winRate: readNumber(data.score, 'winRate', 'win_rate'),
        payoffRatio: readNumber(data.score, 'payoffRatio', 'payoff_ratio'),
        realizedPnl: readNumber(data.score, 'realizedPnl', 'realized_pnl') ?? 0,
        dividendCash: readNumber(data.score, 'dividendCash', 'dividend_cash') ?? 0,
        passCount: readNumber(data.score, 'passCount', 'pass_count') ?? 0,
        minimumSample: readNumber(data.score, 'minimumSample', 'minimum_sample') ?? 6,
        swingClosedCount: readNumber(data.score, 'swingClosedCount', 'swing_closed_count') ?? 0,
        swingRealizedPnl: readNumber(data.score, 'swingRealizedPnl', 'swing_realized_pnl') ?? 0,
        swingPayoffRatio: readNumber(data.score, 'swingPayoffRatio', 'swing_payoff_ratio'),
        sameDayClosedCount: readNumber(data.score, 'sameDayClosedCount', 'same_day_closed_count') ?? 0,
        sameDayRealizedPnl: readNumber(data.score, 'sameDayRealizedPnl', 'same_day_realized_pnl') ?? 0,
      },
    }
  },
}
