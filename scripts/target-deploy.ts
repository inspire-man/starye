/// <reference types="node" />

import type {
  LocalEnvTargetFile,
  ProjectionValidationIssue,
  TargetPagesSurface,
  WranglerCommandExecutor,
} from '../packages/config/src/deployment-target/index.ts'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  assertTargetManagedEnvBlockIsWellFormed,
  buildLocalEnvProjectionPlan,
  buildTargetProjections,
  materializeTargetDeployConfig,
  parseAuditedPublicRuntimeInput,
  resolveTargetProfile,
  runTargetPreflight,
  validateProjectedEnv,
} from '../packages/config/src/deployment-target/index.ts'

const deployAppValues = ['api', 'gateway', 'dashboard', 'blog'] as const

type DeployApp = (typeof deployAppValues)[number]
type CommandExecutor = (command: string, args: readonly string[]) => number

export interface TargetDeployOptions {
  readonly target: string
  readonly app: DeployApp
  readonly surface?: TargetPagesSurface
  readonly envRoot?: string
  readonly execute?: CommandExecutor
  readonly liveCheckExecutor?: WranglerCommandExecutor
  readonly runId?: string
}

function isDeployApp(value: string): value is DeployApp {
  return (deployAppValues as readonly string[]).includes(value)
}

function packageFilter(app: DeployApp): string {
  return app === 'api' ? 'api' : app === 'gateway' ? 'gateway' : app
}

function isWorkerApp(app: DeployApp): app is 'api' | 'gateway' {
  return app === 'api' || app === 'gateway'
}

function expectedSurface(app: DeployApp): TargetPagesSurface | undefined {
  return app === 'dashboard' ? 'dashboard' : app === 'blog' ? 'blog' : undefined
}

function spawnCommand(command: string, args: readonly string[]): number {
  return spawnSync(command, args, { encoding: 'utf8', shell: false }).status ?? 1
}

function createLiveCheckExecutor(): WranglerCommandExecutor {
  return {
    execute(argv) {
      const result = spawnSync('pnpm', ['exec', 'wrangler', ...argv], { encoding: 'utf8', shell: false })
      return { exitCode: result.status ?? 1, stdout: result.stdout ?? '' }
    },
  }
}

async function collectLocalProjectionIssues(target: string, root: string): Promise<ProjectionValidationIssue[]> {
  const plan = buildLocalEnvProjectionPlan(resolveTargetProfile(target))
  const contents: Partial<Record<LocalEnvTargetFile, string>> = {}
  const issues: ProjectionValidationIssue[] = []

  for (const entry of plan.entries) {
    const filePath = path.join(root, entry.file)
    try {
      const content = await readFile(filePath, 'utf8')
      assertTargetManagedEnvBlockIsWellFormed(entry.file, content)
      contents[entry.file] = content
    }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        issues.push({ kind: 'missing-projection-file', file: entry.file })
      }
      else {
        issues.push({ kind: 'malformed-target-managed-block', file: entry.file })
      }
    }
  }

  return [...issues, ...validateProjectedEnv(plan, contents)]
}

export async function runTargetDeploy(options: TargetDeployOptions): Promise<void> {
  const resolution = resolveTargetProfile(options.target)
  const expected = expectedSurface(options.app)
  if (expected !== options.surface) {
    throw new Error(expected ? `Deploy app ${options.app} requires --surface ${expected}.` : 'Worker deploy must not accept --surface.')
  }

  const projectionIssues = await collectLocalProjectionIssues(options.target, path.resolve(options.envRoot ?? process.cwd()))
  const preflight = runTargetPreflight({
    target: options.target,
    scope: 'local',
    command: 'deploy',
    wranglerProfile: resolution.profile.local.wranglerProfile,
    projectionIssues,
    environment: process.env,
    live: true,
    liveCheckExecutor: options.liveCheckExecutor ?? createLiveCheckExecutor(),
    ...(options.surface ? { pagesSurface: options.surface } : {}),
  })
  if (!preflight.ok) {
    throw new Error('Target preflight failed.')
  }

  const root = path.resolve(import.meta.dirname, '..')
  const materialized = await materializeTargetDeployConfig({
    deploy: buildTargetProjections(resolution).deploy,
    publicRuntimeInput: parseAuditedPublicRuntimeInput(resolution, { buildMode: 'local' }),
    runId: options.runId ?? randomUUID(),
    appDirectories: {
      api: path.join(root, 'apps', 'api'),
      gateway: path.join(root, 'apps', 'gateway'),
    },
    runDirectory: path.join(root, '.target-runs'),
    ...(options.surface ? { pagesSurface: options.surface } : {}),
  })
  const execute = options.execute ?? spawnCommand

  try {
    if (isWorkerApp(options.app)) {
      const configPath = options.app === 'api' ? materialized.apiConfigPath : materialized.gatewayConfigPath
      if (execute('pnpm', ['--filter', packageFilter(options.app), 'exec', 'wrangler', 'deploy', '--config', configPath]) !== 0) {
        throw new Error(`Worker deploy failed for ${options.app}.`)
      }
      return
    }

    if (!materialized.pages || !options.surface) {
      throw new Error('Selected Pages deploy configuration is missing.')
    }
    if (execute('pnpm', ['target-profile', 'run-pages-build', '--surface', options.surface, '--pages-build-env-path', materialized.pages.buildEnvPath]) !== 0) {
      throw new Error(`Pages build failed for ${options.app}.`)
    }
    if (execute('pnpm', ['--filter', packageFilter(options.app), 'exec', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', materialized.pages.project]) !== 0) {
      throw new Error(`Pages deploy failed for ${options.app}.`)
    }
  }
  finally {
    await materialized.cleanup()
  }
}

export function parseTargetDeployArgs(argv: readonly string[]): TargetDeployOptions {
  let target: string | undefined
  let app: DeployApp | undefined
  let surface: TargetPagesSurface | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}.`)
    }
    index += 1
    if (flag === '--target')
      target = value
    else if (flag === '--app' && isDeployApp(value))
      app = value
    else if (flag === '--surface' && ['dashboard', 'auth', 'blog', 'movie', 'comic', 'tavern'].includes(value))
      surface = value as TargetPagesSurface
    else throw new Error(`Unsupported target-deploy argument: ${flag}.`)
  }

  if (!target?.trim() || !app) {
    throw new Error('target-deploy requires --target and a closed --app.')
  }

  return { target, app, ...(surface ? { surface } : {}) }
}

async function main(): Promise<void> {
  try {
    await runTargetDeploy(parseTargetDeployArgs(process.argv.slice(2)))
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
