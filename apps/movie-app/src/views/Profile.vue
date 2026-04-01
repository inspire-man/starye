<!-- eslint-disable no-alert -->
<script setup lang="ts">
import type { SelectOption } from '../components/Select.vue'
import type { DownloadStatus, WatchingProgress } from '../types'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { progressApi } from '../api'
import Aria2Settings from '../components/Aria2Settings.vue'
import DownloadTaskPanel from '../components/DownloadTaskPanel.vue'
import Select from '../components/Select.vue'
import { useAria2 } from '../composables/useAria2'
import { useDownloadList } from '../composables/useDownloadList'
import { useMobileDetect } from '../composables/useMobileDetect'
import { useRating } from '../composables/useRating'
import { useUserStore } from '../stores/user'
import { formatFileSize } from '../utils/aria2Client'

const userStore = useUserStore()
const { isMobile } = useMobileDetect()
const loadingHistory = ref(false)
const watchingHistory = ref<WatchingProgress[]>([])

// 下载列表管理
const {
  getDownloadList,
  removeFromDownloadList,
  updateDownloadStatus,
  stats,
  removeMultiple,
  syncWithAria2,
  importFromAria2,
  getItemsWithAria2,
  removeWithAria2,
} = useDownloadList()

// 评分管理
const { getUserRatingHistory } = useRating()
const myRatings = ref<any[]>([])
const loadingRatings = ref(false)

// Aria2 管理
const aria2 = useAria2()
const syncingAria2 = ref(false)
const importingAria2 = ref(false)

// Tab 状态
type TabType = 'history' | 'downloads' | 'aria2-settings' | 'aria2-tasks' | 'my-ratings'
const activeTab = ref<TabType>('history')

// Tab 选项配置
const tabOptions: SelectOption<TabType>[] = [
  { label: '📺 观看历史', value: 'history' },
  { label: '📥 我的下载', value: 'downloads' },
  { label: '⚙️ Aria2 设置', value: 'aria2-settings' },
  { label: '⬇️ 下载任务', value: 'aria2-tasks' },
  { label: '⭐ 我的评分', value: 'my-ratings' },
]

// 下载列表筛选
const downloadFilter = ref<DownloadStatus | 'all'>('all')
const selectedItems = ref<Set<string>>(new Set())

// 下载状态选项配置
const downloadFilterOptions: SelectOption<DownloadStatus | 'all'>[] = [
  { label: '全部状态', value: 'all' },
  { label: '计划下载', value: 'planned', icon: '📋' },
  { label: '下载中', value: 'downloading', icon: '⬇️' },
  { label: '已完成', value: 'completed', icon: '✅' },
]

// Toast 提示
const toast = ref({ show: false, message: '', type: 'success' as 'success' | 'error' })

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 获取筛选后的下载列表
const filteredDownloadList = computed(() => {
  const filter = downloadFilter.value === 'all' ? undefined : downloadFilter.value
  return getDownloadList(filter)
})

// 切换选中状态
function toggleSelection(movieId: string) {
  if (selectedItems.value.has(movieId)) {
    selectedItems.value.delete(movieId)
  }
  else {
    selectedItems.value.add(movieId)
  }
}

// 全选/取消全选
function toggleSelectAll() {
  if (selectedItems.value.size === filteredDownloadList.value.length) {
    selectedItems.value.clear()
  }
  else {
    selectedItems.value = new Set(filteredDownloadList.value.map(item => item.movieId))
  }
}

// 移除单个影片
function removeItem(movieId: string) {
  if (confirm('确定要从下载列表中移除该影片吗？')) {
    const success = removeFromDownloadList(movieId)
    if (success) {
      showToast('已移除')
      selectedItems.value.delete(movieId)
    }
  }
}

// 批量移除
function batchRemove() {
  if (selectedItems.value.size === 0) {
    showToast('请先选择要移除的影片', 'error')
    return
  }

  if (confirm(`确定要移除选中的 ${selectedItems.value.size} 个影片吗？`)) {
    const count = removeMultiple(Array.from(selectedItems.value))
    showToast(`已移除 ${count} 个影片`)
    selectedItems.value.clear()
  }
}

