import type { Database } from '@starye/db'
import type { InferSelectModel } from 'drizzle-orm'
import { movies as moviesTable } from '@starye/db/schema'
import { eq } from 'drizzle-orm'

// 使用 Drizzle 推导的基础类型
type Movie = InferSelectModel<typeof moviesTable>

// ... existing interfaces and functions ...

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
      const { code, title, slug, coverImage, releaseDate, duration, description, genres, actors: actorNames, series, publisher, isR18 } = movieData

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

      if (existingMovie) {
        // 更新现有电影
        await db.update(moviesTable)
          .set(moviePayload)
          .where(eq(moviesTable.id, existingMovie.id))
        result.success++
      }
      else {
        // 插入新电影
        await db.insert(moviesTable).values({
          id: crypto.randomUUID(),
          ...moviePayload,
          createdAt: new Date(),
        } as any)
        result.success++
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
