<script setup lang="ts">
import type { Movie } from '../types'
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { movieApi } from '../api'

const searched = ref(false)
const movies = ref<Movie[]>([])
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

const filters = reactive({
  search: '',
  actor: '',
  publisher: '',
  sortBy: 'releaseDate',
  sortOrder: 'desc' as 'asc' | 'desc',
})

async function search() {
  searched.value = true
  pagination.page = 1
  await fetchMovies()
}

async function fetchMovies() {
  try {
    const response = await movieApi.getMovies({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      actor: filters.actor || undefined,
      publisher: filters.publisher || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })

    if (response.success) {
      movies.value = response.data
      Object.assign(pagination, response.pagination)
    }
  }
  catch (error) {
    console.error('Failed to search movies:', error)
  }
}

function changePage(page: number) {
  pagination.page = page
  fetchMovies()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function resetFilters() {
  filters.search = ''
  filters.actor = ''
  filters.publisher = ''
  filters.sortBy = 'releaseDate'
  searched.value = false
  movies.value = []
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-white mb-4">
        搜索影片
      </h1>

      <div class="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div class="space-y-4">
          <input
            v-model="filters.search"
            type="text"
            placeholder="输入番号或标题..."
            class="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            @keyup.enter="search"
          >

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              v-model="filters.actor"
              type="text"
              placeholder="演员"
              class="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >

            <input
              v-model="filters.publisher"
              type="text"
              placeholder="制作商"
              class="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >

            <select
              v-model="filters.sortBy"
              class="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
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

            <button
              class="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-all shadow-md hover:shadow-lg"
              @click="search"
            >
              搜索
            </button>

            <button
              class="border border-gray-700 hover:bg-gray-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-all"
              @click="resetFilters"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="searched && movies.length === 0" class="text-center py-12">
      <p class="text-gray-400">
        未找到相关影片
      </p>
    </div>

    <div v-else-if="movies.length > 0">
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
