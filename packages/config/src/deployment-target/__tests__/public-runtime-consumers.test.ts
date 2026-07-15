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
] as const

const rawReadAdapters = new Set([
  'apps/auth/nuxt.config.ts',
  'apps/blog/nuxt.config.ts',
  'apps/dashboard/vite.config.ts',
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

async function materializeGeneratedEnv(surface: 'dashboard' | 'auth' | 'blog') {
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

    const dashboard = parseVitePublicRuntimeEnv(dashboardGenerated, 'dashboard')
    const auth = parseNuxtPublicRuntimeEnv(authGenerated, 'auth')

    expect(buildVitePublicRuntimeEnv(dashboard, 'dashboard')).toEqual(dashboardGenerated)
    expect(buildNuxtPublicRuntimeEnv(auth, 'auth')).toEqual(authGenerated)
    expect(dashboard.publicRuntime.gatewayBaseUrl).toBe('https://starye.org')
    expect(auth.publicRuntime.appBasePaths.auth).toBe('/auth/')
  })

  it('rejects cross-framework, missing, unregistered, and credential-shaped generated keys before adapter serialization', async () => {
    const dashboardGenerated = await materializeGeneratedEnv('dashboard')
    const secret = 'token-must-not-appear'

    expect(() => parseVitePublicRuntimeEnv({
      ...dashboardGenerated,
      NUXT_PUBLIC_API_BASE_URL: 'https://cross-framework.example',
    }, 'dashboard')).toThrow('cross-framework')
    expect(() => parseVitePublicRuntimeEnv({
      ...dashboardGenerated,
      VITE_UNREGISTERED_SECRET: secret,
    }, 'dashboard')).toThrow('unregistered')
    expect(() => parseVitePublicRuntimeEnv({
      ...dashboardGenerated,
      VITE_API_BASE_URL: undefined,
    }, 'dashboard')).toThrow('missing')
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
})
