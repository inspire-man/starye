/// <reference types="node" />

import type { MaterializedTargetDeployConfig, TargetDeployDirectories } from './deploy-config'
import type { WranglerCommandResult } from './live-checks'
import type { TargetPagesSurface } from './target-profile.schema'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { materializeTargetDeployConfig } from './deploy-config'
import { runTargetPreflight } from './preflight'
import { parseAuditedPublicRuntimeInput } from './public-runtime-input'
import { buildTargetProjections, isTargetPagesSurface } from './target-projections'
import { resolveTargetProfile } from './target-resolver'

export const targetRemoteEntryValues = [
  'd1-migrate',
  'd1-migrate-movies-metadata',
  'd1-cleanup-backup-preview',
  'd1-cleanup-backup-execute',
  'd1-cleanup-invalid-covers',
  'crawler-comic',
  'crawler-optimized',
  'crawler-actor',
  'crawler-publisher',
  'crawler-search-index',
  'crawler-enrich-players',
  'crawler-check-config',
  'crawler-backfill-covers',
  'crawler-backfill-publishers',
  'crawler-enrich-players-javbus',
  'crawler-r2-storage-audit',
  'monthly-cleanup',
] as const

export type TargetRemoteEntry = (typeof targetRemoteEntryValues)[number]
export type TargetMutationScope = 'ci' | 'remote'
export type TargetMutationCommand = 'worker-deploy' | 'pages-deploy' | 'pages-rollback' | TargetRemoteEntry

export interface PrepareTargetMutationRequest {
  readonly target: string
  readonly scope: TargetMutationScope
  readonly command: TargetMutationCommand
  readonly ciEnvironment?: string
  readonly pagesSurface?: TargetPagesSurface
  readonly environment: Readonly<Record<string, string | undefined>>
  readonly runId: string
  readonly appDirectories: TargetDeployDirectories
  readonly runDirectory: string
  readonly githubOutput?: string
}

export interface TargetMutationPreparation {
  readonly targetId: string
  readonly githubEnvironment: string
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
  readonly preparedContextPath: string
  readonly runId: string
  readonly pages?: Readonly<{ surface: TargetPagesSurface, project: string, buildEnvPath: string }>
  readonly identity: Readonly<{ apiUrl: string, d1Name: string, r2Name: string, accountId: string }>
  cleanup: () => Promise<void>
}

export interface MutationPreparationDependencies {
  readonly executeReadOnly: (argv: readonly string[]) => WranglerCommandResult
  readonly materialize?: (request: Parameters<typeof materializeTargetDeployConfig>[0]) => Promise<MaterializedTargetDeployConfig>
}

export interface PreparedMutationExecution {
  readonly entry: TargetRemoteEntry
  readonly preparedContextPath: string
  readonly execute: (command: string, args: readonly string[], environment: NodeJS.ProcessEnv) => number
}

const targetIdentityKeys = new Set([
  'API_URL',
  'DATABASE_URL',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'R2_ACCOUNT_ID',
  'STARYE_TARGET_ID',
])

function isTargetRemoteEntry(value: string): value is TargetRemoteEntry {
  return (targetRemoteEntryValues as readonly string[]).includes(value)
}

function commandForPreflight(command: TargetMutationCommand): 'deploy' | 'pages-deploy' | 'pages-rollback' | 'migrate' | 'remote-crawl' {
  if (command === 'worker-deploy')
    return 'deploy'
  if (command === 'pages-deploy')
    return 'pages-deploy'
  if (command === 'pages-rollback')
    return 'pages-rollback'
  if (command.startsWith('crawler-'))
    return 'remote-crawl'
  return 'migrate'
}

function assertNoAmbientTargetIdentity(environment: Readonly<Record<string, string | undefined>>): void {
  for (const [key, value] of Object.entries(environment)) {
    if (value && (targetIdentityKeys.has(key) || /^VITE_|^NUXT_PUBLIC_/.test(key))) {
      throw new Error('Ambient target identity is not allowed for remote mutation preparation.')
    }
  }
}

function assertPreparedPath(runDirectory: string, pathname: string): string {
  const root = path.resolve(runDirectory)
  const candidate = path.resolve(pathname)
  if (path.dirname(candidate) !== root || !candidate.endsWith('.json')) {
    throw new Error('Prepared context path is outside the validated run directory.')
  }
  return candidate
}

function outputLines(prepared: TargetMutationPreparation): string[] {
  return [
    `target_id=${prepared.targetId}`,
    `github_environment=${prepared.githubEnvironment}`,
    `api_config_path=${prepared.apiConfigPath}`,
    `gateway_config_path=${prepared.gatewayConfigPath}`,
    `prepared_context_path=${prepared.preparedContextPath}`,
    ...(prepared.pages ? [`pages_project=${prepared.pages.project}`, `pages_build_env_path=${prepared.pages.buildEnvPath}`] : []),
  ]
}

