<script setup lang="ts">
import type { QuantAiResponseMode, QuantAiRunAudit, QuantFactorFreshness, QuantResearchReport, QuantResearchSummary } from '../lib/quant-view-models'
import type { QuantAiSummaryFactorRow } from './quant-detail/quant-ai-summary-contracts'
import { AlertCircle, BrainCircuit, CircleHelp, RefreshCw } from 'lucide-vue-next'
import { computed } from 'vue'
import { buildQuantFactorFreshness } from '../lib/quant-factor-freshness'
import QuantAiFactorReviewPanel from './quant-detail/QuantAiFactorReviewPanel.vue'
import QuantAiRunAuditPanel from './quant-detail/QuantAiRunAuditPanel.vue'
import QuantAiSummaryCitations from './quant-detail/QuantAiSummaryCitations.vue'
import QuantAiProgressStatus from './QuantAiProgressStatus.vue'

const props = defineProps<{
  report: QuantResearchReport
  summary: QuantResearchSummary | null
  loading: boolean
  generating: boolean
  streamMode: QuantAiResponseMode | null
  streamReceivedChars: number
  auditHistory: QuantAiRunAudit[]
  auditHistoryLoading: boolean
  auditHistoryError: string | null
  errorMessage: string | null
  configurationError: boolean
  questionPromptReady: boolean
}>()

const emit = defineEmits<{
  generate: []
  openSettings: []
  useNextCheck: [check: string]
}>()

const factorRows = computed<QuantAiSummaryFactorRow[]>(() => {
  const reviews = props.summary?.summary.factorReviews ?? []
  const reviewByKey = new Map(reviews.map(review => [review.factor, review]))
  const impactByKey = new Map(props.summary?.factorImpact?.factors.map(factor => [factor.factor, factor]) || [])
  const rows: QuantAiSummaryFactorRow[] = []
  const seen = new Set<string>()
  for (const factor of props.report.factorModel?.factors ?? []) {
    if (factor.weight <= 0)
      continue
    rows.push({ key: factor.key, label: factor.label, factor, review: reviewByKey.get(factor.key) || null, impact: impactByKey.get(factor.key) || null })
    seen.add(factor.key)
  }
  for (const review of reviews) {
    if (!seen.has(review.factor))
      rows.push({ key: review.factor, label: factorLabel(review.factor), factor: null, review, impact: impactByKey.get(review.factor) || null })
  }
  return rows
})

const requiredFactorRows = computed(() => factorRows.value.filter(row => row.factor !== null && row.factor.weight > 0))
const acceptedFactorCount = computed(() => requiredFactorRows.value.filter(row => row.review?.accepted).length)
const factorReviewIncomplete = computed(() => Boolean(props.summary && requiredFactorRows.value.length > 0 && acceptedFactorCount.value < requiredFactorRows.value.length))
const factorCoverageLabel = computed(() => requiredFactorRows.value.length
  ? `${acceptedFactorCount.value} / ${requiredFactorRows.value.length} 个有权重因子已纳入`
  : '当前报告没有可展示的有权重因子')
const factorImpact = computed(() => props.summary?.factorImpact ?? null)
const auditRows = computed(() => props.auditHistory.length
  ? props.auditHistory
  : props.summary?.audit ? [props.summary.audit] : [])

function reportStatusLabel(status: QuantResearchReport['status']): string {
  return { ready: '证据完整', partial: '部分可用', insufficient_data: '数据不足' }[status]
}

function reportActionLabel(action: QuantResearchReport['action']): string {
  return {
    'research-window': '进入研究窗口',
    'wait-confirmation': '等待确认',
    'reassess': '重新评估',
    'complete-data': '补齐数据',
  }[action]
}

function recommendationLabel(value: string): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : '观望'
}

function factorLabel(value: string): string {
  return {
    'trend': '趋势',
    'valuation': '估值',
    'quality': '盈利质量',
    'shareholder-return': '股东回报',
    'risk': '风险',
  }[value] || value
}

