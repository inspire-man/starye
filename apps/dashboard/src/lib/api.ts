import type { ManualUploadPurpose } from '@starye/api-types'
import type { User } from 'better-auth'
import { credentialFetch } from './hono-rpc-client'

// API_BASE 用于 upload 等特殊场景
export const API_BASE = '/api'

/** 通用 JSON fetch — 使用 credentialFetch 确保携带 Cookie 凭证 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await credentialFetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string }
    throw new Error(error.message || `Request failed with status ${res.status}`)
  }

  return res.json()
}

/** fetchApi 向后兼容别名（与 apiFetch 等效） */
export const fetchApi = apiFetch

// ─── 公用类型 ────────────────────────────────────────────────────────────────

export interface Comic {
  id: string
  title: string
  slug: string
  coverImage: string | null
  author: string | null
  description: string | null
  isR18?: boolean
  metadataLocked?: boolean
  status?: 'serializing' | 'completed'
  crawlStatus?: 'pending' | 'partial' | 'complete'
  chapterCount?: number | null
  region?: string | null
  genres?: string[] | null
  createdAt?: string
  updatedAt?: string
}

export interface Chapter {
  id: string
  title: string
  slug: string
  sortOrder: number
  sourcePageCount?: number | null
  pages?: { id: string, imageUrl: string, pageNumber: number }[]
}

export interface Movie {
  id: string
  title: string
  slug: string
  code: string
  description?: string | null
  coverImage?: string | null
  releaseDate?: string | null
  duration?: number | null
  actors?: (string | { id: string, name: string })[] | null
  actorNames?: string[] | null
  publishers?: (string | { id: string, name: string })[] | null
  publisherNames?: string[] | null
  genres?: string[] | null
  series?: string | null
  publisher?: string | null
  isR18: boolean
  metadataLocked?: boolean
  sortOrder?: number
  crawlStatus?: 'pending' | 'partial' | 'complete'
  lastCrawledAt?: string | null
  totalPlayers?: number
  crawledPlayers?: number
  createdAt?: string
  updatedAt?: string
  movieActors?: Array<{ sortOrder: number, actor?: { id: string, name: string } }>
  moviePublishers?: Array<{ sortOrder: number, publisher?: { id: string, name: string } }>
}

export interface HotMovieItem {
  id: string
  code: string
  title: string
  coverImage: string | null
  viewCount: number
  isR18: boolean
}

export interface GenreDistributionItem {
  genre: string
  count: number
}

export interface MovieAnalytics {
  hotMovies: HotMovieItem[]
  genreDistribution: GenreDistributionItem[]
}

