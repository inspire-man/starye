<script setup lang="ts">
import type { QuantAiFactorImpact, QuantFactorFreshness, QuantResearchFactor } from '../../lib/quant-view-models'
import type { QuantAiSummaryFactorRow } from './quant-ai-summary-contracts'

export interface QuantAiFactorReviewPanelProps {
  factorRows: QuantAiSummaryFactorRow[]
  factorCoverageLabel: string
  hasSummary: boolean
  factorImpact: QuantAiFactorImpact | null
  factorImpactSnapshot: QuantAiFactorImpact | null
  factorReviewIncomplete: boolean
  factorLabel: (value: string) => string
  factorFreshness: (row: QuantAiSummaryFactorRow) => QuantFactorFreshness | null
  factorFreshnessLabel: (value: QuantFactorFreshness | null) => string
  factorFreshnessClass: (value: QuantFactorFreshness | null) => string
}

const {
  factorRows,
  factorCoverageLabel,
  hasSummary,
  factorImpact,
  factorImpactSnapshot,
  factorReviewIncomplete,
  factorLabel,
  factorFreshness,
  factorFreshnessLabel,
  factorFreshnessClass,
} = defineProps<QuantAiFactorReviewPanelProps>()

function factorStanceLabel(value: string): string {
  return { support: '支持', caution: '注意', oppose: '反对', insufficient: '数据不足' }[value] || value
}

function factorImpactStanceLabel(value: string): string {
  return value === 'unreviewed' ? '未复核' : factorStanceLabel(value)
}

function factorStanceClass(value: string): string {
  return `quant-ai-summary-factor-${value}`
}

function factorReviewDecisionLabel(accepted: boolean, stance: string): string {
  if (accepted)
    return '已计入 AI 复核'
  return stance === 'insufficient' ? '数据不足，未计入' : '未达到纳入门槛'
}

function factorStatusLabel(value: string): string {
  return { ready: '数据完整', partial: '部分覆盖', missing: '数据缺失', unavailable: '来源不可用' }[value] || value
}

function factorStatusClass(value: string): string {
  return `quant-ai-summary-factor-status-${value}`
}

function factorReviewStatusLabel(row: QuantAiSummaryFactorRow): string {
  if (!row.review)
    return 'AI 未返回复核'
  const freshness = factorFreshness(row)
  if (freshness && freshness.status !== 'fresh')
    return freshness.status === 'unknown' ? '时间未知，未计入' : '数据时效不足，未计入'
  return factorReviewDecisionLabel(row.review.accepted, row.review.stance)
}

function factorReviewStatusClass(row: QuantAiSummaryFactorRow): string {
  return row.review ? (row.review.accepted ? 'quant-ai-summary-factor-accepted-yes' : 'quant-ai-summary-factor-accepted-no') : 'quant-ai-summary-factor-no-review'
}

function factorEvidenceCoverage(factor: QuantResearchFactor): string {
  const total = factor.evidenceKeys.length
  if (!total)
    return '无证据定义'
  const covered = Math.max(0, total - factor.missingEvidenceKeys.length)
  return `${covered} / ${total} 条证据`
}

function formatFactorContribution(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(1)} 分`
}

function formatImpactScore(value: number | null | undefined): string {
  return value === null || value === undefined ? '--' : `${value.toFixed(1)} 分`
}

function formatImpactDelta(value: number | null | undefined): string {
  if (value === null || value === undefined)
    return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} 分`
}

function formatWeight(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

function formatImpactTime(value: string | undefined): string {
  if (!value)
    return '时间未记录'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 16) : parsed.toISOString().replace('T', ' ').slice(0, 16)
}
</script>

