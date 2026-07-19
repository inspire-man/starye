import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const fixedPorts = [8080, 8787, 5173, 3002, 3003, 3000, 3001] as const
const legacyPorts = [8787, 5173, 3002, 3003, 3000, 3001] as const

type FixedPort = (typeof fixedPorts)[number]
type ClosedReason
  = 'ancestry_cycle_before_supervisor'
    | 'ambiguous_supervisor'
    | 'duplicate_listener_owner'
    | 'legacy_listener_shape_mismatch'
    | 'malformed_snapshot'
    | 'missing_process_before_supervisor'
    | 'supervisor_not_found'

interface ListenerRecord {
  readonly port: FixedPort
  readonly ownerPid: number
}

interface ProcessRecord {
  readonly pid: number
  readonly parentPid: number | null
  readonly executable: string | null
  readonly commandLine: string | null
  readonly startTime: string | null
}

interface AuthorizationInput {
  readonly workspaceRoot: string
  readonly listeners: readonly ListenerRecord[]
  readonly processes: readonly ProcessRecord[]
}

interface NormalizedProcessFact {
  readonly executable: string | null
  readonly parentPid: number | null
  readonly pid: number
  readonly script: 'scripts/local-dev.ts' | null
  readonly startTime: string | null
}

interface AuthorizationPayload {
  readonly authorizationDescendantPidsChildBeforeParent: readonly number[]
  readonly authorizationExternalAncestorContext: string
  readonly authorizationListenerOwners: readonly ListenerRecord[]
  readonly authorizationSupervisor: NormalizedProcessFact
  readonly authorizedStopPidsChildBeforeParent: readonly number[]
  readonly descendants: readonly (NormalizedProcessFact & { readonly depth: number })[]
  readonly schemaVersion: 1
}

export interface LocalDevAuthorizationAccepted {
  readonly authorizationDescendantPidsChildBeforeParent: readonly number[]
  readonly authorizationExternalAncestorContext: string
  readonly authorizationListenerOwnerPids: readonly number[]
  readonly authorizationSnapshotSha256: string
  readonly authorizationSupervisorPid: number
  readonly authorizationSupervisorScript: 'scripts/local-dev.ts'
  readonly authorizedStopPidsChildBeforeParent: readonly number[]
  readonly kind: 'authorized'
}

export interface LocalDevAuthorizationBlocked {
  readonly authorizationDescendantPidsChildBeforeParent: readonly []
  readonly authorizedStopPidsChildBeforeParent: readonly []
  readonly closedReason: ClosedReason
  readonly kind: 'blocked'
  readonly terminalBranch: 'blocked_pre_teardown'
}

export type LocalDevAuthorizationResult = LocalDevAuthorizationAccepted | LocalDevAuthorizationBlocked

function blocked(closedReason: ClosedReason): LocalDevAuthorizationBlocked {
  return {
    kind: 'blocked',
    terminalBranch: 'blocked_pre_teardown',
    closedReason,
    authorizationDescendantPidsChildBeforeParent: [],
    authorizedStopPidsChildBeforeParent: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null
  }
  return typeof value === 'string' ? value : undefined
}

function normalizeWindowsPath(value: string): string {
  return value.trim().replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()
}

function currentWorkspaceScript(workspaceRoot: string): string {
  return `${normalizeWindowsPath(workspaceRoot)}/scripts/local-dev.ts`
}

function isNodeExecutable(executable: string | null): boolean {
  if (!executable) {
    return false
  }
  const filename = normalizeWindowsPath(executable).split('/').at(-1)
  return filename === 'node' || filename === 'node.exe'
}

function matchesCurrentWorkspaceSupervisor(record: ProcessRecord, scriptPath: string): boolean {
  return isNodeExecutable(record.executable)
    && record.commandLine !== null
    && normalizeWindowsPath(record.commandLine).includes(scriptPath)
}

