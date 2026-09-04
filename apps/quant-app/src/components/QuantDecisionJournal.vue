<script setup lang="ts">
import type { QuantDecisionRecord, QuantDecisionRecordAction, QuantResearchRun } from '../lib/quant-view-models'
import { AlertCircle, CalendarClock, CheckCircle2, History } from 'lucide-vue-next'
import QuantDecisionJournalCurrent from './quant-journal/QuantDecisionJournalCurrent.vue'
import QuantDecisionJournalForm from './quant-journal/QuantDecisionJournalForm.vue'
import QuantDecisionJournalHistory from './quant-journal/QuantDecisionJournalHistory.vue'
import QuantAiOutcomeCalibration from './QuantAiOutcomeCalibration.vue'
import QuantDecisionOutcome from './QuantDecisionOutcome.vue'

defineProps<{
  run: QuantResearchRun | null
  record: QuantDecisionRecord | null
  history: QuantDecisionRecord[]
  loading: boolean
  historyLoading: boolean
  saving: boolean
  latestPrice: number | null
  latestPriceObservedAt: string | null
  loadErrorMessage: string | null
  historyErrorMessage: string | null
  saveErrorMessage: string | null
  saveMessage: string | null
}>()

const emit = defineEmits<{
  save: [action: QuantDecisionRecordAction, note: string | null]
}>()
</script>

<template>
  <section class="quant-decision-journal" aria-labelledby="quant-decision-journal-title">
    <div class="quant-decision-journal-heading">
      <div>
        <p class="section-kicker">
          DECISION JOURNAL
        </p>
        <h3 id="quant-decision-journal-title">
          记录这次判断
        </h3>
        <small>把系统结论和你的实际行动分开保存，之后按快照复盘。</small>
      </div>
      <History :size="19" aria-hidden="true" />
    </div>

    <div v-if="loading" class="quant-decision-journal-state" role="status">
      <CalendarClock :size="15" aria-hidden="true" />
      <span>正在读取本次决策记录</span>
    </div>
    <div v-if="loadErrorMessage" class="quant-decision-journal-alert quant-decision-journal-alert-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ loadErrorMessage }}</span>
    </div>

    <QuantDecisionJournalCurrent
      :record="record"
      :loading="loading"
      :load-error-message="loadErrorMessage"
    />

    <QuantDecisionJournalForm
      :run="run"
      :record="record"
      :saving="saving"
      @save="emit('save', $event.action, $event.note)"
    />

    <div v-if="saveErrorMessage" class="quant-decision-journal-alert quant-decision-journal-alert-error" role="alert">
      <AlertCircle :size="15" aria-hidden="true" />
      <span>{{ saveErrorMessage }}</span>
    </div>
    <div v-if="saveMessage" class="quant-decision-journal-alert quant-decision-journal-alert-success" role="status">
      <CheckCircle2 :size="15" aria-hidden="true" />
      <span>{{ saveMessage }}</span>
    </div>

    <QuantDecisionJournalHistory
      :history="history"
      :history-loading="historyLoading"
      :history-error-message="historyErrorMessage"
    />

    <QuantDecisionOutcome
      :history="history"
      :latest-price="latestPrice"
      :latest-price-observed-at="latestPriceObservedAt"
    />

    <QuantAiOutcomeCalibration
      :history="history"
      :latest-price="latestPrice"
      :latest-price-observed-at="latestPriceObservedAt"
    />
  </section>
</template>

<style scoped>
.quant-decision-journal {
  display: grid;
  min-width: 0;
  gap: 0.75rem;
  margin-top: 0.85rem;
  border-top: 1px solid hsl(var(--status-info) / 0.35);
  padding-top: 0.85rem;
}

.quant-decision-journal-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-decision-journal-heading > svg {
  flex: 0 0 auto;
  color: hsl(var(--status-info));
}

.quant-decision-journal-heading h3 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 720;
}

.quant-decision-journal-heading small {
  display: block;
  margin-top: 0.3rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.4;
}

.quant-decision-journal-state,
.quant-decision-journal-alert {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-decision-journal-state {
  min-height: 2.25rem;
  justify-content: center;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.55rem 0;
}

.quant-decision-journal-alert {
  border: 1px solid hsl(var(--status-danger) / 0.25);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-danger-soft));
  padding: 0.55rem 0.65rem;
  color: hsl(var(--status-danger));
}

.quant-decision-journal-alert span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quant-decision-journal-alert-success {
  border-color: hsl(var(--status-success) / 0.25);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}
</style>
