import type { QuantDividendRecord } from '../provider'
import type { DailyBar } from '../types'
import { describe, expect, it } from 'vitest'
import { buildShareholderReturnResult } from '../shareholder-return'

function bars(close: number): DailyBar[] {
  return [{
    tsCode: '601899.SH',
    tradeDate: '20260824',
    open: close,
    high: close,
    low: close,
    close,
    preClose: close,
    change: 0,
    pctChg: 0,
    volume: 1000,
    amount: 10000,
  }]
}

function dividend(values: Partial<QuantDividendRecord> = {}): QuantDividendRecord {
  return {
    tsCode: '601899.SH',
    endDate: '20260331',
    annDate: '20260711',
    divProc: '实施',
    cashDiv: 0.42,
    exDate: '20260821',
    payDate: '20260821',
    ...values,
  }
}

describe('quant shareholder return formula', () => {
  it('uses implemented dividends in the trailing yield calculation', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend(), dividend({ endDate: '20251231', cashDiv: 0.38, exDate: '20260626', payDate: '20260626' })],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      status: 'ready',
      trailingCashDividendPerShare: 0.8,
      trailingDividendYield: 2.32,
      dividendYears: 2,
      distributions: expect.arrayContaining([
        expect.objectContaining({ endDate: '20260331', cashDividendPerShare: 0.42 }),
      ]),
    })
  })

  it('does not use proposals or fabricate a yield without a local price', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend({ divProc: '预案', cashDiv: 0 })],
      dailyBars: [],
      dividendErrorCode: null,
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result.status).toBe('insufficient_data')
    expect(result.trailingCashDividendPerShare).toBeNull()
    expect(result.trailingDividendYield).toBeNull()
    expect(result.missingFields).toEqual(expect.arrayContaining(['已实施现金分红记录', '近 12 个月已实施现金分红', '观察池最新正收盘价']))
  })

  it('keeps provider failure partial and leaves values null', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [],
      dailyBars: bars(34.54),
      dividendErrorCode: 'QUANT_PROVIDER_CONFIGURATION',
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      status: 'partial',
      trailingCashDividendPerShare: null,
      trailingDividendYield: null,
    })
    expect(result.missingFields[0]).toContain('QUANT_PROVIDER_CONFIGURATION')
  })

  it('returns actual provider and fallback metadata without changing the dividend formula', () => {
    const result = buildShareholderReturnResult({
      tsCode: '601899.SH',
      name: '紫金矿业',
      dividends: [dividend()],
      dailyBars: bars(34.54),
      dividendErrorCode: null,
      dividendProvider: 'eastmoney',
      providerChain: ['tushare', 'eastmoney'],
      fallbackUsed: true,
      fallbackReason: 'QUANT_PROVIDER_QUOTA',
      observedAt: '2026-08-25T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      provider: 'eastmoney',
      providerChain: ['tushare', 'eastmoney'],
      fallbackUsed: true,
      fallbackReason: 'QUANT_PROVIDER_QUOTA',
      providerErrorCode: null,
      trailingCashDividendPerShare: 0.42,
    })
  })
})
