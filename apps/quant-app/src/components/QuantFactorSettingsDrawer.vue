<script setup lang="ts">
import type { QuantFactorConfiguration, QuantFactorConfigurationKey, QuantFactorWeights } from '../lib/quant-types'
import { DetailDrawer } from '@starye/ui'
import { AlertCircle, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { quantApi, QuantApiError } from '../lib/api-client'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

const factorOptions: readonly { key: QuantFactorConfigurationKey, label: string, description: string }[] = [
  { key: 'trend', label: '趋势', description: '日线结构、均线和 20 日方向' },
  { key: 'valuation', label: '估值', description: 'TTM PE 与 PB 的当前有效值' },
  { key: 'quality', label: '盈利质量', description: '利润、ROE、现金流和财报连续性' },
  { key: 'shareholder-return', label: '股东回报', description: '近 12 个月实施分红与股息率' },
  { key: 'risk', label: '风险', description: '成交量异常与连续上涨过热' },
]

type FormWeights = Record<QuantFactorConfigurationKey, number>

const config = ref<QuantFactorConfiguration | null>(null)
const loading = ref(false)
const saving = ref(false)
const resetting = ref(false)
const errorMessage = ref('')
const savedMessage = ref('')
const form = reactive<FormWeights>({
  'trend': 25,
  'valuation': 20,
  'quality': 20,
  'shareholder-return': 15,
  'risk': 20,
})

const totalPercent = computed(() => factorOptions.reduce((total, option) => total + (Number.isFinite(form[option.key]) ? form[option.key] : 0), 0))
const valid = computed(() => factorOptions.every(option => Number.isFinite(form[option.key]) && form[option.key] >= 0 && form[option.key] <= 100) && Math.abs(totalPercent.value - 100) < 0.001)
const hasUnsavedChanges = computed(() => {
  if (!config.value)
    return true
  return factorOptions.some(option => Math.abs(form[option.key] / 100 - config.value!.weights[option.key]) > 0.0001)
})

function percentWeights(weights: QuantFactorWeights): FormWeights {
  return {
    'trend': weights.trend * 100,
    'valuation': weights.valuation * 100,
    'quality': weights.quality * 100,
    'shareholder-return': weights['shareholder-return'] * 100,
    'risk': weights.risk * 100,
  }
}

function resetForm(value: QuantFactorConfiguration): void {
  config.value = value
  Object.assign(form, percentWeights(value.weights))
}

function errorText(error: unknown): string {
  if (error instanceof QuantApiError)
    return error.message
  return error instanceof Error ? error.message : '因子配置加载失败'
}

async function loadConfiguration(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    resetForm(await quantApi.getFactorConfiguration())
  }
  catch (error) {
    errorMessage.value = errorText(error)
  }
  finally {
    loading.value = false
  }
}

async function saveConfiguration(): Promise<void> {
  if (!valid.value) {
    errorMessage.value = '五项权重总和必须为 100%，且每项在 0% 到 100% 之间'
    return
  }
  saving.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    const next = await quantApi.updateFactorConfiguration({
      'trend': form.trend / 100,
      'valuation': form.valuation / 100,
      'quality': form.quality / 100,
      'shareholder-return': form['shareholder-return'] / 100,
      'risk': form.risk / 100,
    })
    resetForm(next)
    savedMessage.value = '配置已保存；重新生成研究报告后生效'
  }
  catch (error) {
    errorMessage.value = errorText(error)
  }
  finally {
    saving.value = false
  }
}

async function resetConfiguration(): Promise<void> {
  if (resetting.value)
    return
  resetting.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    const next = await quantApi.resetFactorConfiguration()
    resetForm(next)
    savedMessage.value = '已恢复默认权重；重新生成研究报告后生效'
  }
  catch (error) {
    errorMessage.value = errorText(error)
  }
  finally {
    resetting.value = false
  }
}

watch(() => props.open, (open) => {
  if (open)
    void loadConfiguration()
})
</script>

