<script setup lang="ts">
/**
 * 电影管理页面
 *
 * 功能：
 * - 电影列表（分页、筛选、排序）
 * - 电影详情编辑
 * - 批量操作
 * - 播放源管理
 */

import type { Movie, Player } from '@/lib/api'
import { ConfirmDialog, DataTable, FilterPanel, Pagination, SkeletonTable, useFilters, usePagination, useToast } from '@starye/ui'
import { ref, watch } from 'vue'
import ActorSelector from '@/components/ActorSelector.vue'
import BatchOperationMenu from '@/components/BatchOperationMenu.vue'
import ImageUpload from '@/components/ImageUpload.vue'
import PublisherSelector from '@/components/PublisherSelector.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useBatchSelect } from '@/composables/useBatchSelect'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { useSorting } from '@/composables/useSorting'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { formatDateTime } from '@/lib/date-utils'

useSession()

const { success, warning, showProgress, updateProgress, hideProgress } = useToast()
const { handleError } = useErrorHandler()

const movies = ref<Movie[]>([])
const loading = ref(true)
const error = ref('')

const isEditModalOpen = ref(false)
const editingMovie = ref<Movie | null>(null)
const updateLoading = ref(false)

// 女优和厂商选择器状态
const selectedActors = ref<{ id: string, name: string, sortOrder: number }[]>([])
const selectedPublishers = ref<{ id: string, name: string, sortOrder: number }[]>([])

const activeTab = ref<'metadata' | 'players'>('metadata')
const players = ref<Player[]>([])
const playersLoading = ref(false)

const { filters, applyFilters, resetFilters } = useFilters({
  isR18: '',
  crawlStatus: '',
  metadataLocked: '',
  actor: '',
  publisher: '',
  genre: '',
  releaseDateFrom: '',
  releaseDateTo: '',
  search: '',
})

const { currentPage, limit, totalPages, setMeta, goToPage, updatePageSize } = usePagination(20)
const { sortBy, sortOrder, updateSort } = useSorting('updatedAt', 'desc')
const { selected, toggleItem, toggleAll, clearSelection, selectedCount, selectedIds } = useBatchSelect(movies)

// 获取 total 用于分页组件
const total = ref(0)

// 监听页码变化时自动加载
watch(currentPage, () => {
  loadMovies()
}, { immediate: true })

// 监听 limit 变化时加载数据
watch(limit, () => {
  loadMovies()
})

const filterFields = [
  {
    key: 'isR18',
    label: 'R18',
    type: 'select' as const,
    options: [
      { value: 'true', label: '是' },
      { value: 'false', label: '否' },
    ],
  },
  {
    key: 'crawlStatus',
    label: '爬取状态',
    type: 'select' as const,
    options: [
      { value: 'pending', label: '等待中' },
      { value: 'partial', label: '部分完成' },
      { value: 'complete', label: '已完成' },
    ],
  },
  {
    key: 'metadataLocked',
    label: '元数据锁定',
    type: 'select' as const,
    options: [
      { value: 'true', label: '已锁定' },
      { value: 'false', label: '未锁定' },
    ],
  },
  {
    key: 'actor',
    label: '演员',
    type: 'text' as const,
    placeholder: '搜索演员名称',
  },
  {
    key: 'publisher',
    label: '厂商',
    type: 'text' as const,
    placeholder: '搜索厂商名称',
  },
  {
    key: 'search',
    label: '搜索',
    type: 'text' as const,
    placeholder: '标题或番号',
  },
]

const batchOperations = [
  { id: 'update_r18', label: '设为 R18', variant: 'default' as const },
  { id: 'lock_metadata', label: '锁定元数据', variant: 'default' as const },
  { id: 'unlock_metadata', label: '解锁元数据', variant: 'default' as const },
  { id: 'delete', label: '批量删除', variant: 'danger' as const },
]

