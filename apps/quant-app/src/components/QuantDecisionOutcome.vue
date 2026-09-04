<script setup lang="ts">
import type { QuantDecisionRecord, QuantDecisionRecordAction } from '../lib/quant-view-models'
import { CircleHelp, GitCompareArrows, Target } from 'lucide-vue-next'
import { computed } from 'vue'
import { buildDecisionOutcome } from '../lib/decision-outcome'

const props = defineProps<{
  history: QuantDecisionRecord[]
  latestPrice: number | null
  latestPriceObservedAt: string | null
}>()

const outcome = computed(() => buildDecisionOutcome(props.history, {
  price: props.latestPrice,
  observedAt: props.latestPriceObservedAt,
}))
const visibleEntries = computed(() => outcome.value.entries.slice(-4).reverse())

function actionLabel(action: QuantDecisionRecordAction): string {
  return action === 'plan-buy' ? '计划买入' : action === 'holding' ? '已持有' : action === 'sold' ? '已卖出' : '继续观察'
}

function statusLabel(status: typeof outcome.value.status): string {
  return {
    empty: '暂无可回看',
    pending: '等待后续价格',
    observed: '已有后续观察',
    completed: '已有卖出配对',
  }[status]
}

function statusClass(status: typeof outcome.value.status): string {
  return `quant-decision-outcome-status-${status}`
}

function kindLabel(kind: 'sold' | 'recorded' | 'current'): string {
  return kind === 'sold' ? '已卖出配对' : kind === 'current' ? '当前最新日线' : '后续记录'
}

function formatPrice(value: number): string {
  return value.toFixed(2)
}

