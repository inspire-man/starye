<script setup lang="ts">
import type { WatchlistItem } from '../../lib/quant-view-models'
import type { TimingHistory, TimingHistoryBucket } from '../../lib/timing-history'
import type { TimingWindow, TimingWindowMetricStatus, TimingWindowState } from '../../lib/timing-window'
import { Info } from 'lucide-vue-next'

export interface QuantTimingSectionProps {
  selectedStock: WatchlistItem | null
  timingWindow: TimingWindow
  timingHistory: TimingHistory
  timingHistoryCurrentBucket: TimingHistoryBucket | null
  formatTradeDate: (value: string | null) => string
  timingWindowClass: (window: TimingWindow) => string
  timingWindowMetricClass: (status: TimingWindowMetricStatus) => string
  timingWindowMetricStatusLabel: (status: TimingWindowMetricStatus) => string
  formatTimingWindowMetric: (metric: TimingWindow['metrics'][number]) => string
  timingHistoryStateClass: (state: TimingWindowState) => string
  formatTimingHistoryRate: (value: number | null) => string
  formatTimingHistoryPercent: (value: number | null) => string
  timingHistoryBucketTitle: (bucket: TimingHistoryBucket) => string
}

const {
  selectedStock,
  timingWindow,
  timingHistory,
  timingHistoryCurrentBucket,
  formatTradeDate,
  timingWindowClass,
  timingWindowMetricClass,
  timingWindowMetricStatusLabel,
  formatTimingWindowMetric,
  timingHistoryStateClass,
  formatTimingHistoryRate,
  formatTimingHistoryPercent,
  timingHistoryBucketTitle,
} = defineProps<QuantTimingSectionProps>()
</script>

<template>
  <section v-if="selectedStock" class="timing-window-panel" aria-label="中长线时机窗口">
    <div class="timing-window-heading">
      <div>
        <p class="section-kicker">
          TIMING WINDOW V1
        </p>
        <h2>中长线时机窗口</h2>
      </div>
      <span class="timing-window-state" :class="timingWindowClass(timingWindow)">{{ timingWindow.label }}</span>
    </div>
    <div class="timing-window-headline" :class="timingWindowClass(timingWindow)">
      <strong>{{ timingWindow.label }}</strong>
      <p>{{ timingWindow.headline }}</p>
    </div>
    <div class="timing-window-metrics">
      <div v-for="metric in timingWindow.metrics" :key="metric.key" class="timing-window-metric" :class="timingWindowMetricClass(metric.status)">
        <div class="timing-window-metric-heading">
          <span>{{ metric.label }}</span>
          <small>{{ timingWindowMetricStatusLabel(metric.status) }}</small>
        </div>
        <strong>{{ formatTimingWindowMetric(metric) }}</strong>
        <p>{{ metric.detail }}</p>
        <small class="timing-window-threshold">阈值：{{ metric.threshold }}</small>
      </div>
    </div>
    <span class="timing-window-note" title="按最近 N 根有效日线计算：MA20、MA60、20 日高点回撤和近 20 个收益波动率。状态只用于研究排序，不是买入或卖出指令。" aria-label="时机窗口口径说明">
      <Info :size="15" aria-hidden="true" />
    </span>
  </section>
  <section v-if="selectedStock" class="timing-history-panel" aria-label="时机条件历史回看">
    <div class="timing-history-heading">
      <div>
        <p class="section-kicker">
          HISTORY CHECK V1
        </p>
        <h2>历史条件回看</h2>
      </div>
      <span class="timing-history-current" :class="timingHistoryStateClass(timingHistory.currentState)">
        当前：{{ timingHistory.currentLabel }}
      </span>
    </div>
    <div class="timing-history-meta">
      <span>有效日线 <strong>{{ timingHistory.availableBars }}</strong> 根</span>
      <span>可回看 <strong>{{ timingHistory.evaluatedWindows }}</strong> 个截点</span>
      <span v-if="timingHistory.dataStartDate && timingHistory.dataEndDate">数据范围 {{ formatTradeDate(timingHistory.dataStartDate) }} → {{ formatTradeDate(timingHistory.dataEndDate) }}</span>
    </div>
    <div v-if="timingHistoryCurrentBucket && timingHistory.evaluatedWindows" class="timing-history-current-grid">
      <div>
        <span>当前状态样本</span>
        <strong>{{ timingHistoryCurrentBucket.sampleSize }}</strong>
        <small>历史截点</small>
      </div>
      <div>
        <span>未来 20 日上涨比例</span>
        <strong>{{ formatTimingHistoryRate(timingHistoryCurrentBucket.positiveRate) }}</strong>
        <small>{{ timingHistoryCurrentBucket.positiveCount }} / {{ timingHistoryCurrentBucket.sampleSize }} 个样本</small>
      </div>
      <div>
        <span>中位数收益</span>
        <strong :class="timingHistoryCurrentBucket.medianForwardReturn20 === null ? 'text-status-neutral' : timingHistoryCurrentBucket.medianForwardReturn20 >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatTimingHistoryPercent(timingHistoryCurrentBucket.medianForwardReturn20) }}</strong>
        <small>未来 20 个有效交易日</small>
      </div>
      <div>
        <span>平均收益</span>
        <strong :class="timingHistoryCurrentBucket.averageForwardReturn20 === null ? 'text-status-neutral' : timingHistoryCurrentBucket.averageForwardReturn20 >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatTimingHistoryPercent(timingHistoryCurrentBucket.averageForwardReturn20) }}</strong>
        <small>重叠历史窗口</small>
      </div>
    </div>
    <div v-if="timingHistory.evaluatedWindows" class="timing-history-table" role="table" aria-label="四类时机状态历史对照">
      <div class="timing-history-table-row timing-history-table-head" role="row">
        <span role="columnheader">状态</span>
        <span role="columnheader">样本</span>
        <span role="columnheader">上涨比例</span>
        <span role="columnheader">中位数</span>
        <span role="columnheader">最好 / 最差</span>
      </div>
      <div v-for="bucket in timingHistory.buckets" :key="bucket.state" class="timing-history-table-row" :class="timingHistoryStateClass(bucket.state)" role="row" :title="timingHistoryBucketTitle(bucket)">
        <strong role="cell">{{ bucket.label }}</strong>
        <span role="cell">{{ bucket.sampleSize || '--' }}</span>
        <span role="cell">{{ formatTimingHistoryRate(bucket.positiveRate) }}</span>
        <span role="cell" :class="bucket.medianForwardReturn20 === null ? 'text-status-neutral' : bucket.medianForwardReturn20 >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatTimingHistoryPercent(bucket.medianForwardReturn20) }}</span>
        <span role="cell">{{ formatTimingHistoryPercent(bucket.bestForwardReturn20) }} / {{ formatTimingHistoryPercent(bucket.worstForwardReturn20) }}</span>
      </div>
    </div>
    <div v-else class="timing-history-empty" role="status">
      <Info :size="15" aria-hidden="true" />
      <span>至少需要 80 根有效日线，才能回看未来 20 个交易日结果</span>
    </div>
    <span class="timing-history-note" title="统计只使用当前股票已保存的本地有效日线；状态窗口与未来收益窗口分离，但历史截点可能重叠。结果不是预测，也不是买入或卖出指令。" aria-label="历史回看口径说明">
      <Info :size="15" aria-hidden="true" />
    </span>
  </section>
</template>
