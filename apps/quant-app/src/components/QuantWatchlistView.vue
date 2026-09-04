<script setup lang="ts">
import type { Column } from '@starye/ui'
import type { SyncResult, WatchlistItem } from '../lib/quant-view-models'
import { ConfirmDialog, DataTable } from '@starye/ui'
import { AlertCircle, ChevronRight, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  watchlist: WatchlistItem[]
  columns: Column<WatchlistItem>[]
  watchlistLoading: boolean
  watchCode: string
  watchName: string
  adding: boolean
  deletingCode: string | null
  pendingDeleteCode: string | null
  deleteDialogMessage: string
  syncResult: SyncResult | null
  syncState: SyncResult | null
  syncing: boolean
  syncStateLoading: boolean
  syncStateErrorMessage: string | null
  canSync: boolean
  latestWatchlistDate: string
  displayedSyncResultMessage: string
  displayedSyncResultTime: string | null
}>()

const emit = defineEmits<{
  'update:watchCode': [value: string]
  'update:watchName': [value: string]
  'add': []
  'select': [item: WatchlistItem]
  'requestRemove': [tsCode: string]
  'cancelRemove': []
  'confirmRemove': []
  'sync': []
  'refreshSyncState': []
}>()

const watchCode = defineModel<string>('watchCode', { required: true })
const watchName = defineModel<string>('watchName', { required: true })

const displayedSyncResult = computed(() => props.syncResult || props.syncState)

