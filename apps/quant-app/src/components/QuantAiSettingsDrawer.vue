<script setup lang="ts">
import type { QuantAiConfig, QuantAiConnectionTest, QuantAiProvider, QuantAiResponseMode } from '../lib/quant-types'
import { DetailDrawer } from '@starye/ui'
import { AlertCircle, Braces, KeyRound, Radio, RefreshCw, Save, ShieldCheck } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { quantApi, QuantApiError } from '../lib/api-client'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

const providerOptions: { value: QuantAiProvider, label: string }[] = [
  { value: 'openai_compatible', label: 'OpenAI 兼容接口' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'qwen', label: '通义千问' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'ollama', label: 'Ollama 本地模型' },
]

const config = ref<QuantAiConfig | null>(null)
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const errorMessage = ref('')
const savedMessage = ref('')
const connectionResult = ref<QuantAiConnectionTest | null>(null)
const connectionErrorMessage = ref('')
const form = reactive<{
  provider: QuantAiProvider
  model: string
  baseUrl: string
  responseMode: QuantAiResponseMode
  generationTimeoutMs: number
  apiKey: string
  clearApiKey: boolean
}>({
  provider: 'openai_compatible',
  model: '',
  baseUrl: '',
  responseMode: 'stream',
  generationTimeoutMs: 300000,
  apiKey: '',
  clearApiKey: false,
})

const hasApiKey = computed(() => Boolean(config.value?.hasApiKey))
const hasUnsavedConfig = computed(() => {
  const saved = config.value
  return !saved
    || saved.provider !== form.provider
    || saved.model !== form.model.trim()
    || (saved.baseUrl || '') !== form.baseUrl.trim()
    || saved.responseMode !== form.responseMode
    || saved.generationTimeoutMs !== form.generationTimeoutMs
    || Boolean(form.apiKey.trim())
    || form.clearApiKey
})
const canTest = computed(() => {
  const saved = config.value
  return Boolean(saved && !hasUnsavedConfig.value && saved.model && (saved.hasApiKey || saved.provider === 'ollama'))
})

function resetForm(value: QuantAiConfig | null): void {
  config.value = value
  form.provider = value?.provider || 'openai_compatible'
  form.model = value?.model || ''
  form.baseUrl = value?.baseUrl || ''
  form.responseMode = value?.responseMode || 'stream'
  form.generationTimeoutMs = value?.generationTimeoutMs || 300000
  form.apiKey = ''
  form.clearApiKey = false
  connectionResult.value = null
  connectionErrorMessage.value = ''
}

function errorText(error: unknown): string {
  if (error instanceof QuantApiError)
    return error.message
  return error instanceof Error ? error.message : 'AI 配置加载失败'
}

function responseModeLabel(value: QuantAiResponseMode): string {
  return value === 'stream' ? '流式响应' : '完整 JSON'
}

function timeoutLabel(value: number): string {
  return `${Math.round(value / 60000)} 分钟`
}

async function loadConfig(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    resetForm(await quantApi.getAiConfig())
  }
  catch (error) {
    errorMessage.value = errorText(error)
  }
  finally {
    loading.value = false
  }
}

async function saveConfig(): Promise<void> {
  if (!form.model.trim()) {
    errorMessage.value = '请填写模型名称'
    return
  }
  saving.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    const next = await quantApi.updateAiConfig({
      provider: form.provider,
      model: form.model.trim(),
      baseUrl: form.baseUrl.trim() || null,
      responseMode: form.responseMode,
      generationTimeoutMs: form.generationTimeoutMs,
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      clearApiKey: form.clearApiKey,
    })
    resetForm(next)
    savedMessage.value = '配置已保存'
  }
  catch (error) {
    errorMessage.value = errorText(error)
  }
  finally {
    saving.value = false
  }
}

async function testConnection(): Promise<void> {
  if (!canTest.value || testing.value)
    return
  testing.value = true
  connectionResult.value = null
  connectionErrorMessage.value = ''
  try {
    connectionResult.value = await quantApi.testAiConfig()
  }
  catch (error) {
    connectionErrorMessage.value = errorText(error)
  }
  finally {
    testing.value = false
  }
}

watch(() => props.open, (open) => {
  if (open)
    void loadConfig()
})

