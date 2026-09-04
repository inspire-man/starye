<script setup lang="ts">
import type { QuantDecisionAssistant, QuantDecisionAssistantMode, QuantResearchRun } from '../lib/quant-view-models'
import { AlertCircle, CheckCircle2, RefreshCw, Sparkles } from 'lucide-vue-next'
import QuantDecisionAssistantForm from './quant-decision/QuantDecisionAssistantForm.vue'
import QuantDecisionAssistantResult from './quant-decision/QuantDecisionAssistantResult.vue'
import QuantAiProgressStatus from './QuantAiProgressStatus.vue'

defineProps<{
  run: QuantResearchRun
  latestClose: number | null
  latestTradeDate: string | null
  assessment: QuantDecisionAssistant | null
  history: QuantDecisionAssistant[]
  loading: boolean
  generating: boolean
  errorMessage: string | null
  aiConfigAvailable: boolean | null
}>()

const emit = defineEmits<{
  assess: [input: { mode: QuantDecisionAssistantMode, costBasis: number | null, quantity: number | null, includeAi: boolean }]
  openSettings: []
}>()

function formatDate(value: string | null): string {
  if (!value)
    return '日期未记录'
  const digits = value.replace(/\D/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : value.slice(0, 10)
}
</script>

<template>
  <section class="quant-decision-assistant" aria-labelledby="quant-decision-assistant-title">
    <div class="quant-decision-assistant-heading">
      <div>
        <p class="section-kicker">
          TODAY'S DECISION
        </p>
        <h3 id="quant-decision-assistant-title">
          今日决策助手
        </h3>
        <p>用服务端行情和持仓成本生成一条可回看的判断。</p>
      </div>
      <span v-if="assessment" class="quant-decision-assistant-run-meta">评估 {{ formatDate(assessment.assessedAt) }}</span>
    </div>

    <QuantDecisionAssistantForm
      :run="run"
      :latest-close="latestClose"
      :latest-trade-date="latestTradeDate"
      :assessment="assessment"
      :loading="loading"
      :generating="generating"
      @assess="emit('assess', $event)"
    />

    <p v-if="errorMessage" class="quant-decision-assistant-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </p>
    <p v-if="aiConfigAvailable === false" class="quant-decision-assistant-config" role="status">
      <Sparkles :size="14" aria-hidden="true" />
      <span>AI 未配置，本次仍可生成确定性判断。</span>
      <button class="text-button" type="button" @click="emit('openSettings')">
        配置 AI
      </button>
    </p>
    <div v-if="loading" class="quant-decision-assistant-loading" role="status">
      <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
      正在读取最近评估
    </div>
    <QuantAiProgressStatus v-else-if="generating" class="quant-decision-assistant-loading" :active="generating" label="正在生成今日判断并请求 AI 复核" />

    <QuantDecisionAssistantResult
      v-if="assessment && !loading"
      :assessment="assessment"
      @open-settings="emit('openSettings')"
    />
    <p v-else-if="!loading && !generating" class="quant-decision-assistant-empty">
      <CheckCircle2 :size="15" aria-hidden="true" />
      生成一次评估后，这里会保留你的场景数据和判断依据。
    </p>

    <p v-if="history.length > 1" class="quant-decision-assistant-history-meta">
      已保留 {{ history.length }} 次评估快照，历史数据不会随因子配置变化。
    </p>
  </section>
</template>

<style scoped>
.quant-decision-assistant {
  display: grid;
  min-width: 0;
  gap: 0.7rem;
  margin-top: 0.9rem;
  border-top: 1px solid hsl(var(--status-info) / 0.3);
  padding-top: 0.85rem;
}

.quant-decision-assistant-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-decision-assistant-heading h3 {
  margin: 0.3rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 720;
}

.quant-decision-assistant-heading p:not(.section-kicker) {
  margin: 0.25rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-decision-assistant-run-meta,
.quant-decision-assistant-history-meta,
.quant-decision-assistant-empty {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-assistant-run-meta {
  flex: 0 0 auto;
  padding-top: 0.2rem;
  white-space: nowrap;
}

.quant-decision-assistant-error,
.quant-decision-assistant-config,
.quant-decision-assistant-loading,
.quant-decision-assistant-empty {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  overflow-wrap: anywhere;
}

.quant-decision-assistant-error {
  border: 1px solid hsl(var(--status-danger) / 0.25);
  background: hsl(var(--status-danger-soft));
  padding: 0.45rem 0.55rem;
  color: hsl(var(--status-danger));
  font-size: 0.625rem;
}

.quant-decision-assistant-config {
  border: 1px solid hsl(var(--status-warning) / 0.25);
  background: hsl(var(--status-warning-soft));
  padding: 0.45rem 0.55rem;
  color: hsl(var(--status-warning));
  font-size: 0.625rem;
}

.quant-decision-assistant-config span,
.quant-decision-assistant-error span {
  min-width: 0;
}

.quant-decision-assistant-loading {
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.55rem 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
}

.quant-decision-assistant-history-meta {
  margin: 0;
}

@media (max-width: 480px) {
  .quant-decision-assistant-heading {
    display: grid;
  }

  .quant-decision-assistant-run-meta {
    padding-top: 0;
  }
}
</style>
