import type { TargetPagesSurface } from '../target-profile.schema'

import { describe, expect, it } from 'vitest'
import {
  renderPagesRedirects,
  renderPagesRedirectTemplate,
} from '../pages-redirects'
import {
  parseTargetProfile,

  targetPagesSurfaceValues,
} from '../target-profile.schema'
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
      quant: 'https://starye-quant.pages.dev',
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

const expectedRedirectLines: Readonly<Record<TargetPagesSurface, readonly string[]>> = {
  dashboard: [
    'https://starye-dashboard.pages.dev/* https://starye.org/dashboard/:splat 301!',
    '/* /index.html 200',
  ],
  quant: [
    'https://starye-quant.pages.dev/* https://starye.org/quant/:splat 301!',
    '/* /index.html 200',
  ],
  auth: [
    'https://starye-auth-die.pages.dev/ https://starye.org/auth/login 301!',
    'https://starye-auth-die.pages.dev/* https://starye.org/auth/:splat 301!',
    '/* /index.html 200',
  ],
  blog: [
    'https://starye-blog.pages.dev/* https://starye.org/blog/:splat 301!',
    '/blog/* /blog/index.html 200',
  ],
  movie: [
    'https://starye-movie-60w.pages.dev/* https://starye.org/movie/:splat 301!',
    '/* /index.html 200',
  ],
  comic: [
    'https://starye-comic-3jr.pages.dev/* https://starye.org/comic/:splat 301!',
    '/* /index.html 200',
  ],
}

describe('pages redirect renderer', () => {
  const profile = parseTargetProfile(trackedTargetProfiles[0])

  it.each(targetPagesSurfaceValues)('保留 %s 的 direct-origin、canonical route 和 SPA fallback', (surface) => {
    expect(renderPagesRedirects(profile, surface)).toBe(`${expectedRedirectLines[surface].join('\n')}\n`)
  })

  it('拒绝未知 surface 和 hostile templates', () => {
    const movieTemplate = {
      surface: 'movie',
      lines: [
        '{{directOrigin}}/* {{gatewayUrl}}/movie/:splat 301!',
        '/* /index.html 200',
      ],
    } as const

    expect(() => renderPagesRedirects(profile, 'unknown' as TargetPagesSurface)).toThrow('Unknown Pages surface')
    expect(() => renderPagesRedirectTemplate(profile, 'movie', {
      ...movieTemplate,
      surface: 'comic',
    })).toThrow('surface')
    expect(() => renderPagesRedirectTemplate(profile, 'movie', {
      ...movieTemplate,
      lines: ['{{origin}}/* {{gatewayUrl}}/movie/:splat 301!', '/* /index.html 200'],
    })).toThrow('placeholder')
    expect(() => renderPagesRedirectTemplate(profile, 'movie', {
      ...movieTemplate,
      lines: ['{{directOrigin}}/* {{gatewayUrl}}/movie/:splat {{', '/* /index.html 200'],
    })).toThrow('placeholder')
    expect(() => renderPagesRedirectTemplate(profile, 'movie', {
      ...movieTemplate,
      lines: ['{{directOrigin}}/* https://untrusted.example/movie/:splat 301!', '/* /index.html 200'],
    })).toThrow('template')
    expect(() => renderPagesRedirectTemplate(profile, 'movie', {
      ...movieTemplate,
      lines: ['{{directOrigin}}/* {{gatewayUrl}}/movie/:splat 301!\n/* /index.html 200'],
    })).toThrow('unsafe')
  })
})
