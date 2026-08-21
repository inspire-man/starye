<script setup lang="ts">
import type { SelectOption } from '@starye/ui'
import type { GenreItem, Movie, WatchingHistoryItem } from '../types'
import { MovieCard, Pagination, Select, SkeletonCard, useListQuery } from '@starye/ui'
import { ArrowDownUp, ArrowUpRight, LayoutGrid, List, Search } from 'lucide-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthGuard } from '../composables/useAuthGuard'
import { genreApi, movieApi, progressApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const { requireLogin } = useAuthGuard()

const userStore = useUserStore()
const movies = ref<Movie[]>([])
const { page, limit, total, totalPages, loading, error, execute, goToPage, updatePageSize } = useListQuery(20)

const activeGenre = ref('')
const showAllGenres = ref(false)
const viewMode = ref<'grid' | 'list'>('grid')

const filters = reactive({
  search: '',
  sortBy: 'releaseDate' as 'title' | 'createdAt' | 'updatedAt' | 'releaseDate',
  sortOrder: 'desc' as 'asc' | 'desc',
  yearFrom: '' as number | '',
  yearTo: '' as number | '',
  duration: '' as '' | 'short' | 'medium' | 'long',
})

// Genre 标签数据
const genres = ref<GenreItem[]>([])

const visibleGenres = computed(() => showAllGenres.value ? genres.value : genres.value.slice(0, 18))
const hasMoreGenres = computed(() => genres.value.length > 18)
const activeFilterCount = computed(() => [
  filters.search,
  activeGenre.value,
  filters.yearFrom,
  filters.yearTo,
  filters.duration,
].filter(Boolean).length)

// 继续观看列表（已登录用户，仅展示未完成记录）
const continueWatchingList = ref<WatchingHistoryItem[]>([])

// 猜你喜欢推荐列表
const recommendedMovies = ref<Movie[]>([])
const recommendedLoading = ref(false)

// 排序选项配置
const sortOptions: SelectOption<string>[] = [
  { label: '发行日期', value: 'releaseDate', icon: '📅' },
  { label: '最近更新', value: 'updatedAt', icon: '🔄' },
  { label: '最新上架', value: 'createdAt', icon: '✨' },
]

// 时长选项配置
const durationOptions = [
  { value: '', label: '不限' },
  { value: 'short', label: '短片 <60分' },
  { value: 'medium', label: '中等 60-120分' },
  { value: 'long', label: '长片 >120分' },
] as const

// 将当前状态同步到 URL query，用 replace 避免污染浏览器历史
async function syncUrl(pageNumber = page.value): Promise<void> {
  await router.replace({
    query: {
      ...route.query,
      ...(pageNumber > 1 ? { page: String(pageNumber) } : { page: undefined }),
      sortBy: filters.sortBy !== 'releaseDate' ? filters.sortBy : undefined,
      sortOrder: filters.sortOrder !== 'desc' ? filters.sortOrder : undefined,
      search: filters.search || undefined,
      genre: activeGenre.value || undefined,
      yearFrom: filters.yearFrom ? String(filters.yearFrom) : undefined,
      yearTo: filters.yearTo ? String(filters.yearTo) : undefined,
      duration: filters.duration || undefined,
    },
  })
}

async function fetchMovies() {
  let durationMin: number | undefined
  let durationMax: number | undefined
  if (filters.duration === 'short') {
    durationMax = 59
  }
  else if (filters.duration === 'medium') {
    durationMin = 60
    durationMax = 120
  }
  else if (filters.duration === 'long') {
    durationMin = 121
  }

  const data = await execute(({ page, limit }) => movieApi.getMovies({
    page,
    limit,
    search: filters.search || undefined,
    genre: activeGenre.value || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    yearFrom: filters.yearFrom || undefined,
    yearTo: filters.yearTo || undefined,
    durationMin,
    durationMax,
  }).then((response) => {
    if (!response.success)
      throw new Error('加载影片失败')
    return response
  }), '加载影片失败')
  if (data)
    movies.value = data
}

async function fetchGenres() {
  try {
    const response = await genreApi.getGenres()
    if (response.success && response.data) {
      genres.value = response.data
    }
  }
  catch {
    // genres 加载失败不影响主列表，静默忽略
  }
}

async function fetchContinueWatching() {
  // 未登录时不请求
  if (!userStore.user) {
    return
  }
  try {
    const response = await progressApi.getWatchingHistory(10)
    if (response.success && response.data) {
      continueWatchingList.value = response.data
        .filter(item => item.progress > 0 && !item.completed)
        .slice(0, 5)
    }
  }
  catch {
    // 进度加载失败不影响主列表，静默忽略
  }
}

async function fetchRecommended() {
  if (!userStore.user) {
    return
  }
  recommendedLoading.value = true
  try {
    const response = await movieApi.getRecommended()
    if (response.success && response.data) {
      // 推荐最多展示 12 部
      recommendedMovies.value = response.data.slice(0, 12)
    }
  }
  catch {
    // 推荐加载失败不影响主列表，静默忽略
  }
  finally {
    recommendedLoading.value = false
  }
}

async function applyFilters(): Promise<void> {
  await syncUrl(1)
  await fetchMovies()
}

function setGenre(genre: string) {
  if (activeGenre.value === genre) {
    return
  }
  activeGenre.value = genre
  void applyFilters()
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

function searchMovies(): void {
  void applyFilters()
}

watch(() => filters.sortBy, () => {
  void applyFilters()
})

watch(() => filters.sortOrder, () => {
  void applyFilters()
})

function clearGenreFilter() {
  activeGenre.value = ''
  void applyFilters()
}

function clearFilters(): void {
  filters.search = ''
  activeGenre.value = ''
  filters.yearFrom = ''
  filters.yearTo = ''
  filters.duration = ''
  void applyFilters()
}

function setViewMode(mode: 'grid' | 'list'): void {
  viewMode.value = mode
  localStorage.setItem('movie-view-mode', mode)
}

// 监听外部（如标签页点击）触发的 genre query 变化
watch(() => route.query.genre, (val) => {
  const genre = typeof val === 'string' ? val : ''
  if (genre !== activeGenre.value) {
    activeGenre.value = genre
    void applyFilters()
  }
})

function progressPercent(item: WatchingHistoryItem): number {
  if (!item.duration || item.duration === 0) {
    return 0
  }
  return Math.min(Math.round((item.progress / item.duration) * 100), 95)
}

function goToHistory() {
  if (!requireLogin('/movie/history')) {
    return
  }
  router.push('/history')
}

onMounted(() => {
  // 从 URL query 恢复状态
  filters.sortBy = (route.query.sortBy as typeof filters.sortBy) || 'releaseDate'
  filters.sortOrder = route.query.sortOrder === 'asc' ? 'asc' : 'desc'
  filters.search = (typeof route.query.search === 'string' ? route.query.search : '')
  activeGenre.value = (typeof route.query.genre === 'string' ? route.query.genre : '')
  filters.yearFrom = route.query.yearFrom && !Array.isArray(route.query.yearFrom) ? Number(route.query.yearFrom) : ''
  filters.yearTo = route.query.yearTo && !Array.isArray(route.query.yearTo) ? Number(route.query.yearTo) : ''
  filters.duration = (typeof route.query.duration === 'string' ? route.query.duration : '') as typeof filters.duration
  const storedViewMode = localStorage.getItem('movie-view-mode')
  if (storedViewMode === 'grid' || storedViewMode === 'list')
    viewMode.value = storedViewMode

  // 并行加载：主列表 + genres + 继续观看（互不依赖）
  fetchMovies()
  fetchGenres()
  fetchContinueWatching()
  fetchRecommended()
})
</script>

<template>
  <div class="ui-public-page movie-library-page">
    <header class="movie-library-hero">
      <div class="movie-library-kicker">
        <span class="movie-library-brand">JAV CATALOG</span>
        <span class="movie-library-count">{{ total }} 条记录</span>
      </div>
      <div class="movie-library-hero-main">
        <div>
          <h1 class="movie-library-title">
            影库
          </h1>
          <p class="movie-library-description">
            按番号、演员、厂商和标签浏览你的影片资料库。
          </p>
        </div>
        <nav class="movie-library-shortcuts" aria-label="影库快捷入口">
          <RouterLink to="/new-releases" class="movie-library-shortcut">
            <span class="movie-library-shortcut-label">新片</span>
            <ArrowUpRight :size="14" aria-hidden="true" />
          </RouterLink>
          <RouterLink to="/actors" class="movie-library-shortcut">
            <span class="movie-library-shortcut-label">女优</span>
            <ArrowUpRight :size="14" aria-hidden="true" />
          </RouterLink>
          <RouterLink to="/publishers" class="movie-library-shortcut">
            <span class="movie-library-shortcut-label">厂商</span>
            <ArrowUpRight :size="14" aria-hidden="true" />
          </RouterLink>
        </nav>
      </div>
    </header>

    <!-- R18 Status Banner (if logged in and not verified) -->
    <div v-if="userStore.user && !userStore.user.isR18Verified" class="ui-public-surface ui-status-warning mb-5 px-4 py-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl shrink-0">🔒</span>
        <div class="text-sm flex-1">
          <p class="font-medium">
            部分 R18 内容已隐藏
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            当前账号未获得 R18 内容访问权限。如需访问，请联系管理员申请。
          </p>
        </div>
      </div>
    </div>

    <!-- 继续观看板块（仅登录用户，且有未完成记录时显示） -->
    <section v-if="continueWatchingList.length > 0" class="continue-watching">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-white">
          继续观看
        </h2>
        <button class="text-xs text-gray-400 hover:text-primary-400 transition-colors" @click="goToHistory">
          查看全部历史 →
        </button>
      </div>
      <div class="continue-list">
        <RouterLink
          v-for="item in continueWatchingList"
          :key="item.id"
          :to="`/movie/${item.movieCode}/play`"
          class="continue-card"
        >
          <div class="continue-cover">
            <img
              v-if="item.coverImage"
              :src="item.coverImage"
              :alt="item.title"
              loading="lazy"
            >
            <div v-else class="cover-placeholder">
              <span>{{ item.isR18 ? 'R18' : '?' }}</span>
            </div>
          </div>
          <div class="continue-info">
            <p class="continue-title">
              {{ item.title }}
            </p>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: `${progressPercent(item)}%` }" />
            </div>
            <p class="progress-label">
              {{ progressPercent(item) }}%
            </p>
          </div>
        </RouterLink>
      </div>
    </section>

    <!-- 猜你喜欢板块（仅登录用户显示） -->
    <section v-if="userStore.user && (recommendedMovies.length > 0 || recommendedLoading)" class="continue-watching">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-white">
          猜你喜欢
        </h2>
      </div>
      <div v-if="recommendedLoading" class="continue-list">
        <div v-for="i in 3" :key="i" class="continue-card animate-pulse">
          <div class="continue-cover bg-gray-800" />
          <div class="continue-info">
            <div class="bg-gray-800 h-3 rounded w-3/4 mb-1" />
            <div class="bg-gray-800 h-2 rounded w-1/2" />
          </div>
        </div>
      </div>
      <div v-else class="continue-list">
        <RouterLink
          v-for="movie in recommendedMovies"
          :key="movie.id"
          :to="`/movie/${movie.code}`"
          class="continue-card"
        >
          <div class="continue-cover">
            <img
              v-if="movie.coverImage"
              :src="movie.coverImage"
              :alt="movie.title"
              loading="lazy"
            >
            <div v-else class="cover-placeholder">
              <span>{{ movie.isR18 ? 'R18' : '?' }}</span>
            </div>
          </div>
          <div class="continue-info">
            <p class="continue-title" :title="movie.title">
              {{ movie.title }}
            </p>
          </div>
        </RouterLink>
      </div>
    </section>

    <!-- Genre 筛选标签提示 -->
    <div v-if="activeGenre" class="ui-status-info mb-4 flex items-center gap-2 rounded-[var(--ui-radius-md)] border px-4 py-2">
      <span class="text-sm">
        当前筛选标签：<strong>{{ activeGenre }}</strong>
      </span>
      <button
        class="ml-auto text-sm transition-colors hover:text-primary"
        @click="clearGenreFilter"
      >
        清除筛选
      </button>
    </div>

    <div class="mb-6">
      <div class="movie-catalog-heading">
        <div>
          <p class="movie-library-kicker">
            COLLECTION
          </p>
          <h2 class="movie-catalog-title">
            {{ activeGenre ? `标签：${activeGenre}` : '热门影片' }}
          </h2>
          <p class="movie-catalog-meta">
            {{ total }} 部影片<span v-if="activeFilterCount"> · {{ activeFilterCount }} 项筛选</span>
          </p>
        </div>
        <div class="movie-view-switcher" aria-label="影片列表视图">
          <button
            type="button"
            class="movie-view-button"
            :class="{ 'is-active': viewMode === 'grid' }"
            aria-label="网格视图"
            :aria-pressed="viewMode === 'grid'"
            title="网格视图"
            @click="setViewMode('grid')"
          >
            <LayoutGrid :size="17" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="movie-view-button"
            :class="{ 'is-active': viewMode === 'list' }"
            aria-label="列表视图"
            :aria-pressed="viewMode === 'list'"
            title="列表视图"
            @click="setViewMode('list')"
          >
            <List :size="17" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="movie-catalog-toolbar">
        <div class="movie-search-field">
          <Search aria-hidden="true" class="movie-search-icon" :size="16" />
          <input
            v-model="filters.search"
            type="text"
            placeholder="搜索番号或标题..."
            class="ui-public-input"
            @keyup.enter="searchMovies"
          >
        </div>
        <Select
          v-model="filters.sortBy"
          class="movie-sort-select"
          :options="sortOptions"
          placeholder="排序"
          size="default"
        />
        <button
          type="button"
          class="movie-sort-order"
          :aria-label="filters.sortOrder === 'desc' ? '降序排列' : '升序排列'"
          :title="filters.sortOrder === 'desc' ? '降序排列' : '升序排列'"
          @click="filters.sortOrder = filters.sortOrder === 'desc' ? 'asc' : 'desc'"
        >
          <ArrowDownUp aria-hidden="true" :size="15" />
          {{ filters.sortOrder === 'desc' ? '最新' : '最早' }}
        </button>
        <button
          v-if="activeFilterCount"
          type="button"
          class="ui-public-button ui-public-button-ghost movie-clear-button"
          @click="clearFilters"
        >
          清除筛选
        </button>
      </div>

      <!-- Genre 标签栏 -->
      <div v-if="genres.length > 0" class="movie-genre-panel">
        <div class="movie-genre-heading">
          <span>热门标签</span>
          <button
            v-if="hasMoreGenres"
            type="button"
            class="movie-genre-more"
            @click="showAllGenres = !showAllGenres"
          >
            {{ showAllGenres ? '收起' : `全部 ${genres.length}` }}
          </button>
        </div>
        <div class="genre-bar">
          <button
            class="genre-tag"
            :class="{ active: activeGenre === '' }"
            @click="setGenre('')"
          >
            全部
          </button>
          <button
            v-for="item in visibleGenres"
            :key="item.genre"
            class="genre-tag"
            :class="{ active: activeGenre === item.genre }"
            @click="setGenre(item.genre)"
          >
            {{ item.genre }}
            <span class="genre-count">{{ item.count }}</span>
          </button>
        </div>
      </div>

      <!-- 高级筛选 -->
      <details class="ui-public-surface ui-public-filter mt-3">
        <summary class="cursor-pointer list-none text-sm font-semibold text-foreground">
          高级筛选
        </summary>
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">年份:</span>
            <input
              v-model.number="filters.yearFrom"
              type="number"
              min="2000"
              :max="new Date().getFullYear()"
              placeholder="2000"
              class="ui-public-input w-20 text-xs"
              @change="applyFilters"
            >
            <span class="text-xs text-gray-500">-</span>
            <input
              v-model.number="filters.yearTo"
              type="number"
              min="2000"
              :max="new Date().getFullYear()"
              placeholder="2025"
              class="ui-public-input w-20 text-xs"
              @change="applyFilters"
            >
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">时长:</span>
            <div class="flex rounded-md shadow-sm" role="group">
              <button
                v-for="opt in durationOptions"
                :key="opt.value"
                type="button"
                class="min-h-8 border border-border px-3 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                :class="[
                  filters.duration === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground',
                  opt.value === '' ? 'rounded-l-md font-normal' : opt.value === 'long' ? 'rounded-r-md font-normal' : 'font-normal',
                ]"
                @click="filters.duration = (filters.duration === opt.value && opt.value !== '') ? '' : opt.value; applyFilters()"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>

    <div v-if="loading" class="ui-public-grid">
      <SkeletonCard v-for="i in 10" :key="i" variant="poster" />
    </div>

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
        暂无影片
      </p>
    </div>

    <div v-else>
      <div class="movie-results" :class="{ 'is-list': viewMode === 'list' }">
        <MovieCard
          v-for="movie in movies"
          :key="movie.id"
          :title="movie.title"
          :href="`/movie/${movie.code}`"
          :code="movie.code"
          :cover="movie.coverImage"
          :release-date="movie.releaseDate ? new Date(movie.releaseDate) : null"
          :is-r18="movie.isR18"
          :actors="movie.actors?.map(actor => actor.name)"
          :layout="viewMode"
          label-missing-cover="暂无封面"
        />
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
/* ── 继续观看 ─────────────────────────────────────────────── */
.continue-watching {
  margin-bottom: 2rem;
}

.continue-list {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0.25rem;
}

.continue-list::-webkit-scrollbar {
  display: none;
}

.continue-card {
  flex: 0 0 140px;
  text-decoration: none;
  transition: transform 0.2s;
}

.continue-card:hover {
  transform: translateY(-2px);
}

.continue-cover {
  width: 140px;
  height: 100px;
  border-radius: 0.5rem;
  overflow: hidden;
  background: hsl(var(--card));
  position: relative;
}

.continue-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
}

