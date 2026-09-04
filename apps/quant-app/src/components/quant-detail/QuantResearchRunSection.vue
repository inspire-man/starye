<script setup lang="ts">
import type { QuantDataHealthFreshness } from '../../lib/data-health'
import type {
  DailyBar,
  QuantAiResponseMode,
  QuantAiRunAudit,
  QuantDecisionAssistant,
  QuantDecisionRecord,
  QuantDecisionRecordAction,
  QuantResearchChangeExplanation,
  QuantResearchEvidence,
  QuantResearchQuestion,
  QuantResearchReport,
  QuantResearchRun,
  QuantResearchSummary,
  WatchlistItem,
} from '../../lib/quant-view-models'
import type { ResearchEvidenceChange, ResearchEvidenceHistoryComparison } from '../../lib/research-evidence-history'
import type { ResearchRunScoreDirection, ResearchRunTimeline } from '../../lib/research-run-timeline'
import { CheckCircle2, ChevronRight, Copy, Download, Info, RefreshCw, RotateCcw } from 'lucide-vue-next'
import { ref } from 'vue'
import QuantAiResearchChangeExplanation from '../QuantAiResearchChangeExplanation.vue'
import QuantAiResearchQuestion from '../QuantAiResearchQuestion.vue'
import QuantAiResearchSummary from '../QuantAiResearchSummary.vue'
import QuantDecisionAssistantPanel from '../QuantDecisionAssistant.vue'
import QuantDecisionJournal from '../QuantDecisionJournal.vue'
import QuantDecisionRecommendation from '../QuantDecisionRecommendation.vue'

export interface QuantResearchRunSectionProps {
  selectedStock: WatchlistItem | null
  latestDailyBar: DailyBar | null
  latestResearchRun: QuantResearchRun | null
  latestResearchReport: QuantResearchReport | null
  researchRuns: QuantResearchRun[]
  researchRunLoading: boolean
  researchRunGenerating: boolean
  researchRunErrorMessage: string | null
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
  decisionAssistant: QuantDecisionAssistant | null
  decisionAssistantHistory: QuantDecisionAssistant[]
  decisionAssistantLoading: boolean
  decisionAssistantGenerating: boolean
  decisionAssistantErrorMessage: string | null
  decisionAssistantAiConfigAvailable: boolean | null
  decisionFreshness: QuantDataHealthFreshness
  decisionFreshnessDetail: string
  researchEvidenceGroups: { dimension: string, label: string, items: QuantResearchEvidence[] }[]
  researchEvidenceComparison: ResearchEvidenceHistoryComparison | null
  researchRunTimeline: ResearchRunTimeline
  researchReportCopying: boolean
  researchReportCopyOutcome: 'success' | 'error' | null
  researchReportCopyMessage: string
  researchQuestionInput: string
  formatDateTime: (value: string | null) => string
  formatResearchEvidenceValue: (item: QuantResearchEvidence) => string
  formatResearchEvidenceDelta: (change: ResearchEvidenceChange) => string
  formatResearchEvidenceHistoryValue: (change: ResearchEvidenceChange, current: boolean) => string
  formatResearchEvidenceHistoryStatus: (change: ResearchEvidenceChange, current: boolean) => string
  formatResearchRunTimelineScore: (value: number | null) => string
  formatResearchRunTimelineDelta: (value: number | null, direction?: ResearchRunScoreDirection) => string
  formatResearchRunSourceDate: (value: string | null) => string
  researchRunStatusLabel: (status: QuantResearchRun['status']) => string
  researchRunStatusClass: (status: QuantResearchRun['status']) => string
  researchRunActionLabel: (action: QuantResearchRun['report']['action']) => string
  researchEvidenceStatusLabel: (status: QuantResearchEvidence['status']) => string
  researchEvidenceStatusClass: (status: QuantResearchEvidence['status']) => string
  researchEvidenceChangeClass: (kind: ResearchEvidenceChange['kind']) => string
  researchRunTimelineScoreClass: (direction: ResearchRunScoreDirection) => string
  researchEvidenceDomId: (tsCode: string, evidenceKey: string) => string
  generateResearchReport: () => void | Promise<void>
  downloadResearchReport: () => void
  copyResearchReport: () => void | Promise<void>
  loadResearchRuns: (tsCode: string) => void | Promise<void>
  generateResearchSummary: () => void | Promise<void>
  createDecisionAssistant: (input: { mode: 'buy' | 'holding', costBasis: number | null, quantity: number | null, includeAi: boolean }) => void | Promise<void>
  saveResearchDecision: (action: QuantDecisionRecordAction, note: string | null) => void | Promise<void>
  focusResearchQuestionEvidence: (evidenceKey: string) => void | Promise<void>
  askResearchQuestion: (question: string) => void | Promise<void>
  generateResearchChangeExplanation: () => void | Promise<void>
  useResearchSummaryNextCheck: (check: string) => void
  useResearchChangeNextCheck: (check: string) => void
}

