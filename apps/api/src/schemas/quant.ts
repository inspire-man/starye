import * as v from 'valibot'

export const QuantTsCodeSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(20),
  v.regex(/^[A-Za-z0-9.-]+$/u, 'Invalid ts_code'),
)

export const QuantDateSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\d{8}$/u, 'Date must be YYYYMMDD'),
)

export const QuantWatchlistItemSchema = v.object({
  id: v.string(),
  tsCode: v.string(),
  name: v.nullable(v.string()),
  createdAt: v.union([v.string(), v.date()]),
  updatedAt: v.union([v.string(), v.date()]),
  latestTradeDate: v.optional(v.nullable(v.string())),
  barCount: v.optional(v.number()),
  latestClose: v.optional(v.nullable(v.number())),
  latestChangePercent: v.optional(v.nullable(v.number())),
})

export const QuantWatchlistResponseSchema = v.object({
  success: v.literal(true),
  data: v.array(QuantWatchlistItemSchema),
})

export const QuantWatchlistItemResponseSchema = v.object({
  success: v.literal(true),
  data: QuantWatchlistItemSchema,
})

export const QuantWatchlistCreateSchema = v.object({
  ts_code: QuantTsCodeSchema,
  name: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(128))),
})

export const QuantWatchlistUpdateSchema = v.object({
  name: v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(128))),
})

export const QuantWatchlistParamSchema = v.object({
  tsCode: QuantTsCodeSchema,
})

export const QuantResearchStatusSchema = v.picklist(['unreviewed', 'priority', 'paused', 'excluded'])

export const QuantResearchMarkerSchema = v.object({
  tsCode: v.string(),
  status: QuantResearchStatusSchema,
  note: v.nullable(v.string()),
  reviewDate: v.nullable(v.string()),
  createdAt: v.union([v.string(), v.date()]),
  updatedAt: v.union([v.string(), v.date()]),
})

export const QuantResearchMarkerResponseSchema = v.object({
  success: v.literal(true),
  data: QuantResearchMarkerSchema,
})

export const QuantResearchMarkersResponseSchema = v.object({
  success: v.literal(true),
  data: v.array(QuantResearchMarkerSchema),
})

export const QuantResearchMarkerUpdateSchema = v.object({
  status: QuantResearchStatusSchema,
  note: v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(1000))),
  review_date: v.nullable(v.pipe(v.string(), v.trim(), v.regex(/^\d{4}-\d{2}-\d{2}$/u, 'Review date must be YYYY-MM-DD'))),
})

export const QuantDailyQuerySchema = v.object({
  from: v.optional(QuantDateSchema),
  to: v.optional(QuantDateSchema),
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,3}$/u))),
})

export const QuantValuationSnapshotSchema = v.object({
  tsCode: v.string(),
  observedAt: v.string(),
  dynamicPe: v.nullable(v.number()),
  peTtm: v.nullable(v.number()),
  peStatic: v.nullable(v.number()),
  pb: v.nullable(v.number()),
  ps: v.nullable(v.number()),
  peg: v.nullable(v.number()),
  marketCap: v.nullable(v.number()),
})

export const QuantValuationResponseSchema = v.object({
  success: v.literal(true),
  data: QuantValuationSnapshotSchema,
})

export const QuantValuationComparisonPeerSchema = v.object({
  tsCode: v.string(),
  name: v.nullable(v.string()),
  valuation: v.nullable(QuantValuationSnapshotSchema),
})

export const QuantValuationComparisonResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    target: QuantValuationSnapshotSchema,
    peers: v.array(QuantValuationComparisonPeerSchema),
    sampleCount: v.number(),
    availableSampleCount: v.number(),
    ttmPeSampleCount: v.number(),
    pbSampleCount: v.number(),
    ttmPeHigherThanPercent: v.nullable(v.number()),
    pbHigherThanPercent: v.nullable(v.number()),
  }),
})

export const QuantFinancialQualitySnapshotSchema = v.object({
  tsCode: v.string(),
  observedAt: v.string(),
  reportDate: v.string(),
  reportType: v.nullable(v.string()),
  reportDateName: v.nullable(v.string()),
  noticeDate: v.nullable(v.string()),
  revenue: v.nullable(v.number()),
  revenueYoY: v.nullable(v.number()),
  netProfit: v.nullable(v.number()),
  netProfitYoY: v.nullable(v.number()),
  adjustedNetProfit: v.nullable(v.number()),
  adjustedNetProfitYoY: v.nullable(v.number()),
  roe: v.nullable(v.number()),
  grossMargin: v.nullable(v.number()),
  netMargin: v.nullable(v.number()),
  debtAssetRatio: v.nullable(v.number()),
  operatingCashflowToRevenue: v.nullable(v.number()),
  operatingCashflowPerShare: v.nullable(v.number()),
  fcffBack: v.nullable(v.number()),
  fcffForward: v.nullable(v.number()),
  interestCoverage: v.nullable(v.number()),
  interestBearingDebtRatio: v.nullable(v.number()),
  cashRatio: v.nullable(v.number()),
  totalLiability: v.nullable(v.number()),
  roic: v.nullable(v.number()),
})

