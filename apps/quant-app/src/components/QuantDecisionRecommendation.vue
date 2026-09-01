<script setup lang="ts">
import type { QuantDataHealthFreshness } from '../lib/data-health'
import type { QuantFactorDataHealthItem, QuantFactorSourceHealth } from '../lib/quant-factor-data-health'
import type { QuantAiDecisionReview, QuantFactorFreshness, QuantRecommendation, QuantReferencePriceRange, QuantResearchReport, QuantResearchSummary } from '../lib/quant-types'
import { BrainCircuit, CircleHelp, Info } from 'lucide-vue-next'
import { computed } from 'vue'
import { buildQuantDecisionReadiness } from '../lib/decision-readiness'
import { buildQuantDecisionGuide } from '../lib/decision-trust-guide'
import { buildQuantFactorDataHealth } from '../lib/quant-factor-data-health'

const props = defineProps<{
  report: QuantResearchReport | null
  summary: QuantResearchSummary | null
  currentPrice?: number | null
  currentPriceObservedAt?: string | null
  dataFreshness?: QuantDataHealthFreshness
  dataFreshnessDetail?: string
  aiReviewGenerating?: boolean
}>()

const emit = defineEmits<{
  requestAiReview: []
}>()

const reportDecision = computed(() => props.report?.decision || null)
const aiReview = computed<QuantAiDecisionReview | null>(() => props.summary?.summary.decisionReview || null)
const dataFreshness = computed<QuantDataHealthFreshness>(() => props.dataFreshness || 'unknown')
const aiFactorFreshnessReady = computed(() => {
  const impact = props.summary?.factorImpact
  return Boolean(impact
    && !impact.freshnessBlockedFactors?.length
    && impact.factors.every(factor => factor.freshness === undefined || factor.freshness.status === 'fresh'))
})
const appliedAiReview = computed(() => aiReview.value?.accepted && dataFreshness.value === 'fresh' && aiFactorFreshnessReady.value ? aiReview.value : null)
const activeRecommendation = computed<QuantRecommendation | null>(() => appliedAiReview.value?.recommendation || reportDecision.value?.recommendation || null)
const activeLabel = computed(() => recommendationLabel(activeRecommendation.value))
const activeSource = computed(() => appliedAiReview.value ? 'AI 决策复核' : '确定性因子模型')
const activeConfidence = computed(() => appliedAiReview.value?.confidence ?? reportDecision.value?.confidence ?? null)
const aiReviewActionLabel = computed(() => props.aiReviewGenerating ? 'AI 复核中' : props.summary ? '重新复核' : '让 AI 复核')
const decisionGuide = computed(() => {
  if (!props.report)
    return null
  return buildQuantDecisionGuide({
    report: props.report,
    recommendation: activeRecommendation.value,
    aiReview: appliedAiReview.value,
    currentPrice: props.currentPrice,
    currentPriceObservedAt: props.currentPriceObservedAt,
  })
})
const decisionReadiness = computed(() => {
  if (!props.report)
    return null
  return buildQuantDecisionReadiness({
    report: props.report,
    aiReview: aiReview.value,
    factorImpact: props.summary?.factorImpact,
    currentPrice: props.currentPrice,
    dataFreshness: dataFreshness.value,
    dataFreshnessDetail: props.dataFreshnessDetail,
  })
})
const factorDataHealth = computed(() => props.report ? buildQuantFactorDataHealth(props.report) : null)

function recommendationLabel(value: QuantRecommendation | null): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : '观望'
}

function recommendationTone(value: QuantRecommendation | null): string {
  return value ? `quant-decision-${value}` : 'quant-decision-watch'
}

function formatRange(value: QuantReferencePriceRange | null | undefined): string {
  return value ? `${value.low.toFixed(2)} - ${value.high.toFixed(2)} 元` : '暂无参考区间'
}

