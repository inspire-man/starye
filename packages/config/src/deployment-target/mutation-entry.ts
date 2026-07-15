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

export type TargetRemoteEntryFamily = 'db' | 'crawler' | 'maintenance'
export type TargetRemoteEntryMode = 'mutation' | 'read-only' | 'diagnostic'

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

export interface TargetRemoteEntryDefinition {
  readonly id: TargetRemoteEntry
  readonly family: TargetRemoteEntryFamily
  readonly mode: TargetRemoteEntryMode
  readonly childModule: 'packages/db/scripts/target-d1-mutation.ts' | 'packages/crawler/scripts/target-crawl-mutation.ts'
  readonly childOperation: string
  readonly allowedOptions: readonly string[]
  readonly requiredSecretKeys: readonly string[]
}

function dbEntry(id: TargetRemoteEntry, childOperation: string, mode: TargetRemoteEntryMode = 'mutation'): TargetRemoteEntryDefinition {
  return {
    id,
    family: 'db',
    mode,
    childModule: 'packages/db/scripts/target-d1-mutation.ts',
    childOperation,
    allowedOptions: [],
    requiredSecretKeys: ['CLOUDFLARE_API_TOKEN'],
  }
}

function crawlerEntry(id: TargetRemoteEntry, childOperation: string, mode: TargetRemoteEntryMode = 'mutation', allowedOptions: readonly string[] = []): TargetRemoteEntryDefinition {
  return {
    id,
    family: 'crawler',
    mode,
    childModule: 'packages/crawler/scripts/target-crawl-mutation.ts',
    childOperation,
    allowedOptions,
    requiredSecretKeys: ['CRAWLER_SECRET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
  }
}

export const targetRemoteEntryDefinitions = [
  dbEntry('d1-migrate', 'migrate'),
  dbEntry('d1-migrate-movies-metadata', 'migrate-movies-metadata'),
  dbEntry('d1-cleanup-backup-preview', 'cleanup-backup-preview', 'read-only'),
  dbEntry('d1-cleanup-backup-execute', 'cleanup-backup-execute'),
  dbEntry('d1-cleanup-invalid-covers', 'cleanup-invalid-covers'),
  crawlerEntry('crawler-comic', 'comic', 'mutation', ['url', 'limit', 'dry-run']),
  crawlerEntry('crawler-optimized', 'optimized', 'mutation', ['limit', 'dry-run']),
  crawlerEntry('crawler-actor', 'actor', 'mutation', ['limit', 'dry-run']),
  crawlerEntry('crawler-publisher', 'publisher', 'mutation', ['limit', 'dry-run']),
  crawlerEntry('crawler-search-index', 'search-index'),
  crawlerEntry('crawler-enrich-players', 'enrich-players', 'mutation', ['limit', 'dry-run']),
  crawlerEntry('crawler-check-config', 'check-config', 'diagnostic'),
  crawlerEntry('crawler-backfill-covers', 'backfill-covers', 'mutation', ['limit', 'dry-run']),
  crawlerEntry('crawler-backfill-publishers', 'backfill-publishers', 'mutation', ['limit', 'dry-run']),
  crawlerEntry('crawler-enrich-players-javbus', 'enrich-players-javbus', 'mutation', ['limit', 'dry-run']),
  crawlerEntry('crawler-r2-storage-audit', 'r2-storage-audit', 'read-only', ['prefix', 'sample-limit', 'dry-run']),
  {
    id: 'monthly-cleanup',
    family: 'maintenance',
    mode: 'mutation',
    childModule: 'packages/db/scripts/target-d1-mutation.ts',
    childOperation: 'monthly-cleanup',
    allowedOptions: [],
    requiredSecretKeys: ['CLOUDFLARE_API_TOKEN'],
  },
] as const satisfies readonly TargetRemoteEntryDefinition[]

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

function resolveTargetRemoteEntryDefinition(entry: TargetRemoteEntry): TargetRemoteEntryDefinition {
  const definition = targetRemoteEntryDefinitions.find(candidate => candidate.id === entry)
  if (!definition) {
    throw new Error('Unknown prepared target entry.')
  }
  return definition
}

function fixedEntryCommand(definition: TargetRemoteEntryDefinition): readonly string[] {
  return ['exec', 'tsx', definition.childModule]
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
  const definition = resolveTargetRemoteEntryDefinition(request.entry)
  const args = fixedEntryCommand(definition)
  const environment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_OPTIONS: process.env.NODE_OPTIONS,
    CLOUDFLARE_ACCOUNT_ID: prepared.identity.accountId,
    STARYE_PREPARED_CONTEXT_PATH: request.preparedContextPath,
    STARYE_API_CONFIG_PATH: prepared.apiConfigPath,
    STARYE_GATEWAY_CONFIG_PATH: prepared.gatewayConfigPath,
    STARYE_PREPARED_ENTRY: definition.id,
    STARYE_PREPARED_OPERATION: definition.childOperation,
    STARYE_PREPARED_SECRET_KEYS: definition.requiredSecretKeys.join(','),
  }
  if (request.execute('pnpm', args, environment) !== 0) {
    throw new Error(`Prepared target entry failed: ${request.entry}.`)
  }
}
