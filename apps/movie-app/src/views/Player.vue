<script setup lang="ts">
import type { MovieDetail } from '../types'
import * as Sentry from '@sentry/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Player from 'xgplayer'
import { useAria2 } from '../composables/useAria2'
import { movieApi, progressApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'
import { isMagnetLink } from '../utils/magnetLink'
import {
  isTrustedTorrServerStreamUrl,
  resolveTrustedTorrServerOrigins,
  UNTRUSTED_STREAM_URL_MESSAGE,
} from '../utils/playerSecurity'

type ErrorKind = 'torrserver' | 'xgplayer' | 'network' | 'source-invalid' | 'unknown'

interface PlayerErrorState {
  visible: boolean
  kind: ErrorKind
  message: string
  recoverable: boolean
}

const BUFFERING_TIMEOUT_MS = 10000
const RETRY_FAILURE_WINDOW_MS = 3000
const PROGRESS_SAVE_INTERVAL_SECONDS = 10
const PROGRESS_MIN_SAVE_SECONDS = 30
const MOVIE_COMPLETED_THRESHOLD = 0.9

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { isConnected: aria2Connected, addMagnetTask } = useAria2()

const loading = ref(true)
const error = ref('')
const movieTitle = ref('')
const movieCode = ref('')
const movieData = ref<MovieDetail | null>(null)
let player: Player | null = null
let saveProgressTimer: number | null = null
let waitingTimeout: number | null = null
let lastRetryAt = 0
let lastTrackedMovieCode = ''
let lastSavedProgressSecond = -1

const playerLoading = ref(false)
const playerLoadingMessage = ref('')
const errorState = ref<PlayerErrorState>(createDefaultErrorState())
const currentSourceUrl = ref('')
const currentMagnetUrl = ref('')
const savedCompleted = ref(false)
const loadedProgressDuration = ref<number | null>(null)

const isTorrServerMode = computed(() => !!route.query.streamUrl)
const hasAria2Fallback = computed(() => Boolean(currentMagnetUrl.value) && aria2Connected.value)
const sentryEnabled = Boolean(import.meta.env.VITE_SENTRY_DSN)

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
  clearWaitingTimeout()

  if (player) {
    player.destroy()
    player = null
  }

  resetPlayerContainer()
}

function resetPlayerFeedback() {
  clearWaitingTimeout()
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
  stopPlayerLoading()
  clearRecoverableError()
  lastRetryAt = 0
}

function getEscalatedRetryMessage() {
  return '多次失败，请返回详情页切换源后再试。'
}

