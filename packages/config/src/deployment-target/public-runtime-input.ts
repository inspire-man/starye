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
