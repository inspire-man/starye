<script setup lang="ts">
import type { MovieAnalytics } from '@/lib/api'
import { ErrorDisplay, SkeletonCard } from '@starye/ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { api } from '@/lib/api'

const { t } = useI18n()
const router = useRouter()
const { handleError, parseError } = useErrorHandler()

interface Stats {
  comics: number
  movies: number
  actors: number
  publishers: number
  users: number
  crawling: {
    movies: number
    comics: number
  }
  pending: {
    actors: number
    publishers: number
  }
}

const stats = ref<Stats>({
  comics: 0,
  movies: 0,
  actors: 0,
  publishers: 0,
  users: 0,
  crawling: { movies: 0, comics: 0 },
  pending: { actors: 0, publishers: 0 },
})

const loading = ref(true)
const error = ref<Error | null>(null)

const analytics = ref<MovieAnalytics | null>(null)
const analyticsLoading = ref(true)
const analyticsError = ref<Error | null>(null)

// 前 20 个 genre（API 已按 count DESC 排序）
const topGenres = computed(() => analytics.value?.genreDistribution.slice(0, 20) ?? [])

// 以总影片数为分母计算 genre 占比
const totalMovies = computed(() => stats.value.movies || 1)

async function loadStats() {
  loading.value = true
  error.value = null

  try {
    const res = await api.admin.getStats()
    stats.value = res
  }
  catch (e) {
    error.value = e as Error
    handleError(e, '加载统计数据失败')
  }
  finally {
    loading.value = false
  }
}

async function loadAnalytics() {
  analyticsLoading.value = true
  analyticsError.value = null

  try {
    analytics.value = await api.admin.getMovieAnalytics()
  }
  catch (e) {
    analyticsError.value = e as Error
  }
  finally {
    analyticsLoading.value = false
  }
}

onMounted(() => {
  loadStats()
  loadAnalytics()
})

function navigateTo(path: string) {
  router.push(path)
}

