<script setup lang="ts">
import type { QuantAiCandidateBriefing, QuantAiCandidateBriefingQuestion, QuantAiCandidateBriefingSession } from '../lib/quant-types'
import { AlertCircle, BrainCircuit, Check, CircleHelp, Copy, Download, RefreshCw, Trash2, X } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { quantApi, QuantApiError } from '../lib/api-client'
import { buildCandidateAiSessionFilename, buildCandidateAiSessionMarkdown } from '../lib/candidate-briefing-export'
import { copyResearchReportMarkdown } from '../lib/research-report-copy'

type CopyOutcome = 'success' | 'error' | null

const props = withDefaults(defineProps<{
  briefing: QuantAiCandidateBriefing | null
  candidateCount: number
  filteredCandidateCount: number
  briefingAvailableCandidateCount: number
  briefingCandidateCount?: number | null
  currentScopeKey?: string
  currentSnapshotId?: string | null
  currentCandidateCodes?: string[]
  historyResetKey?: number
  available?: boolean
  loading: boolean
  errorMessage: string | null
  configurationError: boolean
  questionInput?: string
  questionResult?: QuantAiCandidateBriefingQuestion | null
  questionLoading?: boolean
  questionErrorMessage?: string | null
  questionConfigurationError?: boolean
  sessionHistory?: QuantAiCandidateBriefingSession[] | null
  sessionHistoryErrorMessage?: string | null
  copying?: boolean
  copyOutcome?: CopyOutcome
  copyMessage?: string
}>(), {
  available: true,
  briefingCandidateCount: null,
  currentScopeKey: '',
  currentSnapshotId: null,
  currentCandidateCodes: () => [],
  historyResetKey: 0,
  questionInput: '',
  questionResult: null,
  questionLoading: false,
  questionErrorMessage: null,
  questionConfigurationError: false,
  sessionHistoryErrorMessage: null,
  copying: false,
  copyOutcome: null,
  copyMessage: '',
})

const emit = defineEmits<{
  'generate': []
  'openSettings': []
  'focusCandidate': [tsCode: string]
  'update:questionInput': [value: string]
  'askQuestion': [question: string]
  'copy': []
  'export': []
  'sessionDeleted': [sessionId: string]
}>()

const hasCandidates = computed(() => props.candidateCount > 0)
const hasFilteredCandidates = computed(() => props.filteredCandidateCount > 0)
const hasBriefingCandidates = computed(() => props.briefingAvailableCandidateCount > 0)
const canGenerate = computed(() => props.available !== false && hasFilteredCandidates.value && hasBriefingCandidates.value)
const canAskQuestion = computed(() => props.available !== false && hasBriefingCandidates.value && Boolean(props.questionInput.trim()) && !props.questionLoading)
const canUseQuestionPrompt = computed(() => props.available !== false && hasBriefingCandidates.value && !props.questionLoading)
const showBriefingActions = computed(() => Boolean(props.briefing && !props.loading && !props.errorMessage))
const visibleFocusItems = computed(() => props.briefing?.focusItems.slice(0, 5) || [])
const visibleNextChecks = computed(() => props.briefing?.nextChecks.slice(0, 6) || [])
const currentCandidateCodeSet = computed(() => new Set(props.currentCandidateCodes))
const loadedSessionHistory = ref<QuantAiCandidateBriefingSession[]>([])
const historyLoading = ref(false)
const historyErrorMessage = ref<string | null>(null)
const historyOpen = ref(true)
const selectedHistorySession = ref<QuantAiCandidateBriefingSession | null>(null)
const historyDetailLoading = ref(false)
const historyDetailErrorMessage = ref<string | null>(null)
const historyExporting = ref(false)
const historyExportErrorMessage = ref<string | null>(null)
const historyCopying = ref(false)
const historyCopyOutcome = ref<CopyOutcome>(null)
const historyCopyMessage = ref('')
const historyListRequestId = ref(0)
const historyRequestId = ref(0)
const historyCopyRequestId = ref(0)
const historyDeleteRequestId = ref(0)
const questionInputElement = ref<HTMLTextAreaElement | null>(null)
const deleteConfirmSessionId = ref<string | null>(null)
const deletingSessionId = ref<string | null>(null)
const sessionDeleteTargetId = ref<string | null>(null)
const sessionDeleteErrorMessage = ref<string | null>(null)
const sessionDeleteSuccessMessage = ref<string | null>(null)
const hiddenSessionIds = ref<Set<string>>(new Set())
const visibleSessionHistory = computed(() => {
  const sessions = props.sessionHistory ?? loadedSessionHistory.value
  return sessions.filter(session => !hiddenSessionIds.value.has(session.id))
})
const visibleHistoryError = computed(() => props.sessionHistoryErrorMessage ?? historyErrorMessage.value)

const generateButtonLabel = computed(() => {
  if (props.loading)
    return '生成中'
  if (!hasCandidates.value)
    return '暂无候选'
  if (!hasFilteredCandidates.value)
    return '暂无筛选候选'
  if (!hasBriefingCandidates.value)
    return '暂无快照候选'
  if (!canGenerate.value)
    return '快照未就绪'
  return props.briefing ? '重新生成简报' : '生成 AI 简报'
})

function priorityLabel(level: string): string {
  return {
    urgent: '紧急',
    high: '高优先',
    normal: '常规',
    low: '低优先',
  }[level] || level || '未标记'
}

function priorityClass(level: string): string {
  const normalized = ['urgent', 'high', 'normal', 'low'].includes(level) ? level : 'normal'
  return `quant-ai-briefing-priority-${normalized}`
}

function formatScore(score: number): string {
  return Number.isFinite(score) ? `${score.toFixed(1)} 分` : '--'
}

function formatDate(value: string): string {
  if (!value)
    return '时间未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  if (/^\d{8}$/u.test(compact))
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  return value.slice(0, 10)
}

function focusCandidate(tsCode: string): void {
  emit('focusCandidate', tsCode)
}

function isCurrentCandidateCode(tsCode: string): boolean {
  return currentCandidateCodeSet.value.has(tsCode)
}

function focusHistoricalCandidate(tsCode: string): void {
  if (isCurrentCandidateCode(tsCode))
    focusCandidate(tsCode)
}

function resetHistoryTransferState(): void {
  historyCopyRequestId.value++
  historyExporting.value = false
  historyExportErrorMessage.value = null
  historyCopying.value = false
  historyCopyOutcome.value = null
  historyCopyMessage.value = ''
}

function submitQuestion(): void {
  if (canAskQuestion.value)
    emit('askQuestion', props.questionInput.trim())
}

function questionPromptForNextCheck(check: string): string {
  return `围绕“${check.trim()}”，当前候选范围内有哪些确定性事实需要优先核对？`.slice(0, 500)
}

