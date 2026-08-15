<script setup lang="ts">
import { ArrowLeft, ChevronRight, Home } from 'lucide-vue-next'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface Props {
  items: BreadcrumbItem[]
  showBack?: boolean
}

withDefaults(defineProps<Props>(), {
  showBack: true,
})

const emit = defineEmits<{
  navigate: [to: string]
  back: []
}>()

function navigate(item: BreadcrumbItem): void {
  if (item.to)
    emit('navigate', item.to)
}
</script>

<template>
  <nav class="ui-breadcrumbs" aria-label="当前位置">
    <button
      v-if="showBack && items.length > 1"
      class="ui-breadcrumb-back"
      type="button"
      title="返回上一级"
      aria-label="返回上一级"
      @click="emit('back')"
    >
      <ArrowLeft :size="15" aria-hidden="true" />
    </button>

    <ol class="ui-breadcrumb-list">
      <li v-for="(item, index) in items" :key="`${item.label}-${index}`" class="ui-breadcrumb-item">
        <button
          v-if="item.to && index < items.length - 1"
          class="ui-breadcrumb-link"
          type="button"
          @click="navigate(item)"
        >
          <Home v-if="index === 0" :size="14" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
        <span v-else class="ui-breadcrumb-current" :aria-current="index === items.length - 1 ? 'page' : undefined">
          {{ item.label }}
        </span>
        <ChevronRight v-if="index < items.length - 1" class="ui-breadcrumb-separator" :size="14" aria-hidden="true" />
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.ui-breadcrumbs {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.375rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  line-height: 1rem;
}

.ui-breadcrumb-back {
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-sm, 0.375rem);
  background: hsl(var(--card));
  color: hsl(var(--muted-foreground));
  transition: border-color 150ms ease, color 150ms ease, background-color 150ms ease;
}

.ui-breadcrumb-back:hover,
.ui-breadcrumb-back:focus-visible {
  border-color: hsl(var(--primary) / 0.45);
  background: hsl(var(--accent));
  color: hsl(var(--primary));
  outline: none;
}

.ui-breadcrumb-list {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ui-breadcrumb-item {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
}

.ui-breadcrumb-link,
.ui-breadcrumb-current {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  overflow: hidden;
  border: 0;
  border-radius: var(--ui-radius-sm, 0.375rem);
  padding: 0.2rem 0.3rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-breadcrumb-link {
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}

.ui-breadcrumb-link:hover,
.ui-breadcrumb-link:focus-visible {
  background: hsl(var(--accent));
  color: hsl(var(--primary));
  outline: none;
}

.ui-breadcrumb-current {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.ui-breadcrumb-separator {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground) / 0.6);
}
</style>
