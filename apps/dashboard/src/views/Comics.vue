<script setup lang="ts">
import type { Chapter, Comic } from '@/lib/api'
import { ConfirmDialog, DataTable, DetailDrawer, FilterPanel, Pagination, SkeletonCard, useFilters, usePagination, useToast } from '@starye/ui'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BatchOperationMenu from '@/components/BatchOperationMenu.vue'
import { useBatchSelect } from '@/composables/useBatchSelect'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { useSorting } from '@/composables/useSorting'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

const { t } = useI18n()
useSession()

const route = useRoute()

const { success, warning, showProgress, updateProgress, hideProgress } = useToast()
const { handleError } = useErrorHandler()

const comics = ref<Comic[]>([])
const loading = ref(true)
const error = ref('')

// 分页（URL 状态同步）
const { currentPage, limit, totalPages, total, setMeta, goToPage, updatePageSize } = usePagination(18)

// 筛选（URL 状态同步）
const { filters, applyFilters, resetFilters } = useFilters({
  search: '',
  isR18: '',
  status: '',
  region: '',
  crawlStatus: '',
})

// 排序
const { sortBy, sortOrder, updateSort } = useSorting('updatedAt', 'desc')

// 筛选面板字段配置
const filterFields = [
  {
    key: 'search',
    label: '搜索',
    type: 'text' as const,
    placeholder: '标题或作者',
  },
  {
    key: 'isR18',
    label: 'R18',
    type: 'select' as const,
    options: [
      { value: '', label: '全部' },
      { value: 'true', label: '是' },
      { value: 'false', label: '否' },
    ],
  },
  {
    key: 'status',
    label: '连载状态',
    type: 'select' as const,
    options: [
      { value: '', label: '全部' },
      { value: 'serializing', label: '连载中' },
      { value: 'completed', label: '已完结' },
    ],
  },
  {
    key: 'region',
    label: '地区',
    type: 'text' as const,
    placeholder: '地区',
  },
  {
    key: 'crawlStatus',
    label: '爬取状态',
    type: 'select' as const,
    options: [
      { value: '', label: '全部' },
      { value: 'pending', label: '等待中' },
      { value: 'partial', label: '部分完成' },
      { value: 'complete', label: '已完成' },
    ],
  },
]

// 批量操作
const { selected, toggleItem, clearSelection, selectedCount, selectedIds } = useBatchSelect(comics as any)

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
}>({
  title: '',
  message: '',
  operation: '',
})

// 编辑 Modal
const isEditModalOpen = ref(false)
const editingComic = ref<Comic | null>(null)
const updateLoading = ref(false)
const uploadLoading = ref(false)
const activeTab = ref<'metadata' | 'chapters'>('metadata')
const receiptQuery = typeof route.query.receipt === 'string' && /^\w[\w-]{0,127}$/.test(route.query.receipt.trim())
  ? route.query.receipt.trim()
  : ''
const receiptSourceTask = typeof route.query.sourceTask === 'string' && /^\w[\w-]{0,127}$/.test(route.query.sourceTask)
  ? route.query.sourceTask
  : ''
const receiptSourceRun = typeof route.query.sourceRun === 'string' && /^\w[\w-]{0,127}$/.test(route.query.sourceRun)
  ? route.query.sourceRun
  : ''
const receiptSourceAttempt = typeof route.query.sourceAttempt === 'string' && /^[1-9]\d{0,5}$/.test(route.query.sourceAttempt)
  ? route.query.sourceAttempt
  : ''
const receiptError = ref('')
let receiptHandled = false

const receiptReturnPath = receiptSourceTask && receiptSourceRun && receiptSourceAttempt
  ? `/dashboard/crawlers?${new URLSearchParams({ taskId: receiptSourceTask, runId: receiptSourceRun, attempt: receiptSourceAttempt })}`
  : ''

// 视图模式：card（卡片）| table（表格）
const viewMode = ref<'card' | 'table'>('card')

