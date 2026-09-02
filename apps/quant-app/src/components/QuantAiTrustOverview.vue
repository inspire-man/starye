<script setup lang="ts">
import type { QuantAiTrustOverviewItem, QuantAiTrustOverviewItemStatus } from '../lib/ai-trust-overview'
import type { CandidateItem, QuantDecisionRecord, QuantRecommendation, WatchlistItem } from '../lib/quant-types'
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, CircleHelp, Clock3, Minus, RefreshCw, XCircle } from 'lucide-vue-next'
import { computed } from 'vue'
import { buildQuantAiTrustOverview } from '../lib/ai-trust-overview'

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

const overview = computed(() => buildQuantAiTrustOverview({
  records: props.records,
  candidates: props.candidates,
  watchlist: props.watchlist,
  candidateTradeDate: props.candidateTradeDate,
}))

const visibleItems = computed(() => overview.value.items.slice(0, 8))

function statusLabel(value: QuantAiTrustOverviewItemStatus): string {
  return {
    'aligned': '方向一致',
    'opposed': '方向相反',
    'flat': '价格未变化',
    'pending': '等待新日线',
    'unavailable': '数据不可比',
    'not-accepted': '未纳入 AI',
    'inactive': '非活动记录',
  }[value]
}

function statusClass(value: QuantAiTrustOverviewItemStatus): string {
  return `quant-ai-trust-overview-status-${value}`
}

function statusIcon(value: QuantAiTrustOverviewItemStatus) {
  return value === 'aligned' ? CheckCircle2 : value === 'opposed' ? XCircle : value === 'flat' ? Minus : value === 'pending' ? Clock3 : value === 'unavailable' ? AlertTriangle : CircleHelp
}

function actionLabel(value: QuantDecisionRecord['action']): string {
  return value === 'plan-buy' ? '计划买入' : value === 'holding' ? '已持有' : value === 'sold' ? '已卖出' : '继续观察'
}

function recommendationLabel(value: QuantRecommendation | null): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : value === 'watch' ? '观望' : '未复核'
}

function deterministicRecommendationLabel(value: QuantDecisionRecord['snapshot']['recommendation']): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : value === 'watch' ? '观望' : '未形成'
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

