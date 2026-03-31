<script setup lang="ts">
import type { MovieDetail, Player } from '../types'
import QrcodeVue from 'qrcode.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { movieApi } from '../api'
import RatingStars from '../components/RatingStars.vue'
import { useAria2 } from '../composables/useAria2'
import { useDownloadList } from '../composables/useDownloadList'
import { useFavorites } from '../composables/useFavorites'
import { useRating } from '../composables/useRating'
import { copyMagnetLinks, copyToClipboard } from '../utils/clipboard'
import { isMagnetLink } from '../utils/magnetLink'
import { getQualityBadgeClass, getSourceTypeIcon, sortPlaybackSources } from '../utils/playbackSources'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const movie = ref<MovieDetail | null>(null)

// 下载列表管理
const { isInDownloadList, addToDownloadList } = useDownloadList()

// 收藏管理
const { addFavorite, checkIsFavorited } = useFavorites()
const isFavorited = ref(false)
const favoritingLoading = ref(false)

// 评分管理
const { getPlayerRating, submitRating } = useRating()

// Aria2 管理
const { isConnected: aria2Connected, addMagnetTask } = useAria2()

// 调试模式（从 localStorage 读取，可以在控制台执行 localStorage.setItem('debugMode', 'true') 开启）
const debugMode = ref(localStorage.getItem('debugMode') === 'true')

// 二维码弹窗
const qrcodeModal = ref({ show: false, content: '', title: '' })

// 评分弹窗
const ratingModal = ref({ show: false, player: null as Player | null })

// Toast 提示
const toast = ref({ show: false, message: '', type: 'success' as 'success' | 'error' })

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN')
}

// 播放源相关逻辑
const sortedPlayers = computed(() => {
  if (!movie.value?.players || movie.value.players.length === 0) {
    return []
  }
  return sortPlaybackSources(movie.value.players)
})

const magnetLinks = computed(() => {
  return sortedPlayers.value.filter(p => isMagnetLink(p.sourceUrl))
})

// 复制单个磁链
async function copyMagnetLink(player: Player) {
  try {
    const success = await copyToClipboard(player.sourceUrl)
    if (success) {
      showToast('磁链已复制到剪贴板')
    }
    else {
      showToast('复制失败，请手动复制', 'error')
    }
  }
  catch {
    showToast('复制失败，请手动复制', 'error')
  }
}

// 批量复制所有磁链
async function copyAllMagnetLinks() {
  if (magnetLinks.value.length === 0) {
    showToast('暂无磁力链接', 'error')
    return
  }

  try {
    const links = magnetLinks.value.map(p => ({
      sourceName: p.sourceName,
      sourceUrl: p.sourceUrl,
      quality: p.quality || undefined,
    }))
    const success = await copyMagnetLinks(links)

    if (success) {
      showToast(`已复制 ${links.length} 个磁力链接`)
    }
    else {
      showToast('复制失败，请手动复制', 'error')
    }
  }
  catch {
    showToast('复制失败，请手动复制', 'error')
  }
}

// 添加到下载列表
function addToList() {
  if (!movie.value)
    return

  try {
    // 如果有磁链，使用第一个高清磁链
    const firstMagnet = magnetLinks.value[0]?.sourceUrl
    addToDownloadList(movie.value, firstMagnet)
    showToast('已添加到下载列表')
  }
  catch (error: any) {
    showToast(error.message || '添加失败', 'error')
  }
}

// 显示二维码
function showQRCode(player: Player) {
  qrcodeModal.value = {
    show: true,
    content: player.sourceUrl,
    title: `${player.sourceName} ${player.quality ? `[${player.quality}]` : ''}`,
  }
}

// 关闭二维码弹窗
function closeQRCode() {
  qrcodeModal.value.show = false
}

// 显示评分弹窗
function showRatingModal(player: Player) {
  ratingModal.value = {
    show: true,
    player,
  }
}

// 关闭评分弹窗
function closeRatingModal() {
  ratingModal.value.show = false
  ratingModal.value.player = null
}

