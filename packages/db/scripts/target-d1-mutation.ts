/// <reference types="node" />

import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
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
    accountId: string
  }>
}

export interface PreparedD1SnapshotCommand {
  readonly accountId: string
  readonly configPath: string
  readonly d1Name: string
  readonly sql: string
  readonly params: readonly [string]
}

export interface PreparedD1SnapshotExecutor {
  execute: (command: PreparedD1SnapshotCommand) => { exitCode: number, stdout?: string }
}

export interface TargetD1MutationDependencies {
  readonly execute?: PreparedD1SnapshotExecutor['execute']
}

export type D1SmokeSnapshotObservation
  = Readonly<{ operation: 'd1-smoke-snapshot', status: 'found', itemCode: string, itemId: string }>
    | Readonly<{ operation: 'd1-smoke-snapshot', status: 'not-found' | 'checkpoint', itemCode: string }>

const snapshotSql = [
  'SELECT movie.id AS id, movie.code AS code, COUNT(player.id) AS playerCount',
  'FROM movie',
  'LEFT JOIN player ON player.movie_id = movie.id AND player.is_active = 1',
  'WHERE movie.code = ?',
  'GROUP BY movie.id, movie.code',
  'LIMIT 1',
].join(' ')

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
    && typeof context.identity.accountId === 'string'
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
    const query = command.sql.replace('?', encodeSqlString(command.params[0]))
    const result = spawnSync('pnpm', [
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
    ], {
      encoding: 'utf8',
      shell: false,
      env: {
        PATH: environment.PATH,
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
    const row = rows[0]
    if (rows.length !== 1
      || !row
      || row.code !== itemCode
      || typeof row.id !== 'string'
      || !row.id.trim()
      || Number(row.playerCount) !== 1) {
      return { operation: 'd1-smoke-snapshot', status: 'checkpoint', itemCode }
    }
    return { operation: 'd1-smoke-snapshot', status: 'found', itemCode, itemId: row.id }
  }
  catch {
    return { operation: 'd1-smoke-snapshot', status: 'checkpoint', itemCode }
  }
}

export async function runTargetD1Mutation(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: TargetD1MutationDependencies = {},
): Promise<D1SmokeSnapshotObservation> {
  const context = await readPreparedDbContext(environment)
  if (environment.STARYE_PREPARED_ENTRY !== 'd1-smoke-snapshot' || environment.STARYE_PREPARED_OPERATION !== 'smoke-snapshot') {
    throw new Error('target-d1-mutation requires the registry-owned smoke operation.')
  }
  if (environment.STARYE_PREPARED_SECRET_KEYS !== 'CLOUDFLARE_API_TOKEN' || !environment.CLOUDFLARE_API_TOKEN) {
    throw new Error('target-d1-mutation rejected the declared smoke credential boundary.')
  }
  if (environment.CLOUDFLARE_ACCOUNT_ID !== context.identity.accountId
    || environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath
    || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
    throw new Error('target-d1-mutation rejected an invalid prepared context.')
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
    params: [itemCode],
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