function handleRetry() {
  loadStats()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t('dashboard.overview') }}
      </h1>
      <p class="text-muted-foreground mt-1">
        {{ t('dashboard.welcome_back') }}. {{ t('dashboard.system_operational') }}
      </p>
    </div>

    <!-- 错误提示 -->
    <ErrorDisplay
      v-if="error && !loading"
      :error="parseError(error)"
      mode="banner"
      :actions="[{ label: '重试', variant: 'primary', onClick: handleRetry }]"
    />

    <!-- 内容统计 -->
    <div>
      <h2 class="text-lg font-semibold mb-3">
        内容统计
      </h2>
      <div v-if="loading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard v-for="i in 4" :key="i" variant="stat" />
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <!-- 漫画 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/comics')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              总漫画数
            </div>
            <span class="text-2xl">📚</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.comics.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看漫画列表
          </p>
        </div>

        <!-- 电影 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/movies')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              总电影数
            </div>
            <span class="text-2xl">🎬</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.movies.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看电影列表
          </p>
        </div>

        <!-- 女优 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/actors')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              女优数量
            </div>
            <span class="text-2xl">⭐</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.actors.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看女优列表
          </p>
        </div>

        <!-- 厂商 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/publishers')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              厂商数量
            </div>
            <span class="text-2xl">🏢</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.publishers.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看厂商列表
          </p>
        </div>
      </div>
    </div>

    <!-- 爬取状态 -->
    <div>
      <h2 class="text-lg font-semibold mb-3">
        爬取状态
      </h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <!-- 爬取中的电影 -->
        <div class="p-6 border rounded-xl bg-card shadow-sm">
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              爬取中的电影
            </div>
            <span class="text-2xl">⏳</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-orange-600">
            {{ loading ? '...' : stats.crawling.movies.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            部分播放源未完成
          </p>
        </div>

        <!-- 爬取中的漫画 -->
        <div class="p-6 border rounded-xl bg-card shadow-sm">
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              爬取中的漫画
            </div>
            <span class="text-2xl">⏳</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-orange-600">
            {{ loading ? '...' : stats.crawling.comics.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            部分章节未完成
          </p>
        </div>

        <!-- 待爬取的女优 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-yellow-500"
          @click="navigateTo('/actors')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              待爬取女优详情
            </div>
            <span class="text-2xl">📝</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-yellow-600">
            {{ loading ? '...' : stats.pending.actors.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看待爬取列表
          </p>
        </div>

        <!-- 待爬取的厂商 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-yellow-500"
          @click="navigateTo('/publishers')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              待爬取厂商详情
            </div>
            <span class="text-2xl">📝</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-yellow-600">
            {{ loading ? '...' : stats.pending.publishers.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看待爬取列表
          </p>
        </div>
      </div>
    </div>

    <!-- 内容洞察 -->
    <div>
      <h2 class="text-lg font-semibold mb-3">
        内容洞察
      </h2>

      <!-- 加载骨架屏 -->
      <div v-if="analyticsLoading" class="grid gap-4 md:grid-cols-2">
        <SkeletonCard v-for="i in 2" :key="i" variant="stat" />
      </div>

      <!-- 加载失败提示 -->
      <div
        v-else-if="analyticsError"
        class="p-4 border rounded-xl bg-card text-sm text-muted-foreground"
      >
        内容洞察数据加载失败，请刷新重试
      </div>

      <!-- 无观看数据空状态 -->
      <div
        v-else-if="!analytics || analytics.hotMovies.length === 0"
        class="p-8 border rounded-xl bg-card text-center text-muted-foreground"
      >
        暂无观看数据
      </div>

      <!-- 洞察列表 -->
      <div v-else class="grid gap-4 md:grid-cols-2">
        <!-- 热门影片 Top 10 -->
        <div class="border rounded-xl bg-card shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-lg">🔥</span>
            <h3 class="font-semibold text-sm">
              热门影片 Top 10
            </h3>
          </div>
          <ol class="space-y-2">
            <li
              v-for="(movie, index) in analytics.hotMovies"
              :key="movie.id"
              class="flex items-center gap-3 group cursor-pointer"
              @click="navigateTo('/movies')"
            >
              <!-- 序号 -->
              <span
                class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                :class="index < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
              >
                {{ index + 1 }}
              </span>
              <!-- 标题 -->
              <span class="flex-1 text-sm truncate group-hover:text-primary transition-colors">
                {{ movie.title }}
              </span>
              <!-- 播放量 -->
              <span class="text-xs text-muted-foreground flex-shrink-0">
                {{ movie.viewCount.toLocaleString() }} 次
              </span>
            </li>
          </ol>
        </div>

        <!-- Genre 分布 -->
        <div class="border rounded-xl bg-card shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-lg">📊</span>
            <h3 class="font-semibold text-sm">
              Genre 分布（前 20）
            </h3>
          </div>
          <ul class="space-y-2">
            <li
              v-for="item in topGenres"
              :key="item.genre"
              class="flex items-center gap-2"
            >
              <!-- Genre 名 -->
              <span class="w-20 text-xs text-right flex-shrink-0 truncate">
                {{ item.genre }}
              </span>
              <!-- 进度条 -->
              <div class="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full transition-all"
                  :style="{ width: `${Math.min((item.count / totalMovies) * 100, 100).toFixed(1)}%` }"
                />
              </div>
              <!-- 数量 -->
              <span class="w-10 text-xs text-muted-foreground text-right flex-shrink-0">
                {{ item.count }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 系统信息 -->
    <div>
      <h2 class="text-lg font-semibold mb-3">
        系统信息
      </h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <!-- 用户数 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/users')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              注册用户
            </div>
            <span class="text-2xl">👥</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            {{ loading ? '...' : stats.users.toLocaleString() }}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看用户列表
          </p>
        </div>

        <!-- 爬虫监控 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/crawlers')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              爬虫监控
            </div>
            <span class="text-2xl">🤖</span>
          </div>
          <div class="text-3xl font-bold mt-2 text-green-600">
            运行中
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看爬虫状态
          </p>
        </div>

        <!-- 审计日志 -->
        <div
          class="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary"
          @click="navigateTo('/audit-logs')"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium text-muted-foreground">
              审计日志
            </div>
            <span class="text-2xl">📋</span>
          </div>
          <div class="text-3xl font-bold mt-2">
            查看
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            点击查看操作日志
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