const confirmDialogOpen = ref(false)
const confirmDialogData = ref<{
  title: string
  message: string
  operation: string
  payload?: any
}>({
  title: '',
  message: '',
  operation: '',
})

async function loadMovies(retryCount = 0) {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: limit.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...filters.value,
    }

    const response = await api.admin.getMovies(params)
    movies.value = response.data
    setMeta(response.meta)
    total.value = response.meta.total
    error.value = '' // 清空错误
  }
  catch (e: unknown) {
    const isNetworkError = e instanceof TypeError || (e as Error).message?.includes('fetch')

    // 网络错误且未达到最大重试次数，自动重试
    if (isNetworkError && retryCount < 2) {
      const delay = (retryCount + 1) * 1000 // 1s, 2s
      setTimeout(loadMovies, delay, retryCount + 1)
      return
    }

    // 其他错误或重试失败，显示错误
    error.value = String(e)
    handleError(e, '加载电影列表失败')
  }
  finally {
    loading.value = false
  }
}

// 监听 currentPage 变化时加载数据
watch(currentPage, () => {
  loadMovies()
}, { immediate: true })

// 监听排序变化
watch([sortBy, sortOrder], () => {
  loadMovies()
})

// 监听实际的筛选条件变化（不包括 page）
watch(
  [
    () => filters.value.search,
    () => filters.value.isR18,
    () => filters.value.crawlStatus,
    () => filters.value.metadataLocked,
  ],
  () => {
    // 筛选条件变化时不需要重置页码，因为 usePagination 的 currentPage 是 computed
    // 直接加载即可
    loadMovies()
  },
)

async function openEditModal(movie: Movie) {
  editingMovie.value = { ...movie }
  isEditModalOpen.value = true
  activeTab.value = 'metadata'

  // 重新获取完整的电影数据（包含关联的女优和厂商）
  try {
    const fullMovie = await api.admin.getMovie(movie.id)
    editingMovie.value = fullMovie

    // 初始化女优选择器数据
    if (fullMovie.movieActors && Array.isArray(fullMovie.movieActors)) {
      selectedActors.value = fullMovie.movieActors
        .filter((ma: any) => ma.actor && ma.actor.id)
        .map((ma: any, index: number) => ({
          id: ma.actor!.id,
          name: ma.actor!.name,
          sortOrder: ma.sortOrder ?? index,
        }))
    }
    else {
      selectedActors.value = []
    }

    // 初始化厂商选择器数据
    if (fullMovie.moviePublishers && Array.isArray(fullMovie.moviePublishers)) {
      selectedPublishers.value = fullMovie.moviePublishers
        .filter((mp: any) => mp.publisher && mp.publisher.id)
        .map((mp: any, index: number) => ({
          id: mp.publisher!.id,
          name: mp.publisher!.name,
          sortOrder: mp.sortOrder ?? index,
        }))
    }
    else {
      selectedPublishers.value = []
    }

    if (fullMovie.id) {
      loadPlayers(fullMovie.id)
    }
  }
  catch (e) {
    handleError(e, '加载电影详情失败')
    // 失败时回退到使用列表数据
    selectedActors.value = []
    selectedPublishers.value = []
  }
}

async function loadPlayers(movieId: string) {
  playersLoading.value = true
  try {
    const response = await api.admin.getPlayers(movieId)
    players.value = response.players
  }
  catch (e) {
    handleError(e, '加载播放源失败')
  }
  finally {
    playersLoading.value = false
  }
}

