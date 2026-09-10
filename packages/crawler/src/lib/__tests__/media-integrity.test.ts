import { describe, expect, it } from 'vitest'
import { classifyFetchedImage, retainManagedMediaList, retainManagedMediaUrl, sanitizeMediaFailureReasons } from '../media-integrity'

describe('media-integrity helpers', () => {
  it('classifies fetch, content-type, decode and empty metadata failures', () => {
    expect(classifyFetchedImage({ hasBuffer: false, statusCode: 503 })).toBe('http_probe_failed')
    expect(classifyFetchedImage({ hasBuffer: false })).toBe('source_unavailable')
    expect(classifyFetchedImage({ hasBuffer: true, contentType: 'text/html', metadata: { format: 'jpeg', width: 1, height: 1 } })).toBe('non_image')
    expect(classifyFetchedImage({ hasBuffer: true, contentType: 'image/jpeg', decodeError: true })).toBe('image_decode_failed')
    expect(classifyFetchedImage({ hasBuffer: true, contentType: 'image/jpeg', metadata: { format: undefined, width: 0, height: 0 } })).toBe('non_image')
    expect(classifyFetchedImage({ hasBuffer: true, contentType: 'image/jpeg', metadata: { format: 'jpeg', width: 100, height: 80 } })).toBe('ok')
  })

  it('retains managed media when the latest fetch is empty or untrusted', () => {
    const isManaged = (url: string) => url.startsWith('https://cdn.example/')
    expect(retainManagedMediaUrl('https://cdn.example/cover.webp', null, isManaged)).toBe('https://cdn.example/cover.webp')
    expect(retainManagedMediaUrl('https://src.example/cover.jpg', null, isManaged)).toBeNull()
    expect(retainManagedMediaList(
      ['https://cdn.example/a.webp', 'https://src.example/b.jpg'],
      [null, null],
      isManaged,
    )).toEqual(['https://cdn.example/a.webp'])
  })

  it('keeps only known media failure reasons', () => {
    expect(sanitizeMediaFailureReasons(['image_decode_failed', 'nope', 'image_decode_failed'])).toEqual(['image_decode_failed'])
    expect(sanitizeMediaFailureReasons([])).toBeUndefined()
  })
})
