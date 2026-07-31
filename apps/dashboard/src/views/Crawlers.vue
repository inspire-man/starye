<script setup lang="ts">
/**
 * 爬虫监控页面
 */

import type { CrawlerRun, CrawlerTask, CrawlerTaskLog, CrawlerTaskTemplate } from '@/lib/api'
import { ConfirmDialog, info, SkeletonCard, success } from '@starye/ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { handleError } from '@/composables/useErrorHandler'
import { useResourceGuard } from '@/composables/useResourceGuard'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

useSession()
const { canAccessCrawler } = useResourceGuard()

const stats = ref<any>({})
const failedTasks = ref<any>({})
const loading = ref(true)
const autoRefresh = ref(true)
let refreshInterval: any = null

const crawlerTasks = ref<Record<CrawlerTaskTemplate, CrawlerTask | null>>({ movie: null, manga: null })
const taskDetails = ref<Record<string, { task: CrawlerTask, runs: CrawlerRun[] }>>({})
const selectedRun = ref<{ task: CrawlerTask, run: CrawlerRun } | null>(null)
const taskLogs = ref<CrawlerTaskLog[]>([])
const taskLogCursor = ref<number | null>(null)
const taskLoading = ref(true)
const taskRefreshing = ref(false)
const taskError = ref('')
const taskAction = ref<CrawlerTaskTemplate | null>(null)
const cancelConfirmOpen = ref(false)
const retryConfirmOpen = ref(false)
const pendingAction = ref<{ task: CrawlerTask, run: CrawlerRun } | null>(null)
let taskRefreshInterval: ReturnType<typeof setInterval> | null = null

const taskStatusLabels: Record<CrawlerRun['status'], string> = {
  queued: '排队中 · 等待本地 runner',
  dispatching: '正在领取',
  running: '运行中',
  cancel_requested: '已请求取消 · 等待 runner 确认',
  succeeded: '已完成',
  failed: '执行失败',
  cancelled: '已取消',
}

function canAccessTemplate(template: CrawlerTaskTemplate): boolean {
  return canAccessCrawler(template === 'manga' ? 'comic' : 'movie')
}

function latestRunFor(template: CrawlerTaskTemplate): CrawlerRun | null {
  const task = crawlerTasks.value[template]
  if (!task)
    return null
  return taskDetails.value[task.id]?.runs?.find(run => run.id === task.latest_run_id)
    ?? taskDetails.value[task.id]?.runs?.[0]
    ?? null
}

function selectRun(task: CrawlerTask, run: CrawlerRun | null): void {
  selectedRun.value = run ? { task, run } : null
}

async function loadTaskLogs(task: CrawlerTask, run: CrawlerRun, append = false): Promise<void> {
  try {
    const page = await api.admin.getCrawlerTaskLogs(task.id, run.id, append ? taskLogCursor.value ?? undefined : undefined)
    taskLogs.value = append ? [...taskLogs.value, ...page.logs] : page.logs
    taskLogCursor.value = page.nextCursor
  }
  catch {
    // 保留上一次有效日志，避免刷新失败时伪造空状态。
    taskError.value = '无法加载任务数据。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。'
  }
}

async function loadTaskPanel(): Promise<void> {
  taskRefreshing.value = !taskLoading.value
  taskError.value = ''
  try {
    const visibleTemplates = (['movie', 'manga'] as const).filter(canAccessTemplate)
    const responses = await Promise.all(visibleTemplates.map(async (template) => {
      const response = await api.admin.listCrawlerTasks({ template, limit: 1 })
      return [template, response.tasks[0] ?? null] as const
    }))
    for (const [template, task] of responses) {
      crawlerTasks.value[template] = task
      if (task) {
        const detail = await api.admin.getCrawlerTask(task.id)
        taskDetails.value[task.id] = detail
        const run = detail.runs.find(item => item.id === task.latest_run_id) ?? detail.runs[0] ?? null
        if (selectedRun.value?.task.id === task.id && run) {
          selectRun(task, run)
        }
        else if (!selectedRun.value && run) {
          selectRun(task, run)
        }
      }
    }
    if (selectedRun.value) {
      const current = taskDetails.value[selectedRun.value.task.id]?.runs.find(run => run.id === selectedRun.value?.run.id)
      if (current) {
        selectedRun.value.run = current
        await loadTaskLogs(selectedRun.value.task, current)
      }
    }
  }
  catch {
    taskError.value = '无法加载任务数据。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。'
  }
  finally {
    taskLoading.value = false
    taskRefreshing.value = false
  }
}

