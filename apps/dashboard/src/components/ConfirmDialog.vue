<script setup lang="ts">
/**
 * 确认对话框组件
 *
 * 支持：
 * - 文本确认（输入 "CONFIRM"）
 * - 预览内容
 * - 自定义按钮文本
 */

import { computed, ref, watch } from 'vue'

interface Props {
  open: boolean
  title: string
  message: string
  requireTextConfirm?: boolean
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  previewItems?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  requireTextConfirm: false,
  confirmText: '确认',
  cancelText: '取消',
  variant: 'default',
  previewItems: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
  'cancel': []
}>()

const confirmInput = ref('')

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    confirmInput.value = ''
  }
})

function handleConfirm() {
  if (props.requireTextConfirm && confirmInput.value !== 'CONFIRM') {
    return
  }

  emit('confirm')
  emit('update:open', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:open', false)
}

const canConfirm = computed(() => {
  if (!props.requireTextConfirm) {
    return true
  }
  return confirmInput.value === 'CONFIRM'
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click="handleCancel">
      <div class="dialog-container" @click.stop>
        <div class="dialog-header">
          <h3>{{ title }}</h3>
        </div>

        <div class="dialog-body">
          <p class="message">
            {{ message }}
          </p>

          <div v-if="previewItems.length > 0" class="preview">
            <p class="preview-label">
              预览（共 {{ previewItems.length }} 项）:
            </p>
            <ul class="preview-list">
              <li v-for="(item, index) in previewItems.slice(0, 5)" :key="index">
                {{ item }}
              </li>
              <li v-if="previewItems.length > 5" class="more">
                ... 还有 {{ previewItems.length - 5 }} 项
              </li>
            </ul>
          </div>

          <div v-if="requireTextConfirm" class="confirm-input-section">
            <p class="warning">
              ⚠️ 此操作不可撤销
            </p>
            <p class="instruction">
              输入 <strong>CONFIRM</strong> 以继续:
            </p>
            <input
              v-model="confirmInput"
              type="text"
              placeholder="CONFIRM"
              class="confirm-input"
              @keyup.enter="handleConfirm"
            >
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-cancel" @click="handleCancel">
            {{ cancelText }}
          </button>
          <button
            class="btn-confirm" :class="[variant === 'danger' && 'danger']"
            :disabled="!canConfirm"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.dialog-container {
  background: white;
  border-radius: 0.5rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.dialog-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.dialog-body {
  padding: 1.5rem;
}

.message {
  color: #374151;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.preview {
  margin: 1rem 0;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.preview-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.preview-list {
  list-style: disc;
  padding-left: 1.5rem;
  font-size: 0.875rem;
  color: #374151;
}

.preview-list li {
  margin-bottom: 0.25rem;
}

.preview-list .more {
  color: #6b7280;
  font-style: italic;
}

.confirm-input-section {
  margin-top: 1rem;
}

.warning {
  color: #dc2626;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.instruction {
  font-size: 0.875rem;
  color: #374151;
  margin-bottom: 0.5rem;
}

.instruction strong {
  font-family: monospace;
  background: #fef3c7;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.confirm-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 2px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: monospace;
}

.confirm-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.dialog-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-cancel,
.btn-confirm {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-cancel:hover {
  background: #f9fafb;
}

.btn-confirm {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-confirm:hover {
  background: #2563eb;
}

.btn-confirm.danger {
  background: #dc2626;
}

.btn-confirm.danger:hover {
  background: #b91c1c;
}

.btn-confirm:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}
</style>
