import { describe, expect, it } from 'vitest'
import { deriveWatchCompleted } from '../watch-progress'

describe('deriveWatchCompleted', () => {
  it('uses the server completion threshold', () => {
    expect(deriveWatchCompleted(89, 100)).toBe(false)
    expect(deriveWatchCompleted(90, 100)).toBe(true)
    expect(deriveWatchCompleted(10, 100, true)).toBe(true)
    expect(deriveWatchCompleted(50, null)).toBe(false)
  })
})
