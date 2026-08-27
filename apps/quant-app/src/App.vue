<script setup lang="ts">
import type { Column, ErrorType, ParsedError } from '@starye/ui'
import type { CandidateEvidenceScore } from './lib/candidate-evidence-score'
import type { DecisionEvidenceStatus } from './lib/decision-evidence'
import type {
  CandidateItem,
  CandidateSignalPersistence,
  CandidateSnapshot,
  DailyBar,
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantInvestmentKnowledge,
  QuantKnowledgeFactor,
  QuantResearchEvidence,
  QuantResearchMarker,
  QuantResearchRun,
  QuantResearchSummary,
  QuantShareholderReturnItem,
  QuantShareholderReturnSelection,
  QuantValuationComparison,
  QuantValuationSnapshot,
  QuantValueQualityDimension,
  QuantValueQualityItem,
  QuantValueSelection,
  ResearchMarkerStatus,
  SyncResult,
  SyncStatus,
  WatchlistItem,
} from './lib/quant-types'
import type { QuantView } from './lib/quant-view'
import type { BatchResearchProgress } from './lib/research-batch'
import type { BatchResearchFollowUpState } from './lib/research-batch-follow-up'
import type { ResearchEvidenceChange } from './lib/research-evidence-history'
import type { ResearchPriority, ResearchPriorityValueQuality } from './lib/research-priority'
import type { ResearchReviewMeta } from './lib/research-review'
import type { ResearchRunScoreDirection } from './lib/research-run-timeline'
import type { CandidateResearchMetadata, CandidateResearchStatus, CandidateReviewFilter, CandidateSortKey, SelectionPresetKey } from './lib/selection-presets'
import type { TimingHistoryBucket } from './lib/timing-history'
import type { TimingWindow, TimingWindowMetricStatus, TimingWindowState } from './lib/timing-window'
import type { WatchlistEnvironmentStatus } from './lib/watchlist-environment'
import { ConfirmDialog, DataTable, DetailDrawer, ErrorDisplay, SkeletonCard } from '@starye/ui'
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  DatabaseZap,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Info,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import QuantAiResearchSummary from './components/QuantAiResearchSummary.vue'
import QuantAiSettingsDrawer from './components/QuantAiSettingsDrawer.vue'
import QuantHeader from './components/QuantHeader.vue'
import { quantApi, QuantApiError } from './lib/api-client'
import { buildCandidateEvidenceScore } from './lib/candidate-evidence-score'
import { buildDecisionEvidence } from './lib/decision-evidence'
import { parseQuantView, quantViewHash } from './lib/quant-view'
import { runResearchBatch } from './lib/research-batch'
import { applyBatchResearchProgress, getBatchResearchItemAction, markBatchResearchItemPending } from './lib/research-batch-follow-up'
import { buildResearchEvidenceComparison } from './lib/research-evidence-history'
import { buildResearchPriority, compareResearchPriorities, summarizeResearchPriorities } from './lib/research-priority'
import { buildResearchReportFilename, buildResearchReportMarkdown } from './lib/research-report-export'
import { getResearchReviewMeta, getTodayDate } from './lib/research-review'
import { buildResearchRunTimeline } from './lib/research-run-timeline'
import { buildResearchSummary } from './lib/research-summary'
import { filterAndSortCandidates, selectionPresets } from './lib/selection-presets'
import { buildTimingHistory } from './lib/timing-history'
import { buildTimingWindow } from './lib/timing-window'
import { buildTrendStructure } from './lib/trend-analysis'
import { buildWatchlistEnvironment } from './lib/watchlist-environment'

type ComparisonResearchItemState = BatchResearchFollowUpState

const watchlist = ref<WatchlistItem[]>([])
const snapshot = ref<CandidateSnapshot | null>(null)
const dailyBars = ref<DailyBar[]>([])
const valuationComparison = ref<QuantValuationComparison | null>(null)
const valuationComparisonError = ref<unknown | null>(null)
const valuation = ref<QuantValuationSnapshot | null>(null)
const financialQuality = ref<QuantFinancialQualitySnapshot | null>(null)
const financialHistory = ref<QuantFinancialQualityHistory | null>(null)
const financialComparison = ref<QuantFinancialQualityComparison | null>(null)
const financialComparisonError = ref<unknown | null>(null)
const valueSelection = ref<QuantValueSelection | null>(null)
const shareholderReturns = ref<QuantShareholderReturnSelection | null>(null)
const investmentKnowledge = ref<QuantInvestmentKnowledge | null>(null)
const researchMarkers = ref<QuantResearchMarker[]>([])
const researchRuns = ref<QuantResearchRun[]>([])
const researchAiSummary = ref<QuantResearchSummary | null>(null)
const researchRunLoading = ref(false)
const researchRunGenerating = ref(false)
const researchRunError = ref<unknown | null>(null)
const researchSummaryLoading = ref(false)
const researchSummaryGenerating = ref(false)
const researchSummaryError = ref<unknown | null>(null)
const selectedCandidateIds = ref<Set<string>>(new Set())
const comparisonDrawerOpen = ref(false)
const comparisonLoading = ref(false)
const comparisonValuations = ref<Record<string, QuantValuationSnapshot | null>>({})
const comparisonFinancials = ref<Record<string, QuantFinancialQualitySnapshot | null>>({})
const comparisonErrors = ref<Record<string, { valuation: boolean, financial: boolean }>>({})
const comparisonResearchRunning = ref(false)
const comparisonResearchStates = ref<Record<string, ComparisonResearchItemState>>({})
const researchFormStatus = ref<ResearchMarkerStatus>('unreviewed')
const researchFormNote = ref('')
const researchFormReviewDate = ref('')
const researchSaving = ref(false)
const researchSaveMessage = ref('')
const researchSaveError = ref<unknown | null>(null)
const selectedTsCode = ref<string | null>(null)
const watchCode = ref('')
const watchName = ref('')
const syncResult = ref<SyncResult | null>(null)
const detailDrawerOpen = ref(false)
const aiSettingsOpen = ref(false)
let valuationRequestId = 0
let financialRequestId = 0
let valueQualityRequestId = 0
let shareholderReturnRequestId = 0
let researchRunRequestId = 0
let researchSummaryRequestId = 0
const loading = reactive({
  watchlist: false,
  candidates: false,
  daily: false,
  valuation: false,
  financial: false,
  valueQuality: false,
  shareholderReturns: false,
  knowledge: false,
  research: false,
  sync: false,
})
const errors = reactive<Record<'watchlist' | 'candidates' | 'daily' | 'valuation' | 'financial' | 'valueQuality' | 'shareholderReturns' | 'knowledge' | 'research' | 'action', unknown | null>>({
  watchlist: null,
  candidates: null,
  daily: null,
  valuation: null,
  financial: null,
  valueQuality: null,
  shareholderReturns: null,
  knowledge: null,
  research: null,
  action: null,
})
const deletingCode = ref<string | null>(null)
const pendingDeleteCode = ref<string | null>(null)
const adding = ref(false)
const activeView = ref<QuantView>('overview')
const candidateFilter = ref<SelectionPresetKey>('balanced')
const candidateMinScore = ref(0)
const candidateCompleteOnly = ref(false)
const candidateSort = ref<CandidateSortKey>('researchPriority')
const candidateResearchStatus = ref<CandidateResearchStatus>('all')
const candidateReviewDue = ref<CandidateReviewFilter>('all')
const candidateFilterOptions = [
  { ...selectionPresets[0], icon: ShieldCheck },
  { ...selectionPresets[1], icon: ArrowUpRight },
  { ...selectionPresets[2], icon: ShieldAlert },
  { ...selectionPresets[3], icon: Filter },
]
const candidateSortOptions: { value: CandidateSortKey, label: string }[] = [
  { value: 'researchPriority', label: '研究优先' },
  { value: 'score', label: '信号分' },
  { value: 'return20', label: '20 日表现' },
  { value: 'volumeRatio', label: '成交活跃度' },
  { value: 'relativeStrength', label: '池内强度' },
  { value: 'valueQuality', label: '价值质量' },
  { value: 'evidenceScore', label: '证据就绪' },
]
const SIGNAL_RULE_COUNT = 6
const researchStatusOptions: { value: ResearchMarkerStatus, label: string }[] = [
  { value: 'unreviewed', label: '待研究' },
  { value: 'priority', label: '重点关注' },
  { value: 'paused', label: '暂缓' },
  { value: 'excluded', label: '已排除' },
]
const candidateResearchStatusOptions: { value: CandidateResearchStatus, label: string }[] = [
  { value: 'all', label: '全部状态' },
  ...researchStatusOptions,
]
const candidateReviewDueOptions: { value: CandidateReviewFilter, label: string }[] = [
  { value: 'all', label: '全部复查' },
  { value: 'overdue', label: '已逾期' },
  { value: 'today', label: '今日复查' },
  { value: 'upcoming', label: '近 7 日' },
]
const viewCopy: Record<QuantView, { eyebrow: string, title: string, subtitle: string }> = {
  overview: {
    eyebrow: 'STARYE / STOCK SELECTION',
    title: '择股工作台',
    subtitle: '先看统计和优先关注，再进入候选研究、观察池或因子框架。',
  },
  candidates: {
    eyebrow: 'RESEARCH CANDIDATES',
    title: '候选研究',
    subtitle: '用预设、数据完整度和研究状态缩小范围，再打开分析详情。',
  },
  watchlist: {
    eyebrow: 'WATCHLIST / DATA UPDATE',
    title: '观察池',
    subtitle: '维护关注标的并更新日线数据，观察池是所有比较的样本底座。',
  },
  knowledge: {
    eyebrow: 'INVESTMENT KNOWLEDGE',
    title: '投资因子框架',
    subtitle: '查看每个判断如何量化、哪些字段已接通，以及当前仍存在的数据缺口。',
  },
}

const selectedStock = computed(() => watchlist.value.find(item => item.tsCode === selectedTsCode.value) || null)
const candidateItems = computed(() => snapshot.value?.candidates || [])
const valueQualityMap = computed(() => new Map(valueSelection.value?.items.map(item => [item.tsCode, item]) || []))
const valueQualityResultsLoaded = computed(() => Boolean(valueSelection.value && !loading.valueQuality && !errors.valueQuality))
const candidateEvidenceMap = computed(() => new Map(candidateItems.value.map(item => [
  item.tsCode,
  buildCandidateEvidenceScore(item, valueQualityResultsLoaded.value ? valueQualityMap.value.get(item.tsCode) || null : undefined),
])))
const candidateEvidenceSummary = computed(() => {
  const summary = { ready: 0, partial: 0, missing: 0, unavailable: 0 }
  for (const result of candidateEvidenceMap.value.values())
    summary[result.status]++
  return summary
})
const activeCandidatePreset = computed(() => candidateFilterOptions.find(option => option.key === candidateFilter.value) || candidateFilterOptions[0])
const todayDate = computed(() => getTodayDate())
const filteredCandidateItems = computed(() => filterAndSortCandidates(candidateItems.value, {
  preset: candidateFilter.value,
  minScore: candidateMinScore.value,
  completeOnly: candidateCompleteOnly.value,
  sortBy: candidateSort.value,
  researchStatus: candidateResearchStatus.value,
  reviewDue: candidateReviewDue.value,
  valueQualityByCode: new Map(valueSelection.value?.items.map(item => [item.tsCode, item.score]) || []),
  valueQualityDetailsByCode: valueQualityResultsLoaded.value
    ? new Map<string, ResearchPriorityValueQuality | null>(candidateItems.value.map((item) => {
        const value = valueQualityMap.value.get(item.tsCode)
        return [item.tsCode, value
          ? {
              status: value.status,
              score: value.score,
              riskDeduction: value.riskDeduction,
            }
          : null]
      }))
    : undefined,
  evidenceScoreByCode: new Map(candidateItems.value.map(item => [item.tsCode, candidateEvidenceFor(item).score])),
}, new Map<string, CandidateResearchMetadata>(researchMarkers.value.map(marker => [marker.tsCode, {
  status: marker.status,
  reviewDate: marker.reviewDate,
}])), todayDate.value))
const candidateQueryActive = computed(() => candidateMinScore.value > 0 || candidateCompleteOnly.value || candidateSort.value !== 'researchPriority' || candidateResearchStatus.value !== 'all' || candidateReviewDue.value !== 'all')
const canSync = computed(() => Boolean(watchlist.value.length > 0 && !loading.sync))
const pageBusy = computed(() => loading.watchlist || loading.candidates)
const overallError = computed(() => errors.watchlist || errors.candidates || errors.research || errors.action)
const deleteDialogMessage = computed(() => pendingDeleteCode.value ? `确认从观察池移除 ${pendingDeleteCode.value}？` : '')
const latestDate = computed(() => {
  const dates = dailyBars.value.map(item => item.tradeDate).filter(Boolean)
  return formatTradeDate(dates.at(-1) || snapshot.value?.toDate || null)
})
const selectedCandidate = computed(() => candidateItems.value.find(item => item.tsCode === selectedTsCode.value) || null)
const selectedValueQuality = computed(() => valueQualityMap.value.get(selectedTsCode.value || '') || null)
const shareholderReturnMap = computed(() => new Map(shareholderReturns.value?.items.map(item => [item.tsCode, item]) || []))
const selectedShareholderReturn = computed(() => shareholderReturnMap.value.get(selectedTsCode.value || '') || null)
const latestResearchRun = computed(() => researchRuns.value[0] || null)
const latestResearchReport = computed(() => latestResearchRun.value?.report || null)
const researchEvidenceGroups = computed(() => {
  const report = latestResearchReport.value
  if (!report)
    return [] as { dimension: string, label: string, items: QuantResearchEvidence[] }[]
  const labels: Record<string, string> = {
    'trend': '趋势与价格',
    'valuation': '估值',
    'quality': '经营质量',
    'shareholder-return': '股东回报',
    'risk': '风险与波动',
  }
  const order = ['trend', 'valuation', 'quality', 'shareholder-return', 'risk']
  const groups = new Map<string, QuantResearchEvidence[]>()
  for (const item of report.evidence)
    groups.set(item.dimension, [...(groups.get(item.dimension) || []), item])
  const orderedGroups = order.flatMap(dimension => groups.has(dimension)
    ? [{ dimension, label: labels[dimension] || dimension, items: groups.get(dimension) || [] }]
    : [])
  const additionalGroups = [...groups.entries()]
    .filter(([dimension]) => !order.includes(dimension))
    .map(([dimension, items]) => ({ dimension, label: `其他证据 · ${dimension}`, items }))
  return [...orderedGroups, ...additionalGroups]
})
const previousResearchRun = computed(() => researchRuns.value[1] || null)
const researchEvidenceComparison = computed(() => buildResearchEvidenceComparison(latestResearchReport.value, previousResearchRun.value?.report || null))
const researchRunTimeline = computed(() => buildResearchRunTimeline(researchRuns.value))
const researchSummaryConfigurationError = computed(() => researchSummaryError.value instanceof QuantApiError && researchSummaryError.value.code === 'QUANT_AI_SUMMARY_CONFIGURATION')
const activeKnowledgeFactors = computed(() => investmentKnowledge.value?.factors.filter(factor => factor.status === 'active') || [])
const partialKnowledgeFactors = computed(() => investmentKnowledge.value?.factors.filter(factor => factor.status === 'partial') || [])
const plannedKnowledgeFactors = computed(() => investmentKnowledge.value?.factors.filter(factor => factor.status === 'planned' || factor.status === 'context') || [])
const mappedKnowledgeAliases = computed(() => investmentKnowledge.value?.aliases.filter(alias => alias.status === 'mapped') || [])
const contextKnowledgeAliases = computed(() => investmentKnowledge.value?.aliases.filter(alias => alias.status !== 'mapped') || [])
const researchMarkerMap = computed(() => new Map(researchMarkers.value.map(marker => [marker.tsCode, marker])))
const researchPriorityMap = computed<Map<string, ResearchPriority>>(() => new Map(candidateItems.value.map((item) => {
  const marker = researchMarkerMap.value.get(item.tsCode)
  return [item.tsCode, buildResearchPriority({
    candidate: item,
    metadata: marker ? { status: marker.status, reviewDate: marker.reviewDate } : undefined,
    valueQuality: valueQualityResultsLoaded.value ? valueQualityMap.value.get(item.tsCode) || null : undefined,
    today: todayDate.value,
  })]
})))
const researchReviewMap = computed(() => new Map(researchMarkers.value.map(marker => [marker.tsCode, getResearchReviewMeta(marker.reviewDate, todayDate.value)])))
const selectedResearchMarker = computed<QuantResearchMarker>(() => researchMarkerMap.value.get(selectedTsCode.value || '') || {
  tsCode: selectedTsCode.value || '',
  status: 'unreviewed',
  note: null,
  reviewDate: null,
  createdAt: null,
  updatedAt: null,
})
const selectedResearchReview = computed(() => researchReviewFor(selectedTsCode.value || ''))
const selectedCandidateItems = computed(() => candidateItems.value.filter(item => selectedCandidateIds.value.has(item.id)).slice(0, 3))
const canCompareCandidates = computed(() => selectedCandidateItems.value.length >= 2)
const comparisonStatusLabel = computed(() => comparisonLoading.value ? '正在读取估值与财务数据' : `${selectedCandidateItems.value.length} 只股票`)
const comparisonResearchSummary = computed(() => {
  const states = selectedCandidateItems.value.map(item => comparisonResearchStates.value[item.tsCode]?.status || 'idle')
  const success = states.filter(status => status === 'success').length
  const error = states.filter(status => status === 'error').length
  const running = states.filter(status => status === 'running').length
  const pending = states.filter(status => status === 'pending').length
  return {
    total: states.length,
    success,
    error,
    running,
    pending,
    completed: success + error,
    started: states.some(status => status !== 'idle'),
  }
})
const comparisonResearchButtonLabel = computed(() => comparisonResearchSummary.value.started ? '重新生成研究' : '批量生成研究')
const comparisonResearchSummaryLabel = computed(() => {
  const summary = comparisonResearchSummary.value
  if (!summary.started)
    return '尚未生成本批次研究报告'
  if (summary.running || summary.pending)
    return `已完成 ${summary.completed} / ${summary.total}，${summary.running + summary.pending} 项待完成`
  if (summary.error)
    return `已完成 ${summary.success} / ${summary.total}，${summary.error} 项失败`
  return `已完成 ${summary.success} / ${summary.total} 项`
})
const latestDailyBar = computed(() => dailyBars.value.at(-1) || null)
const latestWatchlistDate = computed(() => {
  const dates = watchlist.value.map(item => item.latestTradeDate).filter((date): date is string => Boolean(date))
  return formatTradeDate([...dates].sort().at(-1) || snapshot.value?.toDate || null)
})
const upCount = computed(() => watchlist.value.filter(item => item.latestChangePercent !== null && item.latestChangePercent >= 0).length)
const downCount = computed(() => watchlist.value.filter(item => item.latestChangePercent !== null && item.latestChangePercent < 0).length)
const signalCandidateCount = computed(() => candidateItems.value.filter(item => item.signals.length > 0).length)
const watchlistEnvironment = computed(() => buildWatchlistEnvironment({
  watchlist: watchlist.value,
  candidates: candidateItems.value,
}))
const dataCoverageCount = computed(() => watchlist.value.filter(item => item.barCount > 0 || item.latestTradeDate !== null).length)
const dataCoverageLabel = computed(() => watchlist.value.length ? `${dataCoverageCount.value} / ${watchlist.value.length}` : '--')
const activeViewCopy = computed(() => viewCopy[activeView.value])
const pendingCandidateCount = computed(() => candidateItems.value.filter(item => item.pendingSync).length)
const scannedCandidateCount = computed(() => candidateItems.value.length - pendingCandidateCount.value)
const topCandidates = computed(() => [...candidateItems.value]
  .sort((left, right) => compareResearchPriorities(candidatePriorityFor(left), candidatePriorityFor(right)))
  .slice(0, 3))
