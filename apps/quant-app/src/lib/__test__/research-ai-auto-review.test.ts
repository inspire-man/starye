import type { QuantAiConfig } from '../quant-view-models'
import { describe, expect, it } from 'vitest'
import { isQuantAiAutoReviewReady } from '../research-ai-auto-review'

function config(overrides: Partial<QuantAiConfig> = {}): QuantAiConfig {
  return {
    id: 'ai-config-1',
    provider: 'openai_compatible',
    model: 'gpt-5.4',
    baseUrl: 'https://api.example.com/v1',
    responseMode: 'stream',
    generationTimeoutMs: 300000,
    hasApiKey: true,
    apiKeyHint: '1234',
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  }
}

describe('isQuantAiAutoReviewReady', () => {
  it('requires a configured model and credential', () => {
    expect(isQuantAiAutoReviewReady(null)).toBe(false)
    expect(isQuantAiAutoReviewReady(config({ model: '  ' }))).toBe(false)
    expect(isQuantAiAutoReviewReady(config({ hasApiKey: false }))).toBe(false)
    expect(isQuantAiAutoReviewReady(config())).toBe(true)
  })

  it('allows Ollama without an API key', () => {
    expect(isQuantAiAutoReviewReady(config({ provider: 'ollama', hasApiKey: false }))).toBe(true)
  })
})
