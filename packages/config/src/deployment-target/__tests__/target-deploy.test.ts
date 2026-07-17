/// <reference types="node" />

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildLocalEnvProjectionPlan,
  buildTargetProjections,
  materializeTargetDeployConfig,
  parseAuditedPublicRuntimeInput,
  resolveTargetProfile,
} from '../index'

const targetDeployModule = new URL('../../../../../scripts/target-deploy.ts', import.meta.url).href
const targetProfileModule = new URL('../../../../../scripts/target-profile.ts', import.meta.url).href
const roots: string[] = []

const successfulLiveCheck = {
  execute(argv: readonly string[]) {
    return {
      exitCode: 0,
      stdout: argv[0] === 'kv'
        ? 'acf49df06ae0447b82a092cf238714d8'
        : argv[0] === 'pages'
          ? 'blog-pages'
          : argv.at(-1),
    }
  },
}

async function loadTargetDeploy() {
  return import(targetDeployModule)
}

async function loadTargetProfile() {
  return import(targetProfileModule)
}

async function createProjectionRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'starye-target-deploy-fixture-'))
  roots.push(root)
  const plan = buildLocalEnvProjectionPlan(resolveTargetProfile('starye-org'))

  await Promise.all(plan.entries.map(async (entry) => {
    const filePath = path.join(root, entry.file)
    const content = [
      '# >>> STARYE TARGET-MANAGED BLOCK >>>',
      ...Object.entries(entry.targetManagedEntries).map(([key, value]) => `${key}=${value}`),
      '# <<< STARYE TARGET-MANAGED BLOCK <<<',
      ...entry.userManagedSecretKeys.map(key => `${key}=fixture-value`),
      '',
    ].join('\n')
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }))

  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('target-deploy wrapper', () => {
  it('uses the repository root when target-profile has no explicit local env root', async () => {
    const { resolveLocalEnvRoot } = await loadTargetProfile()
    const explicitRoot = path.join(tmpdir(), 'starye-explicit-env-root')

    expect(resolveLocalEnvRoot()).toBe(path.resolve(import.meta.dirname, '../../../../../'))
    expect(resolveLocalEnvRoot(explicitRoot)).toBe(path.resolve(explicitRoot))
  })

  it('requires an explicit target and accepts no caller bypasses or arbitrary argv', async () => {
    const { parseTargetDeployArgs } = await loadTargetDeploy()

    expect(() => parseTargetDeployArgs(['--app', 'api'])).toThrow('requires --target')
    expect(() => parseTargetDeployArgs(['--target', 'starye-org', '--app', 'api', '--skip-preflight', 'true'])).toThrow('Unsupported target-deploy argument')
    expect(() => parseTargetDeployArgs(['--target', 'starye-org', '--app', 'api', '--surface', 'blog'])).not.toThrow()
  })

  it('blocks before a fake deploy executor when local projection preflight fails', async () => {
    const { runTargetDeploy } = await loadTargetDeploy()
    const execute = vi.fn<(command: string, args: readonly string[]) => number>(() => 0)

    await expect(runTargetDeploy({
      target: 'starye-org',
      app: 'api',
      envRoot: await mkdtemp(path.join(tmpdir(), 'starye-empty-projection-')),
      execute,
      runId: 'blocked-run',
    })).rejects.toThrow('Target preflight failed')
    expect(execute).not.toHaveBeenCalled()
  })

  it('uses the selected Worker config as a separate argv token and cleans it up', async () => {
    const { runTargetDeploy } = await loadTargetDeploy()
    const execute = vi.fn<(command: string, args: readonly string[], environment?: NodeJS.ProcessEnv) => number>(() => 0)

    await runTargetDeploy({
      target: 'starye-org',
      app: 'api',
      envRoot: await createProjectionRoot(),
      execute,
      liveCheckExecutor: successfulLiveCheck,
      runId: 'worker-run',
    })

    expect(execute).toHaveBeenCalledTimes(1)
    const [, argv] = execute.mock.calls[0]
    expect(argv.slice(0, 6)).toEqual(['--filter', 'api', 'exec', 'wrangler', 'deploy', '--config'])
    expect(path.isAbsolute(argv[6])).toBe(true)
    expect(path.basename(argv[6])).toBe('.target-wrangler.worker-run.toml')
    expect(execute.mock.calls[0]?.[2]).toMatchObject({
      CLOUDFLARE_ACCOUNT_ID: 'd6e57b25da320fae1bd0079fb3c316d4',
    })
    expect(execute.mock.calls[0]?.[2]).not.toHaveProperty('CLOUDFLARE_API_TOKEN')
  })

  it('runs Pages through the fixed build/deploy argv and no caller project name', async () => {
    const { runTargetDeploy } = await loadTargetDeploy()
    const execute = vi.fn<(command: string, args: readonly string[]) => number>(() => 0)

    await runTargetDeploy({
      target: 'starye-org',
      app: 'blog',
      surface: 'blog',
      envRoot: await createProjectionRoot(),
      execute,
      liveCheckExecutor: successfulLiveCheck,
      runId: 'blog-run',
    })

    expect(execute.mock.calls.map(([, argv]) => argv)).toEqual([
      ['target-profile', 'run-pages-build', '--surface', 'blog', '--pages-build-env-path', expect.stringContaining('pages-build-env.blog-run.blog.env')],
      ['--filter', 'blog', 'exec', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', 'blog-pages'],
    ])
  })

  it('supports the selected Movie Pages surface through the same closed deploy path', async () => {
    const { runTargetDeploy } = await loadTargetDeploy()
    const execute = vi.fn<(command: string, args: readonly string[]) => number>(() => 0)

    await runTargetDeploy({
      target: 'starye-org',
      app: 'movie',
      surface: 'movie',
      envRoot: await createProjectionRoot(),
      execute,
      liveCheckExecutor: {
        execute(argv: readonly string[]) {
          return {
            exitCode: 0,
            stdout: argv[0] === 'kv'
              ? 'acf49df06ae0447b82a092cf238714d8'
              : argv[0] === 'pages'
                ? 'starye-movie'
                : argv.at(-1),
          }
        },
      },
      runId: 'movie-run',
    })

    expect(execute.mock.calls.map(([, argv]) => argv)).toEqual([
      ['target-profile', 'run-pages-build', '--surface', 'movie', '--pages-build-env-path', expect.stringContaining('pages-build-env.movie-run.movie.env')],
      ['--filter', '@starye/movie-app', 'exec', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', 'starye-movie'],
    ])
  })
})

describe('run-pages-build', () => {
  it('re-parses the generated file and uses a fresh allowlisted child environment', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'starye-pages-build-'))
    roots.push(root)
    const resolution = resolveTargetProfile('starye-org')
    const materialized = await materializeTargetDeployConfig({
      deploy: buildTargetProjections(resolution).deploy,
      publicRuntimeInput: parseAuditedPublicRuntimeInput(resolution, { buildMode: 'test' }),
      runId: 'pages-run',
      appDirectories: { api: path.join(root, 'api'), gateway: path.join(root, 'gateway') },
      runDirectory: path.join(root, 'run'),
      pagesSurface: 'dashboard',
    })
    const { runPagesBuild } = await loadTargetProfile()
    const execute = vi.fn<(command: string, args: readonly string[], environment: NodeJS.ProcessEnv) => number>(() => 0)

    await runPagesBuild('dashboard', materialized.pages!.buildEnvPath, execute)

    const [command, argv, environment] = execute.mock.calls[0]
    expect(command).toBe('pnpm')
    expect(argv).toEqual(['--filter', 'dashboard', 'build'])
    expect(environment).toMatchObject({
      VITE_TARGET_ID: 'starye-org',
      VITE_GATEWAY_BASE_URL: 'https://starye.org',
      VITE_API_BASE_URL: 'https://api.starye.org',
      VITE_APP_BASE_PATH: '/dashboard/',
      VITE_BUILD_MODE: 'test',
      STARYE_PAGES_BUILD_ENV_PATH: materialized.pages!.buildEnvPath,
    })
    expect(environment).not.toHaveProperty('CLOUDFLARE_API_TOKEN')
    expect(environment).not.toHaveProperty('VITE_UNREGISTERED_SECRET')
    await materialized.cleanup()
  })
})