watch(() => [form.provider, form.model, form.baseUrl, form.responseMode, form.generationTimeoutMs, form.apiKey, form.clearApiKey], () => {
  connectionResult.value = null
  connectionErrorMessage.value = ''
})
</script>

<template>
  <DetailDrawer
    :open="open"
    title="AI 研究配置"
    description="配置只属于当前登录用户，密钥不会回填或出现在响应中"
    width="md"
    @update:open="emit('update:open', $event)"
  >
    <section class="quant-ai-settings" aria-labelledby="quant-ai-settings-title">
      <div class="quant-ai-settings-heading">
        <div>
          <p class="section-kicker">
            PERSONAL RESEARCH RUNTIME
          </p>
          <h2 id="quant-ai-settings-title">
            连接你的研究模型
          </h2>
        </div>
        <ShieldCheck :size="19" aria-hidden="true" />
      </div>

      <div v-if="loading" class="quant-ai-settings-state" role="status">
        正在读取用户配置...
      </div>
      <form v-else class="quant-ai-settings-form" @submit.prevent="saveConfig">
        <label class="quant-ai-field">
          <span>模型服务</span>
          <select v-model="form.provider" class="field-control">
            <option v-for="option in providerOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="quant-ai-field">
          <span>模型名称</span>
          <input v-model="form.model" class="field-control" type="text" maxlength="128" autocomplete="off" placeholder="例如 deepseek-chat">
        </label>

        <label class="quant-ai-field">
          <span>Base URL <small>可选</small></span>
          <input v-model="form.baseUrl" class="field-control" type="url" maxlength="2048" autocomplete="url" placeholder="https://api.example.com/v1">
        </label>

        <fieldset class="quant-ai-runtime-field">
          <legend>响应方式</legend>
          <div class="quant-ai-segmented" role="group" aria-label="AI 响应方式">
            <button
              class="quant-ai-segment"
              :class="{ 'quant-ai-segment-active': form.responseMode === 'stream' }"
              type="button"
              :aria-pressed="form.responseMode === 'stream'"
              title="让 AI 逐步返回内容，适合较长研究响应"
              @click="form.responseMode = 'stream'"
            >
              <Radio :size="14" aria-hidden="true" />
              流式响应
            </button>
            <button
              class="quant-ai-segment"
              :class="{ 'quant-ai-segment-active': form.responseMode === 'json' }"
              type="button"
              :aria-pressed="form.responseMode === 'json'"
              title="等待服务端一次返回完整 JSON"
              @click="form.responseMode = 'json'"
            >
              <Braces :size="14" aria-hidden="true" />
              完整 JSON
            </button>
          </div>
          <small class="quant-ai-runtime-help">当前选择：{{ responseModeLabel(form.responseMode) }}；流式模式会在完成后再进入结构化校验。</small>
        </fieldset>

        <label class="quant-ai-field">
          <span>生成预算</span>
          <select v-model.number="form.generationTimeoutMs" class="field-control">
            <option :value="300000">5 分钟</option>
            <option :value="600000">10 分钟</option>
          </select>
          <small>{{ hasUnsavedConfig ? '待保存' : '已保存' }} {{ timeoutLabel(form.generationTimeoutMs) }}；部署环境仍可设置更低的上限。</small>
        </label>

        <div class="quant-ai-key-state" :class="hasApiKey ? 'quant-ai-key-ready' : 'quant-ai-key-empty'">
          <KeyRound :size="16" aria-hidden="true" />
          <span v-if="hasApiKey">已保存 API key{{ config?.apiKeyHint ? ` · 末四位 ${config.apiKeyHint}` : '' }}</span>
          <span v-else>尚未配置 API key</span>
        </div>

        <label class="quant-ai-field">
          <span>替换 API key <small>留空则保持原值</small></span>
          <input v-model="form.apiKey" class="field-control" type="password" maxlength="1024" autocomplete="new-password" placeholder="输入新 key">
        </label>

        <label v-if="hasApiKey" class="quant-ai-clear-key">
          <input v-model="form.clearApiKey" type="checkbox">
          <span>保存时清除已保存的 key</span>
        </label>

        <div v-if="errorMessage" class="quant-ai-settings-alert quant-ai-settings-alert-error" role="alert">
          <AlertCircle :size="16" aria-hidden="true" />
          <span>{{ errorMessage }}</span>
        </div>
        <div v-if="savedMessage" class="quant-ai-settings-alert quant-ai-settings-alert-success" role="status">
          <ShieldCheck :size="16" aria-hidden="true" />
          <span>{{ savedMessage }}</span>
        </div>

        <div v-if="testing" class="quant-ai-settings-alert quant-ai-settings-alert-success" role="status">
          <RefreshCw :size="16" class="animate-spin" aria-hidden="true" />
          <span>正在测试已保存配置</span>
        </div>
        <div v-else-if="connectionResult" class="quant-ai-settings-alert quant-ai-settings-alert-success" role="status">
          <ShieldCheck :size="16" aria-hidden="true" />
          <span>连接成功 · {{ connectionResult.model }} · {{ responseModeLabel(form.responseMode) }} · {{ connectionResult.latencyMs }} ms</span>
        </div>
        <div v-else-if="connectionErrorMessage" class="quant-ai-settings-alert quant-ai-settings-alert-error" role="alert">
          <AlertCircle :size="16" aria-hidden="true" />
          <span>{{ connectionErrorMessage }}</span>
        </div>

        <div class="quant-ai-settings-actions">
          <button class="secondary-button" type="button" :disabled="!canTest || saving || testing" :title="hasUnsavedConfig ? '请先保存当前配置后再测试' : '仅测试已保存的配置'" @click="testConnection">
            <RefreshCw :size="15" :class="testing ? 'animate-spin' : ''" aria-hidden="true" />
            {{ testing ? '测试中' : '测试连接' }}
          </button>
          <button class="secondary-button" type="button" @click="emit('update:open', false)">
            关闭
          </button>
          <button class="primary-button" type="submit" :disabled="saving">
            <Save :size="15" aria-hidden="true" />
            {{ saving ? '保存中' : '保存配置' }}
          </button>
        </div>
      </form>
    </section>
  </DetailDrawer>
