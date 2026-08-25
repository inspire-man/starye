export const QUANT_INVESTMENT_KNOWLEDGE_VERSION = 'investment-knowledge-v2' as const

export type QuantKnowledgeSourceAccess = 'full' | 'preview'
export type QuantKnowledgeFactorStatus = 'active' | 'partial' | 'planned' | 'context'
export type QuantKnowledgeAliasStatus = 'mapped' | 'ambiguous' | 'context_only'
export type QuantKnowledgeConfidence = 'high' | 'medium' | 'low'

export interface QuantKnowledgeSource {
  readonly id: string
  readonly title: string
  readonly url: string
  readonly publishedAt: string | null
  readonly access: QuantKnowledgeSourceAccess
  readonly summary: string
}

export interface QuantKnowledgeFactor {
  readonly id: string
  readonly category: string
  readonly title: string
  readonly interpretation: string
  readonly measurement: string
  readonly requiredFields: readonly string[]
  readonly availableFields: readonly string[]
  readonly missingFields: readonly string[]
  readonly status: QuantKnowledgeFactorStatus
  readonly eligibleInValueQuality: boolean
  readonly currentDimension: 'valuation' | 'quality' | 'growth' | 'trend' | null
  readonly sourceIds: readonly string[]
}

export interface QuantKnowledgeAlias {
  readonly alias: string
  readonly status: QuantKnowledgeAliasStatus
  readonly confidence: QuantKnowledgeConfidence
  readonly tsCode: string | null
  readonly name: string | null
  readonly candidates: readonly string[]
  readonly note: string
}

export interface QuantInvestmentKnowledge {
  readonly version: typeof QUANT_INVESTMENT_KNOWLEDGE_VERSION
  readonly observedAt: string
  readonly sources: readonly QuantKnowledgeSource[]
  readonly factors: readonly QuantKnowledgeFactor[]
  readonly aliases: readonly QuantKnowledgeAlias[]
  readonly recommendedWatchlist: readonly { readonly tsCode: string, readonly name: string }[]
}

function source(id: string, title: string, url: string, publishedAt: string | null, access: QuantKnowledgeSourceAccess, summary: string): QuantKnowledgeSource {
  return { id, title, url, publishedAt, access, summary }
}

export const QUANT_KNOWLEDGE_SOURCES: readonly QuantKnowledgeSource[] = [
  source('article-new-high-20260818', '创新高', 'https://mp.weixin.qq.com/s/OquWKChdzqe22Y5oQUlv6Q', '2026-08-18', 'full', '讨论长鑫创新高、铜供需缺口、资源股周期和“方向反过来跌得也快”；量化层只提取供需、周期和波动复核思路。'),
  source('article-loss-20260815', '越努力，亏得越多', 'https://mp.weixin.qq.com/s/3EZ2ANI1_gSrjhXVXQPjvw', '2026-08-15', 'preview', '文章为付费试读，仅保留公开可见的知识分享和时效性提示，不把未读正文转成因子。'),
  source('article-fall-20260814', '真跌了', 'https://mp.weixin.qq.com/s/XuUWhlyNpL_avXS417OQ8g', '2026-08-14', 'full', '讨论资本开支预期、传统行业红利、算力投入和慢增长；量化层补充预期差、资本开支和股东回报复核。'),
  source('article-pingan-20260825', '2026半年报业绩增速创七年新高，再谈中国平安', 'https://mp.weixin.qq.com/s/tBZGc34P2HYZWeaquSm5Xw', '2026-08-25', 'full', '用 NBV、合同服务边际、三差和资产分类拆解保险利润含金量与利差损风险。'),
  source('article-lie-flat', '躺平了', 'https://mp.weixin.qq.com/s/FeydbWMQ4PMxXB3-3kVTjg', null, 'full', '强调好公司与好价格分开判断，并用特变电工的业绩底、行业增速和估值做相对比较。'),
  source('article-carry-on', '扛不住了', 'https://mp.weixin.qq.com/s/seve1ckimSAn3sUq4zCuSg', null, 'full', '讨论油价敏感度、行业利润增速、资源品供需和商品作为长期资产的周期属性。'),
  source('article-key-point', '重点来了', 'https://mp.weixin.qq.com/s/fNOk8LKIqNzdlo8Bm7qTaA', '2026-08-21', 'preview', '公开试读部分强调行业周期、环境贝塔、动态应对和“价值”不是固定公式。'),
  source('article-dilemma', '陷入两难了', 'https://mp.weixin.qq.com/s/l7RodQzZ22LTFYtOuF30-g', null, 'full', '用订单、毛利、产业周期、股息、现金、现金流和资本开支讨论长期逆境与预期变化。'),
  source('article-dont-buy-blindly', '不要瞎买啊', 'https://mp.weixin.qq.com/s/JU50GS2WBgQ6K9gghcZTLQ', null, 'full', '强调事前建立判断，比较成本传导、长协比例、合同负债、扣非利润和经营现金流。'),
  source('article-no-crash', '不会暴跌吧', 'https://mp.weixin.qq.com/s/SLchGacNRKiLFzHKlUZKog', null, 'full', '用股息、运价先行指标、资本开支持续性和行业景气区分已有业绩与远期预期。'),
] as const

