<script setup lang="ts">
import type { QuantDecisionAssistant, QuantDecisionAssistantAction, QuantDecisionAssistantMode, QuantDecisionAssistantTrustLevel, QuantResearchRun } from '../lib/quant-types'
import { AlertCircle, CheckCircle2, CircleHelp, ExternalLink, RefreshCw, Sparkles } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  run: QuantResearchRun
  latestClose: number | null
  latestTradeDate: string | null
  assessment: QuantDecisionAssistant | null
  history: QuantDecisionAssistant[]
  loading: boolean
  generating: boolean
  errorMessage: string | null
  aiConfigAvailable: boolean | null
}>()

const emit = defineEmits<{
  assess: [input: { mode: QuantDecisionAssistantMode, costBasis: number | null, quantity: number | null, includeAi: boolean }]
  openSettings: []
}>()

const mode = ref<QuantDecisionAssistantMode>('buy')
const costBasisInput = ref('')
const quantityInput = ref('')
const includeAi = ref(true)

watch(() => props.run.id, () => {
  mode.value = 'buy'
  costBasisInput.value = ''
  quantityInput.value = ''
  includeAi.value = true
})

watch(() => props.assessment, (value) => {
  if (!value)
    return
  mode.value = value.scenario.mode
  costBasisInput.value = value.scenario.costBasis === null ? '' : String(value.scenario.costBasis)
  quantityInput.value = value.scenario.quantity === null ? '' : String(value.scenario.quantity)
}, { immediate: true })

const costBasis = computed(() => parsePositive(costBasisInput.value))
const quantity = computed(() => parsePositive(quantityInput.value))
const validationMessage = computed(() => {
  if (mode.value === 'holding' && costBasis.value === null)
    return '持有场景需要成本价'
  return null
})
const canSubmit = computed(() => Boolean(props.run && !props.generating && !props.loading && !validationMessage.value))