// 漫画表格列定义
const comicTableColumns = [
  { key: 'coverImage', label: '封面', width: '90px', minWidth: '90px', sortable: false },
  { key: 'title', label: '标题', minWidth: '160px', sortable: true },
  { key: 'author', label: '作者', width: '120px', minWidth: '100px' },
  { key: 'region', label: '地区', width: '80px', minWidth: '70px' },
  { key: 'isR18', label: 'R18', width: '60px', minWidth: '60px' },
  { key: 'status', label: '状态', width: '90px', minWidth: '80px' },
  { key: 'crawlStatus', label: '爬取', width: '90px', minWidth: '80px' },
  { key: 'chapterCount', label: '章节', width: '70px', minWidth: '60px' },
  { key: 'updatedAt', label: '更新时间', width: '160px', minWidth: '140px', sortable: true },
  { key: 'actions', label: '操作', width: '80px', minWidth: '70px', sortable: false },
]

// 章节管理
const chapters = ref<Chapter[]>([])
const chaptersLoading = ref(false)
const selectedChapterIds = ref<Set<string>>(new Set())
const chapterBatchDeleteOpen = ref(false)

// ─── 数据加载 ───────────────────────────────────────────────────────────────

async function loadComics() {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: limit.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...filters.value,
    }

    const response = await api.admin.getComics(params)
    comics.value = response.data
    setMeta(response.meta)
    error.value = ''
  }
  catch (e: unknown) {
    error.value = String(e)
    handleError(e, '加载漫画列表失败')
  }
  finally {
    loading.value = false
  }
}

// 监听页码 / 每页数量变化
watch(currentPage, () => loadComics(), { immediate: true })
watch(limit, () => loadComics())

// 监听排序变化
watch([sortBy, sortOrder], () => loadComics())

// 监听筛选条件变化（URL 已含 page=1，直接加载即可）
watch(
  [
    () => filters.value.search,
    () => filters.value.isR18,
    () => filters.value.status,
    () => filters.value.region,
    () => filters.value.crawlStatus,
  ],
  () => loadComics(),
)

// ─── 编辑 Modal ──────────────────────────────────────────────────────────────

function openEditModal(comic: Comic) {
  editingComic.value = { ...comic }
  isEditModalOpen.value = true
  activeTab.value = 'metadata'
  selectedChapterIds.value.clear()
  if (comic.id) {
    loadChapters(comic.id)
  }
}

async function openReceiptContent(): Promise<void> {
  if (receiptHandled)
    return
  receiptHandled = true
  if (!receiptQuery) {
    if (typeof route.query.receipt === 'string')
      receiptError.value = 'receipt 缺少受控的 primaryContentId，未打开内容编辑器。'
    return
  }
  try {
    const response = await api.admin.getComic(receiptQuery)
    openEditModal(response.data)
  }
  catch (e: unknown) {
    receiptError.value = '无法读取已验证的漫画 receipt（可能已失效或无权访问）。'
    handleError(e, '加载已验证漫画 receipt 失败')
  }
}

onMounted(() => {
  void openReceiptContent()
})

async function loadChapters(comicId: string) {
  chaptersLoading.value = true
  try {
    chapters.value = await api.admin.getChapters(comicId)
  }
  catch (e) {
    handleError(e, '加载章节列表失败')
  }
  finally {
    chaptersLoading.value = false
  }
}

async function handleUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !editingComic.value)
    return

  uploadLoading.value = true
  try {
    const uploadResult = await api.upload.uploadImage(file, 'cover')
    editingComic.value.coverImage = uploadResult.url
  }
  catch (e: unknown) {
    handleError(e, '上传封面失败')
  }
  finally {
    uploadLoading.value = false
  }
}

async function handleUpdate() {
  if (!editingComic.value?.id)
    return

  updateLoading.value = true
  try {
    await api.admin.updateComic(editingComic.value.id, {
      title: editingComic.value.title,
      author: editingComic.value.author ?? '',
      description: editingComic.value.description ?? '',
      isR18: editingComic.value.isR18,
      metadataLocked: editingComic.value.metadataLocked,
      status: editingComic.value.status as any,
      region: editingComic.value.region ?? '',
      genres: Array.isArray(editingComic.value.genres)
        ? editingComic.value.genres
        : (typeof editingComic.value.genres === 'string' ? (editingComic.value.genres as string).split(',').map(s => s.trim()).filter(Boolean) : []),
    })

    success('漫画信息更新成功')
    isEditModalOpen.value = false
    await loadComics()
  }
  catch (e: unknown) {
    handleError(e, '更新漫画失败')
  }
  finally {
    updateLoading.value = false
  }
}

