<script setup lang="ts">
import type { DecisionEvidence, DecisionEvidenceStatus } from '../../lib/decision-evidence'

export interface QuantDecisionEvidenceSectionProps {
  decisionEvidence: DecisionEvidence | null
  formatEvidenceDate: (value: string | null) => string
  formatDateTime: (value: string | null) => string
  decisionEvidenceStatusLabel: (status: DecisionEvidenceStatus) => string
  decisionEvidenceStatusClass: (status: DecisionEvidenceStatus) => string
  decisionEvidenceActionClass: (action: string) => string
}

const {
  decisionEvidence,
  formatEvidenceDate,
  formatDateTime,
  decisionEvidenceStatusLabel,
  decisionEvidenceStatusClass,
  decisionEvidenceActionClass,
} = defineProps<QuantDecisionEvidenceSectionProps>()
</script>

<template>
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
</template>
