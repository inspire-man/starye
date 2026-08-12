<script setup lang="ts">
/**
 * 爬虫监控页面
 */

import type { CrawlerAvailabilityHistoryEntry, CrawlerAvailabilityNextAction, CrawlerAvailabilityOutcome, CrawlerAvailabilityProjection, CrawlerAvailabilityReasonCode, CrawlerAvailabilityStatus, CrawlerPlaybackEventName, CrawlerPlaybackEvidenceEntry, CrawlerPlaybackEvidenceEvent, CrawlerPlaybackEvidenceOutcome, CrawlerPlaybackEvidenceSummary, CrawlerRepairNextAction, CrawlerRepairReason, CrawlerRepairReceipt, CrawlerRepairSourceProjection, CrawlerRepairSourceReadback, CrawlerRun, CrawlerSourceDisposition, CrawlerSourceHealth, CrawlerSourceHealthReasonCode, CrawlerSourceHealthRow, CrawlerSourceType, CrawlerTask, CrawlerTaskAudit, CrawlerTaskDetail, CrawlerTaskLifecycleProjection, CrawlerTaskLog, CrawlerTaskMetadataUpdate, CrawlerTaskSupersedeCommand, CrawlerTaskTemplate, ReadinessProjection } from '@/lib/api'
import { ConfirmDialog, info, SkeletonCard, success } from '@starye/ui'
import { AlertTriangle, Archive, CheckCircle2, CircleAlert, CircleHelp, ExternalLink, GitBranch, History, LoaderCircle, Pencil, RefreshCw, Save, Wrench } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
const taskDetails = ref<Record<string, CrawlerTaskDetail>>({})
const selectedTask = ref<CrawlerTask | null>(null)
const selectedRun = ref<{ task: CrawlerTask, run: CrawlerRun } | null>(null)
const taskLogs = ref<CrawlerTaskLog[]>([])
const taskLogCursor = ref<number | null>(null)
const taskLoading = ref(true)
const taskRefreshing = ref(false)
const taskError = ref('')
const taskAction = ref<CrawlerTaskTemplate | null>(null)
const cancelConfirmOpen = ref(false)
const retryConfirmOpen = ref(false)
const archiveConfirmOpen = ref(false)
const supersedeConfirmOpen = ref(false)
const pendingAction = ref<{ task: CrawlerTask, run: CrawlerRun } | null>(null)
const pendingTaskMutation = ref<CrawlerTask | null>(null)
const taskMutation = ref<'archive' | 'metadata' | 'supersede' | null>(null)
const metadataEditOpen = ref(false)
const metadataDescription = ref('')
const metadataIntent = ref('')
const repairConfirmOpen = ref(false)
const pendingRepair = ref<{ movieId: string, movieTitle: string, reason: CrawlerRepairReason } | null>(null)
const repairAction = ref(false)
const expandedHistory = ref<Record<string, boolean>>({})
const taskAudits = ref<Record<string, CrawlerTaskAudit[]>>({})
const taskAuditCursors = ref<Record<string, string | null>>({})
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

const sourceHealthLabels: Record<CrawlerSourceHealth, string> = {
  inactive: 'inactive · 未参与候选',
  unverified: 'unverified · 尚未验证',
  failed: 'failed · 来源失败',
}

const sourceHealthReasonLabels: Record<CrawlerSourceHealthReasonCode, string> = {
  source_inactive: '来源未启用',
  source_unverified: '来源尚未验证',
  source_candidate_invalid: '来源候选未通过校验',
  source_read_failed: '来源读取失败',
  source_write_failed: '来源写入失败',
}

const repairNextActionLabels: Record<CrawlerRepairNextAction, string> = {
  none: '暂无下一步',
  wait_for_observation: '等待来源观察与读回',
  create_new_task: '允许创建新的修复任务',
}

const lifecycleLabels: Record<CrawlerTaskLifecycleProjection['status'], string> = {
  active: 'active · 可运维',
  archived: 'archived · 已归档',
  superseded: 'superseded · 已被新任务替代',
}

const availabilityStatusLabels: Record<CrawlerAvailabilityStatus, string> = {
  available: 'available · 可用',
  degraded: 'degraded · 降级',
  unavailable: 'unavailable · 不可用',
  unknown: 'unknown · 未确定',
}

const availabilityNextActionLabels: Record<CrawlerAvailabilityNextAction, string> = {
  ignore: 'ignore · 忽略',
  none: 'none · 无下一步',
  recheck: 'recheck · 重新检查',
  repair: 'repair · 修复',
  retry: 'retry · 重试',
}

const availabilityOutcomeLabels: Record<CrawlerAvailabilityOutcome, string> = {
  accepted: 'accepted · 已接受',
  conflict: 'conflict · 冲突',
  duplicate: 'duplicate · 重放',
  late: 'late · 迟到',
  rejected: 'rejected · 已拒绝',
  stale: 'stale · 过期',
}

const playbackEventLabels: Record<CrawlerPlaybackEventName, string> = {
  canplay: 'canplay',
  error: 'error',
  playing: 'playing',
  stalled: 'stalled',
  waiting: 'waiting',
}

const boundedFailureCodes = new Set([
  'cancelled',
  'operation_mismatch',
  'provider_lost',
  'receipt_missing',
  'source_read_failed',
  'source_revision_mismatch',
  'source_stale',
  'source_write_failed',
])

const repairConfirmationMessage = computed(() => {
  const target = pendingRepair.value
  if (!target)
    return ''
  return `确认对 ${target.movieTitle} 发起 ${target.reason}，固定意图 restore_playable_sources（恢复可播放源）？`
})

function runReadiness(run: CrawlerRun): ReadinessProjection | null {
  return run.readiness ?? null
}

function sourceDispositionLabel(disposition: CrawlerSourceDisposition): string {
  return sourceDispositionLabels[disposition]
}

function sourceReasonLabel(reasonCode: ReadinessProjection['source']['reasonCode']): string {
  return reasonCode ? sourceReasonLabels[reasonCode] : '无'
}

function isRepairReceipt(receipt: CrawlerRun['receipt']): receipt is CrawlerRepairReceipt {
  return Boolean(receipt && 'operation' in receipt && receipt.operation === 'repair_players')
}

function sourceHealthRows(run: CrawlerRun): CrawlerSourceHealthRow[] {
  return isRepairReceipt(run.receipt) ? run.receipt.sourceSummary : []
}

function sourceHealthLabel(health: CrawlerSourceHealth): string {
  return sourceHealthLabels[health]
}

function sourceHealthReasonLabel(reasonCode: CrawlerSourceHealthReasonCode): string {
  return `${reasonCode} · ${sourceHealthReasonLabels[reasonCode]}`
}

function sourceTypeLabel(sourceType: CrawlerSourceType): string {
  return sourceType
}

function repairReasonFor(run: CrawlerRun, task?: CrawlerTask): CrawlerRepairReason | null {
  const disposition = (task ? sourceProjectionFor(task, run)?.disposition : runReadiness(run)?.source.disposition)
  return disposition === 'no_source' || disposition === 'source_failed' ? disposition : null
}

function repairMovieId(run: CrawlerRun): string | null {
  return runReadiness(run)?.metadata.contentId ?? (run.receipt && !isRepairReceipt(run.receipt) ? run.receipt.primaryContentId : null)
}

function receiptContentId(run: CrawlerRun): string | null {
  return run.receipt && !isRepairReceipt(run.receipt) ? run.receipt.primaryContentId : null
}