const researchPriorityQueueItems = computed(() => [...candidateItems.value]
  .map(item => ({ item, priority: candidatePriorityFor(item) }))
  .sort((left, right) => compareResearchPriorities(left.priority, right.priority) || left.item.tsCode.localeCompare(right.item.tsCode)))
const researchPriorityTotal = computed(() => researchPriorityQueueItems.value.length)
const visibleResearchPriorityQueue = computed(() => researchPriorityQueueItems.value.slice(0, 5))
const researchPrioritySummary = computed(() => summarizeResearchPriorities(researchPriorityQueueItems.value.map(item => item.priority)))
const researchPriorityHighestLabel = computed(() => visibleResearchPriorityQueue.value[0]?.priority.levelLabel || '暂无')
const hasValuationData = computed(() => Boolean(valuation.value && [
  valuation.value.dynamicPe,
  valuation.value.peTtm,
  valuation.value.peStatic,
  valuation.value.pb,
  valuation.value.ps,
  valuation.value.peg,
  valuation.value.marketCap,
].some(value => value !== null)))
const hasFinancialData = computed(() => Boolean(financialQuality.value && [
  financialQuality.value.revenue,
  financialQuality.value.revenueYoY,
  financialQuality.value.netProfit,
  financialQuality.value.netProfitYoY,
  financialQuality.value.roe,
  financialQuality.value.grossMargin,
  financialQuality.value.netMargin,
  financialQuality.value.debtAssetRatio,
  financialQuality.value.operatingCashflowToRevenue,
  financialQuality.value.operatingCashflowPerShare,
  financialQuality.value.fcffBack,
  financialQuality.value.fcffForward,
  financialQuality.value.interestCoverage,
  financialQuality.value.interestBearingDebtRatio,
  financialQuality.value.cashRatio,
  financialQuality.value.totalLiability,
  financialQuality.value.roic,
].some(value => value !== null)))

type FinancialTrendTone = 'positive' | 'negative' | 'neutral'
type FinancialTrendFormat = 'growth' | 'metric'

interface FinancialTrendItem {
  key: string
  label: string
  current: number | null
  delta: number | null
  format: FinancialTrendFormat
  tone: FinancialTrendTone
  state: string
}

function trendState(current: number | null, previous: number | null, inverse = false): { tone: FinancialTrendTone, state: string } {
  if (current === null || previous === null)
    return { tone: 'neutral', state: '暂无足够数据' }
  const delta = current - previous
  if (Math.abs(delta) < 1)
    return { tone: 'neutral', state: '基本稳定' }
  const improved = inverse ? delta < 0 : delta > 0
  return improved
    ? { tone: 'positive', state: '改善' }
    : { tone: 'negative', state: '走弱' }
}

const financialTrendItems = computed<FinancialTrendItem[]>(() => {
  const reports = financialHistory.value?.reports ?? []
  const latest = reports[0]
  const previous = reports[1]
  if (!latest || !previous)
    return []

  const entries = [
    { key: 'revenueYoY', label: '营收增速', current: latest.revenueYoY, previous: previous.revenueYoY, format: 'growth' as const },
    { key: 'netProfitYoY', label: '净利润增速', current: latest.netProfitYoY, previous: previous.netProfitYoY, format: 'growth' as const },
    { key: 'roe', label: 'ROE 回报', current: latest.roe, previous: previous.roe, format: 'metric' as const },
    { key: 'debtAssetRatio', label: '资产负债率', current: latest.debtAssetRatio, previous: previous.debtAssetRatio, format: 'metric' as const, inverse: true },
  ]

  return entries.map((entry) => {
    const state = trendState(entry.current, entry.previous, entry.inverse)
    return {
      key: entry.key,
      label: entry.label,
      current: entry.current,
      delta: entry.current !== null && entry.previous !== null ? entry.current - entry.previous : null,
      format: entry.format,
      tone: state.tone,
      state: state.state,
    }
  })
})

type RiskTone = 'neutral' | 'warning' | 'danger'

interface RiskNote {
  key: string
  tone: RiskTone
  title: string
  detail: string
}

const riskItems = computed<RiskNote[]>(() => {
  const items: RiskNote[] = []
  const incompleteCount = candidateItems.value.filter(item => item.quality !== 'ready').length
  const highVolumeCount = candidateItems.value.filter(item => item.volumeRatio !== null && item.volumeRatio >= 2).length
  const stretchedCount = candidateItems.value.filter(item => item.upStreak !== null && item.upStreak >= 5).length
  const pullbackCount = candidateItems.value.filter(item => item.changePercent !== null && item.changePercent <= -3).length

  if (!watchlist.value.length) {
    items.push({ key: 'empty-watchlist', tone: 'neutral', title: '观察池为空', detail: '加入股票后才会产生择股信号' })
  }
  if (watchlist.value.length > 0 && dataCoverageCount.value < watchlist.value.length) {
    items.push({ key: 'coverage', tone: 'warning', title: '部分标的还没有日线', detail: `${watchlist.value.length - dataCoverageCount.value} 只股票需要先更新数据` })
  }
  if (incompleteCount > 0) {
    items.push({ key: 'incomplete', tone: 'warning', title: '部分信号数据不完整', detail: `${incompleteCount} 只股票缺少计算所需的历史数据` })
  }
  if (pullbackCount > 0) {
    items.push({ key: 'pullback', tone: 'danger', title: '有短线回撤', detail: `${pullbackCount} 只候选最新日线跌幅达到 3%` })
  }
  if (highVolumeCount > 0) {
    items.push({ key: 'volume', tone: 'warning', title: '成交明显放大', detail: `${highVolumeCount} 只候选的成交活跃度达到 2 倍以上` })
  }
  if (stretchedCount > 0) {
    items.push({ key: 'stretched', tone: 'warning', title: '连续上涨较久', detail: `${stretchedCount} 只候选连续上涨达到 5 日，留意波动` })
  }
  if (!items.length) {
    items.push({ key: 'clear', tone: 'neutral', title: '暂未触发提示', detail: '风险提示只基于当前已保存的日线数据' })
  }
  return items.slice(0, 4)
})

const researchSummary = computed(() => buildResearchSummary({
  candidate: selectedCandidate.value,
  valuation: valuation.value,
  valuationComparison: valuationComparison.value,
  financial: financialQuality.value,
  financialComparison: financialComparison.value,
  trends: financialTrendItems.value,
  risks: riskItems.value,
}))

const watchlistColumns: Column<WatchlistItem>[] = [
  { key: 'tsCode', label: '代码', minWidth: '150px' },
  { key: 'name', label: '名称', minWidth: '130px', render: item => item.name || '名称待补齐' },
  { key: 'latestClose', label: '最新价', width: '92px', render: item => formatNumber(item.latestClose) },
  { key: 'latestChangePercent', label: '涨跌幅', width: '92px', render: item => formatPercent(item.latestChangePercent) },
  { key: 'latestTradeDate', label: '数据截至', width: '120px', render: item => formatTradeDate(item.latestTradeDate) },
  { key: 'barCount', label: '覆盖天数', width: '90px', render: item => String(item.barCount) },
  { key: 'actions', label: '操作', width: '80px', minWidth: '80px' },
]

const candidateColumns: Column<CandidateItem>[] = [
  { key: 'tsCode', label: '代码', minWidth: '115px' },
  { key: 'name', label: '名称', minWidth: '100px', render: item => displayStockName(item) },
  { key: 'priority', label: '研究优先', width: '104px', minWidth: '98px' },
  { key: 'score', label: '信号分', width: '78px', render: item => formatNumber(item.score) },
  { key: 'persistence', label: '信号持续', width: '118px', minWidth: '110px' },
  { key: 'return20', label: '20日表现', width: '86px', render: item => formatPercent(item.return20) },
  { key: 'ma20', label: '20日均线', width: '88px', render: item => formatNumber(item.ma20) },
  { key: 'volumeRatio', label: '成交活跃度', width: '98px', render: item => formatNumber(item.volumeRatio) },
  { key: 'relativeStrength', label: '池内强度', width: '88px', render: item => formatNumber(item.relativeStrength) },
  { key: 'valueQuality', label: '价值质量', width: '124px', minWidth: '116px' },
  { key: 'evidence', label: '证据就绪', width: '128px', minWidth: '120px' },
  { key: 'review', label: '复查', width: '100px', minWidth: '94px' },
  { key: 'action', label: '研究动作', width: '112px', minWidth: '106px' },
  { key: 'signals', label: '信号', width: '240px', minWidth: '220px' },
]

const dailyColumns: Column<DailyBar>[] = [
  { key: 'tradeDate', label: '交易日', width: '120px' },
  { key: 'open', label: '开盘', width: '84px', render: item => formatNumber(item.open) },
  { key: 'high', label: '最高', width: '84px', render: item => formatNumber(item.high) },
  { key: 'low', label: '最低', width: '84px', render: item => formatNumber(item.low) },
  { key: 'close', label: '收盘', width: '84px', render: item => formatNumber(item.close) },
  { key: 'changePercent', label: '涨跌幅', width: '92px', render: item => formatPercent(item.changePercent) },
  { key: 'volume', label: '成交量', width: '110px', render: item => formatCompact(item.volume) },
  { key: 'amount', label: '成交额', width: '110px', render: item => formatCompact(item.amount) },
]

const chartBars = computed(() => {
  const values = dailyBars.value.slice(-42).filter(item => item.close !== null)
  if (!values.length)
    return []
  const closes = values.map(item => item.close as number)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = max - min || 1
  return values.map((item) => {
    const close = item.close as number
    return {
      date: item.tradeDate,
      height: 16 + ((close - min) / span) * 84,
      positive: item.changePercent === null || item.changePercent >= 0,
      close,
    }
  })
})

const trendStructure = computed(() => buildTrendStructure(dailyBars.value))
const timingWindow = computed(() => buildTimingWindow(dailyBars.value, trendStructure.value))
const timingHistory = computed(() => buildTimingHistory(dailyBars.value))
const timingHistoryCurrentBucket = computed(() => timingHistory.value.buckets.find(bucket => bucket.state === timingHistory.value.currentState) || null)
const decisionEvidence = computed(() => buildDecisionEvidence({
  candidate: selectedCandidate.value,
  trend: trendStructure.value,
  latestTradeDate: latestDailyBar.value?.tradeDate ?? selectedStock.value?.latestTradeDate ?? null,
  valuation: valuation.value,
  valuationComparison: valuationComparison.value,
  financial: financialQuality.value,
  financialHistory: financialHistory.value,
  valueQuality: selectedValueQuality.value,
  shareholderReturn: selectedShareholderReturn.value,
}))

function formatNumber(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function formatSignalScore(value: number | null): string {
  return value === null ? '--' : `${value} / ${SIGNAL_RULE_COUNT}`
}

const EMPTY_SIGNAL_PERSISTENCE: CandidateSignalPersistence = {
  sampleSize: 0,
  appearanceCount: 0,
  persistenceRate: null,
  latestScore: null,
  previousScore: null,
  scoreDelta: null,
  scoreChange: null,
  state: 'insufficient_history',
  factorPersistence: [],
  evidence: [],
}

function candidatePersistenceFor(item: CandidateItem | null): CandidateSignalPersistence {
  return item?.persistence || EMPTY_SIGNAL_PERSISTENCE
}

function candidatePersistenceLabel(item: CandidateItem | null): string {
  return {
    first_seen: '首次出现',
    confirming: '持续确认',
    weakening: '信号减弱',
    not_in_latest: '未进最新',
    insufficient_history: '历史不足',
  }[candidatePersistenceFor(item).state]
}

function candidatePersistenceClass(item: CandidateItem | null): string {
  return `candidate-persistence-${candidatePersistenceFor(item).state}`
}

function formatPersistenceRate(value: number | null): string {
  return value === null ? '--' : `${Math.round(value * 100)}%`
}

function formatScoreDelta(value: number | null): string {
  return value === null ? '--' : `${value >= 0 ? '+' : ''}${value}`
}

function scoreDeltaClass(value: number | null): string {
  return value === null ? 'text-status-neutral' : value >= 0 ? 'text-status-success' : 'text-status-danger'
}

function candidatePersistenceDetail(item: CandidateItem | null): string {
  const persistence = candidatePersistenceFor(item)
  if (persistence.state === 'not_in_latest')
    return `最近 ${persistence.sampleSize} 次快照中当前未进入最新一次，请先更新观察池数据`
  if (persistence.state === 'insufficient_history')
    return `已记录 ${persistence.sampleSize} 次快照，样本不足以判断信号方向`
  return `最近 ${persistence.sampleSize} 次出现 ${persistence.appearanceCount} 次 · 相邻分数 ${formatScoreDelta(persistence.scoreDelta)} · 出现比例 ${formatPersistenceRate(persistence.persistenceRate)}`
}

function signalScorePercent(value: number | null): number {
  if (value === null)
    return 0
  return Math.min(100, Math.max(0, (value / SIGNAL_RULE_COUNT) * 100))
}

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function environmentStatusClass(status: WatchlistEnvironmentStatus): string {
  return `environment-status-${status}`
}

function formatEnvironmentRatio(value: number | null): string {
  return value === null ? '--' : `${Math.round(value * 100)}%`
}

function formatMetricPercent(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(2)}%`
}

function formatTrendDelta(value: number | null): string {
  return value === null ? '需要至少两期数据' : `${value >= 0 ? '+' : ''}${value.toFixed(1)} 个百分点`
}

function formatCompact(value: number | null): string {
  if (value === null)
    return '--'
  if (Math.abs(value) >= 10000)
    return `${(value / 10000).toFixed(1)}万`
  return value.toFixed(0)
}

function formatMarketCap(value: number | null): string {
  if (value === null)
    return '--'
  if (Math.abs(value) >= 1000000000000)
    return `${(value / 1000000000000).toFixed(2)} 万亿`
  if (Math.abs(value) >= 100000000)
    return `${(value / 100000000).toFixed(2)} 亿`
  return value.toFixed(0)
}

function formatFinancialAmount(value: number | null): string {
  if (value === null)
    return '--'
  if (Math.abs(value) >= 1000000000000)
    return `${(value / 1000000000000).toFixed(2)} 万亿`
  if (Math.abs(value) >= 100000000)
    return `${(value / 100000000).toFixed(2)} 亿`
  if (Math.abs(value) >= 10000)
    return `${(value / 10000).toFixed(2)} 万`
  return value.toFixed(0)
}

function formatRatioPercent(value: number | null): string {
  return value === null ? '--' : `${(value * 100).toFixed(2)}%`
}

function formatMultiple(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(2)}x`
}

