import type {
  CreateDataChainExecutionReceiptInput,
  DataChainCheckpoint,
  DataChainMode,
  DataChainSurface,
} from '../data-chain-evidence'
import { describe, expect, it } from 'vitest'
import {
  appendBrowserObservation,
  assertRemoteEligibility,
  buildPhase19Evidence,
  CHECKPOINT_EXIT_CODE,
  createDataChainCandidate,
  createDataChainExecutionReceipt,
  createDataChainFixtureCodes,
  createPreIngestEvidence,
  createResolvedPendingEvidence,
  dataChainCheckpointValues,
  LOCAL_GATEWAY_ORIGIN,
  phase19EvidenceCommandValues,
  renderDataChainEvidenceMarkdown,
  serializeDataChainEvidenceJson,
  validateDataChainEvidence,
  validateDataChainEvidenceForExitCode,
  validatePhase19Evidence,
} from '../data-chain-evidence'

const tuple = {
  targetId: 'starye-org',
  runId: 'phase13-run-20260716',
  itemCode: createDataChainCandidate({ targetId: 'starye-org', runId: 'phase13-run-20260716' }).itemCode,
  itemId: 'movie-42',
} as const

const preflightDiagnosticCheckpoints = [
  'projection-mismatch',
  'local-api-token-shadowing',
] as const satisfies readonly DataChainCheckpoint[]

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

  it.each(preflightDiagnosticCheckpoints)(
    'round-trips the closed preflight diagnostic checkpoint %s',
    (checkpoint) => {
      const evidence = createPreIngestEvidence({
        targetId: tuple.targetId,
        runId: tuple.runId,
        candidateItemCode: tuple.itemCode,
        mode: 'local',
        timestamp: '2026-07-16T00:00:00.000Z',
        observation: {
          surface: 'local_projection',
          status: 'checkpoint',
          checkpoint,
        },
      })
      const json = serializeDataChainEvidenceJson(evidence)
      const markdown = renderDataChainEvidenceMarkdown(evidence)

      expect(validateDataChainEvidence(evidence)).toEqual([])
      expect(JSON.parse(json)).toMatchObject({
        observations: [{ checkpoint }],
      })
      expect(markdown).toContain(`| local_projection | checkpoint |  | ${checkpoint} |`)
      expect(json).not.toMatch(/ambient-test-token|Local scope must not set/i)
      expect(markdown).not.toMatch(/ambient-test-token|Local scope must not set/i)
    },
  )

  it.each([
    'gateway_auth_timeout',
    'gateway_auth_fetch_failed',
    'gateway_auth_http_status_unaccepted',
    'gateway_auth_redirect_invalid',
  ] as const)('round-trips the closed Gateway auth checkpoint %s without transport detail', (checkpoint) => {
    const evidence = createPreIngestEvidence({
      targetId: tuple.targetId,
      runId: tuple.runId,
      candidateItemCode: tuple.itemCode,
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      observation: {
        surface: 'gateway_auth',
        status: 'checkpoint',
        checkpoint,
        path: '/auth/',
        origin: LOCAL_GATEWAY_ORIGIN,
      },
    })
    const json = serializeDataChainEvidenceJson(evidence)
    const markdown = renderDataChainEvidenceMarkdown(evidence)

    expect(dataChainCheckpointValues).toContain(checkpoint)
    expect(validateDataChainEvidence(evidence)).toEqual([])
    expect(JSON.parse(json)).toMatchObject({ observations: [{ checkpoint }] })
    expect(markdown).toContain(`| gateway_auth | checkpoint |  | ${checkpoint} | /auth/ | ${LOCAL_GATEWAY_ORIGIN} |`)
    expect(Object.keys(JSON.parse(json).observations[0]).sort()).toEqual(['checkpoint', 'origin', 'path', 'status', 'surface'])
    expect(json).not.toMatch(/error|header|body/i)
    expect(markdown).not.toMatch(/error|header|body/i)
  })

  it('retains the generic Gateway auth checkpoint while rejecting unknown values', () => {
    const legacyEvidence = createPreIngestEvidence({
      targetId: tuple.targetId,
      runId: tuple.runId,
      candidateItemCode: tuple.itemCode,
      mode: 'local',
      timestamp: '2026-07-16T00:00:00.000Z',
      observation: {
        surface: 'gateway_auth',
        status: 'checkpoint',
        checkpoint: 'gateway_auth_unavailable',
        path: '/auth/',
        origin: LOCAL_GATEWAY_ORIGIN,
      },
    })

    expect(validateDataChainEvidence(legacyEvidence)).toEqual([])
    expect(validateDataChainEvidence({
      ...legacyEvidence,
      observations: [{
        surface: 'gateway_auth',
        status: 'checkpoint',
        checkpoint: 'gateway_auth_transport_detail',
        path: '/auth/',
        origin: LOCAL_GATEWAY_ORIGIN,
      }],
    })).not.toEqual([])
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

describe('phase 19 run-bound evidence contract', () => {
  const localInput = {
    mode: 'local_contract' as const,
    status: 'passed' as const,
    target: 'local-gateway',
    template: 'movie' as const,
    workflow: 'local-contract',
    repository: 'local-contract',
    ref: 'fixture',
    environment: 'local',
    taskId: 'task-local-movie-01',
    runId: 'run-local-movie-01',
    attempt: 1,
    callbackEventIds: [],
    callbackNonces: [],
    validatedReceipt: {
      template: 'movie' as const,
      primaryContentId: 'movie-local-01',
      createdCount: 1,
      updatedCount: 1,
    },
    gatewayUrl: LOCAL_GATEWAY_ORIGIN,
    crud: { mutation: 'passed' as const, readback: 'passed' as const, restore: 'passed' as const },
    command: 'phase19-local-proof' as const,
    timestamp: '2026-08-01T00:00:00.000Z',
  }

  it('requires one explicit tuple and emits deterministic local evidence', () => {
    const evidence = buildPhase19Evidence(localInput)

    expect(validatePhase19Evidence(evidence)).toEqual([])
    expect(evidence).toMatchObject({
      mode: 'local_contract',
      target: 'local-gateway',
      taskId: localInput.taskId,
      runId: localInput.runId,
      attempt: 1,
      gatewayUrl: LOCAL_GATEWAY_ORIGIN,
      crud: localInput.crud,
    })
    expect(evidence.provider).toBeUndefined()
    expect(evidence.callbackEventIds).toEqual([])
    expect(evidence.callbackNonces).toEqual([])
    expect(phase19EvidenceCommandValues).toContain(evidence.command)
  })

  it('requires provider facts, signed callback facts and remote receipt for production success', () => {
    const production = buildPhase19Evidence({
      ...localInput,
      mode: 'credentialed_provider',
      status: 'passed',
      target: 'starye-org',
      template: 'movie',
      workflow: '.github/workflows/daily-movie-crawl.yml',
      repository: 'inspire-man/starye',
      ref: 'main',
      environment: 'starye-org',
      callbackEventIds: ['evt-provider-success'],
      callbackNonces: ['nonce-provider-success'],
      validatedReceipt: { ...localInput.validatedReceipt, source: 'remote_provider' as const },
      gatewayUrl: 'https://starye.example.test',
      provider: {
        runId: '12345',
        attempt: 1,
        sha: 'a'.repeat(40),
        url: 'https://github.com/inspire-man/starye/actions/runs/12345',
      },
      command: 'phase19-provider-signoff',
    })

    expect(validatePhase19Evidence(production)).toEqual([])
    expect(production.provider?.url).toBe('https://github.com/inspire-man/starye/actions/runs/12345')

    expect(validatePhase19Evidence({
      ...production,
      provider: undefined,
    })).not.toEqual([])
    expect(validatePhase19Evidence({
      ...production,
      provider: { ...production.provider!, url: 'https://example.com/run/12345' },
    })).not.toEqual([])
    expect(validatePhase19Evidence({
      ...production,
      callbackNonces: [],
    })).not.toEqual([])
  })

  it('keeps local and production semantics separate and rejects unsafe fields', () => {
    const local = buildPhase19Evidence(localInput)

    expect(validatePhase19Evidence({
      ...local,
      mode: 'credentialed_provider',
      target: 'starye-org',
      status: 'passed',
    })).not.toEqual([])
    expect(validatePhase19Evidence({
      ...local,
      secret: 'TOKEN',
    })).not.toEqual([])
    expect(validatePhase19Evidence({
      ...local,
      headers: { authorization: 'TOKEN' },
    })).not.toEqual([])
    expect(validatePhase19Evidence({
      ...local,
      validatedReceipt: { ...local.validatedReceipt, validated: false },
    })).not.toEqual([])
    expect(validatePhase19Evidence({
      ...local,
      command: ['pnpm', 'run', 'real-command'],
    })).not.toEqual([])
  })

  it('retains checkpoint truth when production facts are incomplete', () => {
    const checkpoint = buildPhase19Evidence({
      ...localInput,
      mode: 'credentialed_provider',
      status: 'checkpoint',
      target: 'starye-org',
      workflow: '.github/workflows/daily-movie-crawl.yml',
      repository: 'inspire-man/starye',
      ref: 'main',
      environment: 'starye-org',
      callbackEventIds: [],
      callbackNonces: [],
      validatedReceipt: undefined,
      gatewayUrl: 'https://starye.example.test',
      provider: undefined,
      command: 'phase19-provider-signoff',
    })

    expect(checkpoint.status).toBe('checkpoint')
    expect(validatePhase19Evidence(checkpoint)).toEqual([])
    expect(validatePhase19Evidence({ ...checkpoint, status: 'passed' })).not.toEqual([])
  })
})
