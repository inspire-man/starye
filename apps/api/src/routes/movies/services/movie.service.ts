import type { Database } from '@starye/db'
import type { InferSelectModel } from 'drizzle-orm'
import { movies as moviesTable } from '@starye/db/schema'
import { count, desc, eq } from 'drizzle-orm'
import { createAvailabilityRepository } from '../../../domain/crawler-tasks/availability-repository'
import { createServerReadinessProjection } from '../../../domain/movies/source-contract'
import { createPlaybackEvidenceRepository } from '../../../domain/playback-evidence/repository'
import { VIDEO_PROBE_POLICY_V1 } from '../../../domain/video-availability/probe-policy'
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
  availability: MovieAvailabilityReadback
  primaryContentId: string
  readiness: ReturnType<typeof createServerReadinessProjection>
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
    averageRating?: number
    ratingCount?: number
    userScore?: number
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

interface VideoLayerFact {
  readonly freshness: 'fresh' | 'stale' | 'late'
  readonly observedAt: number
  readonly policyVersion: string
  readonly reasonCode: string
  readonly sourceRevision: number
  readonly status: 'available' | 'unavailable' | 'degraded' | 'unknown'
  readonly summary: { readonly counts: Readonly<Record<string, number>>, readonly samples: readonly string[] }
}

interface AvailabilityBinding {
  readonly attemptNumber: number
  readonly metadataObservedAt: number | null
  readonly policyVersion: string
  readonly provider: 'github-actions'
  readonly reason: string
  readonly runId: string
  readonly sourceRevision: number
  readonly taskId: string
  readonly playbackEvidence?: unknown
}

export interface MovieAvailabilityReadback {
  readonly current: {
    readonly direct: VideoLayerFact | null
    readonly magnet: VideoLayerFact | null
    readonly metadata: { readonly observedAt: number | null, readonly persisted: boolean, readonly sourceRevision: number }
    readonly playback: {
      readonly status: 'playback_verified' | 'unverified'
      readonly tuple: { readonly attemptNumber: number, readonly provider: 'github-actions', readonly runId: string, readonly taskId: string } | null
    }
  }
  readonly history: readonly ({ readonly layer: 'direct' | 'magnet', readonly fact: VideoLayerFact })[]
}

function emptyAvailability(sourceRevision: number): MovieAvailabilityReadback {
  return {
    current: {
      direct: null,
      magnet: null,
      metadata: { observedAt: null, persisted: false, sourceRevision },
      playback: { status: 'unverified', tuple: null },
    },
    history: [],
  }
}

function asVideoFact(observation: any): VideoLayerFact {
  return {
    freshness: observation.freshness,
    observedAt: observation.observedAt,
    policyVersion: observation.policyVersion,
    reasonCode: observation.reasonCode,
    sourceRevision: observation.sourceRevision,
    status: observation.status,
    summary: observation.summary,
  }
}