export interface Player {
  id: string
  movieId: string
  sourceName: string
  sourceUrl: string
  quality?: string | null
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface Actor {
  id: string
  name: string
  slug: string
  avatar?: string | null
  bio?: string | null
  movieCount: number
  hasDetailsCrawled: boolean
  sourceUrl?: string | null
  nationality?: string | null
  birthDate?: number | null
  height?: number | null
  measurements?: string | null
  cupSize?: string | null
  bloodType?: string | null
  debutDate?: number | null
  isActive?: boolean | null
  crawlFailureCount?: number
  aliases?: string[] | null
  twitter?: string | null
  instagram?: string | null
  blog?: string | null
  wikiUrl?: string | null
  createdAt?: number | null
  updatedAt?: number | null
}

export interface Publisher {
  id: string
  name: string
  slug: string
  logo?: string | null
  website?: string | null
  movieCount: number
  hasDetailsCrawled: boolean
  sourceUrl?: string | null
  country?: string | null
  foundedYear?: number | null
  description?: string | null
  crawlFailureCount?: number
  twitter?: string | null
  instagram?: string | null
  wikiUrl?: string | null
  parentPublisher?: string | null
  brandSeries?: string[] | null
  createdAt?: number | null
  updatedAt?: number | null
}

export interface AuditLog {
  id: string
  userId: string
  userEmail: string
  action: string
  resourceType: string
  resourceId?: string | null
  resourceIdentifier?: string | null
  affectedCount: number
  changes?: any
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface UploadResponse {
  id: string
  url: string
  key: string
  size: number
  mimeType: string
}

export interface Paginated<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type CrawlerTaskTemplate = 'movie' | 'manga'
export type CrawlerRunStatus = 'queued' | 'dispatching' | 'running' | 'cancel_requested' | 'succeeded' | 'failed' | 'cancelled'
export type CrawlerSourceDisposition = 'ready' | 'no_source' | 'source_failed' | 'repairing'
export type CrawlerSourceReasonCode = 'no_eligible_source' | 'repair_requested' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'
export type CrawlerSourceType = 'direct' | 'magnet' | 'TorrServer'
export type CrawlerSourceHealth = 'inactive' | 'unverified' | 'failed'
export type CrawlerSourceHealthReasonCode = 'source_inactive' | 'source_unverified' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'
export type CrawlerRepairReason = 'no_source' | 'source_failed'
export type CrawlerRepairTargetIntent = 'restore_playable_sources'
export type CrawlerRepairNextAction = 'none' | 'wait_for_observation' | 'create_new_task'
export type CrawlerLeaseOutcome = 'pending' | 'active' | 'renewed' | 'released' | 'expired' | 'recovered'
export type CrawlerReconciliationWindowStatus = 'pending' | 'open' | 'closed' | 'expired'
export type CrawlerReconciliationOutcome = 'pending' | 'observed' | 'failed' | 'lost' | 'late' | 'stale' | 'ignored' | 'duplicate' | 'conflict'
export type CrawlerRepairFactStatus = 'pending' | 'validated' | 'failed'
export type CrawlerAttemptOutcome = 'pending' | 'accepted' | 'contract_failure' | 'duplicate' | 'stale' | 'late' | 'ignored' | 'conflict' | 'receipt_failure'
export type CrawlerPlaybackEvidenceProvider = 'github-actions'
export type CrawlerPlaybackEvidenceSourceType = 'direct' | 'TorrServer' | 'Aria2'
export type CrawlerPlaybackEventName = 'canplay' | 'playing' | 'waiting' | 'stalled' | 'error'
export type CrawlerPlaybackEvidenceOutcome = 'accepted' | 'checkpoint' | 'failed' | 'duplicate' | 'conflict' | 'stale' | 'late' | 'ignored'
export type CrawlerPlaybackProviderStatus = 'pending' | 'succeeded' | 'failed' | 'checkpoint'
export type CrawlerPlaybackRepairStatus = 'pending' | 'validated' | 'succeeded' | 'failed' | 'checkpoint'
export type CrawlerPlaybackSourceStatus = 'ready' | 'failed' | 'checkpoint'
export type CrawlerPlaybackStatus = 'playback_verified' | 'failed' | 'checkpoint'
export type CrawlerPlaybackRejectionOutcome = 'duplicate' | 'conflict' | 'stale' | 'late' | 'ignored'
export type CrawlerTaskLifecycleStatus = 'active' | 'archived' | 'superseded'
export type CrawlerAvailabilityFreshness = 'fresh' | 'stale' | 'late'
export type CrawlerAvailabilityStatus = 'available' | 'unavailable' | 'degraded' | 'unknown'
export type CrawlerAvailabilityNextAction = 'none' | 'recheck' | 'repair' | 'retry' | 'ignore'
export type CrawlerAvailabilityReasonCode = 'available' | 'no_source' | 'source_failed' | 'transport_failed' | 'content_missing' | 'policy_mismatch' | 'cancelled' | 'provider_failed' | 'observation_invalid'
export type CrawlerAvailabilityOutcome = 'accepted' | 'duplicate' | 'stale' | 'late' | 'conflict' | 'rejected'

export interface CrawlerTaskLifecycleProjection {
  changedAt: number
  status: CrawlerTaskLifecycleStatus
  supersededByTaskId?: string
  version: number
}

export interface CrawlerAvailabilityEvidenceSample {
  code: string
  count?: number
  label?: string
}

export interface CrawlerAvailabilityEvidence {
  counts: Record<string, number>
  samples: CrawlerAvailabilityEvidenceSample[]
}

export interface CrawlerAvailabilityObservation {
  attemptNumber: number
  contentId: string
  eventSequence: number
  freshness: CrawlerAvailabilityFreshness
  nextAction: CrawlerAvailabilityNextAction
  observationIdentity: string
  observedAt: number
  policyVersion: string
  provider: CrawlerPlaybackEvidenceProvider
  reasonCode: CrawlerAvailabilityReasonCode
  runId: string
  sourceRevision: number
  status: CrawlerAvailabilityStatus
  summary: CrawlerAvailabilityEvidence
  target: { id: string, kind: 'chapter' | 'image' | 'manga' | 'movie' | 'video' }
  taskId: string
}

export interface CrawlerAvailabilityProjection extends CrawlerAvailabilityObservation {
  projectionVersion: number
}

export interface CrawlerAvailabilityHistoryEntry {
  kind: CrawlerAvailabilityOutcome
  observation: CrawlerAvailabilityObservation | null
  reason?: string
}

export interface CrawlerAvailabilityTaskProjection {
  current: CrawlerAvailabilityProjection | null
  history: CrawlerAvailabilityHistoryEntry[]
  layers?: Record<CrawlerVideoLayerName, CrawlerVideoLayerProjection>
  observations?: CrawlerAvailabilityObservation[]
}

export type CrawlerVideoLayerName = 'metadata' | 'direct' | 'magnet' | 'playback'

export interface CrawlerVideoLayerFact {
  freshness: CrawlerAvailabilityFreshness
  layer: CrawlerVideoLayerName
  observedAt: number
  policyVersion: string
  reason: string | null
  sourceRevision: number
  status: CrawlerAvailabilityStatus
  summary: CrawlerAvailabilityEvidence
}

export interface CrawlerVideoLayerProjection {
  current: CrawlerVideoLayerFact | null
  history: CrawlerVideoLayerFact[]
}

export interface CrawlerTaskAudit {
  action: string
  actor: { email: string, id: string }
  attemptNumber?: number
  createdAt: number
  id: string
  outcome: string
  reason: string
  runId?: string
  snapshotFingerprint?: string
  target?: { id: string, kind: string }
}

export interface CrawlerTaskAuditPage {
  audits: CrawlerTaskAudit[]
  nextCursor: string | null
}

export interface CrawlerTaskMetadataUpdate {
  description?: string
  intent?: string
}

export interface CrawlerTaskSupersedeCommand {
  idempotencyKey: string
  intent: { kind: 'crawl' } | { kind: 'repair_players', reason: CrawlerRepairReason, sourceRevision: number, targetIntent: CrawlerRepairTargetIntent }
  operation: CrawlerTaskTemplate | 'repair_players'
  policyReference: string
  policyVersion: string
  target: { id: string, kind: CrawlerTaskTemplate }
}

export interface MetadataProjection {
  contentId: string
  observedAt: number | null
  persisted: boolean
}

export interface SourceReadinessProjection {
  disposition: CrawlerSourceDisposition
  eligibleCount: number
  observedAt: number
  reasonCode: CrawlerSourceReasonCode | null
  repairable: boolean
  sourceRevision: number
}

export interface PlaybackProjection {
  evidence?: {
    currentTime: number
    observedAt?: number
  }
  status: 'playback_verified' | 'unverified'
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

export interface CrawlerRunReceipt {
  createdCount: number
  primaryContentId: string
  receiptSchemaVersion?: number
  source?: SourceReadinessProjection
  templateKey: CrawlerTaskTemplate
  updatedCount: number
}

export interface CrawlerSourceHealthRow {
  eligible: boolean
  health: CrawlerSourceHealth
  observedAt: number
  reasonCode: CrawlerSourceHealthReasonCode
  sourceType: CrawlerSourceType
}

export interface CrawlerRepairReceipt {
  movieId: string
  observedAt: number
  operation: 'repair_players'
  sourceRevision: number
  sourceSummary: CrawlerSourceHealthRow[]
  summary: {
    eligibleCount: number
    sourceCount: number
  }
}

export type CrawlerReceipt = CrawlerRunReceipt | CrawlerRepairReceipt

export interface CrawlerRepairCommand {
  confirmed: true
  movieId: string
  reason: CrawlerRepairReason
  targetIntent: CrawlerRepairTargetIntent
}

export interface CrawlerPlaybackEvidenceTuple {
  attemptNumber: number
  provider: CrawlerPlaybackEvidenceProvider
  runId: string
  taskId: string
}

export interface CrawlerPlaybackEvidenceEvent {
  event: CrawlerPlaybackEventName
  observed: boolean
  observedAt: number | null
}

export interface CrawlerPlaybackEvidenceSummary {
  artifact: {
    hash: string
    reference: string
    stem: string
  }
  contentId: string
  events: CrawlerPlaybackEvidenceEvent[]
  observedAt: number
  outcome: CrawlerPlaybackEvidenceOutcome
  playback: {
    canplay: boolean
    error: boolean
    playing: boolean
    progress: {
      currentTimeAfter: number
      currentTimeBefore: number
      currentTimeDelta: number
    }
    status: CrawlerPlaybackStatus
  }
  provider: {
    provider: CrawlerPlaybackEvidenceProvider
    status: CrawlerPlaybackProviderStatus
  }
  repair: {
    sourceRevision: number
    status: CrawlerPlaybackRepairStatus
  }
  schemaVersion: 1
  source: {
    revision: number
    sourceType: CrawlerPlaybackEvidenceSourceType
    status: CrawlerPlaybackSourceStatus
  }
  sourceRevision: number
  tuple: CrawlerPlaybackEvidenceTuple
  viewer: {
    path: string
    targetLabel: string
  }
}

export interface CrawlerPlaybackEvidenceRejection {
  contentId: string
  observedAt: number
  outcome: CrawlerPlaybackRejectionOutcome
  sourceRevision: number
  tuple: CrawlerPlaybackEvidenceTuple
}

export interface CrawlerPlaybackEvidenceEntry {
  rejections: CrawlerPlaybackEvidenceRejection[]
  runId: string
  summary: CrawlerPlaybackEvidenceSummary | null
}

export interface CrawlerPlaybackEvidenceProjection {
  current: CrawlerPlaybackEvidenceEntry | null
  history: CrawlerPlaybackEvidenceEntry[]
}

export interface CrawlerTaskRetryProjection {
  attemptNumber: number
  automatic: boolean
  failureCode?: string
  maxAttempts: 2
  status: 'none' | 'retrying' | 'exhausted'
}

export interface CrawlerLeaseProjection {
  acquiredAt?: number
  expiresAt?: number
  lastHeartbeatAt?: number
  outcome: CrawlerLeaseOutcome
  recoveredAt?: number
}

export interface CrawlerReconciliationProjection {
  observedAt?: number
  outcome: CrawlerReconciliationOutcome
  processedAt?: number
  windowEndsAt?: number
  windowStatus: CrawlerReconciliationWindowStatus
}

export interface CrawlerReceiptValidationProjection {
  failureCode?: string
  identityMatch?: boolean
  readbackMatch?: boolean
  status: CrawlerRepairFactStatus
  validatedAt?: number
}

export interface CrawlerRepairResultProjection {
  failureCode?: string
  sourceRevision?: number
  status: CrawlerRepairFactStatus
}

export interface CrawlerAttemptOutcomeProjection {
  code?: string
  observedAt?: number
  outcome: CrawlerAttemptOutcome
}

export interface CrawlerRepairSourceProjection {
  disposition: CrawlerSourceDisposition
  eligibleCount: number
  observedAt: number
  reasonCode: string | null
  repairable: boolean
  rows: CrawlerSourceHealthRow[]
  sourceRevision: number
}

export interface CrawlerRepairSourceReadback extends CrawlerRepairSourceProjection {
  movieId: string
  sourceCount: number
}

export interface CrawlerRepairTask {
  activeDuplicateLock?: { locked: boolean, message: string }
  allowedNextAction: CrawlerRepairNextAction
  createdAt?: number
  id: string
  latestRunId?: string | null
  movie: { code: string, id: string, title: string }
  operation: 'repair_players'
  reason: CrawlerRepairReason
  retry?: CrawlerTaskRetryProjection
  sameMovieIdentity?: boolean | null
  source?: CrawlerRepairSourceProjection
  sourceReadback?: CrawlerRepairSourceReadback
  sourceRevision: number
  targetIntent: CrawlerRepairTargetIntent
  templateKey: 'movie'
  updatedAt?: number
}

export interface CrawlerRepairRun {
  attemptNumber: number
  createdAt?: number
  failureCode?: string | null
  id: string
  lease?: CrawlerLeaseProjection
  outcome?: CrawlerAttemptOutcomeProjection
  provider?: CrawlerProviderSummary | null
  reconciliation?: CrawlerReconciliationProjection
  repair?: CrawlerRepairResultProjection
  observedAt?: number
  receipt?: CrawlerRepairReceipt | null
  receiptValidation?: CrawlerReceiptValidationProjection
  safeLogCursor?: number | null
  sourceReadback?: CrawlerRepairSourceReadback
  sourceRevision?: number
  status: CrawlerRunStatus
  terminalAt?: number | null
  updatedAt?: number
}

export interface CrawlerRepairTaskResponse {
  currentAttempt?: CrawlerRepairRun | null
  history?: CrawlerRepairRun[]
  kind?: 'created' | 'existing_active_run'
  playbackEvidence?: CrawlerPlaybackEvidenceProjection
  run: CrawlerRepairRun | null
  runs?: CrawlerRepairRun[]
  task: CrawlerRepairTask
}

export interface CrawlerProviderSummary {
  provider?: string
  providerRunUrl?: string
  providerConclusion?: string
  providerRunAttempt?: number
  providerRunId?: string
  providerStatus?: string
  environment?: string
  ref?: string
  repository?: string
  sha?: string
  workflow?: string
}

export interface CrawlerRun {
  id: string
  taskId?: string
  attempt_number?: number
  attemptNumber?: number
  status: CrawlerRunStatus
  state_version?: number
  stateVersion?: number
  failure_code?: string | null
  failureCode?: string | null
  cancel_requested_at?: number | null
  cancelRequestedAt?: number | null
  created_at?: string
  createdAt?: number | string
  terminal_at?: string | null
  terminalAt?: number | string | null
  updatedAt?: number
  lease?: CrawlerLeaseProjection | null
  outcome?: CrawlerAttemptOutcomeProjection | null
  provider?: CrawlerProviderSummary | null
  reconciliation?: CrawlerReconciliationProjection | null
  repair?: CrawlerRepairResultProjection | null
  readiness?: ReadinessProjection | null
  receipt: CrawlerReceipt | null
  receiptValidation?: CrawlerReceiptValidationProjection | null
  safeLogCursor?: number | null
  sourceRevision?: number
  sourceReadback?: CrawlerRepairSourceReadback | null
}

export interface CrawlerTask {
  activeDuplicateLock?: { locked: boolean, message: string }
  allowedNextAction?: CrawlerRepairNextAction
  id: string
  lifecycle?: CrawlerTaskLifecycleProjection
  movie?: { code?: string, id: string, title: string }
  operation?: CrawlerTaskTemplate | 'repair_players'
  reason?: CrawlerRepairReason
  retry?: CrawlerTaskRetryProjection
  sameMovieIdentity?: boolean | null
  source?: CrawlerRepairSourceProjection
  sourceReadback?: CrawlerRepairSourceReadback
  sourceRevision?: number
  targetIntent?: CrawlerRepairTargetIntent
  template_key?: CrawlerTaskTemplate
  templateKey?: CrawlerTaskTemplate
  latest_run_id?: string | null
  latestRunId?: string | null
  created_at?: string
  createdAt?: number | string
  updated_at?: string
  updatedAt?: number | string
}

export interface CrawlerTaskDetail {
  availability?: CrawlerAvailabilityTaskProjection
  currentAttempt?: CrawlerRun | null
  history?: CrawlerRun[]
  lifecycle?: CrawlerTaskLifecycleProjection
  playbackEvidence?: CrawlerPlaybackEvidenceProjection
  retry?: CrawlerTaskRetryProjection
  task: CrawlerTask
  runs: CrawlerRun[]
}

export interface CrawlerTaskLog {
  sequence: number
  level: string
  code: string
  safe_message?: string
  safeMessage?: string
  counts_json?: string | null
  counts?: Record<string, number>
  created_at?: string
  createdAt?: number
}

export interface CrawlerTaskLogsPage {
  logs: CrawlerTaskLog[]
  nextCursor: number | null
}

export interface CrawlerTaskListPage {
  tasks: CrawlerTask[]
  nextCursor: string | null
}

// ─── API 对象 ─────────────────────────────────────────────────────────────────

export const api = {
  API_BASE,
  // Public API (filtered)
  getComics: () => apiFetch<Paginated<Comic>>('/comics?limit=50'),

  // Admin API (full access)
  admin: {
    getStats: () => apiFetch<{
      comics: number
      movies: number
      actors: number
      publishers: number
      users: number
      crawling: { movies: number, comics: number }
      pending: { actors: number, publishers: number }
    }>('/admin/stats'),

    getComics: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<Comic>>(`/admin/comics${query ? `?${query}` : ''}`)
    },

    getUsers: () => apiFetch<any[]>('/admin/users'),

    updateUserRole: (email: string, role: string) =>
      apiFetch(`/admin/users/${email}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),

    updateUserStatus: (email: string, isAdult: boolean) =>
      apiFetch(`/admin/users/${email}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isAdult }),
      }),

