import type { Database } from '@starye/db'
import { comics as comicsTable } from '@starye/db/schema'
import { count, eq } from 'drizzle-orm'
import { FilterBuilder } from '../../../services/query-builder'

interface ComicListItem {
  title: string
  slug: string
  coverImage: string | null
  author: string | null
  description: string | null
  isR18: boolean
}

export interface GetComicsOptions {
  db: Database
  isAdult: boolean
  page?: number
  pageSize?: number
  region?: string
  genre?: string
  status?: 'serializing' | 'completed'
}

export interface GetComicsResult {
  data: ComicListItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function getComics(options: GetComicsOptions): Promise<GetComicsResult> {
  const {
    db,
    isAdult,
    page = 1,
    pageSize = 20,
    region,
    genre,
    status,
  } = options

  const whereClause = new FilterBuilder()
    .eq(comicsTable.region, region)
    .eq(comicsTable.status, status)
    .jsonContains(comicsTable.genres, genre)
    .build()

  const queryBuilder = db.query.comics.findMany({
    where: whereClause,
    columns: {
      title: true,
      slug: true,
      coverImage: true,
      author: true,
      description: true,
      isR18: true,
    },
    orderBy: (comics, { desc }) => [desc(comics.updatedAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })

  const [queryResults, countResult] = await Promise.all([
    queryBuilder as Promise<ComicListItem[]>,
    db.select({ value: count() }).from(comicsTable).where(whereClause).then(res => res[0]?.value ?? 0),
  ])

  const safeResults: ComicListItem[] = queryResults.map((comic) => {
    const needsProtection = comic.isR18 === true

    if (needsProtection && !isAdult) {
      return { ...comic, coverImage: null }
    }
    return comic
  })

  return {
    data: safeResults,
    meta: {
      total: countResult,
      page,
      limit: pageSize,
      totalPages: Math.ceil(countResult / pageSize),
    },
  }
}

export interface GetComicBySlugOptions {
  db: Database
  slug: string
  isAdult: boolean
}

export async function getComicBySlug(options: GetComicBySlugOptions) {
  const { db, slug, isAdult } = options

  const comic = await db.query.comics.findFirst({
    where: eq(comicsTable.slug, slug),
    with: {
      chapters: {
        columns: {
          title: true,
          slug: true,
          chapterNumber: true,
          publishedAt: true,
        },
        orderBy: (chapters, { asc }) => [asc(chapters.sortOrder)],
      },
    },
  })

  if (!comic) {
    return null
  }

  // R18 protection
  if (comic.isR18 && !isAdult) {
    return {
      ...comic,
      coverImage: null,
      chapters: [],
    }
  }

  return comic
}