function factorFreshness(row: QuantAiSummaryFactorRow): QuantFactorFreshness | null {
  if (row.impact)
    return row.impact.freshness ?? null
  return row.factor ? buildQuantFactorFreshness(row.factor, props.report.evidence) : null
}

function factorFreshnessLabel(value: QuantFactorFreshness | null): string {
  if (!value)
    return '时间未知'
  return value.status === 'fresh' ? '最新' : value.status === 'aging' ? '需复核' : value.status === 'stale' ? '已过期' : '时间未知'
}

function factorFreshnessClass(value: QuantFactorFreshness | null): string {
  return `quant-ai-summary-factor-freshness-${value?.status || 'unknown'}`
}
</script>

<template>
  <section class="quant-ai-summary-panel" aria-labelledby="quant-ai-summary-title">
    <div class="quant-ai-summary-heading">
      <div>
        <p class="section-kicker">
          EVIDENCE EXPLAINER
        </p>
        <h3 id="quant-ai-summary-title">
          AI 证据解读
        </h3>
        <small>基于本份报告证据复核推荐；价格区间始终来自确定性公式</small>
      </div>
      <button class="secondary-button quant-ai-summary-button" type="button" :disabled="loading || generating" :title="generating ? '正在生成 AI 决策复核' : '基于当前研究报告生成解释'" @click="emit('generate')">
        <RefreshCw v-if="loading || generating" :size="14" class="animate-spin" aria-hidden="true" />
        <BrainCircuit v-else :size="14" aria-hidden="true" />
        {{ loading ? '读取中' : generating ? 'AI 复核中' : summary ? '重新解读' : '生成解读' }}
      </button>
    </div>

    <QuantAiRunAuditPanel
      :audit-rows="auditRows"
      :audit-history-loading="auditHistoryLoading"
      :audit-history-error="auditHistoryError"
    />

    <div class="quant-ai-summary-deterministic" aria-label="确定性研究结论">
      <div>
        <span>报告状态</span>
        <strong>{{ reportStatusLabel(report.status) }}</strong>
      </div>
      <div>
        <span>研究动作</span>
        <strong>{{ reportActionLabel(report.action) }}</strong>
      </div>
      <div>
        <span>确定性分数</span>
        <strong>{{ report.score === null ? '--' : `${report.score.toFixed(1)} / 100` }}</strong>
      </div>
    </div>

    <QuantAiFactorReviewPanel
      :factor-rows="factorRows"
      :factor-coverage-label="factorCoverageLabel"
      :has-summary="Boolean(summary)"
      :factor-impact="factorImpact"
      :factor-impact-snapshot="summary?.factorImpactSnapshot || null"
      :factor-review-incomplete="factorReviewIncomplete"
      :factor-label="factorLabel"
      :factor-freshness="factorFreshness"
      :factor-freshness-label="factorFreshnessLabel"
      :factor-freshness-class="factorFreshnessClass"
    />

    <div v-if="loading" class="quant-ai-summary-state" role="status">
      <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
      <span>正在读取已保存的解读</span>
    </div>
    <div v-else-if="generating" class="quant-ai-summary-state quant-ai-summary-streaming-state" role="status">
      <QuantAiProgressStatus :active="generating" :label="streamMode === 'json' ? '正在等待 AI 完整响应' : '正在生成 AI 决策复核'" />
      <small v-if="streamMode === 'stream' && streamReceivedChars > 0">已接收 {{ streamReceivedChars }} 字，结构校验通过后显示结论</small>
      <small v-else-if="streamMode === 'stream'">已建立流式连接，等待 AI 首段内容</small>
      <small v-else>等待 AI 返回完整响应，完成后统一校验</small>
    </div>
    <div v-else-if="errorMessage" class="quant-ai-summary-state quant-ai-summary-state-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
      <button v-if="configurationError" class="text-button" type="button" @click="emit('openSettings')">
        打开 AI 配置
      </button>
    </div>
    <template v-else-if="summary">
      <section v-if="summary.summary.decisionReview" class="quant-ai-summary-decision" aria-label="AI 决策复核">
        <div class="quant-ai-summary-decision-heading">
          <div>
            <span>AI 决策复核</span>
            <strong>{{ recommendationLabel(summary.summary.decisionReview.recommendation) }}</strong>
          </div>
          <span class="quant-ai-summary-decision-status" :class="summary.summary.decisionReview.accepted ? 'quant-ai-summary-decision-accepted' : 'quant-ai-summary-decision-not-accepted'">
            {{ summary.summary.decisionReview.accepted ? '已纳入最终推荐' : summary.summary.decisionReview.rejectionReason === 'deterministic-watch' ? '数据不足，保持观望' : summary.summary.decisionReview.rejectionReason === 'factor-review-incomplete' ? '因子复核不足，保留确定性结论' : summary.summary.decisionReview.rejectionReason === 'factor-conflict' ? '因子方向冲突，保留确定性结论' : '低置信度，保留确定性结论' }}
          </span>
        </div>
        <div class="quant-ai-summary-decision-meta">
          <span>置信度 {{ summary.summary.decisionReview.confidence.toFixed(0) }}</span>
          <span>因子复核 {{ summary.summary.decisionReview.factorReviewCoverage.toFixed(0) }}%</span>
          <span>{{ summary.summary.decisionReview.citedEvidenceKeys.length }} 条引用证据</span>
          <span>{{ summary.model }} · {{ summary.generatedAt || '时间未记录' }}</span>
        </div>
        <p>{{ summary.summary.decisionReview.rationale }}</p>
        <div v-if="summary.summary.decisionReview.invalidationConditions.length" class="quant-ai-summary-decision-invalidations">
          <span>失效条件</span>
          <ul>
            <li v-for="item in summary.summary.decisionReview.invalidationConditions" :key="`ai-invalidation-${item}`">
              {{ item }}
            </li>
          </ul>
        </div>
      </section>
      <p class="quant-ai-summary-overview">
        {{ summary.summary.overview }}
      </p>
      <div class="quant-ai-summary-grid">
        <div class="quant-ai-summary-column quant-ai-summary-column-support">
          <span>支持点</span>
          <ul>
            <li v-for="item in summary.summary.supports" :key="`support-${item}`">
              {{ item }}
            </li>
          </ul>
        </div>
        <div class="quant-ai-summary-column quant-ai-summary-column-concern">
          <span>需留意</span>
          <ul>
            <li v-for="item in summary.summary.concerns" :key="`concern-${item}`">
              {{ item }}
            </li>
          </ul>
        </div>
        <div class="quant-ai-summary-column quant-ai-summary-column-next">
          <span>下一步核对</span>
          <ul>
            <li v-for="item in summary.summary.nextChecks" :key="`next-${item}`" class="quant-ai-summary-next-check">
              <span class="quant-ai-summary-next-check-text">{{ item }}</span>
              <button
                class="text-button quant-ai-summary-next-prompt"
                type="button"
                :disabled="!questionPromptReady || !item.trim()"
                :aria-label="`将摘要核对项带入当前追问：${item}`"
                title="将摘要核对项转换为当前追问"
                @click="emit('useNextCheck', item)"
              >
                <BrainCircuit :size="13" aria-hidden="true" />
                带入追问
              </button>
            </li>
          </ul>
        </div>
      </div>
      <QuantAiSummaryCitations
        :evidence="report.evidence"
        :cited-evidence-keys="summary.citedEvidenceKeys"
        :model="summary.model"
        :generated-at="summary.generatedAt"
      />
    </template>
    <div v-else class="quant-ai-summary-state" role="status">
      <CircleHelp :size="15" aria-hidden="true" />
      <span>配置 AI 后，生成新研究报告会自动进行决策复核；也可以按需生成解读。</span>
    </div>
  </section>