async function toggleR18Shortcut(comic: Comic) {
  const newValue = !comic.isR18
  try {
    if (comic.id) {
      await api.admin.updateComic(comic.id, { isR18: newValue })
      comic.isR18 = newValue
    }
  }
  catch (e) {
    handleError(e, '快速更新失败')
  }
}

// ─── 章节批量删除 ────────────────────────────────────────────────────────────

function toggleChapter(chapterId: string) {
  if (selectedChapterIds.value.has(chapterId)) {
    selectedChapterIds.value.delete(chapterId)
  }
  else {
    selectedChapterIds.value.add(chapterId)
  }
  selectedChapterIds.value = new Set(selectedChapterIds.value)
}

function toggleAllChapters() {
  if (selectedChapterIds.value.size === chapters.value.length) {
    selectedChapterIds.value.clear()
  }
  else {
    chapters.value.forEach(c => selectedChapterIds.value.add(c.id))
  }
  selectedChapterIds.value = new Set(selectedChapterIds.value)
}

async function deleteSingleChapter(chapterId: string) {
  try {
    await api.admin.deleteChapter(chapterId)
    chapters.value = chapters.value.filter(c => c.id !== chapterId)
    success('章节已删除')
  }
  catch (e) {
    handleError(e, '删除章节失败')
  }
}

async function executeChapterBatchDelete() {
  if (!editingComic.value?.id || selectedChapterIds.value.size === 0)
    return

  try {
    const chapterIds = [...selectedChapterIds.value]
    await api.admin.bulkDeleteChapters(editingComic.value.id, chapterIds)
    chapters.value = chapters.value.filter(c => !selectedChapterIds.value.has(c.id))
    selectedChapterIds.value.clear()
    success(`已删除 ${chapterIds.length} 个章节`)
  }
  catch (e) {
    handleError(e, '批量删除章节失败')
  }
  finally {
    chapterBatchDeleteOpen.value = false
  }
}

// ─── 漫画批量操作 ────────────────────────────────────────────────────────────

function handleBatchOperation(operationId: string) {
  confirmDialogData.value = {
    title: '确认批量操作',
    message: `即将对 ${selectedCount.value} 部漫画执行操作`,
    operation: operationId,
  }

  if (operationId === 'delete') {
    confirmDialogData.value.title = '⚠️ 确认批量删除'
    confirmDialogData.value.message = `此操作将删除 ${selectedCount.value} 部漫画，不可撤销`
  }

  confirmDialogOpen.value = true
}

async function executeBatchOperation() {
  const { operation } = confirmDialogData.value
  const ids = [...selectedIds.value]
  const total = ids.length

  if (operation === 'delete') {
    const progressId = showProgress('正在删除漫画...')
    let successCount = 0
    let failedCount = 0

    try {
      for (let i = 0; i < ids.length; i++) {
        try {
          await api.admin.deleteComic(ids[i])
          successCount++
        }
        catch {
          failedCount++
        }
        updateProgress(progressId, Math.round(((i + 1) / total) * 100))
      }

      hideProgress(progressId)

      if (failedCount === 0) {
        success(`成功删除 ${successCount} 部漫画`)
      }
      else {
        warning(`完成删除: 成功 ${successCount} 部，失败 ${failedCount} 部`)
      }

      clearSelection()
      await loadComics()
    }
    catch (e) {
      hideProgress(progressId)
      handleError(e, '批量删除失败')
    }
  }
  else {
    try {
      await api.admin.bulkOperationComics(selectedIds.value, operation)
      success(`成功对 ${selectedCount.value} 部漫画执行了操作`)
      clearSelection()
      await loadComics()
    }
    catch (e) {
      handleError(e, '批量操作失败')
    }
  }
}
</script>

