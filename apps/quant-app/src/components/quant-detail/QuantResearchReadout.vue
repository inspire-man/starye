<script setup lang="ts">
import type { WatchlistItem } from '../../lib/quant-view-models'
import type { ResearchSummary } from '../../lib/research-summary'

export interface QuantResearchReadoutProps {
  selectedStock: WatchlistItem | null
  researchSummary: ResearchSummary | null
}

const { selectedStock, researchSummary } = defineProps<QuantResearchReadoutProps>()
</script>

<template>
  <div
    v-if="selectedStock && researchSummary"
    class="research-summary"
    :class="`research-summary-${researchSummary.tone}`"
    aria-label="研究摘要"
  >
    <div class="research-summary-heading">
      <div>
        <p class="section-kicker">
          RESEARCH READOUT
        </p>
        <h3>
          研究摘要
        </h3>
      </div>
      <span
        class="status-chip"
        :class="researchSummary.tone === 'positive' ? 'status-enabled' : researchSummary.tone === 'warning' ? 'status-partial' : 'status-info'"
      >
        {{ researchSummary.label }}
      </span>
    </div>
    <p class="research-summary-headline">
      {{ researchSummary.headline }}
    </p>
    <div class="research-dimensions" aria-label="四维研究判断">
      <div
        v-for="dimension in researchSummary.dimensions"
        :key="dimension.key"
        class="research-dimension"
        :class="`research-dimension-${dimension.state}`"
      >
        <span>{{ dimension.label }}</span>
        <strong>{{ dimension.detail }}</strong>
      </div>
    </div>
    <div class="research-summary-grid">
      <div class="research-summary-column">
        <span class="research-summary-label">支持依据</span>
        <ul v-if="researchSummary.support.length">
          <li
            v-for="item in researchSummary.support"
            :key="`support-${item}`"
          >
            {{ item }}
          </li>
        </ul>
        <span v-else class="muted-inline">暂无明确支持依据</span>
      </div>
      <div class="research-summary-column">
        <span class="research-summary-label">需要核对</span>
        <ul v-if="researchSummary.watchouts.length">
          <li
            v-for="item in researchSummary.watchouts"
            :key="`watchout-${item}`"
          >
            {{ item }}
          </li>
        </ul>
        <span v-else class="muted-inline">暂未发现额外核对项</span>
      </div>
      <div class="research-summary-column">
        <span class="research-summary-label">下一步核对</span>
        <ul>
          <li
            v-for="item in researchSummary.nextChecks"
            :key="`check-${item}`"
          >
            {{ item }}
          </li>
        </ul>
      </div>
    </div>
    <p class="valuation-note">
      研究状态只由当前观察池可用数据生成，不代表买入、卖出或收益判断
    </p>
  </div>
</template>
