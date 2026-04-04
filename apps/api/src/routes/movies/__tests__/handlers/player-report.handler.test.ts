/**
 * player-report.handler 单测
 * 覆盖 POST /api/movies/players/:id/report 的核心逻辑
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb, createMockUser } from '../../../../test/helpers'
import { reportPlayer } from '../../handlers/player-report.handler'

// 创建标准测试 App 工厂函数
function createApp(opts: { user?: ReturnType<typeof createMockUser> | null, db?: ReturnType<typeof createMockDb> } = {}) {
  const { user = null, db = createMockDb() } = opts
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user)
      c.set('user', user)
    await next()
  })
  app.post('/players/:id/report', reportPlayer)
  return { app, db }
}

describe('reportPlayer Handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('认证检查', () => {
    it('未登录时应返回 401', async () => {
      const { app } = createApp({ user: null })

      const res = await app.fetch(
        new Request('http://localhost/players/player-1/report', { method: 'POST' }),
      )

      expect(res.status).toBe(401)
    })
  })

  describe('参数校验', () => {
    it('player 不存在时应返回 404', async () => {
      const db = createMockDb()
      ;(db.query as any).players.findFirst = vi.fn().mockResolvedValue(null)
      const { app } = createApp({ user: createMockUser(), db })

      const res = await app.fetch(
        new Request('http://localhost/players/nonexistent/report', { method: 'POST' }),
      )

      expect(res.status).toBe(404)
    })
  })

  describe('上报逻辑', () => {
    it('成功上报时应递增 reportCount 并返回 200', async () => {
      const db = createMockDb()
      ;(db.query as any).players.findFirst = vi.fn().mockResolvedValue({
        id: 'player-1',
        reportCount: 2,
        isActive: true,
      })
      const { app } = createApp({ user: createMockUser(), db })

      const res = await app.fetch(
        new Request('http://localhost/players/player-1/report', { method: 'POST' }),
      )

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)
      expect(json.reportCount).toBe(3)
      // 未超过阈值（5），isActive 保持 true
      expect(json.isActive).toBe(true)
    })

    it('reportCount 为 null 时应将其视为 0', async () => {
      const db = createMockDb()
      ;(db.query as any).players.findFirst = vi.fn().mockResolvedValue({
        id: 'player-1',
        reportCount: null,
        isActive: true,
      })
      const { app } = createApp({ user: createMockUser(), db })

      const res = await app.fetch(
        new Request('http://localhost/players/player-1/report', { method: 'POST' }),
      )

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.reportCount).toBe(1)
    })

    it('达到阈值（第 5 次上报）时应将 isActive 置为 false', async () => {
      const db = createMockDb()
      ;(db.query as any).players.findFirst = vi.fn().mockResolvedValue({
        id: 'player-1',
        reportCount: 4, // 4 + 1 = 5 恰好达到 REPORT_THRESHOLD
        isActive: true,
      })
      const { app } = createApp({ user: createMockUser(), db })

      const res = await app.fetch(
        new Request('http://localhost/players/player-1/report', { method: 'POST' }),
      )

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.reportCount).toBe(5)
      expect(json.isActive).toBe(false)
    })

    it('超过阈值（第 6 次上报）时 isActive 仍为 false（不会反转）', async () => {
      const db = createMockDb()
      ;(db.query as any).players.findFirst = vi.fn().mockResolvedValue({
        id: 'player-1',
        reportCount: 5,
        isActive: false, // 已被标记为无效
      })
      const { app } = createApp({ user: createMockUser(), db })

      const res = await app.fetch(
        new Request('http://localhost/players/player-1/report', { method: 'POST' }),
      )

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.reportCount).toBe(6)
      expect(json.isActive).toBe(false)
    })

    it('未达到阈值时 isActive 保持原始状态', async () => {
      const db = createMockDb()
      ;(db.query as any).players.findFirst = vi.fn().mockResolvedValue({
        id: 'player-1',
        reportCount: 1,
        isActive: true,
      })
      const { app } = createApp({ user: createMockUser(), db })

      const res = await app.fetch(
        new Request('http://localhost/players/player-1/report', { method: 'POST' }),
      )

      const json: any = await res.json()
      expect(json.isActive).toBe(true)
    })
  })

  describe('数据库写入', () => {
    it('应正确调用 db.update 并写入新的 reportCount 和 isActive', async () => {
      const db = createMockDb()
      ;(db.query as any).players.findFirst = vi.fn().mockResolvedValue({
        id: 'player-1',
        reportCount: 3,
        isActive: true,
      })

      // 捕获 db.update 调用时传入的 set 参数
      let capturedSetArgs: any = null
      const mockWhere = vi.fn().mockResolvedValue(undefined)
      const mockSet = vi.fn().mockImplementation((args) => {
        capturedSetArgs = args
        return { where: mockWhere }
      })
      ;(db.update as any) = vi.fn().mockReturnValue({ set: mockSet })

      const { app } = createApp({ user: createMockUser(), db })

      await app.fetch(
        new Request('http://localhost/players/player-1/report', { method: 'POST' }),
      )

      expect(db.update).toHaveBeenCalledOnce()
      expect(capturedSetArgs).toMatchObject({
        reportCount: 4,
        isActive: true, // 4 < 5，不触发 deactivate
      })
      expect(capturedSetArgs.updatedAt).toBeInstanceOf(Date)
    })
  })
})
