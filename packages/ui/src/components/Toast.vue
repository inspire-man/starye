<script setup lang="ts">
import type { Toast } from '../composables/useToast'
import { computed } from 'vue'

const props = defineProps<{
  toast: Toast & { progress?: number }
}>()

const emit = defineEmits<{
  close: [id: string]
}>()

const icons = {
  success: '✓',
  error: '✗',
  warning: '⚠️',
  info: 'ℹ️',
}

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
    class="flex w-full min-w-[300px] max-w-[400px] items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200 ease-in-out sm:w-auto"
    :class="[typeClass]"
    role="status"
    :aria-label="`${toast.type} notification: ${toast.message}`"
  >
    <div class="shrink-0 text-xl font-bold">
      {{ icon }}
    </div>

    <div class="min-w-0 flex-1">
      <p class="break-words text-sm font-medium">
        {{ toast.message }}
      </p>

      <div v-if="isProgressToast" class="mt-2">
        <div class="mb-1 flex items-center justify-between text-xs">
          <span>进度</span>
          <span>{{ toast.progress }}%</span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-white/30">
          <div
            class="h-1.5 rounded-full bg-white transition-all duration-300"
            :style="{ width: `${toast.progress}%` }"
          />
        </div>
      </div>
    </div>

    <button
      v-if="toast.closable"
      type="button"
      class="shrink-0 text-white/80 transition-colors hover:text-white"
      aria-label="Close notification"
      @click="emit('close', toast.id)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
