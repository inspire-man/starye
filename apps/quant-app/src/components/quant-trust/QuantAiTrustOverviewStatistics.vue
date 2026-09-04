<script setup lang="ts">
import type { QuantAiTrustOverviewSummary } from '../../lib/ai-trust-overview'
import { BrainCircuit, CheckCircle2, Clock3, Minus, XCircle } from 'lucide-vue-next'

defineProps<{
  summary: QuantAiTrustOverviewSummary
}>()
</script>

<template>
  <div class="quant-ai-trust-overview-summary" role="list" aria-label="AI 信任总览统计">
    <div role="listitem">
      <BrainCircuit :size="14" aria-hidden="true" />
      <span>已纳入</span>
      <strong>{{ summary.accepted }}</strong>
    </div>
    <div role="listitem">
      <Clock3 :size="14" aria-hidden="true" />
      <span>待观察</span>
      <strong>{{ summary.pending }}</strong>
    </div>
    <div role="listitem">
      <CheckCircle2 :size="14" aria-hidden="true" />
      <span>方向一致</span>
      <strong>{{ summary.aligned }}</strong>
    </div>
    <div role="listitem">
      <XCircle :size="14" aria-hidden="true" />
      <span>方向相反</span>
      <strong>{{ summary.opposed }}</strong>
    </div>
    <div role="listitem">
      <Minus :size="14" aria-hidden="true" />
      <span>价格未变化</span>
      <strong>{{ summary.flat }}</strong>
    </div>
  </div>
</template>
