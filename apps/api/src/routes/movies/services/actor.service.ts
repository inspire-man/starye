import type { Database } from '@starye/db'
import { actors as actorsTable, movies as moviesTable } from '@starye/db/schema'
import { count, eq, sql } from 'drizzle-orm'
import { paginate } from '../../../services/query-builder'

export interface GetActorsOptions {
  db: Database
  page?: number
  pageSize?: number
}

export async function getActors(options: GetActorsOptions) {
  const { db, page = 1, pageSize = 50 } = options

  const [results, totalResult] = await Promise.all([
    paginate(
      db.query.actors.findMany({
        columns: {
          id: true,
          name: true,
          slug: true,
          avatar: true,
          movieCount: true,
        },
        orderBy: (actors, { desc }) => [desc(actors.movieCount)],
      }) as any,
      { page, pageSize },
    ),
    db.select({ value: count() }).from(actorsTable).then(res => res[0].value),
  ])

  return {
    data: results,
    meta: {
      total: totalResult,
      page,
      limit: pageSize,
      totalPages: Math.ceil(totalResult / pageSize),
    },
  }
}

export interface GetActorBySlugOptions {
  db: Database
  slug: string
  page?: number
  pageSize?: number
}

export async function getActorBySlug(options: GetActorBySlugOptions) {
  const { db, slug, page = 1, pageSize = 24 } = options

  const actor = await db.query.actors.findFirst({
    where: eq(actorsTable.slug, slug),
  })

  if (!actor) {
    return null
  }

  const [results, totalResult] = await Promise.all([
    db.query.movies.findMany({
      where: sql`${moviesTable.actors} LIKE ${`%${actor.name}%`}`,
      columns: {
        title: true,
        slug: true,
        code: true,
        coverImage: true,
        releaseDate: true,
        isR18: true,
        actors: true,
        genres: true,
      },
      orderBy: (movies, { desc }) => [desc(movies.releaseDate)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ value: count() })
      .from(moviesTable)
      .where(sql`${moviesTable.actors} LIKE ${`%${actor.name}%`}`)
      .then(res => res[0].value),
  ])

  return {
    data: {
      ...actor,
      movies: results,
    },
    meta: {
      total: totalResult,
      page,
      limit: pageSize,
      totalPages: Math.ceil(totalResult / pageSize),
    },
  }
}
