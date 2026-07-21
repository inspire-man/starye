import { describe, expect, it } from 'vitest'

import { parseTargetProfile, targetPagesSurfaceValues } from '../target-profile.schema'
import { trackedTargetProfiles } from '../target-profiles'

function cloneProfile() {
  return JSON.parse(JSON.stringify(trackedTargetProfiles[0])) as Record<string, any>
}

describe('targetProfile Pages direct origins', () => {
  it('为每个 closed Pages surface 提供显式、非 secret 的 direct origin', () => {
    const parsed = parseTargetProfile(trackedTargetProfiles[0])

    expect(Object.fromEntries(targetPagesSurfaceValues.map(surface => [
      surface,
      parsed.pages[surface].directOrigin,
    ]))).toEqual({
      dashboard: 'https://starye-dashboard.pages.dev',
      auth: 'https://starye-auth-die.pages.dev',
      blog: 'https://starye-blog.pages.dev',
      movie: 'https://starye-movie-60w.pages.dev',
      comic: 'https://starye-comic-3jr.pages.dev',
    })
    expect(parsed.pages.blog.directOrigin).not.toBe(`https://${parsed.pages.blog.project}.pages.dev`)
  })

  it('在 parse-time 拒绝缺失、不安全和跨 surface 的 direct origin', () => {
    const missing = cloneProfile()
    delete missing.pages.movie.directOrigin

    const insecure = cloneProfile()
    insecure.pages.auth.directOrigin = 'http://starye-auth-die.pages.dev'

    const crossSurface = cloneProfile()
    crossSurface.pages.comic.directOrigin = crossSurface.pages.movie.directOrigin

    expect(() => parseTargetProfile(missing)).toThrow('Target profile is invalid')
    expect(() => parseTargetProfile(insecure)).toThrow('Target profile is invalid')
    expect(() => parseTargetProfile(crossSurface)).toThrow('Target profile is invalid')
  })
})
