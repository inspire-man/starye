// @vitest-environment happy-dom

import type { Column, ParsedError } from '@starye/ui'
import type { DecisionEvidence } from '../../lib/decision-evidence'
import type {
  CandidateItem,
  CandidateSignalPersistence,
  DailyBar,
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantResearchMarker,
  QuantShareholderCashflowHistoryItem,
  QuantShareholderReturnItem,
  QuantValuationComparison,
  QuantValuationSnapshot,
  QuantValueQualityItem,
  WatchlistItem,
} from '../../lib/quant-view-models'
import type { ResearchPriority } from '../../lib/research-priority'
import type { ResearchReviewMeta } from '../../lib/research-review'
import type { TimingHistory, TimingHistoryBucket } from '../../lib/timing-history'
import type { TimingWindow } from '../../lib/timing-window'
import type { TrendStructure } from '../../lib/trend-analysis'
import type { QuantDetailErrorState, QuantDetailLoadingState } from '../quant-detail/quant-detail-contracts'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import QuantDailyDataSection from '../quant-detail/QuantDailyDataSection.vue'
import QuantDecisionCard from '../quant-detail/QuantDecisionCard.vue'
import QuantDecisionEvidenceSection from '../quant-detail/QuantDecisionEvidenceSection.vue'
import QuantFinancialQualitySection from '../quant-detail/QuantFinancialQualitySection.vue'
import QuantResearchMarkerEditor from '../quant-detail/QuantResearchMarkerEditor.vue'
import QuantShareholderReturnsSection from '../quant-detail/QuantShareholderReturnsSection.vue'
import QuantSignalPersistenceSection from '../quant-detail/QuantSignalPersistenceSection.vue'
import QuantTimingSection from '../quant-detail/QuantTimingSection.vue'
import QuantValuationSection from '../quant-detail/QuantValuationSection.vue'
import QuantValueQualitySection from '../quant-detail/QuantValueQualitySection.vue'

const stock: WatchlistItem = {
  id: 'watch-1',
  tsCode: '601899.SH',
  name: '测试股票',
  latestTradeDate: '20260903',
  barCount: 120,
  latestClose: 10,
  latestChangePercent: 1.2,
  createdAt: '2026-09-03T00:00:00.000Z',
}

const candidate: CandidateItem = {
  id: 'candidate-1',
  tsCode: stock.tsCode,
  factorVersion: 'momentum-v1',
  name: stock.name,
  score: 3,
  close: 10,
  changePercent: 1.2,
  ma5: 9.8,
  ma20: 9.4,
  return20: 4.5,
  newHigh20: true,
  upStreak: 2,
  volumeRatio: 1.1,
  relativeStrength: 0.8,
  signals: ['ma20'],
  missingFactors: [],
  quality: 'ready',
}

const marker: QuantResearchMarker = {
  tsCode: stock.tsCode,
  status: 'priority',
  note: null,
  reviewDate: null,
  createdAt: null,
  updatedAt: null,
}

const review: ResearchReviewMeta = {
  state: 'unscheduled',
  label: '未设置',
  detail: '尚未设置复查日期',
  tone: 'neutral',
  date: null,
}

const priority: ResearchPriority = {
  level: 'normal',
  levelLabel: '常规研究',
  action: 'continue-research',
  actionLabel: '继续研究',
  tone: 'positive',
  score: 30,
  reasons: ['有信号'],
  breakdown: { dataGap: 0, review: 0, risk: 0, valueQuality: 0, persistence: 0, marker: 0 },
  reviewState: 'unscheduled',
  markerStatus: 'priority',
}

const loading: QuantDetailLoadingState = {
  daily: false,
  valuation: false,
  financial: false,
  valueQuality: false,
  shareholderReturns: false,
}

const errors: QuantDetailErrorState = {
  daily: null,
  valuation: null,
  financial: null,
  valueQuality: null,
  shareholderReturns: null,
}

const valuation: QuantValuationSnapshot = {
  tsCode: stock.tsCode,
  observedAt: '2026-09-03T00:00:00.000Z',
  dynamicPe: 12.3,
  peTtm: 13.1,
  peStatic: 14.2,
  pb: 1.8,
  ps: 2.1,
  peg: 0.9,
  marketCap: 1200000000,
}

