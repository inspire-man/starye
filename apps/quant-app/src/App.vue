<script setup lang="ts">
import type { Column, ErrorType, ParsedError } from '@starye/ui'
import type {
  CandidateItem,
  CandidateSnapshot,
  DailyBar,
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantResearchMarker,
  QuantValuationComparison,
  QuantValuationSnapshot,
  ResearchMarkerStatus,
  SyncResult,
  SyncStatus,
  WatchlistItem,
} from './lib/quant-types'
import type { ResearchReviewMeta } from './lib/research-review'
import type { CandidateResearchMetadata, CandidateResearchStatus, CandidateReviewFilter, CandidateSortKey, SelectionPresetKey } from './lib/selection-presets'
import { ConfirmDialog, DataTable, DetailDrawer, ErrorDisplay, SkeletonCard } from '@starye/ui'
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
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
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { quantApi, QuantApiError } from './lib/api-client'
import { getResearchReviewMeta, getReviewDueRank, getTodayDate } from './lib/research-review'
import { buildResearchSummary } from './lib/research-summary'
import { filterAndSortCandidates, selectionPresets } from './lib/selection-presets'
import { buildTrendStructure } from './lib/trend-analysis'

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
const researchMarkers = ref<QuantResearchMarker[]>([])
const selectedCandidateIds = ref<Set<string>>(new Set())
const comparisonDrawerOpen = ref(false)
const comparisonLoading = ref(false)
const comparisonValuations = ref<Record<string, QuantValuationSnapshot | null>>({})
const comparisonFinancials = ref<Record<string, QuantFinancialQualitySnapshot | null>>({})
const comparisonErrors = ref<Record<string, { valuation: boolean, financial: boolean }>>({})
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
let valuationRequestId = 0
let financialRequestId = 0
const loading = reactive({
  watchlist: false,
  candidates: false,
  daily: false,
  valuation: false,
  financial: false,
  research: false,
  sync: false,
})
const errors = reactive<Record<'watchlist' | 'candidates' | 'daily' | 'valuation' | 'financial' | 'research' | 'action', unknown | null>>({
  watchlist: null,
  candidates: null,
  daily: null,
  valuation: null,
  financial: null,
  research: null,
  action: null,
})
const deletingCode = ref<string | null>(null)
const pendingDeleteCode = ref<string | null>(null)
const adding = ref(false)
const candidateFilter = ref<SelectionPresetKey>('balanced')
const candidateMinScore = ref(0)
const candidateCompleteOnly = ref(false)
const candidateSort = ref<CandidateSortKey>('score')
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