function normalizeInput(input: unknown): AuthorizationInput | null {
  if (!isRecord(input) || typeof input.workspaceRoot !== 'string' || input.workspaceRoot.trim() === '') {
    return null
  }
  if (!Array.isArray(input.listeners) || !Array.isArray(input.processes)) {
    return null
  }

  const listeners: ListenerRecord[] = []
  for (const listener of input.listeners) {
    if (!isRecord(listener) || !isPositiveInteger(listener.port) || !isPositiveInteger(listener.ownerPid) || !fixedPorts.includes(listener.port as FixedPort)) {
      return null
    }
    listeners.push({ port: listener.port as FixedPort, ownerPid: listener.ownerPid })
  }

  const processes: ProcessRecord[] = []
  for (const processRecord of input.processes) {
    if (!isRecord(processRecord) || !isPositiveInteger(processRecord.pid)) {
      return null
    }
    const parentPid = processRecord.parentPid === null || processRecord.parentPid === 0
      ? null
      : isPositiveInteger(processRecord.parentPid)
        ? processRecord.parentPid
        : undefined
    const executable = nullableString(processRecord.executable)
    const commandLine = nullableString(processRecord.commandLine)
    const startTime = nullableString(processRecord.startTime)
    if (parentPid === undefined || executable === undefined || commandLine === undefined || startTime === undefined) {
      return null
    }
    processes.push({
      pid: processRecord.pid,
      parentPid,
      executable,
      commandLine,
      startTime,
    })
  }

  return {
    workspaceRoot: input.workspaceRoot,
    listeners,
    processes,
  }
}

function findLegacyListenerOwners(listeners: readonly ListenerRecord[]): readonly ListenerRecord[] | ClosedReason {
  if (listeners.some(listener => listener.port === 8080)) {
    return 'legacy_listener_shape_mismatch'
  }

  const byPort = new Map<FixedPort, ListenerRecord[]>()
  for (const listener of listeners) {
    const matching = byPort.get(listener.port) ?? []
    matching.push(listener)
    byPort.set(listener.port, matching)
  }

  const owners: ListenerRecord[] = []
  for (const port of legacyPorts) {
    const matching = byPort.get(port) ?? []
    if (matching.length !== 1) {
      return 'legacy_listener_shape_mismatch'
    }
    owners.push(matching[0])
  }
  if (new Set(owners.map(owner => owner.ownerPid)).size !== owners.length) {
    return 'duplicate_listener_owner'
  }
  return owners
}

function reachesSupervisor(ownerPid: number, supervisorPid: number, processes: ReadonlyMap<number, ProcessRecord>): ClosedReason | null {
  const seen = new Set<number>()
  let currentPid = ownerPid
  while (currentPid !== supervisorPid) {
    if (seen.has(currentPid)) {
      return 'ancestry_cycle_before_supervisor'
    }
    seen.add(currentPid)
    const current = processes.get(currentPid)
    if (!current || current.parentPid === null) {
      return 'missing_process_before_supervisor'
    }
    currentPid = current.parentPid
  }
  return null
}

function descendantDepth(pid: number, supervisorPid: number, processes: ReadonlyMap<number, ProcessRecord>): number | null {
  const seen = new Set<number>()
  let depth = 0
  let currentPid = pid
  while (currentPid !== supervisorPid) {
    if (seen.has(currentPid)) {
      return null
    }
    seen.add(currentPid)
    const current = processes.get(currentPid)
    if (!current || current.parentPid === null) {
      return null
    }
    currentPid = current.parentPid
    depth += 1
  }
  return depth
}

function toProcessFact(record: ProcessRecord, script: 'scripts/local-dev.ts' | null): NormalizedProcessFact {
  return {
    pid: record.pid,
    parentPid: record.parentPid,
    executable: record.executable,
    script,
    startTime: record.startTime,
  }
}

function externalAncestorContext(supervisor: ProcessRecord, processes: ReadonlyMap<number, ProcessRecord>): string {
  if (supervisor.parentPid === null) {
    return 'supervisor_parent_not_reported'
  }
  if (processes.has(supervisor.parentPid)) {
    return `supervisor_parent_recorded_not_authorized:${supervisor.parentPid}`
  }
  return `supervisor_parent_pid_unavailable:${supervisor.parentPid}`
}

