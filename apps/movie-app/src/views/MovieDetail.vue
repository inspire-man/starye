<script setup lang="ts">
import type { MovieAvailabilityCommandReason, MovieAvailabilitySourceKind, MovieDetail, Player, ReadinessProjection, SourceDisposition, SourceReasonCode } from '../types'
import type { TorrentFile } from '../utils/torrServerClient'
import { ConfirmDialog } from '@starye/ui'
import QrcodeVue from 'qrcode.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import RatingStars from '../components/RatingStars.vue'
import { useAria2 } from '../composables/useAria2'
import { useAuthGuard } from '../composables/useAuthGuard'
import { useDownloadList } from '../composables/useDownloadList'
import { useFavorites } from '../composables/useFavorites'
import { useRating } from '../composables/useRating'
import { useToast } from '../composables/useToast'
import { useTorrServer } from '../composables/useTorrServer'
import { movieApi, ratingApi } from '../lib/api-client'
import { useUserStore } from '../stores/user'
import { copyMagnetLinks, copyToClipboard } from '../utils/clipboard'
import { isMagnetLink } from '../utils/magnetLink'
import {
  buildPlaybackRoute,
  classifyPlaybackSource,
  getQualityBadgeClass,
  getSourceTypeIcon,
  groupPlaybackSources,
  isEligiblePlaybackSource,
  selectControlledPlaybackSource,
  selectDirectPlaybackSource,
  sortPlaybackSources,
} from '../utils/playbackSources'
import { formatTorrentFileSize } from '../utils/torrServerClient'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const loading = ref(true)
const error = ref('')
const movie = ref<MovieDetail | null>(null)
const readiness = computed<ReadinessProjection | null>(() => movie.value?.readiness ?? null)
const userStore = useUserStore()

type VideoLayerName = 'metadata' | 'direct' | 'magnet' | 'playback'

interface VideoLayerDisplay {
  actionKind: 'none' | 'recheck' | 'repair' | 'configure_provider'
  action: string
  counts: Readonly<Record<string, number>>
  freshness: 'fresh' | 'stale' | 'late'
  history: readonly { freshness: string, sourceRevision: number, status: string }[]
  key: VideoLayerName
  label: string
  reason: MovieAvailabilityCommandReason | 'available' | 'provider_unconfigured' | 'provider_failed'
  samples: readonly string[]
  sourceRevision: number
  status: string
}

const videoLayerLabels: Record<VideoLayerName, string> = {
  metadata: 'Metadata',
  direct: 'Direct source',
  magnet: 'Magnet / TorrServer',
  playback: 'Playback',
}

const videoReasonActionLabels: Record<string, string> = {
  browser_inconclusive: '重新检查',
  direct_blocked: '修复来源',
  direct_content_invalid: '修复来源',
  direct_transport_failed: '重新检查',
  metadata_unresolved: '重新检查',
  no_peer: '重新检查',
  no_source: '修复来源',
  playback_failed: '重新检查',
  playback_unverified: '重新检查',
  provider_failed: '配置 provider',
  provider_unconfigured: '配置 provider',
  source_failed: '修复来源',
  stale: '重新检查',
  stalled: '重新检查',
  stream_failed: '重新检查',
  stream_missing: '重新检查',
}

const movieAvailabilityCommandReasons: readonly MovieAvailabilityCommandReason[] = [
  'no_source',
  'source_failed',
  'stale',
  'direct_blocked',
  'direct_transport_failed',
  'direct_content_invalid',
  'browser_inconclusive',
  'metadata_unresolved',
  'no_peer',
  'stalled',
  'stream_missing',
  'stream_failed',
  'playback_unverified',
  'playback_failed',
]

function normalizeVideoLayerReason(reason: string | null | undefined, freshness: VideoLayerDisplay['freshness']): VideoLayerDisplay['reason'] {
  if (freshness !== 'fresh')
    return 'stale'
  if (reason === 'available' || reason === 'provider_unconfigured' || reason === 'provider_failed')
    return reason
  return movieAvailabilityCommandReasons.includes(reason as MovieAvailabilityCommandReason)
    ? reason as MovieAvailabilityCommandReason
    : 'stale'
}

function isMovieAvailabilityCommandReason(reason: VideoLayerDisplay['reason']): reason is MovieAvailabilityCommandReason {
  return movieAvailabilityCommandReasons.includes(reason as MovieAvailabilityCommandReason)
}

function videoLayerAction(reason: string, freshness: VideoLayerDisplay['freshness']): string {
  if (freshness !== 'fresh')
    return '重新检查'
  if (reason === 'available')
    return '无需操作'
  return videoReasonActionLabels[reason] ?? '重新检查'
}

type MovieVideoLayerReason = MovieAvailabilityCommandReason | 'available' | 'provider_unconfigured' | 'provider_failed'

function videoLayerActionKind(reason: MovieVideoLayerReason, freshness: VideoLayerDisplay['freshness']): VideoLayerDisplay['actionKind'] {
  if (freshness !== 'fresh')
    return 'recheck'
  if (reason === 'available')
    return 'none'
  if (reason === 'provider_unconfigured' || reason === 'provider_failed')
    return 'configure_provider'
  if (reason === 'no_source' || reason === 'source_failed' || reason === 'direct_blocked' || reason === 'direct_content_invalid')
    return 'repair'
  return 'recheck'
}

