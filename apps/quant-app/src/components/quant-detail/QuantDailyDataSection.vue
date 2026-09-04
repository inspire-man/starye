<script setup lang="ts">
import type { Column } from '@starye/ui'
import type { DailyBar, WatchlistItem } from '../../lib/quant-view-models'
import type { TrendStructure } from '../../lib/trend-analysis'
import type { QuantDetailChartBar, QuantDetailErrorState, QuantDetailLoadingState } from './quant-detail-contracts'
import { DataTable } from '@starye/ui'
import { AlertCircle } from 'lucide-vue-next'

export interface QuantDailyDataSectionProps {
  selectedStock: WatchlistItem | null
  selectedTsCode: string | null
  dailyBars: DailyBar[]
  dailyColumns: Column<DailyBar>[]
  chartBars: QuantDetailChartBar[]
  latestDailyBar: DailyBar | null
  latestDate: string
  trendStructure: TrendStructure
  loading: QuantDetailLoadingState
  errors: QuantDetailErrorState
  formatNumber: (value: number | null) => string
  formatPercent: (value: number | null) => string
  formatTradeDate: (value: string | null) => string
  parsedError: (error: unknown) => { message: string }
  loadDailyBars: (tsCode: string) => void | Promise<void>
}

const {
  selectedStock,
  selectedTsCode,
  dailyBars,
  dailyColumns,
  chartBars,
  latestDailyBar,
  latestDate,
  trendStructure,
  loading,
  errors,
  formatNumber,
  formatPercent,
  formatTradeDate,
  parsedError,
  loadDailyBars,
} = defineProps<QuantDailyDataSectionProps>()
</script>

<template>
  <div v-if="selectedStock && dailyBars.length" class="daily-overview">
    <div class="daily-overview-copy">
      <span class="daily-code">{{ selectedStock.tsCode }}</span>
      <strong>{{ selectedStock.name || '未命名股票' }}</strong>
      <span>最新交易日 {{ latestDate }}</span>
      <span class="daily-latest">最新收盘 <strong>{{ formatNumber(latestDailyBar?.close ?? selectedStock.latestClose) }}</strong> <em :class="(latestDailyBar?.changePercent ?? selectedStock.latestChangePercent ?? 0) >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(latestDailyBar?.changePercent ?? selectedStock.latestChangePercent) }}</em></span>
    </div>
    <div class="chart-area" aria-label="收盘价轻量趋势图">
      <div class="chart-grid-line chart-grid-line-top" />
      <div class="chart-grid-line chart-grid-line-mid" />
      <div class="chart-grid-line chart-grid-line-bottom" />
      <div class="chart-bars">
        <div v-for="bar in chartBars" :key="bar.date" class="chart-bar-column" :title="`${bar.date} ${formatNumber(bar.close)}`">
          <span class="chart-bar" :class="bar.positive ? 'chart-bar-positive' : 'chart-bar-negative'" :style="{ height: `${bar.height}%` }" />
        </div>
      </div>
    </div>
  </div>
  <div v-if="selectedStock && dailyBars.length" class="trend-structure" aria-label="多周期趋势结构">
    <div class="trend-structure-heading">
      <div>
        <span class="section-kicker">MULTI-PERIOD STRUCTURE</span>
        <strong>多周期趋势</strong>
      </div>
      <small>有效日线 {{ trendStructure.availableBars }} 根</small>
    </div>
    <div class="trend-structure-grid">
      <div class="trend-structure-item">
        <span>5 日表现</span>
        <strong :class="trendStructure.return5 === null ? 'text-status-neutral' : trendStructure.return5 >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(trendStructure.return5) }}</strong>
      </div>
      <div class="trend-structure-item">
        <span>20 日表现</span>
        <strong :class="trendStructure.return20 === null ? 'text-status-neutral' : trendStructure.return20 >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(trendStructure.return20) }}</strong>
      </div>
      <div class="trend-structure-item">
        <span>60 日表现</span>
        <strong :class="trendStructure.return60 === null ? 'text-status-neutral' : trendStructure.return60 >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(trendStructure.return60) }}</strong>
      </div>
      <div class="trend-structure-item">
        <span>距 20 日均线</span>
        <strong :class="trendStructure.ma20Gap === null ? 'text-status-neutral' : trendStructure.ma20Gap >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(trendStructure.ma20Gap) }}</strong>
      </div>
      <div class="trend-structure-item">
        <span>60 日回撤</span>
        <strong :class="trendStructure.drawdown60 === null ? 'text-status-neutral' : trendStructure.drawdown60 >= -0.05 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(trendStructure.drawdown60) }}</strong>
      </div>
    </div>
    <div class="trend-structure-conclusion" :class="`trend-structure-${trendStructure.tone}`">
      <span>结构结论</span>
      <strong>{{ trendStructure.conclusion }}</strong>
    </div>
    <p class="valuation-note">
      表现按价格间隔计算；指标用于观察当前结构，不代表未来收益
    </p>
  </div>
  <div v-if="errors.daily && !loading.daily" class="inline-alert" role="alert">
    <AlertCircle :size="16" aria-hidden="true" />
    <span>{{ parsedError(errors.daily).message }}</span>
    <button class="text-button" type="button" @click="selectedTsCode && loadDailyBars(selectedTsCode)">
      重试
    </button>
  </div>
  <DataTable
    :data="dailyBars"
    :columns="dailyColumns"
    :loading="loading.daily"
    min-width="820px"
    empty-message="选择观察池中的股票后查看日线数据"
  >
    <template #cell-tradeDate="{ item }">
      <span class="font-mono text-xs text-muted-foreground">{{ formatTradeDate(item.tradeDate) }}</span>
    </template>
    <template #cell-changePercent="{ item }">
      <span :class="item.changePercent !== null && item.changePercent >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(item.changePercent) }}</span>
    </template>
  </DataTable>
</template>
