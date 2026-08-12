import type { ChildProcess } from 'node:child_process'
import type { MaterializedTargetDeployConfig, TargetPagesSurface } from '../packages/config/src/deployment-target/index.ts'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  buildTargetProjections,
  LOCAL_GATEWAY_ORIGIN,
  materializeTargetDeployConfig,
  parseAuditedPublicRuntimeInput,
  resolveTargetProfile,
} from '../packages/config/src/deployment-target/index.ts'
import { packageManagerInvocation } from './package-manager-command.ts'

const localTarget = 'starye-org'
const readinessAttempts = 160
const readinessIntervalMs = 250
const pagesSurfaces = ['dashboard', 'auth', 'blog', 'movie', 'comic'] as const satisfies readonly TargetPagesSurface[]
const localGatewayOrigins = [
  ['API_ORIGIN', 'http://localhost:8787'],
  ['AUTH_ORIGIN', 'http://localhost:3003'],
  ['DASHBOARD_ORIGIN', 'http://localhost:5173'],
  ['BLOG_ORIGIN', 'http://localhost:3002'],
  ['MOVIE_ORIGIN', 'http://localhost:3001'],
  ['COMIC_ORIGIN', 'http://localhost:3000'],
  ['TAVERN_ORIGIN', 'http://127.0.0.1:8000'],
] as const

const localApiOrigins = [
  ['BETTER_AUTH_URL', LOCAL_GATEWAY_ORIGIN],
  ['WEB_URL', LOCAL_GATEWAY_ORIGIN],
  ['ADMIN_URL', LOCAL_GATEWAY_ORIGIN],
] as const

export interface LocalDevServiceRecord {
  readonly label: string
  readonly port: number
  readonly pid: number | undefined
}

interface LocalDevServiceSpec {
  readonly label: string
  readonly port?: number
  readonly args: readonly string[]
  readonly environment?: NodeJS.ProcessEnv
}

interface LocalDevRunnerSpec {
  readonly args: readonly string[]
  readonly environment: NodeJS.ProcessEnv
  readonly label: 'local-task-runner'
}

interface StartedProcess {
  readonly label: string
  readonly pid: number | undefined
  readonly port?: number
  readonly process: ChildProcess
}

interface MaterializedLocalInputs {
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
  readonly pageEnvironment: (surface: TargetPagesSurface) => NodeJS.ProcessEnv
  readonly runnerConfigPath?: string
  readonly cleanup: () => Promise<void>
}

export interface LocalDevManagedProcessRecord {
  readonly label: string
  readonly pid: number | undefined
}

export interface LocalDevSupervisorResult {
  readonly status: 'ready' | 'failed'
  readonly exitCode: 0 | 1
  readonly managed: readonly LocalDevManagedProcessRecord[]
  readonly services: readonly LocalDevServiceRecord[]
  readonly stop: (exitCode: 0 | 1) => Promise<void>
  readonly waitForStop: () => Promise<void>
}

export interface LocalDevSupervisorDependencies {
  readonly materializeInputs?: () => Promise<MaterializedLocalInputs>
  readonly startService?: (service: LocalDevServiceSpec) => ChildProcess
  readonly startRunner?: (runner: LocalDevRunnerSpec) => ChildProcess
  readonly isPortListening?: (port: number) => Promise<boolean>
  readonly sleep?: (milliseconds: number) => Promise<void>
  readonly readinessAttempts?: number
  readonly readinessIntervalMs?: number
  readonly setExitCode?: (exitCode: 0 | 1) => void
  readonly registerSignalHandlers?: (stop: (exitCode: 0 | 1) => Promise<void>) => void
}

function startPnpm(service: LocalDevServiceSpec): ChildProcess {
  const invocation = packageManagerInvocation(service.args)
  return spawn(invocation.command, invocation.args, {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: service.environment ?? process.env,
    shell: false,
    stdio: 'inherit',
  })
}

async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (child.pid === undefined)
    return
  if (process.platform !== 'win32') {
    child.kill()
    return
  }
  await new Promise<void>((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    killer.once('error', () => resolve())
    killer.once('close', () => resolve())
  })
}