function startTaskPolling(): void {
  stopTaskPolling()
  if (document.visibilityState === 'visible') {
    void loadTaskPanel()
    taskRefreshInterval = setInterval(() => void loadTaskPanel(), 5000)
  }
}

function stopTaskPolling(): void {
  if (taskRefreshInterval !== null) {
    clearInterval(taskRefreshInterval)
    taskRefreshInterval = null
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible')
    startTaskPolling()
  else stopTaskPolling()
}

async function createTask(template: CrawlerTaskTemplate): Promise<void> {
  taskAction.value = template
  try {
    const response = await api.admin.createCrawlerTask(template)
    if (response.kind === 'existing_active_run')
      info('该模板已有活动任务，已打开当前任务。')
    await loadTaskPanel()
    const task = crawlerTasks.value[template]
    if (task)
      selectRun(task, latestRunFor(template))
  }
  catch {
    taskError.value = '无法创建任务。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。'
  }
  finally {
    taskAction.value = null
  }
}

function askCancel(task: CrawlerTask, run: CrawlerRun): void {
  pendingAction.value = { task, run }
  cancelConfirmOpen.value = true
}

function askRetry(task: CrawlerTask, run: CrawlerRun): void {
  pendingAction.value = { task, run }
  retryConfirmOpen.value = true
}

async function confirmCancel(): Promise<void> {
  const target = pendingAction.value
  if (!target)
    return
  try {
    await api.admin.cancelCrawlerRun(target.task.id, target.run.id)
    success('已请求取消，等待 runner 确认。')
    await loadTaskPanel()
  }
  catch {
    taskError.value = '无法加载任务数据。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。'
  }
  finally {
    pendingAction.value = null
  }
}

async function confirmRetry(): Promise<void> {
  const target = pendingAction.value
  if (!target)
    return
  try {
    await api.admin.retryCrawlerRun(target.task.id, target.run.id)
    await loadTaskPanel()
    const task = crawlerTasks.value[target.task.template_key]
    if (task)
      selectRun(task, latestRunFor(target.task.template_key))
  }
  catch {
    taskError.value = '无法加载任务数据。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。'
  }
  finally {
    pendingAction.value = null
  }
}

function managementPath(run: CrawlerRun): string | null {
  if (run.status !== 'succeeded' || !run.receipt)
    return null
  return run.receipt.templateKey === 'movie'
    ? `/dashboard/movies?receipt=${encodeURIComponent(run.receipt.primaryContentId)}`
    : `/dashboard/comics?receipt=${encodeURIComponent(run.receipt.primaryContentId)}`
}

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
  document.addEventListener('visibilitychange', handleVisibilityChange)
  startTaskPolling()

  if (autoRefresh.value) {
    refreshInterval = setInterval(refresh, 30000)
  }
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  stopTaskPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
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

// ConfirmDialog 状态（清空失败任务）
const clearConfirmOpen = ref(false)
const clearConfirmType = ref<'comic' | 'movie'>('comic')

function handleClearFailed(type: 'comic' | 'movie') {
  clearConfirmType.value = type
  clearConfirmOpen.value = true
}

async function executeClearFailed() {
  const type = clearConfirmType.value
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

    <section class="local-task-panel" aria-labelledby="local-task-title">
      <div class="section-heading">
        <div>
          <h2 id="local-task-title">
            本地任务
          </h2>
          <p v-if="taskRefreshing" class="refresh-note">
            正在更新
          </p>
        </div>
        <button class="task-refresh-button" type="button" @click="loadTaskPanel">
          刷新
        </button>
      </div>
      <p v-if="taskError" class="task-error" role="alert">
        {{ taskError }}
      </p>
      <div v-if="taskLoading" class="task-grid">
        <SkeletonCard v-if="canAccessTemplate('movie')" variant="stat" />
        <SkeletonCard v-if="canAccessTemplate('manga')" variant="stat" />
      </div>
      <div v-else-if="!crawlerTasks.movie && !crawlerTasks.manga && !canAccessTemplate('movie') && !canAccessTemplate('manga')" class="task-empty">
        <strong>暂无本地任务</strong>
      </div>
      <div v-else class="task-grid">
        <template v-for="template in (['movie', 'manga'] as const)" :key="template">
          <article
            v-if="canAccessTemplate(template)"
            class="task-card"
            :class="{ 'task-card-selected': selectedRun?.task.template_key === template }"
            tabindex="0"
            @click="crawlerTasks[template] && selectRun(crawlerTasks[template]!, latestRunFor(template))"
            @keydown.enter="crawlerTasks[template] && selectRun(crawlerTasks[template]!, latestRunFor(template))"
          >
            <div class="task-card-heading">
              <h3>{{ template === 'movie' ? '视频' : '漫画' }}</h3>
              <span v-if="latestRunFor(template)" class="status-label">{{ taskStatusLabels[latestRunFor(template)!.status] }}</span>
              <span v-else class="status-label">尚未创建</span>
            </div>
            <p>仅执行服务端固定模板</p>
            <div v-if="latestRunFor(template)" class="task-meta">
              <span>attempt {{ latestRunFor(template)!.attemptNumber ?? latestRunFor(template)!.attempt_number ?? '尚未上报' }}</span>
              <span>{{ latestRunFor(template)!.terminal_at ?? latestRunFor(template)!.created_at ?? '尚未上报' }}</span>
            </div>
            <div class="task-actions">
              <button class="task-primary" type="button" :disabled="taskAction === template" @click="createTask(template)">
                {{ taskAction === template ? '创建中…' : template === 'movie' ? '创建视频任务' : '创建漫画任务' }}
              </button>
              <button
                v-if="latestRunFor(template) && ['queued', 'dispatching', 'running'].includes(latestRunFor(template)!.status)"
                class="task-secondary task-danger"
                type="button"
                @click="askCancel(crawlerTasks[template]!, latestRunFor(template)!)"
              >
                取消任务
              </button>
              <button
                v-if="latestRunFor(template) && ['failed', 'cancelled'].includes(latestRunFor(template)!.status)"
                class="task-secondary"
                type="button"
                @click="askRetry(crawlerTasks[template]!, latestRunFor(template)!)"
              >
                重试任务
              </button>
            </div>
          </article>
        </template>
      </div>

      <div v-if="selectedRun" class="task-detail">
        <div class="section-heading">
          <h3>任务执行详情</h3>
          <span>{{ taskStatusLabels[selectedRun.run.status] }}</span>
        </div>
        <p>模板：{{ selectedRun.task.template_key === 'movie' ? '视频' : '漫画' }} · attempt {{ selectedRun.run.attemptNumber ?? selectedRun.run.attempt_number ?? '尚未上报' }}</p>
        <div v-if="selectedRun.run.status === 'failed' && selectedRun.run.failure_code === 'receipt_missing'" class="task-warning">
          任务未找到可验证的入库结果，未生成内容管理链接。
        </div>
        <div v-if="selectedRun.run.receipt && selectedRun.run.status === 'succeeded'" class="receipt-card">
          <strong>已验证入库结果</strong>
          <span>主内容 ID：{{ selectedRun.run.receipt.primaryContentId }}</span>
          <span>新增 {{ selectedRun.run.receipt.createdCount }} · 更新 {{ selectedRun.run.receipt.updatedCount }}</span>
          <a v-if="managementPath(selectedRun.run)" :href="managementPath(selectedRun.run)!">管理{{ selectedRun.run.receipt.templateKey === 'movie' ? '电影' : '漫画' }}内容</a>
        </div>
        <div class="safe-log-scroller">
          <p v-if="taskLogs.length === 0">
            此运行尚未产生可显示的结构化日志；页面可见时会每 5 秒刷新。
          </p>
          <div v-for="log in taskLogs" :key="`${log.sequence}-${log.created_at}`" class="safe-log-row">
            <code :title="String(log.sequence)">#{{ log.sequence }}</code>
            <time>{{ log.created_at }}</time>
            <strong>{{ log.level }}</strong>
            <code :title="log.code">{{ log.code }}</code>
            <span>{{ log.safe_message }}</span>
          </div>
          <button v-if="taskLogCursor !== null" class="task-secondary load-more" type="button" @click="selectedRun && loadTaskLogs(selectedRun.task, selectedRun.run, true)">
            加载更早日志
          </button>
        </div>
      </div>
      <div v-else class="task-empty">
        选择一个最新任务以查看状态、入库结果和结构化日志。
      </div>
    </section>

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

  <!-- 清空失败任务确认对话框 -->
  <ConfirmDialog
    v-model:open="clearConfirmOpen"
    title="确认清空失败任务"
    :message="`确认清空 ${clearConfirmType === 'comic' ? '漫画' : '电影'} 的所有失败任务记录？此操作不可撤销。`"
    variant="danger"
    @confirm="executeClearFailed"
  />

  <ConfirmDialog
    v-model:open="cancelConfirmOpen"
    title="确认请求取消任务"
    message="取消任务：runner 会在下一个安全检查点停止后续工作；已入库内容会保留。"
    confirm-text="继续取消"
    cancel-text="返回任务"
    variant="danger"
    @confirm="confirmCancel"
  />
  <ConfirmDialog
    v-model:open="retryConfirmOpen"
    title="确认重试任务"
    message="重试任务：将创建新的 attempt；原任务的状态和日志会保留。"
    confirm-text="创建重试"
    cancel-text="返回任务"
    @confirm="confirmRetry"
  />
</template>

<style scoped>
.local-task-panel {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--background));
}

