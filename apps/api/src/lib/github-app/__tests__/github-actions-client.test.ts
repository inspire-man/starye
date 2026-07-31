import { describe, expect, it } from 'vitest'

import { createProviderDispatchInput, createProviderSnapshot } from '../../../domain/crawler-tasks/provider-association'
import { createGitHubActionsClient } from '../github-actions-client'

async function createPrivateKeyPem(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { hash: 'SHA-256', modulusLength: 2048, name: 'RSASSA-PKCS1-v1_5', publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  )
  const encoded = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))))
  return `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`
}

async function createClient(fetch: typeof globalThis.fetch, onRetry?: (input: { readonly attempt: number, readonly code: string }) => Promise<void>) {
  return createGitHubActionsClient({
    bindings: {
      appId: '12345',
      environment: 'starye-org',
      installationId: '67890',
      owner: 'inspire-man',
      privateKeyPem: await createPrivateKeyPem(),
      repository: 'starye',
    },
    fetch,
    now: 1_700_000_000,
    onRetry,
  })
}

describe('github Actions client', () => {
  it('dispatches only the server-owned snapshot and four fixed workflow inputs', async () => {
    const calls: Array<{ readonly input: RequestInfo | URL, readonly init?: RequestInit }> = []
    const client = await createClient(async (input, init) => {
      calls.push({ init, input })
      return calls.length === 1
        ? Response.json({ token: 'installation-token-value' })
        : new Response(null, { status: 204 })
    })
    const snapshot = createProviderSnapshot('movie')
    const dispatch = createProviderDispatchInput({ attempt: 2, runId: 'run-1', templateKey: 'movie' })

    await expect(client.dispatchWorkflow({ dispatch, snapshot })).resolves.toEqual({ accepted: true, kind: 'dispatch_accepted', ok: true })
    expect(String(calls[1].input)).toBe('https://api.github.com/repos/inspire-man/starye/actions/workflows/.github%2Fworkflows%2Fdaily-movie-crawl.yml/dispatches')
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      inputs: { attempt: '2', run_id: 'run-1', target: 'starye-org', template: 'movie' },
      ref: 'main',
    })
  })

  it('keeps provider acceptance, cancel acknowledgement, and provider run state as separate process facts', async () => {
    const client = await createClient(async (_input, init) => {
      if (init?.method === 'POST' && String(init.body).includes('permissions'))
        return Response.json({ token: 'installation-token-value' })
      if (init?.method === 'POST')
        return new Response(null, { status: 202 })
      if (init?.method === 'DELETE')
        return new Response(null, { status: 202 })
      return Response.json({
        conclusion: 'success',
        head_sha: 'a'.repeat(40),
        path: '.github/workflows/daily-movie-crawl.yml',
        run_attempt: 1,
        status: 'completed',
      })
    })
    const snapshot = createProviderSnapshot('movie')
    const dispatch = createProviderDispatchInput({ attempt: 1, runId: 'run-1', templateKey: 'movie' })

    await expect(client.dispatchWorkflow({ dispatch, snapshot })).resolves.toEqual({ accepted: true, kind: 'dispatch_accepted', ok: true })
    await expect(client.cancelWorkflowRun({ providerRunId: '123', snapshot })).resolves.toEqual({ accepted: true, kind: 'cancel_accepted', ok: true })
    await expect(client.getWorkflowRun({ providerRunId: '123', snapshot })).resolves.toEqual({
      ok: true,
      value: {
        conclusion: 'success',
        headSha: 'a'.repeat(40),
        path: '.github/workflows/daily-movie-crawl.yml',
        runAttempt: 1,
        status: 'completed',
      },
    })
  })

  it('rejects snapshot mismatch immediately and distinguishes retryable failures from authorization and timeout', async () => {
    const snapshot = createProviderSnapshot('movie')
    const dispatch = createProviderDispatchInput({ attempt: 1, runId: 'run-1', templateKey: 'movie' })
    const mismatched = { ...snapshot, environment: 'wrong-environment' } as typeof snapshot
    const noFetch = await createClient(async () => {
      throw new Error('should not request')
    })
    await expect(noFetch.dispatchWorkflow({ dispatch, snapshot: mismatched })).resolves.toEqual({
      code: 'github_actions_snapshot_mismatch',
      ok: false,
      retryable: false,
    })

    let retries = 0
    let actionCalls = 0
    const retrying = await createClient(async (_input, init) => {
      if (init?.method === 'POST' && String(init.body).includes('permissions'))
        return Response.json({ token: 'installation-token-value' })
      actionCalls += 1
      return actionCalls === 1 ? new Response(null, { status: 503 }) : new Response(null, { status: 204 })
    }, async () => {
      retries += 1
    })
    await expect(retrying.dispatchWorkflow({ dispatch, snapshot })).resolves.toEqual({ accepted: true, kind: 'dispatch_accepted', ok: true })
    expect(retries).toBe(1)

    const forbidden = await createClient(async (_input, init) => init?.method === 'POST' && String(init.body).includes('permissions')
      ? Response.json({ token: 'installation-token-value' })
      : new Response(null, { status: 403 }))
    await expect(forbidden.dispatchWorkflow({ dispatch, snapshot })).resolves.toEqual({
      code: 'github_provider_authorization_failed',
      ok: false,
      retryable: false,
      status: 403,
    })

    const timedOut = await createClient(async (_input, init) => init?.method === 'POST' && String(init.body).includes('permissions')
      ? Response.json({ token: 'installation-token-value' })
      : Promise.reject(new DOMException('aborted', 'AbortError')))
    await expect(timedOut.dispatchWorkflow({ dispatch, snapshot })).resolves.toEqual({
      code: 'github_provider_request_timeout',
      ok: false,
      retryable: true,
    })
  })
})