<template>
  <div class="space-y-6 relative">
    <div v-if="receiptError" class="receipt-error" role="alert">
      <span>{{ receiptError }}</span>
      <a v-if="receiptReturnPath" :href="receiptReturnPath">返回任务详情</a>
    </div>
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {{ t('dashboard.comic_library') }}
        </h2>
        <p class="text-neutral-500 mt-1">
          共 {{ total }} 部漫画
        </p>
      </div>
      <button
        class="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        @click="loadComics"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
    </div>

    <!-- FilterPanel -->
    <FilterPanel
      v-model="filters"
      :fields="filterFields"
      :loading="loading"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <!-- 工具栏：排序 + 批量操作 -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <label class="text-neutral-500">排序:</label>
        <select
          :value="sortBy"
          class="px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-900"
          @change="updateSort(($event.target as HTMLSelectElement).value)"
        >
          <option value="updatedAt">
            更新时间
          </option>
          <option value="createdAt">
            创建时间
          </option>
          <option value="title">
            标题
          </option>
          <option value="sortOrder">
            人工排序
          </option>
        </select>
        <select
          :value="sortOrder"
          class="px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-900"
          @change="updateSort(sortBy, ($event.target as HTMLSelectElement).value as 'asc' | 'desc')"
        >
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

      <button
        v-if="selectedCount > 0"
        class="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        @click="clearSelection"
      >
        取消选择
      </button>

      <!-- 视图切换 -->
      <div class="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 p-1">
        <button
          class="view-toggle-btn"
          :class="viewMode === 'card' ? 'view-toggle-active' : ''"
          title="卡片视图"
          @click="viewMode = 'card'"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <button
          class="view-toggle-btn"
          :class="viewMode === 'table' ? 'view-toggle-active' : ''"
          title="表格视图"
          @click="viewMode = 'table'"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 10h18M3 14h18M10 3v18" />
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading / Error States -->
    <div v-if="loading && comics.length === 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <SkeletonCard v-for="i in 6" :key="i" variant="image" />
    </div>

    <div
      v-else-if="error"
      class="p-6 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex flex-col items-center"
    >
      <p class="font-bold">
        Error
      </p>
      <p class="text-sm mt-1">
        {{ error }}
      </p>
      <button class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm" @click="loadComics">
        Retry
      </button>
    </div>

    <!-- 表格视图 -->
    <DataTable
      v-else-if="viewMode === 'table'"
      :data="comics"
      :columns="comicTableColumns"
      :loading="loading"
      :selectable="true"
      :selected-ids="selected"
      min-width="900px"
      empty-message="暂无漫画数据"
      @toggle-select="(id) => toggleItem(id)"
      @toggle-select-all="() => {}"
      @row-click="(item) => openEditModal(item as Comic)"
    >
      <template #cell-coverImage="{ item }">
        <div class="comic-cover-cell">
          <img v-if="(item as Comic).coverImage" :src="(item as Comic).coverImage!" class="comic-cover-thumb" :alt="(item as Comic).title">
          <div v-else class="comic-cover-placeholder">
            <svg class="h-5 w-5 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        </div>
      </template>
      <template #cell-isR18="{ item }">
        <span class="comic-badge" :class="(item as Comic).isR18 ? 'badge-r18' : 'badge-safe'">
          {{ (item as Comic).isR18 ? 'R18' : '一般' }}
        </span>
      </template>
      <template #cell-status="{ item }">
        <span class="comic-badge badge-status">
          {{ (item as Comic).status === 'serializing' ? '连载中' : (item as Comic).status === 'completed' ? '已完结' : '-' }}
        </span>
      </template>
      <template #cell-crawlStatus="{ item }">
        <span class="comic-badge" :class="(item as any).crawlStatus === 'complete' ? 'badge-complete' : 'badge-pending'">
          {{ (item as any).crawlStatus === 'complete' ? '完成' : (item as any).crawlStatus === 'pending' ? '等待' : '部分' }}
        </span>
      </template>
      <template #cell-updatedAt="{ item }">
        {{ (item as any).updatedAt ? new Date((item as any).updatedAt).toLocaleDateString('zh-CN') : '-' }}
      </template>
      <template #cell-chapterCount="{ item }">
        {{ (item as any).chapterCount ?? '-' }}
      </template>
      <template #cell-actions="{ item }">
        <div style="display:flex;gap:4px;align-items:center" @click.stop>
          <a
            :href="`/comic/${(item as Comic).slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn-link"
            title="在客户端查看"
          >
            <svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            查看
          </a>
        </div>
      </template>
    </DataTable>

    <!-- Comic Grid（卡片视图） -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-for="comic in comics"
        :key="comic.slug"
        class="group relative bg-white dark:bg-neutral-900 border rounded-2xl overflow-hidden flex shadow-sm hover:shadow-md transition-all"
        :class="comic.id && selected.has(comic.id) ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-neutral-200 dark:border-neutral-800'"
      >
        <!-- 批量选择复选框 -->
        <div
          class="absolute top-2 left-2 z-10"
          @click.stop="comic.id && toggleItem(comic.id)"
        >
          <input
            type="checkbox"
            :checked="!!(comic.id && selected.has(comic.id))"
            class="w-4 h-4 rounded accent-blue-600 cursor-pointer"
            @click.stop
            @change="comic.id && toggleItem(comic.id)"
          >
        </div>

        <!-- Cover Preview -->
        <div class="w-28 shrink-0 bg-neutral-100 dark:bg-neutral-800 relative">
          <img v-if="comic.coverImage" :src="comic.coverImage" class="w-full h-full object-cover">
          <div v-else class="w-full h-full flex items-center justify-center text-neutral-400">
            <svg class="w-8 h-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div
            v-if="comic.isR18"
            class="absolute bottom-1 right-1 bg-red-500 text-[8px] text-white font-black px-1 rounded uppercase"
          >
            R18
          </div>
          <div
            v-if="comic.metadataLocked"
            class="absolute top-1 right-1 bg-amber-500 text-[8px] text-white font-black px-1 rounded uppercase"
          >
            LOCKED
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 p-4 flex flex-col">
          <div class="flex-1">
            <h3 class="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {{ comic.title }}
            </h3>
            <p class="text-xs text-neutral-500 mt-1">
              {{ comic.author || t('dashboard.unknown_author') }}
            </p>
          </div>

          <div class="mt-4 flex items-center justify-between">
            <div class="flex gap-1">
              <button
                class="text-[10px] font-bold px-2 py-0.5 rounded border transition-colors"
                :class="comic.isR18 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'"
                @click="toggleR18Shortcut(comic)"
              >
                {{ comic.isR18 ? 'R18' : t('dashboard.safe') }}
              </button>
            </div>
            <button
              class="text-xs font-medium text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              @click="openEditModal(comic)"
            >
              {{ t('dashboard.edit_details') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <Pagination
      v-if="loading || totalPages > 1"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="total"
      :loading="loading"
      :page-size="limit"
      :page-sizes="[10, 18, 30, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      :background="true"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />

    <!-- Detail drawer -->
    <DetailDrawer
      :open="isEditModalOpen && !!editingComic"
      :title="editingComic?.title ?? '编辑漫画'"
      :description="editingComic?.slug ?? ''"
      width="lg"
      @update:open="isEditModalOpen = $event"
    >
      <div v-if="editingComic" class="drawer-content flex min-h-full flex-col gap-4">
        <!-- Section header -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div class="flex min-w-0 items-center gap-3">
            <h3 class="text-base font-semibold text-foreground">
              {{ t('dashboard.edit_comic') }}
            </h3>
            <!-- Tabs -->
            <div class="flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted p-1">
              <button
                class="h-8 rounded-sm px-3 text-xs font-medium transition-colors"
                :class="activeTab === 'metadata' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'"
                @click="activeTab = 'metadata'"
              >
                Metadata
              </button>
              <button
                class="h-8 rounded-sm px-3 text-xs font-medium transition-colors"
                :class="activeTab === 'chapters' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'"
                @click="activeTab = 'chapters'"
              >
                Chapters ({{ chapters.length }})
              </button>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1">
          <!-- Metadata Tab -->
          <div v-if="activeTab === 'metadata'" class="space-y-4">
            <!-- Lock Metadata Toggle -->
            <div
              class="flex items-center justify-between gap-4 rounded-md border border-primary/20 bg-primary/5 p-4"
            >
              <div>
                <p class="text-sm font-semibold text-primary">
                  Lock Metadata
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  Prevent crawler from overwriting title, tags, and description.
                </p>
              </div>
              <input
                v-model="editingComic.metadataLocked" type="checkbox"
                class="h-4 w-4 cursor-pointer accent-primary"
              >
            </div>

            <!-- Cover Image -->
            <div class="space-y-2.5">
              <label class="text-sm font-medium text-foreground">{{ t('dashboard.cover_image') }}</label>
              <div class="flex items-start gap-4">
                <div
                  class="relative h-24 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                >
                  <img v-if="editingComic.coverImage" :src="editingComic.coverImage" class="w-full h-full object-cover">
                  <div v-if="uploadLoading" class="absolute inset-0 flex items-center justify-center bg-foreground/55">
                    <svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                </div>
                <div class="flex-1">
                  <input
                    v-model="editingComic.coverImage" type="text"
                    class="mb-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
                    placeholder="https://..."
                  >
                  <label
                    class="inline-flex h-8 items-center rounded-md border border-border bg-muted px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <svg class="w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {{ t('dashboard.upload_new_cover') }}
                    <input type="file" class="hidden" accept="image/*" @change="handleUpload">
                  </label>
                </div>
              </div>
            </div>

            <!-- Title -->
            <div class="space-y-2.5">
              <label class="text-sm font-medium text-foreground">{{ t('dashboard.comic_title') }}</label>
              <input
                v-model="editingComic.title"
                class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
              >
            </div>

            <!-- Author -->
            <div class="space-y-2.5">
              <label class="text-sm font-medium text-foreground">{{ t('dashboard.author') }}</label>
              <input
                v-model="editingComic.author"
                class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
              >
            </div>

            <!-- Region + Status -->
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2.5">
                <label class="text-sm font-medium text-foreground">{{ t('dashboard.region') }}</label>
                <input
                  v-model="editingComic.region"
                  class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
                >
              </div>
              <div class="space-y-2.5">
                <label class="text-sm font-medium text-foreground">{{ t('dashboard.status') }}</label>
                <select
                  v-model="editingComic.status"
                  class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/15"
                >
                  <option value="serializing">
                    {{ t('dashboard.serializing') }}
                  </option>
                  <option value="completed">
                    {{ t('dashboard.completed') }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Genres -->
            <div class="space-y-2.5">
              <label class="text-sm font-medium text-foreground">{{ t('dashboard.genres') }}</label>
              <input
                :value="Array.isArray(editingComic.genres) ? editingComic.genres.join(', ') : editingComic.genres"
                class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
                @input="e => editingComic!.genres = (e.target as HTMLInputElement).value.split(',').map(s => s.trim())"
              >
            </div>

            <!-- Description -->
            <div class="space-y-2.5">
              <label class="text-sm font-medium text-foreground">{{ t('dashboard.description') }}</label>
              <textarea
                v-model="editingComic.description" rows="3"
                class="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
              />
            </div>

            <!-- R18 Toggle -->
            <div
              class="flex items-center justify-between gap-4 rounded-md border border-destructive/20 bg-destructive/5 p-4"
            >
              <div>
                <p class="text-sm font-semibold text-destructive">
                  {{ t('dashboard.r18_content') }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ t('dashboard.enables_age_verification') }}
                </p>
              </div>
              <input v-model="editingComic.isR18" type="checkbox" class="h-4 w-4 cursor-pointer accent-destructive">
            </div>
          </div>

          <!-- Chapters Tab -->
          <div v-else class="space-y-4">
            <div v-if="chaptersLoading" class="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              加载章节中...
            </div>
            <div v-else-if="chapters.length === 0" class="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              暂无章节数据
            </div>
            <div v-else>
              <!-- 全选 + 批量删除按钮 -->
              <div class="mb-3 flex items-center justify-between gap-3">
                <label class="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    :checked="selectedChapterIds.size === chapters.length && chapters.length > 0"
                    class="h-4 w-4 accent-primary"
                    @change="toggleAllChapters"
                  >
                  全选（{{ selectedChapterIds.size }}/{{ chapters.length }}）
                </label>
                <button
                  v-if="selectedChapterIds.size > 0"
                  class="inline-flex h-8 items-center rounded-md border border-destructive/25 bg-destructive/5 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  @click="chapterBatchDeleteOpen = true"
                >
                  批量删除 {{ selectedChapterIds.size }} 个章节
                </button>
              </div>

              <div class="overflow-x-auto rounded-md border border-border">
                <table class="min-w-full text-left text-sm">
                  <thead class="bg-muted text-xs font-medium text-muted-foreground">
                    <tr>
                      <th class="w-10 px-3 py-2.5" />
                      <th class="px-4 py-2.5">
                        #
                      </th>
                      <th class="px-4 py-2.5">
                        标题
                      </th>
                      <th class="px-4 py-2.5 text-right">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="chapter in chapters" :key="chapter.id"
                      class="border-b border-border transition-colors last:border-b-0 hover:bg-accent/60"
                      :class="{ 'bg-primary/5': selectedChapterIds.has(chapter.id) }"
                    >
                      <td class="px-3 py-2.5">
                        <input
                          type="checkbox"
                          :checked="selectedChapterIds.has(chapter.id)"
                          class="h-4 w-4 cursor-pointer accent-primary"
                          @change="toggleChapter(chapter.id)"
                        >
                      </td>
                      <td class="px-4 py-2.5 text-muted-foreground">
                        {{ chapter.sortOrder }}
                      </td>
                      <td class="px-4 py-2.5 font-medium text-foreground">
                        {{ chapter.title }}
                        <span v-if="chapter.slug" class="ml-2 font-mono text-[10px] text-muted-foreground">{{ chapter.slug }}</span>
                      </td>
                      <td class="px-4 py-2.5 text-right">
                        <button
                          class="text-xs font-medium text-destructive transition-colors hover:text-destructive/80"
                          @click="deleteSingleChapter(chapter.id)"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div v-if="editingComic" class="flex w-full gap-3">
          <button
            class="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            @click="isEditModalOpen = false"
          >
            {{ t('dashboard.cancel') }}
          </button>
          <button
            v-if="activeTab === 'metadata'"
            :disabled="updateLoading"
            class="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            @click="handleUpdate"
          >
            {{ updateLoading ? t('dashboard.saving') : t('dashboard.save_changes') }}
          </button>
        </div>
      </template>
    </DetailDrawer>

    <!-- 漫画批量操作确认对话框 -->
    <ConfirmDialog
      v-model:open="confirmDialogOpen"
      :title="confirmDialogData.title"
      :message="confirmDialogData.message"
      @confirm="executeBatchOperation"
    />

    <!-- 章节批量删除确认对话框 -->
    <ConfirmDialog
      v-model:open="chapterBatchDeleteOpen"
      title="确认批量删除章节"
      :message="`确认删除选中的 ${selectedChapterIds.size} 个章节？此操作不可撤销。`"
      @confirm="executeChapterBatchDelete"
    />
  </div>
</template>

<style scoped>
.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border-radius: 0.375rem;
  color: #6b7280;
  transition: all 0.15s;
  cursor: pointer;
  background: transparent;
  border: none;
}

.receipt-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  background: #fef2f2;
  color: #b91c1c;
}

.receipt-error a { color: #1d4ed8; text-decoration: underline; }

.view-toggle-btn:hover {
  color: #111827;
  background: #f3f4f6;
}

.view-toggle-active {
  background: white;
  color: #1d4ed8;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

/* 漫画表格缩略图 */
.comic-cover-cell {
  width: 56px;
  height: 75px;
  border-radius: 4px;
  overflow: hidden;
  background: #f3f4f6;
  flex-shrink: 0;
}

.comic-cover-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.comic-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.comic-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-r18 { background: #fee2e2; color: #dc2626; }
.badge-safe { background: #f3f4f6; color: #6b7280; }
.badge-status { background: #eff6ff; color: #2563eb; }
.badge-complete { background: #d1fae5; color: #065f46; }
.badge-pending { background: #fef3c7; color: #92400e; }

.action-btn-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.action-btn-link:hover {
  background: #dbeafe;
}
</style>
