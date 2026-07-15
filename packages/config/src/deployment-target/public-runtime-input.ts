import type { TargetPagesSurface } from './target-profile.schema'
import type { TargetPublicRuntimeConfig } from './target-projections'
import type { TargetResolution } from './target-resolver'
import {
  buildTargetPublicRuntimeConfig,
  targetAppBasePaths,
} from './target-projections'

export interface AuditedPublicRuntimeOverlay {
  readonly sentryDsn?: string
  readonly sentryRelease?: string
  readonly buildMode: string
  readonly monitoringEnabled: boolean
  readonly aria2Enabled: boolean
  readonly aria2WebsocketEnabled: boolean
  readonly ratingEnabled: boolean
  readonly autoScoreEnabled: boolean
  readonly performanceMonitoringEnabled: boolean
}

export interface AuditedPublicRuntimeInput {
  readonly publicRuntime: TargetPublicRuntimeConfig
  readonly overlay: AuditedPublicRuntimeOverlay
}

export interface VitePublicRuntimeEnv {
  readonly VITE_TARGET_ID: string
  readonly VITE_GATEWAY_BASE_URL: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_BASE_PATH: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_RELEASE?: string
  readonly VITE_BUILD_MODE: string
  readonly VITE_MONITORING_ENABLED?: 'true' | 'false'
  readonly VITE_FEATURE_ARIA2?: 'true' | 'false'
  readonly VITE_FEATURE_ARIA2_WS?: 'true' | 'false'
  readonly VITE_FEATURE_RATING?: 'true' | 'false'
  readonly VITE_FEATURE_AUTO_SCORE?: 'true' | 'false'
  readonly VITE_FEATURE_PERF_MONITOR?: 'true' | 'false'
}

export interface NuxtPublicRuntimeEnv {
  readonly NUXT_PUBLIC_TARGET_ID: string
  readonly NUXT_PUBLIC_GATEWAY_BASE_URL: string
  readonly NUXT_PUBLIC_API_BASE_URL: string
  readonly NUXT_PUBLIC_APP_BASE_PATH: string
  readonly NUXT_PUBLIC_SENTRY_DSN?: string
  readonly NUXT_PUBLIC_SENTRY_RELEASE?: string
  readonly NUXT_PUBLIC_BUILD_MODE: string
}

type VitePagesSurface = Extract<TargetPagesSurface, 'dashboard' | 'movie' | 'comic' | 'tavern'>
type NuxtPagesSurface = Extract<TargetPagesSurface, 'auth' | 'blog'>
type GeneratedPublicRuntimeEnv = object

const overlayKeys = [
  'sentryDsn',
  'sentryRelease',
  'buildMode',
  'monitoringEnabled',
  'aria2Enabled',
  'aria2WebsocketEnabled',
  'ratingEnabled',
  'autoScoreEnabled',
  'performanceMonitoringEnabled',
] as const

const credentialShape = /secret|token|access[_-]?key|private[_-]?key|credential/i

const viteBaseKeys = [
  'VITE_TARGET_ID',
  'VITE_GATEWAY_BASE_URL',
  'VITE_API_BASE_URL',
  'VITE_APP_BASE_PATH',
  'VITE_SENTRY_DSN',
  'VITE_SENTRY_RELEASE',
  'VITE_BUILD_MODE',
] as const

const movieViteKeys = [
  ...viteBaseKeys,
  'VITE_MONITORING_ENABLED',
  'VITE_FEATURE_ARIA2',
  'VITE_FEATURE_ARIA2_WS',
  'VITE_FEATURE_RATING',
  'VITE_FEATURE_AUTO_SCORE',
  'VITE_FEATURE_PERF_MONITOR',
] as const

const nuxtKeys = [
  'NUXT_PUBLIC_TARGET_ID',
  'NUXT_PUBLIC_GATEWAY_BASE_URL',
  'NUXT_PUBLIC_API_BASE_URL',
  'NUXT_PUBLIC_APP_BASE_PATH',
  'NUXT_PUBLIC_SENTRY_DSN',
  'NUXT_PUBLIC_SENTRY_RELEASE',
  'NUXT_PUBLIC_BUILD_MODE',
] as const

