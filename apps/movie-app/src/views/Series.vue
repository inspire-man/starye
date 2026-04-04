<script setup lang="ts">
import type { Movie, SeriesDetail } from '../types'
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { movieApi, seriesApi } from '../lib/api-client'

const route = useRoute()
const loading = ref(true)
const movies = ref<Movie[]>([])
const seriesName = ref('')
const seriesDetail = ref<SeriesDetail | null>(null)
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

/** 格式化总时长：分钟 → "约 X 小时" */
function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0)
    return null as unknown as string
  const hours = Math.round(minutes / 60)
  return hours > 0 ? `约 ${hours} 小时` : `${minutes} 分钟`
}

/** 格式化年份区间 */
function formatYearRange(minYear: number | null, maxYear: number | null): string {
  if (!minYear && !maxYear)
    return ''
  if (minYear === maxYear)
    return `${minYear} 年`
  return `${minYear ?? '?'} - ${maxYear ?? '?'} 年`
}

async function fetchSeriesMovies() {
  const name = route.params.name as string
  if (!name)
    return

  seriesName.value = decodeURIComponent(name)
  loading.value = true

  try {
    // 并行发出两个请求，不增加加载时间
    const [moviesResponse, detailResponse] = await Promise.allSettled([
      movieApi.getMovies({
        page: pagination.page,
        limit: pagination.limit,
        series: seriesName.value,
        sortBy: 'releaseDate',
        sortOrder: 'desc',
      }),
      seriesApi.getSeriesDetail(seriesName.value),
    ])

    if (moviesResponse.status === 'fulfilled' && moviesResponse.value.success) {
      movies.value = moviesResponse.value.data
      Object.assign(pagination, moviesResponse.value.pagination)
    }

    if (detailResponse.status === 'fulfilled') {
      seriesDetail.value = detailResponse.value
    }
  }
  catch (error) {
    console.error('Failed to fetch series data:', error)
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
    seriesDetail.value = null
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

    <!-- 系列概览卡片 -->
    <div
      v-if="seriesDetail"
      class="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-6 flex flex-wrap gap-x-6 gap-y-2 items-center"
    >
      <!-- 厂商链接 -->
      <div v-if="seriesDetail.publisher" class="flex items-center gap-1.5 text-sm">
        <span class="text-gray-400">厂商：</span>
        <RouterLink
          v-if="seriesDetail.publisher.slug"
          :to="`/publisher/${seriesDetail.publisher.slug}`"
          class="text-primary-400 hover:text-primary-300 font-medium transition-colors"
        >
          {{ seriesDetail.publisher.name }} →
        </RouterLink>
        <span v-else class="text-gray-300">{{ seriesDetail.publisher.name }}</span>
      </div>

      <!-- 影片数 -->
      <div class="flex items-center gap-1 text-sm">
        <span class="text-gray-400">共</span>
        <span class="text-white font-semibold">{{ seriesDetail.movieCount }}</span>
        <span class="text-gray-400">部</span>
      </div>

      <!-- 总时长 -->
      <div v-if="formatDuration(seriesDetail.totalDuration)" class="flex items-center gap-1 text-sm">
        <span class="text-gray-400">总时长</span>
        <span class="text-white font-semibold">{{ formatDuration(seriesDetail.totalDuration) }}</span>
      </div>

      <!-- 年份区间 -->
      <div v-if="formatYearRange(seriesDetail.minYear, seriesDetail.maxYear)" class="flex items-center gap-1 text-sm">
        <span class="text-gray-400">发行</span>
        <span class="text-white font-semibold">{{ formatYearRange(seriesDetail.minYear, seriesDetail.maxYear) }}</span>
      </div>
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

    <!-- 同厂商其他系列（relatedSeries 非空时才显示） -->
    <div
      v-if="seriesDetail && seriesDetail.relatedSeries.length > 0"
      class="mt-10 border-t border-gray-700 pt-6"
    >
      <h2 class="text-gray-300 text-sm font-semibold mb-3">
        同厂商其他系列
      </h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="related in seriesDetail.relatedSeries"
          :key="related"
          :to="`/series/${encodeURIComponent(related)}`"
          class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm rounded-full transition-colors"
        >
          {{ related }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