async function handleUpdate() {
  if (!editingMovie.value?.id)
    return

  updateLoading.value = true
  try {
    await api.admin.updateMovie(editingMovie.value.id, {
      title: editingMovie.value.title,
      description: editingMovie.value.description,
      coverImage: editingMovie.value.coverImage,
      isR18: editingMovie.value.isR18,
      metadataLocked: editingMovie.value.metadataLocked,
      sortOrder: editingMovie.value.sortOrder,
      actors: editingMovie.value.actors,
      genres: editingMovie.value.genres,
      series: editingMovie.value.series,
      publisher: editingMovie.value.publisher,
      releaseDate: editingMovie.value.releaseDate,
      duration: editingMovie.value.duration,
    })

    // 更新女优和厂商关联
    await api.admin.updateMovieActors(editingMovie.value.id, selectedActors.value)
    await api.admin.updateMoviePublishers(editingMovie.value.id, selectedPublishers.value)

    success('电影信息更新成功')
    isEditModalOpen.value = false
    await loadMovies()
  }
  catch (e: unknown) {
    handleError(e, '更新电影失败')
  }
  finally {
    updateLoading.value = false
  }
}

function handleBatchOperation(operationId: string) {
  confirmDialogData.value = {
    title: '确认批量操作',
    message: `即将对 ${selectedCount.value} 部电影执行操作`,
    operation: operationId,
  }

  if (operationId === 'delete') {
    confirmDialogData.value.title = '⚠️ 确认批量删除'
    confirmDialogData.value.message = `此操作将删除 ${selectedCount.value} 部电影及其所有播放源`
  }

  confirmDialogOpen.value = true
}

async function executeBatchOperation() {
  const { operation, payload } = confirmDialogData.value
  const ids = [...selectedIds.value]
  const total = ids.length

  // 特殊处理批量删除，显示进度
  if (operation === 'delete') {
    const progressId = showProgress('正在删除电影...')
    let successCount = 0
    let failedCount = 0
    const failedItems: string[] = []

    try {
      for (let i = 0; i < ids.length; i++) {
        const movieId = ids[i]
        try {
          await api.admin.deleteMovie(movieId)
          successCount++
        }
        catch (e: unknown) {
          failedCount++
          failedItems.push(movieId)
          console.error(`删除电影 ${movieId} 失败:`, e)
        }

        // 更新进度
        const progress = Math.round(((i + 1) / total) * 100)
        updateProgress(progressId, progress)
      }

      hideProgress(progressId)

      // 显示汇总结果
      if (failedCount === 0) {
        success(`成功删除 ${successCount} 部电影`)
      }
      else if (successCount === 0) {
        handleError(new Error('批量删除全部失败'), `删除失败: ${failedCount} 部电影`)
      }
      else {
        warning(`完成删除: 成功 ${successCount} 部，失败 ${failedCount} 部`)
      }

      clearSelection()
      await loadMovies()
    }
    catch (e: unknown) {
      hideProgress(progressId)
      handleError(e, '批量删除失败')
    }
  }
  else {
    // 其他批量操作使用原有逻辑
    try {
      await api.admin.bulkOperationMovies(selectedIds.value, operation, payload)
      success(`成功对 ${selectedCount.value} 部电影执行了操作`)
      clearSelection()
      await loadMovies()
    }
    catch (e: unknown) {
      handleError(e, '批量操作失败')
    }
  }
}

const tableColumns = [
  { key: 'coverImage', label: '封面', width: '100px', sortable: false },
  { key: 'code', label: '番号', width: '120px' },
  { key: 'title', label: '标题', minWidth: '200px', sortable: true },
  { key: 'actors', label: '女优', width: '200px' },
  { key: 'series', label: '系列', width: '150px' },
  { key: 'publisher', label: '厂商', width: '150px' },
  { key: 'releaseDate', label: '发布日期', width: '120px', sortable: true },
  { key: 'isR18', label: 'R18', width: '60px' },
  { key: 'metadataLocked', label: '锁定', width: '60px' },
  { key: 'crawlStatus', label: '状态', width: '120px' },
  { key: 'createdAt', label: '创建时间', width: '180px', sortable: true },
]
</script>

