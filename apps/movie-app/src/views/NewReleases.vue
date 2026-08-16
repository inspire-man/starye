<script setup lang="ts">
import type { Movie } from '../types'
import { MovieCard, Pagination, SkeletonCard, useListQuery } from '@starye/ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { movieApi } from '../lib/api-client'

const route = useRoute()
const router = useRouter()

const currentYear = new Date().getFullYear()
const activeYear = ref(Number(route.query.year) || currentYear)
const movies = ref<Movie[]>([])
const { page, limit, total, totalPages, loading, error, execute, goToPage, updatePageSize } = useListQuery(20)

const yearTabs = computed(() => {
  const tabs = []
  for (let i = 0; i < 5; i++) {
    tabs.push(currentYear - i)
  }
  return tabs
})

async function syncUrl(pageNumber = page.value): Promise<void> {
  await router.replace({
    query: {
      ...route.query,
      ...(pageNumber > 1 ? { page: String(pageNumber) } : { page: undefined }),
      year: activeYear.value !== currentYear ? String(activeYear.value) : undefined,
    },
  })
}

async function fetchMovies() {
  const data = await execute(({ page, limit }) => movieApi.getMovies({
    page,
    limit,
    yearFrom: activeYear.value,
    yearTo: activeYear.value,
    sortBy: 'releaseDate',
    sortOrder: 'desc',
  }).then((response) => {
    if (!response.success)
      throw new Error('加载最新发布失败')
    return response
  }), '加载最新发布失败')
  if (data)
    movies.value = data
}

function setYear(year: number) {
  if (activeYear.value === year)
    return
  activeYear.value = year
  void syncUrl(1).then(fetchMovies)
}

async function changePage(page: number): Promise<void> {
  await goToPage(page)
  await fetchMovies()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function changePageSize(size: number): Promise<void> {
  await updatePageSize(size)
  await fetchMovies()
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
  <div class="ui-public-page pb-16 sm:pb-0">
    <div class="ui-public-page-header">
      <h1 class="ui-public-page-title">
        最新发布
      </h1>
    </div>

    <!-- 年份 Tab -->
    <div class="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button
        v-for="year in yearTabs"
        :key="year"
        class="ui-public-button whitespace-nowrap rounded-full border"
        :class="[
          activeYear === year
            ? 'ui-public-button-primary'
            : 'ui-public-button-ghost',
        ]"
        @click="setYear(year)"
      >
        {{ year }} 年
      </button>
    </div>
    <!-- 加载状态 -->
    <div v-if="loading" class="ui-public-grid">
      <SkeletonCard v-for="i in 10" :key="i" variant="poster" />
    </div>

    <!-- 无数据空状态 -->
    <div v-else-if="error" class="ui-public-empty">
      <span class="text-3xl text-[hsl(var(--status-danger))]">!</span>
      <p>{{ error }}</p>
      <button class="ui-public-button ui-public-button-ghost" @click="fetchMovies">
        重试
      </button>
    </div>

    <div v-else-if="movies.length === 0" class="ui-public-empty">
      <span class="text-3xl">🎬</span>
      <p class="text-muted-foreground">
        该年份暂无发布日期数据
      </p>
    </div>

    <!-- 影片列表分组 -->
    <div v-else class="space-y-8">
      <div v-for="group in groupedByMonth" :key="group.key">
        <h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <span>{{ group.title }}</span>
          <span class="ui-status-tag ui-status-neutral">{{ group.movies.length }} 部</span>
        </h2>

        <div class="ui-public-grid">
          <MovieCard
            v-for="movie in group.movies"
            :key="movie.id"
            :title="movie.title"
            :href="`/movie/${movie.code}`"
            :code="movie.code"
            :cover="movie.coverImage"
            :release-date="movie.releaseDate ? new Date(movie.releaseDate) : null"
            :is-r18="movie.isR18"
            label-missing-cover="暂无封面"
          />
        </div>
      </div>

      <Pagination
        v-if="totalPages > 1"
        :current-page="page"
        :total-pages="totalPages"
        :total="total"
        :page-size="limit"
        layout="total, prev, pager, next, jumper"
        class="mt-8 pb-8"
        @update:current-page="changePage"
        @size-change="changePageSize"
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