const valuationComparison: QuantValuationComparison = {
  target: valuation,
  peers: [],
  sampleCount: 2,
  availableSampleCount: 2,
  ttmPeSampleCount: 2,
  pbSampleCount: 2,
  ttmPeHigherThanPercent: 50,
  pbHigherThanPercent: 50,
}

const financialQuality: QuantFinancialQualitySnapshot = {
  tsCode: stock.tsCode,
  observedAt: '2026-09-03T00:00:00.000Z',
  reportDate: '20260630',
  reportType: '半年报',
  reportDateName: '2026 年半年报',
  noticeDate: '20260830',
  revenue: 100,
  revenueYoY: 0.12,
  netProfit: 20,
  netProfitYoY: 0.08,
  adjustedNetProfit: 19,
  adjustedNetProfitYoY: 0.07,
  roe: 0.15,
  grossMargin: 0.3,
  netMargin: 0.2,
  debtAssetRatio: 0.4,
  operatingCashflowToRevenue: 0.18,
  operatingCashflowPerShare: 0.5,
  fcffBack: 12,
  fcffForward: 14,
  interestCoverage: 4,
  interestBearingDebtRatio: 0.2,
  cashRatio: 0.8,
  totalLiability: 50,
  roic: 0.11,
}

const financialHistory: QuantFinancialQualityHistory = {
  tsCode: stock.tsCode,
  observedAt: financialQuality.observedAt,
  reports: [financialQuality],
}

const financialComparison: QuantFinancialQualityComparison = {
  target: financialQuality,
  peers: [],
  sampleCount: 1,
  availableSampleCount: 1,
  revenueYoYSampleCount: 1,
  netProfitYoYSampleCount: 1,
  roeSampleCount: 1,
  debtAssetRatioSampleCount: 1,
  revenueYoYHigherThanPercent: 100,
  netProfitYoYHigherThanPercent: 100,
  roeHigherThanPercent: 100,
  debtAssetRatioLowerThanPercent: 100,
}

const cashflowHistory: QuantShareholderCashflowHistoryItem[] = [
  {
    formulaVersion: 'shareholder-cashflow-v2',
    status: 'ready',
    reportDate: '2026-06-30',
    reportType: '中报',
    reportDateName: '2026中报',
    noticeDate: '2026-08-22',
    operatingCashflow: 100,
    capitalExpenditure: 30,
    netProfit: 80,
    cashDividendsPaid: 20,
    freeCashflow: 70,
    freeCashflowCoverage: 3.5,
    interestExpense: 10,
    interestExpenseSourceField: 'FE_INTEREST_EXPENSE',
    interestExpenseProviderErrorCode: null,
    interestBearingDebt: 200,
    interestBearingDebtComponents: {
      shortLoan: 100,
      shortBondPayable: null,
      shortFinancePayable: null,
      acceptDepositInterbank: null,
      borrowFund: null,
      loanPbc: null,
      currentMaturityDebt: 20,
      amortizedCostFinancialLiability: null,
      longLoan: 50,
      amortizedCostNoncurrentFinancialLiability: null,
      bondPayable: 20,
      perpetualBond: null,
      perpetualBondPayable: null,
      leaseLiability: 10,
    },
    interestBearingDebtProviderErrorCode: null,
    freeCashflowAfterInterest: 60,
    payoutRatio: null,
    missingFields: [],
  },
  {
    formulaVersion: 'shareholder-cashflow-v2',
    status: 'ready',
    reportDate: '2025-12-31',
    reportType: '年报',
    reportDateName: '2025年报',
    noticeDate: '2026-03-21',
    operatingCashflow: 200,
    capitalExpenditure: 50,
    netProfit: 200,
    cashDividendsPaid: 50,
    freeCashflow: 150,
    freeCashflowCoverage: 3,
    interestExpense: 10,
    interestExpenseSourceField: 'FE_INTEREST_EXPENSE',
    interestExpenseProviderErrorCode: null,
    interestBearingDebt: 180,
    interestBearingDebtComponents: {
      shortLoan: 80,
      shortBondPayable: null,
      shortFinancePayable: null,
      acceptDepositInterbank: null,
      borrowFund: null,
      loanPbc: null,
      currentMaturityDebt: 20,
      amortizedCostFinancialLiability: null,
      longLoan: 50,
      amortizedCostNoncurrentFinancialLiability: null,
      bondPayable: 20,
      perpetualBond: null,
      perpetualBondPayable: null,
      leaseLiability: 10,
    },
    interestBearingDebtProviderErrorCode: null,
    freeCashflowAfterInterest: 140,
    payoutRatio: 25,
    missingFields: [],
  },
]