const {
  selectedStock,
  latestDailyBar,
  latestResearchRun,
  latestResearchReport,
  researchRuns,
  researchRunLoading,
  researchRunGenerating,
  researchRunErrorMessage,
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
  decisionAssistant,
  decisionAssistantHistory,
  decisionAssistantLoading,
  decisionAssistantGenerating,
  decisionAssistantErrorMessage,
  decisionAssistantAiConfigAvailable,
  decisionFreshness,
  decisionFreshnessDetail,
  researchEvidenceGroups,
  researchEvidenceComparison,
  researchRunTimeline,
  researchReportCopying,
  researchReportCopyOutcome,
  researchReportCopyMessage,
  formatDateTime,
  formatResearchEvidenceValue,
  formatResearchEvidenceDelta,
  formatResearchEvidenceHistoryValue,
  formatResearchEvidenceHistoryStatus,
  formatResearchRunTimelineScore,
  formatResearchRunTimelineDelta,
  formatResearchRunSourceDate,
  researchRunStatusLabel,
  researchRunStatusClass,
  researchRunActionLabel,
  researchEvidenceStatusLabel,
  researchEvidenceStatusClass,
  researchEvidenceChangeClass,
  researchRunTimelineScoreClass,
  researchEvidenceDomId,
  generateResearchReport,
  downloadResearchReport,
  copyResearchReport,
  loadResearchRuns,
  generateResearchSummary,
  createDecisionAssistant,
  saveResearchDecision,
  focusResearchQuestionEvidence,
  askResearchQuestion,
  generateResearchChangeExplanation,
  useResearchSummaryNextCheck,
  useResearchChangeNextCheck,
} = defineProps<QuantResearchRunSectionProps>()

const emit = defineEmits<{
  openSettings: []
}>()

const researchQuestionInput = defineModel<string>('researchQuestionInput', { required: true })
const questionPanel = ref<{ useQuestionPrompt: (prompt: string) => void } | null>(null)

function useQuestionPrompt(prompt: string): void {
  questionPanel.value?.useQuestionPrompt(prompt)
}

defineExpose({ useQuestionPrompt })
</script>

