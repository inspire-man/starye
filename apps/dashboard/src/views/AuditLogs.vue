<script setup lang="ts">
import type { AuditLog } from '@/lib/api'
import { DataTable, FilterPanel, success, useFilters, usePagination } from '@starye/ui'
import { onMounted, ref } from 'vue'
import { handleError } from '@/composables/useErrorHandler'
import { useSorting } from '@/composables/useSorting'
import { api } from '@/lib/api'

const logs = ref<AuditLog[]>([])
const loading = ref(false)

const isDetailModalOpen = ref(false)
const selectedLog = ref<AuditLog | null>(null)

const filtersComposable = useFilters({
  userId: '',
  userEmail: '',
  action: '',
  resourceType: '',
  startDate: '',
  endDate: '',
})

const filters = filtersComposable.filters

const { currentPage, limit: pageSize, totalPages, total: totalItems, setMeta, goToPage } = usePagination()

const { sortBy: sortField, sortOrder, updateSort } = useSorting('createdAt', 'desc')

function toggleSort(field: string) {
  const newOrder = sortField.value === field && sortOrder.value === 'asc' ? 'desc' : 'asc'
  updateSort(field, newOrder)
}

const tableColumns = [
  { key: 'createdAt', label: '时间', sortable: true },
  { key: 'userEmail', label: '操作用户', sortable: true },
  { key: 'action', label: '操作', sortable: true },
  { key: 'resourceType', label: '资源类型', sortable: true },
  { key: 'resourceIdentifier', label: '资源标识', sortable: false },
  { key: 'affectedCount', label: '影响数量', sortable: true },
]

const filterFields = [
  { key: 'userEmail', label: '用户邮箱', type: 'text' as const },
  {
    key: 'action',
    label: '操作',
    type: 'select' as const,
    options: [
      { value: '', label: '全部' },
      { value: 'create', label: '创建' },
      { value: 'update', label: '更新' },
      { value: 'delete', label: '删除' },
      { value: 'bulk_update', label: '批量更新' },
      { value: 'bulk_delete', label: '批量删除' },
    ],
  },
  {
    key: 'resourceType',
    label: '资源类型',
    type: 'select' as const,
    options: [
      { value: '', label: '全部' },
      { value: 'comic', label: '漫画' },
      { value: 'movie', label: '电影' },
      { value: 'chapter', label: '章节' },
      { value: 'player', label: '播放源' },
      { value: 'actor', label: '演员' },
      { value: 'publisher', label: '厂商' },
    ],
  },
  { key: 'startDate', label: '开始日期 (YYYY-MM-DD)', type: 'text' as const },
  { key: 'endDate', label: '结束日期 (YYYY-MM-DD)', type: 'text' as const },
]

async function loadLogs() {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      limit: pageSize.value,
      sortBy: sortField.value,
      sortOrder: sortOrder.value,
    }

    if (filters.value.userEmail)
      params.userEmail = filters.value.userEmail
    if (filters.value.action)
      params.action = filters.value.action
    if (filters.value.resourceType)
      params.resourceType = filters.value.resourceType
    if (filters.value.startDate)
      params.startDate = filters.value.startDate
    if (filters.value.endDate)
      params.endDate = filters.value.endDate

    const response = await api.admin.getAuditLogs(params)
    logs.value = response.data
    setMeta({ total: response.meta.total, totalPages: response.meta.totalPages })
  }
  catch (e: any) {
    handleError(e, '加载审计日志失败')
  }
  finally {
    loading.value = false
  }
}

function openDetailModal(log: AuditLog) {
  selectedLog.value = log
  isDetailModalOpen.value = true
}

function formatDate(date: string | Date | null) {
  if (!date)
    return '-'
  return new Date(date).toLocaleString('zh-CN')
}

async function handleExport(format: 'json' | 'csv') {
  try {
    const params: any = {
      sortBy: sortField.value,
      sortOrder: sortOrder.value,
    }

    if (filters.value.userEmail)
      params.userEmail = filters.value.userEmail
    if (filters.value.action)
      params.action = filters.value.action
    if (filters.value.resourceType)
      params.resourceType = filters.value.resourceType
    if (filters.value.startDate)
      params.startDate = filters.value.startDate
    if (filters.value.endDate)
      params.endDate = filters.value.endDate

    const blob = await api.admin.exportAuditLogs(format, params)

    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${Date.now()}.${format}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    success(`审计日志已导出为 ${format.toUpperCase()} 格式`)
  }
  catch (e) {
    handleError(e, '导出审计日志失败')
  }
}

