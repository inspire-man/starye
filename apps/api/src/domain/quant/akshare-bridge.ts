import type { QuantBusinessSegment, QuantCapitalStructureProvider, QuantCapitalStructureReport, QuantCashflowProvider, QuantCashflowReport, QuantDividendFetchResult, QuantDividendProvider, QuantDividendRecord, QuantFinancialQualityProvider, QuantFinancialQualitySnapshot, QuantInterestBearingDebtComponents, QuantInterestExpenseSourceField, QuantRepurchaseProvider, QuantRepurchaseReport } from './provider'
import type { QuantResearchEvidence, QuantResearchSource } from './research-report'
import { QuantError } from './errors'

export const QUANT_AKSHARE_BRIDGE_VERSION = 'quant-akshare-v1' as const

export type QuantAkshareBridgeStatus = 'ready' | 'partial' | 'unavailable' | 'invalid'
export type QuantAkshareBridgeErrorCode = 'CONFIGURATION' | 'TIMEOUT' | 'UNAUTHORIZED' | 'UPSTREAM' | 'INVALID_RESPONSE'

export interface QuantAkshareBridgeEvidence {
  readonly key: string
  readonly dimension: QuantResearchEvidence['dimension']
  readonly label: string
  readonly status: QuantResearchEvidence['status']
  readonly value: number | null
  readonly threshold: string
  readonly source: string
  readonly observedAt: string | null
  readonly formulaVersion: string
  readonly detail: string
}

export interface QuantAkshareProfitForecast {
  readonly tsCode: string
  readonly forecastYear: string
  readonly source: string | null
  readonly forecastEpsLow: number | null
  readonly forecastEpsAverage: number | null
  readonly forecastEpsHigh: number | null
  readonly analystCount: number | null
  readonly industryAverageEps: number | null
  readonly forecastNetProfit100mLow: number | null
  readonly forecastNetProfit100mAverage: number | null
  readonly forecastNetProfit100mHigh: number | null
}

export interface QuantAkshareBridgeResult {
  readonly schemaVersion: typeof QUANT_AKSHARE_BRIDGE_VERSION
  readonly provider: 'akshare'
  readonly requestId: string
  readonly tsCode: string
  readonly observedAt: string
  readonly status: QuantAkshareBridgeStatus
  readonly source: QuantResearchSource
  readonly identity: { readonly name?: string, readonly industry?: string }
  readonly dailyBars: readonly Record<string, unknown>[]
  readonly financials: readonly Record<string, unknown>[]
  /** Optional for responses produced by the pre-expansion v1 bridge. */
  readonly cashflows?: readonly Record<string, unknown>[]
  /** Optional for responses produced before the AkShare repurchase expansion. */
  readonly repurchases?: readonly Record<string, unknown>[]
  /** Optional for responses produced before the AkShare dividend expansion. */
  readonly dividends?: readonly Record<string, unknown>[]
  /** Optional for responses produced before the AkShare capital structure expansion. */
  readonly capitalStructures?: readonly Record<string, unknown>[]
  /** Optional for responses produced before the AkShare profit forecast expansion. */
  readonly profitForecasts?: readonly QuantAkshareProfitForecast[]
  /** Optional for responses produced before the business segment expansion. */
  readonly businessSegments?: readonly Record<string, unknown>[]
  readonly evidence: readonly QuantAkshareBridgeEvidence[]
  readonly errors: readonly { readonly code: string, readonly message: string, readonly source?: string | null }[]
}

export interface QuantAkshareBridgeOptions {
  readonly baseUrl?: string | null
  readonly token?: string | null
  readonly timeoutMs?: number
  readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

export interface QuantAkshareBridgeClient {
  readonly isConfigured: boolean
  readonly fetchEvidence: (input: { readonly tsCode: string, readonly startDate?: string, readonly endDate?: string, readonly includeFinancials?: boolean, readonly includeCapitalStructures?: boolean, readonly includeProfitForecasts?: boolean }) => Promise<QuantAkshareBridgeResult>
}

export class QuantAkshareBridgeError extends Error {
  readonly code: QuantAkshareBridgeErrorCode
  readonly status: number

