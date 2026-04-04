/**
 * 演员关联同步集成测试
 * 使用内存 SQLite 数据库，测试完整的 syncMovieData → getActorBySlug 数据流
 */
import { createClient } from '@libsql/client'
// 引入 drizzle schema 用于 ORM 查询
import * as schema from '@starye/db/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getActorBySlug } from '../../../actors/services/actor.service'

import { syncMovieData } from '../../services/sync.service'

// ---- 建表 DDL（与 schema.ts 保持同步）----
const CREATE_TABLES_SQL = `
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
  is_r18 INTEGER NOT NULL DEFAULT 1,
  metadata_locked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  crawl_status TEXT DEFAULT 'complete',
  last_crawled_at INTEGER,
  total_players INTEGER DEFAULT 0,
  crawled_players INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
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
  is_active INTEGER NOT NULL DEFAULT 1,
  retire_date INTEGER,
  social_links TEXT,
  aliases TEXT,
  blog TEXT,
  twitter TEXT,
  instagram TEXT,
  wiki_url TEXT,
  movie_count INTEGER NOT NULL DEFAULT 0,
  is_r18 INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'javbus',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  has_details_crawled INTEGER DEFAULT 0,
  crawl_failure_count INTEGER DEFAULT 0,
  last_crawl_attempt INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_actor_slug ON actor(slug);

CREATE TABLE IF NOT EXISTS movie_actor (
  id TEXT PRIMARY KEY,
  movie_id TEXT NOT NULL REFERENCES movie(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actor(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_actor ON movie_actor(movie_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_movie_actor_actor_id ON movie_actor(actor_id);

CREATE TABLE IF NOT EXISTS player (
  id TEXT PRIMARY KEY,
  movie_id TEXT NOT NULL REFERENCES movie(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  quality TEXT,
  sort_order INTEGER NOT NULL,
  average_rating INTEGER,
  rating_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
`

let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  const client = createClient({ url: ':memory:' })

  // 执行建表 DDL（逐条执行）
  for (const stmt of CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)) {
    await client.execute(stmt)
  }

  db = drizzle(client, { schema }) as any
})

afterAll(() => {
  // @libsql/client 内存数据库自动释放
})

