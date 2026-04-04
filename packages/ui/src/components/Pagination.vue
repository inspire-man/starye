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
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  }
  else {
    pages.push(1)

    if (current <= 3) {
      for (let i = 2; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    }
    else if (current >= total - 2) {
      pages.push('...')
      for (let i = total - 4; i <= total; i++) {
        pages.push(i)
      }
    }
    else {
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
    class="flex items-center justify-center gap-2 p-4"
    :class="{ 'text-sm': small }"
  >
    <!-- Total -->
    <span v-if="layoutItems.includes('total')" class="mr-2 text-sm text-muted-foreground">
      共 {{ total }} 条
    </span>

    <!-- Sizes -->
    <select
      v-if="layoutItems.includes('sizes')"
      class="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary focus:border-primary focus:outline-none"
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
      class="flex h-8 min-w-8 items-center justify-center rounded border border-border px-2 text-foreground transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="background ? 'bg-muted' : 'bg-background'"
      :disabled="currentPage === 1"
      @click="handlePageChange(currentPage - 1)"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>

    <!-- Pager -->
    <div v-if="layoutItems.includes('pager')" class="flex gap-1">
      <button
        v-for="(page, index) in pagerList"
        :key="index"
        class="flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm transition-all"
        :class="[
          page === currentPage
            ? (background
              ? 'bg-primary font-semibold text-primary-foreground'
              : 'border border-primary bg-primary/10 font-semibold text-primary')
            : (background
              ? 'bg-muted text-foreground hover:text-primary'
              : 'border border-border bg-background text-foreground hover:text-primary'),
          { 'cursor-default': page === '...' },
        ]"
        :disabled="page === '...'"
        @click="typeof page === 'number' && handlePageChange(page)"
      >
        {{ page }}
      </button>
    </div>

    <!-- Next -->
    <button
      v-if="layoutItems.includes('next')"
      class="flex h-8 min-w-8 items-center justify-center rounded border border-border px-2 text-foreground transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="background ? 'bg-muted' : 'bg-background'"
      :disabled="currentPage === totalPages"
      @click="handlePageChange(currentPage + 1)"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>

    <!-- Jumper -->
    <div v-if="layoutItems.includes('jumper')" class="ml-2 flex items-center gap-2 text-sm text-muted-foreground">
      <span>前往</span>
      <input
        v-model.number="jumperValue"
        type="number"
        min="1"
        :max="totalPages"
        class="w-[50px] rounded border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground transition-colors [appearance:textfield] hover:border-primary focus:border-primary focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @keyup.enter="handlePageChange(jumperValue)"
      >
      <span>页</span>
    </div>
  </div>
</template>
