<script setup lang="ts">
import type { QuantDecisionRecord, QuantDecisionRecordAction, QuantResearchRun } from '../lib/quant-types'
import { AlertCircle, CalendarClock, CheckCircle2, CircleHelp, History, Save } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import QuantDecisionOutcome from './QuantDecisionOutcome.vue'

const props = defineProps<{
  run: QuantResearchRun | null
  record: QuantDecisionRecord | null
  history: QuantDecisionRecord[]
  loading: boolean
  historyLoading: boolean
  saving: boolean
  latestPrice: number | null
  latestPriceObservedAt: string | null
  loadErrorMessage: string | null
  historyErrorMessage: string | null
  saveErrorMessage: string | null
  saveMessage: string | null
}>()

const emit = defineEmits<{
  save: [action: QuantDecisionRecordAction, note: string | null]
}>()

const actionOptions: readonly { value: QuantDecisionRecordAction, label: string, description: string }[] = [
  { value: 'watch', label: '继续观察', description: '暂不改变计划' },
  { value: 'plan-buy', label: '计划买入', description: '等待价格或条件' },
  { value: 'holding', label: '已持有', description: '记录当前持仓判断' },
  { value: 'sold', label: '已卖出', description: '保留退出后的复盘' },
]

const formAction = ref<QuantDecisionRecordAction>('watch')
const formNote = ref('')
const formNoteLength = computed(() => formNote.value.length)

function actionLabel(action: QuantDecisionRecordAction): string {
  return actionOptions.find(option => option.value === action)?.label || action
}

function recommendationLabel(value: QuantDecisionRecord['snapshot']['recommendation']): string {
  return value === 'bullish' ? '看多' : value === 'bearish' ? '看空' : value === 'watch' ? '观望' : '未形成'
}

function recommendationClass(value: QuantDecisionRecord['snapshot']['recommendation']): string {
  return value === 'bullish' ? 'quant-decision-value-positive' : value === 'bearish' ? 'quant-decision-value-negative' : 'quant-decision-value-neutral'
}

