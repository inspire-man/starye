<script setup lang="ts">
import type { Column } from '@starye/ui'
import type { QuantDailyBoard, QuantDailyItem } from '../api/resources/daily'
import { DataTable } from '@starye/ui'
import { Plus, RefreshCw } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { quantApi, QuantApiError } from '../lib/api-client'

type DailyRow = QuantDailyItem & { id: string }

const board = ref<QuantDailyBoard | null>(null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const code = ref('')
const adding = ref(false)
const recording = ref<string | null>(null)
const quantity = ref('')
const fee = ref('')
const notice = ref('')
const pending = ref<string | null>(null)

const rows = computed<DailyRow[]>(() => (board.value?.items ?? []).map(item => ({ ...item, id: item.tsCode })))
const actionableCount = computed(() => rows.value.filter(item => item.action === 'buy' || item.action === 'sell').length)
const columns: Column<DailyRow>[] = [
  { key: 'name', label: '股票', minWidth: '9rem' },
  { key: 'price', label: '价格', width: '7rem' },
  { key: 'range', label: '买入区间', width: '9rem' },
  { key: 'position', label: '持仓', width: '8rem' },
  { key: 'action', label: '结论', width: '5rem' },
  { key: 'reason', label: '原因', minWidth: '8rem' },
  { key: 'actions', label: '', width: '9rem' },
]

const score = computed(() => board.value?.score ?? null)

function message(error: unknown, fallback: string): string {
  return error instanceof QuantApiError ? error.message : fallback
}

function money(value: number | null): string {
  return value === null ? '--' : value.toFixed(2)
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function priceDate(item: QuantDailyItem): string {
  if (item.price === null || item.priceFreshness === 'session')
    return ''
  return item.priceDate ?? ''
}

function rangeText(item: QuantDailyItem): string {
  if (item.rangeLow === null || item.rangeHigh === null)
    return '--'
  return `${item.rangeLow.toFixed(2)}–${item.rangeHigh.toFixed(2)}`
}

function gapText(item: QuantDailyItem): string {
  if (item.price === null || item.cost === null || item.cost <= 0 || item.openQuantity <= 0)
    return ''
  const percent = (item.price - item.cost) / item.cost * 100
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`
}

function rowPending(tsCode: string): boolean {
  return pending.value?.startsWith(`${tsCode}:`) === true
}

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = null
  try {
    const codes = board.value?.items.map(item => item.tsCode) ?? []
    if (codes.length)
      await quantApi.syncDaily(codes)
    board.value = await quantApi.getDailyBoard()
  }
  catch (error) {
    errorMessage.value = message(error, '读取失败')
  }
  finally {
    loading.value = false
  }
}

async function addStock(): Promise<void> {
  const tsCode = code.value.trim()
  if (!tsCode || adding.value)
    return
  adding.value = true
  errorMessage.value = null
  try {
    await quantApi.addWatchlist({ tsCode })
    code.value = ''
    await load()
  }
  catch (error) {
    errorMessage.value = message(error, '加入失败')
  }
  finally {
    adding.value = false
  }
}

async function generate(item: QuantDailyItem): Promise<void> {
  pending.value = `${item.tsCode}:research`
  errorMessage.value = null
  try {
    await quantApi.generateResearchRun(item.tsCode)
    await load()
  }
  catch (error) {
    errorMessage.value = message(error, '生成研究失败')
  }
  finally {
    pending.value = null
  }
}

function startRecord(item: QuantDailyItem): void {
  recording.value = recording.value === item.tsCode ? null : item.tsCode
  quantity.value = item.openQuantity > 0 ? String(item.openQuantity) : ''
  fee.value = ''
}

async function save(item: QuantDailyItem, side: 'buy' | 'sell' | 'pass'): Promise<void> {
  if (item.price === null || rowPending(item.tsCode))
    return
  const shares = side === 'pass' ? 0 : Number(quantity.value)
  if (side !== 'pass' && (!Number.isFinite(shares) || shares <= 0)) {
    errorMessage.value = '数量必须大于 0'
    return
  }
  pending.value = `${item.tsCode}:${side}`
  errorMessage.value = null
  try {
    await quantApi.createOperation({
      tsCode: item.tsCode,
      name: item.name,
      side,
      price: item.price,
      quantity: shares,
      fee: side === 'pass' ? 0 : Number(fee.value || 0),
      tradedAt: new Date().toISOString(),
      note: side === 'pass' ? '未执行' : null,
    })
    notice.value = side === 'pass' ? `已记下未执行 ${item.name || item.tsCode}` : `已记下${side === 'sell' ? '卖出' : '买入'} ${item.name || item.tsCode}`
    recording.value = null
    await load()
  }
  catch (error) {
    errorMessage.value = message(error, '记录失败')
  }
  finally {
    pending.value = null
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="quant-page daily-page">
    <header class="quant-view-heading">
      <div>
        <p class="quant-eyebrow">
          QUANT
        </p>
        <h1 class="quant-title">
          追踪
        </h1>
      </div>
      <button class="primary-button" type="button" :disabled="loading" :aria-busy="loading" @click="load">
        <RefreshCw :size="16" aria-hidden="true" />
        {{ loading ? '刷新中' : '刷新' }}
      </button>
    </header>

    <p v-if="errorMessage" class="daily-error" role="alert">
      {{ errorMessage }}
    </p>

    <div class="metric-grid daily-metrics">
      <article class="metric-card">
        <p class="metric-card-heading">
          扣费价差
        </p>
        <strong>{{ score ? signed(score.realizedPnl) : '--' }}</strong>
      </article>
      <article class="metric-card">
        <p class="metric-card-heading">
          盈亏比
        </p>
        <strong>{{ score?.payoffRatio === null || score?.payoffRatio === undefined ? '--' : score.payoffRatio.toFixed(2) }}</strong>
      </article>
      <article class="metric-card">
        <p class="metric-card-heading">
          波段价差
        </p>
        <strong>{{ score ? signed(score.swingRealizedPnl) : '--' }}</strong>
      </article>
      <article class="metric-card">
        <p class="metric-card-heading">
          要处理
        </p>
        <strong>{{ board ? actionableCount : '--' }}</strong>
      </article>
    </div>

    <article class="surface-panel">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            TRACKED
          </p>
          <h2 class="section-title">
            股票
          </h2>
        </div>
        <form class="daily-add" @submit.prevent="addStock">
          <input v-model="code" class="field-control" aria-label="追踪代码" placeholder="601899.SH" autocomplete="off">
          <button class="primary-button" type="submit" :disabled="adding || !code.trim()" :aria-busy="adding">
            <Plus :size="16" aria-hidden="true" />
            {{ adding ? '加入中' : '加入' }}
          </button>
        </form>
      </div>
      <div class="quant-table-frame">
        <DataTable
          :data="rows"
          :columns="columns"
          :loading="loading && !board"
          min-width="860px"
          empty-message="还没有追踪的股票"
        >
          <template #cell-name="{ item }">
            <strong>{{ item.name || item.tsCode }}</strong>
            <span class="quant-table-date">{{ item.tsCode }}</span>
          </template>
          <template #cell-price="{ item }">
            <span class="quant-table-number quant-table-number-emphasis">{{ money(item.price) }}</span>
            <span class="quant-table-date">{{ priceDate(item) }}</span>
          </template>
          <template #cell-range="{ item }">
            <span class="quant-table-number">{{ rangeText(item) }}</span>
          </template>
          <template #cell-position="{ item }">
            <span class="quant-table-number">{{ item.openQuantity > 0 ? `${item.openQuantity}` : '--' }}</span>
            <span class="quant-table-date">{{ gapText(item) || (item.cost === null ? '' : money(item.cost)) }}</span>
          </template>
          <template #cell-action="{ item }">
            <span class="status-chip" :class="item.action === 'buy' ? 'status-enabled' : item.action === 'sell' ? 'status-disabled' : item.action === 'blocked' ? 'status-partial' : 'status-info'">{{ item.label }}</span>
          </template>
          <template #cell-reason="{ item }">
            <span>{{ item.reason }}</span>
          </template>
          <template #cell-actions="{ item }">
            <div class="daily-actions">
              <button v-if="item.blocker === 'report'" class="daily-op" type="button" :disabled="rowPending(item.tsCode)" :aria-busy="pending === `${item.tsCode}:research`" :aria-label="`生成 ${item.name || item.tsCode} 的研究`" @click.stop="generate(item)">
                {{ pending === `${item.tsCode}:research` ? '生成中' : '生成研究' }}
              </button>
              <template v-else-if="item.action === 'buy' || item.action === 'sell'">
                <button class="daily-op" type="button" :disabled="rowPending(item.tsCode)" :aria-pressed="recording === item.tsCode" :aria-label="`记下 ${item.name || item.tsCode} 的成交`" @click.stop="startRecord(item)">
                  {{ recording === item.tsCode ? '收起' : '记下' }}
                </button>
                <button class="daily-op" type="button" :disabled="rowPending(item.tsCode) || item.price === null" :aria-busy="pending === `${item.tsCode}:pass`" :aria-label="`记下 ${item.name || item.tsCode} 未执行`" @click.stop="save(item, 'pass')">
                  {{ pending === `${item.tsCode}:pass` ? '记录中' : '未执行' }}
                </button>
              </template>
            </div>
          </template>
        </DataTable>
      </div>
      <form v-if="recording" class="daily-record" @submit.prevent="save(rows.find(row => row.tsCode === recording)!, rows.find(row => row.tsCode === recording)?.action === 'sell' ? 'sell' : 'buy')">
        <strong>{{ rows.find(row => row.tsCode === recording)?.name || recording }}</strong>
        <label>数量<input v-model="quantity" class="field-control" aria-label="成交数量" inputmode="decimal" :disabled="rowPending(recording)"></label>
        <label>费用<input v-model="fee" class="field-control" aria-label="费用" inputmode="decimal" placeholder="0" :disabled="rowPending(recording)"></label>
        <button class="primary-button" type="submit" :disabled="rowPending(recording)" :aria-busy="rowPending(recording)">
          {{ rowPending(recording) ? '保存中' : '保存成交' }}
        </button>
        <button class="daily-op" type="button" @click="recording = null">
          取消
        </button>
      </form>
      <p v-if="notice" class="daily-notice" role="status">
        {{ notice }}
      </p>
    </article>
  </section>
</template>

<style scoped>
.daily-page { display: grid; gap: 1.15rem; }
.daily-error { margin: 0; color: hsl(var(--status-danger)); }
.daily-metrics { margin-top: 0; }
.daily-metrics strong { display: block; margin-top: 0.8rem; font-size: 1.75rem; font-variant-numeric: tabular-nums; }
.daily-add { display: flex; gap: 0.5rem; align-items: center; }
.daily-add input { width: 9.5rem; }
.daily-actions { display: flex; justify-content: flex-end; gap: 0.45rem; }
.daily-op { min-height: 2.25rem; border: 1px solid hsl(var(--border)); border-radius: var(--ui-radius-md); background: hsl(var(--card)); padding: 0 0.7rem; color: inherit; cursor: pointer; }
.daily-op:hover:not(:disabled) { border-color: hsl(var(--primary)); color: hsl(var(--primary)); background: hsl(var(--accent)); }
.daily-op[aria-pressed="true"] { border-color: hsl(var(--primary)); background: hsl(var(--accent)); color: hsl(var(--primary)); }
.daily-record { display: grid; grid-template-columns: auto minmax(8rem, 1fr) minmax(8rem, 1fr) auto auto; gap: 0.6rem; align-items: end; margin-top: 0.9rem; padding-top: 0.9rem; border-top: 1px solid hsl(var(--border)); }
.daily-record label { display: grid; gap: 0.25rem; color: hsl(var(--muted-foreground)); font-size: 0.75rem; }
.daily-notice { margin: 0.75rem 0 0; color: hsl(var(--status-success)); font-weight: 650; }
.status-chip { display: inline-flex; border: 1px solid transparent; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
@media (max-width: 800px) {
  .daily-metrics { grid-template-columns: 1fr 1fr; }
  .section-heading, .daily-add { display: grid; }
}
</style>