.continue-info {
  padding: 0.375rem 0 0;
}

.continue-title {
  font-size: 0.75rem;
  color: hsl(var(--foreground));
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 0.375rem;
}

.progress-track {
  height: 3px;
  background: hsl(var(--border));
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.progress-fill {
  height: 100%;
  background: hsl(var(--primary));
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-label {
  font-size: 0.625rem;
  color: hsl(var(--muted-foreground));
}

/* ── Genre 标签栏 ─────────────────────────────────────────── */
.genre-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.genre-bar::-webkit-scrollbar {
  display: none;
}

.genre-tag {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid hsl(var(--border));
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.genre-tag:hover {
  border-color: hsl(var(--primary));
  color: hsl(var(--foreground));
}

.genre-tag.active {
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.genre-count {
  font-size: 0.6875rem;
  opacity: 0.65;
}

.movie-library-hero {
  margin: -0.5rem 0 2rem;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.25rem 0 1.5rem;
}

.movie-library-kicker {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 750;
  letter-spacing: 0.13em;
  line-height: 1rem;
  text-transform: uppercase;
}

.movie-library-brand {
  color: hsl(var(--primary));
}

.movie-library-count {
  border-left: 1px solid hsl(var(--border));
  padding-left: 0.625rem;
  letter-spacing: 0;
  text-transform: none;
}

.movie-library-hero-main {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-top: 0.75rem;
}

.movie-library-title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 800;
  line-height: 1.08;
}

.movie-library-description {
  margin: 0.5rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.movie-library-shortcuts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.movie-library-shortcut {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md);
  background: hsl(var(--card) / 0.52);
  padding: 0 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 650;
  transition: border-color var(--ui-motion-fast) ease, background-color var(--ui-motion-fast) ease, color var(--ui-motion-fast) ease, transform var(--ui-motion-fast) ease;
}

.movie-library-shortcut:hover {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
  transform: translateY(-1px);
}

.movie-library-shortcut-label {
  color: hsl(var(--foreground));
}

.movie-catalog-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.movie-catalog-heading .movie-library-kicker {
  margin-bottom: 0.25rem;
}

.movie-catalog-title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: clamp(1.25rem, 2vw, 1.625rem);
  font-weight: 750;
  line-height: 1.2;
}

.movie-catalog-meta {
  margin: 0.35rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.movie-view-switcher {
  display: inline-flex;
  gap: 0.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md);
  background: hsl(var(--card) / 0.55);
  padding: 0.25rem;
}

.movie-view-button {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-sm);
  color: hsl(var(--muted-foreground));
  font-size: 1.15rem;
  line-height: 1;
  transition: background-color var(--ui-motion-fast) ease, color var(--ui-motion-fast) ease;
}

.movie-view-button:hover,
.movie-view-button.is-active {
  background: hsl(var(--primary) / 0.14);
  color: hsl(var(--primary));
}

.movie-catalog-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 1rem;
}

