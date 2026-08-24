export const CAPABILITY_ORDER = ['daily', 'stock_basic', 'trade_cal', 'daily_basic'] as const

export type CapabilityKey = typeof CAPABILITY_ORDER[number]
export type QuantProviderName = 'tushare' | 'eastmoney'

export type SyncStatus = 'completed' | 'partial' | 'rejected'

export interface CapabilityState {
  key: CapabilityKey
  label: string
  enabled: boolean
  reason: string
  requires?: string[]
}

export interface CapabilitiesResponse {
  tier: number | null
  provider: QuantProviderName | null
  enabled: CapabilityKey[]
  capabilities: CapabilityState[]
}

export interface WatchlistItem {
  id: string
  tsCode: string
  name: string | null
  latestTradeDate: string | null
  barCount: number
  latestClose: number | null
  latestChangePercent: number | null
  createdAt: string | null
}

export interface SyncResult {
  status: SyncStatus
  requestedCount: number
  writtenCount: number
  skippedCount: number
  requested: number
  processed: number
  written: number
  skipped: number
  reason: string | null
  snapshotId: string | null
  startedAt: string | null
  completedAt: string | null
}

export type CandidateQuality = 'ready' | 'partial' | 'insufficient' | 'insufficient_data'

export interface CandidateItem {
  id: string
  tsCode: string
  factorVersion: string | null
  name: string | null
  score: number | null
  close: number | null
  changePercent: number | null
  ma5: number | null
  ma20: number | null
  return20: number | null
  newHigh20: boolean | null
  upStreak: number | null
  volumeRatio: number | null
  relativeStrength: number | null
  signals: string[]
  missingFactors: string[]
  quality: CandidateQuality
}

export interface CandidateSnapshot {
  id: string
  factorVersion: string
  generatedAt: string | null
  fromDate: string | null
  toDate: string | null
  candidates: CandidateItem[]
}

export interface DailyBar {
  id: string
  tsCode: string
  tradeDate: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  preClose: number | null
  change: number | null
  changePercent: number | null
  volume: number | null
  amount: number | null
}