function showPlayerError(kind: ErrorKind, message: string, recoverable = true) {
  stopPlayerLoading()
  const finalMessage = lastRetryAt > 0 && Date.now() - lastRetryAt <= RETRY_FAILURE_WINDOW_MS
    ? getEscalatedRetryMessage()
    : message

  reportVideoFailure(kind, finalMessage, recoverable)

  errorState.value = {
    visible: true,
    kind,
    message: finalMessage,
    recoverable,
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
  startPlayerLoading(getLoadingMessage())
  waitingTimeout = window.setTimeout(() => {
    showPlayerError(
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

  if (isMagnetLink(currentSourceUrl.value)) {
    return {
      visible: true,
      kind: 'source-invalid',
      message: '当前源不是浏览器可直接播放的视频地址，请返回详情页使用 TorrServer 或添加到 Aria2。',
      recoverable: false,
    }
  }

  if (isTorrServerMode.value) {
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

async function fetchMovieAndPlay() {
  loading.value = true
  error.value = ''
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
    let startTime = 0

    // TorrServer 模式：直接使用 streamUrl 播放
    const streamUrl = route.query.streamUrl as string | undefined
    if (streamUrl) {
      const response = await movieApi.getMovieDetail(code)

      if (!response.success || !response.data) {
        error.value = response.error || '加载失败'
        loading.value = false
        return
      }

      const trustedOrigins = await resolveTrustedTorrServerOrigins()
      if (!isTrustedTorrServerStreamUrl(streamUrl, trustedOrigins)) {
        error.value = UNTRUSTED_STREAM_URL_MESSAGE
        loading.value = false
        return
      }

      sourceUrl = streamUrl
      movieTitle.value = response.data.title
      movieData.value = response.data
      const magnetPlayer = response.data.players?.find(p => p.sourceUrl.startsWith('magnet:'))
      if (magnetPlayer) {
        currentMagnetUrl.value = magnetPlayer.sourceUrl
      }

      if (userStore.user) {
        const progressResponse = await progressApi.getWatchingProgress(code)
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

      if (!response.success || !response.data) {
        error.value = response.error || '加载失败'
        loading.value = false
        return
      }

      const movie = response.data
      movieTitle.value = movie.title
      movieData.value = movie
      currentMagnetUrl.value = movie.players.find(p => isMagnetLink(p.sourceUrl))?.sourceUrl || ''

      const playerId = route.query.player as string | undefined
      let selectedPlayer = movie.players[0]

      if (playerId) {
        const found = movie.players.find(p => p.id === playerId)
        if (found)
          selectedPlayer = found
      }

      if (!selectedPlayer) {
        error.value = '未找到播放源'
        loading.value = false
        return
      }

      sourceUrl = selectedPlayer.sourceUrl

      if (userStore.user) {
        const progressResponse = await progressApi.getWatchingProgress(code)
        if (progressResponse.success && progressResponse.data && !Array.isArray(progressResponse.data)) {
          savedCompleted.value = progressResponse.data.completed
          loadedProgressDuration.value = progressResponse.data.duration
          if (!progressResponse.data.completed && progressResponse.data.progress >= PROGRESS_MIN_SAVE_SECONDS) {
            startTime = progressResponse.data.progress
          }
        }
      }
    }

    trackCurrentMovieViewOnce(code)
    loading.value = false
    await nextTick()
    initPlayer(sourceUrl, startTime)
  }
  catch (err: any) {
    destroyPlayerInstance()
    error.value = err instanceof Error ? err.message : (err.response?.data?.error || '加载影片失败')
    loading.value = false
  }
}

function initPlayer(url: string, startTime: number) {
  currentSourceUrl.value = url
  resetPlayerFeedback()
  scheduleWaitingTimeout()

  player = new Player({
    id: 'player-container',
    url,
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
    markPlaybackRecovered()
  })

  player.on('playing', () => {
    markPlaybackRecovered()
  })

  player.on('waiting', () => {
    scheduleWaitingTimeout()
  })

  player.on('ended', () => {
    stopPlayerLoading()
    lastRetryAt = 0
    void flushProgress('ended')
  })

  player.on('error', () => {
    const nextError = getPlaybackErrorState()
    showPlayerError(nextError.kind, nextError.message, nextError.recoverable)
  })

  player.on('timeupdate', () => {
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
  router.push(`/movie/${movieCode.value}`)
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
  if (!currentSourceUrl.value) {
    showPlayerError('source-invalid', '当前没有可重试的播放源，请返回详情页切换源。', false)
    return
  }

  const lastTime = player ? Math.max(0, Number(player.currentTime) || 0) : 0
  lastRetryAt = Date.now()
  destroyPlayerInstance()
  resetPlayerFeedback()
  startPlayerLoading('正在重新加载当前播放源...')

  await nextTick()
  initPlayer(currentSourceUrl.value, lastTime)
}

function handlePageHide() {
  void flushProgress('pagehide')
}

onMounted(() => {
  window.addEventListener('pagehide', handlePageHide)
  fetchMovieAndPlay()
})

watch(
  () => [route.params.code, route.query.player, route.query.streamUrl],
  ([newCode, newPlayer, newStreamUrl], [oldCode, oldPlayer, oldStreamUrl]) => {
    if (newCode === oldCode && newPlayer === oldPlayer && newStreamUrl === oldStreamUrl) {
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
      <div id="player-container" class="w-full max-w-5xl" />

      <!-- 统一 loading overlay -->
      <Transition name="fade">
        <div
          v-if="playerLoading && !errorState.visible"
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
                class="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                title="重试当前播放源"
                @click="retryCurrentSource"
              >
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
                class="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                title="返回影片详情页后手动切换播放源"
                @click="goToDetail"
              >
                返回详情页
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
</style>