function factorStatusLabel(value: string): string {
  return { ready: '已覆盖', partial: '部分覆盖', missing: '缺失', unavailable: '来源不可用' }[value] || value
}

function factorStatusClass(value: string): string {
  return `quant-decision-factor-${value}`
}

function configurationSourceLabel(value: string | undefined): string {
  return value === 'user' ? '当前用户配置' : value === 'default' ? '内置默认配置' : '历史报告未记录'
}

function aiReviewStatusLabel(review: QuantAiDecisionReview): string {
  if (review.accepted)
    return '已影响最终推荐'
  if (review.rejectionReason === 'deterministic-watch')
    return '数据不足，保持确定性观望'
  if (review.rejectionReason === 'factor-review-incomplete')
    return '因子复核不足，保留确定性推荐'
  if (review.rejectionReason === 'factor-conflict')
    return '因子方向冲突，保留确定性推荐'
  return '置信度不足，保留确定性推荐'
}

function freshnessLabel(value: QuantDataHealthFreshness): string {
  return value === 'fresh' ? '最新' : value === 'aging' ? '需复核' : value === 'stale' ? '已过期' : '时间未知'
}

function aiReviewDisplayStatusLabel(review: QuantAiDecisionReview): string {
  if (review.accepted && !appliedAiReview.value)
    return `已复核，但数据${freshnessLabel(dataFreshness.value)}，未纳入最终推荐`
  return aiReviewStatusLabel(review)
}

function aiReviewGateDetail(): string {
  return props.dataFreshnessDetail || `当前数据${freshnessLabel(dataFreshness.value)}，刷新后再让 AI 影响最终推荐`
}

function factorHealthStatusLabel(value: QuantFactorDataHealthItem['status']): string {
  return value === 'ready' ? '字段完整' : value === 'partial' ? '部分可用' : value === 'missing' ? '待补数据' : '来源不可用'
}

function factorHealthStatusClass(value: QuantFactorDataHealthItem['status']): string {
  return `quant-factor-health-status-${value}`
}

function factorSourceHealthLabel(value: QuantFactorSourceHealth): string {
  return value === 'primary' ? '主来源' : value === 'fallback' ? '来源需复核' : value === 'unavailable' ? '来源不可用' : '来源状态未知'
}

function factorSourceHealthClass(value: QuantFactorSourceHealth): string {
  return `quant-factor-health-source-${value}`
}

function factorFreshness(value: string): QuantFactorFreshness | null {
  return factorDataHealth.value?.items.find(item => item.factor === value)?.freshness || null
}

function factorFreshnessLabel(value: QuantFactorFreshness | null): string {
  return value?.status === 'fresh' ? '最新' : value?.status === 'aging' ? '需复核' : value?.status === 'stale' ? '已过期' : '时间未知'
}

function factorFreshnessClass(value: QuantFactorFreshness | null): string {
  return `quant-factor-health-freshness-${value?.status || 'unknown'}`
}

function factorObservedAt(value: string | null): string {
  if (!value)
    return '观察时间未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` : value.slice(0, 16)
}
</script>

