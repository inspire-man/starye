import type { DataChainEvidence } from '../data-chain-evidence'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
  createDataChainExecutionReceipt,
  createResolvedPendingEvidence,

  renderDataChainEvidenceMarkdown,
  serializeDataChainEvidenceJson,
} from '../data-chain-evidence'

const evidenceRoot = path.resolve('phase13-evidence')
const baseOptions = {
  mode: 'local' as const,
  target: 'starye-org',
  runId: 'local-20260716t000000z',
  evidenceRoot,
}

function evidencePath(mode: 'local' | 'remote', extension: 'json' | 'md'): string {
  return path.join(evidenceRoot, baseOptions.target, baseOptions.runId, `${mode}.${extension}`)
}

interface SmokeModule {
  runDataChainSmoke: (options: unknown, dependencies?: unknown) => Promise<{ exitCode: 0 | typeof CHECKPOINT_EXIT_CODE, evidence: DataChainEvidence }>
  checkServicesDefault: (execute?: () => { exitCode: number, stdout: string, stderr: string }) => Promise<{ exitCode: number, stdout: string, stderr: string }>
  observeGatewayAuthDefault: (dependencies?: {
    readonly gatewayAuthFetch?: typeof fetch
    readonly gatewayAuthTimeoutMs?: number
  }) => Promise<{ outcome: 'accepted' | 'timeout' | 'fetch_failed' | 'http_status_unaccepted' | 'redirect_invalid' }>
  validGatewayAuth: (response: { outcome: 'accepted' | 'timeout' | 'fetch_failed' | 'http_status_unaccepted' | 'redirect_invalid' }) => boolean
}

interface ObservationModule {
  parseDataChainSurfaceObservationArgs: (argv: readonly string[]) => { mode: 'local' | 'remote', target: string, runId: string }
  observeSurfaceDefault: (input: unknown, puppeteer: unknown) => Promise<{ status: 'passed' | 'unavailable', itemCode?: string, itemId?: string }>
  observeDataChainSurfaces: (options: unknown, dependencies?: unknown) => Promise<{ exitCode: 0 | typeof CHECKPOINT_EXIT_CODE, evidence: DataChainEvidence }>
}

interface VerifyModule {
  verifyDataChainSmoke: (options: unknown, dependencies?: unknown) => Promise<0 | typeof CHECKPOINT_EXIT_CODE>
}

async function loadSmoke() {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/data-chain-smoke.ts', import.meta.url).href) as Promise<SmokeModule>
}

async function loadObservation() {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/data-chain-surface-observation.ts', import.meta.url).href) as Promise<ObservationModule>
}

async function loadVerify() {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/verify-data-chain-smoke.ts', import.meta.url).href) as Promise<VerifyModule>
}

function validServiceReadinessRecord() {
  return {
    schema: 'starye-local-services-1',
    healthy: true,
    listeners: [
      { name: 'Gateway', port: 8080, listening: true },
      { name: 'API', port: 8787, listening: true },
      { name: 'Dashboard', port: 5173, listening: true },
      { name: 'Blog', port: 3002, listening: true },
      { name: 'Auth', port: 3003, listening: true },
      { name: 'Comic', port: 3000, listening: true },
      { name: 'Movie', port: 3001, listening: true },
    ],
    gateway: {
      schema: 'starye-gateway-readiness-1',
      healthy: true,
      robots: { outcome: 'accepted' },
      auth: { outcome: 'accepted' },
      authSlash: { outcome: 'accepted' },
    },
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

function successDependencies() {
  const candidate = createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId })
  return {
    resolveTarget: () => ({
      id: baseOptions.target,
      profile: { local: { wranglerProfile: 'starye-org' } },
    }),
    collectProjectionIssues: async (): Promise<object[]> => [],
    runPreflight: vi.fn((_options: unknown): { ok: boolean, issues: object[] } => ({ ok: true, issues: [] })),
    inspectLocalD1: async (): Promise<{ status: 'ready' | 'unready', checkpoint?: string }> => ({ status: 'ready' }),
    checkServices: async () => ({ exitCode: 0, stdout: '[OK] all services', stderr: '' }),
    observeGatewayAuth: async () => ({ outcome: 'accepted' as const }),
    runFixture: vi.fn(async () => ({ itemCode: candidate.itemCode, itemCount: 1 as const })),
    snapshot: vi.fn(async () => ({ status: 'found' as const, itemCode: candidate.itemCode, itemId: 'movie-42', itemCount: 1 as const })),
    fetchGatewayApi: vi.fn(async (): Promise<{ status: number, itemCode?: string, itemId?: string }> => ({ status: 200, itemCode: candidate.itemCode, itemId: 'movie-42' })),
    write: async () => {},
  }
}

