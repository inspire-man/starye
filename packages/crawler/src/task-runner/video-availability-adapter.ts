import type { BrowserVideoProbe } from '../video-availability/browser-probe'
import type { TaskRunnerAdapter } from './template-adapters'
import { probeDirectVideo } from '../video-availability/direct-probe'
import { isVideoRunnerSnapshot } from './runner-client'

const directReasons = new Set(['direct_blocked', 'direct_transport_failed', 'direct_content_invalid', 'browser_inconclusive'])

export function createVideoAvailabilityAdapter(input: {
  readonly browser?: BrowserVideoProbe
  readonly fetch: (url: string | URL, init?: RequestInit) => Promise<Response>
  readonly resolve: (hostname: string) => Promise<readonly string[]>
  readonly sources: readonly string[]
}): TaskRunnerAdapter {
  return {
    operation: 'video_direct',
    templateKey: 'movie',
    async execute(context) {
      const { candidate } = context
      if (!isVideoRunnerSnapshot(candidate.snapshot)
        || !(candidate.snapshot.sourceKind === 'direct'
          || (candidate.snapshot.sourceKind === undefined && directReasons.has(candidate.snapshot.reason)))) {
        throw new Error('Direct adapter requires a direct video snapshot')
      }
      if ((candidate.sourceRevision !== undefined && candidate.sourceRevision !== candidate.snapshot.sourceRevision)
        || (candidate.policyVersion !== undefined && candidate.policyVersion !== candidate.snapshot.policyVersion)) {
        throw new Error('Direct adapter binding mismatch')
      }
      const results = []
      for (const source of input.sources) {
        if (await context.checkpoint())
          break
        results.push(await probeDirectVideo({ browser: input.browser, fetch: input.fetch, resolve: input.resolve, url: source }))
      }
      const available = results.filter(result => result.status === 'available').length
      const unknown = results.filter(result => result.status === 'unknown').length
      const blocked = results.filter(result => result.reason === 'direct_blocked').length
      return {
        availabilityObservation: {
          freshness: 'fresh',
          nextAction: available === results.length && results.length > 0 ? 'none' : blocked > 0 ? 'repair' : 'recheck',
          reasonCode: available === results.length && results.length > 0 ? 'available' : unknown > 0 ? 'transport_failed' : input.sources.length === 0 ? 'no_source' : 'content_missing',
          status: available > 0 ? (available === results.length ? 'available' : 'degraded') : unknown > 0 ? 'unknown' : 'unavailable',
          summary: {
            counts: { available, blocked, checked: results.length, configured: input.sources.length, unknown },
            samples: [...new Set(results.flatMap(result => result.reason ? [result.reason] : []))].slice(0, 5),
          },
        },
        contentIds: [],
      }
    },
  }
}
