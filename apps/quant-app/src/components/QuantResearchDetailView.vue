<script setup lang="ts">
import type { Column, ParsedError } from '@starye/ui'
import type { QuantDataHealthFreshness } from '../lib/data-health'
import type { DecisionEvidence, DecisionEvidenceStatus } from '../lib/decision-evidence'
import type {
  CandidateItem,
  CandidateSignalPersistence,
  DailyBar,
  QuantAiResponseMode,
  QuantAiRunAudit,
  QuantDecisionAssistant,
  QuantDecisionRecord,
  QuantDecisionRecordAction,
  QuantFinancialQualityComparison,
  QuantFinancialQualityHistory,
  QuantFinancialQualitySnapshot,
  QuantResearchChangeExplanation,
  QuantResearchEvidence,
  QuantResearchMarker,
  QuantResearchQuestion,
  QuantResearchReport,
  QuantResearchRun,
  QuantResearchSummary,
  QuantShareholderReturnItem,
  QuantValuationComparison,
  QuantValuationSnapshot,
  QuantValueQualityDimension,
  QuantValueQualityItem,
  ResearchMarkerStatus,
  WatchlistItem,
} from '../lib/quant-view-models'
import type { ResearchEvidenceChange, ResearchEvidenceHistoryComparison } from '../lib/research-evidence-history'
import type { ResearchPriority } from '../lib/research-priority'
import type { ResearchReviewMeta } from '../lib/research-review'
import type { ResearchRunScoreDirection, ResearchRunTimeline } from '../lib/research-run-timeline'
import type { ResearchSummary } from '../lib/research-summary'
import type { TimingHistory, TimingHistoryBucket } from '../lib/timing-history'
import type { TimingWindow, TimingWindowMetricStatus, TimingWindowState } from '../lib/timing-window'
import type { TrendStructure } from '../lib/trend-analysis'
import type { FinancialTrendItem, QuantDetailChartBar, QuantDetailErrorState, QuantDetailLoadingState } from './quant-detail/quant-detail-contracts'
import { ref } from 'vue'
import QuantDailyDataSection from './quant-detail/QuantDailyDataSection.vue'
import QuantDecisionCard from './quant-detail/QuantDecisionCard.vue'
import QuantDecisionEvidenceSection from './quant-detail/QuantDecisionEvidenceSection.vue'
import QuantFinancialQualitySection from './quant-detail/QuantFinancialQualitySection.vue'
import QuantResearchMarkerEditor from './quant-detail/QuantResearchMarkerEditor.vue'
import QuantResearchReadout from './quant-detail/QuantResearchReadout.vue'
import QuantResearchRunSection from './quant-detail/QuantResearchRunSection.vue'
import QuantShareholderReturnsSection from './quant-detail/QuantShareholderReturnsSection.vue'
import QuantSignalPersistenceSection from './quant-detail/QuantSignalPersistenceSection.vue'
import QuantTimingSection from './quant-detail/QuantTimingSection.vue'
import QuantValuationSection from './quant-detail/QuantValuationSection.vue'

