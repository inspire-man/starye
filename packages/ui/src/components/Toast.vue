<script setup lang="ts">
import type { Toast as ToastData } from '../composables/useToast'
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X, XCircle } from 'lucide-vue-next'
import { computed, ref } from 'vue'

const props = defineProps<{
  toast: ToastData & { progress?: number }
}>()

const emit = defineEmits<{
  close: [id: string]
}>()

const iconComponents = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const icon = computed(() => iconComponents[props.toast.type])
const typeClass = computed(() => `ui-toast-${props.toast.type}`)
const role = computed(() => props.toast.type === 'error' ? 'alert' : 'status')
const isProgressToast = computed(() => props.toast.progress !== undefined)
const actionLoading = ref(false)

async function handleAction(): Promise<void> {
  const action = props.toast.action
  if (!action || actionLoading.value)
    return

  actionLoading.value = true
  try {
    await action.onClick()
    if (action.closeOnClick !== false)
      emit('close', props.toast.id)
  }
  catch (error) {
    console.error('[Toast action]', error)
  }
  finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div
    class="ui-toast flex w-full min-w-0 items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-all duration-200 ease-out sm:w-auto"
    :class="typeClass"
    :role="role"
    :aria-live="role === 'alert' ? 'assertive' : 'polite'"
    :aria-label="`${toast.type} notification: ${toast.message}`"
  >
    <div class="ui-toast-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
      <component :is="icon" :size="18" stroke-width="2.2" />
    </div>

    <div class="min-w-0 flex-1">
      <p v-if="toast.title" class="ui-toast-title mb-0.5 break-words text-sm font-semibold">
        {{ toast.title }}
      </p>
      <p class="ui-toast-message break-words text-sm font-medium">
        {{ toast.message }}
      </p>

      <div v-if="isProgressToast" class="mt-2.5" role="group" :aria-label="`进度 ${toast.progress}%`">
        <div class="mb-1 flex items-center justify-between text-xs font-medium">
          <span>进度</span>
          <span>{{ toast.progress }}%</span>
        </div>
        <div
          class="ui-toast-progress-track h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="toast.progress"
        >
          <div
            class="ui-toast-progress h-full rounded-full transition-[width] duration-300"
            :style="{ width: `${toast.progress}%` }"
          />
        </div>
      </div>

      <button
        v-if="toast.action"
        type="button"
        class="ui-toast-action mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="actionLoading"
        @click="handleAction"
      >
        <LoaderCircle v-if="actionLoading" class="animate-spin" :size="13" aria-hidden="true" />
        {{ actionLoading ? '处理中…' : toast.action.label }}
      </button>
    </div>

    <button
      v-if="toast.closable"
      type="button"
      class="ui-toast-close inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2"
      aria-label="关闭通知"
      @click="emit('close', toast.id)"
    >
      <X :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.ui-toast {
  --toast-card: var(--dashboard-card, var(--card, 0 0% 100%));
  --toast-foreground: var(--dashboard-foreground, var(--foreground, 222 35% 16%));
  --toast-border: var(--dashboard-border, var(--border, 220 16% 88%));
  --toast-accent: var(--dashboard-info, var(--primary, 217 75% 45%));
  --toast-accent-soft: var(--dashboard-info-soft, 214 100% 96%);
  border-color: hsl(var(--toast-border));
  background: hsl(var(--toast-card) / 0.97);
  color: hsl(var(--toast-foreground));
  box-shadow: 0 14px 32px hsl(var(--toast-foreground) / 0.14);
  backdrop-filter: blur(14px);
}

.ui-toast-success {
  --toast-accent: var(--dashboard-success, 142 70% 32%);
  --toast-accent-soft: var(--dashboard-success-soft, 142 76% 94%);
}

.ui-toast-error {
  --toast-accent: var(--dashboard-danger, var(--destructive, 0 72% 51%));
  --toast-accent-soft: var(--dashboard-danger-soft, 0 86% 96%);
}

.ui-toast-warning {
  --toast-accent: var(--dashboard-warning, 32 86% 38%);
  --toast-accent-soft: var(--dashboard-warning-soft, 36 100% 95%);
}

.ui-toast-info {
  --toast-accent: var(--dashboard-info, var(--primary, 217 75% 45%));
  --toast-accent-soft: var(--dashboard-info-soft, 214 100% 96%);
}

.ui-toast-icon {
  background: hsl(var(--toast-accent-soft));
  color: hsl(var(--toast-accent));
}

.ui-toast-title,
.ui-toast-message {
  color: hsl(var(--toast-foreground));
}

.ui-toast-message {
  line-height: 1.35rem;
}

.ui-toast-progress-track {
  background: hsl(var(--toast-accent) / 0.16);
}

.ui-toast-progress {
  background: hsl(var(--toast-accent));
}

.ui-toast-action {
  border-color: hsl(var(--toast-accent) / 0.3);
  background: hsl(var(--toast-accent-soft));
  color: hsl(var(--toast-accent));
}

.ui-toast-action:hover:not(:disabled) {
  background: hsl(var(--toast-accent) / 0.16);
}

.ui-toast-close {
  color: hsl(var(--toast-foreground) / 0.58);
}

.ui-toast-close:hover {
  background: hsl(var(--toast-accent) / 0.1);
  color: hsl(var(--toast-accent));
}

.ui-toast-close:focus-visible,
.ui-toast-action:focus-visible {
  outline: 2px solid hsl(var(--toast-accent));
  outline-offset: 2px;
}
</style>
