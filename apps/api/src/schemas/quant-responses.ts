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

const QuantShareholderReturnDistributionSchema = v.object({
  endDate: v.string(),
  annDate: v.nullable(v.string()),
  cashDividendPerShare: v.number(),
  exDate: v.nullable(v.string()),
  payDate: v.nullable(v.string()),
})

const QuantInterestBearingDebtComponentsSchema = v.object({
  shortLoan: v.nullable(v.number()),
  shortBondPayable: v.nullable(v.number()),
  shortFinancePayable: v.nullable(v.number()),
  acceptDepositInterbank: v.nullable(v.number()),
  borrowFund: v.nullable(v.number()),
  loanPbc: v.nullable(v.number()),
  currentMaturityDebt: v.nullable(v.number()),
  amortizedCostFinancialLiability: v.nullable(v.number()),
  longLoan: v.nullable(v.number()),
  amortizedCostNoncurrentFinancialLiability: v.nullable(v.number()),
  bondPayable: v.nullable(v.number()),
  perpetualBond: v.nullable(v.number()),
  perpetualBondPayable: v.nullable(v.number()),
  leaseLiability: v.nullable(v.number()),
})

const QuantShareholderCashflowEvidenceSchema = v.object({
  formulaVersion: v.string(),
  status: v.picklist(['ready', 'partial', 'insufficient_data', 'unavailable']),
  provider: v.nullable(v.picklist(['tushare', 'eastmoney'])),
  providerErrorCode: v.nullable(v.string()),
  observedAt: v.string(),
  reportDate: v.nullable(v.string()),
  reportType: v.nullable(v.string()),
  reportDateName: v.nullable(v.string()),
  noticeDate: v.nullable(v.string()),
  operatingCashflow: v.nullable(v.number()),
  capitalExpenditure: v.nullable(v.number()),
  netProfit: v.nullable(v.number()),
  cashDividendsPaid: v.nullable(v.number()),
  freeCashflow: v.nullable(v.number()),
  freeCashflowCoverage: v.nullable(v.number()),
  interestExpense: v.nullable(v.number()),
  interestExpenseSourceField: v.nullable(v.picklist(['FE_INTEREST_EXPENSE', 'INTEREST_EXPENSE'])),
  interestExpenseProviderErrorCode: v.nullable(v.string()),
  interestBearingDebt: v.nullable(v.number()),
  interestBearingDebtComponents: QuantInterestBearingDebtComponentsSchema,
  interestBearingDebtProviderErrorCode: v.nullable(v.string()),
  freeCashflowAfterInterest: v.nullable(v.number()),
  payoutRatio: v.nullable(v.number()),
  payoutRatioReportDate: v.nullable(v.string()),
  missingFields: v.array(v.string()),
})

const QuantShareholderCapitalChangeSchema = v.object({
  reportDate: v.string(),
  totalShares: v.nullable(v.number()),
  changeReason: v.nullable(v.string()),
  sharesOutstandingChange: v.nullable(v.number()),
  sharesOutstandingChangeRatio: v.nullable(v.number()),
})

const QuantShareholderCapitalEvidenceSchema = v.object({
  formulaVersion: v.string(),
  status: v.picklist(['ready', 'partial', 'insufficient_data', 'unavailable']),
  provider: v.nullable(v.picklist(['tushare', 'eastmoney'])),
  providerErrorCode: v.nullable(v.string()),
  observedAt: v.string(),
  latestReportDate: v.nullable(v.string()),
  latestTotalShares: v.nullable(v.number()),
  latestChangeReason: v.nullable(v.string()),
  previousReportDate: v.nullable(v.string()),
  previousTotalShares: v.nullable(v.number()),
  sharesOutstandingChange: v.nullable(v.number()),
  sharesOutstandingChangeRatio: v.nullable(v.number()),
  repurchaseSharesRetired: v.nullable(v.number()),
  changes: v.array(QuantShareholderCapitalChangeSchema),
  missingFields: v.array(v.string()),
})

const QuantShareholderRepurchaseRecordSchema = v.object({
  repurchaseCode: v.nullable(v.string()),
  announcementDate: v.nullable(v.string()),
  startDate: v.nullable(v.string()),
  endDate: v.nullable(v.string()),
  finishDate: v.nullable(v.string()),
  progress: v.nullable(v.string()),
  plannedAmountLower: v.nullable(v.number()),
  plannedAmountUpper: v.nullable(v.number()),
  repurchaseAmount: v.nullable(v.number()),
  repurchaseShares: v.nullable(v.number()),
})

const QuantShareholderRepurchaseEvidenceSchema = v.object({
  formulaVersion: v.string(),
  status: v.picklist(['ready', 'partial', 'insufficient_data', 'unavailable']),
  provider: v.nullable(v.picklist(['tushare', 'eastmoney'])),
  providerErrorCode: v.nullable(v.string()),
  observedAt: v.string(),
  latestAnnouncementDate: v.nullable(v.string()),
  latestProgress: v.nullable(v.string()),
  repurchaseAmount: v.nullable(v.number()),
  plannedAmountLower: v.nullable(v.number()),
  plannedAmountUpper: v.nullable(v.number()),
  records: v.array(QuantShareholderRepurchaseRecordSchema),
  missingFields: v.array(v.string()),
})

const QuantShareholderReturnItemSchema = v.object({
  tsCode: v.string(),
  name: v.nullable(v.string()),
  formulaVersion: v.string(),
  status: v.picklist(['ready', 'partial', 'insufficient_data']),
  provider: v.nullable(v.picklist(['tushare', 'eastmoney'])),
  providerChain: v.array(v.picklist(['tushare', 'eastmoney'])),
  fallbackUsed: v.boolean(),
  fallbackReason: v.nullable(v.string()),
  providerErrorCode: v.nullable(v.string()),
  observedAt: v.string(),
  latestClose: v.nullable(v.number()),
  trailingCashDividendPerShare: v.nullable(v.number()),
  trailingDividendYield: v.nullable(v.number()),
  dividendYears: v.number(),
  distributions: v.array(QuantShareholderReturnDistributionSchema),
  missingFields: v.array(v.string()),
  cashflowEvidence: v.optional(QuantShareholderCashflowEvidenceSchema),
  capitalStructureEvidence: v.optional(QuantShareholderCapitalEvidenceSchema),
  repurchaseEvidence: v.optional(QuantShareholderRepurchaseEvidenceSchema),
})

export const QuantShareholderReturnsResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    formulaVersion: v.string(),
    observedAt: v.string(),
    provider: v.nullable(v.picklist(['tushare', 'eastmoney'])),
    providerChain: v.array(v.picklist(['tushare', 'eastmoney'])),
    sampleCount: v.number(),
    readyCount: v.number(),
    partialCount: v.number(),
    insufficientCount: v.number(),
    items: v.array(QuantShareholderReturnItemSchema),
  }),
})

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
