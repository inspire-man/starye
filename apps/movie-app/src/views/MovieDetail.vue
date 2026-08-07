<script setup lang="ts">
import type { MovieDetail, Player, ReadinessProjection, SourceDisposition, SourceReasonCode } from '../types'
import type { TorrentFile } from '../utils/torrServerClient'
import QrcodeVue from 'qrcode.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import RatingStars from '../components/RatingStars.vue'
import { useAria2 } from '../composables/useAria2'
import { useAuthGuard } from '../composables/useAuthGuard'
import { useDownloadList } from '../composables/useDownloadList'
import { useFavorites } from '../composables/useFavorites'
import { useRating } from '../composables/useRating'
import { useTorrServer } from '../composables/useTorrServer'
import { movieApi, ratingApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'
import { copyMagnetLinks, copyToClipboard } from '../utils/clipboard'
import { isMagnetLink } from '../utils/magnetLink'
import {
  classifyPlaybackSource,
  getQualityBadgeClass,
  getSourceTypeIcon,
  groupPlaybackSources,
  isEligiblePlaybackSource,
  selectDirectPlaybackSource,
  sortPlaybackSources,
} from '../utils/playbackSources'
import { formatTorrentFileSize } from '../utils/torrServerClient'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const movie = ref<MovieDetail | null>(null)
const readiness = computed<ReadinessProjection | null>(() => movie.value?.readiness ?? null)

type InformationalSourceType = 'direct' | 'magnet' | 'TorrServer'
type InformationalSourceHealth = 'inactive' | 'unverified' | 'failed'
type InformationalSourceReason = 'source_inactive' | 'source_unverified' | 'source_candidate_invalid' | 'source_read_failed' | 'source_write_failed'

interface InformationalSourceHealthRow {
  playerId: string
  eligible: boolean
  health: InformationalSourceHealth
  observedAt: number
  reasonCode: InformationalSourceReason
  sourceRevision: number
  sourceType: InformationalSourceType
}

// 用户状态
const userStore = useUserStore()

// 下载列表管理
const { isInDownloadList, addToDownloadList } = useDownloadList()

// 收藏管理
const { addFavorite, removeFavorite, checkIsFavorited } = useFavorites()
const isFavorited = ref(false)
const currentFavoriteId = ref<string | null>(null)
const favoritingLoading = ref(false)

// 评分管理
const { getPlayerRating } = useRating()

// Aria2 管理
const { isConnected: aria2Connected, addMagnetTask } = useAria2()

// TorrServer 管理
const { isConnected: torrServerConnected, streamMagnet, buildStreamForFile } = useTorrServer()
const torrServerLoading = ref(false)
const fileSelectionModal = ref<{ show: boolean, files: TorrentFile[], magnetUrl: string }>({
  show: false,
  files: [],
  magnetUrl: '',
})

// 调试模式（从 localStorage 读取，可以在控制台执行 localStorage.setItem('debugMode', 'true') 开启）
const debugMode = ref(localStorage.getItem('debugMode') === 'true')

// 排序方式
const sortMethod = ref<import('../utils/playbackSources').SortMethod>('default')

// 二维码弹窗
const qrcodeModal = ref({ show: false, content: '', title: '' })

// 评分弹窗
const ratingModal = ref({ show: false, player: null as Player | null, submitting: false })

// 上报确认弹窗
const reportModal = ref({ show: false, player: null as Player | null, submitting: false })

// 本地已上报的 player id 集合（当前会话内防重复）
const reportedPlayerIds = ref<Set<string>>(new Set())

// Toast 提示
const toast = ref({ show: false, message: '', type: 'success' as 'success' | 'error' })

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

const sourceDispositionLabels: Record<SourceDisposition, string> = {
  ready: '来源就绪',
  no_source: '暂无来源',
  source_failed: '来源失败',
  repairing: '修复中',
}

const sourceReasonLabels: Record<SourceReasonCode, string> = {
  no_eligible_source: '读回未发现可用来源',
  repair_requested: '受控修复已请求',
  source_candidate_invalid: '候选来源未通过校验',
  source_read_failed: '来源读回失败',
  source_write_failed: '来源写入失败',
}

function sourceDispositionLabel(disposition: SourceDisposition): string {
  return `${disposition} · ${sourceDispositionLabels[disposition]}`
}

function sourceReasonLabel(reasonCode: SourceReasonCode | null): string {
  return reasonCode ? `${reasonCode} · ${sourceReasonLabels[reasonCode]}` : '无'
}

function playbackStatusLabel(status: ReadinessProjection['playback']['status']): string {
  return status === 'playback_verified'
    ? 'playback_verified · 播放已验证'
    : 'unverified · 播放未验证'
}

const sourceHealthLabels: Record<InformationalSourceHealth, string> = {
  inactive: 'inactive · 未参与候选',
  unverified: 'unverified · 尚未验证',
  failed: 'failed · 来源失败',
}

const sourceHealthReasonLabels: Record<InformationalSourceReason, string> = {
  source_inactive: '来源未启用',
  source_unverified: '来源尚未验证',
  source_candidate_invalid: '来源候选未通过校验',
  source_read_failed: '来源读取失败',
  source_write_failed: '来源写入失败',
}

function informationalSourceType(player: Player): InformationalSourceType {
  return classifyPlaybackSource(player)
}

function informationalSourceHealth(player: Player): InformationalSourceHealth {
  if (player.isActive === false)
    return 'inactive'
  if (readiness.value?.source.disposition === 'source_failed')
    return 'failed'
  return 'unverified'
}

function informationalSourceReason(health: InformationalSourceHealth): InformationalSourceReason {
  if (health === 'inactive')
    return 'source_inactive'
  if (health === 'failed')
    return 'source_read_failed'
  return 'source_unverified'
}

const sourceHealthRows = computed<InformationalSourceHealthRow[]>(() => {
  const observedAt = readiness.value?.source.observedAt ?? 0
  const sourceRevision = readiness.value?.source.sourceRevision ?? 0
  return (movie.value?.players ?? []).map((player) => {
    const health = informationalSourceHealth(player)
    return {
      playerId: player.id,
      eligible: isEligiblePlaybackSource(player),
      health,
      observedAt,
      reasonCode: informationalSourceReason(health),
      sourceRevision,
      sourceType: informationalSourceType(player),
    }
  })
})

function sourceHealthLabel(health: InformationalSourceHealth): string {
  return `${health} · ${sourceHealthLabels[health]}`
}

function sourceHealthReasonLabel(reasonCode: InformationalSourceReason): string {
  return `${reasonCode} · ${sourceHealthReasonLabels[reasonCode]}`
}

function showRepairIntent() {
  const source = readiness.value?.source
  const movieId = movie.value?.id
  if (!source?.repairable || !movieId || !['no_source', 'source_failed'].includes(source.disposition))
    return

  const reason = source.disposition
  router.push(`/dashboard/crawlers?movieId=${encodeURIComponent(movieId)}&reason=${reason}`)
}

async function refreshReadiness() {
  if (loading.value)
    return

  await fetchMovieDetail()
}

function getAria2ButtonTitle(player: Player) {
  if (!isMagnetLink(player.sourceUrl)) {
    return '只支持磁力链接添加到 Aria2'
  }

  return aria2Connected.value
    ? '添加到 Aria2'
    : 'aria2 未连接，请先在设置中配置'
}

function getTorrServerButtonTitle(player: Player) {
  if (!isMagnetLink(player.sourceUrl)) {
    return '只支持磁力链接的在线播放'
  }

  if (!torrServerConnected.value) {
    return 'TorrServer 未连接，请先在设置中配置'
  }

  return torrServerLoading.value ? 'TorrServer 正在准备当前播放流' : '通过 TorrServer 在线播放'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN')
}

/**
 * 归一化 genres 字段：兼容 string（JSON 或逗号分隔）和 string[] 两种格式，
 * 并清理爬虫遗留的 * 包裹符号
 */
const genreList = computed<string[]>(() => {
  const raw = movie.value?.genres
  if (!raw)
    return []
  let arr: string[]
  if (Array.isArray(raw)) {
    arr = raw as string[]
  }
  else {
    try {
      const parsed = JSON.parse(raw as unknown as string)
      arr = Array.isArray(parsed) ? parsed : [String(raw)]
    }
    catch {
      arr = (raw as unknown as string).split(',')
    }
  }
  return arr.map(g => g.replace(/^\*+|\*+$/g, '').trim()).filter(Boolean)
})

/**
 * 演员列表：优先使用结构化对象数组（来自关联表），
 * 若为字符串数组（旧 JSON 字段）则降级展示
 */
const actorList = computed(() => {
  const raw = movie.value?.actors
  if (!raw || !Array.isArray(raw) || raw.length === 0)
    return []
  return raw
})

/**
 * 制作商列表：结构化对象数组（来自关联表）
 */
const publisherList = computed(() => {
  return movie.value?.publishers ?? []
})

/**
 * 系列导航：从 relatedMovies 中提取同系列影片，按 releaseDate ASC 排序，计算当前位置
 */
const seriesNavigation = computed(() => {
  const m = movie.value
  if (!m?.series)
    return null

  // 同系列影片（来自 relatedMovies），加上当前影片自身，合并排序
  const sameSeriesFromRelated = (m.relatedMovies ?? []).filter(
    r => r.series === m.series,
  )
  const allInSeries = [
    { id: m.id, code: m.code, title: m.title, releaseDate: m.releaseDate },
    ...sameSeriesFromRelated.map(r => ({
      id: r.id,
      code: r.code,
      title: r.title,
      releaseDate: r.releaseDate,
    })),
  ]

  // 按 releaseDate ASC 排序，无 releaseDate 则按 code ASC 兜底
  allInSeries.sort((a, b) => {
    if (a.releaseDate && b.releaseDate)
      return a.releaseDate - b.releaseDate
    if (a.releaseDate)
      return -1
    if (b.releaseDate)
      return 1
    return a.code.localeCompare(b.code)
  })

  const idx = allInSeries.findIndex(item => item.id === m.id)
  if (idx === -1)
    return null

  return {
    series: m.series,
    total: allInSeries.length,
    position: idx + 1,
    prev: idx > 0 ? allInSeries[idx - 1] : null,
    next: idx < allInSeries.length - 1 ? allInSeries[idx + 1] : null,
  }
})

// 播放源相关逻辑
const sortedPlayers = computed(() => {
  return sortPlaybackSources(movie.value?.players ?? [], sortMethod.value)
})

const sourceCardGroups = computed(() => {
  const groups = groupPlaybackSources(sortedPlayers.value)
  return [
    {
      key: 'eligible-direct',
      label: 'eligible direct · 浏览器播放',
      sources: groups.eligibleDirect,
    },
    {
      key: 'eligible-magnet',
      label: 'eligible magnet · 受控传输',
      sources: groups.eligibleMagnet,
    },
    {
      key: 'ineligible',
      label: 'inactive / ineligible · 仅健康信息',
      sources: groups.ineligible,
    },
  ].filter(group => group.sources.length > 0)
})

const firstEligibleDirect = computed(() => selectDirectPlaybackSource(movie.value?.players ?? []))

const magnetLinks = computed(() => {
  return groupPlaybackSources(sortedPlayers.value).eligibleMagnet
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

// 显示评分弹窗（需要登录）
function showRatingModal(player: Player) {
  if (!userStore.user) {
    showToast('请先登录后评分', 'error')
    return
  }
  ratingModal.value = { show: true, player, submitting: false }
}

// 关闭评分弹窗
function closeRatingModal() {
  ratingModal.value.show = false
  ratingModal.value.player = null
  ratingModal.value.submitting = false
}

// 提交评分（乐观更新本地 player 状态）
async function handleSubmitRating(score: number) {
  const player = ratingModal.value.player
  if (!player || ratingModal.value.submitting)
    return

  ratingModal.value.submitting = true
  try {
    const result = await ratingApi.submitPlayerRating(player.id, score)
    // 乐观更新：直接修改本地 players 列表中该条目的评分数据
    if (movie.value?.players) {
      const target = movie.value.players.find(p => p.id === player.id)
      if (target) {
        target.averageRating = result.averageRating
        target.ratingCount = result.ratingCount
        target.userScore = score
      }
    }
    showToast('评分已提交')
    closeRatingModal()
  }
  catch (err: any) {
    showToast(err.message || '评分提交失败', 'error')
  }
  finally {
    ratingModal.value.submitting = false
  }
}

// 显示上报确认弹窗（需要登录）
function showReportModal(player: Player) {
  if (!userStore.user) {
    showToast('请先登录后再上报', 'error')
    return
  }
  if (reportedPlayerIds.value.has(player.id)) {
    showToast('您已上报过此播放源', 'error')
    return
  }
  reportModal.value = { show: true, player, submitting: false }
}

// 关闭上报弹窗
function closeReportModal() {
  reportModal.value.show = false
  reportModal.value.player = null
  reportModal.value.submitting = false
}

// 确认上报
async function handleConfirmReport() {
  const player = reportModal.value.player
  if (!player || reportModal.value.submitting)
    return

  reportModal.value.submitting = true
  try {
    await ratingApi.reportPlayer(player.id)
    // 本地标记已上报
    reportedPlayerIds.value.add(player.id)
    showToast('上报成功，感谢你的反馈')
    closeReportModal()
  }
  catch (err: any) {
    showToast(err.message || '上报失败，请稍后再试', 'error')
  }
  finally {
    reportModal.value.submitting = false
  }
}

// 添加到 Aria2
async function addToAria2(player: Player) {
  if (!aria2Connected.value) {
    showToast('请先在个人中心配置 Aria2 连接', 'error')
    return
  }

  if (readiness.value?.source.disposition !== 'ready'
    || !isEligiblePlaybackSource(player)
    || classifyPlaybackSource(player) !== 'magnet') {
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

// TorrServer 在线播放
async function playViaTorrServer(player: Player) {
  if (!torrServerConnected.value) {
    showToast('请先在个人中心配置 TorrServer 连接', 'error')
    return
  }

  if (readiness.value?.source.disposition !== 'ready'
    || !isEligiblePlaybackSource(player)
    || classifyPlaybackSource(player) !== 'magnet') {
    showToast('只支持磁力链接的在线播放', 'error')
    return
  }

  torrServerLoading.value = true
  try {
    const result = await streamMagnet(player.sourceUrl)

    if ('needsSelection' in result) {
      fileSelectionModal.value = {
        show: true,
        files: result.files,
        magnetUrl: result.magnetUrl,
      }
      return
    }

    const streamResult = result
    router.push({
      name: 'player',
      params: { code: movie.value!.code },
      query: { streamUrl: streamResult.streamUrl },
    })
  }
  catch (error: any) {
    showToast(error.message || 'TorrServer 播放失败', 'error')
  }
  finally {
    torrServerLoading.value = false
  }
}

// 文件选择后播放
function selectFileAndPlay(file: TorrentFile) {
  if (readiness.value?.source.disposition !== 'ready'
    || !movie.value
    || !isMagnetLink(fileSelectionModal.value.magnetUrl)) {
    return
  }

  const result = buildStreamForFile(fileSelectionModal.value.magnetUrl, file)
  fileSelectionModal.value.show = false

  router.push({
    name: 'player',
    params: { code: movie.value!.code },
    query: { streamUrl: result.streamUrl },
  })
}

function closeFileSelection() {
  fileSelectionModal.value.show = false
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
  if (!movie.value || userStore.loading || !userStore.user) {
    isFavorited.value = false
    currentFavoriteId.value = null
    return
  }

  try {
    const result = await checkIsFavorited('movie', movie.value.id)
    isFavorited.value = result.isFavorited
    currentFavoriteId.value = result.favoriteId
  }
  catch (e) {
    console.error('[MovieDetail] 检查收藏状态失败:', e)
  }
}

watch(
  () => userStore.loading,
  (loading) => {
    if (!loading && userStore.user && movie.value) {
      void checkFavoriteStatus()
    }
  },
)

// 切换收藏
async function toggleFavorite() {
  const { requireLogin } = useAuthGuard()
  if (!requireLogin())
    return // 未登录 → 跳转登录页，early return
  if (!movie.value || favoritingLoading.value)
    return

  favoritingLoading.value = true

  try {
    if (isFavorited.value && currentFavoriteId.value) {
      const result = await removeFavorite(currentFavoriteId.value)
      if (result.success) {
        isFavorited.value = false
        currentFavoriteId.value = null
        showToast('已取消收藏')
      }
      else {
        showToast(result.error || '取消收藏失败', 'error')
      }
    }
    else {
      const result = await addFavorite('movie', movie.value.id)
      if (result.success) {
        isFavorited.value = true
        showToast(result.alreadyExists ? '已在收藏夹中' : '已添加到收藏夹')
        // 重新获取 favoriteId
        await checkFavoriteStatus()
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
        <!-- 封面：完整展示横版原图（400:267） -->
        <div class="shrink-0 w-full md:w-auto">
          <img
            v-if="movie.coverImage"
            :src="movie.coverImage"
            :alt="movie.title"
            class="w-full md:w-80 h-auto rounded-lg shadow-md object-cover"
          >
          <div
            v-else
            class="w-full md:w-80 bg-gray-700 rounded-lg flex items-center justify-center"
            style="aspect-ratio: 400/267"
          >
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
                <span
                  :data-phase13-item-code="movie.code"
                  :data-phase13-item-id="movie.id"
                  class="bg-gray-700/80 text-primary-400 font-mono text-sm px-3 py-1.5 rounded-md border border-gray-600"
                >
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
              <div v-if="actorList.length > 0" class="flex flex-wrap gap-2">
                <RouterLink
                  v-for="(actor, index) in actorList"
                  :key="typeof actor === 'object' ? (actor.id || actor.slug || `actor-${index}`) : `actor-str-${index}`"
                  :to="typeof actor === 'object' && actor.slug ? `/actors/${actor.slug}` : '#'"
                  class="px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200"
                  :class="typeof actor === 'object' && actor.slug
                    ? 'bg-primary-600 hover:bg-primary-500 text-white cursor-pointer'
                    : 'bg-gray-600 text-gray-300 cursor-not-allowed'"
                  @click.prevent="typeof actor !== 'object' || !actor.slug ? null : undefined"
                >
                  {{ typeof actor === 'object' ? actor.name : actor }}
                </RouterLink>
              </div>
              <span v-else class="text-gray-400 text-xs">暂无数据</span>
            </div>

            <div v-if="genreList.length > 0" class="flex items-start text-sm">
              <span class="text-gray-300 w-24 shrink-0 font-medium">标签：</span>
              <div class="flex flex-wrap gap-2">
                <RouterLink
                  v-for="genre in genreList"
                  :key="genre"
                  :to="{ path: '/', query: { genre } }"
                  class="bg-purple-600/20 border border-purple-500/30 text-purple-300 px-2 py-1 rounded text-xs hover:bg-purple-500/30 transition-colors cursor-pointer"
                >
                  {{ genre }}
                </RouterLink>
              </div>
            </div>

            <div class="flex items-start text-sm">
              <span class="text-gray-300 w-24 shrink-0 font-medium">制作商：</span>
              <div v-if="publisherList.length > 0" class="flex flex-wrap gap-2">
                <RouterLink
                  v-for="publisher in publisherList"
                  :key="publisher.id || publisher.slug"
                  :to="publisher.slug ? `/publishers/${publisher.slug}` : '#'"
                  class="px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 bg-green-700 hover:bg-green-600 text-white cursor-pointer"
                >
                  {{ publisher.name }}
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

    <div
      v-if="readiness"
      data-readiness-summary
      class="bg-gray-800 rounded-lg shadow-lg p-6 space-y-4"
      aria-live="polite"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-white">
            播放可用性
          </h2>
          <p class="text-sm text-gray-300 mt-1">
            内容身份：{{ movie.id }} / {{ movie.primaryContentId }}
          </p>
        </div>
        <RouterLink
          v-if="readiness.source.disposition === 'ready' && firstEligibleDirect"
          :to="`/movie/${movie.code}/play?player=${encodeURIComponent(firstEligibleDirect.id)}`"
          data-readiness-action="play"
          class="min-h-11 inline-flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-lg transition-colors"
        >
          播放
        </RouterLink>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <section class="border border-gray-700 rounded-lg p-4">
          <h3 class="text-sm font-semibold text-gray-200">
            Metadata persisted
          </h3>
          <p class="mt-2 text-sm text-green-300">
            <span aria-hidden="true">✓</span>
            {{ readiness.metadata.persisted ? '已持久化' : '未持久化' }}
          </p>
          <p class="mt-1 text-xs text-gray-400 break-words">
            content ID：{{ readiness.metadata.contentId }}
          </p>
          <p class="mt-1 text-xs text-gray-400">
            最近持久化：{{ readiness.metadata.observedAt ?? '尚未上报' }}
          </p>
        </section>

        <section
          class="border border-gray-700 rounded-lg p-4"
          :class="`readiness-${readiness.source.disposition}`"
          :role="readiness.source.disposition === 'source_failed' ? 'alert' : readiness.source.disposition === 'repairing' ? 'status' : undefined"
        >
          <h3 class="text-sm font-semibold text-gray-200">
            Source readiness
          </h3>
          <p class="mt-2 text-sm text-white">
            <span aria-hidden="true">{{ readiness.source.disposition === 'ready' ? '✓' : readiness.source.disposition === 'source_failed' ? '!' : readiness.source.disposition === 'repairing' ? '↻' : '?' }}</span>
            {{ sourceDispositionLabel(readiness.source.disposition) }}
          </p>
          <p class="mt-1 text-sm text-gray-300">
            eligible count：{{ readiness.source.eligibleCount }}
          </p>
          <p class="mt-1 text-xs text-gray-400">
            source revision：{{ readiness.source.sourceRevision }} · 最近读回：{{ readiness.source.observedAt }}
          </p>
          <p class="mt-1 text-xs text-gray-300 break-words">
            受控原因：{{ sourceReasonLabel(readiness.source.reasonCode) }}
          </p>
          <p v-if="readiness.source.disposition === 'no_source'" class="mt-2 text-base text-amber-300">
            暂无可用播放源
          </p>
          <p v-else-if="readiness.source.disposition === 'source_failed'" class="mt-2 text-base text-red-300">
            来源读取失败，请重试读取或查看修复意图
          </p>
          <p v-else-if="readiness.source.disposition === 'repairing'" data-repairing-summary class="mt-2 text-base text-amber-300">
            修复状态：等待新的 server-owned source readback
          </p>
          <p v-if="readiness.source.repairable" class="mt-1 text-sm text-amber-300">
            可修复
          </p>
        </section>

        <section class="border border-gray-700 rounded-lg p-4">
          <h3 class="text-sm font-semibold text-gray-200">
            Playback proof
          </h3>
          <p class="mt-2 text-sm text-white">
            <span aria-hidden="true">{{ readiness.playback.status === 'playback_verified' ? '✓' : '?' }}</span>
            {{ playbackStatusLabel(readiness.playback.status) }}
          </p>
          <p v-if="readiness.playback.evidence" class="mt-1 text-xs text-gray-300">
            独立证据：playing · currentTime {{ readiness.playback.evidence.currentTime }}<span v-if="readiness.playback.evidence.observedAt"> · {{ readiness.playback.evidence.observedAt }}</span>
          </p>
          <p v-else class="mt-1 text-xs text-gray-400">
            ready/receipt 不等于浏览器播放证据
          </p>
        </section>

        <section class="border border-gray-700 rounded-lg p-4">
          <h3 class="text-sm font-semibold text-gray-200">
            Receipt/source summary
          </h3>
          <p class="mt-2 text-sm text-gray-300">
            <span aria-hidden="true">{{ readiness.receipt.persisted ? '✓' : '?' }}</span>
            {{ readiness.receipt.persisted ? 'receipt 已持久化' : 'receipt 未持久化' }}
          </p>
          <p class="mt-1 text-xs text-gray-400">
            content identity matched：{{ readiness.receipt.primaryContentId === readiness.metadata.contentId ? '是' : '否' }}
          </p>
          <p class="mt-1 text-xs text-gray-400">
            schema version：{{ readiness.receipt.schemaVersion ?? '未提供' }} · source revision：{{ readiness.source.sourceRevision }}
          </p>
          <p class="mt-1 text-xs text-gray-400">
            candidate count：{{ readiness.source.eligibleCount }} · disposition：{{ readiness.source.disposition }}
          </p>
        </section>
      </div>

      <section v-if="sourceHealthRows.length" data-source-health-summary class="mt-3 border border-gray-700 rounded-lg p-4" aria-labelledby="source-health-title">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="source-health-title" class="text-sm font-semibold text-gray-200">
            Source health
          </h3>
          <span class="text-xs text-gray-400">最近观察：{{ readiness.source.observedAt }}</span>
        </div>
        <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <article
            v-for="source in sourceHealthRows"
            :key="source.playerId"
            :data-source-health-row="source.sourceType"
            :data-source-health-player="source.playerId"
            class="border border-gray-700 rounded-lg p-3 text-xs text-gray-300"
          >
            <p class="font-semibold text-gray-100">
              {{ source.sourceType }}
            </p>
            <p class="mt-1">
              {{ sourceHealthLabel(source.health) }}
            </p>
            <p class="mt-1">
              观察时间：{{ source.observedAt }}
            </p>
            <p class="mt-1">
              source revision：{{ source.sourceRevision }}
            </p>
            <p class="mt-1 break-words">
              受控原因：{{ sourceHealthReasonLabel(source.reasonCode) }}
            </p>
            <p class="mt-1" :class="source.eligible ? 'text-green-300' : 'text-gray-400'">
              {{ source.eligible ? 'eligible · 可作为候选' : 'ineligible · 不作为候选' }}
            </p>
          </article>
        </div>
      </section>

      <div class="flex flex-wrap gap-2" aria-label="受控 readiness 操作">
        <button
          v-if="['no_source', 'source_failed'].includes(readiness.source.disposition)"
          data-readiness-action="repair"
          type="button"
          class="min-h-11 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors"
          @click="showRepairIntent"
        >
          查看修复意图
        </button>
        <button
          v-if="['no_source', 'source_failed'].includes(readiness.source.disposition)"
          data-readiness-action="refresh"
          type="button"
          class="min-h-11 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="refreshReadiness"
        >
          {{ loading ? '读取中…' : '重试读取' }}
        </button>
        <button
          v-else-if="readiness.source.disposition === 'repairing'"
          data-readiness-action="refresh"
          type="button"
          class="min-h-11 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="refreshReadiness"
        >
          {{ loading ? '读取中…' : '刷新状态' }}
        </button>
      </div>
    </div>

    <!-- 播放源区块 -->
    <div v-if="sourceCardGroups.length > 0 && (!readiness || readiness.source.disposition === 'ready')" class="bg-gray-800 rounded-lg shadow-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-4">
          <h2 class="text-xl font-bold text-white">
            播放源
          </h2>
          <!-- 排序选择器 -->
          <select
            v-model="sortMethod"
            class="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
          >
            <option value="default">
              默认排序
            </option>
            <option value="rating">
              按评分
            </option>
            <option value="quality">
              按画质
            </option>
            <option value="latest">
              按最新
            </option>
          </select>
        </div>
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

      <div class="space-y-5">
        <section
          v-for="group in sourceCardGroups"
          :key="group.key"
          :data-source-group="group.key"
        >
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="text-sm font-semibold text-gray-200">
              {{ group.label }}
            </h3>
            <span class="text-xs text-gray-400">{{ group.sources.length }} 个来源</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <article
              v-for="player in group.sources"
              :key="player.id"
              :data-source-card="player.id"
              :data-source-type="classifyPlaybackSource(player)"
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
                      v-if="player.quality && group.key !== 'ineligible'"
                      class="px-2 py-0.5 text-xs font-semibold rounded"
                      :class="getQualityBadgeClass(player.quality)"
                    >
                      {{ player.quality }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-300">
                    source type：{{ classifyPlaybackSource(player) }}
                  </div>
                  <div class="mt-1 text-xs text-gray-400">
                    {{ sourceHealthLabel(informationalSourceHealth(player)) }} · {{ sourceHealthReasonLabel(informationalSourceReason(informationalSourceHealth(player))) }}
                  </div>
                  <div class="mt-1 text-xs text-gray-400">
                    观察时间：{{ readiness?.source.observedAt ?? 0 }} · source revision：{{ readiness?.source.sourceRevision ?? 0 }}
                  </div>
                  <div class="mt-1 text-xs" :class="group.key === 'ineligible' ? 'text-gray-400' : 'text-green-300'">
                    {{ group.key === 'ineligible' ? 'ineligible · 仅保留健康信息' : 'eligible · 可进入受控路径' }}
                  </div>

                  <template v-if="group.key !== 'ineligible'">
                    <div class="flex items-center gap-2 mt-3">
                      <RatingStars
                        :model-value="player.averageRating || 0"
                        :show-stats="true"
                        :count="player.ratingCount"
                        size="small"
                      />
                    </div>

                    <div v-if="debugMode" class="mt-2 p-2 bg-gray-800 rounded text-xs space-y-1">
                      <div class="text-gray-400 font-semibold">
                        自动评分详情
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
                    </div>
                  </template>
                </div>

                <div v-if="group.key !== 'ineligible'" class="flex flex-col gap-2 shrink-0">
                  <RouterLink
                    v-if="group.key === 'eligible-direct'"
                    :to="`/movie/${movie.code}/play?player=${encodeURIComponent(player.id)}`"
                    data-source-action="play"
                    class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded text-center transition-colors whitespace-nowrap"
                  >
                    播放
                  </RouterLink>
                  <template v-else-if="group.key === 'eligible-magnet'">
                    <button
                      data-source-action="copy"
                      class="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                      @click="copyMagnetLink(player)"
                    >
                      复制磁链
                    </button>
                    <button
                      data-source-action="aria2"
                      :disabled="!aria2Connected"
                      :title="getAria2ButtonTitle(player)"
                      class="px-3 py-1.5 text-white text-xs rounded transition-colors whitespace-nowrap disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                      :class="aria2Connected ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600'"
                      @click="addToAria2(player)"
                    >
                      Aria2
                    </button>
                    <button
                      data-source-action="torrserver"
                      :disabled="!torrServerConnected || torrServerLoading"
                      :title="getTorrServerButtonTitle(player)"
                      class="px-3 py-1.5 text-white text-xs rounded transition-colors whitespace-nowrap disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                      :class="torrServerConnected && !torrServerLoading ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-600'"
                      @click="playViaTorrServer(player)"
                    >
                      {{ torrServerLoading ? '加载中' : 'TorrServer' }}
                    </button>
                    <button
                      data-source-action="qrcode"
                      class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                      @click="showQRCode(player)"
                    >
                      二维码
                    </button>
                  </template>
                  <button
                    data-source-action="rating"
                    class="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors whitespace-nowrap"
                    @click="showRatingModal(player)"
                  >
                    评分
                  </button>
                  <button
                    data-source-action="report"
                    :disabled="reportedPlayerIds.has(player.id)"
                    class="px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap"
                    :class="reportedPlayerIds.has(player.id)
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-red-700 hover:bg-red-800 text-white'"
                    @click="showReportModal(player)"
                  >
                    {{ reportedPlayerIds.has(player.id) ? '已上报' : '上报' }}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>

    <!-- 无播放源提示 -->
    <div v-else-if="!loading && movie" class="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-bold text-white mb-4">
        播放源
      </h2>
      <div v-if="readiness?.source.disposition === 'source_failed'" role="alert" class="text-center py-8 text-red-300">
        <p class="text-lg mb-2">
          来源失败
        </p>
        <p class="text-sm">
          受控原因：{{ sourceReasonLabel(readiness.source.reasonCode) }}
        </p>
      </div>
      <div v-else-if="readiness?.source.disposition === 'repairing'" role="status" class="text-center py-8 text-amber-300">
        <p class="text-lg mb-2">
          来源修复中
        </p>
        <p class="text-sm">
          当前状态尚未完成读回确认，请刷新状态。
        </p>
      </div>
      <div v-else-if="readiness?.source.disposition === 'no_source'" class="text-center py-8 text-gray-400">
        <p class="text-lg mb-2">
          暂无可用播放源
        </p>
        <p class="text-sm">
          eligible count：{{ readiness.source.eligibleCount }}，当前状态可修复。
        </p>
      </div>
      <div v-else class="text-center py-8 text-gray-400">
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
                :interactive="!ratingModal.submitting"
                size="large"
                @change="handleSubmitRating"
              />
            </div>
            <p v-if="ratingModal.submitting" class="text-center text-gray-400 text-xs mt-3">
              提交中...
            </p>
          </div>

          <div v-if="ratingModal.player.averageRating" class="text-center text-sm text-gray-400">
            <p>
              当前平均评分: {{ (ratingModal.player.averageRating / 20).toFixed(1) }} 星
              ({{ ratingModal.player.ratingCount }} 人评价)
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 上报确认 Modal -->
    <Transition name="modal">
      <div
        v-if="reportModal.show && reportModal.player"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="closeReportModal"
      >
        <div class="bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
          <h3 class="text-lg font-bold text-white mb-3">
            🚩 上报播放源失效
          </h3>
          <p class="text-gray-300 text-sm mb-1">
            {{ reportModal.player.sourceName }}
            <span v-if="reportModal.player.quality" class="text-gray-400">
              [{{ reportModal.player.quality }}]
            </span>
          </p>
          <p class="text-gray-400 text-sm mb-6">
            确认上报此播放源为失效？上报数量超过阈值后将自动标记为待审核。
          </p>
          <div class="flex gap-3 justify-end">
            <button
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              @click="closeReportModal"
            >
              取消
            </button>
            <button
              :disabled="reportModal.submitting"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              @click="handleConfirmReport"
            >
              {{ reportModal.submitting ? '上报中...' : '确认上报' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 文件选择 Modal (TorrServer) -->
    <Transition name="modal">
      <div
        v-if="fileSelectionModal.show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="closeFileSelection"
      >
        <div class="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
          <button
            class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            @click="closeFileSelection"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 class="text-lg font-bold text-white mb-4">
            选择播放文件
          </h3>
          <p class="text-gray-400 text-sm mb-4">
            该种子包含多个视频文件，请选择要播放的文件：
          </p>

          <div class="space-y-2 max-h-80 overflow-y-auto">
            <button
              v-for="file in fileSelectionModal.files"
              :key="file.id"
              class="w-full text-left px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
              @click="selectFileAndPlay(file)"
            >
              <p class="text-white text-sm font-medium truncate">
                {{ file.path.split('/').pop() || file.path }}
              </p>
              <p class="text-gray-400 text-xs mt-1">
                {{ formatTorrentFileSize(file.length) }}
              </p>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 系列导航 -->
    <div v-if="seriesNavigation" class="bg-gray-800 rounded-lg shadow-lg p-4">
      <div class="flex items-center justify-between gap-4">
        <RouterLink
          v-if="seriesNavigation.prev"
          :to="`/movie/${seriesNavigation.prev.code}`"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-white transition min-w-0 max-w-[38%]"
        >
          <span class="shrink-0">←</span>
          <span class="truncate text-gray-300">{{ seriesNavigation.prev.title }}</span>
        </RouterLink>
        <span v-else class="w-[38%]" />

        <div class="text-center shrink-0">
          <div class="text-xs text-gray-400 mb-0.5">
            {{ seriesNavigation.series }}
          </div>
          <div class="text-sm font-semibold text-white">
            第 {{ seriesNavigation.position }} 部 / 共 {{ seriesNavigation.total }} 部
          </div>
        </div>

        <RouterLink
          v-if="seriesNavigation.next"
          :to="`/movie/${seriesNavigation.next.code}`"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-white transition min-w-0 max-w-[38%] justify-end"
        >
          <span class="truncate text-gray-300">{{ seriesNavigation.next.title }}</span>
          <span class="shrink-0">→</span>
        </RouterLink>
        <span v-else class="w-[38%]" />
      </div>
    </div>

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
                class="w-full h-full object-cover object-right group-hover:scale-105 transition-transform duration-300"
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
