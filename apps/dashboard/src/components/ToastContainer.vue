<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useToast } from '../composables/useToast'
import Toast from './Toast.vue'

const { toasts, hideToast } = useToast()

// 键盘事件：Escape 关闭最新的 Toast
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && toasts.value.length > 0) {
    const lastToast = toasts.value.at(-1)
    if (lastToast.closable) {
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
      class="fixed top-4 right-4 z-50 space-y-2"
      aria-live="polite"
      aria-atomic="false"
    >
      <TransitionGroup
        name="toast"
        tag="div"
        class="space-y-2"
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
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100px);
}
</style>
