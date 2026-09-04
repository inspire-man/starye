<script setup lang="ts">
defineProps<{
  total: number
}>()
</script>

<template>
  <div class="quant-ai-trust-overview-heading">
    <div>
      <p class="section-kicker">
        AI TRUST CHECK
      </p>
      <h3 id="quant-ai-trust-overview-title">
        AI 信任总览
      </h3>
      <p>先看最近决策是否已纳入 AI、有没有后续价格观察，再进入单只股票详情。</p>
    </div>
    <span class="quant-ai-trust-overview-meta">
      最近 {{ total }} 条决策
    </span>
  </div>
</template>
