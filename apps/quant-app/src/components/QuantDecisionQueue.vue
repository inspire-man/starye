<script setup lang="ts">
import type { CandidateItem, QuantDecisionRecord, WatchlistItem } from '../lib/quant-types'
import { ArrowRight, ChevronRight, CircleHelp, History, RefreshCw, Target } from 'lucide-vue-next'
import { computed } from 'vue'
import {
  buildQuantDecisionQueue,
  quantDecisionQueueActionLabel,
  quantDecisionQueueRecommendationLabel,
} from '../lib/decision-queue'

const props = defineProps<{
  records: QuantDecisionRecord[]
  candidates: CandidateItem[]
  watchlist: WatchlistItem[]
  candidateTradeDate: string | null
  loading: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  focus: [tsCode: string]
}>()

const queue = computed(() => buildQuantDecisionQueue({
  records: props.records,
  candidates: props.candidates,
  watchlist: props.watchlist,
  candidateTradeDate: props.candidateTradeDate,
  limit: 6,
}))

function actionClass(action: QuantDecisionRecord['action']): string {
  return `candidate-decision-queue-action-${action}`
}

function recommendationLabel(value: QuantDecisionRecord['snapshot']['recommendation']): string {
  return quantDecisionQueueRecommendationLabel(value)
}

function recommendationClass(value: QuantDecisionRecord['snapshot']['recommendation']): string {
  return value ? `candidate-decision-queue-recommendation-${value}` : 'candidate-decision-queue-recommendation-watch'
}

function observationLabel(item: ReturnType<typeof buildQuantDecisionQueue>['items'][number]): string {
  return item.observation === 'newer-price'
    ? '已有新日线'
    : item.observation === 'same-day'
      ? '等待新日线'
      : item.observation === 'missing-price'
        ? '价格待补'
        : '当前不在候选快照'
}

function observationClass(item: ReturnType<typeof buildQuantDecisionQueue>['items'][number]): string {
  return `candidate-decision-queue-observation-${item.observation}`
}

function formatPrice(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(2)} 元`
}

function formatChange(value: number | null): string {
  if (value === null)
    return '暂不计算价格变化'
  return `记录后 ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatDate(value: string | null): string {
  if (!value)
    return '日期未记录'
  const compact = value.replace(/\D/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    : value.slice(0, 10)
}
</script>

<template>
  <section class="candidate-decision-queue" aria-labelledby="candidate-decision-queue-title">
    <div class="candidate-decision-queue-heading">
      <div>
        <p class="section-kicker">
          MY DECISION QUEUE
        </p>
        <h3 id="candidate-decision-queue-title">
          决策待办
        </h3>
        <p>把最近保存的判断带回候选页，先处理自己的计划和复查。</p>
      </div>
      <span class="candidate-decision-queue-meta">最近 {{ queue.totalRecords }} 条</span>
    </div>

    <div v-if="loading" class="candidate-decision-queue-state" role="status">
      <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
      <span>正在读取决策待办</span>
    </div>
    <div v-else-if="errorMessage" class="candidate-decision-queue-state candidate-decision-queue-state-error" role="alert">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </div>
    <div v-else-if="!queue.items.length" class="candidate-decision-queue-state" role="status">
      <History :size="15" aria-hidden="true" />
      <span>还没有保存的决策，打开候选详情后记录你的判断。</span>
    </div>
    <template v-else>
      <div class="candidate-decision-queue-summary" role="list" aria-label="决策待办统计">
        <div role="listitem">
          <History :size="14" aria-hidden="true" />
          <span>已记录</span>
          <strong>{{ queue.summary.total }}</strong>
        </div>
        <div role="listitem">
          <Target :size="14" aria-hidden="true" />
          <span>计划 / 持有</span>
          <strong>{{ queue.summary.active }}</strong>
        </div>
        <div role="listitem">
          <CircleHelp :size="14" aria-hidden="true" />
          <span>已卖出</span>
          <strong>{{ queue.summary.sold }}</strong>
        </div>
      </div>
      <div class="candidate-decision-queue-list">
        <button
          v-for="item in queue.items"
          :key="item.record.id"
          class="candidate-decision-queue-row"
          type="button"
          :disabled="!item.availableInWatchlist"
          :title="item.availableInWatchlist ? '打开研究详情' : '该股票已不在观察池，暂时无法打开详情'"
          @click="emit('focus', item.tsCode)"
        >
          <div class="candidate-decision-queue-row-heading">
            <span class="candidate-decision-queue-action" :class="actionClass(item.record.action)">{{ quantDecisionQueueActionLabel(item.record.action) }}</span>
            <span class="candidate-decision-queue-stock">
              <strong>{{ item.name }}</strong>
              <small>{{ item.tsCode }}</small>
            </span>
            <span class="candidate-decision-queue-recommendation" :class="recommendationClass(item.record.snapshot.recommendation)">{{ recommendationLabel(item.record.snapshot.recommendation) }}</span>
            <ChevronRight :size="15" aria-hidden="true" />
          </div>
          <div class="candidate-decision-queue-row-detail">
            <span class="candidate-decision-queue-observation" :class="observationClass(item)">{{ observationLabel(item) }}</span>
            <span class="candidate-decision-queue-prices">
              <span>记录 {{ formatPrice(item.record.snapshot.currentPrice) }}</span>
              <ArrowRight :size="13" aria-hidden="true" />
              <span>当前 {{ formatPrice(item.currentPrice) }}</span>
            </span>
            <small>{{ formatChange(item.changePercent) }} · {{ formatDate(item.currentTradeDate || item.record.snapshot.currentPriceObservedAt) }}</small>
          </div>
        </button>
      </div>
      <p v-if="queue.totalRecords > queue.items.length" class="candidate-decision-queue-more">
        还有 {{ queue.totalRecords - queue.items.length }} 条记录，打开具体股票查看完整历史。
      </p>
    </template>
  </section>
</template>

<style scoped>
.candidate-decision-queue {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.9rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.85rem;
}

.candidate-decision-queue-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.candidate-decision-queue-heading h3 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 720;
}

