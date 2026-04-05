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

/** 已激活的筛选项数量 */
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
  <div class="filter-panel">
    <!-- 移动端折叠头部 -->
    <button
      type="button"
      class="filter-mobile-toggle"
      @click="isExpanded = !isExpanded"
    >
      <div class="filter-mobile-title">
        <svg class="filter-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <span>筛选</span>
        <span v-if="activeCount > 0" class="filter-badge">{{ activeCount }}</span>
      </div>
      <svg
        class="filter-chevron"
        :class="isExpanded ? 'rotated' : ''"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- 筛选内容区 -->
    <div class="filter-body" :class="{ expanded: isExpanded }">
      <div class="filter-grid">
        <div
          v-for="field in fields"
          :key="field.key"
          class="filter-field"
          :class="{
            'col-span-2': field.colSpan === 2,
            'col-span-3': field.colSpan === 3,
          }"
        >
          <label class="filter-label">{{ field.label }}</label>

          <input
            v-if="field.type === 'text'"
            type="text"
            :value="modelValue[field.key] || ''"
            :placeholder="field.placeholder"
            class="filter-input"
            @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
          >

          <select
            v-else-if="field.type === 'select'"
            :value="modelValue[field.key] || ''"
            class="filter-input"
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

          <div v-else-if="field.type === 'checkbox'" class="filter-checkboxes">
            <label
              v-for="opt in field.options"
              :key="opt.value"
              class="filter-checkbox-label"
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

          <div v-else-if="field.type === 'dateRange'" class="filter-date-range">
            <input
              type="date"
              :value="modelValue[`${field.key}From`] || ''"
              class="filter-input"
              @input="updateField(`${field.key}From`, ($event.target as HTMLInputElement).value)"
            >
            <span class="filter-date-sep">至</span>
            <input
              type="date"
              :value="modelValue[`${field.key}To`] || ''"
              class="filter-input"
              @input="updateField(`${field.key}To`, ($event.target as HTMLInputElement).value)"
            >
          </div>
        </div>
      </div>

      <div class="filter-actions">
        <button type="button" class="filter-btn-reset" @click="handleReset">
          重置
        </button>
        <button type="button" class="filter-btn-apply" @click="handleApply">
          应用筛选
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-panel {
  margin-bottom: 1.5rem;
  border-radius: 0.5rem;
  background-color: hsl(var(--background));
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  outline: 1px solid hsl(var(--border));
}

/* 移动端折叠按钮：默认显示，桌面端隐藏 */
.filter-mobile-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  cursor: pointer;
}

.filter-mobile-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-icon {
  width: 1rem;
  height: 1rem;
  color: hsl(var(--muted-foreground));
}

.filter-mobile-title span {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.filter-badge {
  display: inline-flex;
  height: 1.25rem;
  min-width: 1.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: hsl(var(--primary));
  padding: 0 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--primary-foreground));
}

.filter-chevron {
  width: 1rem;
  height: 1rem;
  color: hsl(var(--muted-foreground));
  transition: transform 0.2s;
}

.filter-chevron.rotated {
  transform: rotate(180deg);
}

/* 内容区：移动端默认收起，展开时显示 */
.filter-body {
  display: none;
  padding: 1rem;
}

.filter-body.expanded {
  display: block;
}

/* 筛选网格：移动端 1 列 */
.filter-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.filter-input {
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--background));
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: hsl(var(--foreground));
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
}

.filter-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.1);
}

.filter-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
}

.filter-date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-date-range .filter-input {
  flex: 1;
}

.filter-date-sep {
  flex-shrink: 0;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 1rem;
}

.filter-btn-reset {
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--background));
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: background-color 0.15s;
}

.filter-btn-reset:hover {
  background-color: hsl(var(--muted));
}

.filter-btn-apply {
  border-radius: 0.375rem;
  background-color: hsl(var(--primary));
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  transition: background-color 0.15s;
}

.filter-btn-apply:hover {
  background-color: hsl(var(--primary) / 0.9);
}

/* 桌面端（≥768px）：切换为始终展开的 3 列布局 */
@media (min-width: 768px) {
  .filter-mobile-toggle {
    display: none;
  }

  .filter-body {
    display: block;
    padding: 1.5rem;
  }

  .filter-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .col-span-2 {
    grid-column: span 2;
  }

  .col-span-3 {
    grid-column: span 3;
  }
}
</style>
