<script setup lang="ts">
import type { AutomatedResearchCandidate, AutomatedResearchItemState } from '../lib/research-automation'
import { CheckCircle2, ChevronRight, CircleAlert, CircleHelp, RefreshCw, Sparkles } from 'lucide-vue-next'
import { computed } from 'vue'
import { automatedResearchAiStatusLabel, automatedResearchStageLabel } from '../lib/research-automation'

const props = defineProps<{
  candidates: AutomatedResearchCandidate[]
  states: Record<string, AutomatedResearchItemState>
  running: boolean
  aiReady: boolean | null
  aiConfigErrorMessage: string | null
  errorMessage: string | null
}>()

const emit = defineEmits<{
  start: []
  retry: [tsCode: string]
  focus: [tsCode: string]
  openSettings: []
}>()

const summary = computed(() => {
  const states = props.candidates.map(candidate => props.states[candidate.tsCode])
  return {
    total: states.length,
    completed: states.filter(state => state?.stage === 'completed').length,
    errors: states.filter(state => state?.stage === 'error').length,
  }
})

function stateFor(candidate: AutomatedResearchCandidate): AutomatedResearchItemState | null {
  return props.states[candidate.tsCode] || null
}

function stageLabel(candidate: AutomatedResearchCandidate): string {
  const state = stateFor(candidate)
  return state ? automatedResearchStageLabel(state.stage) : '待开始'
}

function stageClass(candidate: AutomatedResearchCandidate): string {
  return `quant-research-automation-stage-${stateFor(candidate)?.stage || 'idle'}`
}

function aiLabel(candidate: AutomatedResearchCandidate): string {
  const state = stateFor(candidate)
  return state ? automatedResearchAiStatusLabel(state.aiStatus) : props.aiReady === false ? '未配置' : '待处理'
}

function detail(candidate: AutomatedResearchCandidate): string {
  const state = stateFor(candidate)
  if (!state)
    return '选择后启动'
  if (state.stage === 'error')
    return state.errorStage === 'ai' ? '报告已保存，AI 复核失败' : '可重试该项'
  if (state.stage === 'completed')
    return state.aiStatus === 'skipped' ? '确定性报告已保存' : '报告与 AI 复核已保存'
  return state.stage === 'ai' ? '报告已保存，正在请求 AI' : '正在处理'
}

function hasReport(candidate: AutomatedResearchCandidate): boolean {
  return Boolean(stateFor(candidate)?.run)
}
</script>

<template>
  <section class="quant-research-automation" aria-labelledby="quant-research-automation-title">
    <div class="quant-research-automation-heading">
      <div>
        <p class="section-kicker">
          RESEARCH PIPELINE
        </p>
        <h3 id="quant-research-automation-title">
          自动研究闭环
        </h3>
        <p>按当前候选顺序处理入池、报告和 AI 因子复核，最多 3 只。</p>
      </div>
      <div class="quant-research-automation-heading-actions">
        <span v-if="aiReady === true" class="quant-research-automation-ai-meta"><Sparkles :size="13" aria-hidden="true" />AI 已启用</span>
        <span v-else-if="aiReady === false" class="quant-research-automation-ai-meta quant-research-automation-ai-meta-muted">仅确定性报告</span>
        <button class="primary-button quant-research-automation-start" type="button" :disabled="running || !candidates.length" :aria-label="running ? '自动研究闭环处理中' : '启动自动研究闭环'" @click="emit('start')">
          <RefreshCw :size="14" :class="running ? 'animate-spin' : ''" aria-hidden="true" />
          {{ running ? `处理中 ${summary.completed} / ${summary.total}` : candidates.length ? `启动闭环 ${candidates.length} 只` : '暂无候选' }}
        </button>
      </div>
    </div>

    <p v-if="aiConfigErrorMessage" class="quant-research-automation-state quant-research-automation-state-warning" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>AI 配置读取失败，已保留确定性报告：{{ aiConfigErrorMessage }}</span>
      <button class="text-button" type="button" @click="emit('openSettings')">
        打开配置
      </button>
    </p>
    <p v-if="errorMessage" class="quant-research-automation-state quant-research-automation-state-error" role="alert">
      <CircleAlert :size="15" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </p>
    <p v-if="!candidates.length" class="quant-research-automation-state" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>当前筛选没有可处理的候选。</span>
    </p>
    <div v-else class="quant-research-automation-list" role="list" aria-live="polite">
      <article v-for="candidate in candidates" :key="candidate.tsCode" class="quant-research-automation-row" role="listitem">
        <div class="quant-research-automation-stock">
          <strong>{{ candidate.name || candidate.tsCode }}</strong>
          <small>{{ candidate.tsCode }}</small>
        </div>
        <div class="quant-research-automation-progress">
          <span class="quant-research-automation-stage" :class="stageClass(candidate)">
            <CheckCircle2 v-if="stateFor(candidate)?.stage === 'completed'" :size="13" aria-hidden="true" />
            <CircleAlert v-else-if="stateFor(candidate)?.stage === 'error'" :size="13" aria-hidden="true" />
            <RefreshCw v-else-if="stateFor(candidate)" :size="13" class="animate-spin" aria-hidden="true" />
            {{ stageLabel(candidate) }}
          </span>
          <small>{{ detail(candidate) }} · AI {{ aiLabel(candidate) }}</small>
        </div>
        <div class="quant-research-automation-actions">
          <button v-if="hasReport(candidate)" class="text-button" type="button" :aria-label="`查看 ${candidate.name || candidate.tsCode} 研究报告`" title="打开已保存研究报告" @click="emit('focus', candidate.tsCode)">
            查看报告
            <ChevronRight :size="13" aria-hidden="true" />
          </button>
          <button v-if="stateFor(candidate)?.stage === 'error'" class="text-button" type="button" :disabled="running" :aria-label="`重试 ${candidate.name || candidate.tsCode} 自动研究`" title="重试该项闭环" @click="emit('retry', candidate.tsCode)">
            <RefreshCw :size="13" aria-hidden="true" />
            重试
          </button>
        </div>
      </article>
    </div>
    <p v-if="summary.completed || summary.errors" class="quant-research-automation-summary" role="status">
      已完成 {{ summary.completed }} / {{ summary.total }} 项<span v-if="summary.errors">，{{ summary.errors }} 项需处理</span>；报告、摘要和因子复核均按项保存。
    </p>
  </section>