// 导出下载列表
function exportDownloadList() {
  const list = filteredDownloadList.value

  if (list.length === 0) {
    showToast('下载列表为空，无法导出', 'error')
    return
  }

  // 生成文本内容
  let content = '# Starye 下载列表\n\n'
  content += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`
  content += `影片总数: ${list.length}\n\n`
  content += '---\n\n'

  list.forEach((item, index) => {
    content += `## ${index + 1}. ${item.title}\n\n`
    content += `- 番号: ${item.movieCode}\n`
    content += `- 状态: ${getStatusText(item.status)}\n`
    content += `- 添加时间: ${formatDate(item.addedAt)}\n`

    if (item.magnetLink) {
      content += `- 磁力链接:\n  \`\`\`\n  ${item.magnetLink}\n  \`\`\`\n`
    }

    content += '\n'
  })

  // 创建下载
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `starye-downloads-${Date.now()}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  showToast('下载列表已导出')
}

// 状态文本转换（用于导出）
function getStatusText(status: DownloadStatus): string {
  const statusMap: Record<DownloadStatus, string> = {
    planned: '计划下载',
    downloading: '下载中',
    completed: '已完成',
  }
  return statusMap[status]
}

// 加载我的评分历史
async function loadMyRatings() {
  loadingRatings.value = true
  try {
    myRatings.value = await getUserRatingHistory()
  }
  catch (error) {
    console.error('加载评分历史失败', error)
  }
  finally {
    loadingRatings.value = false
  }
}

// 更新状态
function changeStatus(movieId: string, status: DownloadStatus) {
  const success = updateDownloadStatus(movieId, status)
  if (success) {
    showToast('状态已更新')
  }
}

// 同步 Aria2 任务
async function syncAria2Tasks() {
  if (!aria2.isConnected.value) {
    showToast('Aria2 未连接', 'error')
    return
  }

  const itemsWithAria2 = getItemsWithAria2()
  if (itemsWithAria2.length === 0) {
    showToast('没有需要同步的任务', 'error')
    return
  }

  syncingAria2.value = true
  try {
    await syncWithAria2(aria2.getTaskStatus)
    showToast(`已同步 ${itemsWithAria2.length} 个任务`)
  }
  catch (error) {
    console.error('同步失败', error)
    showToast('同步失败', 'error')
  }
  finally {
    syncingAria2.value = false
  }
}

// 从 Aria2 导入任务
async function importAria2Tasks() {
  if (!aria2.isConnected.value) {
    showToast('Aria2 未连接', 'error')
    return
  }

  importingAria2.value = true
  try {
    const [activeTasks, waitingTasks, stoppedTasks] = await Promise.all([
      aria2.getActiveTasks(),
      aria2.getWaitingTasks(),
      aria2.getStoppedTasks(0, 50),
    ])

    const allTasks = [...activeTasks, ...waitingTasks, ...stoppedTasks]
    const count = await importFromAria2(allTasks)

    if (count > 0) {
      showToast(`已导入 ${count} 个任务`)
    }
    else {
      showToast('没有新任务需要导入')
    }
  }
  catch (error) {
    console.error('导入失败', error)
    showToast('导入失败', 'error')
  }
  finally {
    importingAria2.value = false
  }
}

// 删除下载项（包含 Aria2 任务）
async function removeItemWithAria2(movieId: string) {
  if (confirm('确定要从下载列表中移除该影片吗？')) {
    try {
      const success = await removeWithAria2(movieId, aria2.removeTask)
      if (success) {
        showToast('已移除')
        selectedItems.value.delete(movieId)
      }
    }
    catch (error) {
      console.error('移除失败', error)
      showToast('移除失败', 'error')
    }
  }
}

// 暂停/恢复 Aria2 任务
async function toggleAria2Task(item: any) {
  if (!item.aria2Gid)
    return

  try {
    if (item.aria2Status === 'active') {
      await aria2.pauseTask(item.aria2Gid)
    }
    else if (item.aria2Status === 'paused') {
      await aria2.unpauseTask(item.aria2Gid)
    }

    // 同步状态
    await syncAria2Tasks()
  }
  catch (error) {
    console.error('操作失败', error)
    showToast('操作失败', 'error')
  }
}

// 获取 Aria2 状态图标和文本
function getAria2StatusDisplay(status?: string) {
  const statusMap = {
    active: { icon: '⬇️', text: '下载中', color: 'text-blue-400' },
    waiting: { icon: '⏸', text: '等待中', color: 'text-yellow-400' },
    paused: { icon: '⏸', text: '已暂停', color: 'text-gray-400' },
    error: { icon: '❌', text: '错误', color: 'text-red-400' },
    complete: { icon: '✅', text: '已完成', color: 'text-green-400' },
    removed: { icon: '🗑', text: '已删除', color: 'text-gray-500' },
  }
  return statusMap[status as keyof typeof statusMap] || { icon: '❓', text: '未知', color: 'text-gray-400' }
}

// 获取状态标签样式
function getStatusBadgeClass(status: DownloadStatus): string {
  const classes = {
    planned: 'bg-gray-600 text-gray-200',
    downloading: 'bg-blue-600 text-white',
    completed: 'bg-green-600 text-white',
  }
  return classes[status] || 'bg-gray-600 text-gray-200'
}

async function fetchWatchingHistory() {
  if (!userStore.user)
    return

  loadingHistory.value = true
  try {
    const response = await progressApi.getWatchingProgress()
    if (response.success && Array.isArray(response.data)) {
      watchingHistory.value = response.data
    }
  }
  catch (error) {
    console.error('Failed to fetch watching history:', error)
  }
  finally {
    loadingHistory.value = false
  }
}

onMounted(() => {
  if (userStore.user) {
    fetchWatchingHistory()
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!userStore.user" class="text-center py-12">
      <p class="text-gray-400 mb-4">
        请先登录查看个人中心
      </p>
      <button
        class="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-md font-medium transition"
        @click="userStore.signIn"
      >
        登录
      </button>
    </div>

    <div v-else class="space-y-6">
      <!-- 用户信息 -->
      <div class="bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 class="text-2xl font-bold text-white mb-4">
          个人中心
        </h1>

        <div class="flex items-center space-x-4 mb-6">
          <img
            v-if="userStore.user.image"
            :src="userStore.user.image"
            :alt="userStore.user.name"
            class="w-20 h-20 rounded-full"
          >
          <div v-else class="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
            {{ userStore.user.name[0].toUpperCase() }}
          </div>

          <div>
            <h2 class="text-xl font-bold text-white">
              {{ userStore.user.name }}
            </h2>
            <p class="text-gray-400">
              {{ userStore.user.email }}
            </p>
            <span
              v-if="userStore.user.isR18Verified"
              class="inline-block mt-2 bg-green-900 text-green-300 text-xs px-2 py-1 rounded"
            >
              已验证 R18
            </span>
          </div>
        </div>
      </div>

      <!-- Tab 切换 -->
      <div class="bg-gray-800 rounded-lg shadow-lg">
        <!-- 移动端：下拉选择器 -->
        <div v-if="isMobile" class="p-4 border-b border-gray-700">
          <Select
            v-model="activeTab"
            :options="tabOptions"
            placeholder="选择页面"
            size="default"
            @change="activeTab === 'my-ratings' && myRatings.length === 0 && loadMyRatings()"
          />
        </div>

        <!-- 桌面端：Tab 按钮 -->
        <div v-else class="flex flex-wrap border-b border-gray-700">
          <button
            class="flex-1 min-w-[120px] px-4 py-4 text-center font-medium transition-colors text-sm"
            :class="activeTab === 'history'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'"
            @click="activeTab = 'history'"
          >
            📺 观看历史
          </button>
          <button
            class="flex-1 min-w-[120px] px-4 py-4 text-center font-medium transition-colors relative text-sm"
            :class="activeTab === 'downloads'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'"
            @click="activeTab = 'downloads'"
          >
            📥 我的下载
            <span
              v-if="stats.total > 0"
              class="ml-2 px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full"
            >
              {{ stats.total }}
            </span>
          </button>
          <button
            class="flex-1 min-w-[120px] px-4 py-4 text-center font-medium transition-colors text-sm"
            :class="activeTab === 'aria2-settings'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'"
            @click="activeTab = 'aria2-settings'"
          >
            ⚙️ Aria2 设置
          </button>
          <button
            class="flex-1 min-w-[120px] px-4 py-4 text-center font-medium transition-colors text-sm"
            :class="activeTab === 'aria2-tasks'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'"
            @click="activeTab = 'aria2-tasks'"
          >
            ⬇️ 下载任务
          </button>
          <button
            class="flex-1 min-w-[120px] px-4 py-4 text-center font-medium transition-colors text-sm"
            :class="activeTab === 'my-ratings'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'"
            @click="activeTab = 'my-ratings'; if (myRatings.length === 0) loadMyRatings()"
          >
            ⭐ 我的评分
          </button>
        </div>

        <!-- 观看历史 Tab -->
        <div v-show="activeTab === 'history'" class="p-6">
          <div v-if="loadingHistory" class="text-center py-8 text-gray-400">
            加载中...
          </div>

          <div v-else-if="watchingHistory.length === 0" class="text-center py-8 text-gray-400">
            暂无观看历史
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="item in watchingHistory"
              :key="item.id"
              class="flex items-center justify-between border-b border-gray-700 pb-3 last:border-0"
            >
              <div class="flex-1">
                <p class="text-white font-medium">
                  {{ item.movieCode }}
                </p>
                <p class="text-sm text-gray-400">
                  观看至 {{ formatTime(item.progress) }}
                  <span v-if="item.duration"> / {{ formatTime(item.duration) }}</span>
                </p>
              </div>
              <p class="text-xs text-gray-500">
                {{ new Date(item.updatedAt).toLocaleString() }}
              </p>
            </div>
          </div>
        </div>

        <!-- 下载列表 Tab -->
        <div v-show="activeTab === 'downloads'" class="p-6">
          <!-- 统计和操作栏 -->
          <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div class="flex flex-wrap gap-3 text-sm">
              <div class="px-3 py-1 bg-gray-700 rounded-lg text-gray-300">
                总计: <span class="font-bold text-white">{{ stats.total }}</span>
              </div>
              <div class="px-3 py-1 bg-gray-600/50 rounded-lg text-gray-300">
                计划: {{ stats.planned }}
              </div>
              <div class="px-3 py-1 bg-blue-600/50 rounded-lg text-blue-200">
                下载中: {{ stats.downloading }}
              </div>
              <div class="px-3 py-1 bg-green-600/50 rounded-lg text-green-200">
                已完成: {{ stats.completed }}
              </div>
            </div>

            <div class="flex gap-2 flex-wrap">
              <Select
                v-model="downloadFilter"
                :options="downloadFilterOptions"
                placeholder="筛选状态"
                size="small"
              />

              <!-- Aria2 操作按钮 -->
              <button
                v-if="aria2.isConnected.value && getItemsWithAria2().length > 0"
                :disabled="syncingAria2"
                class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                @click="syncAria2Tasks"
              >
                {{ syncingAria2 ? '同步中...' : '🔄 同步 Aria2' }}
              </button>

              <button
                v-if="aria2.isConnected.value"
                :disabled="importingAria2"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                @click="importAria2Tasks"
              >
                {{ importingAria2 ? '导入中...' : '📤 从 Aria2 导入' }}
              </button>

              <button
                v-if="selectedItems.size > 0"
                class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                @click="batchRemove"
              >
                批量移除 ({{ selectedItems.size }})
              </button>

              <button
                v-if="filteredDownloadList.length > 0"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                @click="exportDownloadList"
              >
                📥 导出列表
              </button>
            </div>
          </div>

          <!-- 批量操作栏 -->
          <div v-if="filteredDownloadList.length > 0" class="flex items-center gap-2 mb-4 pb-4 border-b border-gray-700">
            <input
              type="checkbox"
              :checked="selectedItems.size === filteredDownloadList.length && filteredDownloadList.length > 0"
              :indeterminate="selectedItems.size > 0 && selectedItems.size < filteredDownloadList.length"
              class="w-4 h-4"
              @change="toggleSelectAll"
            >
            <span class="text-sm text-gray-400">
              {{ selectedItems.size > 0 ? `已选中 ${selectedItems.size} 个` : '全选' }}
            </span>
          </div>

          <!-- 空状态 -->
          <div v-if="filteredDownloadList.length === 0" class="text-center py-12 text-gray-400">
            <p class="text-lg mb-2">
              {{ downloadFilter === 'all' ? '下载列表为空' : '暂无该状态的影片' }}
            </p>
            <p class="text-sm mb-4">
              在影片详情页点击"添加到下载列表"开始管理你的下载
            </p>
            <RouterLink to="/" class="text-primary-400 hover:underline">
              去发现内容
            </RouterLink>
          </div>

          <!-- 下载列表 -->
          <div v-else class="space-y-3">
            <div
              v-for="item in filteredDownloadList"
              :key="item.movieId"
              class="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700 transition-colors"
            >
              <div class="flex gap-4">
                <!-- 复选框 -->
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    :checked="selectedItems.has(item.movieId)"
                    class="w-4 h-4"
                    @change="toggleSelection(item.movieId)"
                  >
                </div>

                <!-- 封面 -->
                <RouterLink :to="`/movie/${item.movieCode}`" class="shrink-0">
                  <div class="w-20 h-28 bg-gray-800 rounded overflow-hidden">
                    <img
                      v-if="item.coverImage"
                      :src="item.coverImage"
                      :alt="item.title"
                      class="w-full h-full object-cover"
                    >
                  </div>
                </RouterLink>

                <!-- 信息 -->
                <div class="flex-1 min-w-0">
                  <RouterLink
                    :to="`/movie/${item.movieCode}`"
                    class="text-white font-medium hover:text-primary-400 transition-colors block truncate"
                  >
                    {{ item.title }}
                  </RouterLink>
                  <p class="text-sm text-gray-400 mt-1">
                    {{ item.movieCode }}
                  </p>
                  <p class="text-xs text-gray-500 mt-2">
                    添加于 {{ formatDate(item.addedAt) }}
                  </p>

                  <!-- Aria2 状态显示 -->
                  <div v-if="item.aria2Gid" class="mt-2 space-y-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-medium" :class="[getAria2StatusDisplay(item.aria2Status).color]">
                        {{ getAria2StatusDisplay(item.aria2Status).icon }} {{ getAria2StatusDisplay(item.aria2Status).text }}
                      </span>
                      <span v-if="item.downloadProgress !== undefined" class="text-xs text-gray-400">
                        {{ item.downloadProgress }}%
                      </span>
                    </div>

                    <!-- 进度条 -->
                    <div v-if="item.aria2Status === 'active' || item.aria2Status === 'paused'" class="w-full bg-gray-600 rounded-full h-2">
                      <div
                        class="h-2 rounded-full transition-all"
                        :class="item.aria2Status === 'active' ? 'bg-blue-500' : 'bg-gray-500'"
                        :style="{ width: `${item.downloadProgress || 0}%` }"
                      />
                    </div>

                    <!-- 速度和 ETA -->
                    <div v-if="item.aria2Status === 'active'" class="flex gap-4 text-xs text-gray-400">
                      <span v-if="item.downloadSpeed">
                        ↓ {{ formatFileSize(item.downloadSpeed) }}/s
                      </span>
                      <span v-if="item.uploadSpeed">
                        ↑ {{ formatFileSize(item.uploadSpeed) }}/s
                      </span>
                      <span v-if="item.eta">
                        剩余: {{ item.eta }}
                      </span>
                    </div>
                  </div>

                  <!-- 磁链信息 -->
                  <div v-if="item.magnetLink" class="mt-2">
                    <p class="text-xs text-gray-400 truncate">
                      🧲 {{ item.magnetLink.substring(0, 50) }}...
                    </p>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex flex-col gap-2 shrink-0">
                  <!-- Aria2 控制按钮 -->
                  <button
                    v-if="item.aria2Gid && (item.aria2Status === 'active' || item.aria2Status === 'paused')"
                    class="px-3 py-1.5 text-white text-xs rounded-lg transition-colors"
                    :class="item.aria2Status === 'active'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-green-600 hover:bg-green-700'"
                    @click="toggleAria2Task(item)"
                  >
                    {{ item.aria2Status === 'active' ? '⏸ 暂停' : '▶ 恢复' }}
                  </button>

                  <!-- 打开任务详情按钮 -->
                  <button
                    v-if="item.aria2Gid"
                    class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors"
                    @click="activeTab = 'aria2-tasks'"
                  >
                    📊 任务详情
                  </button>

                  <!-- 状态选择 -->
                  <select
                    v-if="!item.aria2Gid"
                    :value="item.status"
                    class="px-3 py-1.5 text-xs rounded-lg transition-colors"
                    :class="getStatusBadgeClass(item.status)"
                    @change="(e) => changeStatus(item.movieId, (e.target as HTMLSelectElement).value as DownloadStatus)"
                  >
                    <option value="planned">
                      计划下载
                    </option>
                    <option value="downloading">
                      下载中
                    </option>
                    <option value="completed">
                      已完成
                    </option>
                  </select>

                  <!-- 移除按钮 -->
                  <button
                    class="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                    @click="item.aria2Gid ? removeItemWithAria2(item.movieId) : removeItem(item.movieId)"
                  >
                    移除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Aria2 设置 Tab -->
        <div v-show="activeTab === 'aria2-settings'" class="p-6">
          <Aria2Settings />
        </div>

        <!-- Aria2 下载任务 Tab -->
        <div v-show="activeTab === 'aria2-tasks'" class="p-6">
          <DownloadTaskPanel />
        </div>

        <!-- 我的评分 Tab -->
        <div v-show="activeTab === 'my-ratings'" class="p-6">
          <div v-if="loadingRatings" class="text-center py-8 text-gray-400">
            加载中...
          </div>

          <div v-else-if="myRatings.length === 0" class="text-center py-8 text-gray-400">
            <p class="text-lg mb-2">
              暂无评分记录
            </p>
            <p class="text-sm">
              快去为播放源评分吧！
            </p>
          </div>

          <div v-else class="space-y-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-white">
                我的评分历史
              </h3>
              <span class="text-sm text-gray-400">
                共 {{ myRatings.length }} 条评分
              </span>
            </div>

            <div class="grid gap-4">
              <div
                v-for="rating in myRatings"
                :key="rating.playerId"
                class="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700 transition-colors"
              >
                <div class="flex items-start gap-4">
                  <!-- 左侧：评分和影片信息 -->
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-yellow-400 font-bold">
                        {{ '⭐'.repeat(rating.score) }}{{ '☆'.repeat(5 - rating.score) }}
                      </span>
                      <span class="text-white">
                        {{ rating.score }} 星
                      </span>
                    </div>

                    <!-- 影片标题和代码（如果有） -->
                    <div v-if="rating.movieCode" class="mb-2">
                      <RouterLink
                        :to="`/movie/${rating.movieCode}`"
                        class="text-white hover:text-primary-400 transition-colors font-medium"
                      >
                        {{ rating.movieTitle || rating.movieCode }}
                      </RouterLink>
                      <span class="text-xs text-gray-500 ml-2">
                        {{ rating.movieCode }}
                      </span>
                    </div>

                    <div class="text-sm text-gray-400 space-y-1">
                      <p>播放源 ID: {{ rating.playerId }}</p>
                      <p>评分时间: {{ formatDate(new Date(rating.createdAt).getTime()) }}</p>
                      <p v-if="rating.updatedAt !== rating.createdAt">
                        更新时间: {{ formatDate(new Date(rating.updatedAt).getTime()) }}
                      </p>
                    </div>
                  </div>

                  <!-- 右侧：查看详情按钮 -->
                  <div v-if="rating.movieCode" class="shrink-0">
                    <RouterLink
                      :to="`/movie/${rating.movieCode}`"
                      class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                    >
                      查看影片
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast 提示 -->
    <Transition name="toast">
      <div
        v-if="toast.show"
        class="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-sm"
        :class="toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Toast 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100px);
}
</style>
