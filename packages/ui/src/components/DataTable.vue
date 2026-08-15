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
  <div class="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/[0.03]">
    <div v-if="loading" class="flex min-h-56 flex-col items-center justify-center p-12 text-muted-foreground">
      <div class="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
      <p class="mt-3">
        加载中...
      </p>
    </div>

    <div v-else-if="data.length === 0" class="flex min-h-56 flex-col items-center justify-center p-12 text-muted-foreground">
      <p>{{ emptyMessage }}</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full bg-card" :style="{ minWidth }">
        <thead class="bg-muted/40">
          <tr>
            <th v-if="selectable" class="w-10 border-b border-border px-3 py-3.5 text-center">
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
              class="border-b border-border px-4 py-3.5 text-left text-xs font-semibold tracking-wide text-muted-foreground"
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
            class="cursor-pointer transition-colors hover:bg-muted/40"
            @click="handleRowClick(item)"
          >
            <td v-if="selectable" class="w-10 border-b border-border px-3 py-3.5 text-center" @click.stop>
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
              class="border-b border-border px-4 py-3.5 text-sm align-middle"
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
