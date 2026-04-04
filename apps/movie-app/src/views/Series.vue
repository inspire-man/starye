<script setup lang="ts">
import type { Movie } from '../types'
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { movieApi } from '../lib/api-client'

const route = useRoute()
const loading = ref(true)
const movies = ref<Movie[]>([])
const seriesName = ref('')
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

async function fetchSeriesMovies() {
  const name = route.params.name as string
  if (!name)
    return

  seriesName.value = decodeURIComponent(name)
  loading.value = true

  try {
    const response = await movieApi.getMovies({
      page: pagination.page,
      limit: pagination.limit,
      series: seriesName.value,
    })

    if (response.success) {
      movies.value = response.data
      Object.assign(pagination, response.pagination)
    }
  }
  catch (error) {
    console.error('Failed to fetch series movies:', error)
  }
  finally {
    loading.value = false
  }
}

function changePage(page: number) {
  pagination.page = page
  fetchSeriesMovies()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => route.params.name, (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    pagination.page = 1
    fetchSeriesMovies()
  }
})

onMounted(() => {
  fetchSeriesMovies()
})
</script>

<template>
  <div>
    <div class="mb-6">
      <RouterLink to="/" class="text-primary-400 hover:text-primary-300 text-sm mb-2 inline-block">
        &larr; 返回首页
      </RouterLink>
      <h1 class="text-3xl font-bold text-white">
        系列：{{ seriesName }}
      </h1>
      <p v-if="!loading" class="text-gray-400 text-sm mt-1">
        共 {{ pagination.total }} 部影片
      </p>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="movies.length === 0" class="text-center py-16">
      <p class="text-5xl mb-4">
        🎬
      </p>
      <p class="text-gray-400 text-lg">
        该系列暂无影片
      </p>
    </div>

    <!-- 影片网格 -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <RouterLink
        v-for="m in movies"
        :key="m.id"
        :to="`/movie/${m.code}`"
        class="group"
      >
        <div class="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
          <img
            v-if="m.coverImage"
            :src="m.coverImage"
            :alt="m.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          >
          <div v-else class="w-full h-full flex items-center justify-center text-gray-600 text-4xl">
            🎬
          </div>
          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
            <p class="text-white text-xs font-medium truncate">
              {{ m.code }}
            </p>
          </div>
        </div>
        <p class="text-gray-300 text-sm mt-2 line-clamp-2 group-hover:text-white transition-colors">
          {{ m.title }}
        </p>
      </RouterLink>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="flex justify-center gap-2 mt-8">
      <button
        v-for="p in pagination.totalPages"
        :key="p"
        class="w-10 h-10 rounded-lg text-sm font-medium transition-colors"
        :class="p === pagination.page
          ? 'bg-primary-600 text-white'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'"
        @click="changePage(p)"
      >
        {{ p }}
      </button>
    </div>
  </div>
</template>
