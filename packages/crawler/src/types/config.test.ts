import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, GITHUB_ACTIONS_CONFIG } from './config'

describe('crawler batch limits', () => {
  it('keeps the local defaults bounded to a ten-item run', () => {
    expect(DEFAULT_LIMITS).toEqual({ maxMovies: 10, maxPages: 10 })
  })

  it('keeps the GitHub Actions movie profile bounded to ten items and pages', () => {
    expect(GITHUB_ACTIONS_CONFIG.limits).toEqual({ maxMovies: 10, maxPages: 10 })
  })
})