export interface QuantResearchDetailProps {
  selectedStock: WatchlistItem | null
  selectedCandidate: CandidateItem | null
  selectedResearchMarker: QuantResearchMarker
  selectedResearchReview: ResearchReviewMeta
  researchStatusOptions: { value: ResearchMarkerStatus, label: string }[]
  signalRuleCount: number
  latestResearchRun: QuantResearchRun | null
  latestResearchReport: QuantResearchReport | null
  researchRuns: QuantResearchRun[]
  researchRunLoading: boolean
  researchRunGenerating: boolean
  researchRunErrorMessage: string | null
  researchSummary: ResearchSummary | null
  researchAiSummary: QuantResearchSummary | null
  researchSummaryLoading: boolean
  researchSummaryGenerating: boolean
  researchSummaryErrorMessage: string | null
  researchSummaryStreamMode: QuantAiResponseMode | null
  researchSummaryStreamReceivedChars: number
  researchSummaryConfigurationError: boolean
  researchAiAudits: QuantAiRunAudit[]
  researchAiAuditsLoading: boolean
  researchAiAuditErrorMessage: string | null
  researchQuestion: QuantResearchQuestion | null
  researchQuestionLoading: boolean
  researchQuestionErrorMessage: string | null
  researchQuestionConfigurationError: boolean
  researchQuestionPromptReady: boolean
  researchChangeExplanation: QuantResearchChangeExplanation | null
  researchChangeExplanationGenerating: boolean
  researchChangeExplanationErrorMessage: string | null
  researchChangeExplanationConfigurationError: boolean
  researchDecisionRecord: QuantDecisionRecord | null
  researchDecisionHistory: QuantDecisionRecord[]
  researchDecisionLoading: boolean
  researchDecisionHistoryLoading: boolean
  researchDecisionSaving: boolean
  researchDecisionLoadErrorMessage: string | null
  researchDecisionHistoryErrorMessage: string | null
  researchDecisionSaveErrorMessage: string | null
  researchDecisionSaveMessage: string
  researchSaving: boolean
  researchSaveMessage: string
  researchSaveErrorMessage: string | null
  decisionAssistant: QuantDecisionAssistant | null
  decisionAssistantHistory: QuantDecisionAssistant[]
  decisionAssistantLoading: boolean
  decisionAssistantGenerating: boolean
  decisionAssistantErrorMessage: string | null
  decisionAssistantAiConfigAvailable: boolean | null
  dailyBars: DailyBar[]
  dailyColumns: Column<DailyBar>[]
  chartBars: QuantDetailChartBar[]
  latestDailyBar: DailyBar | null
  latestDate: string
  trendStructure: TrendStructure
  timingWindow: TimingWindow
  timingHistory: TimingHistory
  timingHistoryCurrentBucket: TimingHistoryBucket | null
  decisionEvidence: DecisionEvidence | null
  valuation: QuantValuationSnapshot | null
  valuationComparison: QuantValuationComparison | null
  hasValuationData: boolean
  financialQuality: QuantFinancialQualitySnapshot | null
  financialHistory: QuantFinancialQualityHistory | null
  financialComparison: QuantFinancialQualityComparison | null
  financialComparisonError: unknown | null
  hasFinancialData: boolean
  financialTrendItems: FinancialTrendItem[]
  selectedValueQuality: QuantValueQualityItem | null
  selectedShareholderReturn: QuantShareholderReturnItem | null
  loading: QuantDetailLoadingState
  errors: QuantDetailErrorState
  decisionFreshness: QuantDataHealthFreshness
  decisionFreshnessDetail: string
  researchEvidenceGroups: { dimension: string, label: string, items: QuantResearchEvidence[] }[]
  researchEvidenceComparison: ResearchEvidenceHistoryComparison | null
  researchRunTimeline: ResearchRunTimeline
  researchReportCopying: boolean
  researchReportCopyOutcome: 'success' | 'error' | null
  researchReportCopyMessage: string
  selectedTsCode: string | null
  formatNumber: (value: number | null) => string
  formatPercent: (value: number | null) => string
  formatSignalScore: (value: number | null) => string
  formatFactorLabel: (value: string) => string
  formatDateTime: (value: string | null) => string
  formatTradeDate: (value: string | null) => string
  formatEvidenceDate: (value: string | null) => string
  formatComparisonPosition: (value: number | null) => string
  formatLowerComparisonPosition: (value: number | null) => string
  formatMarketCap: (value: number | null) => string
  formatFinancialAmount: (value: number | null) => string
  formatMetricPercent: (value: number | null) => string
  formatRatioPercent: (value: number | null) => string
  formatMultiple: (value: number | null) => string
  formatDividendYield: (value: number | null) => string
  formatTrendDelta: (value: number | null) => string
  formatPersistenceRate: (value: number | null) => string
  formatScoreDelta: (value: number | null) => string
  scoreDeltaClass: (value: number | null) => string
  candidatePersistenceFor: (item: CandidateItem | null) => CandidateSignalPersistence
  candidatePersistenceLabel: (item: CandidateItem | null) => string
  candidatePersistenceClass: (item: CandidateItem | null) => string
  candidatePriorityFor: (item: CandidateItem) => ResearchPriority
  researchPriorityDetail: (item: CandidateItem) => string
  researchPriorityActionClass: (item: CandidateItem) => string
  researchRunStatusLabel: (status: QuantResearchRun['status']) => string
  researchRunStatusClass: (status: QuantResearchRun['status']) => string
  researchRunActionLabel: (action: QuantResearchRun['report']['action']) => string
  researchEvidenceStatusLabel: (status: QuantResearchEvidence['status']) => string
  researchEvidenceStatusClass: (status: QuantResearchEvidence['status']) => string
  formatResearchEvidenceValue: (item: QuantResearchEvidence) => string
  researchEvidenceChangeClass: (kind: ResearchEvidenceChange['kind']) => string
  formatResearchEvidenceDelta: (change: ResearchEvidenceChange) => string
  researchEvidenceHistoryValue: (change: ResearchEvidenceChange, current: boolean) => string
  researchEvidenceHistoryStatus: (change: ResearchEvidenceChange, current: boolean) => string
  researchRunTimelineScoreClass: (direction: ResearchRunScoreDirection) => string
  formatResearchRunTimelineScore: (value: number | null) => string
  formatResearchRunTimelineDelta: (value: number | null, direction?: ResearchRunScoreDirection) => string
  formatResearchRunSourceDate: (value: string | null) => string
  timingWindowClass: (window: TimingWindow) => string
  timingWindowMetricClass: (status: TimingWindowMetricStatus) => string
  timingWindowMetricStatusLabel: (status: TimingWindowMetricStatus) => string
  formatTimingWindowMetric: (metric: TimingWindow['metrics'][number]) => string
  timingHistoryStateClass: (state: TimingWindowState) => string
  formatTimingHistoryRate: (value: number | null) => string
  formatTimingHistoryPercent: (value: number | null) => string
  timingHistoryBucketTitle: (bucket: TimingHistoryBucket) => string
  decisionEvidenceStatusLabel: (status: DecisionEvidenceStatus) => string
  decisionEvidenceStatusClass: (status: DecisionEvidenceStatus) => string
  decisionEvidenceActionClass: (action: string) => string
  shareholderReturnStatusLabel: (item: QuantShareholderReturnItem | null) => string
  shareholderReturnStatusClass: (item: QuantShareholderReturnItem | null) => string
  shareholderReturnHeaderLabel: () => string
  shareholderReturnSourceLabel: (item: QuantShareholderReturnItem | null) => string
  valuationErrorMessage: string
  valuationComparisonErrorMessage: string | null
  valueQualityStatusLabel: (item: QuantValueQualityItem | null) => string
  valueQualityStatusClass: (item: QuantValueQualityItem | null) => string
  formatValueQualityScore: (item: QuantValueQualityItem | null) => string
  formatValueQualityDimension: (item: QuantValueQualityItem | null, key: QuantValueQualityDimension['key']) => string
  valueQualityDimensionSamples: (dimension: QuantValueQualityDimension) => number
  researchEvidenceDomId: (tsCode: string, evidenceKey: string) => string
  parsedError: (error: unknown) => ParsedError
  focusResearchQuestionEvidence: (evidenceKey: string) => void | Promise<void>
  generateResearchReport: () => void | Promise<void>
  downloadResearchReport: () => void
  copyResearchReport: () => void | Promise<void>
  loadResearchRuns: (tsCode: string) => void | Promise<void>
  generateResearchSummary: () => void | Promise<void>
  createDecisionAssistant: (input: { mode: 'buy' | 'holding', costBasis: number | null, quantity: number | null, includeAi: boolean }) => void | Promise<void>
  saveResearchDecision: (action: QuantDecisionRecordAction, note: string | null) => void | Promise<void>
  loadDailyBars: (tsCode: string) => void | Promise<void>
  loadValuation: (tsCode: string) => void | Promise<void>
  loadFinancialQuality: (tsCode: string) => void | Promise<void>
  loadValueSelection: () => void | Promise<void>
  loadShareholderReturns: () => void | Promise<void>
  saveResearchMarker: () => void | Promise<void>
  askResearchQuestion: (question: string) => void | Promise<void>
  generateResearchChangeExplanation: () => void | Promise<void>
  useResearchSummaryNextCheck: (check: string) => void
  useResearchChangeNextCheck: (check: string) => void
}