.section-heading,
.task-card-heading,
.task-actions,
.task-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.section-heading {
  margin-bottom: 1rem;
}

.section-heading h2,
.section-heading h3,
.task-card h3 {
  margin: 0;
  font-weight: 600;
}

.section-heading h2 { font-size: 1.25rem; }
.section-heading h3,
.task-card h3 { font-size: 1.125rem; }

.refresh-note,
.task-card p,
.task-meta,
.task-detail > p,
.safe-log-scroller > p {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.task-card,
.task-detail,
.receipt-card {
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--card));
  padding: 1rem;
}
.task-card-selected { border-color: hsl(var(--primary)); }

.task-card p { margin: 0.75rem 0; }
.task-meta { justify-content: flex-start; flex-wrap: wrap; margin-bottom: 0.75rem; }
.status-label { border-radius: 9999px; background: hsl(var(--secondary)); padding: 0.25rem 0.5rem; font-size: 0.875rem; }
.task-actions { justify-content: flex-start; flex-wrap: wrap; }
.task-primary,
.task-secondary,
.task-refresh-button,
.load-more {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
}
.task-primary { border: 1px solid hsl(var(--primary)); background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.task-secondary,
.task-refresh-button { border: 1px solid hsl(var(--border)); background: hsl(var(--secondary)); color: hsl(var(--foreground)); }
.task-danger { border-color: hsl(var(--destructive)); color: hsl(var(--destructive)); }
.task-primary:disabled { cursor: wait; opacity: 0.65; }
.task-detail { margin-top: 1.5rem; }
.task-warning,
.task-error { border-radius: 0.375rem; background: hsl(var(--secondary)); padding: 0.75rem; color: hsl(var(--destructive)); }
.receipt-card { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
.receipt-card a { min-height: 44px; color: hsl(var(--primary)); text-decoration: underline; }
.safe-log-scroller { max-height: 448px; overflow-y: auto; border-radius: 0.375rem; background: hsl(var(--muted)); padding: 0.75rem; }
.safe-log-row { display: grid; grid-template-columns: auto auto auto minmax(0, 10rem) minmax(0, 1fr); gap: 0.5rem; align-items: start; padding: 0.5rem 0; border-bottom: 1px solid hsl(var(--border)); font-size: 0.875rem; }
.safe-log-row span { overflow-wrap: anywhere; }
.safe-log-row code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.load-more { display: block; margin: 0.75rem auto 0; }
.task-empty { padding: 1.5rem; color: hsl(var(--muted-foreground)); text-align: center; }

@media (max-width: 1023px) {
  .task-grid { grid-template-columns: 1fr; }
}

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
