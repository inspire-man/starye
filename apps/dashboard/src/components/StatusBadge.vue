<script setup lang="ts">
import { computed } from 'vue'

/**
 * 状态徽章组件
 *
 * 显示爬取状态：pending / partial / complete
 */

interface Props {
  status: 'pending' | 'partial' | 'complete'
  progress?: { current: number, total: number }
}

const props = defineProps<Props>()

const statusConfig = {
  pending: {
    label: '等待中',
    color: 'orange',
  },
  partial: {
    label: '部分完成',
    color: 'yellow',
  },
  complete: {
    label: '已完成',
    color: 'green',
  },
}

const config = computed(() => statusConfig[props.status])
</script>

<template>
  <div class="status-badge" :class="[config.color]">
    <span class="label">{{ config.label }}</span>
    <span v-if="status === 'partial' && progress" class="progress">
      ({{ progress.current }}/{{ progress.total }})
    </span>
  </div>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid transparent;
  padding: 0.1875rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.status-badge.orange {
  border-color: hsl(var(--status-warning) / 0.22);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.status-badge.yellow {
  border-color: hsl(var(--status-warning) / 0.22);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.status-badge.green {
  border-color: hsl(var(--status-success) / 0.2);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.label {
  white-space: nowrap;
}

.progress {
  font-family: monospace;
  font-size: 0.7rem;
}
</style>
