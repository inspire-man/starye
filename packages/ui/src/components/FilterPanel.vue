<script setup lang="ts">
import type { FilterField } from '../types/filterpanel'

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
  <div class="mb-6 rounded-lg bg-background p-6 shadow-sm ring-1 ring-border">
    <div class="mb-4 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
      <div
        v-for="field in fields"
        :key="field.key"
        class="flex flex-col gap-2"
      >
        <label class="text-sm font-medium text-foreground">{{ field.label }}</label>

        <input
          v-if="field.type === 'text'"
          type="text"
          :value="modelValue[field.key] || ''"
          :placeholder="field.placeholder"
          class="rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          @input="updateField(field.key, ($event.target as HTMLInputElement).value)"
        >

        <select
          v-else-if="field.type === 'select'"
          :value="modelValue[field.key] || ''"
          class="rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
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
            class="flex cursor-pointer items-center gap-2 text-sm"
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

        <div v-else-if="field.type === 'dateRange'" class="flex items-center gap-2">
          <input
            type="date"
            :value="modelValue[`${field.key}From`] || ''"
            class="rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            @input="updateField(`${field.key}From`, ($event.target as HTMLInputElement).value)"
          >
          <span class="text-sm text-muted-foreground">至</span>
          <input
            type="date"
            :value="modelValue[`${field.key}To`] || ''"
            class="rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            @input="updateField(`${field.key}To`, ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-3 border-t border-border pt-4">
      <button
        class="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        @click="handleReset"
      >
        重置
      </button>
      <button
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        @click="handleApply"
      >
        应用筛选
      </button>
    </div>
  </div>
</template>
