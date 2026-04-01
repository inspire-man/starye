<script setup lang="ts">
/**
 * 爬虫监控页面
 */

import { onMounted, onUnmounted, ref } from 'vue'
import SkeletonCard from '@/components/SkeletonCard.vue'
import { handleError } from '@/composables/useErrorHandler'
import { useResourceGuard } from '@/composables/useResourceGuard'
import { info, success } from '@/composables/useToast'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

useSession()
const { canAccessCrawler } = useResourceGuard()

const stats = ref<any>({})
const failedTasks = ref<any>({})
const loading = ref(true)
const autoRefresh = ref(true)
let refreshInterval: any = null

async function loadStats() {
  try {
    stats.value = await api.admin.getCrawlerStats()
  }
  catch (e) {
    handleError(e, '加载爬虫统计失败')
  }
}

async function loadFailedTasks() {
  try {
    failedTasks.value = await api.admin.getFailedTasks()
  }
  catch (e) {
    handleError(e, '加载失败任务失败')
  }
}

async function refresh() {
  loading.value = true
  try {
    await Promise.all([loadStats(), loadFailedTasks()])
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  refresh()

  if (autoRefresh.value) {
    refreshInterval = setInterval(refresh, 30000)
  }
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

async function handleRecoverCrawler(type: 'comic' | 'movie') {
  try {
    const response = await api.admin.recoverCrawler(type)
    success(`恢复 ${type === 'comic' ? '漫画' : '电影'} 爬虫成功`)
    info(JSON.stringify(response, null, 2), { duration: 8000 })
  }
  catch (e) {
    handleError(e, `触发 ${type === 'comic' ? '漫画' : '电影'} 爬虫恢复失败`)
  }
}

async function handleClearFailed(type: 'comic' | 'movie') {
  // eslint-disable-next-line no-alert
  if (!confirm(`确认清空 ${type === 'comic' ? '漫画' : '电影'} 的失败任务记录？`))
    return

  try {
    await api.admin.clearFailedTasks(type)
    await loadFailedTasks()
    success(`已清空 ${type === 'comic' ? '漫画' : '电影'} 失败任务记录`)
  }
  catch (e) {
    handleError(e, `清空 ${type === 'comic' ? '漫画' : '电影'} 失败任务失败`)
  }
}
</script>

<template>
  <div class="crawlers-page">
    <div class="page-header">
      <h1>爬虫监控</h1>
      <div class="header-actions">
        <label class="auto-refresh">
          <input v-model="autoRefresh" type="checkbox">
          自动刷新 (30s)
        </label>
        <button class="btn-refresh" @click="refresh">
          🔄 刷新
        </button>
      </div>
    </div>

    <div v-if="loading && !stats.comics && !stats.movies" class="stats-grid">
      <SkeletonCard variant="stat" />
      <SkeletonCard variant="stat" />
    </div>

    <div v-else class="stats-grid">
      <div v-if="canAccessCrawler('comic') && stats.comics" class="stat-card">
        <h3>📚 漫画爬虫</h3>
        <div class="stat-row">
          <span>总数:</span>
          <strong>{{ stats.comics.total }}</strong>
        </div>
        <div class="stat-row">
          <span>等待中:</span>
          <strong class="text-orange">{{ stats.comics.pending }}</strong>
        </div>
        <div class="stat-row">
          <span>部分完成:</span>
          <strong class="text-yellow">{{ stats.comics.partial }}</strong>
        </div>
        <div class="stat-row">
          <span>已完成:</span>
          <strong class="text-green">{{ stats.comics.complete }}</strong>
        </div>
        <div class="stat-row">
          <span>最后运行:</span>
          <small>{{ stats.comics.lastCrawlAt ? new Date(stats.comics.lastCrawlAt).toLocaleString('zh-CN') : '未运行' }}</small>
        </div>
      </div>

      <div v-if="canAccessCrawler('movie') && stats.movies" class="stat-card">
        <h3>🎬 电影爬虫</h3>
        <div class="stat-row">
          <span>总数:</span>
          <strong>{{ stats.movies.total }}</strong>
        </div>
        <div class="stat-row">
          <span>等待中:</span>
          <strong class="text-orange">{{ stats.movies.pending }}</strong>
        </div>
        <div class="stat-row">
          <span>部分完成:</span>
          <strong class="text-yellow">{{ stats.movies.partial }}</strong>
        </div>
        <div class="stat-row">
          <span>已完成:</span>
          <strong class="text-green">{{ stats.movies.complete }}</strong>
        </div>
        <div class="stat-row">
          <span>最后运行:</span>
          <small>{{ stats.movies.lastCrawlAt ? new Date(stats.movies.lastCrawlAt).toLocaleString('zh-CN') : '未运行' }}</small>
        </div>
      </div>
    </div>

    <div class="failed-tasks-section">
      <h2>❌ 失败任务</h2>

      <div v-if="canAccessCrawler('comic') && failedTasks.comics" class="failed-group">
        <div class="group-header">
          <h3>漫画爬虫失败任务 ({{ failedTasks.comics.total }})</h3>
          <div class="group-actions">
            <button class="btn-secondary" @click="handleRecoverCrawler('comic')">
              触发恢复
            </button>
            <button class="btn-danger" @click="handleClearFailed('comic')">
              清空记录
            </button>
          </div>
        </div>

        <div v-if="failedTasks.comics.total === 0" class="empty-state">
          无失败任务
        </div>
        <div v-else class="error-groups">
          <div
            v-for="(count, errorType) in failedTasks.comics.groupedByError"
            :key="errorType"
            class="error-group"
          >
            <div class="error-header">
              <strong>{{ errorType }}</strong>
              <span class="count-badge">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="canAccessCrawler('movie') && failedTasks.movies" class="failed-group">
        <div class="group-header">
          <h3>电影爬虫失败任务 ({{ failedTasks.movies.total }})</h3>
          <div class="group-actions">
            <button class="btn-secondary" @click="handleRecoverCrawler('movie')">
              触发恢复
            </button>
            <button class="btn-danger" @click="handleClearFailed('movie')">
              清空记录
            </button>
          </div>
        </div>

        <div v-if="failedTasks.movies.total === 0" class="empty-state">
          无失败任务
        </div>
        <div v-else class="error-groups">
          <div
            v-for="(count, errorType) in failedTasks.movies.groupedByError"
            :key="errorType"
            class="error-group"
          >
            <div class="error-header">
              <strong>{{ errorType }}</strong>
              <span class="count-badge">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crawlers-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.auto-refresh {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-refresh {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-refresh:hover {
  background: #2563eb;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #6b7280;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.text-orange {
  color: #ea580c;
}

.text-yellow {
  color: #ca8a04;
}

.text-green {
  color: #16a34a;
}

.failed-tasks-section {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.failed-tasks-section > h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.failed-group {
  margin-bottom: 2rem;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.group-header h3 {
  font-size: 1rem;
  font-weight: 600;
}

.group-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-secondary,
.btn-danger {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-danger:hover {
  background: #fee2e2;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.error-groups {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.error-group {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
}

.error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.count-badge {
  padding: 0.25rem 0.75rem;
  background: #dc2626;
  color: white;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
