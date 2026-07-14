import type {
  LocalEnvTargetFile,
  PreflightCommand,
  PreflightScope,
  ProjectionValidationIssue,
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
  resolveTargetProfile,
  runTargetPreflight,
  validateProjectedEnv,
} from '../packages/config/src/deployment-target/index.ts'

const commandNames = ['validate', 'project-local', 'preflight'] as const

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
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }

  if (!options.help && !options.target?.trim()) {
    throw new Error('Missing required --target <id>.')
  }

  return options
}

export function formatTargetProfileHelp(): string {
  return `Target profile commands:
  target-profile validate --target <id>
  target-profile project-local --target <id> --check|--write [--env-root <path>]
  target-profile preflight --target <id> --scope <local|ci|remote> --command <command> [--env-root <path>] [--live]

Preflight reads exactly the four local consumer files below --env-root, or the repository root when omitted.

Phase 11 identity boundary:
  local Wrangler profile: starye-org
  CI GitHub environment: starye-org
  CI secret bundle: starye-org
  remote credential keys: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
  Phase 11 does not change Worker, Pages, or GitHub workflow consumption.`
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

async function runProjectLocal(options: TargetProfileCliOptions): Promise<void> {
  if (options.check === options.write) {
    throw new Error('project-local requires exactly one of --check or --write.')
  }

  const resolution = resolveTargetProfile(options.target)
  const plan = buildLocalEnvProjectionPlan(resolution)
  const root = path.resolve(options.envRoot ?? process.cwd())
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

function createWranglerExecutor(): WranglerCommandExecutor {
  return {
    execute(argv) {
      const result = spawnSync('pnpm', ['exec', 'wrangler', ...argv], {
        encoding: 'utf8',
        shell: false,
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

  const root = path.resolve(options.envRoot ?? process.cwd())
  const projectionIssues = await collectPreflightProjectionIssues(options.target ?? '', root)

  const result = runTargetPreflight({
    target: options.target ?? '',
    scope: options.scope,
    command: options.command,
    ...(options.wranglerProfile ? { wranglerProfile: options.wranglerProfile } : {}),
    ...(options.ciEnvironment ? { ciEnvironment: options.ciEnvironment } : {}),
    projectionIssues,
    environment: process.env,
    live: options.live,
    ...(options.live ? { liveCheckExecutor: createWranglerExecutor() } : {}),
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
