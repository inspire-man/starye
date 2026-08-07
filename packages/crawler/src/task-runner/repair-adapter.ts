import type {
  RepairPlayersReceipt,
  RepairRunnerSnapshot,
  RepairSourceCandidate,
  RepairSourceObservationInput,
  RepairSourceObservationResponse,
  RunnerCandidate,
  RunnerClient,
  RunnerFailureCode,
} from './runner-client'
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  TaskRunnerAdapter,
} from './template-adapters'
import { isRepairRunnerSnapshot } from './runner-client'

export interface RepairPlayersAdapterOptions {
  readonly discoverSources?: (context: AdapterExecutionContext & { readonly snapshot: RepairRunnerSnapshot }) => Promise<RepairSourceObservationInput>
  readonly now?: () => number
  readonly sources?: readonly RepairSourceCandidate[]
}

type RepairSourceClient = Pick<RunnerClient, 'observeRepairSource'>

function failureCode(response: RepairSourceObservationResponse): RunnerFailureCode {
  if (response.errorCode === 'source_stale'
    || response.errorCode === 'source_read_failed'
    || response.errorCode === 'source_write_failed') {
    return response.errorCode
  }
  return response.accepted ? 'receipt_missing' : 'runner_failed'
}

function repairSnapshot(candidate: RunnerCandidate): RepairRunnerSnapshot {
  if (!isRepairRunnerSnapshot(candidate.snapshot)
    || candidate.snapshot.templateVersion !== 1
    || candidate.snapshot.templateKey !== 'movie'
    || candidate.snapshot.entrypoint !== 'movie-crawler'
    || candidate.snapshot.permissionResource !== 'movie'
    || candidate.snapshot.movieId.trim().length === 0
    || (candidate.snapshot.reason !== 'no_source' && candidate.snapshot.reason !== 'source_failed')
    || !Number.isSafeInteger(candidate.snapshot.sourceRevision)
    || candidate.snapshot.sourceRevision < 0
    || candidate.snapshot.sourceRevision > 1_000_000
    || candidate.snapshot.targetIntent !== 'restore_playable_sources') {
    throw new Error('Repair runner snapshot contract is invalid')
  }
  return candidate.snapshot
}

function boundedReceipt(response: RepairSourceObservationResponse, snapshot: RepairRunnerSnapshot): RepairPlayersReceipt {
  const receipt = response.receipt
  if (!response.accepted || !receipt || !response.readback)
    throw new Error(response.errorCode ?? 'repair_readback_unavailable')
  if (receipt.operation !== 'repair_players'
    || receipt.movieId !== snapshot.movieId
    || receipt.sourceRevision <= snapshot.sourceRevision
    || receipt.observedAt !== response.readback.observedAt
    || response.readback.movieId !== snapshot.movieId
    || response.readback.sourceRevision !== receipt.sourceRevision
    || receipt.sourceSummary.length < 1
    || response.readback.sources.length < 1
    || response.readback.sources.length !== receipt.sourceSummary.length
    || response.readback.summary.sourceCount !== receipt.sourceSummary.length
    || response.readback.summary.eligibleCount !== receipt.sourceSummary.filter(source => source.eligible).length) {
    throw new Error('repair_readback_identity_mismatch')
  }

  for (const [index, source] of receipt.sourceSummary.entries()) {
    const readbackSource = response.readback.sources[index]
    if (!readbackSource
      || readbackSource.eligible !== source.eligible
      || readbackSource.health !== source.health
      || readbackSource.observedAt !== source.observedAt
      || readbackSource.reasonCode !== source.reasonCode
      || readbackSource.sourceType !== source.sourceType) {
      throw new Error('repair_readback_summary_mismatch')
    }
  }

  return {
    movieId: receipt.movieId,
    observedAt: receipt.observedAt,
    operation: 'repair_players',
    sourceRevision: receipt.sourceRevision,
    sourceSummary: receipt.sourceSummary.map(source => ({
      eligible: source.eligible === true,
      health: source.health,
      observedAt: source.observedAt,
      reasonCode: source.reasonCode,
      sourceType: source.sourceType,
    })),
  }
}

async function sourceInput(
  options: RepairPlayersAdapterOptions,
  context: AdapterExecutionContext,
  snapshot: RepairRunnerSnapshot,
): Promise<RepairSourceObservationInput> {
  if (options.discoverSources)
    return options.discoverSources({ ...context, snapshot })
  if (options.sources)
    return { sources: options.sources, observedAt: options.now?.() ?? Math.floor(Date.now() / 1000) }
  throw new Error('repair source discovery is not configured')
}

export function createRepairPlayersAdapter(options: RepairPlayersAdapterOptions = {}): TaskRunnerAdapter {
  return {
    operation: 'repair_players',
    templateKey: 'movie',
    async execute(context: AdapterExecutionContext): Promise<AdapterExecutionResult> {
      const snapshot = repairSnapshot(context.candidate)
      if (await context.checkpoint())
        return { contentIds: [] }
      const client = context.client as RepairSourceClient | undefined
      if (!client?.observeRepairSource)
        throw new Error('repair source client is not configured')
      const input = await sourceInput(options, context, snapshot)
      if (await context.checkpoint())
        return { contentIds: [] }
      if (input.sources.length === 0)
        return { contentIds: [], failureCode: 'receipt_missing' }
      const sequence = context.nextSequence?.() ?? context.candidate.sequence + 1
      const response = await client.observeRepairSource(context.candidate, sequence, input)
      const boundedResponse = response as RepairSourceObservationResponse
      if (!boundedResponse.accepted || !boundedResponse.receipt || !boundedResponse.readback)
        return { contentIds: [], failureCode: failureCode(boundedResponse) }
      let receipt: RepairPlayersReceipt
      try {
        receipt = boundedReceipt(boundedResponse, snapshot)
      }
      catch {
        return { contentIds: [], failureCode: 'receipt_missing' }
      }
      if (await context.checkpoint())
        return { contentIds: [] }
      return { contentIds: [], repairReceipt: receipt }
    },
  }
}

export const repairPlayersAdapter = createRepairPlayersAdapter()
