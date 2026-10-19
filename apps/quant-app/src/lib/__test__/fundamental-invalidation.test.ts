import { describe, expect, it } from 'vitest'
import { buildFundamentalInvalidationChecks, buildShareholderInvalidationChecks } from '../fundamental-invalidation'

const ready = {
  valuation: { peTtm: 12, pb: 1.4, ps: 2, peg: 0.8 },
  valuationState: 'ready' as const,
  financial: {
    industry: 'general' as const,
    revenueYoY: 8,
    netProfitYoY: 6,
    adjustedNetProfitYoY: 5,
    roe: 12,
    grossMargin: 30,
    netMargin: 10,
    operatingCashflowToRevenue: 8,
    debtAssetRatio: 40,
  },
  financialCount: 2,
  financialState: 'ready' as const,
}

describe('buildFundamentalInvalidationChecks', () => {
  it('reports quality evidence that weakened or recovered and hides unchanged rows', () => {
    const checks = buildFundamentalInvalidationChecks({
      ...ready,
      financial: { ...ready.financial, revenueYoY: -12, roe: 12, debtAssetRatio: 70 },
      evidence: [
        { key: 'quality-revenue-growth', label: '营收同比', status: 'pass' },
        { key: 'quality-roe', label: 'ROE', status: 'caution' },
        { key: 'quality-debt-asset', label: '资产负债率', status: 'pass' },
        { key: 'valuation-pe', label: 'TTM PE', status: 'pass' },
        { key: 'trend-ma20', label: '收盘价 / MA20', status: 'fail' },
      ],
    })

    expect(checks).toEqual([
      { key: 'quality-revenue-growth', label: '营收同比', savedStatus: 'pass', currentStatus: 'fail', change: 'triggered' },
      { key: 'quality-roe', label: 'ROE', savedStatus: 'caution', currentStatus: 'pass', change: 'recovered' },
      { key: 'quality-debt-asset', label: '资产负债率', savedStatus: 'pass', currentStatus: 'caution', change: 'triggered' },
    ])
  })

  it('does not judge a source that is still loading, and keeps a failed read unavailable', () => {
    const evidence = [{ key: 'valuation-pe', label: 'TTM PE', status: 'pass' as const }]
    expect(buildFundamentalInvalidationChecks({
      ...ready,
      valuationState: 'pending',
      evidence,
    })).toEqual([])
    expect(buildFundamentalInvalidationChecks({
      ...ready,
      valuation: null,
      valuationState: 'failed',
      evidence,
    })).toEqual([
      { key: 'valuation-pe', label: 'TTM PE', savedStatus: 'pass', currentStatus: 'missing', change: 'unavailable' },
    ])
  })

  it('does not treat an industry metric that the current report does not produce as a change', () => {
    expect(buildFundamentalInvalidationChecks({
      ...ready,
      evidence: [{ key: 'quality-insurance-solvency', label: '偿付能力充足率', status: 'pass' }],
    })).toEqual([])
  })
})

describe('buildShareholderInvalidationChecks', () => {
  it('reports cashflow and payout evidence that weakened and hides a still-positive dividend yield', () => {
    const checks = buildShareholderInvalidationChecks({
      shareholderState: 'ready',
      shareholder: {
        trailingDividendYield: 2.4,
        cashflowEvidence: {
          freeCashflow: -1,
          freeCashflowCoverage: 0.4,
          interestExpense: 3,
          interestBearingDebt: 10,
          freeCashflowAfterInterest: 4,
          payoutRatio: 110,
          historySummary: { status: 'partial' },
        },
        capitalStructureEvidence: { sharesOutstandingChange: 100, repurchaseSharesRetired: -5 },
        repurchaseEvidence: { repurchaseAmount: 20 },
      },
      evidence: [
        { key: 'shareholder-yield', label: '近 12 个月股息率', status: 'pass' },
        { key: 'shareholder-free-cashflow', label: '自由现金流', status: 'pass' },
        { key: 'shareholder-cashflow-coverage', label: '自由现金流分红覆盖', status: 'pass' },
        { key: 'shareholder-payout-ratio', label: '年度分红支付率', status: 'pass' },
        { key: 'shareholder-cashflow-history', label: '多期现金流覆盖', status: 'pass' },
        { key: 'shareholder-repurchase-shares', label: '回购注销股数', status: 'pass' },
        { key: 'quality-roe', label: 'ROE', status: 'fail' },
      ],
    })

    expect(checks.map(check => check.key)).toEqual([
      'shareholder-free-cashflow',
      'shareholder-cashflow-coverage',
      'shareholder-payout-ratio',
      'shareholder-cashflow-history',
      'shareholder-repurchase-shares',
    ])
    expect(checks.find(check => check.key === 'shareholder-free-cashflow')?.change).toBe('triggered')
    expect(checks.find(check => check.key === 'shareholder-cashflow-coverage')).toMatchObject({ currentStatus: 'caution', change: 'triggered' })
    expect(checks.find(check => check.key === 'shareholder-payout-ratio')).toMatchObject({ currentStatus: 'caution', change: 'triggered' })
    expect(checks.find(check => check.key === 'shareholder-cashflow-history')).toMatchObject({ currentStatus: 'caution', change: 'triggered' })
    expect(checks.find(check => check.key === 'shareholder-repurchase-shares')).toMatchObject({ currentStatus: 'fail', change: 'triggered' })
  })

  it('keeps a missing cashflow block unavailable instead of inventing a pass', () => {
    expect(buildShareholderInvalidationChecks({
      shareholderState: 'ready',
      shareholder: { trailingDividendYield: null, cashflowEvidence: null },
      evidence: [{ key: 'shareholder-free-cashflow', label: '自由现金流', status: 'pass' }],
    })).toEqual([
      { key: 'shareholder-free-cashflow', label: '自由现金流', savedStatus: 'pass', currentStatus: 'missing', change: 'unavailable' },
    ])
  })
})
