<script setup lang="ts">
/**
 * 名字映射管理页面
 *
 * 功能：
 * - 查看未匹配的女优/厂商清单
 * - 手动添加名字映射
 * - 查看现有映射
 * - 删除错误映射
 */

import { DetailDrawer, Pagination } from '@starye/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { fetchApi } from '@/lib/api'

interface UnmappedActor {
  name: string
  movieCount?: number
  attempts?: string[]
  lastAttempt?: number
}

const activeTab = ref<'actors' | 'publishers'>('actors')
const loading = ref(false)
const error = ref('')

// 未匹配清单
const unmappedActors = ref<UnmappedActor[]>([])
const unmappedPublishers = ref<UnmappedActor[]>([])

// 添加映射表单
const showAddForm = ref(false)
const addForm = ref({
  javbusName: '',
  wikiUrl: '',
})
const addLoading = ref(false)
const addError = ref('')

// 筛选和排序
const searchQuery = ref('')
const sortBy = ref<'name' | 'movieCount'>('movieCount')
const sortOrder = ref<'asc' | 'desc'>('desc')
const minMovieCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(1)
const totalItems = ref(0)
const selectedMapping = ref<UnmappedActor | null>(null)
const mappingDrawerOpen = ref(false)

// 计算过滤后的列表
const filteredUnmapped = computed(() => {
  const list = activeTab.value === 'actors' ? unmappedActors.value : unmappedPublishers.value

  const filtered = list.filter((item) => {
    if (searchQuery.value && !item.name.toLowerCase().includes(searchQuery.value.toLowerCase())) {
      return false
    }
    if (minMovieCount.value > 0 && (item.movieCount || 0) < minMovieCount.value) {
      return false
    }
    return true
  })

  // 排序
  filtered.sort((a, b) => {
    const aVal = sortBy.value === 'name' ? a.name : (a.movieCount || 0)
    const bVal = sortBy.value === 'name' ? b.name : (b.movieCount || 0)

    if (typeof aVal === 'string') {
      return sortOrder.value === 'asc'
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal)
    }
    else {
      return sortOrder.value === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    }
  })

  return filtered
})

const pagedUnmapped = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredUnmapped.value.slice(start, start + pageSize.value)
})

function syncPagination() {
  totalItems.value = filteredUnmapped.value.length
  totalPages.value = Math.max(1, Math.ceil(totalItems.value / pageSize.value))
  if (currentPage.value > totalPages.value)
    currentPage.value = totalPages.value
}

function resetToFirstPage() {
  currentPage.value = 1
  syncPagination()
}

function openMappingDetails(item: UnmappedActor) {
  selectedMapping.value = item
  mappingDrawerOpen.value = true
}

function closeMappingDetails() {
  mappingDrawerOpen.value = false
  selectedMapping.value = null
}

function prepareMapping(item: UnmappedActor) {
  addForm.value.javbusName = item.name
  showAddForm.value = true
  closeMappingDetails()
}

watch([filteredUnmapped, pageSize], syncPagination, { immediate: true })
watch([activeTab, searchQuery, minMovieCount, sortBy, sortOrder], resetToFirstPage)

async function loadUnmappedData() {
  loading.value = true
  error.value = ''

  try {
    // 注意：这些端点需要在 API 中实现
    // 作为简化，我们可以直接从文件系统读取（如果 API 支持）
    // 或者通过爬虫脚本生成并上传到 R2/D1

    const actorsResponse = await fetchApi<{ data: UnmappedActor[] }>('/admin/crawlers/unmapped-actors')
    unmappedActors.value = actorsResponse.data || []

    const publishersResponse = await fetchApi<{ data: UnmappedActor[] }>('/admin/crawlers/unmapped-publishers')
    unmappedPublishers.value = publishersResponse.data || []
  }
  catch (e: any) {
    error.value = e.message || '加载失败'
    console.error('Failed to load unmapped data:', e)

    // 如果 API 不存在，显示提示信息
    if (e.message?.includes('404')) {
      error.value = 'API 端点未实现。请先在后端添加 /admin/crawlers/unmapped-actors 和 /admin/crawlers/unmapped-publishers 端点。'
    }
  }
  finally {
    loading.value = false
  }
}

