import { describe, expect, it } from 'vitest'
import { createComparisonDailyGeneration } from '../comparison-daily-generation'

describe('comparison daily request generations', () => {
  it('invalidates stale responses when a new comparison starts or closes', () => {
    const generation = createComparisonDailyGeneration()
    const first = generation.next()

    expect(generation.isCurrent(first)).toBe(true)

    const second = generation.next()
    expect(generation.isCurrent(first)).toBe(false)
    expect(generation.isCurrent(second)).toBe(true)

    generation.invalidate()
    expect(generation.isCurrent(second)).toBe(false)
  })
})