async function materializeLocalInputs(): Promise<MaterializedLocalInputs> {
  const root = path.resolve(import.meta.dirname, '..')
  const resolution = resolveTargetProfile(localTarget)
  const deploy = buildTargetProjections(resolution).deploy
  const publicRuntimeInput = parseAuditedPublicRuntimeInput(resolution, { buildMode: 'local' })
  const localPublicRuntimeInput = {
    ...publicRuntimeInput,
    publicRuntime: {
      ...publicRuntimeInput.publicRuntime,
      gatewayBaseUrl: LOCAL_GATEWAY_ORIGIN,
      apiBaseUrl: LOCAL_GATEWAY_ORIGIN,
    },
  }
  const materialized = new Map<TargetPagesSurface, MaterializedTargetDeployConfig>()
  try {
    for (const surface of pagesSurfaces) {
      materialized.set(surface, await materializeTargetDeployConfig({
        deploy,
        profile: resolution.profile,
        publicRuntimeInput: localPublicRuntimeInput,
        runId: `local-dev-${process.pid}-${surface}`,
        appDirectories: {
          api: path.join(root, 'apps', 'api'),
          gateway: path.join(root, 'apps', 'gateway'),
        },
        runDirectory: path.join(root, '.target-runs'),
        pagesSurface: surface,
      }))
    }
  }
  catch (error) {
    await Promise.all([...materialized.values()].map(entry => entry.cleanup()))
    throw error
  }
  const apiAndGateway = materialized.get('dashboard')
  if (!apiAndGateway) {
    await Promise.all([...materialized.values()].map(entry => entry.cleanup()))
    throw new Error('Local dashboard runtime input is unavailable.')
  }

  const apiVars = await readLocalEnvValues(path.join(root, 'apps', 'api', '.dev.vars'))
  const callbackKeyId = process.env.TASK_RUNNER_CALLBACK_KEY_ID_CURRENT?.trim() ?? apiVars.TASK_RUNNER_CALLBACK_KEY_ID_CURRENT
  const callbackSecret = process.env.TASK_RUNNER_CALLBACK_SECRET_CURRENT?.trim() ?? apiVars.TASK_RUNNER_CALLBACK_SECRET_CURRENT
  let runnerConfigPath: string | undefined
  if (callbackKeyId && callbackSecret) {
    const runDirectory = path.resolve(root, '.target-runs')
    runnerConfigPath = path.join(runDirectory, `local-task-runner.${process.pid}.json`)
    await mkdir(runDirectory, { recursive: true })
    await writeFile(runnerConfigPath, JSON.stringify({
      apiBaseUrl: LOCAL_GATEWAY_ORIGIN,
      callbackKeyId,
      callbackSecret,
      crawler: { manga: {}, movie: {} },
      providerMode: 'local-proof',
    }), { encoding: 'utf8', flag: 'w' })
  }

  return {
    apiConfigPath: apiAndGateway.apiConfigPath,
    gatewayConfigPath: apiAndGateway.gatewayConfigPath,
    ...(runnerConfigPath ? { runnerConfigPath } : {}),
    pageEnvironment: (surface) => {
      const buildEnvPath = materialized.get(surface)?.pages?.buildEnvPath
      if (!buildEnvPath) {
        throw new Error(`Local Pages runtime input is unavailable for ${surface}.`)
      }
      return { ...process.env, STARYE_PAGES_BUILD_ENV_PATH: buildEnvPath }
    },
    cleanup: async () => {
      if (runnerConfigPath)
        await rm(runnerConfigPath, { force: true })
      await Promise.all([...materialized.values()].map(entry => entry.cleanup()))
    },
  }
}

