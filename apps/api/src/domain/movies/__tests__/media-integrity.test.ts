import { describe, expect, it } from 'vitest'
import { countReceiptFailureReasons, mediaIntegrityKind, normalizeBackfillReceipt, sanitizeMediaFailureReasons } from '../media-integrity'

describe('movie media integrity aggregation', () => {
  it('classifies stored URLs without collapsing missing and external states', () => {
    expect(mediaIntegrityKind(null, 'https://cdn.example')).toBe('missing_value')
    expect(mediaIntegrityKind('https://img.example/a.jpg', 'https://cdn.example')).toBe('external_url')
    expect(mediaIntegrityKind('https://cdn.example/a.webp', 'https://cdn.example')).toBe('managed')
  })

  it('reads backfill receipt counts and known failure reasons from D1 JSON', () => {
    const summary = normalizeBackfillReceipt({
      createdCount: 2,
      mediaFailureReasons: ['image_decode_failed', 'http_probe_failed', 'raw-error'],
      source: 'movie',
    }, null)
    expect(summary).toMatchObject({
      succeeded: 2,
      sources: ['movie'],
      failureReasons: ['image_decode_failed', 'http_probe_failed'],
    })
    expect(countReceiptFailureReasons([summary], 'image_decode_failed')).toBe(1)
    expect(sanitizeMediaFailureReasons(['upload_failed'])).toEqual(['upload_failed'])
  })
})
