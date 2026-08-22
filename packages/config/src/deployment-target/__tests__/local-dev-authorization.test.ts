import { describe, expect, it } from 'vitest'

interface AuthorizationModule {
  buildReadOnlySnapshotCommand: () => string
  evaluateLocalDevAuthorization: (snapshot: unknown) => unknown
}

const workspaceRoot = 'C:\\workspace\\starye'
const supervisorPid = 900

function processRecord(pid: number, parentPid: number | null, commandLine: string | null = null): object {
  return {
    pid,
    parentPid,
    executable: 'C:\\Program Files\\nodejs\\node.exe',
    commandLine,
    startTime: `2026-07-20T00:00:${String(pid).padStart(2, '0')}Z`,
  }
}

function legacySnapshot(overrides: {
  readonly listeners?: readonly { readonly port: number, readonly ownerPid: number }[]
  readonly processes?: readonly object[]
} = {}): object {
  const listeners = overrides.listeners ?? [
    { port: 8787, ownerPid: 100 },
    { port: 5173, ownerPid: 101 },
    { port: 3002, ownerPid: 102 },
    { port: 3003, ownerPid: 103 },
    { port: 3000, ownerPid: 104 },
    { port: 3001, ownerPid: 105 },
  ]
  const processes = overrides.processes ?? [
    processRecord(supervisorPid, 999, `node "${workspaceRoot}\\scripts\\local-dev.ts"`),
    processRecord(100, supervisorPid),
    processRecord(101, supervisorPid),
    processRecord(102, supervisorPid),
    processRecord(103, supervisorPid),
    processRecord(104, supervisorPid),
    processRecord(105, supervisorPid),
    processRecord(99, 100),
  ]

  return {
    workspaceRoot,
    listeners,
    processes,
  }
}

function currentSnapshot(): object {
  const listeners = [
    { port: 8080, ownerPid: 100 },
    { port: 8787, ownerPid: 101 },
    { port: 5173, ownerPid: 102 },
    { port: 3004, ownerPid: 103 },
    { port: 3002, ownerPid: 104 },
    { port: 3003, ownerPid: 105 },
    { port: 3000, ownerPid: 106 },
    { port: 3001, ownerPid: 107 },
  ]
  const processes = [
    processRecord(supervisorPid, 999, `node "${workspaceRoot}\\scripts\\local-dev.ts"`),
    ...listeners.map(listener => processRecord(listener.ownerPid, supervisorPid)),
  ]
  return { workspaceRoot, listeners, processes }
}

async function loadAuthorization(): Promise<AuthorizationModule> {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/local-dev-authorization.ts', import.meta.url).href) as Promise<AuthorizationModule>
}