export async function prepareTargetMutation(
  request: PrepareTargetMutationRequest,
  dependencies: MutationPreparationDependencies,
): Promise<TargetMutationPreparation> {
  if (request.scope === 'remote') {
    assertNoAmbientTargetIdentity(request.environment)
  }
  if (request.scope === 'ci' && !request.githubOutput) {
    throw new Error('CI mutation preparation requires --github-output.')
  }
  if ((request.command === 'pages-deploy' || request.command === 'pages-rollback') && !isTargetPagesSurface(request.pagesSurface)) {
    throw new Error('Pages mutation commands require a valid selected surface.')
  }

  const resolution = resolveTargetProfile(request.target)
  const preflight = runTargetPreflight({
    target: request.target,
    scope: request.scope,
    command: commandForPreflight(request.command),
    ciEnvironment: request.ciEnvironment,
    environment: request.environment,
    live: true,
    liveCheckExecutor: { execute: dependencies.executeReadOnly },
    ...(request.pagesSurface ? { pagesSurface: request.pagesSurface } : {}),
  })
  if (!preflight.ok) {
    throw new Error(`Target mutation preflight failed: ${preflight.issues.map(issue => issue.code).join(', ')}`)
  }

  const materialize = dependencies.materialize ?? materializeTargetDeployConfig
  const materialized = await materialize({
    deploy: buildTargetProjections(resolution).deploy,
    publicRuntimeInput: parseAuditedPublicRuntimeInput(resolution, { buildMode: request.scope }),
    runId: request.runId,
    appDirectories: request.appDirectories,
    runDirectory: request.runDirectory,
    ...(request.pagesSurface ? { pagesSurface: request.pagesSurface } : {}),
  })
  const preparedContextPath = assertPreparedPath(request.runDirectory, path.join(request.runDirectory, `prepared-context.${request.runId}.json`))
  const prepared: TargetMutationPreparation = {
    targetId: resolution.id,
    githubEnvironment: resolution.profile.ci.githubEnvironment,
    apiConfigPath: materialized.apiConfigPath,
    gatewayConfigPath: materialized.gatewayConfigPath,
    preparedContextPath,
    runId: request.runId,
    ...(materialized.pages ? { pages: { surface: materialized.pages.surface, project: materialized.pages.project, buildEnvPath: materialized.pages.buildEnvPath } } : {}),
    identity: {
      apiUrl: resolution.profile.urls.api,
      d1Name: resolution.profile.resources.d1.name,
      r2Name: resolution.profile.resources.r2.name,
      accountId: resolution.profile.account.id,
    },
    cleanup: materialized.cleanup,
  }
  await mkdir(path.dirname(preparedContextPath), { recursive: true })
  await writeFile(preparedContextPath, JSON.stringify({ ...prepared, cleanup: undefined }), 'utf8')

  if (request.githubOutput) {
    await writeFile(request.githubOutput, `${outputLines(prepared).join('\n')}\n`, { encoding: 'utf8', flag: 'a' })
  }

  return prepared
}

function fixedEntryCommand(entry: TargetRemoteEntry): readonly string[] | undefined {
  if (entry === 'd1-migrate-movies-metadata')
    return undefined
  if (entry.startsWith('crawler-'))
    return ['--filter', '@starye/crawler', 'run', entry]
  if (entry === 'monthly-cleanup')
    return ['run', 'monthly-cleanup']
  return ['--filter', '@starye/db', 'run', entry]
}

export async function runPreparedTargetMutation(request: PreparedMutationExecution): Promise<void> {
  if (!isTargetRemoteEntry(request.entry)) {
    throw new Error('Unknown prepared target entry.')
  }
  let prepared: TargetMutationPreparation
  try {
    prepared = JSON.parse(await readFile(request.preparedContextPath, 'utf8')) as TargetMutationPreparation
  }
  catch {
    throw new Error('Prepared context is invalid or unavailable.')
  }
  if (!prepared.targetId || !path.isAbsolute(prepared.apiConfigPath) || !path.isAbsolute(prepared.gatewayConfigPath)) {
    throw new Error('Prepared context is invalid or unavailable.')
  }
  const args = fixedEntryCommand(request.entry)
  if (!args) {
    throw new Error(`Prepared entry ${request.entry} is reserved until its fixed child is delivered.`)
  }
  const environment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_OPTIONS: process.env.NODE_OPTIONS,
    CLOUDFLARE_ACCOUNT_ID: prepared.identity.accountId,
    STARYE_PREPARED_CONTEXT_PATH: request.preparedContextPath,
    STARYE_API_CONFIG_PATH: prepared.apiConfigPath,
    STARYE_GATEWAY_CONFIG_PATH: prepared.gatewayConfigPath,
  }
  if (request.execute('pnpm', args, environment) !== 0) {
    throw new Error(`Prepared target entry failed: ${request.entry}.`)
  }
}
