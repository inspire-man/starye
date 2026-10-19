import type { AppEnv } from '../../../types'
import { Hono } from 'hono'
import { buildQuantDailyAction, buildQuantDailyScore, compareQuantDailyActions, QUANT_DAILY_ACTION_VERSION, quantMarketDate } from '../../../domain/quant/daily-action'
import { buildQuantInvalidationItem, readQuantReportEvidence } from '../../../domain/quant/invalidation-check'
import { readQuantOperationBoard } from '../../../domain/quant/operation-store'
import { readQuantPriceLocationDecision } from '../../../domain/quant/price-location'
import { listLatestQuantResearchRuns, listQuantDailyFactorBars, listQuantWatchlist } from '../../../domain/quant/repository'
import { quantRouteDocs } from '../contract-docs'
import { currentQuantUserId } from '../route-context'
import { resolveDecisionAssistantMarket } from './market-support'

export const quantDailyRoutes = new Hono<AppEnv>()

quantDailyRoutes.get('/daily', quantRouteDocs('workspace.daily.get'), async (c) => {
  const userId = currentQuantUserId(c)
  const db = c.get('db')
  const today = quantMarketDate(new Date())
  if (!today)
    throw new Error('Shanghai market date is unavailable')
  const watchlist = await listQuantWatchlist(db, userId)
  const codes = watchlist.map(item => item.tsCode)
  const [runs, bars, board] = await Promise.all([
    listLatestQuantResearchRuns(db, userId, codes),
    listQuantDailyFactorBars(db, codes),
    readQuantOperationBoard(db, userId),
  ])
  const runsByCode = new Map(runs.map(run => [run.tsCode, run]))
  const barsByCode = new Map<string, {
    tsCode: string
    tradeDate: string
    open: number
    high: number
    low: number
    close: number
    preClose: null
    change: null
    pctChg: null
    volume: number
    amount: null
  }[]>()
  for (const row of bars) {
    const current = barsByCode.get(row.tsCode) ?? []
    current.push({
      tsCode: row.tsCode,
      tradeDate: row.tradeDate,
      open: row.close,
      high: row.close,
      low: row.close,
      close: row.close,
      preClose: null,
      change: null,
      pctChg: null,
      volume: row.volume,
      amount: null,
    })
    barsByCode.set(row.tsCode, current)
  }
  const items = await Promise.all(watchlist.map(async (item) => {
    const run = runsByCode.get(item.tsCode)
    const decision = run
      ? readQuantPriceLocationDecision(run.reportJson)
      : { recommendation: null, rangeLow: null, rangeHigh: null }
    let price: number | null = null
    let priceDate: string | null = null
    let priceSource: 'eastmoney-realtime' | 'local-daily-bars' | null = null
    try {
      const market = await resolveDecisionAssistantMarket(c.env, db, item.tsCode)
      price = market.market.currentPrice
      priceSource = market.market.currentPriceSource
      priceDate = market.market.currentPriceStatus === 'realtime'
        ? quantMarketDate(market.market.currentPriceObservedAt)
        : market.latestDailyBar?.tradeDate ?? null
    }
    catch {
      price = null
    }
    const invalidation = run
      ? buildQuantInvalidationItem({
          tsCode: item.tsCode,
          name: item.name,
          evidence: readQuantReportEvidence(run.reportJson),
          bars: barsByCode.get(item.tsCode) ?? [],
        })
      : null
    const triggered = invalidation?.checks.filter(check => check.change === 'triggered') ?? []
    const lot = board.ledger.openLots.find(openLot => openLot.tsCode === item.tsCode)
    const action = buildQuantDailyAction({
      recommendation: decision.recommendation,
      price,
      priceDate,
      today,
      rangeLow: decision.rangeLow,
      rangeHigh: decision.rangeHigh,
      openQuantity: lot?.quantity ?? 0,
      trendExitLabels: triggered.filter(check => check.key === 'trend-ma20' || check.key === 'trend-return20').map(check => check.label),
      chaseRiskLabels: triggered.filter(check => check.key === 'risk-volume' || check.key === 'risk-streak').map(check => check.label),
    })
    return {
      tsCode: item.tsCode,
      name: item.name,
      ...action,
      price,
      priceDate,
      priceSource,
      recommendation: decision.recommendation,
      rangeLow: decision.rangeLow,
      rangeHigh: decision.rangeHigh,
      openQuantity: lot?.quantity ?? 0,
      cost: lot?.cost ?? null,
    }
  }))
  items.sort((left, right) => compareQuantDailyActions(left.action, right.action) || (left.name || left.tsCode).localeCompare(right.name || right.tsCode, 'zh'))
  return c.json({
    success: true as const,
    data: {
      formulaVersion: QUANT_DAILY_ACTION_VERSION,
      today,
      items,
      score: buildQuantDailyScore({
        closed: board.ledger.closed,
        closedCount: board.ledger.closedCount,
        winCount: board.ledger.winCount,
        lossCount: board.ledger.lossCount,
        flatCount: board.ledger.flatCount,
        winRate: board.ledger.winRate,
        payoffRatio: board.ledger.payoffRatio,
        realizedPnl: board.ledger.realizedPnl,
        dividendCash: board.ledger.dividendCash,
        passCount: board.operations.filter(operation => operation.side === 'pass').length,
      }),
    },
  })
})
