<script setup lang="ts">
import type { QuantDecisionAssistant, QuantDecisionAssistantMode, QuantResearchRun } from '../../lib/quant-view-models'
import { CircleHelp, RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  run: QuantResearchRun
  latestClose: number | null
  latestTradeDate: string | null
  assessment: QuantDecisionAssistant | null
  loading: boolean
  generating: boolean
}>()

const emit = defineEmits<{
  assess: [input: { mode: QuantDecisionAssistantMode, costBasis: number | null, quantity: number | null, includeAi: boolean }]
}>()

const mode = ref<QuantDecisionAssistantMode>('buy')
const costBasisInput = ref('')
const quantityInput = ref('')
const includeAi = ref(true)

watch(() => props.run.id, () => {
  mode.value = 'buy'
  costBasisInput.value = ''
  quantityInput.value = ''
  includeAi.value = true
})

watch(() => props.assessment, (value) => {
  if (!value)
    return
  mode.value = value.scenario.mode
  costBasisInput.value = value.scenario.costBasis === null ? '' : String(value.scenario.costBasis)
  quantityInput.value = value.scenario.quantity === null ? '' : String(value.scenario.quantity)
}, { immediate: true })

const costBasis = computed(() => parsePositive(costBasisInput.value))
const quantity = computed(() => parsePositive(quantityInput.value))
const validationMessage = computed(() => {
  if (mode.value === 'holding' && costBasis.value === null)
    return '持有场景需要成本价'
  return null
})
const canSubmit = computed(() => Boolean(props.run && !props.generating && !props.loading && !validationMessage.value))

function parsePositive(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function submit(): void {
  if (!canSubmit.value)
    return
  emit('assess', {
    mode: mode.value,
    costBasis: mode.value === 'holding' ? costBasis.value : null,
    quantity: quantity.value,
    includeAi: includeAi.value,
  })
}

function formatPrice(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '--' : `${value.toFixed(2)} 元`
}

function formatDate(value: string | null): string {
  if (!value)
    return '日期未记录'
  const digits = value.replace(/\D/gu, '').slice(0, 8)
  return /^\d{8}$/u.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : value.slice(0, 10)
}
</script>

<template>
  <div class="quant-decision-assistant-form-content">
    <div class="quant-decision-assistant-mode" role="group" aria-label="决策场景">
      <button type="button" :class="{ 'is-active': mode === 'buy' }" :aria-pressed="mode === 'buy'" @click="mode = 'buy'">
        准备买入
      </button>
      <button type="button" :class="{ 'is-active': mode === 'holding' }" :aria-pressed="mode === 'holding'" @click="mode = 'holding'">
        已持有
      </button>
    </div>

    <div class="quant-decision-assistant-market-note" role="status">
      <div>
        <span>当前价格</span>
        <strong>服务端自动获取</strong>
      </div>
      <small v-if="latestClose !== null">最近收盘参考 {{ formatPrice(latestClose) }} · {{ formatDate(latestTradeDate) }}</small>
      <small v-else>生成判断时读取最新行情快照</small>
    </div>

    <div class="quant-decision-assistant-form">
      <label v-if="mode === 'holding'" class="quant-decision-assistant-field">
        <span>持仓成本</span>
        <input v-model="costBasisInput" type="number" min="0.0001" step="0.01" inputmode="decimal" placeholder="例如 33.40" aria-label="持仓成本" @keydown.enter="submit">
        <small>用于计算浮亏和回本所需涨幅</small>
      </label>
      <label class="quant-decision-assistant-field">
        <span>持仓数量 <em>可选</em></span>
        <input v-model="quantityInput" type="number" min="0.0001" step="1" inputmode="decimal" placeholder="可不填" aria-label="持仓数量" @keydown.enter="submit">
        <small>只保存到本次场景快照</small>
      </label>
      <label class="quant-decision-assistant-ai-toggle">
        <span>AI 交叉核对</span>
        <span class="quant-decision-assistant-checkbox-row">
          <input v-model="includeAi" class="quant-decision-assistant-checkbox" type="checkbox" aria-label="使用 AI 交叉核对">
          <strong>{{ includeAi ? '开启' : '关闭' }}</strong>
        </span>
        <small>{{ includeAi ? '合格时才影响最终动作' : '仅使用确定性数据' }}</small>
      </label>
      <button class="primary-button quant-decision-assistant-submit" type="button" :disabled="!canSubmit" :aria-label="generating ? '正在生成今日决策' : '生成今日决策'" @click="submit">
        <RefreshCw :size="15" :class="generating ? 'animate-spin' : ''" aria-hidden="true" />
        {{ generating ? 'AI 复核中' : assessment ? '重新评估' : '生成今日判断' }}
      </button>
    </div>

    <p v-if="validationMessage" class="quant-decision-assistant-form-error" role="status">
      <CircleHelp :size="14" aria-hidden="true" />
      {{ validationMessage }}
    </p>
  </div>
</template>

<style scoped>
.quant-decision-assistant-form-content {
  display: grid;
  min-width: 0;
  gap: 0.7rem;
}

.quant-decision-assistant-mode {
  display: inline-grid;
  width: fit-content;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  padding: 0.15rem;
}

.quant-decision-assistant-mode button {
  min-height: 1.85rem;
  border: 0;
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: transparent;
  padding: 0.3rem 0.7rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 0.6875rem;
  font-weight: 700;
}

.quant-decision-assistant-mode button.is-active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.quant-decision-assistant-mode button:focus-visible,
.quant-decision-assistant-form .quant-decision-assistant-field input:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.quant-decision-assistant-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 0.5rem;
}

