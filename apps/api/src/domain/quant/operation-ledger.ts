export const QUANT_OPERATION_LEDGER_VERSION = 'operation-ledger-v2'
const MIN_WIN_RATE_SAMPLE = 6

export interface QuantOperationFill {
  readonly id: string
  readonly tsCode: string
  readonly name: string | null
  readonly side: 'buy' | 'sell' | 'dividend' | 'pass'
  readonly price: number
  readonly quantity: number
  readonly fee: number
  readonly tradedAt: string
  readonly note: string | null
  readonly researchContext: QuantOperationResearchContext | null
}

export interface QuantOperationResearchContext {
  readonly recommendation: 'bullish' | 'bearish' | 'watch' | null
  readonly buyLow: number | null
  readonly buyHigh: number | null
  readonly sellLow: number | null
  readonly sellHigh: number | null
  readonly generatedAt: string | null
}

export function researchContextFromReport(reportJson: string, generatedAt: string | null): QuantOperationResearchContext | null {
  try {
    const report = JSON.parse(reportJson) as {
      decision?: {
        recommendation?: unknown
        buyPriceRange?: { low?: unknown, high?: unknown } | null
        sellPriceRange?: { low?: unknown, high?: unknown } | null
      } | null
      generatedAt?: unknown
    }
    const decision = report.decision
    if (!decision)
      return null
    const recommendation = decision.recommendation === 'bullish' || decision.recommendation === 'bearish' || decision.recommendation === 'watch' ? decision.recommendation : null
    const numberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
    return {
      recommendation,
      buyLow: numberOrNull(decision.buyPriceRange?.low),
      buyHigh: numberOrNull(decision.buyPriceRange?.high),
      sellLow: numberOrNull(decision.sellPriceRange?.low),
      sellHigh: numberOrNull(decision.sellPriceRange?.high),
      generatedAt: typeof report.generatedAt === 'string' ? report.generatedAt : generatedAt,
    }
  }
  catch {
    return null
  }
}

export interface QuantOperationClosedSlice {
  readonly tsCode: string
  readonly name: string | null
  readonly quantity: number
  readonly buyPrice: number
  readonly sellPrice: number
  readonly pnl: number
  readonly fee: number
  readonly returnRate: number
  readonly sameDay: boolean
  readonly openedAt: string
  readonly closedAt: string
}

export interface QuantOperationOpenLot {
  readonly tsCode: string
  readonly name: string | null
  readonly quantity: number
  readonly cost: number
}

export interface QuantOperationCurvePoint {
  readonly tradedAt: string
  readonly cumulativePnl: number
}

export interface QuantOperationCodeStat {
  readonly tsCode: string
  readonly name: string | null
  readonly closedCount: number
  readonly winCount: number
  readonly lossCount: number
  readonly flatCount: number
  readonly realizedPnl: number
  readonly winRate: number | null
  readonly payoffRatio: number | null
  readonly openQuantity: number
  readonly dividendCash: number
}

export interface QuantOperationAiContext {
  readonly formulaVersion: typeof QUANT_OPERATION_LEDGER_VERSION
  readonly tsCode: string
  readonly closedCount: number
  readonly winCount: number
  readonly lossCount: number
  readonly flatCount: number
  readonly realizedPnl: number
  readonly winRate: number | null
  readonly payoffRatio: number | null
  readonly openQuantity: number
  readonly dividendCash: number
  readonly note: string
}

export function operationAiContext(ledger: QuantOperationLedger, tsCode: string): QuantOperationAiContext | null {
  const row = ledger.byCode.find(item => item.tsCode === tsCode)
  if (!row || (row.closedCount === 0 && row.openQuantity === 0))
    return null
  return {
    formulaVersion: ledger.formulaVersion,
    tsCode: row.tsCode,
    closedCount: row.closedCount,
    winCount: row.winCount,
    lossCount: row.lossCount,
    flatCount: row.flatCount,
    realizedPnl: row.realizedPnl,
    winRate: row.winRate,
    payoffRatio: row.payoffRatio,
    openQuantity: row.openQuantity,
    dividendCash: row.dividendCash,
    note: '用户自己记下的成交价差和分红，不是研究报告证据，不得据此改分数、权重或参考区间。',
  }
}