export const QuantFinancialQualityResponseSchema = v.object({
  success: v.literal(true),
  data: QuantFinancialQualitySnapshotSchema,
})

export const QuantFinancialHistoryQuerySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,2}$/u))),
})

export const QuantFinancialQualityHistoryResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    tsCode: v.string(),
    observedAt: v.string(),
    reports: v.array(QuantFinancialQualitySnapshotSchema),
  }),
})

export const QuantFinancialQualityComparisonPeerSchema = v.object({
  tsCode: v.string(),
  name: v.nullable(v.string()),
  quality: v.nullable(QuantFinancialQualitySnapshotSchema),
})

export const QuantFinancialQualityComparisonResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    target: QuantFinancialQualitySnapshotSchema,
    peers: v.array(QuantFinancialQualityComparisonPeerSchema),
    sampleCount: v.number(),
    availableSampleCount: v.number(),
    revenueYoYSampleCount: v.number(),
    netProfitYoYSampleCount: v.number(),
    roeSampleCount: v.number(),
    debtAssetRatioSampleCount: v.number(),
    revenueYoYHigherThanPercent: v.nullable(v.number()),
    netProfitYoYHigherThanPercent: v.nullable(v.number()),
    roeHigherThanPercent: v.nullable(v.number()),
    debtAssetRatioLowerThanPercent: v.nullable(v.number()),
  }),
})

export const QuantSyncSchema = v.object({
  from_date: v.optional(QuantDateSchema),
  to_date: v.optional(QuantDateSchema),
  ts_codes: v.optional(v.pipe(v.array(QuantTsCodeSchema), v.maxLength(50))),
})

export const QuantCapabilitySchema = v.object({
  name: v.picklist(['daily', 'stock_basic', 'trade_cal', 'daily_basic']),
  enabled: v.boolean(),
  reason: v.picklist(['enabled', 'requires_points_tier_2000', 'invalid_points_tier', 'invalid_provider']),
})

export const QuantCapabilitiesResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    tier: v.nullable(v.union([v.literal(120), v.literal(2000)])),
    provider: v.nullable(v.picklist(['tushare', 'eastmoney'])),
    enabled: v.array(v.picklist(['daily', 'stock_basic', 'trade_cal', 'daily_basic'])),
    capabilities: v.array(QuantCapabilitySchema),
  }),
})

export const QuantAiProviderSchema = v.picklist(['openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama'])

export const QuantAiConfigSchema = v.object({
  id: v.string(),
  provider: QuantAiProviderSchema,
  model: v.string(),
  baseUrl: v.nullable(v.string()),
  hasApiKey: v.boolean(),
  apiKeyHint: v.nullable(v.string()),
  createdAt: v.union([v.string(), v.date()]),
  updatedAt: v.union([v.string(), v.date()]),
})

export const QuantAiConfigResponseSchema = v.object({
  success: v.literal(true),
  data: v.nullable(QuantAiConfigSchema),
})

export const QuantAiConfigUpdateSchema = v.object({
  provider: QuantAiProviderSchema,
  model: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
  base_url: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(2048)))),
  api_key: v.optional(v.pipe(v.string(), v.maxLength(1024))),
  clear_api_key: v.optional(v.boolean()),
})

export const QuantAiConfigDeleteResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({ deleted: v.boolean() }),
})

const QuantFactorWeightSchema = v.pipe(
  v.number(),
  v.check(value => Number.isFinite(value), 'Factor weight must be finite'),
  v.minValue(0),
  v.maxValue(1),
)

export const QuantFactorWeightsSchema = v.strictObject({
  'trend': QuantFactorWeightSchema,
  'valuation': QuantFactorWeightSchema,
  'quality': QuantFactorWeightSchema,
  'shareholder-return': QuantFactorWeightSchema,
  'risk': QuantFactorWeightSchema,
})

