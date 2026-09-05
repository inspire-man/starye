<script setup lang="ts">
import type { Column } from '@starye/ui'
import type { Component } from 'vue'
import type { CandidateEvidenceScore } from '../lib/candidate-evidence-score'
import type {
  CandidateItem,
  CandidateSnapshot,
  QuantAiCandidateBriefing,
  QuantAiCandidateBriefingQuestion,
  QuantDecisionRecord,
  QuantResearchMarker,
  QuantValueQualityItem,
  WatchlistItem,
} from '../lib/quant-view-models'
import type { AutomatedResearchCandidate, AutomatedResearchItemState } from '../lib/research-automation'
import type { ResearchPriority, ResearchPrioritySummary } from '../lib/research-priority'
import type { ResearchReviewMeta } from '../lib/research-review'
import type { CandidateResearchStatus, CandidateReviewFilter, CandidateSortKey, SelectionPreset, SelectionPresetKey } from '../lib/selection-presets'
import { DataTable } from '@starye/ui'
import { BarChart3, ChevronRight, Info, Plus, RefreshCw, RotateCcw } from 'lucide-vue-next'
import { ref } from 'vue'
import QuantAiCandidateBriefingPanel from './QuantAiCandidateBriefing.vue'
import QuantAiTrustOverview from './QuantAiTrustOverview.vue'
import QuantDecisionQueue from './QuantDecisionQueue.vue'
import QuantResearchAutomation from './QuantResearchAutomation.vue'

export interface CandidateFilterOption extends SelectionPreset {
  icon: Component
}

export interface CandidateEvidenceSummary {
  ready: number
  partial: number
  missing: number
  unavailable: number
}

export interface ResearchPriorityQueueEntry {
  item: CandidateItem
  priority: ResearchPriority
}

type CandidateAiBriefingCopyOutcome = 'success' | 'error' | null

const props = defineProps<{
  candidateItems: CandidateItem[]
  snapshot: CandidateSnapshot | null
  scannedCandidateCount: number
  pendingCandidateCount: number
  watchlist: WatchlistItem[]
  adding: boolean
  candidateFilterOptions: CandidateFilterOption[]
  candidateSortOptions: { value: CandidateSortKey, label: string }[]
  candidateResearchStatusOptions: { value: CandidateResearchStatus, label: string }[]
  candidateReviewDueOptions: { value: CandidateReviewFilter, label: string }[]
  candidateQueryActive: boolean
  filteredCandidateItems: CandidateItem[]
  activeCandidatePreset: SelectionPreset
  signalRuleCount: number
  candidateEvidenceSummary: CandidateEvidenceSummary
  valueQualityLoading: boolean
  valueQualityError: boolean
  automatedResearchDisplayCandidates: AutomatedResearchCandidate[]
  automatedResearchStates: Record<string, AutomatedResearchItemState>
  automatedResearchRunning: boolean
  automatedResearchAiReady: boolean | null
  automatedResearchAiConfigErrorMessage: string | null
  automatedResearchErrorMessage: string | null
  researchPriorityTotal: number
  researchPriorityHighestLabel: string
  researchPrioritySummary: ResearchPrioritySummary
  visibleResearchPriorityQueue: ResearchPriorityQueueEntry[]
  decisionQueueRecords: QuantDecisionRecord[]
  decisionQueueLoading: boolean
  decisionQueueErrorMessage: string | null
  candidateAiBriefing: QuantAiCandidateBriefing | null
  candidateBriefingScopeItemsCount: number
  candidateAiBriefingScopeCount: number | null
  candidateBriefingScopeKey: string
  currentCandidateCodes: string[]
  candidateAiBriefingHistoryResetKey: number
  candidateAiBriefingAvailable: boolean
  candidateAiBriefingLoading: boolean
  candidateAiBriefingErrorMessage: string | null
  candidateAiBriefingConfigurationError: boolean
  candidateAiBriefingQuestionInput: string
  candidateAiBriefingQuestion: QuantAiCandidateBriefingQuestion | null
  candidateAiBriefingQuestionLoading: boolean
  candidateAiBriefingQuestionErrorMessage: string | null
  candidateAiBriefingQuestionConfigurationError: boolean
  candidateAiBriefingCopying: boolean
  candidateAiBriefingCopyOutcome: CandidateAiBriefingCopyOutcome
  candidateAiBriefingCopyMessage: string
  candidateColumns: Column<CandidateItem>[]
  candidatesLoading: boolean
  selectedCandidateIds: Set<string>
  selectedCandidateItems: CandidateItem[]
  canCompareCandidates: boolean
  candidateEvidenceFor: (item: CandidateItem) => CandidateEvidenceScore
  candidatePersistenceLabel: (item: CandidateItem | null) => string
  candidatePersistenceClass: (item: CandidateItem | null) => string
  candidatePersistenceDetail: (item: CandidateItem | null) => string
  candidatePriorityFor: (item: CandidateItem) => ResearchPriority
  researchPriorityDetail: (item: CandidateItem) => string
  researchPriorityClass: (item: CandidateItem) => string
  researchPriorityActionClass: (item: CandidateItem) => string
  valueQualityFor: (tsCode: string) => QuantValueQualityItem | null
  valueQualityStatusLabel: (item: QuantValueQualityItem | null) => string
  valueQualityStatusClass: (item: QuantValueQualityItem | null) => string
  valueQualitySummary: (item: QuantValueQualityItem | null) => string
  researchReviewFor: (tsCode: string) => ResearchReviewMeta
  researchMarkerMap: ReadonlyMap<string, QuantResearchMarker>
  displayStockName: (item: Pick<CandidateItem, 'tsCode' | 'name'>) => string
}>()

