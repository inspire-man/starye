<script setup lang="ts">
import type { QuantDecisionGuide } from '../../lib/decision-trust-guide'

export interface QuantDecisionGuideProps {
  decisionGuide: QuantDecisionGuide | null
}

const { decisionGuide } = defineProps<QuantDecisionGuideProps>()
</script>

<template>
  <section class="quant-decision-guide" aria-label="今日参考与信任检查">
    <div class="quant-decision-guide-heading">
      <div>
        <span>今天怎么参考</span>
        <strong>{{ decisionGuide?.priceLabel }}</strong>
      </div>
      <span class="quant-decision-trust-status" :class="`quant-decision-trust-${decisionGuide?.trustStatus || 'insufficient'}`">
        {{ decisionGuide?.trustLabel }}
      </span>
    </div>
    <p class="quant-decision-guide-price-detail">
      {{ decisionGuide?.priceDetail }}
    </p>
    <div class="quant-decision-guide-checks">
      <span v-for="check in decisionGuide?.checks || []" :key="check">{{ check }}</span>
    </div>
    <ol class="quant-decision-guide-steps">
      <li v-for="step in decisionGuide?.steps || []" :key="step">
        {{ step }}
      </li>
    </ol>
  </section>
</template>

<style scoped>
.quant-decision-guide {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.6rem;
}

.quant-decision-guide-heading,
.quant-decision-guide-heading > div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.45rem;
}

.quant-decision-guide-heading {
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.65rem;
}

.quant-decision-guide-heading > div {
  display: grid;
  align-items: start;
  gap: 0.15rem;
}

.quant-decision-guide-heading span,
.quant-decision-guide-price-detail,
.quant-decision-guide-checks span,
.quant-decision-guide-steps {
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-guide-heading strong {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
}

.quant-decision-trust-status {
  flex: 0 0 auto;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.2rem 0.35rem;
  font-weight: 700;
}

.quant-decision-trust-complete {
  border-color: hsl(var(--status-success) / 0.3);
  color: hsl(var(--status-success)) !important;
}

.quant-decision-trust-review {
  border-color: hsl(var(--status-warning) / 0.35);
  color: hsl(var(--status-warning)) !important;
}

.quant-decision-trust-insufficient {
  border-color: hsl(var(--status-danger) / 0.3);
  color: hsl(var(--status-danger)) !important;
}

.quant-decision-guide-price-detail {
  margin: 0;
  overflow-wrap: anywhere;
}

.quant-decision-guide-checks {
  display: grid;
  gap: 0.2rem;
  border-left: 2px solid hsl(var(--primary) / 0.32);
  padding-left: 0.5rem;
}

.quant-decision-guide-checks span {
  overflow-wrap: anywhere;
}

.quant-decision-guide-steps {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding-left: 1rem;
}

.quant-decision-guide-steps li {
  padding-left: 0.1rem;
}

@media (max-width: 520px) {
  .quant-decision-guide-heading {
    display: grid;
  }
}
</style>