export const QuantFactorConfigUpdateSchema = v.strictObject({
  weights: v.pipe(
    QuantFactorWeightsSchema,
    v.check((weights) => {
      const total = weights.trend + weights.valuation + weights.quality + weights['shareholder-return'] + weights.risk
      return Math.abs(total - 1) <= 0.0001
    }, 'Factor weights must sum to 1'),
  ),
})

export const QuantFactorConfigurationSchema = v.strictObject({
  version: v.literal('research-factor-config-v1'),
  weights: QuantFactorWeightsSchema,
  source: v.picklist(['default', 'user']),
  updatedAt: v.nullable(v.string()),
})

export const QuantFactorConfigurationResponseSchema = v.strictObject({
  success: v.literal(true),
  data: QuantFactorConfigurationSchema,
})

export const QuantResearchRunCreateSchema = v.object({
  ts_code: QuantTsCodeSchema,
})

export const QuantResearchRunsQuerySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,2}$/u))),
})

export const QuantResearchRunIdParamSchema = v.object({
  runId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64), v.regex(/^[\w-]+$/u)),
})

export const QuantDecisionRecordActionSchema = v.picklist(['watch', 'plan-buy', 'holding', 'sold'])

export const QuantDecisionRecordUpdateSchema = v.strictObject({
  action: QuantDecisionRecordActionSchema,
  note: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(500)))),
})

export const QuantDecisionRecordQuerySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,2}$/u))),
})

const QuantDecisionRecordPriceRangeSchema = v.strictObject({
  low: v.number(),
  high: v.number(),
  currency: v.literal('CNY'),
  formulaVersion: v.string(),
  source: v.string(),
  observedAt: v.string(),
  evidenceKeys: v.array(v.string()),
})

const QuantDecisionRecordAiReviewSchema = v.strictObject({
  decisionVersion: v.string(),
  recommendation: v.picklist(['bullish', 'bearish', 'watch']),
  confidence: v.number(),
  accepted: v.boolean(),
  rejectionReason: v.nullable(v.picklist(['low-confidence', 'deterministic-watch'])),
  rationale: v.string(),
  invalidationConditions: v.array(v.string()),
  citedEvidenceKeys: v.array(v.string()),
})

export const QuantDecisionRecordSnapshotSchema = v.strictObject({
  snapshotVersion: v.literal('decision-record-v1'),
  reportVersion: v.string(),
  generatedAt: v.string(),
  recommendation: v.nullable(v.picklist(['bullish', 'bearish', 'watch'])),
  confidence: v.nullable(v.number()),
  coverage: v.nullable(v.number()),
  evidenceKeys: v.array(v.string()),
  currentPrice: v.nullable(v.number()),
  currentPriceObservedAt: v.nullable(v.string()),
  buyPriceRange: v.nullable(QuantDecisionRecordPriceRangeSchema),
  sellPriceRange: v.nullable(QuantDecisionRecordPriceRangeSchema),
  aiDecisionReview: v.nullable(QuantDecisionRecordAiReviewSchema),
  factorConfiguration: v.nullable(QuantFactorConfigurationSchema),
})

export const QuantDecisionRecordSchema = v.strictObject({
  id: v.string(),
  researchRunId: v.string(),
  tsCode: v.string(),
  action: QuantDecisionRecordActionSchema,
  note: v.nullable(v.string()),
  snapshot: QuantDecisionRecordSnapshotSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
})

export const QuantDecisionRecordResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.nullable(QuantDecisionRecordSchema),
})

export const QuantDecisionRecordsResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.array(QuantDecisionRecordSchema),
})

export const QuantResearchComparisonSchema = v.strictObject({
  run_ids: v.pipe(
    v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64), v.regex(/^[\w-]+$/u))),
    v.minLength(2),
    v.maxLength(3),
    v.check(runIds => new Set(runIds).size === runIds.length, 'Research run ids must be unique'),
  ),
})

export const QuantResearchComparisonDifferenceSchema = v.strictObject({
  tsCode: QuantTsCodeSchema,
  point: v.pipe(v.string(), v.minLength(1), v.maxLength(480)),
  evidenceKeys: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(80))), v.minLength(1), v.maxLength(16)),
})

export const QuantResearchComparisonCitationSchema = v.strictObject({
  tsCode: QuantTsCodeSchema,
  evidenceKey: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
})

export const QuantResearchComparisonResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.strictObject({
    comparisonVersion: v.literal('research-comparison-v1'),
    provider: QuantAiProviderSchema,
    model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    generatedAt: v.string(),
    overview: v.pipe(v.string(), v.minLength(1), v.maxLength(1200)),
    commonGround: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(360))), v.maxLength(6)),
    differences: v.pipe(v.array(QuantResearchComparisonDifferenceSchema), v.maxLength(6)),
    risks: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(360))), v.maxLength(6)),
    nextChecks: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(360))), v.maxLength(6)),
    citedEvidence: v.pipe(v.array(QuantResearchComparisonCitationSchema), v.maxLength(24)),
  }),
})

