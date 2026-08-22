import { describe, expect, it, vi } from 'vitest'
import { probeChapterImage } from '../image-probe'
import { mergePageProbeStatuses } from '../page-repository'

describe('chapter image probe', () => {
  it('retains a previously available page when a targeted recheck is unknown', () => {
    const statuses = mergePageProbeStatuses(
      [
        { id: 'p1', imageUrl: 'https://cdn.example/1.webp', pageNumber: 1 },
        { id: 'p2', imageUrl: 'https://cdn.example/2.webp', pageNumber: 2 },
      ],
      new Map([
        ['page:1:https://cdn.example/1.webp', 'available'],
        ['page:2:https://cdn.example/2.webp', 'available'],
      ]),
      [{ pageIdentity: 'page:1:https://cdn.example/1.webp', status: 'unknown' }],
    )
    expect(statuses.get('page:1:https://cdn.example/1.webp')).toBe('available')
    expect(statuses.get('page:2:https://cdn.example/2.webp')).toBe('available')
  })

  it('accepts an image content type after a HEAD response', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'HEAD'
      ? new Response(null, { headers: { 'content-type': 'image/jpeg' }, status: 200 })
      : new Response(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]), { headers: { 'content-type': 'image/jpeg' }, status: 206 }))
    await expect(probeChapterImage('https://images.example/chapter/1.jpg?token=secret', { fetch })).resolves.toMatchObject({
      reason: 'available',
      status: 'available',
      urlIdentity: 'https://images.example/chapter/1.jpg',
    })
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://images.example/chapter/1.jpg?token=secret', expect.objectContaining({
      headers: { Range: 'bytes=0-63' },
      method: 'GET',
    }))
  })

  it('does not trust an image MIME type without a valid bounded body', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'HEAD'
      ? new Response(null, { headers: { 'content-type': 'image/jpeg' }, status: 200 })
      : new Response('<html>challenge</html>', { headers: { 'content-type': 'image/jpeg' }, status: 200 }))
    await expect(probeChapterImage('https://images.example/challenge.jpg', { fetch })).resolves.toMatchObject({
      reason: 'challenge_html',
      status: 'unavailable',
    })
  })

  it('does not treat HTML challenge content as an image', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'HEAD'
      ? new Response(null, { status: 405 })
      : new Response('<html><title>challenge</title></html>', { headers: { 'content-type': 'text/html' }, status: 200 }))
    await expect(probeChapterImage('https://images.example/challenge', { fetch })).resolves.toMatchObject({
      reason: 'challenge_html',
      status: 'unavailable',
    })
  })

  it('distinguishes redirects, HTTP failures and invalid content types', async () => {
    await expect(probeChapterImage('https://images.example/redirect', {
      fetch: async () => new Response(null, { status: 302, headers: { location: 'https://other.example/image' } }),
    })).resolves.toMatchObject({ reason: 'redirect', status: 'unavailable' })
    await expect(probeChapterImage('https://images.example/missing', {
      fetch: async () => new Response(null, { status: 404 }),
    })).resolves.toMatchObject({ reason: 'http_failure', status: 'unavailable' })
    await expect(probeChapterImage('https://images.example/page', {
      fetch: async () => new Response('ok', { headers: { 'content-type': 'application/json' }, status: 200 }),
    })).resolves.toMatchObject({ reason: 'content_type_invalid', status: 'unavailable' })
  })
})