function managementLabel(task: CrawlerTask, run: CrawlerRun): string {
  if (task.operation === 'repair_players')
    return '查看影片'
  const readiness = runReadiness(run)
  if (!readiness)
    return `管理${run.receipt && !isRepairReceipt(run.receipt) && run.receipt.templateKey === 'movie' ? '电影' : '漫画'}内容`
  return readiness.source.disposition === 'ready' ? '查看影片' : '查看修复意图'
}

function canAccessTemplate(template: CrawlerTaskTemplate): boolean {
  return canAccessCrawler(template === 'manga' ? 'comic' : 'movie')
}

function taskTemplate(task: CrawlerTask): CrawlerTaskTemplate {
  return task.templateKey ?? task.template_key ?? 'movie'
}

function taskLatestRunId(task: CrawlerTask): string | null {
  return task.latestRunId ?? task.latest_run_id ?? null
}

function taskRuns(task: CrawlerTask): CrawlerRun[] {
  return taskDetails.value[task.id]?.runs ?? []
}

function taskLifecycleFor(task: CrawlerTask): CrawlerTaskLifecycleProjection {
  return taskDetails.value[task.id]?.lifecycle ?? task.lifecycle ?? { changedAt: 0, status: 'active', version: 0 }
}

function taskAvailabilityFor(task: CrawlerTask) {
  return taskDetails.value[task.id]?.availability ?? null
}

function availabilityCurrentFor(task: CrawlerTask): CrawlerAvailabilityProjection | null {
  return taskAvailabilityFor(task)?.current ?? null
}

function availabilityHistoryFor(task: CrawlerTask): CrawlerAvailabilityHistoryEntry[] {
  return taskAvailabilityFor(task)?.history ?? []
}

function availabilityReasonLabel(reasonCode: CrawlerAvailabilityReasonCode): string {
  return reasonCode
}

function latestRunFor(task: CrawlerTask): CrawlerRun | null {
  const currentAttempt = taskDetails.value[task.id]?.currentAttempt
  if (currentAttempt)
    return currentAttempt
  const runs = taskRuns(task)
  if (!runs.length)
    return null
  return runs.find(run => run.id === taskLatestRunId(task))
    ?? runs[0]
    ?? null
}

function historyRunsFor(task: CrawlerTask): CrawlerRun[] {
  const history = taskDetails.value[task.id]?.history
  if (history)
    return history
  const current = latestRunFor(task)
  return taskRuns(task).filter(run => run.id !== current?.id)
}

function playbackEvidenceFor(task: CrawlerTask): CrawlerTaskDetail['playbackEvidence'] | null {
  return taskDetails.value[task.id]?.playbackEvidence ?? null
}

function playbackEntryFor(task: CrawlerTask, run: CrawlerRun): CrawlerPlaybackEvidenceEntry | null {
  const evidence = playbackEvidenceFor(task)
  if (!evidence)
    return null
  if (evidence.current?.runId === run.id)
    return evidence.current
  return evidence.history.find(entry => entry.runId === run.id) ?? null
}

function playbackSummaryFor(task: CrawlerTask, run: CrawlerRun): CrawlerPlaybackEvidenceSummary | null {
  return playbackEntryFor(task, run)?.summary ?? null
}

function playbackEventLabel(event: CrawlerPlaybackEvidenceEvent): string {
  return `${playbackEventLabels[event.event]}：${event.observed ? '已观察' : '未观察'}${event.observedAt !== null ? ` · ${event.observedAt}` : ''}`
}

function playbackStatusLabel(summary: CrawlerPlaybackEvidenceSummary | null): string {
  if (!summary)
    return '等待浏览器证据'
  if (summary.playback.status === 'playback_verified')
    return '播放已验证'
  if (summary.playback.status === 'failed')
    return '播放失败'
  return 'checkpoint：前置条件或证据写入未满足'
}

function playbackOutcomeLabel(outcome: CrawlerPlaybackEvidenceOutcome): string {
  return outcome
}

function playbackHistoryFor(task: CrawlerTask): CrawlerPlaybackEvidenceEntry[] {
  return playbackEvidenceFor(task)?.history ?? []
}

function playbackHistoryEntriesFor(task: CrawlerTask, run: CrawlerRun): CrawlerPlaybackEvidenceEntry[] {
  return playbackHistoryFor(task).filter(entry => entry.runId === run.id)
}

function sourceProjectionFor(task: CrawlerTask, run: CrawlerRun): CrawlerRepairSourceProjection | null {
  if (task.source)
    return task.source
  const source = runReadiness(run)?.source
  if (!source) {
    if (isRepairReceipt(run.receipt)) {
      const rows = sourceHealthRows(run)
      return {
        disposition: rows.some(row => row.eligible) ? 'ready' : 'source_failed',
        eligibleCount: rows.filter(row => row.eligible).length,
        observedAt: run.receipt.observedAt,
        reasonCode: rows[0]?.reasonCode ?? null,
        repairable: !rows.some(row => row.eligible),
        rows,
        sourceRevision: run.receipt.sourceRevision,
      }
    }
    else {
      return null
    }
  }
  return {
    ...source,
    rows: sourceHealthRows(run),
  }
}

function sourceReadbackFor(task: CrawlerTask, run: CrawlerRun): CrawlerRepairSourceReadback | null {
  return task.sourceReadback ?? run.sourceReadback ?? null
}

function isActiveRun(run: CrawlerRun | null | undefined): boolean {
  return Boolean(run && ['queued', 'dispatching', 'running', 'cancel_requested'].includes(run.status))
}

function activeRepairTaskForMovie(movieId: string): CrawlerTask | null {
  return crawlerTasks.value.movie.find((task) => {
    if (task.operation !== 'repair_players' || task.movie?.id !== movieId)
      return false
    return isActiveRun(latestRunFor(task))
  }) ?? null
}

function repairActionLocked(run: CrawlerRun): boolean {
  const movieId = repairMovieId(run)
  const activeTask = movieId ? activeRepairTaskForMovie(movieId) : null
  return Boolean(activeTask && activeTask.id !== selectedRun.value?.task.id)
}

function providerLifecycleLabel(run: CrawlerRun): string {
  if (!run.provider)
    return '尚未上报'
  if (run.provider.providerStatus === 'completed')
    return run.provider.providerConclusion === 'success' ? 'Provider 已完成' : `Provider 已完成 · ${run.provider.providerConclusion ?? '失败'}`
  if (run.provider.providerStatus === 'in_progress')
    return 'Provider 运行中'
  return 'Provider 已受理'
}

function leaseLabel(run: CrawlerRun): string {
  const outcome = run.lease?.outcome
  if (!outcome)
    return '尚未上报'
  return {
    active: 'Lease 有效',
    expired: 'Lease 已过期',
    pending: '等待 lease 对账',
    recovered: 'Lease 已恢复',
    released: 'Lease 已释放',
    renewed: 'Lease 已续期',
  }[outcome]
}

function reconciliationLabel(run: CrawlerRun): string {
  const reconciliation = run.reconciliation
  if (!reconciliation)
    return '等待对账'
  const outcome = reconciliation.outcome
  if (outcome === 'pending')
    return '等待对账'
  return `对账${outcome}`
}

function repairFactLabel(run: CrawlerRun): string {
  if (run.repair?.status === 'validated')
    return '修复已验证'
  if (run.repair?.status === 'failed')
    return `修复失败${run.repair.failureCode ? ` · ${run.repair.failureCode}` : ''}`
  return '修复待校验'
}

function receiptFactLabel(run: CrawlerRun): string {
  if (run.receiptValidation?.status === 'validated')
    return 'receipt 已验证'
  if (run.receiptValidation?.status === 'failed')
    return `receipt 校验失败${run.receiptValidation.failureCode ? ` · ${run.receiptValidation.failureCode}` : ''}`
  return 'receipt 待验证'
}

