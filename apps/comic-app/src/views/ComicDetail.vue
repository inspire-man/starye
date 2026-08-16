<script setup lang="ts">
import type { Chapter, Comic } from '../types'
import { SkeletonCard } from '@starye/ui'
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useFavorites } from '../composables/useFavorites'
import { comicApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'

const route = useRoute()
const userStore = useUserStore()
const loading = ref(true)
const error = ref('')
const comic = ref<Comic | null>(null)
const chapters = ref<Chapter[]>([])

const { checkFavorite, toggleFavorite, isFavorite } = useFavorites()

async function fetchComicDetail() {
  loading.value = true
  error.value = ''

  try {
    const slug = route.params.slug as string
    const response = await comicApi.getComicDetail(slug)

    if (response.success && response.data) {
      comic.value = response.data
      chapters.value = response.data.chapters || []
    }
    else {
      error.value = response.error || '加载失败'
    }
  }
  catch (err: any) {
    error.value = err.response?.data?.error || '加载漫画详情失败'
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchComicDetail()
  if (userStore.user && comic.value) {
    await checkFavorite(comic.value.id)
  }
})
</script>

<template>
  <div v-if="loading" class="ui-public-page space-y-5">
    <div class="ui-public-surface flex flex-col gap-4 p-4 sm:flex-row sm:p-6">
      <SkeletonCard variant="poster" class="w-full sm:w-48" />
      <SkeletonCard variant="content" class="min-w-0 flex-1" />
    </div>
    <SkeletonCard variant="content" />
  </div>

  <div v-else-if="error" class="ui-public-page">
    <div class="ui-public-empty">
      <p class="text-[hsl(var(--status-danger))]">
        {{ error }}
      </p>
      <div class="ui-public-actions-group">
        <button class="ui-public-button ui-public-button-primary" @click="fetchComicDetail">
          重试
        </button>
        <RouterLink to="/" class="ui-public-button ui-public-button-ghost">
          返回首页
        </RouterLink>
      </div>
    </div>
  </div>

  <div v-else-if="comic" class="ui-public-page space-y-5 sm:space-y-6">
    <!-- 漫画信息卡 -->
    <div class="ui-public-surface p-4 sm:p-6">
      <div class="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <!-- 封面 -->
        <div class="shrink-0 mx-auto sm:mx-0">
          <img
            v-if="comic.coverImage"
            :src="comic.coverImage"
            :alt="comic.title"
            class="w-36 sm:w-44 md:w-48 aspect-3/4 object-cover rounded-xl shadow-md"
          >
          <div v-else class="w-36 sm:w-44 md:w-48 aspect-3/4 bg-muted rounded-xl flex items-center justify-center">
            <span class="text-muted-foreground text-sm">暂无封面</span>
          </div>
        </div>

        <!-- 详情 -->
        <div class="flex-1 min-w-0">
          <!-- 标题行 -->
          <div class="mb-4 flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h1 class="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 leading-snug">
                {{ comic.title }}
              </h1>
              <p class="text-muted-foreground text-sm">
                {{ comic.author || '未知作者' }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="comic.isR18" class="ui-status-tag ui-status-danger">
                R18
              </span>
              <button
                v-if="userStore.user"
                class="ui-public-button"
                :class="isFavorite(comic.id)
                  ? 'ui-public-button-primary'
                  : 'ui-public-button-ghost'"
                @click="toggleFavorite(comic.id, comic.title)"
              >
                <svg class="w-4 h-4 shrink-0" :fill="isFavorite(comic.id) ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
                <span class="hidden sm:inline">{{ isFavorite(comic.id) ? '已收藏' : '收藏' }}</span>
              </button>
            </div>
          </div>

          <!-- 元信息 -->
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-3">
              <span class="text-muted-foreground shrink-0">状态</span>
              <span
                class="ui-status-tag"
                :class="comic.status === 'serializing'
                  ? 'ui-status-info'
                  : 'ui-status-success'"
              >
                {{ comic.status === 'serializing' ? '连载中' : '已完结' }}
              </span>
            </div>

            <div v-if="comic.genres && comic.genres.length > 0" class="flex items-start gap-3">
              <span class="text-muted-foreground shrink-0 pt-0.5">分类</span>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="genre in comic.genres"
                  :key="genre"
                  class="ui-status-tag ui-status-info"
                >
                  {{ genre }}
                </span>
              </div>
            </div>

            <div v-if="comic.description" class="flex items-start gap-3">
              <span class="text-muted-foreground shrink-0 pt-0.5">简介</span>
              <p class="text-foreground leading-relaxed flex-1">
                {{ comic.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 章节列表卡 -->
    <div class="ui-public-surface p-4 sm:p-6">
      <h2 class="mb-4 text-lg font-bold sm:text-xl">
        章节列表
        <span class="text-sm font-normal text-muted-foreground ml-2">共 {{ chapters.length }} 话</span>
      </h2>

      <div v-if="chapters.length === 0" class="ui-public-empty min-h-0">
        暂无章节
      </div>

      <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <RouterLink
          v-for="chapter in chapters"
          :key="chapter.id"
          :to="`/${comic.slug}/read/${chapter.id.split('-').pop()}`"
          class="rounded-[var(--ui-radius-md)] border border-border p-2.5 text-center text-sm transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
        >
          <p class="font-medium line-clamp-2 leading-snug">
            {{ chapter.title }}
          </p>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
