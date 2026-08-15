<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  rows?: number
  columns?: number
  widths?: string[]
  selectable?: boolean
  minWidth?: string
  maxHeight?: string
  /** 操作列宽度，与 DataTable 的 actions 列保持一致 */
  actionWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  rows: 5,
  columns: 4,
  widths: () => [],
  selectable: false,
  minWidth: '800px',
  maxHeight: 'min(62vh, 44rem)',
  actionWidth: '7rem',
})

const columnWidths = computed(() => {
  if (props.widths.length > 0) {
    return props.widths
  }
  const widths = Array.from({ length: props.columns })
  return widths.map((_, i) => i === 0 ? 'w-24' : 'flex-1')
})

const rowArray = computed(() => Array.from({ length: props.rows }))
</script>

<template>
  <div class="data-table-skeleton-shell w-full overflow-hidden border border-border bg-card">
    <div class="data-table-skeleton-scroll data-table-scroll" :style="{ maxHeight }">
      <table class="data-table-skeleton-table w-full" :style="{ minWidth }">
        <thead>
          <tr>
            <th v-if="selectable" class="skeleton-table-cell skeleton-table-select-cell skeleton-table-head-cell">
              <div class="skeleton-shimmer ui-skeleton h-4 w-4 rounded" />
            </th>
            <th
              v-for="(width, idx) in columnWidths"
              :key="idx"
              class="skeleton-table-cell skeleton-table-head-cell text-left"
              :class="idx === columnWidths.length - 1 ? 'skeleton-table-action-cell text-right' : ''"
              :style="idx === columnWidths.length - 1 ? { width: actionWidth, minWidth: actionWidth, maxWidth: actionWidth } : undefined"
            >
              <div
                class="skeleton-shimmer ui-skeleton h-3.5 rounded"
                :class="[width === 'flex-1' ? 'w-full' : width, idx === columnWidths.length - 1 ? 'skeleton-table-action-line' : '']"
              />
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(_, rowIdx) in rowArray" :key="rowIdx">
            <td v-if="selectable" class="skeleton-table-cell skeleton-table-select-cell">
              <div class="skeleton-shimmer ui-skeleton h-4 w-4 rounded" />
            </td>
            <td
              v-for="(width, colIdx) in columnWidths"
              :key="colIdx"
              class="skeleton-table-cell"
              :class="colIdx === columnWidths.length - 1 ? 'skeleton-table-action-cell text-right' : ''"
              :style="colIdx === columnWidths.length - 1 ? { width: actionWidth, minWidth: actionWidth, maxWidth: actionWidth } : undefined"
            >
              <div
                class="skeleton-shimmer ui-skeleton h-3.5 rounded"
                :class="[width === 'flex-1' ? 'w-full' : width, colIdx === columnWidths.length - 1 ? 'skeleton-table-action-line' : '']"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.data-table-skeleton-shell {
  border-radius: var(--ui-radius-lg, 0.75rem);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
}

.data-table-skeleton-scroll {
  width: 100%;
  min-width: 0;
  max-height: var(--ui-table-max-height, min(62vh, 44rem));
  overflow: auto;
  overscroll-behavior-inline: contain;
  scrollbar-gutter: auto;
  scrollbar-width: thin;
  background: hsl(var(--card));
}

.data-table-skeleton-table {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.skeleton-table-cell {
  box-sizing: border-box;
  border-bottom: 1px solid hsl(var(--border));
  padding: var(--ui-table-cell-y, 0.75rem) var(--ui-table-cell-x, 1rem);
  min-width: 0;
  overflow: hidden;
}

.skeleton-table-select-cell {
  width: 2.5rem;
  padding-inline: 0.75rem;
  text-align: center;
}

.skeleton-table-head-cell {
  position: sticky;
  top: 0;
  z-index: 2;
  background: hsl(var(--muted) / 0.58);
}

.skeleton-table-action-cell {
  position: sticky;
  right: 0;
  z-index: 1;
  width: var(--data-table-action-width, 7rem);
  min-width: 5rem;
  max-width: var(--data-table-action-width, 7rem);
  overflow: hidden;
  white-space: nowrap;
  background: hsl(var(--card));
  background-clip: padding-box;
  isolation: isolate;
  box-shadow: -1px 0 0 hsl(var(--border)), -0.5rem 0 1rem -0.75rem hsl(var(--foreground) / 0.18);
}

.skeleton-table-head-cell.skeleton-table-action-cell {
  z-index: 3;
  background: hsl(var(--muted) / 0.92);
}

tbody tr:last-child .skeleton-table-cell {
  border-bottom: 0;
}

.skeleton-shimmer {
  display: block;
}

.skeleton-table-action-line {
  width: min(4.5rem, 100%);
  margin-left: auto;
}

@media (max-width: 640px) {
  .skeleton-table-cell {
    padding-inline: 0.75rem;
  }

  .skeleton-table-select-cell {
    padding-inline: 0.625rem;
  }

  .data-table-skeleton-scroll {
    max-height: min(58vh, 34rem);
  }
}
</style>
