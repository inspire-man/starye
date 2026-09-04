<script setup lang="ts">
import type { QuantAiCandidateBriefingContentProps } from './quant-briefing-contracts'
import { BrainCircuit, CircleHelp } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<QuantAiCandidateBriefingContentProps>()

const emit = defineEmits<{
  focusCandidate: [tsCode: string]
  useQuestionPrompt: [prompt: string]
}>()

const visibleFocusItems = computed(() => props.briefing.focusItems.slice(0, 5))
const visibleNextChecks = computed(() => props.briefing.nextChecks.slice(0, 6))

function priorityLabel(level: string): string {
  return {
    urgent: '紧急',
    high: '高优先',
    normal: '常规',
    low: '低优先',
  }[level] || level || '未标记'
}

function priorityClass(level: string): string {
  const normalized = ['urgent', 'high', 'normal', 'low'].includes(level) ? level : 'normal'
  return `quant-ai-briefing-priority-${normalized}`
}

function formatScore(score: number): string {
  return Number.isFinite(score) ? `${score.toFixed(1)} 分` : '--'
}

function questionPromptForNextCheck(check: string): string {
  return `围绕“${check.trim()}”，当前候选范围内有哪些确定性事实需要优先核对？`.slice(0, 500)
}

function questionPromptForFocusItem(item: typeof props.briefing.focusItems[number]): string {
  const candidateCode = item.tsCode.trim()
  const candidateName = item.name?.trim()
  const prefix = '请基于“'
  const suffix = '”的当前候选事实，说明其研究优先级依据和下一项核对内容。'
  const codeSuffix = candidateName ? `（${candidateCode}）` : ''
  const maxNameLength = Math.max(0, 500 - prefix.length - suffix.length - candidateCode.length - codeSuffix.length)
  const boundedName = candidateName?.slice(0, maxNameLength)
  const candidateLabel = boundedName ? `${boundedName}${codeSuffix}` : candidateCode
  return `${prefix}${candidateLabel}${suffix}`
}
</script>

<template>
  <div class="quant-ai-briefing-overview-block">
    <span class="quant-ai-briefing-label">整体概览</span>
    <p class="quant-ai-briefing-overview quant-ai-briefing-wrap-anywhere">
      {{ briefing.overview }}
    </p>
  </div>

  <div class="quant-ai-briefing-section">
    <div class="quant-ai-briefing-section-heading">
      <span class="quant-ai-briefing-label">重点候选</span>
      <small>{{ visibleFocusItems.length }} 个 · 点击候选回看详情</small>
    </div>
    <div v-if="visibleFocusItems.length" class="quant-ai-briefing-focus-list">
      <div
        v-for="item in visibleFocusItems"
        :key="item.tsCode"
        class="quant-ai-briefing-focus-row"
      >
        <button
          class="quant-ai-briefing-focus-item quant-ai-briefing-wrap-anywhere"
          type="button"
          :aria-label="`打开候选 ${item.name || item.tsCode}（${item.tsCode}）详情`"
          @click="emit('focusCandidate', item.tsCode)"
        >
          <span class="quant-ai-briefing-focus-heading">
            <span class="quant-ai-briefing-focus-name">
              <strong>{{ item.name || item.tsCode }}</strong>
              <code>{{ item.tsCode }}</code>
            </span>
            <span class="quant-ai-briefing-focus-arrow" aria-hidden="true">↗</span>
          </span>
          <span class="quant-ai-briefing-focus-meta">
            <span class="quant-ai-briefing-priority" :class="priorityClass(item.priorityLevel)">
              {{ priorityLabel(item.priorityLevel) }}
            </span>
            <span>{{ formatScore(item.priorityScore) }}</span>
            <span>{{ item.actionLabel }}</span>
          </span>
          <span v-if="item.reasons.length" class="quant-ai-briefing-reasons">
            <span v-for="reason in item.reasons" :key="reason" class="quant-ai-briefing-reason quant-ai-briefing-wrap-anywhere">
              {{ reason }}
            </span>
          </span>
          <span class="quant-ai-briefing-explanation quant-ai-briefing-wrap-anywhere">
            {{ item.explanation }}
          </span>
        </button>
        <button
          class="text-button quant-ai-briefing-focus-prompt"
          type="button"
          :disabled="!questionPromptReady"
          :aria-label="`针对候选 ${item.name || item.tsCode}（${item.tsCode}）提问`"
          title="将该重点候选带入当前追问"
          @click="emit('useQuestionPrompt', questionPromptForFocusItem(item))"
        >
          <BrainCircuit :size="13" aria-hidden="true" />
          针对提问
        </button>
      </div>
    </div>
    <span v-else class="quant-ai-briefing-empty">
      <CircleHelp :size="13" aria-hidden="true" />
      未返回重点候选
    </span>
  </div>

  <div class="quant-ai-briefing-section quant-ai-briefing-next">
    <span class="quant-ai-briefing-label">下一步核对</span>
    <ul v-if="visibleNextChecks.length">
      <li v-for="check in visibleNextChecks" :key="check" class="quant-ai-briefing-next-item">
        <span class="quant-ai-briefing-wrap-anywhere">{{ check }}</span>
        <button
          class="text-button quant-ai-briefing-next-prompt"
          type="button"
          :disabled="!questionPromptReady"
          :aria-label="`将核对项带入当前追问：${check}`"
          title="将核对项转换为当前追问"
          @click="emit('useQuestionPrompt', questionPromptForNextCheck(check))"
        >
          <BrainCircuit :size="13" aria-hidden="true" />
          带入追问
        </button>
      </li>
    </ul>
    <span v-else class="quant-ai-briefing-empty">未返回下一步核对项</span>
  </div>

  <div class="quant-ai-briefing-section quant-ai-briefing-citations">
    <div class="quant-ai-briefing-section-heading">
      <span class="quant-ai-briefing-label">引用候选代码</span>
      <small>点击代码回看候选详情</small>
    </div>
    <div v-if="briefing.citedCandidateCodes.length" class="quant-ai-briefing-citation-list">
      <button
        v-for="tsCode in briefing.citedCandidateCodes"
        :key="tsCode"
        class="quant-ai-briefing-citation quant-ai-briefing-wrap-anywhere"
        type="button"
        :aria-label="`打开引用候选 ${tsCode} 详情`"
        @click="emit('focusCandidate', tsCode)"
      >
        <code>{{ tsCode }}</code>
        <span>回看候选</span>
      </button>
    </div>
    <span v-else class="quant-ai-briefing-empty">
      <CircleHelp :size="13" aria-hidden="true" />
      未返回引用代码
    </span>
  </div>
</template>
