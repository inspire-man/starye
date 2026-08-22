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