const videoAvailabilityLayers = computed<VideoLayerDisplay[]>(() => {
  const availability = movie.value?.availability
  if (!availability)
    return []

  const revision = availability.current.metadata.sourceRevision
  const facts = availability.current
  return (['metadata', 'direct', 'magnet', 'playback'] as const).map((key): VideoLayerDisplay => {
    if (key === 'metadata') {
      const reason = facts.metadata.persisted ? 'available' : 'metadata_unresolved'
      return {
        actionKind: videoLayerActionKind(reason, 'fresh'),
        action: videoLayerAction(reason, 'fresh'),
        counts: { persisted: facts.metadata.persisted ? 1 : 0 },
        freshness: 'fresh',
        history: [],
        key,
        label: videoLayerLabels[key],
        reason,
        samples: [],
        sourceRevision: facts.metadata.sourceRevision,
        status: facts.metadata.persisted ? '已持久化' : '未持久化',
      }
    }
    if (key === 'playback') {
      const verified = facts.playback.status === 'playback_verified'
      const reason = verified ? 'available' : 'playback_unverified'
      return {
        actionKind: videoLayerActionKind(reason, 'fresh'),
        action: videoLayerAction(reason, 'fresh'),
        counts: { evidence: verified ? 1 : 0 },
        freshness: 'fresh',
        history: [],
        key,
        label: videoLayerLabels[key],
        reason,
        samples: [],
        sourceRevision: revision,
        status: verified ? '播放已验证' : '播放未验证',
      }
    }

    const fact = facts[key]
    const history = availability.history
      .filter(entry => entry.layer === key)
      .map(entry => ({ freshness: entry.fact.freshness, sourceRevision: entry.fact.sourceRevision, status: entry.fact.status }))
    const freshness = fact?.freshness ?? 'fresh'
    const reason = normalizeVideoLayerReason(fact?.reasonCode, freshness)
    return {
      actionKind: videoLayerActionKind(reason, freshness),
      action: videoLayerAction(reason, freshness),
      counts: fact?.summary.counts ?? {},
      freshness,
      history,
      key,
      label: videoLayerLabels[key],
      reason,
      samples: fact?.summary.samples ?? [],
      sourceRevision: fact?.sourceRevision ?? revision,
      status: fact?.status ?? 'unknown',
    }
  })
})

interface MovieUsageSummary {
  readonly description: string
  readonly entryDescription: string
  readonly entryTitle: string
  readonly sourceDescription: string
  readonly sourceTitle: string
  readonly title: string
}

const primaryVideoAvailabilityAction = computed<VideoLayerDisplay | null>(() => {
  const candidates = videoAvailabilityLayers.value.filter(layer => (layer.key === 'direct' || layer.key === 'magnet') && layer.actionKind !== 'none')
  return candidates.find(layer => layer.key === 'magnet') ?? candidates.find(layer => layer.key === 'direct') ?? null
})

const firstEligibleDirect = computed(() => selectDirectPlaybackSource(movie.value?.players ?? []))
const firstControlledFallback = computed(() => selectControlledPlaybackSource(movie.value?.players ?? []))
const r18SourcesHidden = computed(() => movie.value?.isR18 === true && !userStore.user?.isR18Verified)

const movieUsageSummary = computed<MovieUsageSummary>(() => {
  const source = readiness.value?.source
  const magnet = movie.value?.availability?.current.magnet

  if (!source) {
    return {
      description: '正在读取来源状态，请稍候。',
      entryDescription: '等待服务端返回当前状态',
      entryTitle: '读取中',
      sourceDescription: '尚未完成检查',
      sourceTitle: '读取中',
      title: '正在准备影片',
    }
  }

  if (r18SourcesHidden.value) {
    return {
      description: '当前账号处于 SFW 模式，R18 播放源不会显示。',
      entryDescription: '在个人中心查看 R18 访问状态',
      entryTitle: '查看访问状态',
      sourceDescription: '播放源受 R18 访问权限保护',
      sourceTitle: '需要权限',
      title: '播放源已隐藏',
    }
  }

  if (source.disposition === 'repairing') {
    return {
      description: '来源正在更新，完成后刷新状态再选择播放方式。',
      entryDescription: '等待新的来源读回',
      entryTitle: '稍后刷新',
      sourceDescription: '受控修复进行中',
      sourceTitle: '更新中',
      title: '来源正在更新',
    }
  }

  if (source.disposition === 'ready' && firstEligibleDirect.value) {
    return {
      description: '已找到可直接播放的来源，点击“立即播放”即可开始观看。',
      entryDescription: '浏览器可以直接打开',
      entryTitle: '直接播放',
      sourceDescription: `${source.eligibleCount} 个候选来源`,
      sourceTitle: '可播放',
      title: '现在可以直接观看',
    }
  }

  if (source.disposition === 'ready' && firstControlledFallback.value) {
    return {
      description: '当前来源需要受控方式，请在下方选择 TorrServer 在线播放或 Aria2 下载。',
      entryDescription: '在播放源区域选择 TorrServer 或 Aria2',
      entryTitle: '选择播放方式',
      sourceDescription: `${source.eligibleCount} 个候选来源`,
      sourceTitle: '可受控播放',
      title: '选择一种播放方式',
    }
  }

  if (magnet?.status === 'unknown' || magnet?.status === 'degraded') {
    return {
      description: '磁力来源仍在等待 metadata、peer 或 stream 检查，不要把“已入库”当成可播放。',
      entryDescription: '先完成 Magnet / TorrServer 检查',
      entryTitle: '重新检查来源',
      sourceDescription: '磁力来源待确认',
      sourceTitle: '待确认',
      title: '当前还不能确认可观看',
    }
  }

  if (source.disposition === 'ready') {
    return {
      description: '系统保留了来源候选，但当前页面没有可播放入口，可以先重新检查来源。',
      entryDescription: '完成来源检查后再选择播放方式',
      entryTitle: '重新检查来源',
      sourceDescription: `${source.eligibleCount} 个候选来源，暂无可用入口`,
      sourceTitle: '暂无播放入口',
      title: '当前没有可直接观看的入口',
    }
  }

  return {
    description: '当前还没有可直接观看的来源，可以先重新检查或查看修复建议。',
    entryDescription: '按下方说明操作',
    entryTitle: '先检查来源',
    sourceDescription: source.disposition === 'source_failed' ? '来源读回失败' : '暂无可用来源',
    sourceTitle: source.disposition === 'source_failed' ? '来源失败' : '需要处理',
    title: '现在可以怎么用',
  }
})

