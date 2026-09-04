<script setup lang="ts">
import type { QuantResearchEvidence } from '../../lib/quant-view-models'
import { CheckCircle2, CircleHelp } from 'lucide-vue-next'
import { computed } from 'vue'

export interface QuantAiSummaryCitationsProps {
  evidence: QuantResearchEvidence[]
  citedEvidenceKeys: string[]
  model: string
  generatedAt: string | null
}

const { evidence, citedEvidenceKeys, model, generatedAt } = defineProps<QuantAiSummaryCitationsProps>()

const evidenceByKey = computed(() => new Map(evidence.map(item => [item.key, item])))

function citedEvidence(key: string): QuantResearchEvidence | null {
  return evidenceByKey.value.get(key) || null
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
</script>

<template>
  <div class="quant-ai-summary-citations">
    <div class="quant-ai-summary-citations-heading">
      <span>引用证据</span>
      <small>{{ citedEvidenceKeys.length }} 条 · {{ model }} · {{ generatedAt || '时间未记录' }}</small>
    </div>
    <div class="quant-ai-summary-citation-list">
      <article v-for="key in citedEvidenceKeys" :key="key" class="quant-ai-summary-citation" :class="citedEvidence(key) ? evidenceStatusClass(citedEvidence(key)!.status) : 'quant-ai-summary-evidence-missing'">
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
      <span v-if="!citedEvidenceKeys.length" class="quant-ai-summary-empty-citation">
        <CircleHelp :size="13" aria-hidden="true" />
        未返回引用证据
      </span>
    </div>
  </div>
</template>

<style scoped>
.quant-ai-summary-citations {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-ai-summary-citations-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-ai-summary-citations-heading > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  font-weight: 700;
}

.quant-ai-summary-citations-heading small {
  display: block;
  margin-top: 0.2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.4;
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
  width: fit-content;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--muted) / 0.5);
  padding: 0.25rem 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.25;
}
</style>
