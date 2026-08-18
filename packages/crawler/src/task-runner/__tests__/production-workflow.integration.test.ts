import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ActionsEventClient } from '../actions-event-client'

const root = path.resolve(import.meta.dirname, '../../../../..')

const workflows = [
  {
    file: 'daily-movie-crawl.yml',
    entry: 'crawler-optimized',
    template: 'movie',
    workflow: '.github/workflows/daily-movie-crawl.yml',
  },
  {
    file: 'daily-manga-crawl.yml',
    entry: 'crawler-comic',
    template: 'manga',
    workflow: '.github/workflows/daily-manga-crawl.yml',
  },
] as const

async function workflowText(file: string): Promise<string> {
  return readFile(path.join(root, '.github', 'workflows', file), 'utf8')
}

function githubExpression(value: string): string {
  return '$' + `{{ ${value} }}`
}

function response(body: unknown = { accepted: true, cancel_requested: false }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('production Actions workflow integration contract', () => {
  it('keeps schedule/manual inputs, target resolution, prepared entries, and cleanup in a fixed order', async () => {
    for (const fixture of workflows) {
      const source = await workflowText(fixture.file)
      const registration = source.indexOf('actions-event-client.ts schedule-register')
      const targetResolution = source.indexOf('resolve-target:')
      const preparation = source.indexOf(`--command ${fixture.entry}`)
      const execution = source.indexOf(`run-prepared-entry --entry ${fixture.entry}`)
      const cleanupStart = source.indexOf('Remove generated target files')
      const cleanup = source.indexOf('if: always()', cleanupStart)

      expect(registration, fixture.file).toBeGreaterThanOrEqual(0)
      expect(targetResolution, fixture.file).toBeGreaterThan(registration)
      expect(preparation, fixture.file).toBeGreaterThan(targetResolution)
      expect(execution, fixture.file).toBeGreaterThan(preparation)
      expect(cleanup, fixture.file).toBeGreaterThan(execution)
      expect(source, fixture.file).toContain('workflow_dispatch:')
      expect(source, fixture.file).toContain('registration_probe:')
      expect(source, fixture.file).toContain('inputs.registration_probe == true')
      expect(source, fixture.file).toContain('INPUT_REGISTRATION_PROBE:')
      expect(source, fixture.file).toContain('needs.register-schedule.result == \'success\'')
      expect(source, fixture.file).toContain('run_id:')
      expect(source, fixture.file).toContain('attempt:')
      expect(source, fixture.file).toContain('template:')
      expect(source, fixture.file).toContain('target:')
      expect(source, fixture.file).toContain(`ACTIONS_PROVIDER_TEMPLATE: ${fixture.template}`)
      expect(source, fixture.file).toContain(`ACTIONS_PROVIDER_WORKFLOW: ${fixture.workflow}`)
      expect(source, fixture.file).toContain('ACTIONS_PROVIDER_REPOSITORY: inspire-man/starye')
      expect(source, fixture.file).toContain('ACTIONS_PROVIDER_REF: main')
      expect(source, fixture.file).toContain('ACTIONS_PROVIDER_TARGET:')
      expect(source, fixture.file).toContain('environment: starye-org')
      expect(source, fixture.file).toContain(`environment: ${githubExpression('needs.resolve-target.outputs.github_environment')}`)
      expect(source, fixture.file).toContain('actions-event-client.ts validate-dispatch')
      expect(source, fixture.file).not.toContain('actions-event-client.ts provider-started')
      expect(source, fixture.file).not.toContain('actions-event-client.ts succeeded')
      expect(source, fixture.file).not.toContain('target_url')
      expect(source, fixture.file).not.toContain('workflow: ' + '$' + '{{ inputs.')
      expect(source, fixture.file).toContain('Remove generated target files')
    }
  })

  it('keeps movie repair dispatch on the shared job with only fixed binding inputs', async () => {
    const source = await workflowText('daily-movie-crawl.yml')
    const inputsStart = source.indexOf('    inputs:')
    const jobsStart = source.indexOf('\njobs:', inputsStart)
    const inputsBlock = source.slice(inputsStart, jobsStart)
    const inputNames = [...inputsBlock.matchAll(/^ {6}([a-z_]+):$/gmu)].map(match => match[1])
    const validation = source.indexOf('actions-event-client.ts validate-dispatch')
    const preparation = source.indexOf('--command crawler-optimized')
    const crawlJob = source.indexOf('\n  crawl:')

    expect(inputNames).toEqual(['run_id', 'attempt', 'template', 'target', 'registration_probe'])
    expect(source).toContain('ACTIONS_PROVIDER_WORKFLOW: .github/workflows/daily-movie-crawl.yml')
    expect(source).toContain('run-prepared-entry --entry crawler-optimized')
    expect(source).not.toMatch(/\b(?:operation|movieId|sourceRevision|reason|targetIntent)\b/u)
    expect(source).not.toMatch(/\n {2}repair[^\n]*:/u)
    expect(validation).toBeGreaterThan(crawlJob)
    expect(preparation).toBeGreaterThan(validation)
  })

  it('serializes one signed adapter sequence for dispatch binding, provider start, checkpoints, and receipt', async () => {
    const calls: Array<{ readonly body: Record<string, unknown>, readonly headers: Headers, readonly url: string }> = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      calls.push({ body, headers: new Headers(init?.headers), url: String(input) })
      return response({ accepted: true, cancel_requested: body.type === 'heartbeat' })
    })
    const client = new ActionsEventClient({
      apiBaseUrl: 'http://localhost:8080',
      callbackKeyId: 'actions-key',
      callbackSecret: 'actions-secret',
      environment: 'starye-org',
      fetch,
      now: () => 1_754_000_000_000,
      ref: 'main',
      repository: 'inspire-man/starye',
      runId: 'run-1',
      attempt: 2,
      providerRunId: '12345',
      providerRunAttempt: 1,
      sha: 'a'.repeat(40),
      target: 'starye-org',
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })

    await client.validateDispatch({ attempt: 2, runId: 'run-1' })
    await client.providerStarted({ attempt: 2, providerRunAttempt: 1, providerRunId: '12345', runId: 'run-1', sha: 'a'.repeat(40) })
    await expect(client.heartbeat(2)).resolves.toEqual({ accepted: true, cancel_requested: true })
    await client.progress(3, { fetched: 1 })
    await client.log(4, 'provider progress')
    await client.succeeded(5, ['MOVIE-001'], { createdCount: 1 })

    expect(calls.map(call => new URL(call.url).pathname)).toEqual([
      '/api/internal/crawler-runs/dispatch-validate',
      '/api/internal/crawler-runs/run-1/provider-started',
      '/api/internal/crawler-runs/run-1/events',
      '/api/internal/crawler-runs/run-1/events',
      '/api/internal/crawler-runs/run-1/events',
      '/api/internal/crawler-runs/run-1/events',
    ])
    expect(calls.map(call => call.body.type)).toEqual(['dispatch_validate', 'provider_started', 'heartbeat', 'progress', 'log', 'succeeded'])
    expect(calls[1]?.body).toMatchObject({
      attempt: 2,
      environment: 'starye-org',
      provider_run_attempt: 1,
      provider_run_id: '12345',
      run_id: 'run-1',
      target: 'starye-org',
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
    })
    expect(calls[5]?.body).toMatchObject({
      receipt: { contentIds: ['MOVIE-001'], createdCount: 1, templateKey: 'movie' },
      sequence: 5,
      type: 'succeeded',
    })
    expect(Object.keys(calls[2]?.body ?? {}).sort()).toEqual(['attempt', 'event_id', 'key_id', 'nonce', 'run_id', 'sequence', 'timestamp', 'type'])
    expect(calls[2]?.body).not.toHaveProperty('provider_run_attempt')
    expect(calls[2]?.body).not.toHaveProperty('provider_run_id')
    expect(calls[5]?.body).not.toHaveProperty('provider_run_attempt')
    expect(calls[5]?.body).not.toHaveProperty('provider_run_id')
    for (const call of calls) {
      expect(call.headers.get('x-runner-key-id')).toBe('actions-key')
      expect(call.headers.get('x-runner-signature')).not.toContain('actions-secret')
    }
  })
})
