<script setup lang="ts">
import type {
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  WatchlistItem,
} from '../../lib/quant-view-models'
import type { FinancialTrendItem, QuantDetailErrorState, QuantDetailLoadingState } from './quant-detail-contracts'
import { SkeletonCard } from '@starye/ui'
import { Info } from 'lucide-vue-next'

export interface QuantFinancialQualitySectionProps {
  selectedStock: WatchlistItem | null
  selectedTsCode: string | null
  financialQuality: QuantFinancialQualitySnapshot | null
  financialHistory: QuantFinancialQualityHistory | null
  financialComparison: QuantFinancialQualityComparison | null
  financialComparisonError: unknown | null
  hasFinancialData: boolean
  financialTrendItems: FinancialTrendItem[]
  loading: QuantDetailLoadingState
  errors: QuantDetailErrorState
  formatNumber: (value: number | null) => string
  formatPercent: (value: number | null) => string
  formatTradeDate: (value: string | null) => string
  formatFinancialAmount: (value: number | null) => string
  formatMetricPercent: (value: number | null) => string
  formatRatioPercent: (value: number | null) => string
  formatMultiple: (value: number | null) => string
  formatComparisonPosition: (value: number | null) => string
  formatLowerComparisonPosition: (value: number | null) => string
  formatTrendDelta: (value: number | null) => string
  loadFinancialQuality: (tsCode: string) => void | Promise<void>
}

const {
  selectedStock,
  selectedTsCode,
  financialQuality,
  financialHistory,
  financialComparison,
  financialComparisonError,
  hasFinancialData,
  financialTrendItems,
  loading,
  errors,
  formatNumber,
  formatPercent,
  formatTradeDate,
  formatFinancialAmount,
  formatMetricPercent,
  formatRatioPercent,
  formatMultiple,
  formatComparisonPosition,
  formatLowerComparisonPosition,
  formatTrendDelta,
  loadFinancialQuality,
} = defineProps<QuantFinancialQualitySectionProps>()

function industryLabel(value: QuantFinancialQualitySnapshot['industry']): string {
  return value === 'insurance' ? '保险行业' : value === 'bank' ? '银行行业' : value === 'securities' ? '证券行业' : value === 'other' ? '行业专用' : '通用行业'
}

function genericMetricApplicable(value: QuantFinancialQualitySnapshot | null): boolean {
  return !value?.industry || value.industry === 'general'
}

function financialSourceLabel(value: QuantFinancialQualitySnapshot): string {
  const source = value.provider === 'tushare' ? 'Tushare 财报指标' : 'Eastmoney 财务报告'
  const supplement = value.supplementUsed && value.supplementalProvider
    ? ` + ${value.supplementalProvider === 'tushare' ? 'Tushare' : 'Eastmoney'} 字段补充`
    : ''
  const fallback = value.fallbackUsed && value.fallbackReason ? `（回退：${value.fallbackReason}）` : ''
  return `${source}${supplement}${fallback}`
}
</script>

