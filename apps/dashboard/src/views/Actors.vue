<!-- eslint-disable no-alert -->
<script setup lang="ts">
import type { Actor, Movie } from '@/lib/api'
import { computed, onMounted, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import CrawlStatusTag from '@/components/CrawlStatusTag.vue'
import DataTable from '@/components/DataTable.vue'
import ImageUpload from '@/components/ImageUpload.vue'
import Pagination from '@/components/Pagination.vue'
import { useFilters } from '@/composables/useFilters'
import { usePagination } from '@/composables/usePagination'
import { useSorting } from '@/composables/useSorting'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/date-utils'

const actors = ref<Actor[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// 统计信息
const stats = ref({
  total: 0,
  crawled: 0,
  pending: 0,
  withSourceUrl: 0, // 有 sourceUrl 的女优数量
  crawledPercentage: 0,
})
const loadingStats = ref(false)

const isEditModalOpen = ref(false)
const editingActor = ref<Actor | null>(null)
const relatedMovies = ref<Movie[]>([])
const loadingMovies = ref(false)

const isMergeDialogOpen = ref(false)
const mergeSourceId = ref<string>('')
const mergeTargetId = ref<string>('')
const mergingActors = ref(false)

// 批量操作相关
const selectedActors = ref<Set<string>>(new Set())
const isBatchOperating = ref(false)

// 国籍选项列表
const nationalities = ref<string[]>([])
const loadingNationalities = ref(false)

const { filters } = useFilters({
  search: '',
  crawlStatus: '', // 爬取状态筛选：'' | 'complete' | 'pending' | 'failed' | 'no-link'
  nationality: '', // 国籍筛选
  hasDetails: '', // 是否有详情：'' | 'true' | 'false'
})

const { currentPage, limit: pageSize, totalPages, total: totalItems, setMeta, goToPage } = usePagination()

const { sortBy: sortField, sortOrder, updateSort } = useSorting('movieCount', 'desc')

// 监听页码变化时自动加载
watch(currentPage, () => {
  loadActors()
}, { immediate: true })

// 监听筛选条件变化时重置到第一页
watch(
  [
    () => filters.value.search,
    () => filters.value.crawlStatus,
    () => filters.value.nationality,
    () => filters.value.hasDetails,
  ],
  () => {
    if (currentPage.value !== 1) {
      goToPage(1)
    }
    else {
      loadActors()
    }
  },
)

function toggleSort(field: string) {
  const newOrder = sortField.value === field && sortOrder.value === 'asc' ? 'desc' : 'asc'
  updateSort(field, newOrder)
}

const tableColumns = [
  { key: 'select', label: '选择', sortable: false, width: '40px' },
  { key: 'avatar', label: '头像', sortable: false, width: '60px' },
  { key: 'name', label: '名称', sortable: true, width: '200px' },
  { key: 'movieCount', label: '作品数', sortable: true, width: '80px' },
  { key: 'crawlStatus', label: '爬取状态', sortable: false, width: '120px' },
  { key: 'nationality', label: '国籍', sortable: false, width: '80px' },
  { key: 'createdAt', label: '创建时间', sortable: true, width: '180px' },
  { key: 'actions', label: '操作', sortable: false, width: '100px' },
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

async function loadStats() {
  loadingStats.value = true
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/actors/stats`, {
      credentials: 'include',
    })
    if (response.ok) {
      stats.value = await response.json()
    }
  }
  catch (e) {
    console.error('Failed to load stats:', e)
  }
  finally {
    loadingStats.value = false
  }
}

async function loadNationalities() {
  loadingNationalities.value = true
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/actors/nationalities`, {
      credentials: 'include',
    })
    if (response.ok) {
      const data = await response.json() as { nationalities?: string[] }
      nationalities.value = data.nationalities || []
    }
  }
  catch (e) {
    console.error('Failed to load nationalities:', e)
  }
  finally {
    loadingNationalities.value = false
  }
}

async function loadActors() {
  loading.value = true
  error.value = null
  try {
    const params: any = {
      page: currentPage.value,
      limit: pageSize.value,
    }
    if (filters.value.search) {
      params.search = filters.value.search
    }
    if (filters.value.crawlStatus) {
      params.crawlStatus = filters.value.crawlStatus
    }
    if (filters.value.nationality) {
      params.nationality = filters.value.nationality
    }
    if (filters.value.hasDetails) {
      params.hasDetails = filters.value.hasDetails === 'true'
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
      avatar: editingActor.value.avatar,
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

// 批量操作函数
function toggleActorSelection(actorId: string) {
  if (selectedActors.value.has(actorId)) {
    selectedActors.value.delete(actorId)
  }
  else {
    selectedActors.value.add(actorId)
  }
}

function toggleSelectAll() {
  if (selectedActors.value.size === filteredActors.value.length) {
    selectedActors.value.clear()
  }
  else {
    selectedActors.value.clear()
    filteredActors.value.forEach(actor => selectedActors.value.add(actor.id))
  }
}

const hasSelection = computed(() => selectedActors.value.size > 0)

async function handleBatchRecrawl() {
  if (selectedActors.value.size === 0)
    return

  if (!confirm(`确定要标记 ${selectedActors.value.size} 个演员为"待重新爬取"吗？下次爬虫运行时会尝试补全详情。`))
    return

  isBatchOperating.value = true
  try {
    // 批量调用 API 将选中的演员标记为需要重新爬取
    const ids = Array.from(selectedActors.value)
    await api.admin.batchRecrawlActors(ids)

    selectedActors.value.clear()
    await loadActors()
  }
  catch (e) {
    console.error('Batch recrawl failed:', e)
    alert('批量操作失败，请重试')
  }
  finally {
    isBatchOperating.value = false
  }
}

onMounted(() => {
  loadStats()
  loadNationalities()
})
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

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-label">
          总女优数
        </div>
        <div class="stat-value">
          {{ stats.total }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          已爬取详情
        </div>
        <div class="stat-value text-green">
          {{ stats.crawled }}
        </div>
        <div class="stat-subtitle">
          {{ stats.crawledPercentage }}%
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          待爬取详情
        </div>
        <div class="stat-value text-orange">
          {{ stats.pending }}
        </div>
        <div class="stat-subtitle">
          其中 {{ stats.withSourceUrl }} 个有详情页链接
        </div>
      </div>
    </div>

    <div class="filter-bar">
      <input
        v-model="filters.search"
        type="text"
        placeholder="搜索演员名称..."
        class="search-input"
      >
      <select
        v-model="filters.crawlStatus"
        class="filter-select"
      >
        <option value="">
          全部状态
        </option>
        <option value="complete">
          ✅ 已完成
        </option>
        <option value="pending">
          ⚠️ 待爬取
        </option>
        <option value="failed">
          ❌ 爬取失败
        </option>
        <option value="no-link">
          🔗 无链接
        </option>
      </select>
      <select
        v-model="filters.nationality"
        class="filter-select"
        :disabled="loadingNationalities"
      >
        <option value="">
          全部国籍
        </option>
        <option v-for="nat in nationalities" :key="nat" :value="nat">
          {{ nat }}
        </option>
      </select>
      <select
        v-model="filters.hasDetails"
        class="filter-select"
      >
        <option value="">
          全部详情
        </option>
        <option value="true">
          ✅ 有详情
        </option>
        <option value="false">
          📝 无详情
        </option>
      </select>
      <div class="filter-info">
        共 {{ totalItems }} 个演员
      </div>
    </div>

    <div v-if="hasSelection" class="batch-actions">
      <span class="batch-info">已选择 {{ selectedActors.size }} 个演员</span>
      <button
        class="btn-primary"
        :disabled="isBatchOperating"
        @click="handleBatchRecrawl"
      >
        {{ isBatchOperating ? '处理中...' : '重新爬取详情' }}
      </button>
      <button class="btn-secondary" @click="toggleSelectAll">
        {{ selectedActors.size === filteredActors.length ? '取消全选' : '全选当前页' }}
      </button>
      <button class="btn-secondary" @click="selectedActors.clear()">
        取消选择
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <DataTable
      :data="filteredActors"
      :columns="tableColumns"
      :loading="loading"
      :sort-field="sortField"
      :sort-order="sortOrder"
      empty-message="暂无演员数据"
      @row-click="openEditModal"
      @sort="toggleSort"
    >
      <template #cell-select="{ item }">
        <input
          type="checkbox"
          :checked="selectedActors.has(item.id)"
          @click.stop="toggleActorSelection(item.id)"
        >
      </template>
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
      <template #cell-crawlStatus="{ item }">
        <CrawlStatusTag
          :has-details-crawled="item.hasDetailsCrawled"
          :source-url="item.sourceUrl"
          :crawl-failure-count="item.crawlFailureCount"
        />
      </template>
      <template #cell-nationality="{ item }">
        {{ item.nationality || '-' }}
      </template>
      <template #cell-createdAt="{ item }">
        {{ formatDateTime(item.createdAt) }}
      </template>
      <template #cell-actions="{ item }">
        <router-link :to="`/actors/${item.id}`" class="action-link" @click.stop>
          查看详情
        </router-link>
      </template>
    </DataTable>

    <!-- 分页器 -->
    <Pagination
      v-if="totalPages > 1"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="totalItems"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      :background="true"
      @update:current-page="goToPage"
      @update:page-size="(size) => { pageSize = size; goToPage(1) }"
    />

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
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.filter-select {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
  min-width: 150px;
}

.filter-select:hover {
  border-color: #9ca3af;
}

.filter-info {
  display: flex;
  align-items: center;
  padding: 0 1rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
}

.stat-value.text-green {
  color: #10b981;
}

.stat-value.text-orange {
  color: #f59e0b;
}

.stat-subtitle {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
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

.batch-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.batch-info {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-link {
  color: #3b82f6;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: color 0.2s;
}

.action-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

/* 响应式设计：最小宽度 1280px */
@media (max-width: 1280px) {
  .actors-page {
    max-width: 100%;
    padding: 0 1rem;
  }
}
</style>
