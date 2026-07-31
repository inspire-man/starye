import type {
  ProviderDispatchInput,
  ProviderRunConclusion,
  ProviderRunStatus,
  ProviderSnapshot,
} from '../../domain/crawler-tasks/types'
import type {
  GitHubInstallationTokenCredentials,
  GitHubProviderFailureCode,
  GitHubProviderResult,
} from './installation-token'
import {
  classifyGitHubProviderStatus,
  withGitHubInstallationToken,
} from './installation-token'

const ACTIONS_API_ROOT = 'https://api.github.com'
const DEFAULT_MAX_ATTEMPTS = 2
const DEFAULT_TIMEOUT_MS = 10_000

const providerRunStatuses = new Set<ProviderRunStatus>([
  'completed',
  'in_progress',
  'pending',
  'queued',
  'requested',
  'waiting',
])

const providerRunConclusions = new Set<ProviderRunConclusion>([
  'action_required',
  'cancelled',
  'failure',
  'neutral',
  'skipped',
  'stale',
  'startup_failure',
  'success',
  'timed_out',
])

export type GitHubActionsFailureCode
  = | GitHubProviderFailureCode
    | 'github_actions_dispatch_input_invalid'
    | 'github_actions_provider_run_invalid'
    | 'github_actions_response_invalid'
    | 'github_actions_snapshot_mismatch'

export type GitHubActionsResult<T>
  = | { readonly ok: true, readonly value: T }
    | GitHubActionsFailure

export interface GitHubActionsFailure {
  readonly code: GitHubActionsFailureCode
  readonly ok: false
  readonly retryable: boolean
  readonly status?: number
}

export interface GitHubActionsBindings extends GitHubInstallationTokenCredentials {
  readonly environment: string
  readonly owner: string
}

export interface GitHubWorkflowRunSummary {
  readonly conclusion?: ProviderRunConclusion
  readonly headSha?: string
  readonly path?: string
  readonly runAttempt?: number
  readonly status: ProviderRunStatus
}

