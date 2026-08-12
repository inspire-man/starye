<script setup lang="ts">
import type { MovieDetail, PlaybackEvidenceRequest, PlaybackEvidenceTuple } from '../types'
import type { PlaybackSourceType } from '../utils/playbackSources'
import * as Sentry from '@sentry/vue'
import { CircleAlert, CircleCheck, Clock3, Play, RefreshCw } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Player from 'xgplayer'
import { useAria2 } from '../composables/useAria2'
import { moviePublicRuntime } from '../config/public-runtime'
import { movieApi, progressApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'
import {
  classifyPlaybackSource,
  isEligiblePlaybackSource,
  selectDirectPlaybackSource,
} from '../utils/playbackSources'
import {
  isTrustedTorrServerStreamUrl,
  resolveTrustedTorrServerOrigins,
  UNTRUSTED_STREAM_URL_MESSAGE,
} from '../utils/playerSecurity'

type ErrorKind = 'torrserver' | 'xgplayer' | 'network' | 'source-invalid' | 'unknown'
type PlaybackEventName = 'canplay' | 'playing' | 'waiting' | 'stalled' | 'error'
type PlaybackStatus = 'awaiting-play' | 'preparing' | 'ready-to-play' | 'playing' | 'progressed' | 'failed'
const PLAYBACK_EVENT_NAMES: readonly PlaybackEventName[] = ['canplay', 'playing', 'waiting', 'stalled', 'error']

interface PlaybackEventObservation {
  event: PlaybackEventName
  observed: boolean
  observedAt: number | null
  attempt: number | null
}

interface SourceAttemptObservation {
  sourceId: string
  sourceType: PlaybackSourceType
  attempt: number
  retryCount: number
  outcome: 'pending' | 'failed' | 'progressed'
}

interface PlayerErrorState {
  visible: boolean
  kind: ErrorKind
  message: string
  recoverable: boolean
}

interface ActivePlaybackEvidenceIdentity {
  contentId: string
  key: string
  movieCode: string
  sessionToken: number
  sourceRevision: number
  sourceType: 'direct' | 'TorrServer'
  tuple: PlaybackEvidenceTuple
}

const BUFFERING_TIMEOUT_MS = 10000
const PLAYBACK_OBSERVATION_WINDOW_MS = 15000
const MAX_SOURCE_RETRIES = 2
const PROGRESS_SAVE_INTERVAL_SECONDS = 10
const PROGRESS_MIN_SAVE_SECONDS = 30
const MOVIE_COMPLETED_THRESHOLD = 0.9

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { isConnected: aria2Connected, addMagnetTask } = useAria2()

const loading = ref(true)
const error = ref('')
const sourceGuardVisible = ref(false)
const movieTitle = ref('')
const movieCode = ref('')
const movieData = ref<MovieDetail | null>(null)
let player: Player | null = null
let saveProgressTimer: number | null = null
let waitingTimeout: number | null = null
let lastTrackedMovieCode = ''
let lastSavedProgressSecond = -1
let playbackSessionToken = 0
let loadingCycleToken = 0
let consumedFailureCycleToken = -1
let activePlaybackEvidenceIdentity: ActivePlaybackEvidenceIdentity | null = null
const submittedPlaybackEvidenceIdentities = new Set<string>()
const retryCountBySource = new Map<string, number>()
const attemptedSourceIdentities = new Set<string>()

const playerLoading = ref(false)
const playerLoadingMessage = ref('')
const errorState = ref<PlayerErrorState>(createDefaultErrorState())
const currentSourceUrl = ref('')
const currentSourceIdentity = ref('')
const currentSourceType = ref<PlaybackSourceType | null>(null)
const currentMagnetUrl = ref('')
const sourceGuardTitle = ref('')
const sourceGuardMessage = ref('')
const sourceGuardIsInvalid = ref(false)
const savedCompleted = ref(false)
const loadedProgressDuration = ref<number | null>(null)
const playbackStatus = ref<PlaybackStatus>('awaiting-play')
const playbackStatusReason = ref('')
const playbackClickCount = ref(0)
const playbackClickRequested = ref(false)
const playbackObservationStartedAt = ref<number | null>(null)
const playbackObservationTimer = ref<number | null>(null)
const playbackEvents = ref<PlaybackEventObservation[]>(createPlaybackEventObservations())
const currentTimeBefore = ref<number | null>(null)
const currentTimeAfter = ref<number | null>(null)
const currentTimeDelta = computed(() => {
  if (currentTimeBefore.value == null || currentTimeAfter.value == null)
    return null
  return Math.max(0, currentTimeAfter.value - currentTimeBefore.value)
})
const sourceAttemptHistory = ref<SourceAttemptObservation[]>([])
const currentSourceAttempt = ref(1)
const currentSourcePlayerId = ref('')
const currentContentId = ref('')
const currentSourceRevision = ref(0)
const playbackCandidates = ref<MovieDetail['players']>([])
const currentCandidateIndex = ref(-1)

const isTorrServerMode = computed(() => !!route.query.streamUrl)
const hasAria2Fallback = computed(() => Boolean(currentMagnetUrl.value) && aria2Connected.value)
const sentryEnabled = Boolean(moviePublicRuntime.sentryDsn)

/**
 * 系列导航：从 relatedMovies 中提取同系列影片，按 releaseDate ASC 排序，计算当前位置
 */
const seriesNavigation = computed(() => {
  const m = movieData.value
  if (!m?.series)
    return null

  const sameSeriesFromRelated = (m.relatedMovies ?? []).filter(
    r => r.series === m.series,
  )
  const allInSeries = [
    { id: m.id, code: m.code, title: m.title, releaseDate: m.releaseDate },
    ...sameSeriesFromRelated.map(r => ({
      id: r.id,
      code: r.code,
      title: r.title,
      releaseDate: r.releaseDate,
    })),
  ]

  allInSeries.sort((a, b) => {
    if (a.releaseDate && b.releaseDate)
      return a.releaseDate - b.releaseDate
    if (a.releaseDate)
      return -1
    if (b.releaseDate)
      return 1
    return a.code.localeCompare(b.code)
  })

  const idx = allInSeries.findIndex(item => item.id === m.id)
  if (idx === -1)
    return null

  return {
    series: m.series,
    total: allInSeries.length,
    position: idx + 1,
    prev: idx > 0 ? allInSeries[idx - 1] : null,
    next: idx < allInSeries.length - 1 ? allInSeries[idx + 1] : null,
  }
})

function createDefaultErrorState(): PlayerErrorState {
  return {
    visible: false,
    kind: 'unknown',
    message: '',
    recoverable: true,
  }
}

function createPlaybackEventObservations(): PlaybackEventObservation[] {
  return PLAYBACK_EVENT_NAMES.map(event => ({
    event,
    observed: false,
    observedAt: null,
    attempt: null,
  }))
}

function playbackStatusLabel(status: PlaybackStatus): string {
  return {
    'awaiting-play': '等待用户播放',
    'preparing': '播放准备中',
    'ready-to-play': '可开始播放',
    'playing': '播放已开始',
    'progressed': '播放进度已推进 · 播放已验证',
    'failed': '播放失败',
  }[status]
}

function clearPlaybackObservationTimer() {
  if (playbackObservationTimer.value) {
    clearTimeout(playbackObservationTimer.value)
    playbackObservationTimer.value = null
  }
}

function resetPlaybackEvidenceForAttempt(attempt: number) {
  clearPlaybackObservationTimer()
  playbackEvents.value = createPlaybackEventObservations()
  currentTimeBefore.value = null
  currentTimeAfter.value = null
  playbackStatus.value = 'awaiting-play'
  playbackStatusReason.value = ''
  playbackClickRequested.value = false
  playbackObservationStartedAt.value = null
  currentSourceAttempt.value = attempt
}

function invalidatePlaybackEvidenceIdentity() {
  activePlaybackEvidenceIdentity = null
}

function createActivePlaybackEvidenceIdentity(sourceType: PlaybackSourceType): ActivePlaybackEvidenceIdentity | null {
  const tuple = movieData.value?.availability?.current.playback.tuple
  const contentId = currentContentId.value
  const sourceRevision = currentSourceRevision.value
  const code = movieCode.value.trim()
  if (!tuple || !contentId || !/^[\w.~-]{1,128}$/u.test(code)
    || tuple.provider !== 'github-actions'
    || (sourceType !== 'direct' && sourceType !== 'TorrServer')) {
    return null
  }

  return {
    contentId,
    key: [playbackSessionToken, currentSourceIdentity.value, currentSourceAttempt.value, contentId, sourceRevision, tuple.taskId, tuple.runId, tuple.attemptNumber, sourceType].join(':'),
    movieCode: code,
    sessionToken: playbackSessionToken,
    sourceRevision,
    sourceType,
    tuple: { ...tuple },
  }
}

function isActivePlaybackEvidenceIdentity(identity: ActivePlaybackEvidenceIdentity | null): identity is ActivePlaybackEvidenceIdentity {
  return identity !== null
    && activePlaybackEvidenceIdentity?.key === identity.key
    && identity.sessionToken === playbackSessionToken
    && identity.contentId === currentContentId.value
    && identity.sourceRevision === currentSourceRevision.value
}

function submitCurrentPlaybackEvidence(identity: ActivePlaybackEvidenceIdentity | null) {
  if (!isActivePlaybackEvidenceIdentity(identity) || submittedPlaybackEvidenceIdentities.has(identity.key))
    return

  const before = currentTimeBefore.value
  const after = currentTimeAfter.value
  const delta = currentTimeDelta.value
  if (before == null || after == null || delta == null || delta < 1)
    return

  const eventObserved = (event: PlaybackEventName) => playbackEvents.value.find(item => item.event === event)?.observed === true
  const evidence: PlaybackEvidenceRequest = {
    contentId: identity.contentId,
    events: playbackEvents.value.map(event => ({
      event: event.event,
      observed: event.observed,
      observedAt: event.observedAt,
    })),
    observedAt: Math.floor(Date.now() / 1000),
    playback: {
      canplay: eventObserved('canplay'),
      error: eventObserved('error'),
      playing: eventObserved('playing'),
      progress: { currentTimeAfter: after, currentTimeBefore: before, currentTimeDelta: delta },
      status: 'playback_verified',
    },
    provider: { provider: identity.tuple.provider, status: 'succeeded' },
    repair: { sourceRevision: identity.sourceRevision, status: 'succeeded' },
    schemaVersion: 1,
    source: { revision: identity.sourceRevision, sourceType: identity.sourceType, status: 'ready' },
    sourceRevision: identity.sourceRevision,
    tuple: identity.tuple,
    viewer: { path: `/movie/${identity.movieCode}`, targetLabel: `movie-${identity.movieCode}` },
  }

  submittedPlaybackEvidenceIdentities.add(identity.key)
  void movieApi.submitPlaybackEvidence(identity.tuple.taskId, identity.tuple.runId, evidence).catch(() => {
    // Evidence is advisory; playback remains available when the authenticated write fails.
  })
}

function playbackEventElapsedMs(): number {
  if (playbackObservationStartedAt.value == null)
    return 0

  return Math.max(0, Math.min(
    PLAYBACK_OBSERVATION_WINDOW_MS,
    Date.now() - playbackObservationStartedAt.value,
  ))
}

function readCurrentPlayerTime(): number {
  return Math.max(0, Number(player?.currentTime) || 0)
}

function recordPlaybackEvent(event: PlaybackEventName) {
  const row = playbackEvents.value.find(item => item.event === event)
  if (!row || row.observed)
    return

  row.observed = true
  row.observedAt = playbackEventElapsedMs()
  row.attempt = currentSourceAttempt.value

  if (event === 'canplay' && !playbackClickRequested.value) {
    playbackStatus.value = 'ready-to-play'
  }
  else if (event === 'playing'
    && playbackClickRequested.value
    && playbackStatus.value !== 'failed'
    && !playbackEvents.value.find(item => item.event === 'error')?.observed) {
    currentTimeBefore.value ??= readCurrentPlayerTime()
    currentTimeAfter.value = currentTimeBefore.value
    playbackStatus.value = 'playing'
  }
  else if ((event === 'waiting' || event === 'stalled') && playbackStatus.value !== 'failed') {
    playbackStatus.value = playbackClickRequested.value ? 'preparing' : 'ready-to-play'
  }
}

function updatePlaybackProgress(identity = activePlaybackEvidenceIdentity) {
  if (identity && !isActivePlaybackEvidenceIdentity(identity))
    return
  if (!playbackClickRequested.value || currentTimeBefore.value == null || playbackStatus.value === 'failed')
    return

  currentTimeAfter.value = Math.max(currentTimeAfter.value ?? 0, readCurrentPlayerTime())
  const delta = currentTimeDelta.value ?? 0
  const canplayObserved = playbackEvents.value.find(event => event.event === 'canplay')?.observed === true
  const playingObserved = playbackEvents.value.find(event => event.event === 'playing')?.observed === true
  if (!canplayObserved || !playingObserved || delta < 1 || playbackEvents.value.find(event => event.event === 'error')?.observed)
    return

  clearPlaybackObservationTimer()
  playbackStatus.value = 'progressed'
  playbackStatusReason.value = ''
  stopPlayerLoading()
  clearRecoverableError()
  submitCurrentPlaybackEvidence(identity)
}

function startPlaybackObservationWindow() {
  clearPlaybackObservationTimer()
  playbackObservationStartedAt.value = Date.now()
  playbackObservationTimer.value = window.setTimeout(() => {
    playbackObservationTimer.value = null
    if (playbackStatus.value === 'progressed' || playbackStatus.value === 'failed')
      return

    handleSourceFailure('network', '播放观察超时，尚未观察到至少 1 秒的 currentTime 推进。')
  }, PLAYBACK_OBSERVATION_WINDOW_MS)
}

function rememberCurrentSourceAttempt(outcome: SourceAttemptObservation['outcome']) {
  if (!currentSourcePlayerId.value || !currentSourceType.value)
    return

  sourceAttemptHistory.value.push({
    sourceId: currentSourcePlayerId.value,
    sourceType: currentSourceType.value,
    attempt: currentSourceAttempt.value,
    retryCount: getCurrentSourceRetryCount(),
    outcome,
  })
}

function beginPlaybackSession(): number {
  playbackSessionToken += 1
  invalidatePlaybackEvidenceIdentity()
  submittedPlaybackEvidenceIdentities.clear()
  retryCountBySource.clear()
  attemptedSourceIdentities.clear()
  sourceAttemptHistory.value = []
  playbackCandidates.value = []
  currentCandidateIndex.value = -1
  playbackClickCount.value = 0
  currentSourcePlayerId.value = ''
  currentContentId.value = ''
  currentSourceRevision.value = 0
  resetPlaybackEvidenceForAttempt(1)
  loadingCycleToken = 0
  consumedFailureCycleToken = -1
  currentSourceIdentity.value = ''
  currentSourceType.value = null
  return playbackSessionToken
}

function isCurrentPlaybackSession(sessionToken: number): boolean {
  return sessionToken === playbackSessionToken
}

function getSourceIdentity(source: Pick<PlaybackSourceTypeInput, 'source' | 'sourceUrl' | 'id'>): string {
  if (source.id?.trim()) {
    return source.id.trim()
  }

  const type = classifyPlaybackSource(source)
  return `${type}:${source.sourceUrl?.trim() || ''}`
}

interface PlaybackSourceTypeInput {
  id?: string | null
  source?: string | null
  sourceUrl?: string | null
}

function beginLoadingCycle() {
  loadingCycleToken += 1
  consumedFailureCycleToken = -1
}

function consumeFailureForCurrentCycle(): boolean {
  if (consumedFailureCycleToken === loadingCycleToken) {
    return false
  }

  consumedFailureCycleToken = loadingCycleToken
  return true
}

function getCurrentSourceRetryCount(): number {
  if (!currentSourceIdentity.value) {
    return MAX_SOURCE_RETRIES
  }

  return retryCountBySource.get(currentSourceIdentity.value) ?? 0
}

function setSourceRetryCount(count: number) {
  if (currentSourceIdentity.value) {
    retryCountBySource.set(currentSourceIdentity.value, count)
  }
}

function clearWaitingTimeout() {
  if (waitingTimeout) {
    clearTimeout(waitingTimeout)
    waitingTimeout = null
  }
}

function clearSaveProgressTimer() {
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer)
    saveProgressTimer = null
  }
}