const {
  selectedStock,
  selectedCandidate,
  selectedResearchMarker,
  selectedResearchReview,
  researchStatusOptions,
  signalRuleCount,
  latestResearchRun,
  latestResearchReport,
  researchRuns,
  researchRunLoading,
  researchRunGenerating,
  researchRunErrorMessage,
  researchSummary,
  researchAiSummary,
  researchSummaryLoading,
  researchSummaryGenerating,
  researchSummaryErrorMessage,
  researchSummaryStreamMode,
  researchSummaryStreamReceivedChars,
  researchSummaryConfigurationError,
  researchAiAudits,
  researchAiAuditsLoading,
  researchAiAuditErrorMessage,
  researchQuestion,
  researchQuestionLoading,
  researchQuestionErrorMessage,
  researchQuestionConfigurationError,
  researchQuestionPromptReady,
  researchChangeExplanation,
  researchChangeExplanationGenerating,
  researchChangeExplanationErrorMessage,
  researchChangeExplanationConfigurationError,
  researchDecisionRecord,
  researchDecisionHistory,
  researchDecisionLoading,
  researchDecisionHistoryLoading,
  researchDecisionSaving,
  researchDecisionLoadErrorMessage,
  researchDecisionHistoryErrorMessage,
  researchDecisionSaveErrorMessage,
  researchDecisionSaveMessage,
  researchSaving,
  researchSaveMessage,
  researchSaveErrorMessage,
  decisionAssistant,
  decisionAssistantHistory,
  decisionAssistantLoading,
  decisionAssistantGenerating,
  decisionAssistantErrorMessage,
  decisionAssistantAiConfigAvailable,
  dailyBars,
  dailyColumns,
  chartBars,
  latestDailyBar,
  latestDate,
  trendStructure,
  timingWindow,
  timingHistory,
  timingHistoryCurrentBucket,
  decisionEvidence,
  valuation,
  valuationComparison,
  hasValuationData,
  financialQuality,
  financialHistory,
  financialComparison,
  financialComparisonError,
  hasFinancialData,
  financialTrendItems,
  selectedValueQuality,
  selectedShareholderReturn,
  loading,
  errors,
  decisionFreshness,
  decisionFreshnessDetail,
  researchEvidenceGroups,
  researchEvidenceComparison,
  researchRunTimeline,
  researchReportCopying,
  researchReportCopyOutcome,
  researchReportCopyMessage,
  selectedTsCode,
  formatNumber,
  formatPercent,
  formatSignalScore,
  formatFactorLabel,
  formatDateTime,
  formatTradeDate,
  formatEvidenceDate,
  formatComparisonPosition,
  formatLowerComparisonPosition,
  formatMarketCap,
  formatFinancialAmount,
  formatMetricPercent,
  formatRatioPercent,
  formatMultiple,
  formatDividendYield,
  formatTrendDelta,
  formatPersistenceRate,
  formatScoreDelta,
  scoreDeltaClass,
  candidatePersistenceFor,
  candidatePersistenceLabel,
  candidatePersistenceClass,
  candidatePriorityFor,
  researchPriorityDetail,
  researchPriorityActionClass,
  researchRunStatusLabel,
  researchRunStatusClass,
  researchRunActionLabel,
  researchEvidenceStatusLabel,
  researchEvidenceStatusClass,
  formatResearchEvidenceValue,
  researchEvidenceChangeClass,
  formatResearchEvidenceDelta,
  researchEvidenceHistoryValue,
  researchEvidenceHistoryStatus,
  researchRunTimelineScoreClass,
  formatResearchRunTimelineScore,
  formatResearchRunTimelineDelta,
  formatResearchRunSourceDate,
  timingWindowClass,
  timingWindowMetricClass,
  timingWindowMetricStatusLabel,
  formatTimingWindowMetric,
  timingHistoryStateClass,
  formatTimingHistoryRate,
  formatTimingHistoryPercent,
  timingHistoryBucketTitle,
  decisionEvidenceStatusLabel,
  decisionEvidenceStatusClass,
  decisionEvidenceActionClass,
  shareholderReturnStatusLabel,
  shareholderReturnStatusClass,
  shareholderReturnHeaderLabel,
  shareholderReturnSourceLabel,
  valuationErrorMessage,
  valuationComparisonErrorMessage,
  valueQualityStatusLabel,
  valueQualityStatusClass,
  formatValueQualityScore,
  formatValueQualityDimension,
  valueQualityDimensionSamples,
  researchEvidenceDomId,
  parsedError,
  focusResearchQuestionEvidence,
  generateResearchReport,
  downloadResearchReport,
  copyResearchReport,
  loadResearchRuns,
  generateResearchSummary,
  createDecisionAssistant,
  saveResearchDecision,
  loadDailyBars,
  loadValuation,
  loadFinancialQuality,
  loadValueSelection,
  loadShareholderReturns,
  saveResearchMarker,
  askResearchQuestion,
  generateResearchChangeExplanation,
  useResearchSummaryNextCheck,
  useResearchChangeNextCheck,
} = defineProps<QuantResearchDetailProps>()

