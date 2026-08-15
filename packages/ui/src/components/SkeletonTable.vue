<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  rows?: number
  columns?: number
  widths?: string[]
  selectable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rows: 5,
  columns: 4,
  widths: () => [],
  selectable: false,
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
    <div class="data-table-scroll">
      <table class="data-table-skeleton-table w-full">
        <thead>
          <tr>
            <th v-if="selectable" class="skeleton-table-cell skeleton-table-select-cell skeleton-table-head-cell">
              <div class="skeleton-shimmer ui-skeleton h-4 w-4 rounded" />
            </th>
            <th
              v-for="(width, idx) in columnWidths"
              :key="idx"
              class="skeleton-table-cell skeleton-table-head-cell text-left"
            >
              <div
                class="skeleton-shimmer ui-skeleton h-3.5 rounded"
                :class="width === 'flex-1' ? 'w-full' : width"
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
            >
              <div
                class="skeleton-shimmer ui-skeleton h-3.5 rounded"
                :class="width === 'flex-1' ? 'w-full' : width"
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

.data-table-scroll {
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-gutter: stable;
}

.data-table-skeleton-table {
  border-collapse: separate;
  border-spacing: 0;
}

.skeleton-table-cell {
  border-bottom: 1px solid hsl(var(--border));
  padding: var(--ui-table-cell-y, 0.75rem) var(--ui-table-cell-x, 1rem);
}

.skeleton-table-select-cell {
  width: 2.5rem;
  padding-inline: 0.75rem;
  text-align: center;
}

.skeleton-table-head-cell {
  background: hsl(var(--muted) / 0.58);
}

tbody tr:last-child .skeleton-table-cell {
  border-bottom: 0;
}

.skeleton-shimmer {
  display: block;
}

@media (max-width: 640px) {
  .skeleton-table-cell {
    padding-inline: 0.75rem;
  }

  .skeleton-table-select-cell {
    padding-inline: 0.625rem;
  }
}
</style>
