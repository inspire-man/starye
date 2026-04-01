import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { actors, comics, movies, publishers, user } from '@starye/db/schema'
import { eq } from 'drizzle-orm'

/**
 * 获取管理后台统计信息
 */
export async function getAdminStats(c: Context<AppEnv>) {
  const db = c.get('db')

  try {
    const [
      comicCount,
      movieCount,
      actorCount,
      publisherCount,
      userCount,
      crawlingMovies,
      crawlingComics,
      pendingActors,
      pendingPublishers,
    ] = await Promise.all([
      db.$count(comics),
      db.$count(movies),
      db.$count(actors),
      db.$count(publishers),
      db.$count(user),
      db.$count(movies, eq(movies.crawlStatus, 'partial')),
      db.$count(comics, eq(comics.crawlStatus, 'partial')),
      db.$count(actors, eq(actors.hasDetailsCrawled, false)),
      db.$count(publishers, eq(publishers.hasDetailsCrawled, false)),
    ])

    return c.json({
      comics: comicCount,
      movies: movieCount,
      actors: actorCount,
      publishers: publisherCount,
      users: userCount,
      crawling: {
        movies: crawlingMovies,
        comics: crawlingComics,
      },
      pending: {
        actors: pendingActors,
        publishers: pendingPublishers,
      },
    })
  }
  catch (error) {
    console.error('[Admin/Stats] Failed to get stats:', error)
    return c.json({
      comics: 0,
      movies: 0,
      actors: 0,
      publishers: 0,
      users: 0,
      crawling: { movies: 0, comics: 0 },
      pending: { actors: 0, publishers: 0 },
    })
  }
}