function formatDividendYield(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(2)}%`
}

function decisionEvidenceStatusLabel(status: DecisionEvidenceStatus): string {
  return { pass: '通过', caution: '注意', fail: '未通过', missing: '数据不足' }[status]
}

function decisionEvidenceStatusClass(status: DecisionEvidenceStatus): string {
  return `decision-evidence-status-${status}`
}

function decisionEvidenceActionClass(action: string): string {
  return `decision-evidence-action-${action}`
}

function researchRunStatusLabel(status: QuantResearchRun['status']): string {
  return { ready: '证据完整', partial: '部分可用', insufficient_data: '数据不足' }[status]
}

function researchRunStatusClass(status: QuantResearchRun['status']): string {
  return `research-run-status-${status}`
}

function researchRunActionLabel(action: QuantResearchRun['report']['action']): string {
  return {
    'research-window': '进入研究窗口',
    'wait-confirmation': '等待确认',
    'reassess': '重新评估',
    'complete-data': '补齐数据',
  }[action]
}

function researchEvidenceStatusLabel(status: QuantResearchEvidence['status']): string {
  return { pass: '通过', caution: '注意', fail: '未通过', missing: '数据不足' }[status]
}

function researchEvidenceStatusClass(status: QuantResearchEvidence['status']): string {
  return `research-run-evidence-${status}`
}

function formatResearchEvidenceValue(item: QuantResearchEvidence): string {
  if (item.value === null)
    return '--'
  if (item.key === 'trend-sample')
    return `${item.value.toFixed(0)} 根`
  if (item.key === 'risk-volume')
    return `${item.value.toFixed(2)} 倍`
  if (item.key === 'risk-streak')
    return `${item.value.toFixed(0)} 天`
  if (item.key === 'quality-history')
    return `${item.value.toFixed(0)} 期`
  if (item.key === 'akshare-daily-sample')
    return `${item.value.toFixed(0)} 根`
  if (item.key === 'akshare-financial-sample')
    return `${item.value.toFixed(0)} 期`
  if (item.key === 'quality-cashflow')
    return `${(item.value * 100).toFixed(2)}%`
  if (item.key.startsWith('trend-') || item.key.startsWith('quality-') || item.key.startsWith('akshare-') || item.key === 'shareholder-yield')
    return `${item.value.toFixed(2)}%`
  return item.value.toFixed(2)
}

function researchEvidenceChangeClass(kind: ResearchEvidenceChange['kind']): string {
  return `research-evidence-change-${kind}`
}

function formatResearchEvidenceDelta(change: ResearchEvidenceChange): string {
  if (change.valueDelta === null)
    return '--'
  const evidence = change.current || change.previous
  if (!evidence)
    return '--'
  const value = evidence.key === 'quality-cashflow' ? change.valueDelta * 100 : change.valueDelta
  const prefix = value > 0 ? '+' : ''
  if (evidence.key === 'trend-sample' || evidence.key === 'akshare-daily-sample')
    return `${prefix}${value.toFixed(0)} 根`
  if (evidence.key === 'quality-history' || evidence.key === 'akshare-financial-sample')
    return `${prefix}${value.toFixed(0)} 期`
  if (evidence.key === 'risk-volume')
    return `${prefix}${value.toFixed(2)} 倍`
  if (evidence.key === 'risk-streak')
    return `${prefix}${value.toFixed(0)} 天`
  if (evidence.key.startsWith('trend-') || evidence.key.startsWith('quality-') || evidence.key.startsWith('akshare-') || evidence.key === 'shareholder-yield')
    return `${prefix}${value.toFixed(2)}%`
  return `${prefix}${value.toFixed(2)}`
}

function researchEvidenceHistoryValue(change: ResearchEvidenceChange, current: boolean): string {
  const item = current ? change.current : change.previous
  return item ? formatResearchEvidenceValue(item) : '--'
}

function researchEvidenceHistoryStatus(change: ResearchEvidenceChange, current: boolean): string {
  const item = current ? change.current : change.previous
  return item ? researchEvidenceStatusLabel(item.status) : current ? '本次未返回' : '无历史记录'
}

function researchRunTimelineScoreClass(direction: ResearchRunScoreDirection): string {
  return `research-run-timeline-score-${direction}`
}

function formatResearchRunTimelineScore(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(1)} / 100`
}

function formatResearchRunTimelineDelta(value: number | null, direction: ResearchRunScoreDirection = 'none'): string {
  if (value === null)
    return '不可比较'
  const label = { up: '上升', down: '下降', flat: '持平', none: '变化' }[direction]
  return `${label} ${value > 0 ? '+' : ''}${value.toFixed(1)} 分`
}

function formatResearchRunSourceDate(value: string | null): string {
  if (!value)
    return '未记录'
  return value.length === 8 ? formatTradeDate(value) : formatDateTime(value)
}

function timingWindowClass(window: TimingWindow): string {
  return `timing-window-${window.tone}`
}

function timingWindowMetricClass(status: TimingWindowMetricStatus): string {
  return `timing-window-metric-${status}`
}

function timingWindowMetricStatusLabel(status: TimingWindowMetricStatus): string {
  return { pass: '通过', caution: '注意', fail: '偏弱', missing: '数据不足' }[status]
}

function formatTimingWindowMetric(metric: TimingWindow['metrics'][number]): string {
  if (metric.value === null)
    return '--'
  const value = `${Math.abs(metric.value * 100).toFixed(2)}%`
  if (metric.key === 'volatility20')
    return value
  return `${metric.value >= 0 ? '+' : '-'}${value}`
}

function timingHistoryStateClass(state: TimingWindowState): string {
  return `timing-history-state-${state}`
}

function formatTimingHistoryRate(value: number | null): string {
  return value === null ? '--' : `${Math.round(value * 100)}%`
}