  constructor(code: QuantAkshareBridgeErrorCode, message: string, status = 502) {
    super(message)
    this.name = 'QuantAkshareBridgeError'
    this.code = code
    this.status = status
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function bridgeStatus(value: unknown): QuantAkshareBridgeStatus | null {
  return value === 'ready' || value === 'partial' || value === 'unavailable' || value === 'invalid' ? value : null
}

function evidenceStatus(value: unknown): QuantResearchEvidence['status'] | null {
  return value === 'pass' || value === 'caution' || value === 'fail' || value === 'missing' ? value : null
}

function evidenceDimension(value: unknown): QuantResearchEvidence['dimension'] | null {
  return value === 'trend' || value === 'valuation' || value === 'quality' || value === 'shareholder-return' || value === 'risk' ? value : null
}

function normalizeEvidence(value: unknown): QuantAkshareBridgeEvidence | null {
  const record = asRecord(value)
  if (!record)
    return null
  const key = asString(record.key)
  const dimension = evidenceDimension(record.dimension)
  const label = asString(record.label)
  const status = evidenceStatus(record.status)
  const threshold = asString(record.threshold)
  const source = asString(record.source)
  const formulaVersion = asString(record.formula_version ?? record.formulaVersion)
  const detail = asString(record.detail)
  if (!key || !dimension || !label || !status || !threshold || !source || !formulaVersion || !detail)
    return null
  return {
    key,
    dimension,
    label,
    status,
    value: asNumber(record.value),
    threshold,
    source,
    observedAt: asString(record.observed_at ?? record.observedAt),
    formulaVersion,
    detail,
  }
}

function normalizeSource(value: unknown): QuantResearchSource | null {
  const record = asRecord(value)
  if (!record)
    return null
  const adapter = asString(record.adapter)
  const formulaVersion = asString(record.formula_version ?? record.formulaVersion)
  const endpoints = Array.isArray(record.endpoints) ? record.endpoints.filter((item): item is string => typeof item === 'string').slice(0, 10) : []
  if (!adapter || !formulaVersion)
    return null
  return {
    id: 'akshare-bridge',
    name: endpoints.length ? `AkShare bridge · ${adapter} · ${endpoints.join(', ')}` : `AkShare bridge · ${adapter}`,
    observedAt: null,
    formulaVersion,
  }
}

function normalizeRows(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => asRecord(item) !== null).slice(0, 250)
    : []
}

function normalizeBridgeBusinessSegments(result: QuantAkshareBridgeResult, records: readonly Record<string, unknown>[]): readonly QuantBusinessSegment[] {
  return records.slice(0, 64).flatMap((record) => {
    if (!bridgeReportCode(record, result.tsCode))
      throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare business segment code is missing or mismatched', 502)
    const reportDate = bridgeDate(record, 'report_date', 'reportDate', 'REPORT_DATE', '报告日期')
    const name = bridgeString(record, 'name', 'segment_name', 'segmentName', 'ITEM_NAME', '主营构成')
    if (!reportDate || !name)
      return []
    const rawCategory = bridgeString(record, 'category', 'segment_category', 'segmentCategory', 'MAINOP_TYPE', '分类类型')
    const category: QuantBusinessSegment['category'] = rawCategory === '1' || rawCategory === 'industry' || /行业/u.test(rawCategory ?? '')
      ? 'industry'
      : rawCategory === '2' || rawCategory === 'product' || /产品/u.test(rawCategory ?? '')
        ? 'product'
        : rawCategory === '3' || rawCategory === 'region' || /地区/u.test(rawCategory ?? '')
          ? 'region'
          : 'other'
    return [{
      tsCode: result.tsCode,
      reportDate,
      category,
      name,
      revenue: bridgeNumber(record, 'revenue', 'segment_revenue', 'segmentRevenue', 'MAIN_BUSINESS_INCOME', '主营收入'),
      revenueRatio: bridgeNumber(record, 'revenue_ratio', 'revenueRatio', 'MBI_RATIO', '收入比例'),
      grossMargin: bridgeNumber(record, 'gross_margin', 'grossMargin', 'GROSS_RPOFIT_RATIO', '毛利率'),
      cost: bridgeNumber(record, 'cost', 'segment_cost', 'segmentCost', 'MAIN_BUSINESS_COST', '主营成本'),
      costRatio: bridgeNumber(record, 'cost_ratio', 'costRatio', 'MBC_RATIO', '成本比例'),
      profit: bridgeNumber(record, 'profit', 'segment_profit', 'segmentProfit', 'MAIN_BUSINESS_RPOFIT', '主营利润'),
      profitRatio: bridgeNumber(record, 'profit_ratio', 'profitRatio', 'MBR_RATIO', '利润比例'),
    }]
  })
}

function normalizeProfitForecastRows(value: unknown, requestedTsCode: string): readonly QuantAkshareProfitForecast[] {
  if (value === undefined)
    return []
  if (!Array.isArray(value))
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare profit forecast rows are invalid', 502)
  const rawRows = value.slice(0, 12)
  const reports = rawRows.flatMap((item) => {
    const record = asRecord(item)
    if (!record || !bridgeReportCode(record, requestedTsCode))
      return []
    const forecastYear = bridgeString(record, 'forecast_year', 'forecastYear', '年度')
    if (!forecastYear || !/^20\d{2}$/u.test(forecastYear))
      return []
    const report = {
      tsCode: requestedTsCode,
      forecastYear,
      source: bridgeString(record, 'source'),
      forecastEpsLow: bridgeNumber(record, 'forecast_eps_low', 'forecastEpsLow'),
      forecastEpsAverage: bridgeNumber(record, 'forecast_eps_average', 'forecastEpsAverage'),
      forecastEpsHigh: bridgeNumber(record, 'forecast_eps_high', 'forecastEpsHigh'),
      analystCount: bridgeNumber(record, 'analyst_count', 'analystCount'),
      industryAverageEps: bridgeNumber(record, 'industry_average_eps', 'industryAverageEps'),
      forecastNetProfit100mLow: bridgeNumber(record, 'forecast_net_profit_100m_low', 'forecastNetProfit100mLow'),
      forecastNetProfit100mAverage: bridgeNumber(record, 'forecast_net_profit_100m_average', 'forecastNetProfit100mAverage'),
      forecastNetProfit100mHigh: bridgeNumber(record, 'forecast_net_profit_100m_high', 'forecastNetProfit100mHigh'),
    } satisfies QuantAkshareProfitForecast
    return report.forecastEpsLow !== null || report.forecastEpsAverage !== null || report.forecastEpsHigh !== null || report.forecastNetProfit100mLow !== null || report.forecastNetProfit100mAverage !== null || report.forecastNetProfit100mHigh !== null
      ? [report]
      : []
  })
  if (rawRows.length !== reports.length)
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare profit forecast rows are invalid', 502)
  return [...new Map(reports.map(report => [report.forecastYear, report] as const)).values()]
    .sort((left, right) => right.forecastYear.localeCompare(left.forecastYear))
}

function parseBridgeResponse(payload: unknown, requestedTsCode: string): QuantAkshareBridgeResult {
  const record = asRecord(payload)
  const schemaVersion = asString(record?.schema_version ?? record?.schemaVersion)
  const provider = asString(record?.provider)
  const requestId = asString(record?.request_id ?? record?.requestId)
  const tsCode = asString(record?.ts_code ?? record?.tsCode)
  const observedAt = asString(record?.observed_at ?? record?.observedAt)
  const status = bridgeStatus(record?.status)
  const source = normalizeSource(record?.source)
  if (schemaVersion !== QUANT_AKSHARE_BRIDGE_VERSION || provider !== 'akshare' || !requestId || tsCode !== requestedTsCode || !observedAt || !status || !source)
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare bridge contract is invalid', 502)

  const rawEvidence = Array.isArray(record?.evidence) ? record.evidence : []
  const evidence = rawEvidence.slice(0, 32).map(normalizeEvidence).filter((item): item is QuantAkshareBridgeEvidence => item !== null)
  if (rawEvidence.length !== evidence.length)
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare bridge evidence is invalid', 502)
  const errors = Array.isArray(record?.errors)
    ? record.errors.slice(0, 16).flatMap((item) => {
        const error = asRecord(item)
        const code = asString(error?.code)
        const message = asString(error?.message)
        return code && message ? [{ code, message, source: asString(error?.source) }] : []
      })
    : []
  const identityRecord = asRecord(record?.identity)
  const name = asString(identityRecord?.name)
  const industry = asString(identityRecord?.industry)
  return {
    schemaVersion: QUANT_AKSHARE_BRIDGE_VERSION,
    provider: 'akshare',
    requestId,
    tsCode,
    observedAt,
    status,
    source: { ...source, observedAt },
    identity: name || industry ? { ...(name ? { name } : {}), ...(industry ? { industry } : {}) } : {},
    dailyBars: normalizeRows(record?.daily_bars ?? record?.dailyBars),
    financials: normalizeRows(record?.financials),
    cashflows: normalizeRows(record?.cashflows),
    repurchases: normalizeRows(record?.repurchases),
    dividends: normalizeRows(record?.dividends),
    capitalStructures: normalizeRows(record?.capital_structures ?? record?.capitalStructures),
    profitForecasts: normalizeProfitForecastRows(record?.profit_forecasts ?? record?.profitForecasts, tsCode),
    businessSegments: record?.business_segments === undefined && record?.businessSegments === undefined
      ? undefined
      : normalizeRows(record?.business_segments ?? record?.businessSegments),
    evidence,
    errors,
  }
}

function normalizedBaseUrl(value: string | null | undefined): string | null {
  const input = value?.trim() || ''
  if (!input)
    return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return null
    return url.toString().replace(/\/+$/u, '')
  }
  catch {
    return null
  }
}

export function createQuantAkshareBridge(options: QuantAkshareBridgeOptions = {}): QuantAkshareBridgeClient {
  const baseUrl = normalizedBaseUrl(options.baseUrl)
  const token = options.token?.trim() || null
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0 ? Math.min(options.timeoutMs!, 30_000) : 12_000
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  async function fetchEvidence(input: { readonly tsCode: string, readonly startDate?: string, readonly endDate?: string, readonly includeFinancials?: boolean, readonly includeCapitalStructures?: boolean, readonly includeProfitForecasts?: boolean }): Promise<QuantAkshareBridgeResult> {
    if (!baseUrl || !token)
      throw new QuantAkshareBridgeError('CONFIGURATION', 'AkShare bridge is not configured', 503)
    const tsCode = input.tsCode.trim().toUpperCase()
    const url = new URL('/v1/evidence', baseUrl)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ ts_code: tsCode, start_date: input.startDate, end_date: input.endDate, include_financials: input.includeFinancials ?? true, include_capital_structures: input.includeCapitalStructures ?? true, include_profit_forecasts: input.includeProfitForecasts ?? true }),
        signal: controller.signal,
      })
    }
    catch {
      if (controller.signal.aborted)
        throw new QuantAkshareBridgeError('TIMEOUT', 'AkShare bridge request timed out', 504)
      throw new QuantAkshareBridgeError('UPSTREAM', 'AkShare bridge request failed', 502)
    }
    finally {
      clearTimeout(timer)
    }

    if (response.status === 401 || response.status === 403)
      throw new QuantAkshareBridgeError('UNAUTHORIZED', 'AkShare bridge rejected the configured token', 502)
    if (!response.ok)
      throw new QuantAkshareBridgeError(response.status === 408 || response.status === 504 ? 'TIMEOUT' : 'UPSTREAM', `AkShare bridge HTTP ${response.status}`, response.status === 408 || response.status === 504 ? 504 : 502)

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare bridge response is not JSON', 502)
    }
    return parseBridgeResponse(payload, tsCode)
  }

  return { isConfigured: Boolean(baseUrl && token), fetchEvidence }
}

