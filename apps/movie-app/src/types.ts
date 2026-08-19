export interface Movie {
  id: string
  code: string
  title: string
  slug: string
  coverImage?: string | null
  previewImages?: string[] | null
  description?: string | null
  releaseDate?: number | string | null
  duration?: number | null
  rating?: number | null
  isR18: boolean
  actors?: ActorSummary[]
  publishers?: PublisherSummary[]
  genres?: unknown
  series?: string | null
  sourceUrl?: string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
}

export interface ActorSummary {
  id: string
  name: string
  slug: string
  avatar?: string | null
}

export interface Actor extends ActorSummary {
  bio?: string
  birthDate?: number
  height?: number
  measurements?: string
  cupSize?: string
  bloodType?: string
  nationality?: string
  debutDate?: number
  isActive?: boolean
  retireDate?: number
  movieCount: number
  hasDetailsCrawled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ActorDetail extends Actor {
  relatedMovies: Array<{
    id: string
    code: string
    title: string
    slug: string
    coverImage?: string
    releaseDate?: number
    duration?: number
  }>
}

export interface PublisherSummary {
  id: string
  name: string
  slug: string
  logo?: string | null
}

export interface Publisher extends PublisherSummary {
  website?: string
  description?: string
  foundedYear?: number
  country?: string
  movieCount: number
  hasDetailsCrawled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PublisherDetail extends Publisher {
  relatedMovies: Array<{
    id: string
    code: string
    title: string
    slug: string
    coverImage?: string
    releaseDate?: number
    duration?: number
  }>
}

export interface Player {
  id: string
  movieId?: string
  sourceName: string
  sourceUrl: string
  source?: string
  quality?: string | null
  sortOrder: number
  magnetLink?: string
  // 评分相关字段
  averageRating?: number // 平均用户评分（DB 存储 0-100 整数）
  ratingCount?: number // 评分人数
  userScore?: number // 当前用户的评分 (1-5)
  // 上报相关字段
  reportCount?: number // 失效上报次数
  isActive?: boolean // 是否有效（超过阈值后为 false）
}

export type SourceDisposition = 'ready' | 'no_source' | 'source_failed' | 'repairing'
export type SourceReasonCode = 'no_eligible_source' | 'repair_requested' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'
export type PlaybackProofStatus = 'playback_verified' | 'unverified'

export interface MetadataProjection {
  contentId: string
  observedAt: number | null
  persisted: boolean
}

export interface SourceReadinessProjection {
  disposition: SourceDisposition
  eligibleCount: number
  observedAt: number
  reasonCode: SourceReasonCode | null
  repairable: boolean
  sourceRevision: number
}

export interface PlaybackProjection {
  evidence?: {
    currentTime: number
    observedAt?: number
  }
  status: PlaybackProofStatus
}

export interface ReceiptProjection {
  persisted: boolean
  primaryContentId: string | null
  schemaVersion: number | null
}

export interface ReadinessProjection {
  metadata: MetadataProjection
  playback: PlaybackProjection
  receipt: ReceiptProjection
  source: SourceReadinessProjection
}

export interface PlaybackEvidenceTuple {
  attemptNumber: number
  provider: 'github-actions' | 'local-proof'
  runId: string
  taskId: string
}

export interface MovieAvailabilityPlaybackTuple {
  attemptNumber: number
  provider: 'github-actions' | 'local-proof'
  runId: string
  taskId: string
}

export interface MovieAvailabilityReadback {
  current: {
    direct: MovieVideoLayerFact | null
    magnet: MovieVideoLayerFact | null
    metadata: {
      observedAt: number | null
      persisted: boolean
      sourceRevision: number
    }
    playback: {
      status: PlaybackProofStatus
      tuple: MovieAvailabilityPlaybackTuple | null
    }
  }
  history: readonly { fact: MovieVideoLayerFact, layer: 'direct' | 'magnet' }[]
}

export type MovieAvailabilityCommandReason
  = | 'no_source'
    | 'source_failed'
    | 'stale'
    | 'direct_blocked'
    | 'direct_transport_failed'
    | 'direct_content_invalid'
    | 'browser_inconclusive'
    | 'metadata_unresolved'
    | 'no_peer'
    | 'stalled'
    | 'stream_missing'
    | 'stream_failed'
    | 'playback_unverified'
    | 'playback_failed'

export type MovieAvailabilitySourceKind = 'direct' | 'magnet'

export interface MovieAvailabilityCommand {
  idempotencyKey: string
  movieId: string
  reason: MovieAvailabilityCommandReason
  sourceKind?: MovieAvailabilitySourceKind
}

export interface MovieAvailabilityCommandResponse {
  binding: {
    movieId: string
    movieRevision: number
    policyVersion: string
    sourceKind: MovieAvailabilitySourceKind | null
    sourceRevision: number
  }
  dispatch?: Record<string, unknown>
  kind: 'created' | 'duplicate' | 'existing_active_run'
  run: {
    attemptNumber: number
    id: string
    status: 'queued' | 'dispatching' | 'running' | 'cancel_requested' | 'succeeded' | 'failed' | 'cancelled'
    taskId: string
  }
}

export interface MovieVideoLayerFact {
  freshness: 'fresh' | 'stale' | 'late'
  observedAt: number
  policyVersion: string
  reasonCode: string
  sourceRevision: number
  status: 'available' | 'unavailable' | 'degraded' | 'unknown'
  summary: {
    counts: Readonly<Record<string, number>>
    samples: readonly string[]
  }
}

export interface PlaybackEvidenceRequest {
  contentId: string
  events: Array<{
    event: 'canplay' | 'playing' | 'waiting' | 'stalled' | 'error'
    observed: boolean
    observedAt: number | null
  }>
  observedAt: number
  playback: {
    canplay: boolean
    error: boolean
    playing: boolean
    progress: {
      currentTimeAfter: number
      currentTimeBefore: number
      currentTimeDelta: number
    }
    status: 'playback_verified'
  }
  provider: { provider: 'github-actions' | 'local-proof', status: 'succeeded' }
  repair: { sourceRevision: number, status: 'succeeded' }
  schemaVersion: 1
  source: { revision: number, sourceType: 'direct' | 'TorrServer', status: 'ready' }
  sourceRevision: number
  tuple: PlaybackEvidenceTuple
  viewer: { path: string, targetLabel: string }
}

export interface MovieDetail extends Movie {
  actors: ActorSummary[]
  publishers: PublisherSummary[]
  players?: Player[]
  relatedMovies: Array<{
    id: string
    code: string
    title: string
    slug: string
    coverImage: string | null
    isR18: boolean
    releaseDate?: number
    series?: string
  }>
  primaryContentId: string
  readiness: ReadinessProjection
  availability?: MovieAvailabilityReadback
}

export interface WatchingProgress {
  id: string
  contentType: 'movie'
  contentId: string
  movieCode: string
  position: number
  progress: number
  duration: number | null
  completed: boolean
  updatedAt: string
}

/** 观看历史条目（含影片详情，来自 GET /progress/watching 无参数时） */
export interface WatchingHistoryItem {
  id: string
  contentType: 'movie'
  contentId: string
  movieCode: string
  title: string
  coverImage: string | null
  isR18: boolean
  position: number
  progress: number
  duration: number | null
  completed: boolean
  updatedAt: string
}

/** Genre 聚合条目 */
export interface GenreItem {
  genre: string
  count: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface User {
  id: string
  email: string
  name: string
  image?: string
  isR18Verified: boolean
}

// 下载状态类型
export type DownloadStatus = 'planned' | 'downloading' | 'completed'

// 下载列表项接口
export interface DownloadListItem {
  movieId: string
  movieCode: string
  title: string
  coverImage?: string
  magnetLink?: string
  status: DownloadStatus
  addedAt: number
}

// Aria2 相关类型
export interface Aria2Config {
  rpcUrl: string
  secret?: string
  useProxy: boolean
}

export interface Aria2Task {
  gid: string
  status: Aria2Status
  totalLength: string
  completedLength: string
  uploadLength: string
  downloadSpeed: string
  uploadSpeed: string
  files?: Aria2File[]
  infoHash?: string
}

export type Aria2Status = 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed'

export interface Aria2File {
  index: string
  path: string
  length: string
  completedLength: string
  selected: string
}

// 评分相关类型
export interface Rating {
  id: string
  playerId: string
  userId: string
  score: number // 1-5
  createdAt: Date
  updatedAt: Date
}

export interface RatingStats {
  averageRating: number
  ratingCount: number
  distribution: RatingDistribution
}

export interface RatingDistribution {
  star1: number
  star2: number
  star3: number
  star4: number
  star5: number
}

export interface AutoScoreWeights {
  quality: number
  fileSize: number
  source: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface FavoriteEntity {
  name: string
  cover: string | null
  slug: string
}

export interface Favorite {
  id: string
  userId: string
  entityType: 'actor' | 'publisher' | 'movie' | 'comic'
  entityId: string
  createdAt: number
  entity?: FavoriteEntity | null
}

export interface SeriesDetail {
  name: string
  movieCount: number
  totalDuration: number
  minYear: number | null
  maxYear: number | null
  publisher: { name: string, slug: string | null } | null
  relatedSeries: string[]
}
