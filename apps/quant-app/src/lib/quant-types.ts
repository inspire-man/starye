export const CAPABILITY_ORDER = ['daily', 'stock_basic', 'trade_cal', 'daily_basic'] as const

export type CapabilityKey = typeof CAPABILITY_ORDER[number]
export type QuantProviderName = 'tushare' | 'eastmoney'
export type QuantAiProvider = 'openai_compatible' | 'deepseek' | 'qwen' | 'gemini' | 'ollama'

export interface QuantAiConfig {
  id: string
  provider: QuantAiProvider
  model: string
  baseUrl: string | null
  hasApiKey: boolean
  apiKeyHint: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface QuantAiConnectionTest {
  provider: QuantAiProvider
  model: string
  testedAt: string
  latencyMs: number
}

export type QuantResearchRunStatus = 'ready' | 'partial' | 'insufficient_data'
export type QuantResearchEvidenceStatus = 'pass' | 'caution' | 'fail' | 'missing'
export type QuantResearchAction = 'research-window' | 'wait-confirmation' | 'reassess' | 'complete-data'
export type QuantRecommendation = 'bullish' | 'bearish' | 'watch'
export type QuantResearchFactorStatus = 'ready' | 'partial' | 'missing' | 'unavailable'

export interface QuantResearchFactor {
  key: 'trend' | 'valuation' | 'quality' | 'shareholder-return' | 'risk'
  label: string
  weight: number
  sourceId: string
  source: string
  status: QuantResearchFactorStatus
  score: number | null
  evidenceKeys: string[]
  missingEvidenceKeys: string[]
}

export interface QuantFactorModel {
  modelVersion: string
  totalWeight: number
  coveredWeight: number
  coverage: number
  score: number | null
  factors: QuantResearchFactor[]
}

export interface QuantReferencePriceRange {
  low: number
  high: number
  currency: 'CNY'
  formulaVersion: string
  source: string
  observedAt: string
  evidenceKeys: string[]
}

export interface QuantDecisionProjection {
  decisionVersion: string
  recommendation: QuantRecommendation
  label: '看多' | '看空' | '观望'
  deterministicScore: number | null
  confidence: number | null
  coverage: number
  buyPriceRange: QuantReferencePriceRange | null
  sellPriceRange: QuantReferencePriceRange | null
  evidenceKeys: string[]
  invalidationConditions: string[]
  headline: string
}

export interface QuantResearchEvidence {
  key: string
  dimension: string
  label: string
  status: QuantResearchEvidenceStatus
  value: number | null
  threshold: string
  source: string
  observedAt: string | null
  formulaVersion: string
  detail: string
  optional?: boolean
}

export interface QuantResearchSource {
  id: string
  name: string
  observedAt: string | null
  formulaVersion: string
}

export interface QuantResearchReport {
  reportVersion: string
  tsCode: string
  name: string | null
  generatedAt: string
  sourceSnapshotId: string | null
  status: QuantResearchRunStatus
  action: QuantResearchAction
  score: number | null
  headline: string
  strengths: string[]
  risks: string[]
  gaps: string[]
  nextActions: string[]
  evidence: QuantResearchEvidence[]
  sources: QuantResearchSource[]
  factorModel?: QuantFactorModel
  decision?: QuantDecisionProjection
}

export interface QuantAiDecisionReview {
  decisionVersion: string
  recommendation: QuantRecommendation
  confidence: number
  accepted: boolean
  rejectionReason: 'low-confidence' | 'deterministic-watch' | null
  rationale: string
  invalidationConditions: string[]
  citedEvidenceKeys: string[]
}

export interface QuantResearchRun {
  id: string
  tsCode: string
  name: string | null
  status: QuantResearchRunStatus
  reportVersion: string
  sourceSnapshotId: string | null
  generatedAt: string | null
  createdAt: string | null
  report: QuantResearchReport
}

export interface QuantResearchSummary {
  id: string
  researchRunId: string
  summaryVersion: string
  reportVersion: string
  provider: QuantAiProvider
  model: string
  generatedAt: string | null
  createdAt: string | null
  summary: {
    summaryVersion: string
    overview: string
    supports: string[]
    concerns: string[]
    nextChecks: string[]
    citedEvidenceKeys: string[]
    decisionReview?: QuantAiDecisionReview | null
  }
  citedEvidenceKeys: string[]
}

export interface QuantResearchComparisonDifference {
  tsCode: string
  point: string
  evidenceKeys: string[]
}

export interface QuantResearchComparisonCitation {
  tsCode: string
  evidenceKey: string
}

export interface QuantResearchComparison {
  comparisonVersion: 'research-comparison-v1'
  provider: QuantAiProvider
  model: string
  generatedAt: string
  overview: string
  commonGround: string[]
  differences: QuantResearchComparisonDifference[]
  risks: string[]
  nextChecks: string[]
  citedEvidence: QuantResearchComparisonCitation[]
}

export interface QuantResearchQuestion {
  questionVersion: 'research-question-v1'
  provider: QuantAiProvider
  model: string
  generatedAt: string
  question: string
  answer: string
  citedEvidenceKeys: string[]
}

export type QuantResearchChangeKind = 'improved' | 'weakened' | 'restored' | 'newly-missing' | 'persistent-missing' | 'changed' | 'incomparable' | 'added'

export interface QuantResearchChangeExplanationItem {
  evidenceKey: string
  label: string
  kind: QuantResearchChangeKind
  kindLabel: string
  explanation: string
}

export interface QuantResearchChangeExplanation {
  changeExplanationVersion: 'research-change-explanation-v1'
  provider: QuantAiProvider
  model: string
  generatedAt: string
  currentGeneratedAt: string
  previousGeneratedAt: string
  overview: string
  changes: QuantResearchChangeExplanationItem[]
  nextChecks: string[]
  citedEvidenceKeys: string[]
}

export type QuantAiCandidateBriefingPriorityLevel = 'urgent' | 'high' | 'normal' | 'low'

export interface QuantAiCandidateBriefingFocusItem {
  tsCode: string
  name: string | null
  priorityLevel: QuantAiCandidateBriefingPriorityLevel
  priorityScore: number
  actionLabel: string
  reasons: string[]
  explanation: string
}

export interface QuantAiCandidateBriefing {
  briefingVersion: 'candidate-briefing-v1'
  sessionId?: string
  provider: QuantAiProvider
  model: string
  generatedAt: string
  overview: string
  focusItems: QuantAiCandidateBriefingFocusItem[]
  nextChecks: string[]
  citedCandidateCodes: string[]
}

export interface QuantAiCandidateBriefingQuestion {
  questionVersion: 'candidate-briefing-question-v1'
  sessionId?: string
  provider: QuantAiProvider
  model: string
  generatedAt: string
  question: string
  answer: string
  citedCandidateCodes: string[]
}

export interface QuantAiCandidateBriefingSession {
  id: string
  snapshotId: string
  snapshotGeneratedAt: string | null
  fromDate: string | null
  toDate: string | null
  scopeKey: string
  candidateCodes: string[]
  briefing: QuantAiCandidateBriefing | null
  questions: QuantAiCandidateBriefingQuestion[]
  provider: QuantAiProvider
  model: string
  createdAt: string
  updatedAt: string
}

export interface QuantAiCandidateBriefingSessionList {
  items: QuantAiCandidateBriefingSession[]
  limit: number
}

export interface QuantAiCandidateBriefingSessionDeletion {
  deleted: true
  sessionId: string
}

export type SyncStatus = 'completed' | 'partial' | 'rejected'
export type ResearchMarkerStatus = 'unreviewed' | 'priority' | 'paused' | 'excluded'

export interface QuantResearchMarker {
  tsCode: string
  status: ResearchMarkerStatus
  note: string | null
  reviewDate: string | null
  createdAt: string | null
  updatedAt: string | null
}

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

export interface QuantStockBasic {
  tsCode: string
  name: string
  observedAt: string
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
export type CandidatePersistenceState = 'first_seen' | 'confirming' | 'weakening' | 'not_in_latest' | 'insufficient_history'

export interface CandidateFactorPersistence {
  factor: string
  appearances: number
  rate: number | null
}

export interface CandidateSignalEvidence {
  snapshotId: string
  generatedAt: string | null
  present: boolean
  score: number | null
  matchedFactors: string[]
}

export interface CandidateSignalPersistence {
  sampleSize: number
  appearanceCount: number
  persistenceRate: number | null
  latestScore: number | null
  previousScore: number | null
  scoreDelta: number | null
  scoreChange: number | null
  state: CandidatePersistenceState
  factorPersistence: CandidateFactorPersistence[]
  evidence: CandidateSignalEvidence[]
}

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
  persistence?: CandidateSignalPersistence
  pendingSync?: boolean
  pendingReason?: string | null
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

export interface QuantValuationSnapshot {
  tsCode: string
  observedAt: string
  dynamicPe: number | null
  peTtm: number | null
  peStatic: number | null
  pb: number | null
  ps: number | null
  peg: number | null
  marketCap: number | null
}

export interface QuantValuationComparisonPeer {
  tsCode: string
  name: string | null
  valuation: QuantValuationSnapshot | null
}

export interface QuantValuationComparison {
  target: QuantValuationSnapshot
  peers: QuantValuationComparisonPeer[]
  sampleCount: number
  availableSampleCount: number
  ttmPeSampleCount: number
  pbSampleCount: number
  ttmPeHigherThanPercent: number | null
  pbHigherThanPercent: number | null
}

export interface QuantFinancialQualitySnapshot {
  tsCode: string
  observedAt: string
  reportDate: string
  reportType: string | null
  reportDateName: string | null
  noticeDate: string | null
  revenue: number | null
  revenueYoY: number | null
  netProfit: number | null
  netProfitYoY: number | null
  adjustedNetProfit: number | null
  adjustedNetProfitYoY: number | null
  roe: number | null
  grossMargin: number | null
  netMargin: number | null
  debtAssetRatio: number | null
  operatingCashflowToRevenue: number | null
  operatingCashflowPerShare: number | null
  fcffBack: number | null
  fcffForward: number | null
  interestCoverage: number | null
  interestBearingDebtRatio: number | null
  cashRatio: number | null
  totalLiability: number | null
  roic: number | null
}

export type QuantShareholderReturnStatus = 'ready' | 'partial' | 'insufficient_data'

export interface QuantShareholderReturnDistribution {
  endDate: string
  annDate: string | null
  cashDividendPerShare: number
  exDate: string | null
  payDate: string | null
}

export interface QuantShareholderReturnItem {
  tsCode: string
  name: string | null
  formulaVersion: string
  status: QuantShareholderReturnStatus
  provider: QuantProviderName | null
  providerChain: QuantProviderName[]
  fallbackUsed: boolean
  fallbackReason: string | null
  providerErrorCode: string | null
  observedAt: string
  latestClose: number | null
  trailingCashDividendPerShare: number | null
  trailingDividendYield: number | null
  dividendYears: number
  distributions: QuantShareholderReturnDistribution[]
  missingFields: string[]
}

export interface QuantShareholderReturnSelection {
  formulaVersion: string
  observedAt: string
  provider: QuantProviderName | null
  providerChain: QuantProviderName[]
  sampleCount: number
  readyCount: number
  partialCount: number
  insufficientCount: number
  items: QuantShareholderReturnItem[]
}

export interface QuantFinancialQualityHistory {
  tsCode: string
  observedAt: string
  reports: QuantFinancialQualitySnapshot[]
}

export interface QuantFinancialQualityComparisonPeer {
  tsCode: string
  name: string | null
  quality: QuantFinancialQualitySnapshot | null
}

export interface QuantFinancialQualityComparison {
  target: QuantFinancialQualitySnapshot
  peers: QuantFinancialQualityComparisonPeer[]
  sampleCount: number
  availableSampleCount: number
  revenueYoYSampleCount: number
  netProfitYoYSampleCount: number
  roeSampleCount: number
  debtAssetRatioSampleCount: number
  revenueYoYHigherThanPercent: number | null
  netProfitYoYHigherThanPercent: number | null
  roeHigherThanPercent: number | null
  debtAssetRatioLowerThanPercent: number | null
}

export type ValueQualityStatus = 'ready' | 'partial' | 'insufficient_data'
export type ValueQualityDimensionStatus = 'ready' | 'partial' | 'missing'
export type ValueQualityDimensionKey = 'valuation' | 'quality' | 'growth' | 'resilience' | 'trend'

export interface QuantValueQualityMetric {
  key: string
  label: string
  value: number | null
  favorablePercentile: number | null
  sampleCount: number
}

export interface QuantValueQualityDimension {
  key: ValueQualityDimensionKey
  label: string
  score: number | null
  maxScore: number
  status: ValueQualityDimensionStatus
  metrics: QuantValueQualityMetric[]
}

export interface QuantValueQualityItem {
  tsCode: string
  name: string | null
  formulaVersion: string
  status: ValueQualityStatus
  score: number | null
  observedAt: string
  valuationObservedAt: string | null
  financialObservedAt: string | null
  financialReportDate: string | null
  financialNoticeDate: string | null
  valuationStatus: 'ready' | 'failed' | 'missing'
  financialStatus: 'ready' | 'failed' | 'missing'
  dailyStatus: 'ready' | 'partial' | 'missing'
  dimensions: QuantValueQualityDimension[]
  riskDeduction: number
  riskNotes: string[]
  missingFields: string[]
}

export interface QuantValueSelection {
  formulaVersion: string
  observedAt: string
  sampleCount: number
  readyCount: number
  partialCount: number
  insufficientCount: number
  items: QuantValueQualityItem[]
}

export type QuantKnowledgeSourceAccess = 'full' | 'preview'
export type QuantKnowledgeFactorStatus = 'active' | 'partial' | 'planned' | 'context'
export type QuantKnowledgeAliasStatus = 'mapped' | 'ambiguous' | 'context_only'
export type QuantKnowledgeConfidence = 'high' | 'medium' | 'low'

export interface QuantKnowledgeSource {
  id: string
  title: string
  url: string
  publishedAt: string | null
  access: QuantKnowledgeSourceAccess
  summary: string
}

export interface QuantKnowledgeFactor {
  id: string
  category: string
  title: string
  interpretation: string
  measurement: string
  requiredFields: string[]
  availableFields: string[]
  missingFields: string[]
  status: QuantKnowledgeFactorStatus
  eligibleInValueQuality: boolean
  currentDimension: 'valuation' | 'quality' | 'growth' | 'resilience' | 'trend' | null
  sourceIds: string[]
}

export interface QuantKnowledgeAlias {
  alias: string
  status: QuantKnowledgeAliasStatus
  confidence: QuantKnowledgeConfidence
  tsCode: string | null
  name: string | null
  candidates: string[]
  note: string
}

export interface QuantInvestmentKnowledge {
  version: string
  observedAt: string
  sources: QuantKnowledgeSource[]
  factors: QuantKnowledgeFactor[]
  aliases: QuantKnowledgeAlias[]
  recommendedWatchlist: { tsCode: string, name: string }[]
}
