import type { AppEnv } from '../../../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuantRouteTestApp } from './route-test-helpers'

describe('quant workspace route contract', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns a normalized stock identity from the configured Eastmoney origin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      rc: 0,
      data: { f57: '600000', f58: '浦发银行' },
    }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/stock-basic/600000.SH', {}, {
      EASTMONEY_BASE_URL: 'https://eastmoney.fixture.test',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { tsCode: '600000.SH', name: '浦发银行' },
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('fields=f57%2Cf58')
  })

  it('uses Tushare stock_basic when the Quant provider is Tushare', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      data: { fields: ['ts_code', 'name'], items: [['600000.SH', '浦发银行']] },
    }), { status: 200 }))

    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/stock-basic/600000.SH', {}, {
      QUANT_DATA_PROVIDER: 'tushare',
      TUSHARE_TOKEN: 'fixture-token',
      TUSHARE_BASE_URL: 'https://tushare.fixture.test',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { tsCode: '600000.SH', name: '浦发银行' } })
    expect(fetchMock).toHaveBeenCalledWith('https://tushare.fixture.test', expect.objectContaining({ method: 'POST' }))
  })
})