async function addMapping() {
  if (!addForm.value.javbusName.trim() || !addForm.value.wikiUrl.trim()) {
    addError.value = 'JavBus 名字和 Wiki URL 不能为空'
    return
  }

  addLoading.value = true
  addError.value = ''

  try {
    // 注意：这个端点需要在 API 中实现
    await fetchApi('/admin/crawlers/add-mapping', {
      method: 'POST',
      body: JSON.stringify({
        type: activeTab.value === 'actors' ? 'actor' : 'publisher',
        javbusName: addForm.value.javbusName.trim(),
        wikiUrl: addForm.value.wikiUrl.trim(),
      }),
    })

    // 清空表单
    addForm.value = { javbusName: '', wikiUrl: '' }
    showAddForm.value = false

    // 重新加载数据
    await loadUnmappedData()
  }
  catch (e: any) {
    addError.value = e.message || '添加失败'
    console.error('Failed to add mapping:', e)
  }
  finally {
    addLoading.value = false
  }
}

function formatDate(timestamp?: number) {
  if (!timestamp)
    return '-'
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN')
}

function getPriorityBadge(movieCount?: number) {
  if (!movieCount)
    return 'P3'
  if (movieCount > 100)
    return 'P0'
  if (movieCount > 50)
    return 'P1'
  if (movieCount > 20)
    return 'P2'
  return 'P3'
}

function getPriorityClass(movieCount?: number) {
  const priority = getPriorityBadge(movieCount)
  switch (priority) {
    case 'P0': return 'priority-p0'
    case 'P1': return 'priority-p1'
    case 'P2': return 'priority-p2'
    default: return 'priority-p3'
  }
}

onMounted(() => {
  loadUnmappedData()
})
</script>

