import type { DataChainEvidence } from '../data-chain-evidence'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
  createResolvedPendingEvidence,

  renderDataChainEvidenceMarkdown,
  serializeDataChainEvidenceJson,
} from '../data-chain-evidence'

const evidenceRoot = 'D:\\phase13-evidence'
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
}

interface ObservationModule {
  parseDataChainSurfaceObservationArgs: (argv: readonly string[]) => unknown
  appendDataChainSurfaceObservation: (options: unknown, dependencies?: unknown) => Promise<{ exitCode: 0 | typeof CHECKPOINT_EXIT_CODE, evidence: DataChainEvidence }>
  validateDataChainSurfaceObservation: (options: unknown, dependencies?: unknown) => Promise<0>
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
    observeGatewayAuth: async () => ({ status: 302, location: 'http://localhost:8080/auth/login' }),
    runFixture: vi.fn(async () => ({ itemCode: candidate.itemCode })),
    snapshot: vi.fn(async () => ({ status: 'found' as const, itemCode: candidate.itemCode, itemId: 'movie-42' })),
    fetchGatewayApi: vi.fn(async (): Promise<{ status: number, itemCode?: string, itemId?: string }> => ({ status: 200, itemCode: candidate.itemCode, itemId: 'movie-42' })),
    write: async () => {},
  }
}

describe('phase 13 local smoke runner', () => {
  it('uses local validate without a live executor and stops projection failures before fixture work', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const dependencies = successDependencies()
    dependencies.collectProjectionIssues = async () => [{ kind: 'target-managed-mismatch', file: '.env.local', key: 'VITE_API_URL', expected: 'http://localhost:8080' }]
    dependencies.runPreflight = vi.fn(() => ({ ok: false, issues: [{ code: 'projection-mismatch' }] }))

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ ingestState: 'pre_ingest', itemId: null, aggregate: 'checkpoint' })
    expect(result.evidence.observations).toEqual([{ surface: 'local_projection', status: 'checkpoint', checkpoint: 'target_projection_unmet' }])
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

  it('accepts only a local Gateway auth response before fixture execution', async () => {
    const { runDataChainSmoke } = await loadSmoke()
    const dependencies = successDependencies()
    dependencies.observeGatewayAuth = async () => ({ status: 302, location: 'http://localhost:3003/auth/login' })

    const result = await runDataChainSmoke(baseOptions, dependencies)

    expect(result.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(result.evidence).toMatchObject({ ingestState: 'pre_ingest', itemId: null })
    expect(result.evidence.observations[0]).toMatchObject({ surface: 'gateway_auth', checkpoint: 'gateway_auth_unavailable' })
    expect(dependencies.runFixture).not.toHaveBeenCalled()
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
  })

  it('strictly separates observer append and validate forms', async () => {
    const { parseDataChainSurfaceObservationArgs } = await loadObservation()
    expect(() => parseDataChainSurfaceObservationArgs(['--validate', '--target', 'starye-org', '--run-id', 'run', '--item-code', 'code', '--item-id', 'id', '--mode', 'local'])).toThrow('does not accept')
    expect(parseDataChainSurfaceObservationArgs(['--mode', 'local', '--target', 'starye-org', '--run-id', 'run', '--item-code', 'code', '--item-id', 'id', '--surface', 'viewer', '--path', '/movie/code', '--status', 'passed'])).toMatchObject({ kind: 'append' })
    expect(parseDataChainSurfaceObservationArgs(['--validate', '--target', 'starye-org', '--run-id', 'run', '--item-code', 'code', '--item-id', 'id'])).toMatchObject({ kind: 'validate' })
  })

  it('requires a pending tuple for Dashboard then viewer and validates one deterministic pair', async () => {
    const { appendDataChainSurfaceObservation, validateDataChainSurfaceObservation } = await loadObservation()
    const evidence = createResolvedPendingEvidence({
      targetId: baseOptions.target,
      runId: baseOptions.runId,
      itemCode: createDataChainCandidate({ targetId: baseOptions.target, runId: baseOptions.runId }).itemCode,
      itemId: 'movie-42',
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      observations: [
        { surface: 'local_projection', status: 'passed' },
        { surface: 'local_d1_readiness', status: 'passed' },
        { surface: 'service_readiness', status: 'passed' },
        { surface: 'gateway_auth', status: 'passed' },
        { surface: 'd1', status: 'passed' },
        { surface: 'api', status: 'passed' },
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
    await expect(appendDataChainSurfaceObservation({ ...baseOptions, itemCode, itemId: 'movie-42', surface: 'viewer', path: `/movie/${itemCode}`, status: 'passed' }, { read, write, evidenceRoot })).rejects.toThrow('Dashboard')

    const dashboard = await appendDataChainSurfaceObservation({ ...baseOptions, itemCode, itemId: 'movie-42', surface: 'dashboard', path: '/dashboard/movies', status: 'passed' }, { read, write, evidenceRoot })
    expect(dashboard.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    const viewer = await appendDataChainSurfaceObservation({ ...baseOptions, itemCode, itemId: 'movie-42', surface: 'viewer', path: `/movie/${itemCode}`, status: 'passed' }, { read, write, evidenceRoot })
    expect(viewer.exitCode).toBe(0)
    await expect(validateDataChainSurfaceObservation({ target: baseOptions.target, runId: baseOptions.runId, itemCode, itemId: 'movie-42' }, { read, evidenceRoot })).resolves.toBe(0)
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
