<script setup lang="ts">
import type { QuantOperationBoard, QuantOperationFill } from '../api/resources/operations'
import type { WatchlistItem } from '../lib/quant-view-models'
import { ClipboardList } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { QuantApiError } from '../api/http-client'
import { quantOperationApi } from '../api/resources/operations'
import { quantApi } from '../lib/api-client'

interface StockChoice {
  tsCode: string
  name: string | null
  latestClose: number | null
}

const props = defineProps<{ focusCode?: string | null }>()
const emit = defineEmits<{
  openResearch: [tsCode: string]
  addToWatchlist: [item: { tsCode: string, name: string | null }]
}>()
const board = ref<QuantOperationBoard | null>(null)
const watchlist = ref<WatchlistItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref<string | null>(null)
const stockKey = ref('')
const customCode = ref('')
const name = ref('')
const side = ref<'buy' | 'sell' | 'dividend' | 'pass'>('buy')
const price = ref('')
const quantity = ref('')
const fee = ref('')
const tradedAt = ref(localDateTimeValue())
const note = ref('')
const listFilter = ref('')

const choices = computed<StockChoice[]>(() => {
  const map = new Map<string, StockChoice>()
  for (const item of watchlist.value)
    map.set(item.tsCode, { tsCode: item.tsCode, name: item.name, latestClose: item.latestClose })
  for (const item of board.value?.ledger.byCode ?? []) {
    if (!map.has(item.tsCode))
      map.set(item.tsCode, { tsCode: item.tsCode, name: item.name, latestClose: null })
  }
  for (const item of board.value?.operations ?? []) {
    if (!map.has(item.tsCode))
      map.set(item.tsCode, { tsCode: item.tsCode, name: item.name, latestClose: null })
  }
  return [...map.values()].sort((left, right) => (left.name || left.tsCode).localeCompare(right.name || right.tsCode, 'zh'))
})
const selectedChoice = computed(() => choices.value.find(item => item.tsCode === stockKey.value) ?? null)
const activeCode = computed(() => stockKey.value === '__custom' ? customCode.value.trim() : stockKey.value)
const activeName = computed(() => {
  if (stockKey.value === '__custom')
    return name.value.trim() || null
  return selectedChoice.value?.name ?? null
})
const visibleFills = computed(() => {
  const rows = board.value?.operations ?? []
  return listFilter.value ? rows.filter(item => item.tsCode === listFilter.value) : rows
})
const curvePath = computed(() => {
  const points = board.value?.ledger.curve ?? []
  if (points.length < 2)
    return ''
  const values = points.map(point => point.cumulativePnl)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const span = max - min || 1
  return points.map((point, index) => {
    const x = (index / (points.length - 1)) * 320
    const y = 110 - ((point.cumulativePnl - min) / span) * 100
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
})

function localDateTimeValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function money(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace('T', ' ').slice(0, 16)
}

function choiceLabel(item: StockChoice): string {
  const close = item.latestClose === null ? '' : ` · 最近收盘 ${item.latestClose.toFixed(2)}`
  return `${item.name || item.tsCode} · ${item.tsCode}${close}`
}

function openCost(tsCode: string): number | null {
  return board.value?.ledger.openLots.find(item => item.tsCode === tsCode)?.cost ?? null
}

function selectStock(tsCode: string): void {
  stockKey.value = tsCode
  listFilter.value = tsCode
  const choice = choices.value.find(item => item.tsCode === tsCode)
  name.value = choice?.name ?? ''
}

watch(() => props.focusCode, (code) => {
  if (code)
    selectStock(code)
}, { immediate: true })

function showAllFills(): void {
  listFilter.value = ''
}

function closeGap(tsCode: string, quantity: number): string | null {
  const close = choices.value.find(item => item.tsCode === tsCode)?.latestClose ?? null
  const cost = openCost(tsCode)
  if (close === null || cost === null || cost <= 0 || quantity <= 0)
    return null
  const perShare = close - cost
  if (perShare.toFixed(2) === '0.00')
    return '相对最近收盘持平。账本对照，不是收益结论。'
  const percent = perShare / cost * 100
  return `相对最近收盘 ${money(perShare)}/股（${money(percent)}%），持仓价差 ${money(perShare * quantity)}。账本对照，不是收益结论。`
}

function watched(tsCode: string): boolean {
  return watchlist.value.some(item => item.tsCode === tsCode)
}

function researchLabel(item: QuantOperationFill): string | null {
  const context = item.researchContext
  if (!context?.recommendation)
    return null
  const label = context.recommendation === 'bullish' ? '看多' : context.recommendation === 'bearish' ? '看空' : '观望'
  const buy = context.buyLow !== null && context.buyHigh !== null ? `，参考买入 ${context.buyLow.toFixed(2)}-${context.buyHigh.toFixed(2)}` : ''
  return `记下时报告${label}${buy}`
}

function useLatestClose(): void {
  const close = selectedChoice.value?.latestClose
  if (close === null || close === undefined)
    return
  price.value = close.toFixed(2)
}

function reuseFill(item: QuantOperationFill): void {
  selectStock(item.tsCode)
  side.value = item.side
  price.value = item.price.toFixed(2)
  quantity.value = item.side === 'dividend' || item.side === 'pass' ? '' : String(item.quantity)
  fee.value = item.fee ? item.fee.toFixed(2) : ''
  tradedAt.value = localDateTimeValue()
}

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = null
  const previous = activeCode.value
  try {
    const [operations, stocks] = await Promise.all([
      quantOperationApi.getOperations(),
      quantApi.getWatchlist().catch(() => [] as WatchlistItem[]),
    ])
    board.value = operations
    watchlist.value = stocks
    if (stockKey.value === '__custom')
      return
    if (previous && choices.value.some(item => item.tsCode === previous)) {
      stockKey.value = previous
    }
    else if (!stockKey.value) {
      const only = choices.value[0]
      if (choices.value.length === 1 && only)
        selectStock(only.tsCode)
    }
  }
  catch (error) {
    errorMessage.value = error instanceof QuantApiError ? error.message : '操作记录读取失败'
  }
  finally {
    loading.value = false
  }
}

async function submit(): Promise<void> {
  const parsedPrice = Number(price.value)
  const parsedQuantity = Number(quantity.value)
  const parsedFee = fee.value.trim() ? Number(fee.value) : 0
  const dividend = side.value === 'dividend'
  if (!activeCode.value || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !Number.isFinite(parsedFee) || parsedFee < 0 || !tradedAt.value || (!dividend && (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0))) {
    errorMessage.value = dividend ? '先选择股票，并填写分红金额和时间' : '先选择股票，并填写价格、数量和成交时间'
    return
  }
  saving.value = true
  errorMessage.value = null
  try {
    await quantOperationApi.createOperation({
      tsCode: activeCode.value,
      name: activeName.value,
      side: side.value,
      price: parsedPrice,
      quantity: dividend ? 0 : parsedQuantity,
      fee: parsedFee,
      tradedAt: new Date(tradedAt.value).toISOString(),
      note: note.value.trim() || null,
    })
    price.value = ''
    quantity.value = ''
    fee.value = ''
    note.value = ''
    tradedAt.value = localDateTimeValue()
    await load()
  }
  catch (error) {
    errorMessage.value = error instanceof QuantApiError ? error.message : '成交没有记下'
  }
  finally {
    saving.value = false
  }
}

async function remove(item: QuantOperationFill): Promise<void> {
  errorMessage.value = null
  try {
    await quantOperationApi.deleteOperation(item.id)
    await load()
  }
  catch (error) {
    errorMessage.value = error instanceof QuantApiError ? error.message : '成交没有删除'
  }
}

async function copyBrief(): Promise<void> {
  const brief = board.value?.ledger.aiBrief
  if (!brief)
    return
  await navigator.clipboard.writeText(brief)
}

onMounted(load)
</script>

<template>
  <section class="operations" aria-labelledby="operations-title">
    <div class="section-heading">
      <div>
        <p class="section-kicker">
          OPERATION LEDGER
        </p>
        <h2 id="operations-title" class="section-title">
          操作记录
        </h2>
      </div>
      <ClipboardList :size="18" aria-hidden="true" />
    </div>
    <p v-if="errorMessage" class="operations-error" role="alert">
      {{ errorMessage }}
    </p>
    <button v-if="!board && errorMessage" class="text-button" type="button" @click="load">
      重试
    </button>
    <p v-if="loading && !board" role="status">
      正在读取操作记录…
    </p>
    <template v-else-if="board">
      <form class="operations-form" aria-label="记下成交" @submit.prevent="submit">
        <label class="operations-field">
          <span>股票</span>
          <select v-model="stockKey" class="field-control" aria-label="股票" required>
            <option value="" disabled>从观察池或已记标的选择</option>
            <option v-for="item in choices" :key="item.tsCode" :value="item.tsCode">{{ choiceLabel(item) }}</option>
            <option value="__custom">手动输入代码</option>
          </select>
        </label>
        <div v-if="stockKey === '__custom'" class="operations-fields">
          <label class="operations-field">
            <span>代码</span>
            <input v-model="customCode" class="field-control" aria-label="股票代码" placeholder="601899.SH" maxlength="20" required>
          </label>
          <label class="operations-field">
            <span>名称</span>
            <input v-model="name" class="field-control" aria-label="名称" placeholder="可选" maxlength="40">
          </label>
        </div>
        <div class="operations-side" role="group" aria-label="方向">
          <button type="button" :aria-pressed="side === 'buy'" @click="side = 'buy'">
            买入
          </button>
          <button type="button" :aria-pressed="side === 'sell'" @click="side = 'sell'">
            卖出
          </button>
          <button type="button" :aria-pressed="side === 'dividend'" @click="side = 'dividend'">
            分红
          </button>
        </div>
        <div class="operations-fields">
          <label class="operations-field">
            <span>{{ side === 'dividend' ? '金额' : '价格' }}</span>
            <input v-model="price" class="field-control" :aria-label="side === 'dividend' ? '金额' : '价格'" inputmode="decimal" :placeholder="side === 'dividend' ? '分红金额' : '成交价'" required>
            <button v-if="side !== 'dividend' && selectedChoice?.latestClose != null" class="text-button" type="button" aria-label="用最近收盘" @click="useLatestClose">用最近收盘 {{ selectedChoice.latestClose.toFixed(2) }}</button>
          </label>
          <label v-if="side !== 'dividend'" class="operations-field">
            <span>数量</span>
            <input v-model="quantity" class="field-control" aria-label="数量" inputmode="decimal" placeholder="股数" required>
            <span class="operations-chips">
              <button v-for="lot in [100, 200, 500]" :key="lot" class="text-button" type="button" @click="quantity = String(lot)">{{ lot }}</button>
            </span>
          </label>
          <label v-if="side !== 'dividend'" class="operations-field">
            <span>费用</span>
            <input v-model="fee" class="field-control" aria-label="费用" inputmode="decimal" placeholder="0">
          </label>
          <label class="operations-field">
            <span>成交时间</span>
            <input v-model="tradedAt" class="field-control" aria-label="成交时间" type="datetime-local" required>
            <button class="text-button" type="button" @click="tradedAt = localDateTimeValue()">现在</button>
          </label>
        </div>
        <label class="operations-field">
          <span>备注</span>
          <input v-model="note" class="field-control" aria-label="备注" placeholder="可选" maxlength="200">
        </label>
        <button class="primary-button" type="submit" :disabled="saving">
          {{ saving ? '记录中' : '记下这笔' }}
        </button>
      </form>

      <div v-if="board.ledger.byCode.length" class="operations-positions" role="list" aria-label="按标的选择">
        <div v-for="item in board.ledger.byCode" :key="item.tsCode" class="operations-position" role="listitem">
          <button
            class="operations-position-select"
            type="button"
            :aria-pressed="listFilter === item.tsCode"
            :aria-label="`选择 ${item.name || item.tsCode}`"
            @click="selectStock(item.tsCode)"
          >
            <strong>{{ item.name || item.tsCode }}</strong>
            <small>{{ item.tsCode }}</small>
            <span>未平 {{ item.openQuantity }} 股<template v-if="openCost(item.tsCode) !== null"> · 成本 {{ openCost(item.tsCode)?.toFixed(2) }}</template></span>
            <span>分红 {{ money(item.dividendCash) }} · 价差 {{ money(item.realizedPnl) }}</span>
            <small v-if="closeGap(item.tsCode, item.openQuantity)">{{ closeGap(item.tsCode, item.openQuantity) }}</small>
          </button>
          <button v-if="watched(item.tsCode)" class="text-button" type="button" :aria-label="`看 ${item.name || item.tsCode} 的研究`" @click="emit('openResearch', item.tsCode)">
            看研究
          </button>
          <button v-else class="text-button" type="button" :aria-label="`把 ${item.name || item.tsCode} 加入观察池`" @click="emit('addToWatchlist', { tsCode: item.tsCode, name: item.name })">
            加入观察池
          </button>
        </div>
      </div>

      <div class="operations-stats" role="list" aria-label="已平仓统计">
        <div role="listitem">
          <span>费用后价差</span><strong>{{ money(board.ledger.realizedPnl) }}</strong>
        </div>
        <div role="listitem">
          <span>分红</span><strong>{{ money(board.ledger.dividendCash) }}</strong>
        </div>
        <div role="listitem">
          <span>胜率</span><strong>{{ board.ledger.winRate === null ? '样本不足' : `${board.ledger.winRate.toFixed(2)}%` }}</strong><small>{{ board.ledger.winCount }} 胜 / {{ board.ledger.lossCount }} 负</small>
        </div>
        <div role="listitem">
          <span>盈亏比</span><strong>{{ board.ledger.payoffRatio === null ? '--' : board.ledger.payoffRatio.toFixed(2) }}</strong>
        </div>
        <div role="listitem">
          <span>已平仓</span><strong>{{ board.ledger.closedCount }}</strong><small>持平 {{ board.ledger.flatCount }}</small>
        </div>
      </div>

      <div class="operations-fills" role="table" aria-label="成交明细">
        <div class="operations-fill-tools">
          <span>{{ listFilter ? '只看所选股票' : '全部成交' }}</span>
          <button v-if="listFilter" class="text-button" type="button" @click="showAllFills">
            看全部
          </button>
        </div>
        <div v-for="item in visibleFills" :key="item.id" class="operations-fill" role="row">
          <span>{{ formatTime(item.tradedAt) }}</span>
          <button class="operations-stock" type="button" :aria-label="`在明细里选择 ${item.name || item.tsCode}`" @click="selectStock(item.tsCode)">
            <strong>{{ item.name || item.tsCode }}</strong>
            <small>{{ item.tsCode }}</small>
            <small v-if="item.note">{{ item.note }}</small>
            <small v-if="researchLabel(item)">{{ researchLabel(item) }}</small>
          </button>
          <span>{{ item.side === 'buy' ? '买入' : item.side === 'sell' ? '卖出' : item.side === 'pass' ? '未执行' : '分红' }}</span>
          <span>{{ item.side === 'dividend' ? money(item.price) : item.side === 'pass' ? '未执行' : `${item.price.toFixed(2)} × ${item.quantity}` }}<template v-if="item.fee > 0"> · 费用 {{ item.fee.toFixed(2) }}</template></span>
          <span class="operations-fill-actions">
            <button class="text-button" type="button" :aria-label="`用${item.name || item.tsCode}这笔再记`" @click="reuseFill(item)">再记</button>
            <button class="text-button" type="button" :aria-label="`删除 ${item.name || item.tsCode} ${formatTime(item.tradedAt)}`" @click="remove(item)">删除</button>
          </span>
        </div>
        <p v-if="!visibleFills.length" class="operations-note">
          还没有成交。先选择股票，再记一笔买入。
        </p>
      </div>

      <details class="operations-history">
        <summary>已平仓和复盘</summary>
        <svg v-if="curvePath" class="operations-curve" viewBox="0 0 320 120" role="img" aria-label="已实现价差曲线">
          <path :d="curvePath" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
        <p v-else class="operations-note">
          至少两笔已平仓后，这里画出累计价差。
        </p>
        <p class="operations-brief">
          {{ board.ledger.aiBrief }}
        </p>
        <button class="text-button" type="button" :disabled="!board.ledger.aiBrief" @click="copyBrief">
          复制复盘摘要
        </button>
        <p v-if="board.ledger.unmatchedSellQuantity > 0" class="operations-note">
          还有 {{ board.ledger.unmatchedSellQuantity }} 股卖出没有对应的买入，不计入胜率。
        </p>
        <div v-if="board.ledger.closed.length" class="operations-closed" role="table" aria-label="已平仓明细">
          <div v-for="(item, index) in board.ledger.closed" :key="`${item.tsCode}-${item.closedAt}-${index}`" role="row">
            <button class="operations-stock" type="button" :aria-label="`在已平仓里选择 ${item.name || item.tsCode}`" @click="selectStock(item.tsCode)">
              <strong>{{ item.name || item.tsCode }}</strong>
              <small>{{ formatTime(item.closedAt) }}</small>
            </button>
            <span>买 {{ item.buyPrice.toFixed(2) }} / 卖 {{ item.sellPrice.toFixed(2) }}</span>
            <span>{{ item.quantity }} 股 · {{ money(item.pnl) }} · {{ item.sameDay ? '做T · ' : '' }}{{ item.pnl > 0 ? '胜' : item.pnl < 0 ? '负' : '持平不计' }}</span>
          </div>
        </div>
      </details>
    </template>
  </section>
</template>

<style scoped>
.operations { display: grid; gap: 0.8rem; }
.operations-note, .operations-brief, .operations-error { margin: 0; color: hsl(var(--muted-foreground)); font-size: 0.75rem; line-height: 1.45; }
.operations-error { color: hsl(var(--status-danger)); }
.operations-form, .operations-position, .operations-history { border: 1px solid hsl(var(--border)); border-radius: var(--ui-radius-sm, 0.35rem); background: hsl(var(--card)); }
.operations-form { display: grid; gap: 0.7rem; padding: 0.8rem; }
.operations-field { display: grid; gap: 0.25rem; min-width: 0; }
.operations-field > span, .operations-fill-tools { color: hsl(var(--muted-foreground)); font-size: 0.6875rem; }
.operations-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.55rem; }
.operations-side { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; }
.operations-side button { min-height: 2.25rem; border: 1px solid hsl(var(--border)); border-radius: var(--ui-radius-sm, 0.35rem); background: transparent; color: inherit; }
.operations-side button[aria-pressed="true"] { border-color: hsl(var(--primary)); color: hsl(var(--primary)); }
.operations-chips { display: flex; gap: 0.35rem; }
.operations-positions { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.45rem; }
.operations-position { display: grid; gap: 0.15rem; padding: 0.65rem 0.75rem; text-align: left; color: inherit; }
.operations-position-select[aria-pressed="true"] { color: hsl(var(--primary)); }
.operations-position-select { display: grid; gap: 0.15rem; padding: 0; border: 0; background: none; color: inherit; text-align: left; }
.operations-position small, .operations-stock small { color: hsl(var(--muted-foreground)); }
.operations-fill-tools { display: flex; justify-content: space-between; align-items: center; }
.operations-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 0.5rem; }
.operations-stats div { display: grid; gap: 0.15rem; border: 1px solid hsl(var(--border)); border-radius: var(--ui-radius-sm, 0.35rem); padding: 0.55rem 0.7rem; }
.operations-stats span, .operations-stats small { color: hsl(var(--muted-foreground)); font-size: 0.6875rem; }
.operations-stats strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.operations-fills, .operations-closed { display: grid; gap: 0.35rem; }
.operations-fill, .operations-closed [role="row"] { display: grid; grid-template-columns: 9rem minmax(8rem, 1.2fr) 4rem minmax(6rem, 0.8fr) auto; gap: 0.45rem; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid hsl(var(--border)); font-size: 0.8125rem; font-variant-numeric: tabular-nums; }
.operations-closed [role="row"] { grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(8rem, 1fr); }
.operations-stock { display: grid; padding: 0; border: 0; background: none; color: inherit; text-align: left; }
.operations-fill-actions { display: flex; gap: 0.35rem; justify-content: flex-end; }
.operations-history { padding: 0.55rem 0.75rem; }
.operations-history summary { cursor: pointer; }
.operations-curve { width: 100%; height: 8rem; margin-top: 0.6rem; color: hsl(var(--primary)); }
@media (max-width: 800px) {
  .operations-fields, .operations-stats { grid-template-columns: 1fr 1fr; }
  .operations-fill, .operations-closed [role="row"] { grid-template-columns: 1fr 1fr; }
}
</style>
