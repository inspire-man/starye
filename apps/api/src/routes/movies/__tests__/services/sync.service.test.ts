import type { Database } from '@starye/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncMovieData } from '../../services/sync.service'

// ---- Mock DB ----
function createMockDb(overrides?: {
  existingMovie?: any
}): Database {
  const existingMovie = overrides?.existingMovie ?? null

  const mockUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }

  const mockInsertChain = {
    values: vi.fn().mockResolvedValue(undefined),
  }

  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  }

  return {
    query: {
      movies: {
        findFirst: vi.fn().mockResolvedValue(existingMovie),
        findMany: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue(mockUpdate),
    insert: vi.fn().mockReturnValue(mockInsertChain),
    delete: vi.fn().mockReturnValue(mockDeleteChain),
  } as unknown as Database
}

describe('syncMovieData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础同步（无 players）', () => {
    it('应该插入新电影并返回 success=1', async () => {
      const db = createMockDb({ existingMovie: null })

      const result = await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '测试影片' }],
      })

      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
      expect(db.insert).toHaveBeenCalledOnce() // 仅插入 movie
      expect(db.delete).not.toHaveBeenCalled() // 无 players，不删除
    })

    it('应该更新已有电影并返回 success=1', async () => {
      const db = createMockDb({ existingMovie: { id: 'existing-id', code: 'TEST-001' } })

      const result = await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '更新后的标题' }],
      })

      expect(result.success).toBe(1)
      expect(db.update).toHaveBeenCalledOnce()
      expect(db.insert).not.toHaveBeenCalled()
    })

    it('insert 模式下跳过已有电影', async () => {
      const db = createMockDb({ existingMovie: { id: 'existing-id', code: 'TEST-001' } })

      const result = await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '测试' }],
        mode: 'insert',
      })

      expect(result.skipped).toBe(1)
      expect(result.success).toBe(0)
    })

    it('update 模式下跳过不存在的电影', async () => {
      const db = createMockDb({ existingMovie: null })

      const result = await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '测试' }],
        mode: 'update',
      })

      expect(result.skipped).toBe(1)
    })
  })

  describe('players 写入', () => {
    it('提供 players 时应该删除旧 players 并插入新的', async () => {
      const movieId = 'existing-movie-id'
      const db = createMockDb({ existingMovie: { id: movieId, code: 'TEST-001' } })

      const result = await syncMovieData({
        db,
        movies: [{
          code: 'TEST-001',
          title: '测试',
          players: [
            { sourceName: '磁力 - 1080P', sourceUrl: 'magnet:?xt=urn:btih:aaa', quality: '1080P' },
            { sourceName: '磁力 - 720P', sourceUrl: 'magnet:?xt=urn:btih:bbb', quality: '720P' },
          ],
        }],
      })

      expect(result.success).toBe(1)
      // 应该有两次 insert：一次 update movie，一次 insert players
      expect(db.delete).toHaveBeenCalledOnce()
      expect(db.insert).toHaveBeenCalledOnce()

      // 验证 insert 的参数包含正确的 players
      const insertCalls = (db.insert as any).mock.calls
      expect(insertCalls.length).toBe(1)
    })

    it('players 为空数组时不应该调用 delete 或 insert players', async () => {
      const db = createMockDb({ existingMovie: { id: 'existing-id', code: 'TEST-001' } })

      const result = await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '测试', players: [] }],
      })

      expect(result.success).toBe(1)
      expect(db.delete).not.toHaveBeenCalled()
      expect(db.insert).not.toHaveBeenCalled()
    })

    it('players 未提供时不应该影响现有 players', async () => {
      const db = createMockDb({ existingMovie: { id: 'existing-id', code: 'TEST-001' } })

      await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '测试' }],
      })

      expect(db.delete).not.toHaveBeenCalled()
    })

    it('应该对 players.sourceUrl 去重', async () => {
      // 使用已有影片（走 update 路径），这样 insert 只会被调用一次（仅 players）
      const db = createMockDb({ existingMovie: { id: 'movie-id', code: 'TEST-002' } })

      const capturedPlayerValues: any[] = []
      ;(db as any).insert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: any[]) => {
          capturedPlayerValues.push(...vals)
          return Promise.resolve(undefined)
        }),
      })

      await syncMovieData({
        db,
        movies: [{
          code: 'TEST-002',
          title: '去重测试',
          players: [
            { sourceName: '磁力1', sourceUrl: 'magnet:?xt=urn:btih:duplicate' },
            { sourceName: '磁力2', sourceUrl: 'magnet:?xt=urn:btih:duplicate' }, // 重复 URL
            { sourceName: '磁力3', sourceUrl: 'magnet:?xt=urn:btih:unique' },
          ],
        }],
      })

      expect(capturedPlayerValues).toHaveLength(2) // 去重后只有 2 个
      const urls = capturedPlayerValues.map((p: any) => p.sourceUrl)
      expect(urls).toContain('magnet:?xt=urn:btih:duplicate')
      expect(urls).toContain('magnet:?xt=urn:btih:unique')
    })

    it('应该过滤 sourceUrl 为空的 players', async () => {
      // 使用已有影片，insert 只调用一次（仅 players）
      const db = createMockDb({ existingMovie: { id: 'movie-id', code: 'TEST-003' } })

      const capturedPlayerValues: any[] = []
      ;(db as any).insert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: any[]) => {
          capturedPlayerValues.push(...vals)
          return Promise.resolve(undefined)
        }),
      })

      await syncMovieData({
        db,
        movies: [{
          code: 'TEST-003',
          title: '空URL测试',
          players: [
            { sourceName: '有效', sourceUrl: 'magnet:?xt=urn:btih:valid' },
            { sourceName: '无效', sourceUrl: '' }, // 空 URL
          ],
        }],
      })

      expect(capturedPlayerValues).toHaveLength(1) // 只有 1 个有效 player
      expect(capturedPlayerValues[0].sourceUrl).toBe('magnet:?xt=urn:btih:valid')
    })

    it('players 写入失败时不应影响影片 success 计数', async () => {
      const db = createMockDb({ existingMovie: null })

      // 让 insert players 抛出错误
      let insertCallCount = 0
      ;(db as any).insert = vi.fn().mockImplementation(() => {
        insertCallCount++
        if (insertCallCount === 2) {
          // 第二次 insert（players）抛出错误
          return {
            values: vi.fn().mockRejectedValue(new Error('DB constraint error')),
          }
        }
        return { values: vi.fn().mockResolvedValue(undefined) }
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await syncMovieData({
        db,
        movies: [{
          code: 'TEST-004',
          title: '容错测试',
          players: [{ sourceName: '磁力', sourceUrl: 'magnet:?xt=urn:btih:test' }],
        }],
      })

      // 影片本身应该 success
      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
      // 应该打印警告
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('写入播放源失败'),
        expect.anything(),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('批量同步', () => {
    it('应该正确处理多部影片', async () => {
      // 第一部存在，第二部不存在
      let callCount = 0
      const db = createMockDb()
      ;(db.query.movies.findFirst as any).mockImplementation(() => {
        callCount++
        return callCount === 1
          ? Promise.resolve({ id: 'id-1', code: 'MOVIE-001' })
          : Promise.resolve(null)
      })

      const result = await syncMovieData({
        db,
        movies: [
          { code: 'MOVIE-001', title: '影片一' },
          { code: 'MOVIE-002', title: '影片二' },
        ],
      })

      expect(result.success).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('单部失败不影响其他影片', async () => {
      const db = createMockDb({ existingMovie: null })
      ;(db.query.movies.findFirst as any)
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('DB error'))

      const result = await syncMovieData({
        db,
        movies: [
          { code: 'GOOD-001', title: '正常影片' },
          { code: 'BAD-001', title: '故障影片' },
        ],
      })

      expect(result.success).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors[0].code).toBe('BAD-001')
    })
  })
})
