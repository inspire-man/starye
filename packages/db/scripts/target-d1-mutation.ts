/// <reference types="node" />

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

interface PreparedDbContext {
  readonly targetId: string
  readonly runId: string
  readonly preparedContextPath: string
  readonly smokeItemCode?: string
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
  readonly identity: Readonly<{
    d1Name: string
    r2Name: string
    accountId: string
  }>
}

export interface PreparedD1SnapshotCommand {
  readonly accountId: string
  readonly configPath: string
  readonly d1Name: string
  readonly sql: string
  readonly params: readonly string[]
}

export interface PreparedD1SnapshotExecutor {
  execute: (command: PreparedD1SnapshotCommand) => { exitCode: number, stdout?: string }
}

export interface PreparedD1MigrationCommand {
  readonly kind: 'export' | 'backup' | 'apply'
  readonly accountId: string
  readonly configPath: string
  readonly d1Name: string
  readonly r2Name: string
  readonly backupPath: string
  readonly backupKey: string
}

export interface PreparedD1MigrationExecutor {
  execute: (command: PreparedD1MigrationCommand) => { exitCode: number, stdout?: string, stderr?: string }
}

export interface TargetD1MutationDependencies {
  readonly execute?: PreparedD1SnapshotExecutor['execute']
  readonly executeMigration?: PreparedD1MigrationExecutor['execute']
}

function packageManagerInvocation(args: readonly string[]): { command: string, args: readonly string[] } {
  if (process.platform !== 'win32') {
    return { command: 'pnpm', args }
  }

  const entry = path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
  if (!existsSync(entry)) {
    throw new Error('Windows pnpm entrypoint is unavailable.')
  }
  return { command: process.execPath, args: [entry, ...args] }
}

function pickRuntimeEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const names = process.platform === 'win32'
    ? ['PATH', 'Path', 'SystemRoot', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'NODE_OPTIONS', 'PNPM_HOME']
    : ['PATH', 'HOME', 'TMPDIR', 'NODE_OPTIONS', 'PNPM_HOME']
  const selected: NodeJS.ProcessEnv = {}

  for (const name of names) {
    const value = environment[name]
    if (value !== undefined) {
      selected[name] = value
    }
  }

  return selected
}

function diagnosticOutput(result: { readonly stdout?: string, readonly stderr?: string }): string {
  return [result.stderr, result.stdout]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n')
}

export type D1SmokeSnapshotObservation
  = Readonly<{ operation: 'd1-smoke-snapshot', status: 'found', itemCode: string, itemId: string, itemCount: 10 }>
    | Readonly<{ operation: 'd1-smoke-snapshot', status: 'not-found' | 'checkpoint', itemCode: string }>

const DATA_CHAIN_FIXTURE_COUNT = 10

const snapshotSql = [
  'SELECT movie.id AS id, movie.code AS code, movie.is_r18 AS isR18, COUNT(player.id) AS playerCount',
  'FROM movie',
  'LEFT JOIN player ON player.movie_id = movie.id AND player.is_active = 1',
  'WHERE movie.code = ? OR movie.code LIKE ?',
  'GROUP BY movie.id, movie.code, movie.is_r18',
  'ORDER BY movie.code',
  `LIMIT ${DATA_CHAIN_FIXTURE_COUNT + 1}`,
].join(' ')

function expectedFixtureCodes(primaryCode: string): readonly string[] {
  return [
    primaryCode,
    ...Array.from({ length: DATA_CHAIN_FIXTURE_COUNT - 1 }, (_, index) => `${primaryCode}-fixture-${index + 1}`),
  ]
}

function isPreparedDbContext(value: unknown, contextPath: string): value is PreparedDbContext {
  if (!value || typeof value !== 'object') {
    return false
  }

  const context = value as Partial<PreparedDbContext>
  return typeof context.targetId === 'string'
    && typeof context.runId === 'string'
    && typeof context.preparedContextPath === 'string'
    && path.resolve(context.preparedContextPath) === path.resolve(contextPath)
    && path.basename(contextPath) === `prepared-context.${context.runId}.json`
    && typeof context.apiConfigPath === 'string'
    && path.isAbsolute(context.apiConfigPath)
    && typeof context.gatewayConfigPath === 'string'
    && path.isAbsolute(context.gatewayConfigPath)
    && !!context.identity
    && typeof context.identity.d1Name === 'string'
    && typeof context.identity.r2Name === 'string'
    && typeof context.identity.accountId === 'string'
}

