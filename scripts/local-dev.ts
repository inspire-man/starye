import type { ChildProcess } from 'node:child_process'
import type { MaterializedTargetDeployConfig, TargetPagesSurface } from '../packages/config/src/deployment-target/index.ts'
import { spawn } from 'node:child_process'
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

interface StartedProcess {
  readonly label: string
  readonly process: ChildProcess
}

function startPnpm(label: string, args: readonly string[], environment: NodeJS.ProcessEnv = process.env): StartedProcess {
  const invocation = packageManagerInvocation(args)
  return {
    label,
    process: spawn(invocation.command, invocation.args, {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: environment,
      shell: false,
      stdio: 'inherit',
    }),
  }
}

async function materializeLocalInputs(): Promise<Map<TargetPagesSurface, MaterializedTargetDeployConfig>> {
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
  const entries = await Promise.all(pagesSurfaces.map(async (surface) => {
    const materialized = await materializeTargetDeployConfig({
      deploy,
      publicRuntimeInput: localPublicRuntimeInput,
      runId: `local-dev-${process.pid}-${surface}`,
      appDirectories: {
        api: path.join(root, 'apps', 'api'),
        gateway: path.join(root, 'apps', 'gateway'),
      },
      runDirectory: path.join(root, '.target-runs'),
      pagesSurface: surface,
    })
    return [surface, materialized] as const
  }))
  return new Map(entries)
}

async function main(): Promise<void> {
  const materialized = await materializeLocalInputs()
  const apiAndGateway = materialized.get('dashboard')
  if (!apiAndGateway) {
    throw new Error('Local dashboard runtime input is unavailable.')
  }

  const pageEnvironment = (surface: TargetPagesSurface): NodeJS.ProcessEnv => {
    const buildEnvPath = materialized.get(surface)?.pages?.buildEnvPath
    if (!buildEnvPath) {
      throw new Error(`Local Pages runtime input is unavailable for ${surface}.`)
    }
    return { ...process.env, STARYE_PAGES_BUILD_ENV_PATH: buildEnvPath }
  }

  const processes = [
    startPnpm('api', [
      '--filter',
      'api',
      'exec',
      'wrangler',
      'dev',
      '--port',
      '8787',
      '--config',
      apiAndGateway.apiConfigPath,
      ...localApiOrigins.flatMap(([key, origin]) => ['--var', `${key}:${origin}`]),
    ]),
    startPnpm('gateway', [
      '--filter',
      'gateway',
      'exec',
      'wrangler',
      'dev',
      '--config',
      apiAndGateway.gatewayConfigPath,
      ...localGatewayOrigins.flatMap(([key, origin]) => ['--var', `${key}:${origin}`]),
    ]),
    startPnpm('dashboard', ['--filter', 'dashboard', 'exec', 'vite', '--host', '0.0.0.0', '--config', 'vite.config.ts', '--configLoader', 'runner'], pageEnvironment('dashboard')),
    startPnpm('auth', ['--filter', 'starye-auth', 'exec', 'nuxt', 'dev', '--port', '3003'], pageEnvironment('auth')),
    startPnpm('blog', ['--filter', 'blog', 'exec', 'nuxt', 'dev', '--port', '3002'], pageEnvironment('blog')),
    startPnpm('movie', ['--filter', '@starye/movie-app', 'exec', 'vite', '--port', '3001', '--config', 'vite.config.ts', '--configLoader', 'runner'], pageEnvironment('movie')),
    startPnpm('comic', ['--filter', '@starye/comic-app', 'exec', 'vite', '--port', '3000', '--config', 'vite.config.ts', '--configLoader', 'runner'], pageEnvironment('comic')),
  ]

  let stopping = false
  const stop = async (exitCode: number): Promise<void> => {
    if (stopping) {
      return
    }
    stopping = true
    for (const child of processes) {
      child.process.kill()
    }
    await Promise.all([...materialized.values()].map(entry => entry.cleanup()))
    process.exitCode = exitCode
  }

  for (const child of processes) {
    child.process.once('error', () => void stop(1))
    child.process.once('exit', (code) => {
      if (!stopping) {
        console.error(`Local ${child.label} service exited unexpectedly.`)
        void stop(code ?? 1)
      }
    })
  }

  process.once('SIGINT', () => void stop(0))
  process.once('SIGTERM', () => void stop(0))
  console.log('Local services starting through Gateway at http://localhost:8080')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
