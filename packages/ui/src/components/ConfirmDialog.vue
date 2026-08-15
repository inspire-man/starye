<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Props {
  open: boolean
  title: string
  message: string
  requireTextConfirm?: boolean
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  previewItems?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  requireTextConfirm: false,
  confirmText: '确认',
  cancelText: '取消',
  variant: 'default',
  previewItems: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
  'cancel': []
}>()

const confirmInput = ref('')

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    confirmInput.value = ''
  }
})

function handleConfirm() {
  if (props.requireTextConfirm && confirmInput.value !== 'CONFIRM') {
    return
  }
  emit('confirm')
  emit('update:open', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:open', false)
}

const canConfirm = computed(() => {
  if (!props.requireTextConfirm) {
    return true
  }
  return confirmInput.value === 'CONFIRM'
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="confirm-dialog-overlay fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      @click="handleCancel"
    >
      <div
        class="confirm-dialog-panel w-full max-w-[24rem] overflow-hidden rounded-md border border-border bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.stop
      >
        <!-- Header -->
        <div class="confirm-dialog-header border-b border-border px-4 py-3.5">
          <h3 class="text-base font-semibold text-foreground">
            {{ title }}
          </h3>
        </div>

        <!-- Body -->
        <div class="confirm-dialog-body min-w-0 max-h-[min(65vh,24rem)] overflow-y-auto px-4 py-3.5">
          <p class="mb-3 break-words text-sm leading-6 text-foreground">
            {{ message }}
          </p>

          <div v-if="previewItems.length > 0" class="my-3 min-w-0 rounded-md border border-border bg-muted/55 p-3">
            <p class="mb-2 text-xs font-medium text-muted-foreground">
              预览（共 {{ previewItems.length }} 项）:
            </p>
            <ul class="list-disc break-words pl-5 text-sm leading-5 text-foreground">
              <li v-for="(item, index) in previewItems.slice(0, 5)" :key="index" class="mb-1 last:mb-0">
                {{ item }}
              </li>
              <li v-if="previewItems.length > 5" class="italic text-muted-foreground">
                ... 还有 {{ previewItems.length - 5 }} 项
              </li>
            </ul>
          </div>

          <div v-if="requireTextConfirm" class="mt-4">
            <p class="mb-2 text-sm font-medium text-destructive">
              ⚠️ 此操作不可撤销
            </p>
            <p class="mb-2 text-sm text-foreground">
              输入 <strong class="rounded bg-amber-100 px-1.5 py-0.5 font-mono dark:bg-amber-900/30">CONFIRM</strong> 以继续:
            </p>
            <input
              v-model="confirmInput"
              type="text"
              placeholder="CONFIRM"
              class="w-full rounded-md border-2 border-border px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
              @keyup.enter="handleConfirm"
            >
          </div>
        </div>

        <!-- Footer -->
        <div class="confirm-dialog-footer flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            class="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            @click="handleCancel"
          >
            {{ cancelText }}
          </button>
          <button
            class="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            :class="variant === 'danger' ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'"
            :disabled="!canConfirm"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-dialog-overlay {
  z-index: var(--dashboard-modal-z-index, 3000);
}

.confirm-dialog-panel {
  width: min(24rem, calc(100vw - 2rem));
  max-width: 24rem;
  max-height: min(90dvh, 34rem);
}
</style>
