<script setup lang="ts">
import type { QuantInvestmentKnowledge, QuantKnowledgeFactor } from '../lib/quant-view-models'
import { SkeletonCard } from '@starye/ui'
import { BookOpen, DatabaseZap, ExternalLink, Info, Sparkles, Tags } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  investmentKnowledge: QuantInvestmentKnowledge | null
  loading: boolean
  hasError: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const activeKnowledgeFactors = computed(() => props.investmentKnowledge?.factors.filter(factor => factor.status === 'active') || [])
const partialKnowledgeFactors = computed(() => props.investmentKnowledge?.factors.filter(factor => factor.status === 'partial') || [])
const plannedKnowledgeFactors = computed(() => props.investmentKnowledge?.factors.filter(factor => factor.status === 'planned' || factor.status === 'context') || [])
const mappedKnowledgeAliases = computed(() => props.investmentKnowledge?.aliases.filter(alias => alias.status === 'mapped') || [])
const contextKnowledgeAliases = computed(() => props.investmentKnowledge?.aliases.filter(alias => alias.status !== 'mapped') || [])

function knowledgeStatusLabel(status: QuantKnowledgeFactor['status']): string {
  return {
    active: '已进入评分',
    partial: '部分接通',
    planned: '待接数据',
    context: '知识参考',
  }[status]
}

function knowledgeStatusClass(status: QuantKnowledgeFactor['status']): string {
  return `knowledge-status-${status}`
}

function knowledgeFieldLabel(field: string): string {
  return {
    peTtm: 'TTM PE',
    pb: 'PB',
    ps: 'PS',
    peg: 'PEG',
    netProfitYoY: '净利润同比',
    adjustedNetProfitYoY: '扣非净利润同比',
    operatingCashflowToRevenue: '经营现金流 / 营收',
    roe: 'ROE',
    roic: 'ROIC',
    grossMargin: '毛利率',
    netMargin: '净利率',
    debtAssetRatio: '资产负债率',
    operatingCashflowPerShare: '经营现金流 / 股',
    fcffBack: 'FCFF（历史）',
    fcffForward: 'FCFF（前瞻）',
    interestCoverage: '利息覆盖倍数',
    interestBearingDebtRatio: '带息负债率',
    cashRatio: '现金比率',
    totalLiability: '负债规模',
    revenueYoY: '营收同比',
    reportDate: '报告期',
    dailyBars: '日线',
    return60: '60 日表现',
    ma60Gap: '距 60 日均线',
    drawdown60: '60 日回撤',
    operatingCashflow: '经营现金流',
    capitalExpenditure: '资本开支',
    interestExpense: '利息支出',
    interestBearingDebt: '有息负债',
    orderBacklog: '订单金额',
    contractLiabilities: '合同负债',
    segmentRevenue: '分部收入',
    segmentGrossMargin: '分部毛利率',
    volume: '销量',
    realizedPrice: '实现价格',
    commodityPrice: '商品价格',
    unitCost: '单位成本',
    output: '产量',
    longTermContractRatio: '长协比例',
    dividendYield: '股息率',
    payoutRatio: '分红支付率',
    freeCashflow: '自由现金流',
    buybackAmount: '回购金额',
    sharesOutstandingChange: '股本变化',
    industry: '行业分类',
    industryProfitYoY: '行业利润同比',
    industryIndexReturn: '行业指数表现',
    companyProfitYoY: '公司利润同比',
    consensusRevenue: '一致预期营收',
    consensusProfit: '一致预期利润',
    earningsSurprise: '业绩超预期',
    forwardPe: '前瞻 PE',
    priceBeforeReport: '报告前价格',
    cash: '现金',
    profitVolatility: '利润波动',
  }[field] || field
}

function formatKnowledgeFields(fields: readonly string[]): string {
  return fields.map(knowledgeFieldLabel).join('、')
}

function knowledgeAliasStatusLabel(status: 'mapped' | 'ambiguous' | 'context_only'): string {
  return {
    mapped: '已映射',
    ambiguous: '待确认',
    context_only: '跨市场 / 语境样本',
  }[status]
}

function knowledgeConfidenceLabel(confidence: 'high' | 'medium' | 'low'): string {
  return { high: '高置信度', medium: '中置信度', low: '低置信度' }[confidence]
}
</script>

