import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { adminPublishersRoutes } from '../index'

function createApp(publisherRows: any[]) {
  const db = {
    query: {
      publishers: {
        findMany: vi.fn().mockResolvedValue(publisherRows),
      },
    },
  }

  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db as any)
    await next()
  })
  app.route('/admin/publishers', adminPublishersRoutes)

  return app
}

async function fetchPendingPublishers(app: Hono<AppEnv>) {
  const env = {
    CRAWLER_SECRET: 'crawler-secret',
    R2_PUBLIC_URL: 'https://cdn.example.com',
  } as AppEnv['Bindings']

  return app.fetch(
    new Request('http://localhost/admin/publishers/pending?limit=10', {
      headers: {
        'x-service-token': env.CRAWLER_SECRET,
      },
    }),
    env,
  )
}

describe('admin publisher pending route', () => {
  it('合法 external logo 不再进入 pending logo update 队列', async () => {
    const app = createApp([
      {
        id: 'publisher-external',
        name: 'External Logo Publisher',
        sourceUrl: 'https://www.javbus.com/studio/external',
        movieCount: 30,
        crawlFailureCount: 0,
        lastCrawlAttempt: null,
        hasDetailsCrawled: true,
        logo: 'https://images.example.com/logos/external.jpg',
      },
    ])

    const response = await fetchPendingPublishers(app)
    const json: any = await response.json()

    expect(response.status).toBe(200)
    expect(json.publishers).toEqual([])
    expect(json.total).toBe(0)
    expect(json.needsLogoUpdate).toBe(0)
  })

  it('保留 missing-asset update 与未爬取 publisher 的 pending 语义', async () => {
    const app = createApp([
      {
        id: 'publisher-missing-logo',
        name: 'Missing Logo Publisher',
        sourceUrl: 'https://www.javbus.com/studio/missing',
        movieCount: 20,
        crawlFailureCount: 0,
        lastCrawlAttempt: null,
        hasDetailsCrawled: true,
        logo: null,
      },
      {
        id: 'publisher-new',
        name: 'New Publisher',
        sourceUrl: 'https://www.javbus.com/studio/new',
        movieCount: 11,
        crawlFailureCount: 0,
        lastCrawlAttempt: null,
        hasDetailsCrawled: false,
        logo: null,
      },
    ])

    const response = await fetchPendingPublishers(app)
    const json: any = await response.json()

    expect(response.status).toBe(200)
    expect(json.total).toBe(2)
    expect(json.highPriority).toBe(2)
    expect(json.needsLogoUpdate).toBe(1)

    const missingLogo = json.publishers.find((publisher: any) => publisher.id === 'publisher-missing-logo')
    const newPublisher = json.publishers.find((publisher: any) => publisher.id === 'publisher-new')

    expect(missingLogo).toMatchObject({
      needsLogoUpdate: true,
    })
    expect(newPublisher).toMatchObject({
      needsLogoUpdate: false,
      hasDetailsCrawled: false,
    })
  })
})
