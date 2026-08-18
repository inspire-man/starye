<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useToast } from '../composables/useToast'
import Toast from './Toast.vue'

const { toasts, hideToast } = useToast()

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && toasts.value.length > 0) {
    const lastToast = toasts.value.at(-1)
    if (lastToast?.closable) {
      hideToast(lastToast.id)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="ui-toast-container fixed right-4 top-4 z-[4000] w-[min(28rem,calc(100vw-2rem))]"
      aria-label="通知"
    >
      <TransitionGroup
        name="toast"
        tag="div"
        class="ui-toast-list space-y-2"
      >
        <Toast
          v-for="toast in toasts"
          :key="toast.id"
          :toast="toast"
          @close="hideToast"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.ui-toast-container {
  padding-top: env(safe-area-inset-top, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100px);
}

@media (max-width: 640px) {
  .ui-toast-container {
    right: 0.75rem;
    left: 0.75rem;
    width: auto;
  }

  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(-0.5rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