function defaultMigrationExecutor(environment: NodeJS.ProcessEnv): PreparedD1MigrationExecutor['execute'] {
  return (command) => {
    const args = command.kind === 'export'
      ? ['exec', 'wrangler', 'd1', 'export', command.d1Name, '--remote', '--config', command.configPath, '--output', command.backupPath]
      : command.kind === 'backup'
        ? ['exec', 'wrangler', 'r2', 'object', 'put', `${command.r2Name}/${command.backupKey}`, '--file', command.backupPath]
        : ['exec', 'wrangler', 'd1', 'migrations', 'apply', command.d1Name, '--remote', '--config', command.configPath]
    const invocation = packageManagerInvocation(args)
    const result = spawnSync(invocation.command, invocation.args, {
      encoding: 'utf8',
      shell: false,
      env: {
        ...pickRuntimeEnvironment(environment),
        CLOUDFLARE_ACCOUNT_ID: command.accountId,
        CLOUDFLARE_API_TOKEN: environment.CLOUDFLARE_API_TOKEN,
      },
    })
    return { exitCode: result.status ?? 1, stderr: diagnosticOutput(result) }
  }
}

function migrationFailureMessage(kind: PreparedD1MigrationCommand['kind'], stderr: string | undefined, apiToken: string): string {
  const diagnostic = stderr
    ?.replaceAll(apiToken, '[redacted]')
    .trim()
    .slice(0, 2000)
  return `target-d1-mutation ${kind} failed.${diagnostic ? ` ${diagnostic}` : ''}`
}

function migrationBackup(context: PreparedDbContext): Pick<PreparedD1MigrationCommand, 'backupPath' | 'backupKey'> {
  if (!/^[\w-]+$/.test(context.runId)) {
    throw new Error('target-d1-mutation rejected an invalid prepared context.')
  }
  const configDirectory = path.dirname(context.apiConfigPath)
  const backupPath = path.resolve(configDirectory, `.target-d1-backup.${context.runId}.sql`)
  if (path.dirname(backupPath) !== path.resolve(configDirectory)) {
    throw new Error('target-d1-mutation rejected an invalid prepared context.')
  }
  return {
    backupPath,
    backupKey: `ops/d1-backups/${context.targetId}/${context.runId}.sql`,
  }
}

async function readPreparedDbContext(environment: NodeJS.ProcessEnv = process.env): Promise<PreparedDbContext> {
  const contextPath = environment.STARYE_PREPARED_CONTEXT_PATH
  const entry = environment.STARYE_PREPARED_ENTRY
  const operation = environment.STARYE_PREPARED_OPERATION
  if (!contextPath || (!entry?.startsWith('d1-') && entry !== 'monthly-cleanup') || !operation) {
    return Promise.reject(new Error('target-d1-mutation requires a registry-owned prepared context.'))
  }
  if (!path.isAbsolute(contextPath) || !path.basename(contextPath).startsWith('prepared-context.')) {
    return Promise.reject(new Error('target-d1-mutation rejected an invalid prepared context path.'))
  }
  const text = await readFile(contextPath, 'utf8')
  try {
    const context = JSON.parse(text) as unknown
    if (!isPreparedDbContext(context, contextPath)) {
      throw new Error('target-d1-mutation rejected an invalid prepared context.')
    }
    return context
  }
  catch (error) {
    if (error instanceof Error && error.message === 'target-d1-mutation rejected an invalid prepared context.') {
      throw error
    }
    throw new Error('target-d1-mutation rejected an invalid prepared context.')
  }
}

function encodeSqlString(value: string): string {
  return `'${value.replaceAll('\'', '\'\'')}'`
}

