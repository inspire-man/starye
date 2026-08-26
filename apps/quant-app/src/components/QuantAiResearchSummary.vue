<script setup lang="ts">
import type { QuantResearchEvidence, QuantResearchReport, QuantResearchSummary } from '../lib/quant-types'
import { AlertCircle, BrainCircuit, CheckCircle2, CircleHelp, RefreshCw } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  report: QuantResearchReport
  summary: QuantResearchSummary | null
  loading: boolean
  generating: boolean
  errorMessage: string | null
  configurationError: boolean
}>()

const emit = defineEmits<{
  generate: []
  openSettings: []
}>()

const evidenceByKey = computed(() => new Map(props.report.evidence.map(item => [item.key, item])))

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
  <section class="quant-ai-summary-panel" aria-labelledby="quant-ai-summary-title">
    <div class="quant-ai-summary-heading">
      <div>
        <p class="section-kicker">
          EVIDENCE EXPLAINER
        </p>
        <h3 id="quant-ai-summary-title">
          AI 证据解读
        </h3>
        <small>只解释本份报告已有证据，不改变评分和研究动作</small>
      </div>
      <button class="secondary-button quant-ai-summary-button" type="button" :disabled="loading || generating" title="基于当前研究报告生成解释" @click="emit('generate')">
        <RefreshCw v-if="loading || generating" :size="14" class="animate-spin" aria-hidden="true" />
        <BrainCircuit v-else :size="14" aria-hidden="true" />
        {{ loading || generating ? '读取中' : summary ? '重新解读' : '生成解读' }}
      </button>
    </div>

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

    <div v-if="loading" class="quant-ai-summary-state" role="status">
      <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
      <span>正在读取已保存的解读</span>
    </div>
    <div v-else-if="errorMessage" class="quant-ai-summary-state quant-ai-summary-state-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
      <button v-if="configurationError" class="text-button" type="button" @click="emit('openSettings')">
        打开 AI 配置
      </button>
    </div>
    <template v-else-if="summary">
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
            <li v-for="item in summary.summary.nextChecks" :key="`next-${item}`">
              {{ item }}
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
      <span>还没有生成解释。先阅读上方确定性证据，再按需生成。</span>
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

  .quant-ai-summary-citation-primary {
    align-items: flex-start;
  }

  .quant-ai-summary-citation-title {
    align-items: flex-start;
  }

  .quant-ai-summary-citation-title strong {
    white-space: normal;
  }
}
</style>
