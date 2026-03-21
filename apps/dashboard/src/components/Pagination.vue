<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  total: number
  pageSize?: number
  pageSizes?: number[]
  layout?: string
  background?: boolean
  small?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 20,
  pageSizes: () => [10, 20, 50, 100],
  layout: 'total, sizes, prev, pager, next, jumper',
  background: true,
  small: false,
})

const emit = defineEmits<{
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
  'pageChange': [page: number]
  'sizeChange': [size: number]
}>()

// 计算显示的页码列表
const pagerList = computed(() => {
  const pages: (number | string)[] = []
  const total = props.totalPages
  const current = props.currentPage

  if (total <= 7) {
    // 页数少于7页，全部显示
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  }
  else {
    // 始终显示第一页
    pages.push(1)

    if (current <= 3) {
      // 当前页靠前
      for (let i = 2; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    }
    else if (current >= total - 2) {
      // 当前页靠后
      pages.push('...')
      for (let i = total - 4; i <= total; i++) {
        pages.push(i)
      }
    }
    else {
      // 当前页在中间
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    }
  }

  return pages
})

// 布局项
const layoutItems = computed(() => props.layout.split(',').map(item => item.trim()))

function handlePageChange(page: number) {
  if (page < 1 || page > props.totalPages || page === props.currentPage)
    return
  emit('update:currentPage', page)
  emit('pageChange', page)
}

function handleSizeChange(size: number) {
  emit('update:pageSize', size)
  emit('sizeChange', size)
}

const jumperValue = computed({
  get: () => props.currentPage,
  set: (val: number) => {
    const page = Math.max(1, Math.min(val, props.totalPages))
    handlePageChange(page)
  },
})
</script>

<template>
  <div
    class="pagination-wrapper"
    :class="{
      'pagination-small': small,
      'pagination-background': background,
    }"
  >
    <!-- Total -->
    <span v-if="layoutItems.includes('total')" class="pagination-total">
      共 {{ total }} 条
    </span>

    <!-- Sizes -->
    <select
      v-if="layoutItems.includes('sizes')"
      class="pagination-sizes"
      :value="pageSize"
      @change="handleSizeChange(Number(($event.target as HTMLSelectElement).value))"
    >
      <option v-for="size in pageSizes" :key="size" :value="size">
        {{ size }} 条/页
      </option>
    </select>

    <!-- Prev -->
    <button
      v-if="layoutItems.includes('prev')"
      class="pagination-btn"
      :disabled="currentPage === 1"
      @click="handlePageChange(currentPage - 1)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>

    <!-- Pager -->
    <div v-if="layoutItems.includes('pager')" class="pagination-pager">
      <button
        v-for="(page, index) in pagerList"
        :key="index"
        class="pagination-page"
        :class="{ 'is-active': page === currentPage }"
        :disabled="page === '...'"
        @click="typeof page === 'number' && handlePageChange(page)"
      >
        {{ page }}
      </button>
    </div>

    <!-- Next -->
    <button
      v-if="layoutItems.includes('next')"
      class="pagination-btn"
      :disabled="currentPage === totalPages"
      @click="handlePageChange(currentPage + 1)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>

    <!-- Jumper -->
    <div v-if="layoutItems.includes('jumper')" class="pagination-jumper">
      <span>前往</span>
      <input
        v-model.number="jumperValue"
        type="number"
        min="1"
        :max="totalPages"
        @keyup.enter="handlePageChange(jumperValue)"
      >
      <span>页</span>
    </div>
  </div>
</template>

<style scoped>
.pagination-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  justify-content: center;
}

.pagination-small {
  font-size: 0.875rem;
}

.pagination-total {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin-right: 0.5rem;
}

.pagination-sizes {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-base);
  color: var(--color-text-regular);
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.pagination-sizes:hover {
  border-color: var(--color-primary);
}

.pagination-sizes:focus {
  outline: none;
  border-color: var(--color-primary);
}

.pagination-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-base);
  color: var(--color-text-regular);
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-background .pagination-btn {
  background: var(--color-bg-page);
}

.pagination-btn:hover:not(:disabled) {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.pagination-btn:disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
  opacity: 0.5;
}

.pagination-pager {
  display: flex;
  gap: 0.25rem;
}

.pagination-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-base);
  color: var(--color-text-regular);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.pagination-background .pagination-page {
  background: var(--color-bg-page);
  border: none;
}

.pagination-page:hover:not(:disabled):not(.is-active) {
  color: var(--color-primary);
}

.pagination-page.is-active {
  color: var(--color-primary);
  background: var(--color-primary-50);
  border-color: var(--color-primary);
  font-weight: 600;
}

.pagination-background .pagination-page.is-active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.pagination-page:disabled {
  color: var(--color-text-disabled);
  cursor: default;
  background: var(--color-bg-base);
  border-color: var(--color-border-base);
}

.pagination-background .pagination-page:disabled {
  background: var(--color-bg-page);
  border: none;
}

.pagination-jumper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin-left: 0.5rem;
}

.pagination-jumper input {
  width: 50px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  text-align: center;
  font-size: 0.875rem;
  transition: border-color 0.2s;
  background: var(--color-bg-base);
  color: var(--color-text-regular);
}

.pagination-jumper input:hover {
  border-color: var(--color-primary);
}

.pagination-jumper input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.pagination-jumper input::-webkit-inner-spin-button,
.pagination-jumper input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.pagination-jumper input[type='number'] {
  -moz-appearance: textfield;
}
</style>
