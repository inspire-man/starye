<script setup lang="ts">
import type { QuantAiOutcomeCalibrationAlignment, QuantAiOutcomeCalibrationStatus } from '../lib/ai-outcome-calibration'
import type { QuantDecisionRecord } from '../lib/quant-types'
import { BrainCircuit, CheckCircle2, CircleHelp, Minus, XCircle } from 'lucide-vue-next'
import { computed } from 'vue'
import { buildQuantAiOutcomeCalibration } from '../lib/ai-outcome-calibration'

const props = defineProps<{
  history: QuantDecisionRecord[]
  latestPrice: number | null
  latestPriceObservedAt: string | null
}>()

const calibration = computed(() => buildQuantAiOutcomeCalibration(props.history, {
  price: props.latestPrice,
  observedAt: props.latestPriceObservedAt,
}))

function statusLabel(value: QuantAiOutcomeCalibrationStatus): string {
  return value === 'observed' ? '已有观察' : value === 'pending' ? '等待观察' : '暂无样本'
}

function statusClass(value: QuantAiOutcomeCalibrationStatus): string {
  return `quant-ai-calibration-status-${value}`
}

function recommendationLabel(value: 'bullish' | 'bearish'): string {
  return value === 'bullish' ? '看多' : '看空'
}

function actionLabel(value: 'plan-buy' | 'holding'): string {
  return value === 'plan-buy' ? '计划买入' : '已持有'
}

function alignmentLabel(value: QuantAiOutcomeCalibrationAlignment): string {
  return value === 'aligned' ? '方向一致' : value === 'opposed' ? '方向相反' : '价格未变化'
}

function alignmentClass(value: QuantAiOutcomeCalibrationAlignment): string {
  return `quant-ai-calibration-alignment-${value}`
}

function formatPrice(value: number): string {
  return value.toFixed(2)
}

