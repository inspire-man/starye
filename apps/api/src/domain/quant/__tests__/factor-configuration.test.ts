import { describe, expect, it } from 'vitest'
import { createQuantFactorConfiguration, defaultQuantFactorConfiguration, normalizeQuantFactorWeights } from '../factor-configuration'

const customWeights = {
  'trend': 0.4,
  'valuation': 0.1,
  'quality': 0.2,
  'shareholder-return': 0.1,
  'risk': 0.2,
}

describe('quant factor configuration', () => {
  it('returns the current default model without sharing mutable weight state', () => {
    const first = defaultQuantFactorConfiguration()
    const second = defaultQuantFactorConfiguration()

    expect(first).toMatchObject({
      version: 'research-factor-config-v1',
      source: 'default',
      updatedAt: null,
      weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 },
    })
    expect(first.weights).not.toBe(second.weights)
  })

  it('normalizes valid weights and preserves the user snapshot metadata', () => {
    expect(createQuantFactorConfiguration({
      weights: customWeights,
      source: 'user',
      updatedAt: new Date('2026-08-30T00:00:00.000Z'),
    })).toEqual({
      version: 'research-factor-config-v1',
      weights: customWeights,
      source: 'user',
      updatedAt: '2026-08-30T00:00:00.000Z',
    })
  })

  it.each([
    ['negative weight', { ...customWeights, trend: -0.01 }],
    ['weight above one', { ...customWeights, trend: 1.01 }],
    ['weight total below one', { ...customWeights, trend: 0.3 }],
    ['NaN weight', { ...customWeights, trend: Number.NaN }],
    ['infinite weight', { ...customWeights, trend: Number.POSITIVE_INFINITY }],
    ['unknown factor', { ...customWeights, extra: 0 }],
  ])('rejects %s before a configuration can be persisted', (_label, weights) => {
    expect(() => normalizeQuantFactorWeights(weights)).toThrowError(expect.objectContaining({ code: 'QUANT_FACTOR_CONFIGURATION' }))
  })
})