export function evaluateLocalDevAuthorization(input: unknown): LocalDevAuthorizationResult {
  const snapshot = normalizeInput(input)
  if (!snapshot) {
    return blocked('malformed_snapshot')
  }

  const processes = new Map(snapshot.processes.map(record => [record.pid, record]))
  if (processes.size !== snapshot.processes.length) {
    return blocked('malformed_snapshot')
  }

  const listenerOwners = findLegacyListenerOwners(snapshot.listeners)
  if (typeof listenerOwners === 'string') {
    return blocked(listenerOwners)
  }

  const scriptPath = currentWorkspaceScript(snapshot.workspaceRoot)
  const supervisors = snapshot.processes.filter(record => matchesCurrentWorkspaceSupervisor(record, scriptPath))
  if (supervisors.length === 0) {
    return blocked('supervisor_not_found')
  }
  if (supervisors.length !== 1) {
    return blocked('ambiguous_supervisor')
  }
  const supervisor = supervisors[0]

  for (const listener of listenerOwners) {
    if (listener.ownerPid === supervisor.pid) {
      return blocked('legacy_listener_shape_mismatch')
    }
    const chainIssue = reachesSupervisor(listener.ownerPid, supervisor.pid, processes)
    if (chainIssue) {
      return blocked(chainIssue)
    }
  }

  const descendants = snapshot.processes
    .filter(record => record.pid !== supervisor.pid)
    .map(record => ({ record, depth: descendantDepth(record.pid, supervisor.pid, processes) }))
    .filter((entry): entry is { readonly record: ProcessRecord, readonly depth: number } => entry.depth !== null)
    .sort((left, right) => right.depth - left.depth || left.record.pid - right.record.pid)

  const descendantPids = descendants.map(entry => entry.record.pid)
  if (listenerOwners.some(listener => !descendantPids.includes(listener.ownerPid))) {
    return blocked('missing_process_before_supervisor')
  }

  const listenerOwnerPids = listenerOwners.map(listener => listener.ownerPid)
  const authorizedStopPidsChildBeforeParent = [...descendantPids, supervisor.pid]
  const authorizationExternalAncestorContext = externalAncestorContext(supervisor, processes)
  const payload: AuthorizationPayload = {
    schemaVersion: 1,
    authorizationSupervisor: toProcessFact(supervisor, 'scripts/local-dev.ts'),
    authorizationListenerOwners: listenerOwners,
    authorizationDescendantPidsChildBeforeParent: descendantPids,
    authorizedStopPidsChildBeforeParent,
    authorizationExternalAncestorContext,
    descendants: descendants.map(({ record, depth }) => ({ ...toProcessFact(record, null), depth })),
  }

  return {
    kind: 'authorized',
    authorizationSnapshotSha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    authorizationSupervisorScript: 'scripts/local-dev.ts',
    authorizationSupervisorPid: supervisor.pid,
    authorizationListenerOwnerPids: listenerOwnerPids,
    authorizationDescendantPidsChildBeforeParent: descendantPids,
    authorizedStopPidsChildBeforeParent,
    authorizationExternalAncestorContext,
  }
}

export function buildReadOnlySnapshotCommand(): string {
  return [
    '$ports = @(8080,8787,5173,3002,3003,3000,3001)',
    '$listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains [int]$_.LocalPort } | ForEach-Object { $listenerOwnerPid = [int]$_.OwningProcess; [pscustomobject]@{ port = [int]$_.LocalPort; ownerPid = $listenerOwnerPid } })',
    '$processes = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.ProcessId -gt 0 } | ForEach-Object { $win32ProcessId = [int]$_.ProcessId; $parentProcessId = [int]$_.ParentProcessId; [pscustomobject]@{ pid = $win32ProcessId; parentPid = $parentProcessId; executable = $_.ExecutablePath; commandLine = $_.CommandLine; startTime = $_.CreationDate } })',
    '[pscustomobject]@{ listeners = $listeners; processes = $processes } | ConvertTo-Json -Compress -Depth 3',
  ].join('; ')
}

function captureCurrentWorkspaceSnapshot(): unknown {
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', buildReadOnlySnapshotCommand()], {
    cwd: path.resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  })
  return JSON.parse(output) as unknown
}

function evaluateCurrentWorkspaceSnapshot(): LocalDevAuthorizationResult {
  const root = path.resolve(import.meta.dirname, '..')
  const captured = captureCurrentWorkspaceSnapshot()
  if (!isRecord(captured)) {
    return blocked('malformed_snapshot')
  }
  return evaluateLocalDevAuthorization({
    workspaceRoot: root,
    listeners: captured.listeners,
    processes: captured.processes,
  })
}

function main(): void {
  if (process.argv.length !== 2) {
    process.stdout.write(`${JSON.stringify(blocked('malformed_snapshot'))}\n`)
    process.exitCode = 1
    return
  }

  try {
    const result = evaluateCurrentWorkspaceSnapshot()
    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exitCode = result.kind === 'authorized' ? 0 : 1
  }
  catch {
    process.stdout.write(`${JSON.stringify(blocked('malformed_snapshot'))}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