function resetProgressState() {
  clearSaveProgressTimer()
  lastSavedProgressSecond = -1
  savedCompleted.value = false
  loadedProgressDuration.value = null
}

function resetPlayerContainer() {
  const container = document.getElementById('player-container')
  if (container) {
    container.innerHTML = ''
  }
}

function destroyPlayerInstance() {
  invalidatePlaybackEvidenceIdentity()
  clearWaitingTimeout()
  clearPlaybackObservationTimer()

  if (player) {
    player.destroy()
    player = null
  }

  resetPlayerContainer()
}

function resetPlayerFeedback() {
  clearWaitingTimeout()
  clearPlaybackObservationTimer()
  playerLoading.value = false
  playerLoadingMessage.value = ''
  errorState.value = createDefaultErrorState()
}

function getLoadingMessage() {
  return isTorrServerMode.value
    ? 'TorrServer 正在加载视频数据，请稍候'
    : '正在缓冲当前播放源...'
}

function startPlayerLoading(message = getLoadingMessage()) {
  playerLoading.value = true
  playerLoadingMessage.value = message
}

function stopPlayerLoading() {
  clearWaitingTimeout()
  playerLoading.value = false
  playerLoadingMessage.value = ''
}

function clearRecoverableError() {
  if (errorState.value.visible) {
    errorState.value = createDefaultErrorState()
  }
}