function formatImpactDelta(value: number | null): string {
  if (value === null)
    return 'AI 影响分差未保存'
  return `AI 影响分差 ${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

function hasObservedChange(item: QuantAiTrustOverviewItem): boolean {
  return (item.status === 'aligned' || item.status === 'opposed' || item.status === 'flat') && item.changePercent !== null
}

function reviewDetail(item: QuantAiTrustOverviewItem): string {
  if (item.status === 'pending')
    return '当前价格日期不晚于记录日期，等待下一交易日数据'
  if (item.status === 'unavailable')
    return '记录价格或当前有效交易日缺失，暂不比较'
  if (item.status === 'not-accepted')
    return item.record.snapshot.aiDecisionReview ? 'AI 已复核，但未达到纳入最终判断的条件' : '尚未保存结构化 AI 决策复核'
  if (item.status === 'inactive')
    return `${actionLabel(item.record.action)}不进入当前方向观察样本`
  return `${formatDate(item.record.snapshot.currentPriceObservedAt)} → ${formatDate(item.currentTradeDate)}`
}
</script>

<template>
  <section class="quant-ai-trust-overview" aria-labelledby="quant-ai-trust-overview-title">
    <div class="quant-ai-trust-overview-heading">
      <div>
        <p class="section-kicker">
          AI TRUST CHECK
        </p>
        <h3 id="quant-ai-trust-overview-title">
          AI 信任总览
        </h3>
        <p>先看最近决策是否已纳入 AI、有没有后续价格观察，再进入单只股票详情。</p>
      </div>
      <span class="quant-ai-trust-overview-meta">
        最近 {{ overview.summary.total }} 条决策
      </span>
    </div>

    <div v-if="loading" class="quant-ai-trust-overview-state" role="status">
      <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
      <span>正在读取 AI 决策状态</span>
    </div>
    <div v-else-if="errorMessage" class="quant-ai-trust-overview-state quant-ai-trust-overview-state-error" role="alert">
      <AlertTriangle :size="15" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </div>
    <div v-else-if="!overview.summary.total" class="quant-ai-trust-overview-state" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>还没有保存的决策，先在研究详情中完成一次 AI 复核并记录判断。</span>
    </div>
    <template v-else>
      <div class="quant-ai-trust-overview-summary" role="list" aria-label="AI 信任总览统计">
        <div role="listitem">
          <BrainCircuit :size="14" aria-hidden="true" />
          <span>已纳入</span>
          <strong>{{ overview.summary.accepted }}</strong>
        </div>
        <div role="listitem">
          <Clock3 :size="14" aria-hidden="true" />
          <span>待观察</span>
          <strong>{{ overview.summary.pending }}</strong>
        </div>
        <div role="listitem">
          <CheckCircle2 :size="14" aria-hidden="true" />
          <span>方向一致</span>
          <strong>{{ overview.summary.aligned }}</strong>
        </div>
        <div role="listitem">
          <XCircle :size="14" aria-hidden="true" />
          <span>方向相反</span>
          <strong>{{ overview.summary.opposed }}</strong>
        </div>
        <div role="listitem">
          <Minus :size="14" aria-hidden="true" />
          <span>价格未变化</span>
          <strong>{{ overview.summary.flat }}</strong>
        </div>
      </div>

      <p class="quant-ai-trust-overview-boundary">
        当前队列最近记录：方向样本 {{ overview.summary.directionalSampleCount }} 条 · {{ overview.summary.agreementRate === null ? '样本不足 3 条，不计算一致率' : `方向一致率 ${overview.summary.agreementRate.toFixed(0)}%` }}；这不是长期准确率或收益保证。
      </p>

      <div class="quant-ai-trust-overview-list">
        <button
          v-for="item in visibleItems"
          :key="item.record.id"
          class="quant-ai-trust-overview-row"
          type="button"
          :title="`打开${item.name}研究详情`"
          @click="emit('focus', item.tsCode)"
        >
          <div class="quant-ai-trust-overview-row-heading">
            <component :is="statusIcon(item.status)" :size="15" aria-hidden="true" />
            <span class="quant-ai-trust-overview-stock">
              <strong>{{ item.name }}</strong>
              <small>{{ item.tsCode }}</small>
            </span>
            <span class="quant-ai-trust-overview-status" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
            <ArrowRight :size="14" aria-hidden="true" />
          </div>
          <div class="quant-ai-trust-overview-row-detail">
            <span>{{ actionLabel(item.record.action) }}</span>
            <span>AI {{ item.aiRecommendation === null ? '未复核' : recommendationLabel(item.aiRecommendation) }}</span>
            <span>确定性 {{ deterministicRecommendationLabel(item.record.snapshot.recommendation) }}</span>
            <span v-if="item.confidence !== null">置信度 {{ item.confidence.toFixed(0) }}</span>
            <span v-if="item.factorReviewCoverage !== null">因子 {{ item.factorReviewCoverage.toFixed(0) }}%</span>
          </div>
          <div class="quant-ai-trust-overview-row-observation">
            <span v-if="hasObservedChange(item)">{{ formatPrice(item.record.snapshot.currentPrice) }} → {{ formatPrice(item.currentPrice) }} · {{ formatChange(item.changePercent) }}</span>
            <span v-else>{{ reviewDetail(item) }}</span>
            <small v-if="item.aiAccepted">{{ formatImpactDelta(item.aiScoreDelta) }}</small>
          </div>
        </button>
      </div>
      <p v-if="overview.summary.total > visibleItems.length" class="quant-ai-trust-overview-more">
        还有 {{ overview.summary.total - visibleItems.length }} 条最近决策，打开具体股票查看完整历史。
      </p>
    </template>

    <p class="quant-ai-trust-overview-note">
      口径说明：总览只读取已保存决策快照与当前已加载行情；AI 影响分差不改写确定性评分、因子权重或参考价格区间。
    </p>
  </section>
</template>

<style scoped>
.quant-ai-trust-overview {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.9rem;
  border-top: 1px solid hsl(var(--status-info) / 0.34);
  padding-top: 0.85rem;
}

.quant-ai-trust-overview-heading,
.quant-ai-trust-overview-row-heading,
.quant-ai-trust-overview-row-detail,
.quant-ai-trust-overview-row-observation {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
}

.quant-ai-trust-overview-heading {
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-ai-trust-overview-heading h3 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 720;
}

.quant-ai-trust-overview-heading p:not(.section-kicker),
.quant-ai-trust-overview-boundary,
.quant-ai-trust-overview-note,
.quant-ai-trust-overview-more {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-ai-trust-overview-heading p:not(.section-kicker) {
  margin: 0.25rem 0 0;
}

.quant-ai-trust-overview-meta {
  flex: 0 0 auto;
  padding-top: 0.2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  white-space: nowrap;
}

.quant-ai-trust-overview-state {
  display: flex;
  min-width: 0;
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

.quant-ai-trust-overview-state span,
.quant-ai-trust-overview-note,
.quant-ai-trust-overview-boundary,
.quant-ai-trust-overview-more,
.quant-ai-trust-overview-row-observation span,
.quant-ai-trust-overview-row-observation small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quant-ai-trust-overview-state-error {
  border-color: hsl(var(--status-danger) / 0.25);
  background: hsl(var(--status-danger-soft));
  padding-inline: 0.6rem;
  color: hsl(var(--status-danger));
}

.quant-ai-trust-overview-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-ai-trust-overview-summary > div {
  display: grid;
  grid-template-columns: auto 1fr auto;
  min-width: 0;
  align-items: center;
  gap: 0.18rem 0.35rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.2rem 0.45rem;
}

.quant-ai-trust-overview-summary > div > svg {
  grid-row: 1 / span 2;
  color: hsl(var(--status-info));
}

.quant-ai-trust-overview-summary span {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.3;
}

.quant-ai-trust-overview-summary strong {
  grid-row: 1 / span 2;
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}

.quant-ai-trust-overview-boundary,
.quant-ai-trust-overview-note,
.quant-ai-trust-overview-more {
  margin: 0;
}

.quant-ai-trust-overview-boundary {
  border-left: 2px solid hsl(var(--status-info) / 0.35);
  padding-left: 0.5rem;
}

.quant-ai-trust-overview-list {
  display: grid;
  gap: 0.35rem;
}

.quant-ai-trust-overview-row {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.28rem;
  border: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.72);
  background: transparent;
  padding: 0.45rem 0;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.quant-ai-trust-overview-row:last-child {
  border-bottom: 0;
}

.quant-ai-trust-overview-row:hover {
  background: hsl(var(--muted) / 0.3);
}

.quant-ai-trust-overview-row:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.quant-ai-trust-overview-row-heading > svg {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground));
}

.quant-ai-trust-overview-stock {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.08rem;
}

.quant-ai-trust-overview-stock strong {
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 720;
  line-height: 1.35;
}

.quant-ai-trust-overview-stock small,
.quant-ai-trust-overview-row-detail,
.quant-ai-trust-overview-row-observation {
  color: hsl(var(--muted-foreground));
  font-size: 0.65625rem;
  line-height: 1.4;
}

.quant-ai-trust-overview-stock small {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.quant-ai-trust-overview-status {
  display: inline-flex;
  max-width: 100%;
  flex: 0 0 auto;
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.17rem 0.35rem;
  font-size: 0.625rem;
  font-weight: 720;
  line-height: 1.3;
  white-space: nowrap;
}

.quant-ai-trust-overview-status-aligned {
  border-color: hsl(var(--status-success) / 0.3);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-ai-trust-overview-status-opposed {
  border-color: hsl(var(--status-danger) / 0.3);
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.quant-ai-trust-overview-status-flat,
.quant-ai-trust-overview-status-pending {
  border-color: hsl(var(--status-warning) / 0.3);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-ai-trust-overview-status-unavailable,
.quant-ai-trust-overview-status-not-accepted,
.quant-ai-trust-overview-status-inactive {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.7);
  color: hsl(var(--muted-foreground));
}

.quant-ai-trust-overview-row-heading > svg:last-child {
  flex: 0 0 auto;
}

.quant-ai-trust-overview-row-detail,
.quant-ai-trust-overview-row-observation {
  flex-wrap: wrap;
  align-items: flex-start;
  padding-left: 1.35rem;
}

.quant-ai-trust-overview-row-detail > span,
.quant-ai-trust-overview-row-observation > span,
.quant-ai-trust-overview-row-observation > small {
  overflow-wrap: anywhere;
}

.quant-ai-trust-overview-row-detail > span:not(:last-child)::after {
  margin-left: 0.45rem;
  color: hsl(var(--border));
  content: '·';
}

.quant-ai-trust-overview-row-observation {
  justify-content: space-between;
  gap: 0.4rem;
}

.quant-ai-trust-overview-row-observation small {
  color: hsl(var(--status-info));
}

@media (max-width: 680px) {
  .quant-ai-trust-overview-heading {
    flex-direction: column;
    gap: 0.2rem;
  }

  .quant-ai-trust-overview-meta {
    padding-top: 0;
  }

  .quant-ai-trust-overview-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quant-ai-trust-overview-row-heading {
    align-items: flex-start;
  }

  .quant-ai-trust-overview-status {
    white-space: normal;
  }

  .quant-ai-trust-overview-row-detail,
  .quant-ai-trust-overview-row-observation {
    align-items: flex-start;
    padding-left: 0;
  }
}
</style>
