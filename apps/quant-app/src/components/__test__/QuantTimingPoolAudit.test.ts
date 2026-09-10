// @vitest-environment happy-dom

import type { WatchlistItem } from '../../lib/quant-view-models'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { quantApi } from '../../lib/api-client'
import QuantTimingPoolAudit from '../QuantTimingPoolAudit.vue'

const watchlist: WatchlistItem[] = [
  {
    id: 'watch-1',
    tsCode: '601899.SH',
    name: '紫金矿业',
    latestClose: 20,
    latestChangePercent: 1,
    latestTradeDate: '20260910',
    barCount: 120,
    createdAt: '2026-09-10T00:00:00.000Z',
  },
  {
    id: 'watch-2',
    tsCode: 'FAIL.SH',
    name: '失败股',
    latestClose: null,
    latestChangePercent: null,
    latestTradeDate: null,
    barCount: 0,
    createdAt: '2026-09-10T00:00:00.000Z',
  },
]

function dailyBars(count: number, tsCode: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${tsCode}-${index}`,
    tsCode,
    tradeDate: `2026${String(index + 1).padStart(4, '0')}`,
    open: 100 + index,
    high: 100 + index,
    low: 100 + index,
    close: 100 + index,
    preClose: null,
    change: null,
    changePercent: null,
    volume: 1,
    amount: null,
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('quant timing pool audit', () => {
  it('keeps the audit action disabled when the watchlist is empty', () => {
    const wrapper = mount(QuantTimingPoolAudit, {
      props: {
        watchlist: [],
        displayStockName: item => item.name || item.tsCode,
      },
    })

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('观察池为空')
  })

  it('runs an explicit audit and keeps threshold advice frozen', async () => {
    const getDailyBars = vi.spyOn(quantApi, 'getDailyBars').mockImplementation(async (tsCode: string) => {
      if (tsCode === 'FAIL.SH')
        throw new Error('upstream')
      return dailyBars(120, tsCode)
    })

    const wrapper = mount(QuantTimingPoolAudit, {
      props: {
        watchlist,
        displayStockName: item => item.name || item.tsCode,
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(getDailyBars).toHaveBeenCalledWith('601899.SH', { limit: 520 })
    expect(wrapper.text()).toContain('阈值保持不变')
    expect(wrapper.text()).toContain('来源失败')
    expect(wrapper.text()).not.toContain('看多')
    expect(wrapper.text()).not.toContain('看空')
  })
})
