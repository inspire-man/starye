import type { Database } from '@starye/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncMovieData } from '../../services/sync.service'

// ---- Mock DB ----
// 构造支持演员同步的完整 mock
function createMockDb(overrides?: {
  existingMovie?: any
  existingActor?: any
}): Database {
  const existingMovie = overrides?.existingMovie ?? null
  const existingActor = overrides?.existingActor ?? null

  const mockUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }

  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  }

  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  }

  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ value: 1 }]), // 返回 count=1
  }

  return {
    query: {
      movies: {
        findFirst: vi.fn().mockResolvedValue(existingMovie),
        findMany: vi.fn(),
      },
      actors: {
        findFirst: vi.fn().mockResolvedValue(existingActor),
        findMany: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue(mockUpdate),
    insert: vi.fn().mockReturnValue(mockInsertChain),
    delete: vi.fn().mockReturnValue(mockDeleteChain),
    select: vi.fn().mockReturnValue(mockSelectChain),
  } as unknown as Database
}

describe('syncMovieData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础同步（无 players / actors）', () => {
    it('应该插入新电影并返回 success=1', async () => {
      const db = createMockDb({ existingMovie: null })

      const result = await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '测试影片' }],
      })

      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('应该更新已有电影并返回 success=1', async () => {
      const db = createMockDb({ existingMovie: { id: 'existing-id', code: 'TEST-001' } })

      const result = await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '更新后的标题' }],
      })

      expect(result.success).toBe(1)
      expect(db.update).toHaveBeenCalledOnce()
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

  describe('演员关联同步', () => {
    it('同步含演员的新电影时应写入 actors 表和 movie_actor 关联表', async () => {
      // 演员不存在，需要插入
      const db = createMockDb({ existingMovie: null, existingActor: null })

      // 第一次 findFirst(actors) 返回 null（演员不存在），第二次返回新建的演员
      ;(db.query.actors.findFirst as any)
        .mockResolvedValueOnce(null) // 第一次查：不存在
        .mockResolvedValueOnce({ id: 'actor-uuid', movieCount: 0 }) // 第二次查：刚插入的

      const result = await syncMovieData({
        db,
        movies: [{
          code: 'TEST-010',
          title: '八掛うみ测试',
          actors: ['八掛うみ'],
          isR18: true,
        }],
      })

      expect(result.success).toBe(1)
      // 应该有多次 insert：1 次 movie + 1 次 actor + 1 次 movie_actor
      const insertCalls = (db.insert as any).mock.calls
      expect(insertCalls.length).toBeGreaterThanOrEqual(3)
    })

    it('演员已存在时应直接创建关联而不重复插入 actor', async () => {
      const existingActor = { id: 'actor-uuid-existing', movieCount: 5 }
      const db = createMockDb({
        existingMovie: null,
        existingActor,
      })

      const result = await syncMovieData({
        db,
        movies: [{
          code: 'TEST-011',
          title: '已有演员测试',
          actors: ['波多野結衣'],
          isR18: true,
        }],
      })

      expect(result.success).toBe(1)
    })

    it('演员 slug 含中文/日文时应正常处理', async () => {
      const db = createMockDb({ existingMovie: null, existingActor: null })
      ;(db.query.actors.findFirst as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'actor-uuid', movieCount: 0 })

      const result = await syncMovieData({
        db,
        movies: [{
          code: 'TEST-012',
          title: '多演员测试',
          actors: ['八掛うみ', '波多野結衣'],
          isR18: true,
        }],
      })

      // 有 2 个演员，但不应该因为演员 slug 包含日文而抛错
      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('演员写入失败时不应影响影片 success 计数', async () => {
      const db = createMockDb({ existingMovie: null })
      ;(db.query.actors.findFirst as any).mockRejectedValue(new Error('actor query failed'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await syncMovieData({
        db,
        movies: [{
          code: 'TEST-013',
          title: '演员失败容错测试',
          actors: ['失败的演员'],
        }],
      })

      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
      consoleSpy.mockRestore()
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
      expect(db.delete).toHaveBeenCalledOnce()
    })

    it('players 为空数组时不应该调用 delete', async () => {
      const db = createMockDb({ existingMovie: { id: 'existing-id', code: 'TEST-001' } })

      const result = await syncMovieData({
        db,
        movies: [{ code: 'TEST-001', title: '测试', players: [] }],
      })

      expect(result.success).toBe(1)
      expect(db.delete).not.toHaveBeenCalled()
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
      const db = createMockDb({ existingMovie: { id: 'movie-id', code: 'TEST-002' } })

      const capturedPlayerValues: any[] = []
      ;(db as any).insert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: any) => {
          if (Array.isArray(vals))
            capturedPlayerValues.push(...vals)
          return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }
        }),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
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

      const playerValues = capturedPlayerValues.filter((v: any) => v.sourceName)
      expect(playerValues).toHaveLength(2)
    })

    it('players 写入失败时不应影响影片 success 计数', async () => {
      const db = createMockDb({ existingMovie: null })

      let insertCallCount = 0
      ;(db as any).insert = vi.fn().mockImplementation(() => {
        insertCallCount++
        // 第1次 insert: movie, 第2次 insert: players（模拟失败）
        if (insertCallCount === 2) {
          return {
            values: vi.fn().mockRejectedValue(new Error('DB constraint error')),
            onConflictDoNothing: vi.fn().mockRejectedValue(new Error('DB constraint error')),
          }
        }
        return {
          values: vi.fn().mockReturnThis(),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }
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

      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
      consoleSpy.mockRestore()
    })
  })

  describe('批量同步', () => {
    it('应该正确处理多部影片', async () => {
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