function questionPromptForFocusItem(item: QuantAiCandidateBriefing['focusItems'][number]): string {
  const candidateCode = item.tsCode.trim()
  const candidateName = item.name?.trim()
  const prefix = '请基于“'
  const suffix = '”的当前候选事实，说明其研究优先级依据和下一项核对内容。'
  const codeSuffix = candidateName ? `（${candidateCode}）` : ''
  const maxNameLength = Math.max(0, 500 - prefix.length - suffix.length - candidateCode.length - codeSuffix.length)
  const boundedName = candidateName?.slice(0, maxNameLength)
  const candidateLabel = boundedName ? `${boundedName}${codeSuffix}` : candidateCode
  return `${prefix}${candidateLabel}${suffix}`
}

function useQuestionPrompt(prompt: string): void {
  if (!canUseQuestionPrompt.value)
    return
  const normalized = prompt.trim().slice(0, 500)
  if (!normalized)
    return
  emit('update:questionInput', normalized)
  void nextTick(() => questionInputElement.value?.focus())
}

defineExpose({ useQuestionPrompt })

function historyError(error: unknown): string {
  if (error instanceof QuantApiError || error instanceof Error)
    return error.message
  return '最近会话加载失败，请稍后重试'
}

async function loadSessionHistory(): Promise<void> {
  if (props.sessionHistory !== undefined)
    return
  const requestId = historyListRequestId.value + 1
  historyListRequestId.value = requestId
  historyLoading.value = true
  historyErrorMessage.value = null
  try {
    const result = await quantApi.getCandidateAiSessions(5)
    if (historyListRequestId.value === requestId) {
      loadedSessionHistory.value = result.items
      const resultIds = new Set(result.items.map(session => session.id))
      hiddenSessionIds.value = new Set([...hiddenSessionIds.value].filter(id => resultIds.has(id)))
    }
  }
  catch (error) {
    if (historyListRequestId.value === requestId)
      historyErrorMessage.value = historyError(error)
  }
  finally {
    if (historyListRequestId.value === requestId)
      historyLoading.value = false
  }
}

async function viewHistory(session: QuantAiCandidateBriefingSession): Promise<void> {
  historyOpen.value = true
  resetHistoryTransferState()
  selectedHistorySession.value = session
  historyDetailErrorMessage.value = null
  if (props.sessionHistory !== undefined)
    return
  const requestId = historyRequestId.value + 1
  historyRequestId.value = requestId
  historyDetailLoading.value = true
  try {
    const detail = await quantApi.getCandidateAiSession(session.id)
    if (historyRequestId.value === requestId)
      selectedHistorySession.value = detail
  }
  catch (error) {
    if (historyRequestId.value === requestId)
      historyDetailErrorMessage.value = historyError(error)
  }
  finally {
    if (historyRequestId.value === requestId)
      historyDetailLoading.value = false
  }
}

