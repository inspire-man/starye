<script setup lang="ts">
import type { WatchingHistoryItem } from '../types'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { progressApi } from '../lib/api-client'

const loading = ref(true)
const historyItems = ref<WatchingHistoryItem[]>([])
const currentPage = ref(1)
const PAGE_SIZE = 10

/** 观看状态 tab：all / watching / watched */
type StatusFilter = 'all' | 'watching' | 'watched'
const statusFilter = ref<StatusFilter>('all')

/** 判断是否已看完：progress/duration ≥ 0.9，duration 为 null 时 progress ≥ 3600 秒 */
function isWatched(item: WatchingHistoryItem): boolean {
  if (item.duration && item.duration > 0) {
    return item.progress / item.duration >= 0.9
  }
  return item.progress >= 3600
}

const filteredItems = computed(() => {
  if (statusFilter.value === 'watched')
    return historyItems.value.filter(item => isWatched(item))
  if (statusFilter.value === 'watching')
    return historyItems.value.filter(item => !isWatched(item))
  return historyItems.value
})

const totalPages = computed(() => Math.ceil(filteredItems.value.length / PAGE_SIZE))

const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredItems.value.slice(start, start + PAGE_SIZE)
})

function setStatusFilter(val: StatusFilter) {
  statusFilter.value = val
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
  <div class="history-page">
    <div class="page-header">
      <h1 class="page-title">
        观看历史
      </h1>
      <RouterLink to="/" class="back-link">
        ← 返回首页
      </RouterLink>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="skeleton-list">
      <div v-for="i in 5" :key="i" class="skeleton-item animate-pulse">
        <div class="skeleton-cover" />
        <div class="skeleton-info">
          <div class="skeleton-title" />
          <div class="skeleton-bar" />
          <div class="skeleton-meta" />
        </div>
      </div>
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
      <div v-if="filteredItems.length === 0" class="empty-state">
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
      <div v-if="totalPages > 1" class="pagination">
        <button
          :disabled="currentPage === 1"
          class="page-btn"
          @click="currentPage--"
        >
          上一页
        </button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button
          :disabled="currentPage === totalPages"
          class="page-btn"
          @click="currentPage++"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
}

.back-link {
  font-size: 0.875rem;
  color: #9ca3af;
  text-decoration: none;
  transition: color 0.15s;
}

.back-link:hover {
  color: #e5e7eb;
}

/* ── Skeleton ─────────────────────────────────────────────── */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.skeleton-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.skeleton-cover {
  width: 80px;
  height: 56px;
  background: #1f2937;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.25rem;
}

.skeleton-title {
  height: 1rem;
  background: #1f2937;
  border-radius: 4px;
  width: 70%;
}

.skeleton-bar {
  height: 4px;
  background: #1f2937;
  border-radius: 4px;
}

.skeleton-meta {
  height: 0.75rem;
  background: #1f2937;
  border-radius: 4px;
  width: 30%;
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
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.empty-cta {
  display: inline-block;
  padding: 0.5rem 1.25rem;
  background: #7c3aed;
  color: #fff;
  border-radius: 0.375rem;
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.empty-cta:hover {
  background: #6d28d9;
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
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 0.5rem;
  transition: border-color 0.15s;
}

.history-item:hover {
  border-color: #374151;
}

.item-cover-link {
  flex-shrink: 0;
}

.item-cover {
  width: 80px;
  height: 56px;
  border-radius: 0.375rem;
  overflow: hidden;
  background: #1f2937;
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
  color: #6b7280;
  font-size: 0.6875rem;
  font-weight: 600;
}

.play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
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
  color: #e5e7eb;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.125rem;
  transition: color 0.15s;
}

.item-title:hover {
  color: #a78bfa;
}

.item-code {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.375rem;
}

.progress-section {
  margin-bottom: 0.25rem;
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
}

.progress-text {
  font-size: 0.6875rem;
  color: #9ca3af;
}

.progress-pct {
  margin-left: 0.25rem;
  color: #a78bfa;
}

.item-meta {
  font-size: 0.75rem;
  color: #6b7280;
}

.continue-btn {
  flex-shrink: 0;
  padding: 0.375rem 0.875rem;
  background: #7c3aed;
  color: #fff;
  border-radius: 0.375rem;
  text-decoration: none;
  font-size: 0.8125rem;
  white-space: nowrap;
  transition: background 0.15s;
}

.continue-btn:hover {
  background: #6d28d9;
}

/* ── 分页 ─────────────────────────────────────────────────── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-bottom: 2rem;
}

.page-btn {
  padding: 0.375rem 0.875rem;
  border: 1px solid #374151;
  background: transparent;
  color: #9ca3af;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  border-color: #7c3aed;
  color: #e5e7eb;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: #9ca3af;
}

/* ── 状态筛选 tab ─────────────────────────────────────────── */
.status-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid #1f2937;
  padding-bottom: 0.75rem;
}

.tab-btn {
  padding: 0.375rem 0.875rem;
  border: 1px solid #374151;
  background: transparent;
  color: #9ca3af;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-btn:hover {
  border-color: #7c3aed;
  color: #e5e7eb;
}

.tab-active {
  border-color: #7c3aed !important;
  background: #7c3aed;
  color: #fff !important;
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
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
}
</style>