export interface GitHubActionsClient {
  readonly cancelWorkflowRun: (input: {
    readonly providerRunId: string
    readonly snapshot: ProviderSnapshot
  }) => Promise<GitHubActionsResult<{ readonly accepted: true, readonly kind: 'cancel_accepted' }>>
  readonly dispatchWorkflow: (input: {
    readonly dispatch: ProviderDispatchInput
    readonly snapshot: ProviderSnapshot
  }) => Promise<GitHubActionsResult<{ readonly accepted: true, readonly kind: 'dispatch_accepted' }>>
  readonly getWorkflowRun: (input: {
    readonly providerRunId: string
    readonly snapshot: ProviderSnapshot
  }) => Promise<GitHubActionsResult<GitHubWorkflowRunSummary>>
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function failure(code: GitHubActionsFailureCode, retryable: boolean, status?: number): GitHubActionsFailure {
  return {
    code,
    ok: false,
    retryable,
    ...(status === undefined ? {} : { status }),
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

function isValidProviderRunId(value: string): boolean {
  return /^\d{1,20}$/u.test(value)
}

function isSnapshotBound(snapshot: ProviderSnapshot, bindings: GitHubActionsBindings): boolean {
  return snapshot.provider === 'github-actions'
    && snapshot.repository === `${bindings.owner}/${bindings.repository}`
    && snapshot.environment === bindings.environment
    && snapshot.ref === 'main'
    && ((snapshot.templateKey === 'movie' && snapshot.workflow === '.github/workflows/daily-movie-crawl.yml')
      || (snapshot.templateKey === 'manga' && snapshot.workflow === '.github/workflows/daily-manga-crawl.yml'))
}

function isDispatchBound(dispatch: ProviderDispatchInput, snapshot: ProviderSnapshot): boolean {
  return dispatch.template === snapshot.templateKey && dispatch.target === snapshot.target
}

function toGitHubActionsFailure(result: GitHubProviderResult<never>): GitHubActionsFailure {
  return result.ok
    ? failure('github_actions_response_invalid', false)
    : result
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined
  return value as Readonly<Record<string, unknown>>
}

function parseWorkflowRun(value: unknown): GitHubActionsResult<GitHubWorkflowRunSummary> {
  const record = asRecord(value)
  if (!record || typeof record.status !== 'string' || !providerRunStatuses.has(record.status as ProviderRunStatus))
    return failure('github_actions_response_invalid', false)

  if (record.conclusion !== null && record.conclusion !== undefined && (typeof record.conclusion !== 'string' || !providerRunConclusions.has(record.conclusion as ProviderRunConclusion))) {
    return failure('github_actions_response_invalid', false)
  }
  if (record.path !== undefined && typeof record.path !== 'string')
    return failure('github_actions_response_invalid', false)
  if (record.head_sha !== undefined && (typeof record.head_sha !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(record.head_sha))) {
    return failure('github_actions_response_invalid', false)
  }
  const runAttempt = record.run_attempt
  if (runAttempt !== undefined && (typeof runAttempt !== 'number' || !Number.isSafeInteger(runAttempt) || runAttempt < 1))
    return failure('github_actions_response_invalid', false)

  return {
    ok: true,
    value: {
      ...(typeof record.conclusion === 'string' ? { conclusion: record.conclusion as ProviderRunConclusion } : {}),
      ...(typeof record.head_sha === 'string' ? { headSha: record.head_sha } : {}),
      ...(typeof record.path === 'string' ? { path: record.path } : {}),
      ...(typeof runAttempt === 'number' ? { runAttempt } : {}),
      status: record.status as ProviderRunStatus,
    },
  }
}

/** Builds a closed GitHub Actions surface; all provider identity comes from immutable snapshots. */
export function createGitHubActionsClient(input: {
  readonly bindings: GitHubActionsBindings
  readonly fetch?: FetchImplementation
  readonly maxAttempts?: number
  readonly now?: number
  readonly onRetry?: (input: { readonly attempt: number, readonly code: GitHubActionsFailureCode }) => Promise<void>
  readonly timeoutMs?: number
}): GitHubActionsClient {
  const requestFetch = input.fetch ?? fetch
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function request<T>(request: {
    readonly body?: string
    readonly method: 'DELETE' | 'GET' | 'POST'
    readonly path: string
    readonly success: (response: Response) => Promise<GitHubActionsResult<T>>
  }, token: string): Promise<GitHubActionsResult<T>> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: Response
      try {
        response = await requestFetch(`${ACTIONS_API_ROOT}${request.path}`, {
          ...(request.body === undefined ? {} : { body: request.body }),
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          method: request.method,
          signal: AbortSignal.timeout(timeoutMs),
        })
      }
      catch (error) {
        const transportFailure = isAbortError(error)
          ? failure('github_provider_request_timeout', true)
          : failure('github_provider_network_error', true)
        if (transportFailure.retryable && attempt < maxAttempts) {
          await input.onRetry?.({ attempt, code: transportFailure.code })
          continue
        }
        return transportFailure
      }

      if (response.ok)
        return request.success(response)

      const providerFailure = toGitHubActionsFailure(classifyGitHubProviderStatus(response.status))
      if (providerFailure.retryable && attempt < maxAttempts) {
        await input.onRetry?.({ attempt, code: providerFailure.code })
        continue
      }
      return providerFailure
    }

    return failure('github_provider_unavailable', true)
  }

  async function withToken<T>(operation: (token: string) => Promise<GitHubActionsResult<T>>): Promise<GitHubActionsResult<T>> {
    const tokenResult = await withGitHubInstallationToken({
      credentials: input.bindings,
      fetch: requestFetch,
      now: input.now,
      timeoutMs,
    }, operation)
    return tokenResult.ok ? tokenResult.value : tokenResult
  }

  return {
    async dispatchWorkflow({ dispatch, snapshot }) {
      if (!isSnapshotBound(snapshot, input.bindings))
        return failure('github_actions_snapshot_mismatch', false)
      if (!isDispatchBound(dispatch, snapshot))
        return failure('github_actions_dispatch_input_invalid', false)

      return withToken(token => request<{ readonly accepted: true, readonly kind: 'dispatch_accepted' }>({
        body: JSON.stringify({
          inputs: {
            attempt: String(dispatch.attempt),
            run_id: dispatch.runId,
            target: dispatch.target,
            template: dispatch.template,
          },
          ref: snapshot.ref,
        }),
        method: 'POST',
        path: `/repos/${snapshot.repository}/actions/workflows/${encodeURIComponent(snapshot.workflow)}/dispatches`,
        success: async (response) => {
          if (response.status === 204)
            return { ok: true, value: { accepted: true, kind: 'dispatch_accepted' } }

          const body = asRecord(await response.json().catch(() => undefined))
          return body && (typeof body.id === 'number' || typeof body.id === 'string')
            ? { ok: true, value: { accepted: true, kind: 'dispatch_accepted' } }
            : failure('github_actions_response_invalid', false, response.status)
        },
      }, token))
    },
    async cancelWorkflowRun({ providerRunId, snapshot }) {
      if (!isSnapshotBound(snapshot, input.bindings))
        return failure('github_actions_snapshot_mismatch', false)
      if (!isValidProviderRunId(providerRunId))
        return failure('github_actions_provider_run_invalid', false)

      return withToken(token => request<{ readonly accepted: true, readonly kind: 'cancel_accepted' }>({
        method: 'DELETE',
        path: `/repos/${snapshot.repository}/actions/runs/${providerRunId}/cancel`,
        success: async response => (response.status === 202 || response.status === 204)
          ? { ok: true, value: { accepted: true, kind: 'cancel_accepted' } }
          : failure('github_actions_response_invalid', false, response.status),
      }, token))
    },
    async getWorkflowRun({ providerRunId, snapshot }) {
      if (!isSnapshotBound(snapshot, input.bindings))
        return failure('github_actions_snapshot_mismatch', false)
      if (!isValidProviderRunId(providerRunId))
        return failure('github_actions_provider_run_invalid', false)

      return withToken(token => request<GitHubWorkflowRunSummary>({
        method: 'GET',
        path: `/repos/${snapshot.repository}/actions/runs/${providerRunId}`,
        success: async (response) => {
          try {
            return parseWorkflowRun(await response.json())
          }
          catch {
            return failure('github_actions_response_invalid', false, response.status)
          }
        },
      }, token))
    },
  }
}
