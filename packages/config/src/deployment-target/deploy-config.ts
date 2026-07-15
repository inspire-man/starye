/// <reference types="node" />

import type {
  AuditedPublicRuntimeInput,
  NuxtPublicRuntimeEnv,
  VitePublicRuntimeEnv,
} from './public-runtime-input'
import type { TargetPagesSurface } from './target-profile.schema'

import type { TargetDeployProjection } from './target-projections'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildNuxtPublicRuntimeEnv,
  buildVitePublicRuntimeEnv,
} from './public-runtime-input'
import { targetAppBasePaths } from './target-projections'

type VitePagesSurface = Extract<TargetPagesSurface, 'dashboard' | 'movie' | 'comic' | 'tavern'>
type NuxtPagesSurface = Extract<TargetPagesSurface, 'auth' | 'blog'>

export type ParsedPagesBuildEnv = VitePublicRuntimeEnv | NuxtPublicRuntimeEnv

export interface TargetDeployDirectories {
  readonly api: string
  readonly gateway: string
}

export interface MaterializeTargetDeployConfigRequest {
  readonly deploy: TargetDeployProjection
  readonly publicRuntimeInput: AuditedPublicRuntimeInput
  readonly runId: string
  readonly appDirectories: TargetDeployDirectories
  readonly runDirectory: string
  readonly pagesSurface?: TargetPagesSurface
}

export interface MaterializedPagesBuild {
  readonly surface: TargetPagesSurface
  readonly project: string
  readonly buildEnvPath: string
}

export interface MaterializedTargetDeployConfig {
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
  readonly pages?: MaterializedPagesBuild
  cleanup: () => Promise<void>
}

