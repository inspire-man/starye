<script setup lang="ts">
import type { SelectOption } from '@starye/ui'
import type { Comic } from '../types'
import { ComicCard, Pagination, Select, SkeletonCard, useListQuery } from '@starye/ui'
import { reactive, ref } from 'vue'
import { comicApi } from '../lib/api-client'

const searched = ref(false)
const comics = ref<Comic[]>([])
const { page, limit, total, totalPages, loading, error, execute, goToPage, updatePageSize, cancel, resetMeta } = useListQuery(20)

const filters = reactive({
  search: '',
  status: '' as 'serializing' | 'completed' | '',
  sortBy: 'updatedAt' as 'title' | 'createdAt' | 'updatedAt',
  sortOrder: 'desc' as 'asc' | 'desc',
})

const statusOptions: SelectOption<typeof filters.status>[] = [
  { label: '全部状态', value: '' },
  { label: '连载中', value: 'serializing' },
  { label: '已完结', value: 'completed' },
]

const sortOptions: SelectOption<typeof filters.sortBy>[] = [
  { label: '最近更新', value: 'updatedAt' },
  { label: '最新上架', value: 'createdAt' },
  { label: '按标题', value: 'title' },
]

async function search() {
  searched.value = true
  await goToPage(1)
  await fetchComics()
}

async function fetchComics() {
  const data = await execute(({ page, limit }) => comicApi.getComics({
    page,
    limit,
    search: filters.search || undefined,
    status: filters.status || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }).then((response) => {
    if (!response.success)
      throw new Error('搜索漫画失败')
    return response
  }), '搜索漫画失败')
  if (data)
    comics.value = data
}

async function changePage(page: number) {
  await goToPage(page)
  await fetchComics()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function changePageSize(size: number) {
  await updatePageSize(size)
  await fetchComics()
}

function resetFilters() {
  filters.search = ''
  filters.status = ''
  filters.sortBy = 'updatedAt'
  searched.value = false
  cancel()
  resetMeta()
  comics.value = []
  void goToPage(1)
}
</script>

<template>
  <div class="ui-public-page">
    <header class="ui-public-page-header">
      <div>
        <h1 class="ui-public-page-title">
          搜索漫画
        </h1>
        <p class="ui-public-page-description">
          按标题、状态和更新时间查找漫画
        </p>
      </div>
    </header>

    <!-- 搜索面板 -->
    <section class="ui-public-surface ui-public-filter">
      <div class="ui-public-field">
        <label for="comic-search-query">关键词</label>
        <div class="relative min-w-0">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7 7 0 1 0 4.65 4.65a7 7 0 0 0 12 12Z" />
          </svg>
          <input
            id="comic-search-query"
            v-model="filters.search"
            type="search"
            placeholder="输入标题或作者"
            class="ui-public-input w-full pl-9"
            @keyup.enter="search"
          >
        </div>
      </div>

      <div class="ui-public-filter-grid">
        <div class="ui-public-field">
          <label for="comic-search-status">状态</label>
          <Select
            id="comic-search-status"
            v-model="filters.status"
            :options="statusOptions"
          />
        </div>

        <div class="ui-public-field">
          <label for="comic-search-sort">排序</label>
          <Select
            id="comic-search-sort"
            v-model="filters.sortBy"
            :options="sortOptions"
          />
        </div>
      </div>

      <div class="ui-public-actions">
        <div class="ui-public-actions-group">
          <button
            class="ui-public-button ui-public-button-primary"
            :disabled="loading"
            @click="search"
          >
            {{ loading ? '搜索中…' : '搜索' }}
          </button>

          <button
            class="ui-public-button ui-public-button-ghost"
            @click="resetFilters"
          >
            重置
          </button>
        </div>
      </div>
    </section>

    <!-- 加载中 -->
    <div v-if="loading" class="ui-public-grid">
      <SkeletonCard v-for="i in 10" :key="i" variant="poster" />
    </div>

    <div v-else-if="error" class="ui-public-empty">
      <span class="text-3xl text-[hsl(var(--status-danger))]">!</span>
      <p>{{ error }}</p>
      <button class="ui-public-button ui-public-button-ghost" @click="search">
        重试
      </button>
    </div>

    <!-- 无结果 -->
    <div v-else-if="searched && comics.length === 0" class="ui-public-empty">
      <span class="text-3xl">⌕</span>
      <p>未找到相关漫画</p>
    </div>

    <!-- 结果列表 -->
    <div v-else-if="comics.length > 0">
      <p class="mb-4 text-sm text-muted-foreground">
        共找到 {{ total }} 部漫画
      </p>
      <div class="ui-public-grid">
        <ComicCard
          v-for="comic in comics"
          :key="comic.id"
          :title="comic.title"
          :href="`/${comic.slug}`"
          :cover="comic.coverImage"
          :author="comic.author"
          :status="comic.status"
          :is-r18="comic.isR18"
          label-missing-cover="暂无封面"
          label-unknown-author="未知作者"
          label-serializing="连载中"
          label-completed="已完结"
        />
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="mt-8">
        <Pagination
          :current-page="page"
          :total-pages="totalPages"
          :total="total"
          :page-size="limit"
          @page-change="changePage"
          @size-change="changePageSize"
        />
      </div>
    </div>
  </div>
</template>