function markPlaybackRecovered() {
  if (playbackStatus.value === 'failed')
    return

  stopPlayerLoading()
  clearRecoverableError()
}

function getEscalatedRetryMessage() {
  return '当前播放源已达到 2 次重试上限，请返回详情页切换其他播放源。'
}

function showPlayerError(kind: ErrorKind, message: string, recoverable = true, failureAlreadyConsumed = false) {
  if (recoverable && !failureAlreadyConsumed && !consumeFailureForCurrentCycle()) {
    return
  }

  stopPlayerLoading()
  const retriesExhausted = recoverable && getCurrentSourceRetryCount() >= MAX_SOURCE_RETRIES
  const finalMessage = retriesExhausted ? getEscalatedRetryMessage() : message
  const finalRecoverable = recoverable && !retriesExhausted

  playbackStatus.value = 'failed'
  playbackStatusReason.value = finalMessage
  clearPlaybackObservationTimer()

  reportVideoFailure(kind, finalMessage, finalRecoverable)

  errorState.value = {
    visible: true,
    kind,
    message: finalMessage,
    recoverable: finalRecoverable,
  }

  if (kind === 'source-invalid') {
    goToDetail()
  }
}

function reportVideoFailure(kind: ErrorKind, message: string, recoverable: boolean) {
  if (!sentryEnabled) {
    return
  }

  Sentry.withScope((scope) => {
    scope.setLevel('warning')
    scope.setTag('app', 'movie-app')
    scope.setTag('surface', 'player')
    scope.setTag('error.kind', kind)
    scope.setTag('playback.mode', isTorrServerMode.value ? 'torrserver' : 'standard')
    scope.setContext('video_failure', {
      movieCode: movieCode.value || null,
      movieTitle: movieTitle.value || null,
      streamUrl: isTorrServerMode.value ? currentSourceUrl.value || null : null,
      sourceUrl: currentSourceUrl.value || null,
      recoverable,
      userAgent: navigator.userAgent,
      route: route.fullPath,
    })
    Sentry.captureMessage(`video failure: ${kind} - ${message}`)
  })
}

