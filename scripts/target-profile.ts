import type {
  LocalEnvTargetFile,
  PreflightCommand,
  PreflightScope,
  ProjectionValidationIssue,
  TargetMutationCommand,
  TargetPagesSurface,
  TargetRemoteEntry,
  WranglerCommandExecutor,
} from '../packages/config/src/deployment-target/index.ts'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  applyTargetManagedEnvBlock,
  assertTargetManagedEnvBlockIsWellFormed,
  buildLocalEnvProjectionPlan,
  isTargetPagesSurface,
  parsePagesBuildEnv,
  prepareTargetMutation,
  resolveTargetProfile,
  runPreparedTargetMutation,
  runTargetPreflight,
  validateProjectedEnv,
} from '../packages/config/src/deployment-target/index.ts'
import { packageManagerInvocation } from './package-manager-command.ts'

const commandNames = ['validate', 'project-local', 'preflight', 'run-pages-build', 'prepare-mutation', 'run-prepared-entry'] as const
const repositoryRoot = path.resolve(import.meta.dirname, '..')

export type TargetProfileCliCommand = (typeof commandNames)[number]

export interface TargetProfileCliOptions {
  commandName: TargetProfileCliCommand
  target?: string
  check: boolean
  write: boolean
  scope?: PreflightScope
  command?: PreflightCommand
  live: boolean
  wranglerProfile?: string
  ciEnvironment?: string
  envRoot?: string
  pagesSurface?: TargetPagesSurface
  pagesBuildEnvPath?: string
  mutationCommand?: TargetMutationCommand
  githubOutput?: string
  entry?: TargetRemoteEntry
  preparedContextPath?: string
  help: boolean
}

function readFlagValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1]

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`)
  }

  return value
}

export function parseTargetProfileCliArgs(argv: readonly string[]): TargetProfileCliOptions {
  const commandName = argv[0]

  if (!commandName || !commandNames.includes(commandName as TargetProfileCliCommand)) {
    throw new Error('Expected one command: validate, project-local, preflight.')
  }

  const options: TargetProfileCliOptions = {
    commandName: commandName as TargetProfileCliCommand,
    check: false,
    write: false,
    live: false,
    help: false,
  }

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index]
    const [flag, inlineValue] = arg.startsWith('--') && arg.includes('=')
      ? arg.split(/=(.*)/s, 2)
      : [arg, undefined]
    const consumeValue = (): string => {
      if (inlineValue !== undefined) {
        return inlineValue
      }

      const value = readFlagValue(argv, index, flag)
      index += 1
      return value
    }

    switch (flag) {
      case '--help':
        options.help = true
        if (inlineValue === undefined) {
          continue
        }
        throw new Error('--help does not accept a value')
      case '--check':
        options.check = true
        if (inlineValue === undefined) {
          continue
        }
        throw new Error('--check does not accept a value')
      case '--write':
        options.write = true
        if (inlineValue === undefined) {
          continue
        }
        throw new Error('--write does not accept a value')
      case '--live':
        options.live = true
        if (inlineValue === undefined) {
          continue
        }
        throw new Error('--live does not accept a value')
      case '--target':
        options.target = consumeValue()
        break
      case '--scope':
        options.scope = consumeValue() as PreflightScope
        break
      case '--command':
        options.command = consumeValue() as PreflightCommand
        options.mutationCommand = options.command as TargetMutationCommand
        break
      case '--wrangler-profile':
        options.wranglerProfile = consumeValue()
        break
      case '--ci-environment':
        options.ciEnvironment = consumeValue()
        break
      case '--env-root':
        options.envRoot = consumeValue()
        break
      case '--surface': {
        const surface = consumeValue()
        if (!isTargetPagesSurface(surface)) {
          throw new Error('Unknown Pages surface.')
        }
        options.pagesSurface = surface
        break
      }
      case '--pages-build-env-path':
        options.pagesBuildEnvPath = consumeValue()
        break
      case '--github-output':
        options.githubOutput = consumeValue()
        break
      case '--prepared-context':
        options.preparedContextPath = consumeValue()
        break
      case '--entry':
        options.entry = consumeValue() as TargetRemoteEntry
        break
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }

  if (!options.help && !['run-pages-build', 'run-prepared-entry'].includes(options.commandName) && !options.target?.trim()) {
    throw new Error('Missing required --target <id>.')
  }

  return options
}

export function formatTargetProfileHelp(): string {
  return `Target profile commands:
  target-profile validate --target <id>
  target-profile project-local --target <id> --check|--write [--env-root <path>]
  target-profile preflight --target <id> --scope <local|ci|remote> --command <command> [--env-root <path>] [--live]
  target-profile run-pages-build --surface <dashboard|auth|blog|movie|comic> --pages-build-env-path <generated-path>
  target-profile prepare-mutation --target <id> --scope ci --command <closed-command> --ci-environment <name> --github-output <path> [--surface <surface>]
  target-profile run-prepared-entry --entry <closed-entry> --prepared-context <generated-path>

