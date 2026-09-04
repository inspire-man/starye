<script setup lang="ts">
import type {
  CandidateItem,
  QuantFinancialQualitySnapshot,
  QuantResearchComparison,
  QuantResearchComparisonCitation,
  QuantResearchRun,
  QuantValuationSnapshot,
} from '../lib/quant-view-models'
import type { BatchAiSummaryState } from '../lib/research-batch-ai-summary'
import type { BatchResearchFollowUpState, BatchResearchItemAction } from '../lib/research-batch-follow-up'
import { BrainCircuit, Copy, Download, Eye, RefreshCw, RotateCcw, Sparkles } from 'lucide-vue-next'

interface ComparisonResearchSummary {
  total: number
  success: number
  error: number
  running: number
  pending: number
  completed: number
  started: boolean
  historyLoading: number
  historyError: number
}

interface ComparisonErrors {
  valuation: boolean
  financial: boolean
}

export interface QuantComparisonViewProps {
  selectedCandidateItems: CandidateItem[]
  comparisonLoading: boolean
  comparisonValuations: Record<string, QuantValuationSnapshot | null>
  comparisonFinancials: Record<string, QuantFinancialQualitySnapshot | null>
  comparisonErrors: Record<string, ComparisonErrors>
  comparisonResearchButtonLabel: string
  canCompareCandidates: boolean
  comparisonResearchRunning: boolean
  comparisonResearchSummary: ComparisonResearchSummary
  comparisonResearchExportReady: boolean
  comparisonResearchExporting: boolean
  comparisonResearchCopying: boolean
  comparisonResearchCopyOutcome: 'success' | 'error' | null
  comparisonResearchExportMessage: string
  comparisonResearchExportError: boolean
  comparisonResearchCopyMessage: string
  comparisonResearchAiSummaryReady: boolean
  comparisonResearchAiSummaryRunning: boolean
  comparisonResearchAiSummaryButtonLabel: string
  comparisonResearchAiSummaryMessage: string
  comparisonResearchAiSummaryError: boolean
  comparisonResearchSummaryLabel: string
  comparisonResearchSuccessfulRuns: QuantResearchRun[]
  comparisonAiComparisonReady: boolean
  comparisonAiComparisonLoading: boolean
  comparisonAiComparison: QuantResearchComparison | null
  comparisonAiComparisonError: unknown | null
  comparisonAiComparisonErrorMessage: string
  comparisonAiComparisonExporting: boolean
  comparisonAiComparisonCopying: boolean
  comparisonAiComparisonExportMessage: string
  comparisonAiComparisonExportError: boolean
  comparisonAiComparisonCopyMessage: string
  comparisonAiComparisonCopyOutcome: 'success' | 'error' | null
  comparisonAiNextCheckPromptReady: boolean
  comparisonAiComparisonCitations: QuantResearchComparisonCitation[]
  comparisonResearchAiSummaryStateFor: (item: CandidateItem) => BatchAiSummaryState
  comparisonResearchAiSummaryStatusLabel: (state: BatchAiSummaryState) => string
  comparisonResearchAiSummaryStatusDetail: (state: BatchAiSummaryState) => string
  comparisonResearchStatusLabelFor: (item: CandidateItem) => string
  comparisonResearchStatusDetailFor: (item: CandidateItem) => string
  comparisonResearchHistoryMetaFor: (item: CandidateItem) => string | null
  comparisonResearchActionFor: (item: CandidateItem) => BatchResearchItemAction | null
  comparisonResearchHistoryErrorFor: (item: CandidateItem) => unknown | null
  comparisonResearchHistoryLoadingFor: (item: CandidateItem) => boolean
  comparisonResearchAiSummaryActionFor: (item: CandidateItem) => 'retry' | null
  comparisonResearchItemClass: (item: CandidateItem) => string
  comparisonResearchStateFor: (item: CandidateItem) => BatchResearchFollowUpState
  displayStockName: (item: Pick<CandidateItem, 'tsCode' | 'name'>) => string
  formatNumber: (value: number | null) => string
  formatPercent: (value: number | null) => string
  formatSignalScore: (value: number | null) => string
  formatMetricPercent: (value: number | null) => string
  formatDateTime: (value: string | null) => string
  startBatchResearch: () => void | Promise<void>
  downloadComparisonResearchReports: () => void
  copyComparisonResearchReports: () => void | Promise<void>
  startBatchResearchAiSummary: () => void | Promise<void>
  openBatchResearchResult: (item: CandidateItem) => void | Promise<void>
  retryBatchResearchItem: (item: CandidateItem) => void | Promise<void>
  retryComparisonResearchHistory: (item: CandidateItem) => void | Promise<void>
  retryComparisonResearchAiSummary: (item: CandidateItem) => void | Promise<void>
  generateComparisonAiComparison: () => void | Promise<void>
  downloadComparisonAiComparison: () => void
  copyComparisonAiComparison: () => void | Promise<void>
  openComparisonAiCitation: (citation: QuantResearchComparisonCitation) => void
  useComparisonAiNextCheck: (check: string) => void
}