<template>
  <section class="quant-decision-recommendation" aria-label="简化决策推荐">
    <div class="quant-decision-heading">
      <div>
        <p class="section-kicker">
          DECISION PROJECTION
        </p>
        <h3>简化推荐</h3>
      </div>
      <span v-if="reportDecision" class="quant-decision-source" :class="{ 'quant-decision-source-ai': appliedAiReview }">
        <BrainCircuit v-if="appliedAiReview" :size="13" aria-hidden="true" />
        {{ activeSource }}
      </span>
    </div>

    <div v-if="!reportDecision" class="quant-decision-empty" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>生成新版研究报告后查看看多、看空或观望推荐</span>
    </div>
    <template v-else>
      <div class="quant-decision-hero" :class="recommendationTone(activeRecommendation)">
        <div>
          <span>最终推荐</span>
          <strong>{{ activeLabel }}</strong>
          <small>{{ reportDecision.headline }}</small>
        </div>
        <div class="quant-decision-hero-meta">
          <span>数据覆盖 {{ reportDecision.coverage.toFixed(0) }}%</span>
          <span>{{ activeConfidence === null ? '数据不足' : `置信度 ${activeConfidence.toFixed(0)}` }}</span>
        </div>
      </div>

      <div class="quant-decision-price-grid" aria-label="参考价格区间">
        <div>
          <span>参考买入区间</span>
          <strong>{{ formatRange(reportDecision.buyPriceRange) }}</strong>
          <small>{{ reportDecision.buyPriceRange ? `${reportDecision.buyPriceRange.source} · ${reportDecision.buyPriceRange.observedAt}` : '关键数据齐备后生成' }}</small>
        </div>
        <div>
          <span>参考卖出区间</span>
          <strong>{{ formatRange(reportDecision.sellPriceRange) }}</strong>
          <small>{{ reportDecision.sellPriceRange ? `${reportDecision.sellPriceRange.source} · ${reportDecision.sellPriceRange.observedAt}` : '关键数据齐备后生成' }}</small>
        </div>
      </div>

      <section v-if="factorDataHealth?.items.length" class="quant-factor-data-health" aria-label="因子数据健康">
        <div class="quant-factor-data-health-heading">
          <div>
            <span>因子数据健康</span>
            <strong :class="factorHealthStatusClass(factorDataHealth.status)">{{ factorDataHealth.label }}</strong>
          </div>
          <small>字段覆盖 {{ factorDataHealth.coverage.toFixed(0) }}% · {{ factorDataHealth.readyWeight.toFixed(2) }} / {{ factorDataHealth.totalWeight.toFixed(2) }} 权重已具备</small>
        </div>
        <p class="quant-factor-data-health-note">
          只检查原始字段和来源状态，不代表因子表现或买卖判断。
          <span v-if="factorDataHealth.sourceHealth === 'fallback'">当前至少一个来源使用回退链，需要复核来源时间。</span>
          <span v-else-if="factorDataHealth.sourceHealth === 'unavailable'">当前至少一个来源不可用，需要重试或补充来源。</span>
        </p>
        <div class="quant-factor-data-health-list">
          <div v-for="factor in factorDataHealth.items" :key="factor.factor" class="quant-factor-data-health-row">
            <div class="quant-factor-data-health-row-heading">
              <strong>{{ factor.label }}</strong>
              <span>权重 {{ (factor.weight * 100).toFixed(0) }}%</span>
              <span class="quant-factor-data-health-status" :class="factorHealthStatusClass(factor.status)">{{ factorHealthStatusLabel(factor.status) }}</span>
              <span class="quant-factor-data-health-freshness" :class="factorFreshnessClass(factorFreshness(factor.factor))">{{ factorFreshnessLabel(factorFreshness(factor.factor)) }}</span>
            </div>
            <div class="quant-factor-data-health-meta">
              <span>证据 {{ factor.usableEvidenceCount }} / {{ factor.evidenceCount }} 可用</span>
              <span>观察 {{ factorObservedAt(factor.observedAt) }}</span>
              <span>时效 {{ factorFreshness(factor.factor)?.detail || '没有可核验因子证据时间' }}</span>
              <span :class="factorSourceHealthClass(factor.sourceHealth)">{{ factorSourceHealthLabel(factor.sourceHealth) }}：{{ factor.source || '来源未记录' }}</span>
            </div>
            <small v-if="factor.missingEvidenceKeys.length" class="quant-factor-data-health-missing">待补证据：{{ factor.missingEvidenceKeys.join('、') }}</small>
            <small v-if="factor.failedEvidenceKeys.length" class="quant-factor-data-health-failed">失败证据：{{ factor.failedEvidenceKeys.join('、') }}</small>
            <small class="quant-factor-data-health-action">下一步：{{ factor.nextAction }}</small>
          </div>
        </div>
      </section>

      <section class="quant-decision-guide" aria-label="今日参考与信任检查">
        <div class="quant-decision-guide-heading">
          <div>
            <span>今天怎么参考</span>
            <strong>{{ decisionGuide?.priceLabel }}</strong>
          </div>
          <span class="quant-decision-trust-status" :class="`quant-decision-trust-${decisionGuide?.trustStatus || 'insufficient'}`">
            {{ decisionGuide?.trustLabel }}
          </span>
        </div>
        <p class="quant-decision-guide-price-detail">
          {{ decisionGuide?.priceDetail }}
        </p>
        <div class="quant-decision-guide-checks">
          <span v-for="check in decisionGuide?.checks || []" :key="check">{{ check }}</span>
        </div>
        <ol class="quant-decision-guide-steps">
          <li v-for="step in decisionGuide?.steps || []" :key="step">
            {{ step }}
          </li>
        </ol>
      </section>

      <section v-if="decisionReadiness" class="quant-decision-readiness" aria-label="判断就绪度">
        <div class="quant-decision-readiness-heading">
          <div>
            <span>判断就绪度</span>
            <strong :class="`quant-decision-readiness-${decisionReadiness.status}`">{{ decisionReadiness.label }}</strong>
          </div>
          <small>{{ decisionReadiness.detail }}</small>
        </div>
        <div class="quant-decision-readiness-checks" role="list" aria-label="判断就绪度检查项">
          <div v-for="check in decisionReadiness.checks" :key="check.key" role="listitem" :class="`quant-decision-readiness-check-${check.status}`">
            <span>{{ check.label }}</span>
            <strong>{{ check.status === 'pass' ? '通过' : check.status === 'review' ? '需核对' : '阻断' }}</strong>
            <small>{{ check.detail }}</small>
          </div>
        </div>
        <p v-if="decisionReadiness.unresolvedFactors.length" class="quant-decision-readiness-factors">
          待核对因子：{{ decisionReadiness.unresolvedFactors.join('、') }}
        </p>
      </section>

      <div v-if="aiReview" class="quant-decision-ai-review" :class="{ 'quant-decision-ai-review-accepted': aiReview.accepted, 'quant-decision-ai-review-gated': aiReview.accepted && !appliedAiReview }">
        <div>
          <span>AI 复核</span>
          <strong>{{ recommendationLabel(aiReview.recommendation) }}</strong>
        </div>
        <small>{{ aiReviewDisplayStatusLabel(aiReview) }} · 置信度 {{ aiReview.confidence.toFixed(0) }} · 因子复核 {{ aiReview.factorReviewCoverage.toFixed(0) }}%</small>
        <p v-if="aiReview.accepted && !appliedAiReview" class="quant-decision-ai-review-gate-note">
          {{ aiReviewGateDetail() }}；AI 复核仍保留供核对。
        </p>
      </div>
      <div v-else class="quant-decision-ai-pending">
        <Info :size="14" aria-hidden="true" />
        <span>{{ props.summary ? '摘要已有，尚无结构化 AI 决策复核' : '尚未进行 AI 决策复核' }}</span>
        <button class="text-button quant-decision-ai-review-button" type="button" :disabled="aiReviewGenerating" :title="aiReviewGenerating ? 'AI 复核正在进行' : '使用当前报告证据请求 AI 决策复核'" @click="emit('requestAiReview')">
          <BrainCircuit :size="13" aria-hidden="true" />
          {{ aiReviewActionLabel }}
        </button>
      </div>

      <details class="quant-decision-details">
        <summary>查看因子来源、权重和失效条件</summary>
        <div v-if="report?.factorModel" class="quant-decision-factor-list">
          <div v-for="factor in report?.factorModel?.factors || []" :key="factor.key" class="quant-decision-factor-row">
            <div>
              <strong>{{ factor.label }}</strong>
              <span>{{ (factor.weight * 100).toFixed(0) }}% · {{ factor.source }}</span>
            </div>
            <div>
              <span :class="factorStatusClass(factor.status)">{{ factorStatusLabel(factor.status) }}</span>
              <strong>{{ factor.score === null ? '--' : `${factor.score.toFixed(0)} 分` }}</strong>
            </div>
          </div>
        </div>
        <div class="quant-decision-configuration">
          <span>配置快照</span>
          <strong>{{ configurationSourceLabel(report?.factorModel?.configuration?.source) }}</strong>
          <small>{{ report?.factorModel?.configuration?.version || '旧报告未记录配置版本' }} · {{ report?.factorModel?.configuration?.updatedAt || '生成时使用默认权重' }}</small>
        </div>
        <div class="quant-decision-invalidations">
          <span>失效条件</span>
          <ul>
            <li v-for="condition in reportDecision.invalidationConditions" :key="condition">
              {{ condition }}
            </li>
          </ul>
        </div>
        <p>价格区间为基于日线窗口的参考值，公式 {{ reportDecision.buyPriceRange?.formulaVersion || reportDecision.sellPriceRange?.formulaVersion || '待数据齐备' }}；推荐用于研究排序，不代表收益保证。</p>
      </details>
    </template>
  </section>
