import type { GitHubAppJwtFailureCode } from './jwt'
import { createGitHubAppJwt } from './jwt'

const DEFAULT_TIMEOUT_MS = 10_000

export type GitHubProviderFailureCode
  = | GitHubAppJwtFailureCode
    | 'github_installation_token_request_invalid'
    | 'github_installation_token_response_invalid'
    | 'github_provider_authorization_failed'
    | 'github_provider_network_error'
    | 'github_provider_rate_limited'
    | 'github_provider_request_failed'
    | 'github_provider_request_timeout'
    | 'github_provider_unavailable'

export type GitHubProviderResult<T>
  = | { readonly ok: true, readonly value: T }
    | {
      readonly code: GitHubProviderFailureCode
      readonly ok: false
      readonly retryable: boolean
      readonly status?: number
    }

export interface GitHubInstallationTokenCredentials {
  readonly appId: string
  readonly installationId: string
  readonly privateKeyPem: string
  readonly repository: string
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function failure(code: GitHubProviderFailureCode, retryable: boolean, status?: number): GitHubProviderResult<never> {
  return {
    code,
    ok: false,
    retryable,
    ...(status === undefined ? {} : { status }),
  }
}

function isValidCredentials(value: GitHubInstallationTokenCredentials): boolean {
  return /^\d+$/u.test(value.installationId) && /^[\w.-]+$/u.test(value.repository)
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

/** Converts provider transport outcomes into redacted retry decisions. */
export function classifyGitHubProviderStatus(status: number): GitHubProviderResult<never> {
  if (status === 408)
    return failure('github_provider_request_timeout', true, status)
  if (status === 429)
    return failure('github_provider_rate_limited', true, status)
  if (status >= 500 && status <= 599)
    return failure('github_provider_unavailable', true, status)
  if (status === 401 || status === 403)
    return failure('github_provider_authorization_failed', false, status)
  return failure('github_provider_request_failed', false, status)
}

/** Mints one installation token and confines it to the supplied in-request operation. */
export async function withGitHubInstallationToken<T>(
  input: {
    readonly credentials: GitHubInstallationTokenCredentials
    readonly fetch?: FetchImplementation
    readonly now?: number
    readonly timeoutMs?: number
  },
  operation: (token: string) => Promise<T>,
): Promise<GitHubProviderResult<T>> {
  if (!isValidCredentials(input.credentials))
    return failure('github_installation_token_request_invalid', false)

  const appJwt = await createGitHubAppJwt({
    appId: input.credentials.appId,
    now: input.now,
    privateKeyPem: input.credentials.privateKeyPem,
  })
  if (!appJwt.ok)
    return failure(appJwt.code, false)

  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const requestFetch = input.fetch ?? fetch
  let response: Response
  try {
    response = await requestFetch(
      `https://api.github.com/app/installations/${input.credentials.installationId}/access_tokens`,
      {
        body: JSON.stringify({
          permissions: { actions: 'write' },
          repositories: [input.credentials.repository],
        }),
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${appJwt.value}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
      },
    )
  }
  catch (error) {
    return isAbortError(error)
      ? failure('github_provider_request_timeout', true)
      : failure('github_provider_network_error', true)
  }

  if (!response.ok)
    return classifyGitHubProviderStatus(response.status)

  let responseBody: unknown
  try {
    responseBody = await response.json()
  }
  catch {
    return failure('github_installation_token_response_invalid', false, response.status)
  }

  const body = responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)
    ? responseBody as Readonly<Record<string, unknown>>
    : undefined
  if (typeof body?.token !== 'string' || !body.token.trim()) {
    return failure('github_installation_token_response_invalid', false, response.status)
  }

  return { ok: true, value: await operation(body.token) }
}
