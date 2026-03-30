<script setup lang="ts">
import type { Aria2TaskStatus } from '../utils/aria2Client'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAria2 } from '../composables/useAria2'
import { calculateETA, calculateProgress, formatFileSize, formatSpeed } from '../utils/aria2Client'

type FilterStatus = 'all' | 'active' | 'waiting' | 'stopped' | 'complete' | 'error'
type SortBy = 'addedTime' | 'progress' | 'speed' | 'eta'

const {
  tasks,
  isLoading,
  pauseTask,
  unpauseTask,
  removeTask,
  pauseAllTasks,
  unpauseAllTasks,
  getGlobalStats,
  refreshTasks,
} = useAria2()

const filterStatus = ref<FilterStatus>('all')
const sortBy = ref<SortBy>('addedTime')
const globalStats = ref<any>(null)

let refreshInterval: number | null = null

// 是否有活跃任务
const hasActiveTasks = computed(() => {
  return tasks.value.some(task => task.status === 'active' || task.status === 'waiting')
})

// 过滤后的任务
const filteredTasks = computed(() => {
  if (filterStatus.value === 'all') {
    return tasks.value
  }

  return tasks.value.filter((task) => {
    if (filterStatus.value === 'complete') {
      return task.status === 'complete'
    }
    if (filterStatus.value === 'error') {
      return task.status === 'error'
    }
    if (filterStatus.value === 'stopped') {
      return task.status === 'paused' || task.status === 'removed'
    }

    return task.status === filterStatus.value
  })
})

// 排序后的任务
const sortedTasks = computed(() => {
  const sorted = [...filteredTasks.value]

  switch (sortBy.value) {
    case 'progress':
      sorted.sort((a, b) => getProgress(b) - getProgress(a))
      break
    case 'speed':
      sorted.sort((a, b) => Number.parseInt(b.downloadSpeed) - Number.parseInt(a.downloadSpeed))
      break
    case 'eta': {
      const getEtaSeconds = (task: Aria2TaskStatus) => {
        const total = Number.parseInt(task.totalLength)
        const completed = Number.parseInt(task.completedLength)
        const speed = Number.parseInt(task.downloadSpeed)
        if (speed === 0)
          return Infinity
        return (total - completed) / speed
      }
      sorted.sort((a, b) => getEtaSeconds(a) - getEtaSeconds(b))
      break
    }
    case 'addedTime':
    default:
      // 默认保持原顺序（按添加时间）
      break
  }

  return sorted
})

// 空状态消息
const emptyMessage = computed(() => {
  switch (filterStatus.value) {
    case 'active':
      return '没有正在下载的任务'
    case 'waiting':
      return '没有等待中的任务'
    case 'stopped':
      return '没有已停止的任务'
    case 'complete':
      return '没有已完成的任务'
    case 'error':
      return '没有出错的任务'
    default:
      return '暂无下载任务'
  }
})

/**
 * 获取任务名称
 */
function getTaskName(task: Aria2TaskStatus): string {
  // 尝试从文件列表获取名称
  if (task.files && task.files.length > 0) {
    const fileName = task.files[0].path.split('/').pop()
    if (fileName)
      return fileName
  }

  // 如果是磁力链接，显示 InfoHash
  if (task.infoHash) {
    return `磁力任务 ${task.infoHash.substring(0, 8)}...`
  }

  return `任务 ${task.gid.substring(0, 8)}`
}

/**
 * 获取状态文本
 */
function getStatusText(status: string): string {
  const map: Record<string, string> = {
    active: '下载中',
    waiting: '等待中',
    paused: '已暂停',
    error: '出错',
    complete: '已完成',
    removed: '已删除',
  }
  return map[status] || status
}

/**
 * 获取进度百分比
 */
function getProgress(task: Aria2TaskStatus): number {
  return calculateProgress(task.totalLength, task.completedLength)
}

/**
 * 获取 ETA
 */
function getETA(task: Aria2TaskStatus): string {
  const total = Number.parseInt(task.totalLength)
  const completed = Number.parseInt(task.completedLength)
  const speed = Number.parseInt(task.downloadSpeed)

  return calculateETA(total, completed, speed)
}

