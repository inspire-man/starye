<script setup lang="ts">
import type { Movie, SeriesDetail } from '../types'
import { MovieCard, Pagination, SkeletonCard, useListQuery } from '@starye/ui'
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { movieApi, seriesApi } from '../lib/api-client'

const route = useRoute()
const movies = ref<Movie[]>([])
const seriesName = ref('')
const seriesDetail = ref<SeriesDetail | null>(null)
const { page, limit, total, totalPages, loading, error, execute, goToPage, updatePageSize } = useListQuery(20)

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
  const [movieData, detailResponse] = await Promise.all([
    execute(({ page, limit }) => movieApi.getMovies({
      page,
      limit,
      series: seriesName.value,
      sortBy: 'releaseDate',
      sortOrder: 'desc',
    }).then((response) => {
      if (!response.success)
        throw new Error('加载系列影片失败')
      return response
    }), '加载系列影片失败'),
    seriesApi.getSeriesDetail(seriesName.value).catch(() => null),
  ])

  if (movieData)
    movies.value = movieData
  if (detailResponse)
    seriesDetail.value = detailResponse
}

async function changePage(page: number): Promise<void> {
  await goToPage(page)
  await fetchSeriesMovies()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function changePageSize(size: number): Promise<void> {
  await updatePageSize(size)
  await fetchSeriesMovies()
}

watch(() => route.params.name, async (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    await goToPage(1)
    seriesDetail.value = null
    await fetchSeriesMovies()
  }
})

onMounted(() => {
  fetchSeriesMovies()
})
</script>

<template>
  <div class="ui-public-page">
    <div class="ui-public-page-header">
      <div>
        <RouterLink to="/" class="mb-2 inline-block text-sm text-primary hover:underline">
          &larr; 返回首页
        </RouterLink>
        <h1 class="ui-public-page-title">
          系列：{{ seriesName }}
        </h1>
        <p v-if="!loading" class="ui-public-page-description">
          共 {{ total }} 部影片
        </p>
      </div>
    </div>

    <!-- 系列概览卡片 -->
    <div
      v-if="seriesDetail"
      class="ui-public-surface mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4"
    >
      <!-- 厂商链接 -->
      <div v-if="seriesDetail.publisher" class="flex items-center gap-1.5 text-sm">
        <span class="text-muted-foreground">厂商：</span>
        <RouterLink
          v-if="seriesDetail.publisher.slug"
          :to="`/publishers/${seriesDetail.publisher.slug}`"
          class="font-medium text-primary transition-colors hover:underline"
        >
          {{ seriesDetail.publisher.name }} →
        </RouterLink>
        <span v-else class="text-foreground">{{ seriesDetail.publisher.name }}</span>
      </div>

      <!-- 影片数 -->
      <div class="flex items-center gap-1 text-sm">
        <span class="text-muted-foreground">共</span>
        <span class="font-semibold text-foreground">{{ seriesDetail.movieCount }}</span>
        <span class="text-muted-foreground">部</span>
      </div>

      <!-- 总时长 -->
      <div v-if="formatDuration(seriesDetail.totalDuration)" class="flex items-center gap-1 text-sm">
        <span class="text-muted-foreground">总时长</span>
        <span class="font-semibold text-foreground">{{ formatDuration(seriesDetail.totalDuration) }}</span>
      </div>

      <!-- 年份区间 -->
      <div v-if="formatYearRange(seriesDetail.minYear, seriesDetail.maxYear)" class="flex items-center gap-1 text-sm">
        <span class="text-muted-foreground">发行</span>
        <span class="font-semibold text-foreground">{{ formatYearRange(seriesDetail.minYear, seriesDetail.maxYear) }}</span>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="ui-public-grid">
      <SkeletonCard v-for="n in 10" :key="n" variant="poster" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="error" class="ui-public-empty">
      <span class="text-3xl text-[hsl(var(--status-danger))]">!</span>
      <p>{{ error }}</p>
      <button class="ui-public-button ui-public-button-ghost" @click="fetchSeriesMovies">
        重试
      </button>
    </div>

    <div v-else-if="movies.length === 0" class="ui-public-empty">
      <span class="text-3xl">🎬</span>
      <p class="text-lg text-muted-foreground">
        该系列暂无影片
      </p>
    </div>

    <!-- 影片网格 -->
    <div v-else class="ui-public-grid">
      <MovieCard
        v-for="m in movies"
        :key="m.id"
        :title="m.title"
        :href="`/movie/${m.code}`"
        :code="m.code"
        :cover="m.coverImage"
        :release-date="m.releaseDate ? new Date(m.releaseDate) : null"
        :is-r18="m.isR18"
        label-missing-cover="暂无封面"
      />
    </div>

    <!-- 分页 -->
    <Pagination
      v-if="totalPages > 1"
      :current-page="page"
      :total-pages="totalPages"
      :total="total"
      :page-size="limit"
      @page-change="changePage"
      @size-change="changePageSize"
    />

    <!-- 同厂商其他系列（relatedSeries 非空时才显示） -->
    <div
      v-if="seriesDetail && seriesDetail.relatedSeries.length > 0"
      class="mt-10 border-t border-border pt-6"
    >
      <h2 class="mb-3 text-sm font-semibold text-foreground">
        同厂商其他系列
      </h2>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="related in seriesDetail.relatedSeries"
          :key="related"
          :to="`/series/${encodeURIComponent(related)}`"
          class="ui-public-button ui-public-button-ghost rounded-full"
        >
          {{ related }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