<template>
  <section v-if="factorRows.length" class="quant-ai-summary-factors" aria-label="因子覆盖与 AI 复核">
    <div class="quant-ai-summary-factors-heading">
      <div>
        <span>因子覆盖与 AI 复核</span>
        <small>{{ factorCoverageLabel }} · 仅已纳入的因子可影响 AI 决策</small>
      </div>
      <small v-if="!hasSummary">等待生成 AI 复核</small>
    </div>
    <div v-if="factorImpact" class="quant-ai-summary-impact" aria-label="因子贡献与 AI 影响">
      <h4>因子贡献与 AI 影响</h4>
      <div>
        <span>确定性分数</span>
        <strong>{{ formatFactorContribution(factorImpact.deterministicScore) }}</strong>
        <small>有分数权重 {{ formatWeight(factorImpact.scoredWeight) }}</small>
      </div>
      <div>
        <span>AI 已纳入权重</span>
        <strong>{{ factorImpact.reviewCoverage.toFixed(0) }}%</strong>
        <small>未纳入 {{ formatWeight(factorImpact.unacceptedWeight) }}</small>
      </div>
      <div>
        <span>AI 方向权重</span>
        <strong>支持 {{ formatWeight(factorImpact.supportWeight) }}</strong>
        <small>注意 {{ formatWeight(factorImpact.cautionWeight) }} · 反对 {{ formatWeight(factorImpact.opposeWeight) }}</small>
      </div>
      <div v-if="factorImpact.aiScore !== undefined">
        <span>AI 影响分</span>
        <strong>{{ formatImpactScore(factorImpact.aiScore) }}</strong>
        <small>相对确定性 {{ formatImpactDelta(factorImpact.aiScoreDelta) }}</small>
      </div>
    </div>
    <p v-if="factorImpact" class="quant-ai-summary-impact-note" role="note">
      AI 加权影响只表示已接受复核的因子权重，不改写确定性分数或参考价格区间。
    </p>
    <p v-if="factorImpact?.evaluatedAt || factorImpactSnapshot?.evaluatedAt" class="quant-ai-summary-impact-note" role="note">
      当前时效评估 {{ formatImpactTime(factorImpact?.evaluatedAt) }}<span v-if="factorImpactSnapshot?.evaluatedAt"> · AI 快照评估 {{ formatImpactTime(factorImpactSnapshot.evaluatedAt) }}</span>
    </p>
    <p v-if="factorImpact?.freshnessBlockedFactors?.length" class="quant-ai-summary-factor-warning" role="status">
      新鲜度闸门阻断：{{ factorImpact.freshnessBlockedFactors.map(factorLabel).join('、') }}；这些因子仍可查看 AI 解释，但不会进入最终推荐。
    </p>
    <p v-if="factorReviewIncomplete" class="quant-ai-summary-factor-warning" role="status">
      AI 尚未完成全部有权重因子的证据复核，当前推荐仍以确定性结论为准。
    </p>
    <div class="quant-ai-summary-factor-list">
      <article v-for="row in factorRows" :key="row.key" class="quant-ai-summary-factor-row">
        <div class="quant-ai-summary-factor-title">
          <strong>{{ row.label }}</strong>
          <span v-if="row.factor" class="quant-ai-summary-factor-stance" :class="factorStatusClass(row.factor.status)">{{ factorStatusLabel(row.factor.status) }}</span>
          <span v-if="row.factor" class="quant-ai-summary-factor-weight">权重 {{ (row.factor.weight * 100).toFixed(0) }}%</span>
          <span v-if="row.review" class="quant-ai-summary-factor-stance" :class="factorStanceClass(row.review.stance)">{{ factorStanceLabel(row.review.stance) }}</span>
          <span v-if="factorFreshness(row)" class="quant-ai-summary-factor-freshness" :class="factorFreshnessClass(factorFreshness(row))">{{ factorFreshnessLabel(factorFreshness(row)) }}</span>
          <span class="quant-ai-summary-factor-accepted" :class="factorReviewStatusClass(row)">{{ factorReviewStatusLabel(row) }}</span>
        </div>
        <div v-if="row.factor" class="quant-ai-summary-factor-meta">
          <span>证据覆盖 {{ factorEvidenceCoverage(row.factor) }}</span>
          <span>{{ row.factor.source }}</span>
          <span v-if="factorFreshness(row)">新鲜度 {{ factorFreshnessLabel(factorFreshness(row)) }} · {{ factorFreshness(row)?.detail }}</span>
        </div>
        <div v-if="row.impact" class="quant-ai-summary-factor-impact">
          <span>确定性贡献 {{ formatFactorContribution(row.impact.deterministicContribution) }}</span>
          <span>模型倾向 {{ factorImpactStanceLabel(row.impact.deterministicStance) }}</span>
          <span v-if="row.impact.aiStance">AI {{ factorImpactStanceLabel(row.impact.aiStance) }} · {{ row.impact.aiAccepted ? `计入 ${formatWeight(row.impact.aiWeight)}` : '未计入' }}</span>
          <span v-else>AI 未复核</span>
          <span v-if="row.impact.aiContribution !== undefined">AI 贡献 {{ formatFactorContribution(row.impact.aiContribution) }}</span>
        </div>
        <p v-if="row.factor?.missingEvidenceKeys.length" class="quant-ai-summary-factor-missing">
          待补证据：{{ row.factor.missingEvidenceKeys.join('、') }}
        </p>
        <p v-if="row.review">
          {{ row.review.rationale }}
        </p>
        <small v-if="row.review">置信度 {{ row.review.confidence.toFixed(0) }} · {{ row.review.citedEvidenceKeys.length }} 条因子证据引用</small>
        <small v-else>尚未收到该因子的 AI 复核结果</small>
      </article>
    </div>
  </section>
