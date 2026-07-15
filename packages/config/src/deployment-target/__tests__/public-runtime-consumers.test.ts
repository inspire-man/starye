/// <reference types="node" />

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildNuxtPublicRuntimeEnv,
  buildTargetProjections,
  buildVitePublicRuntimeEnv,
  materializeTargetDeployConfig,
  parseAuditedPublicRuntimeInput,
  parseNuxtPublicRuntimeEnv,
  parsePagesBuildEnv,
  parseVitePublicRuntimeEnv,
} from '../index'
import { resolveTargetProfile } from '../target-resolver'

const workspaceRoot = fileURLToPath(new URL('../../../../../', import.meta.url))
const roots: string[] = []

const sourceInventory = [
  'apps/auth/nuxt.config.ts',
  'apps/blog/nuxt.config.ts',
  'apps/auth/app/lib/auth-client.ts',
  'apps/blog/app/lib/auth-client.ts',
  'apps/auth/sentry.client.config.ts',
  'apps/auth/sentry.server.config.ts',
  'apps/blog/sentry.client.config.ts',
  'apps/blog/sentry.server.config.ts',
  'apps/blog/app/composables/useApiClient.ts',
  'apps/blog/app/pages/archive.vue',
  'apps/blog/app/pages/index.vue',
  'apps/blog/app/pages/search.vue',
  'apps/blog/app/pages/[slug].vue',
  'apps/blog/app/pages/tags/[tag].vue',
  'apps/blog/app/pages/series/[name].vue',
  'apps/dashboard/vite.config.ts',
  'apps/dashboard/src/config/public-runtime.ts',
  'apps/dashboard/src/main.ts',
  'apps/dashboard/src/router/index.ts',
  'apps/dashboard/src/lib/hono-rpc-client.ts',
  'apps/dashboard/src/views/Actors.vue',
  'apps/dashboard/src/views/Publishers.vue',
  'apps/movie-app/vite.config.ts',
  'apps/movie-app/src/config/public-runtime.ts',
  'apps/movie-app/src/main.ts',
  'apps/movie-app/src/router.ts',
  'apps/movie-app/src/views/Player.vue',
  'apps/movie-app/src/utils/monitoring.ts',
  'apps/movie-app/src/composables/useAria2.ts',
  'apps/movie-app/src/composables/useFeatureFlags.ts',
  'apps/movie-app/src/composables/usePerformanceMonitor.ts',
  'apps/movie-app/src/composables/useRating.ts',
  'apps/movie-app/src/lib/api-client.ts',
  'apps/comic-app/vite.config.ts',
  'apps/comic-app/src/config/public-runtime.ts',
  'apps/comic-app/src/main.ts',
  'apps/comic-app/src/router.ts',
  'apps/comic-app/src/lib/api-client.ts',
] as const

const rawReadAdapters = new Set([
  'apps/auth/nuxt.config.ts',
  'apps/blog/nuxt.config.ts',
  'apps/dashboard/vite.config.ts',
  'apps/movie-app/vite.config.ts',
  'apps/comic-app/vite.config.ts',
])

async function createFixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-public-runtime-'))
  roots.push(root)
  return {
    root,
    api: path.join(root, 'api'),
    gateway: path.join(root, 'gateway'),
    run: path.join(root, 'run'),
  }
}

