<script setup lang="ts">
import type { WatchingHistoryItem } from '../types'
import { Pagination, SkeletonCard } from '@starye/ui'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { progressApi } from '../lib/api-client'

const loading = ref(true)
const historyItems = ref<WatchingHistoryItem[]>([])
const currentPage = ref(1)
const PAGE_SIZE = 10
const pageSize = ref(PAGE_SIZE)

/** 观看状态 tab：all / watching / watched */
type StatusFilter = 'all' | 'watching' | 'watched'
const statusFilter = ref<StatusFilter>('all')

function isWatched(item: WatchingHistoryItem): boolean {
  return item.completed
}

const filteredItems = computed(() => {
  if (statusFilter.value === 'watched')
    return historyItems.value.filter(item => isWatched(item))
  if (statusFilter.value === 'watching')
    return historyItems.value.filter(item => !isWatched(item))
  return historyItems.value
})

const totalPages = computed(() => Math.ceil(filteredItems.value.length / pageSize.value))

const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredItems.value.slice(start, start + pageSize.value)
})

function setStatusFilter(val: StatusFilter) {
  statusFilter.value = val
  currentPage.value = 1
}

function changePage(page: number) {
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function changePageSize(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

function progressPercent(item: WatchingHistoryItem): number {
  if (!item.duration || item.duration === 0) {
    return 0
  }
  return Math.min(Math.round((item.progress / item.duration) * 100), 100)
}

/** 格式化已看时长 / 总时长 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 格式化相对时间 */
function formatRelativeTime(updatedAt: string): string {
  const diff = Date.now() - new Date(updatedAt).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) {
    return '刚刚'
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} 小时前`
  }
  const days = Math.floor(hours / 24)
  if (days < 30) {
    return `${days} 天前`
  }
  return new Date(updatedAt).toLocaleDateString('zh-CN')
}

async function loadHistory() {
  loading.value = true
  try {
    const response = await progressApi.getWatchingHistory(50)
    if (response.success && response.data) {
      historyItems.value = response.data
    }
  }
  catch (error) {
    console.error('Failed to load watching history:', error)
  }
  finally {
    loading.value = false
  }
}

onMounted(loadHistory)
</script>

<template>
  <div class="ui-public-page history-page">
    <div class="ui-public-page-header">
      <div>
        <h1 class="ui-public-page-title">
          观看历史
        </h1>
        <p class="ui-public-page-description">
          按观看状态筛选最近记录
        </p>
      </div>
      <RouterLink to="/" class="ui-public-button ui-public-button-ghost">
        ← 返回首页
      </RouterLink>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="skeleton-list">
      <SkeletonCard v-for="i in 5" :key="i" variant="row" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="historyItems.length === 0" class="empty-state">
      <p class="empty-icon">
        📺
      </p>
      <p class="empty-text">
        暂无观看历史
      </p>
      <RouterLink to="/" class="empty-cta">
        去发现影片
      </RouterLink>
    </div>

    <!-- 历史列表 -->
    <div v-else>
      <!-- 状态筛选 tab -->
      <div class="status-tabs">
        <button
          class="tab-btn" :class="[statusFilter === 'all' && 'tab-active']"
          @click="setStatusFilter('all')"
        >
          全部 <span class="tab-count">{{ historyItems.length }}</span>
        </button>
        <button
          class="tab-btn" :class="[statusFilter === 'watching' && 'tab-active']"
          @click="setStatusFilter('watching')"
        >
          在看 <span class="tab-count">{{ historyItems.filter(i => !isWatched(i)).length }}</span>
        </button>
        <button
          class="tab-btn" :class="[statusFilter === 'watched' && 'tab-active']"
          @click="setStatusFilter('watched')"
        >
          已看完 <span class="tab-count">{{ historyItems.filter(i => isWatched(i)).length }}</span>
        </button>
      </div>

      <!-- 筛选后空状态 -->
      <div v-if="filteredItems.length === 0" class="ui-public-empty">
        <p class="empty-icon">
          📺
        </p>
        <p class="empty-text">
          {{ statusFilter === 'watched' ? '还没有看完的影片' : '没有进行中的影片' }}
        </p>
      </div>

      <div v-else class="history-list">
        <div
          v-for="item in pagedItems"
          :key="item.id"
          class="history-item"
        >
          <!-- 封面 -->
          <RouterLink :to="`/movie/${item.movieCode}/play`" class="item-cover-link">
            <div class="item-cover">
              <img
                v-if="item.coverImage && !item.isR18"
                :src="item.coverImage"
                :alt="item.title"
                loading="lazy"
              >
              <div v-else class="cover-placeholder">
                <span>{{ item.isR18 ? 'R18' : '?' }}</span>
              </div>
              <!-- 播放图标 overlay -->
              <div class="play-overlay">
                ▶
              </div>
            </div>
          </RouterLink>

          <!-- 信息 -->
          <div class="item-info">
            <RouterLink :to="`/movie/${item.movieCode}`" class="item-title">
              {{ item.title }}
            </RouterLink>
            <p class="item-code">
              {{ item.movieCode }}
            </p>

            <!-- 进度 / 已看完徽标 -->
            <div class="progress-section">
              <template v-if="isWatched(item)">
                <span class="watched-badge">✓ 已看完</span>
              </template>
              <template v-else>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    :style="{ width: `${progressPercent(item)}%` }"
                  />
                </div>
                <span class="progress-text">
                  {{ formatTime(item.progress) }}
                  <span v-if="item.duration"> / {{ formatTime(item.duration) }}</span>
                  <span class="progress-pct">{{ progressPercent(item) }}%</span>
                </span>
              </template>
            </div>

            <p class="item-meta">
              {{ formatRelativeTime(item.updatedAt) }}
            </p>
          </div>

          <!-- 操作 -->
          <RouterLink
            :to="`/movie/${item.movieCode}/play`"
            class="continue-btn"
          >
            继续观看
          </RouterLink>
        </div>
      </div>

      <!-- 分页 -->
      <Pagination
        v-if="totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total="filteredItems.length"
        :page-size="pageSize"
        layout="total, prev, pager, next, jumper"
        @page-change="changePage"
        @size-change="changePageSize"
      />
    </div>
  </div>
</template>

<style scoped>
.history-page {
  max-width: 800px;
  margin: 0 auto;
}

/* ── Skeleton ─────────────────────────────────────────────── */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── 空状态 ───────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 4rem 0;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.empty-text {
  color: hsl(var(--muted-foreground));
  margin-bottom: 1.5rem;
}

.empty-cta {
  display: inline-block;
  padding: 0.5rem 1.25rem;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: var(--ui-radius-md);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.empty-cta:hover {
  background: hsl(var(--primary) / 0.88);
}

/* ── 历史列表 ─────────────────────────────────────────────── */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md);
  transition: border-color 0.15s;
}

.history-item:hover {
  border-color: hsl(var(--primary) / 0.45);
}

.item-cover-link {
  flex-shrink: 0;
}

.item-cover {
  width: 80px;
  height: 56px;
  border-radius: 0.375rem;
  overflow: hidden;
  background: hsl(var(--muted));
  position: relative;
}

.item-cover img {
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
  font-size: 0.6875rem;
  font-weight: 600;
}

.play-overlay {
  position: absolute;
  inset: 0;
  background: hsl(var(--background) / 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--foreground));
  font-size: 1rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.item-cover-link:hover .play-overlay {
  opacity: 1;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  display: block;
  font-size: 0.9375rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.125rem;
  transition: color 0.15s;
}

.item-title:hover {
  color: hsl(var(--primary));
}

.item-code {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.375rem;
}

.progress-section {
  margin-bottom: 0.25rem;
}

.progress-track {
  height: 3px;
  background: hsl(var(--muted-foreground) / 0.35);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.progress-fill {
  height: 100%;
  background: hsl(var(--primary));
  border-radius: 2px;
}

.progress-text {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.progress-pct {
  margin-left: 0.25rem;
  color: hsl(var(--primary));
}

.item-meta {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.continue-btn {
  flex-shrink: 0;
  padding: 0.375rem 0.875rem;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: var(--ui-radius-sm);
  text-decoration: none;
  font-size: 0.8125rem;
  white-space: nowrap;
  transition: background 0.15s;
}

.continue-btn:hover {
  background: hsl(var(--primary) / 0.88);
}

/* ── 状态筛选 tab ─────────────────────────────────────────── */
.status-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.75rem;
}

.tab-btn {
  padding: 0.375rem 0.875rem;
  border: 1px solid hsl(var(--border));
  background: transparent;
  color: hsl(var(--muted-foreground));
  border-radius: var(--ui-radius-sm);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  border-color: hsl(var(--primary));
  color: hsl(var(--foreground));
}

.tab-active {
  border-color: hsl(var(--primary)) !important;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground)) !important;
}

.tab-count {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-left: 0.25rem;
}

/* ── 已看完徽标 ───────────────────────────────────────────── */
.watched-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
  border: 1px solid hsl(var(--status-success) / 0.3);
  border-radius: var(--ui-radius-sm);
  font-size: 0.6875rem;
  font-weight: 600;
}
</style>
