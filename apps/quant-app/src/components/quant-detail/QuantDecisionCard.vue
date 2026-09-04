<script setup lang="ts">
import type {
  CandidateItem,
  QuantResearchMarker,
  ResearchMarkerStatus,
} from '../../lib/quant-view-models'
import type { ResearchPriority } from '../../lib/research-priority'
import type { ResearchReviewMeta } from '../../lib/research-review'
import { Info } from 'lucide-vue-next'

export interface QuantDecisionCardProps {
  selectedCandidate: CandidateItem | null
  selectedResearchMarker: QuantResearchMarker
  selectedResearchReview: ResearchReviewMeta
  researchStatusOptions: { value: ResearchMarkerStatus, label: string }[]
  signalRuleCount: number
  formatSignalScore: (value: number | null) => string
  formatPercent: (value: number | null) => string
  formatFactorLabel: (value: string) => string
  candidatePriorityFor: (item: CandidateItem) => ResearchPriority
  researchPriorityDetail: (item: CandidateItem) => string
  researchPriorityActionClass: (item: CandidateItem) => string
}

const {
  selectedCandidate,
  selectedResearchMarker,
  selectedResearchReview,
  researchStatusOptions,
  signalRuleCount,
  formatSignalScore,
  formatPercent,
  formatFactorLabel,
  candidatePriorityFor,
  researchPriorityDetail,
  researchPriorityActionClass,
} = defineProps<QuantDecisionCardProps>()
</script>

<template>
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
        <small>命中规则 / {{ signalRuleCount }} 条</small>
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
</template>
