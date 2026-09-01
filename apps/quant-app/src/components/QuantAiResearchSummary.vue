<script setup lang="ts">
import type { QuantAiFactorImpact, QuantAiFactorReview, QuantAiResponseMode, QuantAiRunAudit, QuantFactorFreshness, QuantResearchEvidence, QuantResearchFactor, QuantResearchReport, QuantResearchSummary } from '../lib/quant-types'
import { AlertCircle, BrainCircuit, CheckCircle2, CircleHelp, RefreshCw } from 'lucide-vue-next'
import { computed } from 'vue'
import { buildQuantFactorFreshness } from '../lib/quant-factor-freshness'
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

const evidenceByKey = computed(() => new Map(props.report.evidence.map(item => [item.key, item])))

interface FactorRow {
  readonly key: string
  readonly label: string
  readonly factor: QuantResearchFactor | null
  readonly review: QuantAiFactorReview | null
  readonly impact: QuantAiFactorImpact['factors'][number] | null
}

const factorRows = computed<FactorRow[]>(() => {
  const reviews = props.summary?.summary.factorReviews ?? []
  const reviewByKey = new Map(reviews.map(review => [review.factor, review]))
  const impactByKey = new Map(props.summary?.factorImpact?.factors.map(factor => [factor.factor, factor]) || [])
  const rows: FactorRow[] = []
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

function citedEvidence(key: string): QuantResearchEvidence | null {
  return evidenceByKey.value.get(key) || null
}

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

function factorFreshness(row: FactorRow): QuantFactorFreshness | null {
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

function factorStatusLabel(value: string): string {
  return { ready: '数据完整', partial: '部分覆盖', missing: '数据缺失', unavailable: '来源不可用' }[value] || value
}

function factorStatusClass(value: string): string {
  return `quant-ai-summary-factor-status-${value}`
}

function factorReviewStatusLabel(row: FactorRow): string {
  if (!row.review)
    return 'AI 未返回复核'
  const freshness = factorFreshness(row)
  if (freshness && freshness.status !== 'fresh')
    return freshness.status === 'unknown' ? '时间未知，未计入' : '数据时效不足，未计入'
  return factorReviewDecisionLabel(row.review.accepted, row.review.stance)
}

function factorReviewStatusClass(row: FactorRow): string {
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

function evidenceStatusLabel(status: QuantResearchEvidence['status']): string {
  return { pass: '通过', caution: '注意', fail: '未通过', missing: '数据不足' }[status]
}

function evidenceStatusClass(status: QuantResearchEvidence['status']): string {
  return `quant-ai-summary-evidence-${status}`
}

function formatEvidenceValue(item: QuantResearchEvidence): string {
  if (item.value === null)
    return '--'
  if (item.key === 'trend-sample' || item.key === 'akshare-daily-sample')
    return `${item.value.toFixed(0)} 根`
  if (item.key === 'quality-history' || item.key === 'akshare-financial-sample')
    return `${item.value.toFixed(0)} 期`
  if (item.key === 'risk-volume')
    return `${item.value.toFixed(2)} 倍`
  if (item.key === 'risk-streak')
    return `${item.value.toFixed(0)} 天`
  if (item.key === 'quality-cashflow')
    return `${(item.value * 100).toFixed(2)}%`
  if (item.key.startsWith('trend-') || item.key.startsWith('quality-') || item.key.startsWith('akshare-') || item.key === 'shareholder-yield')
    return `${item.value.toFixed(2)}%`
  return item.value.toFixed(2)
}

function formatEvidenceDate(value: string | null): string {
  if (!value)
    return '时间未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  if (/^\d{8}$/u.test(compact))
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  return value.slice(0, 10)
}

function formatImpactTime(value: string | undefined): string {
  if (!value)
    return '时间未记录'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 16) : parsed.toISOString().replace('T', ' ').slice(0, 16)
}

function auditStatusLabel(value: QuantAiRunAudit['status']): string {
  return value === 'completed' ? '已完成' : value === 'failed' ? '失败' : '已取消'
}

function auditStatusClass(value: QuantAiRunAudit['status']): string {
  return `quant-ai-summary-audit-status-${value}`
}

function auditResponseModeLabel(value: QuantAiResponseMode): string {
  return value === 'stream' ? '流式' : '非流式'
}

function formatAuditDuration(value: number): string {
  if (value < 1_000)
    return `${value} 毫秒`
  if (value < 60_000)
    return `${(value / 1_000).toFixed(1)} 秒`
  return `${(value / 60_000).toFixed(1)} 分钟`
}

function formatAuditTimeout(value: number): string {
  return `${(value / 60_000).toFixed(0)} 分钟预算`
}

function formatAuditFailure(audit: QuantAiRunAudit): string {
  return [audit.errorCode, audit.errorMessage].filter(Boolean).join(' · ') || auditStatusLabel(audit.status)
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

    <section class="quant-ai-summary-audit" aria-label="AI 运行审计">
      <div class="quant-ai-summary-audit-heading">
        <div>
          <span>AI 运行审计</span>
          <small>记录运行元数据，不保存提示词或模型原文</small>
        </div>
        <small v-if="auditRows.length">最近 {{ auditRows.length }} 次</small>
      </div>
      <div v-if="auditHistoryLoading" class="quant-ai-summary-audit-state" role="status">
        <RefreshCw :size="13" class="animate-spin" aria-hidden="true" />
        <span>正在读取运行记录</span>
      </div>
      <div v-else-if="auditRows.length" class="quant-ai-summary-audit-list">
        <article v-for="audit in auditRows" :key="audit.id" class="quant-ai-summary-audit-row">
          <div class="quant-ai-summary-audit-primary">
            <div>
              <strong :class="auditStatusClass(audit.status)">{{ auditStatusLabel(audit.status) }}</strong>
              <span>{{ audit.model }}</span>
            </div>
            <small>{{ formatImpactTime(audit.completedAt) }}</small>
          </div>
          <div class="quant-ai-summary-audit-meta">
            <span>{{ audit.provider }}</span>
            <span>{{ auditResponseModeLabel(audit.responseMode) }}</span>
            <span>耗时 {{ formatAuditDuration(audit.durationMs) }}</span>
            <span>{{ formatAuditTimeout(audit.generationTimeoutMs) }}</span>
            <span>接收 {{ audit.receivedChars }} 字</span>
          </div>
          <p v-if="audit.status !== 'completed'" class="quant-ai-summary-audit-failure">
            {{ formatAuditFailure(audit) }}
          </p>
        </article>
      </div>
      <p v-else-if="auditHistoryError" class="quant-ai-summary-audit-state quant-ai-summary-audit-state-error" role="status">
        {{ auditHistoryError }}
      </p>
      <p v-else class="quant-ai-summary-audit-state" role="status">
        尚未记录 AI 摘要运行
      </p>
      <p v-if="auditHistoryError && auditRows.length" class="quant-ai-summary-audit-state quant-ai-summary-audit-state-error" role="status">
        {{ auditHistoryError }}
      </p>
    </section>

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

    <section v-if="factorRows.length" class="quant-ai-summary-factors" aria-label="因子覆盖与 AI 复核">
      <div class="quant-ai-summary-factors-heading">
        <div>
          <span>因子覆盖与 AI 复核</span>
          <small>{{ factorCoverageLabel }} · 仅已纳入的因子可影响 AI 决策</small>
        </div>
        <small v-if="!summary">等待生成 AI 复核</small>
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
      <p v-if="factorImpact?.evaluatedAt || summary?.factorImpactSnapshot?.evaluatedAt" class="quant-ai-summary-impact-note" role="note">
        当前时效评估 {{ formatImpactTime(factorImpact?.evaluatedAt) }}<span v-if="summary?.factorImpactSnapshot?.evaluatedAt"> · AI 快照评估 {{ formatImpactTime(summary.factorImpactSnapshot.evaluatedAt) }}</span>
      </p>
      <p v-if="factorImpact?.freshnessBlockedFactors?.length" class="quant-ai-summary-factor-warning" role="status">
        新鲜度闸门阻断：{{ factorImpact.freshnessBlockedFactors?.map(factorLabel).join('、') }}；这些因子仍可查看 AI 解释，但不会进入最终推荐。
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
      <div class="quant-ai-summary-citations">
        <div class="quant-ai-summary-citations-heading">
          <span>引用证据</span>
          <small>{{ summary.citedEvidenceKeys.length }} 条 · {{ summary.model }} · {{ summary.generatedAt || '时间未记录' }}</small>
        </div>
        <div class="quant-ai-summary-citation-list">
          <article v-for="key in summary.citedEvidenceKeys" :key="key" class="quant-ai-summary-citation" :class="citedEvidence(key) ? evidenceStatusClass(citedEvidence(key)!.status) : 'quant-ai-summary-evidence-missing'">
            <div class="quant-ai-summary-citation-primary">
              <div class="quant-ai-summary-citation-title">
                <CheckCircle2 v-if="citedEvidence(key)" :size="13" aria-hidden="true" />
                <CircleHelp v-else :size="13" aria-hidden="true" />
                <strong>{{ citedEvidence(key)?.label || key }}</strong>
                <span v-if="citedEvidence(key)">{{ evidenceStatusLabel(citedEvidence(key)!.status) }}</span>
                <span v-else>当前报告未找到</span>
              </div>
              <strong class="quant-ai-summary-citation-value">{{ citedEvidence(key) ? formatEvidenceValue(citedEvidence(key)!) : '--' }}</strong>
            </div>
            <p v-if="citedEvidence(key)" class="quant-ai-summary-citation-detail">
              {{ citedEvidence(key)!.detail }}
            </p>
            <div v-if="citedEvidence(key)" class="quant-ai-summary-citation-meta">
              <span>阈值 {{ citedEvidence(key)!.threshold }}</span>
              <span>{{ citedEvidence(key)!.source }}</span>
              <span>{{ formatEvidenceDate(citedEvidence(key)!.observedAt) }} · {{ citedEvidence(key)!.formulaVersion }}</span>
            </div>
            <p v-else class="quant-ai-summary-citation-detail">
              引用 key：{{ key }}；当前报告未返回可核验数值。
            </p>
          </article>
          <span v-if="!summary.citedEvidenceKeys.length" class="quant-ai-summary-empty-citation">
            <CircleHelp :size="13" aria-hidden="true" />
            未返回引用证据
          </span>
        </div>
      </div>
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

.quant-ai-summary-heading,
.quant-ai-summary-citations-heading {
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

.quant-ai-summary-heading small,
.quant-ai-summary-citations-heading small {
  display: block;
  margin-top: 0.2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-ai-summary-button {
  flex: 0 0 auto;
}

.quant-ai-summary-audit {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.65rem;
}

.quant-ai-summary-audit-heading,
.quant-ai-summary-audit-primary,
.quant-ai-summary-audit-primary > div,
.quant-ai-summary-audit-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
}

.quant-ai-summary-audit-heading,
.quant-ai-summary-audit-primary {
  justify-content: space-between;
  align-items: flex-start;
}

.quant-ai-summary-audit-heading > div,
.quant-ai-summary-audit-primary > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-ai-summary-audit-heading span {
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  font-weight: 720;
}

.quant-ai-summary-audit-heading small,
.quant-ai-summary-audit-primary small,
.quant-ai-summary-audit-meta,
.quant-ai-summary-audit-state {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-ai-summary-audit-list {
  display: grid;
  gap: 0.35rem;
}

.quant-ai-summary-audit-row {
  display: grid;
  gap: 0.3rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--muted) / 0.18);
  padding: 0.5rem 0.6rem;
}

.quant-ai-summary-audit-primary strong {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  font-weight: 740;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quant-ai-summary-audit-primary span {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quant-ai-summary-audit-meta {
  flex-wrap: wrap;
}

.quant-ai-summary-audit-meta span {
  border-right: 1px solid hsl(var(--border));
  padding-right: 0.45rem;
}

.quant-ai-summary-audit-meta span:last-child {
  border-right: 0;
  padding-right: 0;
}

.quant-ai-summary-audit-status-completed {
  color: hsl(var(--status-success)) !important;
}

.quant-ai-summary-audit-status-failed {
  color: hsl(var(--status-danger)) !important;
}

.quant-ai-summary-audit-status-cancelled {
  color: hsl(var(--status-warning)) !important;
}

.quant-ai-summary-audit-failure,
.quant-ai-summary-audit-state-error {
  margin: 0;
  color: hsl(var(--status-danger));
}

.quant-ai-summary-audit-state {
  display: flex;
  min-height: 1.4rem;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
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

.quant-ai-summary-column > span,
.quant-ai-summary-citations-heading > span {
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

.quant-ai-summary-citations {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-ai-summary-citation-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.quant-ai-summary-citation {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
  border: 1px solid hsl(var(--status-success) / 0.25);
  border-left: 2px solid hsl(var(--status-success) / 0.62);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-success) / 0.06);
  padding: 0.45rem 0.5rem;
}

.quant-ai-summary-citation-primary,
.quant-ai-summary-citation-title,
.quant-ai-summary-citation-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.3rem;
}

.quant-ai-summary-citation-primary {
  justify-content: space-between;
}

.quant-ai-summary-citation-title {
  overflow: hidden;
  color: hsl(var(--status-success));
}

.quant-ai-summary-citation-title strong {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quant-ai-summary-citation-title span {
  flex: 0 0 auto;
  font-size: 0.625rem;
  font-weight: 720;
}

.quant-ai-summary-citation-value {
  flex: 0 0 auto;
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.quant-ai-summary-citation-detail {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
}

.quant-ai-summary-citation-meta {
  flex-wrap: wrap;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-ai-summary-citation-meta span {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.quant-ai-summary-evidence-pass {
  border-left-color: hsl(var(--status-success) / 0.72);
}

.quant-ai-summary-evidence-pass .quant-ai-summary-citation-title span {
  color: hsl(var(--status-success));
}

.quant-ai-summary-evidence-caution {
  border-color: hsl(var(--status-warning) / 0.25);
  border-left-color: hsl(var(--status-warning) / 0.75);
  background: hsl(var(--status-warning) / 0.06);
}

.quant-ai-summary-evidence-caution .quant-ai-summary-citation-title {
  color: hsl(var(--status-warning));
}

.quant-ai-summary-evidence-caution .quant-ai-summary-citation-title span {
  color: hsl(var(--status-warning));
}

.quant-ai-summary-evidence-fail {
  border-color: hsl(var(--status-danger) / 0.25);
  border-left-color: hsl(var(--status-danger) / 0.75);
  background: hsl(var(--status-danger) / 0.06);
}

.quant-ai-summary-evidence-fail .quant-ai-summary-citation-title {
  color: hsl(var(--status-danger));
}

.quant-ai-summary-evidence-fail .quant-ai-summary-citation-title span {
  color: hsl(var(--status-danger));
}

.quant-ai-summary-empty-citation {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.5);
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.25rem 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.25;
}

.quant-ai-summary-citation-list > .quant-ai-summary-empty-citation {
  width: fit-content;
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

  .quant-ai-summary-citation-primary {
    align-items: flex-start;
  }

  .quant-ai-summary-citation-title {
    align-items: flex-start;
  }

  .quant-ai-summary-citation-title strong {
    white-space: normal;
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
