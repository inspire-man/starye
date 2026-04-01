<script setup lang="ts">
import type { ParsedError } from '../composables/useErrorHandler'
import { computed } from 'vue'

interface Props {
  error: ParsedError | null
  mode?: 'inline' | 'banner' | 'modal'
  showActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'inline',
  showActions: true,
})

const emit = defineEmits<{
  retry: []
  close: []
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
