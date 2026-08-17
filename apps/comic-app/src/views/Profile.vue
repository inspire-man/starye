<script setup lang="ts">
import type { ReadingProgress } from '../types'
import { onMounted, ref, watch } from 'vue'
import { progressApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const loadingHistory = ref(false)
const readingHistory = ref<ReadingProgress[]>([])

async function fetchReadingHistory() {
  if (!userStore.user)
    return

  loadingHistory.value = true
  try {
    const response = await progressApi.getReadingProgress()
    if (response.success && Array.isArray(response.data)) {
      readingHistory.value = response.data
    }
  }
  catch (error) {
    console.error('Failed to fetch reading history:', error)
  }
  finally {
    loadingHistory.value = false
  }
}

onMounted(() => {
  if (userStore.user) {
    void fetchReadingHistory()
  }
})

watch(() => userStore.user?.id, (userId) => {
  if (userId) {
    void fetchReadingHistory()
  }
})
</script>

<template>
  <div class="ui-public-page">
    <div v-if="!userStore.user" class="ui-public-empty">
      <p class="mb-4">
        请先登录查看个人中心
      </p>
      <button
        class="ui-public-button ui-public-button-primary"
        @click="userStore.signIn"
      >
        登录
      </button>
    </div>

    <div v-else class="space-y-6">
      <div class="ui-public-surface p-6">
        <h1 class="mb-4 text-2xl font-bold text-foreground">
          个人中心
        </h1>

        <div class="flex items-center space-x-4 mb-6">
          <img
            v-if="userStore.user.image"
            :src="userStore.user.image"
            :alt="userStore.user.name"
            class="w-20 h-20 rounded-full"
          >
          <div v-else class="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {{ userStore.user.name[0].toUpperCase() }}
          </div>

          <div>
            <h2 class="text-xl font-bold text-foreground">
              {{ userStore.user.name }}
            </h2>
            <p class="text-muted-foreground">
              {{ userStore.user.email }}
            </p>
            <span
              v-if="userStore.user.isR18Verified"
              class="ui-status-tag ui-status-success mt-2"
            >
              已验证 R18
            </span>
          </div>
        </div>
      </div>

      <div class="ui-public-surface p-6">
        <h2 class="mb-4 text-xl font-bold text-foreground">
          阅读历史
        </h2>

        <div v-if="loadingHistory" class="ui-public-empty min-h-0">
          加载中...
        </div>

        <div v-else-if="readingHistory.length === 0" class="ui-public-empty min-h-0">
          暂无阅读历史
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in readingHistory"
            :key="item.id"
            class="flex items-center justify-between border-b border-border pb-3 last:border-0"
          >
            <div class="flex-1">
              <p class="font-medium text-foreground">
                {{ item.comicTitle || '未知漫画' }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ item.chapterTitle || item.chapterId }}
                <span class="mx-1">·</span>
                阅读至第 {{ item.page }} 页
                <span class="mx-1">·</span>
                {{ item.completed ? '已读完' : '未读完' }}
              </p>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ new Date(item.updatedAt).toLocaleString() }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
