import { execFileSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

interface LocalDevServiceRecord {
  readonly label: string
  readonly port: number
  readonly pid: number | undefined
}

interface LocalDevSupervisorResult {
  readonly status: 'ready' | 'failed'
  readonly exitCode: 0 | 1
  readonly services: readonly LocalDevServiceRecord[]
}

interface LocalDevModule {
  runLocalDevSupervisor: (dependencies: unknown) => Promise<LocalDevSupervisorResult>
}

interface LocalDevEntryModule {
  buildLocalDevSupervisorInvocation: () => {
    readonly args: readonly string[]
    readonly command: string
    readonly cwd: string
  }
}

interface FakeService {
  readonly label: string
  readonly port: number
}

class FakeChild extends EventEmitter {
  readonly kill = vi.fn(() => true)

  constructor(readonly pid: number) {
    super()
  }
}

async function loadLocalDev(): Promise<LocalDevModule> {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/local-dev.ts', import.meta.url).href) as Promise<LocalDevModule>
}

async function loadLocalDevEntry(): Promise<LocalDevEntryModule> {
  return import(/* @vite-ignore */ new URL('../../../../../scripts/local-dev-entry.ts', import.meta.url).href) as Promise<LocalDevEntryModule>
}

const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url))
const rootPackageManifest = new URL('../../../../../package.json', import.meta.url)
const rootLockfile = new URL('../../../../../pnpm-lock.yaml', import.meta.url)

function createHarness(options: {
  readonly listening: (port: number) => boolean
  readonly readinessAttempts?: number
  readonly triggerGatewayError?: boolean
  readonly triggerGatewayExit?: boolean
}): {
  readonly dependencies: object
  readonly children: Map<string, FakeChild>
  readonly cleanup: ReturnType<typeof vi.fn>
  readonly setExitCode: ReturnType<typeof vi.fn>
  readonly probePort: ReturnType<typeof vi.fn>
} {
  const children = new Map<string, FakeChild>()
  const cleanup = vi.fn(async () => {})
  const setExitCode = vi.fn()
  const probePort = vi.fn(async (port: number) => options.listening(port))
  let nextPid = 10_000

  return {
    dependencies: {
      materializeInputs: async () => ({
        apiConfigPath: 'fake-api-config.toml',
        gatewayConfigPath: 'fake-gateway-config.toml',
        pageEnvironment: () => ({}),
        cleanup,
      }),
      startService: (service: FakeService) => {
        const child = new FakeChild(nextPid++)
        children.set(service.label, child)
        if (options.triggerGatewayError && service.label === 'gateway') {
          queueMicrotask(() => child.emit('error', new Error('Gateway process failed before binding.')))
        }
        if (options.triggerGatewayExit && service.label === 'gateway') {
          queueMicrotask(() => child.emit('exit', 0, null))
        }
        return child
      },
      isPortListening: probePort,
      sleep: async () => {},
      readinessAttempts: options.readinessAttempts ?? 2,
      readinessIntervalMs: 0,
      setExitCode,
      registerSignalHandlers: () => {},
    },
    children,
    cleanup,
    setExitCode,
    probePort,
  }
}

