import * as v from 'valibot'
import {
  QuantAiCandidateBriefingQuestionResponseSchema,
  QuantAiCandidateBriefingResponseSchema,
  QuantAiCandidateBriefingSessionDeleteResponseSchema,
  QuantAiCandidateBriefingSessionListResponseSchema,
  QuantAiCandidateBriefingSessionResponseSchema,
  QuantAiConfigDeleteResponseSchema,
  QuantAiConfigResponseSchema,
  QuantAiRunAuditsResponseSchema,
  QuantCapabilitiesResponseSchema,
  QuantDecisionAssistantListResponseSchema,
  QuantDecisionAssistantResponseSchema,
  QuantDecisionRecordResponseSchema,
  QuantDecisionRecordsResponseSchema,
  QuantFactorConfigurationResponseSchema,
  QuantFinancialQualityComparisonResponseSchema,
  QuantFinancialQualityHistoryResponseSchema,
  QuantFinancialQualityResponseSchema,
  QuantResearchChangeExplanationResponseSchema,
  QuantResearchComparisonResponseSchema,
  QuantResearchMarkerResponseSchema,
  QuantResearchMarkersResponseSchema,
  QuantResearchQuestionResponseSchema,
  QuantValuationComparisonResponseSchema,
  QuantValuationResponseSchema,
  QuantWatchlistItemResponseSchema,
  QuantWatchlistResponseSchema,
} from './quant'

export {
  QuantAiCandidateBriefingQuestionResponseSchema,
  QuantAiCandidateBriefingResponseSchema,
  QuantAiCandidateBriefingSessionDeleteResponseSchema,
  QuantAiCandidateBriefingSessionListResponseSchema,
  QuantAiCandidateBriefingSessionResponseSchema,
  QuantAiConfigDeleteResponseSchema,
  QuantAiConfigResponseSchema,
  QuantAiRunAuditsResponseSchema,
  QuantCapabilitiesResponseSchema,
  QuantDecisionAssistantListResponseSchema,
  QuantDecisionAssistantResponseSchema,
  QuantDecisionRecordResponseSchema,
  QuantDecisionRecordsResponseSchema,
  QuantFactorConfigurationResponseSchema,
  QuantFinancialQualityComparisonResponseSchema,
  QuantFinancialQualityHistoryResponseSchema,
  QuantFinancialQualityResponseSchema,
  QuantResearchChangeExplanationResponseSchema,
  QuantResearchComparisonResponseSchema,
  QuantResearchMarkerResponseSchema,
  QuantResearchMarkersResponseSchema,
  QuantResearchQuestionResponseSchema,
  QuantValuationComparisonResponseSchema,
  QuantValuationResponseSchema,
  QuantWatchlistItemResponseSchema,
  QuantWatchlistResponseSchema,
}

const QuantUnknownDataResponseSchema = v.object({
  success: v.literal(true),
  data: v.unknown(),
})

export const QuantWatchlistDeleteResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({ tsCode: v.string() }),
})

export const QuantStockBasicResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    tsCode: v.string(),
    name: v.string(),
    observedAt: v.string(),
  }),
})

const QuantDailyBarSchema = v.object({
  id: v.string(),
  tsCode: v.string(),
  tradeDate: v.string(),
  open: v.nullable(v.number()),
  high: v.nullable(v.number()),
  low: v.nullable(v.number()),
  close: v.nullable(v.number()),
  preClose: v.nullable(v.number()),
  change: v.nullable(v.number()),
  changePercent: v.nullable(v.number()),
  volume: v.nullable(v.number()),
  amount: v.nullable(v.number()),
})

export const QuantDailyBarsResponseSchema = v.object({
  success: v.literal(true),
  data: v.array(QuantDailyBarSchema),
})

const QuantSyncResultSchema = v.object({
  status: v.picklist(['completed', 'partial', 'rejected']),
  requested: v.number(),
  processed: v.number(),
  written: v.number(),
  skipped: v.number(),
  reason: v.nullable(v.string()),
  snapshotId: v.nullable(v.string()),
  startedAt: v.nullable(v.string()),
  completedAt: v.nullable(v.string()),
})

export const QuantSyncStateResponseSchema = v.object({
  success: v.literal(true),
  data: v.nullable(QuantSyncResultSchema),
})

export const QuantSyncResultResponseSchema = v.object({
  success: v.boolean(),
  data: QuantSyncResultSchema,
})

export const QuantCandidateSnapshotResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    id: v.string(),
    factorVersion: v.string(),
    generatedAt: v.nullable(v.string()),
    fromDate: v.nullable(v.string()),
    toDate: v.nullable(v.string()),
    candidates: v.array(v.unknown()),
  }),
})

export const QuantInvestmentKnowledgeResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    version: v.string(),
    observedAt: v.string(),
    sources: v.array(v.unknown()),
    factors: v.array(v.unknown()),
    aliases: v.array(v.unknown()),
    recommendedWatchlist: v.array(v.unknown()),
  }),
})

export const QuantAiConnectionTestResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    provider: v.string(),
    model: v.string(),
    testedAt: v.string(),
    latencyMs: v.number(),
  }),
})

export const QuantValueSelectionResponseSchema = QuantUnknownDataResponseSchema
export const QuantShareholderReturnsResponseSchema = QuantUnknownDataResponseSchema

const QuantResearchRunSchema = v.object({
  id: v.string(),
  tsCode: v.string(),
  name: v.nullable(v.string()),
  status: v.string(),
  reportVersion: v.string(),
  sourceSnapshotId: v.nullable(v.string()),
  generatedAt: v.nullable(v.string()),
  createdAt: v.nullable(v.string()),
  report: v.unknown(),
})

export const QuantResearchRunResponseSchema = v.object({
  success: v.literal(true),
  data: QuantResearchRunSchema,
})

export const QuantResearchRunsResponseSchema = v.object({
  success: v.literal(true),
  data: v.array(QuantResearchRunSchema),
})

const QuantResearchSummarySchema = v.object({
  id: v.string(),
  researchRunId: v.string(),
  summaryVersion: v.string(),
  reportVersion: v.string(),
  provider: v.string(),
  model: v.string(),
  summary: v.unknown(),
  generatedAt: v.nullable(v.string()),
  createdAt: v.nullable(v.string()),
})

export const QuantResearchSummaryResponseSchema = v.object({
  success: v.literal(true),
  data: QuantResearchSummarySchema,
})

export const QuantResearchSummariesResponseSchema = v.object({
  success: v.literal(true),
  data: v.array(QuantResearchSummarySchema),
})

export const QuantResearchSummaryStreamEventSchema = v.string()
