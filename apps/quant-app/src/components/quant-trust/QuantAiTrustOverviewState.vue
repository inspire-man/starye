<script setup lang="ts">
import { AlertTriangle, CircleHelp, RefreshCw } from 'lucide-vue-next'

defineProps<{
  loading: boolean
  errorMessage: string | null
  hasRecords: boolean
}>()
</script>

<template>
  <div v-if="loading" class="quant-ai-trust-overview-state" role="status">
    <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
    <span>正在读取 AI 决策状态</span>
  </div>
  <div v-else-if="errorMessage" class="quant-ai-trust-overview-state quant-ai-trust-overview-state-error" role="alert">
    <AlertTriangle :size="15" aria-hidden="true" />
    <span>{{ errorMessage }}</span>
  </div>
  <div v-else-if="!hasRecords" class="quant-ai-trust-overview-state" role="status">
    <CircleHelp :size="15" aria-hidden="true" />
    <span>还没有保存的决策，先在研究详情中完成一次 AI 复核并记录判断。</span>
  </div>
</template>
