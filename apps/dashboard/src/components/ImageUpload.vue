<script setup lang="ts">
/**
 * 图片上传组件
 *
 * 支持：
 * - 预览
 * - 拖拽上传
 * - 加载状态
 */

import { ref } from 'vue'

interface Props {
  modelValue?: string
  loading?: boolean
  accept?: string
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
  loading: false,
  accept: 'image/*',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'upload': [file: File]
}>()

const isDragging = ref(false)

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    emit('upload', file)
  }
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    emit('upload', file)
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}
</script>

<template>
  <div class="image-upload">
    <div
      v-if="modelValue"
      class="preview-container"
    >
      <img :src="modelValue" alt="Preview" class="preview-image">
      <div v-if="loading" class="loading-overlay">
        <div class="spinner" />
      </div>
    </div>

    <div
      class="upload-zone" :class="[isDragging && 'dragging']"
      @drop.prevent="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <input
        type="file"
        :accept="accept"
        class="file-input"
        @change="handleFileSelect"
      >
      <div class="upload-prompt">
        <span class="icon">📤</span>
        <p>点击或拖拽图片到此处上传</p>
        <p class="hint">
          支持 JPG, PNG, WebP 格式
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-upload {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-container {
  position: relative;
  width: 200px;
  height: 280px;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.upload-zone {
  position: relative;
  border: 2px dashed #d1d5db;
  border-radius: 0.5rem;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}

.upload-zone:hover,
.upload-zone.dragging {
  border-color: #3b82f6;
  background: #eff6ff;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-prompt {
  pointer-events: none;
}

.icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.upload-prompt p {
  color: #374151;
  margin-bottom: 0.25rem;
}

.hint {
  font-size: 0.75rem;
  color: #6b7280;
}
</style>
