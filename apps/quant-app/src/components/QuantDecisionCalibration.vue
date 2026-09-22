<script setup lang="ts">
import type { QuantDecisionRecord, WatchlistItem } from '../lib/quant-view-models'
import { BarChart3, CircleHelp } from 'lucide-vue-next'
import { computed } from 'vue'
import { buildQuantDecisionCalibration } from '../lib/decision-calibration'

const props = defineProps<{
  records: QuantDecisionRecord[]
  watchlist: WatchlistItem[]
  loading: boolean
  errorMessage: string | null
}>()

const calibration = computed(() => buildQuantDecisionCalibration(props.records, props.watchlist))

function formatChange(value: number | null): string {
  return value === null ? '样本不足' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}
</script>

<template>
  <section class="quant-decision-calibration" aria-labelledby="quant-decision-calibration-title">
    <div class="quant-decision-calibration-heading">
      <div>
        <p class="section-kicker">
          RESEARCH QUALITY
        </p>
        <h3 id="quant-decision-calibration-title">
          研究质量与决策校准
        </h3>
        <small>只回看已保存快照和后续价格观察，不生成买卖结论。</small>
      </div>
      <BarChart3 :size="17" aria-hidden="true" />
    </div>

    <p v-if="props.errorMessage" class="quant-decision-calibration-state quant-decision-calibration-error" role="alert">
      {{ props.errorMessage }}
    </p>
    <p v-else-if="props.loading" class="quant-decision-calibration-state" role="status">
      正在读取历史决策…
    </p>
    <p v-else-if="!props.records.length" class="quant-decision-calibration-state" role="status">
      <CircleHelp :size="14" aria-hidden="true" />
      <span>还没有足够的历史决策样本。</span>
    </p>
    <template v-else>
      <div class="quant-decision-calibration-grid" role="list" aria-label="决策校准统计">
        <div role="listitem">
          <strong>{{ calibration.summary.recordCount }}</strong><span>快照</span>
        </div>
        <div role="listitem">
          <strong>{{ calibration.summary.observedCount }}</strong><span>已观察</span>
        </div>
        <div role="listitem">
          <strong>{{ calibration.summary.pendingCount }}</strong><span>待观察</span>
        </div>
        <div role="listitem">
          <strong>{{ calibration.summary.unavailableCount }}</strong><span>不可用</span>
        </div>
      </div>
      <div class="quant-decision-calibration-grid" role="list" aria-label="方向观察统计">
        <div role="listitem">
          <strong>{{ calibration.summary.alignedCount }}</strong><span>价格上行</span>
        </div>
        <div role="listitem">
          <strong>{{ calibration.summary.opposedCount }}</strong><span>价格下行</span>
        </div>
        <div role="listitem">
          <strong>{{ calibration.summary.flatCount }}</strong><span>价格持平</span>
        </div>
        <div role="listitem">
          <strong>{{ formatChange(calibration.summary.averageChangePercent) }}</strong><span>平均变化</span>
        </div>
      </div>
      <p class="quant-decision-calibration-note">
        AI 已接受 {{ calibration.summary.acceptedAiCount }} 条，未接受或未完成 {{ calibration.summary.unacceptedAiCount }} 条；方向样本 {{ calibration.summary.directionalSampleCount }} 条，未达到阈值时保留样本不足。
      </p>
    </template>
  </section>
</template>

<style scoped>
.quant-decision-calibration { display: grid; gap: 0.6rem; margin-top: 0.9rem; border-top: 1px solid hsl(var(--status-info) / 0.32); padding-top: 0.8rem; }
.quant-decision-calibration-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.6rem; }
.quant-decision-calibration-heading h3 { margin: 0.3rem 0 0; font-size: 0.9rem; color: hsl(var(--foreground)); }
.quant-decision-calibration-heading small, .quant-decision-calibration-note, .quant-decision-calibration-state { color: hsl(var(--muted-foreground)); font-size: 0.68rem; line-height: 1.45; }
.quant-decision-calibration-heading small { display: block; margin-top: 0.2rem; }
.quant-decision-calibration-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; }
.quant-decision-calibration-grid > div { display: grid; gap: 0.15rem; border-left: 2px solid hsl(var(--border)); padding: 0.2rem 0.45rem; }
.quant-decision-calibration-grid strong { color: hsl(var(--foreground)); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9rem; }
.quant-decision-calibration-grid span { color: hsl(var(--muted-foreground)); font-size: 0.62rem; }
.quant-decision-calibration-state, .quant-decision-calibration-note { margin: 0; }
.quant-decision-calibration-state { display: flex; align-items: center; gap: 0.35rem; }
.quant-decision-calibration-error { color: hsl(var(--status-danger)); }
@media (max-width: 680px) { .quant-decision-calibration-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