async function readAvailabilityBinding(db: Database, contentId: string, sourceRevision: number): Promise<AvailabilityBinding | null> {
  const client = (db as any).$client
  if (!client?.prepare)
    return null
  const rows = await client.prepare(`
    SELECT task.id AS task_id, task.request_snapshot_json, run.id AS run_id,
      run.attempt_number, run.receipt_schema_version, run.receipt_summary_json,
      provider.provider
    FROM crawler_task AS task
    INNER JOIN crawler_run AS run ON run.id = task.latest_run_id
    INNER JOIN crawler_run_provider_association AS provider
      ON provider.run_id = run.id AND provider.application_attempt = run.attempt_number
    WHERE run.receipt_primary_content_id = ? AND run.receipt_source_revision = ?
      AND run.status = 'succeeded' AND provider.provider = 'github-actions'
    ORDER BY run.created_at DESC
    LIMIT 1
  `).bind(contentId, sourceRevision).all() as { readonly results?: readonly {
    readonly attempt_number: number
    readonly provider: string
    readonly receipt_schema_version: number | null
    readonly receipt_summary_json: string | null
    readonly request_snapshot_json: string
    readonly run_id: string
    readonly task_id: string
  }[] }
  const row = rows.results?.[0]
  if (!row)
    return null
  try {
    const snapshot = JSON.parse(row.request_snapshot_json) as Record<string, unknown>
    const intent = snapshot.intent && typeof snapshot.intent === 'object' && !Array.isArray(snapshot.intent)
      ? snapshot.intent as Record<string, unknown>
      : snapshot
    const target = snapshot.target && typeof snapshot.target === 'object' && !Array.isArray(snapshot.target)
      ? snapshot.target as Record<string, unknown>
      : { id: snapshot.movieId, kind: 'movie' }
    const policyVersion = typeof snapshot.policyVersion === 'string' ? snapshot.policyVersion : intent.policyVersion
    if (intent.sourceRevision !== sourceRevision
      || typeof policyVersion !== 'string'
      || typeof intent.reason !== 'string'
      || target.id !== contentId
      || target.kind !== 'movie') {
      return null
    }
    const receipt = row.receipt_summary_json ? JSON.parse(row.receipt_summary_json) as Record<string, unknown> : null
    const metadataObservedAt = row.receipt_schema_version !== null
      && receipt
      && receipt.sourceRevision === sourceRevision
      && (receipt.movieId === contentId || receipt.primaryContentId === contentId)
      && typeof receipt.observedAt === 'number'
      && Number.isSafeInteger(receipt.observedAt)
      && receipt.observedAt >= 0
      ? receipt.observedAt
      : null
    return {
      attemptNumber: row.attempt_number,
      metadataObservedAt,
      policyVersion,
      provider: 'github-actions',
      reason: intent.reason,
      runId: row.run_id,
      sourceRevision,
      taskId: row.task_id,
    }
  }
  catch {
    return null
  }
}

async function readMovieAvailability(db: Database, contentId: string, sourceRevision: number): Promise<MovieAvailabilityReadback> {
  const binding = await readAvailabilityBinding(db, contentId, sourceRevision)
  if (!binding)
    return emptyAvailability(sourceRevision)
  const [availability, evidence] = await Promise.all([
    createAvailabilityRepository(db).readAuthoritative({
      contentId,
      historyLimit: 20,
      policyVersion: binding.policyVersion || VIDEO_PROBE_POLICY_V1.version,
      sourceRevision,
      target: { id: contentId, kind: 'movie' },
    }),
    createPlaybackEvidenceRepository(db).getTaskEvidence(binding.taskId),
  ])
  const magnetReasons = new Set(['provider_unconfigured', 'provider_failed', 'metadata_unresolved', 'no_peer', 'stalled', 'stream_missing', 'stream_failed'])
  const layer = magnetReasons.has(binding.reason) ? 'magnet' : 'direct'
  const currentFact = availability.current ? asVideoFact(availability.current) : null
  const playback = evidence.runs.find(run => run.runId === binding.runId)?.summary ?? null
  const playbackVerified = playback?.sourceRevision === sourceRevision && playback.playback.status === 'playback_verified'
  return {
    current: {
      direct: layer === 'direct' ? currentFact : null,
      magnet: layer === 'magnet' ? currentFact : null,
      metadata: { observedAt: binding.metadataObservedAt, persisted: binding.metadataObservedAt !== null, sourceRevision },
      playback: {
        status: playbackVerified ? 'playback_verified' : 'unverified',
        tuple: { attemptNumber: binding.attemptNumber, provider: binding.provider, runId: binding.runId, taskId: binding.taskId },
      },
    },
    history: availability.history.map(observation => ({ fact: asVideoFact(observation), layer })),
  }
}

