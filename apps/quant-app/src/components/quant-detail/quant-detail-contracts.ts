import type { DailyBar } from '../../lib/quant-view-models'

export type FinancialTrendTone = 'positive' | 'negative' | 'neutral'
export type FinancialTrendFormat = 'growth' | 'metric'

export interface FinancialTrendItem {
  key: string
  label: string
  current: number | null
  delta: number | null
  format: FinancialTrendFormat
  tone: FinancialTrendTone
  state: string
}

export interface QuantDetailLoadingState {
  daily: boolean
  valuation: boolean
  financial: boolean
  valueQuality: boolean
  shareholderReturns: boolean
}

export interface QuantDetailErrorState {
  daily: unknown | null
  valuation: unknown | null
  financial: unknown | null
  valueQuality: unknown | null
  shareholderReturns: unknown | null
}

export interface QuantDetailChartBar {
  date: string
  height: number
  positive: boolean
  close: number
}

export type QuantDetailDailyColumns = import('@starye/ui').Column<DailyBar>[]