function getWaitingTimeoutMessage() {
  return isTorrServerMode.value
    ? 'TorrServer 缓冲超时，请重试；如果仍失败，请返回详情页改用其他方式。'
    : '当前播放源缓冲超时，请重试；如果仍失败，请返回详情页切换其他播放源。'
}

function scheduleWaitingTimeout() {
  clearWaitingTimeout()
  if (!playerLoading.value) {
    beginLoadingCycle()
  }
  startPlayerLoading(getLoadingMessage())
  const cycleToken = loadingCycleToken
  waitingTimeout = window.setTimeout(() => {
    if (cycleToken !== loadingCycleToken) {
      return
    }

    handleSourceFailure(
      isTorrServerMode.value ? 'torrserver' : 'network',
      getWaitingTimeoutMessage(),
    )
  }, BUFFERING_TIMEOUT_MS)
}

function getPlaybackErrorState(): PlayerErrorState {
  if (!currentSourceUrl.value) {
    return {
      visible: true,
      kind: 'source-invalid',
      message: '当前没有可重试的播放源，请返回详情页切换源。',
      recoverable: false,
    }
  }

  const sourceType = currentSourceType.value ?? classifyPlaybackSource({
    source: isTorrServerMode.value ? 'TorrServer' : undefined,
    sourceUrl: currentSourceUrl.value,
  })

  if (sourceType === 'magnet') {
    return {
      visible: true,
      kind: 'source-invalid',
      message: '当前源不是浏览器可直接播放的视频地址，请返回详情页使用 TorrServer 或添加到 Aria2。',
      recoverable: false,
    }
  }

  if (sourceType === 'TorrServer' || isTorrServerMode.value) {
    return {
      visible: true,
      kind: 'torrserver',
      message: 'TorrServer 流播放失败。请重试；如果仍失败，请返回详情页改用其他方式。',
      recoverable: true,
    }
  }

  return {
    visible: true,
    kind: 'xgplayer',
    message: '当前播放源加载失败，请重试；如果仍失败，请返回详情页切换其他播放源。',
    recoverable: true,
  }
}

function findNextPlaybackCandidate(): { player: MovieDetail['players'][number], index: number } | null {
  for (let index = currentCandidateIndex.value + 1; index < playbackCandidates.value.length; index += 1) {
    const candidate = playbackCandidates.value[index]
    if (!candidate)
      continue

    const identity = getSourceIdentity(candidate)
    if (!attemptedSourceIdentities.has(identity))
      return { player: candidate, index }
  }

  return null
}

function switchToNextPlaybackCandidate(): boolean {
  const next = findNextPlaybackCandidate()
  if (!next)
    return false

  currentCandidateIndex.value = next.index
  retryCountBySource.set(getSourceIdentity(next.player), 0)
  destroyPlayerInstance()
  resetPlayerFeedback()
  startPlayerLoading('当前来源已达到重试上限，正在切换下一个可用来源...')

  const sessionToken = playbackSessionToken
  void nextTick().then(() => {
    if (!isCurrentPlaybackSession(sessionToken))
      return

    initPlayer(
      next.player.sourceUrl,
      0,
      getSourceIdentity(next.player),
      classifyPlaybackSource(next.player),
    )
  })
  return true
}

function handleSourceFailure(kind: ErrorKind, message: string) {
  if (!consumeFailureForCurrentCycle())
    return

  playbackStatus.value = 'failed'
  playbackStatusReason.value = message
  rememberCurrentSourceAttempt('failed')

  if (getCurrentSourceRetryCount() >= MAX_SOURCE_RETRIES && switchToNextPlaybackCandidate())
    return

  showPlayerError(kind, message, true, true)
}

function isEligiblePlayer(candidate: MovieDetail['players'][number]): boolean {
  return isEligiblePlaybackSource(candidate)
}

function serverContentId(detail: MovieDetail): string {
  return detail.primaryContentId || detail.readiness?.metadata.contentId || detail.id || detail.code
}

function routeQueryString(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined

  const normalized = value.trim()
  return /^[\w.~-]{1,128}$/u.test(normalized) ? normalized : undefined
}

function routeQueryRevision(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,7}$/u.test(value))
    return undefined

  const revision = Number(value)
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined
}

function validateRoutePlaybackContext(detail: MovieDetail, sourceType: PlaybackSourceType): string | null {
  const contentId = serverContentId(detail)
  const sourceRevision = detail.readiness?.source.sourceRevision ?? 0
  const query = route.query ?? {}
  const routeContentId = routeQueryString(query.contentId)
  const routeRevision = routeQueryRevision(query.sourceRevision)
  const routeSourceType = routeQueryString(query.sourceType)

  if (query.contentId !== undefined && (!routeContentId || routeContentId !== contentId))
    return '播放上下文 content ID 与 server-owned 影片身份不一致，已停止播放。'
  if (query.sourceRevision !== undefined && (routeRevision == null || routeRevision !== sourceRevision))
    return '播放上下文 source revision 已变化，已停止播放并要求重新读取影片详情。'
  if (query.sourceType !== undefined && (!routeSourceType || routeSourceType !== sourceType))
    return '播放上下文 source type 与当前服务端来源不一致，已停止播放。'

  return null
}

function applyServerOwnedContext(detail: MovieDetail) {
  currentContentId.value = serverContentId(detail)
  currentSourceRevision.value = detail.readiness?.source.sourceRevision ?? 0
}

function showNoSourceGuard() {
  destroyPlayerInstance()
  resetPlayerFeedback()
  error.value = ''
  sourceGuardTitle.value = '暂无可用播放源'
  sourceGuardMessage.value = '当前影片的来源尚未通过可播放读回检查，请返回详情页查看状态或受控修复意图。'
  sourceGuardIsInvalid.value = false
  sourceGuardVisible.value = true
  loading.value = false
}