function assertSafePublicText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Public runtime overlay field ${field} must be non-empty text.`)
  }

  if (credentialShape.test(value)) {
    throw new Error(`Public runtime overlay field ${field} has a credential-shaped value.`)
  }

  return value
}

function parseBoolean(value: unknown, field: string, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue
  }

  if (typeof value !== 'boolean') {
    throw new TypeError(`Public runtime overlay field ${field} must be boolean.`)
  }

  return value
}

function assertGeneratedPublicUrl(value: string | undefined, field: string): string {
  const text = assertSafePublicText(value, field)
  let url: URL
  try {
    url = new URL(text)
  }
  catch {
    throw new Error(`Public runtime generated field ${field} must be an absolute URL.`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Public runtime generated field ${field} must use HTTP(S).`)
  }

  if (url.hostname === 'localhost' && url.port !== '8080') {
    throw new Error(`Public runtime generated field ${field} cannot use a direct local port.`)
  }

  return url.toString().replace(/\/$/, '')
}

function assertGeneratedBoolean(value: string | undefined, field: string, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  throw new TypeError(`Public runtime generated field ${field} must be 'true' or 'false'.`)
}

function parseGeneratedPublicRuntimeEnv(
  environment: GeneratedPublicRuntimeEnv,
  surface: TargetPagesSurface,
  framework: 'vite' | 'nuxt',
): AuditedPublicRuntimeInput {
  const values = environment as Readonly<Record<string, string | undefined>>
  const expectedKeys: ReadonlySet<string> = framework === 'vite'
    ? new Set(surface === 'movie' ? movieViteKeys : viteBaseKeys)
    : new Set(nuxtKeys)
  const ownPrefix = framework === 'vite' ? 'VITE_' : 'NUXT_PUBLIC_'
  const otherPrefix = framework === 'vite' ? 'NUXT_PUBLIC_' : 'VITE_'

  for (const key of Object.keys(values)) {
    if (key.startsWith(otherPrefix)) {
      throw new Error('Public runtime generated env contains a cross-framework key.')
    }

    if (key.startsWith(ownPrefix) && (!expectedKeys.has(key) || credentialShape.test(key))) {
      throw new Error('Public runtime generated env contains an unregistered public key.')
    }
  }

  const keys = framework === 'vite'
    ? {
        targetId: 'VITE_TARGET_ID',
        gatewayBaseUrl: 'VITE_GATEWAY_BASE_URL',
        apiBaseUrl: 'VITE_API_BASE_URL',
        appBasePath: 'VITE_APP_BASE_PATH',
        sentryDsn: 'VITE_SENTRY_DSN',
        sentryRelease: 'VITE_SENTRY_RELEASE',
        buildMode: 'VITE_BUILD_MODE',
      }
    : {
        targetId: 'NUXT_PUBLIC_TARGET_ID',
        gatewayBaseUrl: 'NUXT_PUBLIC_GATEWAY_BASE_URL',
        apiBaseUrl: 'NUXT_PUBLIC_API_BASE_URL',
        appBasePath: 'NUXT_PUBLIC_APP_BASE_PATH',
        sentryDsn: 'NUXT_PUBLIC_SENTRY_DSN',
        sentryRelease: 'NUXT_PUBLIC_SENTRY_RELEASE',
        buildMode: 'NUXT_PUBLIC_BUILD_MODE',
      }
  for (const key of [keys.targetId, keys.gatewayBaseUrl, keys.apiBaseUrl, keys.appBasePath, keys.buildMode]) {
    if (values[key] === undefined) {
      throw new Error(`Public runtime generated env is missing required field ${key}.`)
    }
  }
  const targetId = assertSafePublicText(values[keys.targetId], keys.targetId)
  const gatewayBaseUrl = assertGeneratedPublicUrl(values[keys.gatewayBaseUrl], keys.gatewayBaseUrl)
  const apiBaseUrl = assertGeneratedPublicUrl(values[keys.apiBaseUrl], keys.apiBaseUrl)
  const appBasePath = assertSafePublicText(values[keys.appBasePath], keys.appBasePath)

  if (appBasePath !== targetAppBasePaths[surface]) {
    throw new Error('Public runtime generated env app base path does not match its surface.')
  }

  const overlay: AuditedPublicRuntimeOverlay = {
    ...(values[keys.sentryDsn] === undefined ? {} : { sentryDsn: assertSafePublicText(values[keys.sentryDsn], keys.sentryDsn) }),
    ...(values[keys.sentryRelease] === undefined ? {} : { sentryRelease: assertSafePublicText(values[keys.sentryRelease], keys.sentryRelease) }),
    buildMode: assertSafePublicText(values[keys.buildMode], keys.buildMode),
    monitoringEnabled: framework === 'vite' && surface === 'movie'
      ? assertGeneratedBoolean(values.VITE_MONITORING_ENABLED, 'VITE_MONITORING_ENABLED', false)
      : false,
    aria2Enabled: framework === 'vite' && surface === 'movie'
      ? assertGeneratedBoolean(values.VITE_FEATURE_ARIA2, 'VITE_FEATURE_ARIA2', true)
      : true,
    aria2WebsocketEnabled: framework === 'vite' && surface === 'movie'
      ? assertGeneratedBoolean(values.VITE_FEATURE_ARIA2_WS, 'VITE_FEATURE_ARIA2_WS', true)
      : true,
    ratingEnabled: framework === 'vite' && surface === 'movie'
      ? assertGeneratedBoolean(values.VITE_FEATURE_RATING, 'VITE_FEATURE_RATING', true)
      : true,
    autoScoreEnabled: framework === 'vite' && surface === 'movie'
      ? assertGeneratedBoolean(values.VITE_FEATURE_AUTO_SCORE, 'VITE_FEATURE_AUTO_SCORE', true)
      : true,
    performanceMonitoringEnabled: framework === 'vite' && surface === 'movie'
      ? assertGeneratedBoolean(values.VITE_FEATURE_PERF_MONITOR, 'VITE_FEATURE_PERF_MONITOR', false)
      : false,
  }

  return {
    publicRuntime: {
      targetId,
      gatewayBaseUrl,
      apiBaseUrl,
      appBasePaths: targetAppBasePaths,
    },
    overlay,
  }
}

