import { QuantApiError, requestJson, unwrapData } from '../http-client'
import { isRecord, readNumber, readString } from '../payload'

export interface QuantOperationFill {
  id: string
  tsCode: string
  name: string | null
  side: 'buy' | 'sell' | 'dividend' | 'pass'
  price: number
  quantity: number
  fee: number
  tradedAt: string
  note: string | null
  researchContext: {
    recommendation: 'bullish' | 'bearish' | 'watch' | null
    buyLow: number | null
    buyHigh: number | null
    sellLow: number | null
    sellHigh: number | null
    generatedAt: string | null
  } | null
}

export interface QuantOperationCodeStat {
  tsCode: string
  name: string | null
  closedCount: number
  winCount: number
  lossCount: number
  realizedPnl: number
  winRate: number | null
  payoffRatio: number | null
  openQuantity: number
  dividendCash: number
}

export interface QuantOperationClosedSlice {
  tsCode: string
  name: string | null
  quantity: number
  buyPrice: number
  sellPrice: number
  pnl: number
  fee: number
  returnRate: number
  sameDay: boolean
  openedAt: string
  closedAt: string
}

export interface QuantOperationLedger {
  formulaVersion: string
  closedCount: number
  winCount: number
  lossCount: number
  flatCount: number
  realizedPnl: number
  dividendCash: number
  winRate: number | null
  payoffRatio: number | null
  unmatchedSellQuantity: number
  openLots: { tsCode: string, name: string | null, quantity: number, cost: number }[]
  closed: QuantOperationClosedSlice[]
  curve: { tradedAt: string, cumulativePnl: number }[]
  byCode: QuantOperationCodeStat[]
  aiBrief: string
}

export interface QuantOperationBoard {
  operations: QuantOperationFill[]
  ledger: QuantOperationLedger
}
function parseResearchContext(value: unknown): QuantOperationFill['researchContext'] {
  if (!isRecord(value))
    return null
  const recommendation = value.recommendation
  return {
    recommendation: recommendation === 'bullish' || recommendation === 'bearish' || recommendation === 'watch' ? recommendation : null,
    buyLow: readNumber(value, 'buyLow', 'buy_low'),
    buyHigh: readNumber(value, 'buyHigh', 'buy_high'),
    sellLow: readNumber(value, 'sellLow', 'sell_low'),
    sellHigh: readNumber(value, 'sellHigh', 'sell_high'),
    generatedAt: readString(value, 'generatedAt', 'generated_at'),
  }
}

function parseFill(value: unknown): QuantOperationFill {
  if (!isRecord(value))
    throw new QuantApiError('成交记录格式无效', 502, 'QUANT_OPERATION_INVALID')
  const side = readString(value, 'side')
  if (side !== 'buy' && side !== 'sell' && side !== 'dividend' && side !== 'pass')
    throw new QuantApiError('成交方向无效', 502, 'QUANT_OPERATION_INVALID')
  return {
    id: readString(value, 'id') ?? '',
    tsCode: readString(value, 'tsCode', 'ts_code') ?? '',
    name: readString(value, 'name'),
    side,
    price: readNumber(value, 'price') ?? 0,
    quantity: readNumber(value, 'quantity') ?? 0,
    fee: readNumber(value, 'fee') ?? 0,
    tradedAt: readString(value, 'tradedAt', 'traded_at') ?? '',
    note: readString(value, 'note'),
    researchContext: parseResearchContext(value.researchContext ?? value.research_context),
  }
}

function parseCodeStat(value: unknown): QuantOperationCodeStat | null {
  if (!isRecord(value))
    return null
  return {
    tsCode: readString(value, 'tsCode', 'ts_code') ?? '',
    name: readString(value, 'name'),
    closedCount: readNumber(value, 'closedCount', 'closed_count') ?? 0,
    winCount: readNumber(value, 'winCount', 'win_count') ?? 0,
    lossCount: readNumber(value, 'lossCount', 'loss_count') ?? 0,
    realizedPnl: readNumber(value, 'realizedPnl', 'realized_pnl') ?? 0,
    winRate: readNumber(value, 'winRate', 'win_rate'),
    payoffRatio: readNumber(value, 'payoffRatio', 'payoff_ratio'),
    openQuantity: readNumber(value, 'openQuantity', 'open_quantity') ?? 0,
    dividendCash: readNumber(value, 'dividendCash', 'dividend_cash') ?? 0,
  }
}

