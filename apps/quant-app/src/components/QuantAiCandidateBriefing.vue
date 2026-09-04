<script setup lang="ts">
import type { QuantAiCandidateBriefing, QuantAiCandidateBriefingQuestion, QuantAiCandidateBriefingSession } from '../lib/quant-view-models'
import { AlertCircle, CircleHelp } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import QuantAiCandidateBriefingContent from './quant-briefing/QuantAiCandidateBriefingContent.vue'
import QuantAiCandidateBriefingHeader from './quant-briefing/QuantAiCandidateBriefingHeader.vue'
import QuantAiCandidateBriefingHistory from './quant-briefing/QuantAiCandidateBriefingHistory.vue'
import QuantAiCandidateBriefingQuestionPanel from './quant-briefing/QuantAiCandidateBriefingQuestion.vue'
import QuantAiProgressStatus from './QuantAiProgressStatus.vue'
import './quant-briefing/quant-ai-candidate-briefing.css'

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
const canUseQuestionPrompt = computed(() => props.available !== false && hasBriefingCandidates.value && !props.questionLoading)
const showBriefingActions = computed(() => Boolean(props.briefing && !props.loading && !props.errorMessage))
const questionPanel = ref<{ useQuestionPrompt: (prompt: string) => void } | null>(null)

function focusCandidate(tsCode: string): void {
  emit('focusCandidate', tsCode)
}

function useQuestionPrompt(prompt: string): void {
  questionPanel.value?.useQuestionPrompt(prompt)
}

defineExpose({ useQuestionPrompt })
</script>

<template>
  <section
    class="quant-ai-briefing-panel quant-ai-briefing-responsive"
    aria-labelledby="quant-ai-briefing-title"
    :aria-busy="loading"
  >
    <QuantAiCandidateBriefingHeader
      :briefing="briefing"
      :candidate-count="candidateCount"
      :filtered-candidate-count="filteredCandidateCount"
      :briefing-available-candidate-count="briefingAvailableCandidateCount"
      :briefing-candidate-count="briefingCandidateCount"
      :available="available"
      :loading="loading"
      :error-message="errorMessage"
      :copying="copying"
      @generate="emit('generate')"
      @export="emit('export')"
      @copy="emit('copy')"
    />

    <QuantAiCandidateBriefingHistory
      :current-candidate-codes="currentCandidateCodes"
      :current-scope-key="currentScopeKey"
      :current-snapshot-id="currentSnapshotId"
      :history-reset-key="historyResetKey"
      :question-prompt-ready="canUseQuestionPrompt"
      :briefing-session-id="briefing?.sessionId"
      :question-session-id="questionResult?.sessionId"
      :session-history="sessionHistory"
      :session-history-error-message="sessionHistoryErrorMessage"
      @focus-candidate="focusCandidate"
      @use-question-prompt="useQuestionPrompt"
      @session-deleted="emit('sessionDeleted', $event)"
    />

    <QuantAiCandidateBriefingQuestionPanel
      ref="questionPanel"
      :briefing-available-candidate-count="briefingAvailableCandidateCount"
      :available="available"
      :question-input="questionInput"
      :question-result="questionResult"
      :question-loading="questionLoading"
      :question-error-message="questionErrorMessage"
      :question-configuration-error="questionConfigurationError"
      @update-input="emit('update:questionInput', $event)"
      @ask="emit('askQuestion', $event)"
      @open-settings="emit('openSettings')"
      @focus-candidate="focusCandidate"
    />

    <p v-if="copyMessage && showBriefingActions" class="quant-ai-briefing-copy-message" :class="{ 'quant-ai-briefing-copy-message-error': copyOutcome === 'error' }" role="status">
      {{ copyMessage }}
    </p>

    <QuantAiProgressStatus v-if="loading" class="quant-ai-briefing-state" :active="loading" label="AI 正在整理当前候选简报" />
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
    <QuantAiCandidateBriefingContent
      v-else
      :briefing="briefing"
      :question-prompt-ready="canUseQuestionPrompt"
      @focus-candidate="focusCandidate"
      @use-question-prompt="useQuestionPrompt"
    />
  </section>
</template>
