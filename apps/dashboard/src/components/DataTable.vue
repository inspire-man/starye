<script setup lang="ts" generic="T extends { id: string }">
/**
 * 通用数据表格组件
 *
 * 功能：
 * - 多选支持
 * - 排序
 * - 分页
 * - 加载状态
 * - 空状态
 */

import { computed } from 'vue'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render?: (item: T) => string
  width?: string
  minWidth?: string
}

interface Props {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  emptyMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectable: false,
  selectedIds: () => new Set(),
  emptyMessage: '暂无数据',
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
</script>

<template>
  <div class="data-table">
    <div v-if="loading" class="loading-state">
      <div class="spinner" />
      <p>加载中...</p>
    </div>

    <div v-else-if="data.length === 0" class="empty-state">
      <p>{{ emptyMessage }}</p>
    </div>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th v-if="selectable" class="checkbox-cell">
              <input
                type="checkbox"
                :checked="allSelected"
                @change="handleSelectAll"
              >
            </th>
            <th
              v-for="column in columns"
              :key="column.key"
              :style="{ width: column.width, minWidth: column.minWidth }"
              :class="{ sortable: column.sortable }"
              @click="column.sortable && handleSort(column.key)"
            >
              {{ column.label }}
              <span v-if="column.sortable" class="sort-icon">↕</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in data"
            :key="item.id"
            @click="handleRowClick(item)"
          >
            <td v-if="selectable" class="checkbox-cell" @click.stop>
              <input
                type="checkbox"
                :checked="selectedIds.has(item.id)"
                @change="handleSelect(item.id)"
              >
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              :style="{ width: column.width, minWidth: column.minWidth }"
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
.data-table {
  width: 100%;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #6b7280;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 800px;
  border-collapse: collapse;
  background: white;
  border-radius: 0.5rem;
  overflow: hidden;
}

thead {
  background: #f9fafb;
}

th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

th.sortable {
  cursor: pointer;
  user-select: none;
}

th.sortable:hover {
  background: #f3f4f6;
}

.sort-icon {
  margin-left: 0.25rem;
  opacity: 0.5;
}

.checkbox-cell {
  width: 40px;
  text-align: center;
}

td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
}

tr {
  cursor: pointer;
  transition: background-color 0.15s;
}

tbody tr:hover {
  background: #f9fafb;
}
</style>
