import type { Database } from '@starye/db'
import type { InferSelectModel } from 'drizzle-orm'
import { movies as moviesTable } from '@starye/db/schema'
import { count, eq } from 'drizzle-orm'
import { FilterBuilder } from '../../../services/query-builder'

// 使用 Drizzle 推导的基础类型
type Movie = InferSelectModel<typeof moviesTable>

// 定义查询结果的精确类型（基于实际查询的字段）
interface MovieListItem {
  id: string
  title: string
  slug: string
  code: string
  coverImage: string | null
  releaseDate: Date | null
  isR18: boolean
  actors: Array<{
    id: string
    name: string
    slug: string
    avatar: string | null
  }>
  publishers: Array<{
    id: string
    name: string
    slug: string
    logo: string | null
  }>
}

interface MovieDetailResult extends Omit<Movie, 'actors' | 'publishers'> {
  actors: Array<{
    id: string
    name: string
    slug: string
    avatar: string | null
  }>
  publishers: Array<{
    id: string
    name: string
    slug: string
    logo: string | null
  }>
  players?: Array<{
    id: string
    sourceName: string
    sourceUrl: string
    quality: string | null
    sortOrder: number
  }>
  relatedMovies: Array<{
    id: string
    code: string
    title: string
    slug: string
    coverImage: string | null
    isR18: boolean
  }>
}

export interface GetMoviesOptions {
  db: Database
  isAdult: boolean
  page?: number
  pageSize?: number
  genre?: string
  actor?: string
  publisherId?: string
  searchKeyword?: string
}

