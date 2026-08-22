<script setup lang="ts">
import type { Column, ErrorType, ParsedError } from '@starye/ui'
import type {
  CandidateItem,
  CandidateSnapshot,
  CapabilitiesResponse,
  CapabilityState,
  DailyBar,
  QuantProviderName,
  SyncResult,
  SyncStatus,
  WatchlistItem,
} from './lib/quant-types'
import { ConfirmDialog, DataTable, ErrorDisplay, SkeletonCard } from '@starye/ui'
import {
  Activity,
  AlertCircle,
  BarChart3,
  Check,
  ChevronRight,
  Database,
  Filter,
  LockKeyhole,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { quantApi, QuantApiError } from './lib/api-client'

type CandidateFilter = 'all' | 'ready' | 'signals'

const capabilities = ref<CapabilitiesResponse | null>(null)
const watchlist = ref<WatchlistItem[]>([])
const snapshot = ref<CandidateSnapshot | null>(null)
const dailyBars = ref<DailyBar[]>([])
const selectedTsCode = ref<string | null>(null)
const watchCode = ref('')
const watchName = ref('')
const syncResult = ref<SyncResult | null>(null)
const loading = reactive({
  capabilities: false,
  watchlist: false,
  candidates: false,
  daily: false,
  sync: false,
})
const errors = reactive<Record<'capabilities' | 'watchlist' | 'candidates' | 'daily' | 'action', unknown | null>>({
  capabilities: null,
  watchlist: null,
  candidates: null,
  daily: null,
  action: null,
})
const deletingCode = ref<string | null>(null)
const pendingDeleteCode = ref<string | null>(null)
const adding = ref(false)
const candidateFilter = ref<CandidateFilter>('all')
const candidateFilterOptions = [
  { key: 'all' as const, label: '全部', icon: Filter },
  { key: 'ready' as const, label: '数据完整', icon: ShieldCheck },
  { key: 'signals' as const, label: '有信号', icon: Sparkles },
]

const selectedStock = computed(() => watchlist.value.find(item => item.tsCode === selectedTsCode.value) || null)
const candidateItems = computed(() => snapshot.value?.candidates || [])
const filteredCandidateItems = computed(() => candidateItems.value.filter((item) => {
  if (candidateFilter.value === 'ready')
    return item.quality === 'ready'
  if (candidateFilter.value === 'signals')
    return item.signals.length > 0
  return true
}))
const dailyCapability = computed(() => capabilities.value?.capabilities.find(item => item.key === 'daily'))
const canSync = computed(() => Boolean(dailyCapability.value?.enabled && watchlist.value.length > 0 && !loading.sync))
const pageBusy = computed(() => loading.capabilities && loading.watchlist && loading.candidates)
const overallError = computed(() => errors.capabilities || errors.watchlist || errors.candidates)
const deleteDialogMessage = computed(() => pendingDeleteCode.value ? `确认从观察池移除 ${pendingDeleteCode.value}？` : '')
const latestDate = computed(() => {
  const dates = dailyBars.value.map(item => item.tradeDate).filter(Boolean)
  return dates.at(-1) || snapshot.value?.toDate || '--'
})
const selectedCandidate = computed(() => candidateItems.value.find(item => item.tsCode === selectedTsCode.value) || null)
const providerLabel = computed(() => formatProviderLabel(capabilities.value?.provider ?? null))

const watchlistColumns: Column<WatchlistItem>[] = [
  { key: 'tsCode', label: '代码', minWidth: '150px' },
  { key: 'name', label: '名称', minWidth: '130px', render: item => item.name || '未命名' },
  { key: 'latestClose', label: '最新价', width: '92px', render: item => formatNumber(item.latestClose) },
  { key: 'latestChangePercent', label: '涨跌幅', width: '92px', render: item => formatPercent(item.latestChangePercent) },
  { key: 'latestTradeDate', label: '最新日线', width: '120px', render: item => item.latestTradeDate || '--' },
  { key: 'barCount', label: '日线数', width: '90px', render: item => String(item.barCount) },
  { key: 'actions', label: '操作', width: '72px' },
]

const candidateColumns: Column<CandidateItem>[] = [
  { key: 'tsCode', label: '代码', minWidth: '135px' },
  { key: 'name', label: '名称', minWidth: '120px', render: item => item.name || '--' },
  { key: 'score', label: '动量分', width: '88px', render: item => formatNumber(item.score) },
  { key: 'changePercent', label: '涨跌幅', width: '92px', render: item => formatPercent(item.changePercent) },
  { key: 'ma20', label: 'MA20', width: '88px', render: item => formatNumber(item.ma20) },
  { key: 'volumeRatio', label: '量比', width: '80px', render: item => formatNumber(item.volumeRatio) },
  { key: 'relativeStrength', label: '池内强度', width: '98px', render: item => formatNumber(item.relativeStrength) },
  { key: 'actions', label: '信号', width: '160px' },
]

const dailyColumns: Column<DailyBar>[] = [
  { key: 'tradeDate', label: '交易日', width: '120px' },
  { key: 'open', label: '开盘', width: '84px', render: item => formatNumber(item.open) },
  { key: 'high', label: '最高', width: '84px', render: item => formatNumber(item.high) },
  { key: 'low', label: '最低', width: '84px', render: item => formatNumber(item.low) },
  { key: 'close', label: '收盘', width: '84px', render: item => formatNumber(item.close) },
  { key: 'changePercent', label: '涨跌幅', width: '92px', render: item => formatPercent(item.changePercent) },
  { key: 'volume', label: '成交量', width: '110px', render: item => formatCompact(item.volume) },
  { key: 'amount', label: '成交额', width: '110px', render: item => formatCompact(item.amount) },
]

const chartBars = computed(() => {
  const values = dailyBars.value.slice(-42).filter(item => item.close !== null)
  if (!values.length)
    return []
  const closes = values.map(item => item.close as number)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = max - min || 1
  return values.map((item) => {
    const close = item.close as number
    return {
      date: item.tradeDate,
      height: 16 + ((close - min) / span) * 84,
      positive: item.changePercent === null || item.changePercent >= 0,
      close,
    }
  })
})

function formatNumber(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatCompact(value: number | null): string {
  if (value === null)
    return '--'
  if (Math.abs(value) >= 10000)
    return `${(value / 10000).toFixed(1)}万`
  return value.toFixed(0)
}

function formatDateTime(value: string | null): string {
  if (!value)
    return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatProviderLabel(provider: QuantProviderName | null): string {
  return provider === 'tushare' ? 'Tushare' : provider === 'eastmoney' ? 'Eastmoney · 免费源' : '数据源读取中'
}

function formatFactorLabel(value: string): string {
  return {
    ma5: 'MA5 站上',
    ma20: 'MA20 趋势',
    new_high_20: '20 日新高',
    continuation: '连续上涨',
    volume_ratio: '放量',
    relative_strength: '池内强度',
  }[value] || value
}

function qualityLabel(value: CandidateItem['quality']): string {
  return value === 'ready' ? '数据完整' : value === 'partial' ? '数据部分完整' : '数据不足'
}

function parsedError(error: unknown): ParsedError {
  let type: ErrorType = 'unknown'
  let statusCode: number | undefined
  if (error instanceof QuantApiError) {
    statusCode = error.status
    if (error.status === 401 || error.status === 403)
      type = 'permission'
    else if (error.status === 400 || error.status === 409 || error.status === 422)
      type = 'validation'
    else if (error.status >= 500)
      type = 'server'
  }
  else if (error instanceof TypeError) {
    type = 'network'
  }
  return {
    type,
    message: error instanceof Error ? error.message : '量化数据加载失败',
    originalError: error,
    statusCode,
  }
}

function statusLabel(status: SyncStatus): string {
  return { completed: '已完成', partial: '部分完成', rejected: '已拒绝' }[status]
}

function capabilityStatusClass(item: CapabilityState): string {
  return item.enabled ? 'status-enabled' : 'status-disabled'
}

function syncStatusClass(status: SyncStatus): string {
  return {
    completed: 'status-enabled',
    partial: 'status-partial',
    rejected: 'status-disabled',
  }[status]
}

async function loadCapabilities() {
  loading.capabilities = true
  errors.capabilities = null
  try {
    capabilities.value = await quantApi.getCapabilities()
  }
  catch (error) {
    errors.capabilities = error
  }
  finally {
    loading.capabilities = false
  }
}

async function loadWatchlist() {
  loading.watchlist = true
  errors.watchlist = null
  try {
    watchlist.value = await quantApi.getWatchlist()
    if (!selectedTsCode.value || !watchlist.value.some(item => item.tsCode === selectedTsCode.value))
      selectedTsCode.value = watchlist.value[0]?.tsCode || null
    if (selectedTsCode.value)
      await loadDailyBars(selectedTsCode.value)
    else
      dailyBars.value = []
  }
  catch (error) {
    errors.watchlist = error
  }
  finally {
    loading.watchlist = false
  }
}

async function loadCandidates() {
  loading.candidates = true
  errors.candidates = null
  try {
    snapshot.value = await quantApi.getCandidates()
  }
  catch (error) {
    errors.candidates = error
  }
  finally {
    loading.candidates = false
  }
}

async function loadDailyBars(tsCode: string) {
  loading.daily = true
  errors.daily = null
  try {
    dailyBars.value = await quantApi.getDailyBars(tsCode, { limit: 120 })
  }
  catch (error) {
    errors.daily = error
    dailyBars.value = []
  }
  finally {
    loading.daily = false
  }
}

async function loadWorkspace() {
  errors.action = null
  await Promise.all([loadCapabilities(), loadWatchlist(), loadCandidates()])
}

function selectStock(item: Pick<WatchlistItem, 'tsCode' | 'name'>) {
  if (selectedTsCode.value === item.tsCode)
    return
  selectedTsCode.value = item.tsCode
  loadDailyBars(item.tsCode)
}

async function addToWatchlist() {
  const tsCode = watchCode.value.trim().toUpperCase()
  const name = watchName.value.trim()
  if (!/^\d{6}\.(?:SZ|SH|BJ)$/.test(tsCode)) {
    errors.action = new QuantApiError('请输入形如 000001.SZ 的股票代码', 422, 'INVALID_TS_CODE')
    return
  }
  adding.value = true
  errors.action = null
  try {
    await quantApi.addWatchlist({ tsCode, name })
    watchCode.value = ''
    watchName.value = ''
    await loadWatchlist()
  }
  catch (error) {
    errors.action = error
  }
  finally {
    adding.value = false
  }
}

function requestRemoveFromWatchlist(tsCode: string) {
  pendingDeleteCode.value = tsCode
}

function cancelRemoveFromWatchlist() {
  pendingDeleteCode.value = null
}

async function confirmRemoveFromWatchlist() {
  const tsCode = pendingDeleteCode.value
  if (tsCode)
    await removeFromWatchlist(tsCode)
}

async function removeFromWatchlist(tsCode: string) {
  deletingCode.value = tsCode
  errors.action = null
  try {
    await quantApi.removeWatchlist(tsCode)
    await loadWatchlist()
    await loadCandidates()
  }
  catch (error) {
    errors.action = error
  }
  finally {
    deletingCode.value = null
    pendingDeleteCode.value = null
  }
}

async function syncDaily() {
  if (!canSync.value)
    return
  loading.sync = true
  errors.action = null
  try {
    syncResult.value = await quantApi.syncDaily()
    await Promise.all([loadWatchlist(), loadCandidates()])
  }
  catch (error) {
    errors.action = error
  }
  finally {
    loading.sync = false
  }
}

onMounted(loadWorkspace)
</script>

<template>
  <div class="quant-shell min-h-screen">
    <main class="quant-page">
      <header class="quant-header">
        <div class="min-w-0">
          <p class="quant-eyebrow">
            STARYE / QUANT OPERATIONS
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <h1 class="quant-title">
              量化工作台
            </h1>
            <span class="status-chip status-enabled">
              <Activity :size="13" aria-hidden="true" />
              管理员会话
            </span>
            <span class="status-chip status-info">
              <Database :size="13" aria-hidden="true" />
              {{ providerLabel }}
            </span>
          </div>
          <p class="quant-subtitle">
            观察池、日线同步与候选信号的单页工作区
          </p>
        </div>
        <div class="quant-header-actions">
          <div class="header-metric">
            <span class="header-metric-label">积分档位</span>
            <strong>{{ capabilities?.tier ?? '--' }}</strong>
          </div>
          <button class="icon-button" type="button" title="刷新工作台" aria-label="刷新工作台" :disabled="pageBusy" @click="loadWorkspace">
            <RefreshCw :size="17" :class="pageBusy ? 'animate-spin' : ''" aria-hidden="true" />
          </button>
        </div>
      </header>

      <ErrorDisplay
        v-if="overallError && !pageBusy"
        :error="parsedError(overallError)"
        mode="banner"
        :show-actions="false"
      />
      <div v-if="errors.action" class="inline-alert" role="alert">
        <AlertCircle :size="16" aria-hidden="true" />
        <span>{{ parsedError(errors.action).message }}</span>
        <button class="alert-close" type="button" aria-label="关闭错误" title="关闭错误" @click="errors.action = null">
          <X :size="15" aria-hidden="true" />
        </button>
      </div>

      <section class="metric-grid" aria-label="工作台概览">
        <template v-if="pageBusy">
          <SkeletonCard v-for="index in 3" :key="index" variant="stat" />
        </template>
        <template v-else>
          <article class="metric-card">
            <div class="metric-card-heading">
              <span class="metric-icon metric-icon-teal"><Database :size="17" aria-hidden="true" /></span>
              <span>观察池</span>
            </div>
            <strong class="metric-value">{{ watchlist.length }}<small>/ 50</small></strong>
            <span class="metric-note">唯一股票代码</span>
          </article>
          <article class="metric-card">
            <div class="metric-card-heading">
              <span class="metric-icon metric-icon-amber"><TrendingUp :size="17" aria-hidden="true" /></span>
              <span>候选数量</span>
            </div>
            <strong class="metric-value">{{ candidateItems.length }}</strong>
            <span class="metric-note">{{ snapshot?.factorVersion || '等待快照' }}</span>
          </article>
          <article class="metric-card">
            <div class="metric-card-heading">
              <span class="metric-icon metric-icon-blue"><BarChart3 :size="17" aria-hidden="true" /></span>
              <span>最新数据</span>
            </div>
            <strong class="metric-value metric-value-date">{{ latestDate }}</strong>
            <span class="metric-note">选中股票日线</span>
          </article>
        </template>
      </section>

      <section class="surface-panel capability-panel" aria-labelledby="capability-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">
              CAPABILITY REGISTRY
            </p>
            <h2 id="capability-title" class="section-title">
              数据能力状态
            </h2>
          </div>
          <span class="section-meta">{{ providerLabel }} · {{ capabilities ? (capabilities.tier === null ? '积分配置无效' : `${capabilities.tier} 积分`) : '读取中' }}</span>
        </div>
        <div v-if="loading.capabilities" class="capability-grid" aria-label="能力状态加载中">
          <SkeletonCard v-for="index in 4" :key="index" variant="content" />
        </div>
        <div v-else-if="capabilities" class="capability-grid">
          <div v-for="item in capabilities.capabilities" :key="item.key" class="capability-row" :class="capabilityStatusClass(item)">
            <div class="capability-mark" aria-hidden="true">
              <Check v-if="item.enabled" :size="16" />
              <LockKeyhole v-else :size="15" />
            </div>
            <div class="min-w-0">
              <strong>{{ item.label }}</strong>
              <p>{{ item.reason }}</p>
            </div>
            <span class="capability-state">{{ item.enabled ? '可用' : '未启用' }}</span>
          </div>
        </div>
        <div v-else class="empty-state compact-empty">
          <AlertCircle :size="18" aria-hidden="true" />
          <span>能力状态暂时不可用</span>
          <button class="text-button" type="button" @click="loadCapabilities">
            重试
          </button>
        </div>
      </section>

      <section class="workspace-grid">
        <article class="surface-panel" aria-labelledby="watchlist-title">
          <div class="section-heading">
            <div>
              <p class="section-kicker">
                WATCHLIST
              </p>
              <h2 id="watchlist-title" class="section-title">
                观察池
              </h2>
            </div>
            <span class="section-meta">{{ watchlist.length }} / 50</span>
          </div>
          <form class="watchlist-form" @submit.prevent="addToWatchlist">
            <label class="sr-only" for="quant-code">股票代码</label>
            <input id="quant-code" v-model="watchCode" class="field-control field-code" inputmode="text" autocomplete="off" placeholder="000001.SZ" maxlength="9">
            <label class="sr-only" for="quant-name">股票名称</label>
            <input id="quant-name" v-model="watchName" class="field-control" autocomplete="off" placeholder="名称（可选）" maxlength="40">
            <button class="primary-button" type="submit" :disabled="adding || watchlist.length >= 50">
              <Plus :size="16" aria-hidden="true" />
              {{ adding ? '加入中' : '加入观察池' }}
            </button>
          </form>
          <DataTable
            :data="watchlist"
            :columns="watchlistColumns"
            :loading="loading.watchlist"
            min-width="760px"
            empty-message="观察池为空，先加入一只股票"
            @row-click="selectStock"
          >
            <template #cell-tsCode="{ item }">
              <button class="stock-code-button" type="button" @click.stop="selectStock(item)">
                {{ item.tsCode }}
                <ChevronRight :size="14" aria-hidden="true" />
              </button>
            </template>
            <template #cell-latestChangePercent="{ item }">
              <span :class="item.latestChangePercent !== null && item.latestChangePercent >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(item.latestChangePercent) }}</span>
            </template>
            <template #cell-actions="{ item }">
              <button class="icon-button icon-button-danger" type="button" :disabled="deletingCode === item.tsCode" :aria-label="`删除 ${item.tsCode}`" :title="`删除 ${item.tsCode}`" @click.stop="requestRemoveFromWatchlist(item.tsCode)">
                <Trash2 :size="15" aria-hidden="true" />
              </button>
            </template>
          </DataTable>
          <p v-if="selectedStock" class="selection-note">
            当前查看 <strong>{{ selectedStock.tsCode }}</strong> · {{ selectedStock.name || '未命名' }}
          </p>
        </article>

        <ConfirmDialog
          :open="pendingDeleteCode !== null"
          title="移除观察池代码"
          :message="deleteDialogMessage"
          confirm-text="确认移除"
          cancel-text="取消"
          variant="danger"
          :loading="deletingCode !== null"
          @update:open="value => !value && cancelRemoveFromWatchlist()"
          @cancel="cancelRemoveFromWatchlist"
          @confirm="confirmRemoveFromWatchlist"
        />

        <article class="surface-panel sync-panel" aria-labelledby="sync-title">
          <div class="section-heading">
            <div>
              <p class="section-kicker">
                DAILY SYNC
              </p>
              <h2 id="sync-title" class="section-title">
                日线同步
              </h2>
            </div>
            <span v-if="syncResult" class="status-chip" :class="syncStatusClass(syncResult.status)">
              {{ statusLabel(syncResult.status) }}
            </span>
          </div>
          <div class="sync-copy">
            <div class="sync-window">
              <span>输入</span><strong>{{ watchlist.length }} 只股票</strong>
            </div>
            <div class="sync-window">
              <span>窗口</span><strong>最近 120 个交易日</strong>
            </div>
            <div class="sync-window">
              <span>能力</span><strong :class="dailyCapability?.enabled ? 'text-status-success' : 'text-status-danger'">{{ dailyCapability?.enabled ? 'daily 可用' : 'daily 未启用' }}</strong>
            </div>
          </div>
          <button class="sync-button" type="button" :disabled="!canSync" @click="syncDaily">
            <RefreshCw :size="17" :class="loading.sync ? 'animate-spin' : ''" aria-hidden="true" />
            {{ loading.sync ? '同步中' : '同步观察池' }}
          </button>
          <div v-if="syncResult" class="sync-result" :class="syncStatusClass(syncResult.status)">
            <div class="sync-result-main">
              <span class="sync-status-dot" aria-hidden="true" />
              <strong>{{ statusLabel(syncResult.status) }}</strong>
              <span>{{ syncResult.reason || '已完成本次同步请求' }}</span>
            </div>
            <div class="sync-result-stats">
              <span>写入 <strong>{{ syncResult.written }}</strong></span>
              <span>跳过 <strong>{{ syncResult.skipped }}</strong></span>
              <span>快照 <strong>{{ syncResult.snapshotId || '--' }}</strong></span>
            </div>
          </div>
          <div v-else class="empty-state sync-empty">
            <RotateCcw :size="18" aria-hidden="true" />
            <span>等待首次同步</span>
          </div>
        </article>
      </section>

      <section class="surface-panel" aria-labelledby="candidate-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">
              MOMENTUM SNAPSHOT
            </p>
            <h2 id="candidate-title" class="section-title">
              候选快照
            </h2>
          </div>
          <div class="snapshot-meta">
            <span>因子 {{ snapshot?.factorVersion || '--' }}</span>
            <span>生成 {{ formatDateTime(snapshot?.generatedAt || null) }}</span>
          </div>
        </div>
        <div class="candidate-toolbar">
          <div class="candidate-filter-group" role="group" aria-label="候选筛选">
            <button
              v-for="option in candidateFilterOptions"
              :key="option.key"
              class="candidate-filter-button"
              :class="candidateFilter === option.key ? 'candidate-filter-button-active' : ''"
              type="button"
              :aria-pressed="candidateFilter === option.key"
              @click="candidateFilter = option.key"
            >
              <component :is="option.icon" :size="14" aria-hidden="true" />
              {{ option.label }}
            </button>
          </div>
          <span class="section-meta">显示 {{ filteredCandidateItems.length }} / {{ candidateItems.length }}</span>
        </div>
        <div v-if="snapshot && snapshot.candidates.length" class="snapshot-range">
          <span>输入范围</span>
          <strong>{{ snapshot.fromDate || '--' }} → {{ snapshot.toDate || '--' }}</strong>
          <span class="snapshot-range-divider">·</span>
          <span>仅使用标准化 daily 日线</span>
        </div>
        <div v-if="selectedCandidate" class="candidate-insight">
          <div class="candidate-insight-heading">
            <div>
              <span class="section-kicker">SELECTED SIGNAL</span>
              <strong>{{ selectedCandidate.name || selectedCandidate.tsCode }}</strong>
              <span class="candidate-insight-code">{{ selectedCandidate.tsCode }}</span>
            </div>
            <span class="status-chip" :class="selectedCandidate.quality === 'ready' ? 'status-enabled' : 'status-partial'">
              {{ qualityLabel(selectedCandidate.quality) }}
            </span>
          </div>
          <div class="candidate-insight-stats">
            <span><small>评分</small><strong>{{ formatNumber(selectedCandidate.score) }}</strong></span>
            <span><small>20 日收益</small><strong>{{ formatPercent(selectedCandidate.return20) }}</strong></span>
            <span><small>量比</small><strong>{{ formatNumber(selectedCandidate.volumeRatio) }}</strong></span>
          </div>
          <div class="candidate-insight-signals">
            <span v-for="signal in selectedCandidate.signals" :key="signal" class="signal-tag signal-tag-teal">{{ formatFactorLabel(signal) }}</span>
            <span v-for="factor in selectedCandidate.missingFactors" :key="factor" class="signal-tag signal-tag-muted">缺 {{ formatFactorLabel(factor) }}</span>
            <span v-if="!selectedCandidate.signals.length && !selectedCandidate.missingFactors.length" class="muted-inline">暂无因子信号</span>
          </div>
        </div>
        <DataTable
          :data="filteredCandidateItems"
          :columns="candidateColumns"
          :loading="loading.candidates"
          min-width="940px"
          :empty-message="candidateItems.length ? '当前筛选没有候选' : '暂无候选快照，完成一次日线同步后查看'"
          @row-click="selectStock"
        >
          <template #cell-tsCode="{ item }">
            <span class="font-mono text-xs font-semibold text-foreground">{{ item.tsCode }}</span>
          </template>
          <template #cell-score="{ item }">
            <span class="score-value">{{ formatNumber(item.score) }}</span>
          </template>
          <template #cell-changePercent="{ item }">
            <span :class="item.changePercent !== null && item.changePercent >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(item.changePercent) }}</span>
          </template>
          <template #cell-actions="{ item }">
            <div class="signal-list">
              <span v-if="item.newHigh20" class="signal-tag signal-tag-teal">20日新高</span>
              <span v-if="item.upStreak && item.upStreak >= 3" class="signal-tag signal-tag-amber">连涨 {{ item.upStreak }}</span>
              <span v-if="item.quality !== 'ready'" class="signal-tag signal-tag-muted">数据不足</span>
              <span v-if="!item.signals.length && item.quality === 'ready'" class="muted-inline">--</span>
            </div>
          </template>
        </DataTable>
      </section>

      <section class="surface-panel" aria-labelledby="daily-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">
              SELECTED EQUITY
            </p>
            <h2 id="daily-title" class="section-title">
              指定股票日线
            </h2>
          </div>
          <span class="section-meta">{{ selectedStock?.tsCode || '未选择股票' }}</span>
        </div>
        <div v-if="selectedStock && dailyBars.length" class="daily-overview">
          <div class="daily-overview-copy">
            <span class="daily-code">{{ selectedStock.tsCode }}</span>
            <strong>{{ selectedStock.name || '未命名股票' }}</strong>
            <span>最新交易日 {{ latestDate }}</span>
          </div>
          <div class="chart-area" aria-label="收盘价轻量趋势图">
            <div class="chart-grid-line chart-grid-line-top" />
            <div class="chart-grid-line chart-grid-line-mid" />
            <div class="chart-grid-line chart-grid-line-bottom" />
            <div class="chart-bars">
              <div v-for="bar in chartBars" :key="bar.date" class="chart-bar-column" :title="`${bar.date} ${formatNumber(bar.close)}`">
                <span class="chart-bar" :class="bar.positive ? 'chart-bar-positive' : 'chart-bar-negative'" :style="{ height: `${bar.height}%` }" />
              </div>
            </div>
          </div>
        </div>
        <div v-if="errors.daily && !loading.daily" class="inline-alert" role="alert">
          <AlertCircle :size="16" aria-hidden="true" />
          <span>{{ parsedError(errors.daily).message }}</span>
          <button class="text-button" type="button" @click="selectedTsCode && loadDailyBars(selectedTsCode)">
            重试
          </button>
        </div>
        <DataTable
          :data="dailyBars"
          :columns="dailyColumns"
          :loading="loading.daily"
          min-width="820px"
          empty-message="选择观察池中的股票后查看日线数据"
        >
          <template #cell-tradeDate="{ item }">
            <span class="font-mono text-xs text-muted-foreground">{{ item.tradeDate }}</span>
          </template>
          <template #cell-changePercent="{ item }">
            <span :class="item.changePercent !== null && item.changePercent >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(item.changePercent) }}</span>
          </template>
        </DataTable>
      </section>

      <footer class="quant-footer">
        <span><Activity :size="14" aria-hidden="true" /> 数据请求经过 Gateway 会话</span>
        <span>v1 · 日线能力边界已锁定</span>
      </footer>
    </main>
  </div>
</template>
