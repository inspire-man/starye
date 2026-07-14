import type {
  TargetPagesSurface as ProfileTargetPagesSurface,
  TargetWorkerSurface,
} from './target-profile.schema'
import type { TargetResolution } from './target-resolver'
import {
  targetPagesSurfaceValues,
  targetWorkerSurfaceValues,
} from './target-profile.schema'

export { targetPagesSurfaceValues }
type TargetPagesSurface = ProfileTargetPagesSurface

export const targetAppBasePaths = {
  dashboard: '/dashboard/',
  auth: '/auth/',
  blog: '/blog/',
  movie: '/movie/',
  comic: '/comic/',
  tavern: '/tavern/',
} as const satisfies Readonly<Record<TargetPagesSurface, `/${string}/`>>

export interface TargetPublicRuntimeConfig {
  readonly targetId: string
  readonly gatewayBaseUrl: string
  readonly apiBaseUrl: string
  readonly appBasePaths: Readonly<typeof targetAppBasePaths>
}

export interface TargetPagesBuildEnv {
  readonly appBasePath: `/${string}/`
}

export interface TargetPagesDeployProjection {
  readonly surface: TargetPagesSurface
  readonly project: string
  readonly buildEnv: TargetPagesBuildEnv
}

export interface TargetWorkerDeployProjection {
  readonly surface: TargetWorkerSurface
  readonly name: string
  readonly routes: readonly {
    readonly pattern: string
    readonly customDomain: boolean
  }[]
  readonly vars: Readonly<{
    readonly webUrl?: string
    readonly adminUrl?: string
    readonly apiOrigin?: string
    readonly dashboardOrigin?: string
    readonly authOrigin?: string
    readonly blogOrigin?: string
    readonly movieOrigin?: string
    readonly comicOrigin?: string
    readonly tavernOrigin?: string
  }>
  readonly resources: Readonly<{
    readonly d1: Readonly<{ readonly binding: string, readonly name: string, readonly id: string }>
    readonly r2: Readonly<{ readonly binding: string, readonly name: string }>
    readonly kv: Readonly<{ readonly binding: string, readonly id: string }>
  }>
}

export interface TargetDeployProjection {
  readonly workers: Readonly<{
    readonly api: TargetWorkerDeployProjection
    readonly gateway: TargetWorkerDeployProjection
  }>
}

export interface TargetWorkflowProjection {
  readonly targetId: string
  readonly githubEnvironment: string
  readonly runId?: string
  readonly workerNames: Readonly<{
    readonly api: string
    readonly gateway: string
  }>
}

export interface TargetProjections {
  readonly publicRuntime: TargetPublicRuntimeConfig
  readonly deploy: TargetDeployProjection
  readonly workflow: TargetWorkflowProjection
}

export interface BuildTargetProjectionsOptions {
  readonly runId?: string
}

function isNonEmptyText(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

function assertTargetProjectionComplete(resolution: TargetResolution): void {
  const { profile } = resolution

  for (const worker of targetWorkerSurfaceValues) {
    const selected = profile.workers[worker]
    if (!isNonEmptyText(selected.name) || selected.routes.length === 0) {
      throw new Error(`Target ${resolution.id} is missing a complete ${worker} Worker projection.`)
    }
  }

  for (const surface of targetPagesSurfaceValues) {
    const selected = profile.pages[surface]
    if (!isNonEmptyText(selected.project) || !isNonEmptyText(selected.canonicalUrl)) {
      throw new Error(`Target ${resolution.id} is missing a complete ${surface} Pages projection.`)
    }
  }

  if (
    !isNonEmptyText(profile.resources.d1.binding)
    || !isNonEmptyText(profile.resources.d1.name)
    || !isNonEmptyText(profile.resources.d1.id)
    || !isNonEmptyText(profile.resources.r2.binding)
    || !isNonEmptyText(profile.resources.r2.name)
    || !isNonEmptyText(profile.resources.kv.binding)
    || !isNonEmptyText(profile.resources.kv.id)
  ) {
    throw new Error(`Target ${resolution.id} is missing a complete resource projection.`)
  }
}

export function isTargetPagesSurface(value: unknown): value is TargetPagesSurface {
  return typeof value === 'string' && (targetPagesSurfaceValues as readonly string[]).includes(value)
}

export function buildTargetPublicRuntimeConfig(resolution: TargetResolution): TargetPublicRuntimeConfig {
  assertTargetProjectionComplete(resolution)

  return {
    targetId: resolution.id,
    gatewayBaseUrl: resolution.profile.urls.gateway,
    apiBaseUrl: resolution.profile.urls.api,
    appBasePaths: targetAppBasePaths,
  }
}

export function getPagesDeployProjection(
  resolution: TargetResolution,
  surface: TargetPagesSurface,
): TargetPagesDeployProjection {
  assertTargetProjectionComplete(resolution)

  if (!isTargetPagesSurface(surface)) {
    throw new Error('Unknown Pages surface.')
  }

  const selected = resolution.profile.pages[surface]

  return {
    surface,
    project: selected.project,
    buildEnv: {
      appBasePath: targetAppBasePaths[surface],
    },
  }
}

function buildWorkerDeployProjection(
  resolution: TargetResolution,
  surface: TargetWorkerSurface,
): TargetWorkerDeployProjection {
  const { profile } = resolution
  const selected = profile.workers[surface]
  const sharedResources = {
    d1: profile.resources.d1,
    r2: profile.resources.r2,
    kv: profile.resources.kv,
  }

  if (surface === 'api') {
    return {
      surface,
      name: selected.name,
      routes: selected.routes,
      vars: {
        webUrl: profile.urls.gateway,
        adminUrl: profile.urls.dashboard,
      },
      resources: sharedResources,
    }
  }

  return {
    surface,
    name: selected.name,
    routes: selected.routes,
    vars: {
      apiOrigin: profile.urls.api,
      dashboardOrigin: profile.pages.dashboard.canonicalUrl,
      authOrigin: profile.pages.auth.canonicalUrl,
      blogOrigin: profile.pages.blog.canonicalUrl,
      movieOrigin: profile.pages.movie.canonicalUrl,
      comicOrigin: profile.pages.comic.canonicalUrl,
      tavernOrigin: profile.pages.tavern.canonicalUrl,
    },
    resources: sharedResources,
  }
}

export function buildTargetProjections(
  resolution: TargetResolution,
  options: BuildTargetProjectionsOptions = {},
): TargetProjections {
  const publicRuntime = buildTargetPublicRuntimeConfig(resolution)
  const api = buildWorkerDeployProjection(resolution, 'api')
  const gateway = buildWorkerDeployProjection(resolution, 'gateway')

  return {
    publicRuntime,
    deploy: {
      workers: { api, gateway },
    },
    workflow: {
      targetId: resolution.id,
      githubEnvironment: resolution.profile.ci.githubEnvironment,
      ...(options.runId ? { runId: options.runId } : {}),
      workerNames: { api: api.name, gateway: gateway.name },
    },
  }
}
