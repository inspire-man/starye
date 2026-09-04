<script setup lang="ts">
import type { QuantDecisionJournalHistoryProps } from './quant-journal-contracts'
import { AlertCircle } from 'lucide-vue-next'

defineProps<QuantDecisionJournalHistoryProps>()

function actionLabel(action: NonNullable<QuantDecisionJournalHistoryProps['history']>[number]['action']): string {
  return {
    'watch': '继续观察',
    'plan-buy': '计划买入',
    'holding': '已持有',
    'sold': '已卖出',
  }[action]
}

function recommendationLabel(value: NonNullable<QuantDecisionJournalHistoryProps['history']>[number]['snapshot']['recommendation']): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : value === 'watch' ? '观望' : '未形成'
}

function recommendationClass(value: NonNullable<QuantDecisionJournalHistoryProps['history']>[number]['snapshot']['recommendation']): string {
  return value === 'bullish' ? 'quant-decision-value-positive' : value === 'bearish' ? 'quant-decision-value-negative' : 'quant-decision-value-neutral'
}

function formatPrice(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function formatCoverage(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(0)}%`
}

function formatDateTime(value: string | null): string {
  if (!value)
    return '时间未记录'
  return value.length >= 16 ? value.slice(0, 16).replace('T', ' ') : value
}
</script>

<template>
  <section class="quant-decision-history" aria-labelledby="quant-decision-history-title">
    <div class="quant-decision-subheading">
      <div>
        <span id="quant-decision-history-title">股票决策历史</span>
        <small>最近 {{ history.length }} 条</small>
      </div>
      <span v-if="historyLoading" class="quant-decision-history-loading" role="status">读取中</span>
    </div>
    <div v-if="historyErrorMessage" class="quant-decision-history-error" role="alert">
      <AlertCircle :size="14" aria-hidden="true" />
      <span>{{ historyErrorMessage }}</span>
    </div>
    <div v-else-if="historyLoading && !history.length" class="quant-decision-history-state" role="status">
      正在读取历史记录
    </div>
    <div v-else-if="!history.length" class="quant-decision-history-state" role="status">
      还没有这只股票的决策历史
    </div>
    <div v-else class="quant-decision-history-list">
      <article v-for="item in history" :key="item.id" class="quant-decision-history-row">
        <div class="quant-decision-history-main">
          <div>
            <span class="quant-decision-action" :class="`quant-decision-action-${item.action}`">{{ actionLabel(item.action) }}</span>
            <strong :class="recommendationClass(item.snapshot.recommendation)">{{ recommendationLabel(item.snapshot.recommendation) }}</strong>
          </div>
          <p v-if="item.note">
            {{ item.note }}
          </p>
          <small>{{ formatDateTime(item.updatedAt) }} · 快照 {{ formatDateTime(item.snapshot.generatedAt) }}</small>
        </div>
        <div class="quant-decision-history-metrics">
          <strong>{{ formatPrice(item.snapshot.currentPrice) }}</strong>
          <span>覆盖 {{ formatCoverage(item.snapshot.coverage) }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.quant-decision-history {
  display: grid;
  min-width: 0;
  gap: 0.65rem;
  margin-top: 0.15rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.7rem;
}

.quant-decision-subheading {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-decision-subheading > div {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.quant-decision-subheading > div > span {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 720;
}

.quant-decision-subheading small,
.quant-decision-history-row small,
.quant-decision-history-metrics span {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.4;
}

.quant-decision-action {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.2rem 0.42rem;
  font-size: 0.6875rem;
  font-weight: 720;
  white-space: nowrap;
}

.quant-decision-action-watch { border-color: hsl(var(--status-info) / 0.3); background: hsl(var(--status-info-soft)); color: hsl(var(--status-info)); }
.quant-decision-action-plan-buy { border-color: hsl(var(--status-warning) / 0.35); background: hsl(var(--status-warning-soft)); color: hsl(var(--status-warning)); }
.quant-decision-action-holding { border-color: hsl(var(--status-success) / 0.3); background: hsl(var(--status-success-soft)); color: hsl(var(--status-success)); }
.quant-decision-action-sold { border-color: hsl(var(--muted-foreground) / 0.28); background: hsl(var(--muted) / 0.7); color: hsl(var(--muted-foreground)); }

.quant-decision-value-positive { color: hsl(var(--status-success)) !important; }
.quant-decision-value-negative { color: hsl(var(--status-danger)) !important; }
.quant-decision-value-neutral { color: hsl(var(--muted-foreground)) !important; }

.quant-decision-history-loading {
  color: hsl(var(--status-info));
  font-size: 0.6875rem;
}

.quant-decision-history-state,
.quant-decision-history-error {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-decision-history-state {
  min-height: 2.25rem;
  justify-content: center;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.55rem 0;
}

.quant-decision-history-error {
  border: 1px solid hsl(var(--status-danger) / 0.25);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-danger-soft));
  padding: 0.55rem 0.65rem;
  color: hsl(var(--status-danger));
}

.quant-decision-history-error span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quant-decision-history-list {
  display: grid;
  gap: 0.4rem;
}

.quant-decision-history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  min-width: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.72);
  padding: 0.45rem 0;
}

.quant-decision-history-row:last-child {
  border-bottom: 0;
}

.quant-decision-history-main {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.quant-decision-history-main > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.quant-decision-history-main > div > strong {
  font-size: 0.75rem;
}

.quant-decision-history-main p {
  margin: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.quant-decision-history-metrics {
  display: grid;
  align-content: start;
  justify-items: end;
  gap: 0.2rem;
  min-width: 4.5rem;
  text-align: right;
}

.quant-decision-history-metrics strong {
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}

@media (max-width: 680px) {
  .quant-decision-history-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem;
  }

  .quant-decision-history-metrics {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    min-width: 0;
    text-align: left;
  }
}
</style>
