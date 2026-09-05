import type { AppEnv } from '../../../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuantRouteTestApp } from './route-test-helpers'

describe('quant config route contract', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('requires an authenticated admin session', async () => {
    const response = await createQuantRouteTestApp(null).request('/api/quant/capabilities')
    expect(response.status).toBe(401)
  })

  it('requires authentication for factor configuration reads and writes', async () => {
    const read = await createQuantRouteTestApp(null).request('/api/quant/factor-config')
    const write = await createQuantRouteTestApp(null).request('/api/quant/factor-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weights: { 'trend': 0.25, 'valuation': 0.2, 'quality': 0.2, 'shareholder-return': 0.15, 'risk': 0.2 } }),
    })

    expect(read.status).toBe(401)
    expect(write.status).toBe(401)
  })

  it('returns the source-backed investment knowledge catalog', async () => {
    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/knowledge')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        version: 'investment-knowledge-v4',
        sources: expect.arrayContaining([
          expect.objectContaining({ id: 'article-pingan-20260825', title: '2026半年报业绩增速创七年新高，再谈中国平安' }),
          expect.objectContaining({ id: 'article-key-point', access: 'preview' }),
        ]),
        factors: expect.arrayContaining([
          expect.objectContaining({ id: 'relative-valuation', status: 'active', eligibleInValueQuality: true }),
          expect.objectContaining({ id: 'business-resilience', status: 'active', currentDimension: 'resilience', eligibleInValueQuality: true }),
          expect.objectContaining({ id: 'cashflow-capex-coverage', status: 'partial', eligibleInValueQuality: false }),
        ]),
        aliases: expect.arrayContaining([
          expect.objectContaining({ alias: '变变', tsCode: '600089.SH' }),
          expect.objectContaining({ alias: '海狗', status: 'ambiguous' }),
        ]),
      },
    })
  })

  it('returns the default 120-point capability contract', async () => {
    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/capabilities', {}, {
      TUSHARE_POINTS_TIER: undefined,
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        tier: 120,
        provider: 'eastmoney',
        enabled: ['daily'],
      },
    })
  })

  it('fails closed for an invalid configured tier', async () => {
    const response = await createQuantRouteTestApp({ user: { role: 'admin' } }).request('/api/quant/capabilities', {}, {
      TUSHARE_POINTS_TIER: '-1',
    } as AppEnv['Bindings'])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { tier: null, enabled: [] },
    })
  })
})