const emit = defineEmits<{
  openSettings: []
}>()

const researchFormStatus = defineModel<ResearchMarkerStatus>('researchFormStatus', { required: true })
const researchFormNote = defineModel<string>('researchFormNote', { required: true })
const researchFormReviewDate = defineModel<string>('researchFormReviewDate', { required: true })
const researchQuestionInput = defineModel<string>('researchQuestionInput', { required: true })

const researchRunSection = ref<{ useQuestionPrompt: (prompt: string) => void } | null>(null)

function useQuestionPrompt(prompt: string): void {
  researchRunSection.value?.useQuestionPrompt(prompt)
}

defineExpose({ useQuestionPrompt })
</script>

<template>
  <section class="quant-detail-content" aria-labelledby="daily-title">
    <QuantDecisionCard
      :selected-candidate="selectedCandidate"
      :selected-research-marker="selectedResearchMarker"
      :selected-research-review="selectedResearchReview"
      :research-status-options="researchStatusOptions"
      :signal-rule-count="signalRuleCount"
      :format-signal-score="formatSignalScore"
      :format-percent="formatPercent"
      :format-factor-label="formatFactorLabel"
      :candidate-priority-for="candidatePriorityFor"
      :research-priority-detail="researchPriorityDetail"
      :research-priority-action-class="researchPriorityActionClass"
    />
    <QuantResearchRunSection
      ref="researchRunSection"
      v-model:research-question-input="researchQuestionInput"
      :selected-stock="selectedStock"
      :latest-daily-bar="latestDailyBar"
      :latest-research-run="latestResearchRun"
      :latest-research-report="latestResearchReport"
      :research-runs="researchRuns"
      :research-run-loading="researchRunLoading"
      :research-run-generating="researchRunGenerating"
      :research-run-error-message="researchRunErrorMessage"
      :research-ai-summary="researchAiSummary"
      :research-summary-loading="researchSummaryLoading"
      :research-summary-generating="researchSummaryGenerating"
      :research-summary-error-message="researchSummaryErrorMessage"
      :research-summary-stream-mode="researchSummaryStreamMode"
      :research-summary-stream-received-chars="researchSummaryStreamReceivedChars"
      :research-summary-configuration-error="researchSummaryConfigurationError"
      :research-ai-audits="researchAiAudits"
      :research-ai-audits-loading="researchAiAuditsLoading"
      :research-ai-audit-error-message="researchAiAuditErrorMessage"
      :research-question="researchQuestion"
      :research-question-loading="researchQuestionLoading"
      :research-question-error-message="researchQuestionErrorMessage"
      :research-question-configuration-error="researchQuestionConfigurationError"
      :research-question-prompt-ready="researchQuestionPromptReady"
      :research-change-explanation="researchChangeExplanation"
      :research-change-explanation-generating="researchChangeExplanationGenerating"
      :research-change-explanation-error-message="researchChangeExplanationErrorMessage"
      :research-change-explanation-configuration-error="researchChangeExplanationConfigurationError"
      :research-decision-record="researchDecisionRecord"
      :research-decision-history="researchDecisionHistory"
      :research-decision-loading="researchDecisionLoading"
      :research-decision-history-loading="researchDecisionHistoryLoading"
      :research-decision-saving="researchDecisionSaving"
      :research-decision-load-error-message="researchDecisionLoadErrorMessage"
      :research-decision-history-error-message="researchDecisionHistoryErrorMessage"
      :research-decision-save-error-message="researchDecisionSaveErrorMessage"
      :research-decision-save-message="researchDecisionSaveMessage"
      :decision-assistant="decisionAssistant"
      :decision-assistant-history="decisionAssistantHistory"
      :decision-assistant-loading="decisionAssistantLoading"
      :decision-assistant-generating="decisionAssistantGenerating"
      :decision-assistant-error-message="decisionAssistantErrorMessage"
      :decision-assistant-ai-config-available="decisionAssistantAiConfigAvailable"
      :decision-freshness="decisionFreshness"
      :decision-freshness-detail="decisionFreshnessDetail"
      :research-evidence-groups="researchEvidenceGroups"
      :research-evidence-comparison="researchEvidenceComparison"
      :research-run-timeline="researchRunTimeline"
      :research-report-copying="researchReportCopying"
      :research-report-copy-outcome="researchReportCopyOutcome"
      :research-report-copy-message="researchReportCopyMessage"
      :format-date-time="formatDateTime"
      :format-research-evidence-value="formatResearchEvidenceValue"
      :format-research-evidence-delta="formatResearchEvidenceDelta"
      :format-research-evidence-history-value="researchEvidenceHistoryValue"
      :format-research-evidence-history-status="researchEvidenceHistoryStatus"
      :format-research-run-timeline-score="formatResearchRunTimelineScore"
      :format-research-run-timeline-delta="formatResearchRunTimelineDelta"
      :format-research-run-source-date="formatResearchRunSourceDate"
      :research-run-status-label="researchRunStatusLabel"
      :research-run-status-class="researchRunStatusClass"
      :research-run-action-label="researchRunActionLabel"
      :research-evidence-status-label="researchEvidenceStatusLabel"
      :research-evidence-status-class="researchEvidenceStatusClass"
      :research-evidence-change-class="researchEvidenceChangeClass"
      :research-run-timeline-score-class="researchRunTimelineScoreClass"
      :research-evidence-dom-id="researchEvidenceDomId"
      :generate-research-report="generateResearchReport"
      :download-research-report="downloadResearchReport"
      :copy-research-report="copyResearchReport"
      :load-research-runs="loadResearchRuns"
      :generate-research-summary="generateResearchSummary"
      :create-decision-assistant="createDecisionAssistant"
      :save-research-decision="saveResearchDecision"
      :focus-research-question-evidence="focusResearchQuestionEvidence"
      :ask-research-question="askResearchQuestion"
      :generate-research-change-explanation="generateResearchChangeExplanation"
      :use-research-summary-next-check="useResearchSummaryNextCheck"
      :use-research-change-next-check="useResearchChangeNextCheck"
      @open-settings="emit('openSettings')"
    />
    <QuantSignalPersistenceSection
      :selected-candidate="selectedCandidate"
      :format-persistence-rate="formatPersistenceRate"
      :format-score-delta="formatScoreDelta"
      :score-delta-class="scoreDeltaClass"
      :candidate-persistence-for="candidatePersistenceFor"
      :candidate-persistence-label="candidatePersistenceLabel"
      :candidate-persistence-class="candidatePersistenceClass"
      :format-factor-label="formatFactorLabel"
      :format-date-time="formatDateTime"
      :format-signal-score="formatSignalScore"
    />
    <QuantTimingSection
      :selected-stock="selectedStock"
      :timing-window="timingWindow"
      :timing-history="timingHistory"
      :timing-history-current-bucket="timingHistoryCurrentBucket"
      :format-trade-date="formatTradeDate"
      :timing-window-class="timingWindowClass"
      :timing-window-metric-class="timingWindowMetricClass"
      :timing-window-metric-status-label="timingWindowMetricStatusLabel"
      :format-timing-window-metric="formatTimingWindowMetric"
      :timing-history-state-class="timingHistoryStateClass"
      :format-timing-history-rate="formatTimingHistoryRate"
      :format-timing-history-percent="formatTimingHistoryPercent"
      :timing-history-bucket-title="timingHistoryBucketTitle"
    />
    <QuantDecisionEvidenceSection
      :decision-evidence="decisionEvidence"
      :format-evidence-date="formatEvidenceDate"
      :format-date-time="formatDateTime"
      :decision-evidence-status-label="decisionEvidenceStatusLabel"
      :decision-evidence-status-class="decisionEvidenceStatusClass"
      :decision-evidence-action-class="decisionEvidenceActionClass"
    />
    <QuantValueQualitySection
      :selected-stock="selectedStock"
      :selected-value-quality="selectedValueQuality"
      :loading="loading"
      :errors="errors"
      :format-date-time="formatDateTime"
      :format-trade-date="formatTradeDate"
      :value-quality-status-label="valueQualityStatusLabel"
      :value-quality-status-class="valueQualityStatusClass"
      :format-value-quality-score="formatValueQualityScore"
      :format-value-quality-dimension="formatValueQualityDimension"
      :value-quality-dimension-samples="valueQualityDimensionSamples"
      :parsed-error="parsedError"
      :load-value-selection="loadValueSelection"
    />
    <QuantResearchMarkerEditor
      v-model:research-form-status="researchFormStatus"
      v-model:research-form-note="researchFormNote"
      v-model:research-form-review-date="researchFormReviewDate"
      :research-status-options="researchStatusOptions"
      :research-saving="researchSaving"
      :research-save-message="researchSaveMessage"
      :research-save-error-message="researchSaveErrorMessage"
      :save-research-marker="saveResearchMarker"
    />
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
    <QuantResearchReadout
      :selected-stock="selectedStock"
      :research-summary="researchSummary"
    />
    <QuantValuationSection
      :selected-stock="selectedStock"
      :selected-ts-code="selectedTsCode"
      :valuation="valuation"
      :valuation-comparison="valuationComparison"
      :has-valuation-data="hasValuationData"
      :loading="loading.valuation"
      :error="errors.valuation"
      :valuation-error-message="valuationErrorMessage"
      :valuation-comparison-error-message="valuationComparisonErrorMessage"
      :format-number="formatNumber"
      :format-date-time="formatDateTime"
      :format-comparison-position="formatComparisonPosition"
      :format-market-cap="formatMarketCap"
      :load-valuation="loadValuation"
    />
    <QuantFinancialQualitySection
      :selected-stock="selectedStock"
      :selected-ts-code="selectedTsCode"
      :financial-quality="financialQuality"
      :financial-history="financialHistory"
      :financial-comparison="financialComparison"
      :financial-comparison-error="financialComparisonError"
      :has-financial-data="hasFinancialData"
      :financial-trend-items="financialTrendItems"
      :loading="loading"
      :errors="errors"
      :format-number="formatNumber"
      :format-percent="formatPercent"
      :format-trade-date="formatTradeDate"
      :format-financial-amount="formatFinancialAmount"
      :format-metric-percent="formatMetricPercent"
      :format-ratio-percent="formatRatioPercent"
      :format-multiple="formatMultiple"
      :format-comparison-position="formatComparisonPosition"
      :format-lower-comparison-position="formatLowerComparisonPosition"
      :format-trend-delta="formatTrendDelta"
      :load-financial-quality="loadFinancialQuality"
    />
    <QuantShareholderReturnsSection
      :selected-shareholder-return="selectedShareholderReturn"
      :loading="loading"
      :errors="errors"
      :format-number="formatNumber"
      :format-financial-amount="formatFinancialAmount"
      :format-trade-date="formatTradeDate"
      :format-dividend-yield="formatDividendYield"
      :shareholder-return-status-label="shareholderReturnStatusLabel"
      :shareholder-return-status-class="shareholderReturnStatusClass"
      :shareholder-return-header-label="shareholderReturnHeaderLabel"
      :shareholder-return-source-label="shareholderReturnSourceLabel"
      :parsed-error="parsedError"
      :load-shareholder-returns="loadShareholderReturns"
    />
    <QuantDailyDataSection
      :selected-stock="selectedStock"
      :selected-ts-code="selectedTsCode"
      :daily-bars="dailyBars"
      :daily-columns="dailyColumns"
      :chart-bars="chartBars"
      :latest-daily-bar="latestDailyBar"
      :latest-date="latestDate"
      :trend-structure="trendStructure"
      :loading="loading"
      :errors="errors"
      :format-number="formatNumber"
      :format-percent="formatPercent"
      :format-trade-date="formatTradeDate"
      :parsed-error="parsedError"
      :load-daily-bars="loadDailyBars"
    />
  </section>
</template>
