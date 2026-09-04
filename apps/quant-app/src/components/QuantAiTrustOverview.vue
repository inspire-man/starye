<script setup lang="ts">
import type { CandidateItem, QuantDecisionRecord, WatchlistItem } from '../lib/quant-view-models'
import { computed } from 'vue'
import { buildQuantAiTrustOverview } from '../lib/ai-trust-overview'
import QuantAiTrustOverviewHeader from './quant-trust/QuantAiTrustOverviewHeader.vue'
import QuantAiTrustOverviewList from './quant-trust/QuantAiTrustOverviewList.vue'
import QuantAiTrustOverviewState from './quant-trust/QuantAiTrustOverviewState.vue'
import QuantAiTrustOverviewStatistics from './quant-trust/QuantAiTrustOverviewStatistics.vue'
import './quant-trust/quant-ai-trust-overview.css'

const props = defineProps<{
  records: QuantDecisionRecord[]
  candidates: CandidateItem[]
  watchlist: WatchlistItem[]
  candidateTradeDate: string | null
  loading: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  focus: [tsCode: string]
}>()

const overview = computed(() => buildQuantAiTrustOverview({
  records: props.records,
  candidates: props.candidates,
  watchlist: props.watchlist,
  candidateTradeDate: props.candidateTradeDate,
}))
</script>

<template>
  <section class="quant-ai-trust-overview" aria-labelledby="quant-ai-trust-overview-title">
    <QuantAiTrustOverviewHeader :total="overview.summary.total" />

    <QuantAiTrustOverviewState
      :loading="loading"
      :error-message="errorMessage"
      :has-records="overview.summary.total > 0"
    />

    <template v-if="!loading && !errorMessage && overview.summary.total > 0">
      <QuantAiTrustOverviewStatistics :summary="overview.summary" />

      <p class="quant-ai-trust-overview-boundary">
        当前队列最近记录：方向样本 {{ overview.summary.directionalSampleCount }} 条 · {{ overview.summary.agreementRate === null ? '样本不足 3 条，不计算一致率' : `方向一致率 ${overview.summary.agreementRate.toFixed(0)}%` }}；这不是长期准确率或收益保证。
      </p>

      <QuantAiTrustOverviewList :items="overview.items" @focus="emit('focus', $event)" />
    </template>

    <p class="quant-ai-trust-overview-note">
      口径说明：总览只读取已保存决策快照与当前已加载行情；AI 影响分差不改写确定性评分、因子权重或参考价格区间。
    </p>
  </section>
</template>
