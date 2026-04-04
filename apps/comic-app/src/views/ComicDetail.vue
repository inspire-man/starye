<script setup lang="ts">
import type { Chapter, Comic } from '../types'
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

const { fetchFavorites, toggleFavorite, isFavorite } = useFavorites()

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
  if (userStore.user) {
    await fetchFavorites()
  }
})
</script>

<template>
  <div v-if="loading" class="animate-pulse space-y-4">
    <div class="bg-muted h-56 sm:h-64 rounded-xl" />
    <div class="bg-muted h-8 rounded w-1/2" />
    <div class="bg-muted h-4 rounded w-1/3" />
  </div>

  <div v-else-if="error" class="text-center py-16">
    <p class="text-destructive mb-4">
      {{ error }}
    </p>
    <RouterLink to="/" class="text-primary hover:underline text-sm">
      返回首页
    </RouterLink>
  </div>

  <div v-else-if="comic" class="space-y-4 sm:space-y-6">
    <!-- 漫画信息卡 -->
    <div class="bg-card rounded-xl border shadow-sm p-4 sm:p-6">
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
          <div class="flex items-start justify-between mb-4 gap-3">
            <div class="flex-1 min-w-0">
              <h1 class="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 leading-snug">
                {{ comic.title }}
              </h1>
              <p class="text-muted-foreground text-sm">
                {{ comic.author || '未知作者' }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="comic.isR18" class="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">
                R18
              </span>
              <button
                v-if="userStore.user"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
                :class="isFavorite(comic.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-primary hover:text-primary'"
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
                class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="comic.status === 'serializing'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-muted text-muted-foreground'"
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
                  class="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium"
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
    <div class="bg-card rounded-xl border shadow-sm p-4 sm:p-6">
      <h2 class="text-lg sm:text-xl font-bold mb-4">
        章节列表
        <span class="text-sm font-normal text-muted-foreground ml-2">共 {{ chapters.length }} 话</span>
      </h2>

      <div v-if="chapters.length === 0" class="text-center py-8 text-muted-foreground">
        暂无章节
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
        <RouterLink
          v-for="chapter in chapters"
          :key="chapter.id"
          :to="`/comic/${comic.slug}/read/${chapter.id.split('-').pop()}`"
          class="border rounded-lg p-2.5 text-center text-sm hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
        >
          <p class="font-medium line-clamp-2 leading-snug">
            {{ chapter.title }}
          </p>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
