<script setup lang="ts">
/**
 * 爬虫监控页面
 */

import type { CrawlerRun, CrawlerSourceDisposition, CrawlerTask, CrawlerTaskLog, CrawlerTaskTemplate, ReadinessProjection } from '@/lib/api'
import { ConfirmDialog, info, SkeletonCard, success } from '@starye/ui'
import { AlertTriangle, CheckCircle2, CircleHelp, RefreshCw, Wrench } from 'lucide-vue-next'
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

const crawlerTasks = ref<Record<CrawlerTaskTemplate, CrawlerTask[]>>({ movie: [], manga: [] })
const taskCursors = ref<Record<CrawlerTaskTemplate, string | null>>({ movie: null, manga: null })
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

const sourceDispositionLabels: Record<CrawlerSourceDisposition, string> = {
  ready: 'ready · 有可用播放源',
  no_source: 'no_source · 暂无可用播放源',
  repairing: 'repairing · 修复进行中',
  source_failed: 'source_failed · 来源读取失败',
}

const sourceReasonLabels: Record<NonNullable<ReadinessProjection['source']['reasonCode']>, string> = {
  no_eligible_source: '没有符合条件的播放源',
  repair_requested: '已提交受控修复意图',
  source_candidate_invalid: '播放源候选未通过校验',
  source_read_failed: '来源状态读取失败',
  source_write_failed: '播放源写入失败',
}

function runReadiness(run: CrawlerRun): ReadinessProjection | null {
  return run.readiness ?? null
}

function sourceDispositionLabel(disposition: CrawlerSourceDisposition): string {
  return sourceDispositionLabels[disposition]
}

function sourceReasonLabel(reasonCode: ReadinessProjection['source']['reasonCode']): string {
  return reasonCode ? sourceReasonLabels[reasonCode] : '无'
}

function managementLabel(run: CrawlerRun): string {
  const readiness = runReadiness(run)
  if (!readiness)
    return `管理${run.receipt?.templateKey === 'movie' ? '电影' : '漫画'}内容`
  return readiness.source.disposition === 'ready' ? '查看影片' : '查看修复意图'
}

function canAccessTemplate(template: CrawlerTaskTemplate): boolean {
  return canAccessCrawler(template === 'manga' ? 'comic' : 'movie')
}

function taskTemplate(task: CrawlerTask): CrawlerTaskTemplate {
  return task.templateKey ?? task.template_key!
}

function taskLatestRunId(task: CrawlerTask): string | null {
  return task.latestRunId ?? task.latest_run_id ?? null
}

function taskRuns(task: CrawlerTask): CrawlerRun[] {
  return taskDetails.value[task.id]?.runs ?? []
}

function latestRunFor(task: CrawlerTask): CrawlerRun | null {
  const runs = taskRuns(task)
  if (!runs.length)
    return null
  return runs.find(run => run.id === taskLatestRunId(task))
    ?? runs[0]
    ?? null
}

function selectRun(task: CrawlerTask, run: CrawlerRun | null): void {
  selectedRun.value = run ? { task, run } : null
}