/**
 * 刷新任务列表
 */
async function handleRefresh() {
  await refreshTasks()
  await updateGlobalStats()
}

/**
 * 暂停任务
 */
async function handlePause(gid: string) {
  await pauseTask(gid)
  await handleRefresh()
}

/**
 * 恢复任务
 */
async function handleUnpause(gid: string) {
  await unpauseTask(gid)
  await handleRefresh()
}

/**
 * 删除任务
 */
async function handleRemove(gid: string) {
  await removeTask(gid, false)
  await handleRefresh()
}

/**
 * 强制删除任务
 */
async function handleForceRemove(gid: string) {
  await removeTask(gid, true)
  await handleRefresh()
}

/**
 * 暂停所有任务
 */
async function handlePauseAll() {
  await pauseAllTasks()
  await handleRefresh()
}

/**
 * 恢复所有任务
 */
async function handleUnpauseAll() {
  await unpauseAllTasks()
  await handleRefresh()
}

/**
 * 更新全局统计
 */
async function updateGlobalStats() {
  globalStats.value = await getGlobalStats()
}

/**
 * 启动定时刷新
 */
function startAutoRefresh() {
  refreshInterval = window.setInterval(() => {
    if (hasActiveTasks.value) {
      handleRefresh()
    }
  }, 2000) // 每 2 秒刷新一次
}

/**
 * 停止定时刷新
 */
function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

// 组件挂载
onMounted(() => {
  handleRefresh()
  startAutoRefresh()
})