function releaseDateValue(value: number | string | null | undefined): number | null {
  if (typeof value === 'number')
    return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

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
const fileSelectionModal = ref<{ show: boolean, files: TorrentFile[], magnetUrl: string, playerId: string }>({
  show: false,
  files: [],
  magnetUrl: '',
  playerId: '',
})

// 调试模式（从 localStorage 读取，可以在控制台执行 localStorage.setItem('debugMode', 'true') 开启）
const debugMode = ref(localStorage.getItem('debugMode') === 'true')

// 排序方式
const sortMethod = ref<import('../utils/playbackSources').SortMethod>('default')

// 二维码弹窗
const qrcodeModal = ref({ show: false, content: '', title: '' })

const videoAvailabilityConfirmOpen = ref(false)
const pendingVideoAvailability = ref<{
  action: 'recheck' | 'repair'
  layer: VideoLayerName
  movieId: string
  reason: MovieAvailabilityCommandReason
  sourceKind?: MovieAvailabilitySourceKind
  sourceRevision: number
} | null>(null)
const videoAvailabilityAction = ref(false)

// 评分弹窗
const ratingModal = ref({ show: false, player: null as Player | null, submitting: false })

// 上报确认弹窗
const reportModal = ref({ show: false, player: null as Player | null, submitting: false })

// 本地已上报的 player id 集合（当前会话内防重复）
const reportedPlayerIds = ref<Set<string>>(new Set())

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

const videoAvailabilityConfirmationMessage = computed(() => {
  const target = pendingVideoAvailability.value
  if (!target || !movie.value)
    return ''
  const action = target.action === 'repair' ? '修复' : '重新检查'
  return `将对「${movie.value.title}」的 ${videoLayerLabels[target.layer]} 发起${action}任务。服务端会读取当前 source revision，并使用 canonical policy；当前页面 revision ${target.sourceRevision} 仅用于确认范围。`
})

function openVideoAvailabilityAction(action: 'recheck' | 'repair', layer: VideoLayerName, reason: MovieAvailabilityCommandReason, sourceRevision: number): void {
  const movieId = movie.value?.id
  if (!movieId)
    return
  pendingVideoAvailability.value = {
    action,
    layer,
    movieId,
    reason,
    ...(layer === 'direct' || layer === 'magnet' ? { sourceKind: layer } : {}),
    sourceRevision,
  }
  videoAvailabilityConfirmOpen.value = true
}

function requestVideoLayerAction(layer: VideoLayerDisplay): void {
  if (layer.actionKind === 'none')
    return
  if (layer.actionKind === 'configure_provider') {
    showToast('当前 provider 尚未就绪，请到爬虫管理页检查 Aria2/TorrServer 配置', 'info')
    return
  }
  if (!isMovieAvailabilityCommandReason(layer.reason))
    return
  openVideoAvailabilityAction(layer.actionKind, layer.key, layer.reason, layer.sourceRevision)
}

function showRepairIntent() {
  const source = readiness.value?.source
  if (!source?.repairable || (source.disposition !== 'no_source' && source.disposition !== 'source_failed'))
    return

  openVideoAvailabilityAction('repair', 'direct', source.disposition, source.sourceRevision)
}

function refreshReadiness() {
  if (loading.value)
    return

  const sourceRevision = readiness.value?.source.sourceRevision ?? movie.value?.availability?.current.metadata.sourceRevision ?? 0
  openVideoAvailabilityAction('recheck', 'direct', 'stale', sourceRevision)
}

async function confirmVideoAvailabilityAction(): Promise<void> {
  const target = pendingVideoAvailability.value
  if (!target || videoAvailabilityAction.value)
    return
  videoAvailabilityAction.value = true
  let completed = false
  try {
    const response = await movieApi.submitVideoAvailabilityCommand({
      idempotencyKey: `movie-detail:video-availability:${target.movieId}:${target.sourceRevision}:${target.sourceKind ?? 'auto'}:${target.reason}`,
      movieId: target.movieId,
      reason: target.reason,
      ...(target.sourceKind ? { sourceKind: target.sourceKind } : {}),
    })
    showToast(response.kind === 'existing_active_run' || response.kind === 'duplicate'
      ? '当前影片已有同一来源操作，已保留现有任务并刷新状态'
      : '视频来源操作已排队，正在等待读回')
    videoAvailabilityConfirmOpen.value = false
    completed = true
    await fetchMovieDetail()
  }
  catch (error) {
    showToast(error instanceof Error ? error.message : '视频来源操作提交失败，请稍后重试', 'error')
  }
  finally {
    if (completed)
      pendingVideoAvailability.value = null
    videoAvailabilityAction.value = false
  }
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

function formatDate(timestamp: number | string): string {
  return new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp).toLocaleDateString('zh-CN')
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
    arr = raw.filter((value): value is string => typeof value === 'string')
  }
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      arr = Array.isArray(parsed) ? parsed : [String(raw)]
    }
    catch {
      arr = raw.split(',')
    }
  }
  else {
    return []
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
    const leftDate = releaseDateValue(a.releaseDate)
    const rightDate = releaseDateValue(b.releaseDate)
    if (leftDate != null && rightDate != null)
      return leftDate - rightDate
    if (leftDate != null)
      return -1
    if (rightDate != null)
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
      label: '直接播放',
      sources: groups.eligibleDirect,
    },
    {
      key: 'eligible-magnet',
      label: '磁力在线播放或下载',
      sources: groups.eligibleMagnet,
    },
    {
      key: 'ineligible',
      label: '暂不可用来源',
      sources: groups.ineligible,
    },
  ].filter(group => group.sources.length > 0)
})