Preflight reads exactly the four local consumer files below --env-root, or the repository root when omitted.

Phase 11 identity boundary:
  local Wrangler profile: starye-org
  CI GitHub environment: starye-org
  CI secret bundle: starye-org
  remote credential keys: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
  Phase 11 does not change Worker, Pages, or GitHub workflow consumption.`
}

type PagesBuildExecutor = (command: string, args: readonly string[], environment: NodeJS.ProcessEnv) => number

function pickRuntimeEnvironment(): NodeJS.ProcessEnv {
  const names = process.platform === 'win32'
    ? ['Path', 'SystemRoot', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'CI', 'NODE_OPTIONS', 'PNPM_HOME']
    : ['PATH', 'HOME', 'TMPDIR', 'CI', 'NODE_OPTIONS', 'PNPM_HOME']
  const selected: NodeJS.ProcessEnv = {}

  for (const name of names) {
    const value = process.env[name]
    if (value !== undefined) {
      selected[name] = value
    }
  }

  return selected
}

function pagesBuildArgs(surface: TargetPagesSurface): readonly string[] {
  switch (surface) {
    case 'dashboard': return ['--filter', 'dashboard', 'build']
    case 'auth': return ['--filter', 'starye-auth', 'build']
    case 'blog': return ['--filter', 'blog', 'build']
    case 'movie': return ['--filter', '@starye/movie-app', 'build']
    case 'comic': return ['--filter', '@starye/comic-app', 'build']
    case 'tavern': throw new Error('Tavern has no registered Pages build command.')
  }
}

function spawnPagesBuild(command: string, args: readonly string[], environment: NodeJS.ProcessEnv): number {
  const invocation = command === 'pnpm'
    ? packageManagerInvocation(args)
    : { command, args }
  const result = spawnSync(invocation.command, invocation.args, {
    encoding: 'utf8',
    env: environment,
    shell: false,
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  if (result.error) {
    console.error(`Pages build command failed to start: ${result.error.message}`)
  }

  return result.status ?? 1
}

export async function runPagesBuild(
  surface: TargetPagesSurface,
  pagesBuildEnvPath: string,
  execute: PagesBuildExecutor = spawnPagesBuild,
): Promise<void> {
  const parsed = await parsePagesBuildEnv(pagesBuildEnvPath, surface)
  const environment: NodeJS.ProcessEnv = {
    ...pickRuntimeEnvironment(),
    ...parsed,
    STARYE_PAGES_BUILD_ENV_PATH: pagesBuildEnvPath,
  }
  const status = execute('pnpm', pagesBuildArgs(surface), environment)

  if (status !== 0) {
    throw new Error(`Pages build failed for ${surface}.`)
  }
}

async function runPrepareMutation(options: TargetProfileCliOptions): Promise<void> {
  if (options.scope !== 'ci' || !options.mutationCommand || !options.ciEnvironment || !options.githubOutput) {
    throw new Error('prepare-mutation requires CI scope, --command, --ci-environment, and --github-output.')
  }
  if ((options.mutationCommand === 'pages-deploy' || options.mutationCommand === 'pages-rollback') && !options.pagesSurface) {
    throw new Error('Pages prepare-mutation requires --surface.')
  }
  const root = path.resolve(import.meta.dirname, '..')
  await prepareTargetMutation({
    target: options.target ?? '',
    scope: 'ci',
    command: options.mutationCommand,
    ciEnvironment: options.ciEnvironment,
    environment: process.env,
    githubOutput: options.githubOutput,
    runId: `ci-${process.pid}`,
    appDirectories: { api: path.join(root, 'apps/api'), gateway: path.join(root, 'apps/gateway') },
    runDirectory: path.join(root, '.target-runs'),
    ...(options.pagesSurface ? { pagesSurface: options.pagesSurface } : {}),
  }, { executeReadOnly: createWranglerExecutor().execute })
}

async function runPreparedEntry(options: TargetProfileCliOptions): Promise<void> {
  if (!options.entry || !options.preparedContextPath) {
    throw new Error('run-prepared-entry requires --entry and --prepared-context.')
  }
  await runPreparedTargetMutation({
    entry: options.entry,
    preparedContextPath: options.preparedContextPath,
    execute: (command, args, environment) => {
      const child = spawnSync(command, args, { encoding: 'utf8', shell: false, env: environment })
      return {
        exitCode: child.status ?? 1,
        stdout: child.stdout ?? '',
        stderr: child.stderr ?? '',
      }
    },
  })
}

function printProfileValidation(target: string): void {
  const resolution = resolveTargetProfile(target)
  console.log(`Validated target profile: ${resolution.id}`)
  console.log(`Local Wrangler profile: ${resolution.profile.local.wranglerProfile}`)
  console.log(`CI GitHub environment: ${resolution.profile.ci.githubEnvironment}`)
  console.log(`D1 resource: ${resolution.profile.resources.d1.name}`)
  console.log(`R2 resource: ${resolution.profile.resources.r2.name}`)
  console.log(`KV resource: ${resolution.profile.resources.kv.id}`)
}

async function readEnvFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8')
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return ''
    }
    throw error
  }
}

export function resolveLocalEnvRoot(envRoot?: string): string {
  return path.resolve(envRoot ?? repositoryRoot)
}

async function runProjectLocal(options: TargetProfileCliOptions): Promise<void> {
  if (options.check === options.write) {
    throw new Error('project-local requires exactly one of --check or --write.')
  }

  const resolution = resolveTargetProfile(options.target)
  const plan = buildLocalEnvProjectionPlan(resolution)
  const root = resolveLocalEnvRoot(options.envRoot)
  const contents: Partial<Record<LocalEnvTargetFile, string>> = {}

  for (const entry of plan.entries) {
    const filePath = path.join(root, entry.file)
    const content = await readEnvFile(filePath)
    contents[entry.file] = content

    if (options.write) {
      const update = applyTargetManagedEnvBlock(entry.file, content, entry.targetManagedEntries)

      if (update.changed) {
        await mkdir(path.dirname(filePath), { recursive: true })
        await writeFile(filePath, update.content, 'utf8')
      }

      console.log(`${update.changed ? 'Projected' : 'Already projected'}: ${entry.file}`)
    }
  }

  if (options.check) {
    const issues = validateProjectedEnv(plan, contents)
      .filter(issue => issue.kind === 'target-managed-mismatch')

    if (issues.length > 0) {
      for (const issue of issues) {
        console.error(`projection-mismatch: ${issue.file}: ${issue.key}`)
      }
      throw new Error(`Target-managed projection check failed for ${resolution.id}.`)
    }

    console.log(`Target-managed projection check passed: ${resolution.id}`)
  }
}

function createWranglerExecutor(environment: NodeJS.ProcessEnv = process.env): WranglerCommandExecutor {
  return {
    execute(argv) {
      const invocation = packageManagerInvocation(['exec', 'wrangler', ...argv])
      const result = spawnSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        shell: false,
        cwd: repositoryRoot,
        env: environment,
      })

      return {
        exitCode: result.status ?? 1,
        stdout: result.stdout ?? '',
      }
    },
  }
}

async function collectPreflightProjectionIssues(
  target: string,
  envRoot: string,
): Promise<ProjectionValidationIssue[]> {
  const plan = buildLocalEnvProjectionPlan(resolveTargetProfile(target))
  const contents: Partial<Record<LocalEnvTargetFile, string>> = {}
  const issues: ProjectionValidationIssue[] = []

  for (const entry of plan.entries) {
    const filePath = path.join(envRoot, entry.file)

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

async function runPreflight(options: TargetProfileCliOptions): Promise<void> {
  if (!options.scope || !options.command) {
    throw new Error('preflight requires --scope and --command.')
  }

  const root = resolveLocalEnvRoot(options.envRoot)
  const projectionIssues = options.scope === 'local'
    ? await collectPreflightProjectionIssues(options.target ?? '', root)
    : []
  const localEnvironment = options.scope === 'local'
    ? { ...pickRuntimeEnvironment(), CLOUDFLARE_ACCOUNT_ID: resolveTargetProfile(options.target ?? '').profile.account.id }
    : process.env

  const result = runTargetPreflight({
    target: options.target ?? '',
    scope: options.scope,
    command: options.command,
    ...(options.wranglerProfile ? { wranglerProfile: options.wranglerProfile } : {}),
    ...(options.ciEnvironment ? { ciEnvironment: options.ciEnvironment } : {}),
    projectionIssues,
    environment: localEnvironment,
    live: options.live,
    ...(options.live ? { liveCheckExecutor: createWranglerExecutor(localEnvironment) } : {}),
  })

  if (!result.ok) {
    for (const issue of result.issues) {
      console.error(`${issue.code}: ${issue.message}`)
    }
    throw new Error('Target preflight failed.')
  }

  console.log(`Target preflight passed: ${result.target?.id ?? options.target}`)
}

export async function runTargetProfileCli(options: TargetProfileCliOptions): Promise<void> {
  if (options.help) {
    console.log(formatTargetProfileHelp())
    return
  }

  switch (options.commandName) {
    case 'validate':
      printProfileValidation(options.target ?? '')
      return
    case 'project-local':
      await runProjectLocal(options)
      return
    case 'preflight':
      await runPreflight(options)
      return
    case 'run-pages-build':
      if (!options.pagesSurface || !options.pagesBuildEnvPath) {
        throw new Error('run-pages-build requires --surface and --pages-build-env-path.')
      }
      await runPagesBuild(options.pagesSurface, options.pagesBuildEnvPath)
      return
    case 'prepare-mutation':
      await runPrepareMutation(options)
      return
    case 'run-prepared-entry':
      await runPreparedEntry(options)
  }
}

async function main(): Promise<void> {
  try {
    await runTargetProfileCli(parseTargetProfileCliArgs(process.argv.slice(2)))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Target profile command failed: ${message}`)
    process.exitCode = 1
  }
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectExecution) {
  void main()
}