// 提交评分
async function handleSubmitRating(score: number) {
  if (!ratingModal.value.player)
    return

  const success = await submitRating(ratingModal.value.player.id, score)
  if (success) {
    // 刷新影片详情以更新评分
    await fetchMovieDetail()
    closeRatingModal()
  }
}

// 添加到 Aria2
async function addToAria2(player: Player) {
  if (!aria2Connected.value) {
    showToast('请先在个人中心配置 Aria2 连接', 'error')
    return
  }

  if (!isMagnetLink(player.sourceUrl)) {
    showToast('只支持添加磁力链接到 Aria2', 'error')
    return
  }

  try {
    await addMagnetTask(player.sourceUrl)
    showToast('已添加到 Aria2')
  }
  catch (error: any) {
    showToast(error.message || '添加失败', 'error')
  }
}

async function fetchMovieDetail() {
  loading.value = true
  error.value = ''

  try {
    const code = route.params.code as string
    const response = await movieApi.getMovieDetail(code)

    if (response.success && response.data) {
      movie.value = response.data
      // 检查收藏状态
      await checkFavoriteStatus()
    }
    else {
      error.value = response.error || '加载失败'
    }
  }
  catch (err: any) {
    error.value = err.response?.data?.error || '加载影片详情失败'
  }
  finally {
    loading.value = false
  }
}

// 检查收藏状态
async function checkFavoriteStatus() {
  if (!movie.value)
    return

  try {
    isFavorited.value = await checkIsFavorited('movie', movie.value.id)
  }
  catch (e) {
    console.error('[MovieDetail] 检查收藏状态失败:', e)
  }
}

// 切换收藏
async function toggleFavorite() {
  if (!movie.value || favoritingLoading.value)
    return

  favoritingLoading.value = true

  try {
    if (isFavorited.value) {
      // 取消收藏 - 需要先找到 favoriteId
      // 注意：这里简化处理，实际应该从收藏列表中获取 favoriteId
      // 或者在检查收藏状态时同时保存 favoriteId
      showToast('取消收藏功能开发中', 'error')
    }
    else {
      // 添加收藏
      const result = await addFavorite('movie', movie.value.id)
      if (result.success) {
        isFavorited.value = true
        showToast(result.alreadyExists ? '已在收藏夹中' : '已添加到收藏夹')
      }
      else {
        showToast(result.error || '收藏失败', 'error')
      }
    }
  }
  catch (e) {
    showToast('操作失败', 'error')
    console.error('[MovieDetail] 收藏操作失败:', e)
  }
  finally {
    favoritingLoading.value = false
  }
}

// 监听路由变化，自动刷新影片详情
watch(() => route.params.code, (newCode, oldCode) => {
  if (newCode && newCode !== oldCode) {
    fetchMovieDetail()
  }
})

onMounted(() => {
  fetchMovieDetail()
})
</script>

