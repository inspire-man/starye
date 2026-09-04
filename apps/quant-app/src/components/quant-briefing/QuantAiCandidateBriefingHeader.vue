<script setup lang="ts">
import type { QuantAiCandidateBriefingHeaderProps } from './quant-briefing-contracts'
import { BrainCircuit, Copy, Download, RefreshCw } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<QuantAiCandidateBriefingHeaderProps>()

const emit = defineEmits<{
  generate: []
  export: []
  copy: []
}>()

const hasCandidates = computed(() => props.candidateCount > 0)
const hasFilteredCandidates = computed(() => props.filteredCandidateCount > 0)
const hasBriefingCandidates = computed(() => props.briefingAvailableCandidateCount > 0)
const canGenerate = computed(() => props.available && hasFilteredCandidates.value && hasBriefingCandidates.value)
const showBriefingActions = computed(() => Boolean(props.briefing && !props.loading && !props.errorMessage))

const generateButtonLabel = computed(() => {
  if (props.loading)
    return '生成中'
  if (!hasCandidates.value)
    return '暂无候选'
  if (!hasFilteredCandidates.value)
    return '暂无筛选候选'
  if (!hasBriefingCandidates.value)
    return '暂无快照候选'
  if (!canGenerate.value)
    return '快照未就绪'
  return props.briefing ? '重新生成简报' : '生成 AI 简报'
})

function formatDate(value: string): string {
  if (!value)
    return '时间未记录'
  const compact = value.replace(/-/gu, '').slice(0, 8)
  if (/^\d{8}$/u.test(compact))
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  return value.slice(0, 10)
}
</script>

<template>
  <div class="quant-ai-briefing-heading">
    <div class="quant-ai-briefing-heading-copy">
      <p class="section-kicker">
        CANDIDATE BRIEFING
      </p>
      <h3 id="quant-ai-briefing-title">
        AI 候选简报
      </h3>
      <small>只解释当前候选的确定性研究事实，不改变排序、评分或研究动作</small>
    </div>
    <div class="quant-ai-briefing-actions">
      <button
        class="secondary-button quant-ai-briefing-generate"
        type="button"
        :disabled="loading || !canGenerate"
        title="基于当前候选研究事实生成 AI 简报"
        @click="emit('generate')"
      >
        <RefreshCw v-if="loading" :size="14" class="animate-spin" aria-hidden="true" />
        <BrainCircuit v-else :size="14" aria-hidden="true" />
        {{ generateButtonLabel }}
      </button>
      <template v-if="showBriefingActions">
        <button
          class="secondary-button quant-ai-briefing-export"
          type="button"
          title="将当前候选简报下载为 Markdown 文件"
          aria-label="导出候选 AI 简报为 Markdown 文件"
          @click="emit('export')"
        >
          <Download :size="14" aria-hidden="true" />
          导出 Markdown
        </button>
        <button
          class="secondary-button quant-ai-briefing-copy"
          type="button"
          :disabled="copying"
          title="将当前候选简报复制到剪贴板"
          aria-label="复制候选 AI 简报 Markdown"
          @click="emit('copy')"
        >
          <Copy :size="14" aria-hidden="true" />
          {{ copying ? '复制中' : '复制 Markdown' }}
        </button>
      </template>
    </div>
  </div>

  <div class="quant-ai-briefing-scope quant-ai-briefing-wrap-anywhere" aria-label="候选简报范围">
    <span>当前筛选 <strong>{{ filteredCandidateCount }}</strong> 个</span>
    <span>观察池 <strong>{{ candidateCount }}</strong> 个</span>
    <span>可生成范围 <strong>{{ briefingAvailableCandidateCount }}</strong> 个</span>
    <span v-if="briefingCandidateCount !== null">本次简报 <strong>{{ briefingCandidateCount }}</strong> 个</span>
    <span v-if="briefing">版本 {{ briefing.briefingVersion }}</span>
    <span v-if="briefing">{{ briefing.provider }} · {{ briefing.model }} · {{ formatDate(briefing.generatedAt) }}</span>
  </div>
</template>
