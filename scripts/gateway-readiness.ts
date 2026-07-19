import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { LOCAL_GATEWAY_ORIGIN } from '../packages/config/src/deployment-target/index'

export const GATEWAY_READINESS_SCHEMA = 'starye-gateway-readiness-1' as const
export const GATEWAY_AUTH_TIMEOUT_MS = 10_000

type GatewayProbeOutcome = 'accepted' | 'timeout' | 'fetch_failed' | 'http_status_unaccepted' | 'redirect_invalid'
type GatewayRoute = '/robots.txt' | '/auth' | '/auth/'

export interface GatewayAuthProbeResult {
  readonly outcome: GatewayProbeOutcome
}

export interface GatewayReadinessResult {
  readonly schema: typeof GATEWAY_READINESS_SCHEMA
  readonly healthy: boolean
  readonly robots: GatewayAuthProbeResult
  readonly auth: GatewayAuthProbeResult
  readonly authSlash: GatewayAuthProbeResult
}

interface GatewayProbeDependencies {
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
}

interface GatewayReadinessCliDependencies {
  readonly log?: (line: string) => void
  readonly probe?: () => Promise<GatewayReadinessResult>
}

function accepted(): GatewayAuthProbeResult {
  return { outcome: 'accepted' }
}

function rejected(outcome: Exclude<GatewayProbeOutcome, 'accepted'>): GatewayAuthProbeResult {
  return { outcome }
}

function isCanonicalAuthRedirect(location: string | null, route: GatewayRoute): boolean {
  if (!location) {
    return false
  }
  try {
    const target = new URL(location, LOCAL_GATEWAY_ORIGIN)
    if (target.origin !== LOCAL_GATEWAY_ORIGIN) {
      return false
    }
    return route === '/auth'
      ? target.pathname === '/auth/'
      : target.pathname.startsWith('/auth/')
  }
  catch {
    return false
  }
}

function validateGatewayResponse(route: GatewayRoute, response: Response): GatewayAuthProbeResult {
  if (route === '/robots.txt') {
    return response.status === 200 ? accepted() : rejected('http_status_unaccepted')
  }
  if (route === '/auth') {
    return response.status === 301 && isCanonicalAuthRedirect(response.headers.get('location'), route)
      ? accepted()
      : [301, 302, 303, 307, 308].includes(response.status)
          ? rejected('redirect_invalid')
          : rejected('http_status_unaccepted')
  }
  if (response.status >= 200 && response.status < 300) {
    return accepted()
  }
  return [301, 302, 303, 307, 308].includes(response.status)
    ? isCanonicalAuthRedirect(response.headers.get('location'), route)
      ? accepted()
      : rejected('redirect_invalid')
    : rejected('http_status_unaccepted')
}

async function cancelUnreadBody(response: Response): Promise<void> {
  if (!response.body || response.bodyUsed) {
    return
  }
  try {
    await response.body.cancel()
  }
  catch {
    // Resource cleanup is best-effort and must not expose upstream details.
  }
}

async function probeRoute(route: GatewayRoute, dependencies: GatewayProbeDependencies): Promise<GatewayAuthProbeResult> {
  const request = dependencies.fetch ?? fetch
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, dependencies.timeoutMs ?? GATEWAY_AUTH_TIMEOUT_MS)
  let response: Response

  try {
    response = await request(`${LOCAL_GATEWAY_ORIGIN}${route}`, {
      redirect: 'manual',
      signal: controller.signal,
    })
  }
  catch {
    return rejected(timedOut ? 'timeout' : 'fetch_failed')
  }
  finally {
    clearTimeout(timeout)
  }

  try {
    return validateGatewayResponse(route, response)
  }
  finally {
    await cancelUnreadBody(response)
  }
}

export async function observeCanonicalGatewayAuth(dependencies: GatewayProbeDependencies = {}): Promise<GatewayAuthProbeResult> {
  return probeRoute('/auth/', dependencies)
}

export async function probeCanonicalGatewayReadiness(dependencies: GatewayProbeDependencies = {}): Promise<GatewayReadinessResult> {
  const robots = await probeRoute('/robots.txt', dependencies)
  const auth = await probeRoute('/auth', dependencies)
  const authSlash = await probeRoute('/auth/', dependencies)
  return {
    schema: GATEWAY_READINESS_SCHEMA,
    healthy: [robots, auth, authSlash].every(result => result.outcome === 'accepted'),
    robots,
    auth,
    authSlash,
  }
}

function failedReadinessResult(): GatewayReadinessResult {
  return {
    schema: GATEWAY_READINESS_SCHEMA,
    healthy: false,
    robots: rejected('fetch_failed'),
    auth: rejected('fetch_failed'),
    authSlash: rejected('fetch_failed'),
  }
}

export async function runGatewayReadinessCli(dependencies: GatewayReadinessCliDependencies = {}): Promise<0 | 1> {
  let result: GatewayReadinessResult
  try {
    result = await (dependencies.probe ?? probeCanonicalGatewayReadiness)()
  }
  catch {
    result = failedReadinessResult()
  }
  ;(dependencies.log ?? console.log)(JSON.stringify(result))
  return result.healthy ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runGatewayReadinessCli().then((exitCode) => {
    process.exitCode = exitCode
  })
}
