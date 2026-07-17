import { describe, expect, it } from 'vitest'

import {
  buildNuxtPublicRuntimeEnv,
  buildTargetProjections,
  buildVitePublicRuntimeEnv,
  getPagesDeployProjection,
  parseAuditedPublicRuntimeInput,
  targetPagesSurfaceValues,
} from '../index'
import { trackedTargetProfiles } from '../target-profiles'
import { resolveTargetProfile } from '../target-resolver'

function resolveFixtureTarget() {
  const source = trackedTargetProfiles[0]
  const alternate = {
    ...source,
    id: 'alternate-org',
    account: { ...source.account, id: 'alternate-account', name: 'alternate-org' },
    domain: { root: 'alternate.example', zoneName: 'alternate.example' },
    local: { wranglerProfile: 'alternate-org' },
    ci: { githubEnvironment: 'alternate-org' },
    urls: {
      gateway: 'https://alternate.example',
      api: 'https://api.alternate.example',
      dashboard: 'https://dashboard.alternate.example',
      auth: 'https://auth.alternate.example',
      blog: 'https://blog.alternate.example',
      movie: 'https://movie.alternate.example',
      comic: 'https://comic.alternate.example',
      tavern: 'https://tavern.alternate.example',
    },
    workers: {
      api: { name: 'alternate-api', routes: [{ pattern: 'api.alternate.example', customDomain: true }] },
      gateway: { name: 'alternate-gateway', routes: [{ pattern: 'alternate.example', customDomain: true }] },
    },
    pages: {
      dashboard: { project: 'alternate-dashboard', canonicalUrl: 'https://dashboard.alternate.example' },
      auth: { project: 'alternate-auth', canonicalUrl: 'https://auth.alternate.example' },
      blog: { project: 'alternate-blog', canonicalUrl: 'https://blog.alternate.example' },
      movie: { project: 'alternate-movie', canonicalUrl: 'https://movie.alternate.example' },
      comic: { project: 'alternate-comic', canonicalUrl: 'https://comic.alternate.example' },
    },
  }

  return resolveTargetProfile('alternate-org', new Map([['alternate-org', alternate]]))
}

const overlay = {
  sentryDsn: 'https://public@example.ingest.sentry.io/1',
  sentryRelease: 'release-1',
  buildMode: 'production',
  monitoringEnabled: true,
  aria2Enabled: true,
  aria2WebsocketEnabled: true,
  ratingEnabled: true,
  autoScoreEnabled: true,
  performanceMonitoringEnabled: false,
}

describe('target projections', () => {
  it('derives public, deploy, and workflow facts from the selected resolution', () => {
    const current = buildTargetProjections(resolveTargetProfile('starye-org'), { runId: 'current-run' })
    const alternate = buildTargetProjections(resolveFixtureTarget(), { runId: 'alternate-run' })

    expect(current.publicRuntime).toEqual({
      targetId: 'starye-org',
      gatewayBaseUrl: 'https://starye.org',
      apiBaseUrl: 'https://api.starye.org',
      appBasePaths: {
        dashboard: '/dashboard/',
        auth: '/auth/',
        blog: '/blog/',
        movie: '/movie/',
        comic: '/comic/',
        tavern: '/tavern/',
      },
    })
    expect(alternate.publicRuntime).toMatchObject({
      targetId: 'alternate-org',
      gatewayBaseUrl: 'https://alternate.example',
      apiBaseUrl: 'https://api.alternate.example',
    })
    expect(alternate.deploy.workers.api.name).toBe('alternate-api')
    expect(current.deploy.workers.gateway.vars.tavernOrigin).toBe('https://tavern.starye.org')
    expect(current.deploy.pages.map(page => page.surface)).not.toContain('tavern')
    expect(alternate.workflow).toMatchObject({ targetId: 'alternate-org', githubEnvironment: 'alternate-org', runId: 'alternate-run' })
  })

  it('resolves only the selected Blog project and each closed Pages surface', () => {
    const resolution = resolveTargetProfile('starye-org')
    expect(getPagesDeployProjection(resolution, 'blog').project).toBe('blog-pages')
    expect(targetPagesSurfaceValues).not.toContain('tavern')

    for (const surface of targetPagesSurfaceValues) {
      const projection = getPagesDeployProjection(resolution, surface)
      expect(projection.surface).toBe(surface)
      expect(projection.project).toBe(resolution.profile.pages[surface].project)
      expect(projection.buildEnv.appBasePath).toMatch(/^\/[a-z]+\/$/)
    }

    expect(() => getPagesDeployProjection(resolution, 'missing' as never)).toThrow('Unknown Pages surface')
  })

  it('builds an exact public browser allowlist without deployment identity', () => {
    const input = parseAuditedPublicRuntimeInput(resolveTargetProfile('starye-org'), overlay)
    const vite = buildVitePublicRuntimeEnv(input, 'movie')
    const nuxt = buildNuxtPublicRuntimeEnv(input, 'auth')

    expect(vite).toMatchObject({
      VITE_TARGET_ID: 'starye-org',
      VITE_GATEWAY_BASE_URL: 'https://starye.org',
      VITE_API_BASE_URL: 'https://api.starye.org',
      VITE_APP_BASE_PATH: '/movie/',
      VITE_FEATURE_ARIA2: 'true',
    })
    expect(nuxt).toMatchObject({
      NUXT_PUBLIC_TARGET_ID: 'starye-org',
      NUXT_PUBLIC_GATEWAY_BASE_URL: 'https://starye.org',
      NUXT_PUBLIC_APP_BASE_PATH: '/auth/',
    })
    const serialized = JSON.stringify({ vite, nuxt })
    expect(serialized).not.toMatch(/worker|project|account|resource|bucket|database/i)
  })

  it('rejects unknown or credential-shaped overlay input without echoing it', () => {
    const resolution = resolveTargetProfile('starye-org')
    const secret = 'token-must-not-appear'

    expect(() => parseAuditedPublicRuntimeInput(resolution, { ...overlay, VITE_UNREGISTERED_SECRET: secret })).toThrow(/Unknown public runtime overlay field/)
    expect(() => parseAuditedPublicRuntimeInput(resolution, { ...overlay, sentryRelease: secret })).toThrow(/credential-shaped/)

    try {
      parseAuditedPublicRuntimeInput(resolution, { ...overlay, NUXT_PUBLIC_CRAWLER_SECRET: secret })
    }
    catch (error) {
      expect(error).not.toHaveProperty('message', expect.stringContaining(secret))
    }
  })
})
