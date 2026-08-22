import { describe, expect, it } from 'vitest'
import { createQuantCapabilityRegistry } from '../capabilities'

describe('quant capability registry', () => {
  it('defaults to 120 points with only daily enabled', () => {
    const registry = createQuantCapabilityRegistry()

    expect(registry.tier).toBe(120)
    expect(registry.enabled).toEqual(['daily'])
    expect(registry.hasCapability('daily')).toBe(true)
    expect(registry.hasCapability('daily_basic')).toBe(false)
    expect(registry.provider).toBe('tushare')
  })

  it('exposes the planned extension capabilities at 2000 points', () => {
    const registry = createQuantCapabilityRegistry('2000')

    expect(registry.tier).toBe(2000)
    expect(registry.enabled).toEqual(['daily', 'stock_basic', 'trade_cal', 'daily_basic'])
  })

  it('fails closed for invalid tiers', () => {
    const registry = createQuantCapabilityRegistry('-1')

    expect(registry.tier).toBeNull()
    expect(registry.enabled).toEqual([])
    expect(registry.capabilities.every(item => item.reason === 'invalid_points_tier')).toBe(true)
  })

  it('reports the free Eastmoney source when selected', () => {
    expect(createQuantCapabilityRegistry(undefined, 'eastmoney').provider).toBe('eastmoney')
  })
})
