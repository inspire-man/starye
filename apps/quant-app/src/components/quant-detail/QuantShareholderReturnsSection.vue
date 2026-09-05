<script setup lang="ts">
import type { QuantShareholderCapitalStatus, QuantShareholderCashflowHistorySummary, QuantShareholderCashflowStatus, QuantShareholderRepurchaseStatus, QuantShareholderReturnItem } from '../../lib/quant-view-models'
import type { QuantDetailErrorState, QuantDetailLoadingState } from './quant-detail-contracts'
import { SkeletonCard } from '@starye/ui'
import { Info, RefreshCw } from 'lucide-vue-next'

export interface QuantShareholderReturnsSectionProps {
  selectedShareholderReturn: QuantShareholderReturnItem | null
  loading: QuantDetailLoadingState
  errors: QuantDetailErrorState
  formatNumber: (value: number | null) => string
  formatFinancialAmount: (value: number | null) => string
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
  formatFinancialAmount,
  formatTradeDate,
  formatDividendYield,
  shareholderReturnStatusLabel,
  shareholderReturnStatusClass,
  shareholderReturnHeaderLabel,
  shareholderReturnSourceLabel,
  parsedError,
  loadShareholderReturns,
} = defineProps<QuantShareholderReturnsSectionProps>()

function cashflowStatusLabel(status: QuantShareholderCashflowStatus): string {
  return {
    ready: '现金流核心字段完整',
    partial: '现金流字段部分可用',
    insufficient_data: '现金流报告不足',
    unavailable: '现金流源暂不可用',
  }[status]
}

function cashflowStatusClass(status: QuantShareholderCashflowStatus): string {
  return `shareholder-cashflow-status-${status}`
}

function cashflowHistoryStatusLabel(summary: QuantShareholderCashflowHistorySummary): string {
  return {
    ready: '多期覆盖可用',
    partial: '多期覆盖部分可用',
    insufficient_data: '历史报告不足',
    unavailable: '历史来源暂不可用',
  }[summary.status]
}

function formatCashflowCoverage(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(2)}x`
}

function formatPayoutRatio(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(2)}%`
}

function capitalStatusLabel(status: QuantShareholderCapitalStatus): string {
  return {
    ready: '股本事件可核对',
    partial: '股本事件部分可用',
    insufficient_data: '股本事件不足',
    unavailable: '股本源暂不可用',
  }[status]
}

function capitalStatusClass(status: QuantShareholderCapitalStatus): string {
  return `shareholder-capital-status-${status}`
}

function formatShareCount(value: number | null): string {
  return value === null ? '--' : `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)} 股`
}

function repurchaseStatusLabel(status: QuantShareholderRepurchaseStatus): string {
  return {
    ready: '已实施金额可核对',
    partial: '计划记录部分可用',
    insufficient_data: '回购计划不足',
    unavailable: '回购源暂不可用',
  }[status]
}

function repurchaseStatusClass(status: QuantShareholderRepurchaseStatus): string {
  return `shareholder-repurchase-status-${status}`
}

function repurchaseProgressLabel(progress: string | null): string {
  return {
    '001': '董事会预案',
    '002': '股东大会通过',
    '003': '股东大会否决',
    '004': '实施中',
    '005': '停止实施',
    '006': '完成实施',
  }[progress ?? ''] || progress || '实施状态待补'
}