function exportSelectedHistorySession(): void {
  const session = selectedHistorySession.value
  if (!session || historyDetailLoading.value || historyExporting.value)
    return

  historyExporting.value = true
  historyExportErrorMessage.value = null
  try {
    const blob = new Blob([buildCandidateAiSessionMarkdown(session)], { type: 'text/markdown;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = buildCandidateAiSessionFilename(session)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }
  catch {
    historyExportErrorMessage.value = '历史会话导出失败，请稍后重试'
  }
  finally {
    historyExporting.value = false
  }
}

async function copySelectedHistorySession(): Promise<void> {
  const session = selectedHistorySession.value
  if (!session || historyDetailLoading.value || historyCopying.value)
    return

  const requestId = historyCopyRequestId.value + 1
  historyCopyRequestId.value = requestId
  historyCopying.value = true
  historyExportErrorMessage.value = null
  historyCopyOutcome.value = null
  historyCopyMessage.value = ''
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  const result = await copyResearchReportMarkdown(buildCandidateAiSessionMarkdown(session), clipboard)
  if (requestId !== historyCopyRequestId.value)
    return

  historyCopying.value = false
  if (result === 'copied') {
    historyCopyOutcome.value = 'success'
    historyCopyMessage.value = '历史 Markdown 已复制到剪贴板'
  }
  else if (result === 'unavailable') {
    historyCopyOutcome.value = 'error'
    historyCopyMessage.value = '当前浏览器不支持剪贴板写入'
  }
  else {
    historyCopyOutcome.value = 'error'
    historyCopyMessage.value = '历史会话复制失败，请检查剪贴板权限后重试'
  }
}

function beginSessionDeletion(sessionId: string): void {
  if (deletingSessionId.value)
    return
  sessionDeleteTargetId.value = sessionId
  sessionDeleteErrorMessage.value = null
  sessionDeleteSuccessMessage.value = null
  deleteConfirmSessionId.value = deleteConfirmSessionId.value === sessionId ? null : sessionId
}

function cancelSessionDeletion(): void {
  if (deletingSessionId.value)
    return
  deleteConfirmSessionId.value = null
  sessionDeleteTargetId.value = null
  sessionDeleteErrorMessage.value = null
}

function retrySessionDeletion(): void {
  if (sessionDeleteTargetId.value)
    void deleteSession(sessionDeleteTargetId.value)
}

async function deleteSession(sessionId: string): Promise<void> {
  if (deletingSessionId.value)
    return
  const requestId = historyDeleteRequestId.value + 1
  historyDeleteRequestId.value = requestId
  deletingSessionId.value = sessionId
  deleteConfirmSessionId.value = null
  sessionDeleteTargetId.value = sessionId
  sessionDeleteErrorMessage.value = null
  sessionDeleteSuccessMessage.value = null
  try {
    await quantApi.deleteCandidateAiSession(sessionId)
    if (historyDeleteRequestId.value !== requestId)
      return
    hiddenSessionIds.value = new Set([...hiddenSessionIds.value, sessionId])
    loadedSessionHistory.value = loadedSessionHistory.value.filter(session => session.id !== sessionId)
    if (selectedHistorySession.value?.id === sessionId) {
      selectedHistorySession.value = null
      historyDetailErrorMessage.value = null
      historyDetailLoading.value = false
      historyRequestId.value++
      resetHistoryTransferState()
    }
    sessionDeleteTargetId.value = null
    sessionDeleteSuccessMessage.value = '候选 AI 会话已删除'
    emit('sessionDeleted', sessionId)
    if (props.sessionHistory === undefined)
      await loadSessionHistory()
  }
  catch (error) {
    if (historyDeleteRequestId.value === requestId) {
      sessionDeleteErrorMessage.value = historyError(error)
      deleteConfirmSessionId.value = sessionId
    }
  }
  finally {
    if (historyDeleteRequestId.value === requestId)
      deletingSessionId.value = null
  }
}

function formatSessionRange(session: QuantAiCandidateBriefingSession): string {
  if (session.fromDate && session.toDate)
    return `${formatDate(session.fromDate)} ~ ${formatDate(session.toDate)}`
  if (session.fromDate || session.toDate)
    return formatDate(session.fromDate || session.toDate || '')
  return '日期范围未记录'
}

function sessionSnapshotDate(session: QuantAiCandidateBriefingSession): string {
  return formatDate(session.snapshotGeneratedAt || session.updatedAt || session.createdAt)
}

function sessionTitle(session: QuantAiCandidateBriefingSession): string {
  return `${sessionSnapshotDate(session)} · ${session.candidateCodes.length} 个候选`
}

onMounted(() => {
  void loadSessionHistory()
})

watch(() => [props.briefing?.sessionId, props.questionResult?.sessionId], () => {
  if (props.sessionHistory === undefined)
    void loadSessionHistory()
})

watch(() => [props.currentScopeKey, props.currentSnapshotId, props.historyResetKey], () => {
  selectedHistorySession.value = null
  historyDetailErrorMessage.value = null
  historyDetailLoading.value = false
  resetHistoryTransferState()
  deleteConfirmSessionId.value = null
  deletingSessionId.value = null
  sessionDeleteTargetId.value = null
  sessionDeleteErrorMessage.value = null
  sessionDeleteSuccessMessage.value = null
  hiddenSessionIds.value = new Set()
  historyListRequestId.value++
  historyRequestId.value++
  historyDeleteRequestId.value++
})
</script>

<template>
  <section
    class="quant-ai-briefing-panel quant-ai-briefing-responsive"
    aria-labelledby="quant-ai-briefing-title"
    :aria-busy="loading"
  >
    <div class="quant-ai-briefing-heading">
      <div class="quant-ai-briefing-heading-copy">
        <p class="section-kicker">
          CANDIDATE BRIEFING
        </p>
        <h3 id="quant-ai-briefing-title">
          AI 候选简报
        </h3>
        <small>只解释当前候选的确定性研究事实，不改变排序、评分或研究动作</small>
      </div>
      <div class="quant-ai-briefing-actions">
        <button
          class="secondary-button quant-ai-briefing-generate"
          type="button"
          :disabled="loading || !canGenerate"
          title="基于当前候选研究事实生成 AI 简报"
          @click="emit('generate')"
        >
          <RefreshCw v-if="loading" :size="14" class="animate-spin" aria-hidden="true" />
          <BrainCircuit v-else :size="14" aria-hidden="true" />
          {{ generateButtonLabel }}
        </button>
        <template v-if="showBriefingActions">
          <button
            class="secondary-button quant-ai-briefing-export"
            type="button"
            title="将当前候选简报下载为 Markdown 文件"
            aria-label="导出候选 AI 简报为 Markdown 文件"
            @click="emit('export')"
          >
            <Download :size="14" aria-hidden="true" />
            导出 Markdown
          </button>
          <button
            class="secondary-button quant-ai-briefing-copy"
            type="button"
            :disabled="copying"
            title="将当前候选简报复制到剪贴板"
            aria-label="复制候选 AI 简报 Markdown"
            @click="emit('copy')"
          >
            <Copy :size="14" aria-hidden="true" />
            {{ copying ? '复制中' : '复制 Markdown' }}
          </button>
        </template>
      </div>
    </div>

    <div class="quant-ai-briefing-scope quant-ai-briefing-wrap-anywhere" aria-label="候选简报范围">
      <span>当前筛选 <strong>{{ filteredCandidateCount }}</strong> 个</span>
      <span>观察池 <strong>{{ candidateCount }}</strong> 个</span>
      <span>可生成范围 <strong>{{ briefingAvailableCandidateCount }}</strong> 个</span>
      <span v-if="briefingCandidateCount !== null">本次简报 <strong>{{ briefingCandidateCount }}</strong> 个</span>
      <span v-if="briefing">版本 {{ briefing.briefingVersion }}</span>
      <span v-if="briefing">{{ briefing.provider }} · {{ briefing.model }} · {{ formatDate(briefing.generatedAt) }}</span>
    </div>

    <section class="quant-ai-briefing-history" aria-labelledby="quant-ai-briefing-history-title">
      <div class="quant-ai-briefing-section-heading">
        <div>
          <span id="quant-ai-briefing-history-title" class="quant-ai-briefing-label">最近会话</span>
          <small>保留历史快照和 AI 内容，只读查看，不改变当前候选范围</small>
        </div>
        <button
          class="text-button quant-ai-briefing-history-toggle"
          type="button"
          :aria-expanded="historyOpen"
          @click="historyOpen = !historyOpen"
        >
          {{ historyOpen ? '收起历史' : '查看历史' }}
        </button>
      </div>
      <div v-if="sessionDeleteSuccessMessage" class="quant-ai-briefing-history-state quant-ai-briefing-history-delete-success" role="status">
        <Check :size="14" aria-hidden="true" />
        {{ sessionDeleteSuccessMessage }}
      </div>
      <div v-if="historyOpen" class="quant-ai-briefing-history-body">
        <div v-if="historyLoading" class="quant-ai-briefing-history-state" role="status">
          <RefreshCw :size="14" class="animate-spin" aria-hidden="true" />
          正在加载最近会话
        </div>
        <div v-else-if="visibleHistoryError" class="quant-ai-briefing-history-state quant-ai-briefing-history-state-error" role="alert">
          <AlertCircle :size="14" aria-hidden="true" />
          <span class="quant-ai-briefing-wrap-anywhere">{{ visibleHistoryError }}</span>
          <button class="text-button" type="button" @click="loadSessionHistory">
            重试
          </button>
        </div>
        <div v-else-if="!visibleSessionHistory.length" class="quant-ai-briefing-history-state" role="status">
          <CircleHelp :size="14" aria-hidden="true" />
          暂无已保存的候选 AI 会话
        </div>
        <div v-else class="quant-ai-briefing-history-list">
          <div
            v-for="session in visibleSessionHistory"
            :key="session.id"
            class="quant-ai-briefing-history-row"
            :class="{ 'quant-ai-briefing-history-row-active': selectedHistorySession?.id === session.id }"
            :aria-busy="deletingSessionId === session.id"
          >
            <button
              class="quant-ai-briefing-history-item"
              :class="{ 'quant-ai-briefing-history-item-active': selectedHistorySession?.id === session.id }"
              type="button"
              @click="viewHistory(session)"
            >
              <span class="quant-ai-briefing-history-item-heading">
                <strong>{{ sessionTitle(session) }}</strong>
                <span class="quant-ai-briefing-history-badge">历史 · 查看历史</span>
              </span>
              <span class="quant-ai-briefing-history-item-meta quant-ai-briefing-wrap-anywhere">
                快照 {{ sessionSnapshotDate(session) }} · 范围 {{ formatSessionRange(session) }} · {{ session.scopeKey }}
              </span>
            </button>
            <div class="quant-ai-briefing-history-item-actions">
              <button
                class="quant-ai-briefing-history-delete"
                type="button"
                aria-label="删除候选 AI 会话"
                title="删除候选 AI 会话"
                :disabled="deletingSessionId !== null"
                @click.stop="beginSessionDeletion(session.id)"
              >
                <RefreshCw v-if="deletingSessionId === session.id" :size="14" class="animate-spin" aria-hidden="true" />
                <Trash2 v-else :size="14" aria-hidden="true" />
              </button>
              <div v-if="deleteConfirmSessionId === session.id" class="quant-ai-briefing-history-delete-confirm" role="group" aria-label="确认删除候选 AI 会话">
                <span>确认删除？</span>
                <button
                  class="text-button quant-ai-briefing-history-delete-confirm-action"
                  type="button"
                  :disabled="deletingSessionId !== null"
                  @click.stop="deleteSession(session.id)"
                >
                  <Check :size="13" aria-hidden="true" />
                  确认
                </button>
                <button
                  class="text-button quant-ai-briefing-history-delete-cancel-action"
                  type="button"
                  :disabled="deletingSessionId !== null"
                  @click.stop="cancelSessionDeletion"
                >
                  <X :size="13" aria-hidden="true" />
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="sessionDeleteErrorMessage" class="quant-ai-briefing-history-state quant-ai-briefing-history-state-error" role="alert">
          <AlertCircle :size="14" aria-hidden="true" />
          <span class="quant-ai-briefing-wrap-anywhere">{{ sessionDeleteErrorMessage }}</span>
          <button class="text-button" type="button" :disabled="deletingSessionId !== null" @click="retrySessionDeletion">
            重试删除
          </button>
        </div>

        <div v-if="selectedHistorySession" class="quant-ai-briefing-history-detail">
          <div class="quant-ai-briefing-section-heading">
            <div>
              <span class="quant-ai-briefing-label">历史会话只读恢复</span>
              <small v-if="historyDetailLoading">正在读取详情</small>
              <small v-else>更新于 {{ formatDate(selectedHistorySession.updatedAt) }}</small>
            </div>
            <div class="quant-ai-briefing-history-detail-actions">
              <button
                class="secondary-button quant-ai-briefing-history-detail-action quant-ai-briefing-history-export"
                type="button"
                :disabled="historyDetailLoading || historyExporting"
                title="将选中的历史候选 AI 会话下载为 Markdown 文件"
                aria-label="导出选中的历史候选 AI 会话为 Markdown 文件"
                @click="exportSelectedHistorySession"
              >
                <Download :size="14" aria-hidden="true" />
                {{ historyExporting ? '导出中' : '导出 Markdown' }}
              </button>
              <button
                class="secondary-button quant-ai-briefing-history-detail-action quant-ai-briefing-history-copy"
                type="button"
                :disabled="historyDetailLoading || historyCopying"
                title="将选中的历史候选 AI 会话复制到剪贴板"
                aria-label="复制选中的历史候选 AI 会话 Markdown"
                @click="copySelectedHistorySession"
              >
                <Copy :size="14" aria-hidden="true" />
                {{ historyCopying ? '复制中' : '复制 Markdown' }}
              </button>
            </div>
          </div>
          <p v-if="historyExportErrorMessage" class="quant-ai-briefing-history-transfer-message quant-ai-briefing-history-transfer-message-error" role="alert">
            {{ historyExportErrorMessage }}
          </p>
          <p v-else-if="historyCopyMessage" class="quant-ai-briefing-history-transfer-message" :class="{ 'quant-ai-briefing-history-transfer-message-error': historyCopyOutcome === 'error' }" role="status">
            {{ historyCopyMessage }}
          </p>
          <div class="quant-ai-briefing-history-metadata quant-ai-briefing-wrap-anywhere">
            <span>快照时间 <strong>{{ sessionSnapshotDate(selectedHistorySession) }}</strong></span>
            <span>范围 <strong>{{ formatSessionRange(selectedHistorySession) }}</strong></span>
            <span>历史候选 <strong>{{ selectedHistorySession.candidateCodes.length }} 个</strong></span>
            <span>scopeKey <code>{{ selectedHistorySession.scopeKey }}</code></span>
          </div>
          <div v-if="selectedHistorySession.candidateCodes.length" class="quant-ai-briefing-history-candidates">
            <span class="quant-ai-briefing-history-sub-label">历史候选代码</span>
            <div class="quant-ai-briefing-history-code-list">
              <template v-for="tsCode in selectedHistorySession.candidateCodes" :key="`history-candidate-${tsCode}`">
                <button
                  v-if="isCurrentCandidateCode(tsCode)"
                  class="quant-ai-briefing-history-code-action quant-ai-briefing-wrap-anywhere"
                  type="button"
                  :aria-label="`打开历史候选 ${tsCode} 的当前详情`"
                  @click="focusHistoricalCandidate(tsCode)"
                >
                  <code>{{ tsCode }}</code>
                  <span>打开当前详情</span>
                </button>
                <span
                  v-else
                  class="quant-ai-briefing-history-code-stale quant-ai-briefing-wrap-anywhere"
                  :title="`${tsCode} 已不在当前候选快照中`"
                >
                  <code>{{ tsCode }}</code>
                  <span>当前不可用</span>
                </span>
              </template>
            </div>
          </div>
          <p
            v-if="historyDetailErrorMessage"
            class="quant-ai-briefing-history-detail-error"
            role="alert"
          >
            {{ historyDetailErrorMessage }}
          </p>
          <div v-if="selectedHistorySession.briefing" class="quant-ai-briefing-history-briefing">
            <span class="quant-ai-briefing-label">历史简报</span>
            <p class="quant-ai-briefing-wrap-anywhere">
              {{ selectedHistorySession.briefing.overview }}
            </p>
            <small>{{ selectedHistorySession.briefing.provider }} · {{ selectedHistorySession.briefing.model }} · {{ formatDate(selectedHistorySession.briefing.generatedAt) }}</small>
            <div v-if="selectedHistorySession.briefing.focusItems.length" class="quant-ai-briefing-history-focus-list">
              <span class="quant-ai-briefing-history-sub-label">重点候选</span>
              <div v-for="item in selectedHistorySession.briefing.focusItems" :key="item.tsCode" class="quant-ai-briefing-history-focus-item">
                <button
                  v-if="isCurrentCandidateCode(item.tsCode)"
                  class="quant-ai-briefing-history-focus-action"
                  type="button"
                  :aria-label="`打开历史重点候选 ${item.name || item.tsCode}（${item.tsCode}）当前详情`"
                  @click="focusHistoricalCandidate(item.tsCode)"
                >
                  <strong>{{ item.name || item.tsCode }}</strong>
                  <span>{{ item.tsCode }} · {{ formatScore(item.priorityScore) }} · {{ item.actionLabel }}</span>
                </button>
                <span v-else class="quant-ai-briefing-history-focus-stale" :title="`${item.tsCode} 已不在当前候选快照中`">
                  <strong>{{ item.name || item.tsCode }}</strong>
                  <span>{{ item.tsCode }} · {{ formatScore(item.priorityScore) }} · {{ item.actionLabel }} · 当前不可用</span>
                </span>
                <p class="quant-ai-briefing-wrap-anywhere">
                  {{ item.explanation }}
                </p>
              </div>
            </div>
            <div v-if="selectedHistorySession.briefing.nextChecks.length" class="quant-ai-briefing-history-next-checks">
              <span class="quant-ai-briefing-history-sub-label">下一步核对</span>
              <ul>
                <li v-for="check in selectedHistorySession.briefing.nextChecks" :key="check" class="quant-ai-briefing-wrap-anywhere">
                  {{ check }}
                </li>
              </ul>
            </div>
            <div v-if="selectedHistorySession.briefing.citedCandidateCodes.length" class="quant-ai-briefing-history-citations">
              <span class="quant-ai-briefing-history-sub-label">引用候选代码</span>
              <div class="quant-ai-briefing-history-code-list">
                <template v-for="tsCode in selectedHistorySession.briefing.citedCandidateCodes" :key="`history-briefing-citation-${tsCode}`">
                  <button
                    v-if="isCurrentCandidateCode(tsCode)"
                    class="quant-ai-briefing-history-code-action quant-ai-briefing-wrap-anywhere"
                    type="button"
                    :aria-label="`打开历史简报引用候选 ${tsCode} 当前详情`"
                    @click="focusHistoricalCandidate(tsCode)"
                  >
                    <code>{{ tsCode }}</code>
                    <span>回看候选</span>
                  </button>
                  <span
                    v-else
                    class="quant-ai-briefing-history-code-stale quant-ai-briefing-wrap-anywhere"
                    :title="`${tsCode} 已不在当前候选快照中`"
                  >
                    <code>{{ tsCode }}</code>
                    <span>当前不可用</span>
                  </span>
                </template>
              </div>
            </div>
          </div>
          <div v-if="selectedHistorySession.questions.length" class="quant-ai-briefing-history-questions">
            <span class="quant-ai-briefing-label">历史追问</span>
            <article v-for="question in selectedHistorySession.questions" :key="`${question.question}-${question.generatedAt}`" class="quant-ai-briefing-history-question">
              <div class="quant-ai-briefing-history-question-heading">
                <strong class="quant-ai-briefing-wrap-anywhere">{{ question.question }}</strong>
                <button
                  class="text-button quant-ai-briefing-history-reuse-question"
                  type="button"
                  :disabled="!canUseQuestionPrompt"
                  :aria-label="`将历史追问带入当前问题：${question.question}`"
                  title="将历史追问带入当前问题框"
                  @click="useQuestionPrompt(question.question)"
                >
                  <BrainCircuit :size="13" aria-hidden="true" />
                  再次追问
                </button>
              </div>
              <p class="quant-ai-briefing-wrap-anywhere">
                {{ question.answer }}
              </p>
              <small class="quant-ai-briefing-history-question-citations">
                <span>引用</span>
                <template v-if="question.citedCandidateCodes.length">
                  <template v-for="tsCode in question.citedCandidateCodes" :key="`history-question-citation-${question.generatedAt}-${tsCode}`">
                    <button
                      v-if="isCurrentCandidateCode(tsCode)"
                      class="quant-ai-briefing-history-code-action quant-ai-briefing-wrap-anywhere"
                      type="button"
                      :aria-label="`打开历史追问引用候选 ${tsCode} 当前详情`"
                      @click="focusHistoricalCandidate(tsCode)"
                    >
                      <code>{{ tsCode }}</code>
                    </button>
                    <span
                      v-else
                      class="quant-ai-briefing-history-code-stale quant-ai-briefing-wrap-anywhere"
                      :title="`${tsCode} 已不在当前候选快照中`"
                    >
                      <code>{{ tsCode }}</code>
                    </span>
                  </template>
                </template>
                <span v-else>无</span>
                <span>· {{ formatDate(question.generatedAt) }}</span>
              </small>
            </article>
          </div>
          <span v-if="!selectedHistorySession.briefing && !selectedHistorySession.questions.length" class="quant-ai-briefing-empty">
            <CircleHelp :size="13" aria-hidden="true" />
            该历史会话尚未保存简报或追问
          </span>
        </div>
      </div>
    </section>

    <div class="quant-ai-briefing-question">
      <div class="quant-ai-briefing-section-heading">
        <span class="quant-ai-briefing-label">范围内追问</span>
        <small>只基于当前可生成范围的候选事实回答</small>
      </div>
      <form class="quant-ai-briefing-question-form" @submit.prevent="submitQuestion">
        <label class="quant-ai-briefing-question-field">
          <span>问题</span>
          <textarea
            ref="questionInputElement"
            :value="questionInput"
            class="field-control quant-ai-briefing-question-input"
            maxlength="500"
            rows="2"
            placeholder="例如：当前范围内最需要先核对哪类事实？"
            :disabled="questionLoading || !hasBriefingCandidates || available === false"
            @input="emit('update:questionInput', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <div class="quant-ai-briefing-question-actions">
          <small>{{ questionInput.length }} / 500</small>
          <button class="secondary-button quant-ai-briefing-question-submit" type="submit" :disabled="!canAskQuestion" title="基于当前候选范围回答问题">
            <RefreshCw v-if="questionLoading" :size="14" class="animate-spin" aria-hidden="true" />
            <BrainCircuit v-else :size="14" aria-hidden="true" />
            {{ questionLoading ? '回答中' : questionResult ? '重新追问' : '提交追问' }}
          </button>
        </div>
      </form>
      <div v-if="questionLoading" class="quant-ai-briefing-question-state" role="status">
        <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
        <span>正在基于当前候选范围整理回答</span>
      </div>
      <div v-else-if="questionErrorMessage" class="quant-ai-briefing-question-state quant-ai-briefing-question-state-error" role="alert">
        <AlertCircle :size="15" aria-hidden="true" />
        <span class="quant-ai-briefing-wrap-anywhere">{{ questionErrorMessage }}</span>
        <button v-if="questionConfigurationError" class="text-button quant-ai-briefing-question-error-action" type="button" @click="emit('openSettings')">
          打开 AI 配置
        </button>
        <button v-else class="text-button quant-ai-briefing-question-error-action" type="button" @click="submitQuestion">
          重试
        </button>
      </div>
      <div v-else-if="questionResult" class="quant-ai-briefing-question-result">
        <div class="quant-ai-briefing-question-answer-heading">
          <strong>回答</strong>
          <small>{{ questionResult.model }} · {{ formatDate(questionResult.generatedAt) }}</small>
        </div>
        <p class="quant-ai-briefing-question-answer quant-ai-briefing-wrap-anywhere">
          {{ questionResult.answer }}
        </p>
        <div class="quant-ai-briefing-question-citations">
          <div class="quant-ai-briefing-section-heading">
            <span class="quant-ai-briefing-label">引用候选代码</span>
            <small>{{ questionResult.citedCandidateCodes.length }} 个 · 点击回看详情</small>
          </div>
          <div v-if="questionResult.citedCandidateCodes.length" class="quant-ai-briefing-citation-list">
            <button
              v-for="tsCode in questionResult.citedCandidateCodes"
              :key="tsCode"
              class="quant-ai-briefing-citation quant-ai-briefing-wrap-anywhere"
              type="button"
              :aria-label="`打开追问引用候选 ${tsCode} 详情`"
              @click="focusCandidate(tsCode)"
            >
              <code>{{ tsCode }}</code>
              <span>回看候选</span>
            </button>
          </div>
          <span v-else class="quant-ai-briefing-empty">
            <CircleHelp :size="13" aria-hidden="true" />
            回答未返回引用代码
          </span>
        </div>
      </div>
      <div v-else class="quant-ai-briefing-question-state" role="status">
        <CircleHelp :size="15" aria-hidden="true" />
        <span v-if="!hasBriefingCandidates">当前筛选没有可追问的快照候选</span>
        <span v-else-if="available === false">候选快照尚未准备好，完成一次日线更新后即可追问</span>
        <span v-else>输入一个具体问题，AI 会只根据当前候选范围回答。</span>
      </div>
    </div>

    <p v-if="copyMessage && showBriefingActions" class="quant-ai-briefing-copy-message" :class="{ 'quant-ai-briefing-copy-message-error': copyOutcome === 'error' }" role="status">
      {{ copyMessage }}
    </p>

    <div v-if="loading" class="quant-ai-briefing-state" role="status">
      <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
      <span>AI 正在整理当前候选简报</span>
    </div>
    <div v-else-if="errorMessage" class="quant-ai-briefing-state quant-ai-briefing-state-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span class="quant-ai-briefing-wrap-anywhere">{{ errorMessage }}</span>
      <button v-if="configurationError" class="text-button quant-ai-briefing-error-action" type="button" @click="emit('openSettings')">
        打开 AI 配置
      </button>
      <button v-else class="text-button quant-ai-briefing-error-action" type="button" @click="emit('generate')">
        重试
      </button>
    </div>
    <div v-else-if="!briefing" class="quant-ai-briefing-state" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span v-if="!hasCandidates">当前没有候选数据，加载候选后即可生成简报。</span>
      <span v-else-if="!hasFilteredCandidates">当前筛选没有候选，调整筛选后即可生成简报。</span>
      <span v-else-if="!hasBriefingCandidates">当前筛选候选尚未进入最新快照，完成日线更新后即可生成简报。</span>
      <span v-else-if="!canGenerate">候选快照尚未准备好，完成一次日线更新后即可生成简报。</span>
      <span v-else>还没有生成候选简报，按需读取当前研究重点。</span>
    </div>
    <template v-else>
      <div class="quant-ai-briefing-overview-block">
        <span class="quant-ai-briefing-label">整体概览</span>
        <p class="quant-ai-briefing-overview quant-ai-briefing-wrap-anywhere">
          {{ briefing.overview }}
        </p>
      </div>

      <div class="quant-ai-briefing-section">
        <div class="quant-ai-briefing-section-heading">
          <span class="quant-ai-briefing-label">重点候选</span>
          <small>{{ visibleFocusItems.length }} 个 · 点击候选回看详情</small>
        </div>
        <div v-if="visibleFocusItems.length" class="quant-ai-briefing-focus-list">
          <div
            v-for="item in visibleFocusItems"
            :key="item.tsCode"
            class="quant-ai-briefing-focus-row"
          >
            <button
              class="quant-ai-briefing-focus-item quant-ai-briefing-wrap-anywhere"
              type="button"
              :aria-label="`打开候选 ${item.name || item.tsCode}（${item.tsCode}）详情`"
              @click="focusCandidate(item.tsCode)"
            >
              <span class="quant-ai-briefing-focus-heading">
                <span class="quant-ai-briefing-focus-name">
                  <strong>{{ item.name || item.tsCode }}</strong>
                  <code>{{ item.tsCode }}</code>
                </span>
                <span class="quant-ai-briefing-focus-arrow" aria-hidden="true">↗</span>
              </span>
              <span class="quant-ai-briefing-focus-meta">
                <span class="quant-ai-briefing-priority" :class="priorityClass(item.priorityLevel)">
                  {{ priorityLabel(item.priorityLevel) }}
                </span>
                <span>{{ formatScore(item.priorityScore) }}</span>
                <span>{{ item.actionLabel }}</span>
              </span>
              <span v-if="item.reasons.length" class="quant-ai-briefing-reasons">
                <span v-for="reason in item.reasons" :key="reason" class="quant-ai-briefing-reason quant-ai-briefing-wrap-anywhere">
                  {{ reason }}
                </span>
              </span>
              <span class="quant-ai-briefing-explanation quant-ai-briefing-wrap-anywhere">
                {{ item.explanation }}
              </span>
            </button>
            <button
              class="text-button quant-ai-briefing-focus-prompt"
              type="button"
              :disabled="!canUseQuestionPrompt"
              :aria-label="`针对候选 ${item.name || item.tsCode}（${item.tsCode}）提问`"
              title="将该重点候选带入当前追问"
              @click="useQuestionPrompt(questionPromptForFocusItem(item))"
            >
              <BrainCircuit :size="13" aria-hidden="true" />
              针对提问
            </button>
          </div>
        </div>
        <span v-else class="quant-ai-briefing-empty">
          <CircleHelp :size="13" aria-hidden="true" />
          未返回重点候选
        </span>
      </div>

      <div class="quant-ai-briefing-section quant-ai-briefing-next">
        <span class="quant-ai-briefing-label">下一步核对</span>
        <ul v-if="visibleNextChecks.length">
          <li v-for="check in visibleNextChecks" :key="check" class="quant-ai-briefing-next-item">
            <span class="quant-ai-briefing-wrap-anywhere">{{ check }}</span>
            <button
              class="text-button quant-ai-briefing-next-prompt"
              type="button"
              :disabled="!canUseQuestionPrompt"
              :aria-label="`将核对项带入当前追问：${check}`"
              title="将核对项转换为当前追问"
              @click="useQuestionPrompt(questionPromptForNextCheck(check))"
            >
              <BrainCircuit :size="13" aria-hidden="true" />
              带入追问
            </button>
          </li>
        </ul>
        <span v-else class="quant-ai-briefing-empty">未返回下一步核对项</span>
      </div>

      <div class="quant-ai-briefing-section quant-ai-briefing-citations">
        <div class="quant-ai-briefing-section-heading">
          <span class="quant-ai-briefing-label">引用候选代码</span>
          <small>点击代码回看候选详情</small>
        </div>
        <div v-if="briefing.citedCandidateCodes.length" class="quant-ai-briefing-citation-list">
          <button
            v-for="tsCode in briefing.citedCandidateCodes"
            :key="tsCode"
            class="quant-ai-briefing-citation quant-ai-briefing-wrap-anywhere"
            type="button"
            :aria-label="`打开引用候选 ${tsCode} 详情`"
            @click="focusCandidate(tsCode)"
          >
            <code>{{ tsCode }}</code>
            <span>回看候选</span>
          </button>
        </div>
        <span v-else class="quant-ai-briefing-empty">
          <CircleHelp :size="13" aria-hidden="true" />
          未返回引用代码
        </span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.quant-ai-briefing-panel {
  display: grid;
  gap: 0.7rem;
  min-width: 0;
  margin-top: 0.85rem;
  border-top: 1px solid hsl(var(--primary) / 0.28);
  padding-top: 0.8rem;
}

.quant-ai-briefing-heading,
.quant-ai-briefing-section-heading,
.quant-ai-briefing-focus-heading,
.quant-ai-briefing-focus-meta {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-ai-briefing-heading {
  gap: 0.75rem;
}

.quant-ai-briefing-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
}

.quant-ai-briefing-heading-copy,
.quant-ai-briefing-section,
.quant-ai-briefing-overview-block {
  min-width: 0;
}

.quant-ai-briefing-heading h3 {
  margin: 0.3rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 740;
}

.quant-ai-briefing-heading small,
.quant-ai-briefing-section-heading small {
  display: block;
  margin-top: 0.2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.quant-ai-briefing-generate {
  flex: 0 0 auto;
}

.quant-ai-briefing-copy-message {
  margin: -0.15rem 0 0;
  color: hsl(var(--status-success));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-ai-briefing-copy-message-error {
  color: hsl(var(--status-danger));
}

.quant-ai-briefing-question {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.65rem;
}

.quant-ai-briefing-question-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: end;
}

.quant-ai-briefing-question-field {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.quant-ai-briefing-question-field > span,
.quant-ai-briefing-question-actions small {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-briefing-question-input {
  min-height: 3.3rem;
  resize: vertical;
}

.quant-ai-briefing-question-actions {
  display: grid;
  justify-items: end;
  gap: 0.3rem;
}

.quant-ai-briefing-question-submit {
  white-space: nowrap;
}

.quant-ai-briefing-question-state {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
}

.quant-ai-briefing-question-state-error {
  flex-wrap: wrap;
  color: hsl(var(--status-danger));
}

.quant-ai-briefing-question-result {
  display: grid;
  gap: 0.45rem;
  border-left: 2px solid hsl(var(--status-success) / 0.7);
  background: hsl(var(--status-success) / 0.04);
  padding: 0.5rem 0.6rem;
}

.quant-ai-briefing-question-answer-heading {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: 0.5rem;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-ai-briefing-question-answer-heading small {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-briefing-question-answer {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.55;
}

.quant-ai-briefing-question-citations {
  display: grid;
  gap: 0.35rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.45rem;
}

.quant-ai-briefing-scope {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--muted) / 0.28);
  padding: 0.45rem 0.55rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-briefing-scope strong {
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.quant-ai-briefing-history {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.65rem;
}

.quant-ai-briefing-history-toggle {
  flex: 0 0 auto;
  white-space: nowrap;
}

.quant-ai-briefing-history-body,
.quant-ai-briefing-history-list,
.quant-ai-briefing-history-detail,
.quant-ai-briefing-history-briefing,
.quant-ai-briefing-history-questions {
  display: grid;
  min-width: 0;
  gap: 0.45rem;
}

.quant-ai-briefing-history-list {
  max-height: 14rem;
  overflow-y: auto;
  padding-right: 0.15rem;
}

.quant-ai-briefing-history-row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--card));
}

.quant-ai-briefing-history-row:hover,
.quant-ai-briefing-history-row-active {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.05);
}

.quant-ai-briefing-history-item {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
  border: 0;
  background: transparent;
  padding: 0.45rem 0.55rem;
  color: hsl(var(--foreground));
  text-align: left;
}

.quant-ai-briefing-history-item:hover,
.quant-ai-briefing-history-item-active {
  background: transparent;
}

.quant-ai-briefing-history-item-actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  padding: 0.3rem;
}

.quant-ai-briefing-history-delete {
  display: inline-flex;
  width: 1.8rem;
  height: 1.8rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
}

.quant-ai-briefing-history-delete:hover:not(:disabled) {
  border-color: hsl(var(--status-danger) / 0.55);
  color: hsl(var(--status-danger));
}

.quant-ai-briefing-history-delete:disabled {
  cursor: wait;
  opacity: 0.65;
}

.quant-ai-briefing-history-delete-confirm {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  color: hsl(var(--status-danger));
  font-size: 0.625rem;
}

.quant-ai-briefing-history-delete-confirm-action,
.quant-ai-briefing-history-delete-cancel-action {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  white-space: nowrap;
}

.quant-ai-briefing-history-delete-confirm-action {
  color: hsl(var(--status-danger));
}

.quant-ai-briefing-history-delete-success {
  color: hsl(var(--status-success));
}

.quant-ai-briefing-history-item-heading,
.quant-ai-briefing-history-metadata,
.quant-ai-briefing-history-citations {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.55rem;
}

.quant-ai-briefing-history-item-heading {
  justify-content: space-between;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-ai-briefing-history-badge {
  flex: 0 0 auto;
  border-radius: 999px;
  background: hsl(var(--primary) / 0.12);
  padding: 0.12rem 0.35rem;
  color: hsl(var(--primary));
  font-size: 0.5625rem;
}

.quant-ai-briefing-history-item-meta,
.quant-ai-briefing-history-briefing > small,
.quant-ai-briefing-history-question > small {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-ai-briefing-history-detail {
  border-left: 2px solid hsl(var(--primary) / 0.55);
  background: hsl(var(--muted) / 0.2);
  padding: 0.55rem 0.6rem;
}

.quant-ai-briefing-history-detail-actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.3rem;
}

.quant-ai-briefing-history-detail-action {
  flex: 0 1 auto;
  white-space: nowrap;
}

.quant-ai-briefing-history-transfer-message {
  margin: -0.1rem 0 0;
  color: hsl(var(--status-success));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-ai-briefing-history-transfer-message-error {
  color: hsl(var(--status-danger));
}

.quant-ai-briefing-history-candidates {
  display: grid;
  min-width: 0;
  gap: 0.3rem;
}

.quant-ai-briefing-history-code-list {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.quant-ai-briefing-history-code-action,
.quant-ai-briefing-history-code-stale {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.2rem 0.3rem;
  font-size: 0.625rem;
  line-height: 1.3;
  text-align: left;
}

.quant-ai-briefing-history-code-action {
  border-color: hsl(var(--primary) / 0.35);
  background: hsl(var(--primary) / 0.06);
  color: hsl(var(--foreground));
  cursor: pointer;
}

.quant-ai-briefing-history-code-action:hover {
  border-color: hsl(var(--primary) / 0.7);
  background: hsl(var(--primary) / 0.12);
}

.quant-ai-briefing-history-code-stale {
  background: hsl(var(--muted) / 0.4);
  color: hsl(var(--muted-foreground));
}

.quant-ai-briefing-history-code-action code,
.quant-ai-briefing-history-code-stale code {
  min-width: 0;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.625rem;
  overflow-wrap: anywhere;
}

.quant-ai-briefing-history-code-action span,
.quant-ai-briefing-history-code-stale span {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground));
  font-size: 0.5625rem;
}

.quant-ai-briefing-history-code-action span {
  color: hsl(var(--primary));
}

.quant-ai-briefing-history-metadata {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-briefing-history-metadata strong {
  color: hsl(var(--foreground));
}

.quant-ai-briefing-history-briefing,
.quant-ai-briefing-history-questions {
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.45rem;
}

.quant-ai-briefing-history-briefing > p,
.quant-ai-briefing-history-question > p {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  line-height: 1.5;
}

.quant-ai-briefing-history-question-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.45rem;
}

.quant-ai-briefing-history-question-heading strong {
  min-width: 0;
}

.quant-ai-briefing-history-reuse-question {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.2rem;
  white-space: nowrap;
}

.quant-ai-briefing-history-sub-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  font-weight: 700;
}

.quant-ai-briefing-history-focus-list,
.quant-ai-briefing-history-next-checks,
.quant-ai-briefing-history-citations {
  display: grid;
  gap: 0.3rem;
}

.quant-ai-briefing-history-focus-item {
  display: grid;
  gap: 0.15rem;
  border-left: 1px solid hsl(var(--border));
  padding-left: 0.45rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-briefing-history-focus-action,
.quant-ai-briefing-history-focus-stale {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.15rem;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  text-align: left;
}

.quant-ai-briefing-history-focus-action {
  cursor: pointer;
}

.quant-ai-briefing-history-focus-action:hover strong {
  color: hsl(var(--primary));
}

.quant-ai-briefing-history-focus-item strong {
  color: hsl(var(--foreground));
}

.quant-ai-briefing-history-focus-item p {
  margin: 0;
  line-height: 1.4;
}

.quant-ai-briefing-history-question-citations {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.quant-ai-briefing-history-next-checks ul {
  margin: 0;
  padding-left: 1rem;
  color: hsl(var(--foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-ai-briefing-history-citations code {
  width: fit-content;
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--background));
  padding: 0.12rem 0.3rem;
  color: hsl(var(--foreground));
  font-size: 0.625rem;
}

.quant-ai-briefing-history-state,
.quant-ai-briefing-history-detail-error {
  display: flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
}

.quant-ai-briefing-history-state-error,
.quant-ai-briefing-history-detail-error {
  color: hsl(var(--status-danger));
}

.quant-ai-briefing-history-detail-error {
  margin: 0;
}

.quant-ai-briefing-state {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  text-align: center;
}

.quant-ai-briefing-state-error {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: hsl(var(--status-danger));
}

.quant-ai-briefing-overview-block,
.quant-ai-briefing-section {
  display: grid;
  gap: 0.4rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-ai-briefing-overview-block {
  border-top: 0;
  padding-top: 0;
}

.quant-ai-briefing-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  font-weight: 700;
}

.quant-ai-briefing-overview {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.55;
}

.quant-ai-briefing-focus-list {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
}

.quant-ai-briefing-focus-row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 0.35rem;
}

.quant-ai-briefing-focus-item {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.35rem;
  border: 1px solid hsl(var(--border));
  border-left: 2px solid hsl(var(--status-info) / 0.7);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--card));
  padding: 0.5rem 0.55rem;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
}

.quant-ai-briefing-focus-item:hover {
  border-color: hsl(var(--primary) / 0.5);
}

.quant-ai-briefing-focus-prompt {
  display: inline-flex;
  min-width: 4.6rem;
  align-items: center;
  justify-content: center;
  align-self: start;
  gap: 0.2rem;
  white-space: nowrap;
}

.quant-ai-briefing-focus-heading {
  align-items: center;
}

.quant-ai-briefing-focus-name {
  display: flex;
  min-width: 0;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.quant-ai-briefing-focus-name strong {
  font-size: 0.75rem;
  font-weight: 740;
  overflow-wrap: anywhere;
}

.quant-ai-briefing-focus-name code,
.quant-ai-briefing-citation code {
  color: hsl(var(--muted-foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.625rem;
  overflow-wrap: anywhere;
}

.quant-ai-briefing-focus-arrow {
  flex: 0 0 auto;
  color: hsl(var(--primary));
  font-size: 0.875rem;
}

.quant-ai-briefing-focus-meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-ai-briefing-priority {
  border-radius: 999px;
  background: hsl(var(--muted));
  padding: 0.12rem 0.35rem;
  font-weight: 720;
}

.quant-ai-briefing-priority-urgent {
  background: hsl(var(--status-danger) / 0.12);
  color: hsl(var(--status-danger));
}

.quant-ai-briefing-priority-high {
  background: hsl(var(--status-warning) / 0.14);
  color: hsl(var(--status-warning));
}

.quant-ai-briefing-priority-normal {
  background: hsl(var(--status-info) / 0.12);
  color: hsl(var(--status-info));
}

.quant-ai-briefing-priority-low {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.quant-ai-briefing-reasons {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.quant-ai-briefing-reason {
  max-width: 100%;
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--muted) / 0.7);
  padding: 0.16rem 0.3rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-ai-briefing-explanation {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-ai-briefing-next ul {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding-left: 0.95rem;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-ai-briefing-next-item {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.35rem;
}

.quant-ai-briefing-next-prompt {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.2rem;
  white-space: nowrap;
}

.quant-ai-briefing-citation-list {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.quant-ai-briefing-citation {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid hsl(var(--status-success) / 0.3);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-success) / 0.06);
  padding: 0.35rem 0.45rem;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
}

.quant-ai-briefing-citation:hover {
  border-color: hsl(var(--status-success) / 0.65);
}

.quant-ai-briefing-citation span {
  flex: 0 0 auto;
  color: hsl(var(--status-success));
  font-size: 0.59375rem;
}

.quant-ai-briefing-empty {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-briefing-wrap-anywhere {
  overflow-wrap: anywhere;
  word-break: break-word;
}

button:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

@media (max-width: 680px) {
  .quant-ai-briefing-heading {
    flex-direction: column;
  }

  .quant-ai-briefing-actions {
    width: 100%;
    justify-content: stretch;
  }

  .quant-ai-briefing-actions button {
    flex: 1 1 100%;
  }

  .quant-ai-briefing-generate {
    width: 100%;
  }

  .quant-ai-briefing-scope {
    align-items: flex-start;
    flex-direction: column;
  }

  .quant-ai-briefing-section-heading,
  .quant-ai-briefing-focus-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
  }

  .quant-ai-briefing-history-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .quant-ai-briefing-history-item-actions {
    align-items: center;
    justify-content: flex-end;
    border-top: 1px solid hsl(var(--border));
  }

  .quant-ai-briefing-focus-arrow {
    display: none;
  }

  .quant-ai-briefing-focus-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .quant-ai-briefing-focus-name strong {
    white-space: normal;
  }

  .quant-ai-briefing-focus-meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .quant-ai-briefing-next-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .quant-ai-briefing-next-prompt {
    justify-self: start;
  }

  .quant-ai-briefing-focus-prompt {
    justify-self: start;
  }

  .quant-ai-briefing-history-question-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
  }

  .quant-ai-briefing-question-form {
    grid-template-columns: minmax(0, 1fr);
  }

  .quant-ai-briefing-question-actions {
    align-items: center;
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  .quant-ai-briefing-question-submit {
    width: 100%;
  }

  .quant-ai-briefing-question-answer-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
