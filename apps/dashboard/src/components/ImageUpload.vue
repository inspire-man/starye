<script setup lang="ts">
/**
 * 图片上传组件
 *
 * 支持：
 * - 预览
 * - 拖拽上传
 * - 自动上传到服务器
 * - 加载状态和错误提示
 */

import { ref } from 'vue'
import { api } from '@/lib/api'

interface Props {
  modelValue?: string | null
  accept?: string
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
  accept: 'image/*',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isDragging = ref(false)
const uploading = ref(false)
const uploadError = ref('')

async function handleUpload(file: File) {
  uploading.value = true
  uploadError.value = ''

  try {
    const response = await api.upload.uploadImage(file)
    emit('update:modelValue', response.url)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    uploadError.value = message
  }
  finally {
    uploading.value = false
  }
}

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    handleUpload(file)
  }
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    handleUpload(file)
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
      <div v-if="uploading" class="loading-overlay">
        <div class="spinner" />
        <p class="loading-text">
          上传中...
        </p>
      </div>
    </div>

    <div
      class="upload-zone"
      :class="[isDragging && 'dragging', uploading && 'uploading']"
      @drop.prevent="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <input
        type="file"
        :accept="accept"
        :disabled="uploading"
        class="file-input"
        @change="handleFileSelect"
      >
      <div class="upload-prompt">
        <span class="icon">{{ uploading ? '⏳' : '📤' }}</span>
        <p>{{ uploading ? '上传中...' : '点击或拖拽图片到此处上传' }}</p>
        <p class="hint">
          支持 JPG, PNG, GIF, WebP 格式，最大 10MB
        </p>
        <p v-if="uploadError" class="error-message">
          {{ uploadError }}
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
  width: 100%;
  max-width: 400px;
  aspect-ratio: 400 / 267;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #f3f4f6;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.loading-text {
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
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

.upload-zone.uploading {
  cursor: wait;
  opacity: 0.7;
  pointer-events: none;
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

.error-message {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #dc2626;
  font-weight: 500;
}
</style>
