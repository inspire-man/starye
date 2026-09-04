<script setup lang="ts">
import type { ParsedError } from '@starye/ui'
import type { QuantView } from '../lib/quant-view'
import { ErrorDisplay } from '@starye/ui'
import { BarChart3, X } from 'lucide-vue-next'
import QuantHeader from './QuantHeader.vue'

interface QuantViewCopy {
  eyebrow: string
  title: string
  subtitle: string
}

const props = defineProps<{
  activeView: QuantView
  activeViewCopy: QuantViewCopy
  latestDate: string
  busy: boolean
  overallError: ParsedError | null
  actionErrorMessage: string | null
}>()

const emit = defineEmits<{
  navigate: [view: QuantView]
  refresh: []
  settings: []
  factorSettings: []
  clearError: []
}>()
</script>

<template>
  <div class="quant-shell min-h-screen">
    <QuantHeader
      :active-view="props.activeView"
      :latest-date="props.latestDate"
      :busy="props.busy"
      @navigate="emit('navigate', $event)"
      @refresh="emit('refresh')"
      @settings="emit('settings')"
      @factor-settings="emit('factorSettings')"
    />
    <slot name="drawers" />
    <main class="quant-page">
      <header class="quant-view-heading">
        <div class="min-w-0">
          <p class="quant-eyebrow">
            {{ props.activeViewCopy.eyebrow }}
          </p>
          <div class="quant-view-title-row">
            <h1 class="quant-title">
              {{ props.activeViewCopy.title }}
            </h1>
          </div>
          <p class="quant-subtitle">
            {{ props.activeViewCopy.subtitle }}
          </p>
        </div>
        <div class="quant-view-heading-meta">
          <span>当前视图</span>
          <strong>{{ props.activeViewCopy.title }}</strong>
        </div>
      </header>

      <ErrorDisplay
        v-if="props.overallError && !props.busy"
        :error="props.overallError"
        mode="banner"
        :show-actions="false"
      />
      <div v-if="props.actionErrorMessage" class="inline-alert" role="alert">
        <span>{{ props.actionErrorMessage }}</span>
        <button class="alert-close" type="button" aria-label="关闭错误" title="关闭错误" @click="emit('clearError')">
          <X :size="15" aria-hidden="true" />
        </button>
      </div>

      <slot />

      <footer class="quant-footer">
        <span><BarChart3 :size="14" aria-hidden="true" /> 数据口径：日线收盘价</span>
        <span>信号用于观察与比较，不代表未来收益</span>
      </footer>
    </main>
  </div>
</template>
