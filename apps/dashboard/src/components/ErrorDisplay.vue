<script setup lang="ts">
/**
 * 错误显示组件
 *
 * @component
 * @description
 * 用于显示友好的错误信息，支持三种展示模式：
 * - inline: 行内模式，适用于表单字段下方
 * - banner: 横幅模式，适用于页面顶部提示
 * - modal: 模态框模式，适用于阻断性错误
 *
 * @example 行内错误（表单验证）
 * ```vue
 * <template>
 *   <ErrorDisplay
 *     :error="fieldError"
 *     mode="inline"
 *     :show-actions="false"
 *   />
 * </template>
 * ```
 *
 * @example 横幅错误（页面级提示）
 * ```vue
 * <template>
 *   <ErrorDisplay
 *     :error="pageError"
 *     mode="banner"
 *     @retry="handleRetry"
 *     @close="clearError"
 *   />
 * </template>
 * ```
 *
 * @example 模态框错误（阻断性错误）
 * ```vue
 * <template>
 *   <ErrorDisplay
 *     :error="criticalError"
 *     mode="modal"
 *     @retry="handleRetry"
 *     @contact-support="openSupportDialog"
 *   />
 * </template>
 * ```
 */
import type { ParsedError } from '../composables/useErrorHandler'
import { computed } from 'vue'

interface Props {
  /** 解析后的错误对象，null 表示无错误 */
  error: ParsedError | null
  /** 显示模式，默认 'inline' */
  mode?: 'inline' | 'banner' | 'modal'
  /** 是否显示操作按钮，默认 true */
  showActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'inline',
  showActions: true,
})

const emit = defineEmits<{
  /** 重试操作 */
  retry: []
  /** 关闭错误提示 */
  close: []
  /** 联系技术支持 */
  contactSupport: []
}>()

const isVisible = computed(() => props.error !== null)

// 模式样式
const modeClasses = computed(() => {
  switch (props.mode) {
    case 'inline':
      return 'border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded'
    case 'banner':
      return 'border border-red-500 bg-red-50 dark:bg-red-950/20 p-4 rounded-lg'
    case 'modal':
      return 'fixed inset-0 z-50 flex items-center justify-center bg-black/50'
    default:
      return ''
  }
})
</script>

<template>
  <div v-if="isVisible" :class="modeClasses" role="alert">
    <!-- Modal 包装 -->
    <div
      v-if="mode === 'modal'"
      class="bg-background border border-red-500 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 text-red-600 text-xl">
          ✗
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-red-600 mb-2">
            错误
          </h3>
          <p class="text-sm text-foreground">
            {{ error?.message }}
          </p>

          <!-- 操作按钮 -->
          <div v-if="showActions" class="mt-4 flex items-center gap-2">
            <button
              v-if="error?.type === 'network'"
              type="button"
              class="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
              @click="emit('retry')"
            >
              重试
            </button>
            <button
              v-if="error?.type === 'permission'"
              type="button"
              class="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
              @click="emit('close')"
            >
              返回登录
            </button>
            <button
              v-if="error?.type === 'server'"
              type="button"
              class="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
              @click="emit('contactSupport')"
            >
              联系支持
            </button>
            <button
              type="button"
              class="px-4 py-2 border border-border rounded hover:bg-muted text-sm"
              @click="emit('close')"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Inline / Banner 显示 -->
    <div v-else class="flex items-start gap-3">
      <div class="flex-shrink-0 text-red-600">
        ✗
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-red-800 dark:text-red-200">
          {{ error?.message }}
        </p>

        <!-- 操作按钮 -->
        <div v-if="showActions && mode === 'banner'" class="mt-3 flex items-center gap-2">
          <button
            v-if="error?.type === 'network'"
            type="button"
            class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            @click="emit('retry')"
          >
            重试
          </button>
          <button
            type="button"
            class="px-3 py-1 border border-red-600 text-red-600 rounded hover:bg-red-50 text-sm"
            @click="emit('close')"
          >
            关闭
          </button>
        </div>
      </div>

      <!-- Inline 关闭按钮 -->
      <button
        v-if="mode === 'inline'"
        type="button"
        class="flex-shrink-0 text-red-600 hover:text-red-800"
        aria-label="Close error"
        @click="emit('close')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
