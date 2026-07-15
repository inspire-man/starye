/// <reference types="node" />

import type { TargetRemoteEntry } from '../packages/config/src/deployment-target/index.ts'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  prepareTargetMutation,
  runPreparedTargetMutation,
  targetRemoteEntryValues,
} from '../packages/config/src/deployment-target/index.ts'

export interface TargetRemoteEntryOptions {
  readonly target: string
  readonly entry: TargetRemoteEntry
}

export function parseTargetRemoteEntryArgs(argv: readonly string[]): TargetRemoteEntryOptions {
  let target: string | undefined
  let entry: TargetRemoteEntry | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${flag}.`)
    index += 1
    if (flag === '--target')
      target = value
    else if (flag === '--entry' && (targetRemoteEntryValues as readonly string[]).includes(value))
      entry = value as TargetRemoteEntry
    else throw new Error(`Unsupported target-remote-entry argument: ${flag}.`)
  }

  if (!target?.trim() || !entry)
    throw new Error('target-remote-entry requires --target and a closed --entry.')
  return { target, entry }
}

export async function runTargetRemoteEntry(options: TargetRemoteEntryOptions) {
  const root = path.resolve(import.meta.dirname, '..')
  const prepared = await prepareTargetMutation({
    target: options.target,
    scope: 'remote',
    command: options.entry,
    ciEnvironment: 'starye-org',
    environment: process.env,
    runId: `remote-${process.pid}`,
    appDirectories: { api: path.join(root, 'apps/api'), gateway: path.join(root, 'apps/gateway') },
    runDirectory: path.join(root, '.target-runs'),
  }, {
    executeReadOnly: (argv) => {
      const result = spawnSync('pnpm', ['exec', 'wrangler', ...argv], { encoding: 'utf8', shell: false })
      return { exitCode: result.status ?? 1, stdout: result.stdout ?? '' }
    },
  })
  try {
    const result = await runPreparedTargetMutation({
      entry: options.entry,
      preparedContextPath: prepared.preparedContextPath,
      execute: (command, args, environment) => {
        const child = spawnSync(command, args, { encoding: 'utf8', shell: false, env: environment })
        return { exitCode: child.status ?? 1, stdout: child.stdout ?? '' }
      },
    })
    return result
  }
  finally {
    await prepared.cleanup()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runTargetRemoteEntry(parseTargetRemoteEntryArgs(process.argv.slice(2))).then((result) => {
    if (result.observation) {
      console.log(JSON.stringify(result.observation))
    }
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
