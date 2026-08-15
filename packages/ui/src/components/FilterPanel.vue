<script setup lang="ts">
import type { FilterField } from '../types/filterpanel'
import { computed, ref, watch } from 'vue'

interface Props {
  fields: FilterField[]
  modelValue: Record<string, any>
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
  'apply': []
  'reset': []
}>()

/** 移动端折叠状态 */
const isExpanded = ref(false)
/** 桌面端高级筛选状态：前三项作为常用筛选，其余默认收起 */
const showAdvanced = ref(false)

const primaryFields = computed(() => props.fields.slice(0, 3))
const advancedFields = computed(() => props.fields.slice(3))
const hasAdvancedFields = computed(() => advancedFields.value.length > 0)
const activeAdvancedCount = computed(() => advancedFields.value.filter((field) => {
  if (field.type === 'dateRange')
    return props.modelValue[`${field.key}From`] || props.modelValue[`${field.key}To`]
  const value = props.modelValue[field.key]
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}).length)

watch(activeAdvancedCount, (count) => {
  if (count > 0)
    showAdvanced.value = true
}, { immediate: true })

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

function toggleAdvanced() {
  showAdvanced.value = !showAdvanced.value
}
</script>

<template>
  <div class="filter-panel">
    <div v-if="loading" class="filter-panel-skeleton" role="status" aria-label="筛选条件加载中">
      <div class="filter-skeleton-grid">
        <div v-for="field in fields.slice(0, 3)" :key="field.key" class="filter-skeleton-field">
          <div class="ui-skeleton filter-skeleton-label" />
          <div class="ui-skeleton filter-skeleton-input" />
        </div>
      </div>
      <div v-if="hasAdvancedFields" class="filter-skeleton-advanced">
        <div class="ui-skeleton filter-skeleton-advanced-label" />
        <div class="ui-skeleton filter-skeleton-advanced-icon" />
      </div>
      <div class="filter-skeleton-actions">
        <div class="ui-skeleton filter-skeleton-button filter-skeleton-button-secondary" />
        <div class="ui-skeleton filter-skeleton-button filter-skeleton-button-primary" />
      </div>
    </div>

    <template v-else>
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
            v-for="field in primaryFields"
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

        <button
          v-if="hasAdvancedFields"
          type="button"
          class="advanced-toggle"
          :aria-expanded="showAdvanced"
          @click="toggleAdvanced"
        >
          <span class="advanced-toggle-label">
            <span>高级筛选</span>
            <span class="advanced-count">{{ advancedFields.length }} 项</span>
          </span>
          <svg
            class="advanced-chevron"
            :class="{ rotated: showAdvanced }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <Transition name="filter-advanced">
          <div v-if="hasAdvancedFields && showAdvanced" class="filter-advanced">
            <div class="filter-grid">
              <div
                v-for="field in advancedFields"
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
          </div>
        </Transition>

        <div class="filter-actions">
          <button type="button" class="filter-btn-reset" @click="handleReset">
            重置
          </button>
          <button type="button" class="filter-btn-apply" @click="handleApply">
            应用筛选
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.filter-panel {
  margin-bottom: 1rem;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-lg, 0.75rem);
  background-color: hsl(var(--card));
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
}

.filter-panel-skeleton {
  padding: 1rem 1.25rem;
}

.filter-skeleton-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.filter-skeleton-field {
  display: grid;
  gap: 0.5rem;
}

.filter-skeleton-label {
  width: 5rem;
  height: 0.875rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.filter-skeleton-input {
  width: 100%;
  height: 2.25rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.filter-skeleton-advanced {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md, 0.5rem);
  padding: 0.625rem 0.75rem;
}

.filter-skeleton-advanced-label {
  width: 7rem;
  height: 0.875rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.filter-skeleton-advanced-icon {
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
}

.filter-skeleton-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 1rem;
}

.filter-skeleton-button {
  height: 2.25rem;
  border-radius: var(--ui-radius-sm, 0.375rem);
}

.filter-skeleton-button-secondary {
  width: 4.5rem;
}

.filter-skeleton-button-primary {
  width: 6.5rem;
}

/* 移动端折叠按钮：默认显示，桌面端隐藏 */
.filter-mobile-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  min-height: 3rem;
  border: 0;
  background: transparent;
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
  padding: 1rem 1.25rem;
}

.filter-body.expanded {
  display: block;
}

/* 筛选网格：移动端 1 列 */
.filter-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.filter-input {
  min-height: var(--ui-control-height-md, 2.25rem);
  border-radius: var(--ui-radius-sm, 0.375rem);
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--background) / 0.8);
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
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
}

.advanced-toggle {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0.75rem 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md, 0.5rem);
  background: hsl(var(--muted) / 0.45);
  padding: 0.5rem 0.75rem;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.advanced-toggle:hover {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--muted));
}

.advanced-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.advanced-count {
  border-radius: 9999px;
  background: hsl(var(--background));
  padding: 0.125rem 0.45rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
  font-weight: 500;
}

.advanced-chevron {
  width: 1rem;
  height: 1rem;
  color: hsl(var(--muted-foreground));
  transition: transform 180ms ease;
}

.advanced-chevron.rotated {
  transform: rotate(180deg);
}

.filter-advanced-enter-active,
.filter-advanced-leave-active {
  overflow: hidden;
  transition: max-height 180ms ease, opacity 180ms ease;
}

.filter-advanced-enter-from,
.filter-advanced-leave-to {
  max-height: 0;
  opacity: 0;
}

.filter-advanced-enter-to,
.filter-advanced-leave-from {
  max-height: 30rem;
  opacity: 1;
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
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  border-top: 1px solid hsl(var(--border));
  margin-top: 1rem;
  padding-top: 1rem;
}

.filter-btn-reset {
  min-height: var(--ui-control-height-md, 2.25rem);
  border-radius: var(--ui-radius-sm, 0.375rem);
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
  min-height: var(--ui-control-height-md, 2.25rem);
  border: 1px solid hsl(var(--primary));
  border-radius: var(--ui-radius-sm, 0.375rem);
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
    padding: 1rem 1.25rem;
  }

  .filter-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .filter-skeleton-grid {
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