function formatPrice(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function formatPriceRange(value: QuantDecisionRecord['snapshot']['buyPriceRange']): string {
  return value ? `${formatPrice(value.low)} - ${formatPrice(value.high)}` : '--'
}

function formatCoverage(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(0)}%`
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

function aiReviewLabel(record: QuantDecisionRecord): string {
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

function aiReviewClass(record: QuantDecisionRecord): string {
  const review = record.snapshot.aiDecisionReview
  if (!review)
    return 'quant-decision-value-neutral'
  return review.accepted ? 'quant-decision-value-positive' : 'quant-decision-value-warning'
}

function submit(): void {
  if (props.saving || !props.run)
    return
  emit('save', formAction.value, formNote.value.trim() || null)
}

watch(
  () => [props.run?.id || null, props.record?.id || null, props.record?.updatedAt || null] as const,
  () => {
    if (props.record && props.record.researchRunId === props.run?.id) {
      formAction.value = props.record.action
      formNote.value = props.record.note || ''
      return
    }
    formAction.value = 'watch'
    formNote.value = ''
  },
  { immediate: true },
)
</script>

<template>
  <section class="quant-decision-journal" aria-labelledby="quant-decision-journal-title">
    <div class="quant-decision-journal-heading">
      <div>
        <p class="section-kicker">
          DECISION JOURNAL
        </p>
        <h3 id="quant-decision-journal-title">
          记录这次判断
        </h3>
        <small>把系统结论和你的实际行动分开保存，之后按快照复盘。</small>
      </div>
      <History :size="19" aria-hidden="true" />
    </div>

    <div v-if="loading" class="quant-decision-journal-state" role="status">
      <CalendarClock :size="15" aria-hidden="true" />
      <span>正在读取本次决策记录</span>
    </div>
    <div v-if="loadErrorMessage" class="quant-decision-journal-alert quant-decision-journal-alert-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ loadErrorMessage }}</span>
    </div>

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

    <form v-if="run" class="quant-decision-form" @submit.prevent="submit">
      <fieldset>
        <legend>这次判断</legend>
        <div class="quant-decision-action-options" role="radiogroup" aria-label="选择决策动作">
          <label v-for="option in actionOptions" :key="option.value" class="quant-decision-action-option" :class="{ 'quant-decision-action-option-selected': formAction === option.value }">
            <input v-model="formAction" type="radio" name="quant-decision-action" :value="option.value" :aria-label="option.label">
            <span>
              <strong>{{ option.label }}</strong>
              <small>{{ option.description }}</small>
            </span>
          </label>
        </div>
      </fieldset>
      <label class="quant-decision-note-field">
        <span>备注 <small>可记录触发条件、价格依据或复查事项</small></span>
        <textarea v-model="formNote" class="field-control quant-decision-note-input" maxlength="500" placeholder="写下你此刻的判断依据" />
      </label>
      <div class="quant-decision-form-footer">
        <span>{{ formNoteLength }} / 500</span>
        <button class="primary-button quant-decision-save-button" type="submit" :disabled="saving">
          <Save :size="15" aria-hidden="true" />
          {{ saving ? '保存中' : record ? '更新决策记录' : '保存决策记录' }}
        </button>
      </div>
    </form>

    <div v-if="saveErrorMessage" class="quant-decision-journal-alert quant-decision-journal-alert-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ saveErrorMessage }}</span>
    </div>
    <div v-if="saveMessage" class="quant-decision-journal-alert quant-decision-journal-alert-success" role="status">
      <CheckCircle2 :size="15" aria-hidden="true" />
      <span>{{ saveMessage }}</span>
    </div>

    <section class="quant-decision-history" aria-labelledby="quant-decision-history-title">
      <div class="quant-decision-subheading">
        <div>
          <span id="quant-decision-history-title">股票决策历史</span>
          <small>最近 {{ history.length }} 条</small>
        </div>
        <span v-if="historyLoading" class="quant-decision-history-loading" role="status">读取中</span>
      </div>
      <div v-if="historyErrorMessage" class="quant-decision-history-error" role="alert">
        <AlertCircle :size="14" aria-hidden="true" />
        <span>{{ historyErrorMessage }}</span>
      </div>
      <div v-else-if="historyLoading && !history.length" class="quant-decision-history-state" role="status">
        正在读取历史记录
      </div>
      <div v-else-if="!history.length" class="quant-decision-history-state" role="status">
        还没有这只股票的决策历史
      </div>
      <div v-else class="quant-decision-history-list">
        <article v-for="item in history" :key="item.id" class="quant-decision-history-row">
          <div class="quant-decision-history-main">
            <div>
              <span class="quant-decision-action" :class="`quant-decision-action-${item.action}`">{{ actionLabel(item.action) }}</span>
              <strong :class="recommendationClass(item.snapshot.recommendation)">{{ recommendationLabel(item.snapshot.recommendation) }}</strong>
            </div>
            <p v-if="item.note">
              {{ item.note }}
            </p>
            <small>{{ formatDateTime(item.updatedAt) }} · 快照 {{ formatDateTime(item.snapshot.generatedAt) }}</small>
          </div>
          <div class="quant-decision-history-metrics">
            <strong>{{ formatPrice(item.snapshot.currentPrice) }}</strong>
            <span>覆盖 {{ formatCoverage(item.snapshot.coverage) }}</span>
          </div>
        </article>
      </div>
    </section>

    <QuantDecisionOutcome
      :history="history"
      :latest-price="latestPrice"
      :latest-price-observed-at="latestPriceObservedAt"
    />
  </section>
</template>

<style scoped>
.quant-decision-journal {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.85rem;
  border-top: 1px solid hsl(var(--status-info) / 0.35);
  padding-top: 0.85rem;
}

.quant-decision-journal-heading,
.quant-decision-subheading,
.quant-decision-form-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-decision-journal-heading > svg {
  flex: 0 0 auto;
  color: hsl(var(--status-info));
}

.quant-decision-journal-heading h3 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 720;
}

.quant-decision-journal-heading small,
.quant-decision-subheading small,
.quant-decision-note-field small,
.quant-decision-form-footer,
.quant-decision-history-row small,
.quant-decision-history-metrics span {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.4;
}

.quant-decision-journal-heading small {
  display: block;
  margin-top: 0.3rem;
}

.quant-decision-journal-state,
.quant-decision-history-state,
.quant-decision-empty,
.quant-decision-history-error,
.quant-decision-journal-alert {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-decision-journal-state,
.quant-decision-history-state {
  min-height: 2.25rem;
  justify-content: center;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.55rem 0;
}

.quant-decision-journal-alert,
.quant-decision-history-error {
  border: 1px solid hsl(var(--status-danger) / 0.25);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-danger-soft));
  padding: 0.55rem 0.65rem;
  color: hsl(var(--status-danger));
}

.quant-decision-journal-alert span,
.quant-decision-history-error span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quant-decision-journal-alert-success {
  border-color: hsl(var(--status-success) / 0.25);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-decision-current,
.quant-decision-form,
.quant-decision-history {
  display: grid;
  gap: 0.65rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.7rem;
}

.quant-decision-subheading {
  align-items: baseline;
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

.quant-decision-action-watch {
  border-color: hsl(var(--status-info) / 0.3);
  background: hsl(var(--status-info-soft));
  color: hsl(var(--status-info));
}

.quant-decision-action-plan-buy {
  border-color: hsl(var(--status-warning) / 0.35);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.quant-decision-action-holding {
  border-color: hsl(var(--status-success) / 0.3);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-decision-action-sold {
  border-color: hsl(var(--muted-foreground) / 0.28);
  background: hsl(var(--muted) / 0.7);
  color: hsl(var(--muted-foreground));
}

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

.quant-decision-snapshot-grid span,
.quant-decision-snapshot-grid small,
.quant-decision-price-row,
.quant-decision-current-note > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.35;
}

.quant-decision-snapshot-grid strong,
.quant-decision-price-row strong,
.quant-decision-history-metrics strong {
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}

.quant-decision-value-positive {
  color: hsl(var(--status-success)) !important;
}

.quant-decision-value-negative {
  color: hsl(var(--status-danger)) !important;
}

.quant-decision-value-warning {
  color: hsl(var(--status-warning)) !important;
}

.quant-decision-value-neutral {
  color: hsl(var(--muted-foreground)) !important;
}

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
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-decision-form fieldset {
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.quant-decision-form legend,
.quant-decision-note-field > span {
  margin-bottom: 0.45rem;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 720;
}

.quant-decision-action-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-decision-action-option {
  display: grid;
  min-width: 0;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--card));
  padding: 0.5rem;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.quant-decision-action-option:focus-within {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.13);
}

.quant-decision-action-option-selected {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--accent) / 0.6);
}

.quant-decision-action-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.quant-decision-action-option span {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-decision-action-option strong {
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  line-height: 1.35;
}

.quant-decision-action-option small {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.35;
}

.quant-decision-note-field {
  display: grid;
  min-width: 0;
}

.quant-decision-note-field > span {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
}

.quant-decision-note-input {
  width: 100%;
  min-height: 4.5rem;
  height: auto;
  resize: vertical;
  padding-top: 0.55rem;
  padding-bottom: 0.55rem;
}

.quant-decision-form-footer {
  align-items: center;
}

.quant-decision-save-button {
  flex: 0 0 auto;
}

.quant-decision-history {
  margin-top: 0.15rem;
}

.quant-decision-history-loading {
  color: hsl(var(--status-info));
  font-size: 0.6875rem;
}

.quant-decision-history-list {
  display: grid;
  gap: 0.4rem;
}

.quant-decision-history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  min-width: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.72);
  padding: 0.45rem 0;
}

.quant-decision-history-row:last-child {
  border-bottom: 0;
}

.quant-decision-history-main {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.quant-decision-history-main > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.quant-decision-history-main > div > strong {
  font-size: 0.75rem;
}

.quant-decision-history-main p {
  margin: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.quant-decision-history-metrics {
  display: grid;
  align-content: start;
  justify-items: end;
  gap: 0.2rem;
  min-width: 4.5rem;
  text-align: right;
}

@media (max-width: 680px) {
  .quant-decision-snapshot-grid,
  .quant-decision-action-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quant-decision-history-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem;
  }

  .quant-decision-history-metrics {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    min-width: 0;
    text-align: left;
  }

  .quant-decision-save-button {
    width: 100%;
  }

  .quant-decision-form-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