function parseClosed(value: unknown): QuantOperationClosedSlice | null {
  if (!isRecord(value))
    return null
  return {
    tsCode: readString(value, 'tsCode', 'ts_code') ?? '',
    name: readString(value, 'name'),
    quantity: readNumber(value, 'quantity') ?? 0,
    buyPrice: readNumber(value, 'buyPrice', 'buy_price') ?? 0,
    sellPrice: readNumber(value, 'sellPrice', 'sell_price') ?? 0,
    pnl: readNumber(value, 'pnl') ?? 0,
    fee: readNumber(value, 'fee') ?? 0,
    returnRate: readNumber(value, 'returnRate', 'return_rate') ?? 0,
    sameDay: value.sameDay === true || value.same_day === true,
    openedAt: readString(value, 'openedAt', 'opened_at') ?? '',
    closedAt: readString(value, 'closedAt', 'closed_at') ?? '',
  }
}

function parseLedger(value: unknown): QuantOperationLedger {
  if (!isRecord(value))
    throw new QuantApiError('操作统计格式无效', 502, 'QUANT_OPERATION_INVALID')
  const curve = Array.isArray(value.curve)
    ? value.curve.flatMap((point) => {
        if (!isRecord(point))
          return []
        return [{ tradedAt: readString(point, 'tradedAt', 'traded_at') ?? '', cumulativePnl: readNumber(point, 'cumulativePnl', 'cumulative_pnl') ?? 0 }]
      })
    : []
  const openLots = Array.isArray(value.openLots)
    ? value.openLots.flatMap((lot) => {
        if (!isRecord(lot))
          return []
        return [{
          tsCode: readString(lot, 'tsCode', 'ts_code') ?? '',
          name: readString(lot, 'name'),
          quantity: readNumber(lot, 'quantity') ?? 0,
          cost: readNumber(lot, 'cost') ?? 0,
        }]
      })
    : []
  return {
    formulaVersion: readString(value, 'formulaVersion', 'formula_version') ?? '',
    closedCount: readNumber(value, 'closedCount', 'closed_count') ?? 0,
    winCount: readNumber(value, 'winCount', 'win_count') ?? 0,
    lossCount: readNumber(value, 'lossCount', 'loss_count') ?? 0,
    flatCount: readNumber(value, 'flatCount', 'flat_count') ?? 0,
    realizedPnl: readNumber(value, 'realizedPnl', 'realized_pnl') ?? 0,
    dividendCash: readNumber(value, 'dividendCash', 'dividend_cash') ?? 0,
    winRate: readNumber(value, 'winRate', 'win_rate'),
    payoffRatio: readNumber(value, 'payoffRatio', 'payoff_ratio'),
    unmatchedSellQuantity: readNumber(value, 'unmatchedSellQuantity', 'unmatched_sell_quantity') ?? 0,
    openLots,
    closed: Array.isArray(value.closed)
      ? value.closed.flatMap((item) => {
          const parsed = parseClosed(item)
          return parsed ? [parsed] : []
        })
      : [],
    curve,
    byCode: Array.isArray(value.byCode)
      ? value.byCode.flatMap((item) => {
          const parsed = parseCodeStat(item)
          return parsed ? [parsed] : []
        })
      : [],
    aiBrief: readString(value, 'aiBrief', 'ai_brief') ?? '',
  }
}

export const quantOperationApi = {
  async getOperations(options?: { signal?: AbortSignal }): Promise<QuantOperationBoard> {
    const data = unwrapData(await requestJson('/operations', options?.signal ? { signal: options.signal } : undefined))
    if (!isRecord(data) || !Array.isArray(data.operations))
      throw new QuantApiError('操作记录格式无效', 502, 'QUANT_OPERATION_INVALID')
    return { operations: data.operations.map(parseFill), ledger: parseLedger(data.ledger) }
  },

  async createOperation(input: { tsCode: string, name: string | null, side: 'buy' | 'sell' | 'dividend' | 'pass', price: number, quantity: number, fee: number, tradedAt: string, note: string | null }): Promise<QuantOperationFill> {
    return parseFill(unwrapData(await requestJson('/operations', {
      method: 'POST',
      body: JSON.stringify({
        ts_code: input.tsCode,
        name: input.name,
        side: input.side,
        price: input.price,
        quantity: input.quantity,
        fee: input.fee,
        traded_at: input.tradedAt,
        note: input.note,
      }),
    })))
  },

  async deleteOperation(id: string): Promise<void> {
    await requestJson(`/operations/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}
