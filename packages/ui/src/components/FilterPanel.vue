<script setup lang="ts">
import type { FilterField } from '../types/filterpanel'
import { computed, ref } from 'vue'

interface Props {
  fields: FilterField[]
  modelValue: Record<string, any>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
  'apply': []
  'reset': []
}>()

/** 移动端折叠状态 */
const isExpanded = ref(false)

/** 已激活的筛选项数量（有非空值的字段） */
const activeCount = computed(() => {
  return props.fields.filter((f) => {
    if (f.type === 'dateRange') {
      return props.modelValue[`${f.key}From`] || props.modelValue[`${f.key}To`]
    }
    const val = props.modelValue[f.key]
    return Array.isArray(val) ? val.length > 0 : Boolean(val)
  }).length
})

function updateField(key: string, value: any) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
  })
}

function handleApply() {
  emit('apply')
}

function handleReset() {
  emit('reset')
}
</script>

<template>
  <div class="mb-6 rounded-lg bg-background shadow-sm ring-1 ring-border">
    <!-- 移动端折叠头部（md 以上隐藏） -->
    <button
      type="button"
      class="flex w-full items-center justify-between px-4 py-3 md:hidden"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-2">
        <svg
          class="h-4 w-4 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <span class="text-sm font-medium text-foreground">筛选</span>
        <span
          v-if="activeCount > 0"
          class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
        >
          {{ activeCount }}
        </span>
      </div>
      <svg
        class="h-4 w-4 text-muted-foreground transition-transform duration-200"
        :class="isExpanded ? 'rotate-180' : ''"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- 筛选内容区：移动端折叠控制，桌面端始终展开 -->
    <div
      class="p-4 md:p-6"
      :class="isExpanded ? 'block' : 'hidden md:block'"
    >
      <!-- 筛选字段网格：移动端 1 列，桌面端固定 3 列 -->
      <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          v-for="field in fields"
          :key="field.key"
          class="flex flex-col gap-1.5"
          :class="{
            'md:col-span-2': field.colSpan === 2,
            'md:col-span-3': field.colSpan === 3,
          }"
        >
          <label class="text-sm font-medium text-foreground">{{ field.label }}</label>

          <input
            v-if="field.type === 'text'"
            type="text"
            :value="modelValue[field.key] || ''"
            :placeholder="field.placeholder"
            class="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
          >

          <select
            v-else-if="field.type === 'select'"
            :value="modelValue[field.key] || ''"
            class="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            @change="updateField(field.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              全部
            </option>
            <option
              v-for="opt in field.options"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>

          <div v-else-if="field.type === 'checkbox'" class="flex flex-wrap gap-3">
            <label
              v-for="opt in field.options"
              :key="opt.value"
              class="flex cursor-pointer select-none items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                :checked="(modelValue[field.key] || []).includes(opt.value)"
                @change="(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  const current = modelValue[field.key] || []
                  const updated = checked
                    ? [...current, opt.value]
                    : current.filter((v: string) => v !== opt.value)
                  updateField(field.key, updated)
                }"
              >
              {{ opt.label }}
            </label>
          </div>

          <!-- dateRange 字段占 2 列（在 md 网格中用 col-span-2） -->
          <div
            v-else-if="field.type === 'dateRange'"
            class="flex items-center gap-2"
          >
            <input
              type="date"
              :value="modelValue[`${field.key}From`] || ''"
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              @input="updateField(`${field.key}From`, ($event.target as HTMLInputElement).value)"
            >
            <span class="shrink-0 text-sm text-muted-foreground">至</span>
            <input
              type="date"
              :value="modelValue[`${field.key}To`] || ''"
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              @input="updateField(`${field.key}To`, ($event.target as HTMLInputElement).value)"
            >
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          class="cursor-pointer rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          @click="handleReset"
        >
          重置
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          @click="handleApply"
        >
          应用筛选
        </button>
      </div>
    </div>
  </div>
</template>