const selectedStock = computed(() => watchlist.value.find(item => item.tsCode === selectedTsCode.value) || null)
const candidateItems = computed(() => snapshot.value?.candidates || [])
const activeCandidatePreset = computed(() => candidateFilterOptions.find(option => option.key === candidateFilter.value) || candidateFilterOptions[0])
const todayDate = computed(() => getTodayDate())
const filteredCandidateItems = computed(() => filterAndSortCandidates(candidateItems.value, {
  preset: candidateFilter.value,
  minScore: candidateMinScore.value,
  completeOnly: candidateCompleteOnly.value,
  sortBy: candidateSort.value,
  researchStatus: candidateResearchStatus.value,
  reviewDue: candidateReviewDue.value,
}, new Map<string, CandidateResearchMetadata>(researchMarkers.value.map(marker => [marker.tsCode, {
  status: marker.status,
  reviewDate: marker.reviewDate,
}])), todayDate.value))
const candidateQueryActive = computed(() => candidateMinScore.value > 0 || candidateCompleteOnly.value || candidateSort.value !== 'score' || candidateResearchStatus.value !== 'all' || candidateReviewDue.value !== 'all')
const canSync = computed(() => Boolean(watchlist.value.length > 0 && !loading.sync))
const pageBusy = computed(() => loading.watchlist || loading.candidates)
const overallError = computed(() => errors.watchlist || errors.candidates || errors.research)
const deleteDialogMessage = computed(() => pendingDeleteCode.value ? `确认从观察池移除 ${pendingDeleteCode.value}？` : '')
const latestDate = computed(() => {
  const dates = dailyBars.value.map(item => item.tradeDate).filter(Boolean)
  return formatTradeDate(dates.at(-1) || snapshot.value?.toDate || null)
})
const selectedCandidate = computed(() => candidateItems.value.find(item => item.tsCode === selectedTsCode.value) || null)
const researchMarkerMap = computed(() => new Map(researchMarkers.value.map(marker => [marker.tsCode, marker])))
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
const latestDailyBar = computed(() => dailyBars.value.at(-1) || null)
const latestWatchlistDate = computed(() => {
  const dates = watchlist.value.map(item => item.latestTradeDate).filter((date): date is string => Boolean(date))
  return formatTradeDate([...dates].sort().at(-1) || snapshot.value?.toDate || null)
})
const upCount = computed(() => watchlist.value.filter(item => item.latestChangePercent !== null && item.latestChangePercent >= 0).length)
const downCount = computed(() => watchlist.value.filter(item => item.latestChangePercent !== null && item.latestChangePercent < 0).length)
const signalCandidateCount = computed(() => candidateItems.value.filter(item => item.signals.length > 0).length)
const dataCoverageCount = computed(() => watchlist.value.filter(item => item.barCount > 0 || item.latestTradeDate !== null).length)
const dataCoverageLabel = computed(() => watchlist.value.length ? `${dataCoverageCount.value} / ${watchlist.value.length}` : '--')
const topCandidates = computed(() => [...candidateItems.value]
  .sort((left, right) => (right.score ?? -1) - (left.score ?? -1))
  .slice(0, 3))
const reviewQueueItems = computed(() => researchMarkers.value
  .flatMap((marker) => {
    const stock = watchlist.value.find(item => item.tsCode === marker.tsCode)
    return stock ? [{ marker, stock, review: researchReviewMap.value.get(marker.tsCode) || getResearchReviewMeta(null, todayDate.value) }] : []
  })
  .filter(item => item.marker.status !== 'excluded' && ['overdue', 'today', 'upcoming'].includes(item.review.state))
  .sort((left, right) => {
    const dueRank = getReviewDueRank(left.review.state) - getReviewDueRank(right.review.state)
    if (dueRank !== 0)
      return dueRank
    return (left.review.date || '9999-12-31').localeCompare(right.review.date || '9999-12-31') || left.stock.tsCode.localeCompare(right.stock.tsCode)
  }))
const reviewQueueTotal = computed(() => reviewQueueItems.value.length)
const visibleReviewQueue = computed(() => reviewQueueItems.value.slice(0, 5))
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
  { key: 'name', label: '名称', minWidth: '130px', render: item => item.name || '未命名' },
  { key: 'latestClose', label: '最新价', width: '92px', render: item => formatNumber(item.latestClose) },
  { key: 'latestChangePercent', label: '涨跌幅', width: '92px', render: item => formatPercent(item.latestChangePercent) },
  { key: 'latestTradeDate', label: '数据截至', width: '120px', render: item => formatTradeDate(item.latestTradeDate) },
  { key: 'barCount', label: '覆盖天数', width: '90px', render: item => String(item.barCount) },
  { key: 'actions', label: '操作', width: '80px', minWidth: '80px' },
]

