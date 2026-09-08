import type { AppEnv } from '../../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { adminComicsRoutes } from '../index'

function createApp(comic: Record<string, unknown> | undefined) {
  const findFirst = vi.fn().mockResolvedValue(comic)
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', { query: { comics: { findFirst } }, update: () => ({ set }) } as any)
    ;(c as any).env = { CRAWLER_SECRET: 'secret-token' }
    await next()
  })
  app.route('/', adminComicsRoutes)
  return { app, findFirst, set }
}

describe('admin comics direct detail route', () => {
  it.each([
    { status: 'partial', crawledChapters: 35, totalChapters: 15 },
    { status: 'complete', crawledChapters: 5, totalChapters: 15 },
  ])('rejects inconsistent progress without a database write: %j', async (body) => {
    const { app, set } = createApp({ id: 'comic-1' })
    const response = await app.request('/comic-one/progress', {
      method: 'POST',
      headers: { 'x-service-token': 'secret-token', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(response.status).toBe(422)
    expect(set).not.toHaveBeenCalled()
  })

  it('persists valid source-relative progress', async () => {
    const { app, set } = createApp({ id: 'comic-1' })
    const response = await app.request('/comic-one/progress', {
      method: 'POST',
      headers: { 'x-service-token': 'secret-token', 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'partial', crawledChapters: 5, totalChapters: 15 }),
    })
    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ crawlStatus: 'partial', crawledChapters: 5, totalChapters: 15 }))
  })

  it('returns a receipt-addressable comic behind the existing service resource guard', async () => {
    const { app, findFirst } = createApp({ id: 'comic-1', slug: 'comic-one', title: 'Comic One' })
    const response = await app.fetch(new Request('http://localhost/comic-1', {
      headers: { 'x-service-token': 'secret-token' },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { id: 'comic-1', slug: 'comic-one', title: 'Comic One' },
    })
    expect(findFirst).toHaveBeenCalledOnce()
  })

  it('returns 404 without exposing a foreign or missing comic', async () => {
    const { app } = createApp(undefined)
    const response = await app.fetch(new Request('http://localhost/foreign', {
      headers: { 'x-service-token': 'secret-token' },
    }))

    expect(response.status).toBe(404)
  })
})
