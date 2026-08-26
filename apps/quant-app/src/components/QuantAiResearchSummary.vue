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
          <small>{{ summary.model }} · {{ summary.generatedAt || '时间未记录' }}</small>
        </div>
        <div class="quant-ai-summary-citation-list">
          <span v-for="key in summary.citedEvidenceKeys" :key="key" class="quant-ai-summary-citation" :title="citedEvidence(key)?.detail || '证据已在报告中保存'">
            <CheckCircle2 :size="13" aria-hidden="true" />
            {{ citedEvidence(key)?.label || key }}
          </span>
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
  flex-wrap: wrap;
  gap: 0.35rem;
}

.quant-ai-summary-citation,
.quant-ai-summary-empty-citation {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid hsl(var(--status-success) / 0.25);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-success) / 0.08);
  padding: 0.25rem 0.4rem;
  color: hsl(var(--status-success));
  font-size: 0.625rem;
  line-height: 1.25;
}

.quant-ai-summary-empty-citation {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.5);
  color: hsl(var(--muted-foreground));
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
}
</style>
