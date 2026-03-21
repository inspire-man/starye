<script setup lang="ts">
import type { Publisher } from '@/lib/api'
import { computed, ref } from 'vue'
import { api } from '@/lib/api'

interface Props {
  modelValue: { id: string, name: string, sortOrder: number }[]
}

interface Emits {
  (e: 'update:modelValue', value: { id: string, name: string, sortOrder: number }[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const searchQuery = ref('')
const searchResults = ref<Publisher[]>([])
const searching = ref(false)
const showCreateForm = ref(false)
const newPublisherName = ref('')
const creating = ref(false)
const draggedIndex = ref<number | null>(null)

const selectedPublishers = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

async function searchPublishers() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  searching.value = true
  try {
    const response = await api.admin.getPublishers({
      search: searchQuery.value,
      limit: 20,
    })
    searchResults.value = response.data
  }
  catch (e) {
    console.error('搜索失败:', e)
  }
  finally {
    searching.value = false
  }
}

function togglePublisher(publisher: Publisher) {
  const index = selectedPublishers.value.findIndex(p => p.id === publisher.id)
  if (index > -1) {
    // 取消选择
    const newValue = [...selectedPublishers.value]
    newValue.splice(index, 1)
    // 重新调整 sortOrder
    newValue.forEach((p, i) => {
      p.sortOrder = i
    })
    selectedPublishers.value = newValue
  }
  else {
    // 添加选择
    selectedPublishers.value = [
      ...selectedPublishers.value,
      {
        id: publisher.id,
        name: publisher.name,
        sortOrder: selectedPublishers.value.length,
      },
    ]
  }
}

function isSelected(publisherId: string) {
  return selectedPublishers.value.some(p => p.id === publisherId)
}

function removePublisher(index: number) {
  const newValue = [...selectedPublishers.value]
  newValue.splice(index, 1)
  // 重新调整 sortOrder
  newValue.forEach((p, i) => {
    p.sortOrder = i
  })
  selectedPublishers.value = newValue
}

// 拖拽排序
function handleDragStart(index: number) {
  draggedIndex.value = index
}

function handleDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (draggedIndex.value === null || draggedIndex.value === index)
    return

  const newValue = [...selectedPublishers.value]
  const draggedItem = newValue[draggedIndex.value]
  newValue.splice(draggedIndex.value, 1)
  newValue.splice(index, 0, draggedItem)

  // 重新调整 sortOrder
  newValue.forEach((p, i) => {
    p.sortOrder = i
  })

  selectedPublishers.value = newValue
  draggedIndex.value = index
}

function handleDragEnd() {
  draggedIndex.value = null
}

// 快速创建厂商
function openCreateForm() {
  newPublisherName.value = searchQuery.value
  showCreateForm.value = true
}

async function createPublisher() {
  if (!newPublisherName.value.trim())
    return

  creating.value = true
  try {
    const response = await api.admin.createPublisher({
      name: newPublisherName.value.trim(),
    })

    // 自动选中新创建的厂商
    selectedPublishers.value = [
      ...selectedPublishers.value,
      {
        id: response.id,
        name: response.name,
        sortOrder: selectedPublishers.value.length,
      },
    ]

    showCreateForm.value = false
    newPublisherName.value = ''
    searchQuery.value = ''
    searchResults.value = []
  }
  catch (e) {
    console.error('创建失败:', e)
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="publisher-selector">
    <div class="selector-header">
      <label class="label">厂商</label>
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索厂商名称..."
          class="search-input"
          @input="searchPublishers"
        >
        <button
          v-if="searchQuery && searchResults.length === 0 && !searching"
          class="btn-create"
          @click="openCreateForm"
        >
          + 创建
        </button>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="searchResults.length > 0" class="search-results">
      <div
        v-for="publisher in searchResults"
        :key="publisher.id"
        class="search-result-item"
        :class="{ selected: isSelected(publisher.id) }"
        @click="togglePublisher(publisher)"
      >
        <input
          type="checkbox"
          :checked="isSelected(publisher.id)"
          @click.stop="togglePublisher(publisher)"
        >
        <span>{{ publisher.name }}</span>
        <span class="movie-count">({{ publisher.movieCount }} 作品)</span>
        <span v-if="!publisher.hasDetailsCrawled" class="status-badge pending" title="详情待爬取">⚠️</span>
      </div>
    </div>

    <div v-if="searching" class="loading">
      搜索中...
    </div>

    <!-- 已选择的厂商（可拖拽排序） -->
    <div v-if="selectedPublishers.length > 0" class="selected-publishers">
      <div class="selected-header">
        已选择 ({{ selectedPublishers.length }})
      </div>
      <div class="selected-list">
        <div
          v-for="(publisher, index) in selectedPublishers"
          :key="publisher.id"
          class="selected-item"
          draggable="true"
          @dragstart="handleDragStart(index)"
          @dragover="(e) => handleDragOver(e, index)"
          @dragend="handleDragEnd"
        >
          <span class="drag-handle">☰</span>
          <span class="publisher-name">{{ publisher.name }}</span>
          <span class="sort-order">#{{ publisher.sortOrder + 1 }}</span>
          <button class="btn-remove" @click="removePublisher(index)">
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- 快速创建表单 -->
    <Teleport to="body">
      <div v-if="showCreateForm" class="modal-overlay" @click.self="showCreateForm = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>创建新厂商</h3>
            <button class="modal-close" @click="showCreateForm = false">
              ×
            </button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label>名称</label>
              <input
                v-model="newPublisherName"
                type="text"
                class="input"
                placeholder="输入厂商名称"
                @keyup.enter="createPublisher"
              >
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showCreateForm = false">
              取消
            </button>
            <button
              class="btn-primary"
              :disabled="!newPublisherName.trim() || creating"
              @click="createPublisher"
            >
              {{ creating ? '创建中...' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.publisher-selector {
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  padding: 1rem;
  background: #f9fafb;
}

.selector-header {
  margin-bottom: 1rem;
}

.label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.search-box {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.btn-create {
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
}

.btn-create:hover {
  background: #059669;
}

.search-results {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: white;
  margin-top: 0.5rem;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
}

.search-result-item:hover {
  background: #f9fafb;
}

.search-result-item.selected {
  background: #eff6ff;
}

.search-result-item:last-child {
  border-bottom: none;
}

.movie-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: #6b7280;
}

.status-badge {
  font-size: 0.875rem;
  margin-left: 0.25rem;
}

.status-badge.pending {
  color: #f59e0b;
}

.loading {
  text-align: center;
  padding: 1rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.selected-publishers {
  margin-top: 1rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}

.selected-header {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.selected-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  cursor: move;
}

.selected-item:hover {
  border-color: #3b82f6;
}

.drag-handle {
  color: #9ca3af;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.publisher-name {
  flex: 1;
  font-size: 0.875rem;
}

.sort-order {
  font-size: 0.75rem;
  color: #6b7280;
  padding: 0.125rem 0.5rem;
  background: #f3f4f6;
  border-radius: 9999px;
}

.btn-remove {
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
}

.btn-remove:hover {
  background: #dc2626;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-content {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-close {
  width: 2rem;
  height: 2rem;
  border: none;
  background: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.modal-body {
  padding: 1.5rem;
}

.form-field {
  margin-bottom: 1rem;
}

.form-field label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.btn-primary,
.btn-secondary {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}
</style>
