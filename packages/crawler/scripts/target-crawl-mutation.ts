/// <reference types="node" />

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

interface PreparedCrawlerContext {
  readonly targetId: string
  readonly runId: string
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
}

function redactedDiagnostic(environment: NodeJS.ProcessEnv): {
  declaredSecretKeys: string[]
  declaredKeysPresent: boolean[]
} {
  const declaredKeys = (environment.STARYE_PREPARED_SECRET_KEYS ?? '').split(',').filter(Boolean)
  return {
    declaredSecretKeys: declaredKeys,
    declaredKeysPresent: declaredKeys.map(key => Boolean(environment[key])),
  }
}

export async function runTargetCrawlerMutation(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const contextPath = environment.STARYE_PREPARED_CONTEXT_PATH
  const entry = environment.STARYE_PREPARED_ENTRY
  const operation = environment.STARYE_PREPARED_OPERATION
  if (!contextPath || !entry?.startsWith('crawler-') || !operation) {
    throw new Error('target-crawl-mutation requires a registry-owned prepared context.')
  }
  if (!path.isAbsolute(contextPath) || !path.basename(contextPath).startsWith('prepared-context.')) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context path.')
  }
  const context = JSON.parse(await readFile(contextPath, 'utf8')) as Partial<PreparedCrawlerContext>
  if (!context.targetId || !context.runId || !context.apiConfigPath || !context.gatewayConfigPath) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  if (entry === 'crawler-check-config') {
    console.log(JSON.stringify(redactedDiagnostic(environment)))
    return
  }
  // The selected target runner is the only component allowed to attach live crawler clients.
  throw new Error('Prepared crawler operation requires the target runner execution adapter.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runTargetCrawlerMutation().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
