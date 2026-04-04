<script setup lang="ts">
import type { Comic } from '../types'
import { Pagination } from '@starye/ui'
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { comicApi } from '../lib/api-client'

const loading = ref(false)
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
  status: '' as 'serializing' | 'completed' | '',
  sortBy: 'updatedAt' as 'title' | 'createdAt' | 'updatedAt',
  sortOrder: 'desc' as 'asc' | 'desc',
})

async function search() {
  searched.value = true
  pagination.page = 1
  await fetchComics()
}

async function fetchComics() {
  loading.value = true
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
  catch (err) {
    console.error('Failed to search comics:', err)
  }
  finally {
    loading.value = false
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
  Object.assign(pagination, { page: 1, total: 0, totalPages: 0 })
}
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold mb-1">
        搜索漫画
      </h1>
    </header>

    <!-- 搜索面板 -->
    <div class="bg-card rounded-xl border p-4 sm:p-6 mb-6 shadow-sm">
      <div class="space-y-4">
        <div class="relative">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7 7 0 1 0 4.65 4.65a7 7 0 0 0 12 12Z" />
          </svg>
          <input
            v-model="filters.search"
            type="search"
            placeholder="输入漫画标题或作者…"
            class="w-full pl-10 pr-4 py-2.5 border bg-background rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            @keyup.enter="search"
          >
        </div>

        <div class="flex flex-wrap gap-3">
          <select
            v-model="filters.status"
            class="px-3 py-2 border bg-background rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            class="px-3 py-2 border bg-background rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            class="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            :disabled="loading"
            @click="search"
          >
            {{ loading ? '搜索中…' : '搜索' }}
          </button>

          <button
            class="px-5 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            @click="resetFilters"
          >
            重置
          </button>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div v-for="i in 10" :key="i" class="animate-pulse">
        <div class="bg-muted aspect-3/4 rounded-xl mb-2" />
        <div class="bg-muted h-4 rounded mb-1" />
        <div class="bg-muted h-3 rounded w-2/3" />
      </div>
    </div>

    <!-- 无结果 -->
    <div v-else-if="searched && comics.length === 0" class="text-center py-16 text-muted-foreground">
      <svg class="w-12 h-12 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <p>未找到相关漫画</p>
    </div>

    <!-- 结果列表 -->
    <div v-else-if="comics.length > 0">
      <p class="text-sm text-muted-foreground mb-4">
        共找到 {{ pagination.total }} 部漫画
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <RouterLink
          v-for="comic in comics"
          :key="comic.id"
          :to="`/comic/${comic.slug}`"
          class="group"
        >
          <div class="relative overflow-hidden rounded-xl shadow-sm group-hover:shadow-md transition-shadow duration-200">
            <div class="aspect-3/4 bg-muted">
              <img
                v-if="comic.coverImage"
                :src="comic.coverImage"
                :alt="comic.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              >
            </div>
            <span v-if="comic.isR18" class="absolute top-2 right-2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">
              R18
            </span>
          </div>
          <h3 class="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
            {{ comic.title }}
          </h3>
          <p class="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {{ comic.author || '未知作者' }}
          </p>
        </RouterLink>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.totalPages > 1" class="mt-8">
        <Pagination
          :current-page="pagination.page"
          :total-pages="pagination.totalPages"
          :total="pagination.total"
          :page-size="pagination.limit"
          @page-change="changePage"
        />
      </div>
    </div>
  </div>
</template>