function localDevServiceSpecs(inputs: MaterializedLocalInputs): readonly LocalDevServiceSpec[] {
  return [
    {
      label: 'api',
      port: 8787,
      args: [
        '--filter',
        'api',
        'exec',
        'wrangler',
        'dev',
        '--port',
        '8787',
        '--config',
        inputs.apiConfigPath,
        ...localApiOrigins.flatMap(([key, origin]) => ['--var', `${key}:${origin}`]),
        '--var',
        'CRAWLER_LOCAL_PROOF_ENABLED:true',
      ],
    },
    {
      label: 'gateway',
      port: 8080,
      args: [
        '--filter',
        'gateway',
        'exec',
        'wrangler',
        'dev',
        '--config',
        inputs.gatewayConfigPath,
        ...localGatewayOrigins.flatMap(([key, origin]) => ['--var', `${key}:${origin}`]),
      ],
    },
    {
      label: 'dashboard',
      port: 5173,
      args: ['--filter', 'dashboard', 'exec', 'vite', '--host', '0.0.0.0', '--config', 'vite.config.ts', '--configLoader', 'runner'],
      environment: inputs.pageEnvironment('dashboard'),
    },
    {
      label: 'auth',
      port: 3003,
      args: ['--filter', 'starye-auth', 'exec', 'nuxt', 'dev', '--port', '3003'],
      environment: inputs.pageEnvironment('auth'),
    },
    {
      label: 'blog',
      port: 3002,
      args: ['--filter', 'blog', 'exec', 'nuxt', 'dev', '--port', '3002'],
      environment: inputs.pageEnvironment('blog'),
    },
    {
      label: 'movie',
      port: 3001,
      args: ['--filter', '@starye/movie-app', 'exec', 'vite', '--port', '3001', '--config', 'vite.config.ts', '--configLoader', 'runner'],
      environment: inputs.pageEnvironment('movie'),
    },
    {
      label: 'comic',
      port: 3000,
      args: ['--filter', '@starye/comic-app', 'exec', 'vite', '--port', '3000', '--config', 'vite.config.ts', '--configLoader', 'runner'],
      environment: inputs.pageEnvironment('comic'),
    },
  ]
}

async function readLocalEnvValues(pathname: string): Promise<Record<string, string>> {
  try {
    const values: Record<string, string> = {}
    for (const line of await readFile(pathname, 'utf8').then(value => value.split(/\r?\n/u))) {
      const separator = line.indexOf('=')
      if (separator <= 0)
        continue
      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\'')))
        value = value.slice(1, -1)
      if (/^[A-Z_][A-Z0-9_]*$/u.test(key) && value)
        values[key] = value
    }
    return values
  }
  catch {
    return {}
  }
}

function localTaskRunnerSpec(inputs: MaterializedLocalInputs): LocalDevRunnerSpec | undefined {
  if (!inputs.runnerConfigPath)
    return undefined
  return {
    args: ['--filter', '@starye/crawler', 'exec', 'tsx', '../../scripts/local-task-runner.ts'],
    environment: {
      ...process.env,
      CRAWLER_LOCAL_PROOF_ENABLED: 'true',
      TASK_RUNNER_LOCAL_CONFIG: inputs.runnerConfigPath,
    },
    label: 'local-task-runner',
  }
}

function defaultIsPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    let settled = false
    const finish = (listening: boolean): void => {
      if (settled) {
        return
      }
      settled = true
      socket.destroy()
      resolve(listening)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(250, () => finish(false))
  })
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function registerProcessSignalHandlers(stop: (exitCode: 0 | 1) => Promise<void>): void {
  process.once('SIGINT', () => void stop(0))
  process.once('SIGTERM', () => void stop(0))
}

