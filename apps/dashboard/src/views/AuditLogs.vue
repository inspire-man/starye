<script setup lang="ts">
import type { AuditLog } from '@/lib/api'
import { DataTable, DetailDrawer, FilterPanel, Pagination, success, useFilters, usePagination } from '@starye/ui'
import { onMounted, ref, watch } from 'vue'
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

const { currentPage, limit: pageSize, totalPages, total: totalItems, setMeta, goToPage, updatePageSize } = usePagination()

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
  { key: 'actions', label: '操作', width: '100px', sortable: false },
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

watch([currentPage, pageSize], loadLogs)
onMounted(loadLogs)
</script>

<template>
  <div class="audit-logs-page dashboard-list-page">
    <FilterPanel
      v-model="filters"
      :fields="filterFields"
      :loading="loading"
      @apply="loadLogs"
      @reset="filtersComposable.resetFilters(); loadLogs()"
    />

    <div class="list-toolbar">
      <span class="list-toolbar-text">共 {{ totalItems }} 条记录</span>
      <div class="list-toolbar-group export-buttons">
        <button class="list-toolbar-secondary" @click="handleExport('json')">
          导出 JSON
        </button>
        <button class="list-toolbar-secondary" @click="handleExport('csv')">
          导出 CSV
        </button>
      </div>
    </div>

    <DataTable
      :data="logs"
      :columns="tableColumns"
      :loading="loading"
      :sort-field="sortField"
      :sort-order="sortOrder"
      empty-message="暂无审计日志"
      @row-click="openDetailModal"
      @sort="toggleSort"
    >
      <template #cell-createdAt="{ item }">
        {{ formatDate(item.createdAt) }}
      </template>
      <template #cell-action="{ item }">
        <span class="ui-status-tag action-badge" :class="[`action-${item.action}`]">
          {{ item.action }}
        </span>
      </template>
      <template #cell-resourceType="{ item }">
        <span class="ui-status-tag resource-badge ui-status-neutral">
          {{ item.resourceType }}
        </span>
      </template>
      <template #cell-actions="{ item }">
        <div class="flex justify-end" @click.stop>
          <button class="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary" type="button" @click="openDetailModal(item)">
            查看详情
          </button>
        </div>
      </template>
    </DataTable>

    <Pagination
      v-if="loading || totalItems > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total="totalItems"
      :loading="loading"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      @update:current-page="goToPage"
      @update:page-size="updatePageSize"
    />

    <DetailDrawer
      :open="isDetailModalOpen && !!selectedLog"
      title="审计日志详情"
      :description="selectedLog ? formatDate(selectedLog.createdAt) : ''"
      width="lg"
      @update:open="isDetailModalOpen = $event"
    >
      <div v-if="selectedLog" class="drawer-content">
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
              <span class="ui-status-tag action-badge" :class="[`action-${selectedLog.action}`]">
                {{ selectedLog.action }}
              </span>
            </div>
            <div class="detail-item">
              <label>资源类型</label>
              <span class="ui-status-tag resource-badge ui-status-neutral">{{ selectedLog.resourceType }}</span>
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
              <!-- diff 视图：当 changes 包含 before/after 时显示字段对比 -->
              <template v-if="selectedLog.changes && typeof selectedLog.changes === 'object' && 'before' in selectedLog.changes && 'after' in selectedLog.changes">
                <table class="diff-table">
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>修改前</th>
                      <th>修改后</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="key in Object.keys((selectedLog.changes as any).after || {})"
                      :key="key"
                      :class="JSON.stringify((selectedLog.changes as any).before?.[key]) !== JSON.stringify((selectedLog.changes as any).after?.[key]) ? 'changed-row' : ''"
                    >
                      <td class="field-name">
                        {{ key }}
                      </td>
                      <td class="before-value">
                        {{ (selectedLog.changes as any).before?.[key] !== undefined ? JSON.stringify((selectedLog.changes as any).before[key]) : '-' }}
                      </td>
                      <td class="after-value">
                        {{ JSON.stringify((selectedLog.changes as any).after[key]) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
              <!-- 降级：非 before/after 结构时展示原始 JSON -->
              <pre v-else class="changes-json">{{ JSON.stringify(selectedLog.changes, null, 2) }}</pre>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="isDetailModalOpen = false">
            关闭
          </button>
        </div>
      </div>
    </DetailDrawer>
  </div>
</template>

<style scoped>
.audit-logs-page {
  max-width: none;
  margin: 0;
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
  max-width: 100%;
}

.action-create {
  border-color: hsl(var(--status-success) / 0.2);
  background: hsl(var(--status-success-soft));
  color: hsl(var(--status-success));
}

.action-update {
  border-color: hsl(var(--status-info) / 0.2);
  background: hsl(var(--status-info-soft));
  color: hsl(var(--status-info));
}

.action-delete,
.action-bulk_delete {
  border-color: hsl(var(--status-danger) / 0.2);
  background: hsl(var(--status-danger-soft));
  color: hsl(var(--status-danger));
}

.action-bulk_update {
  border-color: hsl(var(--status-warning) / 0.22);
  background: hsl(var(--status-warning-soft));
  color: hsl(var(--status-warning));
}

.resource-badge {
  max-width: 100%;
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
  min-width: 0;
  max-width: 100%;
  padding: 1.25rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-width: 0;
  max-width: 100%;
}

.detail-item {
  display: flex;
  min-width: 0;
  max-width: 100%;
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
  min-width: 0;
  max-width: 100%;
  font-size: 0.875rem;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
}

.mono {
  font-family: monospace;
  font-size: 0.75rem;
  white-space: pre-wrap;
}

.changes-json {
  max-width: 100%;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.75rem;
  overflow-x: auto;
  overflow-wrap: anywhere;
  max-height: 400px;
}

.diff-table {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.75rem;
  font-family: monospace;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  overflow: hidden;
}

.diff-table th {
  background: hsl(var(--muted));
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: hsl(var(--foreground));
  border-bottom: 1px solid hsl(var(--border));
  overflow-wrap: anywhere;
}

.diff-table td {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.diff-table .field-name {
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}

.diff-table .changed-row {
  background: hsl(var(--status-warning-soft));
}

.diff-table .changed-row .before-value {
  color: hsl(var(--status-danger));
  background: hsl(var(--status-danger-soft));
  border-radius: 2px;
  padding: 0.1rem 0.3rem;
}

.diff-table .changed-row .after-value {
  color: hsl(var(--status-success));
  background: hsl(var(--status-success-soft));
  border-radius: 2px;
  padding: 0.1rem 0.3rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid hsl(var(--border));
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
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.btn-secondary:hover {
  background: hsl(var(--muted));
}

@media (max-width: 640px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail-item.full-width {
    grid-column: auto;
  }

  .modal-body {
    padding: 1rem;
  }
}
</style>
