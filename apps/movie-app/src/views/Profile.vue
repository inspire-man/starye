<script setup lang="ts">
import type { WatchingProgress } from '../types'
import { onMounted, ref } from 'vue'
import { progressApi } from '../api'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const loadingHistory = ref(false)
const watchingHistory = ref<WatchingProgress[]>([])

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

async function fetchWatchingHistory() {
  if (!userStore.user)
    return

  loadingHistory.value = true
  try {
    const response = await progressApi.getWatchingProgress()
    if (response.success && Array.isArray(response.data)) {
      watchingHistory.value = response.data
    }
  }
  catch (error) {
    console.error('Failed to fetch watching history:', error)
  }
  finally {
    loadingHistory.value = false
  }
}

onMounted(() => {
  if (userStore.user) {
    fetchWatchingHistory()
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!userStore.user" class="text-center py-12">
      <p class="text-gray-400 mb-4">
        请先登录查看个人中心
      </p>
      <button
        class="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-md font-medium transition"
        @click="userStore.signIn"
      >
        登录
      </button>
    </div>

    <div v-else class="space-y-6">
      <div class="bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 class="text-2xl font-bold text-white mb-4">
          个人中心
        </h1>

        <div class="flex items-center space-x-4 mb-6">
          <img
            v-if="userStore.user.image"
            :src="userStore.user.image"
            :alt="userStore.user.name"
            class="w-20 h-20 rounded-full"
          >
          <div v-else class="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
            {{ userStore.user.name[0].toUpperCase() }}
          </div>

          <div>
            <h2 class="text-xl font-bold text-white">
              {{ userStore.user.name }}
            </h2>
            <p class="text-gray-400">
              {{ userStore.user.email }}
            </p>
            <span
              v-if="userStore.user.isR18Verified"
              class="inline-block mt-2 bg-green-900 text-green-300 text-xs px-2 py-1 rounded"
            >
              已验证 R18
            </span>
          </div>
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-bold text-white mb-4">
          观看历史
        </h2>

        <div v-if="loadingHistory" class="text-center py-8 text-gray-400">
          加载中...
        </div>

        <div v-else-if="watchingHistory.length === 0" class="text-center py-8 text-gray-400">
          暂无观看历史
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in watchingHistory"
            :key="item.id"
            class="flex items-center justify-between border-b border-gray-700 pb-3 last:border-0"
          >
            <div class="flex-1">
              <p class="text-white font-medium">
                {{ item.movieCode }}
              </p>
              <p class="text-sm text-gray-400">
                观看至 {{ formatTime(item.progress) }}
                <span v-if="item.duration"> / {{ formatTime(item.duration) }}</span>
              </p>
            </div>
            <p class="text-xs text-gray-500">
              {{ new Date(item.updatedAt).toLocaleString() }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
