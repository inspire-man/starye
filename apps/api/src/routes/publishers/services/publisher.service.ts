import type { Database } from '@starye/db'
import type { SQL } from 'drizzle-orm'
import { moviePublishers, movies, publishers } from '@starye/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'

interface PublisherListItem {
  id: string
  name: string
  slug: string
  logo: string | null
  country: string | null
  movieCount: number | null
  hasDetailsCrawled: boolean
}

export interface GetPublishersOptions {
  db: Database
  page?: number
  pageSize?: number
  sort?: 'name' | 'movieCount' | 'createdAt'
  country?: string
  hasDetails?: boolean
}

export interface GetPublishersResult {
  data: PublisherListItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function getPublishers(options: GetPublishersOptions): Promise<GetPublishersResult> {
  const {
    db,
    page = 1,
    pageSize = 20,
    sort = 'name',
    country,
    hasDetails,
  } = options

  // 构建查询条件
  const conditions: SQL[] = []
  if (country) {
    conditions.push(eq(publishers.country, country))
  }
  if (hasDetails !== undefined) {
    conditions.push(eq(publishers.hasDetailsCrawled, hasDetails))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // 确定排序字段
  let orderBy
  switch (sort) {
    case 'movieCount':
      orderBy = desc(publishers.movieCount)
      break
    case 'createdAt':
      orderBy = desc(publishers.createdAt)
      break
    case 'name':
    default:
      orderBy = publishers.name
  }

  const [results, totalResult] = await Promise.all([
    db.query.publishers.findMany({
      where: whereClause,
      orderBy,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      columns: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        country: true,
        movieCount: true,
        hasDetailsCrawled: true,
      },
    }),
    db
      .select({ value: count() })
      .from(publishers)
      .where(whereClause)
      .then(res => res[0]?.value || 0),
  ])

  return {
    data: results as PublisherListItem[],
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
}

export async function getPublisherBySlug(options: GetPublisherBySlugOptions) {
  const { db, slug } = options

  // 查找厂商
  const publisher = await db.query.publishers.findFirst({
    where: eq(publishers.slug, slug),
  })

  if (!publisher) {
    return null
  }

  // 查询关联电影（通过 movie_publishers 表）
  const relatedMoviesData = await db
    .select({
      id: movies.id,
      code: movies.code,
      title: movies.title,
      slug: movies.slug,
      coverImage: movies.coverImage,
      releaseDate: movies.releaseDate,
      duration: movies.duration,
      sortOrder: moviePublishers.sortOrder,
    })
    .from(moviePublishers)
    .innerJoin(movies, eq(moviePublishers.movieId, movies.id))
    .where(eq(moviePublishers.publisherId, publisher.id))
    .orderBy(desc(movies.releaseDate))
    .limit(100)

  return {
    ...publisher,
    relatedMovies: relatedMoviesData,
  }
}
