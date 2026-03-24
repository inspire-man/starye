import type { Database } from '@starye/db'
import { movies as moviesTable, publishers as publishersTable } from '@starye/db/schema'
import { count, eq } from 'drizzle-orm'
import { paginate } from '../../../services/query-builder'

export interface GetPublishersOptions {
  db: Database
  page?: number
  pageSize?: number
}

export async function getPublishers(options: GetPublishersOptions) {
  const { db, page = 1, pageSize = 50 } = options

  const [results, totalResult] = await Promise.all([
    paginate(
      db.query.publishers.findMany({
        columns: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          movieCount: true,
        },
        orderBy: (publishers, { desc }) => [desc(publishers.movieCount)],
      }) as any,
      { page, pageSize },
    ),
    db.select({ value: count() }).from(publishersTable).then(res => res[0].value),
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

export interface GetPublisherBySlugOptions {
  db: Database
  slug: string
  page?: number
  pageSize?: number
}

export async function getPublisherBySlug(options: GetPublisherBySlugOptions) {
  const { db, slug, page = 1, pageSize = 24 } = options

  const publisher = await db.query.publishers.findFirst({
    where: eq(publishersTable.slug, slug),
  })

  if (!publisher) {
    return null
  }

  const [results, totalResult] = await Promise.all([
    db.query.movies.findMany({
      where: eq(moviesTable.publisher, publisher.name),
      columns: {
        title: true,
        slug: true,
        code: true,
        coverImage: true,
        releaseDate: true,
        isR18: true,
        actors: true,
        genres: true,
        publisher: true,
      },
      orderBy: (movies, { desc }) => [desc(movies.releaseDate)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ value: count() })
      .from(moviesTable)
      .where(eq(moviesTable.publisher, publisher.name))
      .then(res => res[0].value),
  ])

  return {
    data: {
      ...publisher,
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