export const QUANT_KNOWLEDGE_FACTORS: readonly QuantKnowledgeFactor[] = [
  {
    id: 'relative-valuation',
    category: '估值',
    title: '好公司还要有好价格',
    interpretation: '公司质量和投资价值分开看，价格需要放回当前观察池比较。',
    measurement: '正值 TTM PE、PB、PS、PEG 采用池内百分位，低估值方向更有利。',
    requiredFields: ['peTtm', 'pb', 'ps', 'peg'],
    availableFields: ['peTtm', 'pb', 'ps', 'peg'],
    missingFields: [],
    status: 'active',
    eligibleInValueQuality: true,
    currentDimension: 'valuation',
    sourceIds: ['article-lie-flat', 'article-dont-buy-blindly', 'article-no-crash'],
  },
  {
    id: 'earnings-quality',
    category: '盈利质量',
    title: '利润要经得起现金流复核',
    interpretation: '净利润增长需要和扣非利润、经营现金流、ROE/ROIC 一起观察。',
    measurement: '高质量增长优先；净利润增长而现金流为负时增加风险提示。',
    requiredFields: ['netProfitYoY', 'adjustedNetProfitYoY', 'operatingCashflowToRevenue', 'roe', 'roic'],
    availableFields: ['netProfitYoY', 'adjustedNetProfitYoY', 'operatingCashflowToRevenue', 'roe', 'roic'],
    missingFields: [],
    status: 'active',
    eligibleInValueQuality: true,
    currentDimension: 'quality',
    sourceIds: ['article-pingan-20260825', 'article-dilemma', 'article-dont-buy-blindly'],
  },
  {
    id: 'growth-stability',
    category: '增长稳定性',
    title: '增长需要连续报告验证',
    interpretation: '单期高增长先当作线索，连续报告的方向、波动和扣非表现更重要。',
    measurement: '至少两期报告，结合营收同比、净利润同比和扣非净利润同比判断稳定性。',
    requiredFields: ['revenueYoY', 'netProfitYoY', 'adjustedNetProfitYoY', 'reportDate'],
    availableFields: ['revenueYoY', 'netProfitYoY', 'adjustedNetProfitYoY', 'reportDate'],
    missingFields: [],
    status: 'active',
    eligibleInValueQuality: true,
    currentDimension: 'growth',
    sourceIds: ['article-pingan-20260825', 'article-carry-on', 'article-dont-buy-blindly'],
  },
  {
    id: 'long-term-trend',
    category: '趋势与风险',
    title: '趋势是确认项，不是价值替代品',
    interpretation: '中长期价格结构帮助安排研究时点，但不应压过估值和经营质量。',
    measurement: '60 日表现、60 日均线偏离和回撤作为辅助证据，异常上涨或大回撤触发复核。',
    requiredFields: ['dailyBars', 'return60', 'ma60Gap', 'drawdown60'],
    availableFields: ['dailyBars', 'return60', 'ma60Gap', 'drawdown60'],
    missingFields: [],
    status: 'active',
    eligibleInValueQuality: true,
    currentDimension: 'trend',
    sourceIds: ['article-lie-flat', 'article-dilemma', 'article-key-point'],
  },
  {
    id: 'cashflow-capex-coverage',
    category: '资本开支',
    title: '现金流要覆盖再投资压力',
    interpretation: '成长和周期行业的投入强度需要与经营现金流、利息和债务一起看。',
    measurement: '经营现金流 - 资本开支 - 利息支出，结合负债规模观察安全边际。',
    requiredFields: ['operatingCashflow', 'capitalExpenditure', 'interestExpense', 'interestBearingDebt'],
    availableFields: ['operatingCashflowToRevenue', 'operatingCashflowPerShare', 'fcffBack', 'fcffForward', 'interestCoverage', 'interestBearingDebtRatio', 'cashRatio', 'totalLiability'],
    missingFields: ['operatingCashflow', 'capitalExpenditure', 'interestExpense', 'interestBearingDebt'],
    status: 'partial',
    eligibleInValueQuality: false,
    currentDimension: null,
    sourceIds: ['article-carry-on', 'article-dilemma', 'article-no-crash'],
  },
  {
    id: 'business-driver',
    category: '经营驱动',
    title: '订单、量价和毛利要互相印证',
    interpretation: '利润结果之外，订单、合同负债、销量、价格和毛利变化更接近经营过程。',
    measurement: '订单/合同负债趋势 + 收入量价拆分 + 分部毛利变化。',
    requiredFields: ['orderBacklog', 'contractLiabilities', 'segmentRevenue', 'segmentGrossMargin', 'volume', 'realizedPrice'],
    availableFields: ['revenueYoY', 'grossMargin'],
    missingFields: ['orderBacklog', 'contractLiabilities', 'segmentRevenue', 'segmentGrossMargin', 'volume', 'realizedPrice'],
    status: 'partial',
    eligibleInValueQuality: false,
    currentDimension: null,
    sourceIds: ['article-lie-flat', 'article-dilemma', 'article-dont-buy-blindly'],
  },
  {
    id: 'cycle-sensitivity',
    category: '周期与供需',
    title: '周期股要看价格传导和供需位置',
    interpretation: '油价、煤价、运价和金属价格变化会通过成本或收入传导到不同公司。',
    measurement: '商品价格情景 × 公司产销量/成本/长协比例 × 毛利和现金流敏感度。',
    requiredFields: ['commodityPrice', 'unitCost', 'output', 'realizedPrice', 'longTermContractRatio'],
    availableFields: [],
    missingFields: ['commodityPrice', 'unitCost', 'output', 'realizedPrice', 'longTermContractRatio'],
    status: 'planned',
    eligibleInValueQuality: false,
    currentDimension: null,
    sourceIds: ['article-carry-on', 'article-key-point', 'article-dont-buy-blindly', 'article-no-crash'],
  },
  {
    id: 'shareholder-return',
    category: '股东回报',
    title: '股息和回购要看可持续性',
    interpretation: '高股息只有在利润、现金流和负债支持下才有长期参考价值。',
    measurement: '股息率、分红支付率、自由现金流覆盖和回购/股本变化联合观察。',
    requiredFields: ['dividendYield', 'payoutRatio', 'freeCashflow', 'buybackAmount', 'sharesOutstandingChange'],
    availableFields: ['dividendYield'],
    missingFields: ['payoutRatio', 'freeCashflow', 'buybackAmount', 'sharesOutstandingChange'],
    status: 'partial',
    eligibleInValueQuality: false,
    currentDimension: null,
    sourceIds: ['article-pingan-20260825', 'article-lie-flat', 'article-dilemma', 'article-no-crash'],
  },
  {
    id: 'industry-beta',
    category: '行业环境',
    title: '区分电梯和俯卧撑',
    interpretation: '行业景气或资源红利带来的上涨，不等于公司管理能力已经被验证。',
    measurement: '公司利润增速 - 行业利润增速，并结合行业排名、指数表现和下行期韧性。',
    requiredFields: ['industry', 'industryProfitYoY', 'industryIndexReturn', 'companyProfitYoY'],
    availableFields: ['companyProfitYoY'],
    missingFields: ['industry', 'industryProfitYoY', 'industryIndexReturn'],
    status: 'planned',
    eligibleInValueQuality: false,
    currentDimension: null,
    sourceIds: ['article-key-point', 'article-carry-on', 'article-no-crash'],
  },
  {
    id: 'expectation-gap',
    category: '预期差',
    title: '已实现业绩与远期预期分开',
    interpretation: '市场可能提前交易更远期的资本开支、景气或反转预期，当前 PE 不是全部。',
    measurement: '实际业绩/业绩预告 vs 一致预期，并结合报告前后价格变化和前瞻估值。',
    requiredFields: ['consensusRevenue', 'consensusProfit', 'earningsSurprise', 'forwardPe', 'priceBeforeReport'],
    availableFields: ['peTtm', 'netProfitYoY', 'return60'],
    missingFields: ['consensusRevenue', 'consensusProfit', 'earningsSurprise', 'forwardPe', 'priceBeforeReport'],
    status: 'partial',
    eligibleInValueQuality: false,
    currentDimension: null,
    sourceIds: ['article-carry-on', 'article-dilemma', 'article-no-crash'],
  },
  {
    id: 'business-resilience',
    category: '逆境韧性',
    title: '先问公司能否熬过逆风期',
    interpretation: '长线持有需要现金、负债、利息和经营现金流共同支撑，而非只看景气高点。',
    measurement: '现金与债务、利息覆盖、经营现金流和利润波动的组合观察。',
    requiredFields: ['cash', 'interestBearingDebt', 'interestCoverage', 'operatingCashflow', 'profitVolatility'],
    availableFields: ['debtAssetRatio', 'operatingCashflowToRevenue', 'operatingCashflowPerShare', 'interestCoverage', 'interestBearingDebtRatio', 'cashRatio', 'totalLiability'],
    missingFields: ['cash', 'interestBearingDebt', 'interestCoverage', 'operatingCashflow', 'profitVolatility'],
    status: 'partial',
    eligibleInValueQuality: false,
    currentDimension: null,
    sourceIds: ['article-pingan-20260825', 'article-dilemma', 'article-dont-buy-blindly'],
  },
] as const

