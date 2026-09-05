export type QuantEvidenceRefreshDomain = 'daily' | 'valuation' | 'financial' | 'shareholder-returns'

export interface QuantEvidenceRefreshTarget {
  readonly domain: QuantEvidenceRefreshDomain
  readonly label: string
}

const REFRESH_TARGETS: readonly { prefix: string, target: QuantEvidenceRefreshTarget }[] = [
  { prefix: 'trend-', target: { domain: 'daily', label: '日线' } },
  { prefix: 'risk-', target: { domain: 'daily', label: '日线' } },
  { prefix: 'valuation-', target: { domain: 'valuation', label: '估值' } },
  { prefix: 'quality-', target: { domain: 'financial', label: '基本面' } },
  { prefix: 'shareholder-', target: { domain: 'shareholder-returns', label: '股东回报' } },
]

const EVIDENCE_LABELS: Readonly<Record<string, string>> = {
  'trend-sample': '日线样本',
  'trend-ma20': '收盘价 / MA20',
  'trend-return20': '20 日收益',
  'valuation-pe': 'TTM PE',
  'valuation-pb': 'PB',
  'valuation-ps': 'PS',
  'valuation-peg': 'PEG',
  'quality-revenue-growth': '营收同比',
  'quality-profit': '净利润同比',
  'quality-adjusted-profit': '扣非净利润同比',
  'quality-roe': 'ROE',
  'quality-gross-margin': '毛利率',
  'quality-net-margin': '净利率',
  'quality-cashflow': '经营现金流 / 营收',
  'quality-debt-asset': '资产负债率',
  'quality-history': '财报连续性',
  'shareholder-yield': '近 12 个月股息率',
  'shareholder-free-cashflow': '自由现金流',
  'shareholder-cashflow-coverage': '自由现金流分红覆盖',
  'shareholder-interest-expense': '利息支出',
  'shareholder-interest-bearing-debt': '有息负债',
  'shareholder-free-cashflow-after-interest': '利息后自由现金流',
  'shareholder-payout-ratio': '年度分红支付率',
  'shareholder-cashflow-history': '多期现金流覆盖',
  'shareholder-shares-outstanding-change': '相邻股本变化',
  'shareholder-repurchase-shares': '回购注销股数',
  'shareholder-repurchase-amount': '已实施回购金额',
  'akshare-bridge': 'AkShare bridge',
  'risk-volume': '成交量比',
  'risk-streak': '连续上涨天数',
}

export function quantEvidenceRefreshTargetForKey(key: string): QuantEvidenceRefreshTarget | null {
  const normalized = key.trim()
  return REFRESH_TARGETS.find(item => normalized.startsWith(item.prefix))?.target || null
}

export function quantEvidenceRefreshActionLabelForKey(key: string): string | null {
  const target = quantEvidenceRefreshTargetForKey(key)
  return target ? `刷新${target.label}并重算` : null
}

export function quantEvidenceLabelForKey(key: string): string {
  return EVIDENCE_LABELS[key] || key
}