function formatRepurchaseRange(lower: number | null, upper: number | null): string {
  const lowerText = formatFinancialAmount(lower)
  const upperText = formatFinancialAmount(upper)
  if (lower === null && upper === null)
    return '--'
  if (lower !== null && upper !== null && lower === upper)
    return lowerText
  return `${lowerText} - ${upperText}`
}
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
      <div v-if="selectedShareholderReturn.cashflowEvidence" class="shareholder-cashflow-evidence" aria-label="股东回报现金流证据">
        <div class="financial-subheading">
          <div>
            <span class="section-kicker">CASHFLOW EVIDENCE</span>
            <strong>现金流与分红覆盖</strong>
          </div>
          <small :class="cashflowStatusClass(selectedShareholderReturn.cashflowEvidence.status)">
            {{ selectedShareholderReturn.cashflowEvidence.reportDate ? `报告期 ${formatTradeDate(selectedShareholderReturn.cashflowEvidence.reportDate)}` : '报告期待补' }} · {{ cashflowStatusLabel(selectedShareholderReturn.cashflowEvidence.status) }}
          </small>
        </div>
        <div class="shareholder-cashflow-grid">
          <div class="shareholder-cashflow-item">
            <span>经营活动净现金流</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.cashflowEvidence.operatingCashflow) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>购建长期资产支出</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.cashflowEvidence.capitalExpenditure) }}</strong>
          </div>
          <div class="shareholder-cashflow-item shareholder-cashflow-item-primary">
            <span>自由现金流</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.cashflowEvidence.freeCashflow) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>同报告期现金分红</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.cashflowEvidence.cashDividendsPaid) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>自由现金流覆盖</span>
            <strong>{{ formatCashflowCoverage(selectedShareholderReturn.cashflowEvidence.freeCashflowCoverage) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>利息支出</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.cashflowEvidence.interestExpense) }}</strong>
          </div>
          <div class="shareholder-cashflow-item shareholder-cashflow-item-primary">
            <span>利息后自由现金流</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.cashflowEvidence.freeCashflowAfterInterest) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>有息负债</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.cashflowEvidence.interestBearingDebt) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>最近完整年度支付率</span>
            <strong>{{ formatPayoutRatio(selectedShareholderReturn.cashflowEvidence.payoutRatio) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>支付率报告期</span>
            <strong>{{ formatTradeDate(selectedShareholderReturn.cashflowEvidence.payoutRatioReportDate) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>现金流净利润</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.cashflowEvidence.netProfit) }}</strong>
          </div>
        </div>
        <div class="shareholder-return-provenance">
          <strong>{{ selectedShareholderReturn.cashflowEvidence.provider ? `${selectedShareholderReturn.cashflowEvidence.provider} 现金流量表` : '现金流量表来源待补' }}</strong>
          <small v-if="selectedShareholderReturn.cashflowEvidence.providerErrorCode">来源错误：{{ selectedShareholderReturn.cashflowEvidence.providerErrorCode }}</small>
          <small v-if="selectedShareholderReturn.cashflowEvidence.interestExpenseSourceField">利息口径：{{ selectedShareholderReturn.cashflowEvidence.interestExpenseSourceField }}</small>
          <small v-if="selectedShareholderReturn.cashflowEvidence.interestExpenseProviderErrorCode">利息支出来源错误：{{ selectedShareholderReturn.cashflowEvidence.interestExpenseProviderErrorCode }}</small>
          <small v-if="selectedShareholderReturn.cashflowEvidence.interestBearingDebtProviderErrorCode">有息负债来源错误：{{ selectedShareholderReturn.cashflowEvidence.interestBearingDebtProviderErrorCode }}</small>
        </div>
        <div v-if="selectedShareholderReturn.cashflowEvidence.missingFields.length" class="value-quality-notes value-quality-notes-muted">
          <strong>现金流数据缺口</strong>
          <span v-for="field in selectedShareholderReturn.cashflowEvidence.missingFields" :key="field">{{ field }}</span>
        </div>
        <div v-if="selectedShareholderReturn.cashflowEvidence.historySummary" class="shareholder-cashflow-history" aria-label="多期现金流连续性观察">
          <div class="financial-subheading">
            <div>
              <span class="section-kicker">MULTI-PERIOD COVERAGE</span>
              <strong>多期连续性观察</strong>
            </div>
            <small :class="cashflowStatusClass(selectedShareholderReturn.cashflowEvidence.historySummary.status)">
              {{ selectedShareholderReturn.cashflowEvidence.historySummary.periodCount }} 期 · {{ cashflowHistoryStatusLabel(selectedShareholderReturn.cashflowEvidence.historySummary) }}
            </small>
          </div>
          <div class="shareholder-cashflow-history-summary">
            <span>正自由现金流 {{ selectedShareholderReturn.cashflowEvidence.historySummary.positiveFreeCashflowPeriods }} / {{ selectedShareholderReturn.cashflowEvidence.historySummary.periodCount }} 期</span>
            <span>正利息后现金流 {{ selectedShareholderReturn.cashflowEvidence.historySummary.positiveFreeCashflowAfterInterestPeriods }} / {{ selectedShareholderReturn.cashflowEvidence.historySummary.periodCount }} 期</span>
            <span>分红覆盖 {{ selectedShareholderReturn.cashflowEvidence.historySummary.coveredDividendPeriods }} / {{ selectedShareholderReturn.cashflowEvidence.historySummary.periodCount }} 期</span>
            <span>支付率可算 {{ selectedShareholderReturn.cashflowEvidence.historySummary.payoutRatioPeriodCount }} 期</span>
          </div>
          <div v-if="selectedShareholderReturn.cashflowEvidence.history?.length" class="shareholder-cashflow-history-list">
            <div v-for="period in selectedShareholderReturn.cashflowEvidence.history" :key="period.reportDate" class="shareholder-cashflow-history-row">
              <span>{{ formatTradeDate(period.reportDate) }}</span>
              <strong>自由现金流 {{ formatFinancialAmount(period.freeCashflow) }}</strong>
              <strong>利息后 {{ formatFinancialAmount(period.freeCashflowAfterInterest) }}</strong>
              <small>分红覆盖 {{ formatCashflowCoverage(period.freeCashflowCoverage) }} · 支付率 {{ formatPayoutRatio(period.payoutRatio) }} · {{ cashflowStatusLabel(period.status) }}</small>
            </div>
          </div>
          <div v-if="selectedShareholderReturn.cashflowEvidence.historySummary.missingFields.length" class="value-quality-notes value-quality-notes-muted">
            <strong>多期覆盖缺口</strong>
            <span v-for="field in selectedShareholderReturn.cashflowEvidence.historySummary.missingFields" :key="field">{{ field }}</span>
          </div>
          <p class="shareholder-cashflow-note">
            这里展示报告期覆盖和同报告期计算值，只用于观察现金流连续性；历史期数、正负方向和覆盖次数均不构成投资判断。
          </p>
        </div>
        <p class="shareholder-cashflow-note">
          自由现金流 = 经营活动净现金流 - 购建长期资产支出；利息后自由现金流再减同报告期利息支出；有息负债只汇总明确借款、债券、租赁及一年内到期非流动负债。覆盖倍数只比较同报告期现金分红，支付率只比较最近完整年度。该区域用于研究核对，不改变价值质量与决策结果。
        </p>
      </div>
      <div v-if="selectedShareholderReturn.capitalStructureEvidence" class="shareholder-capital-evidence" aria-label="股东回报股本证据">
        <div class="financial-subheading">
          <div>
            <span class="section-kicker">CAPITAL STRUCTURE</span>
            <strong>股本变化与回购股数</strong>
          </div>
          <small :class="capitalStatusClass(selectedShareholderReturn.capitalStructureEvidence.status)">
            {{ selectedShareholderReturn.capitalStructureEvidence.latestReportDate ? `事件期 ${formatTradeDate(selectedShareholderReturn.capitalStructureEvidence.latestReportDate)}` : '事件期待补' }} · {{ capitalStatusLabel(selectedShareholderReturn.capitalStructureEvidence.status) }}
          </small>
        </div>
        <div class="shareholder-cashflow-grid shareholder-capital-grid">
          <div class="shareholder-cashflow-item">
            <span>最新总股本</span>
            <strong>{{ formatShareCount(selectedShareholderReturn.capitalStructureEvidence.latestTotalShares) }}</strong>
          </div>
          <div class="shareholder-cashflow-item shareholder-cashflow-item-primary">
            <span>相邻股本变化</span>
            <strong>{{ formatShareCount(selectedShareholderReturn.capitalStructureEvidence.sharesOutstandingChange) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>变化比例</span>
            <strong>{{ selectedShareholderReturn.capitalStructureEvidence.sharesOutstandingChangeRatio === null ? '--' : `${selectedShareholderReturn.capitalStructureEvidence.sharesOutstandingChangeRatio.toFixed(2)}%` }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>回购导致减少</span>
            <strong>{{ formatShareCount(selectedShareholderReturn.capitalStructureEvidence.repurchaseSharesRetired) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>上一条总股本</span>
            <strong>{{ formatShareCount(selectedShareholderReturn.capitalStructureEvidence.previousTotalShares) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>最新变动原因</span>
            <strong>{{ selectedShareholderReturn.capitalStructureEvidence.latestChangeReason || '--' }}</strong>
          </div>
        </div>
        <div v-if="selectedShareholderReturn.capitalStructureEvidence.changes.length" class="shareholder-capital-history">
          <div class="financial-subheading">
            <div>
              <strong>最近股本事件</strong>
            </div>
            <small>{{ selectedShareholderReturn.capitalStructureEvidence.changes.length }} 条</small>
          </div>
          <div v-for="change in selectedShareholderReturn.capitalStructureEvidence.changes.slice(0, 5)" :key="`${change.reportDate}-${change.changeReason || 'unknown'}-${change.totalShares ?? 'null'}`" class="shareholder-capital-change-row">
            <span>{{ formatTradeDate(change.reportDate) }}</span>
            <strong>{{ formatShareCount(change.sharesOutstandingChange) }}</strong>
            <small>{{ change.changeReason || '变动原因待补' }}</small>
          </div>
        </div>
        <div class="shareholder-return-provenance">
          <strong>{{ selectedShareholderReturn.capitalStructureEvidence.provider ? `${selectedShareholderReturn.capitalStructureEvidence.provider} 股本结构` : '股本结构来源待补' }}</strong>
          <small v-if="selectedShareholderReturn.capitalStructureEvidence.providerErrorCode">来源错误：{{ selectedShareholderReturn.capitalStructureEvidence.providerErrorCode }}</small>
        </div>
        <div v-if="selectedShareholderReturn.capitalStructureEvidence.missingFields.length" class="value-quality-notes value-quality-notes-muted">
          <strong>股本数据缺口</strong>
          <span v-for="field in selectedShareholderReturn.capitalStructureEvidence.missingFields" :key="field">{{ field }}</span>
        </div>
        <p class="shareholder-cashflow-note">
          股本变化只比较相邻总股本事件；回购股数只累计原因含“回购”且总股本下降的事件，不换算回购金额，也不改变价值质量与决策结果。
        </p>
      </div>
      <div v-if="selectedShareholderReturn.repurchaseEvidence" class="shareholder-repurchase-evidence" aria-label="股东回报回购证据">
        <div class="financial-subheading">
          <div>
            <span class="section-kicker">REPURCHASE EVIDENCE</span>
            <strong>回购计划与已实施金额</strong>
          </div>
          <small :class="repurchaseStatusClass(selectedShareholderReturn.repurchaseEvidence.status)">
            {{ selectedShareholderReturn.repurchaseEvidence.latestAnnouncementDate ? `公告 ${formatTradeDate(selectedShareholderReturn.repurchaseEvidence.latestAnnouncementDate)}` : '公告日期待补' }} · {{ repurchaseStatusLabel(selectedShareholderReturn.repurchaseEvidence.status) }}
          </small>
        </div>
        <div class="shareholder-cashflow-grid shareholder-repurchase-grid">
          <div class="shareholder-cashflow-item shareholder-cashflow-item-primary">
            <span>样本内已实施回购金额</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.repurchaseEvidence.repurchaseAmount) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>计划金额下限</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.repurchaseEvidence.plannedAmountLower) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>计划金额上限</span>
            <strong>{{ formatFinancialAmount(selectedShareholderReturn.repurchaseEvidence.plannedAmountUpper) }}</strong>
          </div>
          <div class="shareholder-cashflow-item">
            <span>回购计划数</span>
            <strong>{{ selectedShareholderReturn.repurchaseEvidence.records.length }} 项</strong>
          </div>
        </div>
        <div v-if="selectedShareholderReturn.repurchaseEvidence.records.length" class="shareholder-repurchase-history">
          <div class="financial-subheading">
            <div>
              <strong>最近回购计划</strong>
            </div>
            <small>{{ selectedShareholderReturn.repurchaseEvidence.records.length }} 条</small>
          </div>
          <div v-for="record in selectedShareholderReturn.repurchaseEvidence.records.slice(0, 5)" :key="`${record.repurchaseCode || 'plan'}-${record.announcementDate || record.startDate || 'unknown'}`" class="shareholder-repurchase-row">
            <span>{{ formatTradeDate(record.announcementDate || record.startDate) }}</span>
            <strong>{{ formatFinancialAmount(record.repurchaseAmount) }}</strong>
            <small>{{ repurchaseProgressLabel(record.progress) }} · 计划 {{ formatRepurchaseRange(record.plannedAmountLower, record.plannedAmountUpper) }} · {{ formatShareCount(record.repurchaseShares) }}</small>
          </div>
        </div>
        <div class="shareholder-return-provenance">
          <strong>{{ selectedShareholderReturn.repurchaseEvidence.provider ? `${selectedShareholderReturn.repurchaseEvidence.provider} 回购计划` : '回购计划来源待补' }}</strong>
          <small v-if="selectedShareholderReturn.repurchaseEvidence.providerErrorCode">来源错误：{{ selectedShareholderReturn.repurchaseEvidence.providerErrorCode }}</small>
        </div>
        <div v-if="selectedShareholderReturn.repurchaseEvidence.missingFields.length" class="value-quality-notes value-quality-notes-muted">
          <strong>回购数据缺口</strong>
          <span v-for="field in selectedShareholderReturn.repurchaseEvidence.missingFields" :key="field">{{ field }}</span>
        </div>
        <p class="shareholder-cashflow-note">
          已实施金额只汇总回购计划的实际金额字段；计划下限和上限用于规模上下文，不替代已支出金额，也不改变价值质量与决策结果。
        </p>
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