<template>
  <div class="movies-page">
    <div class="page-header">
      <h1>电影管理</h1>
    </div>

    <FilterPanel
      v-model="filters"
      :fields="filterFields"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <div class="toolbar">
      <div class="sort-controls">
        <label>排序:</label>
        <select :value="sortBy" @change="updateSort(($event.target as HTMLSelectElement).value)">
          <option value="updatedAt">
            更新时间
          </option>
          <option value="releaseDate">
            发布日期
          </option>
          <option value="createdAt">
            创建时间
          </option>
          <option value="sortOrder">
            人工排序
          </option>
        </select>
        <select :value="sortOrder" @change="updateSort(sortBy, ($event.target as HTMLSelectElement).value as any)">
          <option value="desc">
            降序
          </option>
          <option value="asc">
            升序
          </option>
        </select>
      </div>

      <BatchOperationMenu
        :operations="batchOperations"
        :selected-count="selectedCount"
        @execute="handleBatchOperation"
      />
    </div>

    <SkeletonTable
      v-if="loading && movies.length === 0"
      :rows="20"
      :columns="7"
      :selectable="true"
    />

    <DataTable
      v-else
      :data="movies"
      :columns="tableColumns"
      :loading="loading"
      :selectable="true"
      :selected-ids="selected"
      empty-message="暂无电影数据"
      @toggle-select="toggleItem"
      @toggle-select-all="toggleAll"
      @row-click="openEditModal"
    >
      <template #cell-coverImage="{ item }">
        <img
          v-if="item.coverImage"
          :src="item.coverImage"
          :alt="item.title"
          class="movie-cover-thumb"
        >
        <span v-else class="no-cover">无</span>
      </template>

      <template #cell-actors="{ item }">
        <span v-if="item.actorNames && item.actorNames.length > 0" class="actor-tags">
          <span v-for="(actor, idx) in item.actorNames.slice(0, 3)" :key="idx" class="actor-tag">
            {{ actor }}
          </span>
          <span v-if="item.actorNames.length > 3" class="more-tag">
            +{{ item.actorNames.length - 3 }}
          </span>
        </span>
        <span v-else>-</span>
      </template>

      <template #cell-isR18="{ item }">
        <span :class="item.isR18 ? 'badge-r18' : 'badge-general'">
          {{ item.isR18 ? 'R18' : '一般' }}
        </span>
      </template>

      <template #cell-metadataLocked="{ item }">
        <span v-if="item.metadataLocked" class="badge-locked">🔒</span>
        <span v-else class="badge-unlocked">🔓</span>
      </template>

      <template #cell-crawlStatus="{ item }">
        <StatusBadge
          :status="item.crawlStatus || 'complete'"
          :progress="item.crawlStatus === 'partial' ? { current: item.crawledPlayers || 0, total: item.totalPlayers || 0 } : undefined"
        />
      </template>

      <template #cell-releaseDate="{ item }">
        {{ item.releaseDate ? new Date(item.releaseDate).toLocaleDateString('zh-CN') : '-' }}
      </template>

      <template #cell-createdAt="{ item }">
        {{ formatDateTime(item.createdAt) }}
      </template>
    </DataTable>

    <!-- 分页器 -->
    <Pagination
      v-if="totalPages > 1"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="total"
      :page-size="limit"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      :background="true"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />

    <Teleport to="body">
      <div v-if="isEditModalOpen" class="modal-overlay" @click="isEditModalOpen = false">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h2>编辑电影</h2>
            <button class="close-btn" @click="isEditModalOpen = false">
              ✕
            </button>
          </div>

          <div class="tabs">
            <button
              class="tab" :class="[activeTab === 'metadata' && 'active']"
              @click="activeTab = 'metadata'"
            >
              元数据
            </button>
            <button
              class="tab" :class="[activeTab === 'players' && 'active']"
              @click="activeTab = 'players'"
            >
              播放源 ({{ players.length }})
            </button>
          </div>

          <div v-if="activeTab === 'metadata'" class="modal-body">
            <div v-if="editingMovie" class="form">
              <div class="form-row">
                <ImageUpload
                  v-model="editingMovie.coverImage as string"
                />
              </div>

              <div class="form-row">
                <label>番号</label>
                <input v-model="editingMovie.code" type="text" disabled>
              </div>

              <div class="form-row">
                <label>标题</label>
                <input v-model="editingMovie.title" type="text">
              </div>

              <div class="form-row">
                <label>简介</label>
                <textarea v-model="editingMovie.description" rows="4" />
              </div>

              <div class="form-row">
                <label>系列</label>
                <input v-model="editingMovie.series" type="text" placeholder="如：SODSTAR, ROCKET">
              </div>

              <div class="form-row">
                <label>厂商</label>
                <input v-model="editingMovie.publisher" type="text" placeholder="如：SODクリエイト">
              </div>

              <div class="form-row">
                <ActorSelector v-model="selectedActors" />
              </div>

              <div class="form-row">
                <PublisherSelector v-model="selectedPublishers" />
              </div>

              <div class="form-row-inline">
                <label>
                  <input v-model="editingMovie.isR18" type="checkbox">
                  R18 内容
                </label>
                <label>
                  <input v-model="editingMovie.metadataLocked" type="checkbox">
                  锁定元数据
                </label>
              </div>

              <div class="form-row">
                <label>排序权重</label>
                <input v-model.number="editingMovie.sortOrder" type="number">
                <p class="hint">
                  值越大越靠前
                </p>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'players'" class="modal-body">
            <div v-if="playersLoading" class="loading-state">
              加载中...
            </div>
            <div v-else class="players-list">
              <div v-if="players.length === 0" class="empty-state">
                暂无播放源
              </div>
              <div v-else>
                <div
                  v-for="player in players"
                  :key="player.id"
                  class="player-item"
                >
                  <div class="player-info">
                    <strong>{{ player.sourceName }}</strong>
                    <span class="player-url">{{ player.sourceUrl }}</span>
                    <span v-if="player.quality" class="quality-badge">{{ player.quality }}</span>
                  </div>
                  <div class="player-actions">
                    <!-- <button class="btn-test" @click="() => { window?.open(player.sourceUrl as string, '_blank') ?? undefined }">
                      测试
                    </button> -->
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="isEditModalOpen = false">
              取消
            </button>
            <button
              v-if="activeTab === 'metadata'"
              class="btn-primary"
              :disabled="updateLoading"
              @click="handleUpdate"
            >
              {{ updateLoading ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      v-model:open="confirmDialogOpen"
      :title="confirmDialogData.title"
      :message="confirmDialogData.message"
      :require-text-confirm="confirmDialogData.operation === 'delete'"
      variant="danger"
      confirm-text="确认"
      @confirm="executeBatchOperation"
    />
  </div>
</template>

<style scoped>
.movies-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sort-controls label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.sort-controls select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.close-btn:hover {
  color: #111827;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 1.5rem;
}

.tab {
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
}

.tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-row input,
.form-row textarea {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.form-row input:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.form-row-inline {
  display: flex;
  gap: 1.5rem;
}

.form-row-inline label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.player-url {
  font-size: 0.75rem;
  color: #6b7280;
  font-family: monospace;
}

.quality-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.player-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-test {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-test:hover {
  background: #e5e7eb;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
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
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.movie-cover-thumb {
  width: 60px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
}

.no-cover {
  color: #9ca3af;
  font-size: 0.75rem;
}

.actor-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.actor-tag {
  padding: 2px 8px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 12px;
  font-size: 0.75rem;
}

.more-tag {
  padding: 2px 8px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 12px;
  font-size: 0.75rem;
}

.badge-r18 {
  padding: 2px 8px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-general {
  padding: 2px 8px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
  font-size: 0.75rem;
}

.badge-locked,
.badge-unlocked {
  font-size: 1rem;
}
</style>
