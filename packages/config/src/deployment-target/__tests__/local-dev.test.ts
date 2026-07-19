import { EventEmitter } from 'node:events'
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

function createHarness(options: {
  readonly listening: (port: number) => boolean
  readonly readinessAttempts?: number
  readonly triggerGatewayError?: boolean
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
        return child
      },
      isPortListening: probePort,
      sleep: async () => {},
      readinessAttempts: options.readinessAttempts ?? 2,
      readinessIntervalMs: 0,
      setExitCode,
    },
    children,
    cleanup,
    setExitCode,
    probePort,
  }
}

describe('local-dev atomic seven-port supervisor', () => {
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

    await expect(localDev.runLocalDevSupervisor(harness.dependencies)).resolves.toEqual({
      status: 'ready',
      exitCode: 0,
      services: [
        { label: 'api', port: 8787, pid: 10_000 },
        { label: 'gateway', port: 8080, pid: 10_001 },
        { label: 'dashboard', port: 5173, pid: 10_002 },
        { label: 'auth', port: 3003, pid: 10_003 },
        { label: 'blog', port: 3002, pid: 10_004 },
        { label: 'movie', port: 3001, pid: 10_005 },
        { label: 'comic', port: 3000, pid: 10_006 },
      ],
    })

    expect(harness.cleanup).not.toHaveBeenCalled()
    for (const child of harness.children.values()) {
      expect(child.kill).not.toHaveBeenCalled()
    }
  })

  it('uses the same idempotent task-owned cleanup when a child errors before readiness', async () => {
    const localDev = await loadLocalDev()
    const harness = createHarness({
      listening: () => true,
      readinessAttempts: 10,
      triggerGatewayError: true,
    })

    await expect(localDev.runLocalDevSupervisor(harness.dependencies)).resolves.toMatchObject({
      status: 'failed',
      exitCode: 1,
    })

    expect(harness.probePort).not.toHaveBeenCalled()
    expect(harness.cleanup).toHaveBeenCalledTimes(1)
    expect(harness.setExitCode).toHaveBeenCalledWith(1)
    for (const child of harness.children.values()) {
      expect(child.kill).toHaveBeenCalledTimes(1)
    }
  })
})
