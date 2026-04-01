import type { Database } from '@starye/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDecryptedAria2Config,
  getUserAria2Config,
  saveAria2Config,
} from './aria2-config.service'

// Mock database
function createMockDb() {
  return {
    query: {
      aria2Configs: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  } as any
}

describe('aria2-config.service', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    mockDb = createMockDb()
    vi.clearAllMocks()
  })

  describe('getUserAria2Config', () => {
    it('应该获取用户的 Aria2 配置', async () => {
      const mockConfig = {
        id: 'config-1',
        userId: 'user-1',
        rpcUrl: 'http://localhost:6800/jsonrpc',
        secret: 'encrypted-secret',
        useProxy: false,
      }

      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(mockConfig)

      const result = await getUserAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
      })

      expect(result).toBeDefined()
      expect(result?.rpcUrl).toBe('http://localhost:6800/jsonrpc')
      expect(result?.hasSecret).toBe(true)
      expect(result?.useProxy).toBe(false)
    })

    it('应该在配置不存在时返回 null', async () => {
      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(null)

      const result = await getUserAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
      })

      expect(result).toBeNull()
    })

    it('应该处理没有密钥的配置', async () => {
      const mockConfig = {
        id: 'config-1',
        userId: 'user-1',
        rpcUrl: 'http://localhost:6800/jsonrpc',
        secret: null,
        useProxy: true,
      }

      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(mockConfig)

      const result = await getUserAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
      })

      expect(result).toBeDefined()
      expect(result?.hasSecret).toBe(false)
      expect(result?.useProxy).toBe(true)
    })
  })

  describe('saveAria2Config', () => {
    it('应该保存新的 Aria2 配置', async () => {
      // 不存在现有配置
      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(null)

      const result = await saveAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
        rpcUrl: 'http://localhost:6800/jsonrpc',
        secret: 'test-secret',
        useProxy: false,
      })

      expect(result).toBeDefined()
      expect(result.rpcUrl).toBe('http://localhost:6800/jsonrpc')
      expect(result.hasSecret).toBe(true)
      expect(result.useProxy).toBe(false)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('应该更新已存在的配置', async () => {
      // 已存在配置
      const existingConfig = {
        id: 'config-1',
        userId: 'user-1',
        rpcUrl: 'http://old:6800/jsonrpc',
        secret: 'old-secret',
        useProxy: false,
      }

      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(existingConfig)

      const result = await saveAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
        rpcUrl: 'http://new:6800/jsonrpc',
        secret: 'new-secret',
        useProxy: true,
      })

      expect(result).toBeDefined()
      expect(result.rpcUrl).toBe('http://new:6800/jsonrpc')
      expect(result.hasSecret).toBe(true)
      expect(result.useProxy).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('应该验证 RPC URL 格式', async () => {
      await expect(
        saveAria2Config({
          db: mockDb as Database,
          userId: 'user-1',
          rpcUrl: 'invalid-url',
          useProxy: false,
        }),
      ).rejects.toThrow('无效的 RPC URL 格式')
    })

    it('应该处理空的 RPC URL', async () => {
      await expect(
        saveAria2Config({
          db: mockDb as Database,
          userId: 'user-1',
          rpcUrl: '',
          useProxy: false,
        }),
      ).rejects.toThrow('无效的 RPC URL 格式')
    })

    it('应该处理可选的密钥字段', async () => {
      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(null)

      const result = await saveAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
        rpcUrl: 'http://localhost:6800/jsonrpc',
        useProxy: false,
      })

      expect(result).toBeDefined()
      expect(result.hasSecret).toBe(false)
    })

    it('应该在更新时保持原密钥（如果未提供新密钥）', async () => {
      const existingConfig = {
        id: 'config-1',
        userId: 'user-1',
        rpcUrl: 'http://localhost:6800/jsonrpc',
        secret: 'old-encrypted-secret',
        useProxy: false,
      }

      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(existingConfig)

      const result = await saveAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
        rpcUrl: 'http://localhost:6800/jsonrpc',
        useProxy: true,
      })

      expect(result.hasSecret).toBe(true) // 保持原有密钥
    })
  })

  describe('getDecryptedAria2Config', () => {
    it('应该获取解密后的配置', async () => {
      const mockConfig = {
        id: 'config-1',
        userId: 'user-1',
        rpcUrl: 'http://localhost:6800/jsonrpc',
        secret: 'encrypted-secret-string', // 实际应该是加密后的
        useProxy: false,
      }

      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(mockConfig)

      const result = await getDecryptedAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
      })

      expect(result).toBeDefined()
      expect(result?.rpcUrl).toBe('http://localhost:6800/jsonrpc')
      expect(result?.secret).toBeDefined() // 应该解密
    })

    it('应该在配置不存在时返回 null', async () => {
      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(null)

      const result = await getDecryptedAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
      })

      expect(result).toBeNull()
    })

    it('应该处理没有密钥的配置', async () => {
      const mockConfig = {
        id: 'config-1',
        userId: 'user-1',
        rpcUrl: 'http://localhost:6800/jsonrpc',
        secret: null,
        useProxy: false,
      }

      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(mockConfig)

      const result = await getDecryptedAria2Config({
        db: mockDb as Database,
        userId: 'user-1',
      })

      expect(result).toBeDefined()
      expect(result?.secret).toBeNull()
    })
  })

  describe('边界情况', () => {
    it('应该处理数据库查询错误', async () => {
      mockDb.query.aria2Configs.findFirst.mockRejectedValueOnce(
        new Error('Database error'),
      )

      await expect(
        getUserAria2Config({
          db: mockDb as Database,
          userId: 'user-1',
        }),
      ).rejects.toThrow('Database error')
    })

    it('应该处理数据库插入错误', async () => {
      mockDb.query.aria2Configs.findFirst.mockResolvedValueOnce(null)
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockRejectedValueOnce(new Error('Insert failed')),
      })

      await expect(
        saveAria2Config({
          db: mockDb as Database,
          userId: 'user-1',
          rpcUrl: 'http://localhost:6800/jsonrpc',
          useProxy: false,
        }),
      ).rejects.toThrow()
    })
  })
})