</template>

<style scoped>
.quant-decision-recommendation {
  display: grid;
  gap: 0.6rem;
  margin-bottom: 0.8rem;
  border: 1px solid hsl(var(--primary) / 0.28);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--background) / 0.72);
  padding: 0.7rem;
}

.quant-decision-heading,
.quant-decision-heading > div,
.quant-decision-source,
.quant-decision-hero-meta,
.quant-decision-ai-review,
.quant-decision-ai-review > div,
.quant-decision-ai-pending,
.quant-decision-factor-row > div:last-child {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.4rem;
}

.quant-decision-heading {
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.7rem;
}

.quant-decision-heading h3 {
  margin: 0.25rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 760;
}

.quant-decision-source {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-decision-source-ai {
  color: hsl(var(--status-info));
}

.quant-decision-empty,
.quant-decision-ai-pending {
  flex-wrap: wrap;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.4;
}

.quant-decision-ai-review-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.2rem;
}

.quant-decision-hero {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  border-left: 3px solid hsl(var(--muted-foreground) / 0.5);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--muted) / 0.35);
  padding: 0.6rem 0.7rem;
}

.quant-decision-hero > div:first-child {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.quant-decision-hero span,
.quant-decision-hero small,
.quant-decision-price-grid span,
.quant-decision-price-grid small,
.quant-decision-ai-review span,
.quant-decision-ai-review small,
.quant-decision-invalidations > span,
.quant-decision-details p {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-decision-hero strong {
  color: hsl(var(--foreground));
  font-size: 1.15rem;
  font-weight: 800;
}

.quant-decision-hero small {
  overflow-wrap: anywhere;
}

.quant-decision-hero-meta {
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  text-align: right;
}

.quant-decision-bullish {
  border-left-color: hsl(var(--status-success));
  background: hsl(var(--status-success) / 0.08);
}

.quant-decision-bearish {
  border-left-color: hsl(var(--status-danger));
  background: hsl(var(--status-danger) / 0.08);
}

.quant-decision-watch {
  border-left-color: hsl(var(--status-warning));
  background: hsl(var(--status-warning) / 0.08);
}

.quant-decision-price-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.quant-decision-price-grid > div {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.2rem 0.55rem;
}

.quant-decision-price-grid strong {
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.quant-decision-price-grid small {
  overflow-wrap: anywhere;
}

.quant-factor-data-health {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-factor-data-health-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-factor-data-health-heading > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-factor-data-health-heading span,
.quant-factor-data-health-heading small,
.quant-factor-data-health-note,
.quant-factor-data-health-meta,
.quant-factor-data-health-row-heading > span:not(.quant-factor-data-health-status):not(.quant-factor-data-health-freshness),
.quant-factor-data-health-row small {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-factor-data-health-heading strong {
  font-size: 0.8125rem;
}

.quant-factor-health-status-ready { color: hsl(var(--status-success)); }
.quant-factor-health-status-partial { color: hsl(var(--status-warning)); }
.quant-factor-health-status-missing { color: hsl(var(--status-warning)); }
.quant-factor-health-status-unavailable { color: hsl(var(--status-danger)); }

.quant-factor-data-health-note {
  margin: 0;
}

.quant-factor-data-health-list {
  display: grid;
  gap: 0.3rem;
}

.quant-factor-data-health-row {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.25rem 0.45rem;
}

.quant-factor-data-health-row-heading {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.65rem;
}

.quant-factor-data-health-row-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-factor-data-health-status {
  margin-left: auto;
  overflow-wrap: anywhere;
  font-size: 0.625rem;
  font-weight: 700;
}

.quant-factor-data-health-freshness {
  flex: 0 0 auto;
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.12rem 0.3rem;
  font-size: 0.6rem;
  font-weight: 720;
}

.quant-factor-health-freshness-fresh {
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-factor-health-freshness-aging {
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-factor-health-freshness-stale,
.quant-factor-health-freshness-unknown {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.quant-factor-data-health-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.25rem 0.85rem;
}

.quant-factor-health-source-primary { color: hsl(var(--muted-foreground)); }
.quant-factor-health-source-fallback { color: hsl(var(--status-warning)); }
.quant-factor-health-source-unavailable { color: hsl(var(--status-danger)); }
.quant-factor-health-source-unknown { color: hsl(var(--muted-foreground)); }

.quant-factor-data-health-missing { color: hsl(var(--status-warning)) !important; }
.quant-factor-data-health-failed { color: hsl(var(--status-danger)) !important; }
.quant-factor-data-health-action { color: hsl(var(--foreground)) !important; }

.quant-decision-guide {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-decision-guide-heading,
.quant-decision-guide-heading > div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.45rem;
}

.quant-decision-guide-heading {
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.65rem;
}

.quant-decision-guide-heading > div {
  display: grid;
  align-items: start;
  gap: 0.15rem;
}

.quant-decision-guide-heading span,
.quant-decision-guide-price-detail,
.quant-decision-guide-checks span,
.quant-decision-guide-steps {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-guide-heading strong {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
}

.quant-decision-trust-status {
  flex: 0 0 auto;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.2rem 0.35rem;
  font-weight: 700;
}

.quant-decision-trust-complete {
  border-color: hsl(var(--status-success) / 0.3);
  color: hsl(var(--status-success)) !important;
}

.quant-decision-trust-review {
  border-color: hsl(var(--status-warning) / 0.35);
  color: hsl(var(--status-warning)) !important;
}

.quant-decision-trust-insufficient {
  border-color: hsl(var(--status-danger) / 0.3);
  color: hsl(var(--status-danger)) !important;
}

.quant-decision-guide-price-detail {
  margin: 0;
  overflow-wrap: anywhere;
}

.quant-decision-guide-checks {
  display: grid;
  gap: 0.2rem;
  border-left: 2px solid hsl(var(--primary) / 0.32);
  padding-left: 0.5rem;
}

.quant-decision-guide-checks span {
  overflow-wrap: anywhere;
}

.quant-decision-guide-steps {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding-left: 1rem;
}

.quant-decision-guide-steps li {
  padding-left: 0.1rem;
}

.quant-decision-readiness {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-decision-readiness-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-decision-readiness-heading > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-decision-readiness-heading span,
.quant-decision-readiness-heading small,
.quant-decision-readiness-checks span,
.quant-decision-readiness-checks small,
.quant-decision-readiness-factors {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-readiness-heading strong {
  font-size: 0.8125rem;
}

.quant-decision-readiness-ready { color: hsl(var(--status-success)); }
.quant-decision-readiness-review { color: hsl(var(--status-warning)); }
.quant-decision-readiness-blocked { color: hsl(var(--status-danger)); }

.quant-decision-readiness-checks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-decision-readiness-checks > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.2rem 0.45rem;
}

.quant-decision-readiness-checks strong {
  font-size: 0.625rem;
}

.quant-decision-readiness-check-pass { border-left-color: hsl(var(--status-success) / 0.55) !important; }
.quant-decision-readiness-check-pass strong { color: hsl(var(--status-success)); }
.quant-decision-readiness-check-review { border-left-color: hsl(var(--status-warning) / 0.55) !important; }
.quant-decision-readiness-check-review strong { color: hsl(var(--status-warning)); }
.quant-decision-readiness-check-blocked { border-left-color: hsl(var(--status-danger) / 0.55) !important; }
.quant-decision-readiness-check-blocked strong { color: hsl(var(--status-danger)); }

.quant-decision-readiness-factors {
  margin: 0;
}

.quant-decision-ai-review {
  flex-wrap: wrap;
  justify-content: space-between;
  border-top: 1px solid hsl(var(--status-info) / 0.24);
  padding-top: 0.5rem;
}

.quant-decision-ai-review > div {
  align-items: baseline;
}

.quant-decision-ai-review strong {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
}

.quant-decision-ai-review-accepted strong {
  color: hsl(var(--status-info));
}

.quant-decision-ai-review-gated {
  border-top-color: hsl(var(--status-warning) / 0.3);
}

.quant-decision-ai-review-gated strong {
  color: hsl(var(--status-warning));
}

.quant-decision-ai-review-gate-note {
  flex: 0 0 100%;
  margin: 0.25rem 0 0;
  overflow-wrap: anywhere;
  color: hsl(var(--status-warning));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-details {
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.5rem;
}

.quant-decision-details summary {
  cursor: pointer;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  font-weight: 700;
}

.quant-decision-factor-list,
.quant-decision-invalidations {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.45rem;
}

.quant-decision-factor-row {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.25rem 0.45rem;
}

.quant-decision-factor-row > div:first-child {
  display: grid;
  min-width: 0;
  gap: 0.12rem;
}

.quant-decision-factor-row strong {
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-decision-factor-row span {
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  line-height: 1.35;
}

.quant-decision-factor-row > div:last-child {
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
}

.quant-decision-factor-ready {
  color: hsl(var(--status-success)) !important;
}

.quant-decision-factor-partial,
.quant-decision-factor-missing {
  color: hsl(var(--status-warning)) !important;
}

.quant-decision-factor-unavailable {
  color: hsl(var(--status-danger)) !important;
}

.quant-decision-configuration {
  display: grid;
  gap: 0.12rem;
  margin-top: 0.45rem;
  border-left: 2px solid hsl(var(--primary) / 0.35);
  padding: 0.25rem 0.45rem;
}

.quant-decision-configuration span {
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
}

.quant-decision-configuration strong {
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-decision-configuration small {
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.quant-decision-invalidations ul {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding-left: 0.95rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-decision-details p {
  margin: 0.5rem 0 0;
}

@media (max-width: 520px) {
  .quant-decision-heading,
  .quant-decision-hero,
  .quant-decision-ai-review,
  .quant-decision-readiness-heading {
    display: grid;
  }

  .quant-decision-source,
  .quant-decision-hero-meta {
    justify-self: start;
    align-items: flex-start;
    text-align: left;
  }

  .quant-decision-price-grid {
    grid-template-columns: 1fr;
  }

  .quant-factor-data-health-heading {
    display: grid;
  }

  .quant-factor-data-health-status {
    margin-left: 0;
  }

  .quant-decision-readiness-checks {
    grid-template-columns: 1fr;
  }
}
</style>