<template>
  <div class="name-mapping-management dashboard-list-page">
    <!-- Tab 切换 -->
    <div class="tabs tabs-order">
      <button
        class="tab" :class="[{ active: activeTab === 'actors' }]"
        @click="activeTab = 'actors'"
      >
        女优 ({{ unmappedActors.length }})
      </button>
      <button
        class="tab" :class="[{ active: activeTab === 'publishers' }]"
        @click="activeTab = 'publishers'"
      >
        厂商 ({{ unmappedPublishers.length }})
      </button>
    </div>

    <!-- 筛选工具栏 -->
    <div class="toolbar list-toolbar toolbar-order">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜索名字..."
      >

      <select v-model="sortBy" class="select">
        <option value="movieCount">
          作品数量
        </option>
        <option value="name">
          名字
        </option>
      </select>

      <select v-model="sortOrder" class="select">
        <option value="desc">
          降序
        </option>
        <option value="asc">
          升序
        </option>
      </select>

      <div class="form-group">
        <label>最少作品数</label>
        <input
          v-model.number="minMovieCount"
          type="number"
          min="0"
          class="form-input"
          style="width: 100px;"
        >
      </div>

      <button class="btn-secondary" @click="loadUnmappedData">
        刷新
      </button>
      <button
        class="list-toolbar-primary"
        type="button"
        @click="showAddForm = !showAddForm"
      >
        {{ showAddForm ? '取消添加' : '添加映射' }}
      </button>
    </div>

    <!-- 添加映射表单 -->
    <div v-if="showAddForm" class="add-form-card add-form-order">
      <h3>添加新映射</h3>
      <div class="form">
        <div class="form-row">
          <div class="form-group">
            <label>JavBus 名字</label>
            <input
              v-model="addForm.javbusName"
              type="text"
              class="form-input"
              placeholder="如：三佳詩"
            >
          </div>
          <div class="form-group">
            <label>SeesaaWiki URL</label>
            <input
              v-model="addForm.wikiUrl"
              type="text"
              class="form-input"
              placeholder="https://seesaawiki.jp/w/sougouwiki/d/..."
            >
          </div>
        </div>

        <div v-if="addError" class="error-message">
          {{ addError }}
        </div>

        <div class="form-actions">
          <button
            class="btn-primary"
            :disabled="addLoading"
            @click="addMapping"
          >
            {{ addLoading ? '添加中...' : '添加' }}
          </button>
          <button
            class="btn-secondary"
            @click="showAddForm = false"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      加载中...
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <p class="error-hint">
        提示：映射数据需要通过爬虫脚本生成。请确保已运行索引爬虫并生成了 .unmapped-actors.json 和 .unmapped-publishers.json 文件。
      </p>
    </div>

    <!-- 未匹配列表 -->
    <template v-else>
      <div v-if="filteredUnmapped.length === 0" class="empty-state">
        <p>{{ searchQuery || minMovieCount > 0 ? '没有符合条件的结果' : '暂无未匹配数据' }}</p>
        <p class="hint">
          所有{{ activeTab === 'actors' ? '女优' : '厂商' }}都已成功映射！
        </p>
      </div>

      <template v-else>
        <div class="list-toolbar mapping-table-summary">
          <span class="list-toolbar-text">未匹配清单</span>
          <span class="list-toolbar-stat"><strong>{{ filteredUnmapped.length }}</strong> 项</span>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>优先级</th>
                <th>名字</th>
                <th>作品数量</th>
                <th>尝试方式</th>
                <th>最后尝试</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in pagedUnmapped"
                :key="item.name"
                class="cursor-pointer transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                tabindex="0"
                @click="openMappingDetails(item)"
                @keydown.enter="openMappingDetails(item)"
              >
                <td>
                  <span
                    class="priority-badge"
                    :class="getPriorityClass(item.movieCount)"
                  >
                    {{ getPriorityBadge(item.movieCount) }}
                  </span>
                </td>
                <td class="name-cell">
                  {{ item.name }}
                </td>
                <td>{{ item.movieCount || 0 }}</td>
                <td>
                  <div class="attempts">
                    <span
                      v-for="attempt in item.attempts"
                      :key="attempt"
                      class="attempt-tag"
                    >
                      {{ attempt }}
                    </span>
                  </div>
                </td>
                <td>{{ formatDate(item.lastAttempt) }}</td>
                <td>
                  <button
                    class="btn-link"
                    @click.stop="prepareMapping(item)"
                  >
                    添加映射
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <Pagination
        v-if="loading || totalItems > 0"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total="totalItems"
        :loading="loading"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @update:current-page="currentPage = $event"
        @update:page-size="pageSize = $event"
      />

      <DetailDrawer
        :open="mappingDrawerOpen && !!selectedMapping"
        :title="selectedMapping?.name || '映射详情'"
        :description="activeTab === 'actors' ? '女优未匹配记录' : '厂商未匹配记录'"
        width="sm"
        @update:open="$event ? undefined : closeMappingDetails()"
      >
        <div v-if="selectedMapping" class="space-y-5">
          <div class="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                匹配优先级
              </p>
              <span class="mt-2 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold text-primary-foreground" :class="getPriorityClass(selectedMapping.movieCount)">
                {{ getPriorityBadge(selectedMapping.movieCount) }}
              </span>
            </div>
            <div class="text-right">
              <p class="text-xs text-muted-foreground">
                关联作品
              </p>
              <p class="mt-1 text-xl font-semibold">
                {{ selectedMapping.movieCount || 0 }}
              </p>
            </div>
          </div>

          <dl class="divide-y divide-border rounded-xl border border-border">
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="text-sm text-muted-foreground">
                名称
              </dt>
              <dd class="break-all text-right text-sm font-medium">
                {{ selectedMapping.name }}
              </dd>
            </div>
            <div class="flex items-start justify-between gap-4 px-4 py-3">
              <dt class="shrink-0 text-sm text-muted-foreground">
                尝试方式
              </dt>
              <dd class="flex flex-wrap justify-end gap-1.5 text-right">
                <span v-for="attempt in selectedMapping.attempts" :key="attempt" class="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {{ attempt }}
                </span>
                <span v-if="!selectedMapping.attempts?.length" class="text-sm text-muted-foreground">暂无记录</span>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-3">
              <dt class="text-sm text-muted-foreground">
                最后尝试
              </dt>
              <dd class="text-sm">
                {{ formatDate(selectedMapping.lastAttempt) }}
              </dd>
            </div>
          </dl>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <button
              v-if="selectedMapping"
              class="btn-primary"
              type="button"
              @click.stop="prepareMapping(selectedMapping)"
            >
              添加映射
            </button>
          </div>
        </template>
      </DetailDrawer>
    </template>
  </div>
