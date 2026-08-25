import { describe, expect, it } from 'vitest'
import { parseQuantView, quantViewHash } from '../quant-view'

describe('quant view navigation', () => {
  it('parses supported hashes and falls back to overview', () => {
    expect(parseQuantView('#candidates')).toBe('candidates')
    expect(parseQuantView('#WATCHLIST')).toBe('watchlist')
    expect(parseQuantView('')).toBe('overview')
    expect(parseQuantView('#unknown')).toBe('overview')
  })

  it('builds stable hashes for direct navigation', () => {
    expect(quantViewHash('knowledge')).toBe('#knowledge')
  })
})