export function parseVitePublicRuntimeEnv(
  environment: GeneratedPublicRuntimeEnv,
  surface: VitePagesSurface,
): AuditedPublicRuntimeInput {
  return parseGeneratedPublicRuntimeEnv(environment, surface, 'vite')
}

export function parseNuxtPublicRuntimeEnv(
  environment: GeneratedPublicRuntimeEnv,
  surface: NuxtPagesSurface,
): AuditedPublicRuntimeInput {
  return parseGeneratedPublicRuntimeEnv(environment, surface, 'nuxt')
}

export function assertPublicRuntimeConfig(input: unknown): asserts input is AuditedPublicRuntimeInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Public runtime input must be an object.')
  }

  const value = input as { publicRuntime?: unknown, overlay?: unknown }
  if (!value.publicRuntime || typeof value.publicRuntime !== 'object' || !value.overlay || typeof value.overlay !== 'object') {
    throw new Error('Public runtime input must include publicRuntime and overlay.')
  }
}

export function parseAuditedPublicRuntimeInput(
  resolution: TargetResolution,
  input: unknown,
): AuditedPublicRuntimeInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Public runtime overlay must be an object.')
  }

  const overlay = input as Record<string, unknown>
  for (const key of Object.keys(overlay)) {
    if (!(overlayKeys as readonly string[]).includes(key)) {
      throw new Error('Unknown public runtime overlay field.')
    }
  }

  const parsed: AuditedPublicRuntimeOverlay = {
    ...(overlay.sentryDsn === undefined ? {} : { sentryDsn: assertSafePublicText(overlay.sentryDsn, 'sentryDsn') }),
    ...(overlay.sentryRelease === undefined ? {} : { sentryRelease: assertSafePublicText(overlay.sentryRelease, 'sentryRelease') }),
    buildMode: assertSafePublicText(overlay.buildMode, 'buildMode'),
    monitoringEnabled: parseBoolean(overlay.monitoringEnabled, 'monitoringEnabled', false),
    aria2Enabled: parseBoolean(overlay.aria2Enabled, 'aria2Enabled', true),
    aria2WebsocketEnabled: parseBoolean(overlay.aria2WebsocketEnabled, 'aria2WebsocketEnabled', true),
    ratingEnabled: parseBoolean(overlay.ratingEnabled, 'ratingEnabled', true),
    autoScoreEnabled: parseBoolean(overlay.autoScoreEnabled, 'autoScoreEnabled', true),
    performanceMonitoringEnabled: parseBoolean(overlay.performanceMonitoringEnabled, 'performanceMonitoringEnabled', false),
  }

  return {
    publicRuntime: buildTargetPublicRuntimeConfig(resolution),
    overlay: parsed,
  }
}

