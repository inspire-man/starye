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

  it('keeps DNS and timeout failures uncertain', async () => {
    const result = await probeDirectVideo({
      fetch: async () => { throw new Error('timeout') },
      resolve: publicResolver,
      url: 'https://media.example/video',
    })
    expect(result).toMatchObject({ reason: 'direct_transport_failed', status: 'unknown' })
  })
})