const shareholderReturn: QuantShareholderReturnItem = {
  tsCode: stock.tsCode,
  name: stock.name,
  formulaVersion: 'shareholder-return-v1',
  status: 'partial',
  provider: 'eastmoney',
  providerChain: ['eastmoney'],
  fallbackUsed: false,
  fallbackReason: null,
  providerErrorCode: null,
  observedAt: '2026-09-03T00:00:00.000Z',
  latestClose: 10,
  trailingCashDividendPerShare: 0.2,
  trailingDividendYield: 0.02,
  dividendYears: 3,
  distributions: [],
  missingFields: [],
  cashflowEvidence: {
    formulaVersion: 'shareholder-cashflow-v2',
    status: 'ready',
    provider: 'eastmoney',
    providerErrorCode: null,
    observedAt: '2026-09-03T00:00:00.000Z',
    reportDate: '2026-06-30',
    reportType: '中报',
    reportDateName: '2026中报',
    noticeDate: '2026-08-22',
    operatingCashflow: 100,
    capitalExpenditure: 30,
    netProfit: 80,
    cashDividendsPaid: 20,
    freeCashflow: 70,
    freeCashflowCoverage: 3.5,
    interestExpense: 10,
    interestExpenseSourceField: 'FE_INTEREST_EXPENSE',
    interestExpenseProviderErrorCode: null,
    interestBearingDebt: 200,
    interestBearingDebtComponents: {
      shortLoan: 100,
      shortBondPayable: null,
      shortFinancePayable: null,
      acceptDepositInterbank: null,
      borrowFund: null,
      loanPbc: null,
      currentMaturityDebt: 20,
      amortizedCostFinancialLiability: null,
      longLoan: 50,
      amortizedCostNoncurrentFinancialLiability: null,
      bondPayable: 20,
      perpetualBond: null,
      perpetualBondPayable: null,
      leaseLiability: 10,
    },
    interestBearingDebtProviderErrorCode: null,
    freeCashflowAfterInterest: 60,
    payoutRatio: 25,
    payoutRatioReportDate: '2025-12-31',
    missingFields: [],
    history: cashflowHistory,
    historySummary: {
      formulaVersion: 'shareholder-cashflow-history-v1',
      status: 'ready',
      periodCount: 2,
      coreReadyPeriodCount: 2,
      positiveFreeCashflowPeriods: 2,
      positiveFreeCashflowAfterInterestPeriods: 2,
      coveredDividendPeriods: 2,
      payoutRatioPeriodCount: 1,
      latestReportDate: '2026-06-30',
      missingFields: [],
    },
  },
  capitalStructureEvidence: {
    formulaVersion: 'shareholder-capital-v1',
    status: 'ready',
    provider: 'eastmoney',
    providerErrorCode: null,
    observedAt: '2026-09-03T00:00:00.000Z',
    latestReportDate: '2026-03-31',
    latestTotalShares: 1200,
    latestChangeReason: '债转股上市',
    previousReportDate: '2025-12-18',
    previousTotalShares: 1100,
    sharesOutstandingChange: 100,
    sharesOutstandingChangeRatio: 9.09,
    repurchaseSharesRetired: 50,
    changes: [
      { reportDate: '2026-03-31', totalShares: 1200, changeReason: '债转股上市', sharesOutstandingChange: 100, sharesOutstandingChangeRatio: 9.09 },
      { reportDate: '2025-12-18', totalShares: 1100, changeReason: '回购', sharesOutstandingChange: -50, sharesOutstandingChangeRatio: -4.35 },
    ],
    missingFields: [],
  },
  repurchaseEvidence: {
    formulaVersion: 'shareholder-repurchase-v1',
    status: 'ready',
    provider: 'eastmoney',
    providerErrorCode: null,
    observedAt: '2026-09-03T00:00:00.000Z',
    latestAnnouncementDate: '2026-04-15',
    latestProgress: '006',
    repurchaseAmount: 200,
    plannedAmountLower: 150,
    plannedAmountUpper: 250,
    records: [{
      repurchaseCode: 'plan-1',
      announcementDate: '2026-04-15',
      startDate: '2026-03-20',
      endDate: '2027-03-20',
      finishDate: '2026-04-14',
      progress: '006',
      plannedAmountLower: 150,
      plannedAmountUpper: 250,
      repurchaseAmount: 200,
      repurchaseShares: 1000,
    }],
    missingFields: [],
  },
}

