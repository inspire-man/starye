<script setup lang="ts">
/**
 * 表格骨架屏组件
 *
 * @component
 * @description
 * 用于在表格数据加载时显示占位骨架，提供平滑的加载过渡效果。
 * 支持自定义行数、列数、列宽和复选框列。
 *
 * @example 基础用法
 * ```vue
 * <template>
 *   <SkeletonTable
 *     v-if="loading"
 *     :rows="10"
 *     :columns="5"
 *   />
 * </template>
 * ```
 *
 * @example 自定义列宽
 * ```vue
 * <template>
 *   <SkeletonTable
 *     v-if="loading"
 *     :rows="20"
 *     :columns="7"
 *     :widths="['50px', '120px', '200px', 'auto', '150px', '100px', '180px']"
 *     :selectable="true"
 *   />
 * </template>
 * ```
 */
import { computed } from 'vue'

interface Props {
  /** 显示的行数，默认 5 */
  rows?: number
  /** 显示的列数，默认 4 */
  columns?: number
  /** 自定义列宽数组，默认均分 */
  widths?: string[]
  /** 是否显示复选框列，默认 false */
  selectable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rows: 5,
  columns: 4,
  widths: () => [],
  selectable: false,
})

// 生成列宽数组
const columnWidths = computed(() => {
  if (props.widths.length > 0) {
    return props.widths
  }
  // 默认列宽：第一列窄，其余平均分配
  const widths = Array.from({ length: props.columns })
  return widths.map((_, i) => i === 0 ? 'w-24' : 'flex-1')
})

// 生成行数组
const rowArray = computed(() => Array.from({ length: props.rows }))
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <table class="w-full">
      <thead class="bg-muted/50 border-b">
        <tr>
          <!-- 复选框列占位 -->
          <th v-if="selectable" class="w-12 p-3">
            <div class="skeleton-base w-4 h-4 rounded" />
          </th>

          <!-- 表头列 -->
          <th
            v-for="(width, idx) in columnWidths"
            :key="idx"
            class="p-3 text-left"
          >
            <div
              class="skeleton-base h-4 rounded"
              :class="width === 'flex-1' ? 'w-full' : width"
            />
          </th>
        </tr>
      </thead>

      <tbody class="divide-y">
        <tr v-for="(_, rowIdx) in rowArray" :key="rowIdx">
          <!-- 复选框列占位 -->
          <td v-if="selectable" class="p-3">
            <div class="skeleton-base w-4 h-4 rounded" />
          </td>

          <!-- 数据列 -->
          <td
            v-for="(width, colIdx) in columnWidths"
            :key="colIdx"
            class="p-3"
          >
            <div
              class="skeleton-base h-4 rounded"
              :class="width === 'flex-1' ? 'w-full' : width"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.skeleton-base {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 0%,
    hsl(var(--muted-foreground) / 0.1) 50%,
    hsl(var(--muted)) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-base {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
}
</style>
