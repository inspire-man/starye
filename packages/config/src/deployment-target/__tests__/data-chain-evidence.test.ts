import { describe, expect, it } from 'vitest'
import {
  appendBrowserObservation,
  assertRemoteEligibility,
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
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
  itemCode: 'p13-smoke-starye-org-2b337d80',
  itemId: 'movie-42',
} as const

function pendingEvidence() {
  return createResolvedPendingEvidence({
    ...tuple,
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
}

describe('phase 13 deterministic evidence contract', () => {
  it('derives one stable non-R18 fixture code from the explicit target and run', () => {
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
    })).toThrow('Dashboard')
    expect(() => appendBrowserObservation(pending, {
      ...tuple,
      itemId: 'different-item',
      surface: 'dashboard',
      status: 'passed',
    })).toThrow('tuple')

    const afterDashboard = appendBrowserObservation(pending, {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
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
    })).toThrow('duplicate')

    const afterViewer = appendBrowserObservation(afterDashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
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
    })).toThrow('non-success')
    expect(validateDataChainEvidenceForExitCode(afterDashboardFailure.evidence)).toBe(0)
  })

  it('requires the exact terminal local tuple before a remote run can begin', () => {
    const dashboard = appendBrowserObservation(pendingEvidence(), {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
    })
    const local = appendBrowserObservation(dashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
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

  it('rejects local prerequisite rows and origins in remote evidence', () => {
    const remote = createResolvedPendingEvidence({
      ...tuple,
      mode: 'remote',
      timestamp: '2026-07-16T00:00:00.000Z',
      observations: [
        { surface: 'remote_preflight', status: 'passed' },
        { surface: 'd1', status: 'passed' },
      ],
    })

    expect(validateDataChainEvidence(remote)).toEqual([])
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
  })

  it('rejects duplicate viewer append after terminal resolution and retains prior rows', () => {
    const beforeBrowser = pendingEvidence()
    const dashboard = appendBrowserObservation(beforeBrowser, {
      ...tuple,
      surface: 'dashboard',
      status: 'passed',
    })
    const viewer = appendBrowserObservation(dashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
    })

    expect(viewer.evidence.observations).toHaveLength(beforeBrowser.observations.length + 2)
    expect(() => appendBrowserObservation(viewer.evidence as typeof dashboard.evidence, {
      ...tuple,
      surface: 'viewer',
      status: 'passed',
    })).toThrow('resolved_pending_observation')
  })
})
