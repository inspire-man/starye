import { describe, expect, it } from 'vitest'

interface AuthorizationModule {
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

async function loadAuthorization(): Promise<AuthorizationModule> {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/local-dev-authorization.ts', import.meta.url).href) as Promise<AuthorizationModule>
}

describe('local-dev supervisor-root authorization', () => {
  it('authorizes a complete legacy tree when only the supervisor external parent is unavailable', async () => {
    const authorization = await loadAuthorization()

    expect(authorization.evaluateLocalDevAuthorization(legacySnapshot())).toMatchObject({
      kind: 'authorized',
      authorizationSupervisorPid: supervisorPid,
      authorizationExternalAncestorContext: 'supervisor_parent_pid_unavailable:999',
      authorizationListenerOwnerPids: [100, 101, 102, 103, 104, 105],
      authorizationDescendantPidsChildBeforeParent: [99, 100, 101, 102, 103, 104, 105],
      authorizedStopPidsChildBeforeParent: [99, 100, 101, 102, 103, 104, 105, supervisorPid],
    })
    expect(authorization.evaluateLocalDevAuthorization(legacySnapshot())).toMatchObject({
      authorizationSnapshotSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
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
})
