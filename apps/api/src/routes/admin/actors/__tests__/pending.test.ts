import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { adminActorsRoutes } from '../index'

function createApp(actorRows: any[]) {
  const db = {
    query: {
      actors: {
        findMany: vi.fn().mockResolvedValue(actorRows),
      },
    },
  }

  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db as any)
    await next()
  })
  app.route('/admin/actors', adminActorsRoutes)

  return app
}

async function fetchPendingActors(app: Hono<AppEnv>, rows: any[]) {
  const env = {
    CRAWLER_SECRET: 'crawler-secret',
    R2_PUBLIC_URL: 'https://cdn.example.com',
  } as AppEnv['Bindings']

  return {
    response: await app.fetch(
      new Request('http://localhost/admin/actors/pending?limit=10', {
        headers: {
          'x-service-token': env.CRAWLER_SECRET,
        },
      }),
      env,
    ),
    rows,
  }
}

describe('admin actor pending route', () => {
  it('合法 external avatar 不再进入 pending avatar update 队列', async () => {
    const app = createApp([
      {
        id: 'actor-external',
        name: 'External Avatar Actor',
        sourceUrl: 'https://www.javbus.com/star/external',
        movieCount: 18,
        crawlFailureCount: 0,
        lastCrawlAttempt: null,
        hasDetailsCrawled: true,
        avatar: 'https://images.example.com/avatars/external.jpg',
        source: 'seesaawiki',
      },
    ])

    const { response } = await fetchPendingActors(app, [])
    const json: any = await response.json()

    expect(response.status).toBe(200)
    expect(json.actors).toEqual([])
    expect(json.total).toBe(0)
    expect(json.needsAvatarUpdate).toBe(0)
    expect(json.needsSeesaaWikiRecrawl).toBe(0)
  })

  it('保留 missing-asset update 与非 SeesaaWiki recrawl 语义', async () => {
    const app = createApp([
      {
        id: 'actor-missing-avatar',
        name: 'Missing Avatar Actor',
        sourceUrl: 'https://www.javbus.com/star/missing',
        movieCount: 20,
        crawlFailureCount: 0,
        lastCrawlAttempt: null,
        hasDetailsCrawled: true,
        avatar: null,
        source: 'seesaawiki',
      },
      {
        id: 'actor-new',
        name: 'New Actor',
        sourceUrl: 'https://www.javbus.com/star/new',
        movieCount: 12,
        crawlFailureCount: 0,
        lastCrawlAttempt: null,
        hasDetailsCrawled: false,
        avatar: null,
        source: 'javbus',
      },
      {
        id: 'actor-recrawl',
        name: 'Needs Recrawl Actor',
        sourceUrl: 'https://www.javbus.com/star/recrawl',
        movieCount: 5,
        crawlFailureCount: 1,
        lastCrawlAttempt: new Date('2026-07-13T00:00:00.000Z'),
        hasDetailsCrawled: true,
        avatar: 'https://images.example.com/avatars/recrawl.jpg',
        source: 'javbus',
      },
    ])

    const { response } = await fetchPendingActors(app, [])
    const json: any = await response.json()

    expect(response.status).toBe(200)
    expect(json.total).toBe(3)
    expect(json.highPriority).toBe(2)
    expect(json.needsAvatarUpdate).toBe(1)
    expect(json.needsSeesaaWikiRecrawl).toBe(1)

    const missingAvatar = json.actors.find((actor: any) => actor.id === 'actor-missing-avatar')
    const recrawlActor = json.actors.find((actor: any) => actor.id === 'actor-recrawl')

    expect(missingAvatar).toMatchObject({
      needsAvatarUpdate: true,
      source: 'seesaawiki',
    })
    expect(recrawlActor).toMatchObject({
      needsAvatarUpdate: false,
      source: 'javbus',
    })
  })
})
