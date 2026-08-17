<script setup lang="ts">
import { AlertTriangle, CircleHelp, LoaderCircle, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

interface Props {
  open: boolean
  title: string
  message: string
  requireTextConfirm?: boolean
  confirmText?: string
  cancelText?: string
  loadingText?: string
  variant?: 'default' | 'danger'
  previewItems?: string[]
  loading?: boolean
  closeOnBackdrop?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  requireTextConfirm: false,
  confirmText: '确认',
  cancelText: '取消',
  loadingText: '处理中…',
  variant: 'default',
  previewItems: () => [],
  loading: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
  'cancel': []
}>()

const dialogId = useId()
const titleId = `confirm-dialog-title-${dialogId}`
const descriptionId = `confirm-dialog-description-${dialogId}`
const confirmationHintId = `confirm-dialog-hint-${dialogId}`

const panel = ref<HTMLElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const confirmationInput = ref<HTMLInputElement | null>(null)
const confirmInput = ref('')
const confirmRequested = ref(false)
const previousActiveElement = ref<HTMLElement | null>(null)
const previousBodyOverflow = ref('')

const canConfirm = computed(() => {
  if (!props.requireTextConfirm)
    return true
  return confirmInput.value === 'CONFIRM'
})

const isDanger = computed(() => props.variant === 'danger')
const canCloseOnBackdrop = computed(() => props.closeOnBackdrop ?? !isDanger.value)
const confirmDisabled = computed(() => props.loading || confirmRequested.value || !canConfirm.value)
const dialogIcon = computed(() => isDanger.value ? AlertTriangle : CircleHelp)

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(): HTMLElement[] {
  return Array.from(panel.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
}

function focusInitialElement(): void {
  if (props.requireTextConfirm) {
    confirmationInput.value?.focus()
    return
  }
  cancelButton.value?.focus()
}

function handleCancel(): void {
  if (props.loading)
    return
  confirmRequested.value = false
  emit('cancel')
  emit('update:open', false)
}

function handleBackdropClick(): void {
  if (canCloseOnBackdrop.value)
    handleCancel()
}

function handleConfirm(): void {
  if (confirmDisabled.value)
    return

  confirmRequested.value = true
  emit('confirm')

  // Let synchronous handlers set loading before deciding whether the dialog
  // should stay open for an async operation.
  void nextTick(() => {
    if (!props.loading) {
      confirmRequested.value = false
      emit('update:open', false)
    }
  })
}

function handleKeydown(event: KeyboardEvent): void {
  if (!props.open)
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
    return
  }

  if (event.key !== 'Tab')
    return

  const focusableElements = getFocusableElements()
  if (focusableElements.length === 0) {
    event.preventDefault()
    panel.value?.focus()
    return
  }

  const first = focusableElements[0]
  const last = focusableElements[focusableElements.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    previousActiveElement.value = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    previousBodyOverflow.value = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeydown)
    await nextTick()
    focusInitialElement()
  }
  else {
    confirmInput.value = ''
    confirmRequested.value = false
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = previousBodyOverflow.value
    previousActiveElement.value?.focus()
    previousActiveElement.value = null
  }
}, { immediate: true })