function showSourceInvalidGuard(message = '当前来源不是浏览器可直接播放的地址，请返回详情页使用受控播放方式。') {
  destroyPlayerInstance()
  resetPlayerFeedback()
  error.value = ''
  sourceGuardTitle.value = '当前播放源不可直接播放'
  sourceGuardMessage.value = message
  sourceGuardIsInvalid.value = true
  sourceGuardVisible.value = true
  loading.value = false
  goToDetail()
}

async function fetchMovieAndPlay() {
  const sessionToken = beginPlaybackSession()
  loading.value = true
  error.value = ''
  sourceGuardVisible.value = false
  sourceGuardTitle.value = ''
  sourceGuardMessage.value = ''
  sourceGuardIsInvalid.value = false
  movieData.value = null
  currentMagnetUrl.value = ''
  currentSourceUrl.value = ''
  destroyPlayerInstance()
  resetProgressState()
  resetPlayerFeedback()

  try {
    const code = route.params.code as string
    movieCode.value = code
    let sourceUrl = ''
    let sourceIdentity = ''
    let sourceType: PlaybackSourceType = 'direct'
    let startTime = 0

    // TorrServer 模式：直接使用 streamUrl 播放
    const streamUrl = typeof route.query.streamUrl === 'string' ? route.query.streamUrl : undefined
    if (streamUrl) {
      const response = await movieApi.getMovieDetail(code)
      if (!isCurrentPlaybackSession(sessionToken)) {
        return
      }

      if (!response.success || !response.data) {
        error.value = response.error || '加载失败'
        loading.value = false
        return
      }

      const trustedOrigins = await resolveTrustedTorrServerOrigins()
      if (!isCurrentPlaybackSession(sessionToken)) {
        return
      }

      if (!isTrustedTorrServerStreamUrl(streamUrl, trustedOrigins)) {
        error.value = UNTRUSTED_STREAM_URL_MESSAGE
        loading.value = false
        return
      }

      sourceUrl = streamUrl
      sourceType = 'TorrServer'
      sourceIdentity = routeQueryString(route.query.player) || 'TorrServer'
      movieTitle.value = response.data.title
      movieData.value = response.data
      applyServerOwnedContext(response.data)
      const streamContextError = validateRoutePlaybackContext(response.data, sourceType)
      if (streamContextError) {
        showSourceInvalidGuard(streamContextError)
        return
      }
      const magnetPlayer = response.data.players?.find(p => isEligiblePlayer(p)
        && classifyPlaybackSource(p) === 'magnet')
      if (magnetPlayer) {
        currentMagnetUrl.value = magnetPlayer.sourceUrl.trim()
      }

      if (userStore.user) {
        const progressResponse = await progressApi.getWatchingProgress(code)
        if (!isCurrentPlaybackSession(sessionToken)) {
          return
        }

        if (progressResponse.success && progressResponse.data && !Array.isArray(progressResponse.data)) {
          savedCompleted.value = progressResponse.data.completed
          loadedProgressDuration.value = progressResponse.data.duration
          if (!progressResponse.data.completed && progressResponse.data.progress >= PROGRESS_MIN_SAVE_SECONDS) {
            startTime = progressResponse.data.progress
          }
        }
      }
    }
    else {
      // 标准模式：从 API 获取播放源
      const response = await movieApi.getMovieDetail(code)
      if (!isCurrentPlaybackSession(sessionToken)) {
        return
      }

      if (!response.success || !response.data) {
        error.value = response.error || '加载失败'
        loading.value = false
        return
      }

      const movie = response.data
      movieTitle.value = movie.title
      movieData.value = movie
      applyServerOwnedContext(movie)
      const players = movie.players ?? []
      const eligiblePlayers = players.filter(isEligiblePlayer)
      const eligibleMagnetPlayer = eligiblePlayers.find(p => classifyPlaybackSource(p) === 'magnet')

      if (movie.readiness?.source.disposition !== 'ready'
        || movie.readiness.source.eligibleCount < 1
        || eligiblePlayers.length === 0) {
        showNoSourceGuard()
        return
      }

      currentMagnetUrl.value = eligibleMagnetPlayer?.sourceUrl.trim() || ''

      const playerId = routeQueryString(route.query.player)
      const selectedPlayer = playerId
        ? players.find(p => p.id === playerId)
        : selectDirectPlaybackSource(players)

      if (!selectedPlayer
        || !isEligiblePlayer(selectedPlayer)
        || classifyPlaybackSource(selectedPlayer) !== 'direct') {
        if (playerId && players.some(p => p.id === playerId)) {
          showSourceInvalidGuard('当前入口选择了不可由浏览器直接播放的来源，请返回详情页使用受控播放方式。')
        }
        else if (eligibleMagnetPlayer) {
          showSourceInvalidGuard('当前影片只有磁力来源，请返回详情页使用 TorrServer 或添加到 Aria2。')
        }
        else {
          showNoSourceGuard()
        }
        return
      }

      const routeContextError = validateRoutePlaybackContext(movie, classifyPlaybackSource(selectedPlayer))
      if (routeContextError) {
        showSourceInvalidGuard(routeContextError)
        return
      }

      playbackCandidates.value = players.filter(player => isEligiblePlayer(player)
        && classifyPlaybackSource(player) === 'direct')
      currentCandidateIndex.value = playbackCandidates.value.findIndex(player => player.id === selectedPlayer.id)

      sourceUrl = selectedPlayer.sourceUrl.trim()
      sourceType = classifyPlaybackSource(selectedPlayer)
      sourceIdentity = getSourceIdentity(selectedPlayer)

      if (userStore.user) {
        const progressResponse = await progressApi.getWatchingProgress(code)
        if (!isCurrentPlaybackSession(sessionToken)) {
          return
        }

        if (progressResponse.success && progressResponse.data && !Array.isArray(progressResponse.data)) {
          savedCompleted.value = progressResponse.data.completed
          loadedProgressDuration.value = progressResponse.data.duration
          if (!progressResponse.data.completed && progressResponse.data.progress >= PROGRESS_MIN_SAVE_SECONDS) {
            startTime = progressResponse.data.progress
          }
        }
      }
    }

    if (!isCurrentPlaybackSession(sessionToken)) {
      return
    }

    trackCurrentMovieViewOnce(code)
    loading.value = false
    await nextTick()
    if (!isCurrentPlaybackSession(sessionToken)) {
      return
    }

    initPlayer(sourceUrl, startTime, sourceIdentity, sourceType)
  }
  catch (err: any) {
    if (!isCurrentPlaybackSession(sessionToken)) {
      return
    }

    destroyPlayerInstance()
    error.value = err instanceof Error ? err.message : (err.response?.data?.error || '加载影片失败')
    loading.value = false
  }
}

