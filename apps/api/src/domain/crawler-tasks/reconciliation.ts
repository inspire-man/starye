import type { GitHubActionsClient, GitHubActionsFailure } from '../../lib/github-app/github-actions-client'
import type { ProviderReconciliationCandidate } from './repository'
import type { ProviderRunStatus } from './types'
import { createProviderSnapshot } from './provider-association'

export const PROVIDER_RECONCILIATION_CADENCE_MS = 60_000

export interface ProviderReconciliationRepository {
  readonly expireProviderReconciliation: (runId: string, attempt: number) => Promise<unknown>
  readonly failProviderReconciliation: (runId: string, attempt: number, reason: string) => Promise<unknown>
  readonly listProviderReconciliationCandidates: () => Promise<readonly ProviderReconciliationCandidate[]>
  readonly recordProviderObservation: (input: {
    readonly attempt: number
    readonly conclusion?: string
    readonly headSha?: string
    readonly path?: string
    readonly providerRunAttempt?: number
    readonly providerRunId: string
    readonly runId: string
    readonly status: ProviderRunStatus
  }) => Promise<unknown>
}

export interface ProviderReconciliationReport {
  readonly failed: number
  readonly lost: number
  readonly observed: number
  readonly skipped: number
}

function isRetryableFailure(result: GitHubActionsFailure): boolean {
  return result.retryable
}

function shouldFailImmediately(result: GitHubActionsFailure): boolean {
  return !result.retryable
    && (result.code === 'github_actions_snapshot_mismatch'
      || result.code === 'github_provider_authorization_failed'
      || result.code === 'github_actions_provider_run_invalid'
      || result.code === 'github_actions_response_invalid')
}

/**
 * Polls only D1-bound provider runs. Provider status remains evidence: success waits
 * for the matching signed receipt, while failed/cancelled/lost facts use repository CAS.
 */
export function createCrawlerTaskReconciliationService(options: {
  readonly client: Pick<GitHubActionsClient, 'getWorkflowRun'>
  readonly now?: () => Date
  readonly repository: ProviderReconciliationRepository
}) {
  const now = options.now ?? (() => new Date())

  async function reconcileCandidate(candidate: ProviderReconciliationCandidate, report: {
    failed: number
    lost: number
    observed: number
    skipped: number
  }): Promise<void> {
    if (!candidate.providerRunId) {
      report.skipped += 1
      return
    }
    const currentNow = Math.floor(now().getTime() / 1000)
    const snapshot = createProviderSnapshot(candidate.template)
    const result = await options.client.getWorkflowRun({
      providerRunId: candidate.providerRunId,
      snapshot,
    })
    if (result.ok) {
      await options.repository.recordProviderObservation({
        attempt: candidate.applicationAttempt,
        ...(result.value.conclusion ? { conclusion: result.value.conclusion } : {}),
        ...(result.value.headSha ? { headSha: result.value.headSha } : {}),
        ...(result.value.path ? { path: result.value.path } : {}),
        ...(result.value.runAttempt ? { providerRunAttempt: result.value.runAttempt } : {}),
        providerRunId: candidate.providerRunId,
        runId: candidate.runId,
        status: result.value.status,
      })
      report.observed += 1
      return
    }

    if (shouldFailImmediately(result)) {
      await options.repository.failProviderReconciliation(candidate.runId, candidate.applicationAttempt, result.code)
      report.failed += 1
      return
    }
    if (isRetryableFailure(result) && candidate.reconciliationWindowEndsAt !== undefined && currentNow < candidate.reconciliationWindowEndsAt) {
      report.skipped += 1
      return
    }

    await options.repository.expireProviderReconciliation(candidate.runId, candidate.applicationAttempt)
    report.lost += 1
  }

  return {
    async reconcile(): Promise<ProviderReconciliationReport> {
      const report = { failed: 0, lost: 0, observed: 0, skipped: 0 }
      const candidates = await options.repository.listProviderReconciliationCandidates()
      for (const candidate of candidates) {
        await reconcileCandidate(candidate, report)
      }
      return report
    },
  }
}
