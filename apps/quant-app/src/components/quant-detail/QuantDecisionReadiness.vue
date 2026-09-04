<script setup lang="ts">
import type { QuantDecisionReadiness } from '../../lib/decision-readiness'

export interface QuantDecisionReadinessProps {
  decisionReadiness: QuantDecisionReadiness | null
}

const { decisionReadiness } = defineProps<QuantDecisionReadinessProps>()
</script>

<template>
  <section v-if="decisionReadiness" class="quant-decision-readiness" aria-label="判断就绪度">
    <div class="quant-decision-readiness-heading">
      <div>
        <span>判断就绪度</span>
        <strong :class="`quant-decision-readiness-${decisionReadiness.status}`">{{ decisionReadiness.label }}</strong>
      </div>
      <small>{{ decisionReadiness.detail }}</small>
    </div>
    <div class="quant-decision-readiness-checks" role="list" aria-label="判断就绪度检查项">
      <div v-for="check in decisionReadiness.checks" :key="check.key" role="listitem" :class="`quant-decision-readiness-check-${check.status}`">
        <span>{{ check.label }}</span>
        <strong>{{ check.status === 'pass' ? '通过' : check.status === 'review' ? '需核对' : '阻断' }}</strong>
        <small>{{ check.detail }}</small>
      </div>
    </div>
    <p v-if="decisionReadiness.unresolvedFactors.length" class="quant-decision-readiness-factors">
      待核对因子：{{ decisionReadiness.unresolvedFactors.join('、') }}
    </p>
  </section>
</template>

<style scoped>
.quant-decision-readiness {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-decision-readiness-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.quant-decision-readiness-heading > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-decision-readiness-heading span,
.quant-decision-readiness-heading small,
.quant-decision-readiness-checks span,
.quant-decision-readiness-checks small,
.quant-decision-readiness-factors {
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-readiness-heading strong {
  font-size: 0.8125rem;
}

.quant-decision-readiness-ready { color: hsl(var(--status-success)); }
.quant-decision-readiness-review { color: hsl(var(--status-warning)); }
.quant-decision-readiness-blocked { color: hsl(var(--status-danger)); }

.quant-decision-readiness-checks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.quant-decision-readiness-checks > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
  border-left: 2px solid hsl(var(--border));
  padding: 0.2rem 0.45rem;
}

.quant-decision-readiness-checks strong {
  font-size: 0.625rem;
}

.quant-decision-readiness-check-pass { border-left-color: hsl(var(--status-success) / 0.55) !important; }
.quant-decision-readiness-check-pass strong { color: hsl(var(--status-success)); }
.quant-decision-readiness-check-review { border-left-color: hsl(var(--status-warning) / 0.55) !important; }
.quant-decision-readiness-check-review strong { color: hsl(var(--status-warning)); }
.quant-decision-readiness-check-blocked { border-left-color: hsl(var(--status-danger) / 0.55) !important; }
.quant-decision-readiness-check-blocked strong { color: hsl(var(--status-danger)); }

.quant-decision-readiness-factors {
  margin: 0;
}

@media (max-width: 520px) {
  .quant-decision-readiness-heading {
    display: grid;
  }

  .quant-decision-readiness-checks {
    grid-template-columns: 1fr;
  }
}
</style>
