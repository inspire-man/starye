/* eslint-disable regexp/no-super-linear-backtracking */
import type { D1Database } from '@cloudflare/workers-types'
import { describe, expect, it } from 'vitest'
// @ts-expect-error relative import
import app from '../../apps/api/src/index'

// Mock D1 Database (Pure JS)
class MockD1Database {
  private data: Record<string, any[]> = {
    movie: [],
    player: [],
  }

  prepare(query: string) {
    return {
      bind: (..._args: any[]) => {
        return {
          all: async () => {
            if (query.includes('from "movie"')) {
              return { results: this.data.movie }
            }
            return { results: [] }
          },
          run: async () => {
            if (query.includes('insert into "movie"')) {
              this.data.movie.push({
                id: 'test-movie-001',
                title: 'Test Movie',
                slug: 'test-movie-001',
                code: 'TEST-001',
                coverImage: 'http://example.com/cover.jpg',
                releaseDate: 1700000000,
                isR18: 1,
              })
            }
            return {
              success: true,
              meta: { changes: 1, last_row_id: 1 },
            }
          },
          first: async () => {
            if (query.includes('from "movie"')) {
              return this.data.movie[0] || null
            }
            return null
          },
          raw: async () => {
            if (query.includes('from "movie"')) {
              // Attempt to extract column order from query
              // Query looks like: 'select "title", "slug", "code" ... from "movie" ...'
              const selectMatch = query.match(/select\s+(.+?)\s+from/i)
              if (selectMatch) {
                const columns = selectMatch[1].split(',').map(c => c.trim().replace(/"/g, '').split('.')[1] || c.trim().replace(/"/g, ''))

                // Map data to columns
                return this.data.movie.map((row) => {
                  return columns.map((col) => {
                    // Quick mapper for this test
                    if (col === 'cover_image')
                      return row.coverImage
                    if (col === 'release_date')
                      return row.releaseDate
                    if (col === 'is_r18')
                      return row.isR18
                    return row[col]
                  })
                })
              }

              return this.data.movie.map(m => Object.values(m))
            }
            return []
          },
        }
      },
    }
  }

  async batch(statements: any[]) {
    return statements.map(() => ({ success: true, meta: { changes: 1 } }))
  }
}

describe('e2E Linkage: Crawler -> API -> Frontend', () => {
  const mockD1 = new MockD1Database()

  const env = {
    DB: mockD1 as unknown as D1Database,
    CRAWLER_SECRET: 'test-secret',
    BETTER_AUTH_SECRET: 'test',
    BETTER_AUTH_URL: 'http://localhost',
  }

  it('should sync movie data (Crawler -> API)', async () => {
    const payload = {
      type: 'movie',
      data: {
        title: 'Test Movie',
        slug: 'test-movie-001',
        code: 'TEST-001',
        description: 'A test movie',
        coverImage: 'http://example.com/cover.jpg',
        releaseDate: 1700000000,
        duration: 120,
        sourceUrl: 'http://example.com/movie',
        actors: ['Actor A', 'Actor B'],
        genres: ['Drama', 'Action'],
        series: 'Test Series',
        publisher: 'Test Studio',
        isR18: true,
        players: [
          { sourceName: 'Magnet', sourceUrl: 'magnet:?xt=urn:btih:test', quality: 'HD', sortOrder: 1 },
        ],
      },
    }

    const res = await app.request('/api/admin/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': 'test-secret',
      },
      body: JSON.stringify(payload),
    }, env)

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body).toEqual({ success: true, id: 'test-movie-001' })
  })

  it('should retrieve movie list (API -> Frontend)', async () => {
    const res = await app.request('/api/movies', {
      method: 'GET',
    }, env)

    expect(res.status).toBe(200)
    const body: any = await res.json()

    expect(body.data).toHaveLength(1)
    const movie = body.data[0]
    // console.log('Movie List Item:', movie)
    expect(movie.title).toBe('Test Movie')
    expect(movie.code).toBe('TEST-001')
  })
})