export const QuantResearchQuestionSchema = v.strictObject({
  question: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
})

export const QuantResearchQuestionResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.strictObject({
    questionVersion: v.literal('research-question-v1'),
    provider: QuantAiProviderSchema,
    model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    generatedAt: v.string(),
    question: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
    answer: v.pipe(v.string(), v.minLength(1), v.maxLength(8000)),
    citedEvidenceKeys: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(80))), v.maxLength(16)),
  }),
})

export const QuantResearchChangeExplanationSchema = v.strictObject({
  previous_run_id: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64), v.regex(/^[\w-]+$/u)),
})

export const QuantResearchChangeKindSchema = v.picklist([
  'improved',
  'weakened',
  'restored',
  'newly-missing',
  'persistent-missing',
  'changed',
  'incomparable',
  'added',
])

export const QuantResearchChangeExplanationResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.strictObject({
    changeExplanationVersion: v.literal('research-change-explanation-v1'),
    provider: QuantAiProviderSchema,
    model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    generatedAt: v.string(),
    currentGeneratedAt: v.string(),
    previousGeneratedAt: v.string(),
    overview: v.pipe(v.string(), v.minLength(1), v.maxLength(1200)),
    changes: v.pipe(v.array(v.strictObject({
      evidenceKey: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
      label: v.pipe(v.string(), v.minLength(1), v.maxLength(160)),
      kind: QuantResearchChangeKindSchema,
      kindLabel: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
      explanation: v.pipe(v.string(), v.minLength(1), v.maxLength(480)),
    })), v.maxLength(8)),
    nextChecks: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(360))), v.maxLength(6)),
    citedEvidenceKeys: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(80))), v.maxLength(16)),
  }),
})

export const QuantAiCandidateBriefingPriorityLevelSchema = v.picklist(['urgent', 'high', 'normal', 'low'])

export const QuantAiCandidateBriefingRequestSchema = v.strictObject({
  ts_codes: v.optional(v.pipe(v.array(QuantTsCodeSchema), v.maxLength(50))),
})

export const QuantAiCandidateBriefingQuestionRequestSchema = v.strictObject({
  ts_codes: v.pipe(v.array(QuantTsCodeSchema), v.minLength(1), v.maxLength(50)),
  question: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
  session_id: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))),
})

export const QuantAiCandidateBriefingFocusItemSchema = v.strictObject({
  tsCode: QuantTsCodeSchema,
  name: v.nullable(v.string()),
  priorityLevel: QuantAiCandidateBriefingPriorityLevelSchema,
  priorityScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  actionLabel: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  reasons: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(360))), v.maxLength(3)),
  explanation: v.pipe(v.string(), v.minLength(1), v.maxLength(480)),
})

export const QuantAiCandidateBriefingResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.strictObject({
    sessionId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    briefingVersion: v.literal('candidate-briefing-v1'),
    provider: QuantAiProviderSchema,
    model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    generatedAt: v.string(),
    overview: v.pipe(v.string(), v.minLength(1), v.maxLength(1200)),
    focusItems: v.pipe(v.array(QuantAiCandidateBriefingFocusItemSchema), v.maxLength(5)),
    nextChecks: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(360))), v.maxLength(6)),
    citedCandidateCodes: v.pipe(v.array(QuantTsCodeSchema), v.maxLength(5)),
  }),
})

export const QuantAiCandidateBriefingQuestionResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.strictObject({
    sessionId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    questionVersion: v.literal('candidate-briefing-question-v1'),
    provider: QuantAiProviderSchema,
    model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    generatedAt: v.string(),
    question: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
    answer: v.pipe(v.string(), v.minLength(1), v.maxLength(8000)),
    citedCandidateCodes: v.pipe(v.array(QuantTsCodeSchema), v.maxLength(16)),
  }),
})

const QuantAiCandidateBriefingHistoryBriefingSchema = v.strictObject({
  sessionId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  briefingVersion: v.literal('candidate-briefing-v1'),
  provider: QuantAiProviderSchema,
  model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  generatedAt: v.string(),
  overview: v.pipe(v.string(), v.minLength(1), v.maxLength(1200)),
  focusItems: v.pipe(v.array(QuantAiCandidateBriefingFocusItemSchema), v.maxLength(5)),
  nextChecks: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(360))), v.maxLength(6)),
  citedCandidateCodes: v.pipe(v.array(QuantTsCodeSchema), v.maxLength(5)),
})