    updateComic: (id: string, data: Partial<Comic>) =>
      apiFetch(`/admin/comics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    getComic: (id: string) => apiFetch<{ data: Comic }>(`/admin/comics/${encodeURIComponent(id)}`),

    getChapters: (comicId: string) => apiFetch<Chapter[]>(`/admin/comics/${comicId}/chapters`),
    getChapter: (id: string) => apiFetch<Chapter>(`/admin/chapters/${id}`),
    deleteChapter: (id: string) => apiFetch(`/admin/chapters/${id}`, { method: 'DELETE' }),

    bulkOperationComics: (ids: string[], operation: string, payload?: any) =>
      apiFetch('/admin/comics/bulk-operation', {
        method: 'POST',
        body: JSON.stringify({ ids, operation, payload }),
      }),

    bulkDeleteChapters: (comicId: string, chapterIds: string[]) =>
      apiFetch(`/admin/comics/${comicId}/chapters/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ chapterIds }),
      }),

    getMovies: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<Movie>>(`/admin/movies${query ? `?${query}` : ''}`)
    },

    getMovie: (id: string) => apiFetch<Movie>(`/admin/movies/${id}`),

    updateMovie: (id: string, data: Partial<Movie>) =>
      apiFetch(`/admin/movies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteMovie: (id: string) =>
      apiFetch(`/admin/movies/${id}`, { method: 'DELETE' }),

    bulkOperationMovies: (ids: string[], operation: string, payload?: any) =>
      apiFetch('/admin/movies/bulk-operation', {
        method: 'POST',
        body: JSON.stringify({ ids, operation, payload }),
      }),

    getPlayers: (movieId: string) =>
      apiFetch<{ movieId: string, players: Player[], total: number }>(`/admin/movies/${movieId}/players`),

    addPlayer: (movieId: string, data: { sourceName: string, sourceUrl: string, quality?: string }) =>
      apiFetch(`/admin/movies/${movieId}/players`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updatePlayer: (playerId: string, data: Partial<Player>) =>
      apiFetch(`/admin/movies/players/${playerId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deletePlayer: (playerId: string) =>
      apiFetch(`/admin/movies/players/${playerId}`, { method: 'DELETE' }),

    batchImportPlayers: (movieId: string, players: Array<{ sourceName: string, sourceUrl: string, quality?: string }>) =>
      apiFetch(`/admin/movies/${movieId}/players/batch-import`, {
        method: 'POST',
        body: JSON.stringify({ players }),
      }),

    getActors: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<Actor>>(`/admin/actors${query ? `?${query}` : ''}`)
    },

    getActor: (id: string) => apiFetch<Actor & { relatedMovies: Movie[] }>(`/admin/actors/${id}`),

    getActorDetail: (id: string) => apiFetch<{ actor: Actor, movies: Movie[] }>(`/admin/actors/${id}`),

    updateActor: (id: string, data: Partial<Actor>) =>
      apiFetch(`/admin/actors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    mergeActors: (sourceId: string, targetId: string) =>
      apiFetch('/admin/actors/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId, targetId }),
      }),

    createActor: (data: { name: string }) =>
      apiFetch<{ id: string, name: string }>('/admin/actors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    batchRecrawlActors: (ids: string[]) =>
      apiFetch<{ success: boolean, total: number, marked: number, message: string }>('/admin/actors/batch-recrawl', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    updateMovieActors: (movieId: string, actors: { id: string, name: string, sortOrder: number }[]) =>
      apiFetch(`/admin/movies/${movieId}/actors`, {
        method: 'PUT',
        body: JSON.stringify({ actors }),
      }),

    getPublishers: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<Publisher>>(`/admin/publishers${query ? `?${query}` : ''}`)
    },

    getPublisher: (id: string) => apiFetch<Publisher & { relatedMovies: Movie[] }>(`/admin/publishers/${id}`),

    getPublisherDetail: (id: string) => apiFetch<{ publisher: Publisher, movies: Movie[] }>(`/admin/publishers/${id}`),

    updatePublisher: (id: string, data: Partial<Publisher>) =>
      apiFetch(`/admin/publishers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    mergePublishers: (sourceId: string, targetId: string) =>
      apiFetch('/admin/publishers/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId, targetId }),
      }),

    createPublisher: (data: { name: string }) =>
      apiFetch<{ id: string, name: string }>('/admin/publishers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateMoviePublishers: (movieId: string, publishers: { id: string, name: string, sortOrder: number }[]) =>
      apiFetch(`/admin/movies/${movieId}/publishers`, {
        method: 'PUT',
        body: JSON.stringify({ publishers }),
      }),

    getMovieAnalytics: () =>
      apiFetch<MovieAnalytics>('/admin/movies/analytics'),

    getCrawlerStats: () =>
      apiFetch<any>('/admin/crawlers/stats'),

    getFailedTasks: () =>
      apiFetch<any>('/admin/crawlers/failed-tasks'),

    recoverCrawler: (type: 'comic' | 'movie') =>
      apiFetch('/admin/crawlers/recover', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),

    clearFailedTasks: (type: 'comic' | 'movie') =>
      apiFetch('/admin/crawlers/clear-failed', {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),

    createCrawlerTask: (template: CrawlerTaskTemplate) =>
      apiFetch<{ kind: 'created' | 'existing_active_run', template: CrawlerTaskTemplate, run: CrawlerRun }>(`/admin/crawler-tasks`, {
        method: 'POST',
        body: JSON.stringify({ template }),
      }),

    repairPlayers: (command: CrawlerRepairCommand) =>
      apiFetch<CrawlerRepairTaskResponse>('/admin/crawler-tasks/repair-players', {
        method: 'POST',
        body: JSON.stringify(command),
      }),

    listCrawlerTasks: (params?: { lifecycle?: CrawlerTaskLifecycleStatus, template?: CrawlerTaskTemplate, cursor?: string, limit?: number }) => {
      const query = new URLSearchParams()
      if (params?.lifecycle)
        query.set('lifecycle', params.lifecycle)
      if (params?.template)
        query.set('template', params.template)
      if (params?.cursor)
        query.set('cursor', params.cursor)
      if (params?.limit)
        query.set('limit', String(params.limit))
      return apiFetch<CrawlerTaskListPage>(`/admin/crawler-tasks${query.toString() ? `?${query}` : ''}`)
    },

    getCrawlerTask: (taskId: string) =>
      apiFetch<CrawlerTaskDetail>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}`),

    updateCrawlerTask: (taskId: string, metadata: CrawlerTaskMetadataUpdate) =>
      apiFetch<{ lifecycle: CrawlerTaskLifecycleProjection, metadata: CrawlerTaskMetadataUpdate, operation: CrawlerTaskTemplate | 'repair_players', taskId: string }>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}`, {
        body: JSON.stringify(metadata),
        method: 'PATCH',
      }),

    archiveCrawlerTask: (taskId: string) =>
      apiFetch<{ kind: 'archived' | 'idempotent', lifecycle: CrawlerTaskLifecycleProjection, taskId: string }>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}/archive`, {
        method: 'POST',
      }),

    supersedeCrawlerTask: (taskId: string, command: CrawlerTaskSupersedeCommand) =>
      apiFetch<{ dispatch?: Record<string, unknown>, kind: 'created' | 'idempotent', lifecycle: CrawlerTaskLifecycleProjection, task?: { run: CrawlerRun, taskId: string }, taskId: string }>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}/supersede`, {
        body: JSON.stringify(command),
        method: 'POST',
      }),

    getCrawlerTaskAudit: (taskId: string, cursor?: string, limit?: number) => {
      const queryParams = new URLSearchParams()
      if (cursor)
        queryParams.set('cursor', cursor)
      if (limit != null)
        queryParams.set('limit', String(limit))
      const query = queryParams.toString() ? `?${queryParams}` : ''
      return apiFetch<CrawlerTaskAuditPage>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}/audit${query}`)
    },

    getCrawlerTaskLogs: (taskId: string, runId: string, cursor?: number, limit?: number) => {
      const queryParams = new URLSearchParams()
      if (cursor != null)
        queryParams.set('cursor', String(cursor))
      if (limit != null)
        queryParams.set('limit', String(limit))
      const query = queryParams.toString() ? `?${queryParams}` : ''
      return apiFetch<CrawlerTaskLogsPage>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/logs${query}`)
    },

    cancelCrawlerRun: (taskId: string, runId: string) =>
      apiFetch(`/admin/crawler-tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' }),

    retryCrawlerRun: (taskId: string, runId: string) =>
      apiFetch<{ kind: 'created' | 'existing_active_run', run: CrawlerRun }>(`/admin/crawler-tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/retry`, {
        method: 'POST',
        body: JSON.stringify({ confirmed: true }),
      }),

    getAuditLogs: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<Paginated<AuditLog>>(`/admin/audit-logs${query ? `?${query}` : ''}`)
    },

    exportAuditLogs: async (format: 'json' | 'csv', params?: Record<string, any>): Promise<Blob> => {
      const query = new URLSearchParams({ ...params, format }).toString()
      const response = await credentialFetch(`${API_BASE}/admin/audit-logs/export?${query}`)
      if (!response.ok) {
        throw new Error(`Failed to export audit logs: ${response.statusText}`)
      }
      return response.blob()
    },

    // R18 白名单管理
    getR18Whitelist: () =>
      apiFetch<{ success: boolean, data: User[] }>('/admin/r18-whitelist'),

    addToR18Whitelist: (userId?: string, email?: string) =>
      apiFetch('/admin/r18-whitelist', {
        method: 'POST',
        body: JSON.stringify({ userId, email }),
      }),

    removeFromR18Whitelist: (userId: string) =>
      apiFetch(`/admin/r18-whitelist/${userId}`, {
        method: 'DELETE',
      }),

    // 名称映射管理
    getNameMappings: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<any>(`/admin/name-mappings${query ? `?${query}` : ''}`)
    },

    createNameMapping: (data: any) =>
      apiFetch('/admin/name-mappings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateNameMapping: (id: string, data: any) =>
      apiFetch(`/admin/name-mappings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteNameMapping: (id: string) =>
      apiFetch(`/admin/name-mappings/${id}`, { method: 'DELETE' }),

    bulkDeleteNameMappings: (ids: string[]) =>
      apiFetch('/admin/name-mappings/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    getMappingQualityReport: () =>
      apiFetch<any>('/admin/name-mappings/quality-report'),

    // 收藏管理
    getFavorites: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<any>(`/favorites${query ? `?${query}` : ''}`)
    },

    checkFavorite: (entityType: string, entityId: string) =>
      apiFetch<any>(`/favorites/check/${entityType}/${entityId}`),

    addFavorite: (entityType: string, entityId: string) =>
      apiFetch('/favorites', {
        method: 'POST',
        body: JSON.stringify({ entityType, entityId }),
      }),

    deleteFavorite: (favoriteId: string) =>
      apiFetch(`/favorites/${favoriteId}`, { method: 'DELETE' }),

    // 评分管理
    getRatings: (params?: Record<string, any>) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch<any>(`/ratings${query ? `?${query}` : ''}`)
    },

    // 同步管理
    triggerSync: (type: string, params?: any) =>
      apiFetch('/admin/sync', {
        method: 'POST',
        body: JSON.stringify({ type, ...params }),
      }),

    // 系统设置
    getSettings: () =>
      apiFetch<{ success: boolean, data: Array<{ key: string, value: string, updatedAt: number | null }> }>('/admin/settings'),

    updateSettings: (settings: Array<{ key: string, value: string }>) =>
      apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      }),

    // 用户管理附加
    saveComic: (id: string, data: Partial<Comic>) =>
      apiFetch(`/admin/comics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteComic: (id: string) =>
      apiFetch(`/admin/comics/${id}`, { method: 'DELETE' }),

    bulkDeleteMovies: (ids: string[]) =>
      apiFetch('/admin/movies/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    bulkDeleteActors: (ids: string[]) =>
      apiFetch('/admin/actors/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),

    bulkDeletePublishers: (ids: string[]) =>
      apiFetch('/admin/publishers/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  },

  upload: {
    uploadImage: async (file: File, purpose: ManualUploadPurpose): Promise<UploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', purpose)

      const res = await credentialFetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Unknown error' })) as { error?: string, message?: string }
        throw new Error(error.error || error.message || `Upload failed with status ${res.status}`)
      }

      return res.json()
    },
  },
}
