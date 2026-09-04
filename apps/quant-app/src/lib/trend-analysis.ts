import type { DailyBar } from './quant-view-models'

export type TrendStructureTone = 'positive' | 'warning' | 'danger' | 'neutral'

export interface TrendStructure {
  return5: number | null
  return20: number | null
  return60: number | null
  ma20Gap: number | null
  drawdown60: number | null
  availableBars: number
  tone: TrendStructureTone
  conclusion: string
}

function finiteCloses(bars: readonly DailyBar[]): number[] {
  return bars
    .map(bar => bar.close)
    .filter((close): close is number => close !== null && Number.isFinite(close))
}

function windowReturn(closes: readonly number[], intervals: number): number | null {
  if (closes.length < intervals + 1)
    return null
  const start = closes[closes.length - intervals - 1]
  const end = closes.at(-1)
  if (start === undefined || end === undefined || start <= 0)
    return null
  return (end / start) - 1
}

function average(values: readonly number[]): number | null {
  if (!values.length)
    return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildConclusion(result: Pick<TrendStructure, 'return5' | 'return20' | 'return60' | 'ma20Gap' | 'drawdown60'>): { tone: TrendStructureTone, conclusion: string } {
  const { return5, return20, return60, ma20Gap, drawdown60 } = result
  if (return5 === null && return20 === null && return60 === null && ma20Gap === null && drawdown60 === null)
    return { tone: 'neutral', conclusion: '暂无足够日线数据' }
  if (drawdown60 !== null && drawdown60 <= -0.1)
    return { tone: 'warning', conclusion: '处于 60 日回撤，先观察修复力度' }
  if (return20 !== null && ma20Gap !== null && return20 >= 0 && ma20Gap >= 0 && (return60 === null || return60 >= 0))
    return { tone: 'positive', conclusion: '多周期偏强，价格站在 20 日均线之上' }
  if (return20 !== null && ma20Gap !== null && return20 < 0 && ma20Gap < 0)
    return { tone: 'danger', conclusion: '中期偏弱，等待重新站回均线' }
  if (return5 !== null && return5 >= 0 && return20 !== null && return20 >= 0)
    return { tone: 'positive', conclusion: '短中期偏强，继续观察趋势延续' }
  return { tone: 'neutral', conclusion: '周期表现分化，结合估值与基本面核对' }
}

export function buildTrendStructure(bars: readonly DailyBar[]): TrendStructure {
  const closes = finiteCloses(bars)
  const latest = closes.at(-1) ?? null
  const ma20 = closes.length >= 20 ? average(closes.slice(-20)) : null
  const high60 = closes.length >= 60 ? Math.max(...closes.slice(-60)) : null
  const result = {
    return5: windowReturn(closes, 5),
    return20: windowReturn(closes, 20),
    return60: windowReturn(closes, 60),
    ma20Gap: latest !== null && ma20 !== null && ma20 > 0 ? (latest / ma20) - 1 : null,
    drawdown60: latest !== null && high60 !== null && high60 > 0 ? (latest / high60) - 1 : null,
    availableBars: closes.length,
  }
  return { ...result, ...buildConclusion(result) }
}