function defaultSnapshotExecutor(environment: NodeJS.ProcessEnv): PreparedD1SnapshotExecutor['execute'] {
  return (command) => {
    let parameterIndex = 0
    const query = command.sql.replace(/\?/g, () => {
      const value = command.params[parameterIndex]
      parameterIndex += 1
      if (value === undefined) {
        throw new Error('target-d1-mutation rejected an invalid snapshot command.')
      }
      return encodeSqlString(value)
    })
    if (parameterIndex !== command.params.length) {
      throw new Error('target-d1-mutation rejected an invalid snapshot command.')
    }
    const invocation = packageManagerInvocation([
      'exec',
      'wrangler',
      'd1',
      'execute',
      command.d1Name,
      '--remote',
      '--config',
      command.configPath,
      '--command',
      query,
      '--json',
    ])
    const result = spawnSync(invocation.command, invocation.args, {
      encoding: 'utf8',
      shell: false,
      env: {
        ...pickRuntimeEnvironment(environment),
        CLOUDFLARE_ACCOUNT_ID: command.accountId,
        CLOUDFLARE_API_TOKEN: environment.CLOUDFLARE_API_TOKEN,
      },
    })
    return { exitCode: result.status ?? 1, stdout: result.stdout ?? '' }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findResultRows(value: unknown): readonly Record<string, unknown>[] | undefined {
  const payloads = Array.isArray(value) ? value : [value]
  for (const payload of payloads) {
    if (isRecord(payload) && Array.isArray(payload.results) && payload.results.every(isRecord)) {
      return payload.results
    }
  }
  return undefined
}

function parseSnapshotResult(stdout: string | undefined, itemCode: string): D1SmokeSnapshotObservation {
  if (!stdout) {
    return { operation: 'd1-smoke-snapshot', status: 'checkpoint', itemCode }
  }
  try {
    const rows = findResultRows(JSON.parse(stdout))
    if (!rows) {
      return { operation: 'd1-smoke-snapshot', status: 'checkpoint', itemCode }
    }
    if (rows.length === 0) {
      return { operation: 'd1-smoke-snapshot', status: 'not-found', itemCode }
    }
    const expectedCodes = expectedFixtureCodes(itemCode)
    const expectedCodeSet = new Set(expectedCodes)
    const primary = rows.find(row => row.code === itemCode)
    const returnedCodes = new Set(rows.map(row => typeof row.code === 'string' ? row.code : ''))
    if (rows.length !== DATA_CHAIN_FIXTURE_COUNT
      || returnedCodes.size !== DATA_CHAIN_FIXTURE_COUNT
      || returnedCodes.size !== expectedCodeSet.size
      || [...expectedCodeSet].some(code => !returnedCodes.has(code))
      || rows.some(row => Number(row.isR18) !== 0)
      || rows.some(row => Number(row.playerCount) !== 1)
      || !primary
      || typeof primary.id !== 'string'
      || !primary.id.trim()) {
      return { operation: 'd1-smoke-snapshot', status: 'checkpoint', itemCode }
    }
    return { operation: 'd1-smoke-snapshot', status: 'found', itemCode, itemId: primary.id, itemCount: DATA_CHAIN_FIXTURE_COUNT }
  }
  catch {
    return { operation: 'd1-smoke-snapshot', status: 'checkpoint', itemCode }
  }
}

export async function runTargetD1Mutation(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: TargetD1MutationDependencies = {},
): Promise<D1SmokeSnapshotObservation | undefined> {
  const context = await readPreparedDbContext(environment)
  if (environment.STARYE_PREPARED_SECRET_KEYS !== 'CLOUDFLARE_API_TOKEN' || !environment.CLOUDFLARE_API_TOKEN) {
    throw new Error('target-d1-mutation rejected the declared credential boundary.')
  }
  if (environment.CLOUDFLARE_ACCOUNT_ID !== context.identity.accountId
    || environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath
    || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
    throw new Error('target-d1-mutation rejected an invalid prepared context.')
  }

  if (environment.STARYE_PREPARED_ENTRY === 'd1-migrate' && environment.STARYE_PREPARED_OPERATION === 'migrate') {
    const backup = migrationBackup(context)
    const execute = dependencies.executeMigration ?? defaultMigrationExecutor(environment)
    const commands: PreparedD1MigrationCommand[] = [
      { kind: 'export', accountId: context.identity.accountId, configPath: context.apiConfigPath, d1Name: context.identity.d1Name, r2Name: context.identity.r2Name, ...backup },
      { kind: 'backup', accountId: context.identity.accountId, configPath: context.apiConfigPath, d1Name: context.identity.d1Name, r2Name: context.identity.r2Name, ...backup },
      { kind: 'apply', accountId: context.identity.accountId, configPath: context.apiConfigPath, d1Name: context.identity.d1Name, r2Name: context.identity.r2Name, ...backup },
    ]
    try {
      for (const command of commands) {
        const result = execute(command)
        if (result.exitCode !== 0) {
          throw new Error(migrationFailureMessage(command.kind, diagnosticOutput(result), environment.CLOUDFLARE_API_TOKEN))
        }
      }
    }
    finally {
      await rm(backup.backupPath, { force: true })
    }
    return undefined
  }

  if (environment.STARYE_PREPARED_ENTRY !== 'd1-smoke-snapshot' || environment.STARYE_PREPARED_OPERATION !== 'smoke-snapshot') {
    throw new Error('target-d1-mutation requires a registry-owned operation.')
  }

  if (typeof context.smokeItemCode !== 'string' || !context.smokeItemCode.trim()) {
    throw new Error('target-d1-mutation rejected an invalid prepared context.')
  }
  const itemCode = context.smokeItemCode
  const execute = dependencies.execute ?? defaultSnapshotExecutor(environment)
  const result = execute({
    accountId: context.identity.accountId,
    configPath: context.apiConfigPath,
    d1Name: context.identity.d1Name,
    sql: snapshotSql,
    params: [itemCode, `${itemCode}-fixture-%`],
  })
  if (result.exitCode !== 0) {
    return { operation: 'd1-smoke-snapshot', status: 'checkpoint', itemCode }
  }
  return parseSnapshotResult(result.stdout, itemCode)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runTargetD1Mutation().then((result) => {
    console.log(JSON.stringify(result))
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