<template>
  <div v-if="loading" class="animate-pulse">
    <div class="bg-gray-800 h-64 rounded-lg mb-4" />
    <div class="bg-gray-800 h-8 rounded w-1/2 mb-2" />
    <div class="bg-gray-800 h-4 rounded w-1/3" />
  </div>

  <div v-else-if="error" class="text-center py-12">
    <p class="text-red-500 mb-4">
      {{ error }}
    </p>
    <RouterLink to="/" class="text-primary-400 hover:underline">
      返回首页
    </RouterLink>
  </div>

  <div v-else-if="movie" class="space-y-6">
    <div class="bg-gray-800 rounded-lg shadow-lg p-6">
      <div class="flex flex-col md:flex-row gap-6">
        <div class="shrink-0">
          <img
            v-if="movie.coverImage"
            :src="movie.coverImage"
            :alt="movie.title"
            class="w-48 h-64 object-cover rounded-lg shadow-md"
          >
          <div v-else class="w-48 h-64 bg-gray-700 rounded-lg flex items-center justify-center">
            <span class="text-gray-500">暂无封面</span>
          </div>
        </div>

        <div class="flex-1">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h1 class="text-3xl font-bold text-white mb-3">
                {{ movie.title }}
              </h1>
              <div class="flex flex-wrap items-center gap-2">
                <span class="bg-gray-700/80 text-primary-400 font-mono text-sm px-3 py-1.5 rounded-md border border-gray-600">
                  {{ movie.code }}
                </span>
                <RouterLink
                  v-if="movie.series"
                  :to="`/series/${encodeURIComponent(movie.series)}`"
                  class="bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  <span class="mr-1">📂</span>
                  {{ movie.series }}
                </RouterLink>
              </div>
            </div>
            <span
              v-if="movie.isR18"
              class="bg-red-600 text-white text-sm px-3 py-1 rounded"
            >
              R18
            </span>
          </div>

          <div class="space-y-3">
            <div v-if="movie.releaseDate" class="flex items-center text-sm">
              <span class="text-gray-300 w-24 font-medium">发行日期：</span>
              <span class="text-white">{{ formatDate(movie.releaseDate) }}</span>
            </div>

            <div v-if="movie.duration" class="flex items-center text-sm">
              <span class="text-gray-300 w-24 font-medium">时长：</span>
              <span class="text-white">{{ Math.floor(movie.duration / 60) }} 分钟</span>
            </div>

            <div class="flex items-start text-sm">
              <span class="text-gray-300 w-24 shrink-0 font-medium">演员：</span>
              <div v-if="movie.actors && movie.actors.length > 0" class="flex flex-wrap gap-2">
                <RouterLink
                  v-for="(actor, index) in movie.actors"
                  :key="typeof actor === 'object' ? (actor.id || actor.slug || `actor-${index}`) : `actor-str-${index}`"
                  :to="typeof actor === 'object' && actor.slug ? `/actors/${actor.slug}` : '#'"
                  class="px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200" :class="[
                    typeof actor === 'object' && actor.slug
                      ? 'bg-primary-600 hover:bg-primary-500 text-white cursor-pointer'
                      : 'bg-gray-600 text-gray-300 cursor-not-allowed',
                  ]"
                  @click.prevent="typeof actor !== 'object' || !actor.slug ? null : undefined"
                >
                  {{ typeof actor === 'object' ? actor.name : actor }}
                  <span v-if="typeof actor !== 'object' || !actor.slug" class="ml-1 text-[10px] opacity-70">
                    (未同步)
                  </span>
                </RouterLink>
              </div>
              <span v-else class="text-gray-400 text-xs">暂无数据</span>
            </div>

            <div v-if="movie.genres && movie.genres.length > 0" class="flex items-start text-sm">
              <span class="text-gray-300 w-24 shrink-0 font-medium">标签：</span>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="genre in movie.genres"
                  :key="genre"
                  class="bg-purple-600/20 border border-purple-500/30 text-purple-300 px-2 py-1 rounded text-xs"
                >
                  {{ genre }}
                </span>
              </div>
            </div>

            <div class="flex items-start text-sm">
              <span class="text-gray-300 w-24 shrink-0 font-medium">制作商：</span>
              <div v-if="movie.publishers && movie.publishers.length > 0" class="flex flex-wrap gap-2">
                <RouterLink
                  v-for="(publisher, index) in movie.publishers"
                  :key="typeof publisher === 'object' ? (publisher.id || publisher.slug || `publisher-${index}`) : `publisher-str-${index}`"
                  :to="typeof publisher === 'object' && publisher.slug ? `/publishers/${publisher.slug}` : '#'"
                  class="px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200" :class="[
                    typeof publisher === 'object' && publisher.slug
                      ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                      : 'bg-gray-600 text-gray-300 cursor-not-allowed',
                  ]"
                  @click.prevent="typeof publisher !== 'object' || !publisher.slug ? null : undefined"
                >
                  {{ typeof publisher === 'object' ? publisher.name : publisher }}
                  <span v-if="typeof publisher !== 'object' || !publisher.slug" class="ml-1 text-[10px] opacity-70">
                    (未同步)
                  </span>
                </RouterLink>
              </div>
              <span v-else class="text-gray-400 text-xs">暂无数据</span>
            </div>

            <div v-if="movie.description" class="flex items-start text-sm pt-2">
              <span class="text-gray-300 w-24 shrink-0 font-medium">简介：</span>
              <p class="text-gray-200 flex-1 leading-relaxed">
                {{ movie.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 播放源区块 -->
    <div v-if="sortedPlayers.length > 0" class="bg-gray-800 rounded-lg shadow-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-white">
          播放源
        </h2>
        <div class="flex gap-2 flex-wrap">
          <button
            v-if="magnetLinks.length > 0"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            @click="copyAllMagnetLinks"
          >
            📋 复制全部磁链
          </button>
          <button
            :disabled="isInDownloadList(movie.id)"
            class="px-4 py-2 text-sm rounded-lg transition-colors"
            :class="isInDownloadList(movie.id)
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'"
            @click="addToList"
          >
            {{ isInDownloadList(movie.id) ? '✓ 已在列表' : '➕ 添加到下载列表' }}
          </button>
          <button
            :disabled="favoritingLoading"
            class="px-4 py-2 text-sm rounded-lg transition-colors"
            :class="isFavorited
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'"
            @click="toggleFavorite"
          >
            <span v-if="favoritingLoading">⟳</span>
            <span v-else>{{ isFavorited ? '⭐ 已收藏' : '☆ 收藏' }}</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="player in sortedPlayers"
          :key="player.id"
          class="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700 transition-colors"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">{{ getSourceTypeIcon(player) }}</span>
                <span class="text-white font-medium truncate">
                  {{ player.sourceName }}
                </span>
                <span
                  v-if="player.quality"
                  class="px-2 py-0.5 text-xs font-semibold rounded"
                  :class="getQualityBadgeClass(player.quality)"
                >
                  {{ player.quality }}
                </span>
                <span
                  v-if="getPlayerRating(player).recommendationTag"
                  class="text-xs"
                  :title="getPlayerRating(player).recommendationTag"
                >
                  {{ getPlayerRating(player).recommendationTag === '🏆 强烈推荐' ? '🏆' : '👍' }}
                </span>
              </div>
              <div class="text-xs text-gray-400 truncate mb-2">
                {{ isMagnetLink(player.sourceUrl) ? 'magnet:...' : player.sourceUrl }}
              </div>

              <!-- 评分显示 -->
              <div class="flex items-center gap-2">
                <RatingStars
                  :model-value="player.averageRating || 0"
                  :show-stats="true"
                  :count="player.ratingCount"
                  size="small"
                />
              </div>

              <!-- 调试信息：自动评分详情（仅调试模式） -->
              <div v-if="debugMode" class="mt-2 p-2 bg-gray-800 rounded text-xs space-y-1">
                <div class="text-gray-400 font-semibold">
                  🔍 自动评分详情
                </div>
                <div class="text-gray-300">
                  综合评分: <span class="text-yellow-400">{{ getPlayerRating(player).compositeScore?.toFixed(1) ?? 'N/A' }}</span>
                </div>
                <div class="text-gray-300">
                  自动评分: <span class="text-blue-400">{{ getPlayerRating(player).autoScore.toFixed(1) }}</span>
                </div>
                <div class="text-gray-300">
                  用户评分: <span class="text-green-400">{{ player.averageRating?.toFixed(1) || 'N/A' }}</span>
                  ({{ player.ratingCount || 0 }} 人)
                </div>
                <div class="text-gray-400 text-[10px] mt-1">
                  提示: 在浏览器控制台执行 localStorage.setItem('debugMode', 'false') 可关闭调试模式
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2 shrink-0">
              <button
                v-if="isMagnetLink(player.sourceUrl)"
                class="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                @click="copyMagnetLink(player)"
              >
                📋 复制
              </button>
              <button
                v-if="isMagnetLink(player.sourceUrl) && aria2Connected"
                class="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                @click="addToAria2(player)"
              >
                ⬇️ Aria2
              </button>
              <a
                v-if="isMagnetLink(player.sourceUrl)"
                :href="player.sourceUrl"
                class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded text-center transition-colors whitespace-nowrap"
              >
                🔗 打开
              </a>
              <button
                v-if="isMagnetLink(player.sourceUrl)"
                class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                @click="showQRCode(player)"
              >
                📱 二维码
              </button>
              <a
                v-else
                :href="player.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded text-center transition-colors whitespace-nowrap"
              >
                ▶️ 播放
              </a>
              <button
                class="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                @click="showRatingModal(player)"
              >
                ⭐ 评分
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 无播放源提示 -->
    <div v-else-if="!loading && movie" class="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-bold text-white mb-4">
        播放源
      </h2>
      <div class="text-center py-8 text-gray-400">
        <p class="text-lg mb-2">
          暂无播放源
        </p>
        <p class="text-sm">
          该影片尚未添加播放源信息
        </p>
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

    <!-- 二维码 Modal -->
    <Transition name="modal">
      <div
        v-if="qrcodeModal.show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="closeQRCode"
      >
        <div class="bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
          <button
            class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            @click="closeQRCode"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 class="text-lg font-bold text-white mb-4">
            {{ qrcodeModal.title }}
          </h3>

          <div class="bg-white p-4 rounded-lg flex items-center justify-center mb-4">
            <QrcodeVue
              :value="qrcodeModal.content"
              :size="240"
              level="H"
              render-as="svg"
            />
          </div>

          <p class="text-xs text-gray-400 text-center">
            使用手机扫描二维码获取磁力链接
          </p>
        </div>
      </div>
    </Transition>

    <!-- 评分 Modal -->
    <Transition name="modal">
      <div
        v-if="ratingModal.show && ratingModal.player"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="closeRatingModal"
      >
        <div class="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
          <button
            class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            @click="closeRatingModal"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 class="text-lg font-bold text-white mb-4">
            评分播放源
          </h3>

          <div class="mb-4">
            <p class="text-gray-300 text-sm mb-2">
              {{ ratingModal.player.sourceName }}
              <span v-if="ratingModal.player.quality" class="text-primary-400">
                [{{ ratingModal.player.quality }}]
              </span>
            </p>
          </div>

          <div class="mb-6">
            <p class="text-gray-400 text-sm mb-3">
              请为该播放源评分（1-5 星）
            </p>
            <div class="flex justify-center">
              <RatingStars
                :model-value="ratingModal.player.userScore || 0"
                :interactive="true"
                size="large"
                @change="handleSubmitRating"
              />
            </div>
          </div>

          <div v-if="ratingModal.player.averageRating" class="text-center text-sm text-gray-400">
            <p>
              当前平均评分: {{ ratingModal.player.averageRating.toFixed(1) }} 分
              ({{ ratingModal.player.ratingCount }} 人评价)
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="movie.relatedMovies && movie.relatedMovies.length > 0" class="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-bold text-white mb-4">
        相关影片
      </h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <RouterLink
          v-for="related in movie.relatedMovies"
          :key="related.id"
          :to="`/movie/${related.code}`"
          class="group cursor-pointer"
        >
          <div class="relative overflow-hidden rounded-lg shadow-md group-hover:shadow-xl transition-shadow duration-300">
            <div class="aspect-3/4 bg-gray-700">
              <img
                v-if="related.coverImage"
                :src="related.coverImage"
                :alt="related.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              >
            </div>
          </div>
          <p class="mt-2 text-sm text-white line-clamp-2 group-hover:text-primary-400 transition">
            {{ related.title }}
          </p>
        </RouterLink>
      </div>
    </div>
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

/* Modal 动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div {
  transform: scale(0.9);
  opacity: 0;
}

.modal-leave-to > div {
  transform: scale(0.9);
  opacity: 0;
}
</style>
