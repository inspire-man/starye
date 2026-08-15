<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

interface Props {
  open: boolean
  title: string
  description?: string
  width?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  width: 'md',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'close': []
}>()

const closeButton = ref<HTMLButtonElement | null>(null)
const previousActiveElement = ref<HTMLElement | null>(null)
const previousBodyOverflow = ref('')

const widthClasses: Record<NonNullable<Props['width']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
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
        class="detail-drawer-overlay fixed inset-0 z-[1000] flex justify-end bg-background/70 backdrop-blur-sm"
        data-detail-drawer
        @click.self="close"
      >
        <aside
          class="detail-drawer-panel flex h-full w-full flex-col rounded-l-2xl border-l border-border bg-background shadow-2xl shadow-black/15"
          :class="widthClasses[width]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          data-detail-drawer-panel
          @click.stop
        >
          <header class="detail-drawer-header flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card/80 px-6 py-5 backdrop-blur">
            <div class="min-w-0">
              <h2 class="truncate text-lg font-semibold text-foreground">
                {{ title }}
              </h2>
              <p v-if="description" class="mt-1 text-sm text-muted-foreground">
                {{ description }}
              </p>
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

          <div class="detail-drawer-body min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="detail-drawer-footer shrink-0 border-t border-border bg-card/70 px-6 py-4">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-drawer-overlay {
  z-index: 1100;
  padding: 0.75rem;
}

.detail-drawer-panel {
  width: min(100%, 56rem);
  max-width: 56rem;
  min-width: 0;
  overflow: hidden;
  border-radius: 1rem;
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
    height: 92%;
    border-left: 0;
    border-top: 1px solid hsl(var(--border));
    border-radius: 1rem;
  }

  .detail-drawer-enter-active aside,
  .detail-drawer-leave-active aside {
    height: 92%;
  }

  .detail-drawer-enter-from aside,
  .detail-drawer-leave-to aside {
    transform: translateY(100%);
  }
}
</style>