function formatChange(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatDate(value: string): string {
  const compact = value.replace(/\D/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    : value.slice(0, 10)
}

function formatImpactDelta(value: number | null): string {
  if (value === null)
    return ''
  return ` · AI 影响分差 ${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}
</script>

<template>
  <section class="quant-ai-outcome-calibration" aria-labelledby="quant-ai-outcome-calibration-title">
    <div class="quant-ai-calibration-heading">
      <div>
        <p class="section-kicker">
          AI OUTCOME CHECK
        </p>
        <h4 id="quant-ai-outcome-calibration-title">
          AI 结果校准
        </h4>
        <small>用保存的 AI 判断和后续价格观察，检查方向是否值得继续参考。</small>
      </div>
      <span class="quant-ai-calibration-status" :class="statusClass(calibration.status)">
        <BrainCircuit :size="13" aria-hidden="true" />
        {{ statusLabel(calibration.status) }}
      </span>
    </div>

    <p class="quant-ai-calibration-headline">
      {{ calibration.headline }}
    </p>

    <div v-if="calibration.eligibleCount" class="quant-ai-calibration-summary" role="list" aria-label="AI 结果校准统计">
      <div role="listitem">
        <CheckCircle2 :size="14" aria-hidden="true" />
        <span>方向一致</span>
        <strong>{{ calibration.alignedCount }}</strong>
      </div>
      <div role="listitem">
        <XCircle :size="14" aria-hidden="true" />
        <span>方向相反</span>
        <strong>{{ calibration.opposedCount }}</strong>
      </div>
      <div role="listitem">
        <Minus :size="14" aria-hidden="true" />
        <span>价格未变化</span>
        <strong>{{ calibration.flatCount }}</strong>
      </div>
      <div role="listitem" class="quant-ai-calibration-rate">
        <span>方向一致率</span>
        <strong>{{ calibration.agreementRate === null ? '样本不足' : `${calibration.agreementRate.toFixed(0)}%` }}</strong>
        <small>{{ calibration.directionalSampleCount }} 条方向样本</small>
      </div>
    </div>

    <div v-if="calibration.entries.length" class="quant-ai-calibration-entry-list">
      <article v-for="entry in calibration.entries" :key="entry.baselineId" class="quant-ai-calibration-entry">
        <div class="quant-ai-calibration-entry-heading">
          <div>
            <span class="quant-ai-calibration-action">{{ actionLabel(entry.baselineAction) }}</span>
            <strong>{{ recommendationLabel(entry.recommendation) }}</strong>
            <small>置信度 {{ entry.confidence.toFixed(0) }}</small>
          </div>
          <span class="quant-ai-calibration-alignment" :class="alignmentClass(entry.alignment)">{{ alignmentLabel(entry.alignment) }}</span>
        </div>
        <div class="quant-ai-calibration-prices">
          <strong>{{ formatPrice(entry.baselinePrice) }}</strong>
          <span>→</span>
          <strong>{{ formatPrice(entry.observationPrice) }}</strong>
          <b :class="entry.changePercent >= 0 ? 'quant-ai-calibration-change-positive' : 'quant-ai-calibration-change-negative'">{{ formatChange(entry.changePercent) }}</b>
        </div>
        <small>{{ formatDate(entry.baselineObservedAt) }} → {{ formatDate(entry.observationObservedAt) }} · {{ entry.observationKind === 'sold' ? '已卖出配对' : entry.observationKind === 'current' ? '当前最新日线' : '后续记录' }}{{ formatImpactDelta(entry.aiScoreDelta) }}</small>
      </article>
    </div>

    <div v-else class="quant-ai-calibration-empty" role="status">
      <CircleHelp :size="14" aria-hidden="true" />
      <span>{{ calibration.status === 'pending' ? '保存一条更晚的决策或等待新的日线后，这里会自动形成方向观察。' : '先完成一次达到纳入条件的 AI 复核，再记录“计划买入”或“已持有”。' }}</span>
    </div>

    <section v-if="calibration.factors.length" class="quant-ai-calibration-factors" aria-label="AI 因子方向回看">
      <div class="quant-ai-calibration-factors-heading">
        <strong>因子方向回看</strong>
        <small>只回看已保存且已接受的因子立场</small>
      </div>
      <div v-for="factor in calibration.factors" :key="factor.factor" class="quant-ai-calibration-factor">
        <div>
          <strong>{{ factor.label }}</strong>
          <small>{{ factor.observedCount }} 次观察 · 最近立场以快照为准</small>
        </div>
        <div>
          <span class="quant-ai-calibration-factor-aligned">一致 {{ factor.alignedCount }}</span>
          <span class="quant-ai-calibration-factor-opposed">相反 {{ factor.opposedCount }}</span>
          <span class="quant-ai-calibration-factor-indeterminate">不可判定 {{ factor.indeterminateCount }}</span>
        </div>
      </div>
    </section>

    <p class="quant-ai-calibration-note">
      口径说明：这里只比较决策记录价格与后续日线/决策价格的方向，不代表实际成交收益、长期胜率或 AI 准确率；样本达到 3 条前不显示一致率。
    </p>
  </section>
</template>

<style scoped>
.quant-ai-outcome-calibration {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.15rem;
  border-top: 1px solid hsl(var(--status-info) / 0.34);
  padding-top: 0.7rem;
}

.quant-ai-calibration-heading,
.quant-ai-calibration-entry-heading,
.quant-ai-calibration-factors-heading,
.quant-ai-calibration-factor {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-ai-calibration-heading h4 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 720;
}

.quant-ai-calibration-heading small,
.quant-ai-calibration-entry > small,
.quant-ai-calibration-factors-heading small,
.quant-ai-calibration-factor small,
.quant-ai-calibration-note {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-ai-calibration-heading small {
  display: block;
  margin-top: 0.25rem;
  max-width: 38rem;
}

.quant-ai-calibration-status,
.quant-ai-calibration-action,
.quant-ai-calibration-alignment {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.18rem 0.38rem;
  font-size: 0.625rem;
  font-weight: 720;
  line-height: 1.3;
  white-space: nowrap;
}

.quant-ai-calibration-status-observed,
.quant-ai-calibration-alignment-aligned {
  border-color: hsl(var(--status-success) / 0.32);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-ai-calibration-status-pending,
.quant-ai-calibration-alignment-flat {
  border-color: hsl(var(--status-warning) / 0.32);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-ai-calibration-alignment-opposed {
  border-color: hsl(var(--status-danger) / 0.28);
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.quant-ai-calibration-status-empty {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.7);
  color: hsl(var(--muted-foreground));
}

.quant-ai-calibration-headline,
.quant-ai-calibration-note {
  margin: 0;
}

.quant-ai-calibration-headline {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.5;
}

.quant-ai-calibration-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-ai-calibration-summary > div {
  display: grid;
  grid-template-columns: auto 1fr auto;
  min-width: 0;
  align-items: center;
  gap: 0.2rem 0.35rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.2rem 0.45rem;
}

.quant-ai-calibration-summary > div > svg {
  grid-row: 1 / span 2;
}

.quant-ai-calibration-summary span,
.quant-ai-calibration-summary small {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.3;
}

.quant-ai-calibration-summary strong {
  grid-row: 1 / span 2;
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
}

.quant-ai-calibration-rate {
  grid-template-columns: 1fr !important;
  align-content: center;
}

.quant-ai-calibration-rate strong,
.quant-ai-calibration-rate small {
  grid-row: auto;
}

.quant-ai-calibration-entry-list,
.quant-ai-calibration-factors {
  display: grid;
  gap: 0.4rem;
}

.quant-ai-calibration-entry {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.72);
  padding: 0.45rem 0;
}

.quant-ai-calibration-entry:last-child {
  border-bottom: 0;
}

.quant-ai-calibration-entry-heading > div,
.quant-ai-calibration-prices,
.quant-ai-calibration-factor > div:last-child {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.quant-ai-calibration-entry-heading strong,
.quant-ai-calibration-factor strong {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
}

.quant-ai-calibration-entry-heading small {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-calibration-action {
  border: 0;
  background: hsl(var(--muted) / 0.7);
  color: hsl(var(--muted-foreground));
}

.quant-ai-calibration-prices {
  color: hsl(var(--muted-foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.quant-ai-calibration-prices strong {
  color: hsl(var(--foreground));
}

.quant-ai-calibration-prices b {
  font-size: 0.75rem;
}

.quant-ai-calibration-change-positive,
.quant-ai-calibration-factor-aligned {
  color: hsl(var(--status-success));
}

.quant-ai-calibration-change-negative,
.quant-ai-calibration-factor-opposed {
  color: hsl(var(--status-danger));
}

.quant-ai-calibration-factor-indeterminate {
  color: hsl(var(--status-warning));
}

.quant-ai-calibration-empty {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-ai-calibration-empty span,
.quant-ai-calibration-note,
.quant-ai-calibration-entry > small,
.quant-ai-calibration-factor small {
  overflow-wrap: anywhere;
}

.quant-ai-calibration-factors {
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.55rem;
}

.quant-ai-calibration-factors-heading {
  align-items: baseline;
}

.quant-ai-calibration-factor {
  align-items: center;
  border-left: 2px solid hsl(var(--status-info) / 0.35);
  padding: 0.2rem 0 0.2rem 0.45rem;
}

.quant-ai-calibration-factor > div:first-child {
  display: grid;
  min-width: 0;
  gap: 0.12rem;
}

@media (max-width: 680px) {
  .quant-ai-calibration-heading,
  .quant-ai-calibration-entry-heading,
  .quant-ai-calibration-factors-heading,
  .quant-ai-calibration-factor {
    display: grid;
  }

  .quant-ai-calibration-status,
  .quant-ai-calibration-alignment {
    justify-self: start;
    white-space: normal;
  }

  .quant-ai-calibration-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quant-ai-calibration-factor > div:last-child {
    align-items: flex-start;
  }
}
</style>