const dailyBar: DailyBar = {
  id: 'bar-1',
  tsCode: stock.tsCode,
  tradeDate: '20260903',
  open: 10,
  high: 10.2,
  low: 9.9,
  close: 10.1,
  preClose: 10,
  change: 0.1,
  changePercent: 1,
  volume: 1000,
  amount: 10000,
}

const trendStructure: TrendStructure = {
  return5: 0.01,
  return20: 0.05,
  return60: 0.12,
  ma20Gap: 0.03,
  drawdown60: -0.02,
  availableBars: 60,
  tone: 'positive',
  conclusion: '趋势向上',
}

const persistence: CandidateSignalPersistence = {
  sampleSize: 2,
  appearanceCount: 2,
  persistenceRate: 1,
  latestScore: 3,
  previousScore: 2,
  scoreDelta: 1,
  scoreChange: 1,
  state: 'confirming',
  factorPersistence: [{ factor: 'ma20', appearances: 2, rate: 1 }],
  evidence: [],
}

const timingWindow: TimingWindow = {
  state: 'constructive',
  tone: 'positive',
  label: '结构平稳',
  headline: '价格位于中期结构附近',
  availableBars: 60,
  ma20Gap: 0.03,
  ma60Gap: 0.05,
  pullback20: -0.01,
  volatility20: 0.02,
  metrics: [{
    key: 'ma20-gap',
    label: '距 MA20',
    value: 0.03,
    status: 'pass',
    threshold: '站上均线 >= 0%',
    detail: '价格位于 MA20 之上',
  }],
}

const timingBucket: TimingHistoryBucket = {
  state: 'constructive',
  label: '结构平稳',
  sampleSize: 4,
  positiveCount: 3,
  positiveRate: 0.75,
  averageForwardReturn20: 0.04,
  medianForwardReturn20: 0.03,
  bestForwardReturn20: 0.1,
  worstForwardReturn20: -0.02,
}

const timingHistory: TimingHistory = {
  availableBars: 80,
  evaluatedWindows: 4,
  forwardDays: 20,
  dataStartDate: '20260601',
  dataEndDate: '20260903',
  evaluationStartDate: '20260801',
  evaluationEndDate: '20260820',
  currentState: 'constructive',
  currentLabel: '结构平稳',
  observations: [],
  buckets: [timingBucket],
}

const decisionEvidence: DecisionEvidence = {
  formulaVersion: 'decision-evidence-v1',
  action: 'research-window',
  label: '进入研究窗口',
  headline: '关键门槛均已通过',
  gateScore: 100,
  passedCount: 2,
  requiredCount: 2,
  cautionCount: 0,
  failedCount: 0,
  missingCount: 0,
  evidence: [{
    key: 'trend-ma20',
    dimension: 'trend',
    label: '收盘价 / MA20',
    status: 'pass',
    numericValue: 0.03,
    value: '+3.00%',
    threshold: '>= 0%',
    source: '本地 Quant 日线库',
    observedAt: '20260903',
    detail: '中期趋势确认',
  }],
  waitConditions: [],
  reassessmentConditions: ['收盘价跌破 MA20'],
}

