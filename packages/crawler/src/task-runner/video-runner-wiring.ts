import type { MagnetProviderClient } from '../video-availability/magnet-probe'
import type { TaskRunnerAdapter } from './template-adapters'
import { lookup } from 'node:dns/promises'
import { createMagnetAvailabilityAdapter } from './magnet-availability-adapter'
import { createVideoAvailabilityAdapter } from './video-availability-adapter'

export interface ServerVideoAvailabilityConfig {
  readonly direct?: {
    readonly sources: readonly string[]
  }
  readonly magnet?: {
    readonly provider?: {
      readonly rpcUrl: string
      readonly secret?: string
    }
    readonly source: string
  }
}

interface JsonRpcResponse<T> {
  readonly error?: unknown
  readonly result?: T
}

function createAria2Provider(config: ServerVideoAvailabilityConfig['magnet']): MagnetProviderClient {
  const provider = config?.provider
  let requestId = 0
  const call = async <T>(method: string, params: readonly unknown[] = []): Promise<T> => {
    if (!provider)
      throw new Error('Magnet provider is not configured')
    const auth = provider.secret ? [`token:${provider.secret}`] : []
    const response = await fetch(provider.rpcUrl, {
      body: JSON.stringify({ id: ++requestId, jsonrpc: '2.0', method: `aria2.${method}`, params: [...auth, ...params] }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    if (!response.ok)
      throw new Error('Magnet provider request failed')
    const body = await response.json() as JsonRpcResponse<T>
    if (body.error || body.result === undefined)
      throw new Error('Magnet provider returned an invalid response')
    return body.result
  }
  return {
    add: magnet => call<string>('addUri', [[magnet]]),
    cleanup: async (id) => { await call('remove', [id]) },
    configured: provider !== undefined,
    status: async (id) => {
      const status = await call<Record<string, unknown>>('tellStatus', [id, ['status', 'completedLength', 'numSeeders', 'connections', 'followedBy', 'bittorrent']])
      const metadataReady = Boolean(status.bittorrent) || (Array.isArray(status.followedBy) && status.followedBy.length > 0)
      const peers = Number(status.numSeeders ?? status.connections ?? 0)
      const progressBytes = Number(status.completedLength ?? 0)
      return {
        metadataReady,
        peers: Number.isFinite(peers) ? peers : 0,
        progressBytes: Number.isFinite(progressBytes) ? progressBytes : 0,
        streamReady: status.status === 'complete' || (metadataReady && progressBytes > 0),
      }
    },
  }
}

export function createServerVideoAvailabilityAdapters(
  config: ServerVideoAvailabilityConfig = {},
  dependencies: {
    readonly fetch?: typeof fetch
    readonly provider?: MagnetProviderClient
    readonly resolve?: (hostname: string) => Promise<readonly string[]>
  } = {},
): readonly TaskRunnerAdapter[] {
  const resolve = dependencies.resolve ?? (async hostname => (await lookup(hostname, { all: true })).map(result => result.address))
  return [
    createVideoAvailabilityAdapter({
      fetch: dependencies.fetch ?? fetch,
      resolve,
      sources: config.direct?.sources ?? [],
    }),
    createMagnetAvailabilityAdapter({
      magnet: config.magnet?.source ?? '',
      provider: dependencies.provider ?? createAria2Provider(config.magnet),
    }),
  ]
}