const {
  selectedCandidateItems,
  comparisonLoading,
  comparisonValuations,
  comparisonFinancials,
  comparisonErrors,
  comparisonResearchButtonLabel,
  canCompareCandidates,
  comparisonResearchRunning,
  comparisonResearchSummary,
  comparisonResearchExportReady,
  comparisonResearchExporting,
  comparisonResearchCopying,
  comparisonResearchCopyOutcome,
  comparisonResearchExportMessage,
  comparisonResearchExportError,
  comparisonResearchCopyMessage,
  comparisonResearchAiSummaryReady,
  comparisonResearchAiSummaryRunning,
  comparisonResearchAiSummaryButtonLabel,
  comparisonResearchAiSummaryMessage,
  comparisonResearchAiSummaryError,
  comparisonResearchSummaryLabel,
  comparisonResearchSuccessfulRuns,
  comparisonAiComparisonReady,
  comparisonAiComparisonLoading,
  comparisonAiComparison,
  comparisonAiComparisonError,
  comparisonAiComparisonErrorMessage,
  comparisonAiComparisonExporting,
  comparisonAiComparisonCopying,
  comparisonAiComparisonExportMessage,
  comparisonAiComparisonExportError,
  comparisonAiComparisonCopyMessage,
  comparisonAiComparisonCopyOutcome,
  comparisonAiNextCheckPromptReady,
  comparisonAiComparisonCitations,
  comparisonResearchAiSummaryStateFor,
  comparisonResearchAiSummaryStatusLabel,
  comparisonResearchAiSummaryStatusDetail,
  comparisonResearchStatusLabelFor,
  comparisonResearchStatusDetailFor,
  comparisonResearchHistoryMetaFor,
  comparisonResearchActionFor,
  comparisonResearchHistoryErrorFor,
  comparisonResearchHistoryLoadingFor,
  comparisonResearchAiSummaryActionFor,
  comparisonResearchItemClass,
  comparisonResearchStateFor,
  displayStockName,
  formatNumber,
  formatPercent,
  formatSignalScore,
  formatMetricPercent,
  formatDateTime,
  startBatchResearch,
  downloadComparisonResearchReports,
  copyComparisonResearchReports,
  startBatchResearchAiSummary,
  openBatchResearchResult,
  retryBatchResearchItem,
  retryComparisonResearchHistory,
  retryComparisonResearchAiSummary,
  generateComparisonAiComparison,
  downloadComparisonAiComparison,
  copyComparisonAiComparison,
  openComparisonAiCitation,
  useComparisonAiNextCheck,
} = defineProps<QuantComparisonViewProps>()
</script>