const valueQuality: QuantValueQualityItem = {
  tsCode: stock.tsCode,
  name: stock.name,
  formulaVersion: 'value-quality-v2',
  status: 'ready',
  score: 82,
  observedAt: '2026-09-03T00:00:00.000Z',
  valuationObservedAt: '2026-09-03T00:00:00.000Z',
  financialObservedAt: '2026-09-03T00:00:00.000Z',
  financialReportDate: '20260630',
  financialNoticeDate: '20260830',
  valuationStatus: 'ready',
  financialStatus: 'ready',
  dailyStatus: 'ready',
  dimensions: [{
    key: 'valuation',
    label: '估值',
    score: 24,
    maxScore: 30,
    status: 'ready',
    metrics: [],
  }],
  riskDeduction: 0,
  riskNotes: [],
  missingFields: [],
}

const formatNumber = (value: number | null) => value === null ? '--' : value.toFixed(2)
const formatPercent = (value: number | null) => value === null ? '--' : `${value.toFixed(2)}%`
const formatTradeDate = (value: string | null) => value || '--'
function formatErrors(value: unknown): ParsedError {
  return {
    type: 'unknown',
    message: value instanceof Error ? value.message : '请求失败',
    originalError: value,
  }
}

describe('quant detail feature sections', () => {
  it('renders candidate facts and research action in the decision card', () => {
    const wrapper = shallowMount(QuantDecisionCard, {
      props: {
        selectedCandidate: candidate,
        selectedResearchMarker: marker,
        selectedResearchReview: review,
        researchStatusOptions: [{ value: 'priority', label: '重点关注' }],
        signalRuleCount: 6,
        formatSignalScore: value => value === null ? '--' : `${value} / 6`,
        formatPercent,
        formatFactorLabel: value => value,
        candidatePriorityFor: () => priority,
        researchPriorityDetail: () => '有信号',
        researchPriorityActionClass: () => 'research-priority-action-positive',
      },
    })

    expect(wrapper.text()).toContain('信号覆盖')
    expect(wrapper.text()).toContain('继续研究')
    expect(wrapper.text()).toContain('20 日表现')
  })

  it('keeps valuation retry at the feature boundary', async () => {
    const loadValuation = vi.fn()
    const wrapper = shallowMount(QuantValuationSection, {
      props: {
        selectedStock: stock,
        selectedTsCode: stock.tsCode,
        valuation: null,
        valuationComparison,
        hasValuationData: false,
        loading: false,
        error: new Error('valuation unavailable'),
        valuationErrorMessage: '估值请求失败',
        valuationComparisonErrorMessage: null,
        formatNumber,
        formatDateTime: value => value || '--',
        formatComparisonPosition: value => value === null ? '--' : String(value),
        formatMarketCap: formatNumber,
        loadValuation,
      },
    })

    await wrapper.get('.valuation-state .text-button').trigger('click')
    expect(loadValuation).toHaveBeenCalledWith(stock.tsCode)
  })

  it('exposes financial quality retry without owning data loading', async () => {
    const loadFinancialQuality = vi.fn()
    const wrapper = shallowMount(QuantFinancialQualitySection, {
      props: {
        selectedStock: stock,
        selectedTsCode: stock.tsCode,
        financialQuality: null,
        financialHistory: null,
        financialComparison: null,
        financialComparisonError: null,
        hasFinancialData: false,
        financialTrendItems: [],
        loading,
        errors: { ...errors, financial: new Error('financial unavailable') },
        formatNumber,
        formatPercent,
        formatTradeDate,
        formatFinancialAmount: formatNumber,
        formatMetricPercent: formatPercent,
        formatRatioPercent: formatPercent,
        formatMultiple: formatNumber,
        formatComparisonPosition: value => value === null ? '--' : String(value),
        formatLowerComparisonPosition: value => value === null ? '--' : String(value),
        formatTrendDelta: value => value === null ? '--' : String(value),
        loadFinancialQuality,
      },
    })

    await wrapper.get('.valuation-state .text-button').trigger('click')
    expect(loadFinancialQuality).toHaveBeenCalledWith(stock.tsCode)
  })

  it('shows the previous shareholder result while refresh reports an error', async () => {
    const loadShareholderReturns = vi.fn()
    const wrapper = shallowMount(QuantShareholderReturnsSection, {
      props: {
        selectedShareholderReturn: shareholderReturn,
        loading,
        errors: { ...errors, shareholderReturns: new Error('provider unavailable') },
        formatNumber,
        formatFinancialAmount: formatNumber,
        formatTradeDate,
        formatDividendYield: formatPercent,
        shareholderReturnStatusLabel: () => '数据部分可用',
        shareholderReturnStatusClass: () => 'value-quality-status-muted',
        shareholderReturnHeaderLabel: () => '最近观察',
        shareholderReturnSourceLabel: () => '本地数据',
        parsedError: formatErrors,
        loadShareholderReturns,
      },
    })

    expect(wrapper.text()).toContain('以下为上次成功结果')
    expect(wrapper.text()).toContain('10.00')
    expect(wrapper.text()).toContain('现金流与分红覆盖')
    expect(wrapper.text()).toContain('70.00')
    expect(wrapper.text()).toContain('利息后自由现金流')
    expect(wrapper.text()).toContain('有息负债')
    expect(wrapper.text()).toContain('多期连续性观察')
    expect(wrapper.text()).toContain('正自由现金流 2 / 2 期')
    expect(wrapper.text()).toContain('2026-06-30')
    expect(wrapper.text()).toContain('利息后 60.00')
    expect(wrapper.text()).toContain('股本变化与回购股数')
    expect(wrapper.text()).toContain('回购导致减少')
    expect(wrapper.text()).toContain('50 股')
    expect(wrapper.text()).toContain('回购计划与已实施金额')
    expect(wrapper.text()).toContain('样本内已实施回购金额')
    expect(wrapper.text()).toContain('200.00')
    expect(wrapper.text()).toContain('完成实施')
    await wrapper.get('.data-refresh-feedback-error .text-button').trigger('click')
    expect(loadShareholderReturns).toHaveBeenCalledOnce()
  })

  it('keeps daily error retry outside the table component', async () => {
    const loadDailyBars = vi.fn()
    const wrapper = shallowMount(QuantDailyDataSection, {
      props: {
        selectedStock: stock,
        selectedTsCode: stock.tsCode,
        dailyBars: [dailyBar],
        dailyColumns: [] as Column<DailyBar>[],
        chartBars: [],
        latestDailyBar: null,
        latestDate: '--',
        trendStructure,
        loading,
        errors: { ...errors, daily: new Error('daily unavailable') },
        formatNumber,
        formatPercent,
        formatTradeDate,
        parsedError: formatErrors,
        loadDailyBars,
      },
    })

    await wrapper.get('.inline-alert .text-button').trigger('click')
    expect(loadDailyBars).toHaveBeenCalledWith(stock.tsCode)
  })

  it('renders financial data when the snapshot is ready', () => {
    const wrapper = shallowMount(QuantFinancialQualitySection, {
      props: {
        selectedStock: stock,
        selectedTsCode: stock.tsCode,
        financialQuality,
        financialHistory,
        financialComparison,
        financialComparisonError: null,
        hasFinancialData: true,
        financialTrendItems: [],
        loading,
        errors,
        formatNumber,
        formatPercent,
        formatTradeDate,
        formatFinancialAmount: formatNumber,
        formatMetricPercent: formatPercent,
        formatRatioPercent: formatPercent,
        formatMultiple: formatNumber,
        formatComparisonPosition: value => value === null ? '--' : String(value),
        formatLowerComparisonPosition: value => value === null ? '--' : String(value),
        formatTrendDelta: value => value === null ? '--' : String(value),
        loadFinancialQuality: vi.fn(),
      },
    })

    expect(wrapper.text()).toContain('营业收入')
    expect(wrapper.text()).toContain('现金流韧性')
    expect(wrapper.text()).toContain('资本开支、回购和分红支付率已在股东回报区域独立展示')
    expect(wrapper.text()).not.toContain('资本开支逐项数据、回购和分红支付率暂未接通')
  })

  it('renders persistence evidence from the prepared candidate model', () => {
    const wrapper = shallowMount(QuantSignalPersistenceSection, {
      props: {
        selectedCandidate: { ...candidate, persistence },
        formatPersistenceRate: value => value === null ? '--' : `${value * 100}%`,
        formatScoreDelta: value => value === null ? '--' : String(value),
        scoreDeltaClass: () => 'text-status-success',
        candidatePersistenceFor: () => persistence,
        candidatePersistenceLabel: () => '持续确认',
        candidatePersistenceClass: () => 'candidate-persistence-confirming',
        formatFactorLabel: value => value,
        formatDateTime: value => value || '--',
        formatSignalScore: value => value === null ? '--' : `${value} / 6`,
      },
    })

    expect(wrapper.text()).toContain('信号是否持续')
    expect(wrapper.text()).toContain('ma20')
  })

  it('renders timing window and history as one analysis feature', () => {
    const wrapper = shallowMount(QuantTimingSection, {
      props: {
        selectedStock: stock,
        timingWindow,
        timingHistory,
        timingHistoryCurrentBucket: timingBucket,
        formatTradeDate,
        timingWindowClass: () => 'timing-window-positive',
        timingWindowMetricClass: () => 'timing-window-metric-pass',
        timingWindowMetricStatusLabel: () => '通过',
        formatTimingWindowMetric: metric => metric.value === null ? '--' : `${metric.value * 100}%`,
        timingHistoryStateClass: () => 'timing-history-state-constructive',
        formatTimingHistoryRate: value => value === null ? '--' : `${value * 100}%`,
        formatTimingHistoryPercent: value => value === null ? '--' : `${value * 100}%`,
        timingHistoryBucketTitle: () => '历史回看',
      },
    })

    expect(wrapper.text()).toContain('中长线时机窗口')
    expect(wrapper.text()).toContain('历史条件回看')
    expect(wrapper.text()).toContain('未来 20 日上涨比例')
  })

  it('keeps decision evidence status and action formatting at the component boundary', () => {
    const wrapper = shallowMount(QuantDecisionEvidenceSection, {
      props: {
        decisionEvidence,
        formatEvidenceDate: value => value || '--',
        formatDateTime: value => value || '--',
        decisionEvidenceStatusLabel: () => '通过',
        decisionEvidenceStatusClass: () => 'decision-evidence-status-pass',
        decisionEvidenceActionClass: () => 'decision-evidence-action-research-window',
      },
    })

    expect(wrapper.text()).toContain('进入研究窗口')
    expect(wrapper.text()).toContain('收盘价 / MA20')
    expect(wrapper.text()).toContain('重新评估条件')
  })

  it('renders value quality score and preserves retry ownership in the parent', async () => {
    const loadValueSelection = vi.fn()
    const wrapper = shallowMount(QuantValueQualitySection, {
      props: {
        selectedStock: stock,
        selectedValueQuality: valueQuality,
        loading,
        errors,
        formatDateTime: value => value || '--',
        formatTradeDate,
        valueQualityStatusLabel: () => '数据完整',
        valueQualityStatusClass: () => 'value-quality-status-ready',
        formatValueQualityScore: item => item?.score === null || !item ? '--' : String(item.score),
        formatValueQualityDimension: (item, key) => item?.dimensions.find(dimension => dimension.key === key)?.score?.toString() || '--',
        valueQualityDimensionSamples: () => 1,
        parsedError: formatErrors,
        loadValueSelection,
      },
    })

    expect(wrapper.text()).toContain('中长线价值质量')
    expect(wrapper.text()).toContain('研究评分')
    expect(wrapper.text()).toContain('82')
  })

  it('keeps research marker fields as local models and save as an explicit action', async () => {
    const saveResearchMarker = vi.fn()
    const wrapper = shallowMount(QuantResearchMarkerEditor, {
      props: {
        researchFormStatus: 'unreviewed',
        researchFormNote: '',
        researchFormReviewDate: '',
        researchStatusOptions: [
          { value: 'unreviewed', label: '待研究' },
          { value: 'priority', label: '重点关注' },
        ],
        researchSaving: false,
        researchSaveMessage: '',
        researchSaveErrorMessage: null,
        saveResearchMarker,
      },
    })

    await wrapper.get('.research-marker-form select').setValue('priority')
    expect(wrapper.emitted('update:researchFormStatus')).toEqual([['priority']])
    await wrapper.get('.research-save-button').trigger('click')
    expect(saveResearchMarker).toHaveBeenCalledOnce()
  })
})
