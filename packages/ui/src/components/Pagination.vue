<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  total: number
  pageSize?: number
  pageSizes?: number[]
  layout?: string
  background?: boolean
  small?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 20,
  pageSizes: () => [10, 20, 50, 100],
  layout: 'total, sizes, prev, pager, next, jumper',
  background: true,
  small: false,
  loading: false,
})

const emit = defineEmits<{
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
  'pageChange': [page: number]
  'sizeChange': [size: number]
}>()

const safeTotalPages = computed(() => Math.max(1, props.totalPages))

// 计算显示的页码列表
const pagerList = computed(() => {
  const pages: (number | string)[] = []
  const total = safeTotalPages.value
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
const jumpPage = ref(props.currentPage)

watch(() => props.currentPage, (page) => {
  jumpPage.value = page
})

function handlePageChange(page: number) {
  if (page < 1 || page > safeTotalPages.value || page === props.currentPage)
    return
  emit('update:currentPage', page)
  emit('pageChange', page)
}

function handleSizeChange(size: number) {
  if (size === props.pageSize)
    return
  emit('update:pageSize', size)
  emit('sizeChange', size)
  if (props.currentPage !== 1) {
    emit('update:currentPage', 1)
    emit('pageChange', 1)
  }
}

const jumperValue = computed({
  get: () => jumpPage.value,
  set: (val: number) => { jumpPage.value = val },
})

function handleJump(): void {
  const page = Math.max(1, Math.min(Number(jumpPage.value) || 1, safeTotalPages.value))
  jumpPage.value = page
  handlePageChange(page)
}
</script>

<template>
  <nav
    v-if="loading || total > 0 || totalPages > 1"
    class="pagination-nav"
    :class="{ 'text-sm': small }"
    :aria-busy="loading"
    aria-label="分页"
  >
    <div v-if="loading" class="pagination-skeleton" aria-hidden="true">
      <div class="ui-skeleton pagination-skeleton-total" />
      <div class="ui-skeleton pagination-skeleton-size" />
      <div class="pagination-skeleton-pages">
        <div v-for="page in 4" :key="page" class="ui-skeleton pagination-skeleton-page" />
      </div>
    </div>

    <template v-else>
      <!-- Total -->
      <div class="flex min-h-8 items-center gap-2 text-sm text-muted-foreground">
        <span v-if="layoutItems.includes('total')">
          共 <strong class="font-semibold text-foreground">{{ total }}</strong> 条
        </span>

        <!-- Sizes -->
        <select
          v-if="layoutItems.includes('sizes')"
          class="h-8 cursor-pointer rounded-md border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          :value="pageSize"
          aria-label="每页条数"
          @change="handleSizeChange(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in pageSizes" :key="size" :value="size">
            {{ size }} 条/页
          </option>
        </select>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-1.5">
        <!-- Prev -->
        <button
          v-if="layoutItems.includes('prev')"
          type="button"
          class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border px-2 text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          :class="background ? 'bg-muted/40' : 'bg-background'"
          :disabled="currentPage === 1"
          aria-label="上一页"
          @click="handlePageChange(currentPage - 1)"
        >
          <ChevronLeft :size="16" aria-hidden="true" />
        </button>

        <!-- Pager -->
        <div v-if="layoutItems.includes('pager')" class="flex gap-1">
          <button
            v-for="(page, index) in pagerList"
            :key="index"
            type="button"
            class="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors"
            :class="[
              page === currentPage
                ? (background
                  ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                  : 'border border-primary bg-primary/10 font-semibold text-primary')
                : (background
                  ? 'bg-muted/40 text-foreground hover:bg-primary/10 hover:text-primary'
                  : 'border border-border bg-background text-foreground hover:border-primary hover:text-primary'),
              page === '...' ? 'cursor-default' : 'cursor-pointer',
            ]"
            :disabled="page === '...'"
            :aria-current="page === currentPage ? 'page' : undefined"
            @click="typeof page === 'number' && handlePageChange(page)"
          >
            {{ page }}
          </button>
        </div>

        <!-- Next -->
        <button
          v-if="layoutItems.includes('next')"
          type="button"
          class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border px-2 text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          :class="background ? 'bg-muted/40' : 'bg-background'"
          :disabled="currentPage === safeTotalPages"
          aria-label="下一页"
          @click="handlePageChange(currentPage + 1)"
        >
          <ChevronRight :size="16" aria-hidden="true" />
        </button>

        <!-- Jumper -->
        <label v-if="layoutItems.includes('jumper')" class="ml-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span>前往</span>
          <input
            v-model.number="jumperValue"
            type="number"
            min="1"
            :max="safeTotalPages"
            class="h-8 w-14 rounded-md border border-border bg-background px-2 text-center text-sm text-foreground transition-colors [appearance:textfield] hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="跳转页码"
            @keyup.enter="handleJump"
          >
          <span>页</span>
        </label>
      </div>
    </template>
  </nav>
</template>

<style scoped>
.pagination-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.625rem;
  border-top: 1px solid hsl(var(--border));
  padding: 0.625rem 0.125rem 0;
}

.pagination-nav :is(button, select, input) {
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.pagination-skeleton {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.pagination-skeleton-total {
  width: 5rem;
  height: 0.875rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.pagination-skeleton-size {
  width: 5.5rem;
  height: var(--ui-control-height-sm, 2rem);
  margin-right: auto;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.pagination-skeleton-pages {
  display: flex;
  gap: 0.25rem;
}

.pagination-skeleton-page {
  width: var(--ui-control-height-sm, 2rem);
  height: var(--ui-control-height-sm, 2rem);
  border-radius: var(--ui-radius-sm, 0.375rem);
}

@media (max-width: 640px) {
  .pagination-nav {
    align-items: stretch;
  }

  .pagination-nav > :not(.pagination-skeleton) {
    width: 100%;
    justify-content: flex-start;
  }

  .pagination-nav .pagination-skeleton {
    flex-wrap: wrap;
  }
}
</style>
