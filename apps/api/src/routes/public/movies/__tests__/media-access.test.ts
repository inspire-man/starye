import type { Database } from '@starye/db'
import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createMockUser } from '../../../../test/helpers'
import { moviesRoutes } from '../../../movies'
import { publicMoviesRoutes } from '../index'

function createApp(user: ReturnType<typeof createMockUser> | null) {
  const rows = [true, false].map(isR18 => ({
    id: isR18 ? 'restricted' : 'general',
    code: isR18 ? 'RESTRICTED-001' : 'GENERAL-001',
    slug: isR18 ? 'restricted' : 'general',
    title: isR18 ? 'Restricted fixture' : 'General fixture',
    isR18,
    coverImage: `https://cdn.example/${isR18 ? 'restricted' : 'general'}/cover.webp`,
    previewImages: [`https://cdn.example/${isR18 ? 'restricted' : 'general'}/preview.webp`],
    releaseDate: null,
    series: 'fixture-series',
    genres: [],
    movieActors: [],
    moviePublishers: [],
    players: [],
  }))
  const db = {
    select: (selection?: Record<string, unknown>) => {
      const data = selection && 'value' in selection
        ? [{ value: rows.length }]
        : selection && 'movieCode' in selection ? [{ movieCode: 'WATCHED-001' }] : rows
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        offset: () => chain,
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(data).then(resolve, reject),
      }
      return chain
    },
    query: {
      movies: { findMany: async () => rows, findFirst: async () => rows[0] },
      ratings: { findMany: async () => [] },
    },
  } as unknown as Database
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    if (user)
      c.set('user', user)
    await next()
  })
  app.route('/api/movies', moviesRoutes)
  app.route('/api/public/movies', publicMoviesRoutes)
  return { app, rows }
}

const identities = [
  { name: 'anonymous', user: null, allowed: false },
  { name: 'unverified', user: createMockUser({ isAdult: false, isR18Verified: false }), allowed: false },
  { name: 'unverified admin', user: createMockUser({ role: 'admin', isAdult: false, isR18Verified: false }), allowed: false },
  { name: 'verified', user: createMockUser({ isAdult: false, isR18Verified: true }), allowed: true },
  { name: 'existing adult flag', user: createMockUser({ isAdult: true, isR18Verified: false }), allowed: true },
]

describe.each(identities)('movie image access: $name', ({ user, allowed }) => {
  it.each(['/api/movies', '/api/movies/featured/hot', '/api/public/movies', '/api/public/movies/recommended'])('protects list media through %s', async (path) => {
    const { app, rows } = createApp(user)
    const response = await app.request(path)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toContain('Cookie')
    const body = await response.json() as { data: typeof rows }
    expect(body.data[0].title).toBe(rows[0].title)
    expect(body.data[0].coverImage).toBe(allowed ? rows[0].coverImage : null)
    if ('previewImages' in body.data[0])
      expect(body.data[0].previewImages).toEqual(allowed ? rows[0].previewImages : [])
    expect(body.data[1].coverImage).toBe(rows[1].coverImage)
    if (!allowed)
      expect(JSON.stringify(body)).not.toContain('https://cdn.example/restricted/')
    expect(rows[0].coverImage).toContain('/restricted/')
  })

  it.each(['/api/movies/RESTRICTED-001', '/api/public/movies/RESTRICTED-001'])('protects detail and related covers through %s', async (path) => {
    const { app, rows } = createApp(user)
    const response = await app.request(path)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await response.json() as { data: (typeof rows)[number] & { relatedMovies: typeof rows } }
    expect(body.data.coverImage).toBe(allowed ? rows[0].coverImage : null)
    expect(body.data.previewImages).toEqual(allowed ? [rows[0].coverImage, ...rows[0].previewImages] : [])
    expect(body.data.relatedMovies[0].coverImage).toBe(allowed ? rows[0].coverImage : null)
    expect(body.data.relatedMovies[1].coverImage).toBe(rows[1].coverImage)
  })
})
