<script setup lang="ts">
import type { SelectOption } from '../components/Select.vue'
import type { GenreItem, Movie, WatchingHistoryItem } from '../types'
import { Pagination } from '@starye/ui'
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Select from '../components/Select.vue'
import { genreApi, movieApi, progressApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()

const userStore = useUserStore()
const loading = ref(true)
const movies = ref<Movie[]>([])
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
})

const activeGenre = ref('')

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

// 继续观看列表（已登录用户，进度 < 90% 的最近 5 部）
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
function syncUrl() {
  router.replace({
    query: {
      ...(pagination.page > 1 && { page: String(pagination.page) }),
      ...(filters.sortBy !== 'releaseDate' && { sortBy: filters.sortBy }),
      ...(filters.search && { search: filters.search }),
      ...(activeGenre.value && { genre: activeGenre.value }),
      ...(filters.yearFrom && { yearFrom: String(filters.yearFrom) }),
      ...(filters.yearTo && { yearTo: String(filters.yearTo) }),
      ...(filters.duration && { duration: filters.duration }),
    },
  })
}

async function fetchMovies() {
  loading.value = true
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

  try {
    const response = await movieApi.getMovies({
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      genre: activeGenre.value || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      yearFrom: filters.yearFrom || undefined,
      yearTo: filters.yearTo || undefined,
      durationMin,
      durationMax,
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
      // 过滤已看完（≥90%）的影片，取前 5 条
      continueWatchingList.value = response.data
        .filter(item => item.progress > 0 && item.duration && item.progress / item.duration < 0.9)
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

function setGenre(genre: string) {
  if (activeGenre.value === genre) {
    return
  }
  activeGenre.value = genre
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

function searchMovies() {
  pagination.page = 1
  syncUrl()
  fetchMovies()
}

watch(() => filters.sortBy, () => {
  pagination.page = 1
  syncUrl()
  fetchMovies()
})

function clearGenreFilter() {
  activeGenre.value = ''
  pagination.page = 1
  syncUrl()
  fetchMovies()
}

// 监听外部（如标签页点击）触发的 genre query 变化
watch(() => route.query.genre, (val) => {
  const genre = typeof val === 'string' ? val : ''
  if (genre !== activeGenre.value) {
    activeGenre.value = genre
    pagination.page = 1
    fetchMovies()
  }
})

function progressPercent(item: WatchingHistoryItem): number {
  if (!item.duration || item.duration === 0) {
    return 0
  }
  return Math.min(Math.round((item.progress / item.duration) * 100), 95)
}

onMounted(() => {
  // 从 URL query 恢复状态
  pagination.page = Number(route.query.page) || 1
  filters.sortBy = (route.query.sortBy as typeof filters.sortBy) || 'releaseDate'
  filters.search = (typeof route.query.search === 'string' ? route.query.search : '')
  activeGenre.value = (typeof route.query.genre === 'string' ? route.query.genre : '')
  filters.yearFrom = route.query.yearFrom && !Array.isArray(route.query.yearFrom) ? Number(route.query.yearFrom) : ''
  filters.yearTo = route.query.yearTo && !Array.isArray(route.query.yearTo) ? Number(route.query.yearTo) : ''
  filters.duration = (typeof route.query.duration === 'string' ? route.query.duration : '') as typeof filters.duration

  // 并行加载：主列表 + genres + 继续观看（互不依赖）
  fetchMovies()
  fetchGenres()
  fetchContinueWatching()
  fetchRecommended()
})
</script>

<template>
  <div>
    <!-- R18 Status Banner (if logged in and not verified) -->
    <div v-if="userStore.user && !userStore.user.isR18Verified" class="bg-amber-900/20 border border-amber-700 rounded-lg px-4 py-3 mb-6">
      <div class="flex items-center gap-3">
        <span class="text-2xl shrink-0">🔒</span>
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

    <!-- 继续观看板块（仅登录用户，且有未完成记录时显示） -->
    <section v-if="continueWatchingList.length > 0" class="continue-watching">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-white">
          继续观看
        </h2>
        <RouterLink to="/history" class="text-xs text-gray-400 hover:text-primary-400 transition-colors">
          查看全部历史 →
        </RouterLink>
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
              v-if="item.coverImage && !item.isR18"
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
              v-if="movie.coverImage && !movie.isR18"
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
    <div v-if="activeGenre" class="flex items-center gap-2 mb-4 bg-purple-600/10 border border-purple-500/30 rounded-lg px-4 py-2">
      <span class="text-purple-300 text-sm">
        当前筛选标签：<strong>{{ activeGenre }}</strong>
      </span>
      <button
        class="ml-auto text-purple-400 hover:text-white text-sm transition-colors"
        @click="clearGenreFilter"
      >
        清除筛选
      </button>
    </div>

    <div class="mb-6">
      <h1 class="text-3xl font-bold text-white mb-4">
        {{ activeGenre ? `标签：${activeGenre}` : '热门影片' }}
      </h1>

      <div class="flex items-center gap-3 mb-4">
        <input
          v-model="filters.search"
          type="text"
          placeholder="搜索番号或标题..."
          class="flex-1 min-w-[180px] max-w-xs px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          @keyup.enter="searchMovies"
        >
        <Select
          v-model="filters.sortBy"
          class="flex-1 max-w-xs"
          :options="sortOptions"
          placeholder="排序"
          size="default"
        />
        <button
          v-if="filters.search"
          class="w-100px cursor-pointer px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          @click="filters.search = ''; searchMovies()"
        >
          清除
        </button>
      </div>

      <!-- Genre 标签栏 -->
      <div v-if="genres.length > 0" class="genre-bar">
        <button
          class="genre-tag"
          :class="{ active: activeGenre === '' }"
          @click="setGenre('')"
        >
          全部
        </button>
        <button
          v-for="item in genres"
          :key="item.genre"
          class="genre-tag"
          :class="{ active: activeGenre === item.genre }"
          @click="setGenre(item.genre)"
        >
          {{ item.genre }}
          <span class="genre-count">{{ item.count }}</span>
        </button>
      </div>

      <!-- 高级筛选 -->
      <div class="filter-panel mt-2 flex flex-wrap items-center gap-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">年份:</span>
          <input
            v-model.number="filters.yearFrom"
            type="number"
            min="2000"
            :max="new Date().getFullYear()"
            placeholder="2000"
            class="w-20 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:ring-1 focus:ring-primary-500"
            @change="pagination.page = 1; syncUrl(); fetchMovies()"
          >
          <span class="text-xs text-gray-500">-</span>
          <input
            v-model.number="filters.yearTo"
            type="number"
            min="2000"
            :max="new Date().getFullYear()"
            placeholder="2025"
            class="w-20 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:ring-1 focus:ring-primary-500"
            @change="pagination.page = 1; syncUrl(); fetchMovies()"
          >
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">时长:</span>
          <div class="flex rounded-md shadow-sm" role="group">
            <button
              v-for="opt in durationOptions"
              :key="opt.value"
              type="button"
              class="px-3 py-1 text-xs font-medium border border-gray-700 hover:bg-gray-700 hover:text-white transition-colors"
              :class="[
                filters.duration === opt.value ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-900 text-gray-300',
                opt.value === '' ? 'rounded-l-md font-normal' : opt.value === 'long' ? 'rounded-r-md font-normal' : 'font-normal',
              ]"
              @click="filters.duration = (filters.duration === opt.value && opt.value !== '') ? '' : opt.value; pagination.page = 1; syncUrl(); fetchMovies()"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div v-for="i in 10" :key="i" class="animate-pulse">
        <div class="bg-gray-800 aspect-3/4 rounded-lg mb-2" />
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
            <div class="aspect-3/4 bg-gray-800">
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
          <h3 class="mt-2 font-medium text-white line-clamp-2 group-hover:text-primary-400 transition">
            {{ movie.title }}
          </h3>
          <p class="text-sm text-gray-400 line-clamp-1">
            {{ movie.code }}
          </p>
        </RouterLink>
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
  background: #1f2937;
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
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 600;
}

.continue-info {
  padding: 0.375rem 0 0;
}

.continue-title {
  font-size: 0.75rem;
  color: #e5e7eb;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 0.375rem;
}

.progress-track {
  height: 3px;
  background: #374151;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.progress-fill {
  height: 100%;
  background: #7c3aed;
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-label {
  font-size: 0.625rem;
  color: #9ca3af;
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
  border: 1px solid #374151;
  background: transparent;
  color: #9ca3af;
  font-size: 0.8125rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.genre-tag:hover {
  border-color: #7c3aed;
  color: #e5e7eb;
}

.genre-tag.active {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #fff;
}

.genre-count {
  font-size: 0.6875rem;
  opacity: 0.65;
}
</style>