const emit = defineEmits<{
  navigateWatchlist: []
  addToWatchlistAndResearch: []
  resetCandidateQuery: []
  openComparisonDrawer: []
  clearCandidateSelection: []
  startAutomatedResearch: []
  retryAutomatedResearchItem: [tsCode: string]
  focusDecisionQueue: [tsCode: string]
  openSettings: []
  selectStock: [item: CandidateItem]
  toggleCandidateSelection: [id: string]
  toggleAllCandidateSelection: []
  generateCandidateAiBriefing: []
  updateCandidateAiBriefingQuestionInput: [value: string]
  askCandidateAiBriefingQuestion: [question: string]
  focusCandidateFromBriefing: [tsCode: string]
  copyCandidateAiBriefing: []
  downloadCandidateAiBriefing: []
  handleCandidateAiSessionDeleted: [sessionId: string]
}>()

const candidateFilter = defineModel<SelectionPresetKey>('candidateFilter', { required: true })
const candidateMinScore = defineModel<number>('candidateMinScore', { required: true })
const candidateCompleteOnly = defineModel<boolean>('candidateCompleteOnly', { required: true })
const candidateSort = defineModel<CandidateSortKey>('candidateSort', { required: true })
const candidateResearchStatus = defineModel<CandidateResearchStatus>('candidateResearchStatus', { required: true })
const candidateReviewDue = defineModel<CandidateReviewFilter>('candidateReviewDue', { required: true })
const watchCode = defineModel<string>('watchCode', { required: true })
const watchName = defineModel<string>('watchName', { required: true })

const candidateAiBriefingPanel = ref<{ useQuestionPrompt: (prompt: string) => void } | null>(null)

function useQuestionPrompt(prompt: string): void {
  candidateAiBriefingPanel.value?.useQuestionPrompt(prompt)
}

defineExpose({ useQuestionPrompt })

function parsedErrorMessage(message: string | null): string | null {
  return message
}

