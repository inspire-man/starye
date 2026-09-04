<script setup lang="ts">
import type { QuantAiCandidateBriefingQuestionProps } from './quant-briefing-contracts'
import { AlertCircle, BrainCircuit, CircleHelp, RefreshCw } from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'
import QuantAiProgressStatus from '../QuantAiProgressStatus.vue'

const props = defineProps<QuantAiCandidateBriefingQuestionProps>()

const emit = defineEmits<{
  updateInput: [value: string]
  ask: [question: string]
  openSettings: []
  focusCandidate: [tsCode: string]
}>()

const canAsk = computed(() => props.available && props.briefingAvailableCandidateCount > 0 && Boolean(props.questionInput.trim()) && !props.questionLoading)
const canUseQuestionPrompt = computed(() => props.available && props.briefingAvailableCandidateCount > 0 && !props.questionLoading)
const questionInputElement = ref<HTMLTextAreaElement | null>(null)

function formatDate(value: string): string {
  if (!value)
    return '时间未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  if (/^\d{8}$/u.test(compact))
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  return value.slice(0, 10)
}

function submit(): void {
  if (canAsk.value)
    emit('ask', props.questionInput.trim())
}

function useQuestionPrompt(prompt: string): void {
  if (!canUseQuestionPrompt.value)
    return
  const normalized = prompt.trim().slice(0, 500)
  if (!normalized)
    return
  emit('updateInput', normalized)
  void nextTick(() => questionInputElement.value?.focus())
}

defineExpose({ useQuestionPrompt })
</script>

<template>
  <div class="quant-ai-briefing-question">
    <div class="quant-ai-briefing-section-heading">
      <span class="quant-ai-briefing-label">范围内追问</span>
      <small>只基于当前可生成范围的候选事实回答</small>
    </div>
    <form class="quant-ai-briefing-question-form" @submit.prevent="submit">
      <label class="quant-ai-briefing-question-field">
        <span>问题</span>
        <textarea
          ref="questionInputElement"
          :value="questionInput"
          class="field-control quant-ai-briefing-question-input"
          maxlength="500"
          rows="2"
          placeholder="例如：当前范围内最需要先核对哪类事实？"
          :disabled="questionLoading || !canUseQuestionPrompt"
          @input="emit('updateInput', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <div class="quant-ai-briefing-question-actions">
        <small>{{ questionInput.length }} / 500</small>
        <button class="secondary-button quant-ai-briefing-question-submit" type="submit" :disabled="!canAsk" title="基于当前候选范围回答问题">
          <RefreshCw v-if="questionLoading" :size="14" class="animate-spin" aria-hidden="true" />
          <BrainCircuit v-else :size="14" aria-hidden="true" />
          {{ questionLoading ? '回答中' : questionResult ? '重新追问' : '提交追问' }}
        </button>
      </div>
    </form>
    <QuantAiProgressStatus v-if="questionLoading" class="quant-ai-briefing-question-state" :active="questionLoading" label="正在基于当前候选范围整理回答" />
    <div v-else-if="questionErrorMessage" class="quant-ai-briefing-question-state quant-ai-briefing-question-state-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span class="quant-ai-briefing-wrap-anywhere">{{ questionErrorMessage }}</span>
      <button v-if="questionConfigurationError" class="text-button quant-ai-briefing-question-error-action" type="button" @click="emit('openSettings')">
        打开 AI 配置
      </button>
      <button v-else class="text-button quant-ai-briefing-question-error-action" type="button" @click="submit">
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
            @click="emit('focusCandidate', tsCode)"
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
      <span v-if="briefingAvailableCandidateCount <= 0">当前筛选没有可追问的快照候选</span>
      <span v-else-if="!available">候选快照尚未准备好，完成一次日线更新后即可追问</span>
      <span v-else>输入一个具体问题，AI 会只根据当前候选范围回答。</span>
    </div>
  </div>
</template>