function formatNumber(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatTradeDate(value: string | null): string {
  if (!value)
    return '--'
  if (/^\d{8}$/.test(value))
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
  return value
}

function statusLabel(status: SyncResult['status']): string {
  return { completed: '已完成', partial: '部分完成', rejected: '未完成' }[status]
}

function syncStatusClass(status: SyncResult['status']): string {
  return `sync-${status}`
}
</script>

<template>
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
        <span class="section-meta">{{ props.watchlist.length }} / 50</span>
      </div>
      <form class="watchlist-form" @submit.prevent="emit('add')">
        <label class="sr-only" for="quant-code">股票代码</label>
        <input id="quant-code" v-model="watchCode" class="field-control field-code" inputmode="text" autocomplete="off" placeholder="000001.SZ" maxlength="9">
        <label class="sr-only" for="quant-name">股票名称</label>
        <input id="quant-name" v-model="watchName" class="field-control" autocomplete="off" placeholder="名称（可选）" maxlength="40">
        <button class="primary-button" type="submit" :disabled="props.adding || props.watchlist.length >= 50">
          <Plus :size="16" aria-hidden="true" />
          {{ props.adding ? '加入中' : '加入观察池' }}
        </button>
      </form>
      <div class="quant-table-frame watchlist-table-frame">
        <DataTable
          :data="props.watchlist"
          :columns="props.columns"
          :loading="props.watchlistLoading"
          min-width="760px"
          empty-message="观察池为空，先加入一只股票"
          @row-click="emit('select', $event)"
        >
          <template #cell-tsCode="{ item }">
            <button class="stock-code-button" type="button" @click.stop="emit('select', item)">
              {{ item.tsCode }}
              <ChevronRight :size="14" aria-hidden="true" />
            </button>
          </template>
          <template #cell-latestClose="{ item }">
            <span class="quant-table-number quant-table-number-emphasis" :class="item.latestClose === null ? 'quant-table-value-muted' : ''">{{ formatNumber(item.latestClose) }}</span>
          </template>
          <template #cell-latestChangePercent="{ item }">
            <span class="quant-table-number" :class="item.latestChangePercent === null ? 'text-status-neutral' : item.latestChangePercent >= 0 ? 'text-status-success' : 'text-status-danger'">{{ formatPercent(item.latestChangePercent) }}</span>
          </template>
          <template #cell-latestTradeDate="{ item }">
            <span class="quant-table-date">{{ formatTradeDate(item.latestTradeDate) }}</span>
          </template>
          <template #cell-barCount="{ item }">
            <span class="quant-table-number">{{ item.barCount }}</span>
          </template>
          <template #cell-actions="{ item }">
            <button class="icon-button icon-button-danger watchlist-action-button" type="button" :disabled="props.deletingCode === item.tsCode" :aria-label="`删除 ${item.tsCode}`" :title="`删除 ${item.tsCode}`" @click.stop="emit('requestRemove', item.tsCode)">
              <Trash2 :size="15" aria-hidden="true" />
            </button>
          </template>
        </DataTable>
      </div>
    </article>

    <ConfirmDialog
      :open="props.pendingDeleteCode !== null"
      mobile-placement="center"
      title="移除观察池代码"
      :message="props.deleteDialogMessage"
      confirm-text="确认移除"
      cancel-text="取消"
      variant="danger"
      :loading="props.deletingCode !== null"
      @update:open="value => !value && emit('cancelRemove')"
      @cancel="emit('cancelRemove')"
      @confirm="emit('confirmRemove')"
    />

    <article class="surface-panel sync-panel" aria-labelledby="sync-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            DATA UPDATE
          </p>
          <h2 id="sync-title" class="section-title">
            更新数据
          </h2>
        </div>
        <span v-if="displayedSyncResult" class="status-chip" :class="syncStatusClass(displayedSyncResult.status)">
          {{ statusLabel(displayedSyncResult.status) }}
        </span>
      </div>
      <div class="sync-copy">
        <div class="sync-window">
          <span>股票</span><strong>{{ props.watchlist.length }} 只</strong>
        </div>
        <div class="sync-window">
          <span>历史范围</span><strong>最近 120 个交易日</strong>
        </div>
        <div class="sync-window">
          <span>数据截至</span><strong>{{ props.latestWatchlistDate }}</strong>
        </div>
      </div>
      <button class="sync-button" type="button" :disabled="!props.canSync" @click="emit('sync')">
        <RefreshCw :size="17" :class="props.syncing ? 'animate-spin' : ''" aria-hidden="true" />
        {{ props.syncing ? '更新中' : '更新观察池' }}
      </button>
      <div v-if="displayedSyncResult" class="sync-result" :class="syncStatusClass(displayedSyncResult.status)">
        <div class="sync-result-main">
          <span class="sync-status-dot" aria-hidden="true" />
          <strong>{{ statusLabel(displayedSyncResult.status) }}</strong>
          <span>{{ props.displayedSyncResultMessage }}</span>
          <small v-if="props.displayedSyncResultTime">完成于 {{ props.displayedSyncResultTime }}</small>
        </div>
        <div class="sync-result-stats">
          <span>请求 <strong>{{ displayedSyncResult.requested }}</strong></span>
          <span>写入 <strong>{{ displayedSyncResult.written }}</strong></span>
          <span>跳过 <strong>{{ displayedSyncResult.skipped }}</strong></span>
        </div>
      </div>
      <div v-if="props.syncStateLoading && displayedSyncResult" class="data-refresh-feedback data-refresh-feedback-loading" role="status">
        <RefreshCw :size="15" class="animate-spin" aria-hidden="true" />
        <span>正在刷新同步状态，先显示最近一次有效结果</span>
      </div>
      <div v-else-if="props.syncStateErrorMessage && displayedSyncResult" class="data-refresh-feedback data-refresh-feedback-error" role="alert">
        <AlertCircle :size="15" aria-hidden="true" />
        <span>同步状态读取失败，以上为最近一次有效结果：{{ props.syncStateErrorMessage }}</span>
        <button class="text-button" type="button" @click="emit('refreshSyncState')">
          重试
        </button>
      </div>
      <div v-else-if="props.syncStateLoading" class="empty-state sync-empty" role="status">
        <RefreshCw :size="18" class="animate-spin" aria-hidden="true" />
        <span>正在读取最近一次同步状态</span>
      </div>
      <div v-else-if="props.syncStateErrorMessage" class="empty-state sync-empty sync-empty-error" role="alert">
        <AlertCircle :size="18" aria-hidden="true" />
        <span>同步状态读取失败：{{ props.syncStateErrorMessage }}</span>
        <button class="text-button" type="button" @click="emit('refreshSyncState')">
          重试
        </button>
      </div>
      <div v-else class="empty-state sync-empty">
        <RotateCcw :size="18" aria-hidden="true" />
        <span>尚未更新日线数据</span>
      </div>
    </article>
  </section>
</template>
