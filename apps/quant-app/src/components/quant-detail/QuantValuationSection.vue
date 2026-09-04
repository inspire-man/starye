<script setup lang="ts">
import type {
  QuantValuationComparison,
  QuantValuationSnapshot,
  WatchlistItem,
} from '../../lib/quant-view-models'
import { SkeletonCard } from '@starye/ui'
import { Info } from 'lucide-vue-next'

export interface QuantValuationSectionProps {
  selectedStock: WatchlistItem | null
  selectedTsCode: string | null
  valuation: QuantValuationSnapshot | null
  valuationComparison: QuantValuationComparison | null
  hasValuationData: boolean
  loading: boolean
  error: unknown | null
  valuationErrorMessage: string
  valuationComparisonErrorMessage: string | null
  formatNumber: (value: number | null) => string
  formatDateTime: (value: string | null) => string
  formatComparisonPosition: (value: number | null) => string
  formatMarketCap: (value: number | null) => string
  loadValuation: (tsCode: string) => void | Promise<void>
}

const {
  selectedStock,
  selectedTsCode,
  valuation,
  valuationComparison,
  hasValuationData,
  loading,
  error,
  valuationErrorMessage,
  valuationComparisonErrorMessage,
  formatNumber,
  formatDateTime,
  formatComparisonPosition,
  formatMarketCap,
  loadValuation,
} = defineProps<QuantValuationSectionProps>()
</script>

<template>
  <section class="valuation-section" aria-label="估值速览">
    <div class="valuation-heading">
      <div>
        <p class="section-kicker">
          VALUATION SNAPSHOT
        </p>
        <h3>
          估值速览
        </h3>
      </div>
      <span v-if="valuation" class="section-meta">观察 {{ formatDateTime(valuation.observedAt) }}</span>
      <span v-else-if="selectedStock" class="section-meta">读取中</span>
    </div>
    <div v-if="loading" class="valuation-state" aria-label="估值数据加载中">
      <SkeletonCard variant="content" />
    </div>
    <div v-else-if="error" class="valuation-state" role="status">
      <Info :size="17" aria-hidden="true" />
      <span class="valuation-state-copy">估值数据暂时不可用：{{ valuationErrorMessage }}</span>
      <button class="text-button" type="button" @click="selectedTsCode && loadValuation(selectedTsCode)">
        重试
      </button>
    </div>
    <div v-else-if="valuation && hasValuationData" class="valuation-grid">
      <div class="valuation-item">
        <span>动态 PE</span>
        <strong>{{ formatNumber(valuation.dynamicPe) }}</strong>
      </div>
      <div class="valuation-item">
        <span>TTM PE</span>
        <strong>{{ formatNumber(valuation.peTtm) }}</strong>
      </div>
      <div class="valuation-item">
        <span>静态 PE</span>
        <strong>{{ formatNumber(valuation.peStatic) }}</strong>
      </div>
      <div class="valuation-item">
        <span>PB</span>
        <strong>{{ formatNumber(valuation.pb) }}</strong>
      </div>
      <div class="valuation-item">
        <span>PS</span>
        <strong>{{ formatNumber(valuation.ps) }}</strong>
      </div>
      <div class="valuation-item">
        <span>PEG</span>
        <strong>{{ formatNumber(valuation.peg) }}</strong>
      </div>
      <div class="valuation-item valuation-item-wide">
        <span>总市值</span>
        <strong>{{ formatMarketCap(valuation.marketCap) }}</strong>
      </div>
    </div>
    <div v-else class="valuation-state">
      <Info :size="17" aria-hidden="true" />
      <span>{{ selectedStock ? '当前没有可比较的估值字段' : '选择一只股票后查看估值' }}</span>
    </div>
    <div v-if="valuationComparison" class="valuation-comparison">
      <div class="valuation-comparison-row">
        <span>TTM PE 相对观察池</span>
        <strong>{{ formatComparisonPosition(valuationComparison.ttmPeHigherThanPercent) }}</strong>
        <small>样本 {{ valuationComparison.ttmPeSampleCount }} 只</small>
      </div>
      <div class="valuation-comparison-row">
        <span>PB 相对观察池</span>
        <strong>{{ formatComparisonPosition(valuationComparison.pbHigherThanPercent) }}</strong>
        <small>样本 {{ valuationComparison.pbSampleCount }} 只</small>
      </div>
      <p>比较范围：当前观察池 {{ valuationComparison.sampleCount }} 只，可用估值 {{ valuationComparison.availableSampleCount }} 只</p>
    </div>
    <div v-else-if="valuationComparisonErrorMessage && valuation" class="valuation-comparison valuation-comparison-error">
      <div class="financial-comparison-empty">
        <Info :size="15" aria-hidden="true" />
        <span>观察池相对位置暂不可用：{{ valuationComparisonErrorMessage }}</span>
        <button class="text-button" type="button" @click="selectedTsCode && loadValuation(selectedTsCode)">
          重试
        </button>
      </div>
    </div>
    <p class="valuation-note">
      估值只用于同口径横向比较；相对位置仅代表当前观察池，不代表行业估值
    </p>
  </section>
</template>
