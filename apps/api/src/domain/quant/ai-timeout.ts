export const QUANT_AI_GENERATION_TIMEOUT_DEFAULT_MS = 300_000
export const QUANT_AI_GENERATION_TIMEOUT_MAX_MS = 600_000
export const QUANT_AI_CONNECTION_TIMEOUT_DEFAULT_MS = 10_000
export const QUANT_AI_CONNECTION_TIMEOUT_MAX_MS = 30_000

function resolveTimeout(value: number | undefined, fallback: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(value, maximum)
    : fallback
}

export function resolveQuantAiGenerationTimeout(value?: number): number {
  return resolveTimeout(value, QUANT_AI_GENERATION_TIMEOUT_DEFAULT_MS, QUANT_AI_GENERATION_TIMEOUT_MAX_MS)
}

export function resolveQuantAiConnectionTimeout(value?: number): number {
  return resolveTimeout(value, QUANT_AI_CONNECTION_TIMEOUT_DEFAULT_MS, QUANT_AI_CONNECTION_TIMEOUT_MAX_MS)
}
