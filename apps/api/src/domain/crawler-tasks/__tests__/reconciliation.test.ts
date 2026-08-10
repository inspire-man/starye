import type { GitHubActionsClient } from '../../../lib/github-app/github-actions-client'
import type { ProviderReconciliationCandidate } from '../repository'
import { describe, expect, it, vi } from 'vitest'
import { validateAvailabilityObservation } from '../availability-contract'
import { createCrawlerTaskReconciliationService } from '../reconciliation'

function candidate(overrides: Partial<ProviderReconciliationCandidate> = {}): ProviderReconciliationCandidate {
  return {
    applicationAttempt: 1,
    environment: 'starye-org',
    providerRunAttempt: 1,
    providerRunId: '123',
    providerStatus: 'in_progress',
    reconciliationWindowEndsAt: 1_700_000_300,
    ref: 'main',
    repository: 'inspire-man/starye',
    runId: 'run-1',
    runStatus: 'running',
    sha: 'a'.repeat(40),
    target: 'starye-org',
    template: 'movie',
    workflow: '.github/workflows/daily-movie-crawl.yml',
    ...overrides,
  }
}

function harness(result: Awaited<ReturnType<GitHubActionsClient['getWorkflowRun']>>, at = new Date('2023-11-14T22:13:20.000Z')) {
  const repository = {
    expireProviderReconciliation: vi.fn().mockResolvedValue({ kind: 'provider_lost' }),
    failProviderReconciliation: vi.fn().mockResolvedValue({ kind: 'updated' }),
    listProviderReconciliationCandidates: vi.fn().mockResolvedValue([candidate()]),
    recordProviderObservation: vi.fn().mockResolvedValue({ kind: 'updated' }),
  }
  const client = { getWorkflowRun: vi.fn().mockResolvedValue(result) }
  const service = createCrawlerTaskReconciliationService({
    client: client as Pick<GitHubActionsClient, 'getWorkflowRun'>,
    now: () => at,
    repository,
  })
  return { client, repository, service }
}

describe('crawler provider reconciliation', () => {
  it('polls only the bound provider run and leaves provider success pending the signed receipt', async () => {
    const { client, repository, service } = harness({
      ok: true,
      value: {
        conclusion: 'success',
        headSha: 'a'.repeat(40),
        path: '.github/workflows/daily-movie-crawl.yml',
        runAttempt: 1,
        status: 'completed',
      },
    })

    await expect(service.reconcile()).resolves.toEqual({ failed: 0, lost: 0, observed: 1, skipped: 0 })
    expect(client.getWorkflowRun).toHaveBeenCalledWith(expect.objectContaining({ providerRunId: '123' }))
    expect(repository.recordProviderObservation).toHaveBeenCalledWith(expect.objectContaining({
      conclusion: 'success',
      providerRunId: '123',
      runId: 'run-1',
      status: 'completed',
    }))
    expect(repository.expireProviderReconciliation).not.toHaveBeenCalled()
  })

  it('uses the finite window for timeout and 5xx facts without automatic business retry', async () => {
    const { repository, service } = harness({
      code: 'github_provider_unavailable',
      ok: false,
      retryable: true,
      status: 503,
    })
    await expect(service.reconcile()).resolves.toEqual({ failed: 0, lost: 0, observed: 0, skipped: 1 })
    expect(repository.expireProviderReconciliation).not.toHaveBeenCalled()
    expect(Object.keys(repository)).not.toContain('retryRun')

    repository.listProviderReconciliationCandidates.mockResolvedValueOnce([
      candidate({ reconciliationWindowEndsAt: 1_700_000_000 }),
    ])
    await expect(service.reconcile()).resolves.toEqual({ failed: 0, lost: 1, observed: 0, skipped: 0 })
    expect(repository.expireProviderReconciliation).toHaveBeenCalledWith('run-1', 1)
  })

  it('fails identity and permission errors immediately with a redacted reason code', async () => {
    const { repository, service } = harness({
      code: 'github_provider_authorization_failed',
      ok: false,
      retryable: false,
      status: 403,
    })
    await expect(service.reconcile()).resolves.toEqual({ failed: 1, lost: 0, observed: 0, skipped: 0 })
    expect(repository.failProviderReconciliation).toHaveBeenCalledWith('run-1', 1, 'github_provider_authorization_failed')
  })

  it('preserves the provider tuple when an observation is handed to the availability contract', () => {
    const provider = candidate()
    const observation = validateAvailabilityObservation({
      attemptNumber: provider.applicationAttempt,
      contentId: 'movie-1',
      eventSequence: 1,
      freshness: 'fresh',
      nextAction: 'recheck',
      observationIdentity: 'provider-observation-1',
      observedAt: provider.reconciliationWindowEndsAt - 1,
      policyVersion: 'v1',
      provider: 'github-actions',
      reasonCode: 'available',
      runId: provider.runId,
      sourceRevision: 3,
      status: 'available',
      summary: { counts: { provider_observed: 1 }, samples: [] },
      target: { id: 'movie-1', kind: 'movie' },
      taskId: 'task-1',
    })
    expect(observation).toMatchObject({
      attemptNumber: provider.applicationAttempt,
      provider: 'github-actions',
      runId: provider.runId,
      taskId: 'task-1',
    })
  })
})