.movie-search-field {
  position: relative;
  min-width: min(100%, 18rem);
  flex: 1 1 20rem;
}

.movie-search-field .ui-public-input {
  width: 100%;
  padding-left: 2.25rem;
}

.movie-search-icon {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  z-index: 1;
  width: 1rem;
  height: 1rem;
  transform: translateY(-50%);
  color: hsl(var(--muted-foreground));
  pointer-events: none;
}

.movie-sort-select {
  flex: 0 1 11rem;
}

.movie-sort-order {
  display: inline-flex;
  min-height: var(--ui-control-height-md);
  align-items: center;
  gap: 0.375rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md);
  background: hsl(var(--card) / 0.55);
  padding: 0 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 650;
  transition: border-color var(--ui-motion-fast) ease, color var(--ui-motion-fast) ease, background-color var(--ui-motion-fast) ease;
}

.movie-sort-order:hover {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
}

.movie-clear-button {
  margin-left: auto;
}

.movie-genre-panel {
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.75rem 0;
}

.movie-genre-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.movie-genre-more {
  color: hsl(var(--primary));
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.movie-genre-more:hover {
  text-decoration: underline;
}

.movie-results {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-5) var(--ui-space-4);
}

.movie-results.is-list {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .movie-results:not(.is-list) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .movie-results:not(.is-list) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .movie-results:not(.is-list) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .movie-library-hero-main {
    align-items: flex-start;
    flex-direction: column;
  }

  .movie-library-shortcuts {
    justify-content: flex-start;
  }

  .movie-clear-button {
    margin-left: 0;
  }
}
</style>
