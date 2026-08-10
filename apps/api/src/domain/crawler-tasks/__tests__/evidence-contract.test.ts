import { describe, expect, it } from 'vitest'
import { redactAvailabilityEvidence, validateBoundedAvailabilityEvidence } from '../evidence-contract'

describe('bounded availability evidence', () => {
  it('keeps only finite safe counts and samples', () => {
    const result = redactAvailabilityEvidence({
      counts: { available: 2, transport_ok: 1 },
      samples: [{ code: 'source_ok', label: 'direct', count: 1 }],
    })
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.value).toEqual({ counts: { available: 2, transport_ok: 1 }, samples: [{ code: 'source_ok', label: 'direct', count: 1 }] })
  })

  it('rejects secrets, URLs, unknown fields, unbounded samples and long text', () => {
    expect(redactAvailabilityEvidence({ counts: {}, signedUrl: 'https://TARGET' }).ok).toBe(false)
    expect(redactAvailabilityEvidence({ counts: {}, samples: [{ code: 'x', value: 'raw response' }] }).ok).toBe(false)
    expect(redactAvailabilityEvidence({ counts: {}, samples: Array.from({ length: 21 }, () => ({ code: 'x' })) }).ok).toBe(false)
    expect(redactAvailabilityEvidence({ counts: { ['x'.repeat(65)]: 1 } }).ok).toBe(false)
    expect(() => validateBoundedAvailabilityEvidence({ counts: {}, rawResponse: 'provider payload' })).toThrow()
  })
})
