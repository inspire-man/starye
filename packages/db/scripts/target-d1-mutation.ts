/// <reference types="node" />

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

interface PreparedDbContext {
  readonly targetId: string
  readonly runId: string
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
}

function readPreparedDbContext(environment: NodeJS.ProcessEnv = process.env): Promise<PreparedDbContext> {
  const contextPath = environment.STARYE_PREPARED_CONTEXT_PATH
  const entry = environment.STARYE_PREPARED_ENTRY
  const operation = environment.STARYE_PREPARED_OPERATION
  if (!contextPath || (!entry?.startsWith('d1-') && entry !== 'monthly-cleanup') || !operation) {
    return Promise.reject(new Error('target-d1-mutation requires a registry-owned prepared context.'))
  }
  if (!path.isAbsolute(contextPath) || !path.basename(contextPath).startsWith('prepared-context.')) {
    return Promise.reject(new Error('target-d1-mutation rejected an invalid prepared context path.'))
  }
  return readFile(contextPath, 'utf8').then((text) => {
    const context = JSON.parse(text) as Partial<PreparedDbContext>
    if (!context.targetId || !context.runId || !context.apiConfigPath || !context.gatewayConfigPath) {
      throw new Error('target-d1-mutation rejected an invalid prepared context.')
    }
    return context as PreparedDbContext
  })
}

export async function runTargetD1Mutation(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  await readPreparedDbContext(environment)
  // Remote D1 execution remains owned by the selected-target runner. This child never reads
  // ambient database identity, environment loading, argv, or ambient credentials.
  throw new Error('Prepared D1 operation requires the target runner execution adapter.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runTargetD1Mutation().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
