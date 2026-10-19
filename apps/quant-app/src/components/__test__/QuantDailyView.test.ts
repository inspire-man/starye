// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuantDailyView from '../QuantDailyView.vue'

const getDailyBoard = vi.fn()
const createOperation = vi.fn()
const generateResearchRun = vi.fn()
const addWatchlist = vi.fn()
const syncDaily = vi.fn()

vi.mock('../../lib/api-client', () => ({
  quantApi: {
    getDailyBoard: (...args: unknown[]) => getDailyBoard(...args),
    createOperation: (...args: unknown[]) => createOperation(...args),
    generateResearchRun: (...args: unknown[]) => generateResearchRun(...args),
    addWatchlist: (...args: unknown[]) => addWatchlist(...args),
    syncDaily: (...args: unknown[]) => syncDaily(...args),
  },
  QuantApiError: class QuantApiError extends Error {},
}))

const board = {
  formulaVersion: 'daily-action-v1',
  today: '2026-10-15',
  items: [{
    tsCode: '601899.SH',
    name: '紫金矿业',
    action: 'buy',
    label: '买',
    reason: '现价 28.40，位于买入区间 27.50-31.20。',
    blocker: null,
    priceFreshness: 'session',
    price: 28.4,
    priceDate: '2026-10-15',
    priceSource: 'eastmoney-realtime',
    recommendation: 'bullish',
    rangeLow: 27.5,
    rangeHigh: 31.2,
    openQuantity: 0,
    cost: null,
  }],
  score: {
    closedCount: 1,
    winCount: 1,
    lossCount: 0,
    flatCount: 0,
    winRate: null,
    payoffRatio: null,
    realizedPnl: 12.5,
    dividendCash: 0,
    passCount: 0,
    minimumSample: 6,
    swingClosedCount: 1,
    swingRealizedPnl: 12.5,
    swingPayoffRatio: null,
    sameDayClosedCount: 0,
    sameDayRealizedPnl: 0,
  },
}

describe('quantDailyView', () => {
  beforeEach(() => {
    getDailyBoard.mockReset()
    createOperation.mockReset()
    getDailyBoard.mockResolvedValue(board)
    syncDaily.mockResolvedValue({ status: 'completed' })
    createOperation.mockResolvedValue({ id: 'op-1' })
  })

  it('shows the daily action and records a pass without treating it as a fill', async () => {
    const wrapper = mount(QuantDailyView)
    await flushPromises()

    expect(wrapper.text()).toContain('追踪')
    expect(wrapper.text()).toContain('买')
    expect(wrapper.text()).toContain('28.40')
    expect(wrapper.text()).toContain('27.50–31.20')
    expect(wrapper.text()).toContain('价差')
    expect(wrapper.text()).not.toContain('不是下单')
    expect(wrapper.text()).not.toContain('不是盘中')
    expect(wrapper.text()).not.toContain('候选研究')
    let release: (value: { id: string }) => void = () => {}
    const pending = new Promise<{ id: string }>((resolve) => {
      release = resolve
    })
    createOperation.mockImplementation(() => pending)
    await wrapper.get('button[aria-label="记下 紫金矿业 未执行"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('记录中')
    release({ id: 'op-1' })
    await flushPromises()
    expect(wrapper.text()).toContain('已记下未执行')
    expect(createOperation).toHaveBeenCalledWith(expect.objectContaining({
      tsCode: '601899.SH',
      side: 'pass',
      quantity: 0,
      note: '未执行',
    }))
  })
})
