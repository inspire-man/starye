/// <reference types="node" />

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createDataChainFixture, runDataChainFixture } from '../src/smoke/data-chain-fixture'
import { ApiClient } from '../src/utils/api-client'

interface PreparedCrawlerContext {
  readonly targetId: string
  readonly runId: string
  readonly preparedContextPath: string
  readonly smokeItemCode?: string
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
  readonly identity: Readonly<{
    apiUrl: string
    accountId: string
  }>
}

interface CrawlerApiClient {
  syncMovie: (movieData: unknown) => Promise<unknown>
}

export interface TargetCrawlerMutationDependencies {
  readonly createApiClient?: (config: { url: string, token: string, timeout: number }) => CrawlerApiClient
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

function isPreparedCrawlerContext(value: unknown, contextPath: string): value is PreparedCrawlerContext {
  if (!value || typeof value !== 'object') {
    return false
  }

  const context = value as Partial<PreparedCrawlerContext>
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
    && typeof context.identity.apiUrl === 'string'
    && typeof context.identity.accountId === 'string'
}

export async function runTargetCrawlerMutation(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: TargetCrawlerMutationDependencies = {},
): Promise<Awaited<ReturnType<typeof runDataChainFixture>> | void> {
  const contextPath = environment.STARYE_PREPARED_CONTEXT_PATH
  const entry = environment.STARYE_PREPARED_ENTRY
  const operation = environment.STARYE_PREPARED_OPERATION
  if (!contextPath || !entry?.startsWith('crawler-') || !operation) {
    throw new Error('target-crawl-mutation requires a registry-owned prepared context.')
  }
  if (!path.isAbsolute(contextPath) || !path.basename(contextPath).startsWith('prepared-context.')) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context path.')
  }
  const context = JSON.parse(await readFile(contextPath, 'utf8')) as unknown
  if (!isPreparedCrawlerContext(context, contextPath)) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  if (entry === 'crawler-check-config' && operation === 'check-config') {
    console.log(JSON.stringify(redactedDiagnostic(environment)))
    return
  }
  if (entry !== 'crawler-smoke-fixture' || operation !== 'smoke-fixture') {
    throw new Error('target-crawl-mutation requires the registry-owned smoke operation.')
  }
  if (environment.STARYE_PREPARED_SECRET_KEYS !== 'CRAWLER_SECRET' || !environment.CRAWLER_SECRET) {
    throw new Error('target-crawl-mutation rejected the declared smoke credential boundary.')
  }
  if (environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  if (typeof context.smokeItemCode !== 'string' || !context.smokeItemCode.trim()) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  if (context.smokeItemCode !== createDataChainFixture({ targetId: context.targetId, runId: context.runId }).code) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }

  const createApiClient = dependencies.createApiClient ?? (config => new ApiClient(config))
  return runDataChainFixture({
    targetId: context.targetId,
    runId: context.runId,
    apiClient: createApiClient({
      url: context.identity.apiUrl,
      token: environment.CRAWLER_SECRET,
      timeout: 60000,
    }),
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runTargetCrawlerMutation().then((result) => {
    if (result) {
      console.log(JSON.stringify(result))
    }
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
