import { describe, expect, it, vi } from 'vitest'
import { probeDirectVideo } from '../direct-probe'

const publicResolver = async () => ['203.0.113.10']

describe('direct video probe', () => {
  it('accepts bounded 206 media and validates Content-Range', async () => {
    const result = await probeDirectVideo({
      fetch: async () => new Response(new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112]), {
        headers: { 'content-range': 'bytes 0-7/100', 'content-type': 'video/mp4' },
        status: 206,
      }),
      resolve: publicResolver,
      url: 'https://media.example/video.mp4',
    })
    expect(result).toMatchObject({ reason: null, status: 'available' })
  })

  it('rejects private redirect hops and strips sensitive cross-origin headers', async () => {
    const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes('first.example'))
        return new Response(null, { headers: { location: 'https://second.example/video.m3u8' }, status: 302 })
      expect(new Headers(init?.headers).has('authorization')).toBe(false)
      return new Response('#EXTM3U', { headers: { 'content-type': 'application/vnd.apple.mpegurl' }, status: 200 })
    })
    await expect(probeDirectVideo({ fetch, headers: { authorization: 'Bearer secret' }, resolve: async host => host === 'first.example' ? ['203.0.113.10'] : ['127.0.0.1'], url: 'https://first.example/video' })).rejects.toThrow('direct_url_private_address')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('strips sensitive headers before following a public cross-origin redirect', async () => {
    const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes('first.example'))
        return new Response(null, { headers: { location: 'https://second.example/video.m3u8' }, status: 302 })
      const headers = new Headers(init?.headers)
      expect(headers.get('range')).toBe('bytes=0-65535')
      expect(headers.has('authorization')).toBe(false)
      expect(headers.has('cookie')).toBe(false)
      return new Response('#EXTM3U', { headers: { 'content-type': 'application/vnd.apple.mpegurl' }, status: 200 })
    })
    const result = await probeDirectVideo({
      fetch,
      headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
      resolve: publicResolver,
      url: 'https://first.example/video',
    })
    expect(result).toMatchObject({ redirects: 1, status: 'available' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('caps ignored Range responses and escalates challenge evidence', async () => {
    const browser = vi.fn(async () => ({ mediaLoaded: false as const, reason: 'challenge' as const }))
    const result = await probeDirectVideo({
      browser,
      fetch: async () => new Response('<html>challenge</html>', { headers: { 'content-type': 'text/html' }, status: 200 }),
      resolve: publicResolver,
      url: 'https://media.example/video',
    })
    expect(result).toMatchObject({ reason: 'direct_blocked', status: 'degraded' })
    expect(browser).toHaveBeenCalledOnce()
  })

  it('caps ignored Range bodies and rejects invalid partial responses', async () => {
    const oversized = new Uint8Array(70 * 1024)
    oversized.set([0, 0, 0, 20, 102, 116, 121, 112])
    const capped = await probeDirectVideo({
      fetch: async () => new Response(oversized, { headers: { 'content-type': 'video/mp4' }, status: 200 }),
      resolve: publicResolver,
      url: 'https://media.example/video.mp4',
    })
    expect(capped).toMatchObject({ bytesRead: 64 * 1024, status: 'available' })

    const invalidRange = await probeDirectVideo({
      fetch: async () => new Response(oversized.slice(0, 8), {
        headers: { 'content-range': 'bytes 8-15/100', 'content-type': 'video/mp4' },
        status: 206,
      }),
      resolve: publicResolver,
      url: 'https://media.example/video.mp4',
    })
    expect(invalidRange).toMatchObject({ reason: 'browser_inconclusive', status: 'unknown' })

    const unsatisfiable = await probeDirectVideo({
      fetch: async () => new Response(null, { headers: { 'content-range': 'bytes */0' }, status: 416 }),
      resolve: publicResolver,
      url: 'https://media.example/video.mp4',
    })
    expect(unsatisfiable).toMatchObject({ reason: 'direct_content_invalid', status: 'degraded' })
  })

  it('upgrades challenge evidence only after the browser loads media', async () => {
    const result = await probeDirectVideo({
      browser: async () => ({ mediaLoaded: true, reason: 'valid_media' }),
      fetch: async () => new Response('<html>challenge</html>', { headers: { 'content-type': 'text/html' }, status: 200 }),
      resolve: publicResolver,
      url: 'https://media.example/video',
    })
    expect(result).toMatchObject({ reason: null, status: 'available' })
  })

  it('keeps DNS and timeout failures uncertain', async () => {
    const result = await probeDirectVideo({
      fetch: async () => { throw new Error('timeout') },
      resolve: publicResolver,
      url: 'https://media.example/video',
    })
    expect(result).toMatchObject({ reason: 'direct_transport_failed', status: 'unknown' })
  })
})