.quant-decision-assistant-form label {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.quant-decision-assistant-market-note {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.5rem;
  border-left: 2px solid hsl(var(--status-info) / 0.55);
  padding: 0.25rem 0.45rem;
}

.quant-decision-assistant-market-note > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quant-decision-assistant-market-note span,
.quant-decision-assistant-field > span:first-child,
.quant-decision-assistant-ai-toggle > span:first-child {
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  font-weight: 700;
}

.quant-decision-assistant-market-note strong {
  color: hsl(var(--status-info));
  font-size: 0.75rem;
  white-space: nowrap;
}

.quant-decision-assistant-market-note small,
.quant-decision-assistant-form small {
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  line-height: 1.45;
}

.quant-decision-assistant-ai-toggle {
  align-self: stretch;
  align-content: end;
}

.quant-decision-assistant-checkbox-row {
  display: flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.35rem;
  color: hsl(var(--foreground));
}

.quant-decision-assistant-checkbox-row input {
  flex: 0 0 auto;
  width: 0.95rem;
  min-width: 0.95rem;
  height: 0.95rem;
  min-height: 0.95rem;
  margin: 0;
  padding: 0;
  border: 0;
  accent-color: hsl(var(--primary));
}

.quant-decision-assistant-checkbox-row strong {
  font-size: 0.6875rem;
}

.quant-decision-assistant-form em {
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  font-style: normal;
  font-weight: 500;
}

.quant-decision-assistant-form .quant-decision-assistant-field input {
  width: 100%;
  min-width: 0;
  min-height: 2rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--background));
  padding: 0.35rem 0.5rem;
  color: hsl(var(--foreground));
  font: inherit;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.quant-decision-assistant-submit {
  min-height: 2rem;
  white-space: nowrap;
}

.quant-decision-assistant-form-error {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--status-warning));
  font-size: 0.625rem;
}

@media (max-width: 720px) {
  .quant-decision-assistant-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quant-decision-assistant-submit {
    grid-column: 1 / -1;
    justify-self: start;
  }
}

@media (max-width: 480px) {
  .quant-decision-assistant-form {
    grid-template-columns: 1fr;
  }

  .quant-decision-assistant-market-note {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2rem;
  }
}
</style>