function localReceipt(surface: 'local_projection' | 'local_d1_readiness' | 'service_readiness' | 'gateway_auth' | 'd1' | 'api') {
  const candidate = createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId })
  const capture = {
    local_projection: 'local_projection',
    local_d1_readiness: 'local_d1_readiness',
    service_readiness: 'service_probe',
    gateway_auth: 'gateway_auth',
    d1: 'local_fixture_snapshot',
    api: 'canonical_api',
  } as const
  const routePath = surface === 'gateway_auth'
    ? '/auth/'
    : surface === 'api' ? `/api/public/movies/${candidate.itemCode}` : undefined
  return createDataChainExecutionReceipt({
    source: 'local_runner',
    capture: capture[surface],
    mode: 'local',
    targetId: baseOptions.target,
    runId: baseOptions.runId,
    itemCode: candidate.itemCode,
    itemId: 'movie-42',
    surface,
    ...(routePath ? { path: routePath } : {}),
    timestamp: '2026-07-16T00:00:00.000Z',
  })
}

describe('phase 13 local smoke runner', () => {
  it('sanitizes an ambient remote token through the default local preflight wiring', async () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'ambient-test-token')
    const { runDataChainSmoke } = await loadSmoke()
    const candidate = createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId })

    const result = await runDataChainSmoke(baseOptions, {
      resolveTarget: () => ({
        id: baseOptions.target,
        profile: { local: { wranglerProfile: 'starye-org' } },
      }),
      collectProjectionIssues: async () => [],
      environment: { CLOUDFLARE_API_TOKEN: 'ambient-test-token' },
      inspectLocalD1: async () => ({ status: 'ready' }),
      checkServices: async () => ({ exitCode: 0, stdout: '[OK] all services', stderr: '' }),
      observeGatewayAuth: async () => ({ outcome: 'accepted' as const }),
      runFixture: async () => ({ itemCode: candidate.itemCode, itemCount: 1 }),
      snapshot: async () => ({
        status: 'found',
        itemCode: candidate.itemCode,
        itemId: 'movie-42',
        itemCount: 1,
      }),
      fetchGatewayApi: async () => ({
        status: 200,
        itemCode: candidate.itemCode,
        itemId: 'movie-42',
      }),
      now: () => '2026-07-16T00:00:00.000Z',
      write: async () => {},
    })

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({
      ingestState: 'resolved_pending_observation',
      aggregate: 'pending',
      itemId: 'movie-42',
    })
  })

  it('uses local validate without a live executor and stops projection failures before fixture work', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const dependencies = successDependencies()
    dependencies.collectProjectionIssues = async () => [{ kind: 'target-managed-mismatch', file: '.env.local', key: 'VITE_API_URL', expected: 'http://localhost:8080' }]
    dependencies.runPreflight = vi.fn(() => ({ ok: false, issues: [{ code: 'projection-mismatch' }] }))

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ ingestState: 'pre_ingest', itemId: null, aggregate: 'checkpoint' })
    expect(result.evidence.observations).toEqual([{ surface: 'local_projection', status: 'checkpoint', checkpoint: 'projection-mismatch' }])
    expect(dependencies.runPreflight).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'local',
      command: 'validate',
      wranglerProfile: 'starye-org',
    }))
    expect(dependencies.runPreflight.mock.calls[0]?.[0]).not.toHaveProperty('live')
    expect(dependencies.runPreflight.mock.calls[0]?.[0]).not.toHaveProperty('liveCheckExecutor')
    expect(dependencies.runFixture).not.toHaveBeenCalled()
    expect(dependencies.snapshot).not.toHaveBeenCalled()
    expect(dependencies.fetchGatewayApi).not.toHaveBeenCalled()
  })

  it('persists the first allowlisted preflight diagnostic and keeps other failures generic', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const tokenDependencies = successDependencies()
    tokenDependencies.collectProjectionIssues = async () => []
    tokenDependencies.runPreflight = vi.fn(() => ({
      ok: false,
      issues: [
        { code: 'invalid-command' },
        { code: 'local-api-token-shadowing' },
      ],
    }))

    const tokenResult = await runDataChainSmoke(baseOptions, tokenDependencies)

    expect(tokenResult.evidence.observations).toEqual([{
      surface: 'local_projection',
      status: 'checkpoint',
      checkpoint: 'local-api-token-shadowing',
    }])
    expect(tokenDependencies.runFixture).not.toHaveBeenCalled()

    const genericDependencies = successDependencies()
    genericDependencies.collectProjectionIssues = async () => []
    genericDependencies.runPreflight = vi.fn(() => ({
      ok: false,
      issues: [{ code: 'invalid-command', message: 'ambient-test-token must stay private' }],
    }))

    const genericResult = await runDataChainSmoke(baseOptions, genericDependencies)

    expect(genericResult.evidence.observations).toEqual([{
      surface: 'local_projection',
      status: 'checkpoint',
      checkpoint: 'target_projection_unmet',
    }])
    expect(JSON.stringify(genericResult.evidence)).not.toContain('ambient-test-token')

    const resolverDependencies = successDependencies()
    resolverDependencies.resolveTarget = () => {
      throw new Error('resolver failed')
    }

    const resolverResult = await runDataChainSmoke(baseOptions, resolverDependencies)

    expect(resolverResult.evidence.observations).toEqual([{
      surface: 'local_projection',
      status: 'checkpoint',
      checkpoint: 'target_projection_unmet',
    }])
  })

  it('rejects missing schema and service [!!] output before fixture work', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const d1Dependencies = successDependencies()
    d1Dependencies.inspectLocalD1 = async () => ({ status: 'unready' as const, checkpoint: 'local_d1_readiness_unmet' as const })

    const d1Result = await runDataChainSmoke(baseOptions, d1Dependencies)
    expect(d1Result.evidence).toMatchObject({ ingestState: 'pre_ingest', itemId: null })
    expect(d1Result.evidence.observations[0]).toMatchObject({ surface: 'local_d1_readiness', checkpoint: 'local_d1_readiness_unmet' })
    expect(d1Dependencies.runFixture).not.toHaveBeenCalled()

    const servicesDependencies = successDependencies()
    servicesDependencies.checkServices = async () => ({ exitCode: 0, stdout: '[!!] api unavailable', stderr: '' })
    const servicesResult = await runDataChainSmoke(baseOptions, servicesDependencies)
    expect(servicesResult.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(servicesResult.evidence.observations[0]).toMatchObject({ surface: 'service_readiness', checkpoint: 'local_prerequisite_unmet' })
    expect(servicesDependencies.runFixture).not.toHaveBeenCalled()
  })

  it('accepts one healthy service machine record and rejects human text, malformed, duplicate, or unhealthy records', async () => {
    const { checkServicesDefault } = await loadSmoke()
    const healthy = validServiceReadinessRecord()

    await expect(checkServicesDefault(() => ({
      exitCode: 0,
      stdout: `[OK] all listeners are present\n${JSON.stringify(healthy)}`,
      stderr: '',
    }))).resolves.toMatchObject({ exitCode: 0 })

    const invalidOutputs = [
      '[OK] all listeners are present',
      '{not-json}',
      `${JSON.stringify(healthy)}\n${JSON.stringify(healthy)}`,
      JSON.stringify({ ...healthy, schema: 'wrong-schema' }),
      JSON.stringify({ ...healthy, healthy: false }),
      JSON.stringify({ ...healthy, listeners: healthy.listeners.slice(1) }),
    ]
    for (const stdout of invalidOutputs) {
      await expect(checkServicesDefault(() => ({ exitCode: 0, stdout: `[OK] all listeners are present\n${stdout}`, stderr: '' }))).resolves.toMatchObject({ exitCode: 1 })
    }
    await expect(checkServicesDefault(() => ({ exitCode: 1, stdout: JSON.stringify(healthy), stderr: '' }))).resolves.toMatchObject({ exitCode: 1 })
  })

  it('treats an unhealthy combined service record as a pre-ingest checkpoint with no downstream calls', async () => {
    const { checkServicesDefault, runDataChainSmoke } = await loadSmoke()
    const dependencies = successDependencies()
    dependencies.checkServices = () => checkServicesDefault(() => ({
      exitCode: 0,
      stdout: `[OK] all listeners are present\n${JSON.stringify({ ...validServiceReadinessRecord(), healthy: false })}`,
      stderr: '',
    }))

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.evidence.observations).toEqual([{ surface: 'service_readiness', status: 'checkpoint', checkpoint: 'local_prerequisite_unmet' }])
    expect(dependencies.runFixture).not.toHaveBeenCalled()
    expect(dependencies.snapshot).not.toHaveBeenCalled()
    expect(dependencies.fetchGatewayApi).not.toHaveBeenCalled()
  })

  it('accepts only a local Gateway auth response before fixture execution', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const dependencies = successDependencies()
    dependencies.observeGatewayAuth = async () => ({ outcome: 'redirect_invalid' as const })

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ ingestState: 'pre_ingest', itemId: null })
    expect(result.evidence.observations[0]).toMatchObject({ surface: 'gateway_auth', checkpoint: 'gateway_auth_unavailable' })
    expect(dependencies.runFixture).not.toHaveBeenCalled()
  })

  it('delegates default Gateway auth to the bounded closed probe and accepts only accepted output', async () => {
    const { observeGatewayAuthDefault, validGatewayAuth } = await loadSmoke()
    const fetch = vi.fn(async () => new Response(null, { status: 200 }))

    const result = await observeGatewayAuthDefault({ gatewayAuthFetch: fetch, gatewayAuthTimeoutMs: 25 })

    expect(fetch).toHaveBeenCalledWith('http://localhost:8080/auth/', expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }))
    expect(result).toEqual({ outcome: 'accepted' })
    expect(validGatewayAuth(result)).toBe(true)
    expect(validGatewayAuth({ outcome: 'timeout' })).toBe(false)
  })

  it('preserves the resolved tuple when the Gateway API cannot correlate it', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const dependencies = successDependencies()
    dependencies.fetchGatewayApi = vi.fn(async () => ({ status: 404, itemCode: 'wrong-code' }))

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({
      ingestState: 'resolved_pending_observation',
      itemId: 'movie-42',
      aggregate: 'checkpoint',
    })
    expect(result.evidence.observations.map(row => row.surface)).toEqual([
      'local_projection',
      'local_d1_readiness',
      'service_readiness',
      'gateway_auth',
      'd1',
      'api',
    ])
  })

  it('creates pending evidence after the Gateway-correlated fixture and snapshot', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const result = await runDataChainSmoke(baseOptions, successDependencies())

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({
      ingestState: 'resolved_pending_observation',
      aggregate: 'pending',
      itemId: 'movie-42',
    })
    expect(result.evidence.observations).toContainEqual(expect.objectContaining({
      surface: 'api',
      status: 'passed',
      path: expect.any(String),
      origin: 'http://localhost:8080',
    }))
    expect(result.evidence.observations.filter(row => row.status === 'passed')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ surface: 'local_projection', receipt: expect.objectContaining({ source: 'local_runner', result: 'passed' }) }),
        expect.objectContaining({ surface: 'd1', receipt: expect.objectContaining({ capture: 'local_fixture_snapshot', itemId: 'movie-42' }) }),
        expect.objectContaining({ surface: 'api', receipt: expect.objectContaining({ path: expect.stringContaining('/api/public/movies/') }) }),
      ]),
    )
  })

  it('turns fixture or D1 count, code, and id mismatches into checkpoint evidence before API proof', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const fixtureMismatch = successDependencies()
    fixtureMismatch.runFixture = vi.fn(async () => ({
      itemCode: createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode,
      itemCount: 9 as never,
    }))

    const fixtureResult = await runDataChainSmoke(baseOptions, fixtureMismatch)
    expect(fixtureResult.evidence.observations[0]).toMatchObject({ surface: 'service_readiness', checkpoint: 'local_prerequisite_unmet' })
    expect(fixtureMismatch.snapshot).not.toHaveBeenCalled()
    expect(fixtureMismatch.fetchGatewayApi).not.toHaveBeenCalled()

    const d1Mismatch = successDependencies()
    d1Mismatch.snapshot = vi.fn(async () => ({
      status: 'found' as const,
      itemCode: createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode,
      itemId: 'movie-42',
      itemCount: 9 as never,
    }))

    const d1Result = await runDataChainSmoke(baseOptions, d1Mismatch)
    expect(d1Result.evidence.observations[0]).toMatchObject({ surface: 'local_d1_readiness', checkpoint: 'fixture_seed_incomplete' })
    expect(d1Mismatch.fetchGatewayApi).not.toHaveBeenCalled()

    const codeMismatch = successDependencies()
    codeMismatch.snapshot = vi.fn(async () => ({
      status: 'found' as const,
      itemCode: 'phase13-smoke-sibling-code',
      itemId: 'movie-42',
      itemCount: 1 as const,
    }))

    const codeResult = await runDataChainSmoke(baseOptions, codeMismatch)
    expect(codeResult.evidence.observations[0]).toMatchObject({ surface: 'local_d1_readiness', checkpoint: 'fixture_seed_incomplete' })
    expect(codeMismatch.fetchGatewayApi).not.toHaveBeenCalled()

    const idMismatch = successDependencies()
    idMismatch.snapshot = vi.fn(async () => ({
      status: 'found' as const,
      itemCode: createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode,
      itemId: '',
      itemCount: 1 as const,
    }))

    const idResult = await runDataChainSmoke(baseOptions, idMismatch)
    expect(idResult.evidence.observations[0]).toMatchObject({ surface: 'local_d1_readiness', checkpoint: 'fixture_seed_incomplete' })
    expect(idMismatch.fetchGatewayApi).not.toHaveBeenCalled()
  })

  it('accepts only the controlled observer mode, target, and run tuple', async () => {
    const { parseDataChainSurfaceObservationArgs } = await loadObservation()
    expect(parseDataChainSurfaceObservationArgs(['--mode', 'local', '--target', 'starye-org', '--run-id', 'run'])).toEqual({
      mode: 'local',
      target: 'starye-org',
      runId: 'run',
    })
    for (const forbidden of ['--status', '--surface', '--item-code', '--item-id', '--path', '--origin', '--validate']) {
      const argv = forbidden === '--validate'
        ? ['--mode', 'local', '--target', 'starye-org', '--run-id', 'run', forbidden]
        : ['--mode', 'local', '--target', 'starye-org', '--run-id', 'run', forbidden, 'passed']
      expect(() => parseDataChainSurfaceObservationArgs(argv)).toThrow()
    }
  })

  it('derives the pending tuple and observes Dashboard before viewer without caller claims', async () => {
    const { observeDataChainSurfaces } = await loadObservation()
    const evidence = createResolvedPendingEvidence({
      targetId: baseOptions.target,
      runId: baseOptions.runId,
      itemCode: createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode,
      itemId: 'movie-42',
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      observations: [
        { surface: 'local_projection', status: 'passed', receipt: localReceipt('local_projection') },
        { surface: 'local_d1_readiness', status: 'passed', receipt: localReceipt('local_d1_readiness') },
        { surface: 'service_readiness', status: 'passed', receipt: localReceipt('service_readiness') },
        { surface: 'gateway_auth', status: 'passed', path: '/auth/', origin: 'http://localhost:8080', receipt: localReceipt('gateway_auth') },
        { surface: 'd1', status: 'passed', itemCount: 1, receipt: localReceipt('d1') },
        { surface: 'api', status: 'passed', path: `/api/public/movies/${createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode}`, origin: 'http://localhost:8080', receipt: localReceipt('api') },
      ],
    })
    const files = new Map<string, string>()
    const write = async (file: string, contents: string) => {
      files.set(file, contents)
    }
    const read = async (file: string) => files.get(file)
    const itemCode = evidence.itemCode

    await write(evidencePath('local', 'json'), serializeDataChainEvidenceJson(evidence))
    await write(evidencePath('local', 'md'), renderDataChainEvidenceMarkdown(evidence))
    const observedInputs: Array<{ surface: 'dashboard' | 'viewer', baseUrl: string, path: string, itemCode: string, itemId: string }> = []
    const observeSurface = vi.fn(async (input: { surface: 'dashboard' | 'viewer', baseUrl: string, path: string, itemCode: string, itemId: string }) => {
      observedInputs.push(input)
      return {
        status: 'passed' as const,
        itemCode,
        itemId: 'movie-42',
      }
    })

    const result = await observeDataChainSurfaces({ mode: 'local', target: baseOptions.target, runId: baseOptions.runId }, {
      read,
      write,
      evidenceRoot,
      observeSurface,
      now: () => '2026-07-16T00:01:00.000Z',
    })

    expect(result.exitCode).toBe(0)
    expect(result.evidence).toMatchObject({ ingestState: 'resolved', aggregate: 'passed', itemCode, itemId: 'movie-42' })
    expect(observedInputs.map(input => input.surface)).toEqual(['dashboard', 'viewer'])
    expect(observedInputs[0]).toMatchObject({ baseUrl: 'http://localhost:8080', path: '/dashboard/movies', itemCode, itemId: 'movie-42' })
    expect(observedInputs[1]).toMatchObject({ path: `/movie/${itemCode}`, itemCode, itemId: 'movie-42' })
    expect(result.evidence.observations.slice(-2)).toEqual([
      expect.objectContaining({ surface: 'dashboard', status: 'passed', receipt: expect.objectContaining({ source: 'browser_observer' }) }),
      expect.objectContaining({ surface: 'viewer', status: 'passed', receipt: expect.objectContaining({ source: 'browser_observer' }) }),
    ])
  })

  it('waits for the exact SPA tuple before the default browser observer can pass', async () => {
    const { observeSurfaceDefault } = await loadObservation()
    const events: string[] = []
    const itemCode = 'starye-smoke-local-20260716t000000z'
    const itemId = 'movie-42'
    const pageDocument = {
      body: { textContent: itemCode },
      documentElement: { outerHTML: `<span>${itemCode}</span>` },
    }
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    Object.defineProperty(globalThis, 'document', { configurable: true, value: pageDocument })
    const waitForFunction = vi.fn(async (
      predicate: (code: string, id: string) => boolean,
      _options: unknown,
      code: string,
      id: string,
    ) => {
      events.push('wait-for-tuple')
      expect(predicate(code, id)).toBe(false)
      pageDocument.documentElement.outerHTML = `<span data-phase13-item-id="${id}">${code}</span>`
      expect(predicate(code, id)).toBe(true)
      return {}
    })
    const evaluate = vi.fn(async (
      evaluateTuple: (code: string, id: string) => { codeMatches: boolean, idMatches: boolean },
      code: string,
      id: string,
    ) => {
      events.push('evaluate-tuple')
      return evaluateTuple(code, id)
    })
    const close = vi.fn(async () => {
      events.push('close')
    })
    const puppeteer = {
      launch: vi.fn(async () => ({
        newPage: async () => ({
          goto: async () => {
            events.push('goto')
            return { ok: () => true }
          },
          url: () => 'http://localhost:8080/dashboard/movies',
          waitForFunction,
          evaluate,
        }),
        close,
      })),
    }

    try {
      await expect(observeSurfaceDefault({
        mode: 'local',
        targetId: baseOptions.target,
        runId: baseOptions.runId,
        itemCode,
        itemId,
        surface: 'dashboard',
        baseUrl: 'http://localhost:8080',
        path: '/dashboard/movies',
      }, puppeteer)).resolves.toEqual({ status: 'passed', itemCode, itemId })
      expect(waitForFunction).toHaveBeenCalledWith(
        expect.any(Function),
        { polling: 'mutation', timeout: 30_000 },
        itemCode,
        itemId,
      )
      expect(events).toEqual(['goto', 'wait-for-tuple', 'evaluate-tuple', 'close'])
    }
    finally {
      if (originalDocument) {
        Object.defineProperty(globalThis, 'document', originalDocument)
      }
      else {
        Reflect.deleteProperty(globalThis, 'document')
      }
    }
  })

  it('persists a Dashboard checkpoint when the browser cannot correlate the derived item', async () => {
    const { observeDataChainSurfaces } = await loadObservation()
    const itemCode = createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode
    const pending = createResolvedPendingEvidence({
      targetId: baseOptions.target,
      runId: baseOptions.runId,
      itemCode,
      itemId: 'movie-42',
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      observations: [
        { surface: 'local_projection', status: 'passed', receipt: localReceipt('local_projection') },
        { surface: 'local_d1_readiness', status: 'passed', receipt: localReceipt('local_d1_readiness') },
        { surface: 'service_readiness', status: 'passed', receipt: localReceipt('service_readiness') },
        { surface: 'gateway_auth', status: 'passed', path: '/auth/', origin: 'http://localhost:8080', receipt: localReceipt('gateway_auth') },
        { surface: 'd1', status: 'passed', itemCount: 1, receipt: localReceipt('d1') },
        { surface: 'api', status: 'passed', path: `/api/public/movies/${itemCode}`, origin: 'http://localhost:8080', receipt: localReceipt('api') },
      ],
    })
    const files = new Map([
      [evidencePath('local', 'json'), serializeDataChainEvidenceJson(pending)],
      [evidencePath('local', 'md'), renderDataChainEvidenceMarkdown(pending)],
    ])
    const observeSurface = vi.fn(async () => ({ status: 'passed' as const, itemCode, itemId: 'wrong-id' }))

    const result = await observeDataChainSurfaces({ mode: 'local', target: baseOptions.target, runId: baseOptions.runId }, {
      evidenceRoot,
      read: async (file: string) => files.get(file),
      write: async (file: string, contents: string) => { files.set(file, contents) },
      observeSurface,
      now: () => '2026-07-16T00:01:00.000Z',
    })

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ ingestState: 'resolved_pending_observation', aggregate: 'checkpoint', itemId: 'movie-42' })
    expect(result.evidence.observations.at(-1)).toMatchObject({ surface: 'dashboard', status: 'checkpoint', checkpoint: 'dashboard_auth_unavailable' })
    expect(observeSurface).toHaveBeenCalledTimes(1)

    const unavailableFiles = new Map([
      [evidencePath('local', 'json'), serializeDataChainEvidenceJson(pending)],
      [evidencePath('local', 'md'), renderDataChainEvidenceMarkdown(pending)],
    ])
    const unavailable = await observeDataChainSurfaces({ mode: 'local', target: baseOptions.target, runId: baseOptions.runId }, {
      evidenceRoot,
      read: async (file: string) => unavailableFiles.get(file),
      write: async (file: string, contents: string) => { unavailableFiles.set(file, contents) },
      observeSurface: async () => { throw new Error('browser unavailable') },
      now: () => '2026-07-16T00:01:00.000Z',
    })
    expect(unavailable.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(unavailable.evidence.observations.at(-1)).toMatchObject({ surface: 'dashboard', status: 'checkpoint' })
  })

  it('preserves only valid runner exit 0 or 2 artifacts in the shared wrapper', async () => {
    const { verifyDataChainSmoke } = await loadVerify()
    const candidate = createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId })
    const pending = createResolvedPendingEvidence({
      targetId: baseOptions.target,
      runId: baseOptions.runId,
      itemCode: candidate.itemCode,
      itemId: 'movie-42',
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      observations: [{ surface: 'local_projection', status: 'passed' }],
    })
    const files = new Map([
      [evidencePath('local', 'json'), serializeDataChainEvidenceJson(pending)],
      [evidencePath('local', 'md'), renderDataChainEvidenceMarkdown(pending)],
    ])

    await expect(verifyDataChainSmoke(baseOptions, {
      run: async () => CHECKPOINT_EXIT_CODE,
      read: async (file: string) => files.get(file),
    })).resolves.toBe(CHECKPOINT_EXIT_CODE)
    await expect(verifyDataChainSmoke(baseOptions, {
      run: async () => 1,
      read: async (file: string) => files.get(file),
    })).rejects.toThrow('unexpected exit code')
  })
})