<template>
  <section class="knowledge-section" aria-labelledby="knowledge-title">
    <div class="knowledge-heading">
      <div>
        <p class="section-kicker">
          INVESTMENT KNOWLEDGE
        </p>
        <h2 id="knowledge-title" class="section-title">
          投资因子框架
        </h2>
        <p class="knowledge-intro">
          把文章中的判断拆成可验证的因子；当前只有“已进入评分”的因子影响价值质量分。
        </p>
      </div>
      <div v-if="props.investmentKnowledge" class="knowledge-meta">
        <span>知识库 {{ props.investmentKnowledge.version }}</span>
        <span>{{ props.investmentKnowledge.sources.length }} 篇来源</span>
      </div>
    </div>
    <div v-if="props.loading" class="knowledge-state" role="status">
      <SkeletonCard variant="content" />
    </div>
    <div v-else-if="props.hasError" class="knowledge-state" role="status">
      <Info :size="17" aria-hidden="true" />
      <span>投资知识暂时不可用</span>
      <button class="text-button" type="button" @click="emit('retry')">
        重试
      </button>
    </div>
    <template v-else-if="props.investmentKnowledge">
      <div class="knowledge-summary-grid" aria-label="因子状态统计">
        <div class="knowledge-summary-item knowledge-summary-active">
          <DatabaseZap :size="16" aria-hidden="true" />
          <strong>{{ activeKnowledgeFactors.length }}</strong>
          <span>已进入评分</span>
        </div>
        <div class="knowledge-summary-item knowledge-summary-partial">
          <Sparkles :size="16" aria-hidden="true" />
          <strong>{{ partialKnowledgeFactors.length }}</strong>
          <span>部分接通</span>
        </div>
        <div class="knowledge-summary-item knowledge-summary-planned">
          <BookOpen :size="16" aria-hidden="true" />
          <strong>{{ plannedKnowledgeFactors.length }}</strong>
          <span>待接或定性</span>
        </div>
        <div class="knowledge-summary-item knowledge-summary-alias">
          <Tags :size="16" aria-hidden="true" />
          <strong>{{ mappedKnowledgeAliases.length }}</strong>
          <span>已映射别名</span>
        </div>
      </div>
      <div class="knowledge-factor-grid">
        <article v-for="factor in props.investmentKnowledge.factors" :key="factor.id" class="knowledge-factor" :class="knowledgeStatusClass(factor.status)">
          <div class="knowledge-factor-heading">
            <div>
              <span class="knowledge-factor-category">{{ factor.category }}</span>
              <h3>{{ factor.title }}</h3>
            </div>
            <span class="knowledge-status-badge" :class="knowledgeStatusClass(factor.status)">{{ knowledgeStatusLabel(factor.status) }}</span>
          </div>
          <p>{{ factor.interpretation }}</p>
          <div class="knowledge-factor-measurement">
            <strong>量化方向</strong>
            <span>{{ factor.measurement }}</span>
          </div>
          <div class="knowledge-factor-fields">
            <span v-if="factor.availableFields.length">已接：{{ formatKnowledgeFields(factor.availableFields) }}</span>
            <span v-if="factor.missingFields.length">待接：{{ formatKnowledgeFields(factor.missingFields) }}</span>
          </div>
          <div class="knowledge-factor-foot">
            <span v-if="factor.eligibleInValueQuality">当前价值质量评分使用</span>
            <span v-else>先作为研究假设</span>
            <span>{{ factor.sourceIds.length }} 篇关联来源</span>
          </div>
        </article>
      </div>
      <details class="knowledge-details">
        <summary>
          <BookOpen :size="15" aria-hidden="true" />
          查看文章来源与股票别名映射
        </summary>
        <div class="knowledge-context-grid">
          <div class="knowledge-context-column">
            <div class="knowledge-context-heading">
              <strong>文章来源</strong>
              <span>{{ props.investmentKnowledge.sources.length }} 篇</span>
            </div>
            <div class="knowledge-source-list">
              <a v-for="source in props.investmentKnowledge.sources" :key="source.id" class="knowledge-source-row" :href="source.url" target="_blank" rel="noreferrer" :title="source.url">
                <span class="knowledge-source-access" :class="source.access === 'preview' ? 'knowledge-source-preview' : 'knowledge-source-full'">{{ source.access === 'preview' ? '试读' : '全文' }}</span>
                <span class="knowledge-source-copy">
                  <strong>{{ source.title }}</strong>
                  <small>{{ source.publishedAt || '日期未读取' }} · {{ source.summary }}</small>
                </span>
                <ExternalLink :size="13" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div class="knowledge-context-column">
            <div class="knowledge-context-heading">
              <strong>文章别名映射</strong>
              <span>{{ props.investmentKnowledge.aliases.length }} 条 · {{ contextKnowledgeAliases.length }} 待确认</span>
            </div>
            <div class="knowledge-alias-grid">
              <div v-for="alias in props.investmentKnowledge.aliases" :key="alias.alias" class="knowledge-alias-row" :title="alias.note">
                <span class="knowledge-alias-name">{{ alias.alias }}</span>
                <strong>{{ alias.name || alias.candidates.join(' / ') || '待确认' }}</strong>
                <small>{{ knowledgeAliasStatusLabel(alias.status) }} · {{ knowledgeConfidenceLabel(alias.confidence) }}</small>
              </div>
            </div>
          </div>
        </div>
        <p class="knowledge-details-note">
          已映射的 A 股研究样本已通过幂等 migration 加入观察池；港股、未上市主体和待确认别名保留在知识层，不进入当前 A 股日线同步。
        </p>
      </details>
    </template>
  </section>
</template>
