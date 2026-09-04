<script setup lang="ts">
import type { QuantDataHealthAction, QuantDataHealthFreshness, QuantDataHealthStatus, QuantDataHealthSummary } from '../lib/data-health'
import type { QuantView } from '../lib/quant-view'
import type { CandidateItem, WatchlistItem } from '../lib/quant-view-models'
import type { WatchlistEnvironment, WatchlistEnvironmentStatus } from '../lib/watchlist-environment'
import { SkeletonCard } from '@starye/ui'
import { ArrowUpRight, CalendarDays, ChevronRight, DatabaseZap, Eye, Info, ShieldAlert, Sparkles } from 'lucide-vue-next'

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
}>()

const emit = defineEmits<{
  navigate: [view: QuantView]
  selectStock: [item: Pick<WatchlistItem, 'tsCode' | 'name'>]
  runDataHealthAction: [action: QuantDataHealthAction | null]
}>()
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
            <small>确认标的并更新最近 120 个交易日</small>
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