function formatChange(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function changeClass(value: number): string {
  return value > 0 ? 'quant-decision-outcome-change-positive' : value < 0 ? 'quant-decision-outcome-change-negative' : 'quant-decision-outcome-change-neutral'
}

function formatDate(value: string): string {
  const compact = value.replace(/\D/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    : value.slice(0, 10)
}
</script>

<template>
  <section class="quant-decision-outcome" aria-labelledby="quant-decision-outcome-title">
    <div class="quant-decision-outcome-heading">
      <div>
        <p class="section-kicker">
          OUTCOME REVIEW
        </p>
        <h4 id="quant-decision-outcome-title">
          记录结果回看
        </h4>
        <small>只比较记录时的价格变化，不替代真实成交复盘。</small>
      </div>
      <span class="quant-decision-outcome-status" :class="statusClass(outcome.status)">
        {{ statusLabel(outcome.status) }}
      </span>
    </div>

    <p class="quant-decision-outcome-headline">
      {{ outcome.headline }}
    </p>

    <div class="quant-decision-outcome-summary" role="list" aria-label="决策结果回看统计">
      <div role="listitem">
        <GitCompareArrows :size="15" aria-hidden="true" />
        <span>已观察</span>
        <strong>{{ outcome.entries.length }}</strong>
        <small>次价格变化</small>
      </div>
      <div role="listitem">
        <Target :size="15" aria-hidden="true" />
        <span>已卖出配对</span>
        <strong>{{ outcome.completedCount }}</strong>
        <small>个起点</small>
      </div>
      <div role="listitem">
        <CircleHelp :size="15" aria-hidden="true" />
        <span>待观察</span>
        <strong>{{ outcome.pendingCount }}</strong>
        <small>个有效起点</small>
      </div>
    </div>

    <div v-if="visibleEntries.length" class="quant-decision-outcome-list">
      <article v-for="entry in visibleEntries" :key="`${entry.baselineId}-${entry.observationId || entry.observationKind}`" class="quant-decision-outcome-row">
        <div class="quant-decision-outcome-row-heading">
          <div>
            <span class="quant-decision-outcome-action">{{ actionLabel(entry.baselineAction) }}</span>
            <span class="quant-decision-outcome-kind">{{ kindLabel(entry.observationKind) }}</span>
          </div>
          <strong class="quant-decision-outcome-change" :class="changeClass(entry.changePercent)">{{ formatChange(entry.changePercent) }}</strong>
        </div>
        <div class="quant-decision-outcome-price">
          <strong>{{ formatPrice(entry.baselinePrice) }}</strong>
          <span>→</span>
          <strong>{{ formatPrice(entry.observationPrice) }}</strong>
        </div>
        <small>{{ formatDate(entry.baselineObservedAt) }} → {{ formatDate(entry.observationObservedAt) }}<span v-if="entry.observationAction"> · {{ actionLabel(entry.observationAction) }}</span></small>
      </article>
    </div>
    <div v-else class="quant-decision-outcome-empty" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>{{ outcome.status === 'pending' ? '保存一条更晚的决策或等待新的日线，再回看这次价格变化。' : '先记录“计划买入”或“已持有”，这里会自动形成后续观察。' }}</span>
    </div>

    <p class="quant-decision-outcome-note">
      口径说明：以上是决策快照之间的价格变化，不含实际成交价、仓位数量、手续费、税费和分红，因此不等同于实际收益。
    </p>
  </section>
</template>

<style scoped>
.quant-decision-outcome {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.15rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.7rem;
}

.quant-decision-outcome-heading,
.quant-decision-outcome-row-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-decision-outcome-heading h4 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 720;
}

.quant-decision-outcome-heading small,
.quant-decision-outcome-row > small,
.quant-decision-outcome-note {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-decision-outcome-heading small {
  display: block;
  margin-top: 0.25rem;
}

.quant-decision-outcome-status {
  flex: 0 0 auto;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.2rem 0.42rem;
  font-size: 0.6875rem;
  font-weight: 720;
  white-space: nowrap;
}

.quant-decision-outcome-status-empty,
.quant-decision-outcome-status-pending {
  border-color: hsl(var(--status-warning) / 0.32);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-decision-outcome-status-observed {
  border-color: hsl(var(--status-info) / 0.32);
  background: hsl(var(--status-info-soft));
  color: hsl(var(--status-info));
}

.quant-decision-outcome-status-completed {
  border-color: hsl(var(--status-success) / 0.32);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-decision-outcome-headline,
.quant-decision-outcome-note {
  margin: 0;
}

.quant-decision-outcome-headline {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.5;
}

.quant-decision-outcome-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.quant-decision-outcome-summary > div {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.18rem 0.35rem;
  min-width: 0;
  border-left: 2px solid hsl(var(--border));
  padding: 0.2rem 0.5rem;
}

.quant-decision-outcome-summary > div > svg {
  grid-row: 1 / span 2;
  color: hsl(var(--status-info));
}

.quant-decision-outcome-summary span,
.quant-decision-outcome-summary small {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.3;
}

.quant-decision-outcome-summary strong {
  grid-row: 1 / span 2;
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}

.quant-decision-outcome-list {
  display: grid;
  gap: 0.4rem;
}

.quant-decision-outcome-row {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.72);
  padding: 0.45rem 0;
}

.quant-decision-outcome-row:last-child {
  border-bottom: 0;
}

.quant-decision-outcome-row-heading > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.quant-decision-outcome-action,
.quant-decision-outcome-kind {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.17rem 0.35rem;
  font-size: 0.625rem;
  font-weight: 720;
  white-space: nowrap;
}

.quant-decision-outcome-action {
  background: hsl(var(--accent));
  color: hsl(var(--primary));
}

.quant-decision-outcome-kind {
  background: hsl(var(--muted) / 0.65);
  color: hsl(var(--muted-foreground));
}

.quant-decision-outcome-change {
  flex: 0 0 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.quant-decision-outcome-change-positive {
  color: hsl(var(--status-success));
}

.quant-decision-outcome-change-negative {
  color: hsl(var(--status-danger));
}

.quant-decision-outcome-change-neutral {
  color: hsl(var(--muted-foreground));
}

.quant-decision-outcome-price {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  color: hsl(var(--muted-foreground));
}

.quant-decision-outcome-price strong {
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.quant-decision-outcome-price span {
  font-size: 0.75rem;
}

.quant-decision-outcome-empty {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.55rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-decision-outcome-empty span {
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 680px) {
  .quant-decision-outcome-summary {
    grid-template-columns: 1fr;
  }

  .quant-decision-outcome-summary > div {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
}
</style>