export interface GetMoviesOptions {
  db: Database
  isAdult: boolean
  page?: number
  pageSize?: number
  genre?: string
  actor?: string
  publisher?: string
  searchKeyword?: string
  sortBy?: 'releaseDate' | 'createdAt' | 'updatedAt' | 'title'
  sortOrder?: 'asc' | 'desc'
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

function buildMovieOrderBy(sortBy?: string, sortOrder?: string) {
  const column = {
    releaseDate: moviesTable.releaseDate,
    createdAt: moviesTable.createdAt,
    updatedAt: moviesTable.updatedAt,
    title: moviesTable.title,
  }[sortBy ?? ''] ?? moviesTable.createdAt

  return sortOrder === 'asc' ? column : desc(column)
}

export async function getMovies(options: GetMoviesOptions): Promise<GetMoviesResult> {
  const {
    db,
    isAdult,
    page = 1,
    pageSize = 24,
    genre,
    actor,
    publisher,
    searchKeyword,
    sortBy,
    sortOrder,
  } = options

  const whereClause = new FilterBuilder()
    .jsonContains(moviesTable.genres, genre)
    .jsonContains(moviesTable.actors, actor)
    .like(moviesTable.publisher, publisher)
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
    orderBy: buildMovieOrderBy(sortBy, sortOrder),
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
  userId?: string
}

export async function getMovieByIdentifier(options: GetMovieByIdentifierOptions): Promise<MovieDetailResult | null> {
  const { db, identifier, isAdult, userId } = options

  const movie = await db.query.movies.findFirst({
    where: (movies, { eq, or }) => or(
      eq(movies.code, identifier),
      eq(movies.slug, identifier),
    ),
    with: {
      players: {
        columns: {
          id: true,
          sourceName: true,
          sourceUrl: true,
          quality: true,
          sortOrder: true,
          averageRating: true,
          ratingCount: true,
          reportCount: true,
          isActive: true,
        },
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
      sourceState: {
        columns: {
          disposition: true,
          eligibleCount: true,
          observedAt: true,
          reasonCode: true,
          repairable: true,
          sourceRevision: true,
        },
      },
    },
  })

  if (!movie) {
    return null
  }

  const sourceRevision = movie.sourceState?.sourceRevision ?? 0
  const availability = await readMovieAvailability(db, movie.id, sourceRevision)
  const playbackTuple = availability.current.playback.tuple
  const playbackEvidence = playbackTuple
    ? (await createPlaybackEvidenceRepository(db).getTaskEvidence(playbackTuple.taskId)).runs.find(run => run.runId === playbackTuple.runId)?.summary
    : undefined
  const readiness = createServerReadinessProjection({
    contentId: movie.id,
    metadata: availability.current.metadata,
    playbackEvidence,
    sourceState: movie.sourceState,
  })

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

  // 如果有 userId，查询用户对播放源的评分
  let userScores: Map<string, number> | undefined
  if (userId && movie.players && movie.players.length > 0) {
    const playerIds = movie.players.map(p => p.id)
    await import('@starye/db/schema')
    const userRatings = await db.query.ratings.findMany({
      where: (ratings, { and, eq, inArray }) => and(
        eq(ratings.userId, userId),
        inArray(ratings.playerId, playerIds),
      ),
      columns: {
        playerId: true,
        score: true,
      },
    })

    userScores = new Map(userRatings.map(r => [r.playerId, r.score]))
  }

  // 构建 players 数据（包含评分和上报信息）
  const playersWithRatings = movie.players?.map(player => ({
    id: player.id,
    sourceName: player.sourceName,
    sourceUrl: player.sourceUrl,
    quality: player.quality,
    sortOrder: player.sortOrder,
    averageRating: player.averageRating || undefined,
    ratingCount: player.ratingCount || undefined,
    userScore: userScores?.get(player.id),
    reportCount: player.reportCount || undefined,
    isActive: player.isActive ?? true,
  }))

  if (movie.isR18 && !isAdult) {
    const { sourceState: _sourceState, ...movieData } = movie
    return {
      ...movieData,
      availability,
      primaryContentId: movie.id,
      readiness,
      coverImage: null,
      players: [],
      actors: actorsData,
      publishers: publishersData,
      relatedMovies,
    }
  }

  const { sourceState: _sourceState, ...movieData } = movie
  return {
    ...movieData,
    availability,
    primaryContentId: movie.id,
    readiness,
    players: playersWithRatings ?? [],
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
    orderBy: (movies, { desc }) => [desc(movies.sortOrder), desc(movies.viewCount), desc(movies.createdAt)],
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
