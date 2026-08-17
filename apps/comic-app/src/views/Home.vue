<script setup lang="ts">
import type { SelectOption } from '@starye/ui'
import type { Comic } from '../types'
import { ComicCard, Pagination, Select, SkeletonCard, useListQuery } from '@starye/ui'
import { onMounted, reactive, ref, watch } from 'vue'
import { comicApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const comics = ref<Comic[]>([])
const { page, limit, total, totalPages, loading, error, execute, goToPage, updatePageSize } = useListQuery(20)

type ComicStatusFilter = 'serializing' | 'completed' | ''
type ComicSort = 'title' | 'createdAt' | 'updatedAt'

const filters = reactive({
  status: '' as ComicStatusFilter,
  sortBy: 'updatedAt' as ComicSort,
  sortOrder: 'desc' as 'asc' | 'desc',
})

const statusOptions: SelectOption<ComicStatusFilter>[] = [
  { label: '全部状态', value: '' },
  { label: '连载中', value: 'serializing' },
  { label: '已完结', value: 'completed' },
]

const sortOptions: SelectOption<ComicSort>[] = [
  { label: '最近更新', value: 'updatedAt' },
  { label: '最新上架', value: 'createdAt' },
  { label: '按标题', value: 'title' },
]

async function fetchComics() {
  const data = await execute(({ page, limit }) => comicApi.getComics({
    page,
    limit,
    status: filters.status || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }).then((response) => {
    if (!response.success)
      throw new Error('加载漫画失败')
    return response
  }), '加载漫画失败')
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

watch([() => filters.status, () => filters.sortBy], async () => {
  await goToPage(1)
  await fetchComics()
})

onMounted(() => {
  fetchComics()
})
</script>

<template>
  <div class="ui-public-page">
    <!-- R18 状态提示 -->
    <div v-if="userStore.user && !userStore.user.isR18Verified" class="ui-public-surface ui-status-warning mb-5 px-4 py-3">
      <div class="flex items-center gap-3">
        <span class="text-xl shrink-0">🔒</span>
        <div class="text-sm flex-1 min-w-0">
          <p class="font-medium text-[hsl(var(--status-warning))]">
            部分 R18 内容已隐藏
          </p>
          <p class="mt-0.5 hidden text-xs text-muted-foreground sm:block">
            当前账号未获得 R18 内容访问权限。如需访问，请联系管理员申请。
          </p>
        </div>
      </div>
    </div>

    <div class="ui-public-page-header">
      <div>
        <h1 class="ui-public-page-title">
          热门漫画
        </h1>
        <p class="ui-public-page-description">
          按更新状态和排序浏览漫画目录
        </p>
      </div>
    </div>

    <section class="ui-public-surface ui-public-filter">
      <div class="ui-public-filter-grid">
        <div class="ui-public-field">
          <label for="comic-home-status">状态</label>
          <Select
            id="comic-home-status"
            v-model="filters.status"
            :options="statusOptions"
            aria-label="漫画状态"
          />
        </div>
        <div class="ui-public-field">
          <label for="comic-home-sort">排序</label>
          <Select
            id="comic-home-sort"
            v-model="filters.sortBy"
            :options="sortOptions"
            aria-label="漫画排序"
          />
        </div>
      </div>
    </section>

    <!-- 骨架屏 -->
    <div v-if="loading" class="ui-public-grid">
      <SkeletonCard v-for="i in 10" :key="i" variant="poster" />
    </div>

    <div v-else-if="error" class="ui-public-empty">
      <span class="text-3xl text-[hsl(var(--status-danger))]">!</span>
      <p>{{ error }}</p>
      <button class="ui-public-button ui-public-button-ghost" @click="fetchComics">
        重试
      </button>
    </div>

    <div v-else-if="comics.length === 0" class="ui-public-empty">
      <span class="text-3xl">📚</span>
      <p>暂无漫画</p>
    </div>

    <div v-else>
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
      <Pagination
        v-if="totalPages > 1"
        :current-page="page"
        :total-pages="totalPages"
        :total="total"
        :page-size="limit"
        layout="total, prev, pager, next, jumper"
        @page-change="changePage"
        @size-change="changePageSize"
      />
    </div>
  </div>
</template>