function baseViteEnv(input: AuditedPublicRuntimeInput, surface: TargetPagesSurface): VitePublicRuntimeEnv {
  const { publicRuntime, overlay } = input
  return {
    VITE_TARGET_ID: publicRuntime.targetId,
    VITE_GATEWAY_BASE_URL: publicRuntime.gatewayBaseUrl,
    VITE_API_BASE_URL: publicRuntime.apiBaseUrl,
    VITE_APP_BASE_PATH: targetAppBasePaths[surface],
    ...(overlay.sentryDsn ? { VITE_SENTRY_DSN: overlay.sentryDsn } : {}),
    ...(overlay.sentryRelease ? { VITE_SENTRY_RELEASE: overlay.sentryRelease } : {}),
    VITE_BUILD_MODE: overlay.buildMode,
  }
}

export function buildVitePublicRuntimeEnv(
  input: AuditedPublicRuntimeInput,
  surface: Extract<TargetPagesSurface, 'dashboard' | 'movie' | 'comic' | 'tavern'>,
): VitePublicRuntimeEnv {
  assertPublicRuntimeConfig(input)
  const base = baseViteEnv(input, surface)

  if (surface !== 'movie') {
    return base
  }

  return {
    ...base,
    VITE_MONITORING_ENABLED: String(input.overlay.monitoringEnabled) as 'true' | 'false',
    VITE_FEATURE_ARIA2: String(input.overlay.aria2Enabled) as 'true' | 'false',
    VITE_FEATURE_ARIA2_WS: String(input.overlay.aria2WebsocketEnabled) as 'true' | 'false',
    VITE_FEATURE_RATING: String(input.overlay.ratingEnabled) as 'true' | 'false',
    VITE_FEATURE_AUTO_SCORE: String(input.overlay.autoScoreEnabled) as 'true' | 'false',
    VITE_FEATURE_PERF_MONITOR: String(input.overlay.performanceMonitoringEnabled) as 'true' | 'false',
  }
}

export function buildNuxtPublicRuntimeEnv(
  input: AuditedPublicRuntimeInput,
  surface: Extract<TargetPagesSurface, 'auth' | 'blog'>,
): NuxtPublicRuntimeEnv {
  assertPublicRuntimeConfig(input)
  const { publicRuntime, overlay } = input

  return {
    NUXT_PUBLIC_TARGET_ID: publicRuntime.targetId,
    NUXT_PUBLIC_GATEWAY_BASE_URL: publicRuntime.gatewayBaseUrl,
    NUXT_PUBLIC_API_BASE_URL: publicRuntime.apiBaseUrl,
    NUXT_PUBLIC_APP_BASE_PATH: targetAppBasePaths[surface],
    ...(overlay.sentryDsn ? { NUXT_PUBLIC_SENTRY_DSN: overlay.sentryDsn } : {}),
    ...(overlay.sentryRelease ? { NUXT_PUBLIC_SENTRY_RELEASE: overlay.sentryRelease } : {}),
    NUXT_PUBLIC_BUILD_MODE: overlay.buildMode,
  }
}