describe('local-dev atomic seven-port supervisor', () => {
  it('declares one direct root tsx entry command without entering its CLI main path', async () => {
    const manifest = JSON.parse(await readFile(rootPackageManifest, 'utf8')) as {
      readonly devDependencies?: Readonly<Record<string, string>>
      readonly scripts?: Readonly<Record<string, string>>
    }
    const lockfile = await readFile(rootLockfile, 'utf8')
    const importersMarker = /^importers:\r?$/m.exec(lockfile)

    expect(manifest.devDependencies?.tsx).toBe('4.21.0')
    expect(manifest.scripts?.dev).toBe('node --import tsx scripts/local-dev-entry.ts')
    expect(manifest.scripts?.dev).not.toMatch(/\bpnpm\b/)
    expect(importersMarker).not.toBeNull()
    if (!importersMarker) {
      throw new Error('pnpm lockfile importers section is required.')
    }

    const afterImporters = lockfile.slice(importersMarker.index + importersMarker[0].length)
    const nextTopLevelKey = afterImporters.search(/^[A-Z][\w-]*:\r?$/im)

    expect(nextTopLevelKey).toBeGreaterThanOrEqual(0)
    const importersBlock = afterImporters.slice(0, nextTopLevelKey)
    const rootImporterMarker = /^ {2}\.:\r?$/m.exec(importersBlock)

    expect(rootImporterMarker).not.toBeNull()
    if (!rootImporterMarker) {
      throw new Error('pnpm lockfile root importer is required.')
    }

    const afterRootImporter = importersBlock.slice(rootImporterMarker.index + rootImporterMarker[0].length)
    const nextImporter = afterRootImporter.search(/^ {2}\S.*:\r?$/m)
    const rootImporterBlock = nextImporter === -1 ? afterRootImporter : afterRootImporter.slice(0, nextImporter)

    expect(rootImporterBlock).toMatch(/^ {6}tsx:\r?\n {8}specifier: 4\.21\.0\r?\n {8}version: 4\.21\.0\r?$/m)
    expect(lockfile).toMatch(/^ {2}tsx@4\.21\.0:\r?\n {4}resolution: \{integrity: sha512-5C1sg4USs1lfG0GFb2RLXsdpXqBSEhAaA\/0kPL01wxzpMqLILNxIxIOKiILz\+cdg\/pLnOUxFYOR5yhHU666wbw==\}\r?$/m)
    expect(() => execFileSync(process.execPath, [
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      'await import(\'./scripts/local-dev-entry.ts\')',
    ], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    })).not.toThrow()
  })

  it('starts the supervisor with an absolute current-workspace script path', async () => {
    const entry = await loadLocalDevEntry()
    const invocation = entry.buildLocalDevSupervisorInvocation()
    const scriptPath = invocation.args.at(-1)

    expect(invocation.command).toContain('node')
    expect(scriptPath).toBeDefined()
    if (!scriptPath) {
      throw new Error('Local development supervisor script argument is required.')
    }
    expect(isAbsolute(scriptPath)).toBe(true)
    expect(normalize(scriptPath)).toBe(normalize(join(repositoryRoot, 'scripts', 'local-dev.ts')))
  })

  it('fails atomically when a live Gateway never binds 8080', async () => {
    const localDev = await loadLocalDev()
    const harness = createHarness({ listening: port => port !== 8080 })

    await expect(localDev.runLocalDevSupervisor(harness.dependencies)).resolves.toMatchObject({
      status: 'failed',
      exitCode: 1,
    })

    expect([...harness.children.keys()]).toEqual(['api', 'gateway', 'dashboard', 'auth', 'blog', 'movie', 'comic'])
    expect(harness.probePort).toHaveBeenCalledWith(8080)
    expect(harness.cleanup).toHaveBeenCalledTimes(1)
    expect(harness.setExitCode).toHaveBeenCalledWith(1)
    for (const child of harness.children.values()) {
      expect(child.kill).toHaveBeenCalledTimes(1)
    }
  })

  it('returns the owned labeled PID records only after all seven fixed ports are ready', async () => {
    const localDev = await loadLocalDev()
    const harness = createHarness({ listening: () => true })

    const result = await localDev.runLocalDevSupervisor(harness.dependencies)

    expect(result).toMatchObject({
      status: 'ready',
      exitCode: 0,
    })
    expect(result.services).toEqual([
      { label: 'api', port: 8787, pid: 10_000 },
      { label: 'gateway', port: 8080, pid: 10_001 },
      { label: 'dashboard', port: 5173, pid: 10_002 },
      { label: 'auth', port: 3003, pid: 10_003 },
      { label: 'blog', port: 3002, pid: 10_004 },
      { label: 'movie', port: 3001, pid: 10_005 },
      { label: 'comic', port: 3000, pid: 10_006 },
    ])

    expect(harness.cleanup).not.toHaveBeenCalled()
    for (const child of harness.children.values()) {
      expect(child.kill).not.toHaveBeenCalled()
    }
  })

  it('keeps materialized inputs through readiness when a Windows pnpm wrapper exits early', async () => {
    const localDev = await loadLocalDev()
    const harness = createHarness({ listening: () => true, triggerGatewayExit: true })

    await expect(localDev.runLocalDevSupervisor(harness.dependencies)).resolves.toMatchObject({
      status: 'ready',
      exitCode: 0,
    })

    expect(harness.cleanup).not.toHaveBeenCalled()
  })

  it('keeps healthy managed services when a Windows wrapper exits after port readiness', async () => {
    const localDev = await loadLocalDev()
    const harness = createHarness({ listening: () => true })

    await expect(localDev.runLocalDevSupervisor(harness.dependencies)).resolves.toMatchObject({
      status: 'ready',
      exitCode: 0,
    })

    const gateway = harness.children.get('gateway')
    expect(gateway).toBeDefined()
    if (!gateway) {
      throw new Error('Gateway child is required.')
    }

    gateway.emit('exit', 0, null)
    await Promise.resolve()

    expect(harness.probePort).toHaveBeenLastCalledWith(8080)
    expect(harness.cleanup).not.toHaveBeenCalled()
    for (const child of harness.children.values()) {
      expect(child.kill).not.toHaveBeenCalled()
    }
  })

  it('still cleans up atomically when a managed service exits with a failure code after readiness', async () => {
    const localDev = await loadLocalDev()
    const harness = createHarness({ listening: () => true })

    await expect(localDev.runLocalDevSupervisor(harness.dependencies)).resolves.toMatchObject({
      status: 'ready',
      exitCode: 0,
    })

    const gateway = harness.children.get('gateway')
    expect(gateway).toBeDefined()
    if (!gateway) {
      throw new Error('Gateway child is required.')
    }

    gateway.emit('exit', 1, null)
    await Promise.resolve()

    expect(harness.cleanup).toHaveBeenCalledTimes(1)
    expect(harness.setExitCode).toHaveBeenCalledWith(1)
    for (const child of harness.children.values()) {
      expect(child.kill).toHaveBeenCalledTimes(1)
    }
  })

  it('still cleans up atomically when a zero-code exit no longer owns its service port', async () => {
    const localDev = await loadLocalDev()
    let gatewayListening = true
    const harness = createHarness({ listening: port => port !== 8080 || gatewayListening })

    await expect(localDev.runLocalDevSupervisor(harness.dependencies)).resolves.toMatchObject({
      status: 'ready',
      exitCode: 0,
    })

    const gateway = harness.children.get('gateway')
    expect(gateway).toBeDefined()
    if (!gateway) {
      throw new Error('Gateway child is required.')
    }

    gatewayListening = false
    gateway.emit('exit', 0, null)
    await Promise.resolve()

    expect(harness.probePort).toHaveBeenLastCalledWith(8080)
    expect(harness.cleanup).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(harness.setExitCode).toHaveBeenCalledWith(1))
    for (const child of harness.children.values()) {
      expect(child.kill).toHaveBeenCalledTimes(1)
    }
  })

  it('uses the same idempotent task-owned cleanup when a child errors before readiness', async () => {
    const localDev = await loadLocalDev()
    const harness = createHarness({
      listening: port => port !== 8080,
      readinessAttempts: 10,
      triggerGatewayError: true,
    })

    await expect(localDev.runLocalDevSupervisor(harness.dependencies)).resolves.toMatchObject({
      status: 'failed',
      exitCode: 1,
    })

    expect(harness.cleanup).toHaveBeenCalledTimes(1)
    expect(harness.setExitCode).toHaveBeenCalledWith(1)
    for (const child of harness.children.values()) {
      expect(child.kill).toHaveBeenCalledTimes(1)
    }
  })
})