const magnetLinks = computed(() => {
  return groupPlaybackSources(sortedPlayers.value).eligibleMagnet
})

function boundedRouteIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined

  const normalized = value.trim()
  return /^[\w.~-]{1,128}$/u.test(normalized) ? normalized : undefined
}

function routeAttemptNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^[12]$/u.test(value))
    return undefined

  return Number(value)
}

function routeTupleReference() {
  const query = route.query ?? {}
  const taskId = boundedRouteIdentifier(query.taskId)
  const runId = boundedRouteIdentifier(query.runId)
  const attemptNumber = routeAttemptNumber(query.attemptNumber)
  const provider = query.provider === 'github-actions' ? 'github-actions' as const : undefined

  return { taskId, runId, attemptNumber, provider }
}

function playbackRouteFor(player: Player, sourceType = classifyPlaybackSource(player)): string {
  if (!movie.value)
    return '#'

  return buildPlaybackRoute(movie.value.code, {
    ...routeTupleReference(),
    playerId: player.id,
    contentId: movie.value.primaryContentId || readiness.value?.metadata.contentId || movie.value.id,
    sourceRevision: readiness.value?.source.sourceRevision ?? 0,
    sourceType,
  })
}

function playbackContextLabel(player: Player, sourceType = classifyPlaybackSource(player)): string {
  const contentId = movie.value?.primaryContentId || readiness.value?.metadata.contentId || movie.value?.id || 'unknown'
  const sourceRevision = readiness.value?.source.sourceRevision ?? 0
  return `${contentId}@${sourceRevision}/${sourceType}/${player.id}`
}

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
        playerId: player.id,
      }
      return
    }

    const streamResult = result
    router.push({
      name: 'player',
      params: { code: movie.value!.code },
      query: {
        streamUrl: streamResult.streamUrl,
        contentId: movie.value!.primaryContentId,
        sourceRevision: String(readiness.value?.source.sourceRevision ?? 0),
        sourceType: 'TorrServer',
        player: player.id,
      },
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
    query: {
      streamUrl: result.streamUrl,
      contentId: movie.value.primaryContentId,
      sourceRevision: String(readiness.value?.source.sourceRevision ?? 0),
      sourceType: 'TorrServer',
      player: fileSelectionModal.value.playerId,
    },
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
    error.value = err instanceof Error ? err.message : err.response?.data?.error || '加载影片详情失败'
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
  <div class="ui-public-page movie-detail-page">
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

    <div v-else-if="movie" class="space-y-8">
      <nav class="movie-detail-breadcrumbs" aria-label="影片详情导航">
        <RouterLink to="/" class="movie-detail-back-link">
          ← 返回影库
        </RouterLink>
        <span aria-hidden="true">/</span>
        <span class="text-muted-foreground">影片详情</span>
      </nav>

      <div class="movie-detail-hero bg-gray-800 rounded-lg shadow-lg p-5 sm:p-6">
        <div class="flex min-w-0 flex-col gap-6 md:flex-row">
          <!-- 封面：完整展示横版原图（400:267） -->
          <div class="movie-detail-cover shrink-0 w-full md:w-72 lg:w-80">
            <img
              v-if="movie.coverImage"
              :src="movie.coverImage"
              :alt="movie.title"
              class="aspect-[4/3] w-full rounded-lg shadow-md object-cover"
            >
            <div
              v-else
              class="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-gray-700"
            >
              <span class="text-gray-500">暂无封面</span>
            </div>
          </div>

          <div class="flex min-w-0 flex-1 flex-col">
            <div class="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-4">
              <div class="movie-detail-title-block min-w-0 flex-1">
                <p class="movie-detail-eyebrow">
                  影片详情
                </p>
                <h1 class="movie-detail-title mt-1 break-words text-2xl font-bold text-white sm:text-3xl">
                  {{ movie.title }}
                </h1>
                <div class="mt-3 flex flex-wrap items-center gap-2">
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
                class="shrink-0 bg-red-600 px-3 py-1 text-sm text-white rounded"
              >
                R18
              </span>
            </div>

            <div class="movie-detail-meta space-y-3">
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

            <div class="movie-detail-hero-actions mt-6 flex flex-wrap gap-2" aria-label="影片主要操作">
              <RouterLink
                v-if="!r18SourcesHidden && (!readiness || readiness.source.disposition === 'ready') && firstEligibleDirect"
                :to="playbackRouteFor(firstEligibleDirect, 'direct')"
                data-hero-action="play"
                class="movie-detail-primary-action min-h-11 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
              >
                <span aria-hidden="true">▶</span>
                立即播放
              </RouterLink>
              <a
                v-else-if="!r18SourcesHidden && (!readiness || readiness.source.disposition === 'ready') && movie.players?.length"
                href="#playback-sources"
                data-hero-action="choose-source"
                class="movie-detail-primary-action min-h-11 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
              >
                选择播放方式
              </a>
              <button
                type="button"
                data-hero-action="favorite"
                :disabled="favoritingLoading"
                class="movie-detail-secondary-action min-h-11 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                @click="toggleFavorite"
              >
                <span aria-hidden="true">{{ isFavorited ? '★' : '☆' }}</span>
                {{ isFavorited ? '已收藏' : '收藏' }}
              </button>
              <button
                type="button"
                data-hero-action="download-list"
                :disabled="isInDownloadList(movie.id)"
                class="movie-detail-secondary-action min-h-11 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                @click="addToList"
              >
                <span aria-hidden="true">↓</span>
                {{ isInDownloadList(movie.id) ? '已加入下载' : '加入下载列表' }}
              </button>
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
        <div data-readiness-overview class="flex flex-col gap-4 rounded-xl border border-primary-500/20 bg-primary-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="movie-detail-eyebrow">
              观看状态
            </p>
            <h2 class="mt-1 text-xl font-bold text-white">
              {{ movieUsageSummary.title }}
            </h2>
            <p class="mt-1 max-w-3xl text-sm leading-6 text-gray-300">
              {{ movieUsageSummary.description }}
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <RouterLink
              v-if="r18SourcesHidden"
              to="/profile"
              data-readiness-action="r18-profile"
              class="movie-detail-warning-action min-h-11 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              管理访问状态
            </RouterLink>
            <RouterLink
              v-if="!r18SourcesHidden && readiness.source.disposition === 'ready' && firstEligibleDirect"
              :to="playbackRouteFor(firstEligibleDirect, 'direct')"
              data-readiness-action="play"
              :data-content-id="movie.primaryContentId"
              :data-source-revision="readiness.source.sourceRevision"
              data-source-type="direct"
              :data-playback-context="playbackContextLabel(firstEligibleDirect, 'direct')"
              class="movie-detail-primary-action min-h-11 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              立即播放
            </RouterLink>
            <a
              v-else-if="!r18SourcesHidden && readiness.source.disposition === 'ready' && firstControlledFallback"
              href="#playback-sources"
              data-controlled-fallback-summary
              data-readiness-action="choose-source"
              class="movie-detail-primary-action min-h-11 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              选择播放方式
            </a>
            <button
              v-else-if="!r18SourcesHidden && readiness.source.repairable"
              type="button"
              data-readiness-action="repair-primary"
              class="movie-detail-warning-action min-h-11 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              @click="showRepairIntent"
            >
              查看修复建议
            </button>
            <button
              v-if="!r18SourcesHidden && readiness.source.disposition !== 'ready'"
              type="button"
              data-readiness-action="refresh-primary"
              class="movie-detail-secondary-action min-h-11 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="loading"
              @click="refreshReadiness"
            >
              {{ loading ? '检查中…' : '重新检查' }}
            </button>
            <button
              v-if="!r18SourcesHidden && primaryVideoAvailabilityAction"
              type="button"
              data-readiness-action="check-video-layer"
              class="movie-detail-secondary-action min-h-11 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="videoAvailabilityAction"
              @click="requestVideoLayerAction(primaryVideoAvailabilityAction)"
            >
              {{ videoAvailabilityAction ? '提交中…' : primaryVideoAvailabilityAction.action }}
            </button>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-3" data-readiness-status-cards>
          <div class="movie-detail-status-card">
            <span class="movie-detail-status-label">播放入口</span>
            <strong>{{ movieUsageSummary.sourceTitle }}</strong>
            <span>{{ movieUsageSummary.sourceDescription }}</span>
          </div>
          <div class="movie-detail-status-card">
            <span class="movie-detail-status-label">播放验证</span>
            <strong>{{ r18SourcesHidden ? '需先开启' : readiness.playback.status === 'playback_verified' ? '已验证' : '未验证' }}</strong>
            <span>{{ r18SourcesHidden ? '开启 R18 访问后再检查' : readiness.playback.status === 'playback_verified' ? '最近有真实播放记录' : '首次播放后会更新' }}</span>
          </div>
          <div class="movie-detail-status-card">
            <span class="movie-detail-status-label">推荐入口</span>
            <strong>{{ movieUsageSummary.entryTitle }}</strong>
            <span>{{ movieUsageSummary.entryDescription }}</span>
          </div>
        </div>

        <div v-if="r18SourcesHidden" data-r18-access-summary class="rounded-xl border border-amber-700/50 bg-amber-900/20 p-4">
          <p class="movie-detail-eyebrow text-amber-200">
            R18 访问状态
          </p>
          <p class="mt-1 text-sm leading-6 text-amber-100/80">
            当前账号处于 SFW 模式，播放源、来源检查记录和播放入口已隐藏。
          </p>
          <RouterLink
            to="/profile"
            data-r18-access-details-link
            class="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-600/60 px-3 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-800/40"
          >
            前往个人中心
          </RouterLink>
        </div>
        <details v-else class="movie-detail-technical-details">
          <summary>
            <span>查看来源与技术详情</span>
            <span class="text-xs font-normal text-gray-400">内容身份、检查记录、来源健康</span>
          </summary>
          <div class="mt-4 space-y-4">
            <section v-if="videoAvailabilityLayers.length" class="border-y border-gray-700" aria-labelledby="video-availability-title">
              <h3 id="video-availability-title" class="py-3 text-sm font-semibold text-gray-200">
                可用性检查记录
              </h3>
              <article
                v-for="layer in videoAvailabilityLayers"
                :key="layer.key"
                :data-video-layer="layer.key"
                class="grid min-w-0 gap-1 border-t border-gray-700 py-3 text-xs text-gray-300"
              >
                <div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <strong class="text-sm text-gray-100">{{ layer.label }}</strong>
                  <span class="break-words">{{ layer.status }}</span>
                </div>
                <span class="break-words">reason：{{ layer.reason }}</span>
                <span>revision {{ layer.sourceRevision }} · {{ layer.freshness }}</span>
                <span>available：{{ layer.counts.available ?? 0 }} · abnormal：{{ layer.counts.abnormal ?? 0 }}</span>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span>下一步：{{ layer.action }}</span>
                  <button
                    v-if="layer.actionKind !== 'none'"
                    type="button"
                    data-video-availability-action
                    :data-video-action="layer.actionKind"
                    class="movie-detail-secondary-action inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="videoAvailabilityAction"
                    @click="requestVideoLayerAction(layer)"
                  >
                    {{ videoAvailabilityAction ? '提交中…' : layer.action }}
                  </button>
                </div>
                <span v-for="sample in layer.samples" :key="sample" class="break-words">{{ sample }}</span>
                <div v-if="layer.history.length" class="grid gap-1 border-l-2 border-gray-700 pl-3" data-video-history>
                  <span v-for="fact in layer.history" :key="`${fact.sourceRevision}-${fact.status}`">
                    history · revision {{ fact.sourceRevision }} · {{ fact.status }} · {{ fact.freshness }}
                  </span>
                </div>
              </article>
            </section>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <section class="border border-gray-700 rounded-lg p-4">
                <h3 class="text-sm font-semibold text-gray-200">
                  影片信息保存状态
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
                  来源状态
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
                  实际播放验证
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
                  同步记录
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
                  各来源健康状态
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
        </details>
      </div>

      <!-- 播放源区块 -->
      <div v-if="!r18SourcesHidden && sourceCardGroups.length > 0 && (!readiness || readiness.source.disposition === 'ready')" id="playback-sources" data-playback-sources class="bg-gray-800 rounded-lg shadow-lg p-5 sm:p-6">
        <section data-usage-guide class="movie-detail-usage-guide mb-6 rounded-xl border border-primary-500/20 bg-primary-500/5 p-4 sm:p-5" aria-labelledby="usage-guide-title">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="movie-detail-eyebrow">
                第一次使用？
              </p>
              <h2 id="usage-guide-title" class="mt-1 text-xl font-bold text-white">
                选择适合你的播放方式
              </h2>
            </div>
            <p class="max-w-xl text-sm leading-6 text-gray-300">
              直链适合直接观看；磁力可以通过 TorrServer 在线播放，或交给 Aria2 下载到本地。
            </p>
          </div>
          <div class="mt-4 grid gap-3 md:grid-cols-3">
            <article class="movie-detail-guide-card">
              <span class="movie-detail-guide-icon" aria-hidden="true">▶</span>
              <div>
                <h3>直接播放</h3>
                <p v-if="firstEligibleDirect">
                  找到直链后，点击来源卡片上的“播放”。
                </p>
                <p v-else>
                  当前没有浏览器可直接播放的来源。
                </p>
              </div>
            </article>
            <article class="movie-detail-guide-card">
              <span class="movie-detail-guide-icon" aria-hidden="true">◉</span>
              <div>
                <h3>在线播放</h3>
                <p>磁力来源点击“TorrServer”，适合不想等待下载的场景。</p>
                <span :class="torrServerConnected ? 'text-green-300' : 'text-gray-400'">
                  {{ torrServerConnected ? 'TorrServer 已连接' : 'TorrServer 未连接' }}
                </span>
              </div>
            </article>
            <article class="movie-detail-guide-card">
              <span class="movie-detail-guide-icon" aria-hidden="true">↓</span>
              <div>
                <h3>下载到本地</h3>
                <p>磁力来源点击“Aria2”，适合保存后观看。</p>
                <span :class="aria2Connected ? 'text-green-300' : 'text-gray-400'">
                  {{ aria2Connected ? 'Aria2 已连接' : 'Aria2 未连接' }}
                </span>
              </div>
            </article>
          </div>
        </section>

        <div class="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="movie-detail-eyebrow">
              可用来源
            </p>
            <h2 class="mt-1 text-xl font-bold text-white">
              播放源
            </h2>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <!-- 排序选择器 -->
            <select
              v-model="sortMethod"
              aria-label="播放源排序"
              class="min-h-10 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none"
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
            <button
              v-if="magnetLinks.length > 0"
              type="button"
              class="movie-detail-secondary-action min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
              @click="copyAllMagnetLinks"
            >
              复制全部磁链
            </button>
            <button
              :disabled="isInDownloadList(movie.id)"
              type="button"
              class="movie-detail-secondary-action min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
              :class="isInDownloadList(movie.id)
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'"
              @click="addToList"
            >
              {{ isInDownloadList(movie.id) ? '已加入下载' : '加入下载列表' }}
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
                :data-content-id="movie.primaryContentId"
                :data-source-revision="readiness?.source.sourceRevision ?? 0"
                :data-playback-context="playbackContextLabel(player)"
                class="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700 transition-colors"
              >
                <div class="movie-source-card-content min-w-0">
                  <div class="flex min-w-0 items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex min-w-0 items-center gap-2">
                        <span class="text-lg" aria-hidden="true">{{ getSourceTypeIcon(player) }}</span>
                        <span class="truncate font-medium text-white">
                          {{ player.sourceName }}
                        </span>
                        <span
                          v-if="player.quality && group.key !== 'ineligible'"
                          class="rounded px-2 py-0.5 text-xs font-semibold"
                          :class="getQualityBadgeClass(player.quality)"
                        >
                          {{ player.quality }}
                        </span>
                      </div>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <span class="movie-source-badge" :class="group.key === 'ineligible' ? 'movie-source-badge-muted' : 'movie-source-badge-success'">
                          {{ group.key === 'ineligible' ? '暂不可用' : '可用于播放' }}
                        </span>
                        <span class="movie-source-badge movie-source-badge-muted">
                          {{ classifyPlaybackSource(player) === 'direct' ? '浏览器直链' : '磁力来源' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <details class="movie-source-details mt-4">
                    <summary>查看来源详情</summary>
                    <div class="mt-3 space-y-1.5 text-xs text-gray-400">
                      <p>
                        来源状态：{{ informationalSourceHealth(player) === 'inactive' ? '已停用' : informationalSourceHealth(player) === 'failed' ? '来源失败' : '等待验证' }}
                      </p>
                      <p>
                        受控原因：{{ sourceHealthReasonLabel(informationalSourceReason(informationalSourceHealth(player))) }}
                      </p>
                      <p>
                        最近检查：{{ readiness?.source.observedAt ?? 0 }} · revision {{ readiness?.source.sourceRevision ?? 0 }}
                      </p>
                      <p class="break-all text-gray-500">
                        播放上下文：{{ playbackContextLabel(player) }}
                      </p>
                      <template v-if="group.key !== 'ineligible'">
                        <div class="flex items-center gap-2 pt-2">
                          <RatingStars
                            :model-value="player.averageRating || 0"
                            :show-stats="true"
                            :count="player.ratingCount"
                            size="small"
                          />
                        </div>

                        <div v-if="debugMode" class="mt-2 space-y-1 rounded bg-gray-800 p-2 text-xs">
                          <div class="font-semibold text-gray-400">
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
                  </details>

                  <div v-if="group.key !== 'ineligible'" class="movie-source-actions mt-4 flex flex-wrap items-center gap-2">
                    <RouterLink
                      v-if="group.key === 'eligible-direct'"
                      :to="playbackRouteFor(player, 'direct')"
                      data-source-action="play"
                      :data-content-id="movie.primaryContentId"
                      :data-source-revision="readiness?.source.sourceRevision ?? 0"
                      data-source-type="direct"
                      :data-playback-context="playbackContextLabel(player, 'direct')"
                      class="movie-detail-primary-action inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                    >
                      立即播放
                    </RouterLink>
                    <template v-else-if="group.key === 'eligible-magnet'">
                      <button
                        type="button"
                        data-source-action="torrserver"
                        :disabled="!torrServerConnected || torrServerLoading"
                        :title="getTorrServerButtonTitle(player)"
                        class="movie-detail-primary-action inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        @click="playViaTorrServer(player)"
                      >
                        {{ torrServerLoading ? '准备中…' : '在线播放' }}
                      </button>
                      <button
                        type="button"
                        data-source-action="aria2"
                        :disabled="!aria2Connected"
                        :title="getAria2ButtonTitle(player)"
                        class="movie-detail-secondary-action inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        @click="addToAria2(player)"
                      >
                        添加到 Aria2
                      </button>
                    </template>
                    <details class="movie-source-more">
                      <summary>更多操作</summary>
                      <div class="movie-source-more-menu mt-2 flex flex-wrap gap-2">
                        <button
                          v-if="group.key === 'eligible-magnet'"
                          type="button"
                          data-source-action="copy"
                          class="movie-detail-secondary-action inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                          @click="copyMagnetLink(player)"
                        >
                          复制磁链
                        </button>
                        <button
                          v-if="group.key === 'eligible-magnet'"
                          type="button"
                          data-source-action="qrcode"
                          class="movie-detail-secondary-action inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                          @click="showQRCode(player)"
                        >
                          二维码
                        </button>
                        <button
                          type="button"
                          data-source-action="rating"
                          class="movie-detail-secondary-action inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                          @click="showRatingModal(player)"
                        >
                          评分
                        </button>
                        <button
                          type="button"
                          data-source-action="report"
                          :disabled="reportedPlayerIds.has(player.id)"
                          class="inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          :class="reportedPlayerIds.has(player.id)
                            ? 'bg-gray-600 text-gray-400'
                            : 'bg-red-700 hover:bg-red-800 text-white'"
                          @click="showReportModal(player)"
                        >
                          {{ reportedPlayerIds.has(player.id) ? '已上报' : '上报' }}
                        </button>
                      </div>
                    </details>
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
        <div v-if="r18SourcesHidden" data-r18-source-guard role="status" class="rounded-xl border border-amber-700/50 bg-amber-900/20 px-4 py-6 text-center">
          <p class="text-lg font-semibold text-amber-200 mb-2">
            播放源已隐藏
          </p>
          <p class="text-sm leading-6 text-amber-100/80">
            当前账号处于 SFW 模式，R18 影片的播放源和播放入口不会显示。
          </p>
          <RouterLink
            to="/profile"
            data-r18-source-profile
            class="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-600/60 px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-800/40"
          >
            查看访问状态
          </RouterLink>
        </div>
        <div v-else-if="readiness?.source.disposition === 'source_failed'" role="alert" class="text-center py-8 text-red-300">
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

      <ConfirmDialog
        v-model:open="videoAvailabilityConfirmOpen"
        title="确认视频来源操作"
        :message="videoAvailabilityConfirmationMessage"
        confirm-text="提交操作"
        cancel-text="返回影片"
        :loading="videoAvailabilityAction"
        @confirm="confirmVideoAvailabilityAction"
      />

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
  </div>
</template>

<style scoped>
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

<style scoped>
.movie-detail-page {
  display: grid;
  gap: var(--ui-section-gap);
}

.movie-detail-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.movie-detail-back-link {
  color: hsl(var(--foreground));
  font-weight: 600;
  transition: color 180ms ease;
}

.movie-detail-back-link:hover {
  color: hsl(var(--primary));
}

.movie-detail-eyebrow {
  color: hsl(var(--primary));
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1rem;
  text-transform: uppercase;
}

.movie-detail-hero {
  overflow: hidden;
}

.movie-detail-hero > div,
.movie-detail-title-block,
.movie-detail-meta {
  min-width: 0;
}

.movie-detail-title {
  max-width: 100%;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.movie-detail-meta > div > :last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

.movie-detail-cover img,
.movie-detail-cover > div {
  border: 1px solid hsl(var(--border));
}

.movie-detail-primary-action {
  border: 1px solid hsl(var(--primary) / 0.55);
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground, 0 0% 100%));
  box-shadow: 0 8px 20px hsl(var(--primary) / 0.18);
}

.movie-detail-primary-action:hover:not(:disabled) {
  background: hsl(var(--primary) / 0.86);
  transform: translateY(-1px);
}

.movie-detail-secondary-action {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.movie-detail-secondary-action:hover:not(:disabled) {
  border-color: hsl(var(--primary) / 0.42);
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.movie-detail-warning-action {
  border: 1px solid hsl(var(--status-warning) / 0.42);
  background: hsl(var(--status-warning) / 0.14);
  color: hsl(var(--status-warning));
}

.movie-detail-warning-action:hover:not(:disabled) {
  background: hsl(var(--status-warning) / 0.22);
}

.movie-detail-status-card,
.movie-detail-guide-card {
  display: flex;
  gap: 0.75rem;
  min-width: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: hsl(var(--card) / 0.55);
  padding: 0.875rem;
}

.movie-detail-status-card {
  flex-direction: column;
  gap: 0.25rem;
}

.movie-detail-status-card strong {
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
}

.movie-detail-status-card > span:last-child,
.movie-detail-guide-card p,
.movie-detail-guide-card > div > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  line-height: 1.25rem;
}

.movie-detail-status-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.movie-detail-guide-card {
  align-items: flex-start;
}

.movie-detail-guide-card h3 {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 700;
}

.movie-detail-guide-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
  font-weight: 700;
}

.movie-detail-technical-details,
.movie-source-details,
.movie-source-more {
  min-width: 0;
}

.movie-detail-technical-details > summary,
.movie-source-details > summary,
.movie-source-more > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  cursor: pointer;
  list-style: none;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
  transition: color 180ms ease;
}

.movie-detail-technical-details > summary::-webkit-details-marker,
.movie-source-details > summary::-webkit-details-marker,
.movie-source-more > summary::-webkit-details-marker {
  display: none;
}

.movie-detail-technical-details > summary::after,
.movie-source-details > summary::after,
.movie-source-more > summary::after {
  content: '+';
  flex: 0 0 auto;
  color: hsl(var(--primary));
  font-size: 1rem;
  line-height: 1;
}

.movie-detail-technical-details[open] > summary::after,
.movie-source-details[open] > summary::after,
.movie-source-more[open] > summary::after {
  content: '−';
}

.movie-detail-technical-details > summary:hover,
.movie-source-details > summary:hover,
.movie-source-more > summary:hover {
  color: hsl(var(--primary));
}

.movie-detail-technical-details > summary {
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.875rem;
}

.movie-source-card {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.56);
}

.movie-source-card:hover {
  border-color: hsl(var(--primary) / 0.42);
  background: hsl(var(--muted));
}

.movie-source-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  border-radius: 999px;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
}

