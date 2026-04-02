/**
 * Public Movies API E2E 测试 — 验证 movie-client-polish + movie-query-migration 变更
 *
 * 通过 HTTP 请求直接测试运行中的 dev 服务器。
 * 需要 `pnpm dev` 在 localhost:8787 上运行。
 */

import { describe, expect, it } from 'vitest'

const BASE_URL = 'http://localhost:8787/api'

async function fetchJson(url: string) {
  const res = await fetch(url)
  return { status: res.status, body: await res.json() }
}

describe('public Movies API E2E', () => {
  describe('gET /public/movies', () => {
    it('无参数时应返回正确的分页结构', async () => {
      const { status, body } = await fetchJson(`${BASE_URL}/public/movies?limit=5`)

      expect(status).toBe(200)
      expect(body).toHaveProperty('success', true)
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('pagination')
      expect(body.pagination).toHaveProperty('page')
      expect(body.pagination).toHaveProperty('limit', 5)
      expect(body.pagination).toHaveProperty('total')
      expect(body.pagination).toHaveProperty('totalPages')
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('series 筛选参数应被接受（不报 400）', async () => {
      const { status, body } = await fetchJson(`${BASE_URL}/public/movies?series=test-series&limit=1`)

      expect(status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.pagination).toBeDefined()
    })

    it('genre 筛选参数应被接受', async () => {
      const { status, body } = await fetchJson(`${BASE_URL}/public/movies?genre=drama&limit=1`)

      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('actor 筛选参数应被接受', async () => {
      const { status, body } = await fetchJson(`${BASE_URL}/public/movies?actor=test-actor&limit=1`)

      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('publisher 筛选参数应被接受', async () => {
      const { status, body } = await fetchJson(`${BASE_URL}/public/movies?publisher=test-pub&limit=1`)

      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('多参数组合不冲突', async () => {
      const { status, body } = await fetchJson(
        `${BASE_URL}/public/movies?genre=action&series=test&actor=a&publisher=p&search=abc&limit=1`,
      )

      expect(status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('无效页码应被 Valibot 校验拒绝', async () => {
      const { status } = await fetchJson(`${BASE_URL}/public/movies?page=0`)
      // Valibot 校验失败通常返回 400 或类似
      expect([400, 422]).toContain(status)
    })
  })

  describe('gET /public/movies/:code — 影片详情', () => {
    it('不存在的影片应返回 404', async () => {
      const { status, body } = await fetchJson(`${BASE_URL}/public/movies/NONEXIST-999`)

      expect(status).toBe(404)
      expect(body.success).toBe(false)
    })
  })

  describe('gET /favorites — 认证保护', () => {
    it('未认证访问应返回 401', async () => {
      const { status, body } = await fetchJson(`${BASE_URL}/favorites`)

      expect(status).toBe(401)
      expect(body.success).toBe(false)
    })
  })

  describe('gET /favorites/check/:entityType/:entityId — 认证保护', () => {
    it('未认证访问应返回 401', async () => {
      const { status, body } = await fetchJson(`${BASE_URL}/favorites/check/movie/test`)

      expect(status).toBe(401)
      expect(body.success).toBe(false)
    })
  })
})