</template>

<style scoped>
.quant-research-automation {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.9rem;
  border-top: 1px solid hsl(var(--primary) / 0.28);
  padding-top: 0.85rem;
}

.quant-research-automation-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-research-automation-heading h3 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 720;
}

.quant-research-automation-heading p:not(.section-kicker) {
  margin: 0.25rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-research-automation-heading-actions,
.quant-research-automation-actions,
.quant-research-automation-ai-meta,
.quant-research-automation-stage {
  display: inline-flex;
  align-items: center;
}

.quant-research-automation-heading-actions {
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

.quant-research-automation-ai-meta {
  gap: 0.25rem;
  color: hsl(var(--status-success));
  font-size: 0.625rem;
  font-weight: 700;
  white-space: nowrap;
}

.quant-research-automation-ai-meta-muted {
  color: hsl(var(--muted-foreground));
}

.quant-research-automation-start {
  min-height: 2rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.6875rem;
}

.quant-research-automation-state {
  display: flex;
  min-height: 2.2rem;
  align-items: center;
  gap: 0.4rem;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.5rem 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.4;
}

.quant-research-automation-state span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quant-research-automation-state-warning {
  border-color: hsl(var(--status-warning) / 0.24);
  color: hsl(var(--status-warning));
}

.quant-research-automation-state-error {
  border-color: hsl(var(--status-danger) / 0.24);
  color: hsl(var(--status-danger));
}

.quant-research-automation-list {
  display: grid;
  gap: 0.35rem;
}

.quant-research-automation-row {
  display: grid;
  grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 1.5fr) auto;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.72);
  padding: 0.5rem 0;
}

.quant-research-automation-row:last-child {
  border-bottom: 0;
}

.quant-research-automation-stock,
.quant-research-automation-progress {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.quant-research-automation-stock strong {
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
}

.quant-research-automation-stock small,
.quant-research-automation-progress small,
.quant-research-automation-summary {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.quant-research-automation-stock small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.quant-research-automation-stage {
  width: fit-content;
  gap: 0.25rem;
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.16rem 0.35rem;
  font-size: 0.625rem;
  font-weight: 720;
}

.quant-research-automation-stage-idle,
.quant-research-automation-stage-watchlist {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.quant-research-automation-stage-research,
.quant-research-automation-stage-ai {
  background: hsl(var(--status-info-soft));
  color: hsl(var(--status-info));
}

.quant-research-automation-stage-completed {
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-research-automation-stage-error {
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.quant-research-automation-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
}

.quant-research-automation-actions .text-button {
  gap: 0.2rem;
  white-space: nowrap;
}

.quant-research-automation-summary {
  margin: 0;
}

@media (max-width: 700px) {
  .quant-research-automation-heading {
    display: grid;
  }

  .quant-research-automation-heading-actions {
    justify-content: flex-start;
  }

  .quant-research-automation-row {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }

  .quant-research-automation-progress {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .quant-research-automation-actions {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
