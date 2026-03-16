<script setup lang="ts">
import type { Chapter, Comic } from '../types'
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { comicApi } from '../api'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const comic = ref<Comic | null>(null)
const chapters = ref<Chapter[]>([])

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

onMounted(() => {
  fetchComicDetail()
})
</script>

<template>
  <div v-if="loading" class="animate-pulse">
    <div class="bg-gray-200 h-64 rounded-lg mb-4" />
    <div class="bg-gray-200 h-8 rounded w-1/2 mb-2" />
    <div class="bg-gray-200 h-4 rounded w-1/3" />
  </div>

  <div v-else-if="error" class="text-center py-12">
    <p class="text-red-600 mb-4">
      {{ error }}
    </p>
    <RouterLink to="/" class="text-primary-600 hover:underline">
      返回首页
    </RouterLink>
  </div>

  <div v-else-if="comic" class="space-y-6">
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex flex-col md:flex-row gap-6">
        <div class="flex-shrink-0">
          <img
            v-if="comic.coverImage"
            :src="comic.coverImage"
            :alt="comic.title"
            class="w-48 h-64 object-cover rounded-lg shadow-md"
          >
          <div v-else class="w-48 h-64 bg-gray-200 rounded-lg flex items-center justify-center">
            <span class="text-gray-400">暂无封面</span>
          </div>
        </div>

        <div class="flex-1">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h1 class="text-3xl font-bold text-gray-900 mb-2">
                {{ comic.title }}
              </h1>
              <p class="text-gray-600">
                {{ comic.author || '未知作者' }}
              </p>
            </div>
            <span
              v-if="comic.isR18"
              class="bg-red-600 text-white text-sm px-3 py-1 rounded"
            >
              R18
            </span>
          </div>

          <div class="space-y-3">
            <div class="flex items-center text-sm">
              <span class="text-gray-500 w-20">状态：</span>
              <span class="text-gray-900">{{ comic.status === 'serializing' ? '连载中' : '已完结' }}</span>
            </div>

            <div v-if="comic.genres && comic.genres.length > 0" class="flex items-start text-sm">
              <span class="text-gray-500 w-20 flex-shrink-0">分类：</span>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="genre in comic.genres"
                  :key="genre"
                  class="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs"
                >
                  {{ genre }}
                </span>
              </div>
            </div>

            <div v-if="comic.description" class="flex items-start text-sm">
              <span class="text-gray-500 w-20 flex-shrink-0">简介：</span>
              <p class="text-gray-700 flex-1">
                {{ comic.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-bold text-gray-900 mb-4">
        章节列表
      </h2>

      <div v-if="chapters.length === 0" class="text-center py-8 text-gray-500">
        暂无章节
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <RouterLink
          v-for="chapter in chapters"
          :key="chapter.id"
          :to="`/comic/${comic.slug}/read/${chapter.id.split('-').pop()}`"
          class="border border-gray-200 hover:border-primary-500 hover:bg-primary-50 rounded-md p-3 text-center transition"
        >
          <p class="text-sm font-medium text-gray-900 line-clamp-2">
            {{ chapter.title }}
          </p>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
