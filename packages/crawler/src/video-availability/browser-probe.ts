export interface BrowserMediaEvidence {
  readonly mediaLoaded: boolean
  readonly reason: 'challenge' | 'contradictory_media' | 'uncertain_media' | 'valid_media'
}

export type BrowserVideoProbe = (url: string) => Promise<BrowserMediaEvidence>

export function classifyBrowserEvidence(evidence: BrowserMediaEvidence): {
  readonly reason: 'direct_blocked' | 'browser_inconclusive' | null
  readonly status: 'available' | 'degraded' | 'unknown'
} {
  if (evidence.mediaLoaded)
    return { reason: null, status: 'available' }
  if (evidence.reason === 'challenge')
    return { reason: 'direct_blocked', status: 'degraded' }
  return { reason: 'browser_inconclusive', status: 'unknown' }
}