const credentialShape = /secret|token|access[_-]?key|private[_-]?key|credential/i
const unsafeShellValue = /[\r\n'"`$;&|<>()[\]{}*!?~\\]/
const runIdPattern = /^[\w-]+$/

const vitePagesSurfaces: readonly VitePagesSurface[] = ['dashboard', 'movie', 'comic', 'tavern']
const nuxtPagesSurfaces: readonly NuxtPagesSurface[] = ['auth', 'blog']

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

function assertRunId(runId: string): void {
  if (!runIdPattern.test(runId)) {
    throw new Error('Run identity must use only letters, digits, underscores, and hyphens.')
  }
}

function isVitePagesSurface(surface: TargetPagesSurface): surface is VitePagesSurface {
  return vitePagesSurfaces.includes(surface as VitePagesSurface)
}

function isNuxtPagesSurface(surface: TargetPagesSurface): surface is NuxtPagesSurface {
  return nuxtPagesSurfaces.includes(surface as NuxtPagesSurface)
}

function assertSafeValue(value: string, label: string): void {
  if (!value.trim() || credentialShape.test(label) || credentialShape.test(value) || unsafeShellValue.test(value)) {
    throw new Error(`Invalid generated deploy value for ${label}.`)
  }
}

function quoteToml(value: string, label: string): string {
  assertSafeValue(value, label)
  return `"${value}"`
}

function assertChildPath(directory: string, filename: string): string {
  const root = path.resolve(directory)
  const candidate = path.resolve(root, filename)

  if (path.dirname(candidate) !== root) {
    throw new Error('Generated deploy config path must remain in its declared directory.')
  }

  return candidate
}

function apiConfigContent(deploy: TargetDeployProjection): string {
  const worker = deploy.workers.api
  const resource = worker.resources
  const routes = worker.routes.map(route => `[[routes]]\npattern = ${quoteToml(route.pattern, 'route')}\ncustom_domain = ${route.customDomain}`).join('\n\n')

  return [
    `name = ${quoteToml(worker.name, 'worker name')}`,
    'main = "src/index.ts"',
    'compatibility_date = "2024-04-01"',
    'compatibility_flags = [ "nodejs_compat" ]',
    '',
    '[vars]',
    `WEB_URL = ${quoteToml(worker.vars.webUrl ?? '', 'WEB_URL')}`,
    `ADMIN_URL = ${quoteToml(worker.vars.adminUrl ?? '', 'ADMIN_URL')}`,
    '',
    '[[d1_databases]]',
    `binding = ${quoteToml(resource.d1.binding, 'd1 binding')}`,
    `database_name = ${quoteToml(resource.d1.name, 'd1 database')}`,
    `database_id = ${quoteToml(resource.d1.id, 'd1 id')}`,
    'migrations_dir = "../../packages/db/drizzle"',
    '',
    '[[r2_buckets]]',
    `binding = ${quoteToml(resource.r2.binding, 'r2 binding')}`,
    `bucket_name = ${quoteToml(resource.r2.name, 'r2 bucket')}`,
    '',
    routes,
    '',
    '[[kv_namespaces]]',
    `binding = ${quoteToml(resource.kv.binding, 'kv binding')}`,
    `id = ${quoteToml(resource.kv.id, 'kv id')}`,
    '',
  ].join('\n')
}

function gatewayConfigContent(deploy: TargetDeployProjection): string {
  const worker = deploy.workers.gateway
  const resource = worker.resources
  const routes = worker.routes.map(route => `[[routes]]\npattern = ${quoteToml(route.pattern, 'route')}\ncustom_domain = ${route.customDomain}`).join('\n\n')
  const origins = [
    ['API_ORIGIN', worker.vars.apiOrigin],
    ['AUTH_ORIGIN', worker.vars.authOrigin],
    ['DASHBOARD_ORIGIN', worker.vars.dashboardOrigin],
    ['BLOG_ORIGIN', worker.vars.blogOrigin],
    ['MOVIE_ORIGIN', worker.vars.movieOrigin],
    ['COMIC_ORIGIN', worker.vars.comicOrigin],
    ['TAVERN_ORIGIN', worker.vars.tavernOrigin],
  ] as const

  return [
    `name = ${quoteToml(worker.name, 'worker name')}`,
    'main = "src/index.ts"',
    'compatibility_date = "2024-04-01"',
    'compatibility_flags = [ "nodejs_compat" ]',
    '',
    '[dev]',
    'port = 8080',
    '',
    '[vars]',
    ...origins.map(([key, value]) => `${key} = ${quoteToml(value ?? '', key)}`),
    '',
    routes,
    '',
    '[[kv_namespaces]]',
    `binding = ${quoteToml(resource.kv.binding, 'kv binding')}`,
    `id = ${quoteToml(resource.kv.id, 'kv id')}`,
    '',
  ].join('\n')
}

function allowedBuildKeys(surface: TargetPagesSurface): readonly string[] {
  if (surface === 'movie') {
    return movieViteKeys
  }

  if (isVitePagesSurface(surface)) {
    return viteBaseKeys
  }

  if (isNuxtPagesSurface(surface)) {
    return nuxtKeys
  }

  throw new Error('Unknown Pages surface.')
}

function buildPagesEnvironment(input: AuditedPublicRuntimeInput, surface: TargetPagesSurface): ParsedPagesBuildEnv {
  if (isVitePagesSurface(surface)) {
    return buildVitePublicRuntimeEnv(input, surface)
  }

  if (isNuxtPagesSurface(surface)) {
    return buildNuxtPublicRuntimeEnv(input, surface)
  }

  throw new Error('Unknown Pages surface.')
}

function serializePagesBuildEnv(environment: ParsedPagesBuildEnv, surface: TargetPagesSurface): string {
  const allowed = new Set(allowedBuildKeys(surface))
  const lines: string[] = []

  for (const [key, rawValue] of Object.entries(environment)) {
    if (!allowed.has(key) || credentialShape.test(key) || rawValue === undefined) {
      throw new Error('Pages build env contains an unregistered key.')
    }

    assertSafeValue(rawValue, key)
    lines.push(`${key}='${rawValue}'`)
  }

  return `${lines.join('\n')}\n`
}

function requiredBuildKeys(surface: TargetPagesSurface): readonly string[] {
  if (isVitePagesSurface(surface)) {
    return ['VITE_TARGET_ID', 'VITE_GATEWAY_BASE_URL', 'VITE_API_BASE_URL', 'VITE_APP_BASE_PATH', 'VITE_BUILD_MODE']
  }

  return ['NUXT_PUBLIC_TARGET_ID', 'NUXT_PUBLIC_GATEWAY_BASE_URL', 'NUXT_PUBLIC_API_BASE_URL', 'NUXT_PUBLIC_APP_BASE_PATH', 'NUXT_PUBLIC_BUILD_MODE']
}

function assertExpectedAppPath(values: Readonly<Record<string, string>>, surface: TargetPagesSurface): void {
  const key = isVitePagesSurface(surface) ? 'VITE_APP_BASE_PATH' : 'NUXT_PUBLIC_APP_BASE_PATH'
  if (values[key] !== targetAppBasePaths[surface]) {
    throw new Error('Pages build env app base path does not match the selected surface.')
  }
}

export async function parsePagesBuildEnv(pathname: string, surface: TargetPagesSurface): Promise<ParsedPagesBuildEnv> {
  const allowed = new Set(allowedBuildKeys(surface))
  const raw = await readFile(pathname, 'utf8')
  const values: Record<string, string> = {}

  for (const line of raw.split(/\r?\n/)) {
    if (!line) {
      continue
    }

    const match = /^([A-Z][A-Z0-9_]*)='([^'\r\n]*)'$/.exec(line)
    if (!match) {
      throw new Error('Invalid Pages build env assignment.')
    }

    const [, key, value] = match
    if (!allowed.has(key) || credentialShape.test(key) || credentialShape.test(value) || unsafeShellValue.test(value) || values[key] !== undefined) {
      throw new Error('Unknown Pages build env key.')
    }

    values[key] = value
  }

  for (const key of requiredBuildKeys(surface)) {
    if (!values[key]) {
      throw new Error('Pages build env is missing a required key.')
    }
  }

  assertExpectedAppPath(values, surface)
  return values as unknown as ParsedPagesBuildEnv
}

