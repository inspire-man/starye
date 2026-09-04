<script setup lang="ts">
import type { QuantDecisionAssistant, QuantDecisionAssistantAction, QuantDecisionAssistantTrustLevel } from '../../lib/quant-view-models'
import { ExternalLink, Sparkles } from 'lucide-vue-next'

type DecisionFactorImpactItem = NonNullable<QuantDecisionAssistant['factorImpact']>['factors'][number]

defineProps<{
  assessment: QuantDecisionAssistant
}>()

const emit = defineEmits<{
  openSettings: []
}>()

function formatPrice(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '--' : `${value.toFixed(2)} 元`
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value))
    return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatDate(value: string | null): string {
  if (!value)
    return '日期未记录'
  const digits = value.replace(/\D/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : value.slice(0, 10)
}

function formatObservedAt(value: string | null): string {
  if (!value)
    return '时间未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? formatDate(value) : date.toLocaleString('zh-CN', { hour12: false })
}

function marketSourceLabel(value: QuantDecisionAssistant['market']): string {
  return value.currentPriceSource === 'eastmoney-realtime' ? 'Eastmoney 实时行情' : value.currentPriceSource === 'local-daily-bars' ? '本地最新收盘回退' : '历史用户输入'
}

function marketStatusLabel(value: QuantDecisionAssistant['market']): string {
  return value.currentPriceStatus === 'realtime' ? '实时快照' : value.currentPriceStatus === 'latest-close' ? '最新收盘' : '历史输入'
}

function formatRange(value: QuantDecisionAssistant['deterministic']['buyPriceRange']): string {
  return value ? `${formatPrice(value.low)} - ${formatPrice(value.high)}` : '暂无'
}

function trustLabel(value: QuantDecisionAssistantTrustLevel): string {
  return value === 'high' ? '高' : value === 'medium' ? '中' : '低'
}

function actionClass(value: QuantDecisionAssistantAction): string {
  return `quant-decision-assistant-action-${value}`
}

function aiStatusLabel(value: QuantDecisionAssistant['ai']['status']): string {
  return value === 'accepted' ? '已纳入最终判断' : value === 'rejected' ? '已复核，保留确定性判断' : value === 'failed' ? 'AI 请求失败，保留确定性判断' : value === 'unavailable' ? 'AI 未配置，保留确定性判断' : '未请求 AI'
}

function aiStatusClass(value: QuantDecisionAssistant['ai']['status']): string {
  return value === 'accepted' ? 'quant-decision-assistant-ai-accepted' : value === 'rejected' ? 'quant-decision-assistant-ai-rejected' : 'quant-decision-assistant-ai-muted'
}

function factorLabel(value: string): string {
  return { 'trend': '趋势', 'valuation': '估值', 'quality': '盈利质量', 'shareholder-return': '股东回报', 'risk': '风险' }[value] || value
}

function stanceLabel(value: string): string {
  return { support: '支持', caution: '注意', oppose: '反对', insufficient: '数据不足' }[value] || value
}

function formatContribution(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '--' : `${value.toFixed(1)} 分`
}

function formatImpactScore(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '--' : `${value.toFixed(1)} 分`
}

function formatImpactDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} 分`
}

function formatImpactTime(value: string | undefined): string {
  if (!value)
    return '时间未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 16) : date.toISOString().replace('T', ' ').slice(0, 16)
}

function formatWeight(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

function deterministicImpactStanceLabel(value: DecisionFactorImpactItem['deterministicStance']): string {
  return value === 'support' ? '支持' : value === 'caution' ? '注意' : value === 'oppose' ? '反对' : '数据不足'
}

function aiImpactStanceLabel(value: DecisionFactorImpactItem['aiStance']): string {
  return value === null ? '未复核' : stanceLabel(value)
}

function factorImpactStatusLabel(value: DecisionFactorImpactItem): string {
  if (value.freshness && value.freshness.status !== 'fresh')
    return value.freshness.status === 'unknown' ? '时间未知，未计入' : '数据时效不足，未计入'
  return value.aiAccepted ? 'AI 已计入' : value.aiStance === null ? 'AI 未复核' : 'AI 已复核，未计入'
}

function factorImpactStatusClass(value: DecisionFactorImpactItem): string {
  if (value.freshness && value.freshness.status !== 'fresh')
    return 'factor-impact-freshness-blocked'
  return value.aiAccepted ? 'factor-impact-accepted' : value.aiStance === null ? 'factor-impact-unreviewed' : 'factor-impact-not-included'
}

function factorFreshnessLabel(value: DecisionFactorImpactItem['freshness']): string {
  return value?.status === 'fresh' ? '最新' : value?.status === 'aging' ? '需复核' : value?.status === 'stale' ? '已过期' : '时间未知'
}
</script>

<template>
  <div class="quant-decision-assistant-result">
    <div class="quant-decision-assistant-result-heading">
      <div>
        <span class="quant-decision-assistant-result-kicker">最终判断 · {{ assessment.final.source === 'ai' ? 'AI + 确定性' : '确定性' }}</span>
        <strong :class="actionClass(assessment.final.action)">{{ assessment.final.actionLabel }}</strong>
      </div>
      <span class="quant-decision-assistant-recommendation" :class="`recommendation-${assessment.final.recommendation || 'watch'}`">{{ assessment.final.label }}</span>
    </div>
    <p class="quant-decision-assistant-rationale">
      {{ assessment.final.rationale }}
    </p>

    <div class="quant-decision-assistant-metrics" role="list" aria-label="今日决策结果">
      <div role="listitem">
        <span>可信度</span>
        <strong :class="`trust-${assessment.deterministic.trust.level}`">{{ trustLabel(assessment.deterministic.trust.level) }} · {{ assessment.deterministic.trust.score.toFixed(0) }}</strong>
        <small>{{ assessment.deterministic.trust.coverage.toFixed(0) }}% 因子覆盖</small>
      </div>
      <div role="listitem">
        <span>服务端现价</span>
        <strong>{{ formatPrice(assessment.scenario.currentPrice) }}</strong>
        <small>{{ marketSourceLabel(assessment.market) }} · {{ marketStatusLabel(assessment.market) }} · {{ formatObservedAt(assessment.market.currentPriceObservedAt) }}</small>
        <small v-if="assessment.market.currentPriceChangePercent !== null">行情涨跌 {{ formatPercent(assessment.market.currentPriceChangePercent) }}</small>
        <small v-if="assessment.market.quoteErrorCode" class="quant-decision-assistant-market-warning">行情回退码 {{ assessment.market.quoteErrorCode }}</small>
      </div>
      <div v-if="assessment.scenario.mode === 'holding'" role="listitem">
        <span>浮亏 / 浮盈</span>
        <strong :class="assessment.deterministic.unrealizedPnlPercent !== null && assessment.deterministic.unrealizedPnlPercent >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(assessment.deterministic.unrealizedPnlPercent) }}</strong>
        <small>成本 {{ formatPrice(assessment.scenario.costBasis) }}</small>
      </div>
      <div v-if="assessment.scenario.mode === 'holding'" role="listitem">
        <span>回本所需</span>
        <strong>{{ assessment.deterministic.recoveryPercent === null ? '--' : `${assessment.deterministic.recoveryPercent.toFixed(2)}%` }}</strong>
        <small>从当前价计算</small>
      </div>
      <div v-else role="listitem">
        <span>价格条件</span>
        <strong>{{ assessment.deterministic.priceLabel }}</strong>
        <small>{{ assessment.deterministic.priceStatus === 'within' ? '区间条件满足' : '区间条件未满足' }}</small>
      </div>
    </div>

    <div class="quant-decision-assistant-price-row">
      <div>
        <span>参考买入区间</span>
        <strong>{{ formatRange(assessment.deterministic.buyPriceRange) }}</strong>
      </div>
      <div>
        <span>参考卖出区间</span>
        <strong>{{ formatRange(assessment.deterministic.sellPriceRange) }}</strong>
      </div>
      <p>{{ assessment.deterministic.priceDetail }}</p>
    </div>

    <div class="quant-decision-assistant-trust">
      <div class="quant-decision-assistant-subheading">
        <strong>可信度依据</strong>
        <span>{{ assessment.deterministic.trust.sourceCount }} 个来源 · 最新 {{ formatDate(assessment.deterministic.trust.latestObservedAt) }}</span>
      </div>
      <div class="quant-decision-assistant-trust-grid">
        <span>证据可用 {{ assessment.deterministic.trust.evidenceCoverage.toFixed(0) }}%</span>
        <span>缺失 {{ assessment.deterministic.trust.missingEvidenceCount }} 条</span>
        <span>失败 {{ assessment.deterministic.trust.failedEvidenceCount }} 条</span>
        <span>跨源提示 {{ assessment.deterministic.trust.crossSourceAlertCount }} 条</span>
      </div>
      <ul v-if="assessment.deterministic.trust.reasons.length" class="quant-decision-assistant-reasons">
        <li v-for="reason in assessment.deterministic.trust.reasons" :key="reason">
          {{ reason }}
        </li>
      </ul>
    </div>

    <div class="quant-decision-assistant-ai" :class="aiStatusClass(assessment.ai.status)">
      <div class="quant-decision-assistant-subheading">
        <strong><Sparkles :size="14" aria-hidden="true" />AI 因子复核</strong>
        <span>{{ aiStatusLabel(assessment.ai.status) }}</span>
      </div>
      <p v-if="assessment.ai.status === 'unavailable'" class="quant-decision-assistant-ai-note">
        当前只使用确定性因子和证据；配置 AI 后可重新评估。
        <button class="text-button" type="button" @click="emit('openSettings')">
          打开配置
        </button>
      </p>
      <p v-else-if="assessment.ai.status === 'failed'" class="quant-decision-assistant-ai-note">
        AI 请求未完成，确定性判断已保存。错误码：{{ assessment.ai.errorCode || '未知' }}
      </p>
      <template v-else>
        <p v-if="assessment.ai.rationale" class="quant-decision-assistant-ai-rationale">
          {{ assessment.ai.rationale }}
        </p>
        <div v-if="assessment.ai.factorReviews.length" class="quant-decision-assistant-factor-list">
          <div v-for="review in assessment.ai.factorReviews" :key="review.factor" class="quant-decision-assistant-factor-row">
            <span>{{ factorLabel(review.factor) }}</span>
            <strong :class="review.accepted ? 'factor-accepted' : 'factor-rejected'">{{ stanceLabel(review.stance) }} · {{ review.confidence.toFixed(0) }}</strong>
            <small>{{ review.rationale }}</small>
          </div>
        </div>
        <p v-if="assessment.ai.rejectionReason" class="quant-decision-assistant-ai-note">
          未纳入原因：{{ assessment.ai.rejectionReason }} · 因子复核覆盖 {{ assessment.ai.factorReviewCoverage.toFixed(0) }}%
        </p>
        <p v-if="assessment.ai.citedEvidenceKeys.length" class="quant-decision-assistant-ai-citations">
          引用证据：{{ assessment.ai.citedEvidenceKeys.join('、') }}
        </p>
      </template>
    </div>

    <div v-if="assessment.factorImpact" class="quant-decision-assistant-factor-impact" aria-label="因子影响审计">
      <div class="quant-decision-assistant-subheading">
        <strong>因子影响审计</strong>
        <span>AI 实际纳入范围，不改写确定性判断</span>
      </div>
      <div class="quant-decision-assistant-factor-impact-summary" role="list" aria-label="因子影响汇总">
        <div role="listitem">
          <span>确定性分数</span>
          <strong>{{ formatContribution(assessment.factorImpact.deterministicScore) }}</strong>
          <small>有分数权重 {{ formatWeight(assessment.factorImpact.scoredWeight) }}</small>
        </div>
        <div role="listitem">
          <span>AI 已纳入</span>
          <strong>{{ assessment.factorImpact.reviewCoverage.toFixed(0) }}%</strong>
          <small>{{ formatWeight(assessment.factorImpact.reviewedWeight) }} / {{ formatWeight(assessment.factorImpact.totalWeight) }} 权重</small>
        </div>
        <div role="listitem">
          <span>AI 方向权重</span>
          <strong>支持 {{ formatWeight(assessment.factorImpact.supportWeight) }}</strong>
          <small>注意 {{ formatWeight(assessment.factorImpact.cautionWeight) }} · 反对 {{ formatWeight(assessment.factorImpact.opposeWeight) }}</small>
        </div>
        <div v-if="assessment.factorImpact.aiScore !== undefined" role="listitem">
          <span>AI 影响分</span>
          <strong>{{ formatImpactScore(assessment.factorImpact.aiScore) }}</strong>
          <small>相对确定性 {{ formatImpactDelta(assessment.factorImpact.aiScoreDelta) }}</small>
        </div>
      </div>
      <p class="quant-decision-assistant-factor-impact-note" role="note">
        确定性贡献来自本次报告的因子分数和权重；AI 权重只统计服务端接受的因子复核，未复核或未达门槛的因子不会被计入。
      </p>
      <p v-if="assessment.factorImpact.evaluatedAt" class="quant-decision-assistant-factor-impact-note" role="note">
        AI 影响快照评估于 {{ formatImpactTime(assessment.factorImpact.evaluatedAt) }}；当前行情和数据时效仍需单独核对。
      </p>
      <p v-if="assessment.factorImpact.freshnessBlockedFactors?.length" class="quant-decision-assistant-factor-impact-note quant-decision-assistant-factor-impact-warning" role="status">
        新鲜度闸门阻断：{{ assessment.factorImpact.freshnessBlockedFactors.map(factorLabel).join('、') }}；请先刷新对应数据。
      </p>
      <div class="quant-decision-assistant-factor-impact-list">
        <div v-for="factor in assessment.factorImpact.factors" :key="factor.factor" class="quant-decision-assistant-factor-impact-row">
          <div class="quant-decision-assistant-factor-impact-heading">
            <strong>{{ factor.label }}</strong>
            <span>报告权重 {{ formatWeight(factor.weight) }}</span>
            <span class="quant-decision-assistant-factor-impact-status" :class="factorImpactStatusClass(factor)">{{ factorImpactStatusLabel(factor) }}</span>
          </div>
          <div class="quant-decision-assistant-factor-impact-details">
            <span>确定性贡献 {{ formatContribution(factor.deterministicContribution) }}</span>
            <span>确定性倾向 {{ deterministicImpactStanceLabel(factor.deterministicStance) }}</span>
            <span>AI 倾向 {{ aiImpactStanceLabel(factor.aiStance) }}</span>
            <span>AI 权重 {{ formatWeight(factor.aiWeight) }}</span>
            <span v-if="factor.aiContribution !== undefined">AI 贡献 {{ formatContribution(factor.aiContribution) }}</span>
            <span v-if="factor.freshness">数据时效 {{ factorFreshnessLabel(factor.freshness) }} · {{ factor.freshness.detail }}</span>
          </div>
        </div>
      </div>
    </div>

    <details class="quant-decision-assistant-details">
      <summary>查看核对条件与来源</summary>
      <div class="quant-decision-assistant-details-grid">
        <div>
          <strong>本次检查</strong>
          <ul>
            <li v-for="check in assessment.deterministic.checks" :key="check">
              {{ check }}
            </li>
          </ul>
        </div>
        <div>
          <strong>失效条件</strong>
          <ul>
            <li v-for="condition in assessment.deterministic.invalidationConditions" :key="condition">
              {{ condition }}
            </li>
          </ul>
        </div>
        <div>
          <strong>数据来源</strong>
          <ul>
            <li v-for="source in assessment.sources" :key="source.id">
              {{ source.name }} · {{ formatDate(source.observedAt) }} · {{ source.formulaVersion }}
              <ExternalLink :size="12" aria-hidden="true" />
            </li>
          </ul>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.quant-decision-assistant-result {
  display: grid;
  min-width: 0;
  gap: 0.7rem;
}

.quant-decision-assistant-result-heading,
.quant-decision-assistant-subheading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-decision-assistant-result-heading {
  align-items: center;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.75rem;
}

.quant-decision-assistant-result-heading > div {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.quant-decision-assistant-result-kicker {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0;
}

.quant-decision-assistant-result-heading strong {
  overflow-wrap: anywhere;
  font-size: 1.15rem;
  font-weight: 780;
}

.quant-decision-assistant-recommendation,
.quant-decision-assistant-result-heading strong {
  color: hsl(var(--foreground));
}

.quant-decision-assistant-recommendation {
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.28rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 750;
  white-space: nowrap;
}

.recommendation-bullish,
.quant-decision-assistant-action-consider-buy,
.quant-decision-assistant-action-hold,
.quant-decision-assistant-action-add-review {
  color: hsl(var(--status-success));
}

.recommendation-bullish { background: hsl(var(--status-success-soft)); }
.recommendation-bearish,
.quant-decision-assistant-action-avoid,
.quant-decision-assistant-action-reduce-review { color: hsl(var(--status-danger)); }
.recommendation-bearish { background: hsl(var(--status-danger-soft)); }
.recommendation-watch,
.quant-decision-assistant-action-wait,
.quant-decision-assistant-action-verify-price,
.quant-decision-assistant-action-review-data { color: hsl(var(--status-warning)); }
.recommendation-watch { background: hsl(var(--status-warning-soft)); }

.quant-decision-assistant-rationale,
.quant-decision-assistant-price-row p,
.quant-decision-assistant-ai-rationale,
.quant-decision-assistant-ai-note,
.quant-decision-assistant-ai-citations {
  margin: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.55;
}

.quant-decision-assistant-rationale {
  color: hsl(var(--foreground));
}

.quant-decision-assistant-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-decision-assistant-metrics > div,
.quant-decision-assistant-price-row > div {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.25rem 0.45rem;
}

.quant-decision-assistant-metrics span,
.quant-decision-assistant-price-row span {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-decision-assistant-metrics strong,
.quant-decision-assistant-price-row strong {
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.quant-decision-assistant-metrics small {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  line-height: 1.35;
}

.quant-decision-assistant-market-warning {
  color: hsl(var(--status-warning)) !important;
}

.trust-high { color: hsl(var(--status-success)) !important; }
.trust-medium { color: hsl(var(--status-warning)) !important; }
.trust-low { color: hsl(var(--status-danger)) !important; }

.quant-decision-assistant-price-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-decision-assistant-price-row p {
  grid-column: 1 / -1;
  padding-left: 0.2rem;
}

.quant-decision-assistant-trust,
.quant-decision-assistant-ai,
.quant-decision-assistant-factor-impact {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-decision-assistant-subheading {
  align-items: center;
}

.quant-decision-assistant-subheading strong {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-decision-assistant-subheading span,
.quant-decision-assistant-trust-grid,
.quant-decision-assistant-details {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-assistant-trust-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
}

.quant-decision-assistant-reasons,
.quant-decision-assistant-details ul {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding-left: 1rem;
}

.quant-decision-assistant-reasons li,
.quant-decision-assistant-details li {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-assistant-ai-accepted {
  border-color: hsl(var(--status-success) / 0.32);
}

.quant-decision-assistant-ai-rejected {
  border-color: hsl(var(--status-warning) / 0.32);
}

.quant-decision-assistant-ai-muted {
  border-color: hsl(var(--border));
}

.quant-decision-assistant-factor-list {
  display: grid;
  gap: 0.25rem;
}

.quant-decision-assistant-factor-row {
  display: grid;
  grid-template-columns: minmax(5rem, 0.35fr) minmax(6rem, 0.45fr) minmax(0, 1.2fr);
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.65);
  padding: 0.25rem 0;
}

.quant-decision-assistant-factor-row > span,
.quant-decision-assistant-factor-row > strong,
.quant-decision-assistant-factor-row > small {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-decision-assistant-factor-row > span { color: hsl(var(--foreground)); font-weight: 700; }
.quant-decision-assistant-factor-row > small { color: hsl(var(--muted-foreground)); }
.factor-accepted { color: hsl(var(--status-success)); }
.factor-rejected { color: hsl(var(--status-warning)); }

.quant-decision-assistant-factor-impact-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-decision-assistant-factor-impact-summary > div {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
  border-left: 2px solid hsl(var(--status-info) / 0.45);
  padding: 0.25rem 0.45rem;
}

.quant-decision-assistant-factor-impact-summary span,
.quant-decision-assistant-factor-impact-summary small,
.quant-decision-assistant-factor-impact-details {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  line-height: 1.4;
}

.quant-decision-assistant-factor-impact-summary strong {
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.quant-decision-assistant-factor-impact-note {
  margin: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.5;
}

.quant-decision-assistant-factor-impact-warning {
  color: hsl(var(--status-warning));
}

.quant-decision-assistant-factor-impact-list {
  display: grid;
  gap: 0.25rem;
}

.quant-decision-assistant-factor-impact-row {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
  border-bottom: 1px solid hsl(var(--border) / 0.65);
  padding: 0.25rem 0;
}

.quant-decision-assistant-factor-impact-heading {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
}

.quant-decision-assistant-factor-impact-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}

.quant-decision-assistant-factor-impact-heading > span:not(.quant-decision-assistant-factor-impact-status) {
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
}

.quant-decision-assistant-factor-impact-status {
  margin-left: auto;
  overflow-wrap: anywhere;
  font-size: 0.6rem;
  font-weight: 700;
}

.factor-impact-accepted { color: hsl(var(--status-success)); }
.factor-impact-not-included { color: hsl(var(--status-warning)); }
.factor-impact-unreviewed { color: hsl(var(--muted-foreground)); }
.factor-impact-freshness-blocked { color: hsl(var(--status-warning)); }

.quant-decision-assistant-factor-impact-details {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.25rem 0.85rem;
}

.quant-decision-assistant-details {
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.55rem;
}

.quant-decision-assistant-details summary {
  width: fit-content;
  cursor: pointer;
  color: hsl(var(--foreground));
  font-weight: 700;
}

.quant-decision-assistant-details summary:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.quant-decision-assistant-details-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.5rem;
}

.quant-decision-assistant-details-grid > div {
  min-width: 0;
}

.quant-decision-assistant-details-grid strong {
  color: hsl(var(--foreground));
  font-size: 0.625rem;
}

.quant-decision-assistant-details li {
  display: flex;
  align-items: flex-start;
  gap: 0.2rem;
}

@media (max-width: 720px) {
  .quant-decision-assistant-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quant-decision-assistant-details-grid {
    grid-template-columns: 1fr;
  }

  .quant-decision-assistant-factor-impact-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .quant-decision-assistant-result-heading,
  .quant-decision-assistant-subheading {
    display: grid;
  }

  .quant-decision-assistant-metrics,
  .quant-decision-assistant-price-row,
  .quant-decision-assistant-factor-impact-summary {
    grid-template-columns: 1fr;
  }

  .quant-decision-assistant-price-row p {
    grid-column: auto;
  }

  .quant-decision-assistant-factor-row {
    grid-template-columns: minmax(4.5rem, 0.45fr) minmax(0, 0.55fr);
  }

  .quant-decision-assistant-factor-row > small {
    grid-column: 1 / -1;
  }

  .quant-decision-assistant-factor-impact-status {
    margin-left: 0;
  }
}
</style>
