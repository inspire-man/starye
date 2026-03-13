<script setup lang="ts">
/**
 * 筛选器面板组件
 *
 * 支持：
 * - 文本输入
 * - 下拉选择
 * - 多选框
 * - 日期范围选择器
 */

export interface FilterField {
  key: string
  label: string
  type: 'text' | 'select' | 'checkbox' | 'dateRange'
  options?: Array<{ value: string, label: string }>
  placeholder?: string
}

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
    <div class="filters-grid">
      <div
        v-for="field in fields"
        :key="field.key"
        class="filter-field"
      >
        <label>{{ field.label }}</label>

        <input
          v-if="field.type === 'text'"
          type="text"
          :value="modelValue[field.key] || ''"
          :placeholder="field.placeholder"
          @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
        >

        <select
          v-else-if="field.type === 'select'"
          :value="modelValue[field.key] || ''"
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

        <div v-else-if="field.type === 'checkbox'" class="checkbox-group">
          <label
            v-for="opt in field.options"
            :key="opt.value"
            class="checkbox-label"
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

        <div v-else-if="field.type === 'dateRange'" class="date-range">
          <input
            type="date"
            :value="modelValue[`${field.key}From`] || ''"
            @input="updateField(`${field.key}From`, ($event.target as HTMLInputElement).value)"
          >
          <span>至</span>
          <input
            type="date"
            :value="modelValue[`${field.key}To`] || ''"
            @input="updateField(`${field.key}To`, ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>
    </div>

    <div class="filter-actions">
      <button class="btn-secondary" @click="handleReset">
        重置
      </button>
      <button class="btn-primary" @click="handleApply">
        应用筛选
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-panel {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.filter-field input[type="text"],
.filter-field input[type="date"],
.filter-field select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.filter-field input:focus,
.filter-field select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-range span {
  font-size: 0.875rem;
  color: #6b7280;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.btn-primary,
.btn-secondary {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}
</style>
