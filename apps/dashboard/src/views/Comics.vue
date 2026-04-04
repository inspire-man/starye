<script setup lang="ts">
import type { Chapter, Comic } from '@/lib/api'
import { ConfirmDialog, FilterPanel, Pagination, SkeletonCard, useFilters, usePagination, useToast } from '@starye/ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BatchOperationMenu from '@/components/BatchOperationMenu.vue'
import { useBatchSelect } from '@/composables/useBatchSelect'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { useSorting } from '@/composables/useSorting'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'

const { t } = useI18n()
useSession()

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
    const presignRes = await api.upload.presign(file.name, file.type)
    await fetch(presignRes.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    editingComic.value.coverImage = presignRes.publicUrl
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
      author: editingComic.value.author,
      description: editingComic.value.description,
      isR18: editingComic.value.isR18,
      metadataLocked: editingComic.value.metadataLocked,
      status: editingComic.value.status as any,
      region: editingComic.value.region,
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
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <!-- 工具栏：排序 + 批量操作 -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 text-sm">
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

    <!-- Comic Grid -->
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
      v-if="totalPages > 1"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="total"
      :page-size="limit"
      :page-sizes="[10, 18, 30, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      :background="true"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />

    <!-- Edit Modal -->
    <div
      v-if="isEditModalOpen && editingComic"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"
      >
        <!-- Header -->
        <div class="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-4">
            <h3 class="text-xl font-bold">
              {{ t('dashboard.edit_comic') }}
            </h3>
            <!-- Tabs -->
            <div class="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
              <button
                class="px-3 py-1 text-xs font-bold rounded-md transition-all"
                :class="activeTab === 'metadata' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'"
                @click="activeTab = 'metadata'"
              >
                Metadata
              </button>
              <button
                class="px-3 py-1 text-xs font-bold rounded-md transition-all"
                :class="activeTab === 'chapters' ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'"
                @click="activeTab = 'chapters'"
              >
                Chapters ({{ chapters.length }})
              </button>
            </div>
          </div>
          <button
            class="text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            @click="isEditModalOpen = false"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Content (Scrollable) -->
        <div class="p-8 overflow-y-auto flex-1">
          <!-- Metadata Tab -->
          <div v-if="activeTab === 'metadata'" class="space-y-5">
            <!-- Lock Metadata Toggle -->
            <div
              class="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/50"
            >
              <div>
                <p class="font-bold text-sm text-amber-700 dark:text-amber-500">
                  Lock Metadata
                </p>
                <p class="text-[10px] text-amber-600/80 dark:text-amber-500/80">
                  Prevent crawler from overwriting title, tags, and description.
                </p>
              </div>
              <input
                v-model="editingComic.metadataLocked" type="checkbox"
                class="w-5 h-5 accent-amber-600 cursor-pointer"
              >
            </div>

            <!-- Cover Image -->
            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.cover_image') }}</label>
              <div class="flex items-center gap-4">
                <div
                  class="w-16 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 relative group"
                >
                  <img v-if="editingComic.coverImage" :src="editingComic.coverImage" class="w-full h-full object-cover">
                  <div v-if="uploadLoading" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                </div>
                <div class="flex-1">
                  <input
                    v-model="editingComic.coverImage" type="text"
                    class="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent mb-2"
                    placeholder="https://..."
                  >
                  <label
                    class="inline-flex items-center px-3 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
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
            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.comic_title') }}</label>
              <input
                v-model="editingComic.title"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none"
              >
            </div>

            <!-- Author -->
            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.author') }}</label>
              <input
                v-model="editingComic.author"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none"
              >
            </div>

            <!-- Region + Status -->
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.region') }}</label>
                <input
                  v-model="editingComic.region"
                  class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none text-sm"
                >
              </div>
              <div class="space-y-2">
                <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.status') }}</label>
                <select
                  v-model="editingComic.status"
                  class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none text-sm appearance-none"
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
            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.genres') }}</label>
              <input
                :value="Array.isArray(editingComic.genres) ? editingComic.genres.join(', ') : editingComic.genres"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none text-sm"
                @input="e => editingComic!.genres = (e.target as HTMLInputElement).value.split(',').map(s => s.trim())"
              >
            </div>

            <!-- Description -->
            <div class="space-y-2">
              <label class="text-xs font-black uppercase tracking-widest text-neutral-500">{{ t('dashboard.description') }}</label>
              <textarea
                v-model="editingComic.description" rows="3"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent focus:ring-2 ring-primary transition-all outline-none text-sm resize-none"
              />
            </div>

            <!-- R18 Toggle -->
            <div
              class="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800"
            >
              <div>
                <p class="font-bold text-sm text-red-600">
                  {{ t('dashboard.r18_content') }}
                </p>
                <p class="text-[10px] text-neutral-500">
                  {{ t('dashboard.enables_age_verification') }}
                </p>
              </div>
              <input v-model="editingComic.isR18" type="checkbox" class="w-5 h-5 accent-red-600 cursor-pointer">
            </div>
          </div>

          <!-- Chapters Tab -->
          <div v-else class="space-y-4">
            <div v-if="chaptersLoading" class="text-center py-8 text-neutral-500">
              加载章节中...
            </div>
            <div v-else-if="chapters.length === 0" class="text-center py-8 text-neutral-500">
              暂无章节数据
            </div>
            <div v-else>
              <!-- 全选 + 批量删除按钮 -->
              <div class="flex items-center justify-between mb-3">
                <label class="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="selectedChapterIds.size === chapters.length && chapters.length > 0"
                    class="w-4 h-4 accent-blue-600"
                    @change="toggleAllChapters"
                  >
                  全选（{{ selectedChapterIds.size }}/{{ chapters.length }}）
                </label>
                <button
                  v-if="selectedChapterIds.size > 0"
                  class="text-xs font-bold px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  @click="chapterBatchDeleteOpen = true"
                >
                  批量删除 {{ selectedChapterIds.size }} 个章节
                </button>
              </div>

              <div class="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <table class="w-full text-sm text-left">
                  <thead class="bg-neutral-50 dark:bg-neutral-800 text-xs uppercase text-neutral-500 font-bold">
                    <tr>
                      <th class="px-3 py-3 w-10" />
                      <th class="px-4 py-3">
                        #
                      </th>
                      <th class="px-4 py-3">
                        标题
                      </th>
                      <th class="px-4 py-3 text-right">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
                    <tr
                      v-for="chapter in chapters" :key="chapter.id"
                      class="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      :class="{ 'bg-blue-50 dark:bg-blue-900/10': selectedChapterIds.has(chapter.id) }"
                    >
                      <td class="px-3 py-3">
                        <input
                          type="checkbox"
                          :checked="selectedChapterIds.has(chapter.id)"
                          class="w-4 h-4 accent-blue-600 cursor-pointer"
                          @change="toggleChapter(chapter.id)"
                        >
                      </td>
                      <td class="px-4 py-3 text-neutral-500">
                        {{ chapter.sortOrder }}
                      </td>
                      <td class="px-4 py-3 font-medium">
                        {{ chapter.title }}
                        <span v-if="chapter.slug" class="ml-2 text-[10px] text-neutral-400 font-mono">{{ chapter.slug }}</span>
                      </td>
                      <td class="px-4 py-3 text-right">
                        <button
                          class="text-red-600 hover:text-red-700 font-bold text-xs"
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

        <!-- Footer -->
        <div
          class="p-6 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 flex gap-3 shrink-0"
        >
          <button
            class="flex-1 px-4 py-3 rounded-xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
            @click="isEditModalOpen = false"
          >
            {{ t('dashboard.cancel') }}
          </button>
          <button
            v-if="activeTab === 'metadata'"
            :disabled="updateLoading"
            class="flex-1 px-4 py-3 bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all"
            @click="handleUpdate"
          >
            {{ updateLoading ? t('dashboard.saving') : t('dashboard.save_changes') }}
          </button>
        </div>
      </div>
    </div>

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