<template>
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
        <button v-if="comparisonResearchSummary.success" class="secondary-button comparison-research-export-button" type="button" :disabled="!comparisonResearchExportReady || comparisonResearchExporting" title="导出当前批次已经成功生成的研究报告" :aria-label="`导出 ${comparisonResearchSummary.success} 份成功研究报告`" @click="downloadComparisonResearchReports">
          <Download :size="15" aria-hidden="true" />
          {{ comparisonResearchExporting ? '导出中' : `导出 ${comparisonResearchSummary.success} 份` }}
        </button>
        <button v-if="comparisonResearchSummary.success" class="secondary-button comparison-research-copy-button" type="button" :disabled="!comparisonResearchExportReady || comparisonResearchCopying" title="将当前批次研究报告复制到剪贴板" :aria-label="`复制 ${comparisonResearchSummary.success} 份研究报告 Markdown`" @click="copyComparisonResearchReports">
          <Copy :size="15" aria-hidden="true" />
          {{ comparisonResearchCopying ? '复制中' : `复制 ${comparisonResearchSummary.success} 份` }}
        </button>
        <button v-if="comparisonResearchAiSummaryReady" class="secondary-button comparison-research-ai-summary-button" type="button" :disabled="comparisonResearchAiSummaryRunning" title="为当前批次已经完成的研究报告生成 AI 摘要" :aria-label="comparisonResearchAiSummaryButtonLabel" @click="startBatchResearchAiSummary">
          <Sparkles :size="15" :class="comparisonResearchAiSummaryRunning ? 'animate-spin' : ''" aria-hidden="true" />
          {{ comparisonResearchAiSummaryRunning ? '摘要生成中' : comparisonResearchAiSummaryButtonLabel }}
        </button>
      </div>
      <p v-if="comparisonResearchExportMessage" class="comparison-research-export-message" :class="{ 'comparison-research-export-message-error': comparisonResearchExportError }" role="status">
        {{ comparisonResearchExportMessage }}
      </p>
      <p v-if="comparisonResearchCopyMessage" class="comparison-research-copy-message" :class="{ 'comparison-research-copy-message-error': comparisonResearchCopyOutcome === 'error' }" role="status">
        {{ comparisonResearchCopyMessage }}
      </p>
      <p v-if="comparisonResearchAiSummaryMessage" class="comparison-research-ai-summary-message" :class="{ 'comparison-research-ai-summary-message-error': comparisonResearchAiSummaryError }" role="status">
        {{ comparisonResearchAiSummaryMessage }}
      </p>
      <div class="comparison-research-list" role="list" aria-live="polite">
        <div v-for="item in selectedCandidateItems" :key="`research-${item.id}`" class="comparison-research-item" :class="comparisonResearchItemClass(item)" role="listitem">
          <div class="comparison-research-stock">
            <strong>{{ displayStockName(item) }}</strong>
            <small>{{ item.tsCode }}</small>
          </div>
          <div class="comparison-research-detail">
            <span>{{ comparisonResearchStatusLabelFor(item) }}</span>
            <small>{{ comparisonResearchStatusDetailFor(item) }}</small>
            <small v-if="comparisonResearchHistoryMetaFor(item)" class="comparison-research-history-meta">{{ comparisonResearchHistoryMetaFor(item) }}</small>
            <div v-if="comparisonResearchStateFor(item).status === 'success'" class="comparison-research-ai-summary" :class="`comparison-research-ai-summary-${comparisonResearchAiSummaryStateFor(item).status}`">
              <span>AI 摘要 · {{ comparisonResearchAiSummaryStatusLabel(comparisonResearchAiSummaryStateFor(item)) }}</span>
              <small>{{ comparisonResearchAiSummaryStatusDetail(comparisonResearchAiSummaryStateFor(item)) }}</small>
            </div>
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
            <button
              v-if="comparisonResearchHistoryErrorFor(item)"
              class="text-button comparison-research-action"
              type="button"
              :disabled="comparisonResearchHistoryLoadingFor(item)"
              :aria-label="`重试读取 ${displayStockName(item)} 的研究历史`"
              title="只重试读取这一只股票的研究历史"
              @click="retryComparisonResearchHistory(item)"
            >
              <RefreshCw :size="14" :class="comparisonResearchHistoryLoadingFor(item) ? 'animate-spin' : ''" aria-hidden="true" />
              {{ comparisonResearchHistoryLoadingFor(item) ? '读取中' : '重试读取' }}
            </button>
            <button
              v-if="comparisonResearchAiSummaryActionFor(item) === 'retry'"
              class="text-button comparison-research-action"
              type="button"
              :disabled="comparisonResearchAiSummaryRunning"
              :aria-label="`重试 ${displayStockName(item)} 的 AI 摘要`"
              title="只重试这一只股票的 AI 摘要"
              @click="retryComparisonResearchAiSummary(item)"
            >
              <RotateCcw :size="14" :class="comparisonResearchAiSummaryRunning ? 'animate-spin' : ''" aria-hidden="true" />
              重试摘要
            </button>
          </div>
        </div>
      </div>
      <p class="comparison-research-summary" role="status">
        {{ comparisonResearchSummaryLabel }}
      </p>
    </section>
    <section v-if="comparisonAiComparisonReady" class="comparison-ai-panel" aria-labelledby="comparison-ai-title">
      <div class="comparison-ai-heading">
        <div>
          <p class="section-kicker">
            AI RESEARCH
          </p>
          <h3 id="comparison-ai-title">
            AI 对比研究助手
          </h3>
          <p>基于当前已完成的 {{ comparisonResearchSuccessfulRuns.length }} 份研究报告，提炼共同点、差异和下一步核对项。</p>
        </div>
        <button class="primary-button comparison-ai-button" type="button" :disabled="comparisonAiComparisonLoading" :aria-label="comparisonAiComparisonLoading ? 'AI 对比研究生成中' : comparisonAiComparison ? '重新生成 AI 对比研究' : '生成 AI 对比研究'" @click="generateComparisonAiComparison">
          <Sparkles :size="15" :class="comparisonAiComparisonLoading ? 'animate-spin' : ''" aria-hidden="true" />
          {{ comparisonAiComparisonLoading ? '对比生成中' : comparisonAiComparison ? '重新生成对比' : '生成 AI 对比' }}
        </button>
      </div>
      <div v-if="comparisonAiComparisonLoading" class="comparison-ai-state" role="status">
        正在读取已完成的研究报告并生成对比...
      </div>
      <div v-else-if="comparisonAiComparisonError" class="comparison-ai-state comparison-ai-state-error" role="alert">
        <span>{{ comparisonAiComparisonErrorMessage }}</span>
        <button class="text-button" type="button" @click="generateComparisonAiComparison">
          重试
        </button>
      </div>
      <div v-else-if="comparisonAiComparison" class="comparison-ai-result">
        <div class="comparison-ai-result-heading">
          <p class="comparison-ai-meta">
            {{ comparisonAiComparison.provider }} · {{ comparisonAiComparison.model }} · {{ formatDateTime(comparisonAiComparison.generatedAt) }}
          </p>
          <div class="comparison-ai-result-actions">
            <button class="secondary-button comparison-ai-export" type="button" :disabled="comparisonAiComparisonExporting || comparisonAiComparisonCopying" title="将 AI 对比研究导出为 Markdown 文件" aria-label="导出 AI 对比研究为 Markdown 文件" @click="downloadComparisonAiComparison">
              <Download :size="14" aria-hidden="true" />
              {{ comparisonAiComparisonExporting ? '导出中' : '导出 Markdown' }}
            </button>
            <button class="secondary-button comparison-ai-copy" type="button" :disabled="comparisonAiComparisonExporting || comparisonAiComparisonCopying" title="将 AI 对比研究 Markdown 复制到剪贴板" aria-label="复制 AI 对比研究 Markdown" @click="copyComparisonAiComparison">
              <Copy :size="14" aria-hidden="true" />
              {{ comparisonAiComparisonCopying ? '复制中' : '复制 Markdown' }}
            </button>
          </div>
        </div>
        <p v-if="comparisonAiComparisonExportMessage" class="comparison-ai-transfer-message" :class="{ 'comparison-ai-transfer-message-error': comparisonAiComparisonExportError }" role="status">
          {{ comparisonAiComparisonExportMessage }}
        </p>
        <p v-if="comparisonAiComparisonCopyMessage" class="comparison-ai-transfer-message" :class="{ 'comparison-ai-transfer-message-error': comparisonAiComparisonCopyOutcome === 'error' }" role="status">
          {{ comparisonAiComparisonCopyMessage }}
        </p>
        <p class="comparison-ai-overview">
          {{ comparisonAiComparison.overview }}
        </p>
        <div v-if="comparisonAiComparison.commonGround.length" class="comparison-ai-block">
          <strong>共同点</strong>
          <ul>
            <li v-for="item in comparisonAiComparison.commonGround" :key="`common-${item}`">
              {{ item }}
            </li>
          </ul>
        </div>
        <div v-if="comparisonAiComparison.differences.length" class="comparison-ai-block">
          <strong>关键差异</strong>
          <ul>
            <li v-for="(item, index) in comparisonAiComparison.differences" :key="`difference-${item.tsCode}-${index}`">
              <span class="comparison-ai-stock-label">{{ item.tsCode }}</span>{{ item.point }}
              <span v-if="item.evidenceKeys.length" class="comparison-ai-evidence-keys">
                证据：
                <button v-for="evidenceKey in item.evidenceKeys" :key="`${item.tsCode}-${evidenceKey}`" class="text-button comparison-ai-inline-citation" type="button" :aria-label="`打开 ${item.tsCode} 的证据 ${evidenceKey}`" @click="openComparisonAiCitation({ tsCode: item.tsCode, evidenceKey })">
                  {{ evidenceKey }}
                </button>
              </span>
            </li>
          </ul>
        </div>
        <div v-if="comparisonAiComparison.risks.length" class="comparison-ai-block comparison-ai-block-risk">
          <strong>风险</strong>
          <ul>
            <li v-for="item in comparisonAiComparison.risks" :key="`risk-${item}`">
              {{ item }}
            </li>
          </ul>
        </div>
        <div v-if="comparisonAiComparison.nextChecks.length" class="comparison-ai-block">
          <strong>下一步核对</strong>
          <ul>
            <li v-for="item in comparisonAiComparison.nextChecks" :key="`next-${item}`" class="comparison-ai-next-check">
              <span>{{ item }}</span>
              <button
                class="text-button comparison-ai-next-prompt"
                type="button"
                :disabled="!comparisonAiNextCheckPromptReady || !item.trim()"
                :aria-label="`将对比核对项带入当前追问：${item}`"
                title="将对比核对项带入候选 AI 追问"
                @click="useComparisonAiNextCheck(item)"
              >
                <BrainCircuit :size="13" aria-hidden="true" />
                带入追问
              </button>
            </li>
          </ul>
        </div>
        <div v-if="comparisonAiComparisonCitations.length" class="comparison-ai-citations">
          <strong>引用证据</strong>
          <div class="comparison-ai-citation-list">
            <button v-for="citation in comparisonAiComparisonCitations" :key="`${citation.tsCode}-${citation.evidenceKey}`" class="text-button comparison-ai-citation" type="button" :aria-label="`打开 ${citation.tsCode} 的证据 ${citation.evidenceKey}`" @click="openComparisonAiCitation(citation)">
              {{ citation.tsCode }} · {{ citation.evidenceKey }}
            </button>
          </div>
        </div>
      </div>
    </section>
    <p class="comparison-note">
      估值和财务指标来自当前接口的最近可用快照；不同报告期不做强行横比。
    </p>
  </section>
</template>