function parsePositive(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function submit(): void {
  if (!canSubmit.value)
    return
  emit('assess', {
    mode: mode.value,
    costBasis: mode.value === 'holding' ? costBasis.value : null,
    quantity: quantity.value,
    includeAi: includeAi.value,
  })
}

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
</script>

<template>
  <section class="quant-decision-assistant" aria-labelledby="quant-decision-assistant-title">
    <div class="quant-decision-assistant-heading">
      <div>
        <p class="section-kicker">
          TODAY'S DECISION
        </p>
        <h3 id="quant-decision-assistant-title">
          今日决策助手
        </h3>
        <p>用服务端行情和持仓成本生成一条可回看的判断。</p>
      </div>
      <span v-if="assessment" class="quant-decision-assistant-run-meta">评估 {{ formatDate(assessment.assessedAt) }}</span>
    </div>

    <div class="quant-decision-assistant-mode" role="group" aria-label="决策场景">
      <button type="button" :class="{ 'is-active': mode === 'buy' }" :aria-pressed="mode === 'buy'" @click="mode = 'buy'">
        准备买入
      </button>
      <button type="button" :class="{ 'is-active': mode === 'holding' }" :aria-pressed="mode === 'holding'" @click="mode = 'holding'">
        已持有
      </button>
    </div>

    <div class="quant-decision-assistant-market-note" role="status">
      <div>
        <span>当前价格</span>
        <strong>服务端自动获取</strong>
      </div>
      <small v-if="latestClose !== null">最近收盘参考 {{ formatPrice(latestClose) }} · {{ formatDate(latestTradeDate) }}</small>
      <small v-else>生成判断时读取最新行情快照</small>
    </div>

    <div class="quant-decision-assistant-form">
      <label v-if="mode === 'holding'" class="quant-decision-assistant-field">
        <span>持仓成本</span>
        <input v-model="costBasisInput" type="number" min="0.0001" step="0.01" inputmode="decimal" placeholder="例如 33.40" aria-label="持仓成本" @keydown.enter="submit">
        <small>用于计算浮亏和回本所需涨幅</small>
      </label>
      <label class="quant-decision-assistant-field">
        <span>持仓数量 <em>可选</em></span>
        <input v-model="quantityInput" type="number" min="0.0001" step="1" inputmode="decimal" placeholder="可不填" aria-label="持仓数量" @keydown.enter="submit">
        <small>只保存到本次场景快照</small>
      </label>
      <label class="quant-decision-assistant-ai-toggle">
        <span>AI 交叉核对</span>
        <span class="quant-decision-assistant-checkbox-row">
          <input v-model="includeAi" type="checkbox" aria-label="使用 AI 交叉核对">
          <strong>{{ includeAi ? '开启' : '关闭' }}</strong>
        </span>
        <small>{{ includeAi ? '合格时才影响最终动作' : '仅使用确定性数据' }}</small>
      </label>
      <button class="primary-button quant-decision-assistant-submit" type="button" :disabled="!canSubmit" :aria-label="generating ? '正在生成今日决策' : '生成今日决策'" @click="submit">
        <RefreshCw :size="15" :class="generating ? 'animate-spin' : ''" aria-hidden="true" />
        {{ generating ? 'AI 复核中' : assessment ? '重新评估' : '生成今日判断' }}
      </button>
    </div>

    <p v-if="validationMessage" class="quant-decision-assistant-form-error" role="status">
      <CircleHelp :size="14" aria-hidden="true" />
      {{ validationMessage }}
    </p>
    <p v-if="errorMessage" class="quant-decision-assistant-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </p>
    <p v-if="aiConfigAvailable === false" class="quant-decision-assistant-config" role="status">
      <Sparkles :size="14" aria-hidden="true" />
      <span>AI 未配置，本次仍可生成确定性判断。</span>
      <button class="text-button" type="button" @click="emit('openSettings')">
        配置 AI
      </button>
    </p>
    <div v-if="loading" class="quant-decision-assistant-loading" role="status">
      <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
      正在读取最近评估
    </div>

    <template v-if="assessment && !loading">
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
    </template>
    <p v-else-if="!loading" class="quant-decision-assistant-empty">
      <CheckCircle2 :size="15" aria-hidden="true" />
      生成一次评估后，这里会保留你的场景数据和判断依据。
    </p>

    <p v-if="history.length > 1" class="quant-decision-assistant-history-meta">
      已保留 {{ history.length }} 次评估快照，历史数据不会随因子配置变化。
    </p>
  </section>
</template>

<style scoped>
.quant-decision-assistant {
  display: grid;
  gap: 0.7rem;
  margin-top: 0.9rem;
  border-top: 1px solid hsl(var(--status-info) / 0.3);
  padding-top: 0.85rem;
}

.quant-decision-assistant-heading,
.quant-decision-assistant-result-heading,
.quant-decision-assistant-subheading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-decision-assistant-heading h3 {
  margin: 0.3rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 720;
}

.quant-decision-assistant-heading p:not(.section-kicker) {
  margin: 0.25rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-decision-assistant-run-meta,
.quant-decision-assistant-history-meta,
.quant-decision-assistant-form small,
.quant-decision-assistant-trust-grid,
.quant-decision-assistant-subheading span,
.quant-decision-assistant-price-row span,
.quant-decision-assistant-details,
.quant-decision-assistant-empty {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-assistant-run-meta {
  flex: 0 0 auto;
  padding-top: 0.2rem;
  white-space: nowrap;
}

.quant-decision-assistant-mode {
  display: inline-grid;
  width: fit-content;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.15rem;
}

.quant-decision-assistant-mode button {
  min-height: 1.85rem;
  border: 0;
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: transparent;
  padding: 0.3rem 0.7rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 0.6875rem;
  font-weight: 700;
}

.quant-decision-assistant-mode button.is-active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.quant-decision-assistant-mode button:focus-visible,
.quant-decision-assistant-details summary:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.quant-decision-assistant-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 0.5rem;
}

.quant-decision-assistant-form label {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.quant-decision-assistant-market-note {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.5rem;
  border-left: 2px solid hsl(var(--status-info) / 0.55);
  padding: 0.25rem 0.45rem;
}

.quant-decision-assistant-market-note > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-decision-assistant-market-note span,
.quant-decision-assistant-field > span:first-child,
.quant-decision-assistant-ai-toggle > span:first-child {
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  font-weight: 700;
}

.quant-decision-assistant-market-note strong {
  color: hsl(var(--status-info));
  font-size: 0.75rem;
  white-space: nowrap;
}

.quant-decision-assistant-market-note small {
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-assistant-ai-toggle {
  align-self: stretch;
  align-content: end;
}

.quant-decision-assistant-checkbox-row {
  display: flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.35rem;
  color: hsl(var(--foreground));
}

.quant-decision-assistant-checkbox-row input {
  flex: 0 0 auto;
  width: 0.95rem;
  min-height: 0.95rem;
  margin: 0;
  accent-color: hsl(var(--primary));
}

.quant-decision-assistant-checkbox-row strong {
  font-size: 0.6875rem;
}

.quant-decision-assistant-form em {
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  font-style: normal;
  font-weight: 500;
}

.quant-decision-assistant-form .quant-decision-assistant-field input {
  width: 100%;
  min-width: 0;
  min-height: 2rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--background));
  padding: 0.35rem 0.5rem;
  color: hsl(var(--foreground));
  font: inherit;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.quant-decision-assistant-form .quant-decision-assistant-field input:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 1px;
}

.quant-decision-assistant-submit {
  min-height: 2rem;
  white-space: nowrap;
}

.quant-decision-assistant-form-error,
.quant-decision-assistant-error,
.quant-decision-assistant-config,
.quant-decision-assistant-loading,
.quant-decision-assistant-empty {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  overflow-wrap: anywhere;
}

.quant-decision-assistant-form-error {
  color: hsl(var(--status-warning));
  font-size: 0.625rem;
}

.quant-decision-assistant-error {
  border: 1px solid hsl(var(--status-danger) / 0.25);
  background: hsl(var(--status-danger-soft));
  padding: 0.45rem 0.55rem;
  color: hsl(var(--status-danger));
  font-size: 0.625rem;
}

.quant-decision-assistant-config {
  border: 1px solid hsl(var(--status-warning) / 0.25);
  background: hsl(var(--status-warning-soft));
  padding: 0.45rem 0.55rem;
  color: hsl(var(--status-warning));
  font-size: 0.625rem;
}

.quant-decision-assistant-config span,
.quant-decision-assistant-error span {
  min-width: 0;
}

.quant-decision-assistant-loading {
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.55rem 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
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
.quant-decision-assistant-ai {
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

.quant-decision-assistant-history-meta {
  margin: 0;
}

@media (max-width: 720px) {
  .quant-decision-assistant-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quant-decision-assistant-submit {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .quant-decision-assistant-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quant-decision-assistant-details-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .quant-decision-assistant-heading,
  .quant-decision-assistant-result-heading,
  .quant-decision-assistant-subheading {
    display: grid;
  }

  .quant-decision-assistant-run-meta {
    padding-top: 0;
  }

  .quant-decision-assistant-form,
  .quant-decision-assistant-metrics,
  .quant-decision-assistant-price-row {
    grid-template-columns: 1fr;
  }

  .quant-decision-assistant-market-note {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2rem;
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
}
</style>