export async function runLocalDevSupervisor(dependencies: LocalDevSupervisorDependencies = {}): Promise<LocalDevSupervisorResult> {
  const materializeInputs = dependencies.materializeInputs ?? materializeLocalInputs
  const startService = dependencies.startService ?? startPnpm
  const startRunner = dependencies.startRunner ?? (spec => startPnpm({ ...spec }))
  const isPortListening = dependencies.isPortListening ?? defaultIsPortListening
  const sleep = dependencies.sleep ?? defaultSleep
  const attempts = dependencies.readinessAttempts ?? readinessAttempts
  const interval = dependencies.readinessIntervalMs ?? readinessIntervalMs
  const setExitCode = dependencies.setExitCode ?? ((exitCode) => {
    process.exitCode = exitCode
  })
  const started: StartedProcess[] = []
  let materialized: MaterializedLocalInputs | undefined
  let ready = false
  let stopping = false
  let stopped: Promise<void> | undefined
  let resolveStopped: (() => void) | undefined
  const stoppedSignal = new Promise<void>((resolve) => {
    resolveStopped = resolve
  })

  const serviceRecords = (): readonly LocalDevServiceRecord[] => started
    .filter((child): child is StartedProcess & { readonly port: number } => child.port !== undefined)
    .map(({ label, port, pid }) => ({ label, port, pid }))
  const managedRecords = (): readonly LocalDevManagedProcessRecord[] => started.map(({ label, pid }) => ({ label, pid }))
  const stop = async (exitCode: 0 | 1): Promise<void> => {
    if (stopped) {
      return stopped
    }
    stopping = true
    stopped = (async () => {
      for (const child of started) {
        try {
          await terminateProcessTree(child.process)
        }
        catch {
          // The child may have already exited; no process outside this invocation is targeted.
        }
      }
      if (materialized) {
        await materialized.cleanup()
      }
      resolveStopped?.()
      setExitCode(exitCode)
    })()
    return stopped
  }
  const failed = (): LocalDevSupervisorResult => ({
    managed: managedRecords(),
    status: 'failed',
    exitCode: 1,
    services: serviceRecords(),
    stop,
    waitForStop: () => stoppedSignal,
  })
  const watchChild = (child: StartedProcess): void => {
    const stopAfterReadiness = (): void => {
      if (!stopping && ready) {
        console.error(`Local ${child.label} service exited unexpectedly.`)
        void stop(1)
      }
    }

    const stopForUnexpectedExit = async (code: number | null, signal: NodeJS.Signals | null): Promise<void> => {
      if (stopping || !ready) {
        return
      }
      if (child.port !== undefined && code === 0 && signal === null) {
        try {
          if (await isPortListening(child.port)) {
            return
          }
        }
        catch {
          // A failed liveness probe must not mask an exited managed service.
        }
      }
      stopAfterReadiness()
    }

    child.process.once('error', stopAfterReadiness)
    child.process.once('exit', (code, signal) => {
      // Windows pnpm wrappers can exit before their long-lived service child binds.
      void stopForUnexpectedExit(code, signal)
    })
  }

  try {
    materialized = await materializeInputs()
    for (const service of localDevServiceSpecs(materialized)) {
      const child = startService(service)
      const startedChild = {
        label: service.label,
        port: service.port,
        pid: child.pid,
        process: child,
      }
      started.push(startedChild)
      watchChild(startedChild)
    }
  }
  catch (error) {
    await stop(1)
    console.error(error instanceof Error ? error.message : String(error))
    return failed()
  }

  dependencies.registerSignalHandlers?.(stop)
  if (!dependencies.registerSignalHandlers) {
    registerProcessSignalHandlers(stop)
  }

  if (stopping) {
    await stopped
    return failed()
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const portChildren = started.filter((child): child is StartedProcess & { readonly port: number } => child.port !== undefined)
    const readiness = await Promise.all(portChildren.map(child => isPortListening(child.port)))
    if (stopping) {
      await stopped
      return failed()
    }
    if (readiness.every(Boolean)) {
      ready = true
      const runner = localTaskRunnerSpec(materialized)
      if (runner) {
        try {
          const child = startRunner(runner)
          const startedChild = { label: runner.label, pid: child.pid, process: child }
          started.push(startedChild)
          watchChild(startedChild)
        }
        catch (error) {
          await stop(1)
          console.error(error instanceof Error ? error.message : String(error))
          return failed()
        }
      }
      return {
        managed: managedRecords(),
        status: 'ready',
        exitCode: 0,
        services: serviceRecords(),
        stop,
        waitForStop: () => stoppedSignal,
      }
    }
    if (attempt < attempts - 1) {
      await sleep(interval)
      if (stopping) {
        await stopped
        return failed()
      }
    }
  }

  await stop(1)
  return failed()
}

async function main(): Promise<void> {
  const result = await runLocalDevSupervisor()
  if (result.status === 'ready') {
    console.log('Local services starting through Gateway at http://localhost:8080')
    await result.waitForStop()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
