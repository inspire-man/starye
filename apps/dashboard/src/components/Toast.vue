<script setup lang="ts">
/**
 * Toast 通知组件
 *
 * @component
 * @description
 * 用于显示临时性的消息通知，支持四种类型：success、error、warning、info。
 * 可选支持进度条显示（用于长时间操作）。
 *
 * @example
 * ```vue
 * <template>
 *   <Toast
 *     :toast="{ id: '1', type: 'success', message: '操作成功' }"
 *     @close="handleClose"
 *   />
 * </template>
 * ```
 *
 * @example 带进度的 Toast
 * ```vue
 * <template>
 *   <Toast
 *     :toast="{ id: '2', type: 'info', message: '处理中...', progress: 50 }"
 *     @close="handleClose"
 *   />
 * </template>
 * ```
 */
import type { Toast } from '../composables/useToast'
import { computed } from 'vue'

const props = defineProps<{
  /** Toast 数据，包含类型、消息和可选的进度 */
  toast: Toast & { progress?: number }
}>()

const emit = defineEmits<{
  /** 关闭事件，传递 Toast ID */
  close: [id: string]
}>()

// 类型图标映射
const icons = {
  success: '✓',
  error: '✗',
  warning: '⚠️',
  info: 'ℹ️',
}

// 类型样式映射
const typeClasses = {
  success: 'bg-green-600 text-white border-green-700',
  error: 'bg-red-600 text-white border-red-700',
  warning: 'bg-orange-500 text-white border-orange-600',
  info: 'bg-blue-600 text-white border-blue-700',
}

const icon = computed(() => icons[props.toast.type])
const typeClass = computed(() => typeClasses[props.toast.type])
const isProgressToast = computed(() => props.toast.progress !== undefined)
</script>

<template>
  <div
    class="flex items-start gap-3 p-4 rounded-lg shadow-lg border transition-all duration-200 ease-in-out min-w-[300px] max-w-[400px] w-full sm:w-auto" :class="[
      typeClass,
    ]"
    role="status"
    :aria-label="`${toast.type} notification: ${toast.message}`"
  >
    <!-- 类型图标 -->
    <div class="shrink-0 text-xl font-bold">
      {{ icon }}
    </div>

    <!-- 消息内容 -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium wrap-break-word">
        {{ toast.message }}
      </p>

      <!-- Progress Toast 进度条 -->
      <div v-if="isProgressToast" class="mt-2">
        <div class="flex items-center justify-between text-xs mb-1">
          <span>进度</span>
          <span>{{ toast.progress }}%</span>
        </div>
        <div class="w-full bg-white/30 rounded-full h-1.5">
          <div
            class="bg-white h-1.5 rounded-full transition-all duration-300"
            :style="{ width: `${toast.progress}%` }"
          />
        </div>
      </div>
    </div>

    <!-- 关闭按钮 -->
    <button
      v-if="toast.closable"
      type="button"
      class="shrink-0 text-white/80 hover:text-white transition-colors"
      aria-label="Close notification"
      @click="emit('close', toast.id)"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
</template>
