export interface MagnetProviderFacts {
  readonly configured: boolean
  readonly metadataReady?: boolean
  readonly peers?: number
  readonly progressBytes?: number
  readonly providerError?: boolean
  readonly streamReady?: boolean
}

export type MagnetProbeReason
  = | 'provider_unconfigured'
    | 'provider_failed'
    | 'metadata_unresolved'
    | 'no_peer'
    | 'stalled'
    | 'stream_missing'
    | 'playback_unverified'

export interface MagnetProbeResult {
  readonly metadataReady: boolean
  readonly peers: number
  readonly progressBytes: number
  readonly reason: MagnetProbeReason
  readonly status: 'degraded' | 'unknown'
  readonly streamReady: boolean
}

export interface MagnetProviderClient {
  readonly configured: boolean
  add: (magnet: string) => Promise<string>
  cleanup: (id: string) => Promise<void>
  status: (id: string) => Promise<Omit<MagnetProviderFacts, 'configured'>>
}

export function classifyMagnetProbe(facts: MagnetProviderFacts): MagnetProbeResult {
  const metadataReady = facts.metadataReady === true
  const peers = Math.max(0, Math.trunc(facts.peers ?? 0))
  const progressBytes = Math.max(0, Math.trunc(facts.progressBytes ?? 0))
  const streamReady = facts.streamReady === true
  let reason: MagnetProbeReason
  if (!facts.configured)
    reason = 'provider_unconfigured'
  else if (facts.providerError)
    reason = 'provider_failed'
  else if (!metadataReady)
    reason = 'metadata_unresolved'
  else if (peers === 0)
    reason = 'no_peer'
  else if (progressBytes === 0)
    reason = 'stalled'
  else if (!streamReady)
    reason = 'stream_missing'
  else
    reason = 'playback_unverified'

  return Object.freeze({
    metadataReady,
    peers,
    progressBytes,
    reason,
    status: reason === 'provider_failed' || reason === 'provider_unconfigured' || reason === 'playback_unverified'
      ? 'unknown'
      : 'degraded',
    streamReady,
  })
}

export async function probeMagnetAvailability(input: {
  readonly magnet: string
  readonly pollIntervalMs?: number
  readonly progressPolls?: number
  readonly provider: MagnetProviderClient
}): Promise<MagnetProbeResult> {
  if (!input.provider.configured)
    return classifyMagnetProbe({ configured: false })
  const pollCount = Math.min(12, Math.max(1, input.progressPolls ?? 12))
  const pollIntervalMs = Math.min(5_000, Math.max(0, input.pollIntervalMs ?? 5_000))
  let id: string | undefined
  try {
    id = await input.provider.add(input.magnet)
    let facts: MagnetProviderFacts = { configured: true }
    for (let index = 0; index < pollCount; index += 1) {
      facts = { configured: true, ...await input.provider.status(id) }
      if (facts.streamReady)
        break
      if (pollIntervalMs > 0 && index + 1 < pollCount)
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
    return classifyMagnetProbe(facts)
  }
  catch {
    return classifyMagnetProbe({ configured: true, providerError: true })
  }
  finally {
    if (id) {
      try {
        await input.provider.cleanup(id)
      }
      catch {
        // Cleanup failure cannot turn provider facts into content facts.
      }
    }
  }
}