function initPlayer(
  url: string,
  startTime: number,
  sourceIdentity = '',
  sourceType?: PlaybackSourceType,
) {
  invalidatePlaybackEvidenceIdentity()
  const normalizedUrl = url.trim()
  const resolvedType = sourceType ?? classifyPlaybackSource({ sourceUrl: normalizedUrl })
  const resolvedIdentity = sourceIdentity || getSourceIdentity({
    source: resolvedType,
    sourceUrl: normalizedUrl,
  })
  const retryCount = retryCountBySource.get(resolvedIdentity) ?? 0
  currentSourceUrl.value = normalizedUrl
  currentSourceType.value = resolvedType
  currentSourceIdentity.value = resolvedIdentity
  currentSourcePlayerId.value = /^[\w.~-]{1,128}$/u.test(resolvedIdentity) ? resolvedIdentity : resolvedType
  currentSourceAttempt.value = retryCount + 1
  attemptedSourceIdentities.add(resolvedIdentity)
  resetPlaybackEvidenceForAttempt(currentSourceAttempt.value)
  activePlaybackEvidenceIdentity = createActivePlaybackEvidenceIdentity(resolvedType)
  const evidenceIdentity = activePlaybackEvidenceIdentity

  if (!normalizedUrl || (resolvedType !== 'direct' && resolvedType !== 'TorrServer')) {
    showPlayerError(
      'source-invalid',
      '当前源不是浏览器可直接播放的视频地址，请返回详情页使用受控播放方式。',
      false,
    )
    return
  }

  resetPlayerFeedback()
  beginLoadingCycle()

  player = new Player({
    id: 'player-container',
    url: normalizedUrl,
    autoplay: false,
    playsinline: true,
    width: '100%',
    height: '100%',
    poster: '',
    fluid: true,
    fitVideoSize: 'fixWidth',
    videoInit: true,
    startTime,
  })

  if (startTime === 0) {
    scheduleRestartProgressReset()
  }

  player.on('canplay', () => {
    if (evidenceIdentity && !isActivePlaybackEvidenceIdentity(evidenceIdentity))
      return
    recordPlaybackEvent('canplay')
    markPlaybackRecovered()
  })

  player.on('playing', () => {
    if (evidenceIdentity && !isActivePlaybackEvidenceIdentity(evidenceIdentity))
      return
    recordPlaybackEvent('playing')
    markPlaybackRecovered()
    updatePlaybackProgress(evidenceIdentity)
  })

  player.on('waiting', () => {
    if (evidenceIdentity && !isActivePlaybackEvidenceIdentity(evidenceIdentity))
      return
    recordPlaybackEvent('waiting')
    scheduleWaitingTimeout()
  })

  player.on('stalled', () => {
    if (evidenceIdentity && !isActivePlaybackEvidenceIdentity(evidenceIdentity))
      return
    recordPlaybackEvent('stalled')
    scheduleWaitingTimeout()
  })

  player.on('ended', () => {
    if (evidenceIdentity && !isActivePlaybackEvidenceIdentity(evidenceIdentity))
      return
    stopPlayerLoading()
    if (playbackClickRequested.value && playbackStatus.value !== 'progressed') {
      handleSourceFailure('network', '媒体在 currentTime 推进 1 秒前结束，播放证据未达标。')
      return
    }
    void flushProgress('ended')
  })

  player.on('error', () => {
    if (evidenceIdentity && !isActivePlaybackEvidenceIdentity(evidenceIdentity))
      return
    recordPlaybackEvent('error')
    const nextError = getPlaybackErrorState()
    if (nextError.recoverable)
      handleSourceFailure(nextError.kind, nextError.message)
    else
      showPlayerError(nextError.kind, nextError.message, false)
  })

  player.on('timeupdate', () => {
    if (evidenceIdentity && !isActivePlaybackEvidenceIdentity(evidenceIdentity))
      return
    updatePlaybackProgress(evidenceIdentity)
    if (!userStore.user || !player) {
      return
    }

    const currentSecond = Math.floor(Number(player.currentTime) || 0)
    if (currentSecond < PROGRESS_MIN_SAVE_SECONDS) {
      return
    }

    if (currentSecond - lastSavedProgressSecond >= PROGRESS_SAVE_INTERVAL_SECONDS) {
      lastSavedProgressSecond = currentSecond
      void flushProgress('checkpoint')
    }
  })

  player.on('pause', () => {
    void flushProgress('pause')
  })

  player.on('seeked', () => {
    void flushProgress('seeked')
  })
}

function handlePlayClick() {
  if (!player || (playbackClickRequested.value && playbackStatus.value !== 'failed'))
    return

  playbackClickCount.value += 1
  playbackClickRequested.value = true
  playbackStatus.value = playbackEvents.value.find(event => event.event === 'canplay')?.observed
    ? 'ready-to-play'
    : 'preparing'
  playbackStatusReason.value = ''
  startPlaybackObservationWindow()
  startPlayerLoading('正在启动播放，请等待媒体事件确认...')

  try {
    const result = player.play()
    if (result && typeof result.then === 'function') {
      void result.catch(() => {
        handleSourceFailure('network', '播放策略阻止了启动，请重试当前来源或切换来源。')
      })
    }
  }
  catch {
    handleSourceFailure('network', '播放策略阻止了启动，请重试当前来源或切换来源。')
  }
}

function isCompletedProgress(progress: number, duration: number | null | undefined): boolean {
  if (!duration || duration <= 0) {
    return false
  }
  return progress / duration >= MOVIE_COMPLETED_THRESHOLD
}

function shouldPersistProgress(progress: number): boolean {
  return progress >= PROGRESS_MIN_SAVE_SECONDS
}

async function persistProgress(progress: number, duration: number | null, completed: boolean) {
  if (!movieCode.value) {
    return
  }
  await progressApi.saveWatchingProgress(
    movieCode.value,
    Math.floor(progress),
    duration != null ? Math.floor(duration) : null,
    completed,
  )
}

