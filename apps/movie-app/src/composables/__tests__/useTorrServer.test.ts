import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadComposable() {
  const module = await import('../useTorrServer')
  return module.useTorrServer()
}

describe('useTorrServer', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('系统默认地址保留控制请求，并经 Gateway 构建最终媒体流', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { defaultUrl: 'http://control.example:8090' } }),
    } as Response)
    const torrServer = await loadComposable()

    await torrServer.loadSystemDefault()
    const result = torrServer.buildStreamForFile('magnet:?xt=urn:btih:system-default', {
      id: 4,
      path: 'movie.mp4',
      length: 100,
    })

    expect(torrServer.config.value?.serverUrl).toBe('http://control.example:8090')
    expect(result.streamUrl).toContain('http://localhost:8080/torrserver/stream/video')
    expect(result.streamUrl).toContain('index=4')
  })

  it('显式保存的地址同时保留为控制和媒体 base', async () => {
    localStorage.setItem('torrserver-config', JSON.stringify({ serverUrl: 'https://direct.example:8090/' }))
    const torrServer = await loadComposable()

    const result = torrServer.buildStreamForFile('magnet:?xt=urn:btih:explicit', {
      id: 1,
      path: 'movie.mp4',
      length: 100,
    })

    expect(torrServer.config.value?.serverUrl).toBe('https://direct.example:8090/')
    expect(result.streamUrl).toContain('https://direct.example:8090/stream/video')
    expect(result.streamUrl).not.toContain('/torrserver/stream/video')
  })

  it('saveConfig 切换为显式地址并持续使用直连媒体流', async () => {
    const torrServer = await loadComposable()
    torrServer.saveConfig({ serverUrl: 'http://saved.example:8090' })

    const result = torrServer.buildStreamForFile('magnet:?xt=urn:btih:saved', {
      id: 0,
      path: 'movie.mp4',
      length: 100,
    })

    expect(localStorage.getItem('torrserver-config')).toContain('saved.example')
    expect(result.streamUrl).toContain('http://saved.example:8090/stream/video')
  })
})
