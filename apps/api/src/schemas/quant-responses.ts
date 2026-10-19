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

export const QuantPriceLocationsResponseSchema = v.object({
  success: v.literal(true),
  data: v.array(v.object({
    tsCode: v.string(),
    name: v.nullable(v.string()),
    latestClose: v.nullable(v.number()),
    latestTradeDate: v.nullable(v.string()),
    reportGeneratedAt: v.nullable(v.string()),
    recommendation: v.nullable(v.picklist(['bullish', 'bearish', 'watch'])),
    recommendationLabel: v.nullable(v.string()),
    rangeLow: v.nullable(v.number()),
    rangeHigh: v.nullable(v.number()),
    status: v.picklist(['inside', 'below', 'above', 'not-buying', 'missing-range', 'missing-price', 'missing-report']),
    label: v.string(),
    distancePercent: v.nullable(v.number()),
    detail: v.string(),
  })),
})

export const QuantAiReviewOutcomesResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    headline: v.string(),
    acceptedAgreementRate: v.nullable(v.number()),
    unacceptedAgreementRate: v.nullable(v.number()),
    acceptedDirectionalCount: v.number(),
    unacceptedDirectionalCount: v.number(),
    pendingCount: v.number(),
    items: v.array(v.object({
      tsCode: v.string(),
      name: v.nullable(v.string()),
      reviewedAt: v.string(),
      accepted: v.nullable(v.boolean()),
      recommendation: v.nullable(v.picklist(['bullish', 'bearish', 'watch'])),
      baselineClose: v.nullable(v.number()),
      baselineTradeDate: v.nullable(v.string()),
      observationClose: v.nullable(v.number()),
      observationTradeDate: v.nullable(v.string()),
      changePercent: v.nullable(v.number()),
      status: v.picklist(['aligned', 'opposed', 'flat', 'pending', 'unavailable', 'not-directional']),
      label: v.string(),
      detail: v.string(),
    })),
  }),
})

export const QuantInvalidationChecksResponseSchema = v.object({
  success: v.literal(true),
  data: v.array(v.object({
    tsCode: v.string(),
    name: v.nullable(v.string()),
    triggeredCount: v.number(),
    recoveredCount: v.number(),
    unchangedCount: v.number(),
    unavailableCount: v.number(),
    uncheckedCount: v.number(),
    label: v.string(),
    checks: v.array(v.object({
      key: v.string(),
      label: v.string(),
      savedStatus: v.picklist(['pass', 'caution', 'fail', 'missing']),
      currentStatus: v.picklist(['pass', 'caution', 'fail', 'missing']),
      change: v.picklist(['triggered', 'recovered', 'unchanged', 'unavailable']),
    })),
  })),
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

const QuantShareholderCashflowHistoryItemSchema = v.object({
  formulaVersion: v.string(),
  status: v.picklist(['ready', 'partial', 'insufficient_data', 'unavailable']),
  reportDate: v.string(),
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
  missingFields: v.array(v.string()),
})

const QuantShareholderCashflowHistorySummarySchema = v.object({
  formulaVersion: v.string(),
  status: v.picklist(['ready', 'partial', 'insufficient_data', 'unavailable']),
  periodCount: v.number(),
  coreReadyPeriodCount: v.number(),
  positiveFreeCashflowPeriods: v.number(),
  positiveFreeCashflowAfterInterestPeriods: v.number(),
  coveredDividendPeriods: v.number(),
  payoutRatioPeriodCount: v.number(),
  latestReportDate: v.nullable(v.string()),
  missingFields: v.array(v.string()),
})

const QuantShareholderCashflowEvidenceSchema = v.object({
  formulaVersion: v.string(),
  status: v.picklist(['ready', 'partial', 'insufficient_data', 'unavailable']),
  provider: v.nullable(v.picklist(['tushare', 'eastmoney', 'akshare'])),
  providerErrorCode: v.nullable(v.string()),
  fallbackUsed: v.optional(v.boolean()),
  fallbackReason: v.optional(v.nullable(v.string())),
  supplementalProvider: v.optional(v.picklist(['tushare', 'eastmoney', 'akshare'])),
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
  history: v.optional(v.array(QuantShareholderCashflowHistoryItemSchema)),
  historySummary: v.optional(QuantShareholderCashflowHistorySummarySchema),
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
  provider: v.nullable(v.picklist(['tushare', 'eastmoney', 'akshare'])),
  providerErrorCode: v.nullable(v.string()),
  fallbackUsed: v.boolean(),
  fallbackReason: v.nullable(v.string()),
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
  provider: v.nullable(v.picklist(['tushare', 'eastmoney', 'akshare'])),
  providerChain: v.array(v.picklist(['tushare', 'eastmoney', 'akshare'])),
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
    provider: v.nullable(v.picklist(['tushare', 'eastmoney', 'akshare'])),
    providerChain: v.array(v.picklist(['tushare', 'eastmoney', 'akshare'])),
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

const QuantScheduledResearchItemSchema = v.object({
  tsCode: v.string(),
  name: v.nullable(v.string()),
  reasons: v.array(v.picklist(['overdue', 'today', 'stale-daily', 'insufficient-data'])),
  stage: v.picklist(['watchlist', 'data', 'research', 'ai', 'completed', 'error', 'skipped']),
  aiStatus: v.picklist(['pending', 'running', 'success', 'skipped', 'error']),
  errorStage: v.nullable(v.picklist(['watchlist', 'data', 'research', 'ai'])),
  errorCode: v.nullable(v.string()),
  researchRunId: v.nullable(v.string()),
  reviewDateBefore: v.nullable(v.string()),
  reviewDateAfter: v.nullable(v.string()),
})

const QuantScheduledResearchRunSchema = v.object({
  id: v.string(),
  status: v.picklist(['running', 'completed', 'partial', 'failed']),
  dueCount: v.number(),
  processedCount: v.number(),
  completedCount: v.number(),
  failedCount: v.number(),
  skippedCount: v.number(),
  startedAt: v.string(),
  completedAt: v.nullable(v.string()),
  items: v.array(QuantScheduledResearchItemSchema),
})

export const QuantScheduledResearchResponseSchema = v.object({
  success: v.literal(true),
  data: v.nullable(QuantScheduledResearchRunSchema),
})

export const QuantScheduledResearchHistoryResponseSchema = v.object({
  success: v.literal(true),
  data: v.array(QuantScheduledResearchRunSchema),
})

export const QuantScheduledResearchRunTriggerResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    userId: v.nullable(v.string()),
    jobId: v.nullable(v.string()),
    processedCount: v.number(),
    skippedReason: v.nullable(v.picklist(['no-users', 'cooldown', 'leased', 'no-due'])),
  }),
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

const QuantOperationLedgerSchema = v.object({
  formulaVersion: v.string(),
  closed: v.array(v.object({
    tsCode: v.string(),
    name: v.nullable(v.string()),
    quantity: v.number(),
    buyPrice: v.number(),
    sellPrice: v.number(),
    pnl: v.number(),
    fee: v.number(),
    returnRate: v.number(),
    sameDay: v.boolean(),
    openedAt: v.string(),
    closedAt: v.string(),
  })),
  openLots: v.array(v.object({
    tsCode: v.string(),
    name: v.nullable(v.string()),
    quantity: v.number(),
    cost: v.number(),
  })),
  unmatchedSellQuantity: v.number(),
  closedCount: v.number(),
  winCount: v.number(),
  lossCount: v.number(),
  flatCount: v.number(),
  realizedPnl: v.number(),
  dividendCash: v.number(),
  winRate: v.nullable(v.number()),
  payoffRatio: v.nullable(v.number()),
  curve: v.array(v.object({ tradedAt: v.string(), cumulativePnl: v.number() })),
  byCode: v.array(v.object({
    tsCode: v.string(),
    name: v.nullable(v.string()),
    closedCount: v.number(),
    winCount: v.number(),
    lossCount: v.number(),
    flatCount: v.number(),
    realizedPnl: v.number(),
    winRate: v.nullable(v.number()),
    payoffRatio: v.nullable(v.number()),
    openQuantity: v.number(),
    dividendCash: v.number(),
  })),
  aiBrief: v.string(),
})

export const QuantOperationsResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    operations: v.array(v.object({
      id: v.string(),
      tsCode: v.string(),
      name: v.nullable(v.string()),
      side: v.picklist(['buy', 'sell', 'dividend', 'pass']),
      price: v.number(),
      quantity: v.number(),
      fee: v.number(),
      tradedAt: v.string(),
      note: v.nullable(v.string()),
      researchContext: v.nullable(v.object({
        recommendation: v.nullable(v.picklist(['bullish', 'bearish', 'watch'])),
        buyLow: v.nullable(v.number()),
        buyHigh: v.nullable(v.number()),
        sellLow: v.nullable(v.number()),
        sellHigh: v.nullable(v.number()),
        generatedAt: v.nullable(v.string()),
      })),
    })),
    ledger: QuantOperationLedgerSchema,
  }),
})