<template>
  <DetailDrawer
    :open="open"
    title="因子权重配置"
    description="只影响之后生成的研究报告，历史快照保持原样"
    width="md"
    @update:open="emit('update:open', $event)"
  >
    <section class="quant-factor-settings" aria-labelledby="quant-factor-settings-title">
      <div class="quant-factor-settings-heading">
        <div>
          <p class="section-kicker">
            RESEARCH FACTOR MODEL
          </p>
          <h2 id="quant-factor-settings-title">
            调整研究重点
          </h2>
        </div>
        <SlidersHorizontal :size="19" aria-hidden="true" />
      </div>

      <div v-if="loading" class="quant-factor-settings-state" role="status">
        正在读取当前因子配置...
      </div>
      <form v-else class="quant-factor-settings-form" @submit.prevent="saveConfiguration">
        <div class="quant-factor-settings-summary" :class="valid ? 'quant-factor-settings-summary-valid' : 'quant-factor-settings-summary-invalid'" role="status" aria-live="polite">
          <div>
            <span>权重合计</span>
            <strong>{{ totalPercent.toFixed(0) }}%</strong>
          </div>
          <small>{{ config?.source === 'user' ? '当前用户配置' : '内置默认配置' }} · {{ config?.version || 'research-factor-config-v1' }}</small>
        </div>

        <div class="quant-factor-setting-list">
          <fieldset v-for="option in factorOptions" :key="option.key" class="quant-factor-setting">
            <legend>
              <span>{{ option.label }}</span>
              <small>{{ option.description }}</small>
            </legend>
            <div class="quant-factor-setting-controls">
              <input
                :id="`quant-factor-${option.key}`"
                v-model.number="form[option.key]"
                type="range"
                min="0"
                max="100"
                step="1"
                :aria-label="`${option.label}权重`"
              >
              <label class="sr-only" :for="`quant-factor-${option.key}-number`">
                {{ option.label }}权重百分比
              </label>
              <input
                :id="`quant-factor-${option.key}-number`"
                v-model.number="form[option.key]"
                class="field-control quant-factor-setting-number"
                type="number"
                min="0"
                max="100"
                step="1"
                inputmode="numeric"
                :aria-label="`${option.label}权重百分比`"
              >
              <span aria-hidden="true">%</span>
            </div>
          </fieldset>
        </div>

        <p v-if="!valid" class="quant-factor-settings-hint" role="note">
          调整任意一项后，请让五项权重合计为 100%。
        </p>
        <p v-else class="quant-factor-settings-hint" role="note">
          权重为 0% 的因子仍保留来源和状态，但不参与本次分数和数据完整度判断。
        </p>

        <div v-if="errorMessage" class="quant-factor-settings-alert quant-factor-settings-alert-error" role="alert">
          <AlertCircle :size="16" aria-hidden="true" />
          <span>{{ errorMessage }}</span>
        </div>
        <div v-if="savedMessage" class="quant-factor-settings-alert quant-factor-settings-alert-success" role="status">
          <ShieldCheck :size="16" aria-hidden="true" />
          <span>{{ savedMessage }}</span>
        </div>

        <div class="quant-factor-settings-actions">
          <button class="secondary-button" type="button" :disabled="resetting || saving" title="删除当前用户配置并恢复内置默认权重" @click="resetConfiguration">
            <RotateCcw :size="15" :class="resetting ? 'animate-spin' : ''" aria-hidden="true" />
            {{ resetting ? '恢复中' : '恢复默认' }}
          </button>
          <button class="secondary-button" type="button" @click="emit('update:open', false)">
            关闭
          </button>
          <button class="primary-button" type="submit" :disabled="!valid || !hasUnsavedChanges || saving || resetting">
            <Save :size="15" aria-hidden="true" />
            {{ saving ? '保存中' : '保存权重' }}
          </button>
        </div>
      </form>
    </section>
  </DetailDrawer>
</template>

<style scoped>
.quant-factor-settings {
  display: grid;
  gap: 1rem;
}

.quant-factor-settings-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.85rem;
  color: hsl(var(--primary));
}

.quant-factor-settings-heading h2 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 1rem;
}

.quant-factor-settings-form,
.quant-factor-setting-list {
  display: grid;
  gap: 0.75rem;
}

.quant-factor-settings-summary,
.quant-factor-setting {
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md, 0.375rem);
  background: hsl(var(--background) / 0.6);
}

.quant-factor-settings-summary {
  display: grid;
  gap: 0.25rem;
  padding: 0.7rem 0.8rem;
}

.quant-factor-settings-summary > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.quant-factor-settings-summary span,
.quant-factor-settings-summary small,
.quant-factor-setting legend small,
.quant-factor-settings-hint {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.45;
}

.quant-factor-settings-summary strong {
  font-size: 1.05rem;
  font-weight: 780;
}

.quant-factor-settings-summary-valid {
  border-color: hsl(var(--status-success) / 0.3);
  background: hsl(var(--status-success-soft));
}

.quant-factor-settings-summary-valid strong {
  color: hsl(var(--status-success));
}

.quant-factor-settings-summary-invalid {
  border-color: hsl(var(--status-warning) / 0.35);
  background: hsl(var(--status-warning-soft));
}

.quant-factor-settings-summary-invalid strong {
  color: hsl(var(--status-warning));
}

.quant-factor-setting {
  min-width: 0;
  padding: 0.7rem 0.8rem 0.75rem;
}

.quant-factor-setting legend {
  display: grid;
  max-width: 100%;
  gap: 0.15rem;
  padding: 0;
}

.quant-factor-setting legend span {
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 700;
}

.quant-factor-setting-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.25rem auto;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.65rem;
}

.quant-factor-setting-controls input[type='range'] {
  width: 100%;
  accent-color: hsl(var(--primary));
}

.quant-factor-setting-number {
  min-width: 0;
  width: 100%;
  text-align: right;
}

.quant-factor-setting-controls > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.quant-factor-settings-hint {
  margin: 0;
}

.quant-factor-settings-alert {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md, 0.375rem);
  padding: 0.65rem 0.75rem;
  font-size: 0.75rem;
  line-height: 1.4;
}

.quant-factor-settings-alert-error {
  border-color: hsl(var(--status-danger) / 0.28);
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.quant-factor-settings-alert-success {
  border-color: hsl(var(--status-success) / 0.28);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-factor-settings-state {
  min-height: 8rem;
  display: grid;
  place-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.quant-factor-settings-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.85rem;
}

@media (max-width: 420px) {
  .quant-factor-setting-controls {
    grid-template-columns: minmax(0, 1fr) 3.75rem auto;
    gap: 0.4rem;
  }

  .quant-factor-settings-actions {
    justify-content: stretch;
  }

  .quant-factor-settings-actions > button {
    flex: 1 1 auto;
  }
}
</style>
