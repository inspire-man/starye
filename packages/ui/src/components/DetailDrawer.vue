<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

interface Props {
  open: boolean
  title: string
  description?: string
  width?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  width: 'md',
  loading: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'close': []
}>()

const closeButton = ref<HTMLButtonElement | null>(null)
const previousActiveElement = ref<HTMLElement | null>(null)
const previousBodyOverflow = ref('')

const widthClasses: Record<NonNullable<Props['width']>, string> = {
  sm: 'detail-drawer-width-sm',
  md: 'detail-drawer-width-md',
  lg: 'detail-drawer-width-lg',
}

function close(): void {
  emit('update:open', false)
  emit('close')
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.open && event.key === 'Escape')
    close()
}

watch(() => props.open, async (open) => {
  if (open) {
    previousActiveElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousBodyOverflow.value = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeydown)
    await nextTick()
    closeButton.value?.focus()
  }
  else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = previousBodyOverflow.value
    previousActiveElement.value?.focus()
    previousActiveElement.value = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = previousBodyOverflow.value
})
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-drawer">
      <div
        v-if="open"
        class="detail-drawer-overlay fixed inset-0 z-[1400] flex justify-end bg-background/70 backdrop-blur-sm"
        data-detail-drawer
        @click.self="close"
      >
        <aside
          class="detail-drawer-panel flex h-full w-full flex-col border border-border bg-card shadow-2xl shadow-black/15"
          :class="widthClasses[width]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          :aria-busy="loading"
          data-detail-drawer-panel
          @click.stop
        >
          <header class="detail-drawer-header flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card/80 backdrop-blur">
            <div class="min-w-0">
              <template v-if="loading">
                <div class="ui-skeleton detail-drawer-skeleton-title" />
                <div class="ui-skeleton detail-drawer-skeleton-description" />
              </template>
              <template v-else>
                <h2 class="truncate text-lg font-semibold text-foreground">
                  {{ title }}
                </h2>
                <p v-if="description" class="mt-1 text-sm text-muted-foreground">
                  {{ description }}
                </p>
              </template>
            </div>
            <button
              ref="closeButton"
              class="detail-drawer-close inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              type="button"
              title="关闭详情"
              aria-label="关闭详情"
              @click="close"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </header>

          <div class="detail-drawer-body min-h-0 flex-1 overflow-y-auto">
            <div v-if="loading" class="detail-drawer-skeleton-content" role="status" aria-label="加载中">
              <div class="ui-skeleton detail-drawer-skeleton-summary" />
              <div class="detail-drawer-skeleton-group">
                <div v-for="row in 4" :key="row" class="detail-drawer-skeleton-row">
                  <div class="ui-skeleton detail-drawer-skeleton-label" />
                  <div class="ui-skeleton detail-drawer-skeleton-value" />
                </div>
              </div>
              <div class="detail-drawer-skeleton-group">
                <div class="ui-skeleton detail-drawer-skeleton-section-title" />
                <div v-for="row in 3" :key="row" class="ui-skeleton detail-drawer-skeleton-line" />
              </div>
            </div>
            <slot v-else />
          </div>

          <footer v-if="$slots.footer && !loading" class="detail-drawer-footer shrink-0 border-t border-border bg-card/70">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-drawer-overlay {
  z-index: var(--dashboard-drawer-z-index, 1400);
  padding: var(--dashboard-drawer-inset, 1rem);
}

.detail-drawer-panel {
  width: min(100%, var(--detail-drawer-max-width, 42rem));
  max-width: var(--detail-drawer-max-width, 42rem);
  height: 100%;
  min-width: 0;
  max-height: calc(100dvh - (var(--dashboard-drawer-inset, 1rem) * 2));
  overflow: hidden;
  border-radius: var(--ui-radius-lg, 0.75rem);
  background: hsl(var(--card));
  box-shadow: 0 20px 45px hsl(var(--foreground) / 0.18);
}

.detail-drawer-width-sm {
  --detail-drawer-max-width: 28rem;
}

.detail-drawer-width-md {
  --detail-drawer-max-width: 42rem;
}

.detail-drawer-width-lg {
  --detail-drawer-max-width: 56rem;
}

.detail-drawer-header {
  padding: 0.875rem 1rem;
}

.detail-drawer-body {
  padding: 1rem;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: auto;
  scrollbar-width: thin;
}

.detail-drawer-body > :deep(*) {
  min-width: 0;
  max-width: 100%;
}

.detail-drawer-footer {
  padding: 0.75rem 1rem;
}

.detail-drawer-skeleton-title {
  width: min(15rem, 72vw);
  height: 1.25rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.detail-drawer-skeleton-description {
  width: min(10rem, 52vw);
  height: 0.875rem;
  margin-top: 0.625rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.detail-drawer-skeleton-content {
  display: grid;
  gap: 0.75rem;
}

.detail-drawer-skeleton-summary {
  height: 4.5rem;
  border-radius: var(--ui-radius-md, 0.5rem);
}

.detail-drawer-skeleton-group {
  display: grid;
  gap: 0.625rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md, 0.5rem);
  padding: 0.75rem 0.875rem;
}

.detail-drawer-skeleton-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.detail-drawer-skeleton-label {
  width: 28%;
  height: 0.875rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.detail-drawer-skeleton-value {
  width: 46%;
  height: 0.875rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.detail-drawer-skeleton-section-title {
  width: 34%;
  height: 1rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.detail-drawer-skeleton-line {
  width: 100%;
  height: 0.875rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.detail-drawer-enter-active,
.detail-drawer-leave-active {
  transition: opacity 180ms ease;
}

.detail-drawer-enter-active aside,
.detail-drawer-leave-active aside {
  transition: transform 180ms ease;
}

.detail-drawer-enter-from,
.detail-drawer-leave-to {
  opacity: 0;
}

.detail-drawer-enter-from aside,
.detail-drawer-leave-to aside {
  transform: translateX(100%);
}

@media (max-width: 640px) {
  .detail-drawer-overlay {
    align-items: flex-end;
    padding: 0.5rem;
  }

  .detail-drawer-panel {
    width: 100%;
    max-width: none;
    height: min(92%, 48rem);
    border-left: 0;
    border-top: 1px solid hsl(var(--border));
    border-radius: var(--ui-radius-lg, 0.75rem);
  }

  .detail-drawer-header {
    padding: 0.75rem 0.875rem;
  }

  .detail-drawer-body {
    padding: 0.875rem;
  }

  .detail-drawer-footer {
    padding: 0.625rem 0.875rem;
  }

  .detail-drawer-enter-active aside,
  .detail-drawer-leave-active aside {
    height: min(92%, 48rem);
  }

  .detail-drawer-enter-from aside,
  .detail-drawer-leave-to aside {
    transform: translateY(100%);
  }
}
</style>
