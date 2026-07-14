import type { PreflightOptions } from '../preflight'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runTargetPreflight } from '../preflight'
import { buildLocalEnvProjectionPlan } from '../projection-plan'
import { resolveTargetProfile } from '../target-resolver'

const targetProfileCliModule = new URL('../../../../../scripts/target-profile.ts', import.meta.url).href

async function loadTargetProfileCli() {
  return import(targetProfileCliModule)
}

const fixtureSecret = 'fixture-secret-never-print'
const fixtureRoots: string[] = []

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

async function createProjectionFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'starye-target-profile-'))
  fixtureRoots.push(root)
  const plan = buildLocalEnvProjectionPlan(resolveTargetProfile('starye-org'))

  await Promise.all(plan.entries.map(async (entry) => {
    const filePath = path.join(root, entry.file)
    const content = [
      '# >>> STARYE TARGET-MANAGED BLOCK >>>',
      ...Object.entries(entry.targetManagedEntries).map(([key, value]) => `${key}=${value}`),
      '# <<< STARYE TARGET-MANAGED BLOCK <<<',
      ...entry.userManagedSecretKeys.map(key => `${key}=${fixtureSecret}`),
      '',
    ].join('\n')

    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }))

  return root
}

async function runLocalPreflight(envRoot: string): Promise<void> {
  const { runTargetProfileCli } = await loadTargetProfileCli()

  await runTargetProfileCli({
    commandName: 'preflight',
    target: 'starye-org',
    scope: 'local',
    command: 'validate',
    wranglerProfile: 'starye-org',
    envRoot,
    check: false,
    write: false,
    live: false,
    help: false,
  })
}

function createOptions(overrides: Partial<PreflightOptions> = {}): PreflightOptions {
  return {
    target: 'starye-org',
    scope: 'local',
    command: 'validate',
    wranglerProfile: 'starye-org',
    ...overrides,
  }
}

describe('runTargetPreflight', () => {
  it('returns one blocking result that combines projection, identity, and command failures', () => {
    const result = runTargetPreflight(createOptions({
      scope: 'remote',
      command: 'not-a-command' as PreflightOptions['command'],
      ciEnvironment: 'other-environment',
      projectionIssues: [
        {
          kind: 'target-managed-mismatch',
          file: 'apps/api/.dev.vars',
          key: 'STARYE_TARGET_ID',
          expected: 'starye-org',
          actual: 'different-target',
        },
      ],
    }))

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-command', blocking: true }),
      expect.objectContaining({ code: 'ci-environment-mismatch', blocking: true }),
      expect.objectContaining({ code: 'projection-mismatch', blocking: true }),
    ]))
    expect(result.issues.every(issue => issue.blocking)).toBe(true)
  })

  it.each(['default', 'prod', 'production', 'starye.org', 'api.starye.org'])(
    'rejects legacy target alias %s without falling back to starye-org',
    (target) => {
      const result = runTargetPreflight(createOptions({ target }))

      expect(result.target).toBeUndefined()
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'legacy-target-alias',
        blocking: true,
      }))
    },
  )

  it('requires an explicit target and preserves the resolver failure code', () => {
    const result = runTargetPreflight(createOptions({ target: '   ' }))

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'missing-selected-target',
      blocking: true,
    }))
  })
})

describe('target-profile CLI parser', () => {
  it('rejects a command without an explicit target', async () => {
    const { parseTargetProfileCliArgs } = await loadTargetProfileCli()

    expect(() => parseTargetProfileCliArgs(['validate'])).toThrow('Missing required --target')
  })

  it('requires explicit remote scope, command, and CI environment', async () => {
    const { parseTargetProfileCliArgs } = await loadTargetProfileCli()

    expect(parseTargetProfileCliArgs([
      'preflight',
      '--target',
      'starye-org',
      '--scope',
      'remote',
      '--command',
      'deploy',
      '--ci-environment',
      'starye-org',
      '--live',
    ])).toMatchObject({
      commandName: 'preflight',
      target: 'starye-org',
      scope: 'remote',
      command: 'deploy',
      ciEnvironment: 'starye-org',
      live: true,
    })
  })

  it('documents the separate local profile and CI credential boundary', async () => {
    const { formatTargetProfileHelp } = await loadTargetProfileCli()
    const help = formatTargetProfileHelp()

    expect(help).toContain('local Wrangler profile: starye-org')
    expect(help).toContain('CI GitHub environment: starye-org')
    expect(help).toContain('CLOUDFLARE_API_TOKEN')
    expect(help).toContain('CLOUDFLARE_ACCOUNT_ID')
  })

  it('passes local preflight only when every projected consumer is complete', async () => {
    await expect(runLocalPreflight(await createProjectionFixture())).resolves.toBeUndefined()
  })

  it.each([
    ['missing projection file', async (root: string) => rm(path.join(root, '.env.local'))],
    ['malformed marker', async (root: string) => writeFile(
      path.join(root, 'apps/api/.dev.vars'),
      `${await readFile(path.join(root, 'apps/api/.dev.vars'), 'utf8')}# >>> STARYE TARGET-MANAGED BLOCK >>>\n`,
      'utf8',
    )],
    ['wrong target-managed value', async (root: string) => writeFile(
      path.join(root, 'apps/api/.dev.vars'),
      (await readFile(path.join(root, 'apps/api/.dev.vars'), 'utf8')).replace('STARYE_TARGET_ID=starye-org', 'STARYE_TARGET_ID=wrong-target'),
      'utf8',
    )],
    ['missing user-managed secret', async (root: string) => writeFile(
      path.join(root, 'packages/crawler/.env'),
      (await readFile(path.join(root, 'packages/crawler/.env'), 'utf8')).replace(`CRAWLER_SECRET=${fixtureSecret}\n`, ''),
      'utf8',
    )],
  ])('fails closed for %s without leaking operator values', async (_name, mutate) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const root = await createProjectionFixture()
    await mutate(root)

    await expect(runLocalPreflight(root)).rejects.toThrow('Target preflight failed')
    expect(error.mock.calls.flat().join('\n')).not.toContain(fixtureSecret)
  })
})