</template>

<style scoped>
.quant-ai-summary-factors {
  display: grid;
  gap: 0.4rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-ai-summary-factors-heading,
.quant-ai-summary-factor-title {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.quant-ai-summary-factors-heading {
  justify-content: space-between;
  align-items: flex-start;
}

.quant-ai-summary-factors-heading > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-ai-summary-factors-heading span {
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  font-weight: 720;
}

.quant-ai-summary-factors-heading small,
.quant-ai-summary-factor-row > small {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-ai-summary-factor-list {
  display: grid;
  gap: 0.35rem;
}

.quant-ai-summary-impact {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  border: 1px solid hsl(var(--status-info) / 0.24);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-info) / 0.05);
  padding: 0.5rem 0.6rem;
}

.quant-ai-summary-impact > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-ai-summary-impact h4 {
  grid-column: 1 / -1;
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.7rem;
  font-weight: 700;
}

.quant-ai-summary-impact span,
.quant-ai-summary-impact small,
.quant-ai-summary-impact-note,
.quant-ai-summary-factor-impact {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-ai-summary-impact strong {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 760;
  overflow-wrap: anywhere;
}

.quant-ai-summary-impact-note {
  margin: 0;
  border-left: 2px solid hsl(var(--status-info) / 0.55);
  padding-left: 0.45rem;
  overflow-wrap: anywhere;
}

.quant-ai-summary-factor-row {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  border-left: 2px solid hsl(var(--border));
  padding: 0.35rem 0.5rem;
}

.quant-ai-summary-factor-title strong {
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-ai-summary-factor-stance,
.quant-ai-summary-factor-accepted,
.quant-ai-summary-factor-freshness {
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.12rem 0.3rem;
  font-size: 0.6rem;
  font-weight: 720;
}

.quant-ai-summary-factor-freshness-fresh {
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-ai-summary-factor-freshness-aging {
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-ai-summary-factor-freshness-stale,
.quant-ai-summary-factor-freshness-unknown {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.quant-ai-summary-factor-support,
.quant-ai-summary-factor-accepted-yes {
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-ai-summary-factor-caution {
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-ai-summary-factor-oppose,
.quant-ai-summary-factor-insufficient,
.quant-ai-summary-factor-accepted-no {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.quant-ai-summary-factor-oppose {
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.quant-ai-summary-factor-status-ready {
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-ai-summary-factor-status-partial {
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-ai-summary-factor-status-missing,
.quant-ai-summary-factor-status-unavailable,
.quant-ai-summary-factor-no-review {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.quant-ai-summary-factor-weight {
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  font-weight: 650;
}

.quant-ai-summary-factor-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.3rem 0.65rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-ai-summary-factor-meta span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quant-ai-summary-factor-impact {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.25rem 0.65rem;
}

.quant-ai-summary-factor-impact span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quant-ai-summary-factor-missing,
.quant-ai-summary-factor-warning {
  margin: 0;
  color: hsl(var(--status-warning));
  font-size: 0.625rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.quant-ai-summary-factor-warning {
  border-left: 2px solid hsl(var(--status-warning) / 0.65);
  background: hsl(var(--status-warning) / 0.06);
  padding: 0.35rem 0.5rem;
}

.quant-ai-summary-factor-row p {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

@media (max-width: 680px) {
  .quant-ai-summary-impact {
    grid-template-columns: 1fr;
  }
}
</style>
