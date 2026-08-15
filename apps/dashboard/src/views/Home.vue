<script setup lang="ts">
import type { MovieAnalytics } from '@/lib/api'
import { ErrorDisplay, SkeletonCard, StatisticCard } from '@starye/ui'
import {
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  Clock3,
  FilePenLine,
  Film,
  Flame,
  Users,
} from 'lucide-vue-next'
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

function normalizeGenre(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw)
    return '未分类'

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed))
        return parsed.filter(Boolean).join(' / ') || '未分类'
    }
    catch {
      // Keep the source value when older records contain a non-JSON label.
    }
  }

  return raw.replace(/^['"]|['"]$/g, '').trim() || '未分类'
}

const totalGenreAssignments = computed(() => (analytics.value?.genreDistribution ?? []).reduce((sum, item) => sum + Math.max(Number(item.count) || 0, 0), 0))

const topGenres = computed(() => {
  const total = totalGenreAssignments.value || 1
  return (analytics.value?.genreDistribution ?? []).slice(0, 20).map((item, index) => ({
    genre: normalizeGenre(item.genre),
    count: Math.max(Number(item.count) || 0, 0),
    percentage: ((Math.max(Number(item.count) || 0, 0) / total) * 100),
    tone: `genre-tone-${index % 5}`,
  }))
})

const maxGenreCount = computed(() => Math.max(...topGenres.value.map(item => item.count), 1))
const activeCrawlerCount = computed(() => stats.value.crawling.movies + stats.value.crawling.comics)

async function loadStats() {
  loading.value = true
  error.value = null

  try {
    stats.value = await api.admin.getStats()
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

function navigateTo(path: string): void {
  router.push(path)
}

function handleRetry(): void {
  loadStats()
  loadAnalytics()
}
</script>

<template>
  <div class="overview-page">
    <section class="overview-hero" aria-labelledby="overview-title">
      <div>
        <p class="overview-kicker">
          STARYE / CONTENT OPERATIONS
        </p>
        <h1 id="overview-title" class="overview-title">
          {{ t('dashboard.overview') }}
        </h1>
        <p class="overview-subtitle">
          {{ t('dashboard.welcome_back') }}. {{ t('dashboard.system_operational') }}
        </p>
      </div>
      <div class="overview-health" role="status">
        <span class="overview-health-dot" aria-hidden="true" />
        <span>系统运行正常</span>
      </div>
    </section>

    <ErrorDisplay
      v-if="error && !loading"
      :error="parseError(error)"
      mode="banner"
      :actions="[{ label: '重试', variant: 'primary', onClick: handleRetry }]"
    />

    <section class="overview-section" aria-labelledby="content-stats-title">
      <div class="overview-section-heading">
        <div>
          <p class="overview-section-kicker">
            CONTENT INVENTORY
          </p>
          <h2 id="content-stats-title">
            内容统计
          </h2>
        </div>
        <span class="overview-section-note">实时数据</span>
      </div>

      <div v-if="loading" class="overview-stat-grid">
        <SkeletonCard v-for="i in 4" :key="i" variant="stat" />
      </div>
      <div v-else class="overview-stat-grid">
        <StatisticCard label="总漫画数" :value="stats.comics" description="进入漫画列表管理内容" tone="primary" clickable @click="navigateTo('/comics')">
          <template #icon>
            <BookOpen :size="17" />
          </template>
        </StatisticCard>
        <StatisticCard label="总电影数" :value="stats.movies" description="进入电影列表管理内容" tone="info" clickable @click="navigateTo('/movies')">
          <template #icon>
            <Film :size="17" />
          </template>
        </StatisticCard>
        <StatisticCard label="女优数量" :value="stats.actors" description="查看女优关联与资料" tone="success" clickable @click="navigateTo('/actors')">
          <template #icon>
            <Users :size="17" />
          </template>
        </StatisticCard>
        <StatisticCard label="厂商数量" :value="stats.publishers" description="查看厂商关联与资料" tone="warning" clickable @click="navigateTo('/publishers')">
          <template #icon>
            <Building2 :size="17" />
          </template>
        </StatisticCard>
      </div>
    </section>

    <section class="overview-section" aria-labelledby="crawl-stats-title">
      <div class="overview-section-heading">
        <div>
          <p class="overview-section-kicker">
            CRAWL HEALTH
          </p>
          <h2 id="crawl-stats-title">
            爬取状态
          </h2>
        </div>
        <span class="overview-section-note">需要关注的任务</span>
      </div>

      <div v-if="loading" class="overview-stat-grid">
        <SkeletonCard v-for="i in 4" :key="i" variant="stat" />
      </div>
      <div v-else class="overview-stat-grid">
        <StatisticCard label="爬取中的电影" :value="stats.crawling.movies" description="部分播放源尚未完成" tone="info" clickable @click="navigateTo('/crawlers')">
          <template #icon>
            <Clock3 :size="17" />
          </template>
        </StatisticCard>
        <StatisticCard label="爬取中的漫画" :value="stats.crawling.comics" description="部分章节尚未完成" tone="info" clickable @click="navigateTo('/crawlers')">
          <template #icon>
            <Clock3 :size="17" />
          </template>
        </StatisticCard>
        <StatisticCard label="待爬取女优详情" :value="stats.pending.actors" description="进入女优列表查看待处理项" tone="warning" clickable @click="navigateTo('/actors')">
          <template #icon>
            <FilePenLine :size="17" />
          </template>
        </StatisticCard>
        <StatisticCard label="待爬取厂商详情" :value="stats.pending.publishers" description="进入厂商列表查看待处理项" tone="warning" clickable @click="navigateTo('/publishers')">
          <template #icon>
            <FilePenLine :size="17" />
          </template>
        </StatisticCard>
      </div>
    </section>

    <section class="overview-section" aria-labelledby="insight-title">
      <div class="overview-section-heading">
        <div>
          <p class="overview-section-kicker">
            CONTENT INSIGHTS
          </p>
          <h2 id="insight-title">
            内容洞察
          </h2>
        </div>
        <span class="overview-section-note">影片数据分析</span>
      </div>

      <div v-if="analyticsLoading" class="overview-insight-grid">
        <SkeletonCard v-for="i in 2" :key="i" variant="stat" />
      </div>
      <div v-else-if="analyticsError" class="overview-empty-panel" role="alert">
        内容洞察数据加载失败，请刷新重试
      </div>
      <div v-else-if="!analytics || analytics.hotMovies.length === 0" class="overview-empty-panel">
        暂无观看数据
      </div>
      <div v-else class="overview-insight-grid">
        <article class="overview-panel">
          <header class="overview-panel-heading">
            <div class="overview-panel-title">
              <span class="overview-panel-icon overview-panel-icon-danger"><Flame :size="16" /></span>
              <h3>热门影片 Top 10</h3>
            </div>
            <span class="overview-panel-meta">按播放量</span>
          </header>
          <ol class="hot-movie-list">
            <li
              v-for="(movie, index) in analytics.hotMovies"
              :key="movie.id"
              class="hot-movie-item"
              @click="navigateTo('/movies')"
            >
              <span class="hot-movie-rank" :class="{ 'hot-movie-rank-top': index < 3 }">{{ index + 1 }}</span>
              <span class="hot-movie-title">{{ movie.title }}</span>
              <span class="hot-movie-views">{{ movie.viewCount.toLocaleString() }} 次</span>
            </li>
          </ol>
        </article>

        <article class="overview-panel">
          <header class="overview-panel-heading">
            <div class="overview-panel-title">
              <span class="overview-panel-icon overview-panel-icon-primary"><BarChart3 :size="16" /></span>
              <h3>Genre 分布</h3>
            </div>
            <span class="overview-panel-meta">前 {{ topGenres.length }} 项</span>
          </header>
          <ul v-if="topGenres.length" class="genre-list">
            <li v-for="item in topGenres" :key="item.genre" class="genre-item">
              <div class="genre-item-heading">
                <span class="genre-tag" :class="item.tone">{{ item.genre }}</span>
                <span class="genre-count">{{ item.count.toLocaleString() }} 部</span>
                <span class="genre-percentage">{{ item.percentage.toFixed(1) }}%</span>
              </div>
              <div class="genre-track" aria-hidden="true">
                <span class="genre-track-value" :class="item.tone" :style="{ width: `${((item.count / maxGenreCount) * 100).toFixed(1)}%` }" />
              </div>
            </li>
          </ul>
          <div v-else class="overview-inline-empty">
            暂无 Genre 数据
          </div>
        </article>
      </div>
    </section>

    <section class="overview-section" aria-labelledby="system-info-title">
      <div class="overview-section-heading">
        <div>
          <p class="overview-section-kicker">
            SYSTEM ACCESS
          </p>
          <h2 id="system-info-title">
            系统信息
          </h2>
        </div>
        <span class="overview-section-note">快速入口</span>
      </div>

      <div class="overview-quick-grid">
        <StatisticCard label="注册用户" :value="stats.users" description="查看用户列表" tone="neutral" clickable @click="navigateTo('/users')">
          <template #icon>
            <Users :size="17" />
          </template>
        </StatisticCard>
        <StatisticCard label="运行中任务" :value="activeCrawlerCount" description="进入爬虫监控查看状态" tone="success" clickable @click="navigateTo('/crawlers')">
          <template #icon>
            <Bot :size="17" />
          </template>
        </StatisticCard>
        <article class="overview-quick-link" role="button" tabindex="0" @click="navigateTo('/audit-logs')" @keydown.enter="navigateTo('/audit-logs')">
          <span class="overview-quick-link-icon"><ClipboardList :size="17" /></span>
          <div>
            <span class="overview-quick-link-label">审计日志</span>
            <strong>查看记录</strong>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overview-page {
  display: grid;
  gap: 1.5rem;
  min-width: 0;
}

.overview-hero,
.overview-section-heading,
.overview-panel-heading,
.overview-quick-link,
.hot-movie-item,
.genre-item-heading {
  display: flex;
  align-items: center;
}

.overview-hero {
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.25rem 0 1.25rem;
}

.overview-kicker,
.overview-section-kicker {
  margin: 0;
  color: hsl(var(--primary));
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1rem;
}

.overview-title {
  margin: 0.3rem 0 0;
  color: hsl(var(--foreground));
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 2.25rem;
}

.overview-subtitle {
  margin: 0.35rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.overview-health {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid hsl(var(--status-success) / 0.22);
  border-radius: 9999px;
  background: hsl(var(--status-success-soft));
  padding: 0.4rem 0.7rem;
  color: hsl(var(--status-success));
  font-size: 0.75rem;
  font-weight: 600;
}

.overview-health-dot {
  height: 0.45rem;
  width: 0.45rem;
  border-radius: 9999px;
  background: currentColor;
  box-shadow: 0 0 0 0.2rem hsl(var(--status-success) / 0.14);
}

.overview-section {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.overview-section-heading {
  justify-content: space-between;
  gap: 1rem;
}

.overview-section-heading h2 {
  margin: 0.15rem 0 0;
  color: hsl(var(--foreground));
  font-size: 1rem;
  font-weight: 700;
}

.overview-section-note,
.overview-panel-meta {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.overview-stat-grid,
.overview-quick-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.overview-quick-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.overview-insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.overview-panel,
.overview-empty-panel,
.overview-quick-link {
  min-width: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-lg, 0.5rem);
  background: hsl(var(--card));
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
}

.overview-panel {
  padding: 1rem 1.125rem;
}

.overview-panel-heading {
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
}

.overview-panel-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.overview-panel-title h3 {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 700;
}

.overview-panel-icon,
.overview-quick-link-icon {
  display: inline-flex;
  height: 1.875rem;
  width: 1.875rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
}

.overview-panel-icon-danger {
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.overview-panel-icon-primary,
.overview-quick-link-icon {
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.hot-movie-list,
.genre-list {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0.625rem 0 0;
  list-style: none;
}

.hot-movie-item {
  min-width: 0;
  gap: 0.625rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
  padding: 0.375rem 0.25rem;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.hot-movie-item:hover {
  background: hsl(var(--accent));
}

.hot-movie-rank {
  display: inline-flex;
  height: 1.5rem;
  width: 1.5rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 700;
}

.hot-movie-rank-top {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.hot-movie-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-movie-views,
.genre-count,
.genre-percentage {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

.genre-item {
  display: grid;
  gap: 0.35rem;
  padding: 0.35rem 0;
}

.genre-item-heading {
  min-width: 0;
  gap: 0.5rem;
}

.genre-tag {
  max-width: 12rem;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 9999px;
  padding: 0.15rem 0.5rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  font-weight: 700;
}

.genre-count {
  margin-left: auto;
}

.genre-percentage {
  min-width: 2.75rem;
  text-align: right;
}

.genre-track {
  height: 0.3rem;
  overflow: hidden;
  border-radius: 9999px;
  background: hsl(var(--muted));
}

.genre-track-value {
  display: block;
  height: 100%;
  min-width: 0.3rem;
  border-radius: inherit;
  transition: width 520ms ease;
}

.genre-tone-0 { border-color: hsl(var(--status-info) / 0.2); background: hsl(var(--status-info-soft)); color: hsl(var(--status-info)); }
.genre-tone-1 { border-color: hsl(var(--status-success) / 0.2); background: hsl(var(--status-success-soft)); color: hsl(var(--status-success)); }
.genre-tone-2 { border-color: hsl(var(--status-warning) / 0.2); background: hsl(var(--status-warning-soft)); color: hsl(var(--status-warning)); }
.genre-tone-3 { border-color: hsl(var(--status-danger) / 0.2); background: hsl(var(--status-danger-soft)); color: hsl(var(--status-danger)); }
.genre-tone-4 { border-color: hsl(var(--status-neutral) / 0.2); background: hsl(var(--status-neutral-soft)); color: hsl(var(--status-neutral)); }
.genre-track-value.genre-tone-0 { background: hsl(var(--status-info)); }
.genre-track-value.genre-tone-1 { background: hsl(var(--status-success)); }
.genre-track-value.genre-tone-2 { background: hsl(var(--status-warning)); }
.genre-track-value.genre-tone-3 { background: hsl(var(--status-danger)); }
.genre-track-value.genre-tone-4 { background: hsl(var(--status-neutral)); }

.overview-empty-panel,
.overview-inline-empty {
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  text-align: center;
}

.overview-empty-panel {
  padding: 2rem 1rem;
}

.overview-inline-empty {
  padding: 1.75rem 0 0.75rem;
}

.overview-quick-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.125rem;
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.overview-quick-link:hover,
.overview-quick-link:focus-visible {
  border-color: hsl(var(--primary) / 0.45);
  box-shadow: 0 10px 24px hsl(var(--foreground) / 0.08);
  outline: none;
  transform: translateY(-1px);
}

.overview-quick-link > div {
  display: grid;
  gap: 0.2rem;
}

.overview-quick-link-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
}

.overview-quick-link strong {
  color: hsl(var(--foreground));
  font-size: 1.125rem;
}

@media (max-width: 1023px) {
  .overview-stat-grid,
  .overview-quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .overview-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .overview-insight-grid,
  .overview-stat-grid,
  .overview-quick-grid {
    grid-template-columns: 1fr;
  }
}
</style>