describe('local-dev supervisor-root authorization', () => {
  it('authorizes the current eight-port tree including quant on 3004', async () => {
    const authorization = await loadAuthorization()
    const result = authorization.evaluateLocalDevAuthorization(currentSnapshot())

    expect(result).toMatchObject({
      kind: 'authorized',
      authorizationListenerOwnerPids: [100, 101, 102, 103, 104, 105, 106, 107],
    })
  })

  it('uses non-reserved PowerShell identifiers while retaining the fixed snapshot JSON fields', async () => {
    const authorization = await loadAuthorization()
    const command = authorization.buildReadOnlySnapshotCommand()

    expect(command).toContain('$listenerOwnerPid = [int]$_.OwningProcess')
    expect(command).toContain('$win32ProcessId = [int]$_.ProcessId')
    expect(command).toContain('$parentProcessId = [int]$_.ParentProcessId')
    expect(command).toContain('ownerPid = $listenerOwnerPid')
    expect(command).toContain('pid = $win32ProcessId')
    expect(command).toContain('parentPid = $parentProcessId')
    expect(command).not.toMatch(/\$pid\s*=/i)
  })

  it('authorizes a complete legacy tree when only the supervisor external parent is unavailable', async () => {
    const authorization = await loadAuthorization()

    const first = authorization.evaluateLocalDevAuthorization(legacySnapshot())
    const second = authorization.evaluateLocalDevAuthorization(legacySnapshot())

    expect(first).toMatchObject({
      kind: 'authorized',
      authorizationSupervisorPid: supervisorPid,
      authorizationExternalAncestorContext: 'supervisor_parent_pid_unavailable:999',
      authorizationListenerOwnerPids: [100, 101, 102, 103, 104, 105],
      authorizationDescendantPidsChildBeforeParent: [99, 100, 101, 102, 103, 104, 105],
      authorizedStopPidsChildBeforeParent: [99, 100, 101, 102, 103, 104, 105, supervisorPid],
    })
    expect(first).toMatchObject({
      authorizationSnapshotSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    expect(first).toStrictEqual(second)
  })

  it('refuses before teardown when a listener chain is missing before the matched supervisor', async () => {
    const authorization = await loadAuthorization()
    const result = authorization.evaluateLocalDevAuthorization(legacySnapshot({
      processes: [
        processRecord(supervisorPid, 999, `node "${workspaceRoot}\\scripts\\local-dev.ts"`),
        processRecord(100, 444),
        processRecord(101, supervisorPid),
        processRecord(102, supervisorPid),
        processRecord(103, supervisorPid),
        processRecord(104, supervisorPid),
        processRecord(105, supervisorPid),
      ],
    }))

    expect(result).toMatchObject({
      kind: 'blocked',
      terminalBranch: 'blocked_pre_teardown',
      closedReason: 'missing_process_before_supervisor',
      authorizationDescendantPidsChildBeforeParent: [],
      authorizedStopPidsChildBeforeParent: [],
    })
  })

  it('refuses before teardown when an owner-to-supervisor chain contains a cycle', async () => {
    const authorization = await loadAuthorization()
    const result = authorization.evaluateLocalDevAuthorization(legacySnapshot({
      processes: [
        processRecord(supervisorPid, 999, `node "${workspaceRoot}\\scripts\\local-dev.ts"`),
        processRecord(100, 101),
        processRecord(101, 100),
        processRecord(102, supervisorPid),
        processRecord(103, supervisorPid),
        processRecord(104, supervisorPid),
        processRecord(105, supervisorPid),
      ],
    }))

    expect(result).toMatchObject({
      kind: 'blocked',
      terminalBranch: 'blocked_pre_teardown',
      closedReason: 'ancestry_cycle_before_supervisor',
      authorizationDescendantPidsChildBeforeParent: [],
      authorizedStopPidsChildBeforeParent: [],
    })
  })

  it('preserves malformed, supervisor, duplicate-owner, and listener-shape closed branches', async () => {
    const authorization = await loadAuthorization()
    const expectedBlocked = {
      kind: 'blocked',
      terminalBranch: 'blocked_pre_teardown',
      authorizationDescendantPidsChildBeforeParent: [],
      authorizedStopPidsChildBeforeParent: [],
    }

    expect(authorization.evaluateLocalDevAuthorization({})).toMatchObject({
      ...expectedBlocked,
      closedReason: 'malformed_snapshot',
    })
    expect(authorization.evaluateLocalDevAuthorization(legacySnapshot({
      processes: [
        processRecord(100, 999),
        processRecord(101, 999),
        processRecord(102, 999),
        processRecord(103, 999),
        processRecord(104, 999),
        processRecord(105, 999),
      ],
    }))).toMatchObject({
      ...expectedBlocked,
      closedReason: 'supervisor_not_found',
    })
    expect(authorization.evaluateLocalDevAuthorization(legacySnapshot({
      listeners: [
        { port: 8787, ownerPid: 100 },
        { port: 5173, ownerPid: 100 },
        { port: 3002, ownerPid: 102 },
        { port: 3003, ownerPid: 103 },
        { port: 3000, ownerPid: 104 },
        { port: 3001, ownerPid: 105 },
      ],
    }))).toMatchObject({
      ...expectedBlocked,
      closedReason: 'duplicate_listener_owner',
    })
    expect(authorization.evaluateLocalDevAuthorization(legacySnapshot({
      listeners: [
        { port: 8080, ownerPid: 99 },
        { port: 8787, ownerPid: 100 },
        { port: 5173, ownerPid: 101 },
        { port: 3002, ownerPid: 102 },
        { port: 3003, ownerPid: 103 },
        { port: 3000, ownerPid: 104 },
        { port: 3001, ownerPid: 105 },
      ],
    }))).toMatchObject({
      ...expectedBlocked,
      closedReason: 'legacy_listener_shape_mismatch',
    })
  })
})