export const QUANT_KNOWLEDGE_ALIASES: readonly QuantKnowledgeAlias[] = [
  { alias: '变变', status: 'mapped', confidence: 'high', tsCode: '600089.SH', name: '特变电工', candidates: [], note: '文章中与电网、煤炭、煤化工和硅料业务描述一致。' },
  { alias: '便便', status: 'mapped', confidence: 'high', tsCode: '600089.SH', name: '特变电工', candidates: [], note: '与“变变”处于同一调仓和基本面语境。' },
  { alias: '海控', status: 'mapped', confidence: 'high', tsCode: '601919.SH', name: '中远海控', candidates: [], note: '文章明确写出“海控A”，并同时讨论 CCFI/SCFI。' },
  { alias: '海油', status: 'mapped', confidence: 'high', tsCode: '600938.SH', name: '中国海油', candidates: [], note: '文章同时使用“海油H”和“油油”，A 股工作台采用 600938.SH。' },
  { alias: '油油', status: 'mapped', confidence: 'high', tsCode: '600938.SH', name: '中国海油', candidates: [], note: '与原油价格、海油仓位和资源股语境一致。' },
  { alias: '海狗', status: 'ambiguous', confidence: 'medium', tsCode: null, name: null, candidates: ['600938.SH', '601919.SH'], note: '文章上下文同时出现海油和海控，暂保留人工确认。' },
  { alias: '赵姨', status: 'mapped', confidence: 'medium', tsCode: '603986.SH', name: '兆易创新', candidates: [], note: '与存储器、AI 资本开支和长鑫对比的语境相符。' },
  { alias: '平安', status: 'mapped', confidence: 'high', tsCode: '601318.SH', name: '中国平安', candidates: [], note: '文章标题与正文均明确指向中国平安。' },
  { alias: '平安银行', status: 'mapped', confidence: 'high', tsCode: '000001.SZ', name: '平安银行', candidates: [], note: '文章将其与中国平安并列讨论。' },
  { alias: '中石化', status: 'mapped', confidence: 'high', tsCode: '600028.SH', name: '中国石化', candidates: [], note: '文章正文明确写出中国石化。' },
  { alias: '中石油', status: 'mapped', confidence: 'high', tsCode: '601857.SH', name: '中国石油', candidates: [], note: '文章在三桶油比较中明确指向中国石油。' },
  { alias: '华能', status: 'mapped', confidence: 'high', tsCode: '600011.SH', name: '华能国际', candidates: [], note: '文章正文明确写出华能国际。' },
  { alias: '长江电力', status: 'mapped', confidence: 'high', tsCode: '600900.SH', name: '长江电力', candidates: [], note: '文章正文明确写出长江电力。' },
  { alias: '平高电气', status: 'mapped', confidence: 'high', tsCode: '600312.SH', name: '平高电气', candidates: [], note: '文章正文明确写出平高电气。' },
  { alias: '洛钼', status: 'mapped', confidence: 'high', tsCode: '603993.SH', name: '洛阳钼业', candidates: [], note: '文章正文明确写出洛钼，并与紫金比较。' },
  { alias: '阿里', status: 'context_only', confidence: 'high', tsCode: null, name: '阿里巴巴', candidates: ['9988.HK'], note: '港股主体，保留为远期跨市场知识样本。' },
  { alias: '泡泡玛特', status: 'context_only', confidence: 'high', tsCode: null, name: '泡泡玛特', candidates: ['9992.HK'], note: '港股主体，当前 A 股 provider 不纳入观察池。' },
  { alias: '中国宏桥', status: 'context_only', confidence: 'high', tsCode: null, name: '中国宏桥', candidates: ['01378.HK'], note: '港股主体，当前 A 股 provider 不纳入观察池。' },
  { alias: '长鑫', status: 'context_only', confidence: 'low', tsCode: null, name: '长鑫存储相关主体', candidates: [], note: '文章使用行业对比称呼，上市主体和代码需要后续确认。' },
] as const

export const QUANT_KNOWLEDGE_RECOMMENDED_WATCHLIST = [
  { tsCode: '601318.SH', name: '中国平安' },
  { tsCode: '000001.SZ', name: '平安银行' },
  { tsCode: '600028.SH', name: '中国石化' },
  { tsCode: '601857.SH', name: '中国石油' },
  { tsCode: '601919.SH', name: '中远海控' },
  { tsCode: '600011.SH', name: '华能国际' },
  { tsCode: '600900.SH', name: '长江电力' },
  { tsCode: '600312.SH', name: '平高电气' },
  { tsCode: '603993.SH', name: '洛阳钼业' },
  { tsCode: '603986.SH', name: '兆易创新' },
] as const

export function getQuantInvestmentKnowledge(observedAt = new Date()): QuantInvestmentKnowledge {
  return {
    version: QUANT_INVESTMENT_KNOWLEDGE_VERSION,
    observedAt: observedAt.toISOString(),
    sources: QUANT_KNOWLEDGE_SOURCES,
    factors: QUANT_KNOWLEDGE_FACTORS,
    aliases: QUANT_KNOWLEDGE_ALIASES,
    recommendedWatchlist: QUANT_KNOWLEDGE_RECOMMENDED_WATCHLIST,
  }
}