function formatNumber(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatSignalScore(value: number | null): string {
  return value === null ? '--' : `${value} / ${props.signalRuleCount}`
}

function signalScorePercent(value: number | null): number {
  if (value === null || props.signalRuleCount <= 0)
    return 0
  return Math.min(100, Math.max(0, (value / props.signalRuleCount) * 100))
}

function formatTradeDate(value: string | null): string {
  if (!value)
    return '--'
  if (/^\d{8}$/.test(value))
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
  return value
}

function formatDateTime(value: string | null): string {
  if (!value)
    return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function candidateEvidenceStatusLabel(item: CandidateEvidenceScore): string {
  if (item.status === 'ready')
    return '证据充分'
  if (item.status === 'partial')
    return '部分覆盖'
  if (item.status === 'missing')
    return '待补证据'
  if (props.valueQualityLoading)
    return '读取中'
  if (props.valueQualityError)
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

function formatValueQualityScore(item: CandidateItem): string {
  const result = props.valueQualityFor(item.tsCode)
  return result?.score === null || result?.score === undefined ? '--' : `${result.score.toFixed(1)} / 100`
}

function candidateEvidenceDetail(item: CandidateItem): string {
  const result = props.candidateEvidenceFor(item)
  const reason = result.missingReasons[0]
  return reason ? `${result.summary} · ${reason}` : result.summary
}

function candidateEvidenceActionLabel(item: CandidateItem): string | null {
  const result = props.candidateEvidenceFor(item)
  if (result.status === 'ready')
    return null
  return props.valueQualityLoading ? '读取中' : '去补齐'
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

function reviewStatusClass(item: CandidateItem): string {
  return `review-state-text-${props.researchReviewFor(item.tsCode).state}`
}

function reviewStatusLabel(item: CandidateItem): string {
  return props.researchReviewFor(item.tsCode).label
}

function researchMarkerStatus(item: CandidateItem): string | null {
  return props.researchMarkerMap.get(item.tsCode)?.status || null
}

function signalListTitle(item: CandidateItem): string | undefined {
  const status = researchMarkerStatus(item)
  return status ? props.candidateResearchStatusOptions.find(option => option.value === status)?.label : undefined
}

function emitNavigateWatchlist(): void {
  emit('navigateWatchlist')
}

function emitSelectStock(item: CandidateItem): void {
  emit('selectStock', item)
}

function emitResearchPrioritySelect(entry: ResearchPriorityQueueEntry): void {
  emitSelectStock(entry.item)
}
</script>

<template>
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
        <button class="secondary-button" type="button" title="打开观察池并新增股票" @click="emitNavigateWatchlist">
          <Plus :size="14" aria-hidden="true" />
          添加观察股
        </button>
        <button class="secondary-button" type="button" title="打开观察池并更新日线数据" @click="emitNavigateWatchlist">
          <RefreshCw :size="14" aria-hidden="true" />
          更新数据
        </button>
      </div>
      <div class="snapshot-meta">
        <span>数据截至 {{ formatTradeDate(props.snapshot?.toDate || null) }}</span>
        <span>计算 {{ formatDateTime(props.snapshot?.generatedAt || null) }}</span>
      </div>
    </div>
    <div class="candidate-sync-summary" aria-label="候选数据覆盖状态">
      <span>当前观察池 <strong>{{ props.candidateItems.length }}</strong> 只</span>
      <span>已计算 <strong>{{ props.scannedCandidateCount }}</strong> 只</span>
      <span :class="props.pendingCandidateCount ? 'candidate-sync-summary-warning' : ''">待更新 <strong>{{ props.pendingCandidateCount }}</strong> 只</span>
    </div>
    <div v-if="props.pendingCandidateCount" class="candidate-pending-callout" role="status">
      <Info :size="16" aria-hidden="true" />
      <span>{{ props.pendingCandidateCount }} 只新加入的股票还没有进入最近一次日线快照，更新观察池后才会计算信号、趋势和价值质量。</span>
      <button class="text-button" type="button" @click="emitNavigateWatchlist">
        去更新
      </button>
    </div>
    <form class="candidate-add-form" aria-label="从候选研究新增观察股" @submit.prevent="emit('addToWatchlistAndResearch')">
      <label class="sr-only" for="candidate-quant-code">新增股票代码</label>
      <input id="candidate-quant-code" v-model="watchCode" class="field-control field-code" inputmode="text" autocomplete="off" placeholder="输入代码，如 600000.SH" maxlength="9">
      <label class="sr-only" for="candidate-quant-name">新增股票名称</label>
      <input id="candidate-quant-name" v-model="watchName" class="field-control" autocomplete="off" placeholder="名称可留空，系统会解析" maxlength="40">
      <button class="primary-button" type="submit" :disabled="props.adding || props.watchlist.length >= 50">
        <Plus :size="15" aria-hidden="true" />
        {{ props.adding ? '加入中' : '加入观察池并研究' }}
      </button>
    </form>
    <div class="candidate-toolbar">
      <div class="candidate-filter-group" role="group" aria-label="择股预设">
        <button
          v-for="option in props.candidateFilterOptions"
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
            <option :value="0">不限</option>
            <option :value="2">2 分以上</option>
            <option :value="4">4 分以上</option>
          </select>
        </label>
        <label class="candidate-query-field">
          <span>排序</span>
          <select v-model="candidateSort" class="candidate-query-select">
            <option v-for="option in props.candidateSortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="candidate-query-field">
          <span>研究状态</span>
          <select v-model="candidateResearchStatus" class="candidate-query-select">
            <option v-for="option in props.candidateResearchStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="candidate-query-field">
          <span>复查状态</span>
          <select v-model="candidateReviewDue" class="candidate-query-select">
            <option v-for="option in props.candidateReviewDueOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="candidate-query-check">
          <input v-model="candidateCompleteOnly" type="checkbox">
          <span>只看数据完整</span>
        </label>
        <button v-if="props.candidateQueryActive" class="candidate-reset-button" type="button" title="重置自定义筛选" @click="emit('resetCandidateQuery')">
          <RotateCcw :size="14" aria-hidden="true" />
          重置
        </button>
      </div>
      <div class="candidate-toolbar-meta">
        <span class="section-meta">显示 {{ props.filteredCandidateItems.length }} / {{ props.candidateItems.length }}</span>
        <button class="compare-button" type="button" :disabled="!props.canCompareCandidates" @click="emit('openComparisonDrawer')">
          <BarChart3 :size="14" aria-hidden="true" />
          对比 {{ props.selectedCandidateItems.length }} 只
        </button>
        <button v-if="props.selectedCandidateItems.length" class="text-button candidate-clear-button" type="button" @click="emit('clearCandidateSelection')">
          清除选择
        </button>
      </div>
    </div>
    <div class="selection-guide" aria-label="择股预设说明">
      <div class="selection-guide-copy">
        <span class="section-kicker">START WITH A PRESET</span>
        <strong>{{ props.activeCandidatePreset.label }}</strong>
        <span>{{ props.activeCandidatePreset.description }}</span>
      </div>
      <span class="selection-guide-count">命中 {{ props.filteredCandidateItems.length }} 只</span>
    </div>
    <div class="selection-legend" aria-label="指标释义">
      <span><strong>信号分</strong>命中规则 / {{ props.signalRuleCount }} 条</span>
      <span><strong>20 日表现</strong>近 20 个交易日收益</span>
      <span><strong>成交活跃度</strong>相对近 5 日均量</span>
      <span><strong>价值质量</strong>估值、经营、增长、趋势四维观察</span>
    </div>
    <section v-if="props.candidateItems.length" class="candidate-evidence-overview" aria-label="候选证据就绪度">
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
          <strong class="candidate-evidence-overview-ready">{{ props.candidateEvidenceSummary.ready }}</strong><span>可直接核对</span>
        </div>
        <div role="listitem">
          <strong class="candidate-evidence-overview-partial">{{ props.candidateEvidenceSummary.partial }}</strong><span>部分覆盖</span>
        </div>
        <div role="listitem">
          <strong class="candidate-evidence-overview-missing">{{ props.candidateEvidenceSummary.missing }}</strong><span>待补证据</span>
        </div>
        <div role="listitem">
          <strong class="candidate-evidence-overview-unavailable">{{ props.candidateEvidenceSummary.unavailable }}</strong><span>{{ props.valueQualityLoading ? '读取中' : props.valueQualityError ? '暂不可用' : '待加载' }}</span>
        </div>
      </div>
      <p>仅衡量原始字段是否齐全；价值质量分仍单独表示指标表现。</p>
    </section>
    <QuantResearchAutomation
      :candidates="props.automatedResearchDisplayCandidates"
      :states="props.automatedResearchStates"
      :running="props.automatedResearchRunning"
      :ai-ready="props.automatedResearchAiReady"
      :ai-config-error-message="parsedErrorMessage(props.automatedResearchAiConfigErrorMessage)"
      :error-message="parsedErrorMessage(props.automatedResearchErrorMessage)"
      @start="emit('startAutomatedResearch')"
      @retry="emit('retryAutomatedResearchItem', $event)"
      @focus="emit('focusDecisionQueue', $event)"
      @open-settings="emit('openSettings')"
    />
    <div v-if="props.snapshot && props.snapshot.candidates.length" class="snapshot-range">
      <span>观察窗口</span>
      <strong>{{ formatTradeDate(props.snapshot.fromDate || null) }} → {{ formatTradeDate(props.snapshot.toDate || null) }}</strong>
      <span class="snapshot-range-divider">·</span>
      <span>{{ props.snapshot.factorVersion || '动量信号' }}</span>
    </div>
    <section v-if="props.researchPriorityTotal" class="research-priority-queue" aria-labelledby="research-priority-title">
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
          <span>{{ props.researchPriorityTotal }} 只候选</span>
          <span class="research-priority-info" role="img" tabindex="0" aria-label="研究优先级只用于安排核对顺序，不代表买卖指令" title="研究优先级只用于安排核对顺序，不代表买卖指令"><Info :size="14" aria-hidden="true" /></span>
        </div>
      </div>
      <div class="research-priority-summary" role="list" aria-label="研究队列统计">
        <div class="research-priority-summary-item" role="listitem">
          <strong>{{ props.researchPriorityHighestLabel }}</strong><span>最高优先</span>
        </div>
        <div class="research-priority-summary-item" role="listitem">
          <strong>{{ props.researchPrioritySummary.dataGap }}</strong><span>待补数据</span>
        </div>
        <div class="research-priority-summary-item" role="listitem">
          <strong>{{ props.researchPrioritySummary.review }}</strong><span>待复查</span>
        </div>
        <div class="research-priority-summary-item" role="listitem">
          <strong>{{ props.researchPrioritySummary.risk }}</strong><span>核对风险</span>
        </div>
        <div class="research-priority-summary-item" role="listitem">
          <strong>{{ props.researchPrioritySummary.valueQuality }}</strong><span>补看价值</span>
        </div>
      </div>
      <div class="research-priority-list">
        <button v-for="entry in props.visibleResearchPriorityQueue" :key="entry.item.tsCode" class="research-priority-row" type="button" @click="emitResearchPrioritySelect(entry)">
          <span class="research-priority-badge" :class="props.researchPriorityClass(entry.item)">{{ entry.priority.levelLabel }}</span>
          <span class="research-priority-stock"><strong>{{ props.displayStockName(entry.item) }}</strong><small>{{ entry.item.tsCode }} · {{ entry.priority.score }} 分</small></span>
          <span class="research-priority-detail"><strong :class="props.researchPriorityActionClass(entry.item)">{{ entry.priority.actionLabel }}</strong><small>{{ entry.priority.reasons.join('；') }}</small></span>
          <ChevronRight :size="15" aria-hidden="true" />
        </button>
      </div>
      <p v-if="props.researchPriorityTotal > props.visibleResearchPriorityQueue.length" class="research-priority-more">
        还有 {{ props.researchPriorityTotal - props.visibleResearchPriorityQueue.length }} 条记录，请使用研究优先排序查看
      </p>
    </section>
    <QuantDecisionQueue
      v-if="props.candidateItems.length || props.decisionQueueRecords.length"
      :records="props.decisionQueueRecords"
      :candidates="props.candidateItems"
      :watchlist="props.watchlist"
      :candidate-trade-date="props.snapshot?.toDate || null"
      :loading="props.decisionQueueLoading"
      :error-message="props.decisionQueueErrorMessage"
      @focus="emit('focusDecisionQueue', $event)"
    />
    <QuantAiTrustOverview
      v-if="props.candidateItems.length || props.decisionQueueRecords.length"
      :records="props.decisionQueueRecords"
      :candidates="props.candidateItems"
      :watchlist="props.watchlist"
      :candidate-trade-date="props.snapshot?.toDate || null"
      :loading="props.decisionQueueLoading"
      :error-message="props.decisionQueueErrorMessage"
      @focus="emit('focusDecisionQueue', $event)"
    />
    <QuantAiCandidateBriefingPanel
      v-if="props.candidateItems.length"
      ref="candidateAiBriefingPanel"
      :briefing="props.candidateAiBriefing"
      :candidate-count="props.candidateItems.length"
      :filtered-candidate-count="props.filteredCandidateItems.length"
      :briefing-available-candidate-count="props.candidateBriefingScopeItemsCount"
      :briefing-candidate-count="props.candidateAiBriefingScopeCount"
      :current-scope-key="props.candidateBriefingScopeKey"
      :current-snapshot-id="props.snapshot?.id || null"
      :current-candidate-codes="props.currentCandidateCodes"
      :history-reset-key="props.candidateAiBriefingHistoryResetKey"
      :available="props.candidateAiBriefingAvailable"
      :loading="props.candidateAiBriefingLoading"
      :error-message="props.candidateAiBriefingErrorMessage"
      :configuration-error="props.candidateAiBriefingConfigurationError"
      :question-input="props.candidateAiBriefingQuestionInput"
      :question-result="props.candidateAiBriefingQuestion"
      :question-loading="props.candidateAiBriefingQuestionLoading"
      :question-error-message="props.candidateAiBriefingQuestionErrorMessage"
      :question-configuration-error="props.candidateAiBriefingQuestionConfigurationError"
      :copying="props.candidateAiBriefingCopying"
      :copy-outcome="props.candidateAiBriefingCopyOutcome"
      :copy-message="props.candidateAiBriefingCopyMessage"
      @generate="emit('generateCandidateAiBriefing')"
      @update:question-input="emit('updateCandidateAiBriefingQuestionInput', $event)"
      @ask-question="emit('askCandidateAiBriefingQuestion', $event)"
      @open-settings="emit('openSettings')"
      @focus-candidate="emit('focusCandidateFromBriefing', $event)"
      @copy="emit('copyCandidateAiBriefing')"
      @export="emit('downloadCandidateAiBriefing')"
      @session-deleted="emit('handleCandidateAiSessionDeleted', $event)"
    />
    <div class="quant-table-frame candidate-table-frame">
      <DataTable
        :data="props.filteredCandidateItems"
        :columns="props.candidateColumns"
        :loading="props.candidatesLoading"
        selectable
        :selected-ids="props.selectedCandidateIds"
        min-width="1580px"
        :empty-message="props.candidateItems.length ? '当前筛选没有候选' : '暂无候选快照，完成一次日线同步后查看'"
        @toggle-select="emit('toggleCandidateSelection', $event)"
        @toggle-select-all="emit('toggleAllCandidateSelection')"
        @row-click="emit('selectStock', $event)"
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
          <div class="research-priority-cell" :title="props.researchPriorityDetail(item)">
            <span class="research-priority-badge" :class="props.researchPriorityClass(item)">{{ props.candidatePriorityFor(item).levelLabel }}</span>
            <small>{{ props.candidatePriorityFor(item).score }} 分</small>
          </div>
        </template>
        <template #cell-persistence="{ item }">
          <div class="candidate-persistence-cell" :title="props.candidatePersistenceDetail(item)">
            <span class="candidate-persistence-state" :class="props.candidatePersistenceClass(item)">{{ props.candidatePersistenceLabel(item) }}</span>
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
          <div class="value-quality-table-cell" :title="props.valueQualitySummary(props.valueQualityFor(item.tsCode))">
            <strong :class="props.valueQualityStatusClass(props.valueQualityFor(item.tsCode))">{{ formatValueQualityScore(item) }}</strong>
            <small>{{ props.valueQualityStatusLabel(props.valueQualityFor(item.tsCode)) }}</small>
          </div>
        </template>
        <template #cell-evidence="{ item }">
          <div class="candidate-evidence-cell" :title="candidateEvidenceDetail(item)" :aria-label="`${candidateEvidenceStatusLabel(props.candidateEvidenceFor(item))}，${candidateEvidenceDetail(item)}`">
            <div class="candidate-evidence-cell-heading">
              <strong :class="candidateEvidenceStatusClass(props.candidateEvidenceFor(item))">{{ formatCandidateEvidenceScore(props.candidateEvidenceFor(item)) }}</strong>
              <span :class="candidateEvidenceStatusClass(props.candidateEvidenceFor(item))">{{ candidateEvidenceStatusLabel(props.candidateEvidenceFor(item)) }}</span>
            </div>
            <small>{{ candidateEvidenceCoverage(props.candidateEvidenceFor(item)) }}</small>
            <button
              v-if="candidateEvidenceActionLabel(item)"
              class="text-button candidate-evidence-action"
              type="button"
              :disabled="props.valueQualityLoading"
              title="打开分析详情，按缺失维度刷新数据"
              @click.stop="emit('selectStock', item)"
            >
              <ChevronRight :size="12" aria-hidden="true" />
              {{ candidateEvidenceActionLabel(item) }}
            </button>
          </div>
        </template>
        <template #cell-review="{ item }">
          <div class="review-cell" :title="props.researchReviewFor(item.tsCode).detail" :aria-label="`${reviewStatusLabel(item)}，${props.researchReviewFor(item.tsCode).date || '未设置日期'}`">
            <span class="review-cell-label" :class="reviewStatusClass(item)">{{ reviewStatusLabel(item) }}</span>
            <small>{{ props.researchReviewFor(item.tsCode).date || '--' }}</small>
          </div>
        </template>
        <template #cell-action="{ item }">
          <div class="candidate-action-cell" :title="props.researchPriorityDetail(item)" :aria-label="`${props.candidatePriorityFor(item).actionLabel}：${props.researchPriorityDetail(item)}`">
            <span class="candidate-action-badge" :class="props.researchPriorityActionClass(item)">{{ props.candidatePriorityFor(item).actionLabel }}</span>
            <small>{{ props.candidatePriorityFor(item).reasons[0] || '按当前数据保持观察' }}</small>
          </div>
        </template>
        <template #cell-signals="{ item }">
          <div class="signal-list candidate-signal-list">
            <span v-if="researchMarkerStatus(item) && researchMarkerStatus(item) !== 'unreviewed'" class="research-status-dot" :class="`research-status-${researchMarkerStatus(item)}`" :title="signalListTitle(item) || undefined" aria-hidden="true" />
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