// 组件卸载
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="download-task-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        下载任务
      </h3>

      <!-- 筛选和操作 -->
      <div class="panel-actions">
        <select v-model="filterStatus" class="status-filter">
          <option value="all">
            全部任务
          </option>
          <option value="active">
            下载中
          </option>
          <option value="waiting">
            等待中
          </option>
          <option value="stopped">
            已停止
          </option>
          <option value="complete">
            已完成
          </option>
          <option value="error">
            出错
          </option>
        </select>

        <select v-model="sortBy" class="sort-select">
          <option value="addedTime">
            添加时间
          </option>
          <option value="progress">
            下载进度
          </option>
          <option value="speed">
            下载速度
          </option>
          <option value="eta">
            剩余时间
          </option>
        </select>

        <button class="btn-icon" title="刷新" @click="handleRefresh">
          🔄
        </button>
      </div>
    </div>

    <!-- 批量操作 -->
    <div v-if="hasActiveTasks" class="batch-actions">
      <button class="btn btn-small" @click="handlePauseAll">
        全部暂停
      </button>
      <button class="btn btn-small" @click="handleUnpauseAll">
        全部恢复
      </button>
    </div>

    <!-- 任务列表 -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner" />
      <span>加载中...</span>
    </div>

    <div v-else-if="filteredTasks.length === 0" class="empty-state">
      <div class="empty-icon">
        📥
      </div>
      <p class="empty-text">
        {{ emptyMessage }}
      </p>
    </div>

    <div v-else class="task-list">
      <div
        v-for="task in sortedTasks"
        :key="task.gid"
        class="task-item"
        :class="`status-${task.status}`"
      >
        <!-- 任务信息 -->
        <div class="task-info">
          <div class="task-name">
            {{ getTaskName(task) }}
          </div>

          <div class="task-meta">
            <span class="task-size">{{ formatFileSize(Number.parseInt(task.totalLength)) }}</span>
            <span class="task-status-badge" :class="`badge-${task.status}`">
              {{ getStatusText(task.status) }}
            </span>
          </div>
        </div>

        <!-- 进度条 -->
        <div v-if="task.status === 'active' || task.status === 'paused'" class="task-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${getProgress(task)}%` }"
            />
          </div>

          <div class="progress-stats">
            <span class="progress-percent">{{ getProgress(task) }}%</span>
            <span v-if="task.status === 'active'" class="progress-speed">
              {{ formatSpeed(Number.parseInt(task.downloadSpeed)) }}
            </span>
            <span v-if="task.status === 'active'" class="progress-eta">
              ETA: {{ getETA(task) }}
            </span>
          </div>
        </div>

        <!-- 任务控制 -->
        <div class="task-controls">
          <button
            v-if="task.status === 'active'"
            class="btn-icon"
            title="暂停"
            @click="handlePause(task.gid)"
          >
            ⏸️
          </button>

          <button
            v-if="task.status === 'paused' || task.status === 'waiting'"
            class="btn-icon"
            title="恢复"
            @click="handleUnpause(task.gid)"
          >
            ▶️
          </button>

          <button
            v-if="task.status === 'complete' || task.status === 'error' || task.status === 'removed'"
            class="btn-icon"
            title="删除"
            @click="handleRemove(task.gid)"
          >
            🗑️
          </button>

          <button
            v-if="task.status !== 'complete'"
            class="btn-icon btn-danger"
            title="强制删除"
            @click="handleForceRemove(task.gid)"
          >
            ❌
          </button>
        </div>
      </div>
    </div>

    <!-- 全局统计（底部） -->
    <div v-if="globalStats" class="global-stats">
      <div class="stat-item">
        <span class="stat-label">总速度</span>
        <span class="stat-value">{{ formatSpeed(Number.parseInt(globalStats.downloadSpeed)) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">活跃任务</span>
        <span class="stat-value">{{ globalStats.numActive }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">等待任务</span>
        <span class="stat-value">{{ globalStats.numWaiting }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已停止</span>
        <span class="stat-value">{{ globalStats.numStopped }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.download-task-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.panel-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status-filter,
.sort-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
}

.btn-icon {
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #f5f5f5;
}

.btn-danger:hover {
  background: #ffebee;
  border-color: #f44336;
}

/* 批量操作 */
.batch-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  background: #1976d2;
  color: #fff;
  transition: background 0.2s;
}

.btn:hover {
  background: #1565c0;
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px;
  color: #999;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #ddd;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text {
  margin: 0;
  color: #999;
}

/* 任务列表 */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
  transition: box-shadow 0.2s;
}

.task-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.task-item.status-active {
  border-left: 4px solid #4caf50;
}

.task-item.status-paused {
  border-left: 4px solid #ff9800;
}

.task-item.status-error {
  border-left: 4px solid #f44336;
}

.task-item.status-complete {
  border-left: 4px solid #2196f3;
}

.task-info {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 12px;
}

.task-name {
  flex: 1;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.task-size {
  color: #999;
}

.task-status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge-active {
  background: #e8f5e9;
  color: #4caf50;
}

.badge-waiting {
  background: #fff3e0;
  color: #ff9800;
}

.badge-paused {
  background: #fff3e0;
  color: #ff9800;
}

.badge-error {
  background: #ffebee;
  color: #f44336;
}

.badge-complete {
  background: #e3f2fd;
  color: #2196f3;
}

/* 进度条 */
.task-progress {
  margin-bottom: 12px;
}

.progress-bar {
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1976d2, #2196f3);
  transition: width 0.3s;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
}

.progress-percent {
  font-weight: 600;
  color: #333;
}

/* 任务控制 */
.task-controls {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 全局统计 */
.global-stats {
  display: flex;
  justify-content: space-around;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .download-task-panel {
    background: #1e1e1e;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .panel-title {
    color: #eee;
  }

  .status-filter,
  .sort-select,
  .btn-icon {
    background: #2a2a2a;
    border-color: #444;
    color: #eee;
  }

  .task-item {
    border-color: #333;
  }

  .task-name {
    color: #eee;
  }

  .progress-percent {
    color: #eee;
  }

  .stat-value {
    color: #eee;
  }

  .global-stats {
    background: #2a2a2a;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .download-task-panel {
    padding: 16px;
  }

  .panel-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .panel-actions {
    flex-wrap: wrap;
  }

  .task-info {
    flex-direction: column;
    gap: 8px;
  }

  .task-controls {
    justify-content: flex-start;
  }

  .global-stats {
    flex-wrap: wrap;
    gap: 16px;
  }

  .stat-item {
    flex: 1 1 40%;
  }
}
</style>
