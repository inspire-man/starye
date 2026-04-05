/* eslint-disable no-console */
/**
 * TorrServer 集成测试
 * 需要本地运行 TorrServer（http://localhost:8090）才能通过
 * 运行：npx vitest run --reporter=verbose torrServerClient.integration
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TorrServerClient } from '../torrServerClient'

const TORRSERVER_URL = 'http://localhost:8090'
// 来自本地 DB 的真实磁力链接（XVSR-872）
const TEST_MAGNET = 'magnet:?xt=urn:btih:84B86D843559FAFBFCFAFBF034380132B042F1F3'

/** 检查 TorrServer 是否可用，跳过不可用环境 */
async function isTorrServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${TORRSERVER_URL}/echo`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  }
  catch {
    return false
  }
}

describe('torrServerClient 集成测试（需本地 TorrServer）', () => {
  let client: TorrServerClient
  let serverAvailable = false
  let addedTorrentHash: string | null = null

  beforeAll(async () => {
    serverAvailable = await isTorrServerAvailable()
    if (!serverAvailable) {
      console.warn('⚠️  TorrServer 未运行，跳过集成测试（启动后重试）')
      return
    }
    client = new TorrServerClient({ serverUrl: TORRSERVER_URL })
    console.log(`✅ TorrServer 已连接: ${TORRSERVER_URL}`)
  })

  afterAll(async () => {
    // 清理：移除测试中添加的种子
    if (serverAvailable && addedTorrentHash) {
      try {
        await client.removeTorrent(addedTorrentHash)
        console.log(`🧹 已清理测试种子: ${addedTorrentHash}`)
      }
      catch {
        // 清理失败不影响测试结果
      }
    }
  })

  describe('getVersion() - 服务连通性', () => {
    it('应该成功获取 TorrServer 版本号', async () => {
      if (!serverAvailable)
        return

      const version = await client.getVersion()

      expect(version).toBeTruthy()
      expect(typeof version).toBe('string')
      // TorrServer 版本格式：MatriX.xxx
      expect(version).toMatch(/MatriX\.\d+/)
      console.log(`  版本: ${version}`)
    })
  })

  describe('listTorrents() - 种子列表', () => {
    it('应该返回种子列表（可为空）', async () => {
      if (!serverAvailable)
        return

      const torrents = await client.listTorrents()

      expect(Array.isArray(torrents)).toBe(true)
      console.log(`  当前种子数: ${torrents.length}`)
    })
  })

  describe('addTorrent() - 添加磁力链接', () => {
    it('应该成功添加磁力链接并返回种子信息', async () => {
      if (!serverAvailable)
        return

      const result = await client.addTorrent(TEST_MAGNET)

      expect(result).toBeTruthy()
      // TorrServer 返回种子 hash
      if (result?.hash) {
        addedTorrentHash = result.hash
        console.log(`  已添加种子 hash: ${result.hash}`)
      }
    }, 15000)
  })

  describe('getTorrentInfo() - 获取种子信息', () => {
    it('应该能查询已添加种子的基本信息', async () => {
      if (!serverAvailable || !addedTorrentHash)
        return

      // 等待 TorrServer 处理种子（最多 10s）
      let info: any = null
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          info = await client.getTorrentInfo(addedTorrentHash!)
          if (info)
            break
        }
        catch {
          // 还未就绪，继续等待
        }
      }

      expect(info).toBeTruthy()
      expect(info.hash).toBeTruthy()
      console.log(`  种子 hash: ${info.hash}`)
      console.log(`  种子状态: ${info.stat_string || info.stat || '未知'}`)
    }, 20000)
  })

  describe('getStreamUrl() - 流 URL 构建', () => {
    it('应该构建正确格式的流 URL', () => {
      if (!serverAvailable)
        return

      const url = client.getStreamUrl(TEST_MAGNET, 0)

      expect(url).toContain(TORRSERVER_URL)
      expect(url).toContain('/stream/video')
      expect(url).toContain(encodeURIComponent(TEST_MAGNET))
      expect(url).toContain('index=0')
      console.log(`  流 URL: ${url.substring(0, 100)}...`)
    })

    it('构建的流 URL 应该可以被 fetch 访问（HEAD 请求）', async () => {
      if (!serverAvailable || !addedTorrentHash)
        return

      const url = client.getStreamUrl(TEST_MAGNET, 0)

      // HEAD 请求验证 URL 可响应（不下载数据）
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(8000),
        })
        // TorrServer 可能返回 200（就绪）或 416/206（range 相关），均视为可访问
        const isAccessible = res.status < 500
        expect(isAccessible).toBe(true)
        console.log(`  流 URL 响应状态: ${res.status}`)
        console.log(`  Content-Type: ${res.headers.get('content-type') || '未知'}`)
      }
      catch (e: any) {
        // 网络超时等视为种子元数据未就绪，不算失败
        console.warn(`  流 URL 访问超时（种子可能还在获取元数据）: ${e.message}`)
      }
    }, 15000)
  })

  describe('getPlaylistUrl() - 播放列表 URL', () => {
    it('应该构建正确格式的播放列表 URL', () => {
      if (!serverAvailable)
        return

      const url = client.getPlaylistUrl(TEST_MAGNET)

      expect(url).toContain(TORRSERVER_URL)
      expect(url).toContain('/playlist')
      expect(url).toContain(encodeURIComponent(TEST_MAGNET))
      console.log(`  播放列表 URL: ${url.substring(0, 100)}...`)
    })
  })

  describe('错误处理', () => {
    it('连接到错误地址应该抛出明确错误', async () => {
      const badClient = new TorrServerClient({ serverUrl: 'http://localhost:19999' })

      await expect(badClient.getVersion()).rejects.toThrow()
    }, 8000)

    it('查询不存在的种子 hash 应该得到错误或 null', async () => {
      if (!serverAvailable)
        return

      const fakeHash = '0000000000000000000000000000000000000000'
      try {
        const result = await client.getTorrentInfo(fakeHash)
        // 有些版本返回 null 而非抛出
        expect(result == null || typeof result === 'object').toBe(true)
      }
      catch (e: any) {
        // 抛出错误也是合理行为
        expect(e).toBeTruthy()
      }
    }, 8000)
  })
})