</template>

<style scoped>
.quant-ai-settings {
  display: grid;
  gap: 1rem;
}

.quant-ai-settings-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.85rem;
  color: hsl(var(--primary));
}

.quant-ai-settings-heading h2 {
  margin: 0.35rem 0 0;
  color: hsl(var(--foreground));
  font-size: 1rem;
}

.quant-ai-settings-form {
  display: grid;
  gap: 0.85rem;
}

.quant-ai-field {
  display: grid;
  gap: 0.35rem;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 650;
}

.quant-ai-field small {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 500;
}

.quant-ai-runtime-field {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 650;
}

.quant-ai-runtime-field legend {
  padding: 0;
}

.quant-ai-segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
  min-width: 0;
}

.quant-ai-segment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 0;
  min-height: 2.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md, 0.375rem);
  background: hsl(var(--background));
  padding: 0.45rem 0.6rem;
  color: hsl(var(--muted-foreground));
  font: inherit;
  cursor: pointer;
}

.quant-ai-segment:hover,
.quant-ai-segment:focus-visible {
  border-color: hsl(var(--primary) / 0.55);
  color: hsl(var(--foreground));
}

.quant-ai-segment-active {
  border-color: hsl(var(--primary) / 0.65);
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.quant-ai-runtime-help {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.45;
}

.quant-ai-key-state,
.quant-ai-settings-alert {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md, 0.375rem);
  padding: 0.65rem 0.75rem;
  font-size: 0.75rem;
}

.quant-ai-key-ready {
  border-color: hsl(var(--status-success) / 0.3);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-ai-key-empty {
  background: hsl(var(--muted) / 0.6);
  color: hsl(var(--muted-foreground));
}

.quant-ai-clear-key {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: hsl(var(--status-danger));
  font-size: 0.75rem;
}

.quant-ai-settings-alert-error {
  border-color: hsl(var(--status-danger) / 0.28);
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.quant-ai-settings-alert-success {
  border-color: hsl(var(--status-success) / 0.28);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.quant-ai-settings-state {
  min-height: 8rem;
  display: grid;
  place-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.quant-ai-settings-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.85rem;
}

.quant-ai-settings-actions > button {
  min-width: 0;
}
</style>