.candidate-decision-queue-heading p:not(.section-kicker) {
  margin: 0.25rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.candidate-decision-queue-meta,
.candidate-decision-queue-more,
.candidate-decision-queue-row-detail,
.candidate-decision-queue-stock small {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.4;
}

.candidate-decision-queue-meta {
  flex: 0 0 auto;
  padding-top: 0.2rem;
  white-space: nowrap;
}

.candidate-decision-queue-state {
  display: flex;
  min-height: 2.4rem;
  align-items: center;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.55rem 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.candidate-decision-queue-state-error {
  border-color: hsl(var(--status-danger) / 0.25);
  background: hsl(var(--status-danger-soft));
  padding-inline: 0.6rem;
  color: hsl(var(--status-danger));
}

.candidate-decision-queue-state span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.candidate-decision-queue-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.candidate-decision-queue-summary > div {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.15rem 0.35rem;
  min-width: 0;
  border-left: 2px solid hsl(var(--border));
  padding: 0.2rem 0.5rem;
}

.candidate-decision-queue-summary svg {
  grid-row: 1 / span 2;
  color: hsl(var(--status-info));
}

.candidate-decision-queue-summary span {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.3;
}

.candidate-decision-queue-summary strong {
  grid-row: 1 / span 2;
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}

.candidate-decision-queue-list {
  display: grid;
  gap: 0.35rem;
}

.candidate-decision-queue-row {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.35rem;
  border: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.72);
  background: transparent;
  padding: 0.45rem 0;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.candidate-decision-queue-row:last-child {
  border-bottom: 0;
}

.candidate-decision-queue-row:hover:not(:disabled) {
  background: hsl(var(--muted) / 0.3);
}

.candidate-decision-queue-row:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.candidate-decision-queue-row:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.candidate-decision-queue-row-heading,
.candidate-decision-queue-row-detail {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
}

.candidate-decision-queue-row-heading > svg {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground));
}

.candidate-decision-queue-action,
.candidate-decision-queue-recommendation,
.candidate-decision-queue-observation {
  display: inline-flex;
  width: fit-content;
  flex: 0 0 auto;
  align-items: center;
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.17rem 0.35rem;
  font-size: 0.625rem;
  font-weight: 720;
  white-space: nowrap;
}

.candidate-decision-queue-action-watch,
.candidate-decision-queue-recommendation-watch {
  background: hsl(var(--status-info-soft));
  color: hsl(var(--status-info));
}

.candidate-decision-queue-action-plan-buy {
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.candidate-decision-queue-action-holding,
.candidate-decision-queue-recommendation-bullish {
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.candidate-decision-queue-action-sold,
.candidate-decision-queue-recommendation-bearish {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.candidate-decision-queue-stock {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.08rem;
}

.candidate-decision-queue-stock strong {
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 720;
  line-height: 1.35;
}

.candidate-decision-queue-stock small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.candidate-decision-queue-recommendation {
  border: 1px solid hsl(var(--border));
}

.candidate-decision-queue-row-detail {
  flex-wrap: wrap;
  padding-left: 0.2rem;
}

.candidate-decision-queue-observation-newer-price {
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.candidate-decision-queue-observation-same-day {
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.candidate-decision-queue-observation-missing-price,
.candidate-decision-queue-observation-outside-candidate {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.candidate-decision-queue-prices {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

.candidate-decision-queue-row-detail small {
  overflow-wrap: anywhere;
}

.candidate-decision-queue-more {
  margin: 0;
}

@media (max-width: 680px) {
  .candidate-decision-queue-heading {
    flex-direction: column;
    gap: 0.2rem;
  }

  .candidate-decision-queue-meta {
    padding-top: 0;
  }

  .candidate-decision-queue-row-heading {
    align-items: flex-start;
  }

  .candidate-decision-queue-row-detail {
    align-items: flex-start;
    padding-left: 0;
  }
}
</style>
