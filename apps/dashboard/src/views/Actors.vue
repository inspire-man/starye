<script setup lang="ts">
import type { Actor, Movie } from '@/lib/api'
import { computed, onMounted, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataTable from '@/components/DataTable.vue'
import ImageUpload from '@/components/ImageUpload.vue'
import { useFilters } from '@/composables/useFilters'
import { usePagination } from '@/composables/usePagination'
import { useSorting } from '@/composables/useSorting'
import { api } from '@/lib/api'

const actors = ref<Actor[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const isEditModalOpen = ref(false)
const editingActor = ref<Actor | null>(null)
const relatedMovies = ref<Movie[]>([])
const loadingMovies = ref(false)

const isMergeDialogOpen = ref(false)
const mergeSourceId = ref<string>('')
const mergeTargetId = ref<string>('')
const mergingActors = ref(false)

const { filters } = useFilters({
  search: '',
})

const { currentPage, limit: pageSize, totalPages, total: totalItems, setMeta, goToPage } = usePagination()

const { sortBy: sortField, sortOrder, updateSort } = useSorting('movieCount', 'desc')

function toggleSort(field: string) {
  const newOrder = sortField.value === field && sortOrder.value === 'asc' ? 'desc' : 'asc'
  updateSort(field, newOrder)
}

const tableColumns = [
  { key: 'avatar', label: '头像', sortable: false },
  { key: 'name', label: '名称', sortable: true },
  { key: 'movieCount', label: '作品数', sortable: true },
]

const filteredActors = computed(() => {
  let result = actors.value

  if (filters.value.search) {
    const searchLower = filters.value.search.toLowerCase()
    result = result.filter(a =>
      a.name.toLowerCase().includes(searchLower),
    )
  }

  result.sort((a, b) => {
    let aVal: any = a[sortField.value as keyof Actor]
    let bVal: any = b[sortField.value as keyof Actor]

    if (sortField.value === 'createdAt') {
      aVal = new Date(aVal || 0).getTime()
      bVal = new Date(bVal || 0).getTime()
    }

    if (aVal < bVal)
      return sortOrder.value === 'asc' ? -1 : 1
    if (aVal > bVal)
      return sortOrder.value === 'asc' ? 1 : -1
    return 0
  })

  return result
})

async function loadActors() {
  loading.value = true
  error.value = null
  try {
    const params: any = {
      page: currentPage.value,
      limit: pageSize.value,
      sortBy: sortField.value,
      sortOrder: sortOrder.value,
    }
    if (filters.value.search) {
      params.search = filters.value.search
    }

    const response = await api.admin.getActors(params)
    actors.value = response.data
    setMeta({ total: response.meta.total, totalPages: response.meta.totalPages })
  }
  catch (e: any) {
    error.value = e.message || '加载失败'
  }
  finally {
    loading.value = false
  }
}

async function openEditModal(actor: Actor) {
  editingActor.value = { ...actor }
  isEditModalOpen.value = true
  if (actor.id) {
    await loadRelatedMovies(actor.id)
  }
}

async function loadRelatedMovies(actorId: string) {
  loadingMovies.value = true
  try {
    const response = await api.admin.getActorDetail(actorId)
    relatedMovies.value = response.movies || []
  }
  catch (e) {
    console.error('Failed to load related movies:', e)
  }
  finally {
    loadingMovies.value = false
  }
}

async function handleUpdate() {
  if (!editingActor.value?.id)
    return

  try {
    await api.admin.updateActor(editingActor.value.id, {
      name: editingActor.value.name,
    })
    isEditModalOpen.value = false
    await loadActors()
  }
  catch (e) {
    console.error('Update failed:', e)
  }
}

function openMergeDialog(actorId: string) {
  mergeSourceId.value = actorId
  mergeTargetId.value = ''
  isMergeDialogOpen.value = true
}

async function handleMerge() {
  if (!mergeSourceId.value || !mergeTargetId.value)
    return

  mergingActors.value = true
  try {
    await api.admin.mergeActors(mergeSourceId.value, mergeTargetId.value)
    isMergeDialogOpen.value = false
    await loadActors()
  }
  catch (e) {
    console.error('Merge failed:', e)
  }
  finally {
    mergingActors.value = false
  }
}

onMounted(loadActors)
</script>

<template>
  <div class="actors-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">
          演员管理
        </h2>
        <p class="page-subtitle">
          管理电影演员信息
        </p>
      </div>
    </div>

    <div class="filter-bar">
      <input
        v-model="filters.search"
        type="text"
        placeholder="搜索演员名称..."
        class="search-input"
        @input="loadActors"
      >
      <div class="filter-info">
        共 {{ totalItems }} 个演员
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <DataTable
      :data="filteredActors"
      :columns="tableColumns"
      :loading="loading"
      :current-page="currentPage"
      :total-pages="totalPages"
      :sort-field="sortField"
      :sort-order="sortOrder"
      empty-message="暂无演员数据"
      @row-click="openEditModal"
      @sort="toggleSort"
      @page-change="(page) => { goToPage(page); loadActors() }"
    >
      <template #cell-avatar="{ item }">
        <img
          v-if="item.avatar"
          :src="item.avatar"
          :alt="item.name"
          class="actor-avatar"
        >
        <div v-else class="actor-avatar-placeholder">
          {{ item.name.charAt(0) }}
        </div>
      </template>
    </DataTable>

    <Teleport to="body">
      <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>编辑演员</h3>
            <button class="modal-close" @click="isEditModalOpen = false">
              ×
            </button>
          </div>

          <div class="modal-body">
            <div class="form-field">
              <label>名称</label>
              <input
                v-model="editingActor!.name"
                type="text"
                class="input"
              >
            </div>

            <div class="form-field">
              <label>头像</label>
              <ImageUpload
                v-model="editingActor!.avatar"
              />
            </div>

            <div class="form-field">
              <label>相关作品 ({{ relatedMovies.length }})</label>
              <div v-if="loadingMovies" class="loading">
                加载中...
              </div>
              <div v-else class="movie-list">
                <div
                  v-for="movie in relatedMovies"
                  :key="movie.id"
                  class="movie-item"
                >
                  <img
                    v-if="movie.coverImage"
                    :src="movie.coverImage"
                    :alt="movie.title"
                    class="movie-cover"
                  >
                  <span>{{ movie.title }}</span>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button
                class="btn-danger"
                @click="openMergeDialog(editingActor!.id)"
              >
                合并重复
              </button>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="isEditModalOpen = false">
              取消
            </button>
            <button class="btn-primary" @click="handleUpdate">
              保存
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      :open="isMergeDialogOpen"
      title="合并演员"
      message="将此演员合并到另一个演员（所有关联作品将转移）"
      @confirm="handleMerge"
      @cancel="isMergeDialogOpen = false"
    >
      <div class="merge-form">
        <div class="form-field">
          <label>源演员 ID</label>
          <input
            v-model="mergeSourceId"
            type="text"
            class="input"
            disabled
          >
        </div>
        <div class="form-field">
          <label>目标演员 ID</label>
          <input
            v-model="mergeTargetId"
            type="text"
            class="input"
            placeholder="输入目标演员 ID"
          >
        </div>
      </div>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.actors-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
}

.page-subtitle {
  color: #6b7280;
  margin-top: 0.25rem;
}

.filter-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.filter-info {
  display: flex;
  align-items: center;
  padding: 0 1rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.error-message {
  padding: 1rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #991b1b;
  margin-bottom: 1rem;
}

.actor-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.actor-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #6b7280;
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
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
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
  margin-bottom: 1.5rem;
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

.movie-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  padding: 0.5rem;
}

.movie-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.movie-item:last-child {
  border-bottom: none;
}

.movie-cover {
  width: 40px;
  height: 60px;
  object-fit: cover;
  border-radius: 0.25rem;
}

.form-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.btn-primary,
.btn-secondary,
.btn-danger {
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

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.loading {
  text-align: center;
  color: #6b7280;
  padding: 1rem;
}

.merge-form {
  margin-top: 1rem;
}
</style>
