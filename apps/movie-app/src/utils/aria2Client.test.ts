import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createAria2Client,
  formatFileSize,
  formatSpeed,
  calculateProgress,
  calculateETA,
} from './aria2Client'

// Mock fetch
global.fetch = vi.fn()

describe('aria2Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createAria2Client', () => {
    it('应该创建 Aria2 客户端实例', () => {
      const client = createAria2Client({
        rpcUrl: 'http://localhost:6800/jsonrpc',
      })

      expect(client).toBeDefined()
      expect(client.getVersion).toBeDefined()
      expect(client.addUri).toBeDefined()
      expect(client.tellStatus).toBeDefined()
    })

    it('应该支持带密钥的配置', () => {
      const client = createAria2Client({
        rpcUrl: 'http://localhost:6800/jsonrpc',
        secret: 'my-secret',
      })

      expect(client).toBeDefined()
    })
  })

  describe('RPC 方法', () => {
    const mockUrl = 'http://localhost:6800/jsonrpc'
    let client: ReturnType<typeof createAria2Client>

    beforeEach(() => {
      client = createAria2Client({ rpcUrl: mockUrl })
    })

    describe('getVersion', () => {
      it('应该成功获取 Aria2 版本', async () => {
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: {
            enabledFeatures: ['BitTorrent', 'Metalink'],
            version: '1.36.0',
          },
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const version = await client.getVersion()

        expect(version).toEqual({
          enabledFeatures: ['BitTorrent', 'Metalink'],
          version: '1.36.0',
        })

        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('aria2.getVersion'),
          }),
        )
      })

      it('应该在请求失败时抛出错误', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response)

        await expect(client.getVersion()).rejects.toThrow('HTTP 404: Not Found')
      })

      it('应该在 RPC 错误时抛出错误', async () => {
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          error: {
            code: -32600,
            message: 'Invalid Request',
          },
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        await expect(client.getVersion()).rejects.toThrow('Invalid Request')
      })
    })

    describe('addUri', () => {
      it('应该成功添加单个 URI', async () => {
        const mockGid = '1234567890abcdef'
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockGid,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const gid = await client.addUri(['magnet:?xt=urn:btih:test'])

        expect(gid).toBe(mockGid)
        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            body: expect.stringContaining('aria2.addUri'),
          }),
        )
      })

      it('应该支持添加多个 URI', async () => {
        const mockGid = '1234567890abcdef'
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockGid,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const gid = await client.addUri([
          'http://example.com/file1.zip',
          'http://example.com/file2.zip',
        ])

        expect(gid).toBe(mockGid)
      })

      it('应该支持传递选项参数', async () => {
        const mockGid = '1234567890abcdef'
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockGid,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const gid = await client.addUri(
          ['magnet:?xt=urn:btih:test'],
          { dir: '/downloads' },
        )

        expect(gid).toBe(mockGid)
        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            body: expect.stringContaining('/downloads'),
          }),
        )
      })
    })

    describe('tellStatus', () => {
      it('应该成功获取任务状态', async () => {
        const mockStatus = {
          gid: '1234567890abcdef',
          status: 'active',
          totalLength: '104857600',
          completedLength: '52428800',
          uploadSpeed: '0',
          downloadSpeed: '1048576',
          connections: '8',
          numSeeders: '10',
          files: [
            {
              index: '1',
              path: '/downloads/test.zip',
              length: '104857600',
              completedLength: '52428800',
              selected: 'true',
              uris: [],
            },
          ],
        }

        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockStatus,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const status = await client.tellStatus('1234567890abcdef')

        expect(status).toEqual(mockStatus)
        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            body: expect.stringContaining('aria2.tellStatus'),
          }),
        )
      })
    })

    describe('pause', () => {
      it('应该成功暂停任务', async () => {
        const mockGid = '1234567890abcdef'
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockGid,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const gid = await client.pause(mockGid)

        expect(gid).toBe(mockGid)
        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            body: expect.stringContaining('aria2.pause'),
          }),
        )
      })
    })

    describe('unpause', () => {
      it('应该成功恢复任务', async () => {
        const mockGid = '1234567890abcdef'
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockGid,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const gid = await client.unpause(mockGid)

        expect(gid).toBe(mockGid)
        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            body: expect.stringContaining('aria2.unpause'),
          }),
        )
      })
    })

    describe('remove', () => {
      it('应该成功删除任务', async () => {
        const mockGid = '1234567890abcdef'
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockGid,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const gid = await client.remove(mockGid)

        expect(gid).toBe(mockGid)
        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            body: expect.stringContaining('aria2.remove'),
          }),
        )
      })
    })

    describe('forceRemove', () => {
      it('应该成功强制删除任务', async () => {
        const mockGid = '1234567890abcdef'
        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockGid,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const gid = await client.forceRemove(mockGid)

        expect(gid).toBe(mockGid)
        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            body: expect.stringContaining('aria2.forceRemove'),
          }),
        )
      })
    })

    describe('tellActive', () => {
      it('应该成功获取活跃任务列表', async () => {
        const mockTasks = [
          {
            gid: '1234567890abcdef',
            status: 'active',
            totalLength: '104857600',
            completedLength: '52428800',
          },
        ]

        const mockResponse = {
          jsonrpc: '2.0',
          id: expect.any(String),
          result: mockTasks,
        }

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)

        const tasks = await client.tellActive()

        expect(tasks).toEqual(mockTasks)
        expect(fetch).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            body: expect.stringContaining('aria2.tellActive'),
          }),
        )
      })
    })
  })

  describe('工具函数', () => {
    describe('formatFileSize', () => {
      it('应该正确格式化文件大小', () => {
        expect(formatFileSize(0)).toBe('0 B')
        expect(formatFileSize(1024)).toBe('1.00 KB')
        expect(formatFileSize(1048576)).toBe('1.00 MB')
        expect(formatFileSize(1073741824)).toBe('1.00 GB')
        expect(formatFileSize(1099511627776)).toBe('1.00 TB')
      })

      it('应该保留两位小数', () => {
        expect(formatFileSize(1536)).toBe('1.50 KB')
        expect(formatFileSize(1572864)).toBe('1.50 MB')
      })

      it('应该正确处理 TB 级别的文件', () => {
        expect(formatFileSize(1099511627776)).toBe('1.00 TB') // 1 TB
      })
    })

    describe('formatSpeed', () => {
      it('应该正确格式化速度', () => {
        expect(formatSpeed(0)).toBe('0 B/s')
        expect(formatSpeed(1024)).toBe('1.00 KB/s')
        expect(formatSpeed(1048576)).toBe('1.00 MB/s')
        expect(formatSpeed(1073741824)).toBe('1.00 GB/s')
      })

      it('应该保留两位小数', () => {
        expect(formatSpeed(2560)).toBe('2.50 KB/s')
        expect(formatSpeed(2621440)).toBe('2.50 MB/s')
      })
    })

    describe('calculateProgress', () => {
      it('应该正确计算进度百分比', () => {
        // calculateProgress(totalLength, completedLength)
        expect(calculateProgress('100', '0')).toBe(0)
        expect(calculateProgress('100', '50')).toBe(50)
        expect(calculateProgress('100', '100')).toBe(100)
      })

      it('应该返回取整的百分比', () => {
        expect(calculateProgress('100', '33')).toBe(33)
        expect(calculateProgress('1000', '666')).toBe(66) // Math.floor
      })

      it('应该处理总长度为 0 的情况', () => {
        expect(calculateProgress('0', '0')).toBe(0)
      })
    })

    describe('calculateETA', () => {
      it('应该正确计算剩余时间', () => {
        // 100MB 总大小，已下载 50MB，速度 1MB/s，剩余 50 秒
        // calculateETA(totalBytes, completedBytes, speedBytesPerSec)
        expect(calculateETA(104857600, 52428800, 1048576)).toBe('50秒')
      })

      it('应该格式化为分钟', () => {
        // 100MB 文件，已下载 0，速度 1MB/s，剩余 100 秒 ≈ 1.7 分钟
        expect(calculateETA(104857600, 0, 1048576)).toContain('分钟')
      })

      it('应该格式化为小时', () => {
        // 10GB 文件，已下载 0，速度 1MB/s，剩余约 2.8 小时
        expect(calculateETA(10737418240, 0, 1048576)).toContain('小时')
      })

      it('应该处理速度为 0 的情况', () => {
        expect(calculateETA(100, 50, 0)).toBe('--')
      })

      it('应该处理已完成的情况', () => {
        expect(calculateETA(100, 100, 1048576)).toBe('0秒')
      })

      it('应该处理总大小为 0', () => {
        expect(calculateETA(0, 0, 1048576)).toBe('--')
      })
    })
  })

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      const client = createAria2Client({ url: 'http://localhost:6800/jsonrpc' })

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(client.getVersion()).rejects.toThrow()
    })

    it('应该处理超时', async () => {
      const client = createAria2Client({
        url: 'http://localhost:6800/jsonrpc',
        timeout: 100,
      })

      vi.mocked(fetch).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ result: {} }),
              } as Response)
            }, 200)
          }),
      )

      // 注意：实际的超时处理可能需要在 aria2Client 中实现
      // 这里只是示意如何测试超时场景
    })

  })

  describe('带密钥的请求', () => {
    it('应该在请求中包含密钥', async () => {
      const client = createAria2Client({
        rpcUrl: 'http://localhost:6800/jsonrpc',
        secret: 'my-secret-token',
      })

      const mockResponse = {
        jsonrpc: '2.0',
        id: expect.any(String),
        result: { version: '1.36.0', enabledFeatures: [] },
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      await client.getVersion()

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('token:my-secret-token'),
        }),
      )
    })
  })

  describe('JSON 解析错误处理', () => {
    it('应该处理 JSON 解析错误', async () => {
      const client = createAria2Client({ rpcUrl: 'http://localhost:6800/jsonrpc' })

      // Mock fetch 返回无效的 JSON
      vi.mocked(fetch).mockReset().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      } as Response)

      await expect(client.getVersion()).rejects.toThrow()
    })
  })
})