export async function materializeTargetDeployConfig(
  request: MaterializeTargetDeployConfigRequest,
): Promise<MaterializedTargetDeployConfig> {
  assertRunId(request.runId)

  const apiConfigPath = assertChildPath(request.appDirectories.api, `.target-wrangler.${request.runId}.toml`)
  const gatewayConfigPath = assertChildPath(request.appDirectories.gateway, `.target-wrangler.${request.runId}.toml`)
  const cleanupPaths = [apiConfigPath, gatewayConfigPath]

  await Promise.all([
    mkdir(path.dirname(apiConfigPath), { recursive: true }),
    mkdir(path.dirname(gatewayConfigPath), { recursive: true }),
  ])
  await Promise.all([
    writeFile(apiConfigPath, apiConfigContent(request.deploy), 'utf8'),
    writeFile(gatewayConfigPath, gatewayConfigContent(request.deploy), 'utf8'),
  ])

  let pages: MaterializedPagesBuild | undefined
  if (request.pagesSurface !== undefined) {
    const surface = request.pagesSurface
    const environment = buildPagesEnvironment(request.publicRuntimeInput, surface)
    const selected = request.deploy.pages.find(candidate => candidate.surface === surface)
    if (!selected) {
      await Promise.all(cleanupPaths.map(target => rm(target, { force: true })))
      throw new Error(`Missing selected Pages project for ${surface}.`)
    }

    const runDirectory = path.resolve(request.runDirectory)
    const buildEnvPath = assertChildPath(runDirectory, `pages-build-env.${request.runId}.${surface}.env`)
    await mkdir(runDirectory, { recursive: true })
    await writeFile(buildEnvPath, serializePagesBuildEnv(environment, surface), 'utf8')
    cleanupPaths.push(buildEnvPath)
    pages = { surface, project: selected.project, buildEnvPath }
  }

  return {
    apiConfigPath,
    gatewayConfigPath,
    ...(pages ? { pages } : {}),
    async cleanup() {
      await Promise.all(cleanupPaths.map(target => rm(target, { force: true })))
    },
  }
}
