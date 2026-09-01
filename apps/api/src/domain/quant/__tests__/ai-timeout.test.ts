import { describe, expect, it } from 'vitest'
import {
  QUANT_AI_CONNECTION_TIMEOUT_DEFAULT_MS,
  QUANT_AI_CONNECTION_TIMEOUT_MAX_MS,
  QUANT_AI_GENERATION_TIMEOUT_DEFAULT_MS,
  QUANT_AI_GENERATION_TIMEOUT_MAX_MS,
  resolveQuantAiConnectionTimeout,
  resolveQuantAiGenerationTimeout,
} from '../ai-timeout'

describe('quant AI timeout budgets', () => {
  it('uses a five-minute default and caps generation at ten minutes', () => {
    expect(resolveQuantAiGenerationTimeout()).toBe(QUANT_AI_GENERATION_TIMEOUT_DEFAULT_MS)
    expect(resolveQuantAiGenerationTimeout(45_000)).toBe(45_000)
    expect(resolveQuantAiGenerationTimeout(900_000)).toBe(QUANT_AI_GENERATION_TIMEOUT_MAX_MS)
  })

  it('falls back to the default for invalid generation budgets', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(resolveQuantAiGenerationTimeout(value)).toBe(QUANT_AI_GENERATION_TIMEOUT_DEFAULT_MS)
  })

  it('keeps connection checks short even when a large value is supplied', () => {
    expect(resolveQuantAiConnectionTimeout()).toBe(QUANT_AI_CONNECTION_TIMEOUT_DEFAULT_MS)
    expect(resolveQuantAiConnectionTimeout(5_000)).toBe(5_000)
    expect(resolveQuantAiConnectionTimeout(600_000)).toBe(QUANT_AI_CONNECTION_TIMEOUT_MAX_MS)
  })
})
