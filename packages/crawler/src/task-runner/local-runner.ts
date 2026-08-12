import type { RunnerAvailabilityObservationInput, RunnerCandidate, RunnerClient } from './runner-client'
import type { TaskRunnerAdapter } from './template-adapters'

export interface LocalTaskRunnerOptions {
  readonly adapters: { select: (snapshot: RunnerCandidate['snapshot'], proofProfile?: RunnerCandidate['proofProfile']) => TaskRunnerAdapter }
  readonly client: RunnerClient
  readonly sleep?: (milliseconds: number) => Promise<void>
}

export class LocalTaskRunner {
  private activeRun: RunnerCandidate | undefined
  private isPolling = false
  private readonly sleep: (milliseconds: number) => Promise<void>

  constructor(private readonly options: LocalTaskRunnerOptions) {
    this.sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  }

  get activeRunId(): string | undefined {
    return this.activeRun?.runId
  }

  async runOnce(): Promise<void> {
    if (this.activeRun || this.isPolling) {
      return
    }
    this.isPolling = true
    try {
      const candidate = await this.options.client.poll()
      if (!candidate) {
        return
      }
      const claim = await this.options.client.claim(candidate)
      if (!claim.accepted) {
        return
      }

      this.activeRun = candidate
      let sequence = candidate.sequence + 1
      let pendingSequence: number | undefined
      let cancelled = false
      const contentIds = new Set<string>()
      const issueSequence = (): number => {
        const issued = sequence++
        pendingSequence = issued
        return issued
      }
      const completeSequence = (issued: number): void => {
        if (pendingSequence === issued)
          pendingSequence = undefined
      }
      const terminalSequence = (): number => {
        if (pendingSequence !== undefined) {
          const issued = pendingSequence
          pendingSequence = undefined
          return issued
        }
        return issueSequence()
      }
      const checkpoint = async () => {
        const issued = issueSequence()
        const heartbeat = await this.options.client.heartbeat(candidate, issued)
        completeSequence(issued)
        cancelled = heartbeat.cancel_requested === true
        return cancelled
      }

      try {
        const adapter = this.options.adapters.select(candidate.snapshot, candidate.proofProfile)
        const result = await adapter.execute({
          candidate,
          checkpoint,
          client: this.options.client,
          nextSequence: issueSequence,
          observe: contentId => contentIds.add(contentId),
        })
        for (const contentId of result.contentIds) contentIds.add(contentId)
        if (!cancelled && await checkpoint())
          cancelled = true

        if (cancelled) {
          await this.options.client.cancelled(candidate, terminalSequence())
        }
        else if (candidate.snapshot.operation === 'repair_players') {
          if (result.repairReceipt)
            await this.options.client.succeededRepair(candidate, terminalSequence(), result.repairReceipt)
          else
            await this.options.client.failed(candidate, terminalSequence(), result.failureCode ?? 'receipt_missing')
        }
        else if (result.availabilityObservation && contentIds.size === 0) {
          const observationSequence = issueSequence()
          const observation = await this.options.client.observeAvailability(candidate, observationSequence, result.availabilityObservation)
          completeSequence(observationSequence)
          if (!observation.accepted) {
            await this.options.client.failed(candidate, terminalSequence(), 'runner_failed')
          }
          else if (candidate.contentId) {
            await this.options.client.succeeded(candidate, terminalSequence(), [candidate.contentId])
          }
          else {
            await this.options.client.failed(candidate, terminalSequence(), 'receipt_missing')
          }
        }
        else if (contentIds.size > 0) {
          const terminal = await this.options.client.succeeded(candidate, terminalSequence(), [...contentIds])
          if (result.availabilityObservation && (terminal?.accepted ?? true)) {
            await this.observeAvailabilityHistory(candidate, result.availabilityObservation, issueSequence, completeSequence)
          }
        }
        else {
          await this.options.client.failed(candidate, terminalSequence(), 'receipt_missing')
        }
      }
      catch {
        await this.options.client.failed(candidate, terminalSequence(), 'runner_failed')
      }
      finally {
        this.activeRun = undefined
      }
    }
    finally {
      this.isPolling = false
    }
  }

  async run(signal: AbortSignal, pollIntervalMs = 5_000): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.runOnce()
      }
      catch {
        // The API remains authoritative; retrying later leaves queued work unchanged.
      }
      await this.sleep(pollIntervalMs)
    }
  }

  private async observeAvailabilityHistory(
    candidate: RunnerCandidate,
    input: RunnerAvailabilityObservationInput,
    issueSequence: () => number,
    completeSequence: (sequence: number) => void,
  ): Promise<void> {
    const observe = async (observation: RunnerAvailabilityObservationInput, sequence = issueSequence()) => {
      try {
        return await this.options.client.observeAvailability(candidate, sequence, observation)
      }
      finally {
        completeSequence(sequence)
      }
    }
    const firstSequence = issueSequence()
    const first = await observe(input, firstSequence)
    if (!first.accepted || !input.observationIdentity)
      return

    await observe({ ...input, observationIdentity: input.observationIdentity }, firstSequence)
    await observe({
      ...input,
      observationIdentity: input.observationIdentity,
      reasonCode: 'content_missing',
      status: 'unknown',
    })
    await observe({
      ...input,
      expectedProjectionVersion: candidate.expectedProjectionVersion,
      observationIdentity: `${input.observationIdentity}:stale`,
    })
    await observe({
      ...input,
      freshness: 'late',
      nextAction: 'ignore',
      observationIdentity: `${input.observationIdentity}:late`,
      reasonCode: 'cancelled',
      status: 'unknown',
    }, candidate.sequence)
  }
}
