<script setup lang="ts">
import type { Column, ErrorType, ParsedError } from '@starye/ui'
import type { CandidateEvidenceScore } from './lib/candidate-evidence-score'
import type { QuantDataHealthAction, QuantDataHealthFreshness, QuantDataHealthStatus } from './lib/data-health'
import type { DecisionEvidenceStatus } from './lib/decision-evidence'
import type { QuantView } from './lib/quant-view'
import type {
  CandidateItem,
  CandidateSignalPersistence,
  CandidateSnapshot,
  DailyBar,
  QuantAiCandidateBriefing,
  QuantAiCandidateBriefingQuestion,
  QuantAiResponseMode,
  QuantAiRunAudit,
  QuantAiSummaryStreamProgress,
  QuantDecisionAssistant,
  QuantDecisionRecord,
  QuantDecisionRecordAction,
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantResearchChangeExplanation,
  QuantResearchComparison,
  QuantResearchComparisonCitation,
  QuantResearchEvidence,
  QuantResearchMarker,
  QuantResearchQuestion,
  QuantResearchRun,
  QuantResearchSummary,
  QuantShareholderReturnItem,
  QuantValuationComparison,
  QuantValuationSnapshot,
  QuantValueQualityDimension,
  QuantValueQualityItem,
  ResearchMarkerStatus,
  SyncResult,
  WatchlistItem,
} from './lib/quant-view-models'
import type { AutomatedResearchCandidate, AutomatedResearchItemState } from './lib/research-automation'
import type { BatchResearchProgress } from './lib/research-batch'
import type { BatchAiSummaryProgress, BatchAiSummaryState } from './lib/research-batch-ai-summary'
import type { BatchResearchFollowUpState } from './lib/research-batch-follow-up'
import type { ResearchBatchStateSource } from './lib/research-batch-history'
import type { ResearchEvidenceChange } from './lib/research-evidence-history'
import type { ResearchPriority, ResearchPriorityValueQuality } from './lib/research-priority'
import type { ResearchReportCopyResult } from './lib/research-report-copy'
import type { ResearchReviewMeta } from './lib/research-review'
import type { ResearchRunScoreDirection } from './lib/research-run-timeline'
import type { CandidateResearchMetadata, CandidateResearchStatus, CandidateReviewFilter, CandidateSortKey } from './lib/selection-presets'
import type { TimingHistoryBucket } from './lib/timing-history'
import type { TimingWindow, TimingWindowMetricStatus, TimingWindowState } from './lib/timing-window'
import type { WatchlistEnvironmentStatus } from './lib/watchlist-environment'
import { DetailDrawer } from '@starye/ui'
import {
  ArrowUpRight,
  Filter,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import QuantAiSettingsDrawer from './components/QuantAiSettingsDrawer.vue'
import QuantFactorSettingsDrawer from './components/QuantFactorSettingsDrawer.vue'
import QuantOverviewView from './components/QuantOverviewView.vue'
import QuantShell from './components/QuantShell.vue'
import { useQuantWorkspace } from './composables/use-quant-workspace'
import { quantApi, QuantApiError } from './lib/api-client'
import { buildCandidateAiBriefingFilename, buildCandidateAiBriefingMarkdown } from './lib/candidate-briefing-export'
import { buildCandidateBriefingScopeKey, canApplyCandidateBriefingResponse } from './lib/candidate-briefing-scope'
import { buildCandidateEvidenceScore } from './lib/candidate-evidence-score'
import { buildResearchComparisonFilename, buildResearchComparisonMarkdown } from './lib/comparison-ai-export'
import { buildComparisonAiNextCheckPrompt } from './lib/comparison-ai-prompts'
import { buildQuantDataHealth, classifyQuantDataHealthFreshness, mergeQuantDataHealthFreshness } from './lib/data-health'
import { buildDecisionEvidence } from './lib/decision-evidence'
import { isQuantAiAutoReviewReady } from './lib/research-ai-auto-review'
import {
  applyAutomatedResearchProgress,
  initialAutomatedResearchStates,
  markAutomatedResearchItemPending,
  runAutomatedResearch,
} from './lib/research-automation'
import { runResearchBatch } from './lib/research-batch'
import {
  applyBatchAiSummaryProgress,
  idleBatchAiSummaryState,
  markBatchAiSummaryItemPending,
  runResearchAiSummaryBatch,
} from './lib/research-batch-ai-summary'
import { buildResearchBatchFilename, buildResearchBatchMarkdown } from './lib/research-batch-export'
import { applyBatchResearchProgress, getBatchResearchItemAction, markBatchResearchItemPending } from './lib/research-batch-follow-up'
import { hydrateResearchBatchState } from './lib/research-batch-history'
import { buildResearchChangeNextCheckPrompt } from './lib/research-change-prompts'
import { buildResearchEvidenceComparison } from './lib/research-evidence-history'
import { buildResearchPriority, compareResearchPriorities, summarizeResearchPriorities } from './lib/research-priority'
import { copyResearchReportMarkdown } from './lib/research-report-copy'
import { buildResearchReportFilename, buildResearchReportMarkdown } from './lib/research-report-export'
import { getResearchReviewMeta, getTodayDate } from './lib/research-review'
import { buildResearchRunTimeline } from './lib/research-run-timeline'
import { buildResearchSummary } from './lib/research-summary'
import { buildResearchSummaryNextCheckPrompt } from './lib/research-summary-prompts'
import { filterAndSortCandidates, selectionPresets } from './lib/selection-presets'
import { buildTimingHistory } from './lib/timing-history'
import { buildTimingWindow } from './lib/timing-window'
import { buildTrendStructure } from './lib/trend-analysis'
import { buildWatchlistEnvironment } from './lib/watchlist-environment'
import { useQuantCandidatesStore } from './stores/quant-candidates'
import { useQuantNavigationStore } from './stores/quant-navigation'
import { useQuantWorkspaceLifecycleStore } from './stores/quant-workspace-lifecycle'

const QuantCandidatesView = defineAsyncComponent(() => import('./components/QuantCandidatesView.vue'))
const QuantComparisonView = defineAsyncComponent(() => import('./components/QuantComparisonView.vue'))
const QuantKnowledgeView = defineAsyncComponent(() => import('./components/QuantKnowledgeView.vue'))
const QuantResearchDetailView = defineAsyncComponent(() => import('./components/QuantResearchDetailView.vue'))
const QuantWatchlistView = defineAsyncComponent(() => import('./components/QuantWatchlistView.vue'))

type ComparisonResearchItemState = BatchResearchFollowUpState
type ResearchReportCopyOutcome = 'success' | 'error' | null

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
const researchRuns = ref<QuantResearchRun[]>([])
const researchDecisionRecord = ref<QuantDecisionRecord | null>(null)
const researchDecisionHistory = ref<QuantDecisionRecord[]>([])
const researchDecisionLoading = ref(false)
const researchDecisionHistoryLoading = ref(false)
const researchDecisionSaving = ref(false)
const researchDecisionLoadError = ref<unknown | null>(null)
const researchDecisionHistoryError = ref<unknown | null>(null)
const researchDecisionSaveError = ref<unknown | null>(null)
const researchDecisionSaveMessage = ref('')
const decisionAssistant = ref<QuantDecisionAssistant | null>(null)
const decisionAssistantHistory = ref<QuantDecisionAssistant[]>([])
const decisionAssistantLoading = ref(false)
const decisionAssistantGenerating = ref(false)
const decisionAssistantError = ref<unknown | null>(null)
const decisionAssistantAiConfigAvailable = ref<boolean | null>(null)
const automatedResearchTargets = ref<AutomatedResearchCandidate[]>([])
const automatedResearchStates = ref<Record<string, AutomatedResearchItemState>>({})
const automatedResearchRunning = ref(false)
const automatedResearchError = ref<unknown | null>(null)
const automatedResearchAiReady = ref<boolean | null>(null)
const automatedResearchAiConfigError = ref<unknown | null>(null)
const researchAiSummary = ref<QuantResearchSummary | null>(null)
const researchRunLoading = ref(false)
const researchRunGenerating = ref(false)
const researchRunError = ref<unknown | null>(null)
const researchSummaryLoading = ref(false)
const researchSummaryGenerating = ref(false)
const researchSummaryError = ref<unknown | null>(null)
const researchSummaryStreamMode = ref<QuantAiResponseMode | null>(null)
const researchSummaryStreamReceivedChars = ref(0)
const researchAiAudits = ref<QuantAiRunAudit[]>([])
const researchAiAuditsLoading = ref(false)
const researchAiAuditError = ref<unknown | null>(null)
const researchQuestionInput = ref('')
const researchQuestion = ref<QuantResearchQuestion | null>(null)
const researchQuestionLoading = ref(false)
const researchQuestionError = ref<unknown | null>(null)
const researchQuestionPanel = ref<{ useQuestionPrompt: (prompt: string) => void } | null>(null)
const researchChangeExplanation = ref<QuantResearchChangeExplanation | null>(null)
const researchChangeExplanationGenerating = ref(false)
const researchChangeExplanationError = ref<unknown | null>(null)
const candidateAiBriefing = ref<QuantAiCandidateBriefing | null>(null)
const candidateAiBriefingLoading = ref(false)
const candidateAiBriefingError = ref<unknown | null>(null)
const candidateAiBriefingQuestionInput = ref('')
const candidateAiBriefingQuestion = ref<QuantAiCandidateBriefingQuestion | null>(null)
const candidateAiBriefingQuestionLoading = ref(false)
const candidateAiBriefingQuestionError = ref<unknown | null>(null)
const candidateAiBriefingPanel = ref<{ useQuestionPrompt: (prompt: string) => void } | null>(null)
const candidateAiBriefingCopying = ref(false)
const candidateAiBriefingCopyOutcome = ref<ResearchReportCopyOutcome>(null)
const candidateAiBriefingCopyMessage = ref('')
const candidateAiBriefingScopeCount = ref<number | null>(null)
const candidateAiBriefingHistoryResetKey = ref(0)
const researchReportCopying = ref(false)
const researchReportCopyOutcome = ref<ResearchReportCopyOutcome>(null)
const researchReportCopyMessage = ref('')
const comparisonDrawerOpen = ref(false)
const comparisonLoading = ref(false)
const comparisonValuations = ref<Record<string, QuantValuationSnapshot | null>>({})
const comparisonFinancials = ref<Record<string, QuantFinancialQualitySnapshot | null>>({})
const comparisonErrors = ref<Record<string, { valuation: boolean, financial: boolean }>>({})
const comparisonResearchRunning = ref(false)
const comparisonResearchStates = ref<Record<string, ComparisonResearchItemState>>({})
const comparisonResearchHistoryLoading = ref<Record<string, boolean>>({})
const comparisonResearchHistoryErrors = ref<Record<string, unknown | null>>({})
const comparisonResearchHistorySources = ref<Record<string, ResearchBatchStateSource | undefined>>({})
const comparisonResearchExporting = ref(false)
const comparisonResearchExportMessage = ref('')
const comparisonResearchExportError = ref(false)
const comparisonResearchCopying = ref(false)
const comparisonResearchCopyOutcome = ref<ResearchReportCopyOutcome>(null)
const comparisonResearchCopyMessage = ref('')
const comparisonResearchAiSummaryRunning = ref(false)
const comparisonResearchAiSummaryStates = ref<Record<string, BatchAiSummaryState>>({})
const comparisonResearchAiSummaryMessage = ref('')
const comparisonResearchAiSummaryError = ref(false)
const comparisonAiComparison = ref<QuantResearchComparison | null>(null)
const comparisonAiComparisonLoading = ref(false)
const comparisonAiComparisonError = ref<unknown | null>(null)
const comparisonAiEvidenceTarget = ref<QuantResearchComparisonCitation | null>(null)
const comparisonAiComparisonExporting = ref(false)
const comparisonAiComparisonExportMessage = ref('')
const comparisonAiComparisonExportError = ref(false)
const comparisonAiComparisonCopying = ref(false)
const comparisonAiComparisonCopyOutcome = ref<ResearchReportCopyOutcome>(null)
const comparisonAiComparisonCopyMessage = ref('')
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
const factorSettingsOpen = ref(false)
let valuationRequestId = 0
let financialRequestId = 0
let researchRunRequestId = 0
let researchDecisionRequestId = 0
let decisionAssistantRequestId = 0
let researchSummaryRequestId = 0
let researchQuestionRequestId = 0
let researchChangeExplanationRequestId = 0
let candidateAiBriefingRequestId = 0
let candidateAiBriefingQuestionRequestId = 0
let candidateAiBriefingCopyRequestId = 0
let researchReportCopyRequestId = 0
let comparisonResearchCopyRequestId = 0
let comparisonResearchAiSummaryRequestId = 0
let comparisonAiComparisonRequestId = 0
let comparisonAiComparisonCopyRequestId = 0
let comparisonResearchHistoryRequestId = 0
const comparisonResearchHistoryRequestIds = new Map<string, number>()
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
  syncState: false,
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
const {
  decisionQueueRecords,
  decisionQueueLoading,
  decisionQueueError,
  valueSelection,
  shareholderReturns,
  investmentKnowledge,
  researchMarkers,
  syncState,
  syncStateError,
  loadDecisionQueue,
  loadValueSelection,
  invalidateValueSelection,
  loadShareholderReturns,
  invalidateShareholderReturns,
  loadInvestmentKnowledge,
  loadSyncState,
  loadResearchMarkers,
  cancelWorkspaceRequests,
} = useQuantWorkspace({ loading, errors })
const deletingCode = ref<string | null>(null)
const pendingDeleteCode = ref<string | null>(null)
const adding = ref(false)
const candidatesStore = useQuantCandidatesStore()
const {
  candidateFilter,
  candidateMinScore,
  candidateCompleteOnly,
  candidateSort,
  candidateResearchStatus,
  candidateReviewDue,
  selectedCandidateIds,
} = storeToRefs(candidatesStore)
const navigationStore = useQuantNavigationStore()
const workspaceLifecycleStore = useQuantWorkspaceLifecycleStore()
const activeView = computed(() => navigationStore.activeView)
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
const currentCandidateCodes = computed(() => candidateItems.value.map(item => item.tsCode))
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
const candidateBriefingScopeItems = computed(() => filteredCandidateItems.value.filter(item => !item.pendingSync))
const candidateBriefingScopeCodes = computed(() => candidateBriefingScopeItems.value.map(item => item.tsCode))
const candidateBriefingScopeKey = computed(() => buildCandidateBriefingScopeKey(candidateBriefingScopeCodes.value))
const candidateQueryActive = computed(() => candidateMinScore.value > 0 || candidateCompleteOnly.value || candidateSort.value !== 'researchPriority' || candidateResearchStatus.value !== 'all' || candidateReviewDue.value !== 'all')
const canSync = computed(() => Boolean(watchlist.value.length > 0 && !loading.sync))
const displayedSyncResult = computed(() => syncResult.value || syncState.value)
const displayedSyncResultMessage = computed(() => {
  const result = displayedSyncResult.value
  if (!result)
    return ''
  if (result.reason)
    return result.reason
  if (result.status === 'partial')
    return '部分完成，仍有数据未写入'
  if (result.status === 'rejected')
    return '同步请求已拒绝'
  return syncResult.value ? '已完成本次同步请求' : '最近一次同步已完成'
})
const displayedSyncResultTime = computed(() => displayedSyncResult.value?.completedAt || displayedSyncResult.value?.startedAt || null)
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
const researchQuestionConfigurationError = computed(() => researchQuestionError.value instanceof QuantApiError && researchQuestionError.value.code === 'QUANT_AI_QUESTION_CONFIGURATION')
const researchQuestionPromptReady = computed(() => Boolean(
  latestResearchReport.value
  && researchQuestionPanel.value
  && !researchRunGenerating.value
  && !researchQuestionLoading.value,
))
const researchChangeExplanationConfigurationError = computed(() => researchChangeExplanationError.value instanceof QuantApiError && researchChangeExplanationError.value.code === 'QUANT_AI_CHANGE_EXPLANATION_CONFIGURATION')
const candidateAiBriefingConfigurationError = computed(() => candidateAiBriefingError.value instanceof QuantApiError && candidateAiBriefingError.value.code === 'QUANT_AI_CANDIDATE_BRIEFING_CONFIGURATION')
const candidateAiBriefingQuestionConfigurationError = computed(() => candidateAiBriefingQuestionError.value instanceof QuantApiError && candidateAiBriefingQuestionError.value.code === 'QUANT_AI_CANDIDATE_BRIEFING_QUESTION_CONFIGURATION')
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
const automatedResearchCandidates = computed<AutomatedResearchCandidate[]>(() => {
  const source = selectedCandidateItems.value.length ? selectedCandidateItems.value : filteredCandidateItems.value
  return source.slice(0, 3).map(item => ({ tsCode: item.tsCode, name: item.name }))
})
const automatedResearchDisplayCandidates = computed<AutomatedResearchCandidate[]>(() => automatedResearchTargets.value.length
  ? automatedResearchTargets.value
  : automatedResearchCandidates.value)
const comparisonStatusLabel = computed(() => comparisonLoading.value ? '正在读取估值与财务数据' : `${selectedCandidateItems.value.length} 只股票`)
const comparisonResearchSummary = computed(() => {
  const states = selectedCandidateItems.value.map(item => comparisonResearchStates.value[item.tsCode]?.status || 'idle')
  const success = states.filter(status => status === 'success').length
  const error = states.filter(status => status === 'error').length
  const running = states.filter(status => status === 'running').length
  const pending = states.filter(status => status === 'pending').length
  const historyLoading = selectedCandidateItems.value.filter(item => comparisonResearchHistoryLoading.value[item.tsCode]).length
  const historyError = selectedCandidateItems.value.filter(item => comparisonResearchHistoryErrors.value[item.tsCode]).length
  return {
    total: states.length,
    success,
    error,
    running,
    pending,
    completed: success + error,
    started: states.some(status => status !== 'idle'),
    historyLoading,
    historyError,
  }
})
const comparisonResearchButtonLabel = computed(() => comparisonResearchSummary.value.started ? '重新生成研究' : '批量生成研究')
const comparisonResearchSummaryLabel = computed(() => {
  const summary = comparisonResearchSummary.value
  if (summary.historyLoading)
    return `${summary.started ? `已完成 ${summary.completed} / ${summary.total}` : '批量研究未开始'}，${summary.historyLoading} 项历史读取中`
  if (!summary.started && summary.historyError)
    return `${summary.historyError} 项历史读取失败，可重试`
  if (!summary.started)
    return '尚未生成本批次研究报告'
  if (summary.running || summary.pending)
    return `已完成 ${summary.completed} / ${summary.total}，${summary.running + summary.pending} 项待完成`
  if (summary.error)
    return `已完成 ${summary.success} / ${summary.total}，${summary.error} 项失败`
  if (summary.historyError)
    return `已完成 ${summary.success} / ${summary.total}，${summary.historyError} 项历史读取失败`
  return `已完成 ${summary.success} / ${summary.total} 项`
})
const comparisonResearchSuccessfulRuns = computed(() => selectedCandidateItems.value
  .map(item => comparisonResearchStates.value[item.tsCode])
  .filter((state): state is ComparisonResearchItemState & { status: 'success', run: QuantResearchRun } => state?.status === 'success' && !!state.run)
  .map(state => state.run))
const comparisonResearchFailedCodes = computed(() => selectedCandidateItems.value
  .filter(item => comparisonResearchStates.value[item.tsCode]?.status === 'error')
  .map(item => item.tsCode))
const comparisonResearchExportReady = computed(() => comparisonResearchSuccessfulRuns.value.length > 0
  && comparisonResearchSummary.value.completed === comparisonResearchSummary.value.total
  && comparisonResearchSummary.value.pending === 0
  && comparisonResearchSummary.value.running === 0)
const comparisonResearchAiSummarySummary = computed(() => {
  const states = comparisonResearchSuccessfulRuns.value.map(run => comparisonResearchAiSummaryStates.value[run.tsCode]?.status || 'idle')
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
const comparisonResearchAiSummaryReady = computed(() => comparisonResearchExportReady.value
  && comparisonResearchSuccessfulRuns.value.length > 0)
const comparisonResearchAiSummaryButtonLabel = computed(() => comparisonResearchAiSummarySummary.value.started ? '重新生成 AI 摘要' : '批量生成 AI 摘要')
const comparisonAiComparisonReady = computed(() => comparisonResearchSuccessfulRuns.value.length >= 2)
const comparisonAiComparisonCitations = computed(() => {
  const runs = new Map(comparisonResearchSuccessfulRuns.value.map(run => [run.tsCode, run]))
  const cited = comparisonAiComparison.value?.citedEvidence || []
  const differences = comparisonAiComparison.value?.differences || []
  const differenceCitations = differences.flatMap(item => item.evidenceKeys.map(evidenceKey => ({ tsCode: item.tsCode, evidenceKey })))
  return [...new Map([...cited, ...differenceCitations].map(citation => [`${citation.tsCode}:${citation.evidenceKey}`, citation])).values()].filter((citation) => {
    const run = runs.get(citation.tsCode)
    return Boolean(run?.report.evidence.some(evidence => evidence.key === citation.evidenceKey))
  })
})
const comparisonAiNextCheckPromptReady = computed(() => Boolean(
  snapshot.value?.generatedAt
  && candidateBriefingScopeItems.value.length
  && !candidateAiBriefingQuestionLoading.value,
))
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
const dataHealthSummary = computed(() => buildQuantDataHealth({
  watchlist: watchlist.value,
  sync: syncResult.value || syncState.value,
  syncLoading: loading.sync || loading.syncState,
  syncError: Boolean(syncStateError.value),
  valueSelection: valueSelection.value,
  valueLoading: loading.valueQuality,
  valueError: Boolean(errors.valueQuality),
  shareholderReturns: shareholderReturns.value,
  shareholderLoading: loading.shareholderReturns,
  shareholderError: Boolean(errors.shareholderReturns),
}))
const researchReportFreshness = computed(() => classifyQuantDataHealthFreshness(latestResearchReport.value?.generatedAt ?? null))
const decisionFreshness = computed(() => mergeQuantDataHealthFreshness(dataHealthSummary.value.freshness, researchReportFreshness.value.freshness))
const decisionFreshnessDetail = computed(() => {
  if (researchReportFreshness.value.freshness !== 'fresh' && decisionFreshness.value === researchReportFreshness.value.freshness)
    return `研究报告${researchReportFreshness.value.freshnessLabel}：${researchReportFreshness.value.freshnessDetail}`
  return dataHealthSummary.value.freshnessDetail
})
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

function formatResearchShareCount(value: number): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 股`
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
  if (item.key === 'shareholder-free-cashflow' || item.key === 'shareholder-interest-expense' || item.key === 'shareholder-interest-bearing-debt' || item.key === 'shareholder-free-cashflow-after-interest')
    return formatFinancialAmount(item.value)
  if (item.key === 'shareholder-cashflow-coverage')
    return `${item.value.toFixed(2)}x`
  if (item.key === 'shareholder-payout-ratio')
    return `${item.value.toFixed(2)}%`
  if (item.key === 'shareholder-shares-outstanding-change' || item.key === 'shareholder-repurchase-shares')
    return formatResearchShareCount(item.value)
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
  if (evidence.key === 'shareholder-cashflow-coverage')
    return `${prefix}${value.toFixed(2)}x`
  if (evidence.key === 'shareholder-payout-ratio')
    return `${prefix}${value.toFixed(2)}%`
  if (evidence.key === 'shareholder-free-cashflow' || evidence.key === 'shareholder-interest-expense' || evidence.key === 'shareholder-interest-bearing-debt' || evidence.key === 'shareholder-free-cashflow-after-interest')
    return `${prefix}${formatFinancialAmount(value)}`
  if (evidence.key === 'shareholder-shares-outstanding-change' || evidence.key === 'shareholder-repurchase-shares') {
    const sign = value > 0 ? '+' : value < 0 ? '-' : ''
    return `${sign}${formatResearchShareCount(Math.abs(value))}`
  }
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

function shareholderReturnProviderLabel(provider: QuantShareholderReturnItem['provider']): string {
  return provider === 'tushare' ? 'Tushare' : provider === 'eastmoney' ? 'Eastmoney' : 'Quant'
}

function shareholderReturnSourceLabel(item: QuantShareholderReturnItem | null): string {
  if (!item)
    return '分红数据源未配置'
  const source = `${shareholderReturnProviderLabel(item.provider)} 实施分红`
  if (item.fallbackUsed && item.fallbackReason)
    return `${source} · 已回退（${item.fallbackReason}）`
  return source
}

function shareholderReturnHeaderLabel(): string {
  const item = selectedShareholderReturn.value
  if (item)
    return shareholderReturnSourceLabel(item)
  const provider = shareholderReturns.value?.provider ?? null
  const chain = shareholderReturns.value?.providerChain ?? []
  if (!provider)
    return '分红数据源未配置'
  return chain.length > 1 ? `${shareholderReturnProviderLabel(provider)} 分红 · 回退链 ${chain.join(' -> ')}` : `${shareholderReturnProviderLabel(provider)} 分红`
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

function resetCandidateAiBriefingCopyState(): void {
  candidateAiBriefingCopyRequestId++
  candidateAiBriefingCopying.value = false
  candidateAiBriefingCopyOutcome.value = null
  candidateAiBriefingCopyMessage.value = ''
}

function resetCandidateAiBriefingState(): void {
  candidateAiBriefingHistoryResetKey.value++
  candidateAiBriefingRequestId++
  candidateAiBriefingQuestionRequestId++
  candidateAiBriefing.value = null
  candidateAiBriefingLoading.value = false
  candidateAiBriefingError.value = null
  candidateAiBriefingScopeCount.value = null
  candidateAiBriefingQuestionInput.value = ''
  candidateAiBriefingQuestion.value = null
  candidateAiBriefingQuestionLoading.value = false
  candidateAiBriefingQuestionError.value = null
  resetCandidateAiBriefingCopyState()
}

watch(candidateBriefingScopeKey, (scopeKey, previousScopeKey) => {
  if (previousScopeKey !== undefined && scopeKey !== previousScopeKey)
    resetCandidateAiBriefingState()
})

watch(
  [candidateFilter, candidateMinScore, candidateCompleteOnly, candidateSort, candidateResearchStatus, candidateReviewDue],
  () => resetCandidateAiBriefingState(),
)

watch(comparisonAiComparison, () => resetComparisonAiComparisonTransferState(), { flush: 'sync' })

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

function dataHealthStatusLabel(status: QuantDataHealthStatus): string {
  return {
    ready: '完整',
    partial: '部分可用',
    missing: '待补数据',
    loading: '读取中',
    error: '读取失败',
  }[status]
}

function dataHealthStatusClass(status: QuantDataHealthStatus): string {
  return {
    ready: 'status-enabled',
    partial: 'status-partial',
    missing: 'status-disabled',
    loading: 'status-info',
    error: 'status-disabled',
  }[status]
}

function dataHealthFreshnessClass(freshness: QuantDataHealthFreshness): string {
  return {
    fresh: 'status-enabled',
    aging: 'status-partial',
    stale: 'status-disabled',
    unknown: 'status-info',
  }[freshness]
}

function dataHealthSummaryClass(status: QuantDataHealthStatus): string {
  return `data-health-summary-${status}`
}

async function runDataHealthAction(action: QuantDataHealthAction | null): Promise<void> {
  if (action === 'open-watchlist') {
    setActiveView('watchlist')
    return
  }
  if (action === 'refresh-value-quality') {
    await loadValueSelection()
    return
  }
  if (action === 'refresh-shareholder-returns')
    await loadShareholderReturns()
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
  candidatesStore.resetQuery()
}

async function loadWatchlist() {
  resetCandidateAiBriefingState()
  loading.watchlist = true
  errors.watchlist = null
  invalidateValueSelection()
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
    invalidateShareholderReturns()
    researchRunRequestId++
    researchRuns.value = []
    resetResearchDecisionState()
    researchRunError.value = null
    researchSummaryRequestId++
    researchAiSummary.value = null
    researchSummaryError.value = null
    researchSummaryLoading.value = false
    researchSummaryGenerating.value = false
    researchSummaryStreamMode.value = null
    researchSummaryStreamReceivedChars.value = 0
    researchAiAudits.value = []
    researchAiAuditsLoading.value = false
    researchAiAuditError.value = null
    resetResearchQuestionState()
    resetResearchChangeExplanationState()
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
  resetCandidateAiBriefingState()
  loading.candidates = true
  errors.candidates = null
  try {
    snapshot.value = await quantApi.getCandidates()
    const candidateIds = new Set(candidateItems.value.map(item => item.id))
    candidatesStore.pruneSelection(candidateIds)
  }
  catch (error) {
    errors.candidates = error
  }
  finally {
    loading.candidates = false
  }
}

async function generateCandidateAiBriefing(): Promise<void> {
  const scopeCodes = [...candidateBriefingScopeCodes.value]
  if (!snapshot.value?.generatedAt || !scopeCodes.length || candidateAiBriefingLoading.value)
    return
  const requestId = ++candidateAiBriefingRequestId
  const scopeKey = buildCandidateBriefingScopeKey(scopeCodes)
  resetCandidateAiBriefingCopyState()
  candidateAiBriefingLoading.value = true
  candidateAiBriefingError.value = null
  try {
    const briefing = await quantApi.generateCandidateAiBriefing(scopeCodes)
    if (canApplyCandidateBriefingResponse(requestId, candidateAiBriefingRequestId, scopeKey, candidateBriefingScopeKey.value)) {
      candidateAiBriefing.value = briefing
      candidateAiBriefingScopeCount.value = scopeCodes.length
    }
  }
  catch (error) {
    if (canApplyCandidateBriefingResponse(requestId, candidateAiBriefingRequestId, scopeKey, candidateBriefingScopeKey.value))
      candidateAiBriefingError.value = error
  }
  finally {
    if (requestId === candidateAiBriefingRequestId)
      candidateAiBriefingLoading.value = false
  }
}

async function askCandidateAiBriefingQuestion(question: string): Promise<void> {
  const scopeCodes = [...candidateBriefingScopeCodes.value]
  const normalizedQuestion = question.trim()
  if (!snapshot.value?.generatedAt || !scopeCodes.length || !normalizedQuestion || normalizedQuestion.length > 500 || candidateAiBriefingQuestionLoading.value)
    return

  const requestId = ++candidateAiBriefingQuestionRequestId
  const scopeKey = buildCandidateBriefingScopeKey(scopeCodes)
  const sessionId = candidateAiBriefing.value?.sessionId || candidateAiBriefingQuestion.value?.sessionId
  candidateAiBriefingQuestionInput.value = normalizedQuestion
  candidateAiBriefingQuestion.value = null
  candidateAiBriefingQuestionLoading.value = true
  candidateAiBriefingQuestionError.value = null
  try {
    const result = await quantApi.askCandidateAiBriefingQuestion(scopeCodes, normalizedQuestion, sessionId)
    if (canApplyCandidateBriefingResponse(requestId, candidateAiBriefingQuestionRequestId, scopeKey, candidateBriefingScopeKey.value))
      candidateAiBriefingQuestion.value = result
  }
  catch (error) {
    if (canApplyCandidateBriefingResponse(requestId, candidateAiBriefingQuestionRequestId, scopeKey, candidateBriefingScopeKey.value))
      candidateAiBriefingQuestionError.value = error
  }
  finally {
    if (requestId === candidateAiBriefingQuestionRequestId)
      candidateAiBriefingQuestionLoading.value = false
  }
}

function handleCandidateAiSessionDeleted(sessionId: string): void {
  const activeSessionId = candidateAiBriefing.value?.sessionId || candidateAiBriefingQuestion.value?.sessionId
  if (activeSessionId !== sessionId)
    return

  candidateAiBriefingQuestionRequestId++
  candidateAiBriefingQuestionLoading.value = false
  candidateAiBriefingQuestionError.value = null
  if (candidateAiBriefing.value?.sessionId === sessionId) {
    const { sessionId: _sessionId, ...briefing } = candidateAiBriefing.value
    candidateAiBriefing.value = briefing
  }
  if (candidateAiBriefingQuestion.value?.sessionId === sessionId) {
    const { sessionId: _sessionId, ...question } = candidateAiBriefingQuestion.value
    candidateAiBriefingQuestion.value = question
  }
}

function downloadCandidateAiBriefing(): void {
  const briefing = candidateAiBriefing.value
  if (!briefing)
    return

  const candidateCount = candidateAiBriefingScopeCount.value ?? filteredCandidateItems.value.length
  const blob = new Blob([buildCandidateAiBriefingMarkdown(briefing, candidateCount)], { type: 'text/markdown;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = buildCandidateAiBriefingFilename(briefing)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

async function copyCandidateAiBriefing(): Promise<void> {
  const briefing = candidateAiBriefing.value
  if (!briefing || candidateAiBriefingCopying.value)
    return

  const requestId = ++candidateAiBriefingCopyRequestId
  candidateAiBriefingCopying.value = true
  candidateAiBriefingCopyOutcome.value = null
  candidateAiBriefingCopyMessage.value = ''
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  const candidateCount = candidateAiBriefingScopeCount.value ?? filteredCandidateItems.value.length
  const result = await copyResearchReportMarkdown(buildCandidateAiBriefingMarkdown(briefing, candidateCount), clipboard)
  if (requestId !== candidateAiBriefingCopyRequestId)
    return

  candidateAiBriefingCopying.value = false
  if (result === 'copied') {
    candidateAiBriefingCopyOutcome.value = 'success'
    candidateAiBriefingCopyMessage.value = 'Markdown 已复制到剪贴板'
  }
  else if (result === 'unavailable') {
    candidateAiBriefingCopyOutcome.value = 'error'
    candidateAiBriefingCopyMessage.value = '当前浏览器不支持剪贴板写入'
  }
  else {
    candidateAiBriefingCopyOutcome.value = 'error'
    candidateAiBriefingCopyMessage.value = '复制失败，请检查剪贴板权限后重试'
  }
}

function resetResearchDecisionState(): void {
  researchDecisionRequestId++
  researchDecisionRecord.value = null
  researchDecisionHistory.value = []
  researchDecisionLoading.value = false
  researchDecisionHistoryLoading.value = false
  researchDecisionLoadError.value = null
  researchDecisionHistoryError.value = null
  researchDecisionSaveError.value = null
  researchDecisionSaveMessage.value = ''
}

function resetDecisionAssistantState(): void {
  decisionAssistantRequestId++
  decisionAssistant.value = null
  decisionAssistantHistory.value = []
  decisionAssistantLoading.value = false
  decisionAssistantError.value = null
  decisionAssistantAiConfigAvailable.value = null
}

function researchDecisionRequestIsCurrent(requestId: number, tsCode: string, runId: string | null): boolean {
  return requestId === researchDecisionRequestId
    && selectedTsCode.value === tsCode
    && (runId === null || latestResearchRun.value?.id === runId)
}

async function loadResearchDecisionJournal(tsCode: string, runId: string | null, options: { preserveCurrent?: boolean } = {}): Promise<void> {
  const requestId = ++researchDecisionRequestId
  researchDecisionLoading.value = true
  researchDecisionHistoryLoading.value = true
  researchDecisionLoadError.value = null
  researchDecisionHistoryError.value = null
  researchDecisionSaveError.value = null
  if (!options.preserveCurrent) {
    researchDecisionRecord.value = null
    researchDecisionHistory.value = []
  }

  const [recordResult, historyResult] = await Promise.allSettled([
    runId ? quantApi.getResearchDecisionRecord(runId) : Promise.resolve(null),
    quantApi.getResearchDecisionRecords(tsCode, 10),
  ])
  if (!researchDecisionRequestIsCurrent(requestId, tsCode, runId))
    return

  if (recordResult.status === 'fulfilled')
    researchDecisionRecord.value = recordResult.value
  else
    researchDecisionLoadError.value = recordResult.reason
  if (historyResult.status === 'fulfilled')
    researchDecisionHistory.value = historyResult.value
  else
    researchDecisionHistoryError.value = historyResult.reason
  researchDecisionLoading.value = false
  researchDecisionHistoryLoading.value = false
}

async function loadResearchRuns(tsCode: string) {
  const requestId = ++researchRunRequestId
  resetResearchDecisionState()
  resetDecisionAssistantState()
  resetResearchReportCopyState()
  resetResearchQuestionState()
  resetResearchChangeExplanationState()
  researchSummaryRequestId++
  researchAiSummary.value = null
  researchSummaryError.value = null
  researchSummaryLoading.value = false
  researchSummaryGenerating.value = false
  researchSummaryStreamMode.value = null
  researchSummaryStreamReceivedChars.value = 0
  researchAiAudits.value = []
  researchAiAuditsLoading.value = false
  researchAiAuditError.value = null
  researchRunLoading.value = true
  researchRunError.value = null
  try {
    const runs = await quantApi.getResearchRuns(tsCode)
    if (requestId === researchRunRequestId) {
      researchRuns.value = runs
      void loadResearchDecisionJournal(tsCode, runs[0]?.id || null)
      void loadDecisionAssistant(tsCode, runs[0]?.id || null)
      if (runs[0])
        await loadResearchSummary(runs[0].id)
      const evidenceTarget = comparisonAiEvidenceTarget.value
      if (evidenceTarget?.tsCode === tsCode)
        await focusComparisonAiEvidence(evidenceTarget)
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

async function loadResearchAiAudits(runId: string, requestId: number): Promise<void> {
  if (requestId !== researchSummaryRequestId)
    return
  researchAiAuditsLoading.value = true
  researchAiAuditError.value = null
  try {
    const audits = await quantApi.getResearchAiAudits(runId)
    if (requestId === researchSummaryRequestId)
      researchAiAudits.value = audits
  }
  catch (error) {
    if (requestId === researchSummaryRequestId)
      researchAiAuditError.value = error
  }
  finally {
    if (requestId === researchSummaryRequestId)
      researchAiAuditsLoading.value = false
  }
}

async function loadResearchSummary(runId: string, options: { autoGenerate?: boolean } = {}) {
  const requestId = ++researchSummaryRequestId
  researchSummaryLoading.value = true
  researchSummaryGenerating.value = false
  researchSummaryError.value = null
  researchSummaryStreamMode.value = null
  researchSummaryStreamReceivedChars.value = 0
  researchAiAudits.value = []
  researchAiAuditError.value = null
  void loadResearchAiAudits(runId, requestId)
  try {
    const summaries = await quantApi.getResearchSummaries(runId, 1)
    if (requestId !== researchSummaryRequestId)
      return
    if (summaries[0]) {
      researchAiSummary.value = summaries[0] || null
      return
    }
    if (!options.autoGenerate)
      return
    const config = await quantApi.getAiConfig()
    if (requestId !== researchSummaryRequestId || !isQuantAiAutoReviewReady(config))
      return
    researchSummaryLoading.value = false
    researchSummaryGenerating.value = true
    const summary = await quantApi.generateResearchSummaryStream(runId, event => applyResearchSummaryStreamProgress(requestId, event))
    if (requestId === researchSummaryRequestId) {
      researchAiSummary.value = summary
      void loadResearchAiAudits(runId, requestId)
    }
  }
  catch (error) {
    if (requestId === researchSummaryRequestId) {
      researchSummaryError.value = error
      researchAiSummary.value = null
      void loadResearchAiAudits(runId, requestId)
    }
  }
  finally {
    if (requestId === researchSummaryRequestId) {
      researchSummaryLoading.value = false
      researchSummaryGenerating.value = false
    }
  }
}

async function generateResearchReport() {
  const stock = selectedStock.value
  if (!stock || researchRunGenerating.value)
    return
  const tsCode = stock.tsCode
  resetResearchReportCopyState()
  resetResearchQuestionState()
  resetResearchChangeExplanationState()
  researchRunGenerating.value = true
  researchRunError.value = null
  try {
    const run = await quantApi.generateResearchRun(tsCode)
    if (selectedTsCode.value !== tsCode)
      return
    researchRuns.value = [run, ...researchRuns.value.filter(item => item.id !== run.id)].slice(0, 5)
    void loadResearchDecisionJournal(tsCode, run.id)
    void loadDecisionAssistant(tsCode, run.id)
    researchSummaryRequestId++
    researchAiSummary.value = null
    researchSummaryError.value = null
    await loadResearchSummary(run.id, { autoGenerate: true })
  }
  catch (error) {
    researchRunError.value = error
  }
  finally {
    researchRunGenerating.value = false
  }
}

async function loadDecisionAssistant(tsCode: string, runId: string | null): Promise<void> {
  const requestId = ++decisionAssistantRequestId
  decisionAssistant.value = null
  decisionAssistantHistory.value = []
  decisionAssistantError.value = null
  decisionAssistantLoading.value = true
  const [historyResult, configResult] = await Promise.allSettled([
    quantApi.getDecisionAssistants(tsCode, 10),
    quantApi.getAiConfig(),
  ])
  if (requestId !== decisionAssistantRequestId || selectedTsCode.value !== tsCode)
    return
  if (historyResult.status === 'fulfilled') {
    decisionAssistantHistory.value = historyResult.value
    decisionAssistant.value = runId ? historyResult.value.find(item => item.researchRunId === runId) || null : null
  }
  else {
    decisionAssistantError.value = historyResult.reason
  }
  if (configResult.status === 'fulfilled')
    decisionAssistantAiConfigAvailable.value = Boolean(configResult.value && (configResult.value.hasApiKey || configResult.value.provider === 'ollama'))
  else if (!decisionAssistantError.value)
    decisionAssistantAiConfigAvailable.value = null
  decisionAssistantLoading.value = false
}

async function createDecisionAssistant(input: { mode: 'buy' | 'holding', costBasis: number | null, quantity: number | null, includeAi: boolean }): Promise<void> {
  const run = latestResearchRun.value
  const stock = selectedStock.value
  if (!run || !stock || decisionAssistantGenerating.value)
    return
  const requestId = ++decisionAssistantRequestId
  decisionAssistantGenerating.value = true
  decisionAssistantError.value = null
  try {
    const assessment = await quantApi.createDecisionAssistant({
      researchRunId: run.id,
      mode: input.mode,
      costBasis: input.costBasis,
      quantity: input.quantity,
      includeAi: input.includeAi,
    })
    if (requestId !== decisionAssistantRequestId || selectedTsCode.value !== stock.tsCode || latestResearchRun.value?.id !== run.id)
      return
    decisionAssistant.value = assessment
    decisionAssistantHistory.value = [assessment, ...decisionAssistantHistory.value.filter(item => item.id !== assessment.id)].slice(0, 10)
    if (assessment.ai.status === 'unavailable')
      decisionAssistantAiConfigAvailable.value = false
    else if (assessment.ai.status !== 'not-requested')
      decisionAssistantAiConfigAvailable.value = true
  }
  catch (error) {
    if (requestId === decisionAssistantRequestId && selectedTsCode.value === stock.tsCode)
      decisionAssistantError.value = error
  }
  finally {
    if (requestId === decisionAssistantRequestId)
      decisionAssistantGenerating.value = false
  }
}

async function saveResearchDecision(action: QuantDecisionRecordAction, note: string | null): Promise<void> {
  const stock = selectedStock.value
  const run = latestResearchRun.value
  if (!stock || !run || researchDecisionSaving.value)
    return

  const tsCode = stock.tsCode
  const runId = run.id
  researchDecisionSaving.value = true
  researchDecisionSaveError.value = null
  researchDecisionSaveMessage.value = ''
  try {
    await quantApi.saveResearchDecisionRecord(runId, action, note)
    await loadResearchDecisionJournal(tsCode, runId, { preserveCurrent: true })
    void loadDecisionQueue()
    if (selectedTsCode.value !== tsCode || latestResearchRun.value?.id !== runId)
      return
    if (researchDecisionLoadError.value || researchDecisionHistoryError.value)
      researchDecisionSaveMessage.value = '决策已保存，但部分复盘数据刷新失败'
    else
      researchDecisionSaveMessage.value = '决策记录已保存，快照已回读'
  }
  catch (error) {
    if (selectedTsCode.value === tsCode && latestResearchRun.value?.id === runId)
      researchDecisionSaveError.value = error
  }
  finally {
    researchDecisionSaving.value = false
  }
}

async function generateResearchSummary() {
  const run = latestResearchRun.value
  if (!run || researchSummaryGenerating.value)
    return
  const requestId = ++researchSummaryRequestId
  researchSummaryGenerating.value = true
  researchSummaryError.value = null
  researchSummaryStreamMode.value = null
  researchSummaryStreamReceivedChars.value = 0
  try {
    const summary = await quantApi.generateResearchSummaryStream(run.id, event => applyResearchSummaryStreamProgress(requestId, event))
    if (requestId === researchSummaryRequestId) {
      researchAiSummary.value = summary
      void loadResearchAiAudits(run.id, requestId)
    }
  }
  catch (error) {
    if (requestId === researchSummaryRequestId) {
      researchSummaryError.value = error
      void loadResearchAiAudits(run.id, requestId)
    }
  }
  finally {
    researchSummaryGenerating.value = false
  }
}

function applyResearchSummaryStreamProgress(requestId: number, event: QuantAiSummaryStreamProgress): void {
  if (requestId !== researchSummaryRequestId)
    return
  if (event.type === 'started') {
    researchSummaryStreamMode.value = event.responseMode
    researchSummaryStreamReceivedChars.value = 0
  }
  else if (event.type === 'delta') {
    researchSummaryStreamReceivedChars.value = event.receivedLength
  }
}

function resetResearchQuestionState(): void {
  researchQuestionRequestId++
  researchQuestionInput.value = ''
  researchQuestion.value = null
  researchQuestionLoading.value = false
  researchQuestionError.value = null
}

function resetResearchChangeExplanationState(): void {
  researchChangeExplanationRequestId++
  researchChangeExplanation.value = null
  researchChangeExplanationGenerating.value = false
  researchChangeExplanationError.value = null
}

async function askResearchQuestion(question: string): Promise<void> {
  const run = latestResearchRun.value
  const normalizedQuestion = question.trim()
  if (!run || !normalizedQuestion || normalizedQuestion.length > 500 || researchQuestionLoading.value)
    return

  const requestId = ++researchQuestionRequestId
  researchQuestionInput.value = normalizedQuestion
  researchQuestion.value = null
  researchQuestionLoading.value = true
  researchQuestionError.value = null
  try {
    const result = await quantApi.askResearchQuestion(run.id, normalizedQuestion)
    if (requestId === researchQuestionRequestId)
      researchQuestion.value = result
  }
  catch (error) {
    if (requestId === researchQuestionRequestId)
      researchQuestionError.value = error
  }
  finally {
    if (requestId === researchQuestionRequestId)
      researchQuestionLoading.value = false
  }
}

function useResearchQuestionPrompt(prompt: string): void {
  const panel = researchQuestionPanel.value
  if (!prompt || !researchQuestionPromptReady.value || !panel)
    return

  panel.useQuestionPrompt(prompt)
}

function useResearchSummaryNextCheck(check: string): void {
  useResearchQuestionPrompt(buildResearchSummaryNextCheckPrompt(check))
}

function useResearchChangeNextCheck(check: string): void {
  useResearchQuestionPrompt(buildResearchChangeNextCheckPrompt(check))
}

async function generateResearchChangeExplanation(): Promise<void> {
  const currentRun = latestResearchRun.value
  const previousRun = previousResearchRun.value
  const comparison = researchEvidenceComparison.value
  if (!currentRun || !previousRun || !comparison || researchChangeExplanationGenerating.value)
    return

  const requestId = ++researchChangeExplanationRequestId
  researchChangeExplanation.value = null
  researchChangeExplanationGenerating.value = true
  researchChangeExplanationError.value = null
  try {
    const explanation = await quantApi.generateResearchChangeExplanation(currentRun.id, previousRun.id)
    if (requestId === researchChangeExplanationRequestId)
      researchChangeExplanation.value = explanation
  }
  catch (error) {
    if (requestId === researchChangeExplanationRequestId)
      researchChangeExplanationError.value = error
  }
  finally {
    if (requestId === researchChangeExplanationRequestId)
      researchChangeExplanationGenerating.value = false
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

function resetResearchReportCopyState() {
  researchReportCopyRequestId++
  researchReportCopying.value = false
  researchReportCopyOutcome.value = null
  researchReportCopyMessage.value = ''
}

async function copyResearchReport() {
  const run = latestResearchRun.value
  if (!run || researchReportCopying.value)
    return

  const requestId = ++researchReportCopyRequestId
  researchReportCopying.value = true
  researchReportCopyOutcome.value = null
  researchReportCopyMessage.value = ''
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  const result = await copyResearchReportMarkdown(buildResearchReportMarkdown(run, researchAiSummary.value), clipboard)
  if (requestId !== researchReportCopyRequestId)
    return

  researchReportCopying.value = false
  if (result === 'copied') {
    researchReportCopyOutcome.value = 'success'
    researchReportCopyMessage.value = 'Markdown 已复制到剪贴板'
  }
  else if (result === 'unavailable') {
    researchReportCopyOutcome.value = 'error'
    researchReportCopyMessage.value = '当前浏览器不支持剪贴板写入'
  }
  else {
    researchReportCopyOutcome.value = 'error'
    researchReportCopyMessage.value = '复制失败，请检查剪贴板权限后重试'
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
    resetCandidateAiBriefingState()
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
  candidatesStore.toggleSelection(item.id)
  resetComparisonAiComparisonState()
}

function handleCandidateToggle(id: string) {
  const item = candidateItems.value.find(candidate => candidate.id === id)
  if (item)
    toggleCandidateSelection(item)
}

function toggleAllCandidateSelection() {
  resetComparisonAiComparisonState()
  const visibleIds = filteredCandidateItems.value.map(item => item.id)
  candidatesStore.toggleAllSelection(visibleIds)
}

function clearCandidateSelection() {
  resetComparisonAiComparisonState()
  candidatesStore.clearSelection()
}

function handleComparisonDrawerOpenChange(open: boolean): void {
  comparisonDrawerOpen.value = open
  if (!open)
    resetComparisonAiComparisonState()
}

function researchEvidenceDomId(tsCode: string, evidenceKey: string): string {
  return `research-evidence-${encodeURIComponent(tsCode)}-${encodeURIComponent(evidenceKey)}`
}

async function focusComparisonAiEvidence(citation: QuantResearchComparisonCitation): Promise<void> {
  const run = researchRuns.value.find(candidate => candidate.tsCode === citation.tsCode)
  if (!run?.report.evidence.some(evidence => evidence.key === citation.evidenceKey))
    return

  await nextTick()
  const element = document.getElementById(researchEvidenceDomId(citation.tsCode, citation.evidenceKey))
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (element instanceof HTMLElement) {
    element.classList.add('research-evidence-focus')
    window.setTimeout(() => element.classList.remove('research-evidence-focus'), 2200)
  }
  if (comparisonAiEvidenceTarget.value?.tsCode === citation.tsCode && comparisonAiEvidenceTarget.value.evidenceKey === citation.evidenceKey)
    comparisonAiEvidenceTarget.value = null
}

async function focusResearchQuestionEvidence(evidenceKey: string): Promise<void> {
  const report = latestResearchReport.value
  if (!report?.evidence.some(evidence => evidence.key === evidenceKey))
    return

  await nextTick()
  const element = document.getElementById(researchEvidenceDomId(report.tsCode, evidenceKey))
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (element instanceof HTMLElement) {
    element.classList.add('research-evidence-focus')
    window.setTimeout(() => element.classList.remove('research-evidence-focus'), 2200)
  }
}

function comparisonResearchStateFor(item: CandidateItem): ComparisonResearchItemState {
  return comparisonResearchStates.value[item.tsCode] || { status: 'idle', run: null, error: null }
}

function comparisonResearchAiSummaryStateFor(item: CandidateItem): BatchAiSummaryState {
  return comparisonResearchAiSummaryStates.value[item.tsCode] || idleBatchAiSummaryState()
}

function comparisonResearchAiSummaryStatusLabel(state: BatchAiSummaryState): string {
  if (state.status === 'idle')
    return '未生成'
  if (state.status === 'pending')
    return '排队中'
  if (state.status === 'running')
    return '生成中'
  if (state.status === 'error')
    return '生成失败'
  return '已生成'
}

function comparisonResearchAiSummaryStatusDetail(state: BatchAiSummaryState): string {
  if (state.status === 'idle')
    return '点击上方按钮生成摘要'
  if (state.status === 'pending')
    return '等待可用任务位'
  if (state.status === 'running')
    return '正在请求 AI 摘要'
  if (state.status === 'error')
    return parsedError(state.error).message
  if (!state.summary)
    return '摘要已返回'
  return `${state.summary.provider} · ${state.summary.model}`
}

function comparisonResearchAiSummaryActionFor(item: CandidateItem): 'retry' | null {
  const researchState = comparisonResearchStateFor(item)
  const summaryState = comparisonResearchAiSummaryStateFor(item)
  return researchState.status === 'success' && researchState.run && summaryState.status === 'error' ? 'retry' : null
}

function comparisonResearchHistoryLoadingFor(item: CandidateItem): boolean {
  return comparisonResearchHistoryLoading.value[item.tsCode] === true
}

function comparisonResearchHistoryErrorFor(item: CandidateItem): unknown | null {
  return comparisonResearchHistoryErrors.value[item.tsCode] || null
}

function comparisonResearchStateSourceFor(item: CandidateItem): ResearchBatchStateSource | undefined {
  return comparisonResearchHistorySources.value[item.tsCode]
}

function comparisonResearchActionFor(item: CandidateItem) {
  return getBatchResearchItemAction(comparisonResearchStateFor(item))
}

function comparisonResearchStateClass(state: ComparisonResearchItemState): string {
  return `comparison-research-item-${state.status}`
}

function comparisonResearchItemClass(item: CandidateItem): string {
  const classes = [comparisonResearchStateClass(comparisonResearchStateFor(item))]
  if (comparisonResearchHistoryLoadingFor(item))
    classes.push('comparison-research-item-history-loading')
  if (comparisonResearchHistoryErrorFor(item))
    classes.push('comparison-research-item-history-error')
  return classes.join(' ')
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

function comparisonResearchStatusLabelFor(item: CandidateItem): string {
  const state = comparisonResearchStateFor(item)
  if (state.status === 'idle' && comparisonResearchHistoryLoadingFor(item))
    return '读取历史中'
  if (state.status === 'idle' && comparisonResearchHistoryErrorFor(item))
    return '历史读取失败'
  return comparisonResearchStatusLabel(state)
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

function comparisonResearchStatusDetailFor(item: CandidateItem): string {
  const state = comparisonResearchStateFor(item)
  if (state.status === 'idle' && comparisonResearchHistoryLoadingFor(item))
    return '正在读取最近研究历史'
  if (state.status === 'idle' && comparisonResearchHistoryErrorFor(item))
    return '点击重试读取历史'
  return comparisonResearchStatusDetail(state)
}

function comparisonResearchHistoryMetaFor(item: CandidateItem): string {
  const error = comparisonResearchHistoryErrorFor(item)
  if (comparisonResearchHistoryLoadingFor(item))
    return comparisonResearchStateSourceFor(item) === 'batch' ? '正在同步最近研究历史' : ''
  if (error)
    return `历史读取失败：${parsedError(error).message}`
  return ''
}

function comparisonResearchHistoryRequestIsCurrent(tsCode: string, requestId: number): boolean {
  return comparisonResearchHistoryRequestIds.get(tsCode) === requestId
}

function invalidateComparisonResearchHistory(tsCode: string): void {
  const requestId = ++comparisonResearchHistoryRequestId
  comparisonResearchHistoryRequestIds.set(tsCode, requestId)
  comparisonResearchHistoryLoading.value = { ...comparisonResearchHistoryLoading.value, [tsCode]: false }
  comparisonResearchHistoryErrors.value = { ...comparisonResearchHistoryErrors.value, [tsCode]: null }
}

async function loadComparisonResearchHistory(item: CandidateItem): Promise<void> {
  const tsCode = item.tsCode
  const requestId = ++comparisonResearchHistoryRequestId
  comparisonResearchHistoryRequestIds.set(tsCode, requestId)
  comparisonResearchHistoryLoading.value = { ...comparisonResearchHistoryLoading.value, [tsCode]: true }
  comparisonResearchHistoryErrors.value = { ...comparisonResearchHistoryErrors.value, [tsCode]: null }

  try {
    const runs = await quantApi.getResearchRuns(tsCode, 1)
    if (!comparisonResearchHistoryRequestIsCurrent(tsCode, requestId))
      return

    const result = hydrateResearchBatchState({
      existing: comparisonResearchStates.value[tsCode],
      source: comparisonResearchHistorySources.value[tsCode],
      run: runs[0] || null,
    })
    comparisonResearchStates.value = { ...comparisonResearchStates.value, [tsCode]: result.state }
    comparisonResearchHistorySources.value = { ...comparisonResearchHistorySources.value, [tsCode]: result.source }
    comparisonResearchHistoryErrors.value = { ...comparisonResearchHistoryErrors.value, [tsCode]: null }
  }
  catch (error) {
    if (!comparisonResearchHistoryRequestIsCurrent(tsCode, requestId))
      return

    const result = hydrateResearchBatchState({
      existing: comparisonResearchStates.value[tsCode],
      source: comparisonResearchHistorySources.value[tsCode],
      run: null,
      error,
    })
    comparisonResearchStates.value = { ...comparisonResearchStates.value, [tsCode]: result.state }
    comparisonResearchHistorySources.value = { ...comparisonResearchHistorySources.value, [tsCode]: result.source }
    comparisonResearchHistoryErrors.value = { ...comparisonResearchHistoryErrors.value, [tsCode]: result.error }
  }
  finally {
    if (comparisonResearchHistoryRequestIsCurrent(tsCode, requestId))
      comparisonResearchHistoryLoading.value = { ...comparisonResearchHistoryLoading.value, [tsCode]: false }
  }
}

async function retryComparisonResearchHistory(item: CandidateItem): Promise<void> {
  if (comparisonResearchHistoryLoadingFor(item))
    return
  await loadComparisonResearchHistory(item)
}

async function openComparisonDrawer() {
  if (!canCompareCandidates.value)
    return
  const items = [...selectedCandidateItems.value]
  resetComparisonResearchExportState()
  resetComparisonResearchCopyState()
  resetComparisonResearchAiSummaryState()
  resetComparisonAiComparisonState()
  comparisonDrawerOpen.value = true
  comparisonLoading.value = true
  comparisonValuations.value = {}
  comparisonFinancials.value = {}
  comparisonErrors.value = {}
  comparisonResearchHistoryErrors.value = {
    ...comparisonResearchHistoryErrors.value,
    ...Object.fromEntries(items.map(item => [item.tsCode, null])),
  }
  void Promise.all(items.map(item => loadComparisonResearchHistory(item)))
  await Promise.all(items.map(async (item) => {
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

async function executeAutomatedResearch(targets: readonly AutomatedResearchCandidate[], replaceTargets: boolean): Promise<void> {
  const normalizedTargets = targets
    .map(candidate => ({ tsCode: candidate.tsCode.trim().toUpperCase(), name: candidate.name?.trim() || null }))
    .filter(candidate => candidate.tsCode)
    .slice(0, 3)
  if (!normalizedTargets.length || automatedResearchRunning.value)
    return

  if (replaceTargets) {
    automatedResearchTargets.value = normalizedTargets
    automatedResearchStates.value = initialAutomatedResearchStates(normalizedTargets)
  }
  else {
    for (const candidate of normalizedTargets)
      automatedResearchStates.value = markAutomatedResearchItemPending(automatedResearchStates.value, candidate.tsCode)
  }
  automatedResearchRunning.value = true
  automatedResearchError.value = null
  automatedResearchAiConfigError.value = null

  let aiReady = false
  try {
    aiReady = isQuantAiAutoReviewReady(await quantApi.getAiConfig())
  }
  catch (error) {
    automatedResearchAiConfigError.value = error
  }
  automatedResearchAiReady.value = aiReady

  try {
    const results = await runAutomatedResearch(normalizedTargets, {
      aiReady,
      ensureWatchlist: async (candidate) => {
        if (watchlist.value.some(item => item.tsCode === candidate.tsCode))
          return
        const persisted = await quantApi.addWatchlist({
          tsCode: candidate.tsCode,
          ...(candidate.name ? { name: candidate.name } : {}),
        })
        if (!persisted)
          throw new QuantApiError('观察池写入后没有返回已保存记录', 500, 'QUANT_WATCHLIST_READBACK_FAILED')
      },
      generateResearch: candidate => quantApi.generateResearchRun(candidate.tsCode),
      generateAiSummary: run => quantApi.generateResearchSummary(run.id),
    }, (progress) => {
      automatedResearchStates.value = applyAutomatedResearchProgress(automatedResearchStates.value, progress)
    })

    await Promise.all([
      loadWatchlist(),
      loadCandidates(),
      loadResearchMarkers(),
      loadDecisionQueue(),
      loadValueSelection(),
      loadShareholderReturns(),
    ])
    const focusResult = results.find(result => result.run)
    const focusStock = focusResult ? watchlist.value.find(item => item.tsCode === focusResult.candidate.tsCode) : null
    if (focusStock)
      selectStock(focusStock)
  }
  catch (error) {
    automatedResearchError.value = error
  }
  finally {
    automatedResearchRunning.value = false
  }
}

async function startAutomatedResearch(): Promise<void> {
  await executeAutomatedResearch(automatedResearchCandidates.value, true)
}

async function retryAutomatedResearchItem(tsCode: string): Promise<void> {
  const candidate = automatedResearchTargets.value.find(item => item.tsCode === tsCode)
  if (candidate)
    await executeAutomatedResearch([candidate], false)
}

async function startBatchResearch() {
  if (!canCompareCandidates.value || comparisonResearchRunning.value || comparisonResearchAiSummaryRunning.value)
    return

  resetComparisonResearchExportState()
  resetComparisonResearchCopyState()
  resetComparisonResearchAiSummaryState()
  resetComparisonAiComparisonState()
  const items = [...selectedCandidateItems.value]
  for (const item of items)
    invalidateComparisonResearchHistory(item.tsCode)
  comparisonResearchStates.value = Object.fromEntries(items.map(item => [item.tsCode, {
    status: 'pending' as const,
    run: null,
    error: null,
  }]))
  const sources = { ...comparisonResearchHistorySources.value }
  const historyErrors = { ...comparisonResearchHistoryErrors.value }
  for (const item of items) {
    sources[item.tsCode] = 'batch'
    historyErrors[item.tsCode] = null
  }
  comparisonResearchHistorySources.value = sources
  comparisonResearchHistoryErrors.value = historyErrors
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
  if (current.status !== 'error' || comparisonResearchRunning.value || comparisonResearchAiSummaryRunning.value)
    return

  resetComparisonResearchExportState()
  resetComparisonResearchCopyState()
  resetComparisonResearchAiSummaryState()
  resetComparisonAiComparisonState()
  invalidateComparisonResearchHistory(item.tsCode)
  comparisonResearchStates.value = markBatchResearchItemPending(comparisonResearchStates.value, item.tsCode)
  comparisonResearchHistorySources.value = { ...comparisonResearchHistorySources.value, [item.tsCode]: 'batch' }
  comparisonResearchHistoryErrors.value = { ...comparisonResearchHistoryErrors.value, [item.tsCode]: null }
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
  handleComparisonDrawerOpenChange(false)
  selectStock(item)
}

function resetComparisonResearchExportState() {
  comparisonResearchExportMessage.value = ''
  comparisonResearchExportError.value = false
  comparisonResearchExporting.value = false
}

function resetComparisonResearchCopyState() {
  comparisonResearchCopyRequestId++
  comparisonResearchCopying.value = false
  comparisonResearchCopyOutcome.value = null
  comparisonResearchCopyMessage.value = ''
}

function downloadComparisonResearchReports() {
  if (!comparisonResearchExportReady.value || comparisonResearchExporting.value)
    return

  comparisonResearchExporting.value = true
  comparisonResearchExportMessage.value = ''
  comparisonResearchExportError.value = false
  try {
    const runs = comparisonResearchSuccessfulRuns.value
    const markdown = buildResearchBatchMarkdown(runs, comparisonResearchFailedCodes.value)
    if (!markdown)
      throw new Error('当前批次暂无成功研究报告')

    const objectUrl = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = buildResearchBatchFilename(runs)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    comparisonResearchExportMessage.value = `已导出 ${runs.length} 份成功研究报告`
  }
  catch {
    comparisonResearchExportError.value = true
    comparisonResearchExportMessage.value = '批量导出失败，请稍后重试'
  }
  finally {
    comparisonResearchExporting.value = false
  }
}

async function copyComparisonResearchReports() {
  if (!comparisonResearchExportReady.value || comparisonResearchCopying.value)
    return

  const requestId = ++comparisonResearchCopyRequestId
  comparisonResearchCopying.value = true
  comparisonResearchCopyOutcome.value = null
  comparisonResearchCopyMessage.value = ''
  let result: ResearchReportCopyResult
  try {
    const markdown = buildResearchBatchMarkdown(comparisonResearchSuccessfulRuns.value, comparisonResearchFailedCodes.value)
    if (!markdown)
      throw new Error('当前批次暂无成功研究报告')
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    result = await copyResearchReportMarkdown(markdown, clipboard)
  }
  catch {
    result = 'failed'
  }
  if (requestId !== comparisonResearchCopyRequestId)
    return

  comparisonResearchCopying.value = false
  if (result === 'copied') {
    comparisonResearchCopyOutcome.value = 'success'
    comparisonResearchCopyMessage.value = `已复制 ${comparisonResearchSuccessfulRuns.value.length} 份研究报告到剪贴板`
  }
  else if (result === 'unavailable') {
    comparisonResearchCopyOutcome.value = 'error'
    comparisonResearchCopyMessage.value = '当前浏览器不支持剪贴板写入'
  }
  else {
    comparisonResearchCopyOutcome.value = 'error'
    comparisonResearchCopyMessage.value = '批量复制失败，请检查剪贴板权限后重试'
  }
}

function resetComparisonResearchAiSummaryState() {
  comparisonResearchAiSummaryRequestId++
  comparisonResearchAiSummaryRunning.value = false
  comparisonResearchAiSummaryStates.value = {}
  comparisonResearchAiSummaryMessage.value = ''
  comparisonResearchAiSummaryError.value = false
}

function resetComparisonAiComparisonState() {
  comparisonAiComparisonRequestId++
  comparisonAiComparison.value = null
  comparisonAiComparisonLoading.value = false
  comparisonAiComparisonError.value = null
  comparisonAiEvidenceTarget.value = null
}

function resetComparisonAiComparisonTransferState(): void {
  comparisonAiComparisonCopyRequestId++
  comparisonAiComparisonExporting.value = false
  comparisonAiComparisonExportMessage.value = ''
  comparisonAiComparisonExportError.value = false
  comparisonAiComparisonCopying.value = false
  comparisonAiComparisonCopyOutcome.value = null
  comparisonAiComparisonCopyMessage.value = ''
}

function comparisonAiComparisonErrorMessage(): string {
  return parsedError(comparisonAiComparisonError.value).message
}

async function generateComparisonAiComparison(): Promise<void> {
  if (!comparisonAiComparisonReady.value || comparisonAiComparisonLoading.value)
    return

  const requestId = ++comparisonAiComparisonRequestId
  resetComparisonAiComparisonTransferState()
  comparisonAiComparisonLoading.value = true
  comparisonAiComparisonError.value = null
  try {
    const result = await quantApi.generateResearchComparison(comparisonResearchSuccessfulRuns.value.map(run => run.id))
    if (requestId === comparisonAiComparisonRequestId)
      comparisonAiComparison.value = result
  }
  catch (error) {
    if (requestId === comparisonAiComparisonRequestId)
      comparisonAiComparisonError.value = error
  }
  finally {
    if (requestId === comparisonAiComparisonRequestId)
      comparisonAiComparisonLoading.value = false
  }
}

function downloadComparisonAiComparison(): void {
  const comparison = comparisonAiComparison.value
  if (!comparison || comparisonAiComparisonLoading.value || comparisonAiComparisonExporting.value)
    return

  comparisonAiComparisonExporting.value = true
  comparisonAiComparisonExportMessage.value = ''
  comparisonAiComparisonExportError.value = false
  try {
    const markdown = buildResearchComparisonMarkdown(comparison)
    const objectUrl = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = buildResearchComparisonFilename(comparison)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    comparisonAiComparisonExportMessage.value = 'AI 对比研究已导出'
  }
  catch {
    comparisonAiComparisonExportError.value = true
    comparisonAiComparisonExportMessage.value = 'AI 对比研究导出失败，请稍后重试'
  }
  finally {
    comparisonAiComparisonExporting.value = false
  }
}

async function copyComparisonAiComparison(): Promise<void> {
  const comparison = comparisonAiComparison.value
  if (!comparison || comparisonAiComparisonLoading.value || comparisonAiComparisonCopying.value)
    return

  const requestId = ++comparisonAiComparisonCopyRequestId
  comparisonAiComparisonCopying.value = true
  comparisonAiComparisonCopyOutcome.value = null
  comparisonAiComparisonCopyMessage.value = ''
  let result: ResearchReportCopyResult
  try {
    const markdown = buildResearchComparisonMarkdown(comparison)
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    result = await copyResearchReportMarkdown(markdown, clipboard)
  }
  catch {
    result = 'failed'
  }
  if (requestId !== comparisonAiComparisonCopyRequestId)
    return

  comparisonAiComparisonCopying.value = false
  if (result === 'copied') {
    comparisonAiComparisonCopyOutcome.value = 'success'
    comparisonAiComparisonCopyMessage.value = 'AI 对比研究已复制到剪贴板'
  }
  else if (result === 'unavailable') {
    comparisonAiComparisonCopyOutcome.value = 'error'
    comparisonAiComparisonCopyMessage.value = '当前浏览器不支持剪贴板写入'
  }
  else {
    comparisonAiComparisonCopyOutcome.value = 'error'
    comparisonAiComparisonCopyMessage.value = 'AI 对比研究复制失败，请检查剪贴板权限后重试'
  }
}

function openComparisonAiCitation(citation: QuantResearchComparisonCitation): void {
  const target = comparisonAiComparisonCitations.value.find(item => item.tsCode === citation.tsCode && item.evidenceKey === citation.evidenceKey)
  if (!target)
    return
  handleComparisonDrawerOpenChange(false)
  comparisonAiEvidenceTarget.value = target
  const item = watchlist.value.find(candidate => candidate.tsCode === citation.tsCode) || candidateItems.value.find(candidate => candidate.tsCode === citation.tsCode)
  if (item)
    selectStock(item)
}

function useComparisonAiNextCheck(check: string): void {
  const prompt = buildComparisonAiNextCheckPrompt(check)
  const panel = candidateAiBriefingPanel.value
  if (!prompt || !comparisonAiNextCheckPromptReady.value || !panel)
    return

  panel.useQuestionPrompt(prompt)
  handleComparisonDrawerOpenChange(false)
}

function updateComparisonResearchAiSummaryMessage() {
  const summary = comparisonResearchAiSummarySummary.value
  if (!summary.total)
    return

  comparisonResearchAiSummaryError.value = summary.error > 0
  comparisonResearchAiSummaryMessage.value = summary.error > 0
    ? `已生成 ${summary.success} / ${summary.total} 项 AI 摘要，${summary.error} 项失败，可单独重试`
    : `已生成 ${summary.success} / ${summary.total} 项 AI 摘要`
}

async function startBatchResearchAiSummary() {
  if (!comparisonResearchAiSummaryReady.value || comparisonResearchAiSummaryRunning.value)
    return

  const candidates = comparisonResearchSuccessfulRuns.value.map(run => ({ tsCode: run.tsCode, runId: run.id }))
  if (!candidates.length)
    return

  const requestId = ++comparisonResearchAiSummaryRequestId
  comparisonResearchAiSummaryStates.value = Object.fromEntries(candidates.map(candidate => [candidate.tsCode, idleBatchAiSummaryState()]))
  comparisonResearchAiSummaryMessage.value = ''
  comparisonResearchAiSummaryError.value = false
  comparisonResearchAiSummaryRunning.value = true
  try {
    await runResearchAiSummaryBatch(
      candidates,
      candidate => quantApi.generateResearchSummary(candidate.runId),
      (progress: BatchAiSummaryProgress) => {
        if (requestId === comparisonResearchAiSummaryRequestId)
          comparisonResearchAiSummaryStates.value = applyBatchAiSummaryProgress(comparisonResearchAiSummaryStates.value, progress)
      },
    )
    if (requestId === comparisonResearchAiSummaryRequestId)
      updateComparisonResearchAiSummaryMessage()
  }
  finally {
    if (requestId === comparisonResearchAiSummaryRequestId)
      comparisonResearchAiSummaryRunning.value = false
  }
}

async function retryComparisonResearchAiSummary(item: CandidateItem) {
  const run = comparisonResearchSuccessfulRuns.value.find(candidate => candidate.tsCode === item.tsCode)
  const current = comparisonResearchAiSummaryStateFor(item)
  if (!run || current.status !== 'error' || comparisonResearchAiSummaryRunning.value)
    return

  const requestId = ++comparisonResearchAiSummaryRequestId
  comparisonResearchAiSummaryStates.value = markBatchAiSummaryItemPending(comparisonResearchAiSummaryStates.value, item.tsCode)
  comparisonResearchAiSummaryMessage.value = ''
  comparisonResearchAiSummaryError.value = false
  comparisonResearchAiSummaryRunning.value = true
  try {
    await runResearchAiSummaryBatch(
      [{ tsCode: run.tsCode, runId: run.id }],
      candidate => quantApi.generateResearchSummary(candidate.runId),
      (progress: BatchAiSummaryProgress) => {
        if (requestId === comparisonResearchAiSummaryRequestId)
          comparisonResearchAiSummaryStates.value = applyBatchAiSummaryProgress(comparisonResearchAiSummaryStates.value, progress)
      },
    )
    if (requestId === comparisonResearchAiSummaryRequestId)
      updateComparisonResearchAiSummaryMessage()
  }
  finally {
    if (requestId === comparisonResearchAiSummaryRequestId)
      comparisonResearchAiSummaryRunning.value = false
  }
}

async function loadWorkspace(force = false) {
  const loader = async () => {
    errors.action = null
    syncResult.value = null
    await Promise.all([loadWatchlist(), loadCandidates(), loadDecisionQueue(), loadResearchMarkers(), loadInvestmentKnowledge(), loadSyncState()])
    await Promise.all([loadValueSelection(), loadShareholderReturns()])
  }
  await (force ? workspaceLifecycleStore.run(loader) : workspaceLifecycleStore.initialize(loader))
}

function selectStock(item: Pick<WatchlistItem, 'tsCode' | 'name'>) {
  selectedTsCode.value = item.tsCode
  decisionAssistantRequestId++
  decisionAssistant.value = null
  decisionAssistantHistory.value = []
  decisionAssistantError.value = null
  syncResearchForm(item.tsCode)
  detailDrawerOpen.value = true
  void Promise.all([loadDailyBars(item.tsCode), loadValuation(item.tsCode), loadFinancialQuality(item.tsCode), loadResearchRuns(item.tsCode)])
}

function focusCandidateFromBriefing(tsCode: string): void {
  const item = candidateItems.value.find(candidate => candidate.tsCode === tsCode)
  if (item)
    selectStock(item)
}

function focusDecisionQueue(tsCode: string): void {
  const item = watchlist.value.find(stock => stock.tsCode === tsCode)
  if (item)
    selectStock(item)
}

async function addToWatchlist(): Promise<boolean> {
  const tsCode = watchCode.value.trim().toUpperCase()
  const name = watchName.value.trim()
  if (!/^\d{6}\.(?:SZ|SH|BJ)$/.test(tsCode)) {
    errors.action = new QuantApiError('请输入形如 000001.SZ 的股票代码', 422, 'INVALID_TS_CODE')
    return false
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
    return true
  }
  catch (error) {
    errors.action = error
    return false
  }
  finally {
    adding.value = false
  }
}

async function addToWatchlistAndResearch(): Promise<void> {
  const tsCode = watchCode.value.trim().toUpperCase()
  const added = await addToWatchlist()
  if (!added)
    return
  const saved = watchlist.value.find(item => item.tsCode === tsCode)
  await executeAutomatedResearch([{
    tsCode,
    name: saved?.name || null,
  }], true)
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
    syncState.value = syncResult.value
    syncStateError.value = null
    resetCandidateAiBriefingState()
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

function setActiveView(view: QuantView): void {
  void navigationStore.navigate(view)
}

onMounted(() => {
  void navigationStore.initialize()
  void loadWorkspace()
})

onUnmounted(() => {
  cancelWorkspaceRequests()
  navigationStore.dispose()
})
</script>

<template>
  <QuantShell
    :active-view="activeView"
    :active-view-copy="activeViewCopy"
    :latest-date="latestWatchlistDate"
    :busy="pageBusy"
    :overall-error="overallError ? parsedError(overallError) : null"
    :action-error-message="errors.action ? parsedError(errors.action).message : null"
    @navigate="setActiveView"
    @refresh="loadWorkspace(true)"
    @settings="aiSettingsOpen = true"
    @factor-settings="factorSettingsOpen = true"
    @clear-error="errors.action = null"
  >
    <template #drawers>
      <QuantAiSettingsDrawer v-model:open="aiSettingsOpen" />
      <QuantFactorSettingsDrawer v-model:open="factorSettingsOpen" />
    </template>

    <QuantOverviewView
      v-if="activeView === 'overview'"
      :page-busy="pageBusy"
      :candidates-loading="loading.candidates"
      :watchlist-count="watchlist.length"
      :up-count="upCount"
      :down-count="downCount"
      :signal-candidate-count="signalCandidateCount"
      :data-coverage-label="dataCoverageLabel"
      :latest-watchlist-date="latestWatchlistDate"
      :data-health-summary="dataHealthSummary"
      :watchlist-environment="watchlistEnvironment"
      :top-candidates="topCandidates"
      :risk-items="riskItems"
      :data-health-status-class="dataHealthStatusClass"
      :data-health-status-label="dataHealthStatusLabel"
      :data-health-freshness-class="dataHealthFreshnessClass"
      :data-health-summary-class="dataHealthSummaryClass"
      :environment-status-class="environmentStatusClass"
      :format-environment-ratio="formatEnvironmentRatio"
      :format-date-time="formatDateTime"
      :focus-tone="focusTone"
      :display-stock-name="displayStockName"
      :focus-signal="focusSignal"
      :format-signal-score="formatSignalScore"
      :signal-score-percent="signalScorePercent"
      :candidate-risk-tone="candidateRiskTone"
      :risk-tone-class="riskToneClass"
      :risk-label="riskLabel"
      :research-priority-detail="researchPriorityDetail"
      @navigate="setActiveView"
      @select-stock="selectStock"
      @run-data-health-action="runDataHealthAction"
    />

    <QuantWatchlistView
      v-else-if="activeView === 'watchlist'"
      v-model:watch-code="watchCode"
      v-model:watch-name="watchName"
      :watchlist="watchlist"
      :columns="watchlistColumns"
      :watchlist-loading="loading.watchlist"
      :adding="adding"
      :deleting-code="deletingCode"
      :pending-delete-code="pendingDeleteCode"
      :delete-dialog-message="deleteDialogMessage"
      :sync-result="syncResult"
      :sync-state="syncState"
      :syncing="loading.sync"
      :sync-state-loading="loading.syncState"
      :sync-state-error-message="syncStateError ? parsedError(syncStateError).message : null"
      :can-sync="canSync"
      :latest-watchlist-date="latestWatchlistDate"
      :displayed-sync-result-message="displayedSyncResultMessage"
      :displayed-sync-result-time="displayedSyncResultTime ? formatDateTime(displayedSyncResultTime) : null"
      @add="addToWatchlist"
      @select="selectStock"
      @request-remove="requestRemoveFromWatchlist"
      @cancel-remove="cancelRemoveFromWatchlist"
      @confirm-remove="confirmRemoveFromWatchlist"
      @sync="syncDaily"
      @refresh-sync-state="loadSyncState"
    />

    <QuantCandidatesView
      v-else-if="activeView === 'candidates'"
      ref="candidateAiBriefingPanel"
      v-model:candidate-filter="candidateFilter"
      v-model:candidate-min-score="candidateMinScore"
      v-model:candidate-complete-only="candidateCompleteOnly"
      v-model:candidate-sort="candidateSort"
      v-model:candidate-research-status="candidateResearchStatus"
      v-model:candidate-review-due="candidateReviewDue"
      v-model:watch-code="watchCode"
      v-model:watch-name="watchName"
      :candidate-items="candidateItems"
      :snapshot="snapshot"
      :scanned-candidate-count="scannedCandidateCount"
      :pending-candidate-count="pendingCandidateCount"
      :watchlist="watchlist"
      :adding="adding"
      :candidate-filter-options="candidateFilterOptions"
      :candidate-sort-options="candidateSortOptions"
      :candidate-research-status-options="candidateResearchStatusOptions"
      :candidate-review-due-options="candidateReviewDueOptions"
      :candidate-query-active="candidateQueryActive"
      :filtered-candidate-items="filteredCandidateItems"
      :active-candidate-preset="activeCandidatePreset"
      :signal-rule-count="SIGNAL_RULE_COUNT"
      :candidate-evidence-summary="candidateEvidenceSummary"
      :value-quality-loading="loading.valueQuality"
      :value-quality-error="Boolean(errors.valueQuality)"
      :automated-research-display-candidates="automatedResearchDisplayCandidates"
      :automated-research-states="automatedResearchStates"
      :automated-research-running="automatedResearchRunning"
      :automated-research-ai-ready="automatedResearchAiReady"
      :automated-research-ai-config-error-message="automatedResearchAiConfigError ? parsedError(automatedResearchAiConfigError).message : null"
      :automated-research-error-message="automatedResearchError ? parsedError(automatedResearchError).message : null"
      :research-priority-total="researchPriorityTotal"
      :research-priority-highest-label="researchPriorityHighestLabel"
      :research-priority-summary="researchPrioritySummary"
      :visible-research-priority-queue="visibleResearchPriorityQueue"
      :decision-queue-records="decisionQueueRecords"
      :decision-queue-loading="decisionQueueLoading"
      :decision-queue-error-message="decisionQueueError ? parsedError(decisionQueueError).message : null"
      :candidate-ai-briefing="candidateAiBriefing"
      :candidate-briefing-scope-items-count="candidateBriefingScopeItems.length"
      :candidate-ai-briefing-scope-count="candidateAiBriefingScopeCount"
      :candidate-briefing-scope-key="candidateBriefingScopeKey"
      :current-candidate-codes="currentCandidateCodes"
      :candidate-ai-briefing-history-reset-key="candidateAiBriefingHistoryResetKey"
      :candidate-ai-briefing-available="Boolean(snapshot?.generatedAt)"
      :candidate-ai-briefing-loading="candidateAiBriefingLoading"
      :candidate-ai-briefing-error-message="candidateAiBriefingError ? parsedError(candidateAiBriefingError).message : null"
      :candidate-ai-briefing-configuration-error="candidateAiBriefingConfigurationError"
      :candidate-ai-briefing-question-input="candidateAiBriefingQuestionInput"
      :candidate-ai-briefing-question="candidateAiBriefingQuestion"
      :candidate-ai-briefing-question-loading="candidateAiBriefingQuestionLoading"
      :candidate-ai-briefing-question-error-message="candidateAiBriefingQuestionError ? parsedError(candidateAiBriefingQuestionError).message : null"
      :candidate-ai-briefing-question-configuration-error="candidateAiBriefingQuestionConfigurationError"
      :candidate-ai-briefing-copying="candidateAiBriefingCopying"
      :candidate-ai-briefing-copy-outcome="candidateAiBriefingCopyOutcome"
      :candidate-ai-briefing-copy-message="candidateAiBriefingCopyMessage"
      :candidate-columns="candidateColumns"
      :candidates-loading="loading.candidates"
      :selected-candidate-ids="selectedCandidateIds"
      :selected-candidate-items="selectedCandidateItems"
      :can-compare-candidates="canCompareCandidates"
      :candidate-evidence-for="candidateEvidenceFor"
      :candidate-persistence-label="candidatePersistenceLabel"
      :candidate-persistence-class="candidatePersistenceClass"
      :candidate-persistence-detail="candidatePersistenceDetail"
      :candidate-priority-for="candidatePriorityFor"
      :research-priority-detail="researchPriorityDetail"
      :research-priority-class="researchPriorityClass"
      :research-priority-action-class="researchPriorityActionClass"
      :value-quality-for="valueQualityFor"
      :value-quality-status-label="valueQualityStatusLabel"
      :value-quality-status-class="valueQualityStatusClass"
      :value-quality-summary="valueQualitySummary"
      :research-review-for="researchReviewFor"
      :research-marker-map="researchMarkerMap"
      :display-stock-name="displayStockName"
      @navigate-watchlist="setActiveView('watchlist')"
      @add-to-watchlist-and-research="addToWatchlistAndResearch"
      @reset-candidate-query="resetCandidateQuery"
      @open-comparison-drawer="openComparisonDrawer"
      @clear-candidate-selection="clearCandidateSelection"
      @start-automated-research="startAutomatedResearch"
      @retry-automated-research-item="retryAutomatedResearchItem"
      @focus-decision-queue="focusDecisionQueue"
      @open-settings="aiSettingsOpen = true"
      @select-stock="selectStock"
      @toggle-candidate-selection="handleCandidateToggle"
      @toggle-all-candidate-selection="toggleAllCandidateSelection"
      @generate-candidate-ai-briefing="generateCandidateAiBriefing"
      @update-candidate-ai-briefing-question-input="candidateAiBriefingQuestionInput = $event"
      @ask-candidate-ai-briefing-question="askCandidateAiBriefingQuestion"
      @focus-candidate-from-briefing="focusCandidateFromBriefing"
      @copy-candidate-ai-briefing="copyCandidateAiBriefing"
      @download-candidate-ai-briefing="downloadCandidateAiBriefing"
      @handle-candidate-ai-session-deleted="handleCandidateAiSessionDeleted"
    />

    <QuantKnowledgeView
      :investment-knowledge="investmentKnowledge"
      :loading="loading.knowledge"
      :has-error="Boolean(errors.knowledge)"
      @retry="loadInvestmentKnowledge"
    />

    <DetailDrawer
      :open="detailDrawerOpen && !!selectedStock"
      :title="selectedStock ? `${selectedStock.name || selectedStock.tsCode} · 分析详情` : '分析详情'"
      :description="selectedStock ? `${selectedStock.tsCode} · 走势、估值、财务质量与研究摘要` : ''"
      width="lg"
      @update:open="detailDrawerOpen = $event"
    >
      <QuantResearchDetailView
        ref="researchQuestionPanel"
        v-model:research-form-status="researchFormStatus"
        v-model:research-form-note="researchFormNote"
        v-model:research-form-review-date="researchFormReviewDate"
        v-model:research-question-input="researchQuestionInput"
        :selected-stock="selectedStock"
        :selected-candidate="selectedCandidate"
        :selected-research-marker="selectedResearchMarker"
        :selected-research-review="selectedResearchReview"
        :research-status-options="researchStatusOptions"
        :signal-rule-count="SIGNAL_RULE_COUNT"
        :latest-research-run="latestResearchRun"
        :latest-research-report="latestResearchReport"
        :research-runs="researchRuns"
        :research-run-loading="researchRunLoading"
        :research-run-generating="researchRunGenerating"
        :research-run-error-message="researchRunError ? parsedError(researchRunError).message : null"
        :research-summary="researchSummary"
        :research-ai-summary="researchAiSummary"
        :research-summary-loading="researchSummaryLoading"
        :research-summary-generating="researchSummaryGenerating"
        :research-summary-error-message="researchSummaryError ? parsedError(researchSummaryError).message : null"
        :research-summary-stream-mode="researchSummaryStreamMode"
        :research-summary-stream-received-chars="researchSummaryStreamReceivedChars"
        :research-summary-configuration-error="researchSummaryConfigurationError"
        :research-ai-audits="researchAiAudits"
        :research-ai-audits-loading="researchAiAuditsLoading"
        :research-ai-audit-error-message="researchAiAuditError ? parsedError(researchAiAuditError).message : null"
        :research-question="researchQuestion"
        :research-question-loading="researchQuestionLoading"
        :research-question-error-message="researchQuestionError ? parsedError(researchQuestionError).message : null"
        :research-question-configuration-error="researchQuestionConfigurationError"
        :research-question-prompt-ready="researchQuestionPromptReady"
        :research-change-explanation="researchChangeExplanation"
        :research-change-explanation-generating="researchChangeExplanationGenerating"
        :research-change-explanation-error-message="researchChangeExplanationError ? parsedError(researchChangeExplanationError).message : null"
        :research-change-explanation-configuration-error="researchChangeExplanationConfigurationError"
        :research-decision-record="researchDecisionRecord"
        :research-decision-history="researchDecisionHistory"
        :research-decision-loading="researchDecisionLoading"
        :research-decision-history-loading="researchDecisionHistoryLoading"
        :research-decision-saving="researchDecisionSaving"
        :research-decision-load-error-message="researchDecisionLoadError ? parsedError(researchDecisionLoadError).message : null"
        :research-decision-history-error-message="researchDecisionHistoryError ? parsedError(researchDecisionHistoryError).message : null"
        :research-decision-save-error-message="researchDecisionSaveError ? parsedError(researchDecisionSaveError).message : null"
        :research-decision-save-message="researchDecisionSaveMessage"
        :research-saving="researchSaving"
        :research-save-message="researchSaveMessage"
        :research-save-error-message="researchSaveError ? parsedError(researchSaveError).message : null"
        :decision-assistant="decisionAssistant"
        :decision-assistant-history="decisionAssistantHistory"
        :decision-assistant-loading="decisionAssistantLoading"
        :decision-assistant-generating="decisionAssistantGenerating"
        :decision-assistant-error-message="decisionAssistantError ? parsedError(decisionAssistantError).message : null"
        :decision-assistant-ai-config-available="decisionAssistantAiConfigAvailable"
        :daily-bars="dailyBars"
        :daily-columns="dailyColumns"
        :chart-bars="chartBars"
        :latest-daily-bar="latestDailyBar"
        :latest-date="latestDate"
        :trend-structure="trendStructure"
        :timing-window="timingWindow"
        :timing-history="timingHistory"
        :timing-history-current-bucket="timingHistoryCurrentBucket"
        :decision-evidence="decisionEvidence"
        :valuation="valuation"
        :valuation-comparison="valuationComparison"
        :valuation-error-message="valuationErrorMessage(errors.valuation)"
        :valuation-comparison-error-message="valuationComparisonError ? valuationErrorMessage(valuationComparisonError) : null"
        :has-valuation-data="hasValuationData"
        :financial-quality="financialQuality"
        :financial-history="financialHistory"
        :financial-comparison="financialComparison"
        :financial-comparison-error="financialComparisonError"
        :has-financial-data="hasFinancialData"
        :financial-trend-items="financialTrendItems"
        :selected-value-quality="selectedValueQuality"
        :selected-shareholder-return="selectedShareholderReturn"
        :loading="loading"
        :errors="errors"
        :decision-freshness="decisionFreshness"
        :decision-freshness-detail="decisionFreshnessDetail"
        :research-evidence-groups="researchEvidenceGroups"
        :research-evidence-comparison="researchEvidenceComparison"
        :research-run-timeline="researchRunTimeline"
        :research-report-copying="researchReportCopying"
        :research-report-copy-outcome="researchReportCopyOutcome"
        :research-report-copy-message="researchReportCopyMessage"
        :selected-ts-code="selectedTsCode"
        :format-number="formatNumber"
        :format-percent="formatPercent"
        :format-signal-score="formatSignalScore"
        :format-factor-label="formatFactorLabel"
        :format-date-time="formatDateTime"
        :format-trade-date="formatTradeDate"
        :format-evidence-date="formatEvidenceDate"
        :format-comparison-position="formatComparisonPosition"
        :format-lower-comparison-position="formatLowerComparisonPosition"
        :format-market-cap="formatMarketCap"
        :format-financial-amount="formatFinancialAmount"
        :format-metric-percent="formatMetricPercent"
        :format-ratio-percent="formatRatioPercent"
        :format-multiple="formatMultiple"
        :format-dividend-yield="formatDividendYield"
        :format-trend-delta="formatTrendDelta"
        :format-persistence-rate="formatPersistenceRate"
        :format-score-delta="formatScoreDelta"
        :score-delta-class="scoreDeltaClass"
        :candidate-persistence-for="candidatePersistenceFor"
        :candidate-persistence-label="candidatePersistenceLabel"
        :candidate-persistence-class="candidatePersistenceClass"
        :candidate-priority-for="candidatePriorityFor"
        :research-priority-detail="researchPriorityDetail"
        :research-priority-action-class="researchPriorityActionClass"
        :research-run-status-label="researchRunStatusLabel"
        :research-run-status-class="researchRunStatusClass"
        :research-run-action-label="researchRunActionLabel"
        :research-evidence-status-label="researchEvidenceStatusLabel"
        :research-evidence-status-class="researchEvidenceStatusClass"
        :format-research-evidence-value="formatResearchEvidenceValue"
        :research-evidence-change-class="researchEvidenceChangeClass"
        :format-research-evidence-delta="formatResearchEvidenceDelta"
        :research-evidence-history-value="researchEvidenceHistoryValue"
        :research-evidence-history-status="researchEvidenceHistoryStatus"
        :research-run-timeline-score-class="researchRunTimelineScoreClass"
        :format-research-run-timeline-score="formatResearchRunTimelineScore"
        :format-research-run-timeline-delta="formatResearchRunTimelineDelta"
        :format-research-run-source-date="formatResearchRunSourceDate"
        :timing-window-class="timingWindowClass"
        :timing-window-metric-class="timingWindowMetricClass"
        :timing-window-metric-status-label="timingWindowMetricStatusLabel"
        :format-timing-window-metric="formatTimingWindowMetric"
        :timing-history-state-class="timingHistoryStateClass"
        :format-timing-history-rate="formatTimingHistoryRate"
        :format-timing-history-percent="formatTimingHistoryPercent"
        :timing-history-bucket-title="timingHistoryBucketTitle"
        :decision-evidence-status-label="decisionEvidenceStatusLabel"
        :decision-evidence-status-class="decisionEvidenceStatusClass"
        :decision-evidence-action-class="decisionEvidenceActionClass"
        :shareholder-return-status-label="shareholderReturnStatusLabel"
        :shareholder-return-status-class="shareholderReturnStatusClass"
        :shareholder-return-header-label="shareholderReturnHeaderLabel"
        :shareholder-return-source-label="shareholderReturnSourceLabel"
        :value-quality-status-label="valueQualityStatusLabel"
        :value-quality-status-class="valueQualityStatusClass"
        :format-value-quality-score="formatValueQualityScore"
        :format-value-quality-dimension="formatValueQualityDimension"
        :value-quality-dimension-samples="valueQualityDimensionSamples"
        :research-evidence-dom-id="researchEvidenceDomId"
        :parsed-error="parsedError"
        :focus-research-question-evidence="focusResearchQuestionEvidence"
        :generate-research-report="generateResearchReport"
        :download-research-report="downloadResearchReport"
        :copy-research-report="copyResearchReport"
        :load-research-runs="loadResearchRuns"
        :generate-research-summary="generateResearchSummary"
        :create-decision-assistant="createDecisionAssistant"
        :save-research-decision="saveResearchDecision"
        :load-daily-bars="loadDailyBars"
        :load-valuation="loadValuation"
        :load-financial-quality="loadFinancialQuality"
        :load-value-selection="loadValueSelection"
        :load-shareholder-returns="loadShareholderReturns"
        :save-research-marker="saveResearchMarker"
        :ask-research-question="askResearchQuestion"
        :generate-research-change-explanation="generateResearchChangeExplanation"
        :use-research-summary-next-check="useResearchSummaryNextCheck"
        :use-research-change-next-check="useResearchChangeNextCheck"
        @open-settings="aiSettingsOpen = true"
      />
    </DetailDrawer>

    <DetailDrawer
      :open="comparisonDrawerOpen"
      title="候选对比"
      :description="`技术信号、估值和基本面 · ${comparisonStatusLabel}`"
      width="lg"
      @update:open="handleComparisonDrawerOpenChange"
    >
      <QuantComparisonView
        :selected-candidate-items="selectedCandidateItems"
        :comparison-loading="comparisonLoading"
        :comparison-valuations="comparisonValuations"
        :comparison-financials="comparisonFinancials"
        :comparison-errors="comparisonErrors"
        :comparison-research-button-label="comparisonResearchButtonLabel"
        :can-compare-candidates="canCompareCandidates"
        :comparison-research-running="comparisonResearchRunning"
        :comparison-research-summary="comparisonResearchSummary"
        :comparison-research-export-ready="comparisonResearchExportReady"
        :comparison-research-exporting="comparisonResearchExporting"
        :comparison-research-copying="comparisonResearchCopying"
        :comparison-research-copy-outcome="comparisonResearchCopyOutcome"
        :comparison-research-export-message="comparisonResearchExportMessage"
        :comparison-research-export-error="comparisonResearchExportError"
        :comparison-research-copy-message="comparisonResearchCopyMessage"
        :comparison-research-ai-summary-ready="comparisonResearchAiSummaryReady"
        :comparison-research-ai-summary-running="comparisonResearchAiSummaryRunning"
        :comparison-research-ai-summary-button-label="comparisonResearchAiSummaryButtonLabel"
        :comparison-research-ai-summary-message="comparisonResearchAiSummaryMessage"
        :comparison-research-ai-summary-error="comparisonResearchAiSummaryError"
        :comparison-research-summary-label="comparisonResearchSummaryLabel"
        :comparison-research-successful-runs="comparisonResearchSuccessfulRuns"
        :comparison-ai-comparison-ready="comparisonAiComparisonReady"
        :comparison-ai-comparison-loading="comparisonAiComparisonLoading"
        :comparison-ai-comparison="comparisonAiComparison"
        :comparison-ai-comparison-error="comparisonAiComparisonError"
        :comparison-ai-comparison-error-message="comparisonAiComparisonErrorMessage()"
        :comparison-ai-comparison-exporting="comparisonAiComparisonExporting"
        :comparison-ai-comparison-copying="comparisonAiComparisonCopying"
        :comparison-ai-comparison-export-message="comparisonAiComparisonExportMessage"
        :comparison-ai-comparison-export-error="comparisonAiComparisonExportError"
        :comparison-ai-comparison-copy-message="comparisonAiComparisonCopyMessage"
        :comparison-ai-comparison-copy-outcome="comparisonAiComparisonCopyOutcome"
        :comparison-ai-next-check-prompt-ready="comparisonAiNextCheckPromptReady"
        :comparison-ai-comparison-citations="comparisonAiComparisonCitations"
        :comparison-research-ai-summary-state-for="comparisonResearchAiSummaryStateFor"
        :comparison-research-ai-summary-status-label="comparisonResearchAiSummaryStatusLabel"
        :comparison-research-ai-summary-status-detail="comparisonResearchAiSummaryStatusDetail"
        :comparison-research-status-label-for="comparisonResearchStatusLabelFor"
        :comparison-research-status-detail-for="comparisonResearchStatusDetailFor"
        :comparison-research-history-meta-for="comparisonResearchHistoryMetaFor"
        :comparison-research-action-for="comparisonResearchActionFor"
        :comparison-research-history-error-for="comparisonResearchHistoryErrorFor"
        :comparison-research-history-loading-for="comparisonResearchHistoryLoadingFor"
        :comparison-research-ai-summary-action-for="comparisonResearchAiSummaryActionFor"
        :comparison-research-item-class="comparisonResearchItemClass"
        :comparison-research-state-for="comparisonResearchStateFor"
        :display-stock-name="displayStockName"
        :format-number="formatNumber"
        :format-percent="formatPercent"
        :format-signal-score="formatSignalScore"
        :format-metric-percent="formatMetricPercent"
        :format-date-time="formatDateTime"
        :start-batch-research="startBatchResearch"
        :download-comparison-research-reports="downloadComparisonResearchReports"
        :copy-comparison-research-reports="copyComparisonResearchReports"
        :start-batch-research-ai-summary="startBatchResearchAiSummary"
        :open-batch-research-result="openBatchResearchResult"
        :retry-batch-research-item="retryBatchResearchItem"
        :retry-comparison-research-history="retryComparisonResearchHistory"
        :retry-comparison-research-ai-summary="retryComparisonResearchAiSummary"
        :generate-comparison-ai-comparison="generateComparisonAiComparison"
        :download-comparison-ai-comparison="downloadComparisonAiComparison"
        :copy-comparison-ai-comparison="copyComparisonAiComparison"
        :open-comparison-ai-citation="openComparisonAiCitation"
        :use-comparison-ai-next-check="useComparisonAiNextCheck"
      />
    </DetailDrawer>
  </QuantShell>
</template>
