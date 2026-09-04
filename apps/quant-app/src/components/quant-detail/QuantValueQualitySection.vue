<script setup lang="ts">
import type { ParsedError } from '@starye/ui'
import type { QuantValueQualityDimension, QuantValueQualityItem, WatchlistItem } from '../../lib/quant-view-models'
import type { QuantDetailErrorState, QuantDetailLoadingState } from './quant-detail-contracts'
import { SkeletonCard } from '@starye/ui'
import { Info, RefreshCw } from 'lucide-vue-next'

export interface QuantValueQualitySectionProps {
  selectedStock: WatchlistItem | null
  selectedValueQuality: QuantValueQualityItem | null
  loading: QuantDetailLoadingState
  errors: QuantDetailErrorState
  formatDateTime: (value: string | null) => string
  formatTradeDate: (value: string | null) => string
  valueQualityStatusLabel: (item: QuantValueQualityItem | null) => string
  valueQualityStatusClass: (item: QuantValueQualityItem | null) => string
  formatValueQualityScore: (item: QuantValueQualityItem | null) => string
  formatValueQualityDimension: (item: QuantValueQualityItem | null, key: QuantValueQualityDimension['key']) => string
  valueQualityDimensionSamples: (dimension: QuantValueQualityDimension) => number
  parsedError: (error: unknown) => ParsedError
  loadValueSelection: () => void | Promise<void>
}

const {
  selectedStock,
  selectedValueQuality,
  loading,
  errors,
  formatDateTime,
  formatTradeDate,
  valueQualityStatusLabel,
  valueQualityStatusClass,
  formatValueQualityScore,
  formatValueQualityDimension,
  valueQualityDimensionSamples,
  parsedError,
  loadValueSelection,
} = defineProps<QuantValueQualitySectionProps>()
</script>

<template>
  <section class="value-quality-panel" aria-label="中长线价值质量评分">
    <div class="value-quality-heading">
      <div>
        <p class="section-kicker">
          VALUE QUALITY V2
        </p>
        <h2>中长线价值质量</h2>
      </div>
      <span v-if="loading.valueQuality" class="section-meta">刷新中</span>
      <span v-else-if="errors.valueQuality && selectedValueQuality" class="section-meta text-status-danger">上次结果</span>
      <span v-else-if="selectedValueQuality" class="section-meta">{{ valueQualityStatusLabel(selectedValueQuality) }}</span>
      <span v-else-if="selectedStock" class="section-meta">读取中</span>
    </div>
    <div v-if="loading.valueQuality && !selectedValueQuality" class="value-quality-state" role="status">
      <SkeletonCard variant="content" />
    </div>
    <div v-else-if="errors.valueQuality && !selectedValueQuality" class="value-quality-state" role="alert">
      <Info :size="17" aria-hidden="true" />
      <span>价值质量暂时不可用</span>
      <button class="text-button" type="button" @click="loadValueSelection">
        重试
      </button>
    </div>
    <template v-else-if="selectedValueQuality">
      <div v-if="loading.valueQuality" class="data-refresh-feedback data-refresh-feedback-loading" role="status">
        <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
        <span>正在刷新价值质量，先显示上次成功结果</span>
      </div>
      <div v-else-if="errors.valueQuality" class="data-refresh-feedback data-refresh-feedback-error" role="alert">
        <Info :size="15" aria-hidden="true" />
        <span>价值质量刷新失败，以下为上次成功结果：{{ parsedError(errors.valueQuality).message }}</span>
        <button class="text-button" type="button" @click="loadValueSelection">
          重试
        </button>
      </div>
      <div class="value-quality-score-row">
        <div>
          <span>研究评分</span>
          <strong :class="valueQualityStatusClass(selectedValueQuality)">{{ formatValueQualityScore(selectedValueQuality) }}</strong>
        </div>
        <div>
          <span>风险扣分</span>
          <strong :class="selectedValueQuality.riskDeduction > 0 ? 'value-quality-status-partial' : 'text-status-success'">-{{ selectedValueQuality.riskDeduction.toFixed(1) }}</strong>
        </div>
        <div>
          <span>报告期</span>
          <strong>{{ formatTradeDate(selectedValueQuality.financialReportDate) }}</strong>
        </div>
      </div>
      <div class="value-quality-dimension-grid">
        <div v-for="dimension in selectedValueQuality.dimensions" :key="dimension.key" class="value-quality-dimension" :class="`value-quality-dimension-${dimension.status}`">
          <div>
            <span>{{ dimension.label }}</span>
            <strong>{{ formatValueQualityDimension(selectedValueQuality, dimension.key) }}</strong>
          </div>
          <div class="value-quality-meter" aria-hidden="true">
            <span :style="{ width: `${dimension.score === null ? 0 : (dimension.score / dimension.maxScore) * 100}%` }" />
          </div>
          <small>{{ dimension.status === 'ready' ? '样本可比较' : dimension.status === 'partial' ? '部分指标可用' : '暂无可比数据' }} · {{ valueQualityDimensionSamples(dimension) }} 只</small>
        </div>
      </div>
      <div v-if="selectedValueQuality.riskNotes.length" class="value-quality-notes value-quality-notes-warning">
        <strong>先核对</strong>
        <span v-for="note in selectedValueQuality.riskNotes" :key="note">{{ note }}</span>
      </div>
      <div v-if="selectedValueQuality.missingFields.length" class="value-quality-notes value-quality-notes-muted">
        <strong>数据缺口</strong>
        <span v-for="field in selectedValueQuality.missingFields" :key="field">{{ field }}</span>
      </div>
      <p class="value-quality-note">
        估值、质量、增长、韧性、趋势分别占 30 / 30 / 20 / 15 / 5 分；百分位只代表当前观察池，评分用于研究排序，不代表未来收益。观察 {{ formatDateTime(selectedValueQuality.observedAt) }}
      </p>
    </template>
    <div v-else class="value-quality-state">
      <Info :size="17" aria-hidden="true" />
      <span>当前股票暂无价值质量数据</span>
      <button class="text-button" type="button" @click="loadValueSelection">
        重试
      </button>
    </div>
  </section>
</template>
