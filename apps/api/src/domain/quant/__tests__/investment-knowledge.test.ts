import { describe, expect, it } from 'vitest'
import {
  getQuantInvestmentKnowledge,
  QUANT_INVESTMENT_KNOWLEDGE_VERSION,
  QUANT_KNOWLEDGE_ALIASES,
  QUANT_KNOWLEDGE_FACTORS,
  QUANT_KNOWLEDGE_RECOMMENDED_WATCHLIST,
  QUANT_KNOWLEDGE_SOURCES,
} from '../investment-knowledge'

describe('quant investment knowledge catalog', () => {
  it('keeps the seven supplied sources traceable and marks the paid preview', () => {
    expect(QUANT_KNOWLEDGE_SOURCES).toHaveLength(7)
    expect(QUANT_KNOWLEDGE_SOURCES.filter(source => source.access === 'preview')).toEqual([
      expect.objectContaining({ id: 'article-key-point', title: '重点来了' }),
    ])
    expect(new Set(QUANT_KNOWLEDGE_SOURCES.map(source => source.url)).size).toBe(7)
  })

  it('separates active score factors from data-dependent hypotheses', () => {
    const active = QUANT_KNOWLEDGE_FACTORS.filter(factor => factor.status === 'active')
    const eligible = QUANT_KNOWLEDGE_FACTORS.filter(factor => factor.eligibleInValueQuality)
    const planned = QUANT_KNOWLEDGE_FACTORS.filter(factor => factor.status === 'planned')

    expect(active.map(factor => factor.id)).toEqual([
      'relative-valuation',
      'earnings-quality',
      'growth-stability',
      'long-term-trend',
    ])
    expect(eligible).toEqual(active)
    expect(planned.length).toBeGreaterThanOrEqual(2)
    expect(planned.every(factor => factor.missingFields.length > 0 && !factor.eligibleInValueQuality)).toBe(true)
  })

  it('maps clear nicknames while retaining ambiguous and cross-market context', () => {
    expect(QUANT_KNOWLEDGE_ALIASES).toEqual(expect.arrayContaining([
      expect.objectContaining({ alias: '变变', tsCode: '600089.SH', name: '特变电工', confidence: 'high' }),
      expect.objectContaining({ alias: '赵姨', tsCode: '603986.SH', name: '兆易创新', confidence: 'medium' }),
      expect.objectContaining({ alias: '海狗', status: 'ambiguous', tsCode: null }),
      expect.objectContaining({ alias: '阿里', status: 'context_only', candidates: ['9988.HK'] }),
    ]))
  })

  it('returns a versioned response and a bounded A-share research list', () => {
    const response = getQuantInvestmentKnowledge(new Date('2026-08-25T00:00:00.000Z'))

    expect(response).toMatchObject({
      version: QUANT_INVESTMENT_KNOWLEDGE_VERSION,
      observedAt: '2026-08-25T00:00:00.000Z',
    })
    expect(response.recommendedWatchlist).toEqual(QUANT_KNOWLEDGE_RECOMMENDED_WATCHLIST)
    expect(response.recommendedWatchlist.every(item => /^\d{6}\.(?:SH|SZ|BJ)$/u.test(item.tsCode))).toBe(true)
  })
})
