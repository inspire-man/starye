import type {
  CreateDataChainExecutionReceiptInput,
  DataChainMode,
  DataChainSurface,
} from '../data-chain-evidence'
import { describe, expect, it } from 'vitest'
import {
  appendBrowserObservation,
  assertRemoteEligibility,
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
  createDataChainExecutionReceipt,
  createDataChainFixtureCodes,
  createPreIngestEvidence,
  createResolvedPendingEvidence,
  LOCAL_GATEWAY_ORIGIN,
  renderDataChainEvidenceMarkdown,
  serializeDataChainEvidenceJson,
  validateDataChainEvidence,
  validateDataChainEvidenceForExitCode,
} from '../data-chain-evidence'

const tuple = {
  targetId: 'starye-org',
  runId: 'phase13-run-20260716',
  itemCode: createDataChainCandidate({ targetId: 'starye-org', runId: 'phase13-run-20260716' }).itemCode,
  itemId: 'movie-42',
} as const

function receiptFor(
  surface: DataChainSurface,
  overrides: Partial<CreateDataChainExecutionReceiptInput> = {},
) {
  const mode: DataChainMode = overrides.mode ?? 'local'
  const itemCode = overrides.itemCode ?? tuple.itemCode
  const capture = {
    local_projection: 'local_projection',
    local_d1_readiness: 'local_d1_readiness',
    service_readiness: 'service_probe',
    gateway_auth: 'gateway_auth',
    remote_preflight: 'remote_preflight',
    d1: mode === 'local' ? 'local_fixture_snapshot' : 'remote_fixture_snapshot',
    api: 'canonical_api',
    dashboard: 'browser_navigation',
    viewer: 'browser_navigation',
  } as const
  const path = surface === 'gateway_auth'
    ? '/auth/'
    : surface === 'api'
      ? `/api/public/movies/${itemCode}`
      : surface === 'dashboard'
        ? '/dashboard/movies'
        : surface === 'viewer'
          ? `/movie/${itemCode}`
          : undefined

  return createDataChainExecutionReceipt({
    source: surface === 'dashboard' || surface === 'viewer'
      ? 'browser_observer'
      : mode === 'local' ? 'local_runner' : 'remote_provider',
    capture: capture[surface],
    mode,
    targetId: tuple.targetId,
    runId: tuple.runId,
    itemCode,
    itemId: tuple.itemId,
    surface,
    ...(path ? { path } : {}),
    timestamp: '2026-07-16T00:00:00.000Z',
    ...overrides,
  })
}

function pendingEvidence() {
  return createResolvedPendingEvidence({
    ...tuple,
    mode: 'local',
    timestamp: '2026-07-16T00:00:00.000Z',
    observations: [
      { surface: 'local_projection', status: 'passed', receipt: receiptFor('local_projection') },
      { surface: 'local_d1_readiness', status: 'passed', receipt: receiptFor('local_d1_readiness') },
      { surface: 'service_readiness', status: 'passed', receipt: receiptFor('service_readiness') },
      { surface: 'gateway_auth', status: 'passed', receipt: receiptFor('gateway_auth') },
      { surface: 'd1', status: 'passed', itemCount: 1, receipt: receiptFor('d1') },
      { surface: 'api', status: 'passed', receipt: receiptFor('api') },
    ],
  })
}

