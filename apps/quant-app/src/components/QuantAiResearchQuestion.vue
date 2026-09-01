<script setup lang="ts">
import type { QuantResearchEvidence, QuantResearchQuestion, QuantResearchReport } from '../lib/quant-types'
import { AlertCircle, BrainCircuit, CircleHelp, RefreshCw } from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'
import QuantAiProgressStatus from './QuantAiProgressStatus.vue'

const props = defineProps<{
  report: QuantResearchReport
  input: string
  result: QuantResearchQuestion | null
  loading: boolean
  errorMessage: string | null
  configurationError: boolean
}>()

const emit = defineEmits<{
  'update:input': [value: string]
  'ask': [question: string]
  'openSettings': []
  'focusEvidence': [evidenceKey: string]
}>()

const evidenceByKey = computed(() => new Map(props.report.evidence.map(item => [item.key, item])))
const canAsk = computed(() => Boolean(props.input.trim()) && !props.loading)
const questionInputElement = ref<HTMLTextAreaElement | null>(null)

function evidenceFor(key: string): QuantResearchEvidence | null {
  return evidenceByKey.value.get(key) || null
}

function submit(): void {
  if (canAsk.value)
    emit('ask', props.input.trim())
}

function useQuestionPrompt(prompt: string): void {
  const normalized = prompt.trim().slice(0, 500)
  if (!normalized || props.loading)
    return
  emit('update:input', normalized)
  void nextTick(() => questionInputElement.value?.focus())
}

defineExpose({ useQuestionPrompt })
</script>

<template>
  <section class="quant-ai-question-panel" aria-labelledby="quant-ai-question-title">
    <div class="quant-ai-question-heading">
      <div>
        <p class="section-kicker">
          REPORT Q&amp;A
        </p>
        <h3 id="quant-ai-question-title">
          向这份报告提问
        </h3>
        <small>只回答当前研究报告已有事实，并保留 evidence key 供你回看</small>
      </div>
      <BrainCircuit :size="18" aria-hidden="true" />
    </div>

    <form class="quant-ai-question-form" @submit.prevent="submit">
      <label class="quant-ai-question-field">
        <span>问题</span>
        <textarea
          ref="questionInputElement"
          :value="input"
          class="field-control quant-ai-question-input"
          maxlength="500"
          rows="3"
          placeholder="例如：这份报告中最需要先核对的证据是什么？"
          :disabled="loading"
          @input="emit('update:input', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <div class="quant-ai-question-actions">
        <small>{{ input.length }} / 500</small>
        <button class="secondary-button" type="submit" :disabled="!canAsk" title="基于当前研究报告回答问题">
          <RefreshCw v-if="loading" :size="14" class="animate-spin" aria-hidden="true" />
          <BrainCircuit v-else :size="14" aria-hidden="true" />
          {{ loading ? '回答中' : result ? '重新提问' : '提交问题' }}
        </button>
      </div>
    </form>

    <QuantAiProgressStatus v-if="loading" class="quant-ai-question-state" :active="loading" label="正在基于当前报告整理回答" />
    <div v-else-if="errorMessage" class="quant-ai-question-state quant-ai-question-state-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
      <button v-if="configurationError" class="text-button" type="button" @click="emit('openSettings')">
        打开 AI 配置
      </button>
      <small v-else>保留问题后可以再次提交</small>
    </div>
    <template v-else-if="result">
      <div class="quant-ai-question-answer">
        <div class="quant-ai-question-answer-heading">
          <strong>回答</strong>
          <small>{{ result.model }} · {{ result.generatedAt }}</small>
        </div>
        <p>{{ result.answer }}</p>
      </div>
      <div class="quant-ai-question-citations">
        <div class="quant-ai-question-citations-heading">
          <strong>引用证据</strong>
          <small>{{ result.citedEvidenceKeys.length }} 条 · 点击回到报告原文</small>
        </div>
        <div v-if="result.citedEvidenceKeys.length" class="quant-ai-question-citation-list">
          <button
            v-for="key in result.citedEvidenceKeys"
            :key="key"
            class="quant-ai-question-citation"
            type="button"
            :aria-label="`回看 ${report.tsCode} 的证据 ${evidenceFor(key)?.label || key}（${key}）`"
            @click="emit('focusEvidence', key)"
          >
            <span>
              {{ report.tsCode }} · {{ evidenceFor(key)?.label || key }}
              <small>{{ key }}</small>
            </span>
            <strong>{{ evidenceFor(key) ? '查看' : '当前报告未找到' }}</strong>
          </button>
        </div>
        <span v-else class="quant-ai-question-empty-citation">
          <CircleHelp :size="13" aria-hidden="true" />
          回答未返回引用证据
        </span>
      </div>
    </template>
    <div v-else class="quant-ai-question-state" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>输入一个具体问题，AI 会只根据这份报告回答。</span>
    </div>
  </section>
</template>