<template>
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
        <button v-if="latestResearchReport" class="secondary-button research-run-copy-button" type="button" :disabled="researchReportCopying" title="将当前研究报告复制到剪贴板" aria-label="复制当前研究报告 Markdown" @click="copyResearchReport">
          <Copy :size="15" aria-hidden="true" />
          {{ researchReportCopying ? '复制中' : '复制 Markdown' }}
        </button>
      </div>
    </div>
    <p v-if="researchReportCopyMessage" class="research-report-copy-message" :class="{ 'research-report-copy-message-error': researchReportCopyOutcome === 'error' }" role="status">
      {{ researchReportCopyMessage }}
    </p>
    <div v-if="researchRunLoading" class="research-run-state" role="status">
      <RefreshCw :size="16" class="animate-spin" aria-hidden="true" />
      <span>正在读取研究历史</span>
    </div>
    <div v-else-if="researchRunErrorMessage" class="research-run-state research-run-state-error" role="status">
      <Info :size="16" aria-hidden="true" />
      <span>{{ researchRunErrorMessage }}</span>
      <button class="text-button" type="button" @click="loadResearchRuns(selectedStock.tsCode)">
        重试
      </button>
    </div>
    <template v-else-if="latestResearchReport">
      <QuantDecisionRecommendation
        :report="latestResearchReport"
        :summary="researchAiSummary"
        :current-price="latestDailyBar?.close ?? selectedStock.latestClose"
        :current-price-observed-at="latestDailyBar?.tradeDate ?? selectedStock.latestTradeDate"
        :data-freshness="decisionFreshness"
        :data-freshness-detail="decisionFreshnessDetail"
        :ai-review-generating="researchSummaryLoading || researchSummaryGenerating"
        @request-ai-review="generateResearchSummary"
      />
      <QuantDecisionAssistantPanel
        v-if="latestResearchRun"
        :run="latestResearchRun"
        :latest-close="latestDailyBar?.close ?? selectedStock.latestClose"
        :latest-trade-date="latestDailyBar?.tradeDate ?? selectedStock.latestTradeDate"
        :assessment="decisionAssistant"
        :history="decisionAssistantHistory"
        :loading="decisionAssistantLoading"
        :generating="decisionAssistantGenerating"
        :error-message="decisionAssistantErrorMessage"
        :ai-config-available="decisionAssistantAiConfigAvailable"
        @assess="createDecisionAssistant"
        @open-settings="emit('openSettings')"
      />
      <QuantDecisionJournal
        :run="latestResearchRun"
        :record="researchDecisionRecord"
        :history="researchDecisionHistory"
        :loading="researchDecisionLoading"
        :history-loading="researchDecisionHistoryLoading"
        :saving="researchDecisionSaving"
        :latest-price="latestDailyBar?.close ?? selectedStock.latestClose"
        :latest-price-observed-at="latestDailyBar?.tradeDate ?? selectedStock.latestTradeDate"
        :load-error-message="researchDecisionLoadErrorMessage"
        :history-error-message="researchDecisionHistoryErrorMessage"
        :save-error-message="researchDecisionSaveErrorMessage"
        :save-message="researchDecisionSaveMessage"
        @save="saveResearchDecision"
      />
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
            <div v-for="item in group.items" :id="researchEvidenceDomId(latestResearchReport.tsCode, item.key)" :key="item.key" class="research-run-evidence-row" :class="researchEvidenceStatusClass(item.status)" :title="`${item.source} · ${item.formulaVersion}`">
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
        :stream-mode="researchSummaryStreamMode"
        :stream-received-chars="researchSummaryStreamReceivedChars"
        :audit-history="researchAiAudits"
        :audit-history-loading="researchAiAuditsLoading"
        :audit-history-error="researchAiAuditErrorMessage"
        :error-message="researchSummaryErrorMessage"
        :configuration-error="researchSummaryConfigurationError"
        :question-prompt-ready="researchQuestionPromptReady"
        @generate="generateResearchSummary"
        @open-settings="emit('openSettings')"
        @use-next-check="useResearchSummaryNextCheck"
      />
      <QuantAiResearchQuestion
        v-if="!researchRunGenerating"
        ref="questionPanel"
        :report="latestResearchReport"
        :input="researchQuestionInput"
        :result="researchQuestion"
        :loading="researchQuestionLoading"
        :error-message="researchQuestionErrorMessage"
        :configuration-error="researchQuestionConfigurationError"
        @update:input="researchQuestionInput = $event"
        @ask="askResearchQuestion"
        @open-settings="emit('openSettings')"
        @focus-evidence="focusResearchQuestionEvidence"
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
                  <strong>{{ formatResearchEvidenceHistoryValue(change, false) }}</strong>
                  <span>{{ formatResearchEvidenceHistoryStatus(change, false) }}</span>
                </div>
                <ChevronRight :size="14" aria-hidden="true" />
                <div>
                  <small>本次</small>
                  <strong>{{ formatResearchEvidenceHistoryValue(change, true) }}</strong>
                  <span>{{ formatResearchEvidenceHistoryStatus(change, true) }}</span>
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
      <QuantAiResearchChangeExplanation
        v-if="researchEvidenceComparison"
        :comparison="researchEvidenceComparison"
        :explanation="researchChangeExplanation"
        :loading="false"
        :generating="researchChangeExplanationGenerating"
        :error-message="researchChangeExplanationErrorMessage"
        :configuration-error="researchChangeExplanationConfigurationError"
        :question-prompt-ready="researchQuestionPromptReady"
        @generate="generateResearchChangeExplanation"
        @open-settings="emit('openSettings')"
        @use-next-check="useResearchChangeNextCheck"
        @focus-evidence="focusResearchQuestionEvidence"
      />
      <p class="research-run-note">
        这是基于已保存数据的版本化研究快照；报告用于整理核对顺序，不是买入、卖出或收益预测。
      </p>
    </template>
    <div v-else class="research-run-state" role="status">
      <Info :size="16" aria-hidden="true" />
      <span>还没有研究运行，生成一份报告后可在这里回看证据链。</span>
    </div>
  </section>
</template>