const QuantAiCandidateBriefingHistoryQuestionSchema = v.strictObject({
  sessionId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  questionVersion: v.literal('candidate-briefing-question-v1'),
  provider: QuantAiProviderSchema,
  model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  generatedAt: v.string(),
  question: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
  answer: v.pipe(v.string(), v.minLength(1), v.maxLength(8000)),
  citedCandidateCodes: v.pipe(v.array(QuantTsCodeSchema), v.maxLength(16)),
})

export const QuantAiCandidateBriefingSessionIdParamSchema = v.object({
  sessionId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
})

export const QuantAiCandidateBriefingSessionQuerySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,2}$/u))),
})

export const QuantAiCandidateBriefingSessionSchema = v.strictObject({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  snapshotId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  snapshotGeneratedAt: v.nullable(v.string()),
  fromDate: v.nullable(v.string()),
  toDate: v.nullable(v.string()),
  scopeKey: v.pipe(v.string(), v.minLength(1), v.maxLength(1200)),
  candidateCodes: v.pipe(v.array(QuantTsCodeSchema), v.maxLength(50)),
  briefing: v.nullable(QuantAiCandidateBriefingHistoryBriefingSchema),
  questions: v.pipe(v.array(QuantAiCandidateBriefingHistoryQuestionSchema), v.maxLength(10)),
  provider: QuantAiProviderSchema,
  model: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  createdAt: v.string(),
  updatedAt: v.string(),
})

export const QuantAiCandidateBriefingSessionListResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.strictObject({
    items: v.array(QuantAiCandidateBriefingSessionSchema),
    limit: v.pipe(v.number(), v.minValue(1), v.maxValue(10)),
  }),
})

export const QuantAiCandidateBriefingSessionResponseSchema = v.strictObject({
  success: v.literal(true),
  data: QuantAiCandidateBriefingSessionSchema,
})

export const QuantAiCandidateBriefingSessionDeleteResponseSchema = v.strictObject({
  success: v.literal(true),
  data: v.strictObject({
    deleted: v.literal(true),
    sessionId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  }),
})

export type QuantAiCandidateBriefingSessionDeleteResponse = v.InferOutput<typeof QuantAiCandidateBriefingSessionDeleteResponseSchema>

export const QuantResearchSummaryQuerySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,2}$/u))),
})

export type QuantWatchlistCreate = v.InferOutput<typeof QuantWatchlistCreateSchema>
export type QuantWatchlistUpdate = v.InferOutput<typeof QuantWatchlistUpdateSchema>
export type QuantResearchMarkerUpdate = v.InferOutput<typeof QuantResearchMarkerUpdateSchema>
export type QuantDailyQuery = v.InferOutput<typeof QuantDailyQuerySchema>
export type QuantSyncInput = v.InferOutput<typeof QuantSyncSchema>
export type QuantAiConfigUpdate = v.InferOutput<typeof QuantAiConfigUpdateSchema>
export type QuantFactorConfigUpdate = v.InferOutput<typeof QuantFactorConfigUpdateSchema>
export type QuantAiCandidateBriefingRequest = v.InferOutput<typeof QuantAiCandidateBriefingRequestSchema>
export type QuantAiCandidateBriefingQuestionRequest = v.InferOutput<typeof QuantAiCandidateBriefingQuestionRequestSchema>
export type QuantAiCandidateBriefingSessionQuery = v.InferOutput<typeof QuantAiCandidateBriefingSessionQuerySchema>
export type QuantResearchRunCreate = v.InferOutput<typeof QuantResearchRunCreateSchema>
export type QuantResearchRunsQuery = v.InferOutput<typeof QuantResearchRunsQuerySchema>
export type QuantResearchRunIdParam = v.InferOutput<typeof QuantResearchRunIdParamSchema>
export type QuantResearchComparison = v.InferOutput<typeof QuantResearchComparisonSchema>
export type QuantResearchComparisonResponse = v.InferOutput<typeof QuantResearchComparisonResponseSchema>
export type QuantResearchQuestion = v.InferOutput<typeof QuantResearchQuestionSchema>
export type QuantResearchQuestionResponse = v.InferOutput<typeof QuantResearchQuestionResponseSchema>
export type QuantResearchChangeExplanationInput = v.InferOutput<typeof QuantResearchChangeExplanationSchema>
export type QuantResearchSummaryQuery = v.InferOutput<typeof QuantResearchSummaryQuerySchema>