function formatTimingHistoryPercent(value: number | null): string {
  return value === null ? '--' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

function timingHistoryBucketTitle(bucket: TimingHistoryBucket): string {
  return `${bucket.label}：${bucket.sampleSize} 个历史截点，未来 20 日上涨比例 ${formatTimingHistoryRate(bucket.positiveRate)}`
}

function formatEvidenceDate(value: string | null): string {
  return value ? formatTradeDate(value) : '未记录'
}

function shareholderReturnStatusLabel(item: QuantShareholderReturnItem | null): string {
  if (!item)
    return loading.shareholderReturns ? '读取中' : '暂无数据'
  if (item.status === 'ready')
    return '已接通'
  if (item.status === 'partial')
    return '部分数据'
  return '数据不足'
}

function shareholderReturnStatusClass(item: QuantShareholderReturnItem | null): string {
  if (!item || item.status === 'insufficient_data')
    return 'value-quality-status-muted'
  return item.status === 'ready' ? 'value-quality-status-ready' : 'value-quality-status-partial'
}

function formatComparisonPosition(value: number | null): string {
  return value === null ? '暂无足够样本' : `高于观察池 ${value}%`
}

function valueQualityFor(tsCode: string): QuantValueQualityItem | null {
  return valueQualityMap.value.get(tsCode) || null
}

function valueQualityStatusLabel(item: QuantValueQualityItem | null): string {
  if (!item)
    return loading.valueQuality ? '读取中' : '暂无评分'
  if (item.status === 'ready')
    return '可比较'
  if (item.status === 'partial')
    return '部分数据'
  return '数据不足'
}

function valueQualityStatusClass(item: QuantValueQualityItem | null): string {
  if (!item || item.status === 'insufficient_data')
    return 'value-quality-status-muted'
  return item.status === 'ready' ? 'value-quality-status-ready' : 'value-quality-status-partial'
}

function formatValueQualityScore(item: QuantValueQualityItem | null): string {
  return item?.score === null || item?.score === undefined ? '--' : `${item.score.toFixed(1)} / 100`
}

function valueQualityDimension(item: QuantValueQualityItem | null, key: QuantValueQualityDimension['key']): QuantValueQualityDimension | null {
  return item?.dimensions.find(dimension => dimension.key === key) || null
}

function formatValueQualityDimension(item: QuantValueQualityItem | null, key: QuantValueQualityDimension['key']): string {
  const dimension = valueQualityDimension(item, key)
  return dimension?.score === null || dimension?.score === undefined ? '--' : `${dimension.score.toFixed(1)} / ${dimension.maxScore}`
}

function valueQualityDimensionSamples(dimension: QuantValueQualityDimension): number {
  return dimension.metrics.reduce((maximum, metric) => Math.max(maximum, metric.sampleCount), 0)
}

function valueQualitySummary(item: QuantValueQualityItem | null): string {
  if (!item)
    return loading.valueQuality ? '正在读取观察池估值、财务和长期趋势' : '完成日线更新后读取价值质量'
  if (item.status === 'ready')
    return `报告期 ${formatTradeDate(item.financialReportDate)} · 观察 ${formatDateTime(item.observedAt)}`
  return item.missingFields[0] || '关键数据尚未齐全'
}

function candidateEvidenceFor(item: CandidateItem): CandidateEvidenceScore {
  return candidateEvidenceMap.value.get(item.tsCode) || buildCandidateEvidenceScore(item, valueQualityResultsLoaded.value ? valueQualityMap.value.get(item.tsCode) || null : undefined)
}

function candidateEvidenceStatusLabel(item: CandidateEvidenceScore): string {
  if (item.status === 'ready')
    return '证据充分'
  if (item.status === 'partial')
    return '部分覆盖'
  if (item.status === 'missing')
    return '待补证据'
  if (loading.valueQuality)
    return '读取中'
  if (errors.valueQuality)
    return '暂不可用'
  return '待加载'
}

function candidateEvidenceStatusClass(item: CandidateEvidenceScore): string {
  return `candidate-evidence-status-${item.status}`
}

function formatCandidateEvidenceScore(item: CandidateEvidenceScore): string {
  return item.score === null ? '--' : `${item.score} / 100`
}

function candidateEvidenceCoverage(item: CandidateEvidenceScore): string {
  return item.score === null ? '--' : `${item.coveredMetricCount} / ${item.totalMetricCount} 字段`
}

function candidateEvidenceDetail(item: CandidateItem): string {
  const result = candidateEvidenceFor(item)
  const reason = result.missingReasons[0]
  return reason ? `${result.summary} · ${reason}` : result.summary
}

function knowledgeStatusLabel(status: QuantKnowledgeFactor['status']): string {
  return {
    active: '已进入评分',
    partial: '部分接通',
    planned: '待接数据',
    context: '知识参考',
  }[status]
}

function knowledgeStatusClass(status: QuantKnowledgeFactor['status']): string {
  return `knowledge-status-${status}`
}

function knowledgeFieldLabel(field: string): string {
  return {
    peTtm: 'TTM PE',
    pb: 'PB',
    ps: 'PS',
    peg: 'PEG',
    netProfitYoY: '净利润同比',
    adjustedNetProfitYoY: '扣非净利润同比',
    operatingCashflowToRevenue: '经营现金流 / 营收',
    roe: 'ROE',
    roic: 'ROIC',
    grossMargin: '毛利率',
    netMargin: '净利率',
    debtAssetRatio: '资产负债率',
    operatingCashflowPerShare: '经营现金流 / 股',
    fcffBack: 'FCFF（历史）',
    fcffForward: 'FCFF（前瞻）',
    interestCoverage: '利息覆盖倍数',
    interestBearingDebtRatio: '带息负债率',
    cashRatio: '现金比率',
    totalLiability: '负债规模',
    revenueYoY: '营收同比',
    reportDate: '报告期',
    dailyBars: '日线',
    return60: '60 日表现',
    ma60Gap: '距 60 日均线',
    drawdown60: '60 日回撤',
    operatingCashflow: '经营现金流',
    capitalExpenditure: '资本开支',
    interestExpense: '利息支出',
    interestBearingDebt: '有息负债',
    orderBacklog: '订单金额',
    contractLiabilities: '合同负债',
    segmentRevenue: '分部收入',
    segmentGrossMargin: '分部毛利率',
    volume: '销量',
    realizedPrice: '实现价格',
    commodityPrice: '商品价格',
    unitCost: '单位成本',
    output: '产量',
    longTermContractRatio: '长协比例',
    dividendYield: '股息率',
    payoutRatio: '分红支付率',
    freeCashflow: '自由现金流',
    buybackAmount: '回购金额',
    sharesOutstandingChange: '股本变化',
    industry: '行业分类',
    industryProfitYoY: '行业利润同比',
    industryIndexReturn: '行业指数表现',
    companyProfitYoY: '公司利润同比',
    consensusRevenue: '一致预期营收',
    consensusProfit: '一致预期利润',
    earningsSurprise: '业绩超预期',
    forwardPe: '前瞻 PE',
    priceBeforeReport: '报告前价格',
    cash: '现金',
    profitVolatility: '利润波动',
  }[field] || field
}

function formatKnowledgeFields(fields: readonly string[]): string {
  return fields.map(knowledgeFieldLabel).join('、')
}

function knowledgeAliasStatusLabel(status: 'mapped' | 'ambiguous' | 'context_only'): string {
  return {
    mapped: '已映射',
    ambiguous: '待确认',
    context_only: '跨市场 / 语境样本',
  }[status]
}

function knowledgeConfidenceLabel(confidence: 'high' | 'medium' | 'low'): string {
  return { high: '高置信度', medium: '中置信度', low: '低置信度' }[confidence]
}

function formatLowerComparisonPosition(value: number | null): string {
  return value === null ? '暂无足够样本' : `低于观察池 ${value}%`
}

function formatDateTime(value: string | null): string {
  if (!value)
    return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatTradeDate(value: string | null): string {
  if (!value)
    return '--'
  if (/^\d{8}$/.test(value))
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
  return value
}

function formatFactorLabel(value: string): string {
  return {
    ma5: '短线趋势',
    ma20: '站上 20 日均线',
    new_high_20: '20 日新高',
    continuation: '连续上涨',
    volume_ratio: '成交放大',
    relative_strength: '池内更强',
  }[value] || value
}

function displayStockName(item: Pick<CandidateItem, 'tsCode' | 'name'>): string {
  return item.name || watchlist.value.find(stock => stock.tsCode === item.tsCode)?.name || '名称待补齐'
}

function candidatePriorityFor(item: CandidateItem): ResearchPriority {
  return researchPriorityMap.value.get(item.tsCode) || buildResearchPriority({
    candidate: item,
    metadata: researchMarkerMap.value.get(item.tsCode),
    valueQuality: valueQualityResultsLoaded.value ? valueQualityMap.value.get(item.tsCode) || null : undefined,
    today: todayDate.value,
  })
}

function researchPriorityDetail(item: CandidateItem): string {
  const priority = candidatePriorityFor(item)
  return `${priority.reasons.join('；')} · 研究优先级 ${priority.score} 分`
}

function researchPriorityClass(item: CandidateItem): string {
  return `research-priority-${candidatePriorityFor(item).level}`
}

function researchPriorityActionClass(item: CandidateItem): string {
  return `research-priority-action-${candidatePriorityFor(item).tone}`
}

function researchReviewFor(tsCode: string): ResearchReviewMeta {
  return researchReviewMap.value.get(tsCode) || getResearchReviewMeta(null, todayDate.value)
}

function parsedError(error: unknown): ParsedError {
  let type: ErrorType = 'unknown'
  let statusCode: number | undefined
  if (error instanceof QuantApiError) {
    statusCode = error.status
    if (error.status === 401 || error.status === 403)
      type = 'permission'
    else if (error.status === 400 || error.status === 409 || error.status === 422)
      type = 'validation'
    else if (error.status >= 500)
      type = 'server'
  }
  else if (error instanceof TypeError) {
    type = 'network'
  }
  return {
    type,
    message: error instanceof Error ? error.message : '量化数据加载失败',
    originalError: error,
    statusCode,
  }
}

function valuationErrorMessage(error: unknown): string {
  if (error instanceof QuantApiError) {
    switch (error.code) {
      case 'QUANT_PROVIDER_TIMEOUT':
        return '估值请求超时，数据源没有及时返回'
      case 'QUANT_PROVIDER_INVALID_RESPONSE':
        return '数据源返回的估值格式不完整'
      case 'QUANT_PROVIDER_QUOTA':
        return '数据源配额暂时不可用'
      case 'QUANT_PROVIDER_CONFIGURATION':
        return '估值数据源尚未配置'
      case 'QUANT_PROVIDER_UPSTREAM':
        return '估值数据源暂时不可达'
      default:
        return error.message || '估值请求失败'
    }
  }
  if (error instanceof TypeError)
    return '网络连接异常'
  return '估值请求失败，请稍后重试'
}

function statusLabel(status: SyncStatus): string {
  return { completed: '已完成', partial: '部分完成', rejected: '已拒绝' }[status]
}

function syncStatusClass(status: SyncStatus): string {
  return {
    completed: 'status-enabled',
    partial: 'status-partial',
    rejected: 'status-disabled',
  }[status]
}

function focusSignal(item: CandidateItem): string {
  return candidatePriorityFor(item).actionLabel
}

function focusTone(item: CandidateItem): string {
  const tone = candidatePriorityFor(item).tone
  if (tone === 'warning' || tone === 'danger')
    return 'focus-tone-warning'
  return tone === 'positive' ? 'focus-tone-positive' : 'focus-tone-neutral'
}

function riskLabel(item: CandidateItem): string {
  if (item.quality !== 'ready')
    return '数据不完整'
  if (item.changePercent !== null && item.changePercent <= -3)
    return '短线回撤'
  if (item.upStreak !== null && item.upStreak >= 5)
    return '连续上涨，留意波动'
  if (item.volumeRatio !== null && item.volumeRatio >= 2)
    return '成交放大，波动偏高'
  return '暂未触发提示'
}

function candidateRiskTone(item: CandidateItem): RiskTone {
  if (item.quality !== 'ready')
    return 'warning'
  if (item.changePercent !== null && item.changePercent <= -3)
    return 'danger'
  if (item.upStreak !== null && item.upStreak >= 5)
    return 'warning'
  if (item.volumeRatio !== null && item.volumeRatio >= 2)
    return 'warning'
  return 'neutral'
}

function riskToneClass(tone: RiskTone): string {
  return `risk-note-${tone}`
}

function resetCandidateQuery(): void {
  candidateMinScore.value = 0
  candidateCompleteOnly.value = false
  candidateSort.value = 'researchPriority'
  candidateResearchStatus.value = 'all'
  candidateReviewDue.value = 'all'
}

async function loadWatchlist() {
  loading.watchlist = true
  errors.watchlist = null
  valueQualityRequestId++
  try {
    watchlist.value = await quantApi.getWatchlist()
    if (!selectedTsCode.value || !watchlist.value.some(item => item.tsCode === selectedTsCode.value))
      selectedTsCode.value = watchlist.value[0]?.tsCode || null
    detailDrawerOpen.value = false
    valuationRequestId++
    financialRequestId++
    dailyBars.value = []
    valuationComparison.value = null
    valuationComparisonError.value = null
    valuation.value = null
    financialQuality.value = null
    financialHistory.value = null
    financialComparison.value = null
    financialComparisonError.value = null
    valueSelection.value = null
    errors.valueQuality = null
    shareholderReturnRequestId++
    shareholderReturns.value = null
    errors.shareholderReturns = null
    researchRunRequestId++
    researchRuns.value = []
    researchRunError.value = null
    researchSummaryRequestId++
    researchAiSummary.value = null
    researchSummaryError.value = null
    researchSummaryLoading.value = false
    researchSummaryGenerating.value = false
    loading.valuation = false
    loading.financial = false
  }
  catch (error) {
    errors.watchlist = error
  }
  finally {
    loading.watchlist = false
  }
}

async function loadCandidates() {
  loading.candidates = true
  errors.candidates = null
  try {
    snapshot.value = await quantApi.getCandidates()
    const candidateIds = new Set(candidateItems.value.map(item => item.id))
    selectedCandidateIds.value = new Set([...selectedCandidateIds.value].filter(id => candidateIds.has(id)))
  }
  catch (error) {
    errors.candidates = error
  }
  finally {
    loading.candidates = false
  }
}

async function loadValueSelection() {
  const requestId = ++valueQualityRequestId
  loading.valueQuality = true
  errors.valueQuality = null
  try {
    const result = await quantApi.getValueSelection()
    if (requestId === valueQualityRequestId)
      valueSelection.value = result
  }
  catch (error) {
    if (requestId === valueQualityRequestId) {
      errors.valueQuality = error
      valueSelection.value = null
    }
  }
  finally {
    if (requestId === valueQualityRequestId)
      loading.valueQuality = false
  }
}

async function loadShareholderReturns() {
  const requestId = ++shareholderReturnRequestId
  loading.shareholderReturns = true
  errors.shareholderReturns = null
  try {
    const result = await quantApi.getShareholderReturns()
    if (requestId === shareholderReturnRequestId)
      shareholderReturns.value = result
  }
  catch (error) {
    if (requestId === shareholderReturnRequestId) {
      errors.shareholderReturns = error
      shareholderReturns.value = null
    }
  }
  finally {
    if (requestId === shareholderReturnRequestId)
      loading.shareholderReturns = false
  }
}

async function loadInvestmentKnowledge() {
  loading.knowledge = true
  errors.knowledge = null
  try {
    investmentKnowledge.value = await quantApi.getInvestmentKnowledge()
  }
  catch (error) {
    errors.knowledge = error
    investmentKnowledge.value = null
  }
  finally {
    loading.knowledge = false
  }
}

async function loadResearchMarkers() {
  loading.research = true
  errors.research = null
  try {
    researchMarkers.value = await quantApi.getResearchMarkers()
  }
  catch (error) {
    errors.research = error
  }
  finally {
    loading.research = false
  }
}

async function loadResearchRuns(tsCode: string) {
  const requestId = ++researchRunRequestId
  researchSummaryRequestId++
  researchAiSummary.value = null
  researchSummaryError.value = null
  researchSummaryLoading.value = false
  researchSummaryGenerating.value = false
  researchRunLoading.value = true
  researchRunError.value = null
  try {
    const runs = await quantApi.getResearchRuns(tsCode)
    if (requestId === researchRunRequestId) {
      researchRuns.value = runs
      if (runs[0])
        await loadResearchSummary(runs[0].id)
    }
  }
  catch (error) {
    if (requestId === researchRunRequestId) {
      researchRunError.value = error
      researchRuns.value = []
    }
  }
  finally {
    if (requestId === researchRunRequestId)
      researchRunLoading.value = false
  }
}

async function loadResearchSummary(runId: string) {
  const requestId = ++researchSummaryRequestId
  researchSummaryLoading.value = true
  researchSummaryError.value = null
  try {
    const summaries = await quantApi.getResearchSummaries(runId, 1)
    if (requestId === researchSummaryRequestId)
      researchAiSummary.value = summaries[0] || null
  }
  catch (error) {
    if (requestId === researchSummaryRequestId) {
      researchSummaryError.value = error
      researchAiSummary.value = null
    }
  }
  finally {
    if (requestId === researchSummaryRequestId)
      researchSummaryLoading.value = false
  }
}

async function generateResearchReport() {
  if (!selectedStock.value || researchRunGenerating.value)
    return
  researchRunGenerating.value = true
  researchRunError.value = null
  try {
    const run = await quantApi.generateResearchRun(selectedStock.value.tsCode)
    researchRuns.value = [run, ...researchRuns.value.filter(item => item.id !== run.id)].slice(0, 5)
    researchSummaryRequestId++
    researchAiSummary.value = null
    researchSummaryError.value = null
    await loadResearchSummary(run.id)
  }
  catch (error) {
    researchRunError.value = error
  }
  finally {
    researchRunGenerating.value = false
  }
}

async function generateResearchSummary() {
  const run = latestResearchRun.value
  if (!run || researchSummaryGenerating.value)
    return
  const requestId = ++researchSummaryRequestId
  researchSummaryGenerating.value = true
  researchSummaryError.value = null
  try {
    const summary = await quantApi.generateResearchSummary(run.id)
    if (requestId === researchSummaryRequestId)
      researchAiSummary.value = summary
  }
  catch (error) {
    if (requestId === researchSummaryRequestId)
      researchSummaryError.value = error
  }
  finally {
    researchSummaryGenerating.value = false
  }
}

function downloadResearchReport() {
  const run = latestResearchRun.value
  if (!run)
    return

  const blob = new Blob([buildResearchReportMarkdown(run, researchAiSummary.value)], { type: 'text/markdown;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = buildResearchReportFilename(run)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

async function loadDailyBars(tsCode: string) {
  loading.daily = true
  errors.daily = null
  try {
    dailyBars.value = await quantApi.getDailyBars(tsCode, { limit: 120 })
  }
  catch (error) {
    errors.daily = error
    dailyBars.value = []
  }
  finally {
    loading.daily = false
  }
}

async function loadValuation(tsCode: string) {
  const requestId = ++valuationRequestId
  loading.valuation = true
  errors.valuation = null
  valuationComparison.value = null
  valuationComparisonError.value = null
  valuation.value = null
  const [targetResult, comparisonResult] = await Promise.allSettled([
    quantApi.getValuation(tsCode),
    quantApi.getValuationComparison(tsCode),
  ])
  if (requestId === valuationRequestId) {
    if (targetResult.status === 'fulfilled')
      valuation.value = targetResult.value
    else
      errors.valuation = targetResult.reason
    if (comparisonResult.status === 'fulfilled')
      valuationComparison.value = comparisonResult.value
    else
      valuationComparisonError.value = comparisonResult.reason
    loading.valuation = false
  }
}

async function loadFinancialQuality(tsCode: string) {
  const requestId = ++financialRequestId
  loading.financial = true
  errors.financial = null
  financialComparisonError.value = null
  financialQuality.value = null
  financialHistory.value = null
  financialComparison.value = null
  try {
    const [historyResult, comparisonResult] = await Promise.allSettled([
      quantApi.getFinancialQualityHistory(tsCode),
      quantApi.getFinancialQualityComparison(tsCode),
    ])
    if (requestId !== financialRequestId)
      return

    if (historyResult.status === 'fulfilled') {
      financialHistory.value = historyResult.value
      financialQuality.value = historyResult.value.reports[0] ?? null
    }
    else {
      errors.financial = historyResult.reason
    }

    if (comparisonResult.status === 'fulfilled') {
      financialComparison.value = comparisonResult.value
      if (!financialQuality.value)
        financialQuality.value = comparisonResult.value.target
    }
    else {
      financialComparisonError.value = comparisonResult.reason
    }

    if (historyResult.status === 'rejected' && comparisonResult.status === 'rejected')
      errors.financial = historyResult.reason
  }
  finally {
    if (requestId === financialRequestId)
      loading.financial = false
  }
}

function syncResearchForm(tsCode: string) {
  const marker = researchMarkerMap.value.get(tsCode)
  researchFormStatus.value = marker?.status || 'unreviewed'
  researchFormNote.value = marker?.note || ''
  researchFormReviewDate.value = marker?.reviewDate || ''
  researchSaveMessage.value = ''
  researchSaveError.value = null
}

async function saveResearchMarker() {
  if (!selectedStock.value || researchSaving.value)
    return
  researchSaving.value = true
  researchSaveMessage.value = ''
  researchSaveError.value = null
  try {
    const marker = await quantApi.updateResearchMarker(selectedStock.value.tsCode, {
      status: researchFormStatus.value,
      note: researchFormNote.value.trim() || null,
      reviewDate: researchFormReviewDate.value || null,
    })
    researchMarkers.value = researchMarkers.value.some(item => item.tsCode === marker.tsCode)
      ? researchMarkers.value.map(item => item.tsCode === marker.tsCode ? marker : item)
      : [...researchMarkers.value, marker]
    researchSaveMessage.value = '研究记录已保存'
  }
  catch (error) {
    researchSaveError.value = error
  }
  finally {
    researchSaving.value = false
  }
}

function toggleCandidateSelection(item: CandidateItem) {
  const next = new Set(selectedCandidateIds.value)
  if (next.has(item.id)) {
    next.delete(item.id)
  }
  else if (next.size < 3) {
    next.add(item.id)
  }
  selectedCandidateIds.value = next
}

function handleCandidateToggle(id: string) {
  const item = candidateItems.value.find(candidate => candidate.id === id)
  if (item)
    toggleCandidateSelection(item)
}

function toggleAllCandidateSelection() {
  const visibleIds = filteredCandidateItems.value.map(item => item.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedCandidateIds.value.has(id))
  const next = new Set(selectedCandidateIds.value)
  if (allVisibleSelected) {
    visibleIds.forEach(id => next.delete(id))
  }
  else {
    visibleIds.forEach((id) => {
      if (next.size < 3)
        next.add(id)
    })
  }
  selectedCandidateIds.value = next
}

function clearCandidateSelection() {
  selectedCandidateIds.value = new Set()
}

function comparisonResearchStateFor(item: CandidateItem): ComparisonResearchItemState {
  return comparisonResearchStates.value[item.tsCode] || { status: 'idle', run: null, error: null }
}

function comparisonResearchActionFor(item: CandidateItem) {
  return getBatchResearchItemAction(comparisonResearchStateFor(item))
}

function comparisonResearchStateClass(state: ComparisonResearchItemState): string {
  return `comparison-research-item-${state.status}`
}

function comparisonResearchStatusLabel(state: ComparisonResearchItemState): string {
  if (state.status === 'idle')
    return '未开始'
  if (state.status === 'pending')
    return '排队中'
  if (state.status === 'running')
    return '生成中'
  if (state.status === 'error')
    return '生成失败'
  return state.run ? researchRunStatusLabel(state.run.status) : '已完成'
}

function comparisonResearchStatusDetail(state: ComparisonResearchItemState): string {
  if (state.status === 'idle')
    return '等待批量启动'
  if (state.status === 'pending')
    return '等待可用任务位'
  if (state.status === 'running')
    return '正在生成独立研究快照'
  if (state.status === 'error')
    return parsedError(state.error).message
  if (!state.run)
    return '研究快照已返回'
  return `${researchRunActionLabel(state.run.report.action)} · ${state.run.report.evidence.length} 条证据`
}

async function openComparisonDrawer() {
  if (!canCompareCandidates.value)
    return
  comparisonDrawerOpen.value = true
  comparisonLoading.value = true
  comparisonValuations.value = {}
  comparisonFinancials.value = {}
  comparisonErrors.value = {}
  await Promise.all(selectedCandidateItems.value.map(async (item) => {
    const result = { valuation: null as QuantValuationSnapshot | null, financial: null as QuantFinancialQualitySnapshot | null, valuationError: false, financialError: false }
    const [valuationResult, financialResult] = await Promise.allSettled([
      quantApi.getValuation(item.tsCode),
      quantApi.getFinancialQuality(item.tsCode),
    ])
    if (valuationResult.status === 'fulfilled')
      result.valuation = valuationResult.value
    else
      result.valuationError = true
    if (financialResult.status === 'fulfilled')
      result.financial = financialResult.value
    else
      result.financialError = true
    comparisonValuations.value = { ...comparisonValuations.value, [item.tsCode]: result.valuation }
    comparisonFinancials.value = { ...comparisonFinancials.value, [item.tsCode]: result.financial }
    comparisonErrors.value = {
      ...comparisonErrors.value,
      [item.tsCode]: { valuation: result.valuationError, financial: result.financialError },
    }
  }))
  comparisonLoading.value = false
}

async function startBatchResearch() {
  if (!canCompareCandidates.value || comparisonResearchRunning.value)
    return

  const items = [...selectedCandidateItems.value]
  comparisonResearchStates.value = Object.fromEntries(items.map(item => [item.tsCode, {
    status: 'pending' as const,
    run: null,
    error: null,
  }]))
  comparisonResearchRunning.value = true
  try {
    await runResearchBatch(
      items.map(item => item.tsCode),
      tsCode => quantApi.generateResearchRun(tsCode),
      (progress: BatchResearchProgress) => {
        comparisonResearchStates.value = applyBatchResearchProgress(comparisonResearchStates.value, progress)
      },
    )
  }
  finally {
    comparisonResearchRunning.value = false
  }
}

async function retryBatchResearchItem(item: CandidateItem) {
  const current = comparisonResearchStateFor(item)
  if (current.status !== 'error' || comparisonResearchRunning.value)
    return

  comparisonResearchStates.value = markBatchResearchItemPending(comparisonResearchStates.value, item.tsCode)
  await runResearchBatch(
    [item.tsCode],
    tsCode => quantApi.generateResearchRun(tsCode),
    (progress: BatchResearchProgress) => {
      comparisonResearchStates.value = applyBatchResearchProgress(comparisonResearchStates.value, progress)
    },
  )
}

function openBatchResearchResult(item: CandidateItem) {
  if (comparisonResearchActionFor(item) !== 'view')
    return
  comparisonDrawerOpen.value = false
  selectStock(item)
}

async function loadWorkspace() {
  errors.action = null
  await Promise.all([loadWatchlist(), loadCandidates(), loadResearchMarkers(), loadInvestmentKnowledge()])
  await Promise.all([loadValueSelection(), loadShareholderReturns()])
}

function selectStock(item: Pick<WatchlistItem, 'tsCode' | 'name'>) {
  selectedTsCode.value = item.tsCode
  syncResearchForm(item.tsCode)
  detailDrawerOpen.value = true
  void Promise.all([loadDailyBars(item.tsCode), loadValuation(item.tsCode), loadFinancialQuality(item.tsCode), loadResearchRuns(item.tsCode)])
}

async function addToWatchlist() {
  const tsCode = watchCode.value.trim().toUpperCase()
  const name = watchName.value.trim()
  if (!/^\d{6}\.(?:SZ|SH|BJ)$/.test(tsCode)) {
    errors.action = new QuantApiError('请输入形如 000001.SZ 的股票代码', 422, 'INVALID_TS_CODE')
    return
  }
  adding.value = true
  errors.action = null
  try {
    const existing = watchlist.value.find(item => item.tsCode === tsCode)
    let resolvedName = name
    let nameLookupFailed = false
    if (!resolvedName) {
      try {
        resolvedName = (await quantApi.getStockBasic(tsCode)).name
      }
      catch {
        resolvedName = ''
        nameLookupFailed = true
      }
    }
    if (existing && resolvedName && existing.name !== resolvedName) {
      await quantApi.updateWatchlistName(tsCode, resolvedName)
    }
    else {
      await quantApi.addWatchlist({ tsCode, name: resolvedName })
    }
    watchCode.value = ''
    watchName.value = ''
    if (nameLookupFailed)
      errors.action = new QuantApiError('股票已加入，但名称解析暂不可用；可补充名称后再次提交', 503, 'QUANT_STOCK_BASIC_UNAVAILABLE')
    await Promise.all([loadWatchlist(), loadCandidates(), loadResearchMarkers()])
    await Promise.all([loadValueSelection(), loadShareholderReturns()])
  }
  catch (error) {
    errors.action = error
  }
  finally {
    adding.value = false
  }
}

function requestRemoveFromWatchlist(tsCode: string) {
  pendingDeleteCode.value = tsCode
}

function cancelRemoveFromWatchlist() {
  pendingDeleteCode.value = null
}

async function confirmRemoveFromWatchlist() {
  const tsCode = pendingDeleteCode.value
  if (tsCode)
    await removeFromWatchlist(tsCode)
}

async function removeFromWatchlist(tsCode: string) {
  deletingCode.value = tsCode
  errors.action = null
  try {
    await quantApi.removeWatchlist(tsCode)
    await Promise.all([loadWatchlist(), loadResearchMarkers()])
    await Promise.all([loadCandidates(), loadValueSelection(), loadShareholderReturns()])
  }
  catch (error) {
    errors.action = error
  }
  finally {
    deletingCode.value = null
    pendingDeleteCode.value = null
  }
}

async function syncDaily() {
  if (!canSync.value)
    return
  loading.sync = true
  errors.action = null
  try {
    syncResult.value = await quantApi.syncDaily()
    await Promise.all([loadWatchlist(), loadCandidates()])
    await Promise.all([loadValueSelection(), loadShareholderReturns()])
  }
  catch (error) {
    errors.action = error
  }
  finally {
    loading.sync = false
  }
}

function syncViewFromHash(): void {
  const view = parseQuantView(window.location.hash)
  activeView.value = view
  const normalizedHash = quantViewHash(view)
  if (window.location.hash !== normalizedHash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${normalizedHash}`)
  }
}

function setActiveView(view: QuantView): void {
  activeView.value = view
  const normalizedHash = quantViewHash(view)
  if (window.location.hash !== normalizedHash) {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${normalizedHash}`)
  }
}

onMounted(() => {
  syncViewFromHash()
  window.addEventListener('hashchange', syncViewFromHash)
  window.addEventListener('popstate', syncViewFromHash)
  void loadWorkspace()
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncViewFromHash)
  window.removeEventListener('popstate', syncViewFromHash)
})
</script>

<template>
  <div class="quant-shell min-h-screen">
    <QuantHeader :active-view="activeView" :latest-date="latestWatchlistDate" :busy="pageBusy" @navigate="setActiveView" @refresh="loadWorkspace" @settings="aiSettingsOpen = true" />
    <QuantAiSettingsDrawer v-model:open="aiSettingsOpen" />
    <main class="quant-page">
      <header class="quant-view-heading">
        <div class="min-w-0">
          <p class="quant-eyebrow">
            {{ activeViewCopy.eyebrow }}
          </p>
          <div class="quant-view-title-row">
            <h1 class="quant-title">
              {{ activeViewCopy.title }}
            </h1>
          </div>
          <p class="quant-subtitle">
            {{ activeViewCopy.subtitle }}
          </p>
        </div>
        <div class="quant-view-heading-meta">
          <span>当前视图</span>
          <strong>{{ activeViewCopy.title }}</strong>
        </div>
      </header>

      <ErrorDisplay
        v-if="overallError && !pageBusy"
        :error="parsedError(overallError)"
        mode="banner"
        :show-actions="false"
      />
      <div v-if="errors.action" class="inline-alert" role="alert">
        <AlertCircle :size="16" aria-hidden="true" />
        <span>{{ parsedError(errors.action).message }}</span>
        <button class="alert-close" type="button" aria-label="关闭错误" title="关闭错误" @click="errors.action = null">
          <X :size="15" aria-hidden="true" />
        </button>
      </div>

      <template v-if="activeView === 'overview'">
        <section class="metric-grid" aria-label="工作台概览">
          <template v-if="pageBusy">
            <SkeletonCard v-for="index in 4" :key="index" variant="stat" />
          </template>
          <template v-else>
            <article class="metric-card">
              <div class="metric-card-heading">
                <span class="metric-icon metric-icon-teal"><Eye :size="17" aria-hidden="true" /></span>
                <span>观察池</span>
              </div>
              <strong class="metric-value">{{ watchlist.length }}<small>/ 50</small></strong>
              <span class="metric-note">当前关注标的</span>
            </article>
            <article class="metric-card">
              <div class="metric-card-heading">
                <span class="metric-icon metric-icon-green"><ArrowUpRight :size="17" aria-hidden="true" /></span>
                <span>今日涨跌</span>
              </div>
              <strong class="metric-value metric-value-split"><span class="text-status-success">+{{ upCount }}</span><small>/ 跌 {{ downCount }}</small></strong>
              <span class="metric-note">观察池最新日线</span>
            </article>
            <article class="metric-card">
              <div class="metric-card-heading">
                <span class="metric-icon metric-icon-amber"><Sparkles :size="17" aria-hidden="true" /></span>
                <span>有信号</span>
              </div>
              <strong class="metric-value">{{ signalCandidateCount }}</strong>
              <span class="metric-note">候选快照中的标的</span>
            </article>
            <article class="metric-card">
              <div class="metric-card-heading">
                <span class="metric-icon metric-icon-blue"><CalendarDays :size="17" aria-hidden="true" /></span>
                <span>数据覆盖</span>
              </div>
              <strong class="metric-value metric-value-date">{{ dataCoverageLabel }}</strong>
              <span class="metric-note">最新 {{ latestWatchlistDate }}</span>
            </article>
          </template>
        </section>

        <section class="environment-section" aria-labelledby="environment-title">
          <div class="section-heading">
            <div>
              <p class="section-kicker">
                WATCHLIST CONTEXT
              </p>
              <h2 id="environment-title" class="section-title">
                观察池环境
              </h2>
            </div>
            <span class="section-meta">只看当前样本，不代表大盘</span>
          </div>
          <div class="environment-layout">
            <div class="environment-summary" :class="environmentStatusClass(watchlistEnvironment.status)">
              <div class="environment-summary-heading">
                <span class="status-chip" :class="environmentStatusClass(watchlistEnvironment.status)">{{ watchlistEnvironment.label }}</span>
                <strong>{{ watchlistEnvironment.headline }}</strong>
              </div>
              <p>{{ watchlistEnvironment.scopeNote }}</p>
              <ul v-if="watchlistEnvironment.cautions.length" class="environment-cautions">
                <li v-for="caution in watchlistEnvironment.cautions" :key="caution">
                  {{ caution }}
                </li>
              </ul>
            </div>
            <div class="environment-metrics" role="list" aria-label="观察池环境指标">
              <div v-for="metric in watchlistEnvironment.metrics" :key="metric.key" class="environment-metric" role="listitem">
                <div class="environment-metric-heading">
                  <span>{{ metric.label }}</span>
                  <strong>{{ formatEnvironmentRatio(metric.ratio) }}</strong>
                </div>
                <div class="environment-meter" role="progressbar" :aria-label="metric.label" :aria-valuenow="metric.ratio === null ? undefined : Math.round(metric.ratio * 100)" aria-valuemin="0" aria-valuemax="100">
                  <span :style="{ width: `${metric.ratio === null ? 0 : Math.round(metric.ratio * 100)}%` }" />
                </div>
                <small>{{ metric.detail }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="focus-section" aria-labelledby="focus-title">
          <div class="section-heading">
            <div>
              <p class="section-kicker">
                TODAY'S FOCUS
              </p>
              <h2 id="focus-title" class="section-title">
                今日优先关注
              </h2>
            </div>
            <span class="section-meta">按当前信号分排序 · {{ latestWatchlistDate }}</span>
          </div>
          <div class="focus-layout">
            <div class="focus-list">
              <div v-if="loading.candidates" class="focus-empty" aria-label="优先关注加载中">
                <SkeletonCard variant="content" />
              </div>
              <button
                v-for="(item, index) in topCandidates"
                :key="item.tsCode"
                class="focus-row"
                :class="focusTone(item)"
                type="button"
                @click="selectStock(item)"
              >
                <span class="focus-rank">0{{ index + 1 }}</span>
                <span class="focus-stock">
                  <strong>{{ displayStockName(item) }}</strong>
                  <small>{{ item.tsCode }}</small>
                </span>
                <span class="focus-signal" :title="researchPriorityDetail(item)">{{ focusSignal(item) }}</span>
                <span class="focus-score">
                  <strong>{{ formatSignalScore(item.score) }}</strong>
                  <span class="focus-score-meter" aria-hidden="true"><span class="focus-score-meter-fill" :style="{ width: `${signalScorePercent(item.score)}%` }" /></span>
                  <small>命中规则</small>
                </span>
                <span class="status-chip" :class="riskToneClass(candidateRiskTone(item))">{{ riskLabel(item) }}</span>
                <ChevronRight :size="15" aria-hidden="true" />
              </button>
              <div v-if="!loading.candidates && !topCandidates.length" class="focus-empty">
                <Sparkles :size="18" aria-hidden="true" />
                <span>完成一次日线更新后，这里会出现可比较的信号</span>
              </div>
            </div>
            <aside class="risk-summary" aria-labelledby="risk-title">
              <div class="risk-summary-heading">
                <div>
                  <p class="section-kicker">
                    CHECK BEFORE DECISION
                  </p>
                  <h3 id="risk-title">
                    风险提示
                  </h3>
                </div>
                <ShieldAlert :size="18" aria-hidden="true" />
              </div>
              <div class="risk-list">
                <div v-for="item in riskItems" :key="item.key" class="risk-note" :class="riskToneClass(item.tone)">
                  <span class="risk-note-mark" aria-hidden="true" />
                  <div>
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.detail }}</span>
                  </div>
                </div>
              </div>
              <span class="risk-footnote" role="img" tabindex="0" aria-label="信号是筛选线索，不是买入指令" title="信号是筛选线索，不是买入指令">
                <Info :size="14" aria-hidden="true" />
              </span>
            </aside>
          </div>
        </section>

        <section class="research-path-section" aria-labelledby="research-path-title">
          <div class="section-heading">
            <div>
              <p class="section-kicker">
                RESEARCH PATH
              </p>
              <h2 id="research-path-title" class="section-title">
                下一步怎么做
              </h2>
            </div>
            <span class="section-meta">按顺序完成一次研究</span>
          </div>
          <div class="research-path-grid">
            <button class="research-path-card" type="button" @click="setActiveView('candidates')">
              <span class="research-path-index">01</span>
              <span class="research-path-copy">
                <strong>筛选候选</strong>
                <small>先用预设和数据完整度缩小范围</small>
              </span>
              <ChevronRight :size="16" aria-hidden="true" />
            </button>
            <button class="research-path-card" type="button" @click="setActiveView('watchlist')">
              <span class="research-path-index">02</span>
              <span class="research-path-copy">
                <strong>维护观察池</strong>
                <small>确认标的并更新最近 120 个交易日</small>
              </span>
              <ChevronRight :size="16" aria-hidden="true" />
            </button>
            <button class="research-path-card" type="button" @click="setActiveView('knowledge')">
              <span class="research-path-index">03</span>
              <span class="research-path-copy">
                <strong>核对因子</strong>
                <small>理解信号、估值和财务数据的边界</small>
              </span>
              <ChevronRight :size="16" aria-hidden="true" />
            </button>
          </div>
        </section>
      </template>

      <template v-else-if="activeView === 'watchlist'">
        <section class="workspace-grid">
          <article class="surface-panel" aria-labelledby="watchlist-title">
            <div class="section-heading">
              <div>
                <p class="section-kicker">
                  WATCHLIST
                </p>
                <h2 id="watchlist-title" class="section-title">
                  观察池
                </h2>
              </div>
              <span class="section-meta">{{ watchlist.length }} / 50</span>
            </div>
            <form class="watchlist-form" @submit.prevent="addToWatchlist">
              <label class="sr-only" for="quant-code">股票代码</label>
              <input id="quant-code" v-model="watchCode" class="field-control field-code" inputmode="text" autocomplete="off" placeholder="000001.SZ" maxlength="9">
              <label class="sr-only" for="quant-name">股票名称</label>
              <input id="quant-name" v-model="watchName" class="field-control" autocomplete="off" placeholder="名称（可选）" maxlength="40">
              <button class="primary-button" type="submit" :disabled="adding || watchlist.length >= 50">
                <Plus :size="16" aria-hidden="true" />
                {{ adding ? '加入中' : '加入观察池' }}
              </button>
            </form>
            <div class="quant-table-frame watchlist-table-frame">
              <DataTable
                :data="watchlist"
                :columns="watchlistColumns"
                :loading="loading.watchlist"
                min-width="760px"
                empty-message="观察池为空，先加入一只股票"
                @row-click="selectStock"
              >
                <template #cell-tsCode="{ item }">
                  <button class="stock-code-button" type="button" @click.stop="selectStock(item)">
                    {{ item.tsCode }}
                    <ChevronRight :size="14" aria-hidden="true" />
                  </button>
                </template>
                <template #cell-latestClose="{ item }">
                  <span class="quant-table-number quant-table-number-emphasis" :class="item.latestClose === null ? 'quant-table-value-muted' : ''">{{ formatNumber(item.latestClose) }}</span>
                </template>
                <template #cell-latestChangePercent="{ item }">
                  <span class="quant-table-number" :class="item.latestChangePercent === null ? 'text-status-neutral' : item.latestChangePercent >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(item.latestChangePercent) }}</span>
                </template>
                <template #cell-latestTradeDate="{ item }">
                  <span class="quant-table-date">{{ formatTradeDate(item.latestTradeDate) }}</span>
                </template>
                <template #cell-barCount="{ item }">
                  <span class="quant-table-number">{{ item.barCount }}</span>
                </template>
                <template #cell-actions="{ item }">
                  <button class="icon-button icon-button-danger watchlist-action-button" type="button" :disabled="deletingCode === item.tsCode" :aria-label="`删除 ${item.tsCode}`" :title="`删除 ${item.tsCode}`" @click.stop="requestRemoveFromWatchlist(item.tsCode)">
                    <Trash2 :size="15" aria-hidden="true" />
                  </button>
                </template>
              </DataTable>
            </div>
          </article>

          <ConfirmDialog
            :open="pendingDeleteCode !== null"
            mobile-placement="center"
            title="移除观察池代码"
            :message="deleteDialogMessage"
            confirm-text="确认移除"
            cancel-text="取消"
            variant="danger"
            :loading="deletingCode !== null"
            @update:open="value => !value && cancelRemoveFromWatchlist()"
            @cancel="cancelRemoveFromWatchlist"
            @confirm="confirmRemoveFromWatchlist"
          />

          <article class="surface-panel sync-panel" aria-labelledby="sync-title">
            <div class="section-heading">
              <div>
                <p class="section-kicker">
                  DATA UPDATE
                </p>
                <h2 id="sync-title" class="section-title">
                  更新数据
                </h2>
              </div>
              <span v-if="syncResult" class="status-chip" :class="syncStatusClass(syncResult.status)">
                {{ statusLabel(syncResult.status) }}
              </span>
            </div>
            <div class="sync-copy">
              <div class="sync-window">
                <span>股票</span><strong>{{ watchlist.length }} 只</strong>
              </div>
              <div class="sync-window">
                <span>历史范围</span><strong>最近 120 个交易日</strong>
              </div>
              <div class="sync-window">
                <span>数据截至</span><strong>{{ latestWatchlistDate }}</strong>
              </div>
            </div>
            <button class="sync-button" type="button" :disabled="!canSync" @click="syncDaily">
              <RefreshCw :size="17" :class="loading.sync ? 'animate-spin' : ''" aria-hidden="true" />
              {{ loading.sync ? '更新中' : '更新观察池' }}
            </button>
            <div v-if="syncResult" class="sync-result" :class="syncStatusClass(syncResult.status)">
              <div class="sync-result-main">
                <span class="sync-status-dot" aria-hidden="true" />
                <strong>{{ statusLabel(syncResult.status) }}</strong>
                <span>{{ syncResult.reason || '已完成本次同步请求' }}</span>
              </div>
              <div class="sync-result-stats">
                <span>请求 <strong>{{ syncResult.requested }}</strong></span>
                <span>写入 <strong>{{ syncResult.written }}</strong></span>
                <span>跳过 <strong>{{ syncResult.skipped }}</strong></span>
              </div>
            </div>
            <div v-else class="empty-state sync-empty">
              <RotateCcw :size="18" aria-hidden="true" />
              <span>尚未更新日线数据</span>
            </div>
          </article>
        </section>
      </template>

      <template v-else-if="activeView === 'candidates'">
        <section class="surface-panel" aria-labelledby="candidate-title">
          <div class="section-heading">
            <div>
              <p class="section-kicker">
                SELECTION SIGNALS
              </p>
              <h2 id="candidate-title" class="section-title">
                择股信号
              </h2>
            </div>
            <div class="candidate-heading-actions">
              <button class="secondary-button" type="button" title="打开观察池并新增股票" @click="setActiveView('watchlist')">
                <Plus :size="14" aria-hidden="true" />
                添加观察股
              </button>
              <button class="secondary-button" type="button" title="打开观察池并更新日线数据" @click="setActiveView('watchlist')">
                <RefreshCw :size="14" aria-hidden="true" />
                更新数据
              </button>
            </div>
            <div class="snapshot-meta">
              <span>数据截至 {{ formatTradeDate(snapshot?.toDate || null) }}</span>
              <span>计算 {{ formatDateTime(snapshot?.generatedAt || null) }}</span>
            </div>
          </div>
          <div class="candidate-sync-summary" aria-label="候选数据覆盖状态">
            <span>当前观察池 <strong>{{ candidateItems.length }}</strong> 只</span>
            <span>已计算 <strong>{{ scannedCandidateCount }}</strong> 只</span>
            <span :class="pendingCandidateCount ? 'candidate-sync-summary-warning' : ''">待更新 <strong>{{ pendingCandidateCount }}</strong> 只</span>
          </div>
          <div v-if="pendingCandidateCount" class="candidate-pending-callout" role="status">
            <Info :size="16" aria-hidden="true" />
            <span>{{ pendingCandidateCount }} 只新加入的股票还没有进入最近一次日线快照，更新观察池后才会计算信号、趋势和价值质量。</span>
            <button class="text-button" type="button" @click="setActiveView('watchlist')">
              去更新
            </button>
          </div>
          <form class="candidate-add-form" aria-label="从候选研究新增观察股" @submit.prevent="addToWatchlist">
            <label class="sr-only" for="candidate-quant-code">新增股票代码</label>
            <input id="candidate-quant-code" v-model="watchCode" class="field-control field-code" inputmode="text" autocomplete="off" placeholder="输入代码，如 600000.SH" maxlength="9">
            <label class="sr-only" for="candidate-quant-name">新增股票名称</label>
            <input id="candidate-quant-name" v-model="watchName" class="field-control" autocomplete="off" placeholder="名称可留空，系统会解析" maxlength="40">
            <button class="primary-button" type="submit" :disabled="adding || watchlist.length >= 50">
              <Plus :size="15" aria-hidden="true" />
              {{ adding ? '加入中' : '加入观察池并研究' }}
            </button>
          </form>
          <div class="candidate-toolbar">
            <div class="candidate-filter-group" role="group" aria-label="择股预设">
              <button
                v-for="option in candidateFilterOptions"
                :key="option.key"
                class="candidate-filter-button"
                :class="candidateFilter === option.key ? 'candidate-filter-button-active' : ''"
                type="button"
                :aria-pressed="candidateFilter === option.key"
                :title="option.detail"
                @click="candidateFilter = option.key"
              >
                <component :is="option.icon" :size="14" aria-hidden="true" />
                {{ option.label }}
              </button>
            </div>
            <div class="candidate-query-controls" aria-label="候选筛选">
              <label class="candidate-query-field">
                <span>最低信号分</span>
                <select v-model.number="candidateMinScore" class="candidate-query-select">
                  <option :value="0">
                    不限
                  </option>
                  <option :value="2">
                    2 分以上
                  </option>
                  <option :value="4">
                    4 分以上
                  </option>
                </select>
              </label>
              <label class="candidate-query-field">
                <span>排序</span>
                <select v-model="candidateSort" class="candidate-query-select">
                  <option v-for="option in candidateSortOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label class="candidate-query-field">
                <span>研究状态</span>
                <select v-model="candidateResearchStatus" class="candidate-query-select">
                  <option v-for="option in candidateResearchStatusOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label class="candidate-query-field">
                <span>复查状态</span>
                <select v-model="candidateReviewDue" class="candidate-query-select">
                  <option v-for="option in candidateReviewDueOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label class="candidate-query-check">
                <input v-model="candidateCompleteOnly" type="checkbox">
                <span>只看数据完整</span>
              </label>
              <button v-if="candidateQueryActive" class="candidate-reset-button" type="button" title="重置自定义筛选" @click="resetCandidateQuery">
                <RotateCcw :size="14" aria-hidden="true" />
                重置
              </button>
            </div>
            <div class="candidate-toolbar-meta">
              <span class="section-meta">显示 {{ filteredCandidateItems.length }} / {{ candidateItems.length }}</span>
              <button class="compare-button" type="button" :disabled="!canCompareCandidates" @click="openComparisonDrawer">
                <BarChart3 :size="14" aria-hidden="true" />
                对比 {{ selectedCandidateItems.length }} 只
              </button>
              <button v-if="selectedCandidateItems.length" class="text-button candidate-clear-button" type="button" @click="clearCandidateSelection">
                清除选择
              </button>
            </div>
          </div>
          <div class="selection-guide" aria-label="择股预设说明">
            <div class="selection-guide-copy">
              <span class="section-kicker">START WITH A PRESET</span>
              <strong>{{ activeCandidatePreset.label }}</strong>
              <span>{{ activeCandidatePreset.description }}</span>
            </div>
            <span class="selection-guide-count">命中 {{ filteredCandidateItems.length }} 只</span>
          </div>
          <div class="selection-legend" aria-label="指标释义">
            <span><strong>信号分</strong>命中规则 / {{ SIGNAL_RULE_COUNT }} 条</span>
            <span><strong>20 日表现</strong>近 20 个交易日收益</span>
            <span><strong>成交活跃度</strong>相对近 5 日均量</span>
            <span><strong>价值质量</strong>估值、经营、增长、趋势四维观察</span>
          </div>
          <section v-if="candidateItems.length" class="candidate-evidence-overview" aria-label="候选证据就绪度">
            <div class="candidate-evidence-overview-heading">
              <div>
                <p class="section-kicker">
                  EVIDENCE READINESS
                </p>
                <h3>证据就绪度</h3>
              </div>
              <span class="candidate-evidence-overview-info" role="img" tabindex="0" aria-label="证据就绪度只统计五个研究维度的原始字段覆盖，不代表价值质量好坏或买卖判断" title="只统计五个研究维度的原始字段覆盖，不代表价值质量好坏或买卖判断">
                <Info :size="14" aria-hidden="true" />
              </span>
            </div>
            <div class="candidate-evidence-overview-stats" role="list" aria-label="证据就绪统计">
              <div role="listitem">
                <strong class="candidate-evidence-overview-ready">{{ candidateEvidenceSummary.ready }}</strong>
                <span>可直接核对</span>
              </div>
              <div role="listitem">
                <strong class="candidate-evidence-overview-partial">{{ candidateEvidenceSummary.partial }}</strong>
                <span>部分覆盖</span>
              </div>
              <div role="listitem">
                <strong class="candidate-evidence-overview-missing">{{ candidateEvidenceSummary.missing }}</strong>
                <span>待补证据</span>
              </div>
              <div role="listitem">
                <strong class="candidate-evidence-overview-unavailable">{{ candidateEvidenceSummary.unavailable }}</strong>
                <span>{{ loading.valueQuality ? '读取中' : errors.valueQuality ? '暂不可用' : '待加载' }}</span>
              </div>
            </div>
            <p>仅衡量原始字段是否齐全；价值质量分仍单独表示指标表现。</p>
          </section>
          <div v-if="snapshot && snapshot.candidates.length" class="snapshot-range">
            <span>观察窗口</span>
            <strong>{{ formatTradeDate(snapshot.fromDate || null) }} → {{ formatTradeDate(snapshot.toDate || null) }}</strong>
            <span class="snapshot-range-divider">·</span>
            <span>{{ snapshot.factorVersion || '动量信号' }}</span>
          </div>
          <section v-if="researchPriorityTotal" class="research-priority-queue" aria-labelledby="research-priority-title">
            <div class="research-priority-heading">
              <div>
                <p class="section-kicker">
                  RESEARCH PRIORITY
                </p>
                <h3 id="research-priority-title">
                  研究优先队列
                </h3>
              </div>
              <div class="research-priority-heading-meta">
                <span>{{ researchPriorityTotal }} 只候选</span>
                <span class="research-priority-info" role="img" tabindex="0" aria-label="研究优先级只用于安排核对顺序，不代表买卖指令" title="研究优先级只用于安排核对顺序，不代表买卖指令">
                  <Info :size="14" aria-hidden="true" />
                </span>
              </div>
            </div>
            <div class="research-priority-summary" role="list" aria-label="研究队列统计">
              <div class="research-priority-summary-item" role="listitem">
                <strong>{{ researchPriorityHighestLabel }}</strong>
                <span>最高优先</span>
              </div>
              <div class="research-priority-summary-item" role="listitem">
                <strong>{{ researchPrioritySummary.dataGap }}</strong>
                <span>待补数据</span>
              </div>
              <div class="research-priority-summary-item" role="listitem">
                <strong>{{ researchPrioritySummary.review }}</strong>
                <span>待复查</span>
              </div>
              <div class="research-priority-summary-item" role="listitem">
                <strong>{{ researchPrioritySummary.risk }}</strong>
                <span>核对风险</span>
              </div>
              <div class="research-priority-summary-item" role="listitem">
                <strong>{{ researchPrioritySummary.valueQuality }}</strong>
                <span>补看价值</span>
              </div>
            </div>
            <div class="research-priority-list">
              <button
                v-for="entry in visibleResearchPriorityQueue"
                :key="entry.item.tsCode"
                class="research-priority-row"
                type="button"
                @click="selectStock(entry.item)"
              >
                <span class="research-priority-badge" :class="researchPriorityClass(entry.item)">{{ entry.priority.levelLabel }}</span>
                <span class="research-priority-stock">
                  <strong>{{ displayStockName(entry.item) }}</strong>
                  <small>{{ entry.item.tsCode }} · {{ entry.priority.score }} 分</small>
                </span>
                <span class="research-priority-detail">
                  <strong :class="researchPriorityActionClass(entry.item)">{{ entry.priority.actionLabel }}</strong>
                  <small>{{ entry.priority.reasons.join('；') }}</small>
                </span>
                <ChevronRight :size="15" aria-hidden="true" />
              </button>
            </div>
            <p v-if="researchPriorityTotal > visibleResearchPriorityQueue.length" class="research-priority-more">
              还有 {{ researchPriorityTotal - visibleResearchPriorityQueue.length }} 条记录，请使用研究优先排序查看
            </p>
          </section>
          <div class="quant-table-frame candidate-table-frame">
            <DataTable
              :data="filteredCandidateItems"
              :columns="candidateColumns"
              :loading="loading.candidates"
              selectable
              :selected-ids="selectedCandidateIds"
              min-width="1580px"
              :empty-message="candidateItems.length ? '当前筛选没有候选' : '暂无候选快照，完成一次日线同步后查看'"
              @toggle-select="handleCandidateToggle"
              @toggle-select-all="toggleAllCandidateSelection"
              @row-click="selectStock"
            >
              <template #cell-tsCode="{ item }">
                <span class="font-mono text-xs font-semibold text-foreground">{{ item.tsCode }}</span>
              </template>
              <template #cell-score="{ item }">
                <div class="score-cell" :aria-label="`命中 ${formatSignalScore(item.score)} 条规则`">
                  <strong class="score-value" :class="item.score === null ? 'quant-table-value-muted' : ''">{{ formatSignalScore(item.score) }}</strong>
                  <span class="score-meter" aria-hidden="true"><span class="score-meter-fill" :style="{ width: `${signalScorePercent(item.score)}%` }" /></span>
                </div>
              </template>
              <template #cell-priority="{ item }">
                <div class="research-priority-cell" :title="researchPriorityDetail(item)">
                  <span class="research-priority-badge" :class="researchPriorityClass(item)">{{ candidatePriorityFor(item).levelLabel }}</span>
                  <small>{{ candidatePriorityFor(item).score }} 分</small>
                </div>
              </template>
              <template #cell-persistence="{ item }">
                <div class="candidate-persistence-cell" :title="candidatePersistenceDetail(item)">
                  <span class="candidate-persistence-state" :class="candidatePersistenceClass(item)">{{ candidatePersistenceLabel(item) }}</span>
                  <small>{{ item.persistence?.sampleSize ? `${item.persistence.appearanceCount} / ${item.persistence.sampleSize} 次` : '暂无历史快照' }}</small>
                </div>
              </template>
              <template #cell-return20="{ item }">
                <span class="quant-table-number" :class="item.return20 === null ? 'text-status-neutral' : item.return20 >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(item.return20) }}</span>
              </template>
              <template #cell-ma20="{ item }">
                <span class="quant-table-number" :class="item.ma20 === null ? 'quant-table-value-muted' : ''">{{ formatNumber(item.ma20) }}</span>
              </template>
              <template #cell-volumeRatio="{ item }">
                <span class="quant-table-number" :class="item.volumeRatio === null ? 'quant-table-value-muted' : ''">{{ formatNumber(item.volumeRatio) }}</span>
              </template>
              <template #cell-relativeStrength="{ item }">
                <span class="quant-table-number" :class="item.relativeStrength === null ? 'quant-table-value-muted' : ''">{{ formatNumber(item.relativeStrength) }}</span>
              </template>
              <template #cell-valueQuality="{ item }">
                <div class="value-quality-table-cell" :title="valueQualitySummary(valueQualityFor(item.tsCode))">
                  <strong :class="valueQualityStatusClass(valueQualityFor(item.tsCode))">{{ formatValueQualityScore(valueQualityFor(item.tsCode)) }}</strong>
                  <small>{{ valueQualityStatusLabel(valueQualityFor(item.tsCode)) }}</small>
                </div>
              </template>
              <template #cell-evidence="{ item }">
                <div class="candidate-evidence-cell" :title="candidateEvidenceDetail(item)" :aria-label="`${candidateEvidenceStatusLabel(candidateEvidenceFor(item))}，${candidateEvidenceDetail(item)}`">
                  <div class="candidate-evidence-cell-heading">
                    <strong :class="candidateEvidenceStatusClass(candidateEvidenceFor(item))">{{ formatCandidateEvidenceScore(candidateEvidenceFor(item)) }}</strong>
                    <span :class="candidateEvidenceStatusClass(candidateEvidenceFor(item))">{{ candidateEvidenceStatusLabel(candidateEvidenceFor(item)) }}</span>
                  </div>
                  <small>{{ candidateEvidenceCoverage(candidateEvidenceFor(item)) }}</small>
                </div>
              </template>
              <template #cell-review="{ item }">
                <div class="review-cell" :title="researchReviewFor(item.tsCode).detail" :aria-label="`${researchReviewFor(item.tsCode).label}，${researchReviewFor(item.tsCode).date || '未设置日期'}`">
                  <span class="review-cell-label" :class="`review-state-text-${researchReviewFor(item.tsCode).state}`">{{ researchReviewFor(item.tsCode).label }}</span>
                  <small>{{ researchReviewFor(item.tsCode).date || '--' }}</small>
                </div>
              </template>
              <template #cell-action="{ item }">
                <div class="candidate-action-cell" :title="researchPriorityDetail(item)" :aria-label="`${candidatePriorityFor(item).actionLabel}：${researchPriorityDetail(item)}`">
                  <span class="candidate-action-badge" :class="`research-priority-action-${candidatePriorityFor(item).tone}`">{{ candidatePriorityFor(item).actionLabel }}</span>
                  <small>{{ candidatePriorityFor(item).reasons[0] || '按当前数据保持观察' }}</small>
                </div>
              </template>
              <template #cell-signals="{ item }">
                <div class="signal-list candidate-signal-list">
                  <span v-if="researchMarkerMap.get(item.tsCode)?.status && researchMarkerMap.get(item.tsCode)?.status !== 'unreviewed'" class="research-status-dot" :class="`research-status-${researchMarkerMap.get(item.tsCode)?.status}`" :title="researchStatusOptions.find(option => option.value === researchMarkerMap.get(item.tsCode)?.status)?.label" aria-hidden="true" />
                  <span v-if="item.pendingSync" class="signal-tag signal-tag-warning">待更新数据</span>
                  <span v-for="signal in item.signals" :key="signal" class="signal-tag signal-tag-teal">{{ formatFactorLabel(signal) }}</span>
                  <span v-if="!item.pendingSync && item.quality !== 'ready'" class="signal-tag signal-tag-muted">数据不足</span>
                  <span v-if="!item.signals.length && item.quality === 'ready'" class="muted-inline">暂无明确信号</span>
                </div>
              </template>
            </DataTable>
          </div>
        </section>
      </template>

      <template v-else-if="activeView === 'knowledge'">
        <section class="knowledge-section" aria-labelledby="knowledge-title">
          <div class="knowledge-heading">
            <div>
              <p class="section-kicker">
                INVESTMENT KNOWLEDGE
              </p>
              <h2 id="knowledge-title" class="section-title">
                投资因子框架
              </h2>
              <p class="knowledge-intro">
                把文章中的判断拆成可验证的因子；当前只有“已进入评分”的因子影响价值质量分。
              </p>
            </div>
            <div v-if="investmentKnowledge" class="knowledge-meta">
              <span>知识库 {{ investmentKnowledge.version }}</span>
              <span>{{ investmentKnowledge.sources.length }} 篇来源</span>
            </div>
          </div>
          <div v-if="loading.knowledge" class="knowledge-state" role="status">
            <SkeletonCard variant="content" />
          </div>
          <div v-else-if="errors.knowledge" class="knowledge-state" role="status">
            <Info :size="17" aria-hidden="true" />
            <span>投资知识暂时不可用</span>
            <button class="text-button" type="button" @click="loadInvestmentKnowledge">
              重试
            </button>
          </div>
          <template v-else-if="investmentKnowledge">
            <div class="knowledge-summary-grid" aria-label="因子状态统计">
              <div class="knowledge-summary-item knowledge-summary-active">
                <DatabaseZap :size="16" aria-hidden="true" />
                <strong>{{ activeKnowledgeFactors.length }}</strong>
                <span>已进入评分</span>
              </div>
              <div class="knowledge-summary-item knowledge-summary-partial">
                <Sparkles :size="16" aria-hidden="true" />
                <strong>{{ partialKnowledgeFactors.length }}</strong>
                <span>部分接通</span>
              </div>
              <div class="knowledge-summary-item knowledge-summary-planned">
                <BookOpen :size="16" aria-hidden="true" />
                <strong>{{ plannedKnowledgeFactors.length }}</strong>
                <span>待接或定性</span>
              </div>
              <div class="knowledge-summary-item knowledge-summary-alias">
                <Tags :size="16" aria-hidden="true" />
                <strong>{{ mappedKnowledgeAliases.length }}</strong>
                <span>已映射别名</span>
              </div>
            </div>
            <div class="knowledge-factor-grid">
              <article v-for="factor in investmentKnowledge.factors" :key="factor.id" class="knowledge-factor" :class="knowledgeStatusClass(factor.status)">
                <div class="knowledge-factor-heading">
                  <div>
                    <span class="knowledge-factor-category">{{ factor.category }}</span>
                    <h3>{{ factor.title }}</h3>
                  </div>
                  <span class="knowledge-status-badge" :class="knowledgeStatusClass(factor.status)">{{ knowledgeStatusLabel(factor.status) }}</span>
                </div>
                <p>{{ factor.interpretation }}</p>
                <div class="knowledge-factor-measurement">
                  <strong>量化方向</strong>
                  <span>{{ factor.measurement }}</span>
                </div>
                <div class="knowledge-factor-fields">
                  <span v-if="factor.availableFields.length">已接：{{ formatKnowledgeFields(factor.availableFields) }}</span>
                  <span v-if="factor.missingFields.length">待接：{{ formatKnowledgeFields(factor.missingFields) }}</span>
                </div>
                <div class="knowledge-factor-foot">
                  <span v-if="factor.eligibleInValueQuality">当前价值质量评分使用</span>
                  <span v-else>先作为研究假设</span>
                  <span>{{ factor.sourceIds.length }} 篇关联来源</span>
                </div>
              </article>
            </div>
            <details class="knowledge-details">
              <summary>
                <BookOpen :size="15" aria-hidden="true" />
                查看文章来源与股票别名映射
              </summary>
              <div class="knowledge-context-grid">
                <div class="knowledge-context-column">
                  <div class="knowledge-context-heading">
                    <strong>文章来源</strong>
                    <span>{{ investmentKnowledge.sources.length }} 篇</span>
                  </div>
                  <div class="knowledge-source-list">
                    <a v-for="source in investmentKnowledge.sources" :key="source.id" class="knowledge-source-row" :href="source.url" target="_blank" rel="noreferrer" :title="source.url">
                      <span class="knowledge-source-access" :class="source.access === 'preview' ? 'knowledge-source-preview' : 'knowledge-source-full'">{{ source.access === 'preview' ? '试读' : '全文' }}</span>
                      <span class="knowledge-source-copy">
                        <strong>{{ source.title }}</strong>
                        <small>{{ source.publishedAt || '日期未读取' }} · {{ source.summary }}</small>
                      </span>
                      <ExternalLink :size="13" aria-hidden="true" />
                    </a>
                  </div>
                </div>
                <div class="knowledge-context-column">
                  <div class="knowledge-context-heading">
                    <strong>文章别名映射</strong>
                    <span>{{ investmentKnowledge.aliases.length }} 条 · {{ contextKnowledgeAliases.length }} 待确认</span>
                  </div>
                  <div class="knowledge-alias-grid">
                    <div v-for="alias in investmentKnowledge.aliases" :key="alias.alias" class="knowledge-alias-row" :title="alias.note">
                      <span class="knowledge-alias-name">{{ alias.alias }}</span>
                      <strong>{{ alias.name || alias.candidates.join(' / ') || '待确认' }}</strong>
                      <small>{{ knowledgeAliasStatusLabel(alias.status) }} · {{ knowledgeConfidenceLabel(alias.confidence) }}</small>
                    </div>
                  </div>
                </div>
              </div>
              <p class="knowledge-details-note">
                已映射的 A 股研究样本已通过幂等 migration 加入观察池；港股、未上市主体和待确认别名保留在知识层，不进入当前 A 股日线同步。
              </p>
            </details>
          </template>
        </section>
      </template>

      <DetailDrawer
        :open="detailDrawerOpen && !!selectedStock"
        :title="selectedStock ? `${selectedStock.name || selectedStock.tsCode} · 分析详情` : '分析详情'"
        :description="selectedStock ? `${selectedStock.tsCode} · 走势、估值、财务质量与研究摘要` : ''"
        width="lg"
        @update:open="detailDrawerOpen = $event"
      >
        <section class="quant-detail-content" aria-labelledby="daily-title">
          <section class="decision-card" aria-label="候选决策卡">
            <div class="decision-card-heading">
              <div>
                <p class="section-kicker">
                  DECISION CARD
                </p>
                <h2>先看依据，再做判断</h2>
              </div>
              <div class="detail-review-status">
                <span v-if="selectedResearchMarker.status !== 'unreviewed'" class="research-status-badge" :class="`research-status-${selectedResearchMarker.status}`">
                  {{ researchStatusOptions.find(option => option.value === selectedResearchMarker.status)?.label }}
                </span>
                <span v-if="selectedResearchReview.state !== 'unscheduled'" class="review-state-badge" :class="`review-state-${selectedResearchReview.state}`">
                  {{ selectedResearchReview.label }}
                </span>
              </div>
            </div>
            <div v-if="selectedCandidate" class="decision-card-grid">
              <div class="decision-card-item decision-card-item-primary">
                <span>信号覆盖</span>
                <strong>{{ formatSignalScore(selectedCandidate.score) }}</strong>
                <small>命中规则 / {{ SIGNAL_RULE_COUNT }} 条</small>
              </div>
              <div class="decision-card-item">
                <span>20 日表现</span>
                <strong :class="selectedCandidate.return20 === null ? 'text-status-neutral' : selectedCandidate.return20 >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(selectedCandidate.return20) }}</strong>
                <small>历史窗口收益，不代表未来</small>
              </div>
              <div class="decision-card-item">
                <span>数据状态</span>
                <strong>{{ selectedCandidate.quality === 'ready' ? '数据完整' : '需要补齐' }}</strong>
                <small>{{ selectedCandidate.factorVersion || '当前快照' }}</small>
              </div>
              <div class="decision-card-item">
                <span>研究优先</span>
                <strong :class="researchPriorityActionClass(selectedCandidate)">{{ candidatePriorityFor(selectedCandidate).levelLabel }}</strong>
                <small>{{ candidatePriorityFor(selectedCandidate).score }} 分 · {{ candidatePriorityFor(selectedCandidate).actionLabel }}</small>
              </div>
            </div>
            <div v-else class="decision-card-empty">
              <Info :size="16" aria-hidden="true" />
              <span>当前股票不在最新候选快照中，先看日线、估值和基本面。</span>
            </div>
            <div v-if="selectedCandidate" class="decision-signal-row">
              <span class="decision-signal-label">入选依据</span>
              <div class="signal-list decision-signal-list">
                <span v-for="signal in selectedCandidate.signals" :key="signal" class="signal-tag signal-tag-teal">{{ formatFactorLabel(signal) }}</span>
                <span v-if="!selectedCandidate.signals.length" class="muted-inline">暂无明确信号</span>
              </div>
            </div>
            <div v-if="selectedCandidate" class="decision-action-row">
              <span>研究动作</span>
              <strong :class="researchPriorityActionClass(selectedCandidate)">{{ candidatePriorityFor(selectedCandidate).actionLabel }}</strong>
              <small>{{ researchPriorityDetail(selectedCandidate) }}</small>
            </div>
            <p class="decision-card-note">
              技术信号用于缩小研究范围；估值和财务数据需要结合报告期与样本完整度人工核对。
            </p>
          </section>
          <section v-if="selectedStock" class="research-run-panel" aria-label="结构化研究报告">
            <div class="research-run-heading">
              <div>
                <p class="section-kicker">
                  RESEARCH RUN V1
                </p>
                <h2>结构化研究报告</h2>
                <small v-if="latestResearchReport">最近生成 {{ formatDateTime(latestResearchReport.generatedAt) }}</small>
              </div>
              <div class="research-run-heading-actions">
                <button class="secondary-button research-run-generate-button" type="button" :disabled="researchRunGenerating || researchRunLoading" title="按当前已保存数据生成一份可回看的研究快照" @click="generateResearchReport">
                  <RotateCcw :size="15" :class="researchRunGenerating ? 'animate-spin' : ''" aria-hidden="true" />
                  {{ researchRunGenerating ? '生成中' : latestResearchReport ? '重新生成' : '生成报告' }}
                </button>
                <button v-if="latestResearchReport" class="secondary-button research-run-export-button" type="button" title="将当前研究报告下载为 Markdown 文件" aria-label="导出当前研究报告为 Markdown 文件" @click="downloadResearchReport">
                  <Download :size="15" aria-hidden="true" />
                  导出 Markdown
                </button>
              </div>
            </div>
            <div v-if="researchRunLoading" class="research-run-state" role="status">
              <RefreshCw :size="16" class="animate-spin" aria-hidden="true" />
              <span>正在读取研究历史</span>
            </div>
            <div v-else-if="researchRunError" class="research-run-state research-run-state-error" role="status">
              <Info :size="16" aria-hidden="true" />
              <span>{{ parsedError(researchRunError).message }}</span>
              <button class="text-button" type="button" @click="selectedStock && loadResearchRuns(selectedStock.tsCode)">
                重试
              </button>
            </div>
            <template v-else-if="latestResearchReport">
              <div class="research-run-summary">
                <div class="research-run-summary-main" :class="researchRunStatusClass(latestResearchReport.status)">
                  <span>当前状态</span>
                  <strong>{{ researchRunStatusLabel(latestResearchReport.status) }}</strong>
                  <small>{{ latestResearchReport.reportVersion }}</small>
                </div>
                <div>
                  <span>研究动作</span>
                  <strong>{{ researchRunActionLabel(latestResearchReport.action) }}</strong>
                  <small>{{ latestResearchReport.score === null ? '--' : `${latestResearchReport.score.toFixed(1)} / 100` }}</small>
                </div>
                <div>
                  <span>证据条数</span>
                  <strong>{{ latestResearchReport.evidence.length }}</strong>
                  <small>{{ latestResearchReport.sources.length }} 个来源</small>
                </div>
              </div>
              <p class="research-run-headline">
                {{ latestResearchReport.headline }}
              </p>
              <div class="research-run-guidance-grid">
                <div v-if="latestResearchReport.strengths.length" class="research-run-guidance research-run-guidance-positive">
                  <span>支持依据</span>
                  <ul>
                    <li v-for="item in latestResearchReport.strengths" :key="`strength-${item}`">
                      {{ item }}
                    </li>
                  </ul>
                </div>
                <div v-if="latestResearchReport.risks.length" class="research-run-guidance research-run-guidance-danger">
                  <span>风险核对</span>
                  <ul>
                    <li v-for="item in latestResearchReport.risks" :key="`risk-${item}`">
                      {{ item }}
                    </li>
                  </ul>
                </div>
                <div v-if="latestResearchReport.gaps.length" class="research-run-guidance research-run-guidance-warning">
                  <span>数据缺口</span>
                  <ul>
                    <li v-for="item in latestResearchReport.gaps" :key="`gap-${item}`">
                      {{ item }}
                    </li>
                  </ul>
                </div>
                <div class="research-run-guidance research-run-guidance-neutral">
                  <span>下一步</span>
                  <ul>
                    <li v-for="item in latestResearchReport.nextActions" :key="`next-${item}`">
                      {{ item }}
                    </li>
                  </ul>
                </div>
              </div>
              <section class="research-run-timeline-panel" aria-label="研究决策轨迹">
                <div class="research-run-timeline-heading">
                  <div>
                    <p class="section-kicker">
                      DECISION TIMELINE
                    </p>
                    <h3>研究决策轨迹</h3>
                  </div>
                  <div class="research-run-timeline-heading-meta">
                    <span>{{ researchRunTimeline.points.length }} / {{ researchRunTimeline.totalRunCount }} 次</span>
                    <span class="research-run-timeline-info" role="img" tabindex="0" aria-label="轨迹只记录已保存研究快照的变化，不替代当前报告的研究动作" title="轨迹只记录已保存研究快照的变化，不替代当前报告的研究动作">
                      <Info :size="14" aria-hidden="true" />
                    </span>
                  </div>
                </div>
                <div v-if="researchRunTimeline.points.length < 2" class="research-run-timeline-state" role="status">
                  <Info :size="15" aria-hidden="true" />
                  <span>当前只有 1 份研究快照，再生成 1 份后可观察分数和动作轨迹。</span>
                </div>
                <template v-else>
                  <div class="research-run-timeline-summary" role="list" aria-label="研究轨迹统计">
                    <div role="listitem">
                      <span>最近分数</span>
                      <strong>{{ formatResearchRunTimelineScore(researchRunTimeline.latestScore) }}</strong>
                      <small>当前报告</small>
                    </div>
                    <div role="listitem">
                      <span>相邻变化</span>
                      <strong :class="researchRunTimelineScoreClass(researchRunTimeline.latestScoreDirection)">{{ formatResearchRunTimelineDelta(researchRunTimeline.latestScoreDelta, researchRunTimeline.latestScoreDirection) }}</strong>
                      <small>仅比较有限数值</small>
                    </div>
                    <div role="listitem">
                      <span>状态 / 动作变化</span>
                      <strong>{{ researchRunTimeline.statusChangeCount }} / {{ researchRunTimeline.actionChangeCount }}</strong>
                      <small>最近可见快照</small>
                    </div>
                  </div>
                  <div class="research-run-timeline-list">
                    <article v-for="point in researchRunTimeline.points" :key="point.id" class="research-run-timeline-row">
                      <div class="research-run-timeline-rail" aria-hidden="true">
                        <span />
                      </div>
                      <div class="research-run-timeline-date">
                        <time>{{ formatDateTime(point.generatedAt) }}</time>
                        <small>{{ point.id.slice(0, 8) }}</small>
                      </div>
                      <div class="research-run-timeline-main">
                        <div class="research-run-timeline-title">
                          <span class="research-run-timeline-status" :class="`research-run-timeline-status-${point.status}`">{{ researchRunStatusLabel(point.status) }}</span>
                          <strong>{{ researchRunActionLabel(point.action) }}</strong>
                          <span v-if="point.statusChanged || point.actionChanged" class="research-run-timeline-change">结论变化</span>
                        </div>
                        <p>{{ point.headline }}</p>
                        <small>{{ point.evidenceCount }} 条证据</small>
                      </div>
                      <div class="research-run-timeline-score" :class="researchRunTimelineScoreClass(point.scoreDirection)">
                        <strong>{{ formatResearchRunTimelineScore(point.score) }}</strong>
                        <span>{{ point.scoreDelta === null ? '无可比分数' : `相邻 ${formatResearchRunTimelineDelta(point.scoreDelta, point.scoreDirection)}` }}</span>
                      </div>
                    </article>
                  </div>
                </template>
              </section>
              <div class="research-run-evidence-groups">
                <section v-for="group in researchEvidenceGroups" :key="group.dimension" class="research-run-evidence-group" :aria-labelledby="`research-evidence-${group.dimension}`">
                  <div class="research-run-evidence-group-heading">
                    <strong :id="`research-evidence-${group.dimension}`">{{ group.label }}</strong>
                    <small>{{ group.items.length }} 条证据</small>
                  </div>
                  <div class="research-run-evidence-list">
                    <div v-for="item in group.items" :key="item.key" class="research-run-evidence-row" :class="researchEvidenceStatusClass(item.status)" :title="`${item.source} · ${item.formulaVersion}`">
                      <div class="research-run-evidence-main">
                        <div class="research-run-evidence-title">
                          <strong>{{ item.label }}</strong>
                          <span>{{ researchEvidenceStatusLabel(item.status) }}</span>
                          <small v-if="item.optional">可选证据</small>
                        </div>
                        <p>{{ item.detail }}</p>
                      </div>
                      <div class="research-run-evidence-value">
                        <strong>{{ formatResearchEvidenceValue(item) }}</strong>
                        <small>阈值 {{ item.threshold }}</small>
                      </div>
                      <div class="research-run-evidence-meta">
                        <span>{{ item.source }}</span>
                        <small>{{ formatResearchRunSourceDate(item.observedAt) }} · {{ item.formulaVersion }}</small>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              <div class="research-run-sources">
                <span>来源快照</span>
                <span v-for="source in latestResearchReport.sources" :key="source.id" :title="source.formulaVersion">
                  {{ source.name }} · {{ formatResearchRunSourceDate(source.observedAt) }}
                </span>
              </div>
              <QuantAiResearchSummary
                :report="latestResearchReport"
                :summary="researchAiSummary"
                :loading="researchSummaryLoading"
                :generating="researchSummaryGenerating"
                :error-message="researchSummaryError ? parsedError(researchSummaryError).message : null"
                :configuration-error="researchSummaryConfigurationError"
                @generate="generateResearchSummary"
                @open-settings="aiSettingsOpen = true"
              />
              <section class="research-evidence-history-panel" aria-label="研究证据变化">
                <div class="research-evidence-history-heading">
                  <div>
                    <p class="section-kicker">
                      HISTORY DIFF
                    </p>
                    <h3>与上次快照相比</h3>
                    <small v-if="researchEvidenceComparison">
                      本次 {{ formatDateTime(researchEvidenceComparison.currentGeneratedAt) }} · 上次 {{ formatDateTime(researchEvidenceComparison.previousGeneratedAt) }}
                    </small>
                  </div>
                  <span v-if="researchEvidenceComparison" class="research-evidence-history-count">
                    {{ researchEvidenceComparison.changedCount }} 项变化
                  </span>
                </div>
                <div v-if="researchRuns.length < 2" class="research-evidence-history-state" role="status">
                  <Info :size="15" aria-hidden="true" />
                  <span>当前只有 1 份研究快照，再生成 1 份后可比较证据变化。</span>
                </div>
                <template v-else-if="researchEvidenceComparison">
                  <div class="research-evidence-history-summary">
                    <div>
                      <span>变化项</span>
                      <strong>{{ researchEvidenceComparison.changedCount }}</strong>
                      <small>共 {{ researchEvidenceComparison.totalEvidenceCount }} 项证据</small>
                    </div>
                    <div>
                      <span>改善 / 恢复</span>
                      <strong class="research-evidence-history-positive">{{ researchEvidenceComparison.improvedCount }}</strong>
                      <small>状态或数据可用性变好</small>
                    </div>
                    <div>
                      <span>转弱 / 缺失</span>
                      <strong class="research-evidence-history-negative">{{ researchEvidenceComparison.weakenedCount }}</strong>
                      <small>需要优先核对</small>
                    </div>
                    <div>
                      <span>仍缺失</span>
                      <strong>{{ researchEvidenceComparison.missingCount }}</strong>
                      <small>没有用零值补齐</small>
                    </div>
                  </div>
                  <div v-if="researchEvidenceComparison.items.length" class="research-evidence-history-list">
                    <article v-for="change in researchEvidenceComparison.items" :key="change.key" class="research-evidence-history-row" :class="researchEvidenceChangeClass(change.kind)">
                      <div class="research-evidence-history-main">
                        <div class="research-evidence-history-title">
                          <strong>{{ change.label }}</strong>
                          <span>{{ change.kindLabel }}</span>
                        </div>
                        <small>{{ change.key }}</small>
                      </div>
                      <div class="research-evidence-history-values">
                        <div>
                          <small>上次</small>
                          <strong>{{ researchEvidenceHistoryValue(change, false) }}</strong>
                          <span>{{ researchEvidenceHistoryStatus(change, false) }}</span>
                        </div>
                        <ChevronRight :size="14" aria-hidden="true" />
                        <div>
                          <small>本次</small>
                          <strong>{{ researchEvidenceHistoryValue(change, true) }}</strong>
                          <span>{{ researchEvidenceHistoryStatus(change, true) }}</span>
                        </div>
                        <em v-if="change.valueDelta !== null">变化 {{ formatResearchEvidenceDelta(change) }}</em>
                      </div>
                      <p>{{ (change.current || change.previous)?.detail || '当前没有可补充的解释。' }}</p>
                    </article>
                  </div>
                  <div v-else class="research-evidence-history-state" role="status">
                    <CheckCircle2 :size="15" aria-hidden="true" />
                    <span>最近两份报告的证据状态和数值没有明显变化。</span>
                  </div>
                </template>
              </section>
              <p class="research-run-note">
                这是基于已保存数据的版本化研究快照；报告用于整理核对顺序，不是买入、卖出或收益预测。
              </p>
            </template>
            <div v-else class="research-run-state" role="status">
              <Info :size="16" aria-hidden="true" />
              <span>还没有研究运行，生成一份报告后可在这里回看证据链。</span>
            </div>
          </section>
          <section v-if="selectedCandidate" class="signal-persistence-panel" aria-label="信号持续性证据">
            <div class="signal-persistence-heading">
              <div>
                <p class="section-kicker">
                  SIGNAL PERSISTENCE
                </p>
                <h2>信号是否持续</h2>
              </div>
              <span class="candidate-persistence-state" :class="candidatePersistenceClass(selectedCandidate)">{{ candidatePersistenceLabel(selectedCandidate) }}</span>
            </div>
            <div class="signal-persistence-summary">
              <div>
                <span>出现比例</span>
                <strong>{{ formatPersistenceRate(candidatePersistenceFor(selectedCandidate).persistenceRate) }}</strong>
                <small>最近 {{ candidatePersistenceFor(selectedCandidate).sampleSize }} 次快照</small>
              </div>
              <div>
                <span>相邻分数</span>
                <strong :class="scoreDeltaClass(candidatePersistenceFor(selectedCandidate).scoreDelta)">{{ formatScoreDelta(candidatePersistenceFor(selectedCandidate).scoreDelta) }}</strong>
                <small>最新对比前次</small>
              </div>
              <div>
                <span>首末变化</span>
                <strong :class="scoreDeltaClass(candidatePersistenceFor(selectedCandidate).scoreChange)">{{ formatScoreDelta(candidatePersistenceFor(selectedCandidate).scoreChange) }}</strong>
                <small>当前窗口内</small>
              </div>
            </div>
            <div class="signal-persistence-factors">
              <div class="signal-persistence-subheading">
                <span>因子出现频次</span>
                <small>出现次数 / 快照样本</small>
              </div>
              <div v-if="candidatePersistenceFor(selectedCandidate).factorPersistence.length" class="signal-persistence-factor-list">
                <span v-for="factor in candidatePersistenceFor(selectedCandidate).factorPersistence" :key="factor.factor" class="signal-persistence-factor" :title="`${formatFactorLabel(factor.factor)}出现比例 ${formatPersistenceRate(factor.rate)}`">
                  <strong>{{ formatFactorLabel(factor.factor) }}</strong>
                  <small>{{ factor.appearances }} / {{ candidatePersistenceFor(selectedCandidate).sampleSize || '--' }}</small>
                </span>
              </div>
              <span v-else class="muted-inline">暂无可比较的历史因子</span>
            </div>
            <div class="signal-persistence-evidence">
              <div class="signal-persistence-subheading">
                <span>最近快照证据</span>
                <small>服务端已保存记录</small>
              </div>
              <div v-if="candidatePersistenceFor(selectedCandidate).evidence.length" class="signal-persistence-evidence-list">
                <div v-for="evidence in candidatePersistenceFor(selectedCandidate).evidence" :key="evidence.snapshotId" class="signal-persistence-evidence-row">
                  <span class="signal-persistence-evidence-date">{{ formatDateTime(evidence.generatedAt) }}</span>
                  <strong>{{ evidence.present ? `命中 ${formatSignalScore(evidence.score)}` : '未出现在快照' }}</strong>
                  <span v-if="evidence.present" class="signal-list signal-persistence-evidence-tags">
                    <span v-for="factor in evidence.matchedFactors" :key="`${evidence.snapshotId}-${factor}`" class="signal-tag signal-tag-teal">{{ formatFactorLabel(factor) }}</span>
                  </span>
                </div>
              </div>
              <span v-else class="muted-inline">暂无历史快照，请完成一次日线同步</span>
            </div>
            <span class="signal-persistence-note" title="持续性只描述当前观察池中已保存的快照样本；它是筛选线索，不是买入或卖出指令。" aria-label="信号持续性口径说明">
              <Info :size="15" aria-hidden="true" />
            </span>
          </section>
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
          <section v-if="decisionEvidence" class="decision-evidence-panel" aria-label="中长线决策证据链">
            <div class="decision-evidence-heading">
              <div>
                <p class="section-kicker">
                  DECISION EVIDENCE V1
                </p>
                <h2>中长线时机证据链</h2>
              </div>
              <div class="decision-evidence-score" :class="decisionEvidenceActionClass(decisionEvidence.action)">
                <strong>{{ decisionEvidence.gateScore === null ? '--' : `${decisionEvidence.gateScore}%` }}</strong>
                <span>门槛通过率</span>
              </div>
            </div>
            <div class="decision-evidence-action" :class="decisionEvidenceActionClass(decisionEvidence.action)">
              <div>
                <span>研究动作</span>
                <strong>{{ decisionEvidence.label }}</strong>
              </div>
              <p>{{ decisionEvidence.headline }}</p>
            </div>
            <div class="decision-evidence-counts" aria-label="证据链统计">
              <span><strong>{{ decisionEvidence.passedCount }}</strong> 项通过</span>
              <span><strong>{{ decisionEvidence.cautionCount }}</strong> 项注意</span>
              <span><strong>{{ decisionEvidence.failedCount }}</strong> 项未通过</span>
              <span><strong>{{ decisionEvidence.missingCount }}</strong> 项缺失</span>
            </div>
            <div class="decision-evidence-list">
              <div v-for="item in decisionEvidence.evidence" :key="item.key" class="decision-evidence-row" :class="decisionEvidenceStatusClass(item.status)">
                <div class="decision-evidence-row-main">
                  <div class="decision-evidence-row-title">
                    <strong>{{ item.label }}</strong>
                    <span>{{ decisionEvidenceStatusLabel(item.status) }}</span>
                  </div>
                  <div class="decision-evidence-values">
                    <strong>{{ item.value }}</strong>
                    <small>门槛 {{ item.threshold }}</small>
                  </div>
                  <p>{{ item.detail }}</p>
                </div>
                <div class="decision-evidence-meta">
                  <span>{{ item.source }}</span>
                  <small>{{ item.observedAt?.length === 8 ? formatEvidenceDate(item.observedAt) : item.observedAt ? formatDateTime(item.observedAt) : '未记录' }}</small>
                </div>
              </div>
            </div>
            <div class="decision-evidence-guidance">
              <div>
                <span>等待条件</span>
                <ul>
                  <li v-for="condition in decisionEvidence.waitConditions" :key="`wait-${condition}`">
                    {{ condition }}
                  </li>
                  <li v-if="!decisionEvidence.waitConditions.length">
                    当前没有额外等待条件
                  </li>
                </ul>
              </div>
              <div>
                <span>重新评估条件</span>
                <ul>
                  <li v-for="condition in decisionEvidence.reassessmentConditions" :key="`reassess-${condition}`">
                    {{ condition }}
                  </li>
                </ul>
              </div>
            </div>
            <p class="decision-evidence-note">
              公式 {{ decisionEvidence.formulaVersion }} · 这是一套可复核的研究时机框架，不是买入、卖出或收益承诺；所有门槛均基于当前观察池与已返回数据。
            </p>
          </section>
          <section class="value-quality-panel" aria-label="中长线价值质量评分">
            <div class="value-quality-heading">
              <div>
                <p class="section-kicker">
                  VALUE QUALITY V2
                </p>
                <h2>中长线价值质量</h2>
              </div>
              <span v-if="selectedValueQuality" class="section-meta">{{ valueQualityStatusLabel(selectedValueQuality) }}</span>
              <span v-else-if="selectedStock" class="section-meta">读取中</span>
            </div>
            <div v-if="loading.valueQuality" class="value-quality-state" role="status">
              <SkeletonCard variant="content" />
            </div>
            <div v-else-if="errors.valueQuality" class="value-quality-state" role="status">
              <Info :size="17" aria-hidden="true" />
              <span>价值质量暂时不可用</span>
              <button class="text-button" type="button" @click="loadValueSelection">
                重试
              </button>
            </div>
            <template v-else-if="selectedValueQuality">
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
          <section class="research-marker-editor" aria-label="研究记录">
            <div class="research-marker-heading">
              <div>
                <p class="section-kicker">
                  RESEARCH LOG
                </p>
                <h2>我的研究记录</h2>
              </div>
              <span class="section-meta">只保存你的工作状态，不影响信号分</span>
            </div>
            <div class="research-marker-form">
              <label class="research-field">
                <span>状态</span>
                <select v-model="researchFormStatus" class="field-control">
                  <option v-for="option in researchStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label class="research-field research-field-date">
                <span>复查日期</span>
                <input v-model="researchFormReviewDate" class="field-control" type="date">
              </label>
              <label class="research-field research-field-note">
                <span>备注</span>
                <textarea v-model="researchFormNote" class="field-control research-note-input" maxlength="1000" placeholder="记录需要核对的事项、假设或下一步动作" />
              </label>
              <button class="primary-button research-save-button" type="button" :disabled="researchSaving" @click="saveResearchMarker">
                <Save :size="15" aria-hidden="true" />
                {{ researchSaving ? '保存中' : '保存记录' }}
              </button>
            </div>
            <p v-if="researchSaveMessage" class="research-save-message" role="status">
              {{ researchSaveMessage }}
            </p>
            <p v-if="researchSaveError" class="research-save-error" role="alert">
              {{ parsedError(researchSaveError).message }}
            </p>
          </section>
          <div class="section-heading">
            <div>
              <p class="section-kicker">
                PRICE & DAILY DATA
              </p>
              <h2 id="daily-title" class="section-title">
                走势与日线
              </h2>
            </div>
            <span class="section-meta">{{ selectedStock?.tsCode || '未选择股票' }}</span>
          </div>
          <div
            v-if="selectedStock && researchSummary"
            class="research-summary"
            :class="`research-summary-${researchSummary.tone}`"
            aria-label="研究摘要"
          >
            <div class="research-summary-heading">
              <div>
                <p class="section-kicker">
                  RESEARCH READOUT
                </p>
                <h3>
                  研究摘要
                </h3>
              </div>
              <span
                class="status-chip"
                :class="researchSummary.tone === 'positive' ? 'status-enabled' : researchSummary.tone === 'warning' ? 'status-partial' : 'status-info'"
              >
                {{ researchSummary.label }}
              </span>
            </div>
            <p class="research-summary-headline">
              {{ researchSummary.headline }}
            </p>
            <div class="research-dimensions" aria-label="四维研究判断">
              <div
                v-for="dimension in researchSummary.dimensions"
                :key="dimension.key"
                class="research-dimension"
                :class="`research-dimension-${dimension.state}`"
              >
                <span>{{ dimension.label }}</span>
                <strong>{{ dimension.detail }}</strong>
              </div>
            </div>
            <div class="research-summary-grid">
              <div class="research-summary-column">
                <span class="research-summary-label">支持依据</span>
                <ul v-if="researchSummary.support.length">
                  <li
                    v-for="item in researchSummary.support"
                    :key="`support-${item}`"
                  >
                    {{ item }}
                  </li>
                </ul>
                <span v-else class="muted-inline">暂无明确支持依据</span>
              </div>
              <div class="research-summary-column">
                <span class="research-summary-label">需要核对</span>
                <ul v-if="researchSummary.watchouts.length">
                  <li
                    v-for="item in researchSummary.watchouts"
                    :key="`watchout-${item}`"
                  >
                    {{ item }}
                  </li>
                </ul>
                <span v-else class="muted-inline">暂未发现额外核对项</span>
              </div>
              <div class="research-summary-column">
                <span class="research-summary-label">下一步核对</span>
                <ul>
                  <li
                    v-for="item in researchSummary.nextChecks"
                    :key="`check-${item}`"
                  >
                    {{ item }}
                  </li>
                </ul>
              </div>
            </div>
            <p class="valuation-note">
              研究状态只由当前观察池可用数据生成，不代表买入、卖出或收益判断
            </p>
          </div>
          <div class="valuation-section" aria-label="估值速览">
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
            <div v-if="loading.valuation" class="valuation-state" aria-label="估值数据加载中">
              <SkeletonCard variant="content" />
            </div>
            <div v-else-if="errors.valuation" class="valuation-state" role="status">
              <Info :size="17" aria-hidden="true" />
              <span class="valuation-state-copy">估值数据暂时不可用：{{ valuationErrorMessage(errors.valuation) }}</span>
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
            <div v-else-if="valuationComparisonError && valuation" class="valuation-comparison valuation-comparison-error">
              <div class="financial-comparison-empty">
                <Info :size="15" aria-hidden="true" />
                <span>观察池相对位置暂不可用：{{ valuationErrorMessage(valuationComparisonError) }}</span>
                <button class="text-button" type="button" @click="selectedTsCode && loadValuation(selectedTsCode)">
                  重试
                </button>
              </div>
            </div>
            <p class="valuation-note">
              估值只用于同口径横向比较；相对位置仅代表当前观察池，不代表行业估值
            </p>
          </div>
          <div class="financial-section" aria-label="基本面速览">
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
                <strong>{{ formatMetricPercent(financialQuality.grossMargin) }}</strong>
              </div>
              <div class="financial-item">
                <span>净利率</span>
                <strong>{{ formatMetricPercent(financialQuality.netMargin) }}</strong>
              </div>
              <div class="financial-item">
                <span>资产负债率</span>
                <strong>{{ formatMetricPercent(financialQuality.debtAssetRatio) }}</strong>
              </div>
              <div class="financial-item">
                <span>经营现金流 / 营收</span>
                <strong>{{ formatRatioPercent(financialQuality.operatingCashflowToRevenue) }}</strong>
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
                <div class="financial-comparison-item">
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
              <div class="financial-context-grid">
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
              <p class="financial-context-note">
                这些指标用于判断现金流和偿债韧性；资本开支逐项数据、回购和分红支付率暂未接通，不进入价值质量总分。
              </p>
            </div>
            <div class="shareholder-return-panel" aria-label="股东回报">
              <div class="financial-subheading">
                <div>
                  <span class="section-kicker">SHAREHOLDER RETURNS</span>
                  <strong>股东回报</strong>
                </div>
                <small>{{ shareholderReturns?.provider === 'tushare' ? 'Tushare 分红实施记录' : '分红数据源未配置' }}</small>
              </div>
              <div v-if="loading.shareholderReturns" class="shareholder-return-state" role="status">
                <SkeletonCard variant="content" />
              </div>
              <div v-else-if="errors.shareholderReturns" class="shareholder-return-state" role="status">
                <Info :size="16" aria-hidden="true" />
                <span>股东回报暂时不可用</span>
                <button class="text-button" type="button" @click="loadShareholderReturns">
                  重试
                </button>
              </div>
              <template v-else-if="selectedShareholderReturn">
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
            </div>
            <p class="valuation-note">
              金额单位：元；比例单位：%；数据来自最近已披露报告，指标用于观察，不代表未来收益
            </p>
          </div>
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
        </section>
      </DetailDrawer>

      <DetailDrawer
        :open="comparisonDrawerOpen"
        title="候选对比"
        :description="`技术信号、估值和基本面 · ${comparisonStatusLabel}`"
        width="lg"
        @update:open="comparisonDrawerOpen = $event"
      >
        <section class="comparison-content" aria-label="候选股票对比">
          <div class="comparison-intro">
            <p class="section-kicker">
              COMPARE BEFORE RESEARCH
            </p>
            <h2>把候选放在同一张表里</h2>
            <p>先比较技术事实，再看估值和最近已披露报告。缺失数据保留为空，不生成排名。</p>
          </div>
          <div v-if="comparisonLoading" class="comparison-loading" role="status">
            正在读取估值与财务数据...
          </div>
          <div v-else class="comparison-table-wrap">
            <table class="comparison-table">
              <thead>
                <tr>
                  <th>指标</th>
                  <th v-for="item in selectedCandidateItems" :key="item.id">
                    <strong>{{ displayStockName(item) }}</strong>
                    <small>{{ item.tsCode }}</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr class="comparison-group-row">
                  <th :colspan="selectedCandidateItems.length + 1">
                    技术信号
                  </th>
                </tr>
                <tr>
                  <th>信号覆盖</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-score`">
                    {{ formatSignalScore(item.score) }}
                  </td>
                </tr>
                <tr>
                  <th>20 日表现</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-return20`" :class="item.return20 === null ? 'text-status-neutral' : item.return20 >= 0 ? 'text-status-success' : 'text-status-danger'">
                    {{ formatPercent(item.return20) }}
                  </td>
                </tr>
                <tr>
                  <th>20 日均线</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-ma20`">
                    {{ formatNumber(item.ma20) }}
                  </td>
                </tr>
                <tr>
                  <th>成交活跃度</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-volume`">
                    {{ formatNumber(item.volumeRatio) }}
                  </td>
                </tr>
                <tr>
                  <th>池内强度</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-strength`">
                    {{ formatNumber(item.relativeStrength) }}
                  </td>
                </tr>
                <tr class="comparison-group-row">
                  <th :colspan="selectedCandidateItems.length + 1">
                    估值快照
                  </th>
                </tr>
                <tr>
                  <th>TTM PE</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-pe`">
                    {{ comparisonErrors[item.tsCode]?.valuation ? '暂不可用' : formatNumber(comparisonValuations[item.tsCode]?.peTtm ?? null) }}
                  </td>
                </tr>
                <tr>
                  <th>PB</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-pb`">
                    {{ comparisonErrors[item.tsCode]?.valuation ? '暂不可用' : formatNumber(comparisonValuations[item.tsCode]?.pb ?? null) }}
                  </td>
                </tr>
                <tr class="comparison-group-row">
                  <th :colspan="selectedCandidateItems.length + 1">
                    基本面快照
                  </th>
                </tr>
                <tr>
                  <th>营收同比</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-revenue`">
                    {{ comparisonErrors[item.tsCode]?.financial ? '暂不可用' : formatPercent(comparisonFinancials[item.tsCode]?.revenueYoY ?? null) }}
                  </td>
                </tr>
                <tr>
                  <th>净利润同比</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-profit`">
                    {{ comparisonErrors[item.tsCode]?.financial ? '暂不可用' : formatPercent(comparisonFinancials[item.tsCode]?.netProfitYoY ?? null) }}
                  </td>
                </tr>
                <tr>
                  <th>ROE</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-roe`">
                    {{ comparisonErrors[item.tsCode]?.financial ? '暂不可用' : formatMetricPercent(comparisonFinancials[item.tsCode]?.roe ?? null) }}
                  </td>
                </tr>
                <tr>
                  <th>资产负债率</th><td v-for="item in selectedCandidateItems" :key="`${item.id}-debt`">
                    {{ comparisonErrors[item.tsCode]?.financial ? '暂不可用' : formatMetricPercent(comparisonFinancials[item.tsCode]?.debtAssetRatio ?? null) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <section class="comparison-research-panel" aria-labelledby="comparison-research-title">
            <div class="comparison-research-heading">
              <div>
                <p class="section-kicker">
                  RESEARCH RUNS
                </p>
                <h3 id="comparison-research-title">
                  批量进入研究
                </h3>
                <p>为当前选中的候选分别生成研究快照，结果会保留在各自的研究历史中。</p>
              </div>
              <button class="primary-button comparison-research-button" type="button" :disabled="!canCompareCandidates || comparisonLoading || comparisonResearchRunning" @click="startBatchResearch">
                <RotateCcw :size="15" :class="comparisonResearchRunning ? 'animate-spin' : ''" aria-hidden="true" />
                {{ comparisonResearchButtonLabel }}
              </button>
            </div>
            <div class="comparison-research-list" role="list" aria-live="polite">
              <div v-for="item in selectedCandidateItems" :key="`research-${item.id}`" class="comparison-research-item" :class="comparisonResearchStateClass(comparisonResearchStateFor(item))" role="listitem">
                <div class="comparison-research-stock">
                  <strong>{{ displayStockName(item) }}</strong>
                  <small>{{ item.tsCode }}</small>
                </div>
                <div class="comparison-research-detail">
                  <span>{{ comparisonResearchStatusLabel(comparisonResearchStateFor(item)) }}</span>
                  <small>{{ comparisonResearchStatusDetail(comparisonResearchStateFor(item)) }}</small>
                </div>
                <div class="comparison-research-actions">
                  <button
                    v-if="comparisonResearchActionFor(item) === 'view'"
                    class="text-button comparison-research-action"
                    type="button"
                    :aria-label="`查看 ${displayStockName(item)} 的研究详情`"
                    title="重新读取并打开研究详情"
                    @click="openBatchResearchResult(item)"
                  >
                    <Eye :size="14" aria-hidden="true" />
                    查看详情
                  </button>
                  <button
                    v-else-if="comparisonResearchActionFor(item) === 'retry'"
                    class="text-button comparison-research-action"
                    type="button"
                    :disabled="comparisonResearchRunning"
                    :aria-label="`重试 ${displayStockName(item)} 的研究`"
                    title="只重试这一只股票"
                    @click="retryBatchResearchItem(item)"
                  >
                    <RotateCcw :size="14" aria-hidden="true" />
                    单项重试
                  </button>
                </div>
              </div>
            </div>
            <p class="comparison-research-summary" role="status">
              {{ comparisonResearchSummaryLabel }}
            </p>
          </section>
          <p class="comparison-note">
            估值和财务指标来自当前接口的最近可用快照；不同报告期不做强行横比。
          </p>
        </section>
      </DetailDrawer>

      <footer class="quant-footer">
        <span><BarChart3 :size="14" aria-hidden="true" /> 数据口径：日线收盘价</span>
        <span>信号用于观察与比较，不代表未来收益</span>
      </footer>
    </main>
  </div>
</template>
