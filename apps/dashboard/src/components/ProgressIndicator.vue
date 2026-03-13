<script setup lang="ts">
import { computed } from 'vue'

/**
 * 进度指示器组件
 */

interface Props {
  current: number
  total: number
  showPercentage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showPercentage: true,
})

const percentage = computed(() => {
  if (props.total === 0)
    return 0
  return Math.round((props.current / props.total) * 100)
})
</script>

<template>
  <div class="progress-indicator">
    <div class="progress-bar-container">
      <div
        class="progress-bar"
        :style="{ width: `${percentage}%` }"
      />
    </div>
    <div class="progress-text">
      <span v-if="showPercentage" class="percentage">{{ percentage }}%</span>
      <span class="fraction">{{ current }}/{{ total }}</span>
    </div>
  </div>
</template>

<style scoped>
.progress-indicator {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-bar-container {
  width: 100%;
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(to right, #3b82f6, #2563eb);
  transition: width 0.3s ease;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #6b7280;
}

.percentage {
  font-weight: 600;
}

.fraction {
  font-family: monospace;
}
</style>