</template>

<style scoped>
.name-mapping-management {
  display: grid;
  min-width: 0;
  gap: 1rem;
  max-width: none;
  margin: 0;
}

.tabs-order { order: 1; margin-bottom: 0; }
.toolbar-order { order: 2; margin-bottom: 0; }
.add-form-order { order: 3; }
.name-mapping-management > .loading,
.name-mapping-management > .error,
.name-mapping-management > .content { order: 4; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.btn-primary {
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: 1px solid hsl(var(--primary));
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: hsl(var(--primary) / 0.9);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: hsl(var(--muted));
}

.btn-link {
  padding: 0;
  background: none;
  border: none;
  color: hsl(var(--primary));
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
}

.btn-link:hover {
  color: hsl(var(--primary) / 0.8);
}

.add-form-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  padding: 1.25rem;
  margin-bottom: 24px;
}

.add-form-card h3 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.form-input,
.select,
.search-input {
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus,
.select:focus,
.search-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
}

.form-actions {
  display: flex;
  gap: 12px;
}

.error-message {
  padding: 12px;
  background: hsl(var(--destructive) / 0.06);
  border: 1px solid hsl(var(--destructive) / 0.25);
  border-radius: 0.5rem;
  color: hsl(var(--destructive));
  font-size: 14px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid hsl(var(--border));
}

.tab {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  transition: all 0.2s;
}

.tab.active {
  color: hsl(var(--primary));
  border-bottom-color: hsl(var(--primary));
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 24px;
  padding: 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
}

.search-input {
  flex: 1;
  max-width: 300px;
}

.select {
  min-width: 120px;
}

.loading,
.error {
  padding: 48px;
  text-align: center;
  color: hsl(var(--muted-foreground));
}

.error {
  color: hsl(var(--destructive));
}

.error-hint {
  margin-top: 12px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.empty-state {
  padding: 48px;
  text-align: center;
  color: hsl(var(--muted-foreground));
}

.empty-state .hint {
  margin-top: 8px;
  font-size: 14px;
  color: hsl(var(--muted-foreground) / 0.75);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.35);
}

.card-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.badge {
  padding: 4px 12px;
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.table-container {
  max-height: var(--ui-table-max-height, min(62vh, 44rem));
  overflow-x: auto;
  overflow-y: auto;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-lg, 0.5rem);
  background: hsl(var(--card));
  scrollbar-color: hsl(var(--primary) / 0.42) hsl(var(--muted) / 0.32);
  scrollbar-width: thin;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  min-width: 760px;
}

.data-table th,
.data-table td {
  min-width: 0;
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid hsl(var(--border));
  overflow-wrap: anywhere;
}

.data-table th {
  background: hsl(var(--muted) / 0.35);
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.data-table td {
  font-size: 14px;
  color: hsl(var(--foreground));
}

.data-table th:last-child,
.data-table td:last-child {
  position: sticky;
  right: 0;
  z-index: 1;
  width: 7rem;
  min-width: 7rem;
  text-align: right;
  background: hsl(var(--card));
  box-shadow: -1px 0 0 hsl(var(--border)), -0.5rem 0 1rem -0.75rem hsl(var(--foreground) / 0.18);
}

.data-table th:last-child {
  z-index: 2;
  background: hsl(var(--muted) / 0.92);
}

.data-table tbody tr:hover {
  background: hsl(var(--muted) / 0.35);
}

.data-table tbody tr:hover td:last-child {
  background: hsl(var(--accent) / 0.88);
}

.name-cell {
  font-weight: 500;
}

.priority-badge {
  display: inline-block;
  padding: 4px 8px;
  color: hsl(var(--primary-foreground));
  border-radius: 0.375rem;
  font-size: 12px;
  font-weight: 600;
}

.priority-p0 { background: hsl(var(--destructive)); }
.priority-p1 { background: hsl(var(--primary)); }
.priority-p2 { background: hsl(var(--secondary-foreground)); }
.priority-p3 { background: hsl(var(--muted-foreground)); }

.attempts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.attempt-tag {
  padding: 2px 8px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  border-radius: 0.375rem;
  font-size: 12px;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    max-width: none;
  }
}
</style>