async function loadTaskLogs(task: CrawlerTask, run: CrawlerRun, append = false): Promise<void> {
  try {
    const page = await api.admin.getCrawlerTaskLogs(task.id, run.id, append ? taskLogCursor.value ?? undefined : undefined, 50)
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
      const response = await api.admin.listCrawlerTasks({ template, limit: 20 })
      return [template, response] as const
    }))
    for (const [template, response] of responses) {
      crawlerTasks.value[template] = response.tasks
      taskCursors.value[template] = response.nextCursor ?? null
      for (const task of response.tasks) {
        const detail = await api.admin.getCrawlerTask(task.id)
        taskDetails.value[task.id] = detail
        const run = latestRunFor(task)
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

async function loadMoreTasks(template: CrawlerTaskTemplate): Promise<void> {
  const cursor = taskCursors.value[template]
  if (!cursor)
    return
  const response = await api.admin.listCrawlerTasks({ template, cursor, limit: 20 })
  crawlerTasks.value[template] = [...crawlerTasks.value[template], ...response.tasks]
  taskCursors.value[template] = response.nextCursor ?? null
  for (const task of response.tasks)
    taskDetails.value[task.id] = await api.admin.getCrawlerTask(task.id)
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
    const task = crawlerTasks.value[template][0]
    if (task)
      selectRun(task, latestRunFor(task))
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
    const task = crawlerTasks.value[taskTemplate(target.task)][0]
    if (task)
      selectRun(task, latestRunFor(task))
  }
  catch {
    taskError.value = '无法加载任务数据。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。'
  }
  finally {
    pendingAction.value = null
  }
}

function managementPath(task: CrawlerTask, run: CrawlerRun): string | null {
  if (run.status !== 'succeeded' || !run.receipt)
    return null
  const query = new URLSearchParams({
    receipt: run.receipt.primaryContentId,
    sourceAttempt: String(run.attemptNumber ?? run.attempt_number ?? ''),
    sourceRun: run.id,
    sourceTask: task.id,
  })
  return run.receipt.templateKey === 'movie'
    ? `/dashboard/movies?${query}`
    : `/dashboard/comics?${query}`
}

function runFailureCode(run: CrawlerRun): string | null {
  return run.failureCode ?? run.failure_code ?? null
}

function runTimestamp(run: CrawlerRun): number | string | null | undefined {
  return run.terminalAt ?? run.terminal_at ?? run.createdAt ?? run.created_at
}

function logMessage(log: CrawlerTaskLog): string {
  return log.safeMessage ?? log.safe_message ?? ''
}

function logTimestamp(log: CrawlerTaskLog): number | string | undefined {
  return log.createdAt ?? log.created_at
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
      <div v-else-if="!crawlerTasks.movie.length && !crawlerTasks.manga.length && !canAccessTemplate('movie') && !canAccessTemplate('manga')" class="task-empty">
        <strong>暂无本地任务</strong>
      </div>
      <div v-else class="task-history-grid">
        <template v-for="template in (['movie', 'manga'] as const)" :key="template">
          <section v-if="canAccessTemplate(template)" class="task-group" :aria-labelledby="`${template}-task-title`">
            <div class="task-group-heading">
              <h3 :id="`${template}-task-title`">
                {{ template === 'movie' ? '视频' : '漫画' }}任务历史
              </h3>
              <button class="task-primary" type="button" :disabled="taskAction === template" @click="createTask(template)">
                {{ taskAction === template ? '创建中…' : template === 'movie' ? '创建视频任务' : '创建漫画任务' }}
              </button>
            </div>
            <p v-if="!crawlerTasks[template].length" class="task-empty">
              尚未创建
            </p>
            <article
              v-for="task in crawlerTasks[template]"
              :key="task.id"
              class="task-card"
              :class="{ 'task-card-selected': selectedRun?.task.id === task.id }"
              tabindex="0"
              @click="selectRun(task, latestRunFor(task))"
              @keydown.enter="selectRun(task, latestRunFor(task))"
            >
              <div class="task-card-heading">
                <h4>{{ task.id }}</h4>
                <span v-if="latestRunFor(task)" class="status-label">{{ taskStatusLabels[latestRunFor(task)!.status] }}</span>
                <span v-else class="status-label">尚未上报</span>
              </div>
              <div v-if="latestRunFor(task)" class="task-meta">
                <span>attempt {{ latestRunFor(task)!.attemptNumber ?? latestRunFor(task)!.attempt_number ?? '尚未上报' }}</span>
                <span>{{ runTimestamp(latestRunFor(task)!) ?? '尚未上报' }}</span>
              </div>
              <div class="task-actions">
                <button
                  v-if="latestRunFor(task) && ['queued', 'dispatching', 'running'].includes(latestRunFor(task)!.status)"
                  class="task-secondary task-danger"
                  type="button"
                  @click.stop="askCancel(task, latestRunFor(task)!)"
                >
                  取消任务
                </button>
                <button
                  v-if="latestRunFor(task) && ['failed', 'cancelled'].includes(latestRunFor(task)!.status)"
                  class="task-secondary"
                  type="button"
                  @click.stop="askRetry(task, latestRunFor(task)!)"
                >
                  重试任务
                </button>
              </div>
            </article>
            <button v-if="taskCursors[template]" class="task-secondary load-more" type="button" @click="loadMoreTasks(template)">
              加载更多任务
            </button>
          </section>
        </template>
      </div>

      <div v-if="selectedRun" class="task-detail">
        <div class="section-heading">
          <h3>任务执行详情</h3>
          <span>{{ taskStatusLabels[selectedRun.run.status] }}</span>
        </div>
        <p>模板：{{ taskTemplate(selectedRun.task) === 'movie' ? '视频' : '漫画' }} · attempt {{ selectedRun.run.attemptNumber ?? selectedRun.run.attempt_number ?? '尚未上报' }}</p>
        <p v-if="runFailureCode(selectedRun.run)" class="task-warning">
          终态原因：{{ runFailureCode(selectedRun.run) }}
        </p>
        <div v-if="selectedRun.run.status === 'failed' && runFailureCode(selectedRun.run) === 'receipt_missing'" class="task-warning">
          任务未找到可验证的入库结果，未生成内容管理链接。
        </div>
        <div v-if="selectedRun.run.status === 'cancel_requested'" class="task-warning">
          已请求取消，等待 runner 在安全检查点确认。
        </div>
        <div v-if="taskRuns(selectedRun.task).length > 1" class="attempt-switcher">
          <span>全部 attempt：</span>
          <button
            v-for="run in taskRuns(selectedRun.task)"
            :key="run.id"
            class="task-secondary"
            :class="{ 'attempt-selected': run.id === selectedRun.run.id }"
            type="button"
            @click="selectRun(selectedRun.task, run)"
          >
            #{{ run.attemptNumber ?? run.attempt_number }} · {{ taskStatusLabels[run.status] }}
          </button>
        </div>
        <div class="readiness-detail" aria-live="polite">
          <div class="readiness-identity">
            <strong>内容身份</strong>
            <span v-if="runReadiness(selectedRun.run)">primaryContentId：{{ runReadiness(selectedRun.run)!.metadata.contentId }}</span>
            <span v-else-if="selectedRun.run.receipt">primaryContentId：{{ selectedRun.run.receipt.primaryContentId }}</span>
            <span v-else>状态读取中</span>
          </div>
          <div v-if="runReadiness(selectedRun.run)" class="readiness-grid">
            <section class="readiness-block">
              <h4>Metadata persisted</h4>
              <p class="readiness-state readiness-state-success">
                <CheckCircle2 :size="16" aria-hidden="true" />
                已持久化
              </p>
              <span>content ID：{{ runReadiness(selectedRun.run)!.metadata.contentId }}</span>
              <span>观察时间：{{ runReadiness(selectedRun.run)!.metadata.observedAt ?? '尚未上报' }}</span>
            </section>
            <section
              class="readiness-block"
              :class="`readiness-${runReadiness(selectedRun.run)!.source.disposition}`"
              :role="runReadiness(selectedRun.run)!.source.disposition === 'source_failed' ? 'alert' : runReadiness(selectedRun.run)!.source.disposition === 'repairing' ? 'status' : undefined"
            >
              <h4>Source readiness</h4>
              <p class="readiness-state">
                <CheckCircle2 v-if="runReadiness(selectedRun.run)!.source.disposition === 'ready'" :size="16" aria-hidden="true" />
                <AlertTriangle v-else-if="runReadiness(selectedRun.run)!.source.disposition === 'source_failed'" :size="16" aria-hidden="true" />
                <Wrench v-else-if="runReadiness(selectedRun.run)!.source.disposition === 'repairing'" :size="16" aria-hidden="true" />
                <CircleHelp v-else :size="16" aria-hidden="true" />
                <span>{{ sourceDispositionLabel(runReadiness(selectedRun.run)!.source.disposition) }}</span>
              </p>
              <span>eligible count：{{ runReadiness(selectedRun.run)!.source.eligibleCount }}</span>
              <span>source revision：{{ runReadiness(selectedRun.run)!.source.sourceRevision }}</span>
              <span>受控原因：{{ sourceReasonLabel(runReadiness(selectedRun.run)!.source.reasonCode) }}</span>
              <strong v-if="runReadiness(selectedRun.run)!.source.repairable">可修复</strong>
            </section>
            <section class="readiness-block">
              <h4>Playback proof</h4>
              <p class="readiness-state">
                <CheckCircle2 v-if="runReadiness(selectedRun.run)!.playback.status === 'playback_verified'" :size="16" aria-hidden="true" />
                <CircleHelp v-else :size="16" aria-hidden="true" />
                <span>{{ runReadiness(selectedRun.run)!.playback.status === 'playback_verified' ? '播放已验证' : '播放未验证' }}</span>
              </p>
              <span v-if="runReadiness(selectedRun.run)!.playback.evidence">独立证据：playing · currentTime {{ runReadiness(selectedRun.run)!.playback.evidence!.currentTime }}</span>
              <span v-else>ready/receipt 不等于浏览器播放证据</span>
            </section>
            <section class="readiness-block">
              <h4>Receipt/source summary</h4>
              <p class="readiness-state readiness-state-success">
                <CheckCircle2 :size="16" aria-hidden="true" />
                {{ runReadiness(selectedRun.run)!.receipt.persisted ? 'receipt 已持久化' : 'receipt 未持久化' }}
              </p>
              <span>content identity matched：{{ runReadiness(selectedRun.run)!.receipt.primaryContentId === runReadiness(selectedRun.run)!.metadata.contentId ? '是' : '否' }}</span>
              <span>source revision：{{ runReadiness(selectedRun.run)!.source.sourceRevision }}</span>
              <span>candidate count：{{ runReadiness(selectedRun.run)!.source.eligibleCount }} · disposition：{{ runReadiness(selectedRun.run)!.source.disposition }}</span>
              <span v-if="selectedRun.run.receipt">新增 {{ selectedRun.run.receipt.createdCount }} · 更新 {{ selectedRun.run.receipt.updatedCount }}</span>
            </section>
          </div>
          <div v-else class="readiness-loading" role="status">
            <RefreshCw :size="16" aria-hidden="true" />状态读取中，未推导 ready 或 playback proof。
          </div>
          <div v-if="selectedRun.run.receipt && selectedRun.run.status === 'succeeded'" class="readiness-actions">
            <a
              v-if="managementPath(selectedRun.task, selectedRun.run) && (!runReadiness(selectedRun.run) || ['ready', 'no_source', 'source_failed'].includes(runReadiness(selectedRun.run)!.source.disposition))"
              class="task-secondary readiness-link"
              :href="managementPath(selectedRun.task, selectedRun.run)!"
            >
              {{ managementLabel(selectedRun.run) }}
            </a>
            <button
              v-if="!runReadiness(selectedRun.run) || ['no_source', 'source_failed'].includes(runReadiness(selectedRun.run)!.source.disposition)"
              class="task-secondary"
              type="button"
              :disabled="taskRefreshing"
              @click="loadTaskPanel"
            >
              {{ taskRefreshing ? '读取中…' : '重试读取' }}
            </button>
            <button
              v-else-if="runReadiness(selectedRun.run)?.source.disposition === 'repairing'"
              class="task-secondary"
              type="button"
              :disabled="taskRefreshing"
              @click="loadTaskPanel"
            >
              {{ taskRefreshing ? '刷新中…' : '刷新状态' }}
            </button>
          </div>
        </div>
        <div v-if="selectedRun.run.provider" class="provider-summary">
          <strong>Provider 摘要</strong>
          <span>{{ selectedRun.run.provider.provider ?? 'provider' }}</span>
          <span v-if="selectedRun.run.provider.providerStatus">状态：{{ selectedRun.run.provider.providerStatus }}</span>
          <span v-if="selectedRun.run.provider.providerConclusion">结论：{{ selectedRun.run.provider.providerConclusion }}</span>
          <span v-if="selectedRun.run.provider.providerRunAttempt">attempt：{{ selectedRun.run.provider.providerRunAttempt }}</span>
          <span v-if="selectedRun.run.provider.sha">SHA：{{ selectedRun.run.provider.sha }}</span>
        </div>
        <div class="safe-log-scroller">
          <p v-if="taskLogs.length === 0">
            此运行尚未产生可显示的结构化日志；页面可见时会每 5 秒刷新。
          </p>
          <div v-for="log in taskLogs" :key="`${log.sequence}-${log.created_at}`" class="safe-log-row">
            <code :title="String(log.sequence)">#{{ log.sequence }}</code>
            <time>{{ logTimestamp(log) }}</time>
            <strong>{{ log.level }}</strong>
            <code :title="log.code">{{ log.code }}</code>
            <span>{{ logMessage(log) }}</span>
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

.task-history-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  align-items: start;
}

.task-group {
  display: grid;
  gap: 0.75rem;
}

.task-group-heading,
.attempt-switcher,
.provider-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.task-group-heading h3 { margin: 0; flex: 1; }
.task-group-heading .task-primary { min-height: 36px; }
.attempt-selected { border-color: hsl(var(--primary)); }
.provider-summary { margin-bottom: 1rem; color: hsl(var(--muted-foreground)); font-size: 0.875rem; }

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
.readiness-detail { display: grid; gap: 1rem; margin-bottom: 1rem; border: 1px solid hsl(var(--border)); border-radius: 0.5rem; background: hsl(var(--card)); padding: 1rem; }
.readiness-identity { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.75rem; overflow-wrap: anywhere; }
.readiness-identity span,
.readiness-block > span,
.readiness-block > strong { overflow-wrap: anywhere; }
.readiness-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.readiness-block { display: grid; align-content: start; gap: 0.5rem; min-width: 0; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; padding: 0.875rem; }
.readiness-block h4 { margin: 0; font-size: 0.95rem; font-weight: 600; }
.readiness-state { display: flex; align-items: center; gap: 0.4rem; margin: 0; font-weight: 600; }
.readiness-state-success { color: hsl(var(--primary)); }
.readiness-no_source { background: hsl(var(--secondary)); }
.readiness-source_failed { border-color: hsl(var(--destructive)); }
.readiness-repairing { border-color: hsl(var(--primary)); }
.readiness-loading,
.readiness-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.readiness-loading { color: hsl(var(--muted-foreground)); }
.readiness-actions .readiness-link { display: inline-flex; align-items: center; text-decoration: none; }
.safe-log-scroller { max-height: 448px; overflow-y: auto; border-radius: 0.375rem; background: hsl(var(--muted)); padding: 0.75rem; }
.safe-log-row { display: grid; grid-template-columns: auto auto auto minmax(0, 10rem) minmax(0, 1fr); gap: 0.5rem; align-items: start; padding: 0.5rem 0; border-bottom: 1px solid hsl(var(--border)); font-size: 0.875rem; }
.safe-log-row span { overflow-wrap: anywhere; }
.safe-log-row code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.load-more { display: block; margin: 0.75rem auto 0; }
.task-empty { padding: 1.5rem; color: hsl(var(--muted-foreground)); text-align: center; }

@media (max-width: 1023px) {
  .task-grid,
  .task-history-grid,
  .readiness-grid { grid-template-columns: 1fr; }
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
