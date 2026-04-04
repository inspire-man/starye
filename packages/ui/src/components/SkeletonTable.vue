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
  <div class="overflow-hidden rounded-lg border border-border">
    <table class="w-full">
      <thead class="border-b border-border bg-muted/50">
        <tr>
          <th v-if="selectable" class="w-12 p-3">
            <div class="skeleton-shimmer h-4 w-4 rounded" />
          </th>
          <th
            v-for="(width, idx) in columnWidths"
            :key="idx"
            class="p-3 text-left"
          >
            <div
              class="skeleton-shimmer h-4 rounded"
              :class="width === 'flex-1' ? 'w-full' : width"
            />
          </th>
        </tr>
      </thead>

      <tbody class="divide-y divide-border">
        <tr v-for="(_, rowIdx) in rowArray" :key="rowIdx">
          <td v-if="selectable" class="p-3">
            <div class="skeleton-shimmer h-4 w-4 rounded" />
          </td>
          <td
            v-for="(width, colIdx) in columnWidths"
            :key="colIdx"
            class="p-3"
          >
            <div
              class="skeleton-shimmer h-4 rounded"
              :class="width === 'flex-1' ? 'w-full' : width"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.skeleton-shimmer {
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
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
}
</style>