const candidateColumns: Column<CandidateItem>[] = [
  { key: 'tsCode', label: '代码', minWidth: '135px' },
  { key: 'name', label: '名称', minWidth: '120px', render: item => displayStockName(item) },
  { key: 'score', label: '信号分', width: '88px', render: item => formatNumber(item.score) },
  { key: 'return20', label: '20日表现', width: '92px', render: item => formatPercent(item.return20) },
  { key: 'ma20', label: '20日均线', width: '96px', render: item => formatNumber(item.ma20) },
  { key: 'volumeRatio', label: '成交活跃度', width: '108px', render: item => formatNumber(item.volumeRatio) },
  { key: 'relativeStrength', label: '池内强度', width: '98px', render: item => formatNumber(item.relativeStrength) },
  { key: 'review', label: '复查', width: '118px', minWidth: '110px' },
  { key: 'signals', label: '信号', width: '260px', minWidth: '240px' },
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

function formatNumber(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function formatSignalScore(value: number | null): string {
  return value === null ? '--' : `${value} / ${SIGNAL_RULE_COUNT}`
}

function signalScorePercent(value: number | null): number {
  if (value === null)
    return 0
  return Math.min(100, Math.max(0, (value / SIGNAL_RULE_COUNT) * 100))
}

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
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

function formatComparisonPosition(value: number | null): string {
  return value === null ? '暂无足够样本' : `高于观察池 ${value}%`
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
  return item.name || watchlist.value.find(stock => stock.tsCode === item.tsCode)?.name || item.tsCode
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
  if (item.newHigh20)
    return '趋势走强'
  if (item.upStreak !== null && item.upStreak >= 3)
    return `连续上涨 ${item.upStreak} 日`
  if (item.volumeRatio !== null && item.volumeRatio >= 1.2)
    return '成交活跃'
  if (item.relativeStrength !== null && item.relativeStrength >= 0.5)
    return '池内相对更强'
  return item.quality === 'ready' ? '数据完整' : '数据待补齐'
}

function focusTone(item: CandidateItem): string {
  if (item.quality !== 'ready')
    return 'focus-tone-warning'
  return item.signals.length > 0 ? 'focus-tone-positive' : 'focus-tone-neutral'
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
  candidateSort.value = 'score'
  candidateResearchStatus.value = 'all'
  candidateReviewDue.value = 'all'
}

async function loadWatchlist() {
  loading.watchlist = true
  errors.watchlist = null
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

async function loadWorkspace() {
  errors.action = null
  await Promise.all([loadWatchlist(), loadCandidates(), loadResearchMarkers()])
}

function selectStock(item: Pick<WatchlistItem, 'tsCode' | 'name'>) {
  selectedTsCode.value = item.tsCode
  syncResearchForm(item.tsCode)
  detailDrawerOpen.value = true
  void Promise.all([loadDailyBars(item.tsCode), loadValuation(item.tsCode), loadFinancialQuality(item.tsCode)])
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
    await quantApi.addWatchlist({ tsCode, name })
    watchCode.value = ''
    watchName.value = ''
    await Promise.all([loadWatchlist(), loadResearchMarkers()])
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
    await loadCandidates()
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
  }
  catch (error) {
    errors.action = error
  }
  finally {
    loading.sync = false
  }
}

onMounted(loadWorkspace)
</script>

<template>
  <div class="quant-shell min-h-screen">
    <main class="quant-page">
      <header class="quant-header">
        <div class="min-w-0">
          <p class="quant-eyebrow">
            STARYE / STOCK SELECTION
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <h1 class="quant-title">
              择股工作台
            </h1>
          </div>
          <p class="quant-subtitle">
            用可解释的日线信号筛出值得继续研究的标的
          </p>
        </div>
        <div class="quant-header-actions">
          <div class="header-metric">
            <span class="header-metric-label">数据截至</span>
            <strong>{{ latestWatchlistDate }}</strong>
          </div>
          <button class="icon-button" type="button" title="刷新工作台" aria-label="刷新工作台" :disabled="pageBusy" @click="loadWorkspace">
            <RefreshCw :size="17" :class="pageBusy ? 'animate-spin' : ''" aria-hidden="true" />
          </button>
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
              <span class="focus-signal">{{ focusSignal(item) }}</span>
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
            <p class="risk-footnote">
              <Info :size="13" aria-hidden="true" />
              信号是筛选线索，不是买入指令
            </p>
          </aside>
        </div>
      </section>

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
          <div class="snapshot-meta">
            <span>数据截至 {{ formatTradeDate(snapshot?.toDate || null) }}</span>
            <span>计算 {{ formatDateTime(snapshot?.generatedAt || null) }}</span>
          </div>
        </div>
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
        </div>
        <div v-if="snapshot && snapshot.candidates.length" class="snapshot-range">
          <span>观察窗口</span>
          <strong>{{ formatTradeDate(snapshot.fromDate || null) }} → {{ formatTradeDate(snapshot.toDate || null) }}</strong>
          <span class="snapshot-range-divider">·</span>
          <span>{{ snapshot.factorVersion || '动量信号' }}</span>
        </div>
        <section v-if="reviewQueueTotal" class="review-queue" aria-labelledby="review-queue-title">
          <div class="review-queue-heading">
            <div>
              <p class="section-kicker">
                REVIEW QUEUE
              </p>
              <h3 id="review-queue-title">
                复查到期队列
              </h3>
            </div>
            <span class="review-queue-count">{{ reviewQueueTotal }} 条待处理</span>
          </div>
          <div class="review-queue-list">
            <button
              v-for="item in visibleReviewQueue"
              :key="item.marker.tsCode"
              class="review-queue-row"
              type="button"
              @click="selectStock(item.stock)"
            >
              <span class="review-state-badge" :class="`review-state-${item.review.state}`">{{ item.review.label }}</span>
              <span class="review-queue-stock">
                <strong>{{ item.stock.name || item.stock.tsCode }}</strong>
                <small>{{ item.stock.tsCode }} · {{ researchStatusOptions.find(option => option.value === item.marker.status)?.label }}</small>
              </span>
              <span class="review-queue-detail">{{ item.review.detail }}</span>
              <ChevronRight :size="15" aria-hidden="true" />
            </button>
          </div>
          <p v-if="reviewQueueTotal > visibleReviewQueue.length" class="review-queue-more">
            还有 {{ reviewQueueTotal - visibleReviewQueue.length }} 条记录，请使用复查筛选继续查看
          </p>
        </section>
        <div class="quant-table-frame candidate-table-frame">
          <DataTable
            :data="filteredCandidateItems"
            :columns="candidateColumns"
            :loading="loading.candidates"
            selectable
            :selected-ids="selectedCandidateIds"
            min-width="1160px"
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
            <template #cell-review="{ item }">
              <div class="review-cell" :title="researchReviewFor(item.tsCode).detail" :aria-label="`${researchReviewFor(item.tsCode).label}，${researchReviewFor(item.tsCode).date || '未设置日期'}`">
                <span class="review-cell-label" :class="`review-state-text-${researchReviewFor(item.tsCode).state}`">{{ researchReviewFor(item.tsCode).label }}</span>
                <small>{{ researchReviewFor(item.tsCode).date || '--' }}</small>
              </div>
            </template>
            <template #cell-signals="{ item }">
              <div class="signal-list candidate-signal-list">
                <span v-if="researchMarkerMap.get(item.tsCode)?.status && researchMarkerMap.get(item.tsCode)?.status !== 'unreviewed'" class="research-status-dot" :class="`research-status-${researchMarkerMap.get(item.tsCode)?.status}`" :title="researchStatusOptions.find(option => option.value === researchMarkerMap.get(item.tsCode)?.status)?.label" aria-hidden="true" />
                <span v-for="signal in item.signals" :key="signal" class="signal-tag signal-tag-teal">{{ formatFactorLabel(signal) }}</span>
                <span v-if="item.quality !== 'ready'" class="signal-tag signal-tag-muted">数据不足</span>
                <span v-if="!item.signals.length && item.quality === 'ready'" class="muted-inline">暂无明确信号</span>
              </div>
            </template>
          </DataTable>
        </div>
      </section>

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
            <p class="decision-card-note">
              技术信号用于缩小研究范围；估值和财务数据需要结合报告期与样本完整度人工核对。
            </p>
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
