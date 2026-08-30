import type { QuantAiConfig } from './quant-types'

export function isQuantAiAutoReviewReady(config: QuantAiConfig | null | undefined): boolean {
  const model = config?.model.trim()
  if (!model)
    return false
  return config !== null && config !== undefined && (config.hasApiKey || config.provider === 'ollama')
}