watch(() => props.loading, (isLoading, wasLoading) => {
  if (wasLoading && !isLoading)
    confirmRequested.value = false
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = previousBodyOverflow.value
  previousActiveElement.value?.focus()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="open"
        class="confirm-dialog-overlay fixed inset-0 z-[3000] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm"
        data-confirm-dialog
        role="presentation"
        @click.self="handleBackdropClick"
      >
        <div
          ref="panel"
          class="confirm-dialog-panel w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/20"
          :class="isDanger ? 'confirm-dialog-panel-danger' : 'confirm-dialog-panel-default'"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="descriptionId"
          :aria-busy="loading"
          data-confirm-dialog-panel
          tabindex="-1"
          @click.stop
        >
          <header class="confirm-dialog-header flex items-start gap-3 border-b border-border bg-card/85 px-5 py-4 backdrop-blur">
            <div
              class="confirm-dialog-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              :class="isDanger ? 'confirm-dialog-icon-danger' : 'confirm-dialog-icon-default'"
              aria-hidden="true"
            >
              <component :is="dialogIcon" :size="20" stroke-width="2.2" />
            </div>
            <div class="min-w-0 flex-1 pt-0.5">
              <h2 :id="titleId" class="break-words text-base font-semibold leading-6 text-foreground">
                {{ title }}
              </h2>
              <p v-if="loading" class="mt-1 text-xs font-medium text-muted-foreground" role="status" aria-live="polite">
                {{ loadingText }}
              </p>
            </div>
            <button
              class="confirm-dialog-close inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :aria-label="cancelText"
              :disabled="loading"
              @click="handleCancel"
            >
              <X :size="17" aria-hidden="true" />
            </button>
          </header>

          <div class="confirm-dialog-body min-w-0 max-h-[min(65vh,28rem)] overflow-y-auto px-5 py-4">
            <div :id="descriptionId" class="space-y-3">
              <p class="break-words text-sm leading-6 text-muted-foreground">
                {{ message }}
              </p>

              <div v-if="isDanger" class="confirm-dialog-risk flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm" role="alert">
                <AlertTriangle :size="17" class="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{{ requireTextConfirm ? '此操作不可撤销，请确认操作范围后继续。' : '请确认操作对象与范围，提交后可能影响现有数据。' }}</span>
              </div>

              <div v-if="previewItems.length > 0" class="confirm-dialog-preview min-w-0 rounded-lg border p-3">
                <p class="mb-2 text-xs font-medium text-muted-foreground">
                  预览（共 {{ previewItems.length }} 项）
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

              <div v-if="$slots.default" class="confirm-dialog-extra rounded-lg border p-3">
                <slot />
              </div>

              <div v-if="requireTextConfirm" class="space-y-2 pt-1">
                <label :for="confirmationHintId" class="block text-sm font-medium text-foreground">
                  输入 <strong class="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-destructive">CONFIRM</strong> 以继续
                </label>
                <input
                  :id="confirmationHintId"
                  ref="confirmationInput"
                  v-model="confirmInput"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="CONFIRM"
                  aria-required="true"
                  :aria-invalid="confirmInput.length > 0 && !canConfirm"
                  class="confirm-dialog-input w-full rounded-lg border px-3 py-2.5 font-mono text-sm outline-none transition-colors"
                  @keyup.enter="handleConfirm"
                >
              </div>
            </div>
          </div>

          <footer class="confirm-dialog-footer flex flex-col-reverse gap-2 border-t border-border bg-card/70 px-5 py-4 sm:flex-row sm:justify-end">
            <button
              ref="cancelButton"
              class="confirm-dialog-cancel inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              type="button"
              :disabled="loading"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
              class="confirm-dialog-confirm inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              :class="isDanger ? 'confirm-dialog-confirm-danger' : 'confirm-dialog-confirm-default'"
              :disabled="confirmDisabled"
              :aria-busy="loading"
              type="button"
              @click="handleConfirm"
            >
              <LoaderCircle v-if="loading" class="animate-spin" :size="16" aria-hidden="true" />
              <span>{{ loading ? loadingText : confirmText }}</span>
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-dialog-overlay {
  z-index: var(--dashboard-modal-z-index, 3000);
  --confirm-dialog-background: var(--dashboard-background, var(--background));
  --confirm-dialog-foreground: var(--dashboard-foreground, var(--foreground));
  --confirm-dialog-card: var(--dashboard-card, var(--card));
  --confirm-dialog-primary: var(--dashboard-primary, var(--primary));
  --confirm-dialog-primary-foreground: var(--dashboard-primary-foreground, var(--primary-foreground));
  --confirm-dialog-destructive: var(--dashboard-destructive, var(--destructive));
  --confirm-dialog-destructive-foreground: var(--dashboard-destructive-foreground, var(--destructive-foreground));
  --confirm-dialog-muted: var(--dashboard-muted, var(--muted));
  --confirm-dialog-muted-foreground: var(--dashboard-muted-foreground, var(--muted-foreground));
  --confirm-dialog-border: var(--dashboard-border, var(--border));
  --confirm-dialog-input: var(--dashboard-input, var(--input));
  --confirm-dialog-ring: var(--dashboard-ring, var(--ring));
  background-color: hsl(var(--confirm-dialog-background) / 0.75);
  color: hsl(var(--confirm-dialog-foreground));
}

.confirm-dialog-panel {
  width: min(30rem, calc(100vw - 2rem));
  max-width: 30rem;
  max-height: min(90dvh, 42rem);
  border: 1px solid hsl(var(--confirm-dialog-border));
  border-color: hsl(var(--confirm-dialog-border));
  background: hsl(var(--confirm-dialog-card));
}

.confirm-dialog-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-color: hsl(var(--confirm-dialog-border));
  padding: 1rem 1.25rem;
  background: hsl(var(--confirm-dialog-card) / 0.9);
}

.confirm-dialog-icon {
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.confirm-dialog-icon-danger {
  background: hsl(var(--confirm-dialog-destructive) / 0.12);
  color: hsl(var(--confirm-dialog-destructive));
}

.confirm-dialog-icon-default {
  background: hsl(var(--confirm-dialog-primary) / 0.12);
  color: hsl(var(--confirm-dialog-primary));
}

.confirm-dialog-close {
  border: 0;
  background: transparent;
  color: hsl(var(--confirm-dialog-muted-foreground));
}

.confirm-dialog-close:hover:not(:disabled) {
  background: hsl(var(--confirm-dialog-muted));
  color: hsl(var(--confirm-dialog-foreground));
}

.confirm-dialog-body {
  max-height: min(65vh, 28rem);
  overflow-y: auto;
  padding: 1rem 1.25rem;
}

.confirm-dialog-body > div {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.confirm-dialog-body p {
  margin: 0;
  color: hsl(var(--confirm-dialog-muted-foreground));
  line-height: 1.5rem;
}

.confirm-dialog-risk {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  border-color: hsl(var(--confirm-dialog-destructive) / 0.22);
  background: hsl(var(--confirm-dialog-destructive) / 0.08);
  color: hsl(var(--confirm-dialog-destructive));
  padding: 0.625rem 0.75rem;
}

.confirm-dialog-preview,
.confirm-dialog-extra {
  border-color: hsl(var(--confirm-dialog-border));
  background: hsl(var(--confirm-dialog-muted) / 0.45);
  padding: 0.75rem;
}

.confirm-dialog-preview p {
  margin-bottom: 0.5rem;
  color: hsl(var(--confirm-dialog-muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
}

.confirm-dialog-preview ul {
  margin: 0;
  color: hsl(var(--confirm-dialog-foreground));
}

.confirm-dialog-extra > :deep(*) {
  min-width: 0;
  max-width: 100%;
}

.confirm-dialog-input {
  min-height: 2.5rem;
  border-color: hsl(var(--confirm-dialog-input));
  background: hsl(var(--confirm-dialog-background));
  color: hsl(var(--confirm-dialog-foreground));
}

.confirm-dialog-input::placeholder {
  color: hsl(var(--confirm-dialog-muted-foreground));
}

.confirm-dialog-input:focus {
  border-color: hsl(var(--confirm-dialog-ring));
  box-shadow: 0 0 0 3px hsl(var(--confirm-dialog-ring) / 0.18);
  outline: none;
}

.confirm-dialog-footer {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  justify-content: flex-end;
  border-color: hsl(var(--confirm-dialog-border));
  padding: 1rem 1.25rem;
  background: hsl(var(--confirm-dialog-card) / 0.78);
}

.confirm-dialog-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.5rem;
  width: 100%;
  padding: 0 1rem;
  border-radius: var(--ui-radius-md, 0.375rem);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.confirm-dialog-cancel {
  border-color: hsl(var(--confirm-dialog-border));
  background: hsl(var(--confirm-dialog-background));
  color: hsl(var(--confirm-dialog-foreground));
}

.confirm-dialog-cancel:hover:not(:disabled) {
  background: hsl(var(--confirm-dialog-muted));
}

.confirm-dialog-confirm-default {
  background: hsl(var(--confirm-dialog-primary));
  color: hsl(var(--confirm-dialog-primary-foreground));
}

.confirm-dialog-confirm-default:hover:not(:disabled) {
  background: hsl(var(--confirm-dialog-primary) / 0.9);
}

.confirm-dialog-confirm-danger {
  background: hsl(var(--confirm-dialog-destructive));
  color: hsl(var(--confirm-dialog-destructive-foreground));
}

.confirm-dialog-confirm-danger:hover:not(:disabled) {
  background: hsl(var(--confirm-dialog-destructive) / 0.9);
}

.confirm-dialog-close:focus-visible,
.confirm-dialog-cancel:focus-visible,
.confirm-dialog-confirm:focus-visible {
  outline: 2px solid hsl(var(--confirm-dialog-ring));
  outline-offset: 2px;
}

.confirm-dialog-panel-danger {
  box-shadow: 0 24px 60px hsl(var(--destructive) / 0.12), 0 20px 45px hsl(var(--foreground) / 0.14);
}

.confirm-dialog-panel-default {
  box-shadow: 0 20px 45px hsl(var(--foreground) / 0.16);
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 180ms ease;
}

.confirm-dialog-enter-active .confirm-dialog-panel,
.confirm-dialog-leave-active .confirm-dialog-panel {
  transition: transform 180ms ease, opacity 180ms ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}

.confirm-dialog-enter-from .confirm-dialog-panel,
.confirm-dialog-leave-to .confirm-dialog-panel {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.98);
}

@media (max-width: 640px) {
  .confirm-dialog-overlay {
    align-items: flex-end;
    padding: 0.5rem;
  }

  .confirm-dialog-panel {
    width: 100%;
    max-width: none;
    max-height: min(92dvh, 42rem);
    border-radius: var(--ui-radius-lg, 0.75rem);
  }

  .confirm-dialog-header,
  .confirm-dialog-body,
  .confirm-dialog-footer {
    padding-inline: 0.875rem;
  }

  .confirm-dialog-footer {
    flex-direction: column-reverse;
  }

  .confirm-dialog-footer button {
    width: 100%;
  }

  .confirm-dialog-panel {
    border-radius: var(--ui-radius-lg, 0.75rem);
  }

  .confirm-dialog-enter-from .confirm-dialog-panel,
  .confirm-dialog-leave-to .confirm-dialog-panel {
    transform: translateY(1rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .confirm-dialog-enter-active,
  .confirm-dialog-leave-active,
  .confirm-dialog-enter-active .confirm-dialog-panel,
  .confirm-dialog-leave-active .confirm-dialog-panel {
    transition: none;
  }
}
</style>
