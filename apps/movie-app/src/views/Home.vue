<script setup lang="ts">
import type { Movie } from '../types'
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { movieApi } from '../api'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const loading = ref(true)
const movies = ref<Movie[]>([])
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

const filters = reactive({
  search: '',
  sortBy: 'releaseDate',
  sortOrder: 'desc' as 'asc' | 'desc',
})

async function fetchMovies() {
  loading.value = true
  try {
    const response = await movieApi.getMovies({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })

    if (response.success) {
      movies.value = response.data
      Object.assign(pagination, response.pagination)
    }
  }
  catch (error) {
    console.error('Failed to fetch movies:', error)
  }
  finally {
    loading.value = false
  }
}

function changePage(page: number) {
  pagination.page = page
  fetchMovies()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function searchMovies() {
  pagination.page = 1
  fetchMovies()
}

watch(() => filters.sortBy, () => {
  pagination.page = 1
  fetchMovies()
})

onMounted(() => {
  fetchMovies()
})
</script>

<template>
  <div>
    <!-- R18 Status Banner (if logged in and not verified) -->
    <div v-if="userStore.user && !userStore.user.isR18Verified" class="bg-amber-900/20 border border-amber-700 rounded-lg px-4 py-3 mb-6">
      <div class="flex items-center gap-3">
        <span class="text-2xl flex-shrink-0">🔒</span>
        <div class="text-sm flex-1">
          <p class="font-medium text-amber-300">
            部分 R18 内容已隐藏
          </p>
          <p class="text-amber-400 text-xs mt-0.5">
            当前账号未获得 R18 内容访问权限。如需访问，请联系管理员申请。
          </p>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <h1 class="text-3xl font-bold text-white mb-4">
        热门影片
      </h1>

      <div class="flex flex-wrap gap-4 mb-6">
        <input
          v-model="filters.search"
          type="text"
          placeholder="搜索番号或标题..."
          class="flex-1 min-w-[200px] px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          @keyup.enter="searchMovies"
        >

        <select
          v-model="filters.sortBy"
          class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="releaseDate">
            发行日期
          </option>
          <option value="updatedAt">
            最近更新
          </option>
          <option value="createdAt">
            最新上架
          </option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div v-for="i in 10" :key="i" class="animate-pulse">
        <div class="bg-gray-800 aspect-[3/4] rounded-lg mb-2" />
        <div class="bg-gray-800 h-4 rounded mb-1" />
        <div class="bg-gray-800 h-3 rounded w-2/3" />
      </div>
    </div>

    <div v-else-if="movies.length === 0" class="text-center py-12">
      <p class="text-gray-400">
        暂无影片
      </p>
    </div>

    <div v-else>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <RouterLink
          v-for="movie in movies"
          :key="movie.id"
          :to="`/movie/${movie.code}`"
          class="group cursor-pointer"
        >
          <div class="relative overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
            <div class="aspect-[3/4] bg-gray-800">
              <img
                v-if="movie.coverImage"
                :src="movie.coverImage"
                :alt="movie.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          <h3 class="mt-2 font-medium text-white line-clamp-2 group-hover:text-primary-400 transition">
            {{ movie.title }}
          </h3>
          <p class="text-sm text-gray-400 line-clamp-1">
            {{ movie.code }}
          </p>
        </RouterLink>
      </div>

      <div v-if="pagination.totalPages > 1" class="mt-8 flex justify-center gap-2">
        <button
          :disabled="pagination.page <= 1"
          class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="changePage(pagination.page - 1)"
        >
          上一页
        </button>
        <span class="px-4 py-2 text-gray-300">
          {{ pagination.page }} / {{ pagination.totalPages }}
        </span>
        <button
          :disabled="pagination.page >= pagination.totalPages"
          class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="changePage(pagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>