export interface GetMoviesResult {
  data: MovieListItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function getMovies(options: GetMoviesOptions): Promise<GetMoviesResult> {
  const {
    db,
    isAdult,
    page = 1,
    pageSize = 24,
    genre,
    actor,
    publisherId,
    searchKeyword,
  } = options

  const whereClause = new FilterBuilder()
    .jsonContains(moviesTable.genres, genre)
    .jsonContains(moviesTable.actors, actor)
    .eq(moviesTable.id, publisherId)
    .like(moviesTable.title, searchKeyword)
    .build()

  const queryBuilder = db.query.movies.findMany({
    where: whereClause,
    columns: {
      id: true,
      title: true,
      slug: true,
      code: true,
      coverImage: true,
      releaseDate: true,
      isR18: true,
    },
    with: {
      movieActors: {
        with: {
          actor: {
            columns: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
        },
        orderBy: (movieActors, { asc }) => [asc(movieActors.sortOrder)],
      },
      moviePublishers: {
        with: {
          publisher: {
            columns: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
      },
    },
    orderBy: (movies, { desc }) => [desc(movies.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })

  const [queryResults, countResult] = await Promise.all([
    queryBuilder as Promise<Array<{
      id: string
      title: string
      slug: string
      code: string
      coverImage: string | null
      releaseDate: Date | null
      isR18: boolean
      movieActors?: Array<{ actor: { id: string, name: string, slug: string, avatar: string | null } }>
      moviePublishers?: Array<{ publisher: { id: string, name: string, slug: string, logo: string | null } }>
    }>>,
    db.select({ value: count() }).from(moviesTable).where(whereClause).then(res => res[0]?.value ?? 0),
  ])

  const safeResults: MovieListItem[] = queryResults.map((movie) => {
    const actorsData = movie.movieActors?.map(ma => ma.actor).filter(Boolean) || []
    const publishersData = movie.moviePublishers?.map(mp => mp.publisher).filter(Boolean) || []

    if (movie.isR18 && !isAdult) {
      return {
        id: movie.id,
        title: movie.title,
        slug: movie.slug,
        code: movie.code,
        coverImage: null,
        releaseDate: movie.releaseDate,
        isR18: movie.isR18,
        actors: actorsData,
        publishers: publishersData,
      }
    }

    return {
      id: movie.id,
      title: movie.title,
      slug: movie.slug,
      code: movie.code,
      coverImage: movie.coverImage,
      releaseDate: movie.releaseDate,
      isR18: movie.isR18,
      actors: actorsData,
      publishers: publishersData,
    }
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

export interface GetMovieByIdentifierOptions {
  db: Database
  identifier: string
  isAdult: boolean
}

export async function getMovieByIdentifier(options: GetMovieByIdentifierOptions): Promise<MovieDetailResult | null> {
  const { db, identifier, isAdult } = options

  const movie = await db.query.movies.findFirst({
    where: (movies, { eq, or }) => or(
      eq(movies.code, identifier),
      eq(movies.slug, identifier),
    ),
    with: {
      players: {
        orderBy: (players, { asc }) => [asc(players.sortOrder)],
      },
      movieActors: {
        with: {
          actor: {
            columns: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
        },
        orderBy: (movieActors, { asc }) => [asc(movieActors.sortOrder)],
      },
      moviePublishers: {
        with: {
          publisher: {
            columns: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
      },
    },
  })

  if (!movie) {
    return null
  }

  const actorsData = (movie.movieActors || [])
    .map(ma => ma.actor)
    .filter((actor): actor is NonNullable<typeof actor> => actor !== null && actor.id !== undefined)

  const publishersData = (movie.moviePublishers || [])
    .map(mp => mp.publisher)
    .filter((publisher): publisher is NonNullable<typeof publisher> => publisher !== null && publisher.id !== undefined)

  const relatedMoviesQuery = []

  if (movie.series) {
    relatedMoviesQuery.push(
      db.query.movies.findMany({
        where: (movies, { eq, and, not }) => and(
          eq(movies.series, movie.series!),
          not(eq(movies.id, movie.id)),
        ),
        columns: {
          id: true,
          code: true,
          title: true,
          slug: true,
          coverImage: true,
          isR18: true,
        },
        limit: 6,
      }),
    )
  }

  if (actorsData.length > 0) {
    const actorIds = actorsData.map(a => a.id)
    relatedMoviesQuery.push(
      db.query.movieActors.findMany({
        where: (movieActors, { inArray, not, and }) => and(
          inArray(movieActors.actorId, actorIds),
          not(eq(movieActors.movieId, movie.id)),
        ),
        with: {
          movie: {
            columns: {
              id: true,
              code: true,
              title: true,
              slug: true,
              coverImage: true,
              isR18: true,
            },
          },
        },
        limit: 6,
      }),
    )
  }

  const relatedResults = await Promise.all(relatedMoviesQuery)

  const relatedMoviesMap = new Map<string, {
    id: string
    code: string
    title: string
    slug: string
    coverImage: string | null
    isR18: boolean
  }>()

  for (const result of relatedResults.flat()) {
    const movieData = 'movie' in result ? result.movie : result
    if (movieData && !relatedMoviesMap.has(movieData.id)) {
      relatedMoviesMap.set(movieData.id, movieData)
    }
  }

  const relatedMovies = Array.from(relatedMoviesMap.values())
    .slice(0, 12)
    .filter(m => !m.isR18 || isAdult)

  if (movie.isR18 && !isAdult) {
    return {
      ...movie,
      coverImage: null,
      players: [],
      actors: actorsData,
      publishers: publishersData,
      relatedMovies,
    }
  }

  return {
    ...movie,
    actors: actorsData,
    publishers: publishersData,
    relatedMovies,
  }
}

export interface GetHotMoviesOptions {
  db: Database
  isAdult: boolean
  limit?: number
}

export async function getHotMovies(options: GetHotMoviesOptions): Promise<MovieListItem[]> {
  const { db, isAdult, limit = 12 } = options

  const movies = await db.query.movies.findMany({
    columns: {
      id: true,
      code: true,
      title: true,
      slug: true,
      coverImage: true,
      releaseDate: true,
      isR18: true,
    },
    with: {
      movieActors: {
        with: {
          actor: {
            columns: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
            },
          },
        },
        orderBy: (movieActors, { asc }) => [asc(movieActors.sortOrder)],
      },
      moviePublishers: {
        with: {
          publisher: {
            columns: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
      },
    },
    orderBy: (movies, { desc }) => [desc(movies.createdAt)],
    limit,
  })

  return movies.map((movie): MovieListItem => {
    const actorsData = movie.movieActors?.map(ma => ma.actor).filter(Boolean) || []
    const publishersData = movie.moviePublishers?.map(mp => mp.publisher).filter(Boolean) || []

    if (movie.isR18 && !isAdult) {
      return {
        id: movie.id,
        title: movie.title,
        slug: movie.slug,
        code: movie.code,
        coverImage: null,
        releaseDate: movie.releaseDate,
        isR18: movie.isR18,
        actors: actorsData,
        publishers: publishersData,
      }
    }

    return {
      id: movie.id,
      title: movie.title,
      slug: movie.slug,
      code: movie.code,
      coverImage: movie.coverImage,
      releaseDate: movie.releaseDate,
      isR18: movie.isR18,
      actors: actorsData,
      publishers: publishersData,
    }
  })
}
