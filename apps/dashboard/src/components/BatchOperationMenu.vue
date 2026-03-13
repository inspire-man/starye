<script setup lang="ts">
/**
 * 批量操作菜单组件
 */

import { ref } from 'vue'

export interface BatchOperation {
  id: string
  label: string
  icon?: string
  variant?: 'default' | 'danger'
}

interface Props {
  operations: BatchOperation[]
  selectedCount: number
}

defineProps<Props>()

const emit = defineEmits<{
  execute: [operationId: string]
}>()

const isOpen = ref(false)

function handleExecute(operationId: string) {
  emit('execute', operationId)
  isOpen.value = false
}
</script>

<template>
  <div class="batch-operation-menu">
    <button
      class="trigger-button"
      :disabled="selectedCount === 0"
      @click="isOpen = !isOpen"
    >
      批量操作 ({{ selectedCount }})
      <span class="dropdown-arrow">▼</span>
    </button>

    <div v-if="isOpen" class="dropdown-menu">
      <button
        v-for="op in operations"
        :key="op.id"
        class="menu-item" :class="[op.variant === 'danger' && 'danger']"
        @click="handleExecute(op.id)"
      >
        <span v-if="op.icon" class="icon">{{ op.icon }}</span>
        {{ op.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.batch-operation-menu {
  position: relative;
  display: inline-block;
}

.trigger-button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.trigger-button:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.trigger-button:not(:disabled):hover {
  background: #2563eb;
}

.dropdown-arrow {
  font-size: 0.75rem;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  z-index: 50;
}

.menu-item {
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #374151;
}

.menu-item:hover {
  background: #f9fafb;
}

.menu-item.danger {
  color: #dc2626;
}

.menu-item.danger:hover {
  background: #fef2f2;
}

.icon {
  font-size: 1rem;
}
</style>
