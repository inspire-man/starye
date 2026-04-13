<script setup lang="ts">
import type { Movie } from '../types'
import { Pagination } from '@starye/ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { movieApi } from '../lib/api-client'

const route = useRoute()
const router = useRouter()

const currentYear = new Date().getFullYear()
const activeYear = ref(Number(route.query.year) || currentYear)
const loading = ref(true)
const movies = ref<Movie[]>([])

const pagination = reactive({
  page: Number(route.query.page) || 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

const yearTabs = computed(() => {
  const tabs = []
  for (let i = 0; i < 5; i++) {
    tabs.push(currentYear - i)
  }
  return tabs
})

function syncUrl() {
  router.replace({
    query: {
      ...(pagination.page > 1 && { page: String(pagination.page) }),
      ...(activeYear.value !== currentYear && { year: String(activeYear.value) }),
    },
  })
}

async function fetchMovies() {
  loading.value = true
  try {
    const response = await movieApi.getMovies({
      page: pagination.page,
      limit: pagination.limit,
      yearFrom: activeYear.value,
      yearTo: activeYear.value,
      sortBy: 'releaseDate',
      sortOrder: 'desc',
    })

    if (response.success) {
      movies.value = response.data
      Object.assign(pagination, response.pagination)
    }
  }
  catch (error) {
    console.error('Failed to fetch new releases:', error)
  }
  finally {
    loading.value = false
  }
}

function setYear(year: number) {
  if (activeYear.value === year)
    return
  activeYear.value = year
  pagination.page = 1
  syncUrl()
  fetchMovies()
}

function changePage(page: number) {
  pagination.page = page
  syncUrl()
  fetchMovies()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const groupedByMonth = computed(() => {
  const groupMap = new Map<string, Movie[]>()

  for (const movie of movies.value) {
    if (!movie.releaseDate)
      continue
    const date = new Date(movie.releaseDate)
    const yearStr = date.getFullYear()
    const monthStr = String(date.getMonth() + 1).padStart(2, '0')
    const key = `${yearStr}-${monthStr}`

    if (!groupMap.has(key)) {
      groupMap.set(key, [])
    }
    groupMap.get(key)!.push(movie)
  }

  // Sort keys descending
  const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => b.localeCompare(a))

  return sortedKeys.map((key) => {
    const [year, month] = key.split('-')
    return {
      key,
      title: `${year} 年 ${Number(month)} 月`,
      movies: groupMap.get(key)!,
    }
  })
})

onMounted(() => {
  fetchMovies()
})
</script>

<template>
  <div class="pb-16 sm:pb-0">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-white mb-4">
        最新发布
      </h1>

      <!-- 年份 Tab -->
      <div class="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
        <button
          v-for="year in yearTabs"
          :key="year"
          class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border"
          :class="[
            activeYear === year
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-primary-500 hover:text-white',
          ]"
          @click="setYear(year)"
        >
          {{ year }} 年
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div v-for="i in 10" :key="i" class="animate-pulse">
        <div class="bg-gray-800 aspect-[3/4] rounded-lg mb-2" />
        <div class="bg-gray-800 h-4 rounded mb-1" />
        <div class="bg-gray-800 h-3 rounded w-2/3" />
      </div>
    </div>

    <!-- 无数据空状态 -->
    <div v-else-if="movies.length === 0" class="text-center py-12">
      <p class="text-gray-400">
        该年份暂无发布日期数据
      </p>
    </div>

    <!-- 影片列表分组 -->
    <div v-else class="space-y-8">
      <div v-for="group in groupedByMonth" :key="group.key">
        <h2 class="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <span>{{ group.title }}</span>
          <span class="text-sm font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-md">{{ group.movies.length }} 部</span>
        </h2>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <RouterLink
            v-for="movie in group.movies"
            :key="movie.id"
            :to="`/movie/${movie.code}`"
            class="group cursor-pointer block"
          >
            <div class="relative overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
              <div class="aspect-[3/4] bg-gray-800">
                <img
                  v-if="movie.coverImage"
                  :src="movie.coverImage"
                  :alt="movie.title"
                  class="w-full h-full object-cover object-right group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                >
              </div>
              <div
                v-if="movie.isR18"
                class="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded"
              >
                R18
              </div>
            </div>
            <h3 class="mt-2 text-sm font-medium text-white line-clamp-2 group-hover:text-primary-400 transition" :title="movie.title">
              {{ movie.title }}
            </h3>
            <p class="text-xs text-gray-400 mt-1">
              {{ movie.code }}
            </p>
          </RouterLink>
        </div>
      </div>

      <Pagination
        v-if="pagination.totalPages > 1"
        :current-page="pagination.page"
        :total-pages="pagination.totalPages"
        :total="pagination.total"
        :page-size="pagination.limit"
        layout="total, prev, pager, next, jumper"
        class="mt-8 pb-8"
        @update:current-page="changePage"
      />
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  scrollbar-width: none;
}
</style>