function sourceFactLabel(source: CrawlerRepairSourceProjection | null): string {
  return source ? sourceDispositionLabel(source.disposition) : '尚未上报'
}

function historyOutcomeLabel(run: CrawlerRun): string {
  const outcome = run.outcome?.outcome
  if (!outcome || outcome === 'pending')
    return '尚未上报'
  return outcome
}

function toggleHistory(taskId: string): void {
  expandedHistory.value[taskId] = !expandedHistory.value[taskId]
}

function selectRun(task: CrawlerTask, run: CrawlerRun | null): void {
  selectedTask.value = task
  selectedRun.value = run ? { task, run } : null
  void loadTaskAudit(task.id)
  if (run) {
    void loadTaskLogs(task, run)
  }
  else {
    taskLogs.value = []
    taskLogCursor.value = null
  }
}

async function loadTaskAudit(taskId: string, append = false): Promise<void> {
  try {
    const page = await api.admin.getCrawlerTaskAudit(taskId, append ? taskAuditCursors.value[taskId] ?? undefined : undefined, 50)
    taskAudits.value[taskId] = append ? [...(taskAudits.value[taskId] ?? []), ...page.audits] : page.audits
    taskAuditCursors.value[taskId] = page.nextCursor
  }
  catch {
    taskError.value = '无法加载任务审计。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。'
  }
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
    let selectedRunChanged = false
    for (const [template, response] of responses) {
      const selectedTaskForTemplate = selectedRun.value && taskTemplate(selectedRun.value.task) === template
        ? selectedRun.value.task
        : selectedTask.value && taskTemplate(selectedTask.value) === template
          ? selectedTask.value
          : null
      const tasks = selectedTaskForTemplate && !response.tasks.some(task => task.id === selectedTaskForTemplate.id)
        ? [selectedTaskForTemplate, ...response.tasks]
        : response.tasks
      crawlerTasks.value[template] = tasks
      taskCursors.value[template] = response.nextCursor ?? null
      for (const task of tasks) {
        const detail = await api.admin.getCrawlerTask(task.id)
        const previousDetail = taskDetails.value[task.id]
        const storedDetail: CrawlerTaskDetail = {
          ...detail,
          ...(detail.playbackEvidence || !previousDetail?.playbackEvidence
            ? {}
            : { playbackEvidence: previousDetail.playbackEvidence }),
        }
        taskDetails.value[task.id] = storedDetail
        const displayTask = storedDetail.task ?? task
        crawlerTasks.value[template] = crawlerTasks.value[template].map(current => current.id === task.id ? displayTask : current)
        const run = latestRunFor(displayTask)
        if (selectedRun.value?.task.id === task.id && run) {
          selectRun(displayTask, run)
          selectedRunChanged = true
        }
        else if (selectedTask.value?.id === task.id) {
          selectedTask.value = displayTask
          if (run) {
            selectRun(displayTask, run)
            selectedRunChanged = true
          }
        }
        else if (!selectedRun.value && run) {
          selectRun(displayTask, run)
          selectedRunChanged = true
        }
      }
    }
    if (selectedRun.value && !selectedRunChanged) {
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

function askArchive(task: CrawlerTask): void {
  pendingTaskMutation.value = task
  archiveConfirmOpen.value = true
}

function askSupersede(task: CrawlerTask): void {
  pendingTaskMutation.value = task
  supersedeConfirmOpen.value = true
}

function openMetadataEdit(task: CrawlerTask): void {
  pendingTaskMutation.value = task
  metadataDescription.value = ''
  metadataIntent.value = task.operation ?? taskTemplate(task)
  metadataEditOpen.value = true
}

function supersedeCommand(task: CrawlerTask): CrawlerTaskSupersedeCommand | null {
  const template = taskTemplate(task)
  const targetId = task.movie?.id ?? task.id
  if (task.operation === 'repair_players') {
    if (!task.movie?.id || task.reason === undefined || task.sourceRevision === undefined)
      return null
    return {
      idempotencyKey: `dashboard:supersede:${task.id}`,
      intent: {
        kind: 'repair_players',
        reason: task.reason,
        sourceRevision: task.sourceRevision,
        targetIntent: 'restore_playable_sources',
      },
      operation: 'repair_players',
      policyReference: 'dashboard/crawler-task-supersede',
      policyVersion: 'v1',
      target: { id: task.movie.id, kind: 'movie' },
    }
  }
  return {
    idempotencyKey: `dashboard:supersede:${task.id}`,
    intent: { kind: 'crawl' },
    operation: template,
    policyReference: 'dashboard/crawler-task-supersede',
    policyVersion: 'v1',
    target: { id: targetId, kind: template },
  }
}

async function saveMetadata(): Promise<void> {
  const task = pendingTaskMutation.value
  if (!task || taskMutation.value)
    return
  const metadata: CrawlerTaskMetadataUpdate = {
    ...(metadataDescription.value.trim() ? { description: metadataDescription.value.trim() } : {}),
    ...(metadataIntent.value.trim() ? { intent: metadataIntent.value.trim() } : {}),
  }
  if (!metadata.description && !metadata.intent) {
    taskError.value = '至少填写一项任务元数据。'
    return
  }
  taskMutation.value = 'metadata'
  try {
    await api.admin.updateCrawlerTask(task.id, metadata)
    success('任务元数据已提交，正在读取权威状态。')
    metadataEditOpen.value = false
    await loadTaskPanel()
    await loadTaskAudit(task.id)
  }
  catch {
    taskError.value = '任务元数据更新被拒绝。请刷新后重试。'
  }
  finally {
    taskMutation.value = null
  }
}

async function confirmArchive(): Promise<void> {
  const task = pendingTaskMutation.value
  if (!task || taskMutation.value)
    return
  taskMutation.value = 'archive'
  try {
    await api.admin.archiveCrawlerTask(task.id)
    success('任务已归档，历史 run、observation 和 audit 仍保留。')
    await loadTaskPanel()
    await loadTaskAudit(task.id)
  }
  catch {
    taskError.value = '任务归档被拒绝。请刷新后重试。'
  }
  finally {
    pendingTaskMutation.value = null
    taskMutation.value = null
  }
}

async function confirmSupersede(): Promise<void> {
  const task = pendingTaskMutation.value
  const command = task ? supersedeCommand(task) : null
  if (!task || !command || taskMutation.value)
    return
  taskMutation.value = 'supersede'
  try {
    await api.admin.supersedeCrawlerTask(task.id, command)
    success('任务已生成新快照，正在读取历史与最新状态。')
    await loadTaskPanel()
    await loadTaskAudit(task.id)
  }
  catch {
    taskError.value = '任务 supersede 被拒绝。请检查当前任务是否仍为 active。'
  }
  finally {
    pendingTaskMutation.value = null
    taskMutation.value = null
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
  if (task.operation === 'repair_players') {
    if (!task.movie?.code || task.sameMovieIdentity === false || task.sourceRevision == null || !['succeeded', 'failed', 'cancelled'].includes(run.status))
      return null
    return `/movie/${encodeURIComponent(task.movie.code)}`
  }
  if (run.status !== 'succeeded' || !run.receipt || isRepairReceipt(run.receipt))
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
  const value = run.failureCode ?? run.failure_code ?? null
  return value && boundedFailureCodes.has(value) ? value : null
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

function askRepair(run: CrawlerRun): void {
  const task = selectedRun.value?.task
  const reason = repairReasonFor(run, task)
  const movieId = task?.movie?.id ?? repairMovieId(run)
  if (!reason || !movieId || repairAction.value || repairActionLocked(run))
    return
  pendingRepair.value = { movieId, movieTitle: task?.movie?.title ?? movieId, reason }
  repairConfirmOpen.value = true
}

async function confirmRepair(): Promise<void> {
  const target = pendingRepair.value
  if (!target || repairAction.value)
    return
  repairAction.value = true
  try {
    const response = await api.admin.repairPlayers({
      confirmed: true,
      movieId: target.movieId,
      reason: target.reason,
      targetIntent: 'restore_playable_sources',
    })
    success('已创建受控来源修复任务，正在等待读回。')
    await loadTaskPanel()
    const detail = await api.admin.getCrawlerTask(response.task.id)
    const task = detail.task ?? response.task
    taskDetails.value[task.id] = detail
    crawlerTasks.value.movie = [task, ...crawlerTasks.value.movie.filter(item => item.id !== task.id)]
    const run = latestRunFor(task)
    if (run)
      selectRun(task, run)
  }
  catch {
    taskError.value = '无法创建修复任务。请刷新页面；如果问题持续，请检查 Gateway 与本地 runner 服务。'
  }
  finally {
    pendingRepair.value = null
    repairAction.value = false
  }
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
            <p v-if="template === 'movie' && !crawlerTasks[template].length" class="task-empty repair-empty">
              <strong>暂无生产修复任务</strong>
              <span>从 no_source 或 source_failed 的影片发起生产修复，当前任务会在本页显示。</span>
            </p>
            <p v-else-if="!crawlerTasks[template].length" class="task-empty">
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
                <span v-if="task.operation === 'repair_players'" class="operation-label">repair_players</span>
                <span class="lifecycle-label" data-task-lifecycle>{{ lifecycleLabels[taskLifecycleFor(task).status] }}</span>
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

      <div v-if="selectedTask && !selectedRun" class="task-detail current-attempt-pending" aria-live="polite">
        <div class="section-heading">
          <h3>任务执行详情</h3>
          <span class="status-label">等待 attempt 上报</span>
        </div>
        <div class="identity-strip">
          <strong>{{ selectedTask.movie?.title ?? selectedTask.id }}</strong>
          <span v-if="selectedTask.movie">movie {{ selectedTask.movie.id }} · {{ selectedTask.movie.code }}</span>
          <code>{{ selectedTask.id }}</code>
          <span v-if="selectedTask.operation === 'repair_players'">repair_players</span>
          <span>source revision：{{ selectedTask.sourceRevision ?? '尚未上报' }}</span>
        </div>
        <div class="fact-grid">
          <section class="fact-block">
            <h4>Provider</h4><p>尚未上报</p>
          </section>
          <section class="fact-block">
            <h4>Lease</h4><p>等待 lease 对账</p>
          </section>
          <section class="fact-block">
            <h4>Reconciliation</h4><p>等待对账</p>
          </section>
          <section class="fact-block">
            <h4>Receipt / repair</h4><p>receipt 待验证 · 修复待校验</p>
          </section>
        </div>
      </div>
      <div v-if="selectedRun" class="task-detail">
        <div class="identity-strip" data-current-attempt-focal aria-live="polite">
          <div class="identity-title">
            <strong>{{ selectedRun.task.movie?.title ?? selectedRun.task.id }}</strong>
            <span v-if="selectedRun.task.movie">movie {{ selectedRun.task.movie.id }} · {{ selectedRun.task.movie.code }}</span>
            <span v-if="selectedRun.task.operation === 'repair_players'">repair_players</span>
          </div>
          <div class="identity-facts">
            <code>task {{ selectedRun.task.id }}</code>
            <code>run {{ selectedRun.run.id }}</code>
            <span>attempt #{{ selectedRun.run.attemptNumber ?? selectedRun.run.attempt_number ?? '尚未上报' }}</span>
            <span>content ID：{{ selectedRun.task.movie?.id ?? playbackSummaryFor(selectedRun.task, selectedRun.run)?.contentId ?? '尚未上报' }}</span>
            <span>source revision：{{ selectedRun.task.sourceRevision ?? '尚未上报' }}</span>
            <span v-if="selectedRun.run.provider?.providerRunId">provider run #{{ selectedRun.run.provider.providerRunId }}</span>
            <span v-if="selectedRun.run.provider?.providerRunAttempt">provider attempt：{{ selectedRun.run.provider.providerRunAttempt }}</span>
            <span v-if="playbackSummaryFor(selectedRun.task, selectedRun.run)?.viewer.targetLabel">target：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.viewer.targetLabel }}</span>
            <span v-if="selectedRun.task.retry" class="retry-label">任务级重试 · 当前 attempt #{{ selectedRun.task.retry.attemptNumber }}</span>
            <span v-if="selectedRun.task.sameMovieIdentity === true">同一内容身份</span>
          </div>
        </div>
        <div v-if="selectedRun.task.activeDuplicateLock?.locked" class="task-warning duplicate-lock" role="status">
          {{ selectedRun.task.activeDuplicateLock.message }}
        </div>
        <div class="section-heading">
          <h3>任务执行详情</h3>
          <span>{{ taskStatusLabels[selectedRun.run.status] }}</span>
        </div>
        <p>模板：{{ taskTemplate(selectedRun.task) === 'movie' ? '视频' : '漫画' }} · attempt {{ selectedRun.run.attemptNumber ?? selectedRun.run.attempt_number ?? '尚未上报' }}</p>
        <p v-if="runFailureCode(selectedRun.run)" class="task-warning">
          终态原因：{{ runFailureCode(selectedRun.run) }}
        </p>
        <p v-if="selectedRun.task.operation === 'repair_players'" class="task-warning">
          修复原因：{{ selectedRun.task.reason }} · source revision：{{ selectedRun.task.sourceRevision }} · 下一步：{{ repairNextActionLabels[selectedRun.task.allowedNextAction ?? 'none'] }}
        </p>
        <section class="task-lifecycle-surface" data-section="task-lifecycle" aria-labelledby="task-lifecycle-title">
          <div class="section-heading">
            <div>
              <h4 id="task-lifecycle-title">
                <GitBranch :size="16" aria-hidden="true" /> 任务生命周期
              </h4>
              <span class="fact-muted">与 run execution 独立 · version {{ taskLifecycleFor(selectedRun.task).version }}</span>
            </div>
            <span class="lifecycle-label">{{ lifecycleLabels[taskLifecycleFor(selectedRun.task).status] }}</span>
          </div>
          <div class="task-actions">
            <button
              v-if="taskLifecycleFor(selectedRun.task).status === 'active'"
              class="task-secondary"
              data-task-action="metadata"
              type="button"
              :disabled="taskMutation !== null"
              @click="openMetadataEdit(selectedRun.task)"
            >
              <Pencil :size="15" aria-hidden="true" /> 编辑元数据
            </button>
            <button
              v-if="taskLifecycleFor(selectedRun.task).status === 'active'"
              class="task-secondary task-danger"
              data-task-action="archive"
              type="button"
              :disabled="taskMutation !== null"
              @click="askArchive(selectedRun.task)"
            >
              <Archive :size="15" aria-hidden="true" /> 归档任务
            </button>
            <button
              v-if="taskLifecycleFor(selectedRun.task).status === 'active' && !isActiveRun(selectedRun.run)"
              class="task-secondary"
              data-task-action="supersede"
              type="button"
              :disabled="taskMutation !== null || !supersedeCommand(selectedRun.task)"
              @click="askSupersede(selectedRun.task)"
            >
              <GitBranch :size="15" aria-hidden="true" /> 生成新快照
            </button>
          </div>
          <form v-if="metadataEditOpen && pendingTaskMutation?.id === selectedRun.task.id" class="metadata-editor" data-task-metadata-editor @submit.prevent="saveMetadata">
            <label>
              说明
              <input v-model="metadataDescription" maxlength="256" name="description" type="text">
            </label>
            <label>
              安全意图标签
              <input v-model="metadataIntent" maxlength="128" name="intent" type="text">
            </label>
            <div class="task-actions">
              <button class="task-primary" data-task-action="metadata-save" type="submit" :disabled="taskMutation === 'metadata'">
                <Save :size="15" aria-hidden="true" /> {{ taskMutation === 'metadata' ? '保存中…' : '保存元数据' }}
              </button>
              <button class="task-secondary" type="button" :disabled="taskMutation !== null" @click="metadataEditOpen = false">
                返回
              </button>
            </div>
          </form>
        </section>
        <div v-if="selectedRun.run.status === 'failed' && runFailureCode(selectedRun.run) === 'receipt_missing'" class="task-warning">
          任务未找到可验证的入库结果，未生成内容管理链接。
        </div>
        <div v-if="selectedRun.run.status === 'cancel_requested'" class="task-warning">
          已请求取消，等待 runner 在安全检查点确认。
        </div>
        <div class="attempt-timeline" aria-label="当前 attempt 状态时间线">
          <span class="timeline-step timeline-step-current">{{ taskStatusLabels[selectedRun.run.status] }}</span>
          <span class="timeline-arrow" aria-hidden="true">→</span>
          <span class="timeline-step">{{ providerLifecycleLabel(selectedRun.run) }}</span>
          <span class="timeline-arrow" aria-hidden="true">→</span>
          <span class="timeline-step">{{ reconciliationLabel(selectedRun.run) }}</span>
          <span class="timeline-arrow" aria-hidden="true">→</span>
          <span class="timeline-step">{{ receiptFactLabel(selectedRun.run) }}</span>
        </div>
        <div class="fact-grid" data-fact-grid>
          <section class="fact-block" data-evidence-block="provider" :role="selectedRun.run.provider?.providerStatus === 'completed' && selectedRun.run.provider.providerConclusion !== 'success' ? 'alert' : undefined">
            <h4>Provider</h4>
            <p class="fact-state">
              <LoaderCircle v-if="selectedRun.run.provider?.providerStatus === 'in_progress'" :size="16" aria-hidden="true" /><CircleAlert v-else-if="selectedRun.run.provider?.providerStatus === 'completed' && selectedRun.run.provider.providerConclusion !== 'success'" :size="16" aria-hidden="true" /><CheckCircle2 v-else-if="selectedRun.run.provider" :size="16" aria-hidden="true" />{{ providerLifecycleLabel(selectedRun.run) }}
            </p>
            <span v-if="selectedRun.run.provider?.providerRunId">provider run #{{ selectedRun.run.provider.providerRunId }}</span>
            <span v-if="selectedRun.run.provider?.providerRunAttempt">provider attempt：{{ selectedRun.run.provider.providerRunAttempt }}</span>
            <span v-if="selectedRun.run.provider?.sha">SHA：{{ selectedRun.run.provider.sha }}</span>
            <a
              v-if="selectedRun.run.provider?.providerRunUrl"
              class="provider-run-link"
              :href="selectedRun.run.provider.providerRunUrl"
              rel="noreferrer"
              target="_blank"
            ><ExternalLink :size="14" aria-hidden="true" />打开 provider run #{{ selectedRun.run.provider.providerRunId }}</a>
          </section>
          <section class="fact-block">
            <h4>Lease</h4>
            <p class="fact-state">
              {{ leaseLabel(selectedRun.run) }}
            </p>
            <span v-if="selectedRun.run.lease?.expiresAt">expiresAt：{{ selectedRun.run.lease.expiresAt }}</span>
            <span v-if="selectedRun.run.lease?.lastHeartbeatAt">heartbeat：{{ selectedRun.run.lease.lastHeartbeatAt }}</span>
          </section>
          <section class="fact-block" :role="['failed', 'lost', 'conflict', 'stale'].includes(selectedRun.run.reconciliation?.outcome ?? '') ? 'alert' : undefined">
            <h4>Reconciliation</h4>
            <p class="fact-state">
              <History :size="16" aria-hidden="true" />{{ reconciliationLabel(selectedRun.run) }}
            </p>
            <span v-if="selectedRun.run.reconciliation?.windowStatus">窗口：{{ selectedRun.run.reconciliation.windowStatus }}</span>
            <span v-if="selectedRun.run.reconciliation?.observedAt">观察时间：{{ selectedRun.run.reconciliation.observedAt }}</span>
            <span v-if="selectedRun.run.reconciliation?.processedAt">处理时间：{{ selectedRun.run.reconciliation.processedAt }}</span>
          </section>
          <section class="fact-block" data-evidence-block="repair-receipt" :role="selectedRun.run.receiptValidation?.status === 'failed' ? 'alert' : undefined">
            <h4>Repair / receipt</h4>
            <p class="fact-state">
              <CheckCircle2 v-if="selectedRun.run.repair?.status === 'validated'" :size="16" aria-hidden="true" /><CircleAlert v-else-if="selectedRun.run.receiptValidation?.status === 'failed'" :size="16" aria-hidden="true" />{{ repairFactLabel(selectedRun.run) }}
            </p>
            <span>{{ receiptFactLabel(selectedRun.run) }}</span>
            <span v-if="isRepairReceipt(selectedRun.run.receipt)">receipt observedAt：{{ selectedRun.run.receipt.observedAt }}</span>
            <span v-if="isRepairReceipt(selectedRun.run.receipt)">receipt source revision：{{ selectedRun.run.receipt.sourceRevision }}</span>
            <span v-if="selectedRun.run.receiptValidation?.identityMatch !== undefined">same identity：{{ selectedRun.run.receiptValidation.identityMatch ? '是' : '否' }}</span>
            <span v-if="selectedRun.run.receiptValidation?.readbackMatch !== undefined">readback：{{ selectedRun.run.receiptValidation.readbackMatch ? '是' : '否' }}</span>
          </section>
        </div>
        <div v-if="historyRunsFor(selectedRun.task).length" class="attempt-history" :class="{ 'attempt-history-expanded': expandedHistory[selectedRun.task.id] }">
          <button class="history-toggle" type="button" :aria-expanded="expandedHistory[selectedRun.task.id] ? 'true' : 'false'" @click="toggleHistory(selectedRun.task.id)">
            <History :size="16" aria-hidden="true" />旧 attempt 历史（{{ historyRunsFor(selectedRun.task).length }}） · 全部 attempt
          </button>
          <div v-if="expandedHistory[selectedRun.task.id]" class="history-list">
            <article v-for="run in historyRunsFor(selectedRun.task)" :key="run.id" class="history-row">
              <div class="history-row-heading">
                <strong>attempt #{{ run.attemptNumber ?? run.attempt_number }}</strong>
                <code>{{ run.id }}</code>
                <span class="status-label">{{ taskStatusLabels[run.status] }}</span>
                <span class="history-outcome">{{ historyOutcomeLabel(run) }}</span>
              </div>
              <div class="history-facts">
                <span>provider：{{ providerLifecycleLabel(run) }}</span>
                <span>lease：{{ leaseLabel(run) }}</span>
                <span>reconciliation：{{ reconciliationLabel(run) }}</span>
                <span>{{ receiptFactLabel(run) }}</span>
                <span>source revision：{{ run.sourceRevision ?? selectedRun.task.sourceRevision ?? '尚未上报' }}</span>
                <span v-if="run.outcome?.code">outcome code：{{ run.outcome.code }}</span>
                <span v-if="runFailureCode(run)">failure：{{ runFailureCode(run) }}</span>
                <span v-if="playbackSummaryFor(selectedRun.task, run)">playback：{{ playbackStatusLabel(playbackSummaryFor(selectedRun.task, run)) }} · {{ playbackSummaryFor(selectedRun.task, run)!.outcome }}</span>
                <span v-for="entry in playbackHistoryEntriesFor(selectedRun.task, run)" :key="`${entry.runId}-playback-history`">
                  playback rejection：{{ entry.rejections.map(rejection => rejection.outcome).join(' · ') || '无' }}
                </span>
              </div>
            </article>
          </div>
        </div>
        <section class="availability-surface" data-evidence-section="availability" aria-labelledby="availability-title">
          <div class="section-heading">
            <div>
              <h4 id="availability-title">
                Availability current
              </h4>
              <span class="fact-muted">内容可用性与 runner execution 独立计算</span>
            </div>
            <span v-if="availabilityCurrentFor(selectedRun.task)" class="status-label">
              {{ availabilityStatusLabels[availabilityCurrentFor(selectedRun.task)!.status] }}
            </span>
          </div>
          <div v-if="availabilityCurrentFor(selectedRun.task)" class="availability-current" data-availability-current>
            <span>reason：{{ availabilityReasonLabel(availabilityCurrentFor(selectedRun.task)!.reasonCode) }}</span>
            <span>policy：{{ availabilityCurrentFor(selectedRun.task)!.policyVersion }}</span>
            <span>observedAt：{{ availabilityCurrentFor(selectedRun.task)!.observedAt }}</span>
            <span>freshness：{{ availabilityCurrentFor(selectedRun.task)!.freshness }}</span>
            <span>next action：{{ availabilityNextActionLabels[availabilityCurrentFor(selectedRun.task)!.nextAction] }}</span>
            <span>projection version：{{ availabilityCurrentFor(selectedRun.task)!.projectionVersion }}</span>
            <span>observation：{{ availabilityCurrentFor(selectedRun.task)!.observationIdentity }}</span>
            <span>target：{{ availabilityCurrentFor(selectedRun.task)!.target.kind }} / {{ availabilityCurrentFor(selectedRun.task)!.target.id }}</span>
          </div>
          <p v-else class="source-empty">
            暂无 availability current projection。
          </p>
          <div v-if="availabilityHistoryFor(selectedRun.task).length" class="availability-history" data-availability-history>
            <strong>Observation / rejection history</strong>
            <article v-for="entry in availabilityHistoryFor(selectedRun.task)" :key="`${entry.kind}-${entry.observation?.observationIdentity ?? entry.reason ?? 'empty'}`" class="availability-history-row">
              <span>{{ availabilityOutcomeLabels[entry.kind] }}</span>
              <span v-if="entry.reason">reason：{{ entry.reason }}</span>
              <span v-if="entry.observation">observation：{{ entry.observation.observationIdentity }} · {{ entry.observation.status }} · {{ entry.observation.freshness }}</span>
              <span v-if="entry.observation">observedAt：{{ entry.observation.observedAt }} · revision：{{ entry.observation.sourceRevision }}</span>
            </article>
          </div>
        </section>
        <section class="audit-surface" data-evidence-section="audit" aria-labelledby="audit-title">
          <div class="section-heading">
            <div>
              <h4 id="audit-title">
                Task audit
              </h4>
              <span class="fact-muted">创建、更新、归档、supersede、取消、重试和修复均保留摘要</span>
            </div>
          </div>
          <div v-if="taskAudits[selectedRun.task.id]?.length" class="audit-list">
            <article v-for="audit in taskAudits[selectedRun.task.id]" :key="audit.id" class="audit-row">
              <strong>{{ audit.action }} · {{ audit.outcome }}</strong>
              <span>{{ audit.reason }} · {{ audit.createdAt }}</span>
              <span v-if="audit.actor?.id">actor：{{ audit.actor.id }}</span>
              <span v-if="audit.runId">run：{{ audit.runId }}<template v-if="audit.attemptNumber"> · attempt #{{ audit.attemptNumber }}</template></span>
            </article>
            <button v-if="taskAuditCursors[selectedRun.task.id]" class="task-secondary load-more" data-task-action="audit-more" type="button" @click="loadTaskAudit(selectedRun.task.id, true)">
              加载更早审计
            </button>
          </div>
          <p v-else class="source-empty">
            暂无任务审计摘要。
          </p>
        </section>
        <div v-if="selectedRun.task.operation !== 'repair_players'" class="readiness-detail" aria-live="polite">
          <div class="readiness-identity">
            <strong>内容身份</strong>
            <span v-if="runReadiness(selectedRun.run)">primaryContentId：{{ runReadiness(selectedRun.run)!.metadata.contentId }}</span>
            <span v-else-if="receiptContentId(selectedRun.run)">primaryContentId：{{ receiptContentId(selectedRun.run) }}</span>
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
              <span v-if="selectedRun.run.receipt && !isRepairReceipt(selectedRun.run.receipt)">新增 {{ selectedRun.run.receipt.createdCount }} · 更新 {{ selectedRun.run.receipt.updatedCount }}</span>
            </section>
          </div>
          <section v-if="sourceHealthRows(selectedRun.run).length" class="source-health-block" aria-labelledby="source-health-title">
            <div class="source-health-heading">
              <div>
                <h4 id="source-health-title">
                  Source health
                </h4>
                <span v-if="isRepairReceipt(selectedRun.run.receipt)">观察时间：{{ selectedRun.run.receipt.observedAt }} · revision：{{ selectedRun.run.receipt.sourceRevision }}</span>
              </div>
            </div>
            <div class="source-health-grid">
              <article
                v-for="source in sourceHealthRows(selectedRun.run)"
                :key="`${source.sourceType}-${source.observedAt}-${source.reasonCode}`"
                :data-source-row="source.sourceType"
                class="source-health-row"
              >
                <strong>{{ sourceTypeLabel(source.sourceType) }}</strong>
                <span>{{ sourceHealthLabel(source.health) }}</span>
                <span>观察时间：{{ source.observedAt }}</span>
                <span>受控原因：{{ sourceHealthReasonLabel(source.reasonCode) }}</span>
                <span>{{ source.eligible ? 'eligible · 可作为候选' : 'ineligible · 不作为候选' }}</span>
                <button v-if="source.eligible" data-source-action type="button" class="task-secondary" disabled>
                  当前候选
                </button>
              </article>
            </div>
          </section>
          <div v-if="!runReadiness(selectedRun.run)" class="readiness-loading" role="status">
            <RefreshCw :size="16" aria-hidden="true" />状态读取中，未推导 ready 或 playback proof。
          </div>
          <div
            v-if="(selectedRun.run.receipt && selectedRun.run.status === 'succeeded') || managementPath(selectedRun.task, selectedRun.run)"
            class="readiness-actions"
          >
            <a
              v-if="managementPath(selectedRun.task, selectedRun.run) && (!runReadiness(selectedRun.run) || ['ready', 'no_source', 'source_failed'].includes(runReadiness(selectedRun.run)!.source.disposition))"
              class="task-secondary readiness-link"
              :href="managementPath(selectedRun.task, selectedRun.run)!"
            >
              {{ managementLabel(selectedRun.task, selectedRun.run) }}
            </a>
            <template v-if="selectedRun.run.receipt && selectedRun.run.status === 'succeeded'">
              <button
                v-if="repairReasonFor(selectedRun.run, selectedRun.task)"
                data-repair-action="open"
                class="task-secondary"
                type="button"
                :disabled="repairAction || repairActionLocked(selectedRun.run)"
                @click="askRepair(selectedRun.run)"
              >
                {{ repairAction ? '创建中…' : repairActionLocked(selectedRun.run) ? '当前电影已有活动修复任务' : '发起生产修复' }}
              </button>
              <span v-if="repairActionLocked(selectedRun.run)" class="duplicate-lock-copy">当前电影已有活动修复任务，页面聚焦当前 attempt。</span>
              <button
                v-if="!runReadiness(selectedRun.run) || ['ready', 'no_source', 'source_failed'].includes(runReadiness(selectedRun.run)!.source.disposition)"
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
            </template>
          </div>
        </div>
        <div v-if="selectedRun.task.operation === 'repair_players'" class="repair-source-surface" data-evidence-block="source" aria-live="polite">
          <div class="source-surface-heading">
            <div>
              <h4>Current source projection</h4>
              <span>{{ sourceFactLabel(sourceProjectionFor(selectedRun.task, selectedRun.run)) }}</span>
            </div>
            <span v-if="selectedRun.task.allowedNextAction">下一步：{{ repairNextActionLabels[selectedRun.task.allowedNextAction] }}</span>
          </div>
          <template v-if="sourceProjectionFor(selectedRun.task, selectedRun.run)">
            <div class="source-projection-facts">
              <span>source revision：{{ sourceProjectionFor(selectedRun.task, selectedRun.run)!.sourceRevision }}</span>
              <span>observedAt：{{ sourceProjectionFor(selectedRun.task, selectedRun.run)!.observedAt }}</span>
              <span>eligible count：{{ sourceProjectionFor(selectedRun.task, selectedRun.run)!.eligibleCount }}</span>
              <span>受控原因：{{ sourceProjectionFor(selectedRun.task, selectedRun.run)!.reasonCode ?? '无' }}</span>
            </div>
            <div v-if="sourceProjectionFor(selectedRun.task, selectedRun.run)!.rows.length" class="source-health-grid">
              <article v-for="source in sourceProjectionFor(selectedRun.task, selectedRun.run)!.rows" :key="`${source.sourceType}-${source.observedAt}-${source.reasonCode}`" data-source-row class="source-health-row">
                <strong>{{ source.sourceType }}</strong>
                <span>{{ source.health }}</span>
                <span>观察时间：{{ source.observedAt }}</span>
                <span>受控原因：{{ source.reasonCode }}</span>
                <span>{{ source.eligible ? 'eligible · 可作为候选' : 'ineligible · 不作为候选' }}</span>
              </article>
            </div>
            <p v-else class="source-empty">
              暂无来源观察
            </p>
          </template>
          <p v-else class="source-empty">
            暂无来源观察 · 当前 source projection 尚未上报
          </p>
          <div v-if="sourceReadbackFor(selectedRun.task, selectedRun.run)" class="source-readback">
            <strong>Authoritative source readback</strong>
            <span>movieId：{{ sourceReadbackFor(selectedRun.task, selectedRun.run)!.movieId }}</span>
            <span>revision：{{ sourceReadbackFor(selectedRun.task, selectedRun.run)!.sourceRevision }}</span>
            <span>source count：{{ sourceReadbackFor(selectedRun.task, selectedRun.run)!.sourceCount }}</span>
            <span>eligible count：{{ sourceReadbackFor(selectedRun.task, selectedRun.run)!.eligibleCount }}</span>
          </div>
          <section
            class="fact-block actual-playback-block"
            data-evidence-block="actual-playback"
            :role="playbackSummaryFor(selectedRun.task, selectedRun.run)?.playback.status === 'failed' || playbackSummaryFor(selectedRun.task, selectedRun.run)?.playback.error ? 'alert' : 'status'"
            aria-live="polite"
          >
            <h4>Actual playback</h4>
            <p class="fact-state">
              <CheckCircle2 v-if="playbackSummaryFor(selectedRun.task, selectedRun.run)?.playback.status === 'playback_verified'" :size="16" aria-hidden="true" />
              <CircleAlert v-else-if="playbackSummaryFor(selectedRun.task, selectedRun.run)?.playback.status === 'failed'" :size="16" aria-hidden="true" />
              <CircleHelp v-else :size="16" aria-hidden="true" />
              {{ playbackStatusLabel(playbackSummaryFor(selectedRun.task, selectedRun.run)) }}
            </p>
            <template v-if="playbackSummaryFor(selectedRun.task, selectedRun.run)">
              <span>tuple：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.tuple.taskId }} / {{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.tuple.runId }} / attempt #{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.tuple.attemptNumber }} / {{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.tuple.provider }}</span>
              <span>content ID：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.contentId }} · source revision：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.sourceRevision }}</span>
              <span>Viewer path：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.viewer.path }}</span>
              <span>selected source：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.source.sourceType }} · {{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.source.status }}</span>
              <div class="evidence-event-list">
                <span v-for="event in playbackSummaryFor(selectedRun.task, selectedRun.run)!.events" :key="event.event">{{ playbackEventLabel(event) }}</span>
              </div>
              <span>currentTimeBefore：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.playback.progress.currentTimeBefore }}</span>
              <span>currentTimeAfter：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.playback.progress.currentTimeAfter }}</span>
              <span>delta：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.playback.progress.currentTimeDelta }}</span>
              <span>evidence outcome：{{ playbackOutcomeLabel(playbackSummaryFor(selectedRun.task, selectedRun.run)!.outcome) }}</span>
              <span class="artifact-status">已写入脱敏 JSON/Markdown · artifact reference：{{ playbackSummaryFor(selectedRun.task, selectedRun.run)!.artifact.reference }}</span>
            </template>
            <span v-else>等待浏览器证据</span>
            <div v-if="playbackEntryFor(selectedRun.task, selectedRun.run)?.rejections.length" class="evidence-rejection-history">
              <strong>rejection history</strong>
              <span v-for="rejection in playbackEntryFor(selectedRun.task, selectedRun.run)!.rejections" :key="`${rejection.outcome}-${rejection.observedAt}`">
                {{ rejection.outcome }} · content ID：{{ rejection.contentId }} · source revision：{{ rejection.sourceRevision }}
              </span>
            </div>
          </section>
          <div class="readiness-actions">
            <a
              v-if="managementPath(selectedRun.task, selectedRun.run)"
              class="task-secondary readiness-link"
              :href="managementPath(selectedRun.task, selectedRun.run)!"
            >
              打开影片
            </a>
            <button
              v-if="repairReasonFor(selectedRun.run, selectedRun.task) && selectedRun.task.allowedNextAction === 'create_new_task'"
              data-repair-action="open"
              class="task-primary"
              type="button"
              :disabled="repairAction || repairActionLocked(selectedRun.run)"
              @click="askRepair(selectedRun.run)"
            >
              {{ repairAction ? '提交中…' : repairActionLocked(selectedRun.run) ? '当前电影已有活动修复任务' : '发起生产修复' }}
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
  <ConfirmDialog
    v-model:open="archiveConfirmOpen"
    title="确认归档任务"
    message="归档只改变任务生命周期；run、attempt、availability observation 和审计历史继续保留。"
    confirm-text="确认归档"
    cancel-text="返回任务"
    variant="danger"
    @confirm="confirmArchive"
  />
  <ConfirmDialog
    v-model:open="supersedeConfirmOpen"
    title="确认生成新快照"
    message="将保留当前任务历史，并使用服务端允许的固定 operation、policy 和 target 生成新任务快照。"
    confirm-text="生成新快照"
    cancel-text="返回任务"
    @confirm="confirmSupersede"
  />
  <ConfirmDialog
    v-model:open="repairConfirmOpen"
    title="确认来源修复"
    :message="repairConfirmationMessage"
    confirm-text="确认恢复可播放源"
    cancel-text="返回"
    @confirm="confirmRepair"
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
.operation-label,
.retry-label,
.lifecycle-label,
.history-outcome { color: hsl(var(--primary)); font-size: 0.8rem; overflow-wrap: anywhere; }
.identity-strip { display: grid; gap: 0.5rem; margin-bottom: 1rem; border: 2px solid hsl(var(--primary)); border-radius: 0.375rem; background: hsl(var(--card)); padding: 1rem; overflow-wrap: anywhere; }
.identity-title,
.identity-facts { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.6rem; min-width: 0; }
.identity-title strong { font-size: 1.15rem; }
.identity-facts code,
.identity-facts span { overflow-wrap: anywhere; }
.current-attempt-pending .identity-strip { border-style: dashed; }
.duplicate-lock { border-left: 3px solid hsl(var(--primary)); }
.task-lifecycle-surface,
.availability-surface,
.audit-surface { display: grid; gap: 0.75rem; margin-bottom: 1rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; background: hsl(var(--card)); padding: 1rem; }
.task-lifecycle-surface h4,
.availability-surface h4,
.audit-surface h4 { display: flex; align-items: center; gap: 0.4rem; margin: 0; font-size: 0.95rem; }
.fact-muted { color: hsl(var(--muted-foreground)); font-size: 0.82rem; overflow-wrap: anywhere; }
.metadata-editor { display: grid; gap: 0.75rem; border-top: 1px solid hsl(var(--border)); padding-top: 0.75rem; }
.metadata-editor label { display: grid; gap: 0.35rem; color: hsl(var(--muted-foreground)); font-size: 0.82rem; }
.metadata-editor input { min-height: 40px; border: 1px solid hsl(var(--border)); border-radius: 0.25rem; background: hsl(var(--background)); padding: 0.5rem 0.65rem; color: hsl(var(--foreground)); }
.availability-current,
.availability-history,
.audit-list { display: grid; gap: 0.5rem; min-width: 0; }
.availability-current { grid-template-columns: repeat(2, minmax(0, 1fr)); color: hsl(var(--muted-foreground)); font-size: 0.82rem; }
.availability-current span,
.availability-history-row span,
.audit-row span { overflow-wrap: anywhere; }
.availability-history { border-top: 1px solid hsl(var(--border)); padding-top: 0.75rem; }
.availability-history-row,
.audit-row { display: grid; gap: 0.35rem; min-width: 0; border: 1px solid hsl(var(--border)); border-radius: 0.25rem; background: hsl(var(--muted)); padding: 0.65rem; color: hsl(var(--muted-foreground)); font-size: 0.82rem; }
.availability-history-row > span:first-child,
.audit-row > strong { color: hsl(var(--foreground)); }
.audit-list { max-height: 20rem; overflow: auto; }
.attempt-timeline { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-bottom: 1rem; color: hsl(var(--muted-foreground)); font-size: 0.85rem; }
.timeline-step { min-height: 32px; border: 1px solid hsl(var(--border)); border-radius: 0.25rem; padding: 0.35rem 0.5rem; overflow-wrap: anywhere; }
.timeline-step-current { border-color: hsl(var(--primary)); color: hsl(var(--foreground)); font-weight: 600; }
.timeline-arrow { color: hsl(var(--muted-foreground)); }
.fact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.fact-block { display: grid; align-content: start; gap: 0.45rem; min-width: 0; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; background: hsl(var(--card)); padding: 0.875rem; }
.fact-block h4 { margin: 0; font-size: 0.95rem; }
.fact-block p { margin: 0; }
.fact-block > span { overflow-wrap: anywhere; color: hsl(var(--muted-foreground)); font-size: 0.82rem; }
.fact-state { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; overflow-wrap: anywhere; }
.provider-run-link { display: inline-flex; align-items: center; gap: 0.35rem; min-height: 44px; width: fit-content; max-width: 100%; color: hsl(var(--primary)); overflow-wrap: anywhere; }
.attempt-history { margin: 1rem 0; border-top: 1px solid hsl(var(--border)); padding-top: 0.75rem; }
.history-toggle { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; background: hsl(var(--secondary)); padding: 0.5rem 0.75rem; cursor: pointer; }
.history-list { display: grid; gap: 0.6rem; max-height: 28rem; overflow: auto; margin-top: 0.75rem; padding-right: 0.25rem; }
.history-row { display: grid; gap: 0.5rem; min-width: 0; border: 1px solid hsl(var(--border)); border-radius: 0.25rem; background: hsl(var(--muted)); padding: 0.75rem; }
.history-row-heading,
.history-facts { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; min-width: 0; overflow-wrap: anywhere; }
.history-facts { color: hsl(var(--muted-foreground)); font-size: 0.82rem; }
.repair-source-surface { display: grid; gap: 0.85rem; margin-bottom: 1rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; background: hsl(var(--card)); padding: 1rem; }
.source-surface-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.75rem; }
.source-surface-heading h4 { margin: 0; font-size: 1rem; }
.source-surface-heading span { color: hsl(var(--muted-foreground)); font-size: 0.82rem; overflow-wrap: anywhere; }
.source-projection-facts,
.source-readback { display: flex; flex-wrap: wrap; gap: 0.75rem; color: hsl(var(--muted-foreground)); font-size: 0.82rem; overflow-wrap: anywhere; }
.source-readback { border-top: 1px solid hsl(var(--border)); padding-top: 0.75rem; }
.source-readback strong { color: hsl(var(--foreground)); }
.source-empty { margin: 0; color: hsl(var(--muted-foreground)); }
.playback-boundary { display: flex; align-items: center; gap: 0.4rem; color: hsl(var(--muted-foreground)); font-weight: 600; }
.actual-playback-block { margin-top: 0.75rem; }
.evidence-event-list,
.evidence-rejection-history { display: grid; gap: 0.35rem; color: hsl(var(--muted-foreground)); font-size: 0.82rem; overflow-wrap: anywhere; }
.evidence-rejection-history { border-top: 1px solid hsl(var(--border)); padding-top: 0.65rem; }
.artifact-status { overflow-wrap: anywhere; }
.duplicate-lock-copy { color: hsl(var(--muted-foreground)); font-size: 0.82rem; overflow-wrap: anywhere; }

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
.source-health-block { display: grid; gap: 0.75rem; margin-top: 1rem; border-top: 1px solid hsl(var(--border)); padding-top: 1rem; }
.source-health-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.75rem; }
.source-health-heading h4 { margin: 0; font-size: 0.95rem; font-weight: 600; }
.source-health-heading span { color: hsl(var(--muted-foreground)); font-size: 0.8rem; }
.bounded-next-action { color: hsl(var(--primary)) !important; font-weight: 600; }
.source-health-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.source-health-row { display: grid; gap: 0.35rem; min-width: 0; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; padding: 0.75rem; font-size: 0.8rem; }
.source-health-row span { overflow-wrap: anywhere; }
.safe-log-scroller { max-height: 448px; overflow: auto; border-radius: 0.375rem; background: hsl(var(--muted)); padding: 0.75rem; }
.safe-log-row { display: grid; grid-template-columns: auto auto auto minmax(0, 10rem) minmax(0, 1fr); gap: 0.5rem; align-items: start; padding: 0.5rem 0; border-bottom: 1px solid hsl(var(--border)); font-size: 0.875rem; }
.safe-log-row span { overflow-wrap: anywhere; }
.safe-log-row code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.load-more { display: block; margin: 0.75rem auto 0; }
.task-empty { padding: 1.5rem; color: hsl(var(--muted-foreground)); text-align: center; }

@media (max-width: 1023px) {
  .task-grid,
  .task-history-grid,
  .fact-grid,
  .readiness-grid,
  .source-health-grid,
  .availability-current { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
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
