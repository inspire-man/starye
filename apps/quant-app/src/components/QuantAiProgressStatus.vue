<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  active: boolean
  label: string
}>()

const startedAt = ref<number | null>(null)
const currentTime = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

function stopTimer(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function startTimer(): void {
  stopTimer()
  startedAt.value = Date.now()
  currentTime.value = startedAt.value
  timer = setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)
}

watch(() => props.active, (active) => {
  if (active) {
    startTimer()
  }
  else {
    stopTimer()
    startedAt.value = null
  }
}, { immediate: true })

onBeforeUnmount(stopTimer)

const elapsedSeconds = computed(() => {
  if (startedAt.value === null)
    return 0
  return Math.max(0, Math.floor((currentTime.value - startedAt.value) / 1000))
})

const elapsedLabel = computed(() => {
  const totalSeconds = elapsedSeconds.value
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds % 3600 / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
})

const startedAtLabel = computed(() => startedAt.value === null ? undefined : new Date(startedAt.value).toISOString())
</script>

<template>
  <div v-if="active" class="quant-ai-progress-status" role="status" aria-live="polite">
    <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
    <span class="quant-ai-progress-label">{{ label }}</span>
    <time class="quant-ai-progress-elapsed" :datetime="startedAtLabel" :aria-label="`已等待 ${elapsedLabel}`">
      已等待 {{ elapsedLabel }}
    </time>
  </div>
</template>

<style scoped>
.quant-ai-progress-status {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  border: 1px solid hsl(var(--status-info) / 0.24);
  border-radius: var(--ui-radius-sm, 0.25rem);
  background: hsl(var(--status-info) / 0.06);
  padding: 0.45rem 0.55rem;
  color: hsl(var(--status-info));
  font-size: 0.6875rem;
  text-align: center;
}

.quant-ai-progress-label {
  color: hsl(var(--muted-foreground));
}

.quant-ai-progress-elapsed {
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
  font-weight: 720;
}
</style>