async function flushProgress(reason: 'checkpoint' | 'pause' | 'seeked' | 'pagehide' | 'ended') {
  if (!userStore.user || !player) {
    return
  }

  const currentProgress = Math.max(0, Math.floor(Number(player.currentTime) || 0))
  const currentDuration = Number(player.duration) > 0
    ? Math.floor(Number(player.duration))
    : loadedProgressDuration.value

  const completed = reason === 'ended' || isCompletedProgress(currentProgress, currentDuration)

  if (!completed && !shouldPersistProgress(currentProgress)) {
    return
  }

  try {
    await persistProgress(currentProgress, currentDuration, completed)
    savedCompleted.value = completed
    loadedProgressDuration.value = currentDuration ?? null
  }
  catch (error) {
    console.error('Failed to save progress:', error)
  }
}

function scheduleRestartProgressReset() {
  if (!savedCompleted.value || !userStore.user) {
    return
  }

  clearSaveProgressTimer()

  saveProgressTimer = window.setTimeout(async () => {
    try {
      await persistProgress(0, loadedProgressDuration.value, false)
      savedCompleted.value = false
      lastSavedProgressSecond = -1
    }
    catch (error) {
      console.error('Failed to save progress:', error)
    }
  }, 0)
}

// 降级到 Aria2 下载
async function fallbackToAria2() {
  if (!currentMagnetUrl.value) {
    goToDetail()
    return
  }

  try {
    await addMagnetTask(currentMagnetUrl.value)
  }
  catch {
    // toast 已在 addMagnetTask 内处理
  }
}

function goBack() {
  router.back()
}

function goToDetail() {
  if (!movieCode.value) {
    return
  }

  router.push(`/movie/${encodeURIComponent(movieCode.value)}`)
}

function trackCurrentMovieView(code: string) {
  if (code) {
    movieApi.trackView(code)
  }
}

function trackCurrentMovieViewOnce(code: string) {
  if (!code || lastTrackedMovieCode === code) {
    return
  }

  trackCurrentMovieView(code)
  lastTrackedMovieCode = code
}

async function retryCurrentSource() {
  const sourceUrl = currentSourceUrl.value.trim()
  const sourceType = currentSourceType.value
  const sourceIdentity = currentSourceIdentity.value

  if (!sourceUrl || !sourceIdentity || sourceType === 'magnet' || !sourceType) {
    showPlayerError('source-invalid', '当前没有可重试的播放源，请返回详情页切换源。', false)
    return
  }

  const retryCount = getCurrentSourceRetryCount()
  if (retryCount >= MAX_SOURCE_RETRIES) {
    if (switchToNextPlaybackCandidate())
      return

    showPlayerError('network', getEscalatedRetryMessage(), false)
    goToDetail()
    return
  }

  const sessionToken = playbackSessionToken
  const lastTime = player ? Math.max(0, Number(player.currentTime) || 0) : 0
  setSourceRetryCount(retryCount + 1)
  destroyPlayerInstance()
  resetPlayerFeedback()
  startPlayerLoading('正在重新加载当前播放源...')

  await nextTick()
  if (!isCurrentPlaybackSession(sessionToken)) {
    return
  }

  initPlayer(sourceUrl, lastTime, sourceIdentity, sourceType)
}

function handlePageHide() {
  void flushProgress('pagehide')
}

onMounted(() => {
  window.addEventListener('pagehide', handlePageHide)
  fetchMovieAndPlay()
})

watch(
  () => [
    route.params.code,
    route.query.player,
    route.query.streamUrl,
    route.query.contentId,
    route.query.sourceRevision,
    route.query.sourceType,
    route.query.taskId,
    route.query.runId,
    route.query.attemptNumber,
    route.query.provider,
  ],
  (newContext, oldContext) => {
    if (newContext.every((value, index) => value === oldContext[index])) {
      return
    }

    fetchMovieAndPlay()
  },
)

onUnmounted(() => {
  window.removeEventListener('pagehide', handlePageHide)
  void flushProgress('pagehide')
  destroyPlayerInstance()
  clearSaveProgressTimer()
})
</script>

