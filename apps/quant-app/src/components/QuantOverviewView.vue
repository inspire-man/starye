<script setup lang="ts">
import type { QuantAiReviewOutcomeBoard, QuantInvalidationItem, QuantPriceLocation } from '../api/resources/research'
import type { QuantDataHealthAction, QuantDataHealthFreshness, QuantDataHealthStatus, QuantDataHealthSummary } from '../lib/data-health'
import type { QuantView } from '../lib/quant-view'
import type { CandidateItem, QuantScheduledResearchRun, WatchlistItem } from '../lib/quant-view-models'
import type { WatchlistEnvironment, WatchlistEnvironmentStatus } from '../lib/watchlist-environment'
import { ArrowUpRight, CalendarDays, ChevronRight, DatabaseZap, Eye, Info, RefreshCw, ShieldAlert, Sparkles } from 'lucide-vue-next'
import { computed } from 'vue'
import QuantTimingPoolAudit from './QuantTimingPoolAudit.vue'

type RiskTone = 'neutral' | 'warning' | 'danger'

interface RiskNote {
  key: string
  tone: RiskTone
  title: string
  detail: string
}

const props = defineProps<{
  pageBusy: boolean
  candidatesLoading: boolean
  watchlistCount: number
  upCount: number
  downCount: number
  signalCandidateCount: number
  dataCoverageLabel: string
  latestWatchlistDate: string
  dataHealthSummary: QuantDataHealthSummary
  watchlist: WatchlistItem[]
  watchlistEnvironment: WatchlistEnvironment
  topCandidates: CandidateItem[]
  riskItems: RiskNote[]
  dataHealthStatusClass: (status: QuantDataHealthStatus) => string
  dataHealthStatusLabel: (status: QuantDataHealthStatus) => string
  dataHealthFreshnessClass: (freshness: QuantDataHealthFreshness) => string
  dataHealthSummaryClass: (status: QuantDataHealthStatus) => string
  environmentStatusClass: (status: WatchlistEnvironmentStatus) => string
  formatEnvironmentRatio: (value: number | null) => string
  formatDateTime: (value: string | null) => string
  focusTone: (item: CandidateItem) => string
  displayStockName: (item: Pick<CandidateItem, 'tsCode' | 'name'>) => string
  focusSignal: (item: CandidateItem) => string
  formatSignalScore: (value: number | null) => string
  signalScorePercent: (value: number | null) => number
  candidateRiskTone: (item: CandidateItem) => RiskTone
  riskToneClass: (tone: RiskTone) => string
  riskLabel: (item: CandidateItem) => string
  researchPriorityDetail: (item: CandidateItem) => string
  scheduledResearch?: QuantScheduledResearchRun | null
  scheduledResearchHistory?: QuantScheduledResearchRun[]
  scheduledResearchRunning?: boolean
  scheduledResearchError?: string | null
  priceLocations?: QuantPriceLocation[]
  priceLocationsLoading?: boolean
  priceLocationsError?: string | null
  aiReviewOutcomes?: QuantAiReviewOutcomeBoard | null
  aiReviewOutcomesLoading?: boolean
  aiReviewOutcomesError?: string | null
  invalidationChecks?: QuantInvalidationItem[]
  invalidationChecksLoading?: boolean
  invalidationChecksError?: string | null
  holdings?: Record<string, { name: string | null, openQuantity: number, cost: number | null, dividendCash: number, realizedPnl: number }>
}>()

const emit = defineEmits<{
  navigate: [view: QuantView]
  selectStock: [item: Pick<WatchlistItem, 'tsCode' | 'name'>]
  runDataHealthAction: [action: QuantDataHealthAction | null]
  recoverDataHealth: []
  runScheduledResearch: []
  addHolding: [item: { tsCode: string, name: string | null }]
  recordFill: [tsCode: string]
}>()

