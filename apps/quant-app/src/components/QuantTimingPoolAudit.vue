<script setup lang="ts">
import type { WatchlistItem } from '../lib/quant-view-models'
import type { TimingPoolAudit, TimingPoolTickerResult } from '../lib/timing-history-pool'
import { Activity, RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { quantApi } from '../lib/api-client'
import {
  collectTimingPoolAudit,
  TIMING_POOL_HISTORY_LIMIT,
  timingPoolConsensusLabel,
  timingPoolEdgeLabel,
  timingPoolTickerStatusLabel,
} from '../lib/timing-history-pool'

const props = defineProps<{
  watchlist: readonly WatchlistItem[]
  displayStockName: (item: Pick<WatchlistItem, 'tsCode' | 'name'>) => string
}>()

const emit = defineEmits<{
  selectStock: [item: Pick<WatchlistItem, 'tsCode' | 'name'>]
}>()

const generation = ref(0)
const running = ref(false)
const completedCount = ref(0)
const results = ref<TimingPoolTickerResult[]>([])
const audit = ref<TimingPoolAudit | null>(null)
const auditedKey = ref<string | null>(null)

const universeKey = computed(() => props.watchlist.map(item => item.tsCode).join('|'))
const stale = computed(() => Boolean(auditedKey.value && auditedKey.value !== universeKey.value))
const totalCount = computed(() => props.watchlist.length)
const buttonLabel = computed(() => {
  if (running.value)
    return '审计中'
  if (audit.value)
    return '重新审计'
  return '运行审计'
})

watch(universeKey, () => {
  if (!running.value)
    return
  generation.value += 1
  running.value = false
})

async function runAudit(): Promise<void> {
  if (!props.watchlist.length || running.value)
    return
  const currentGeneration = generation.value + 1
  generation.value = currentGeneration
  running.value = true
  completedCount.value = 0
  try {
    const collection = await collectTimingPoolAudit(
      props.watchlist.map(item => ({ tsCode: item.tsCode, name: item.name })),
      tsCode => quantApi.getDailyBars(tsCode, { limit: TIMING_POOL_HISTORY_LIMIT }),
      {
        isCurrent: () => generation.value === currentGeneration,
        onProgress: (completed) => {
          if (generation.value === currentGeneration)
            completedCount.value = completed
        },
      },
    )
    if (generation.value !== currentGeneration || collection.aborted)
      return
    results.value = [...collection.results]
    audit.value = collection.audit
    auditedKey.value = universeKey.value
  }
  finally {
    if (generation.value === currentGeneration)
      running.value = false
  }
}
</script>

<template>
  <section class="timing-pool-section" aria-labelledby="timing-pool-title">
    <div class="section-heading">
      <div>
        <p class="section-kicker">
          TIMING SAMPLE AUDIT
        </p>
        <h2 id="timing-pool-title" class="section-title">
          历史时机样本审计
        </h2>
      </div>
      <button
        class="secondary-button"
        type="button"
        :disabled="!props.watchlist.length || running"
        :aria-label="buttonLabel"
        @click="runAudit"
      >
        <RefreshCw :size="14" aria-hidden="true" />
        {{ buttonLabel }}
      </button>
    </div>

    <p v-if="!props.watchlist.length" class="timing-pool-empty">
      观察池为空时不能审计跨标的样本。加入股票并更新日线后再运行。
    </p>
    <p v-else-if="running" class="timing-pool-progress" role="status">
      正在读取观察池日线 {{ completedCount }} / {{ totalCount }}。结论只用于检查样本是否分开，不调整阈值。
    </p>
    <p v-else-if="stale" class="timing-pool-stale" role="status">
      观察池已变化，当前结果可能过期，请重新审计。
    </p>

    <template v-if="audit">
      <div class="timing-pool-summary" :aria-label="audit.headline">
        <div class="timing-pool-summary-copy">
          <Activity :size="16" aria-hidden="true" />
          <div>
            <strong>{{ audit.headline }}</strong>
            <p>{{ audit.thresholdAdviceLabel }} · 已评估 {{ audit.readyCount }} / {{ audit.universeSize }} · 来源失败 {{ audit.sourceFailedCount }} · 数据不足 {{ audit.insufficientDataCount }}</p>
          </div>
        </div>
        <span class="status-chip timing-pool-hold">{{ audit.thresholdAdviceLabel }}</span>
      </div>

      <div class="timing-pool-state-grid" aria-label="各状态跨标的分布">
        <article v-for="state in audit.states" :key="state.state" class="timing-pool-state-card">
          <strong>{{ state.label }}</strong>
          <span class="status-chip">{{ timingPoolConsensusLabel(state.consensus) }}</span>
          <p>稳定支持 {{ state.supportedCount }} · 偏弱 {{ state.weakerCount }} · 重叠 {{ state.indeterminateCount }} · 样本不足 {{ state.insufficientCount }}</p>
        </article>
      </div>

      <div class="timing-pool-table" role="table" aria-label="观察池历史时机审计表">
        <div class="timing-pool-row timing-pool-row-head" role="row">
          <span role="columnheader">标的</span>
          <span role="columnheader">读取</span>
          <span role="columnheader">当前状态</span>
          <span role="columnheader">日线 / 截点</span>
          <span role="columnheader">当前区间结论</span>
        </div>
        <button
          v-for="item in results"
          :key="item.tsCode"
          class="timing-pool-row"
          type="button"
          role="row"
          :aria-label="`打开 ${props.displayStockName(item)} 的研究详情`"
          @click="emit('selectStock', item)"
        >
          <span role="cell">
            <strong>{{ props.displayStockName(item) }}</strong>
            <small>{{ item.tsCode }}</small>
          </span>
          <span role="cell">{{ timingPoolTickerStatusLabel(item.status) }}</span>
          <span role="cell">{{ item.currentLabel || '--' }}</span>
          <span role="cell">{{ item.availableBars === null ? '--' : item.availableBars }} / {{ item.evaluatedWindows === null ? '--' : item.evaluatedWindows }}</span>
          <span role="cell">{{ timingPoolEdgeLabel(item.currentEdgeAssessment) }}</span>
        </button>
      </div>
      <p class="timing-pool-note">
        各标的使用独立的 20 日非重叠窗口和 Wilson 区间，不合并胜率，也不改状态阈值。
      </p>
    </template>
  </section>
</template>
