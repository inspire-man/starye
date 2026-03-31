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

import { computed, onMounted, ref } from 'vue'
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

function getPriorityColor(movieCount?: number) {
  const priority = getPriorityBadge(movieCount)
  switch (priority) {
    case 'P0': return '#dc2626' // red
    case 'P1': return '#f59e0b' // amber
    case 'P2': return '#3b82f6' // blue
    default: return '#6b7280' // gray
  }
}

onMounted(() => {
  loadUnmappedData()
})
</script>

<template>
  <div class="name-mapping-management">
    <!-- 头部 -->
    <div class="header">
      <h1 class="title">
        名字映射管理
      </h1>
      <button
        class="btn-primary"
        @click="showAddForm = !showAddForm"
      >
        {{ showAddForm ? '取消添加' : '+ 添加映射' }}
      </button>
    </div>

    <!-- 添加映射表单 -->
    <div v-if="showAddForm" class="add-form-card">
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

    <!-- Tab 切换 -->
    <div class="tabs">
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
    <div class="toolbar">
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
    <div v-else class="content">
      <div v-if="filteredUnmapped.length === 0" class="empty-state">
        <p>{{ searchQuery || minMovieCount > 0 ? '没有符合条件的结果' : '暂无未匹配数据' }}</p>
        <p class="hint">
          所有{{ activeTab === 'actors' ? '女优' : '厂商' }}都已成功映射！
        </p>
      </div>

      <div v-else class="card">
        <div class="card-header">
          <h2>未匹配清单</h2>
          <span class="badge">{{ filteredUnmapped.length }} 项</span>
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
              <tr v-for="item in filteredUnmapped" :key="item.name">
                <td>
                  <span
                    class="priority-badge"
                    :style="{ background: getPriorityColor(item.movieCount) }"
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
                    @click="addForm.javbusName = item.name; showAddForm = true"
                  >
                    添加映射
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.name-mapping-management {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

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
  padding: 10px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 24px;
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.btn-link {
  padding: 0;
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
}

.btn-link:hover {
  color: #2563eb;
}

.add-form-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 24px;
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
  color: #374151;
}

.form-input,
.select,
.search-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus,
.select:focus,
.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-actions {
  display: flex;
  gap: 12px;
}

.error-message {
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 14px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.tab {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
}

.tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
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
  color: #6b7280;
}

.error {
  color: #dc2626;
}

.error-hint {
  margin-top: 12px;
  font-size: 13px;
  color: #6b7280;
}

.empty-state {
  padding: 48px;
  text-align: center;
  color: #6b7280;
}

.empty-state .hint {
  margin-top: 8px;
  font-size: 14px;
  color: #9ca3af;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.card-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.badge {
  padding: 4px 12px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.data-table th {
  background: #f9fafb;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.data-table td {
  font-size: 14px;
  color: #111827;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.name-cell {
  font-weight: 500;
}

.priority-badge {
  display: inline-block;
  padding: 4px 8px;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.attempts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.attempt-tag {
  padding: 2px 8px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
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
