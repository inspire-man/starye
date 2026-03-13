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
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.orange {
  background: #fed7aa;
  color: #c2410c;
}

.status-badge.yellow {
  background: #fef08a;
  color: #a16207;
}

.status-badge.green {
  background: #bbf7d0;
  color: #15803d;
}

.label {
  white-space: nowrap;
}

.progress {
  font-family: monospace;
  font-size: 0.7rem;
}
</style>