.movie-source-badge-success {
  background: hsl(var(--status-success) / 0.12);
  color: hsl(var(--status-success));
}

.movie-source-badge-muted {
  background: hsl(var(--muted-foreground) / 0.12);
  color: hsl(var(--muted-foreground));
}

.movie-source-more > summary {
  min-height: 2.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.625rem;
  padding: 0.5rem 0.75rem;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.movie-source-more > summary:hover {
  border-color: hsl(var(--primary) / 0.42);
  background: hsl(var(--primary) / 0.12);
}

.movie-source-more-menu {
  max-width: 100%;
}

.movie-detail-page :deep([class~="bg-gray-800"]) {
  border: 1px solid hsl(var(--border));
  border-radius: var(--ui-radius-lg);
  background: hsl(var(--card));
  box-shadow: var(--ui-surface-shadow);
}

.movie-detail-page :deep([class~="bg-gray-700"]),
.movie-detail-page :deep([class~="bg-gray-700/50"]),
.movie-detail-page :deep([class~="bg-gray-700/80"]) {
  background: hsl(var(--muted));
}

.movie-detail-page :deep([class~="border-gray-700"]),
.movie-detail-page :deep([class~="border-gray-600"]) {
  border-color: hsl(var(--border));
}

.movie-detail-page :deep([class~="text-white"]),
.movie-detail-page :deep([class~="text-gray-100"]),
.movie-detail-page :deep([class~="text-gray-200"]) {
  color: hsl(var(--foreground));
}

.movie-detail-page :deep([class~="text-gray-300"]),
.movie-detail-page :deep([class~="text-gray-400"]),
.movie-detail-page :deep([class~="text-gray-500"]) {
  color: hsl(var(--muted-foreground));
}

.movie-detail-page :deep([class~="text-red-300"]),
.movie-detail-page :deep([class~="text-red-400"]),
.movie-detail-page :deep([class~="text-red-500"]) {
  color: hsl(var(--status-danger));
}

.movie-detail-page :deep([class~="text-green-300"]),
.movie-detail-page :deep([class~="text-green-400"]) {
  color: hsl(var(--status-success));
}

.movie-detail-page :deep([class~="text-amber-300"]) {
  color: hsl(var(--status-warning));
}

.movie-detail-page :deep([class~="bg-purple-600/20"]),
.movie-detail-page :deep([class~="bg-purple-600/30"]) {
  border-color: hsl(var(--primary) / 0.28);
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.movie-detail-page :deep([class~="border-purple-500/30"]) {
  border-color: hsl(var(--primary) / 0.28);
}

.movie-detail-page :deep([class~="bg-green-700"]),
.movie-detail-page :deep([class~="bg-green-600"]),
.movie-detail-page :deep([class~="bg-teal-600"]),
.movie-detail-page :deep([class~="bg-orange-600"]) {
  background: hsl(var(--primary));
}

.movie-detail-page :deep([class~="bg-red-600"]),
.movie-detail-page :deep([class~="bg-red-700"]) {
  background: hsl(var(--status-danger));
}

.movie-detail-page :deep([class~="z-50"]) {
  z-index: 1200;
}

@media (max-width: 640px) {
  .movie-detail-page {
    padding-inline: var(--ui-space-4);
  }

  .movie-detail-hero-actions > *,
  .movie-source-actions > * {
    flex: 1 1 auto;
  }

  .movie-detail-hero-actions > a,
  .movie-detail-hero-actions > button,
  .movie-source-actions > a,
  .movie-source-actions > button {
    min-width: 9rem;
  }

  .movie-source-more {
    flex-basis: 100%;
  }

  .movie-detail-technical-details > summary {
    align-items: flex-start;
  }
}
</style>
