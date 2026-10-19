import { describe, expect, it } from 'vitest'
import { buildFactorRobustness } from '../factor-robustness'

function bars(closes: readonly number[]) {
  return closes.map((close, index) => ({
    tradeDate: `2026${String(index + 1).padStart(4, '0')}`,
    close,
  }))
}

describe('factor robustness', () => {
  it('does not treat a rising market as proof that the current factor is more accurate', () => {
    const result = buildFactorRobustness(bars(Array.from({ length: 220 }, (_, index) => index + 1)))
    expect(result.expectedDirection).toBe('up')
    expect(result.edge).not.toBe('supported')
    expect(result.detail).toContain('不是预测准确率')
  })

  it('keeps a short history from producing an accuracy rate', () => {
    const result = buildFactorRobustness(bars(Array.from({ length: 30 }, (_, index) => index + 1)))
    expect(result.agreementRate).toBeNull()
    expect(result.edge).toBe('insufficient')
  })

  it('does not score a split MA20 and 20-day direction', () => {
    const closes = Array.from({ length: 80 }, (_, index) => index < 60 ? 100 + index : 160 - (index - 60) * 4)
    const result = buildFactorRobustness(bars(closes))
    expect(result.expectedDirection === 'split' || result.edge === 'insufficient' || result.edge === 'indeterminate').toBe(true)
    if (result.expectedDirection === 'split')
      expect(result.agreementRate).toBeNull()
  })
})
