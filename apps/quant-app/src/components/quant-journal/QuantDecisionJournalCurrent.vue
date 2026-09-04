<script setup lang="ts">
import type { QuantDecisionJournalCurrentProps } from './quant-journal-contracts'
import { CircleHelp } from 'lucide-vue-next'

defineProps<QuantDecisionJournalCurrentProps>()

function actionLabel(action: NonNullable<QuantDecisionJournalCurrentProps['record']>['action']): string {
  return {
    'watch': '继续观察',
    'plan-buy': '计划买入',
    'holding': '已持有',
    'sold': '已卖出',
  }[action]
}

function recommendationLabel(value: NonNullable<QuantDecisionJournalCurrentProps['record']>['snapshot']['recommendation']): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : value === 'watch' ? '观望' : '未形成'
}

function recommendationClass(value: NonNullable<QuantDecisionJournalCurrentProps['record']>['snapshot']['recommendation']): string {
  return value === 'bullish' ? 'quant-decision-value-positive' : value === 'bearish' ? 'quant-decision-value-negative' : 'quant-decision-value-neutral'
}

function formatPrice(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function formatPriceRange(value: NonNullable<QuantDecisionJournalCurrentProps['record']>['snapshot']['buyPriceRange']): string {
  return value ? `${formatPrice(value.low)} - ${formatPrice(value.high)}` : '--'
}

function formatCoverage(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(0)}%`
}

function formatImpactScore(value: number | null | undefined): string {
  return value === null || value === undefined ? '--' : value.toFixed(1)
}

function formatImpactDelta(value: number | null | undefined): string {
  if (value === null || value === undefined)
    return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

function formatDateTime(value: string | null): string {
  if (!value)
    return '时间未记录'
  return value.length >= 16 ? value.slice(0, 16).replace('T', ' ') : value
}

function formatSnapshotDate(value: string | null): string {
  if (!value)
    return '日期未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    : value.slice(0, 10)
}

function aiReviewLabel(record: NonNullable<QuantDecisionJournalCurrentProps['record']>): string {
  const review = record.snapshot.aiDecisionReview
  if (!review)
    return '未生成'
  if (review.accepted)
    return '已纳入推荐'
  if (review.rejectionReason === 'deterministic-watch')
    return '数据不足，保持观望'
  if (review.rejectionReason === 'factor-review-incomplete')
    return '因子复核不足'
  if (review.rejectionReason === 'factor-conflict')
    return '因子方向冲突'
  return '低置信度，保留确定性结论'
}

function aiReviewClass(record: NonNullable<QuantDecisionJournalCurrentProps['record']>): string {
  const review = record.snapshot.aiDecisionReview
  if (!review)
    return 'quant-decision-value-neutral'
  return review.accepted ? 'quant-decision-value-positive' : 'quant-decision-value-warning'
}
</script>

<template>
  <section class="quant-decision-current" aria-label="当前决策快照">
    <div class="quant-decision-subheading">
      <div>
        <span>当前记录</span>
        <small v-if="record">更新于 {{ formatDateTime(record.updatedAt) }}</small>
      </div>
      <span v-if="record" class="quant-decision-action" :class="`quant-decision-action-${record.action}`">{{ actionLabel(record.action) }}</span>
    </div>
    <div v-if="record" class="quant-decision-snapshot-grid">
      <div>
        <span>报告推荐</span>
        <strong :class="recommendationClass(record.snapshot.recommendation)">{{ recommendationLabel(record.snapshot.recommendation) }}</strong>
        <small>{{ record.snapshot.reportVersion }}</small>
      </div>
      <div>
        <span>证据覆盖</span>
        <strong>{{ formatCoverage(record.snapshot.coverage) }}</strong>
        <small>{{ record.snapshot.evidenceKeys.length }} 条引用证据</small>
      </div>
      <div>
        <span>记录时价格</span>
        <strong>{{ formatPrice(record.snapshot.currentPrice) }}</strong>
        <small>{{ formatSnapshotDate(record.snapshot.currentPriceObservedAt) }}</small>
      </div>
      <div>
        <span>AI 复核</span>
        <strong :class="aiReviewClass(record)">{{ aiReviewLabel(record) }}</strong>
        <small>{{ record.snapshot.aiDecisionReview ? `置信度 ${record.snapshot.aiDecisionReview.confidence.toFixed(0)} · 因子复核 ${record.snapshot.aiDecisionReview.factorReviewCoverage.toFixed(0)}%` : '当前快照未保存 AI 复核' }}</small>
      </div>
    </div>
    <div v-if="record" class="quant-decision-price-row">
      <span>参考买入区间 <strong>{{ formatPriceRange(record.snapshot.buyPriceRange) }}</strong></span>
      <span>参考卖出区间 <strong>{{ formatPriceRange(record.snapshot.sellPriceRange) }}</strong></span>
      <span v-if="record.snapshot.factorConfiguration">因子配置 <strong>{{ record.snapshot.factorConfiguration.source === 'user' ? '当前用户配置' : '内置默认' }}</strong></span>
      <span v-if="record.snapshot.aiFactorReviews.length">AI 因子复核 <strong>{{ record.snapshot.aiFactorReviews.length }} 项</strong></span>
      <span v-if="record.snapshot.factorImpact">AI 影响分 <strong>{{ formatImpactScore(record.snapshot.factorImpact.aiScore) }}</strong> · 分差 {{ formatImpactDelta(record.snapshot.factorImpact.aiScoreDelta) }}</span>
      <span v-if="record.snapshot.factorImpact?.evaluatedAt">AI 影响快照 <strong>{{ formatDateTime(record.snapshot.factorImpact.evaluatedAt) }}</strong></span>
    </div>
    <div v-if="record?.note" class="quant-decision-current-note">
      <span>当时备注</span>
      <p>{{ record.note }}</p>
    </div>
    <div v-else-if="!loading && !loadErrorMessage" class="quant-decision-empty">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>本次研究还没有决策记录，提交下方判断即可开始复盘。</span>
    </div>
  </section>
</template>

<style scoped>
.quant-decision-current {
  display: grid;
  min-width: 0;
  gap: 0.65rem;
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
.quant-decision-snapshot-grid span,
.quant-decision-snapshot-grid small,
.quant-decision-price-row,
.quant-decision-current-note > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.35;
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

.quant-decision-snapshot-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.quant-decision-snapshot-grid > div {
  display: grid;
  min-width: 0;
  gap: 0.16rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.2rem 0.55rem;
}

.quant-decision-snapshot-grid strong,
.quant-decision-price-row strong {
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}

.quant-decision-value-positive { color: hsl(var(--status-success)) !important; }
.quant-decision-value-negative { color: hsl(var(--status-danger)) !important; }
.quant-decision-value-warning { color: hsl(var(--status-warning)) !important; }
.quant-decision-value-neutral { color: hsl(var(--muted-foreground)) !important; }

.quant-decision-price-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 1rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-decision-price-row span {
  min-width: 0;
}

.quant-decision-price-row strong {
  margin-left: 0.25rem;
}

.quant-decision-current-note {
  display: grid;
  gap: 0.25rem;
  border-left: 2px solid hsl(var(--status-info) / 0.45);
  padding-left: 0.55rem;
}

.quant-decision-current-note p {
  margin: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.quant-decision-empty {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

@media (max-width: 680px) {
  .quant-decision-snapshot-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
