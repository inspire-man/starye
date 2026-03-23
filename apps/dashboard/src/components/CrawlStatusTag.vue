<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  hasDetailsCrawled?: boolean | null
  sourceUrl?: string | null
  crawlFailureCount?: number | null
}

const props = defineProps<Props>()

const statusInfo = computed(() => {
  if (props.hasDetailsCrawled) {
    return {
      icon: '✅',
      text: '已完成',
      class: 'status-complete',
      tooltip: '详情已爬取完成',
    }
  }

  if (props.crawlFailureCount && props.crawlFailureCount > 0) {
    return {
      icon: '❌',
      text: `失败(${props.crawlFailureCount})`,
      class: 'status-failed',
      tooltip: `已尝试 ${props.crawlFailureCount} 次失败，需要人工检查`,
    }
  }

  if (!props.sourceUrl) {
    return {
      icon: '🔗',
      text: '无链接',
      class: 'status-no-link',
      tooltip: '没有详情页 URL，无法自动爬取',
    }
  }

  return {
    icon: '⚠️',
    text: '待爬取',
    class: 'status-pending',
    tooltip: '详情待补全，下次爬虫运行时会处理',
  }
})
</script>

<template>
  <span
    class="crawl-status-tag"
    :class="statusInfo.class"
    :title="statusInfo.tooltip"
  >
    <span class="status-icon">{{ statusInfo.icon }}</span>
    <span class="status-text">{{ statusInfo.text }}</span>
  </span>
</template>

<style scoped>
.crawl-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  cursor: help;
  white-space: nowrap;
}

/* 已完成 */
.status-complete {
  background: #dcfce7;
  color: #166534;
  border-color: #86efac;
}

/* 待爬取 */
.status-pending {
  background: #fef3c7;
  color: #92400e;
  border-color: #fcd34d;
}

/* 失败 */
.status-failed {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

/* 无链接 */
.status-no-link {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #d1d5db;
}

.status-icon {
  line-height: 1;
}

.status-text {
  line-height: 1;
}
</style>