function bridgeString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key])
    if (value)
      return value
  }
  return null
}

function bridgeNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (value === null || value === undefined || value === '')
      continue
    const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
    if (Number.isFinite(numeric))
      return numeric
  }
  return null
}

function bridgeDate(record: Record<string, unknown>, ...keys: string[]): string | null {
  const value = bridgeString(record, ...keys)
  if (!value)
    return null
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/u.exec(value)
  if (!match)
    return null
  const normalized = `${match[1]}-${match[2]}-${match[3]}`
  const date = new Date(`${normalized}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized ? null : normalized
}

function reportTypeForDate(reportDate: string): { readonly reportType: string, readonly reportDateName: string } {
  const monthDay = reportDate.slice(5)
  const reportType = monthDay === '03-31' ? '一季报' : monthDay === '06-30' ? '中报' : monthDay === '09-30' ? '三季报' : monthDay === '12-31' ? '年报' : '定期报告'
  return { reportType, reportDateName: `${reportDate.slice(0, 4)}${reportType}` }
}

function financialIndustry(value: string | null): QuantFinancialQualitySnapshot['industry'] {
  if (!value)
    return undefined
  if (/保险/u.test(value))
    return 'insurance'
  if (/银行/u.test(value))
    return 'bank'
  if (/证券|券商/u.test(value))
    return 'securities'
  if (/通用|一般/u.test(value))
    return 'general'
  return 'other'
}

function bridgeReportCode(record: Record<string, unknown>, tsCode: string): boolean {
  const returnedCode = bridgeString(record, 'ts_code', 'tsCode', 'SECURITY_CODE', 'security_code')
  return !returnedCode || returnedCode.trim().toUpperCase().split('.')[0] === tsCode.split('.')[0]
}

function normalizeBridgeFinancialReport(result: QuantAkshareBridgeResult, record: Record<string, unknown>): QuantFinancialQualitySnapshot | null {
  if (!bridgeReportCode(record, result.tsCode))
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare financial report code is missing or mismatched', 502)
  const reportDate = bridgeDate(record, 'report_date', 'reportDate', 'REPORT_DATE', 'date')
  if (!reportDate)
    return null
  const industry = financialIndustry(bridgeString(record, 'industry', '行业', 'ORG_TYPE') ?? result.identity.industry ?? null)
  const businessSegments = result.businessSegments === undefined
    ? undefined
    : normalizeBridgeBusinessSegments(result, result.businessSegments).filter(segment => segment.reportDate === reportDate)
  const businessSegmentErrorCode = result.errors.find(error => error.code.startsWith('AKSHARE_SEGMENT_'))?.code ?? null
  const businessSegmentSource = result.businessSegments !== undefined && result.source.name.includes('stock_zygc_em')
    ? 'stock_zygc_em'
    : null
  const accountsReceivable = bridgeNumber(record, 'accounts_receivable', 'accountsReceivable', 'ACCOUNTS_RECE', '应收账款')
  const inventory = bridgeNumber(record, 'inventory', 'INVENTORY', '存货')
  const contractLiabilities = bridgeNumber(record, 'contract_liabilities', 'contractLiabilities', 'CONTRACT_LIAB', '合同负债')
  const workingCapitalComplete = [accountsReceivable, inventory, contractLiabilities].every(value => value !== null)
  const workingCapitalErrorCode = workingCapitalComplete
    ? null
    : result.errors.find((error) => {
      if (error.code === 'AKSHARE_WORKING_CAPITAL_FIELDS_UNAVAILABLE')
        return true
      return /^[A-Z][A-Z0-9_-]{0,95}$/u.test(error.code)
        && /AKSHARE_FINANCIAL_ENDPOINT_(?:FAILED|UNAVAILABLE)/u.test(error.code)
        && /balance|financial_report_sina/iu.test(error.source ?? '')
    })?.code ?? null
  return {
    tsCode: result.tsCode,
    observedAt: result.observedAt,
    reportDate,
    reportType: bridgeString(record, 'report_type', 'reportType') ?? reportTypeForDate(reportDate).reportType,
    reportDateName: bridgeString(record, 'report_date_name', 'reportDateName') ?? reportTypeForDate(reportDate).reportDateName,
    noticeDate: bridgeDate(record, 'notice_date', 'noticeDate', '公告日期'),
    revenue: bridgeNumber(record, 'revenue', '营业总收入', '营业收入'),
    revenueYoY: bridgeNumber(record, 'revenue_yoy', 'revenueYoY', '营业总收入同比增长率(%)'),
    netProfit: bridgeNumber(record, 'net_profit', 'netProfit', '净利润', '归母净利润'),
    netProfitYoY: bridgeNumber(record, 'net_profit_yoy', 'netProfitYoY', '净利润同比增长率(%)'),
    adjustedNetProfit: bridgeNumber(record, 'adjusted_net_profit', 'adjustedNetProfit', '扣非净利润'),
    adjustedNetProfitYoY: bridgeNumber(record, 'adjusted_net_profit_yoy', 'adjustedNetProfitYoY', '扣非净利润同比增长率(%)'),
    roe: bridgeNumber(record, 'roe', 'ROE', '净资产收益率(%)'),
    grossMargin: bridgeNumber(record, 'gross_margin', 'grossMargin', '销售毛利率(%)', '毛利率'),
    netMargin: bridgeNumber(record, 'net_margin', 'netMargin', '销售净利率(%)', '净利率'),
    debtAssetRatio: bridgeNumber(record, 'debt_asset_ratio', 'debtAssetRatio', '资产负债率(%)', '资产负债率'),
    operatingCashflowToRevenue: bridgeNumber(record, 'operating_cashflow_to_revenue', 'operatingCashflowToRevenue', 'ocf_to_or'),
    operatingCashflowPerShare: bridgeNumber(record, 'operating_cashflow_per_share', 'operatingCashflowPerShare', 'ocfps'),
    fcffBack: bridgeNumber(record, 'fcff_back', 'fcffBack', 'fcff'),
    fcffForward: bridgeNumber(record, 'fcff_forward', 'fcffForward'),
    interestCoverage: bridgeNumber(record, 'interest_coverage', 'interestCoverage'),
    interestBearingDebtRatio: bridgeNumber(record, 'interest_bearing_debt_ratio', 'interestBearingDebtRatio'),
    cashRatio: bridgeNumber(record, 'cash_ratio', 'cashRatio'),
    totalLiability: bridgeNumber(record, 'total_liability', 'totalLiability'),
    roic: bridgeNumber(record, 'roic', 'ROIC'),
    accountsReceivable,
    inventory,
    contractLiabilities,
    ...(workingCapitalErrorCode ? { workingCapitalErrorCode } : {}),
    ...(businessSegments !== undefined ? { businessSegments } : {}),
    ...(businessSegments?.length ? {} : businessSegmentErrorCode ? { businessSegmentErrorCode } : {}),
    ...(businessSegmentSource ? { businessSegmentSource } : {}),
    provider: 'akshare',
    ...(industry ? { industry } : {}),
  }
}

function bridgeDebtComponents(record: Record<string, unknown>): QuantInterestBearingDebtComponents {
  const nested = asRecord(record.interest_bearing_debt_components ?? record.interestBearingDebtComponents)
  const number = (...keys: string[]): number | null => bridgeNumber(record, ...keys) ?? bridgeNumber(nested ?? {}, ...keys)
  return {
    shortLoan: number('short_loan', 'shortLoan', 'SHORT_LOAN'),
    shortBondPayable: number('short_bond_payable', 'shortBondPayable', 'SHORT_BOND_PAYABLE'),
    shortFinancePayable: number('short_finance_payable', 'shortFinancePayable', 'SHORT_FIN_PAYABLE'),
    acceptDepositInterbank: number('accept_deposit_interbank', 'acceptDepositInterbank', 'ACCEPT_DEPOSIT_INTERBANK'),
    borrowFund: number('borrow_fund', 'borrowFund', 'BORROW_FUND'),
    loanPbc: number('loan_pbc', 'loanPbc', 'LOAN_PBC'),
    currentMaturityDebt: number('current_maturity_debt', 'currentMaturityDebt', 'NONCURRENT_LIAB_1YEAR'),
    amortizedCostFinancialLiability: number('amortized_cost_financial_liability', 'amortizedCostFinancialLiability', 'AMORTIZE_COST_FINLIAB'),
    longLoan: number('long_loan', 'longLoan', 'LONG_LOAN'),
    amortizedCostNoncurrentFinancialLiability: number('amortized_cost_noncurrent_financial_liability', 'amortizedCostNoncurrentFinancialLiability', 'AMORTIZE_COST_NCFINLIAB'),
    bondPayable: number('bond_payable', 'bondPayable', 'BOND_PAYABLE'),
    perpetualBond: number('perpetual_bond', 'perpetualBond', 'PERPETUAL_BOND'),
    perpetualBondPayable: number('perpetual_bond_payable', 'perpetualBondPayable', 'PERPETUAL_BOND_PAYBALE'),
    leaseLiability: number('lease_liability', 'leaseLiability', 'LEASE_LIAB'),
  }
}

function bridgeDebtTotal(record: Record<string, unknown>, components: QuantInterestBearingDebtComponents): number | null {
  const explicit = bridgeNumber(record, 'interest_bearing_debt', 'interestBearingDebt')
  if (explicit !== null)
    return explicit
  const values = Object.values(components).filter((value): value is number => value !== null)
  return values.length ? values.reduce((total, value) => total + value, 0) : null
}

function bridgeInterestExpense(record: Record<string, unknown>): { readonly value: number | null, readonly sourceField: QuantInterestExpenseSourceField | null } {
  const declaredSource = bridgeString(record, 'interest_expense_source_field', 'interestExpenseSourceField')
  const financeExpenseInterest = bridgeNumber(record, 'FE_INTEREST_EXPENSE', '利息支出', '利息费用')
  const incomeStatementInterest = bridgeNumber(record, 'INTEREST_EXPENSE', 'interestExpense')
  const genericInterest = bridgeNumber(record, 'interest_expense', 'interestExpense')
  if (declaredSource === 'FE_INTEREST_EXPENSE' && (financeExpenseInterest ?? genericInterest) !== null)
    return { value: financeExpenseInterest ?? genericInterest, sourceField: declaredSource }
  if (declaredSource === 'INTEREST_EXPENSE' && (incomeStatementInterest ?? genericInterest) !== null)
    return { value: incomeStatementInterest ?? genericInterest, sourceField: declaredSource }
  if (financeExpenseInterest !== null)
    return { value: financeExpenseInterest, sourceField: 'FE_INTEREST_EXPENSE' }
  if (incomeStatementInterest !== null)
    return { value: incomeStatementInterest, sourceField: 'INTEREST_EXPENSE' }
  return { value: genericInterest, sourceField: genericInterest !== null ? 'INTEREST_EXPENSE' : null }
}

function normalizeBridgeCashflowReport(result: QuantAkshareBridgeResult, record: Record<string, unknown>): QuantCashflowReport | null {
  if (!bridgeReportCode(record, result.tsCode))
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare cashflow report code is missing or mismatched', 502)
  const reportDate = bridgeDate(record, 'report_date', 'reportDate', 'REPORT_DATE', '日期')
  if (!reportDate)
    return null
  const reportType = reportTypeForDate(reportDate)
  const interestExpense = bridgeInterestExpense(record)
  const interestBearingDebtComponents = bridgeDebtComponents(record)
  return {
    tsCode: result.tsCode,
    reportDate,
    reportType: bridgeString(record, 'report_type', 'reportType') ?? reportType.reportType,
    reportDateName: bridgeString(record, 'report_date_name', 'reportDateName') ?? reportType.reportDateName,
    noticeDate: bridgeDate(record, 'notice_date', 'noticeDate', '公告日期'),
    operatingCashflow: bridgeNumber(record, 'operating_cashflow', 'operatingCashflow', 'n_cashflow_act'),
    capitalExpenditure: bridgeNumber(record, 'capital_expenditure', 'capitalExpenditure', 'c_pay_acq_const_fiolta'),
    netProfit: bridgeNumber(record, 'net_profit', 'netProfit', '净利润'),
    cashDividendsPaid: bridgeNumber(record, 'cash_dividends_paid', 'cashDividendsPaid', 'ASSIGN_DIVIDEND_PORFIT', '分配股利、利润或偿付利息支付的现金'),
    interestExpense: interestExpense.value,
    interestExpenseSourceField: interestExpense.sourceField,
    interestExpenseProviderErrorCode: null,
    interestBearingDebt: bridgeDebtTotal(record, interestBearingDebtComponents),
    interestBearingDebtComponents,
    interestBearingDebtProviderErrorCode: null,
    provider: 'akshare',
  }
}

function normalizeBridgeRepurchaseReport(result: QuantAkshareBridgeResult, record: Record<string, unknown>): QuantRepurchaseReport | null {
  const returnedCode = bridgeString(record, 'ts_code', 'tsCode', 'SECURITY_CODE', 'security_code')
  if (!returnedCode || returnedCode.trim().toUpperCase().split('.')[0] !== result.tsCode.split('.')[0])
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare repurchase report code is missing or mismatched', 502)
  const hasUsableField = [
    ['announcement_date', 'announcementDate'],
    ['start_date', 'startDate'],
    ['end_date', 'endDate'],
    ['finish_date', 'finishDate'],
    ['progress'],
    ['planned_amount_lower', 'plannedAmountLower'],
    ['planned_amount_upper', 'plannedAmountUpper'],
    ['repurchase_amount', 'repurchaseAmount'],
    ['repurchase_shares', 'repurchaseShares'],
  ].some(keys => keys.some(key => record[key] !== null && record[key] !== undefined && record[key] !== ''))
  if (!hasUsableField)
    return null
  return {
    tsCode: result.tsCode,
    repurchaseCode: bridgeString(record, 'repurchase_code', 'repurchaseCode'),
    announcementDate: bridgeDate(record, 'announcement_date', 'announcementDate'),
    startDate: bridgeDate(record, 'start_date', 'startDate'),
    endDate: bridgeDate(record, 'end_date', 'endDate'),
    finishDate: bridgeDate(record, 'finish_date', 'finishDate'),
    progress: bridgeString(record, 'progress'),
    plannedAmountLower: bridgeNumber(record, 'planned_amount_lower', 'plannedAmountLower'),
    plannedAmountUpper: bridgeNumber(record, 'planned_amount_upper', 'plannedAmountUpper'),
    repurchaseAmount: bridgeNumber(record, 'repurchase_amount', 'repurchaseAmount'),
    repurchaseShares: bridgeNumber(record, 'repurchase_shares', 'repurchaseShares'),
    provider: 'akshare',
  }
}

function normalizeBridgeCapitalStructureReport(result: QuantAkshareBridgeResult, record: Record<string, unknown>): QuantCapitalStructureReport | null {
  if (!bridgeReportCode(record, result.tsCode))
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare capital structure code is missing or mismatched', 502)
  const reportDate = bridgeDate(record, 'report_date', 'reportDate', 'REPORT_DATE', '变动日期')
  if (!reportDate)
    return null
  return {
    tsCode: result.tsCode,
    reportDate,
    totalShares: bridgeNumber(record, 'total_shares', 'totalShares', 'TOTAL_SHARES', '总股本'),
    changeReason: bridgeString(record, 'change_reason', 'changeReason', 'CHANGE_REASON', '变动原因'),
    provider: 'akshare',
  }
}

function normalizeBridgeDividendReport(result: QuantAkshareBridgeResult, record: Record<string, unknown>): QuantDividendRecord | null {
  const returnedCode = bridgeString(record, 'ts_code', 'tsCode', 'SECURITY_CODE', 'security_code')
  if (!returnedCode || returnedCode.trim().toUpperCase().split('.')[0] !== result.tsCode.split('.')[0])
    throw new QuantAkshareBridgeError('INVALID_RESPONSE', 'AkShare dividend report code is missing or mismatched', 502)
  const announcementDate = bridgeDate(record, 'ann_date', 'annDate', 'announcement_date', 'announcementDate')
  const exDate = bridgeDate(record, 'ex_date', 'exDate')
  const payDate = bridgeDate(record, 'pay_date', 'payDate')
  const endDate = bridgeDate(record, 'end_date', 'endDate') ?? announcementDate ?? exDate ?? payDate
  const divProc = bridgeString(record, 'div_proc', 'divProc', 'progress')
  const cashDiv = bridgeNumber(record, 'cash_div', 'cashDiv')
  if (!endDate || (!divProc && cashDiv === null && !announcementDate && !exDate && !payDate))
    return null
  return {
    tsCode: result.tsCode,
    endDate,
    annDate: announcementDate,
    divProc,
    cashDiv,
    exDate,
    payDate,
  }
}

function bridgeLimit(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) ? Math.min(8, Math.max(1, value!)) : fallback
}

function repurchaseLimit(value: number | undefined): number {
  return Number.isInteger(value) ? Math.min(20, Math.max(1, value!)) : 12
}

function bridgeDataUnavailable(kind: string): QuantAkshareBridgeError {
  return new QuantAkshareBridgeError('UPSTREAM', `AkShare ${kind} data is unavailable`, 502)
}

export function createQuantAkshareFinancialProvider(bridge: QuantAkshareBridgeClient): QuantFinancialQualityProvider {
  async function fetchFinancialQualityHistory(request: { readonly tsCode: string, readonly limit?: number }): Promise<readonly QuantFinancialQualitySnapshot[]> {
    if (!bridge.isConfigured)
      throw new QuantAkshareBridgeError('CONFIGURATION', 'AkShare bridge is not configured', 503)
    const result = await bridge.fetchEvidence({ tsCode: request.tsCode, includeProfitForecasts: false })
    const reports = result.financials
      .map(record => normalizeBridgeFinancialReport(result, record))
      .filter((report): report is QuantFinancialQualitySnapshot => report !== null)
    if (!reports.length)
      throw bridgeDataUnavailable('financial')
    return [...new Map(reports.map(report => [report.reportDate, report] as const)).values()]
      .sort((left, right) => right.reportDate.localeCompare(left.reportDate))
      .slice(0, bridgeLimit(request.limit, 4))
  }

  async function fetchFinancialQuality(request: { readonly tsCode: string }): Promise<QuantFinancialQualitySnapshot> {
    const report = (await fetchFinancialQualityHistory({ ...request, limit: 1 }))[0]
    if (!report)
      throw bridgeDataUnavailable('financial')
    return report
  }

  return {
    name: 'akshare',
    isConfigured: bridge.isConfigured,
    supportsBusinessSegments: true,
    fetchFinancialQuality,
    fetchFinancialQualityHistory,
  }
}

export function createQuantAkshareCashflowProvider(bridge: QuantAkshareBridgeClient): QuantCashflowProvider {
  async function fetchCashflowHistory(request: { readonly tsCode: string, readonly limit?: number }): Promise<readonly QuantCashflowReport[]> {
    if (!bridge.isConfigured)
      throw new QuantAkshareBridgeError('CONFIGURATION', 'AkShare bridge is not configured', 503)
    const result = await bridge.fetchEvidence({ tsCode: request.tsCode, includeProfitForecasts: false })
    const reports = (result.cashflows ?? [])
      .map(record => normalizeBridgeCashflowReport(result, record))
      .filter((report): report is QuantCashflowReport => report !== null)
    if (!reports.length)
      throw bridgeDataUnavailable('cashflow')
    return [...new Map(reports.map(report => [report.reportDate, report] as const)).values()]
      .sort((left, right) => right.reportDate.localeCompare(left.reportDate))
      .slice(0, bridgeLimit(request.limit, 8))
  }

  return {
    name: 'akshare',
    isConfigured: bridge.isConfigured,
    fetchCashflowHistory,
  }
}

export function createQuantAkshareRepurchaseProvider(bridge: QuantAkshareBridgeClient): QuantRepurchaseProvider {
  async function fetchRepurchaseHistory(request: { readonly tsCode: string, readonly limit?: number }): Promise<readonly QuantRepurchaseReport[]> {
    if (!bridge.isConfigured)
      throw new QuantAkshareBridgeError('CONFIGURATION', 'AkShare bridge is not configured', 503)
    const result = await bridge.fetchEvidence({ tsCode: request.tsCode, includeFinancials: false, includeCapitalStructures: false, includeProfitForecasts: false })
    const reports = (result.repurchases ?? [])
      .map(record => normalizeBridgeRepurchaseReport(result, record))
      .filter((report): report is QuantRepurchaseReport => report !== null)
    const repurchaseErrors = result.errors.filter(error => error.code.startsWith('AKSHARE_REPURCHASE_'))
    if (!reports.length && repurchaseErrors.length)
      throw bridgeDataUnavailable('repurchase')
    return [...new Map(reports.map(report => [
      report.repurchaseCode ?? `${report.announcementDate ?? ''}:${report.startDate ?? ''}:${report.plannedAmountLower ?? ''}:${report.plannedAmountUpper ?? ''}`,
      report,
    ])).values()]
      .sort((left, right) => `${right.announcementDate ?? ''}:${right.startDate ?? ''}`.localeCompare(`${left.announcementDate ?? ''}:${left.startDate ?? ''}`))
      .slice(0, repurchaseLimit(request.limit))
  }

  return {
    name: 'akshare',
    isConfigured: bridge.isConfigured,
    fetchRepurchaseHistory,
  }
}

export function createQuantAkshareCapitalStructureProvider(bridge: QuantAkshareBridgeClient): QuantCapitalStructureProvider {
  async function fetchCapitalStructureHistory(request: { readonly tsCode: string, readonly limit?: number }): Promise<readonly QuantCapitalStructureReport[]> {
    if (!bridge.isConfigured)
      throw new QuantAkshareBridgeError('CONFIGURATION', 'AkShare bridge is not configured', 503)
    const result = await bridge.fetchEvidence({ tsCode: request.tsCode, includeFinancials: false, includeCapitalStructures: true, includeProfitForecasts: false })
    const reports = (result.capitalStructures ?? [])
      .map(record => normalizeBridgeCapitalStructureReport(result, record))
      .filter((report): report is QuantCapitalStructureReport => report !== null)
    const capitalErrors = result.errors.filter(error => error.code.startsWith('AKSHARE_CAPITAL_'))
    if (!reports.length && capitalErrors.length)
      throw bridgeDataUnavailable('capital structure')
    const limit = Number.isInteger(request.limit) ? Math.min(20, Math.max(1, request.limit!)) : 12
    return [...new Map(reports.map(report => [`${report.reportDate}:${report.totalShares ?? ''}:${report.changeReason ?? ''}`, report] as const)).values()]
      .sort((left, right) => right.reportDate.localeCompare(left.reportDate))
      .slice(0, limit)
  }

  return {
    name: 'akshare',
    isConfigured: bridge.isConfigured,
    fetchCapitalStructureHistory,
  }
}

export function createQuantAkshareDividendProvider(bridge: QuantAkshareBridgeClient): QuantDividendProvider {
  async function fetchDividends(request: { readonly tsCode: string }): Promise<QuantDividendFetchResult> {
    if (!bridge.isConfigured)
      throw new QuantAkshareBridgeError('CONFIGURATION', 'AkShare bridge is not configured', 503)
    const result = await bridge.fetchEvidence({ tsCode: request.tsCode, includeFinancials: false, includeCapitalStructures: false, includeProfitForecasts: false })
    const reports = (result.dividends ?? [])
      .map(record => normalizeBridgeDividendReport(result, record))
      .filter((report): report is QuantDividendRecord => report !== null)
    const dividendErrors = result.errors.filter(error => error.code.startsWith('AKSHARE_DIVIDEND_'))
    if (!reports.length && dividendErrors.length)
      throw bridgeDataUnavailable('dividend')
    return {
      records: [...new Map(reports.map(report => [
        `${report.endDate}:${report.annDate ?? ''}:${report.divProc ?? ''}:${report.exDate ?? ''}:${report.payDate ?? ''}`,
        report,
      ])).values()]
        .sort((left, right) => `${right.payDate ?? right.exDate ?? right.annDate ?? right.endDate}`.localeCompare(`${left.payDate ?? left.exDate ?? left.annDate ?? left.endDate}`))
        .slice(0, 60),
      provider: 'akshare',
      fallbackUsed: false,
      fallbackReason: null,
    }
  }

  return {
    name: 'akshare',
    isConfigured: bridge.isConfigured,
    providerChain: ['akshare'],
    fetchDividends,
  }
}

export function mapQuantAkshareBridgeError(error: unknown): QuantError {
  if (error instanceof QuantAkshareBridgeError) {
    if (error.code === 'CONFIGURATION')
      return new QuantError('QUANT_PROVIDER_CONFIGURATION', error.message, 503)
    if (error.code === 'TIMEOUT')
      return new QuantError('QUANT_PROVIDER_TIMEOUT', error.message, 504)
    if (error.code === 'INVALID_RESPONSE')
      return new QuantError('QUANT_PROVIDER_INVALID_RESPONSE', error.message, 502)
  }
  return new QuantError('QUANT_PROVIDER_UPSTREAM', 'AkShare bridge request failed', 502)
}
