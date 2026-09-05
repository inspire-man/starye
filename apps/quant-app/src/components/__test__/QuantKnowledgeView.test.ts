// @vitest-environment happy-dom

import type { QuantInvestmentKnowledge } from '../../lib/quant-view-models'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuantKnowledgeView from '../QuantKnowledgeView.vue'

const knowledge: QuantInvestmentKnowledge = {
  version: 'investment-knowledge-v4',
  observedAt: '2026-09-03T00:00:00.000Z',
  sources: [{
    id: 'source-1',
    title: '研究来源',
    url: 'https://example.test/source-1',
    publishedAt: '2026-09-01',
    access: 'full',
    summary: '来源摘要',
  }],
  factors: [
    {
      id: 'factor-trend',
      category: '趋势',
      title: '趋势结构',
      interpretation: '观察价格结构',
      measurement: '日线与均线',
      requiredFields: ['dailyBars'],
      availableFields: ['dailyBars'],
      missingFields: [],
      status: 'active',
      eligibleInValueQuality: true,
      currentDimension: 'trend',
      sourceIds: ['source-1'],
    },
    {
      id: 'factor-growth',
      category: '增长',
      title: '增长稳定性',
      interpretation: '观察增长变化',
      measurement: '利润同比',
      requiredFields: ['netProfitYoY'],
      availableFields: [],
      missingFields: ['netProfitYoY'],
      status: 'partial',
      eligibleInValueQuality: false,
      currentDimension: 'growth',
      sourceIds: [],
    },
  ],
  aliases: [
    {
      alias: '平安',
      status: 'mapped',
      confidence: 'high',
      tsCode: '601318.SH',
      name: '中国平安',
      candidates: [],
      note: '',
    },
    {
      alias: '港股样本',
      status: 'context_only',
      confidence: 'low',
      tsCode: null,
      name: null,
      candidates: ['00700.HK'],
      note: '仅作为语境参考',
    },
  ],
  recommendedWatchlist: [],
}

describe('quant knowledge view', () => {
  it('renders factor coverage and alias context', () => {
    const wrapper = mount(QuantKnowledgeView, {
      props: { investmentKnowledge: knowledge, loading: false, hasError: false },
    })

    expect(wrapper.text()).toContain('知识库 investment-knowledge-v4')
    expect(wrapper.text()).toContain('趋势结构')
    expect(wrapper.text()).toContain('已进入评分')
    expect(wrapper.text()).toContain('中国平安')
    expect(wrapper.text()).toContain('港股样本')
  })

  it('keeps loading and retry states explicit', async () => {
    const wrapper = mount(QuantKnowledgeView, {
      props: { investmentKnowledge: null, loading: false, hasError: true },
    })

    await wrapper.get('.knowledge-state button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