export const QuantOperationResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    id: v.string(),
    tsCode: v.string(),
    name: v.nullable(v.string()),
    side: v.picklist(['buy', 'sell', 'dividend', 'pass']),
    price: v.number(),
    quantity: v.number(),
    fee: v.number(),
    tradedAt: v.string(),
    note: v.nullable(v.string()),
    researchContext: v.nullable(v.object({
      recommendation: v.nullable(v.picklist(['bullish', 'bearish', 'watch'])),
      buyLow: v.nullable(v.number()),
      buyHigh: v.nullable(v.number()),
      sellLow: v.nullable(v.number()),
      sellHigh: v.nullable(v.number()),
      generatedAt: v.nullable(v.string()),
    })),
  }),
})

export const QuantOperationDeleteResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({ id: v.string() }),
})

export const QuantDailyBoardResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    formulaVersion: v.string(),
    today: v.string(),
    items: v.array(v.object({
      tsCode: v.string(),
      name: v.nullable(v.string()),
      action: v.picklist(['buy', 'sell', 'hold', 'blocked']),
      label: v.picklist(['买', '卖', '不动', '先补数据']),
      reason: v.string(),
      blocker: v.nullable(v.picklist(['report', 'price', 'range'])),
      priceFreshness: v.picklist(['session', 'prior-close', 'missing']),
      price: v.nullable(v.number()),
      priceDate: v.nullable(v.string()),
      priceSource: v.nullable(v.picklist(['eastmoney-realtime', 'local-daily-bars'])),
      recommendation: v.nullable(v.picklist(['bullish', 'bearish', 'watch'])),
      rangeLow: v.nullable(v.number()),
      rangeHigh: v.nullable(v.number()),
      openQuantity: v.number(),
      cost: v.nullable(v.number()),
    })),
    score: v.object({
      closedCount: v.number(),
      winCount: v.number(),
      lossCount: v.number(),
      flatCount: v.number(),
      winRate: v.nullable(v.number()),
      payoffRatio: v.nullable(v.number()),
      realizedPnl: v.number(),
      dividendCash: v.number(),
      passCount: v.number(),
      minimumSample: v.number(),
      swingClosedCount: v.number(),
      swingRealizedPnl: v.number(),
      swingPayoffRatio: v.nullable(v.number()),
      sameDayClosedCount: v.number(),
      sameDayRealizedPnl: v.number(),
    }),
  }),
})
export const QuantResearchSummaryStreamEventSchema = v.string()