<template>
  <div class="fixed inset-0 bg-black z-50">
    <div class="absolute top-0 left-0 right-0 bg-linear-to-b from-black/80 to-transparent p-4 z-10">
      <div class="container mx-auto flex items-center justify-between">
        <button
          class="text-white hover:text-primary-400 transition flex items-center gap-2"
          @click="goBack"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>

        <div class="text-white text-center">
          <h2 class="text-lg font-medium">
            {{ movieTitle }}
          </h2>
          <span v-if="isTorrServerMode" class="text-xs text-teal-400">
            TorrServer 流播放
          </span>
        </div>

        <div class="w-16" />
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center h-full"
    >
      <div class="text-white text-lg">
        加载中...
      </div>
    </div>

    <div
      v-else-if="sourceGuardVisible"
      :role="sourceGuardIsInvalid ? 'alert' : 'status'"
      :data-source-state="sourceGuardIsInvalid ? 'source-invalid' : 'no-source'"
      class="flex items-center justify-center h-full px-6"
    >
      <div class="text-center max-w-lg">
        <p class="text-amber-300 text-xl mb-3">
          {{ sourceGuardTitle }}
        </p>
        <p class="text-gray-400 text-sm mb-6">
          {{ sourceGuardMessage }}
        </p>
        <button
          type="button"
          class="min-h-11 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          title="返回影片详情页"
          @click="goToDetail"
        >
          返回影片详情
        </button>
      </div>
    </div>

    <div
      v-else-if="error"
      class="flex items-center justify-center h-full"
    >
      <div class="text-red-500 text-lg">
        {{ error }}
      </div>
    </div>

    <div
      v-else
      class="h-full flex items-center justify-center relative"
    >
      <div
        id="player-container"
        class="w-full max-w-5xl"
        data-autoplay="false"
        :data-content-id="currentContentId || undefined"
        :data-source-revision="currentSourceRevision"
        :data-source-type="currentSourceType || undefined"
        :data-source-player-id="currentSourcePlayerId || undefined"
        :data-playback-click-count="playbackClickCount"
      />

      <div class="absolute inset-x-4 bottom-4 z-10 flex flex-col items-center gap-3 pointer-events-none">
        <section
          data-playback-evidence
          class="pointer-events-auto w-full max-w-5xl rounded-lg border border-gray-700 bg-black/80 p-4 text-white shadow-xl"
          aria-live="polite"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <CircleCheck v-if="playbackStatus === 'progressed'" :size="18" class="text-green-300" aria-hidden="true" />
              <CircleAlert v-else-if="playbackStatus === 'failed'" :size="18" class="text-red-300" aria-hidden="true" />
              <Clock3 v-else :size="18" class="text-amber-300" aria-hidden="true" />
              <span
                data-playback-status
                :role="playbackStatus === 'failed' ? 'alert' : 'status'"
                class="text-sm font-semibold"
              >
                {{ playbackStatusLabel(playbackStatus) }}
              </span>
            </div>
            <span class="text-xs text-gray-400 break-all">
              source：{{ currentSourceType || '尚未选择' }} · source attempt：{{ currentSourceAttempt }}
            </span>
          </div>
          <p v-if="playbackStatusReason" data-playback-reason class="mt-2 text-xs text-amber-200 break-words">
            {{ playbackStatusReason }}
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-player-action="play"
              aria-label="播放"
              :disabled="playbackClickRequested && playbackStatus !== 'failed'"
              class="min-h-11 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              title="播放"
              @click="handlePlayClick"
            >
              <Play :size="18" fill="currentColor" aria-hidden="true" />
              {{ playbackClickRequested ? '播放已请求' : '播放' }}
            </button>
            <span data-playback-click class="text-xs text-gray-400">
              visible Play clicks：{{ playbackClickCount }}
            </span>
          </div>

          <ul data-playback-event-timeline class="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
            <li
              v-for="event in playbackEvents"
              :key="event.event"
              :data-playback-event="event.event"
              :data-observed="event.observed"
              class="rounded border border-gray-700 bg-gray-900/70 px-2 py-2"
            >
              <span class="font-semibold text-gray-200">{{ event.event }}</span>
              <span class="ml-1" :class="event.observed ? 'text-green-300' : 'text-gray-400'">
                {{ event.observed ? '已观察' : '未观察' }}
              </span>
              <span class="mt-1 block text-gray-500">
                {{ event.observedAt == null ? '时间：未观察' : `时间：${event.observedAt}ms` }}
                · attempt {{ event.attempt ?? currentSourceAttempt }}
              </span>
            </li>
          </ul>

          <div data-playback-progress class="mt-3 grid grid-cols-1 gap-1 text-xs text-gray-300 sm:grid-cols-3">
            <span :data-current-time-before="currentTimeBefore == null ? 'pending' : currentTimeBefore">currentTimeBefore：{{ currentTimeBefore ?? '尚未采样' }}</span>
            <span :data-current-time-after="currentTimeAfter == null ? 'pending' : currentTimeAfter">currentTimeAfter：{{ currentTimeAfter ?? '尚未采样' }}</span>
            <span :data-current-time-delta="currentTimeDelta == null ? 'pending' : currentTimeDelta">delta：{{ currentTimeDelta ?? '尚未推进' }}</span>
          </div>

          <div v-if="sourceAttemptHistory.length" data-source-attempt-history class="mt-3 border-t border-gray-700 pt-2 text-xs text-gray-400">
            <p class="font-semibold text-gray-300">
              已完成来源尝试
            </p>
            <ul class="mt-1 space-y-1">
              <li v-for="attempt in sourceAttemptHistory" :key="`${attempt.sourceId}-${attempt.attempt}-${attempt.retryCount}`" data-source-attempt-row>
                {{ attempt.sourceType }} · attempt {{ attempt.attempt }} · retry {{ attempt.retryCount }}/{{ MAX_SOURCE_RETRIES }} · {{ attempt.outcome === 'failed' ? '失败' : '已推进' }}
              </li>
            </ul>
          </div>
        </section>
      </div>

      <!-- 统一 loading overlay -->
      <Transition name="fade">
        <div
          v-if="playerLoading && !errorState.visible"
          role="status"
          aria-live="polite"
          class="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
        >
          <div class="text-center">
            <div class="inline-block w-10 h-10 border-3 border-teal-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p class="text-white text-lg">
              {{ playerLoadingMessage || '正在缓冲...' }}
            </p>
            <p class="text-gray-400 text-sm mt-2">
              {{ isTorrServerMode ? '如果长时间无响应，系统会自动提示你重试当前源。' : '如果长时间无响应，系统会自动转为可见错误提示。' }}
            </p>
          </div>
        </div>
      </Transition>

      <!-- 统一错误卡片 -->
      <Transition name="fade">
        <div
          v-if="errorState.visible"
          role="alert"
          data-playback-failure
          class="absolute inset-0 flex items-center justify-center bg-black/80 z-20"
        >
          <div class="text-center max-w-lg px-6">
            <p class="text-red-400 text-lg mb-3">
              {{ errorState.message }}
            </p>
            <p class="text-gray-400 text-sm mb-6">
              {{ errorState.recoverable ? '可以先重试当前源；如果反复失败，请返回详情页手动切换播放源。' : '当前问题无法通过浏览器内重试恢复，建议返回详情页改用其他方式。' }}
            </p>
            <div class="flex flex-wrap gap-3 justify-center">
              <button
                v-if="errorState.recoverable"
                class="min-h-11 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                title="重试当前播放源"
                @click="retryCurrentSource"
              >
                <RefreshCw :size="16" aria-hidden="true" />
                重试当前源
              </button>
              <button
                v-if="hasAria2Fallback"
                class="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                title="将当前影片磁链添加到 Aria2"
                @click="fallbackToAria2"
              >
                ⬇ 添加到 Aria2
              </button>
              <button
                class="min-h-11 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                title="返回影片详情页后手动切换播放源"
                @click="goToDetail"
              >
                {{ errorState.recoverable ? '返回详情页' : '切换来源' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 系列导航 -->
    <div v-if="seriesNavigation" class="bg-gray-800 border-t border-gray-700 px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <RouterLink
          v-if="seriesNavigation.prev"
          :to="`/movie/${seriesNavigation.prev.code}/play`"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-white transition min-w-0 max-w-[38%]"
        >
          <span class="shrink-0">←</span>
          <span class="truncate text-gray-300">{{ seriesNavigation.prev.title }}</span>
        </RouterLink>
        <span v-else class="w-[38%]" />

        <div class="text-center shrink-0">
          <div class="text-xs text-gray-400 mb-0.5">
            {{ seriesNavigation.series }}
          </div>
          <div class="text-sm font-semibold text-white">
            第 {{ seriesNavigation.position }} 部 / 共 {{ seriesNavigation.total }} 部
          </div>
        </div>

        <RouterLink
          v-if="seriesNavigation.next"
          :to="`/movie/${seriesNavigation.next.code}/play`"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-white transition min-w-0 max-w-[38%] justify-end"
        >
          <span class="truncate text-gray-300">{{ seriesNavigation.next.title }}</span>
          <span class="shrink-0">→</span>
        </RouterLink>
        <span v-else class="w-[38%]" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }

  .animate-spin {
    animation: none;
  }
}
</style>
