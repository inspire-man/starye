import { describe, expect, it, vi } from 'vitest'
import {
  fetchDefaultTorrServerUrl,
  getTrustedTorrServerOrigins,
  isTrustedTorrServerStreamUrl,
  readStoredTorrServerUrl,
  resolveTrustedTorrServerOrigins,
  UNTRUSTED_STREAM_URL_MESSAGE,
} from '../playerSecurity'

describe('playerSecurity', () => {
  describe('getTrustedTorrServerOrigins', () => {
    it('只保留合法 http/https origin，并去重', () => {
      const origins = getTrustedTorrServerOrigins(
        'http://127.0.0.1:8090/stream/video?x=1',
        'http://127.0.0.1:8090',
        'https://torr.example.com/base',
        'javascript:alert(1)',
        null,
      )

      expect(origins).toEqual([
        'http://127.0.0.1:8090',
        'https://torr.example.com',
      ])
    })
  })

  describe('isTrustedTorrServerStreamUrl', () => {
    const trustedOrigins = ['http://127.0.0.1:8090']

    it('接受可信 origin 下的 /stream/video 链接', () => {
      expect(
        isTrustedTorrServerStreamUrl(
          'http://127.0.0.1:8090/stream/video?link=magnet%3A%3Fxt%3Durn%3Abtih%3A123&index=0&play=',
          trustedOrigins,
        ),
      ).toBe(true)
    })

    it('拒绝非可信 origin', () => {
      expect(
        isTrustedTorrServerStreamUrl(
          'http://evil.example.com/stream/video?link=magnet%3Aabc&index=0',
          trustedOrigins,
        ),
      ).toBe(false)
    })

    it('拒绝非 /stream/video 路径或缺少必要参数', () => {
      expect(
        isTrustedTorrServerStreamUrl(
          'http://127.0.0.1:8090/playlist?link=magnet%3Aabc',
          trustedOrigins,
        ),
      ).toBe(false)

      expect(
        isTrustedTorrServerStreamUrl(
          'http://127.0.0.1:8090/stream/video?index=0',
          trustedOrigins,
        ),
      ).toBe(false)
    })
  })

  describe('readStoredTorrServerUrl', () => {
    it('从 localStorage 配置中读取 serverUrl', () => {
      const storage = {
        getItem: vi.fn().mockReturnValue(JSON.stringify({ serverUrl: 'http://localhost:8090' })),
      }

      expect(readStoredTorrServerUrl(storage)).toBe('http://localhost:8090')
    })

    it('解析失败时返回 null', () => {
      const storage = {
        getItem: vi.fn().mockReturnValue('{'),
      }

      expect(readStoredTorrServerUrl(storage)).toBeNull()
    })
  })

  describe('fetchDefaultTorrServerUrl', () => {
    it('成功时返回默认地址', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { defaultUrl: 'http://localhost:8090' } }),
      })

      await expect(fetchDefaultTorrServerUrl(fetchMock as any)).resolves.toBe('http://localhost:8090')
    })

    it('失败时返回 null', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })

      await expect(fetchDefaultTorrServerUrl(fetchMock as any)).resolves.toBeNull()
    })
  })

  describe('resolveTrustedTorrServerOrigins', () => {
    it('合并本地配置与系统默认地址', async () => {
      const storage = {
        getItem: vi.fn().mockReturnValue(JSON.stringify({ serverUrl: 'http://127.0.0.1:8090' })),
      }
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { defaultUrl: 'https://torr.example.com' } }),
      })

      await expect(
        resolveTrustedTorrServerOrigins({
          storage,
          fetchImpl: fetchMock as any,
        }),
      ).resolves.toEqual(['http://127.0.0.1:8090', 'https://torr.example.com'])
    })
  })

  describe('uNTRUSTED_STREAM_URL_MESSAGE', () => {
    it('暴露统一错误文案供播放器使用', () => {
      expect(UNTRUSTED_STREAM_URL_MESSAGE).toContain('不受信任')
    })
  })
})
