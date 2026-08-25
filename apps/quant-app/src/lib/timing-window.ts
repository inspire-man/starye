import type { DailyBar } from './quant-types'
import type { TrendStructure } from './trend-analysis'

export type TimingWindowState = 'constructive' | 'pullback_watch' | 'extended' | 'weak' | 'insufficient'
export type TimingWindowTone = 'positive' | 'warning' | 'danger' | 'neutral'
export type TimingWindowMetricStatus = 'pass' | 'caution' | 'fail' | 'missing'

export interface TimingWindowMetric {
  readonly key: 'ma20-gap' | 'ma60-gap' | 'pullback20' | 'volatility20'
  readonly label: string
  readonly value: number | null
  readonly status: TimingWindowMetricStatus
  readonly threshold: string
  readonly detail: string
}

export interface TimingWindow {
  readonly state: TimingWindowState
  readonly tone: TimingWindowTone
  readonly label: string
  readonly headline: string
  readonly availableBars: number
  readonly ma20Gap: number | null
  readonly ma60Gap: number | null
  readonly pullback20: number | null
  readonly volatility20: number | null
  readonly metrics: readonly TimingWindowMetric[]
}

function finiteCloses(bars: readonly DailyBar[]): number[] {
  return [...bars]
    .sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))
    .map(bar => bar.close)
    .filter((close): close is number => close !== null && Number.isFinite(close) && close > 0)
}

function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function standardDeviation(values: readonly number[]): number | null {
  const mean = average(values)
  if (mean === null)
    return null
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
}

function recentReturns(closes: readonly number[]): number[] {
  const window = closes.slice(-21)
  if (window.length < 21)
    return []
  const returns: number[] = []
  for (let index = 1; index < window.length; index++) {
    const previous = window[index - 1]
    const current = window[index]
    if (previous === undefined || current === undefined || previous <= 0)
      return []
    returns.push(current / previous - 1)
  }
  return returns
}

function metricStatus(value: number | null, threshold: (value: number) => TimingWindowMetricStatus): TimingWindowMetricStatus {
  return value === null ? 'missing' : threshold(value)
}

function buildMetrics(
  ma20Gap: number | null,
  ma60Gap: number | null,
  pullback20: number | null,
  volatility20: number | null,
): TimingWindowMetric[] {
  return [
    {
      key: 'ma20-gap',
      label: '距 MA20',
      value: ma20Gap,
      status: metricStatus(ma20Gap, value => value <= -0.03 ? 'fail' : value >= 0 ? 'pass' : 'caution'),
      threshold: '弱势 ≤ -3%；站上均线 ≥ 0%',
      detail: ma20Gap === null ? '缺少 20 根有效收盘价' : ma20Gap <= -0.03 ? '价格明显低于短中期均线' : ma20Gap >= 0 ? '价格位于 MA20 之上或附近' : '价格略低于 MA20，继续观察修复',
    },
    {
      key: 'ma60-gap',
      label: '距 MA60',
      value: ma60Gap,
      status: metricStatus(ma60Gap, value => value <= -0.05 ? 'fail' : value >= 0 ? 'pass' : 'caution'),
      threshold: '弱势 ≤ -5%；中期支撑 ≥ 0%',
      detail: ma60Gap === null ? '缺少 60 根有效收盘价' : ma60Gap <= -0.05 ? '价格低于中期均线较多' : ma60Gap >= 0 ? '价格仍在中期均线之上' : '价格略低于 MA60，需结合基本面',
    },
    {
      key: 'pullback20',
      label: '距 20 日高点',
      value: pullback20,
      status: metricStatus(pullback20, value => value <= -0.03 ? 'caution' : 'pass'),
      threshold: '回撤观察线 ≤ -3%',
      detail: pullback20 === null ? '缺少 20 根有效收盘价' : pullback20 <= -0.03 ? '从近期高点出现可观察回撤' : '接近 20 日高点，留意追涨风险',
    },
    {
      key: 'volatility20',
      label: '近 20 日波动',
      value: volatility20,
      status: volatility20 === null ? 'missing' : 'pass',
      threshold: '仅描述最近 20 个收益波动',
      detail: volatility20 === null ? '缺少 21 根有效收盘价' : '波动率用于识别近期价格变化幅度，不预测未来',
    },
  ]
}

function stateCopy(state: TimingWindowState, availableBars: number): Pick<TimingWindow, 'tone' | 'label' | 'headline'> {
  if (state === 'insufficient')
    return { tone: 'neutral', label: '数据不足', headline: `当前有 ${availableBars} 根有效日线，补齐 60 根后再判断中长线结构。` }
  if (state === 'weak')
    return { tone: 'danger', label: '趋势走弱', headline: '价格偏离中期结构或回撤较深，先核对基本面变化和数据时点。' }
  if (state === 'extended')
    return { tone: 'warning', label: '短线偏热', headline: '价格短期偏离均线或近期高点较近，观察波动收敛和回撤原因。' }
  if (state === 'pullback_watch')
    return { tone: 'warning', label: '回撤观察', headline: '价格从近期高点回撤，但中期结构仍有支撑，优先核对回撤原因。' }
  return { tone: 'positive', label: '结构平稳', headline: '价格位于中期结构附近，暂未出现明显追涨或破位特征。' }
}

export function buildTimingWindow(bars: readonly DailyBar[], trend: TrendStructure): TimingWindow {
  const closes = finiteCloses(bars)
  const latest = closes.at(-1) ?? null
  const ma20 = closes.length >= 20 ? average(closes.slice(-20)) : null
  const ma60 = closes.length >= 60 ? average(closes.slice(-60)) : null
  const high20 = closes.length >= 20 ? Math.max(...closes.slice(-20)) : null
  const ma20Gap = latest !== null && ma20 !== null && ma20 > 0 ? latest / ma20 - 1 : null
  const ma60Gap = latest !== null && ma60 !== null && ma60 > 0 ? latest / ma60 - 1 : null
  const pullback20 = latest !== null && high20 !== null && high20 > 0 ? latest / high20 - 1 : null
  const volatility20 = standardDeviation(recentReturns(closes))
  const metrics = buildMetrics(ma20Gap, ma60Gap, pullback20, volatility20)

  let state: TimingWindowState = 'insufficient'
  if (closes.length >= 60 && ma20Gap !== null && ma60Gap !== null && pullback20 !== null) {
    if (ma20Gap <= -0.03 || ma60Gap <= -0.05 || (trend.drawdown60 !== null && trend.drawdown60 <= -0.15)) {
      state = 'weak'
    }
    else if (ma20Gap >= 0.08 || (trend.return5 !== null && trend.return5 >= 0.05 && pullback20 > -0.02)) {
      state = 'extended'
    }
    else if (pullback20 <= -0.03 && ma20Gap >= -0.02 && ma60Gap >= 0) {
      state = 'pullback_watch'
    }
    else {
      state = 'constructive'
    }
  }

  return {
    state,
    ...stateCopy(state, closes.length),
    availableBars: closes.length,
    ma20Gap,
    ma60Gap,
    pullback20,
    volatility20,
    metrics,
  }
}

