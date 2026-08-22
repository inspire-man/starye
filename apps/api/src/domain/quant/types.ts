export const QUANT_FACTOR_VERSION = 'momentum-v1' as const

export type QuantCapabilityName = 'daily' | 'stock_basic' | 'trade_cal' | 'daily_basic'

export type QuantSyncStatus = 'completed' | 'partial' | 'rejected'

export type QuantDataQuality = 'ready' | 'insufficient_data'

export interface DailyBar {
  readonly tsCode: string
  readonly tradeDate: string
  readonly open: number
  readonly high: number
  readonly low: number
  readonly close: number
  readonly preClose: number | null
  readonly change: number | null
  readonly pctChg: number | null
  readonly volume: number
  readonly amount: number | null
}

export interface MomentumFactors {
  readonly ma5: number | null
  readonly ma20: number | null
  readonly isNewHigh20: boolean | null
  readonly consecutiveUpDays: number | null
  readonly volumeRatio: number | null
  readonly return20: number | null
  readonly relativeStrength: number | null
}

export interface MomentumCandidate {
  readonly tsCode: string
  readonly factorVersion: typeof QUANT_FACTOR_VERSION
  readonly factors: MomentumFactors
  readonly matchedFactors: readonly string[]
  readonly missingFactors: readonly string[]
  readonly dataQuality: QuantDataQuality
  readonly score: number
}

export interface QuantSyncInput {
  readonly fromDate?: string
  readonly toDate?: string
  readonly tsCodes?: readonly string[]
}

export interface QuantSyncResult {
  readonly status: QuantSyncStatus
  readonly fromDate: string
  readonly toDate: string
  readonly requestedCount: number
  readonly writtenCount: number
  readonly skippedCount: number
  readonly reasonCode?: string
  readonly reason?: string
  readonly snapshotId?: string
  readonly candidates: readonly MomentumCandidate[]
}