describe('phase 13 deterministic evidence contract', () => {
  it('derives one stable non-R18 primary code from the explicit target and run', () => {
    const first = createDataChainCandidate({ targetId: 'starye-org', runId: 'run-a' })
    const second = createDataChainCandidate({ targetId: 'starye-org', runId: 'run-a' })
    const changedTarget = createDataChainCandidate({ targetId: 'other-target', runId: 'run-a' })
    const changedRun = createDataChainCandidate({ targetId: 'starye-org', runId: 'run-b' })

    expect(first).toEqual(second)
    expect(first.itemCode).not.toMatch(/r18/i)
    expect(first.itemCode).not.toBe(changedTarget.itemCode)
    expect(first.itemCode).not.toBe(changedRun.itemCode)
    expect(first.fixture.movies).toHaveLength(1)
    expect(first.fixture.movies[0]?.isAdult).toBe(false)
    expect(createDataChainFixtureCodes({ targetId: 'starye-org', runId: 'run-a' })).toEqual([first.itemCode])
  })

  it('accepts only an incomplete prerequisite as a pre-ingest terminal record', () => {
    const evidence = createPreIngestEvidence({
      targetId: tuple.targetId,
      runId: tuple.runId,
      candidateItemCode: tuple.itemCode,
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      observation: {
        surface: 'local_projection',
        status: 'checkpoint',
        checkpoint: 'target_projection_unmet',
      },
    })

    expect(evidence.itemId).toBeNull()
    expect(evidence.aggregate).toBe('checkpoint')
    expect(validateDataChainEvidence(evidence)).toEqual([])
  })

  it('rejects passed pre-ingest rows, fabricated ids, and post-ingest surfaces before resolution', () => {
    const evidence = createPreIngestEvidence({
      targetId: tuple.targetId,
      runId: tuple.runId,
      candidateItemCode: tuple.itemCode,
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      observation: {
        surface: 'local_projection',
        status: 'checkpoint',
        checkpoint: 'target_projection_unmet',
      },
    })

    expect(validateDataChainEvidence({
      ...evidence,
      aggregate: 'passed',
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...evidence,
      itemId: 'invented-id',
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...evidence,
      observations: [{ surface: 'api', status: 'failed' }],
    })).not.toEqual([])
  })

  it('preserves the resolved tuple and prerequisite observations while browser proof remains pending', () => {
    const evidence = pendingEvidence()

    expect(evidence.ingestState).toBe('resolved_pending_observation')
    expect(evidence.itemId).toBe(tuple.itemId)
    expect(evidence.aggregate).toBe('pending')
    expect(evidence.observations.map(row => row.surface)).toContain('local_projection')
    expect(validateDataChainEvidence(evidence)).toEqual([])
  })

  it('requires the matching pending tuple and Dashboard then viewer browser grammar', () => {
    const pending = pendingEvidence()

    expect(() => appendBrowserObservation(pending, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
      receipt: receiptFor('viewer'),
    })).toThrow('Dashboard')
    expect(() => appendBrowserObservation(pending, {
      ...tuple,
      itemId: 'different-item',
      surface: 'dashboard',
      status: 'passed',
      receipt: receiptFor('dashboard'),
    })).toThrow('tuple')
    expect(() => appendBrowserObservation(pending, {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
    })).toThrow('controlled execution receipt')

    const afterDashboard = appendBrowserObservation(pending, {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
      receipt: receiptFor('dashboard'),
    })
    expect(afterDashboard.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(afterDashboard.evidence.ingestState).toBe('resolved_pending_observation')
    expect(afterDashboard.evidence.aggregate).toBe('pending')
    expect(afterDashboard.evidence.observations.at(-1)).toMatchObject({
      surface: 'dashboard',
      path: '/dashboard/movies',
      origin: LOCAL_GATEWAY_ORIGIN,
    })

    if (afterDashboard.evidence.ingestState !== 'resolved_pending_observation') {
      throw new Error('Dashboard append must retain pending evidence.')
    }

    expect(() => appendBrowserObservation(afterDashboard.evidence, {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
      receipt: receiptFor('dashboard'),
    })).toThrow('duplicate')

    const afterViewer = appendBrowserObservation(afterDashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
      receipt: receiptFor('viewer'),
    })
    expect(afterViewer.exitCode).toBe(0)
    expect(afterViewer.evidence.ingestState).toBe('resolved')
    expect(afterViewer.evidence.aggregate).toBe('passed')
    expect(afterViewer.evidence.observations.at(-1)).toMatchObject({
      surface: 'viewer',
      path: `/movie/${tuple.itemCode}`,
      origin: LOCAL_GATEWAY_ORIGIN,
    })
  })

  it('persists browser checkpoints as non-successes and prevents later synthetic promotion', () => {
    const afterDashboardFailure = appendBrowserObservation(pendingEvidence(), {
      ...tuple,
      surface: 'dashboard',
      status: 'checkpoint',
      checkpoint: 'dashboard_auth_unavailable',
    })

    expect(afterDashboardFailure.exitCode).toBe(CHECKPOINT_EXIT_CODE)
    expect(afterDashboardFailure.evidence.aggregate).toBe('checkpoint')

    if (afterDashboardFailure.evidence.ingestState !== 'resolved_pending_observation') {
      throw new Error('Browser checkpoint must retain pending evidence.')
    }

    expect(() => appendBrowserObservation(afterDashboardFailure.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
      receipt: receiptFor('viewer'),
    })).toThrow('non-success')
    expect(validateDataChainEvidenceForExitCode(afterDashboardFailure.evidence)).toBe(0)
    expect(() => appendBrowserObservation(pendingEvidence(), {
      ...tuple,
      surface: 'dashboard',
      status: 'checkpoint',
      checkpoint: 'dashboard_auth_unavailable',
      receipt: receiptFor('dashboard'),
    })).toThrow('cannot carry')
  })

  it('requires the exact terminal local tuple before a remote run can begin', () => {
    const dashboard = appendBrowserObservation(pendingEvidence(), {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
      receipt: receiptFor('dashboard'),
    })
    const local = appendBrowserObservation(dashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
      receipt: receiptFor('viewer'),
    }).evidence

    expect(assertRemoteEligibility(local, tuple)).toMatchObject({
      mode: 'local',
      ingestState: 'resolved',
      aggregate: 'passed',
    })
    expect(() => assertRemoteEligibility(pendingEvidence(), tuple)).toThrow('terminal passed')
    expect(() => assertRemoteEligibility(local, { ...tuple, runId: 'other-run' })).toThrow('exact local evidence tuple')
  })

  it('rejects direct service ports, unsupported vocabulary, and tuple disagreement', () => {
    const pending = pendingEvidence()

    expect(validateDataChainEvidence({
      ...pending,
      observations: [...pending.observations, {
        surface: 'dashboard',
        status: 'passed',
        path: '/dashboard/movies',
        origin: 'http://localhost:3001',
      }],
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...pending,
      observations: [{ surface: 'unknown', status: 'passed' }],
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...pending,
      observations: [{ surface: 'api', status: 'unknown' }],
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...pending,
      observations: [{
        surface: 'api',
        status: 'checkpoint',
        checkpoint: 'unknown_checkpoint',
      }],
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...pending,
      itemCode: '',
    })).not.toEqual([])
  })

  it('allows only the remote local-prerequisite checkpoint and rejects other local rows or origins', () => {
    const remote = createResolvedPendingEvidence({
      ...tuple,
      mode: 'remote',
      timestamp: '2026-07-16T00:00:00.000Z',
      observations: [
        { surface: 'remote_preflight', status: 'passed' },
        { surface: 'd1', status: 'passed', itemCount: 1 },
      ],
    })

    expect(validateDataChainEvidence(remote)).toEqual([])
    expect(validateDataChainEvidence({
      ...remote,
      ingestState: 'pre_ingest',
      aggregate: 'checkpoint',
      itemId: null,
      observations: [{
        surface: 'local_projection',
        status: 'checkpoint',
        checkpoint: 'local_prerequisite_unmet',
      }],
    })).toEqual([])
    expect(validateDataChainEvidence({
      ...remote,
      observations: [{ surface: 'local_projection', status: 'passed' }],
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...remote,
      observations: [{
        surface: 'dashboard',
        status: 'passed',
        path: '/dashboard/movies',
        origin: LOCAL_GATEWAY_ORIGIN,
      }],
    })).not.toEqual([])
  })

  it('serializes only allowlisted typed data into JSON and Markdown', () => {
    const evidence = pendingEvidence()
    const json = serializeDataChainEvidenceJson(evidence)
    const markdown = renderDataChainEvidenceMarkdown(evidence)

    expect(json).toContain(tuple.targetId)
    expect(markdown).toContain(tuple.itemCode)
    expect(markdown).toContain('| d1 | passed | 1 |')
    expect(json).not.toMatch(/token|secret|cookie|authorization|header/i)
    expect(markdown).not.toContain('http://localhost:3000')
    expect(() => serializeDataChainEvidenceJson({
      ...evidence,
      token: 'not-allowed',
    })).toThrow('Unexpected evidence key')
    for (const unsafeField of ['secret', 'headers', 'preparedContext', 'outputRoot'] as const) {
      expect(() => serializeDataChainEvidenceJson({
        ...evidence,
        [unsafeField]: unsafeField === 'headers' ? { authorization: 'value' } : 'value',
      })).toThrow('Unexpected evidence key')
    }

    const receiptInput = {
      source: 'local_runner',
      capture: 'canonical_api',
      mode: 'local',
      targetId: tuple.targetId,
      runId: tuple.runId,
      itemCode: tuple.itemCode,
      itemId: tuple.itemId,
      surface: 'api',
      path: `/api/public/movies/${tuple.itemCode}`,
      timestamp: '2026-07-16T00:00:00.000Z',
    } as const
    for (const unsafeField of ['cookie', 'headers', 'body', 'screenshot', 'origin', 'command', 'token', 'preparedContext', 'notes'] as const) {
      expect(() => createDataChainExecutionReceipt({
        ...receiptInput,
        [unsafeField]: 'not-allowed',
      } as never)).toThrow('Unexpected data-chain receipt input key')
    }
  })

  it('requires one successful primary D1 row and rejects sibling or batch-shaped evidence', () => {
    const pending = pendingEvidence()
    const d1Index = pending.observations.findIndex(row => row.surface === 'd1')
    expect(validateDataChainEvidence({
      ...pending,
      observations: pending.observations.map((row, index) => index === d1Index ? { ...row, itemCount: 2 } : row),
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...pending,
      observations: pending.observations.map((row, index) => index === d1Index ? { surface: 'api', status: 'passed', itemCount: 1 } : row),
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...pending,
      itemCode: `${tuple.itemCode}-sibling`,
    })).not.toEqual([])
    expect(validateDataChainEvidence({
      ...pending,
      siblingCodes: [`${tuple.itemCode}-sibling`],
    })).not.toEqual([])
  })

  it('rejects duplicate viewer append after terminal resolution and retains prior rows', () => {
    const beforeBrowser = pendingEvidence()
    const dashboard = appendBrowserObservation(beforeBrowser, {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
      receipt: receiptFor('dashboard'),
    })
    const viewer = appendBrowserObservation(dashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
      receipt: receiptFor('viewer'),
    })

    expect(viewer.evidence.observations).toHaveLength(beforeBrowser.observations.length + 2)
    expect(() => appendBrowserObservation(viewer.evidence as typeof dashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
    })).toThrow('resolved_pending_observation')
  })

  it('rejects a legacy terminal pair whose passed rows have no execution receipts', () => {
    const terminal = {
      version: 1,
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      ...tuple,
      ingestState: 'resolved',
      aggregate: 'passed',
      observations: [
        { surface: 'local_projection', status: 'passed' },
        { surface: 'local_d1_readiness', status: 'passed' },
        { surface: 'service_readiness', status: 'passed' },
        { surface: 'gateway_auth', status: 'passed', path: '/auth/', origin: LOCAL_GATEWAY_ORIGIN },
        { surface: 'd1', status: 'passed', itemCount: 1 },
        { surface: 'api', status: 'passed', path: `/api/public/movies/${tuple.itemCode}`, origin: LOCAL_GATEWAY_ORIGIN },
        { surface: 'dashboard', status: 'passed', path: '/dashboard/movies', origin: LOCAL_GATEWAY_ORIGIN },
        { surface: 'viewer', status: 'passed', path: `/movie/${tuple.itemCode}`, origin: LOCAL_GATEWAY_ORIGIN },
      ],
    }

    expect(validateDataChainEvidence(terminal)).toContain('Resolved evidence requires a provenance receipt for every passed required surface.')
  })

  it('accepts a complete remote receipt set only for the exact canonical tuple', () => {
    const pending = createResolvedPendingEvidence({
      ...tuple,
      mode: 'remote',
      timestamp: '2026-07-16T00:00:00.000Z',
      observations: [
        { surface: 'remote_preflight', status: 'passed', receipt: receiptFor('remote_preflight', { mode: 'remote' }) },
        { surface: 'd1', status: 'passed', itemCount: 1, receipt: receiptFor('d1', { mode: 'remote' }) },
        { surface: 'api', status: 'passed', path: `/api/public/movies/${tuple.itemCode}`, receipt: receiptFor('api', { mode: 'remote' }) },
      ],
    })
    const dashboard = appendBrowserObservation(pending, {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
      receipt: receiptFor('dashboard', { mode: 'remote' }),
    })
    const terminal = appendBrowserObservation(dashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
      receipt: receiptFor('viewer', { mode: 'remote' }),
    }).evidence

    expect(validateDataChainEvidence(terminal)).toEqual([])
    expect(terminal.observations.every(row => row.receipt !== undefined)).toBe(true)
  })

  it('rejects mismatched, non-canonical, or tampered receipt metadata', () => {
    const pending = pendingEvidence()
    const apiIndex = pending.observations.findIndex(row => row.surface === 'api')
    const mutateApiReceipt = (receipt: Record<string, unknown>) => ({
      ...pending,
      observations: pending.observations.map((row, index) => index === apiIndex
        ? { ...row, receipt }
        : row),
    })
    const apiReceipt = receiptFor('api')

    for (const receipt of [
      { ...apiReceipt, targetId: 'different-target' },
      { ...apiReceipt, surface: 'viewer' },
      { ...apiReceipt, source: 'browser_observer' },
      { ...apiReceipt, capture: 'browser_navigation' },
      { ...apiReceipt, path: `http://localhost:3000/api/public/movies/${tuple.itemCode}` },
      { ...apiReceipt, timestamp: '2026-07-16T00:00:00.000+08:00' },
      { ...apiReceipt, result: 'failed' },
      { ...apiReceipt, integrity: '00000000' },
      { ...apiReceipt, cookie: 'not-allowed' },
    ]) {
      expect(validateDataChainEvidence(mutateApiReceipt(receipt))).not.toEqual([])
    }
  })
})
