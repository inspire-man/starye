<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Player from 'xgplayer'
import { movieApi, progressApi } from '../api'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const error = ref('')
const movieTitle = ref('')
const movieCode = ref('')
let player: Player | null = null
let saveProgressTimer: number | null = null

async function fetchMovieAndPlay() {
  loading.value = true
  error.value = ''

  try {
    const code = route.params.code as string
    movieCode.value = code

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

  player.on('timeupdate', () => {
    if (userStore.user && player) {
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

function goBack() {
  router.back()
}

onMounted(() => {
  fetchMovieAndPlay()
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
    <div class="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
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
      class="h-full flex items-center justify-center"
    >
      <div id="player-container" class="w-full max-w-5xl" />
    </div>
  </div>
</template>
