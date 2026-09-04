<script setup lang="ts">
import type { CandidateItem, CandidateSignalPersistence } from '../../lib/quant-view-models'
import { Info } from 'lucide-vue-next'

export interface QuantSignalPersistenceSectionProps {
  selectedCandidate: CandidateItem | null
  formatPersistenceRate: (value: number | null) => string
  formatScoreDelta: (value: number | null) => string
  scoreDeltaClass: (value: number | null) => string
  candidatePersistenceFor: (item: CandidateItem | null) => CandidateSignalPersistence
  candidatePersistenceLabel: (item: CandidateItem | null) => string
  candidatePersistenceClass: (item: CandidateItem | null) => string
  formatFactorLabel: (value: string) => string
  formatDateTime: (value: string | null) => string
  formatSignalScore: (value: number | null) => string
}

const {
  selectedCandidate,
  formatPersistenceRate,
  formatScoreDelta,
  scoreDeltaClass,
  candidatePersistenceFor,
  candidatePersistenceLabel,
  candidatePersistenceClass,
  formatFactorLabel,
  formatDateTime,
  formatSignalScore,
} = defineProps<QuantSignalPersistenceSectionProps>()
</script>

<template>
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
</template>
