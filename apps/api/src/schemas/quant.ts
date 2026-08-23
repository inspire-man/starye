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

export type QuantWatchlistCreate = v.InferOutput<typeof QuantWatchlistCreateSchema>
export type QuantWatchlistUpdate = v.InferOutput<typeof QuantWatchlistUpdateSchema>
export type QuantDailyQuery = v.InferOutput<typeof QuantDailyQuerySchema>
export type QuantSyncInput = v.InferOutput<typeof QuantSyncSchema>

