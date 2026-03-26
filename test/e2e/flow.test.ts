import type { D1Database } from '@cloudflare/workers-types'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import app from '../../apps/api/src/index'

// 使用 better-sqlite3 适配器模拟 D1 Database
class BetterSqliteD1Adapter {
  private db: Database.Database

  constructor() {
    this.db = new Database(':memory:')
    this.initSchema()
  }

  private initSchema() {
    // 创建必要的表结构
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS movie (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        cover_image TEXT,
        release_date INTEGER,
        duration INTEGER,
        source_url TEXT UNIQUE,
        actors TEXT,
        genres TEXT,
        series TEXT,
        publisher TEXT,
        is_r18 INTEGER DEFAULT 1 NOT NULL,
        metadata_locked INTEGER DEFAULT 0 NOT NULL,
        sort_order INTEGER DEFAULT 0,
        crawl_status TEXT DEFAULT 'complete',
        last_crawled_at INTEGER,
        total_players INTEGER DEFAULT 0,
        crawled_players INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS player (
        id TEXT PRIMARY KEY,
        movie_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        quality TEXT,
        sort_order INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (movie_id) REFERENCES movie(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS actor (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        avatar TEXT,
        cover TEXT,
        bio TEXT,
        birth_date INTEGER,
        height INTEGER,
        measurements TEXT,
        cup_size TEXT,
        blood_type TEXT,
        nationality TEXT,
        debut_date INTEGER,
        is_active INTEGER DEFAULT 1,
        retire_date INTEGER,
        social_links TEXT,
        aliases TEXT,
        movie_count INTEGER DEFAULT 0 NOT NULL,
        is_r18 INTEGER DEFAULT 1 NOT NULL,
        source TEXT DEFAULT 'javbus' NOT NULL,
        source_id TEXT DEFAULT '' NOT NULL,
        source_url TEXT,
        has_details_crawled INTEGER DEFAULT 0,
        crawl_failure_count INTEGER DEFAULT 0,
        last_crawl_attempt INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS publisher (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        logo TEXT,
        website TEXT,
        description TEXT,
        founded_year INTEGER,
        country TEXT,
        movie_count INTEGER DEFAULT 0 NOT NULL,
        is_r18 INTEGER DEFAULT 1 NOT NULL,
        source TEXT DEFAULT 'javbus' NOT NULL,
        source_id TEXT DEFAULT '' NOT NULL,
        source_url TEXT,
        has_details_crawled INTEGER DEFAULT 0,
        crawl_failure_count INTEGER DEFAULT 0,
        last_crawl_attempt INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS movie_actor (
        id TEXT PRIMARY KEY,
        movie_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (movie_id) REFERENCES movie(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES actor(id) ON DELETE CASCADE,
        UNIQUE (movie_id, actor_id)
      );

      CREATE TABLE IF NOT EXISTS movie_publisher (
        id TEXT PRIMARY KEY,
        movie_id TEXT NOT NULL,
        publisher_id TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (movie_id) REFERENCES movie(id) ON DELETE CASCADE,
        FOREIGN KEY (publisher_id) REFERENCES publisher(id) ON DELETE CASCADE,
        UNIQUE (movie_id, publisher_id)
      );
    `)
  }

  prepare(query: string) {
    return {
      bind: (...params: any[]) => {
        return {
          all: async () => {
            try {
              const stmt = this.db.prepare(query)
              const results = stmt.all(...params)
              return { results }
            }
            catch (error) {
              console.error('[D1 Mock Error]', error)
              throw error
            }
          },
          run: async () => {
            try {
              const stmt = this.db.prepare(query)
              const info = stmt.run(...params)
              return {
                success: true,
                meta: {
                  changes: info.changes,
                  last_row_id: info.lastInsertRowid,
                },
              }
            }
            catch (error) {
              console.error('[D1 Mock Error]', error)
              throw error
            }
          },
          first: async () => {
            try {
              const stmt = this.db.prepare(query)
              return stmt.get(...params) || null
            }
            catch (error) {
              console.error('[D1 Mock Error]', error)
              throw error
            }
          },
          raw: async () => {
            try {
              const stmt = this.db.prepare(query)
              return stmt.raw().all(...params)
            }
            catch (error) {
              console.error('[D1 Mock Error]', error)
              throw error
            }
          },
        }
      },
    }
  }

  async batch(statements: any[]) {
    return statements.map((stmt: any) => {
      try {
        const result = this.db.prepare(stmt.query).run(...(stmt.params || []))
        return {
          success: true,
          meta: {
            changes: result.changes,
            last_row_id: result.lastInsertRowid,
          },
        }
      }
      catch (error) {
        console.error('[D1 Batch Error]', error)
        return { success: false, error }
      }
    })
  }

  close() {
    this.db.close()
  }
}

describe('e2E Linkage: Crawler -> API -> Frontend', () => {
  let mockD1: BetterSqliteD1Adapter
  let env: any

  beforeAll(() => {
    mockD1 = new BetterSqliteD1Adapter()
    env = {
      DB: mockD1 as unknown as D1Database,
      CRAWLER_SECRET: 'test-secret',
      BETTER_AUTH_SECRET: 'test',
      BETTER_AUTH_URL: 'http://localhost',
    }
  })

  afterAll(() => {
    mockD1.close()
  })

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