export interface QuantOperationLedger {
  readonly formulaVersion: typeof QUANT_OPERATION_LEDGER_VERSION
  readonly closed: readonly QuantOperationClosedSlice[]
  readonly openLots: readonly QuantOperationOpenLot[]
  readonly unmatchedSellQuantity: number
  readonly closedCount: number
  readonly winCount: number
  readonly lossCount: number
  readonly flatCount: number
  readonly realizedPnl: number
  readonly dividendCash: number
  readonly winRate: number | null
  readonly payoffRatio: number | null
  readonly curve: readonly QuantOperationCurvePoint[]
  readonly byCode: readonly QuantOperationCodeStat[]
  readonly aiBrief: string
}

interface Lot {
  price: number
  quantity: number
  fee: number
  tradedAt: string
  name: string | null
}

function round(value: number): number {
  return Number(value.toFixed(4))
}

function time(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dayKey(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed))
    return value.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed)
}

function sideRank(side: QuantOperationFill['side']): number {
  return side === 'buy' ? 0 : side === 'dividend' ? 1 : 2
}
export function buildQuantOperationLedger(fills: readonly QuantOperationFill[]): QuantOperationLedger {
  const ordered = [...fills].sort((left, right) => time(left.tradedAt) - time(right.tradedAt) || sideRank(left.side) - sideRank(right.side) || left.id.localeCompare(right.id))
  const lots = new Map<string, Lot[]>()
  const closed: QuantOperationClosedSlice[] = []
  const dividends: QuantOperationFill[] = []
  let unmatchedSellQuantity = 0
  for (const fill of ordered) {
    if (fill.side === 'pass')
      continue
    if (fill.side === 'dividend') {
      dividends.push(fill)
      continue
    }
    const queue = lots.get(fill.tsCode) ?? []
    lots.set(fill.tsCode, queue)
    if (fill.side === 'buy') {
      queue.push({ price: fill.price, quantity: fill.quantity, fee: fill.fee, tradedAt: fill.tradedAt, name: fill.name })
      continue
    }
    let remaining = fill.quantity
    const sellDay = dayKey(fill.tradedAt)
    while (remaining > 0 && queue.some(lot => lot.quantity > 0)) {
      const sameDayIndex = queue.findIndex(lot => lot.quantity > 0 && dayKey(lot.tradedAt) === sellDay)
      const index = sameDayIndex >= 0 ? sameDayIndex : queue.findIndex(lot => lot.quantity > 0)
      const lot = queue[index]
      if (!lot)
        break
      const quantity = Math.min(remaining, lot.quantity)
      const buyFee = quantity === lot.quantity ? lot.fee : lot.fee * quantity / lot.quantity
      const sellFee = fill.quantity > 0 ? fill.fee * quantity / fill.quantity : 0
      const pnl = (fill.price - lot.price) * quantity - buyFee - sellFee
      closed.push({
        tsCode: fill.tsCode,
        name: fill.name ?? lot.name,
        quantity: round(quantity),
        buyPrice: lot.price,
        sellPrice: fill.price,
        pnl: round(pnl),
        fee: round(buyFee + sellFee),
        returnRate: lot.price > 0 ? round(fill.price / lot.price - 1) : 0,
        sameDay: dayKey(lot.tradedAt) === sellDay,
        openedAt: lot.tradedAt,
        closedAt: fill.tradedAt,
      })
      lot.fee = round(lot.fee - buyFee)
      lot.quantity = round(lot.quantity - quantity)
      remaining = round(remaining - quantity)
      if (lot.quantity <= 0)
        queue.splice(index, 1)
    }
    if (remaining > 0)
      unmatchedSellQuantity = round(unmatchedSellQuantity + remaining)
  }
  const openLots = [...lots.entries()].flatMap(([tsCode, queue]) => {
    const quantity = queue.reduce((total, lot) => total + lot.quantity, 0)
    if (quantity <= 0)
      return []
    const cost = queue.reduce((total, lot) => total + lot.price * lot.quantity + lot.fee, 0) / quantity
    return [{ tsCode, name: queue.find(lot => lot.name)?.name ?? null, quantity: round(quantity), cost: round(cost) }]
  })
  const dividendCash = round(dividends.reduce((total, fill) => total + fill.price, 0))
  const winCount = closed.filter(item => item.pnl > 0).length
  const lossCount = closed.filter(item => item.pnl < 0).length
  const flatCount = closed.filter(item => item.pnl === 0).length
  const wins = closed.filter(item => item.pnl > 0)
  const losses = closed.filter(item => item.pnl < 0)
  const averageWin = wins.length ? wins.reduce((total, item) => total + item.pnl, 0) / wins.length : null
  const averageLoss = losses.length ? Math.abs(losses.reduce((total, item) => total + item.pnl, 0) / losses.length) : null
  const directional = winCount + lossCount
  const winRate = directional >= MIN_WIN_RATE_SAMPLE ? round(winCount / directional * 100) : null
  let cumulative = 0
  const curve = closed.map((item) => {
    cumulative = round(cumulative + item.pnl)
    return { tradedAt: item.closedAt, cumulativePnl: cumulative }
  })
  const realizedPnl = round(closed.reduce((total, item) => total + item.pnl, 0))
  const payoffRatio = averageWin !== null && averageLoss ? round(averageWin / averageLoss) : null
  const winRateText = winRate === null ? `方向样本 ${directional} 笔，不足 ${MIN_WIN_RATE_SAMPLE} 笔，不计算胜率` : `胜率 ${winRate}%（${winCount} / ${directional}）`
  const payoffText = payoffRatio === null ? '盈亏比缺少盈利或亏损样本' : `盈亏比 ${payoffRatio}`
  const codes = new Set([...closed.map(item => item.tsCode), ...openLots.map(item => item.tsCode), ...dividends.map(item => item.tsCode)])
  const byCode = [...codes].map((tsCode) => {
    const slices = closed.filter(item => item.tsCode === tsCode)
    const winsForCode = slices.filter(item => item.pnl > 0)
    const lossesForCode = slices.filter(item => item.pnl < 0)
    const codeWins = winsForCode.length
    const codeLosses = lossesForCode.length
    const codeDirectional = codeWins + codeLosses
    const averageCodeWin = winsForCode.length ? winsForCode.reduce((total, item) => total + item.pnl, 0) / winsForCode.length : null
    const averageCodeLoss = lossesForCode.length ? Math.abs(lossesForCode.reduce((total, item) => total + item.pnl, 0) / lossesForCode.length) : null
    return {
      tsCode,
      name: slices.find(item => item.name)?.name ?? openLots.find(item => item.tsCode === tsCode)?.name ?? dividends.find(item => item.tsCode === tsCode)?.name ?? null,
      closedCount: slices.length,
      winCount: codeWins,
      lossCount: codeLosses,
      flatCount: slices.filter(item => item.pnl === 0).length,
      realizedPnl: round(slices.reduce((total, item) => total + item.pnl, 0)),
      winRate: codeDirectional >= MIN_WIN_RATE_SAMPLE ? round(codeWins / codeDirectional * 100) : null,
      payoffRatio: averageCodeWin !== null && averageCodeLoss ? round(averageCodeWin / averageCodeLoss) : null,
      openQuantity: openLots.find(item => item.tsCode === tsCode)?.quantity ?? 0,
      dividendCash: round(dividends.filter(item => item.tsCode === tsCode).reduce((total, item) => total + item.price, 0)),
    }
  }).sort((left, right) => right.realizedPnl - left.realizedPnl || left.tsCode.localeCompare(right.tsCode))
  const codeBrief = byCode.slice(0, 8).map(item => `${item.name || item.tsCode} 费用后价差 ${item.realizedPnl}，${item.winCount} 胜 ${item.lossCount} 负，未平 ${item.openQuantity}，分红 ${item.dividendCash}`).join('；')
  return {
    formulaVersion: QUANT_OPERATION_LEDGER_VERSION,
    closed,
    openLots,
    unmatchedSellQuantity,
    closedCount: closed.length,
    winCount,
    lossCount,
    flatCount,
    realizedPnl,
    dividendCash,
    winRate,
    payoffRatio,
    curve,
    byCode,
    aiBrief: `${QUANT_OPERATION_LEDGER_VERSION}。已平仓 ${closed.length} 笔，${winRateText}，${payoffText}，费用后价差 ${realizedPnl}，分红现金 ${dividendCash}。同一天的买入先和当天卖出配对。持平 ${flatCount} 笔不计入胜率。未平仓 ${openLots.length} 组，未匹配卖出数量 ${unmatchedSellQuantity}。${codeBrief ? `分标的：${codeBrief}。` : ''}分红不计入胜率。`,
  }
}