const holdingRows = computed(() => Object.entries(props.holdings ?? {})
  .filter(([, book]) => book.openQuantity > 0)
  .map(([tsCode, book]) => {
    const watchedItem = props.watchlist.find(item => item.tsCode === tsCode)
    const cost = book.cost
    const latestClose = watchedItem?.latestClose ?? null
    const gapPercent = cost !== null && latestClose !== null && cost > 0 ? (latestClose - cost) / cost : null
    return {
      tsCode,
      name: book.name ?? watchedItem?.name ?? null,
      openQuantity: book.openQuantity,
      cost,
      dividendCash: book.dividendCash,
      latestClose,
      watched: Boolean(watchedItem),
      gapPercent,
    }
  })
  .sort((left, right) => Number(left.watched) - Number(right.watched)
    || Math.abs(right.gapPercent ?? 0) - Math.abs(left.gapPercent ?? 0)
    || (left.name || left.tsCode).localeCompare(right.name || right.tsCode, 'zh')))

const blockedHoldingCount = computed(() => holdingRows.value.filter(item => !item.watched).length)

function holdingGap(item: { cost: number | null, latestClose: number | null, openQuantity: number }): string | null {
  if (item.cost === null || item.latestClose === null || item.cost <= 0 || item.openQuantity <= 0)
    return null
  const perShare = item.latestClose - item.cost
  const percent = perShare / item.cost * 100
  const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`
  if (perShare.toFixed(2) === '0.00')
    return '相对最近收盘持平。账本对照，不是收益结论。'
  return `相对最近收盘 ${signed(perShare)}/股（${signed(percent)}%）。账本对照，不是收益结论。`
}

function scheduledStatusLabel(status: QuantScheduledResearchRun['status']): string {
  return { running: '运行中', completed: '已完成', partial: '部分完成', failed: '失败' }[status]
}

function scheduledStageLabel(stage: NonNullable<QuantScheduledResearchRun['items'][number]>['stage']): string {
  return {
    watchlist: '确认入池',
    data: '更新数据',
    research: '生成报告',
    ai: 'AI 复核',
    completed: '完成',
    error: '失败',
    skipped: '跳过',
  }[stage]
}

function scheduledReasonLabel(reason: NonNullable<QuantScheduledResearchRun['items'][number]>['reasons'][number]): string {
  return {
    'overdue': '已逾期',
    'today': '今日复查',
    'stale-daily': '日线过期',
    'insufficient-data': '数据不足',
  }[reason]
}

function evidenceStatusLabel(status: 'pass' | 'caution' | 'fail' | 'missing'): string {
  return { pass: '通过', caution: '留意', fail: '未通过', missing: '缺失' }[status]
}

function changedInvalidationItems(): QuantInvalidationItem[] {
  return (props.invalidationChecks ?? []).filter(item => item.triggeredCount || item.recoveredCount)
}

function unchangedInvalidationCount(): number {
  return (props.invalidationChecks ?? []).filter(item => !item.triggeredCount && !item.recoveredCount).length
}

function focusInvalidationLabel(tsCode: string): string {
  const item = props.invalidationChecks?.find(row => row.tsCode === tsCode)
  if (!item?.triggeredCount)
    return ''
  return item.checks.filter(check => check.change === 'triggered').map(check => check.label).join('、')
}

function changedCheckSummary(item: QuantInvalidationItem): string {
  return item.checks
    .filter(check => check.change === 'triggered' || check.change === 'recovered')
    .map(check => `${check.label}${check.change === 'triggered' ? '转弱' : '恢复'}`)
    .join('、')
}
</script>

<template>
  <div class="quant-overview">
    <section class="metric-grid" aria-label="工作台概览">
      <template v-if="props.pageBusy">
        <SkeletonCard v-for="index in 4" :key="index" variant="stat" />
      </template>
      <template v-else>
        <article class="metric-card">
          <div class="metric-card-heading">
            <span class="metric-icon metric-icon-teal"><Eye :size="17" aria-hidden="true" /></span>
            <span>观察池</span>
          </div>
          <strong class="metric-value">{{ props.watchlistCount }}<small>/ 50</small></strong>
          <span class="metric-note">当前关注标的</span>
        </article>
        <article class="metric-card">
          <div class="metric-card-heading">
            <span class="metric-icon metric-icon-green"><ArrowUpRight :size="17" aria-hidden="true" /></span>
            <span>今日涨跌</span>
          </div>
          <strong class="metric-value metric-value-split"><span class="text-status-success">+{{ props.upCount }}</span><small>/ 跌 {{ props.downCount }}</small></strong>
          <span class="metric-note">观察池最新日线</span>
        </article>
        <article class="metric-card">
          <div class="metric-card-heading">
            <span class="metric-icon metric-icon-amber"><Sparkles :size="17" aria-hidden="true" /></span>
            <span>有信号</span>
          </div>
          <strong class="metric-value">{{ props.signalCandidateCount }}</strong>
          <span class="metric-note">候选快照中的标的</span>
        </article>
        <article class="metric-card">
          <div class="metric-card-heading">
            <span class="metric-icon metric-icon-blue"><CalendarDays :size="17" aria-hidden="true" /></span>
            <span>数据覆盖</span>
          </div>
          <strong class="metric-value metric-value-date">{{ props.dataCoverageLabel }}</strong>
          <span class="metric-note">最新 {{ props.latestWatchlistDate }}</span>
        </article>
      </template>
    </section>

    <section v-if="holdingRows.length" class="holdings-section" aria-labelledby="holdings-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            OPEN WORKFLOW
          </p>
          <h2 id="holdings-title" class="section-title">
            开盘工作流
          </h2>
          <p class="holdings-note">
            先处理打不开研究的持仓，再看相对最近收盘偏离更大的。这不是买卖清单。
          </p>
        </div>
        <button class="text-button" type="button" @click="emit('navigate', 'operations')">
          打开操作记录
        </button>
      </div>
      <p class="holdings-progress">
        {{ holdingRows.length }} 只持仓 · {{ blockedHoldingCount }} 只还不能研究
      </p>
      <ol class="holdings-steps">
        <li v-for="(item, index) in holdingRows" :key="item.tsCode" class="holding-step">
          <span class="holding-step-index">{{ index + 1 }}</span>
          <div class="holding-step-body">
            <strong>{{ item.name || item.tsCode }}</strong>
            <small>{{ item.tsCode }}</small>
            <span>未平 {{ item.openQuantity }} 股 · 成本 {{ item.cost === null ? '--' : item.cost.toFixed(2) }} · 分红 {{ item.dividendCash > 0 ? '+' : '' }}{{ item.dividendCash.toFixed(2) }}</span>
            <small v-if="!item.watched" :aria-label="`${item.name || item.tsCode} 不在观察池`">不在观察池，打不开研究详情</small>
            <small v-else-if="holdingGap(item)">{{ holdingGap(item) }}</small>
            <small v-else>最近收盘还没带入。打开研究后再核对。</small>
          </div>
          <div class="holding-step-actions">
            <button v-if="item.watched" class="primary-button" type="button" :aria-label="`打开 ${item.name || item.tsCode} 的研究`" @click="emit('selectStock', { tsCode: item.tsCode, name: item.name })">
              打开研究
            </button>
            <button v-else class="primary-button" type="button" :aria-label="`把 ${item.name || item.tsCode} 加入观察池`" @click="emit('addHolding', { tsCode: item.tsCode, name: item.name })">
              加入观察池
            </button>
            <button class="text-button" type="button" :aria-label="`为 ${item.name || item.tsCode} 记一笔`" @click="emit('recordFill', item.tsCode)">
              记一笔
            </button>
          </div>
        </li>
      </ol>
    </section>

    <section class="data-health-section" aria-labelledby="data-health-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            DATA HEALTH
          </p>
          <h2 id="data-health-title" class="section-title">
            数据健康
          </h2>
        </div>
        <div class="data-health-heading-status">
          <span class="status-chip" :class="props.dataHealthStatusClass(props.dataHealthSummary.status)">
            {{ props.dataHealthStatusLabel(props.dataHealthSummary.status) }}
          </span>
          <span class="status-chip" :class="props.dataHealthFreshnessClass(props.dataHealthSummary.freshness)">
            {{ props.dataHealthSummary.freshnessLabel }}
          </span>
        </div>
      </div>
      <div class="data-health-layout">
        <div class="data-health-summary" :class="props.dataHealthSummaryClass(props.dataHealthSummary.status)">
          <div class="data-health-summary-icon" aria-hidden="true">
            <DatabaseZap :size="18" />
          </div>
          <strong>{{ props.dataHealthSummary.headline }}</strong>
          <p>{{ props.dataHealthSummary.scopeNote }}</p>
          <small class="data-health-freshness-summary">{{ props.dataHealthSummary.freshnessDetail }}</small>
          <button v-if="props.dataHealthSummary.items[0]?.totalCount && props.dataHealthSummary.status !== 'loading' && (props.dataHealthSummary.status !== 'ready' || props.dataHealthSummary.freshness !== 'fresh')" class="text-button data-health-recover-all" type="button" aria-label="自动补齐全部数据" @click="emit('recoverDataHealth')">
            <RefreshCw :size="13" aria-hidden="true" />
            自动补齐全部数据
          </button>
        </div>
        <div class="data-health-list" role="list" aria-label="数据健康状态">
          <div v-for="item in props.dataHealthSummary.items" :key="item.key" class="data-health-item" role="listitem">
            <div class="data-health-item-heading">
              <strong>{{ item.label }}</strong>
              <span class="status-chip" :class="props.dataHealthStatusClass(item.status)">
                {{ props.dataHealthStatusLabel(item.status) }}
              </span>
            </div>
            <p>{{ item.detail }}</p>
            <div class="data-health-item-meta">
              <small v-if="item.observedAt">观测 {{ props.formatDateTime(item.observedAt) }}</small>
              <small v-else>未记录观察时间</small>
              <span class="status-chip data-health-freshness-chip" :class="props.dataHealthFreshnessClass(item.freshness)">
                {{ item.freshnessLabel }}
              </span>
              <small>{{ item.freshnessDetail }}</small>
            </div>
            <button
              v-if="item.action && item.actionLabel"
              class="text-button data-health-action"
              type="button"
              :aria-label="`${item.label}：${item.actionLabel}`"
              @click="emit('runDataHealthAction', item.action)"
            >
              <ChevronRight :size="13" aria-hidden="true" />
              {{ item.actionLabel }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="data-health-section scheduled-research-section" aria-labelledby="scheduled-research-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            BACKGROUND RESEARCH
          </p>
          <h2 id="scheduled-research-title" class="section-title">
            后台定时研究
          </h2>
        </div>
        <span v-if="props.scheduledResearch" class="status-chip">{{ scheduledStatusLabel(props.scheduledResearch.status) }}</span>
        <button class="text-button" type="button" :disabled="props.scheduledResearchRunning" @click="emit('runScheduledResearch')">
          <RefreshCw :size="13" :class="props.scheduledResearchRunning ? 'animate-spin' : ''" aria-hidden="true" />
          {{ props.scheduledResearchRunning ? '运行中' : '立即运行一批' }}
        </button>
      </div>
      <p v-if="props.scheduledResearchError" class="data-health-error" role="alert">
        {{ props.scheduledResearchError }}
      </p>
      <div v-if="!props.scheduledResearch" class="data-health-summary">
        <strong>尚未运行后台研究</strong>
        <p>关闭页面后，Worker 仍会处理已逾期复查、过期日线和数据不足的观察池标的。这里显示后台任务状态，不构成买卖建议。</p>
      </div>
      <div v-else class="data-health-summary">
        <strong>最近一次后台任务 {{ props.scheduledResearch.completedCount }} 完成 / {{ props.scheduledResearch.failedCount }} 失败 / {{ props.scheduledResearch.dueCount }} 到期</strong>
        <p>确定性报告成功后才会推迟复查日；AI 失败会保留报告。缺口保持可见，不会补零。</p>
        <small>{{ props.formatDateTime(props.scheduledResearch.startedAt) }}</small>
        <div v-if="props.scheduledResearch.items.length" class="scheduled-research-list" role="list" aria-label="后台研究标的">
          <div v-for="item in props.scheduledResearch.items" :key="item.tsCode" class="data-health-item" role="listitem">
            <div class="data-health-item-heading">
              <strong>{{ props.displayStockName(item) }}</strong>
              <span class="status-chip">{{ scheduledStageLabel(item.stage) }}</span>
            </div>
            <p>{{ item.reasons.map(scheduledReasonLabel).join('、') || '无到期原因' }}</p>
            <small v-if="item.errorCode">{{ item.errorCode }}</small>
          </div>
        </div>
      </div>
      <div v-if="props.scheduledResearchHistory?.length" class="scheduled-research-history" role="list" aria-label="后台研究历史">
        <div v-for="run in props.scheduledResearchHistory" :key="run.id" class="scheduled-research-history-row" role="listitem">
          <span>{{ props.formatDateTime(run.startedAt) }}</span>
          <strong>{{ scheduledStatusLabel(run.status) }}</strong>
          <small>{{ run.completedCount }} 完成 · {{ run.failedCount }} 失败 · {{ run.processedCount }} 已处理</small>
        </div>
      </div>
    </section>

    <QuantTimingPoolAudit
      :watchlist="props.watchlist"
      :display-stock-name="props.displayStockName"
      @select-stock="emit('selectStock', $event)"
    />

    <section class="environment-section" aria-labelledby="environment-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            WATCHLIST CONTEXT
          </p>
          <h2 id="environment-title" class="section-title">
            观察池环境
          </h2>
        </div>
        <span class="section-meta">只看当前样本，不代表大盘</span>
      </div>
      <div class="environment-layout">
        <div class="environment-summary" :class="props.environmentStatusClass(props.watchlistEnvironment.status)">
          <div class="environment-summary-heading">
            <span class="status-chip" :class="props.environmentStatusClass(props.watchlistEnvironment.status)">{{ props.watchlistEnvironment.label }}</span>
            <strong>{{ props.watchlistEnvironment.headline }}</strong>
          </div>
          <p>{{ props.watchlistEnvironment.scopeNote }}</p>
          <ul v-if="props.watchlistEnvironment.cautions.length" class="environment-cautions">
            <li v-for="caution in props.watchlistEnvironment.cautions" :key="caution">
              {{ caution }}
            </li>
          </ul>
        </div>
        <div class="environment-metrics" role="list" aria-label="观察池环境指标">
          <div v-for="metric in props.watchlistEnvironment.metrics" :key="metric.key" class="environment-metric" role="listitem">
            <div class="environment-metric-heading">
              <span>{{ metric.label }}</span>
              <strong>{{ props.formatEnvironmentRatio(metric.ratio) }}</strong>
            </div>
            <div class="environment-meter" role="progressbar" :aria-label="metric.label" :aria-valuenow="metric.ratio === null ? undefined : Math.round(metric.ratio * 100)" aria-valuemin="0" aria-valuemax="100">
              <span :style="{ width: `${metric.ratio === null ? 0 : Math.round(metric.ratio * 100)}%` }" />
            </div>
            <small>{{ metric.detail }}</small>
          </div>
        </div>
      </div>
    </section>

    <section class="price-location-section" aria-labelledby="price-location-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            PRICE LOCATION
          </p>
          <h2 id="price-location-title" class="section-title">
            价格位置
          </h2>
        </div>
        <span class="section-meta">最近收盘对照已保存的参考区间</span>
      </div>
      <p class="price-location-note">
        只比较观察池里已经生成的研究报告。区间内表示价格条件满足，不是下单依据。
      </p>
      <div v-if="props.priceLocationsLoading" class="focus-empty" aria-label="价格位置加载中">
        <SkeletonCard variant="content" />
      </div>
      <p v-else-if="props.priceLocationsError" class="price-location-error" role="status">
        {{ props.priceLocationsError }}
      </p>
      <div v-else-if="props.priceLocations?.length" class="price-location-list">
        <button v-for="item in props.priceLocations" :key="item.tsCode" class="price-location-row" :class="`price-location-${item.status}`" type="button" :title="item.detail" @click="emit('selectStock', { tsCode: item.tsCode, name: item.name ?? item.tsCode })">
          <span class="price-location-identity">
            <strong>{{ item.name || item.tsCode }}</strong>
            <small>{{ item.tsCode }}</small>
          </span>
          <span>{{ item.label }}</span>
          <em>{{ item.latestClose === null ? '--' : `${item.latestClose.toFixed(2)}` }}</em>
          <em>{{ item.distancePercent === null ? '' : `${item.distancePercent > 0 ? '+' : ''}${item.distancePercent.toFixed(1)}%` }}</em>
        </button>
      </div>
      <p v-else class="price-location-empty">
        生成研究报告后，这里会按最近收盘和参考区间排列观察池。
      </p>
    </section>

    <section class="price-location-section" aria-labelledby="ai-review-outcome-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            AI REVIEW OUTCOME
          </p>
          <h2 id="ai-review-outcome-title" class="section-title">
            AI 复核回看
          </h2>
        </div>
        <span class="section-meta">最近一次复核对照后续收盘</span>
      </div>
      <p class="price-location-note">
        {{ props.aiReviewOutcomes?.headline || '每只股票只用最近一次已保存的 AI 复核。方向一致不是收益。' }}
      </p>
      <div v-if="props.aiReviewOutcomesLoading" class="focus-empty" aria-label="AI 复核回看加载中">
        <SkeletonCard variant="content" />
      </div>
      <p v-else-if="props.aiReviewOutcomesError" class="price-location-error" role="status">
        {{ props.aiReviewOutcomesError }}
      </p>
      <div v-else-if="props.aiReviewOutcomes?.items.length" class="price-location-list">
        <button v-for="item in props.aiReviewOutcomes.items" :key="item.tsCode" class="price-location-row" :class="`price-location-${item.status === 'aligned' ? 'inside' : item.status === 'opposed' ? 'below' : 'missing-report'}`" type="button" :title="item.detail" @click="emit('selectStock', { tsCode: item.tsCode, name: item.name ?? item.tsCode })">
          <span class="price-location-identity">
            <strong>{{ item.name || item.tsCode }}</strong>
            <small>{{ item.accepted === false ? '未接受' : item.accepted ? '已接受' : '无结论' }}</small>
          </span>
          <span>{{ item.label }}</span>
          <em>{{ item.changePercent === null ? '--' : `${item.changePercent > 0 ? '+' : ''}${item.changePercent.toFixed(1)}%` }}</em>
        </button>
      </div>
      <p v-else class="price-location-empty">
        完成一次 AI 复核后，这里回看它和后续收盘的方向。
      </p>
    </section>

    <section class="price-location-section overview-changes" aria-labelledby="invalidation-check-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            INVALIDATION CHECK
          </p>
          <h2 id="invalidation-check-title" class="section-title">
            失效对照
          </h2>
        </div>
        <span class="section-meta">只核对均线、20 日收益、量比和连涨</span>
      </div>
      <p class="price-location-note">
        用最新日线重算报告里这四条证据。转弱只表示该重新评估，不构成交易结论。财务、估值和股东回报在个股决策卡对照当前读取结果。
      </p>
      <div v-if="props.invalidationChecksLoading" class="focus-empty" aria-label="失效对照加载中">
        <SkeletonCard variant="content" />
      </div>
      <p v-else-if="props.invalidationChecksError" class="price-location-error" role="status">
        {{ props.invalidationChecksError }}
      </p>
      <div v-else-if="changedInvalidationItems().length" class="price-location-list">
        <button v-for="item in changedInvalidationItems()" :key="item.tsCode" class="price-location-row" :class="item.triggeredCount ? 'price-location-below' : 'price-location-inside'" type="button" :title="item.checks.map(check => `${check.label} ${evidenceStatusLabel(check.savedStatus)} → ${evidenceStatusLabel(check.currentStatus)}`).join('；')" @click="emit('selectStock', { tsCode: item.tsCode, name: item.name ?? item.tsCode })">
          <span class="price-location-identity">
            <strong>{{ item.name || item.tsCode }}</strong>
            <small>{{ item.tsCode }}</small>
          </span>
          <span>{{ changedCheckSummary(item) }}</span>
          <em>{{ item.triggeredCount ? `${item.triggeredCount} 条转弱` : `${item.recoveredCount} 条恢复` }}</em>
        </button>
      </div>
      <p v-else-if="props.invalidationChecks?.length" class="price-location-empty">
        可对照的日线证据都未转弱。
      </p>
      <p v-else class="price-location-empty">
        生成研究报告后，这里对照最新日线是否让已保存证据转弱。
      </p>
      <p v-if="changedInvalidationItems().length && unchangedInvalidationCount()" class="price-location-note">
        其余 {{ unchangedInvalidationCount() }} 只未转弱。
      </p>
    </section>

    <section class="focus-section" aria-labelledby="focus-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            TODAY'S FOCUS
          </p>
          <h2 id="focus-title" class="section-title">
            今日优先关注
          </h2>
        </div>
        <span class="section-meta">按当前信号分排序 · {{ props.latestWatchlistDate }}</span>
      </div>
      <div class="focus-layout">
        <div class="focus-list">
          <div v-if="props.candidatesLoading" class="focus-empty" aria-label="优先关注加载中">
            <SkeletonCard variant="content" />
          </div>
          <button
            v-for="(item, index) in props.topCandidates"
            :key="item.tsCode"
            class="focus-row"
            :class="props.focusTone(item)"
            type="button"
            @click="emit('selectStock', item)"
          >
            <span class="focus-rank">0{{ index + 1 }}</span>
            <span class="focus-stock">
              <strong>{{ props.displayStockName(item) }}</strong>
              <small>{{ item.tsCode }}</small>
              <small v-if="focusInvalidationLabel(item.tsCode)">{{ focusInvalidationLabel(item.tsCode) }}已转弱</small>
            </span>
            <span class="focus-signal" :title="props.researchPriorityDetail(item)">{{ props.focusSignal(item) }}</span>
            <span class="focus-score">
              <strong>{{ props.formatSignalScore(item.score) }}</strong>
              <span class="focus-score-meter" aria-hidden="true"><span class="focus-score-meter-fill" :style="{ width: `${props.signalScorePercent(item.score)}%` }" /></span>
              <small>命中规则</small>
            </span>
            <span class="status-chip" :class="props.riskToneClass(props.candidateRiskTone(item))">{{ props.riskLabel(item) }}</span>
            <ChevronRight :size="15" aria-hidden="true" />
          </button>
          <div v-if="!props.candidatesLoading && !props.topCandidates.length" class="focus-empty">
            <Sparkles :size="18" aria-hidden="true" />
            <span>完成一次日线更新后，这里会出现可比较的信号</span>
          </div>
        </div>
        <aside class="risk-summary" aria-labelledby="risk-title">
          <div class="risk-summary-heading">
            <div>
              <p class="section-kicker">
                CHECK BEFORE DECISION
              </p>
              <h3 id="risk-title">
                风险提示
              </h3>
            </div>
            <ShieldAlert :size="18" aria-hidden="true" />
          </div>
          <div class="risk-list">
            <div v-for="item in props.riskItems" :key="item.key" class="risk-note" :class="props.riskToneClass(item.tone)">
              <span class="risk-note-mark" aria-hidden="true" />
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.detail }}</span>
              </div>
            </div>
          </div>
          <span class="risk-footnote" role="img" tabindex="0" aria-label="信号是筛选线索，不是买入指令" title="信号是筛选线索，不是买入指令">
            <Info :size="14" aria-hidden="true" />
          </span>
        </aside>
      </div>
    </section>

    <section class="research-path-section" aria-labelledby="research-path-title">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            RESEARCH PATH
          </p>
          <h2 id="research-path-title" class="section-title">
            下一步怎么做
          </h2>
        </div>
        <span class="section-meta">按顺序完成一次研究</span>
      </div>
      <div class="research-path-grid">
        <button class="research-path-card" type="button" @click="emit('navigate', 'candidates')">
          <span class="research-path-index">01</span>
          <span class="research-path-copy">
            <strong>筛选候选</strong>
            <small>先用预设和数据完整度缩小范围</small>
          </span>
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
        <button class="research-path-card" type="button" @click="emit('navigate', 'watchlist')">
          <span class="research-path-index">02</span>
          <span class="research-path-copy">
            <strong>维护观察池</strong>
            <small>确认标的并更新约两年历史日线</small>
          </span>
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
        <button class="research-path-card" type="button" @click="emit('navigate', 'knowledge')">
          <span class="research-path-index">03</span>
          <span class="research-path-copy">
            <strong>核对因子</strong>
            <small>理解信号、估值和财务数据的边界</small>
          </span>
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
      </div>
    </section>
  </div>
</template>
