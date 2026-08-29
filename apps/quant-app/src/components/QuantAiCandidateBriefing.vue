<script setup lang="ts">
import type { QuantAiCandidateBriefing, QuantAiCandidateBriefingQuestion } from '../lib/quant-types'
import { AlertCircle, BrainCircuit, CircleHelp, Copy, Download, RefreshCw } from 'lucide-vue-next'
import { computed } from 'vue'

type CopyOutcome = 'success' | 'error' | null

const props = withDefaults(defineProps<{
  briefing: QuantAiCandidateBriefing | null
  candidateCount: number
  filteredCandidateCount: number
  briefingAvailableCandidateCount: number
  briefingCandidateCount?: number | null
  available?: boolean
  loading: boolean
  errorMessage: string | null
  configurationError: boolean
  questionInput?: string
  questionResult?: QuantAiCandidateBriefingQuestion | null
  questionLoading?: boolean
  questionErrorMessage?: string | null
  questionConfigurationError?: boolean
  copying?: boolean
  copyOutcome?: CopyOutcome
  copyMessage?: string
}>(), {
  available: true,
  briefingCandidateCount: null,
  questionInput: '',
  questionResult: null,
  questionLoading: false,
  questionErrorMessage: null,
  questionConfigurationError: false,
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
}>()

const hasCandidates = computed(() => props.candidateCount > 0)
const hasFilteredCandidates = computed(() => props.filteredCandidateCount > 0)
const hasBriefingCandidates = computed(() => props.briefingAvailableCandidateCount > 0)
const canGenerate = computed(() => props.available !== false && hasFilteredCandidates.value && hasBriefingCandidates.value)
const canAskQuestion = computed(() => props.available !== false && hasBriefingCandidates.value && Boolean(props.questionInput.trim()) && !props.questionLoading)
const showBriefingActions = computed(() => Boolean(props.briefing && !props.loading && !props.errorMessage))
const visibleFocusItems = computed(() => props.briefing?.focusItems.slice(0, 5) || [])
const visibleNextChecks = computed(() => props.briefing?.nextChecks.slice(0, 6) || [])

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

function submitQuestion(): void {
  if (canAskQuestion.value)
    emit('askQuestion', props.questionInput.trim())
}
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

    <div class="quant-ai-briefing-question">
      <div class="quant-ai-briefing-section-heading">
        <span class="quant-ai-briefing-label">范围内追问</span>
        <small>只基于当前可生成范围的候选事实回答</small>
      </div>
      <form class="quant-ai-briefing-question-form" @submit.prevent="submitQuestion">
        <label class="quant-ai-briefing-question-field">
          <span>问题</span>
          <textarea
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
          <button
            v-for="item in visibleFocusItems"
            :key="item.tsCode"
            class="quant-ai-briefing-focus-item quant-ai-briefing-wrap-anywhere"
            type="button"
            :aria-label="`打开候选 ${item.name}（${item.tsCode}）详情`"
            @click="focusCandidate(item.tsCode)"
          >
            <span class="quant-ai-briefing-focus-heading">
              <span class="quant-ai-briefing-focus-name">
                <strong>{{ item.name }}</strong>
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
        </div>
        <span v-else class="quant-ai-briefing-empty">
          <CircleHelp :size="13" aria-hidden="true" />
          未返回重点候选
        </span>
      </div>

      <div class="quant-ai-briefing-section quant-ai-briefing-next">
        <span class="quant-ai-briefing-label">下一步核对</span>
        <ul v-if="visibleNextChecks.length">
          <li v-for="check in visibleNextChecks" :key="check" class="quant-ai-briefing-wrap-anywhere">
            {{ check }}
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

  .quant-ai-briefing-focus-arrow {
    display: none;
  }

  .quant-ai-briefing-focus-name strong {
    white-space: normal;
  }

  .quant-ai-briefing-focus-meta {
    align-items: flex-start;
    flex-direction: column;
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
