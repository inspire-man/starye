<script setup lang="ts" generic="T extends { id: string }">
import type { Column } from '../types/datatable'
import { computed } from 'vue'

interface Props {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  emptyMessage?: string
  /** 表格最小宽度，默认 800px */
  minWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectable: false,
  selectedIds: () => new Set(),
  emptyMessage: '暂无数据',
  minWidth: '800px',
})

const emit = defineEmits<{
  toggleSelect: [id: string]
  toggleSelectAll: []
  sort: [key: string]
  rowClick: [item: T]
}>()

const allSelected = computed(() => {
  return props.data.length > 0 && props.data.every(item => props.selectedIds.has(item.id))
})

const skeletonRowCount = computed(() => Math.max(props.data.length, 6))

function handleSelectAll() {
  emit('toggleSelectAll')
}

function handleSelect(id: string) {
  emit('toggleSelect', id)
}

function handleSort(key: string) {
  emit('sort', key)
}

function handleRowClick(item: T) {
  emit('rowClick', item)
}

function getCellValue(item: T, column: Column<T>): string {
  if (column.render) {
    return column.render(item)
  }
  return String((item as any)[column.key] ?? '')
}

function isActionColumn(column: Column<T>): boolean {
  return column.key === 'actions' || column.label === '操作'
}
</script>

<template>
  <div class="data-table-shell w-full overflow-hidden border border-border bg-card" :aria-busy="loading">
    <div v-if="loading" class="data-table-loading data-table-scroll" aria-live="polite" aria-label="加载中">
      <table class="data-table w-full" :style="{ minWidth }">
        <thead>
          <tr>
            <th v-if="selectable" class="data-table-cell data-table-select-cell data-table-head-cell">
              <div class="ui-skeleton data-table-skeleton-line data-table-skeleton-line--checkbox" />
            </th>
            <th
              v-for="(column, columnIndex) in columns"
              :key="column.key"
              :style="{ width: column.width, minWidth: column.minWidth }"
              class="data-table-cell data-table-head-cell"
              :class="isActionColumn(column) ? 'text-right' : ''"
            >
              <div
                class="ui-skeleton data-table-skeleton-line"
                :class="isActionColumn(column) ? 'data-table-skeleton-line--action' : columnIndex === 0 ? 'data-table-skeleton-line--title' : 'data-table-skeleton-line--header'"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rowIndex in skeletonRowCount" :key="rowIndex">
            <td v-if="selectable" class="data-table-cell data-table-select-cell">
              <div class="ui-skeleton data-table-skeleton-line data-table-skeleton-line--checkbox" />
            </td>
            <td
              v-for="(column, columnIndex) in columns"
              :key="column.key"
              :style="{ width: column.width, minWidth: column.minWidth }"
              class="data-table-cell data-table-body-cell"
              :class="isActionColumn(column) ? 'text-right' : ''"
            >
              <div
                class="ui-skeleton data-table-skeleton-line"
                :class="isActionColumn(column) ? 'data-table-skeleton-line--action' : columnIndex === 0 ? 'data-table-skeleton-line--title' : 'data-table-skeleton-line--body'"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="data.length === 0" class="flex min-h-56 flex-col items-center justify-center p-12 text-muted-foreground">
      <p>{{ emptyMessage }}</p>
    </div>

    <div v-else class="data-table-scroll">
      <table class="data-table w-full bg-card" :style="{ minWidth }">
        <thead>
          <tr>
            <th v-if="selectable" class="data-table-cell data-table-select-cell data-table-head-cell">
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                :checked="allSelected"
                @change="handleSelectAll"
              >
            </th>
            <th
              v-for="column in columns"
              :key="column.key"
              :style="{ width: column.width, minWidth: column.minWidth }"
              class="data-table-cell data-table-head-cell text-left"
              :class="[
                { 'cursor-pointer select-none hover:bg-muted': column.sortable },
                isActionColumn(column) ? 'text-right' : '',
              ]"
              @click="column.sortable && handleSort(column.key)"
            >
              <span>{{ column.label }}</span>
              <span v-if="column.sortable" class="ml-1 opacity-50">↕</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in data"
            :key="item.id"
            class="data-table-row cursor-pointer transition-colors"
            @click="handleRowClick(item)"
          >
            <td v-if="selectable" class="data-table-cell data-table-select-cell data-table-body-cell" @click.stop>
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                :checked="selectedIds.has(item.id)"
                @change="handleSelect(item.id)"
              >
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              :style="{ width: column.width, minWidth: column.minWidth }"
              class="data-table-cell data-table-body-cell"
              :class="isActionColumn(column) ? 'text-right' : ''"
            >
              <slot :name="`cell-${column.key}`" :item="item" :value="getCellValue(item, column)">
                {{ getCellValue(item, column) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.data-table-shell {
  border-radius: var(--ui-radius-lg, 0.75rem);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
}

.data-table-scroll {
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-gutter: stable;
}

.data-table {
  border-collapse: separate;
  border-spacing: 0;
}

.data-table-cell {
  border-bottom: 1px solid hsl(var(--border));
  padding: var(--ui-table-cell-y, 0.75rem) var(--ui-table-cell-x, 1rem);
}

.data-table-select-cell {
  width: 2.5rem;
  padding-inline: 0.75rem;
  text-align: center;
}

.data-table-head-cell {
  background: hsl(var(--muted) / 0.58);
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
  letter-spacing: 0.025em;
  white-space: nowrap;
}

.data-table-body-cell {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  line-height: 1.25rem;
  vertical-align: middle;
}

.data-table-row:hover {
  background: hsl(var(--accent) / 0.52);
}

.data-table tbody tr:last-child .data-table-cell {
  border-bottom: 0;
}

.data-table-loading {
  min-height: 22rem;
}

.data-table-skeleton-line {
  height: 0.875rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.data-table-skeleton-line--checkbox {
  width: 1rem;
  height: 1rem;
  margin-inline: auto;
  border-radius: 0.25rem;
}

.data-table-skeleton-line--title {
  width: min(72%, 14rem);
}

.data-table-skeleton-line--header {
  width: 58%;
}

.data-table-skeleton-line--body {
  width: 74%;
}

.data-table-skeleton-line--action {
  width: 4.5rem;
  margin-left: auto;
}

@media (max-width: 640px) {
  .data-table-cell {
    padding-inline: 0.75rem;
  }

  .data-table-select-cell {
    padding-inline: 0.625rem;
  }
}
</style>

