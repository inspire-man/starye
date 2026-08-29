import { QuantError } from './errors'

export const QUANT_FACTOR_CONFIGURATION_VERSION = 'research-factor-config-v1' as const

export const QUANT_FACTOR_KEYS = ['trend', 'valuation', 'quality', 'shareholder-return', 'risk'] as const
export type QuantFactorConfigurationKey = typeof QUANT_FACTOR_KEYS[number]
export type QuantFactorConfigurationSource = 'default' | 'user'

export interface QuantFactorWeights {
  readonly 'trend': number
  readonly 'valuation': number
  readonly 'quality': number
  readonly 'shareholder-return': number
  readonly 'risk': number
}

export interface QuantFactorConfiguration {
  readonly version: typeof QUANT_FACTOR_CONFIGURATION_VERSION
  readonly weights: QuantFactorWeights
  readonly source: QuantFactorConfigurationSource
  readonly updatedAt: string | null
}

export const DEFAULT_QUANT_FACTOR_WEIGHTS: QuantFactorWeights = {
  'trend': 0.25,
  'valuation': 0.2,
  'quality': 0.2,
  'shareholder-return': 0.15,
  'risk': 0.2,
}

export const DEFAULT_QUANT_FACTOR_CONFIGURATION: QuantFactorConfiguration = {
  version: QUANT_FACTOR_CONFIGURATION_VERSION,
  weights: DEFAULT_QUANT_FACTOR_WEIGHTS,
  source: 'default',
  updatedAt: null,
}

function roundWeight(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

export function normalizeQuantFactorWeights(input: Record<QuantFactorConfigurationKey, number>): QuantFactorWeights {
  const inputKeys = Object.keys(input)
  if (inputKeys.some(key => !(QUANT_FACTOR_KEYS as readonly string[]).includes(key)))
    throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Factor configuration contains an unknown factor', 400)
  const weights = Object.fromEntries(QUANT_FACTOR_KEYS.map((key) => {
    const value = input[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
      throw new QuantError('QUANT_FACTOR_CONFIGURATION', `Factor weight for ${key} must be a finite number between 0 and 1`, 400)
    return [key, roundWeight(value)]
  })) as unknown as QuantFactorWeights
  const total = QUANT_FACTOR_KEYS.reduce((sum, key) => sum + weights[key], 0)
  if (Math.abs(total - 1) > 0.0001)
    throw new QuantError('QUANT_FACTOR_CONFIGURATION', 'Factor weights must sum to 1', 400, { total })
  return weights
}

export function createQuantFactorConfiguration(input: {
  readonly weights: Record<QuantFactorConfigurationKey, number>
  readonly source: QuantFactorConfigurationSource
  readonly updatedAt?: Date | string | null
}): QuantFactorConfiguration {
  const updatedAt = input.updatedAt instanceof Date ? input.updatedAt.toISOString() : input.updatedAt ?? null
  return {
    version: QUANT_FACTOR_CONFIGURATION_VERSION,
    weights: normalizeQuantFactorWeights(input.weights),
    source: input.source,
    updatedAt,
  }
}

export function defaultQuantFactorConfiguration(): QuantFactorConfiguration {
  return {
    ...DEFAULT_QUANT_FACTOR_CONFIGURATION,
    weights: { ...DEFAULT_QUANT_FACTOR_WEIGHTS },
  }
}
