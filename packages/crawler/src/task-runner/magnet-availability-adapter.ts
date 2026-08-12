import type { MagnetProviderClient } from '../video-availability/magnet-probe'
import type { RunnerAvailabilityNextAction, RunnerAvailabilityReasonCode } from './runner-client'
import type { TaskRunnerAdapter } from './template-adapters'
import { probeMagnetAvailability } from '../video-availability/magnet-probe'
import { isVideoRunnerSnapshot } from './runner-client'

export function createMagnetAvailabilityAdapter(input: {
  readonly magnet: string
  readonly provider: MagnetProviderClient
}): TaskRunnerAdapter {
  return {
    operation: 'video_magnet',
    templateKey: 'movie',
    async execute(context) {
      const { candidate } = context
      if (!isVideoRunnerSnapshot(candidate.snapshot))
        throw new Error('Magnet adapter requires a video runner snapshot')
      if ((candidate.sourceRevision !== undefined && candidate.sourceRevision !== candidate.snapshot.sourceRevision)
        || (candidate.policyVersion !== undefined && candidate.policyVersion !== candidate.snapshot.policyVersion)) {
        throw new Error('Magnet adapter binding mismatch')
      }
      const result = await probeMagnetAvailability(input)
      const providerFailure = result.reason === 'provider_failed' || result.reason === 'provider_unconfigured'
      const reasonCode: RunnerAvailabilityReasonCode = providerFailure ? 'provider_failed' : 'content_missing'
      const nextAction: RunnerAvailabilityNextAction = providerFailure ? 'retry' : 'recheck'
      return {
        availabilityObservation: {
          freshness: 'fresh',
          nextAction,
          reasonCode,
          status: result.status,
          summary: {
            counts: {
              metadata_ready: result.metadataReady ? 1 : 0,
              peers: result.peers,
              progress_bytes: result.progressBytes,
              stream_ready: result.streamReady ? 1 : 0,
            },
            samples: [result.reason],
          },
        },
        contentIds: [],
      }
    },
  }
}
