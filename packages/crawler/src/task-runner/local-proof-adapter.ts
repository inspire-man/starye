import type { AdapterExecutionContext, AdapterExecutionResult, TaskRunnerAdapter } from './template-adapters'

export const LOCAL_PROOF_PROFILE = 'phase25-movie-availability-v1' as const

export interface LocalProofAdapterOptions {
  readonly now?: () => number
}

function localProofCandidate(context: AdapterExecutionContext): { readonly contentId: string } {
  const candidate = context.candidate
  if (candidate.provider !== 'local-proof'
    || candidate.proofProfile !== LOCAL_PROOF_PROFILE
    || candidate.target?.kind !== 'movie'
    || !candidate.contentId
    || !candidate.taskId
    || !candidate.policyReference
    || !candidate.policyVersion
    || candidate.sourceRevision === undefined
    || candidate.expectedProjectionVersion === undefined) {
    throw new Error('Local proof candidate binding is incomplete')
  }
  return { contentId: candidate.contentId }
}

/** Bounded, server-bound movie proof adapter. It never fetches a source or emits raw media material. */
export function createLocalProofAdapter(options: LocalProofAdapterOptions = {}): TaskRunnerAdapter {
  return {
    proofProfile: LOCAL_PROOF_PROFILE,
    templateKey: 'movie',
    async execute(context): Promise<AdapterExecutionResult> {
      const candidate = localProofCandidate(context)
      if (await context.checkpoint())
        return { contentIds: [] }

      const observedAt = Math.floor((options.now?.() ?? Date.now()) / 1000)
      context.observe(candidate.contentId)
      return {
        availabilityObservation: {
          freshness: 'fresh',
          nextAction: 'none',
          observationIdentity: `local-proof:${context.candidate.runId}:accepted`,
          observedAt,
          reasonCode: 'available',
          status: 'available',
          summary: {
            counts: { available: 1, checked: 1 },
            samples: [candidate.contentId],
          },
        },
        contentIds: [candidate.contentId],
      }
    },
  }
}

export const localProofAdapter = createLocalProofAdapter()