<template>
  <section class="financial-section" aria-label="基本面速览">
    <div class="valuation-heading">
      <div>
        <p class="section-kicker">
          FINANCIAL QUALITY
        </p>
        <h3>
          基本面速览
        </h3>
      </div>
      <span v-if="financialQuality" class="section-meta">最近已披露报告 · {{ financialQuality.reportDateName || formatTradeDate(financialQuality.reportDate) }}</span>
      <span v-else-if="selectedStock" class="section-meta">读取中</span>
    </div>
    <div v-if="financialQuality" class="financial-report-meta">
      <span>报告期 <strong>{{ formatTradeDate(financialQuality.reportDate) }}</strong></span>
      <span>公告日期 <strong>{{ formatTradeDate(financialQuality.noticeDate) }}</strong></span>
      <span>报告口径 <strong>{{ financialQuality.reportType || '最近已披露' }}</strong></span>
      <span>数据源 <strong>{{ financialSourceLabel(financialQuality) }}</strong></span>
    </div>
    <div v-if="loading.financial" class="valuation-state" aria-label="基本面数据加载中">
      <SkeletonCard variant="content" />
    </div>
    <div v-else-if="errors.financial" class="valuation-state" role="status">
      <Info :size="17" aria-hidden="true" />
      <span>基本面数据暂时不可用</span>
      <button class="text-button" type="button" @click="selectedTsCode && loadFinancialQuality(selectedTsCode)">
        重试
      </button>
    </div>
    <div v-else-if="financialQuality && hasFinancialData" class="financial-grid">
      <div class="financial-item">
        <span>营业收入</span>
        <strong>{{ formatFinancialAmount(financialQuality.revenue) }}</strong>
      </div>
      <div class="financial-item">
        <span>归母净利润</span>
        <strong>{{ formatFinancialAmount(financialQuality.netProfit) }}</strong>
      </div>
      <div class="financial-item">
        <span>营收同比</span>
        <strong :class="financialQuality.revenueYoY !== null && financialQuality.revenueYoY >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(financialQuality.revenueYoY) }}</strong>
      </div>
      <div class="financial-item">
        <span>净利润同比</span>
        <strong :class="financialQuality.netProfitYoY !== null && financialQuality.netProfitYoY >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(financialQuality.netProfitYoY) }}</strong>
      </div>
      <div class="financial-item">
        <span>ROE 股东回报</span>
        <strong>{{ formatMetricPercent(financialQuality.roe) }}</strong>
      </div>
      <div class="financial-item">
        <span>毛利率</span>
        <strong>{{ genericMetricApplicable(financialQuality) ? formatMetricPercent(financialQuality.grossMargin) : '行业不适用' }}</strong>
      </div>
      <div class="financial-item">
        <span>净利率</span>
        <strong>{{ formatMetricPercent(financialQuality.netMargin) }}</strong>
      </div>
      <div class="financial-item">
        <span>资产负债率</span>
        <strong>{{ genericMetricApplicable(financialQuality) ? formatMetricPercent(financialQuality.debtAssetRatio) : '行业不适用' }}</strong>
      </div>
      <div class="financial-item">
        <span>经营现金流 / 营收</span>
        <strong>{{ genericMetricApplicable(financialQuality) ? formatRatioPercent(financialQuality.operatingCashflowToRevenue) : '行业不适用' }}</strong>
      </div>
      <div class="financial-item">
        <span>ROIC 投入资本回报</span>
        <strong>{{ formatMetricPercent(financialQuality.roic) }}</strong>
      </div>
    </div>
    <div v-else class="valuation-state">
      <Info :size="17" aria-hidden="true" />
      <span>{{ selectedStock ? '报告已找到，但当前指标暂缺' : '选择一只股票后查看基本面' }}</span>
    </div>
    <div v-if="financialQuality?.industry && financialQuality.industry !== 'general' && financialQuality.industryMetrics" class="financial-context-panel financial-industry-panel">
      <div class="financial-subheading">
        <div>
          <span class="section-kicker">INDUSTRY METRICS</span>
          <strong>{{ industryLabel(financialQuality.industry) }}专用口径</strong>
        </div>
        <small>不与通用毛利率、资产负债率直接混算</small>
      </div>
      <div v-if="financialQuality.industry === 'insurance'" class="financial-context-grid">
        <div class="financial-context-item">
          <span>偿付能力充足率</span>
          <strong>{{ formatMetricPercent(financialQuality.industryMetrics.insuranceSolvencyRatio) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>净投资收益率</span>
          <strong>{{ formatMetricPercent(financialQuality.industryMetrics.insuranceNetInvestmentReturn) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>新业务价值率</span>
          <strong>{{ formatMetricPercent(financialQuality.industryMetrics.insuranceNewBusinessValueRate) }}</strong>
        </div>
      </div>
      <div v-else-if="financialQuality.industry === 'bank'" class="financial-context-grid">
        <div class="financial-context-item">
          <span>核心一级资本充足率</span>
          <strong>{{ formatMetricPercent(financialQuality.industryMetrics.bankCoreTier1CapitalAdequacyRatio) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>净息差</span>
          <strong>{{ formatMetricPercent(financialQuality.industryMetrics.bankNetInterestMargin) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>贷款拨备率</span>
          <strong>{{ formatMetricPercent(financialQuality.industryMetrics.bankLoanProvisionRatio) }}</strong>
        </div>
      </div>
      <p class="financial-context-note">
        这些字段来自 Eastmoney 财报行业专用指标；通用指标显示为缺口时，先判断是否属于行业口径差异。
      </p>
    </div>
    <div v-if="financialTrendItems.length" class="financial-trend" aria-label="财务质量趋势">
      <div class="financial-subheading">
        <div>
          <span class="section-kicker">RECENT TREND</span>
          <strong>最近几期变化</strong>
        </div>
        <small>比较最近两期报告 · {{ financialHistory?.reports.length || 0 }} 期可读</small>
      </div>
      <div class="financial-trend-grid">
        <div v-for="item in financialTrendItems" :key="item.key" class="financial-trend-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.format === 'growth' ? formatPercent(item.current) : formatMetricPercent(item.current) }}</strong>
          <span class="financial-trend-delta" :class="`trend-${item.tone}`">{{ item.state }} · {{ formatTrendDelta(item.delta) }}</span>
        </div>
      </div>
    </div>
    <div v-if="financialComparison || financialComparisonError" class="financial-comparison" aria-label="观察池财务质量比较">
      <div class="financial-subheading">
        <div>
          <span class="section-kicker">QUALITY POSITION</span>
          <strong>观察池质量位置</strong>
        </div>
        <small>仅当前观察池</small>
      </div>
      <div v-if="financialComparisonError" class="financial-comparison-empty">
        <Info :size="15" aria-hidden="true" />
        <span>同池质量比较暂时不可用</span>
      </div>
      <div v-else-if="financialComparison" class="financial-comparison-grid">
        <div class="financial-comparison-item">
          <span>营收同比</span>
          <strong>{{ formatComparisonPosition(financialComparison?.revenueYoYHigherThanPercent ?? null) }}</strong>
          <small>样本 {{ financialComparison?.revenueYoYSampleCount ?? 0 }} 只</small>
        </div>
        <div class="financial-comparison-item">
          <span>净利润同比</span>
          <strong>{{ formatComparisonPosition(financialComparison?.netProfitYoYHigherThanPercent ?? null) }}</strong>
          <small>样本 {{ financialComparison?.netProfitYoYSampleCount ?? 0 }} 只</small>
        </div>
        <div class="financial-comparison-item">
          <span>ROE 股东回报</span>
          <strong>{{ formatComparisonPosition(financialComparison?.roeHigherThanPercent ?? null) }}</strong>
          <small>样本 {{ financialComparison?.roeSampleCount ?? 0 }} 只</small>
        </div>
        <div v-if="genericMetricApplicable(financialQuality)" class="financial-comparison-item">
          <span>资产负债率</span>
          <strong>{{ formatLowerComparisonPosition(financialComparison?.debtAssetRatioLowerThanPercent ?? null) }}</strong>
          <small>样本 {{ financialComparison?.debtAssetRatioSampleCount ?? 0 }} 只</small>
        </div>
      </div>
      <p class="financial-comparison-note">
        可用报告 {{ financialComparison?.availableSampleCount ?? 0 }} / {{ financialComparison?.sampleCount ?? 0 }} 只；相对位置不代表行业排名或未来收益
      </p>
    </div>
    <div v-if="financialQuality" class="financial-context-panel" aria-label="现金流韧性">
      <div class="financial-subheading">
        <div>
          <span class="section-kicker">CASHFLOW RESILIENCE</span>
          <strong>现金流韧性</strong>
        </div>
        <small>报告期 {{ formatTradeDate(financialQuality.reportDate) }}</small>
      </div>
      <div v-if="genericMetricApplicable(financialQuality)" class="financial-context-grid">
        <div class="financial-context-item">
          <span>经营现金流 / 营收</span>
          <strong>{{ formatRatioPercent(financialQuality.operatingCashflowToRevenue) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>经营现金流 / 股</span>
          <strong>{{ formatNumber(financialQuality.operatingCashflowPerShare) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>FCFF（历史）</span>
          <strong>{{ formatFinancialAmount(financialQuality.fcffBack) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>FCFF（前瞻）</span>
          <strong>{{ formatFinancialAmount(financialQuality.fcffForward) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>利息覆盖倍数</span>
          <strong>{{ formatMultiple(financialQuality.interestCoverage) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>带息负债率</span>
          <strong>{{ formatMetricPercent(financialQuality.interestBearingDebtRatio) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>现金比率</span>
          <strong>{{ formatRatioPercent(financialQuality.cashRatio) }}</strong>
        </div>
        <div class="financial-context-item">
          <span>负债规模</span>
          <strong>{{ formatFinancialAmount(financialQuality.totalLiability) }}</strong>
        </div>
      </div>
      <div v-else class="financial-context-note financial-context-note-na">
        <Info :size="15" aria-hidden="true" />
        <span>{{ industryLabel(financialQuality.industry) }}不使用通用自由现金流、利息覆盖和现金比率阈值；请结合上方行业专用指标、股东回报和股本事件核对。</span>
      </div>
      <p class="financial-context-note">
        {{ genericMetricApplicable(financialQuality) ? '这些指标用于判断现金流和偿债韧性；资本开支、回购和分红支付率已在股东回报区域独立展示，不进入价值质量总分。' : '行业专用指标与通用现金流韧性分开保存，避免把金融机构的业务结构误判为普通公司的数据缺口。' }}
      </p>
    </div>
  </section>
</template>