async function materializeGeneratedEnv(surface: 'dashboard' | 'auth' | 'blog' | 'movie' | 'comic') {
  const fixture = await createFixtureRoot()
  const resolution = resolveTargetProfile('starye-org')
  const generated = await materializeTargetDeployConfig({
    deploy: buildTargetProjections(resolution).deploy,
    publicRuntimeInput: parseAuditedPublicRuntimeInput(resolution, {
      buildMode: 'production',
      sentryDsn: 'https://public@example.ingest.sentry.io/1',
      sentryRelease: 'release-12-02',
    }),
    runId: `runtime-${surface}`,
    appDirectories: { api: fixture.api, gateway: fixture.gateway },
    runDirectory: fixture.run,
    pagesSurface: surface,
  })

  return parsePagesBuildEnv(generated.pages!.buildEnvPath, surface)
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('public runtime consumer adapters', () => {
  it('round-trips only Plan 12-01 parsed Vite and Nuxt dotenv surfaces', async () => {
    const dashboardGenerated = await materializeGeneratedEnv('dashboard')
    const authGenerated = await materializeGeneratedEnv('auth')
    const movieGenerated = await materializeGeneratedEnv('movie')
    const comicGenerated = await materializeGeneratedEnv('comic')

    const dashboard = parseVitePublicRuntimeEnv(dashboardGenerated, 'dashboard')
    const auth = parseNuxtPublicRuntimeEnv(authGenerated, 'auth')
    const movie = parseVitePublicRuntimeEnv(movieGenerated, 'movie')
    const comic = parseVitePublicRuntimeEnv(comicGenerated, 'comic')

    expect(buildVitePublicRuntimeEnv(dashboard, 'dashboard')).toEqual(dashboardGenerated)
    expect(buildNuxtPublicRuntimeEnv(auth, 'auth')).toEqual(authGenerated)
    expect(buildVitePublicRuntimeEnv(movie, 'movie')).toEqual(movieGenerated)
    expect(buildVitePublicRuntimeEnv(comic, 'comic')).toEqual(comicGenerated)
    expect(dashboard.publicRuntime.gatewayBaseUrl).toBe('https://starye.org')
    expect(auth.publicRuntime.appBasePaths.auth).toBe('/auth/')
    expect(movie.publicRuntime.appBasePaths.movie).toBe('/movie/')
    expect(comic.publicRuntime.appBasePaths.comic).toBe('/comic/')
    expect(movie.overlay).toMatchObject({
      aria2Enabled: true,
      aria2WebsocketEnabled: true,
      ratingEnabled: true,
      autoScoreEnabled: true,
      monitoringEnabled: false,
      performanceMonitoringEnabled: false,
    })
  })

  it('rejects cross-framework, missing, unregistered, and credential-shaped generated keys before adapter serialization', async () => {
    const movieGenerated = await materializeGeneratedEnv('movie')
    const secret = 'token-must-not-appear'

    expect(() => parseVitePublicRuntimeEnv({
      ...movieGenerated,
      NUXT_PUBLIC_API_BASE_URL: 'https://cross-framework.example',
    }, 'movie')).toThrow('cross-framework')
    expect(() => parseVitePublicRuntimeEnv({
      ...movieGenerated,
      VITE_UNREGISTERED_SECRET: secret,
    }, 'movie')).toThrow('unregistered')
    expect(() => parseVitePublicRuntimeEnv({
      ...movieGenerated,
      VITE_API_TOKEN: secret,
    }, 'movie')).toThrow('unregistered')
    expect(() => parseVitePublicRuntimeEnv({
      ...movieGenerated,
      VITE_API_BASE_URL: undefined,
    }, 'movie')).toThrow('missing')

    try {
      parseVitePublicRuntimeEnv({
        ...movieGenerated,
        VITE_UNREGISTERED_SECRET: secret,
      }, 'movie')
    }
    catch (error) {
      expect(String(error)).not.toContain(secret)
    }

    try {
      parseVitePublicRuntimeEnv({
        ...movieGenerated,
        NUXT_PUBLIC_CRAWLER_SECRET: secret,
      }, 'movie')
    }
    catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })

  it('accepts the selected local and production browser bases without direct app-port fallbacks', async () => {
    const productionMovie = parseVitePublicRuntimeEnv(await materializeGeneratedEnv('movie'), 'movie')
    const localMovie = parseVitePublicRuntimeEnv({
      VITE_TARGET_ID: 'local-fixture',
      VITE_GATEWAY_BASE_URL: 'http://localhost:8080',
      VITE_API_BASE_URL: 'http://localhost:8080/api',
      VITE_APP_BASE_PATH: '/movie/',
      VITE_BUILD_MODE: 'development',
      VITE_MONITORING_ENABLED: 'true',
      VITE_FEATURE_ARIA2: 'false',
      VITE_FEATURE_ARIA2_WS: 'false',
      VITE_FEATURE_RATING: 'true',
      VITE_FEATURE_AUTO_SCORE: 'true',
      VITE_FEATURE_PERF_MONITOR: 'true',
    }, 'movie')

    expect(productionMovie.publicRuntime.targetId).toBe('starye-org')
    expect(localMovie.publicRuntime).toMatchObject({
      targetId: 'local-fixture',
      gatewayBaseUrl: 'http://localhost:8080',
      apiBaseUrl: 'http://localhost:8080/api',
      appBasePaths: { movie: '/movie/' },
    })
    expect(localMovie.overlay).toMatchObject({
      buildMode: 'development',
      monitoringEnabled: true,
      aria2Enabled: false,
      aria2WebsocketEnabled: false,
      ratingEnabled: true,
      autoScoreEnabled: true,
      performanceMonitoringEnabled: true,
    })
    expect(Object.keys(buildVitePublicRuntimeEnv(productionMovie, 'movie')).sort()).toEqual([
      'VITE_API_BASE_URL',
      'VITE_APP_BASE_PATH',
      'VITE_BUILD_MODE',
      'VITE_FEATURE_ARIA2',
      'VITE_FEATURE_ARIA2_WS',
      'VITE_FEATURE_AUTO_SCORE',
      'VITE_FEATURE_PERF_MONITOR',
      'VITE_FEATURE_RATING',
      'VITE_GATEWAY_BASE_URL',
      'VITE_MONITORING_ENABLED',
      'VITE_SENTRY_DSN',
      'VITE_SENTRY_RELEASE',
      'VITE_TARGET_ID',
    ])
  })

  it('keeps the reconciled Blog Pages project in deploy-only output', () => {
    const resolution = resolveTargetProfile('starye-org')
    const deployment = buildTargetProjections(resolution)
    const input = parseAuditedPublicRuntimeInput(resolution, { buildMode: 'production' })
    const browserOutput = JSON.stringify({
      vite: buildVitePublicRuntimeEnv(input, 'dashboard'),
      nuxt: buildNuxtPublicRuntimeEnv(input, 'blog'),
    })

    expect(deployment.deploy.pages.find(page => page.surface === 'blog')?.project).toBe('blog-pages')
    expect(browserOutput).not.toMatch(/blog-pages|starye-blog/)
  })

  it('allows raw public reads only inside registered framework-entry adapters', async () => {
    const rawRead = /import\.meta\.env|env\.(?:VITE|NUXT_PUBLIC)_|process\.env\.STARYE_PAGES_BUILD_ENV_PATH|runtimeConfig:\s*\{\s*public:/

    for (const relativePath of sourceInventory) {
      const source = await readFile(path.join(workspaceRoot, relativePath), 'utf8')
      expect(rawRead.test(source), relativePath).toBe(rawReadAdapters.has(relativePath))
    }
  })

  it('keeps movie and comic runtime injection typed and free of direct local app ports', async () => {
    const expectedGlobals = {
      'apps/movie-app/vite.config.ts': '__STARYE_MOVIE_PUBLIC_RUNTIME__',
      'apps/comic-app/vite.config.ts': '__STARYE_COMIC_PUBLIC_RUNTIME__',
    }

    for (const [relativePath, globalName] of Object.entries(expectedGlobals)) {
      const source = await readFile(path.join(workspaceRoot, relativePath), 'utf8')
      expect(source).toContain(globalName)
      expect(source).not.toMatch(/localhost:(?:3000|3001|3002|3003|5173|8787)/)
    }
  })
})
