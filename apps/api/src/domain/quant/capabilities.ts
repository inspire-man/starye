import type { QuantProviderName } from './provider'
import type { QuantCapabilityName } from './types'
import { resolveQuantProviderName } from './provider'

export const QUANT_CAPABILITIES = ['daily', 'stock_basic', 'trade_cal', 'daily_basic'] as const satisfies readonly QuantCapabilityName[]

export interface QuantCapabilityStatus {
  readonly name: QuantCapabilityName
  readonly enabled: boolean
  readonly reason: 'enabled' | 'requires_points_tier_2000' | 'invalid_points_tier' | 'invalid_provider'
}

export interface QuantCapabilityRegistry {
  readonly tier: 120 | 2000 | null
  readonly provider: QuantProviderName | null
  readonly enabled: readonly QuantCapabilityName[]
  readonly capabilities: readonly QuantCapabilityStatus[]
  hasCapability: (name: QuantCapabilityName) => boolean
}

function parsePointsTier(value: unknown): 120 | 2000 | null {
  if (value === undefined || value === null || value === '')
    return 120

  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(numeric) || (numeric !== 120 && numeric !== 2000))
    return null

  return numeric
}

export function createQuantCapabilityRegistry(pointsTier: unknown = undefined, provider: QuantProviderName | null = 'tushare'): QuantCapabilityRegistry {
  const tier = parsePointsTier(pointsTier)
  const enabled: readonly QuantCapabilityName[] = provider === null
    ? []
    : tier === 120
      ? ['daily']
      : tier === 2000
        ? QUANT_CAPABILITIES
        : []

  const capabilities = QUANT_CAPABILITIES.map((name) => {
    const isEnabled = enabled.includes(name)
    return {
      name,
      enabled: isEnabled,
      reason: provider === null
        ? 'invalid_provider' as const
        : tier === null
          ? 'invalid_points_tier' as const
          : isEnabled
            ? 'enabled' as const
            : 'requires_points_tier_2000' as const,
    }
  })

  return {
    tier,
    provider,
    enabled,
    capabilities,
    hasCapability(name) {
      return enabled.includes(name)
    },
  }
}

export function createQuantCapabilityRegistryFromEnv(env: unknown): QuantCapabilityRegistry {
  const pointsTier = typeof env === 'object' && env !== null
    ? (env as { readonly TUSHARE_POINTS_TIER?: unknown }).TUSHARE_POINTS_TIER
    : undefined
  return createQuantCapabilityRegistry(pointsTier, resolveQuantProviderName(env))
}
