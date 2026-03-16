<script setup lang="ts">
import type { Comic } from '../types'
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { comicApi } from '../api'

const searched = ref(false)
const comics = ref<Comic[]>([])
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

const filters = reactive({
  search: '',
  status: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc' as 'asc' | 'desc',
})

async function search() {
  searched.value = true
  pagination.page = 1
  await fetchComics()
}

async function fetchComics() {
  try {
    const response = await comicApi.getComics({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      status: filters.status || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })

    if (response.success) {
      comics.value = response.data
      Object.assign(pagination, response.pagination)
    }
  }
  catch (error) {
    console.error('Failed to search comics:', error)
  }
}

function changePage(page: number) {
  pagination.page = page
  fetchComics()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function resetFilters() {
  filters.search = ''
  filters.status = ''
  filters.sortBy = 'updatedAt'
  searched.value = false
  comics.value = []
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">
        搜索漫画
      </h1>

      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <div class="space-y-4">
          <input
            v-model="filters.search"
            type="text"
            placeholder="输入漫画标题或作者..."
            class="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            @keyup.enter="search"
          >

          <div class="flex flex-wrap gap-4">
            <select
              v-model="filters.status"
              class="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">
                全部状态
              </option>
              <option value="serializing">
                连载中
              </option>
              <option value="completed">
                已完结
              </option>
            </select>

            <select
              v-model="filters.sortBy"
              class="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="updatedAt">
                最近更新
              </option>
              <option value="createdAt">
                最新上架
              </option>
              <option value="title">
                按标题
              </option>
            </select>

            <button
              class="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-md font-medium transition"
              @click="search"
            >
              搜索
            </button>

            <button
              class="border border-gray-300 hover:bg-gray-100 text-gray-700 px-6 py-2 rounded-md font-medium transition"
              @click="resetFilters"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="searched && comics.length === 0" class="text-center py-12">
      <p class="text-gray-500">
        未找到相关漫画
      </p>
    </div>

    <div v-else-if="comics.length > 0">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <RouterLink
          v-for="comic in comics"
          :key="comic.id"
          :to="`/comic/${comic.slug}`"
          class="group cursor-pointer"
        >
          <div class="relative overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
            <div class="aspect-[3/4] bg-gray-200">
              <img
                v-if="comic.coverImage"
                :src="comic.coverImage"
                :alt="comic.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              >
            </div>
            <div
              v-if="comic.isR18"
              class="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded"
            >
              R18
            </div>
          </div>
          <h3 class="mt-2 font-medium text-gray-900 line-clamp-2 group-hover:text-primary-600 transition">
            {{ comic.title }}
          </h3>
          <p class="text-sm text-gray-500 line-clamp-1">
            {{ comic.author || '未知作者' }}
          </p>
        </RouterLink>
      </div>

      <div v-if="pagination.totalPages > 1" class="mt-8 flex justify-center gap-2">
        <button
          :disabled="pagination.page <= 1"
          class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="changePage(pagination.page - 1)"
        >
          上一页
        </button>
        <span class="px-4 py-2 text-gray-700">
          {{ pagination.page }} / {{ pagination.totalPages }}
        </span>
        <button
          :disabled="pagination.page >= pagination.totalPages"
          class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="changePage(pagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>
