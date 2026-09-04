<script setup lang="ts">
import type { QuantAiTrustOverviewItem, QuantAiTrustOverviewItemStatus } from '../../lib/ai-trust-overview'
import type { QuantDecisionRecord, QuantRecommendation } from '../../lib/quant-view-models'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, Clock3, Minus, XCircle } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  items: readonly QuantAiTrustOverviewItem[]
}>()

const emit = defineEmits<{
  focus: [tsCode: string]
}>()

const visibleItems = computed(() => props.items.slice(0, 8))
const remainingCount = computed(() => Math.max(0, props.items.length - visibleItems.value.length))

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
  <p v-if="remainingCount > 0" class="quant-ai-trust-overview-more">
    还有 {{ remainingCount }} 条最近决策，打开具体股票查看完整历史。
  </p>
</template>