onMounted(loadLogs)
</script>

<template>
  <div class="audit-logs-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">
          审计日志
        </h2>
        <p class="page-subtitle">
          查看系统操作记录
        </p>
      </div>
      <div class="export-buttons">
        <button class="btn-secondary" @click="handleExport('json')">
          导出 JSON
        </button>
        <button class="btn-secondary" @click="handleExport('csv')">
          导出 CSV
        </button>
      </div>
    </div>

    <FilterPanel
      v-model="filters"
      :fields="filterFields"
      @apply="loadLogs"
      @reset="loadLogs"
    />

    <div class="filter-info">
      共 {{ totalItems }} 条记录
    </div>

    <DataTable
      :data="logs"
      :columns="tableColumns"
      :loading="loading"
      :current-page="currentPage"
      :total-pages="totalPages"
      :sort-field="sortField"
      :sort-order="sortOrder"
      empty-message="暂无审计日志"
      @row-click="openDetailModal"
      @sort="toggleSort"
      @page-change="(page: number) => { goToPage(page); loadLogs() }"
    >
      <template #cell-createdAt="{ item }">
        {{ formatDate(item.createdAt) }}
      </template>
      <template #cell-action="{ item }">
        <span class="action-badge" :class="[`action-${item.action}`]">
          {{ item.action }}
        </span>
      </template>
      <template #cell-resourceType="{ item }">
        <span class="resource-badge">
          {{ item.resourceType }}
        </span>
      </template>
    </DataTable>

    <Teleport to="body">
      <div v-if="isDetailModalOpen && selectedLog" class="modal-overlay" @click.self="isDetailModalOpen = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>审计日志详情</h3>
            <button class="modal-close" @click="isDetailModalOpen = false">
              ×
            </button>
          </div>

          <div class="modal-body">
            <div class="detail-grid">
              <div class="detail-item">
                <label>操作时间</label>
                <span>{{ formatDate(selectedLog.createdAt) }}</span>
              </div>
              <div class="detail-item">
                <label>操作用户</label>
                <span>{{ selectedLog.userEmail }}</span>
              </div>
              <div class="detail-item">
                <label>用户 ID</label>
                <span>{{ selectedLog.userId }}</span>
              </div>
              <div class="detail-item">
                <label>操作类型</label>
                <span class="action-badge" :class="[`action-${selectedLog.action}`]">
                  {{ selectedLog.action }}
                </span>
              </div>
              <div class="detail-item">
                <label>资源类型</label>
                <span class="resource-badge">{{ selectedLog.resourceType }}</span>
              </div>
              <div class="detail-item">
                <label>资源 ID</label>
                <span>{{ selectedLog.resourceId || '-' }}</span>
              </div>
              <div class="detail-item">
                <label>资源标识</label>
                <span>{{ selectedLog.resourceIdentifier || '-' }}</span>
              </div>
              <div class="detail-item">
                <label>影响数量</label>
                <span>{{ selectedLog.affectedCount }}</span>
              </div>
              <div class="detail-item">
                <label>IP 地址</label>
                <span>{{ selectedLog.ipAddress || '-' }}</span>
              </div>
              <div class="detail-item full-width">
                <label>User Agent</label>
                <span class="mono">{{ selectedLog.userAgent || '-' }}</span>
              </div>
              <div v-if="selectedLog.changes" class="detail-item full-width">
                <label>变更详情</label>
                <pre class="changes-json">{{ JSON.stringify(selectedLog.changes, null, 2) }}</pre>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="isDetailModalOpen = false">
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.audit-logs-page {
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

.export-buttons {
  display: flex;
  gap: 0.5rem;
}

.filter-info {
  margin-bottom: 1rem;
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

.action-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.action-create {
  background: #d1fae5;
  color: #065f46;
}

.action-update {
  background: #dbeafe;
  color: #1e40af;
}

.action-delete,
.action-bulk_delete {
  background: #fee2e2;
  color: #991b1b;
}

.action-bulk_update {
  background: #fef3c7;
  color: #92400e;
}

.resource-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: #f3f4f6;
  color: #374151;
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
  max-width: 800px;
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

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-item label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
}

.detail-item span {
  font-size: 0.875rem;
  color: #111827;
}

.mono {
  font-family: monospace;
  font-size: 0.75rem;
}

.changes-json {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.75rem;
  overflow-x: auto;
  max-height: 400px;
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
</style>
