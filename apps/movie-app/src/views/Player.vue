<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Player from 'xgplayer'
import { useAria2 } from '../composables/useAria2'
import { movieApi, progressApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { isConnected: aria2Connected, addMagnetTask } = useAria2()

const loading = ref(true)
const error = ref('')
const movieTitle = ref('')
const movieCode = ref('')
let player: Player | null = null
let saveProgressTimer: number | null = null

// TorrServer 流播放状态
const isTorrServerMode = computed(() => !!route.query.streamUrl)
const torrServerBuffering = ref(false)
const torrServerError = ref('')
const currentMagnetUrl = ref('')

async function fetchMovieAndPlay() {
  loading.value = true
  error.value = ''

  try {
    const code = route.params.code as string
    movieCode.value = code

    // TorrServer 模式：直接使用 streamUrl 播放
    const streamUrl = route.query.streamUrl as string | undefined
    if (streamUrl) {
      torrServerBuffering.value = true
      // 仍然获取影片标题用于显示
      try {
        const response = await movieApi.getMovieDetail(code)
        if (response.success && response.data) {
          movieTitle.value = response.data.title
          // 保存磁链用于降级到 Aria2
          const magnetPlayer = response.data.players?.find(p => p.sourceUrl.startsWith('magnet:'))
          if (magnetPlayer) {
            currentMagnetUrl.value = magnetPlayer.sourceUrl
          }
        }
      }
      catch {
        movieTitle.value = code
      }

      initPlayer(streamUrl, 0)
      loading.value = false
      return
    }

    // 标准模式：从 API 获取播放源
    const response = await movieApi.getMovieDetail(code)

    if (!response.success || !response.data) {
      error.value = response.error || '加载失败'
      return
    }

    const movie = response.data
    movieTitle.value = movie.title

    const playerId = route.query.player as string | undefined
    let selectedPlayer = movie.players[0]

    if (playerId) {
      const found = movie.players.find(p => p.id === playerId)
      if (found)
        selectedPlayer = found
    }

    if (!selectedPlayer) {
      error.value = '未找到播放源'
      return
    }

    let startTime = 0
    if (userStore.user) {
      const progressResponse = await progressApi.getWatchingProgress(code)
      if (progressResponse.success && progressResponse.data && !Array.isArray(progressResponse.data)) {
        startTime = progressResponse.data.progress
      }
    }

    initPlayer(selectedPlayer.sourceUrl, startTime)
  }
  catch (err: any) {
    error.value = err.response?.data?.error || '加载影片失败'
  }
  finally {
    loading.value = false
  }
}

function initPlayer(url: string, startTime: number) {
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

  // TorrServer 模式：监听 canplay 隐藏缓冲层
  if (isTorrServerMode.value) {
    player.on('canplay', () => {
      torrServerBuffering.value = false
    })

    player.on('error', () => {
      torrServerBuffering.value = false
      torrServerError.value = '视频播放失败。可能是浏览器不支持该视频格式（如 MKV/HEVC），建议使用 Aria2 下载后本地播放。'
    })

    player.on('waiting', () => {
      torrServerBuffering.value = true
    })

    player.on('playing', () => {
      torrServerBuffering.value = false
    })
  }

  // 标准模式：进度保存
  player.on('timeupdate', () => {
    if (userStore.user && player && !isTorrServerMode.value) {
      debounceSaveProgress(player.currentTime, player.duration)
    }
  })
}

function debounceSaveProgress(progress: number, duration: number) {
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer)
  }

  saveProgressTimer = window.setTimeout(async () => {
    try {
      await progressApi.saveWatchingProgress(movieCode.value, Math.floor(progress), Math.floor(duration))
    }
    catch (error) {
      console.error('Failed to save progress:', error)
    }
  }, 2000)
}

// 降级到 Aria2 下载
async function fallbackToAria2() {
  if (!currentMagnetUrl.value) {
    goBack()
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

onMounted(() => {
  fetchMovieAndPlay()
  // 上报观看（fire-and-forget），用于热门排序 viewCount 统计
  const code = route.params.code as string
  if (code) {
    movieApi.trackView(code)
  }
})

onUnmounted(() => {
  if (player) {
    player.destroy()
  }
  if (saveProgressTimer) {
    clearTimeout(saveProgressTimer)
  }
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

      <!-- TorrServer 缓冲 overlay -->
      <Transition name="fade">
        <div
          v-if="isTorrServerMode && torrServerBuffering && !torrServerError"
          class="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
        >
          <div class="text-center">
            <div class="inline-block w-10 h-10 border-3 border-teal-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p class="text-white text-lg">
              正在缓冲...
            </p>
            <p class="text-gray-400 text-sm mt-2">
              TorrServer 正在加载视频数据，请稍候
            </p>
          </div>
        </div>
      </Transition>

      <!-- TorrServer 错误降级 -->
      <Transition name="fade">
        <div
          v-if="isTorrServerMode && torrServerError"
          class="absolute inset-0 flex items-center justify-center bg-black/80 z-20"
        >
          <div class="text-center max-w-md px-6">
            <p class="text-red-400 text-lg mb-4">
              {{ torrServerError }}
            </p>
            <div class="flex gap-3 justify-center">
              <button
                v-if="aria2Connected && currentMagnetUrl"
                class="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                @click="fallbackToAria2"
              >
                ⬇ 添加到 Aria2
              </button>
              <button
                class="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                @click="goToDetail"
              >
                返回详情页
              </button>
            </div>
          </div>
        </div>
      </Transition>
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
