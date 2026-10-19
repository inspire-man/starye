// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuantOperationsView from '../QuantOperationsView.vue'

const getOperations = vi.fn()
const createOperation = vi.fn()
const getWatchlist = vi.fn()

vi.mock('../../api/resources/operations', () => ({
  quantOperationApi: {
    getOperations: (...args: unknown[]) => getOperations(...args),
    createOperation: (...args: unknown[]) => createOperation(...args),
    deleteOperation: vi.fn(),
  },
}))

vi.mock('../../lib/api-client', () => ({
  quantApi: {
    getWatchlist: (...args: unknown[]) => getWatchlist(...args),
  },
}))

const ledger = {
  formulaVersion: 'operation-ledger-v2',
  closedCount: 0,
  winCount: 0,
  lossCount: 0,
  flatCount: 0,
  realizedPnl: 0,
  dividendCash: 0,
  winRate: null,
  payoffRatio: null,
  unmatchedSellQuantity: 0,
  openLots: [{ tsCode: '000001.SZ', name: '平安银行', quantity: 100, cost: 10.5 }],
  closed: [],
  curve: [],
  byCode: [{
    tsCode: '000001.SZ',
    name: '平安银行',
    openQuantity: 100,
    dividendCash: 0,
    closedCount: 0,
    winCount: 0,
    lossCount: 0,
    realizedPnl: 0,
    winRate: null,
    payoffRatio: null,
  }],
  aiBrief: '',
}

beforeEach(() => {
  getOperations.mockReset()
  createOperation.mockReset()
  getWatchlist.mockReset()
  getWatchlist.mockResolvedValue([{
    id: 'watch-1',
    tsCode: '601899.SH',
    name: '紫金矿业',
    latestTradeDate: '20260928',
    barCount: 120,
    latestClose: 28.8,
    latestChangePercent: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
  }])
  getOperations.mockResolvedValue({
    operations: [{
      id: 'fill-1',
      tsCode: '000001.SZ',
      name: '平安银行',
      side: 'buy',
      price: 10.5,
      quantity: 200,
      fee: 0,
      tradedAt: '2026-09-28T01:30:00.000Z',
    }],
    ledger,
  })
  createOperation.mockResolvedValue({})
})
describe('quant operations view', () => {
  it('records a watchlist stock without typing its code', async () => {
    const wrapper = mount(QuantOperationsView)
    await flushPromises()

    await wrapper.get('select[aria-label="股票"]').setValue('601899.SH')
    await wrapper.get('[aria-label="用最近收盘"]').trigger('click')
    expect((wrapper.get('input[aria-label="价格"]').element as HTMLInputElement).value).toBe('28.80')
    await wrapper.get('input[aria-label="数量"]').setValue('100')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(createOperation).toHaveBeenCalledWith(expect.objectContaining({
      tsCode: '601899.SH',
      name: '紫金矿业',
      side: 'buy',
      price: 28.8,
      quantity: 100,
    }))
  })

  it('selects an existing position and reuses that fill', async () => {
    const wrapper = mount(QuantOperationsView)
    await flushPromises()

    await wrapper.get('[aria-label="选择 平安银行"]').trigger('click')
    expect((wrapper.get('select[aria-label="股票"]').element as HTMLSelectElement).value).toBe('000001.SZ')
    await wrapper.get('[aria-label="用平安银行这笔再记"]').trigger('click')
    expect((wrapper.get('input[aria-label="价格"]').element as HTMLInputElement).value).toBe('10.50')
    expect((wrapper.get('input[aria-label="数量"]').element as HTMLInputElement).value).toBe('200')
    expect(wrapper.get('[aria-label="方向"] button[aria-pressed="true"]').text()).toBe('买入')
  })

  it('shows dividend on the stock card and filters the fills', async () => {
    getOperations.mockResolvedValue({
      operations: [
        { id: 'a', tsCode: '601899.SH', name: '紫金矿业', side: 'buy', price: 30, quantity: 100, fee: 0, tradedAt: '2026-03-02T07:00:00.000Z' },
        { id: 'b', tsCode: '600089.SH', name: '特变电工', side: 'buy', price: 18.49, quantity: 100, fee: 0.46, tradedAt: '2026-09-14T07:00:00.000Z' },
      ],
      ledger: {
        ...ledger,
        byCode: [
          { tsCode: '601899.SH', name: '紫金矿业', closedCount: 0, winCount: 0, lossCount: 0, realizedPnl: 0, winRate: null, payoffRatio: null, openQuantity: 700, dividendCash: 560 },
          { tsCode: '600089.SH', name: '特变电工', closedCount: 0, winCount: 0, lossCount: 0, realizedPnl: 0, winRate: null, payoffRatio: null, openQuantity: 500, dividendCash: 144 },
        ],
        openLots: [{ tsCode: '600089.SH', name: '特变电工', quantity: 500, cost: 24.7881 }],
      },
    })
    const wrapper = mount(QuantOperationsView)
    await flushPromises()

    expect(wrapper.get('[aria-label="选择 特变电工"]').text()).toContain('分红 +144.00')
    expect(wrapper.get('[aria-label="选择 特变电工"]').text()).toContain('500 股')
    await wrapper.get('[aria-label="选择 特变电工"]').trigger('click')
    expect(wrapper.find('[aria-label="在明细里选择 紫金矿业"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="成交明细"]').text()).toContain('18.49')
    expect(wrapper.get('[aria-label="成交明细"]').text()).not.toContain('紫金矿业')
  })
})