</template>

<style scoped>
.quant-ai-summary-panel {
  display: grid;
  gap: 0.7rem;
  margin-top: 0.85rem;
  border-top: 1px solid hsl(var(--primary) / 0.28);
  padding-top: 0.8rem;
}

.quant-ai-summary-deterministic {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--muted) / 0.28);
  padding: 0.5rem 0.6rem;
}

.quant-ai-summary-deterministic > div {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.quant-ai-summary-deterministic span {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-summary-deterministic strong {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 740;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quant-ai-summary-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-ai-summary-heading h3 {
  margin: 0.3rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 740;
}

.quant-ai-summary-heading small {
  display: block;
  margin-top: 0.2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-ai-summary-button {
  flex: 0 0 auto;
}

.quant-ai-summary-state {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  text-align: center;
}

.quant-ai-summary-streaming-state {
  flex-direction: column;
  min-height: 3.5rem;
}

.quant-ai-summary-streaming-state small {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-summary-state-error {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: hsl(var(--status-danger));
}

.quant-ai-summary-overview {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.55;
}

.quant-ai-summary-decision {
  display: grid;
  gap: 0.45rem;
  border: 1px solid hsl(var(--status-info) / 0.28);
  border-left: 3px solid hsl(var(--status-info) / 0.72);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-info) / 0.06);
  padding: 0.6rem 0.7rem;
}

.quant-ai-summary-decision-heading,
.quant-ai-summary-decision-heading > div,
.quant-ai-summary-decision-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
}

.quant-ai-summary-decision-heading {
  justify-content: space-between;
  align-items: flex-start;
}

.quant-ai-summary-decision-heading > div {
  align-items: baseline;
}

.quant-ai-summary-decision-heading span,
.quant-ai-summary-decision-meta,
.quant-ai-summary-decision-invalidations > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.quant-ai-summary-decision-heading strong {
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 780;
}

.quant-ai-summary-decision-status {
  flex: 0 0 auto;
  font-weight: 720;
}

.quant-ai-summary-decision-accepted {
  color: hsl(var(--status-success)) !important;
}

.quant-ai-summary-decision-not-accepted {
  color: hsl(var(--status-warning)) !important;
}

.quant-ai-summary-decision-meta {
  flex-wrap: wrap;
}

.quant-ai-summary-decision p {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-ai-summary-decision-invalidations {
  display: grid;
  gap: 0.25rem;
}

.quant-ai-summary-decision-invalidations ul {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding-left: 0.95rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-ai-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.quant-ai-summary-column {
  min-width: 0;
  border-top: 2px solid hsl(var(--status-info) / 0.35);
  padding-top: 0.4rem;
}

.quant-ai-summary-column > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  font-weight: 700;
}

.quant-ai-summary-column-support {
  border-top-color: hsl(var(--status-success) / 0.55);
}

.quant-ai-summary-column-concern {
  border-top-color: hsl(var(--status-warning) / 0.55);
}

.quant-ai-summary-column-next {
  border-top-color: hsl(var(--status-info) / 0.55);
}

.quant-ai-summary-column ul {
  display: grid;
  gap: 0.25rem;
  margin: 0.35rem 0 0;
  padding-left: 0.95rem;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-ai-summary-next-check {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.35rem;
}

.quant-ai-summary-next-check-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quant-ai-summary-next-prompt {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.2rem;
  white-space: nowrap;
}

.quant-ai-summary-next-prompt:hover:not(:disabled) {
  text-decoration: underline;
}

.quant-ai-summary-next-prompt:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 680px) {
  .quant-ai-summary-heading {
    flex-direction: column;
  }

  .quant-ai-summary-button {
    width: 100%;
  }

  .quant-ai-summary-grid {
    grid-template-columns: 1fr;
  }

  .quant-ai-summary-deterministic {
    grid-template-columns: 1fr;
  }

  .quant-ai-summary-impact {
    grid-template-columns: 1fr;
  }

  .quant-ai-summary-next-check {
    grid-template-columns: minmax(0, 1fr);
  }

  .quant-ai-summary-next-prompt {
    justify-self: start;
  }

  .quant-ai-summary-decision-heading {
    display: grid;
  }
}
</style>
