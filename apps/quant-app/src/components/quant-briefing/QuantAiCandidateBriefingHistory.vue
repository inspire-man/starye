<script setup lang="ts">
import type { QuantAiBriefingCopyOutcome, QuantAiCandidateBriefingHistoryProps } from './quant-briefing-contracts'
import { AlertCircle, BrainCircuit, Check, CircleHelp, Copy, Download, RefreshCw, Trash2, X } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { quantApi, QuantApiError } from '../../lib/api-client'
import { buildCandidateAiSessionFilename, buildCandidateAiSessionMarkdown } from '../../lib/candidate-briefing-export'
import { copyResearchReportMarkdown } from '../../lib/research-report-copy'

const props = defineProps<QuantAiCandidateBriefingHistoryProps>()

const emit = defineEmits<{
  focusCandidate: [tsCode: string]
  useQuestionPrompt: [prompt: string]
  sessionDeleted: [sessionId: string]
}>()

const currentCandidateCodeSet = computed(() => new Set(props.currentCandidateCodes))
const loadedSessionHistory = ref<QuantAiCandidateBriefingHistoryProps['sessionHistory'] extends (infer T)[] | null | undefined ? T[] : never>([])
const historyLoading = ref(false)
const historyErrorMessage = ref<string | null>(null)
const historyOpen = ref(true)
const selectedHistorySession = ref<NonNullable<QuantAiCandidateBriefingHistoryProps['sessionHistory']>[number] | null>(null)
const historyDetailLoading = ref(false)
const historyDetailErrorMessage = ref<string | null>(null)
const historyExporting = ref(false)
const historyExportErrorMessage = ref<string | null>(null)
const historyCopying = ref(false)
const historyCopyOutcome = ref<QuantAiBriefingCopyOutcome>(null)
const historyCopyMessage = ref('')
const historyListRequestId = ref(0)
const historyRequestId = ref(0)
const historyCopyRequestId = ref(0)
const historyDeleteRequestId = ref(0)
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

function formatDate(value: string): string {
  if (!value)
    return '时间未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  if (/^\d{8}$/u.test(compact))
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  return value.slice(0, 10)
}

function formatScore(score: number): string {
  return Number.isFinite(score) ? `${score.toFixed(1)} 分` : '--'
}

function isCurrentCandidateCode(tsCode: string): boolean {
  return currentCandidateCodeSet.value.has(tsCode)
}

function focusHistoricalCandidate(tsCode: string): void {
  if (isCurrentCandidateCode(tsCode))
    emit('focusCandidate', tsCode)
}

function useQuestionPrompt(prompt: string): void {
  if (!props.questionPromptReady)
    return
  const normalized = prompt.trim().slice(0, 500)
  if (normalized)
    emit('useQuestionPrompt', normalized)
}

function resetHistoryTransferState(): void {
  historyCopyRequestId.value++
  historyExporting.value = false
  historyExportErrorMessage.value = null
  historyCopying.value = false
  historyCopyOutcome.value = null
  historyCopyMessage.value = ''
}

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

async function viewHistory(session: NonNullable<QuantAiCandidateBriefingHistoryProps['sessionHistory']>[number]): Promise<void> {
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

function formatSessionRange(session: NonNullable<QuantAiCandidateBriefingHistoryProps['sessionHistory']>[number]): string {
  if (session.fromDate && session.toDate)
    return `${formatDate(session.fromDate)} ~ ${formatDate(session.toDate)}`
  if (session.fromDate || session.toDate)
    return formatDate(session.fromDate || session.toDate || '')
  return '日期范围未记录'
}

function sessionSnapshotDate(session: NonNullable<QuantAiCandidateBriefingHistoryProps['sessionHistory']>[number]): string {
  return formatDate(session.snapshotGeneratedAt || session.updatedAt || session.createdAt)
}

function sessionTitle(session: NonNullable<QuantAiCandidateBriefingHistoryProps['sessionHistory']>[number]): string {
  return `${sessionSnapshotDate(session)} · ${session.candidateCodes.length} 个候选`
}

onMounted(() => {
  void loadSessionHistory()
})

watch(() => [props.briefingSessionId, props.questionSessionId], () => {
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
                :disabled="!questionPromptReady"
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
</template>
