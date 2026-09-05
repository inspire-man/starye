import { describe, expect, it } from 'vitest'
import { quantEvidenceLabelForKey, quantEvidenceRefreshActionLabelForKey, quantEvidenceRefreshTargetForKey } from '../quant-evidence-refresh'

describe('quant evidence refresh mapping', () => {
  it('maps report evidence to the existing source loaders', () => {
    expect(quantEvidenceRefreshTargetForKey('trend-ma20')).toEqual({ domain: 'daily', label: '日线' })
    expect(quantEvidenceRefreshTargetForKey('valuation-pe')).toEqual({ domain: 'valuation', label: '估值' })
    expect(quantEvidenceRefreshTargetForKey('quality-cashflow')).toEqual({ domain: 'financial', label: '基本面' })
    expect(quantEvidenceRefreshTargetForKey('shareholder-payout-ratio')).toEqual({ domain: 'shareholder-returns', label: '股东回报' })
  })

  it('keeps bridge-only evidence without a local refresh action', () => {
    expect(quantEvidenceRefreshTargetForKey('akshare-bridge')).toBeNull()
    expect(quantEvidenceRefreshActionLabelForKey('akshare-bridge')).toBeNull()
    expect(quantEvidenceLabelForKey('quality-cashflow')).toBe('经营现金流 / 营收')
  })
})
