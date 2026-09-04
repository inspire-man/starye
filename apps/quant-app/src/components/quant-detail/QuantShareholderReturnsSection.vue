<script setup lang="ts">
import type { QuantShareholderReturnItem } from '../../lib/quant-view-models'
import type { QuantDetailErrorState, QuantDetailLoadingState } from './quant-detail-contracts'
import { SkeletonCard } from '@starye/ui'
import { Info, RefreshCw } from 'lucide-vue-next'

export interface QuantShareholderReturnsSectionProps {
  selectedShareholderReturn: QuantShareholderReturnItem | null
  loading: QuantDetailLoadingState
  errors: QuantDetailErrorState
  formatNumber: (value: number | null) => string
  formatTradeDate: (value: string | null) => string
  formatDividendYield: (value: number | null) => string
  shareholderReturnStatusLabel: (item: QuantShareholderReturnItem | null) => string
  shareholderReturnStatusClass: (item: QuantShareholderReturnItem | null) => string
  shareholderReturnHeaderLabel: () => string
  shareholderReturnSourceLabel: (item: QuantShareholderReturnItem | null) => string
  parsedError: (error: unknown) => { message: string }
  loadShareholderReturns: () => void | Promise<void>
}

const {
  selectedShareholderReturn,
  loading,
  errors,
  formatNumber,
  formatTradeDate,
  formatDividendYield,
  shareholderReturnStatusLabel,
  shareholderReturnStatusClass,
  shareholderReturnHeaderLabel,
  shareholderReturnSourceLabel,
  parsedError,
  loadShareholderReturns,
} = defineProps<QuantShareholderReturnsSectionProps>()
</script>

<template>
  <section class="shareholder-return-panel" aria-label="股东回报">
    <div class="financial-subheading">
      <div>
        <span class="section-kicker">SHAREHOLDER RETURNS</span>
        <strong>股东回报</strong>
      </div>
      <small>{{ shareholderReturnHeaderLabel() }}</small>
    </div>
    <div v-if="loading.shareholderReturns && !selectedShareholderReturn" class="shareholder-return-state" role="status">
      <SkeletonCard variant="content" />
    </div>
    <div v-else-if="errors.shareholderReturns && !selectedShareholderReturn" class="shareholder-return-state" role="alert">
      <Info :size="16" aria-hidden="true" />
      <span>股东回报暂时不可用</span>
      <button class="text-button" type="button" @click="loadShareholderReturns">
        重试
      </button>
    </div>
    <template v-else-if="selectedShareholderReturn">
      <div v-if="loading.shareholderReturns" class="data-refresh-feedback data-refresh-feedback-loading" role="status">
        <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
        <span>正在刷新股东回报，先显示上次成功结果</span>
      </div>
      <div v-else-if="errors.shareholderReturns" class="data-refresh-feedback data-refresh-feedback-error" role="alert">
        <Info :size="15" aria-hidden="true" />
        <span>股东回报刷新失败，以下为上次成功结果：{{ parsedError(errors.shareholderReturns).message }}</span>
        <button class="text-button" type="button" @click="loadShareholderReturns">
          重试
        </button>
      </div>
      <div class="shareholder-return-grid">
        <div class="shareholder-return-item shareholder-return-item-primary">
          <span>近 12 个月股息率</span>
          <strong :class="shareholderReturnStatusClass(selectedShareholderReturn)">{{ formatDividendYield(selectedShareholderReturn.trailingDividendYield) }}</strong>
        </div>
        <div class="shareholder-return-item">
          <span>每股现金分红</span>
          <strong>{{ selectedShareholderReturn.trailingCashDividendPerShare === null ? '--' : selectedShareholderReturn.trailingCashDividendPerShare.toFixed(3) }}</strong>
        </div>
        <div class="shareholder-return-item">
          <span>近 5 年有分红</span>
          <strong>{{ selectedShareholderReturn.dividendYears }} 年</strong>
        </div>
        <div class="shareholder-return-item">
          <span>最新收盘价</span>
          <strong>{{ formatNumber(selectedShareholderReturn.latestClose) }}</strong>
        </div>
      </div>
      <div class="shareholder-return-provenance">
        <strong>{{ shareholderReturnSourceLabel(selectedShareholderReturn) }}</strong>
        <small v-if="selectedShareholderReturn.providerChain.length > 1">来源链：{{ selectedShareholderReturn.providerChain.join(' -> ') }}</small>
        <small v-if="selectedShareholderReturn.providerErrorCode">来源错误：{{ selectedShareholderReturn.providerErrorCode }}</small>
      </div>
      <div v-if="selectedShareholderReturn.distributions.length" class="shareholder-distribution-list">
        <div class="financial-subheading">
          <div>
            <strong>最近实施记录</strong>
          </div>
          <small>{{ shareholderReturnStatusLabel(selectedShareholderReturn) }}</small>
        </div>
        <div v-for="distribution in selectedShareholderReturn.distributions.slice(0, 4)" :key="`${distribution.endDate}-${distribution.payDate || distribution.exDate || 'pending'}`" class="shareholder-distribution-row">
          <span>{{ formatTradeDate(distribution.endDate) }}</span>
          <strong>每股 {{ distribution.cashDividendPerShare.toFixed(3) }} 元</strong>
          <small>{{ distribution.payDate ? `派息 ${formatTradeDate(distribution.payDate)}` : distribution.exDate ? `除息 ${formatTradeDate(distribution.exDate)}` : '日期待确认' }}</small>
        </div>
      </div>
      <div v-if="selectedShareholderReturn.missingFields.length" class="value-quality-notes value-quality-notes-muted">
        <strong>数据缺口</strong>
        <span v-for="field in selectedShareholderReturn.missingFields" :key="field">{{ field }}</span>
      </div>
      <p class="valuation-note">
        仅统计已实施现金分红；股息率按近 12 个月现金分红 / 最新本地收盘价计算。该指标用于研究上下文，不代表未来收益。
      </p>
    </template>
    <div v-else class="shareholder-return-state">
      <Info :size="16" aria-hidden="true" />
      <span>选择一只股票后查看股东回报</span>
    </div>
  </section>
</template>
