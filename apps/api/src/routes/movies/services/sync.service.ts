import type { Database } from '@starye/db'
import type { InferSelectModel } from 'drizzle-orm'
import { actors as actorsTable, movieActors as movieActorsTable, movies as moviesTable, players as playersTable } from '@starye/db/schema'
import { count, eq } from 'drizzle-orm'

// 使用 Drizzle 推导的基础类型
type Movie = InferSelectModel<typeof moviesTable>

export interface PlayerInput {
  sourceName: string
  sourceUrl: string
  quality?: string
  sortOrder?: number
}

/**
 * 同步电影数据
 * 用于从外部数据源批量同步或更新电影信息
 */
export interface SyncMovieDataOptions {
  db: Database
  movies: Array<{
    code: string
    title: string
    slug?: string
    coverImage?: string
    releaseDate?: Date | string
    duration?: number
    description?: string
    genres?: string[]
    actors?: string[]
    series?: string // 系列名（通常来自"發行商"字段）
    publisher?: string // 真实厂商名（来自"製作商"字段）
    isR18?: boolean
    players?: PlayerInput[] // 播放源列表
  }>
  mode?: 'upsert' | 'insert' | 'update'
}

export interface SyncMovieDataResult {
  success: number
  failed: number
  skipped: number
  errors: Array<{
    code: string
    error: string
  }>
}

/**
 * 幂等写入演员关联：upsert actor 记录 + movie_actor 关联表
 * 对存量数据安全：已有记录直接跳过插入冲突
 */
async function syncActors(
  db: Database,
  movieId: string,
  actorNames: string[],
  isR18: boolean,
): Promise<void> {
  for (let i = 0; i < actorNames.length; i++) {
    const name = actorNames[i]?.trim()
    if (!name)
      continue

    try {
      // 1. 查找已有演员（按 slug = name 匹配，日文/中文名作为 slug）
      let actor = await db.query.actors.findFirst({
        where: eq(actorsTable.slug, name),
        columns: { id: true, movieCount: true },
      })

      // 2. 不存在则插入（slug = name，onConflictDoNothing 防止并发重复）
      if (!actor) {
        const actorId = crypto.randomUUID()
        await db.insert(actorsTable).values({
          id: actorId,
          name,
          slug: name,
          movieCount: 0,
          isR18,
          source: 'javbus',
          sourceId: '',
          hasDetailsCrawled: false,
          createdAt: new Date(),
        }).onConflictDoNothing()

        // 再次查询（防止并发插入后找不到）
        actor = await db.query.actors.findFirst({
          where: eq(actorsTable.slug, name),
          columns: { id: true, movieCount: true },
        })
      }

      if (!actor)
        continue

      // 3. 写入 movie_actor 关联（幂等：已存在则跳过）
      await db.insert(movieActorsTable).values({
        id: crypto.randomUUID(),
        movieId,
        actorId: actor.id,
        sortOrder: i,
        createdAt: new Date(),
      }).onConflictDoNothing()

      // 4. 更新演员的作品数（从关联表重新统计，保证准确）
      const countResult = await db
        .select({ value: count() })
        .from(movieActorsTable)
        .where(eq(movieActorsTable.actorId, actor.id))
      const newCount = countResult[0]?.value ?? 0
      if (newCount !== actor.movieCount) {
        await db.update(actorsTable)
          .set({ movieCount: newCount })
          .where(eq(actorsTable.id, actor.id))
      }
    }
    catch (actorError) {
      console.warn(
        `[SyncService] ⚠️ 演员关联写入失败 (${name}):`,
        actorError instanceof Error ? actorError.message : String(actorError),
      )
    }
  }
}

export async function syncMovieData(options: SyncMovieDataOptions): Promise<SyncMovieDataResult> {
  const { db, movies: movieDataList, mode = 'upsert' } = options

  const result: SyncMovieDataResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  for (const movieData of movieDataList) {
    try {
      const { code, title, slug, coverImage, releaseDate, duration, description, genres, actors: actorNames, series, publisher, isR18, players } = movieData

      // 检查电影是否已存在
      const existingMovie = await db.query.movies.findFirst({
        where: eq(moviesTable.code, code),
      })

      // 根据模式处理
      if (mode === 'insert' && existingMovie) {
        result.skipped++
        continue
      }

      if (mode === 'update' && !existingMovie) {
        result.skipped++
        continue
      }

      // 准备数据
      const moviePayload: Partial<Movie> = {
        code,
        title,
        slug: slug || code.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        coverImage: coverImage || null,
        releaseDate: releaseDate
          ? (typeof releaseDate === 'number'
              ? new Date(releaseDate * 1000) // Unix timestamp (秒) -> Date
              : typeof releaseDate === 'string'
                ? new Date(releaseDate)
                : releaseDate)
          : null,
        duration: duration || null,
        description: description || null,
        genres: genres ? JSON.stringify(genres) : null,
        actors: actorNames ? JSON.stringify(actorNames) : null,
        series: series || null, // 系列名
        publisher: publisher || null, // 真实厂商名
        isR18: isR18 || false,
        updatedAt: new Date(),
      }

      let movieId: string
      if (existingMovie) {
        // 更新现有电影
        await db.update(moviesTable)
          .set(moviePayload)
          .where(eq(moviesTable.id, existingMovie.id))
        movieId = existingMovie.id
        result.success++
      }
      else {
        // 插入新电影
        movieId = crypto.randomUUID()
        await db.insert(moviesTable).values({
          id: movieId,
          ...moviePayload,
          createdAt: new Date(),
        } as any)
        result.success++
      }

      // 写入演员关联（独立 try-catch，失败不影响影片元数据）
      if (actorNames && actorNames.length > 0) {
        try {
          await syncActors(db, movieId, actorNames, isR18 ?? false)
        }
        catch (actorErr) {
          console.warn(`[SyncService] ⚠️ 演员批量同步失败 (${code}):`, actorErr instanceof Error ? actorErr.message : String(actorErr))
        }
      }

      // 写入播放源（独立 try-catch，失败不影响影片元数据）
      if (players && players.length > 0) {
        try {
          // 去重：过滤空 sourceUrl，同一影片内 sourceUrl 唯一
          const seen = new Set<string>()
          const uniquePlayers = players.filter((p) => {
            if (!p.sourceUrl || seen.has(p.sourceUrl))
              return false
            seen.add(p.sourceUrl)
            return true
          })

          if (uniquePlayers.length > 0) {
            // 幂等写入：先删除现有 players，再批量插入
            await db.delete(playersTable).where(eq(playersTable.movieId, movieId))
            await db.insert(playersTable).values(
              uniquePlayers.map((p, idx) => ({
                id: crypto.randomUUID(),
                movieId,
                sourceName: p.sourceName,
                sourceUrl: p.sourceUrl,
                quality: p.quality ?? null,
                sortOrder: p.sortOrder ?? idx,
              })),
            )
            // 同步更新冗余计数字段
            await db.update(moviesTable)
              .set({ totalPlayers: uniquePlayers.length, updatedAt: new Date() })
              .where(eq(moviesTable.id, movieId))
          }
        }
        catch (playerError) {
          console.warn(`[SyncService] ⚠️ 写入播放源失败 (${code}):`, playerError instanceof Error ? playerError.message : String(playerError))
        }
      }
    }
    catch (error) {
      result.failed++
      result.errors.push({
        code: movieData.code,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}
