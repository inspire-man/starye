/// <reference types="node" />

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildTargetProjections,
  materializeTargetDeployConfig,
  parseAuditedPublicRuntimeInput,
  parsePagesBuildEnv,
} from '../index'
import { resolveTargetProfile } from '../target-resolver'

const roots: string[] = []

async function createFixtureRoot(): Promise<{
  root: string
  apiDir: string
  gatewayDir: string
  runDir: string
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-target-deploy-'))
  roots.push(root)
  const apiDir = path.join(root, 'apps', 'api')
  const gatewayDir = path.join(root, 'apps', 'gateway')
  const runDir = path.join(root, '.run')
  await Promise.all([mkdir(apiDir, { recursive: true }), mkdir(gatewayDir, { recursive: true }), mkdir(runDir, { recursive: true })])
  await writeFile(path.join(apiDir, 'wrangler.toml'), 'main = "src/index.ts"\ncompatibility_date = "2024-04-01"\n', 'utf8')
  await writeFile(path.join(gatewayDir, 'wrangler.toml'), 'main = "src/index.ts"\n[dev]\nport = 8080\n', 'utf8')
  return { root, apiDir, gatewayDir, runDir }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('target deploy config materializer', () => {
  it('writes selected Worker configs beside their target-neutral templates and cleans them up', async () => {
    const fixture = await createFixtureRoot()
    const resolution = resolveTargetProfile('starye-org')
    const result = await materializeTargetDeployConfig({
      deploy: buildTargetProjections(resolution).deploy,
      publicRuntimeInput: parseAuditedPublicRuntimeInput(resolution, { buildMode: 'production' }),
      runId: 'run-123',
      appDirectories: { api: fixture.apiDir, gateway: fixture.gatewayDir },
      runDirectory: fixture.runDir,
      pagesSurface: 'dashboard',
    })

    expect(path.dirname(result.apiConfigPath)).toBe(fixture.apiDir)
    expect(path.basename(result.apiConfigPath)).toBe('.target-wrangler.run-123.toml')
    expect(path.dirname(result.gatewayConfigPath)).toBe(fixture.gatewayDir)
    expect(path.basename(result.gatewayConfigPath)).toBe('.target-wrangler.run-123.toml')
    const apiConfig = await readFile(result.apiConfigPath, 'utf8')
    expect(apiConfig).toContain('main = "src/index.ts"')
    expect(apiConfig).toContain('migrations_dir = "../../packages/db/drizzle"')
    expect(apiConfig).toContain('name = "starye-api"')
    expect(apiConfig).toContain('database_name = "starye-db"')
    expect(result.pages).toMatchObject({ surface: 'dashboard', project: 'starye-dashboard' })
    expect(await parsePagesBuildEnv(result.pages!.buildEnvPath, 'dashboard')).toEqual({
      VITE_TARGET_ID: 'starye-org',
      VITE_GATEWAY_BASE_URL: 'https://starye.org',
      VITE_API_BASE_URL: 'https://api.starye.org',
      VITE_APP_BASE_PATH: '/dashboard/',
      VITE_BUILD_MODE: 'production',
    })

    await result.cleanup()
    await expect(readFile(result.apiConfigPath, 'utf8')).rejects.toThrow()
    await expect(readFile(result.pages!.buildEnvPath, 'utf8')).rejects.toThrow()
  })

  it('only serializes the selected surface public allowlist and rejects hostile dotenv input', async () => {
    const fixture = await createFixtureRoot()
    const resolution = resolveTargetProfile('starye-org')
    const result = await materializeTargetDeployConfig({
      deploy: buildTargetProjections(resolution).deploy,
      publicRuntimeInput: parseAuditedPublicRuntimeInput(resolution, {
        buildMode: 'production',
        monitoringEnabled: true,
      }),
      runId: 'run-456',
      appDirectories: { api: fixture.apiDir, gateway: fixture.gatewayDir },
      runDirectory: fixture.runDir,
      pagesSurface: 'movie',
    })
    const parsed = await parsePagesBuildEnv(result.pages!.buildEnvPath, 'movie')

    expect(Object.keys(parsed).sort()).toEqual([
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
      'VITE_TARGET_ID',
    ])

    const hostilePath = path.join(fixture.runDir, 'hostile.env')
    await writeFile(hostilePath, 'VITE_TARGET_ID=\'starye-org\'\nVITE_UNREGISTERED_SECRET=\'token-value\'\n', 'utf8')
    await expect(parsePagesBuildEnv(hostilePath, 'dashboard')).rejects.toThrow('Unknown Pages build env key')
  })
})