describe('syncMovieData + getActorBySlug 端到端集成', () => {
  describe('场景 1：新电影带演员同步', () => {
    it('同步后演员应存在于 actors 表', async () => {
      await syncMovieData({
        db: db as any,
        movies: [{
          code: 'SDAB-333',
          title: '雄川ひより 测试影片',
          actors: ['雄川ひより'],
          isR18: true,
        }],
      })

      const actor = await db.query.actors.findFirst({
        where: (a: any, { eq }: any) => eq(a.slug, '雄川ひより'),
      })

      expect(actor).toBeDefined()
      expect(actor!.name).toBe('雄川ひより')
      expect(actor!.slug).toBe('雄川ひより')
      expect(actor!.movieCount).toBe(1)
    })

    it('movie_actor 关联表应有对应记录', async () => {
      const actor = await db.query.actors.findFirst({
        where: (a: any, { eq }: any) => eq(a.slug, '雄川ひより'),
      })
      expect(actor).toBeDefined()

      const movie = await db.query.movies.findFirst({
        where: (m: any, { eq }: any) => eq(m.code, 'SDAB-333'),
      })
      expect(movie).toBeDefined()

      const link = await db.query.movieActors.findFirst({
        where: (ma: any, { and, eq }: any) => and(
          eq(ma.movieId, movie!.id),
          eq(ma.actorId, actor!.id),
        ),
      })
      expect(link).toBeDefined()
    })

    it('getActorBySlug 应能通过 join table 查到关联影片', async () => {
      const result = await getActorBySlug({
        db: db as any,
        slug: '雄川ひより',
        isR18Verified: true,
      })

      expect(result).not.toBeNull()
      expect(result!.name).toBe('雄川ひより')
      expect(result!.relatedMovies).toHaveLength(1)
      expect(result!.relatedMovies[0].code).toBe('SDAB-333')
    })
  })

  describe('场景 2：相同演员出演多部影片', () => {
    const actorName = '松本あかり'

    beforeAll(async () => {
      await syncMovieData({
        db: db as any,
        movies: [
          { code: 'SDJS-344', title: '影片A', actors: [actorName], isR18: true },
          { code: 'SDJS-345', title: '影片B', actors: [actorName], isR18: true },
          { code: 'SDJS-346', title: '影片C', actors: [actorName, '另一演员'], isR18: true },
        ],
      })
    })

    it('演员 movieCount 应正确计算为 3', async () => {
      const actor = await db.query.actors.findFirst({
        where: (a: any, { eq }: any) => eq(a.slug, actorName),
      })
      expect(actor!.movieCount).toBe(3)
    })

    it('getActorBySlug 应返回 3 部关联影片', async () => {
      const result = await getActorBySlug({
        db: db as any,
        slug: actorName,
        isR18Verified: true,
      })

      expect(result!.relatedMovies).toHaveLength(3)
    })
  })

  describe('场景 3：幂等性 — 重复同步同一影片', () => {
    const code = 'IDEM-001'
    const actorName = '冪等テスト'

    beforeAll(async () => {
      // 同步两次
      for (let i = 0; i < 2; i++) {
        await syncMovieData({
          db: db as any,
          movies: [{ code, title: '幂等测试', actors: [actorName], isR18: true }],
        })
      }
    })

    it('actors 表中演员只有一条记录', async () => {
      const actors = await db.query.actors.findMany({
        where: (a: any, { eq }: any) => eq(a.slug, actorName),
      })
      expect(actors).toHaveLength(1)
    })

    it('movie_actor 关联表只有一条记录', async () => {
      const actor = await db.query.actors.findFirst({
        where: (a: any, { eq }: any) => eq(a.slug, actorName),
      })
      const movie = await db.query.movies.findFirst({
        where: (m: any, { eq }: any) => eq(m.code, code),
      })

      const links = await db.query.movieActors.findMany({
        where: (ma: any, { and, eq }: any) => and(
          eq(ma.movieId, movie!.id),
          eq(ma.actorId, actor!.id),
        ),
      })
      expect(links).toHaveLength(1) // 幂等，不重复
    })

    it('movieCount 应为 1 而非 2', async () => {
      const actor = await db.query.actors.findFirst({
        where: (a: any, { eq }: any) => eq(a.slug, actorName),
      })
      expect(actor!.movieCount).toBe(1)
    })
  })

  describe('场景 4：存量数据 fallback — join table 为空时从 movies.actors LIKE 查询', () => {
    it('getActorBySlug 在 join table 无记录时应 fallback 到 LIKE 查询', async () => {
      // 手动插入：movie.actors 有值，但 movie_actor 无关联
      const actorId = crypto.randomUUID()
      const movieId = crypto.randomUUID()
      await db.run(sql`INSERT INTO actor (id, name, slug, movie_count, is_r18, source, source_id) VALUES (${actorId}, ${'八掛うみ'}, ${'八掛うみ'}, 0, 1, 'javbus', '')`)
      await db.run(sql`INSERT INTO movie (id, code, title, slug, actors, is_r18) VALUES (${movieId}, ${'SDMM-221'}, ${'八掛うみ作品'}, ${'sdmm-221'}, ${JSON.stringify(['八掛うみ'])}, 1)`)
      // 不插入 movie_actor

      const result = await getActorBySlug({
        db: db as any,
        slug: '八掛うみ',
        isR18Verified: true,
      })

      expect(result).not.toBeNull()
      // fallback LIKE 查询应找到 movie
      expect(result!.relatedMovies.length).toBeGreaterThan(0)
      const codes = result!.relatedMovies.map(m => m.code)
      expect(codes).toContain('SDMM-221')
    })
  })

  describe('场景 5：R18 过滤', () => {
    beforeAll(async () => {
      await syncMovieData({
        db: db as any,
        movies: [
          { code: 'R18-MOVIE', title: 'R18影片', actors: ['R18テスト演者'], isR18: true },
        ],
      })
    })

    it('未验证 R18 的用户不应看到 R18 影片', async () => {
      const result = await getActorBySlug({
        db: db as any,
        slug: 'R18テスト演者',
        isR18Verified: false,
      })

      // 演员存在，但关联影片为空（全部 R18）
      expect(result).not.toBeNull()
      expect(result!.relatedMovies).toHaveLength(0)
    })

    it('已验证 R18 的用户应看到 R18 影片', async () => {
      const result = await getActorBySlug({
        db: db as any,
        slug: 'R18テスト演者',
        isR18Verified: true,
      })

      expect(result!.relatedMovies).toHaveLength(1)
      expect(result!.relatedMovies[0].code).toBe('R18-MOVIE')
    })
  })
})
