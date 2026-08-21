/// <reference types="node" />

import type { Page } from 'puppeteer-core'
import type { ActorCrawlerConfig } from '../src/crawlers/actor-crawler'
import type { JavBusCrawlerConfig } from '../src/crawlers/javbus'
import type { CrawlerConfig } from '../src/lib/base-crawler'
import type { CrawlerImageTargetInput, ProcessedImage, R2Config } from '../src/lib/image-processor'
import type { JavDBMovieImageUrls } from '../src/strategies/javdb-image'
import type { JavHkMovieImageUrls } from '../src/strategies/javhk'
import type { RepairPlayersReceipt, RepairRunnerSnapshot, RepairSourceObservationInput, RepairSourceObservationResponse, RunnerAvailabilityObservationInput, RunnerCandidate } from '../src/task-runner/runner-client'
import type { AdapterExecutionContext, AdapterExecutionResult } from '../src/task-runner/template-adapters'
import type { ServerVideoAvailabilityConfig } from '../src/task-runner/video-runner-wiring'
import type { MovieImageRefreshCandidate } from '../src/utils/api-client'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  productionCrawlerEnvironmentKeys as configuredProductionCrawlerEnvironmentKeys,
  productionCrawlerRequiredEnvironmentKeys as configuredProductionCrawlerRequiredEnvironmentKeys,
  productionCrawlerOptionalEnvironmentKeys,
} from '@starye/config/deployment-target'
import { ActorCrawler } from '../src/crawlers/actor-crawler'
import { ImageProcessor } from '../src/lib/image-processor'
import { createDataChainFixture, runDataChainFixture } from '../src/smoke/data-chain-fixture'
import { JavDBImageStrategy } from '../src/strategies/javdb-image'
import { JAVHK_BASE_URL, JAVHK_LOCALE, JavHkStrategy } from '../src/strategies/javhk'
import { createActionsEventClientFromEnvironment } from '../src/task-runner/actions-event-client'
import { createMangaAdapter } from '../src/task-runner/manga-adapter'
import { createMovieAdapter } from '../src/task-runner/movie-adapter'
import { createRepairPlayersAdapter } from '../src/task-runner/repair-adapter'
import { createRunnerClientFromEnvironment } from '../src/task-runner/runner-client'
import { createTemplateAdapterRegistry } from '../src/task-runner/template-adapters'
import { createServerVideoAvailabilityAdapters } from '../src/task-runner/video-runner-wiring'
import { GITHUB_ACTIONS_CONFIG } from '../src/types/config'
import { ApiClient } from '../src/utils/api-client'
import { BrowserManager } from '../src/utils/browser'

interface PreparedCrawlerContext {
  readonly targetId: string
  readonly runId: string
  readonly preparedContextPath: string
  readonly smokeItemCode?: string
  readonly apiConfigPath: string
  readonly gatewayConfigPath: string
  readonly identity: Readonly<{
    apiUrl: string
    accountId: string
    r2Name?: string
  }>
}

interface CrawlerApiClient {
  syncMovie: (movieData: unknown) => Promise<unknown>
}

interface BackfillActorCandidate {
  readonly id: string
  readonly name: string
  readonly sourceUrl?: string | null
}

interface BackfillApiClient {
  fetchMoviesNeedingImageRefresh: (limit?: number) => Promise<readonly MovieImageRefreshCandidate[]>
  fetchPendingActors: (maxCount: number) => Promise<readonly BackfillActorCandidate[]>
  syncActorDetails: (id: string, details: unknown) => Promise<unknown>
  syncMovie: (movieData: unknown) => Promise<unknown>
}

interface BackfillImageProcessor {
  process: (target: CrawlerImageTargetInput) => Promise<readonly ProcessedImage[]>
}

interface BackfillActorSource {
  findActor: (actorName: string) => Promise<{ readonly avatar: string } | null>
}

interface BackfillMovieSource {
  findMovieImages: (movieCode: string) => Promise<JavHkMovieImageUrls | JavDBMovieImageUrls | null>
}

type ProductionTemplate = 'manga' | 'movie'

interface ProductionCrawlerResult {
  readonly attempt: number
  readonly contentIds: readonly string[]
  readonly itemCount: number
  readonly operation: 'manga-production' | 'movie-production'
  readonly providerRunId: string
  readonly runId: string
  readonly status: 'cancelled' | 'succeeded'
  readonly template: ProductionTemplate
}

interface ProductionActionsClient {
  providerStarted: (input: {
    readonly attempt: number
    readonly providerRunAttempt: number
    readonly providerRunId: string
    readonly runId: string
    readonly sha: string
  }) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  heartbeat: (sequence: number) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  log: (sequence: number, message: string) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  progress: (sequence: number, counts: Readonly<Record<string, number>>) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  succeeded: (sequence: number, contentIds: readonly string[], counts: { readonly createdCount?: number, readonly updatedCount?: number }) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  failed: (sequence: number, code: string) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  cancelled: (sequence: number) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
}

interface ProductionRunnerClient {
  cancelled: (candidate: RunnerCandidate, sequence: number) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  claim: (candidate: RunnerCandidate) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  failed: (candidate: RunnerCandidate, sequence: number, code: string) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  heartbeat: (candidate: RunnerCandidate, sequence: number) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  log: (candidate: RunnerCandidate, sequence: number, message: string) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  observeRepairSource: (candidate: RunnerCandidate, sequence: number, input: RepairSourceObservationInput) => Promise<RepairSourceObservationResponse>
  observeAvailability: (candidate: RunnerCandidate, sequence: number, input: RunnerAvailabilityObservationInput) => Promise<{ readonly accepted: boolean }>
  poll: () => Promise<RunnerCandidate | undefined>
  progress: (candidate: RunnerCandidate, sequence: number, counts: Readonly<Record<string, number>>) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  succeeded: (candidate: RunnerCandidate, sequence: number, contentIds: readonly string[]) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
  succeededRepair: (candidate: RunnerCandidate, sequence: number, receipt: RepairPlayersReceipt) => Promise<{ readonly accepted: boolean, readonly cancel_requested?: boolean }>
}

export const productionCrawlerEnvironmentKeys = configuredProductionCrawlerEnvironmentKeys
export const productionCrawlerRequiredEnvironmentKeys = configuredProductionCrawlerRequiredEnvironmentKeys

const productionOperations = {
  'crawler-comic': {
    operation: 'manga-production',
    template: 'manga',
    workflow: '.github/workflows/daily-manga-crawl.yml',
  },
  'crawler-optimized': {
    operation: 'movie-production',
    template: 'movie',
    workflow: '.github/workflows/daily-movie-crawl.yml',
  },
} as const

const PRODUCTION_HEARTBEAT_INTERVAL_MS = 60_000

interface ProductionBinding {
  readonly attempt: number
  readonly providerRunAttempt: number
  readonly providerRunId: string
  readonly runId: string
  readonly sha: string
}

export interface TargetCrawlerMutationDependencies {
  readonly createActorCrawler?: (config: ActorCrawlerConfig) => Pick<ActorCrawler, 'run'>
  readonly createApiClient?: (config: { url: string, token: string, timeout: number }) => CrawlerApiClient
  readonly createBackfillApiClient?: (config: { url: string, token: string, timeout: number }) => BackfillApiClient
  readonly createBackfillImageProcessor?: (config: R2Config) => BackfillImageProcessor
  readonly createBackfillActorSource?: () => BackfillActorSource
  readonly createBackfillMovieSource?: () => BackfillMovieSource
  readonly createActionsEventClient?: (environment: NodeJS.ProcessEnv) => ProductionActionsClient
  readonly createRunnerClient?: (environment: NodeJS.ProcessEnv) => ProductionRunnerClient
  readonly discoverRepairSources?: (context: AdapterExecutionContext & { readonly snapshot: RepairRunnerSnapshot }) => Promise<RepairSourceObservationInput>
  readonly executeManga?: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>
  readonly executeMovie?: (context: AdapterExecutionContext) => Promise<AdapterExecutionResult>
  readonly videoAvailabilityConfig?: (environment: NodeJS.ProcessEnv, candidate: RunnerCandidate) => ServerVideoAvailabilityConfig
}

function productionVideoAvailabilityConfig(environment: NodeJS.ProcessEnv): ServerVideoAvailabilityConfig {
  let directSources: readonly string[] = []
  if (environment.STARYE_VIDEO_DIRECT_SOURCES) {
    try {
      const parsed = JSON.parse(environment.STARYE_VIDEO_DIRECT_SOURCES) as unknown
      if (Array.isArray(parsed) && parsed.every(value => typeof value === 'string'))
        directSources = parsed
    }
    catch {
      throw new Error('target-crawl-mutation rejected invalid server video source configuration.')
    }
  }
  return {
    direct: { sources: directSources },
    magnet: environment.STARYE_VIDEO_MAGNET_SOURCE
      ? {
          provider: environment.STARYE_VIDEO_MAGNET_PROVIDER_RPC_URL
            ? { rpcUrl: environment.STARYE_VIDEO_MAGNET_PROVIDER_RPC_URL, secret: environment.STARYE_VIDEO_MAGNET_PROVIDER_SECRET }
            : undefined,
          source: environment.STARYE_VIDEO_MAGNET_SOURCE,
        }
      : undefined,
  }
}

function redactedDiagnostic(environment: NodeJS.ProcessEnv): {
  declaredSecretKeys: string[]
  declaredKeysPresent: boolean[]
} {
  const declaredKeys = (environment.STARYE_PREPARED_SECRET_KEYS ?? '').split(',').filter(Boolean)
  return {
    declaredSecretKeys: declaredKeys,
    declaredKeysPresent: declaredKeys.map(key => Boolean(environment[key])),
  }
}

function productionErrorDiagnostic(error: unknown, environment: NodeJS.ProcessEnv): string {
  const raw = error instanceof Error
    ? `${error.name}: ${error.message}`
    : `UnknownError: ${String(error)}`
  const secretValues = productionCrawlerEnvironmentKeys
    .map(key => environment[key])
    .filter((value): value is string => Boolean(value && value.length > 0))
  const redacted = secretValues.reduce((message, value) => message.split(value).join('[redacted]'), raw)
  return redacted.replace(/\s+/gu, ' ').slice(0, 400)
}

function isPreparedCrawlerContext(value: unknown, contextPath: string): value is PreparedCrawlerContext {
  if (!value || typeof value !== 'object') {
    return false
  }

  const context = value as Partial<PreparedCrawlerContext>
  return typeof context.targetId === 'string'
    && typeof context.runId === 'string'
    && typeof context.preparedContextPath === 'string'
    && path.resolve(context.preparedContextPath) === path.resolve(contextPath)
    && path.basename(contextPath) === `prepared-context.${context.runId}.json`
    && typeof context.apiConfigPath === 'string'
    && path.isAbsolute(context.apiConfigPath)
    && typeof context.gatewayConfigPath === 'string'
    && path.isAbsolute(context.gatewayConfigPath)
    && !!context.identity
    && typeof context.identity.apiUrl === 'string'
    && typeof context.identity.accountId === 'string'
}

function requireEnvironment(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim()
  if (!value)
    throw new Error(`target-crawl-mutation rejected a missing prepared environment value: ${key}.`)
  return value
}

function requirePositiveInteger(environment: NodeJS.ProcessEnv, key: string): number {
  const value = Number(requireEnvironment(environment, key))
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`target-crawl-mutation rejected an invalid prepared environment value: ${key}.`)
  return value
}

function productionOperation(entry: string | undefined, operation: string | undefined) {
  if (entry !== 'crawler-comic' && entry !== 'crawler-optimized')
    return undefined
  const production = productionOperations[entry]
  return operation === production.operation ? production : undefined
}

function createCrawlerConfig(context: PreparedCrawlerContext, environment: NodeJS.ProcessEnv): CrawlerConfig {
  return {
    api: {
      token: requireEnvironment(environment, 'CRAWLER_SECRET'),
      url: context.identity.apiUrl,
    },
    r2: {
      accessKeyId: requireEnvironment(environment, 'R2_ACCESS_KEY_ID'),
      accountId: context.identity.accountId,
      bucketName: context.identity.r2Name ?? context.targetId,
      publicUrl: requireEnvironment(environment, 'R2_PUBLIC_URL'),
      secretAccessKey: requireEnvironment(environment, 'R2_SECRET_ACCESS_KEY'),
    },
  }
}

function createActorCrawlerConfig(context: PreparedCrawlerContext, environment: NodeJS.ProcessEnv): ActorCrawlerConfig {
  return {
    apiConfig: {
      token: requireEnvironment(environment, 'CRAWLER_SECRET'),
      url: context.identity.apiUrl,
    },
    browserConfig: {},
    r2Config: {
      accessKeyId: requireEnvironment(environment, 'R2_ACCESS_KEY_ID'),
      accountId: context.identity.accountId,
      bucketName: context.identity.r2Name ?? context.targetId,
      publicUrl: requireEnvironment(environment, 'R2_PUBLIC_URL'),
      secretAccessKey: requireEnvironment(environment, 'R2_SECRET_ACCESS_KEY'),
    },
  }
}

async function runActorCrawlerMutation(
  context: PreparedCrawlerContext,
  environment: NodeJS.ProcessEnv,
  dependencies: TargetCrawlerMutationDependencies,
): Promise<void> {
  if (environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }

  const crawler = dependencies.createActorCrawler?.(createActorCrawlerConfig(context, environment))
    ?? new ActorCrawler(createActorCrawlerConfig(context, environment))
  await crawler.run()
}

function getProcessedPreviewUrl(images: readonly ProcessedImage[]): string {
  const preview = images.find(image => image.variant === 'preview')
  if (!preview?.url)
    throw new Error('target-crawl-mutation rejected an image processor result without a preview URL.')
  return preview.url
}

function getProcessedPreviewUrls(images: readonly ProcessedImage[]): string[] {
  return images
    .filter(image => image.variant === 'preview' && Boolean(image.url))
    .map(image => image.url)
}

async function readBrowserImage(page: Page, url: string): Promise<Uint8Array | undefined> {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const contentType = response?.headers()['content-type'] ?? ''
    if ((response?.status() ?? 0) < 200 || (response?.status() ?? 0) >= 300 || !contentType.toLowerCase().startsWith('image/'))
      return undefined
    return await response?.buffer()
  }
  catch {
    return undefined
  }
}

async function runBackfillCoversMutation(
  context: PreparedCrawlerContext,
  environment: NodeJS.ProcessEnv,
  dependencies: TargetCrawlerMutationDependencies,
): Promise<void> {
  if (environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }

  const config = createCrawlerConfig(context, environment)
  const apiClient = dependencies.createBackfillApiClient?.({
    timeout: 60000,
    token: config.api.token,
    url: config.api.url,
  }) ?? new ApiClient(config.api)
  const imageProcessor = dependencies.createBackfillImageProcessor?.(config.r2) ?? new ImageProcessor(config.r2)
  const actorSource = dependencies.createBackfillActorSource?.() ?? new JavHkStrategy()
  let javDbBrowserManager: BrowserManager | null = null
  let javDbBrowserPage: Page | null = null
  let javDbBrowserImagePage: Page | null = null
  let javDbBrowserSource: JavDBImageStrategy | null = null
  const movieSource = dependencies.createBackfillMovieSource?.() ?? (() => {
    const javHkSource = new JavHkStrategy()
    return {
      findMovieImages: async (movieCode: string): Promise<JavHkMovieImageUrls | null> => {
        const javHkImages = await javHkSource.findMovieImages(movieCode)
        if (javHkImages)
          return javHkImages

        if (!javDbBrowserManager) {
          javDbBrowserManager = new BrowserManager()
          await javDbBrowserManager.launch()
          javDbBrowserPage = await javDbBrowserManager.createPage()
          javDbBrowserImagePage = await javDbBrowserManager.createPage()
          javDbBrowserSource = new JavDBImageStrategy(async (url) => {
            if (!javDbBrowserPage)
              return ''
            await javDbBrowserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
            return javDbBrowserPage.content()
          }, async (url) => {
            if (!javDbBrowserPage)
              return false

            try {
              const response = await javDbBrowserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
              const contentType = response?.headers()['content-type'] ?? ''
              const imageState = await javDbBrowserPage.evaluate(() => {
                const image = document.querySelector('img')
                return image
                  ? { complete: image.complete, height: image.naturalHeight, width: image.naturalWidth }
                  : null
              })
              return (response?.status() ?? 0) >= 200
                && (response?.status() ?? 0) < 300
                && contentType.toLowerCase().startsWith('image/')
                && imageState?.complete === true
                && imageState.width > 0
                && imageState.height > 0
            }
            catch {
              return false
            }
          })
        }

        if (!javDbBrowserSource)
          return null

        const javDbImages = await javDbBrowserSource.findMovieImages(movieCode)
        if (javDbImages)
          console.log(`✅ 使用 JavDB 图片源: ${movieCode}`)
        return javDbImages
      },
    }
  })()
  const movieCandidates = await apiClient.fetchMoviesNeedingImageRefresh(200)
  const actorCandidates = await apiClient.fetchPendingActors(200)

  console.log(`🖼️  影片/女优媒体回填：${movieCandidates.length} 部影片，${actorCandidates.length} 位女优`)

  try {
    for (const candidate of movieCandidates) {
      try {
        const imageUrls = await movieSource.findMovieImages(candidate.code)
        if (!imageUrls) {
          console.warn(`⚠️  JAV.hk/JavDB 未找到可用影片图片源: ${candidate.code}`)
          continue
        }

        const previewSourceImages = 'previewImages' in imageUrls && imageUrls.previewImages.length > 0
          ? imageUrls.previewImages.slice(0, 12)
          : [imageUrls.preview]
        const refererUrl = 'refererUrl' in imageUrls
          ? imageUrls.refererUrl
          : `${JAVHK_BASE_URL}/${JAVHK_LOCALE}`
        const coverImages = await imageProcessor.process({
          imageUrl: imageUrls.cover,
          ...('refererUrl' in imageUrls && javDbBrowserImagePage
            ? { imageData: await readBrowserImage(javDbBrowserImagePage, imageUrls.cover) }
            : {}),
          purpose: 'cover',
          keyNamespace: `movies/${candidate.code}`,
          filename: 'cover',
          refererUrl,
        })
        const processedPreviewImages: string[][] = []
        for (const [index, imageUrl] of previewSourceImages.entries()) {
          try {
            const images = await imageProcessor.process({
              imageUrl,
              ...('refererUrl' in imageUrls && javDbBrowserImagePage
                ? { imageData: await readBrowserImage(javDbBrowserImagePage, imageUrl) }
                : {}),
              purpose: 'cover',
              keyNamespace: `movies/${candidate.code}`,
              filename: `overview-${String(index + 1).padStart(2, '0')}`,
              refererUrl,
            })
            processedPreviewImages.push(getProcessedPreviewUrls(images))
          }
          catch (error) {
            console.warn(`⚠️  预览图回填失败 [${candidate.code}#${index + 1}]: ${error instanceof Error ? error.message : String(error)}`)
            processedPreviewImages.push([])
          }
        }

        const coverImage = getProcessedPreviewUrl(coverImages)
        const managedPreviewImages = processedPreviewImages.flat()
        if (managedPreviewImages.length === 0)
          throw new Error('预览图回填未返回任何托管地址')

        const result = await apiClient.syncMovie({
          code: candidate.code,
          coverImage,
          previewImages: managedPreviewImages,
        })
        if (!result)
          throw new Error('API 同步未返回成功响应')

        console.log(`✅ 影片媒体已回填: ${candidate.code}`)
      }
      catch (error) {
        console.warn(`⚠️ 影片媒体回填失败 [${candidate.code}]: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  finally {
    const browserManager = javDbBrowserManager as BrowserManager | null
    if (browserManager)
      await browserManager.close()
  }

  for (const actor of actorCandidates) {
    if (!actor.id || !actor.name.trim())
      continue

    try {
      const sourceActor = await actorSource.findActor(actor.name)
      if (!sourceActor?.avatar) {
        console.warn(`⚠️  JAV.hk 未找到女优头像: ${actor.name}`)
        continue
      }

      const avatarImages = await imageProcessor.process({
        imageUrl: sourceActor.avatar,
        purpose: 'avatar',
        keyNamespace: `actors/${actor.id}`,
        filename: 'avatar',
        refererUrl: `${JAVHK_BASE_URL}/${JAVHK_LOCALE}/actresses`,
      })
      const avatar = getProcessedPreviewUrl(avatarImages)
      const result = await apiClient.syncActorDetails(actor.id, { avatar })
      if (!result)
        throw new Error('API 同步未返回成功响应')

      console.log(`✅ 女优头像已回填: ${actor.name}`)
    }
    catch (error) {
      console.warn(`⚠️ 女优头像回填失败 [${actor.name}]: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

function assertProductionBinding(
  context: PreparedCrawlerContext,
  environment: NodeJS.ProcessEnv,
  production: { readonly template: ProductionTemplate, readonly workflow: string },
): ProductionBinding {
  const declared = environment.STARYE_PREPARED_SECRET_KEYS?.split(',').filter(Boolean) ?? []
  const declaredOptional = environment.STARYE_PREPARED_OPTIONAL_ENVIRONMENT_KEYS?.split(',').filter(Boolean) ?? []
  const actualOptional = productionCrawlerOptionalEnvironmentKeys.filter(key => Boolean(environment[key]))
  if (declared.length !== productionCrawlerEnvironmentKeys.length - productionCrawlerOptionalEnvironmentKeys.length
    || declared.some((key, index) => key !== productionCrawlerEnvironmentKeys[index])
    || declaredOptional.some((key, index) => key !== actualOptional[index])
    || declaredOptional.length !== actualOptional.length
    || declaredOptional.some(key => !productionCrawlerOptionalEnvironmentKeys.includes(key as typeof productionCrawlerOptionalEnvironmentKeys[number]))) {
    throw new Error('target-crawl-mutation rejected the declared production credential boundary.')
  }
  const binding = {
    attempt: requirePositiveInteger(environment, 'ACTIONS_APPLICATION_ATTEMPT'),
    providerRunAttempt: requirePositiveInteger(environment, 'GITHUB_RUN_ATTEMPT'),
    providerRunId: requireEnvironment(environment, 'GITHUB_RUN_ID'),
    runId: requireEnvironment(environment, 'ACTIONS_APPLICATION_RUN_ID'),
    sha: requireEnvironment(environment, 'GITHUB_SHA'),
  }
  if (binding.runId !== context.runId
    || environment.ACTIONS_PROVIDER_ENVIRONMENT !== 'starye-org'
    || environment.ACTIONS_PROVIDER_REF !== 'main'
    || environment.ACTIONS_PROVIDER_REPOSITORY !== 'inspire-man/starye'
    || environment.ACTIONS_PROVIDER_TARGET !== context.targetId
    || environment.ACTIONS_PROVIDER_TEMPLATE !== production.template
    || environment.ACTIONS_PROVIDER_WORKFLOW !== production.workflow) {
    throw new Error('target-crawl-mutation rejected an invalid production binding.')
  }
  if (!/^\d{1,20}$/u.test(binding.providerRunId) || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(binding.sha))
    throw new Error('target-crawl-mutation rejected an invalid provider identity.')
  return binding
}

async function runClaimedProductionCrawlerMutation(
  context: PreparedCrawlerContext,
  environment: NodeJS.ProcessEnv,
  production: { readonly operation: 'manga-production' | 'movie-production', readonly template: ProductionTemplate, readonly workflow: string },
  dependencies: TargetCrawlerMutationDependencies,
  binding: ProductionBinding,
  actions: ProductionActionsClient,
  runner: ProductionRunnerClient,
): Promise<ProductionCrawlerResult> {
  const candidate = await runner.poll()
  if (!candidate
    || candidate.runId !== binding.runId
    || candidate.attempt !== binding.attempt
    || candidate.snapshot.templateKey !== production.template) {
    throw new Error('target-crawl-mutation rejected a candidate outside the prepared production binding.')
  }

  let sequence = candidate.sequence
  if (candidate.sequence === 1) {
    const claim = await runner.claim(candidate)
    if (!claim.accepted)
      throw new Error('target-crawl-mutation rejected an unclaimed production run.')
    sequence += 1
  }

  const started = await actions.providerStarted(binding)
  if (!started.accepted)
    throw new Error('target-crawl-mutation rejected an unbound production provider.')

  const contentIds = new Set<string>()
  const observeContentId = (value: string) => {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 128)
      throw new Error('target-crawl-mutation rejected an invalid content identifier.')
    contentIds.add(value.trim())
  }
  let cancelled = started.cancel_requested === true
  let terminalEmitted = false
  let heartbeatPromise: Promise<boolean> | undefined
  let heartbeatFailure: unknown
  const checkpoint = () => {
    if (cancelled)
      return Promise.resolve(true)
    if (!heartbeatPromise) {
      heartbeatPromise = runner.heartbeat(candidate, sequence++)
        .then((heartbeat) => {
          if (!heartbeat.accepted)
            throw new Error('Production runner lease was rejected.')
          cancelled = heartbeat.cancel_requested === true
          return cancelled
        })
        .finally(() => {
          heartbeatPromise = undefined
        })
    }
    return heartbeatPromise
  }
  const cancelledResult = (ids: readonly string[] = []): ProductionCrawlerResult => ({
    attempt: binding.attempt,
    contentIds: ids,
    itemCount: ids.length,
    operation: production.operation,
    providerRunId: binding.providerRunId,
    runId: binding.runId,
    status: 'cancelled',
    template: production.template,
  })

  if (cancelled) {
    await runner.cancelled(candidate, sequence++)
    return cancelledResult()
  }

  const config = createCrawlerConfig(context, environment)
  const repairAdapter = createRepairPlayersAdapter(dependencies.discoverRepairSources
    ? { discoverSources: dependencies.discoverRepairSources }
    : {})
  const adapters = createTemplateAdapterRegistry([
    createMovieAdapter({ ...GITHUB_ACTIONS_CONFIG, ...config } as JavBusCrawlerConfig, dependencies.executeMovie),
    createMangaAdapter(config, dependencies.executeManga),
    repairAdapter,
    ...createServerVideoAvailabilityAdapters((dependencies.videoAvailabilityConfig ?? productionVideoAvailabilityConfig)(environment, candidate)),
  ])

  try {
    // Claim scheduled runs before registry selection; manual dispatch runs were claimed before Actions started.
    if (await checkpoint()) {
      await runner.cancelled(candidate, sequence++)
      terminalEmitted = true
      return cancelledResult()
    }
    await runner.log(candidate, sequence++, 'production crawler started')
    const heartbeatTimer = setInterval(() => {
      void checkpoint().catch((error: unknown) => {
        heartbeatFailure ??= error
      })
    }, PRODUCTION_HEARTBEAT_INTERVAL_MS)
    let result: AdapterExecutionResult
    try {
      const adapter = adapters.select(candidate.snapshot)
      result = await adapter.execute({
        candidate,
        checkpoint,
        client: runner,
        nextSequence: () => sequence++,
        observe: observeContentId,
      })
    }
    finally {
      clearInterval(heartbeatTimer)
      if (heartbeatPromise) {
        try {
          await heartbeatPromise
        }
        catch (error: unknown) {
          heartbeatFailure ??= error
        }
      }
    }
    if (heartbeatFailure)
      throw heartbeatFailure

    if (candidate.snapshot.operation !== 'repair_players' && !result.availabilityObservation) {
      for (const contentId of result.contentIds) observeContentId(contentId)
    }
    const progress = await runner.progress(candidate, sequence++, { observed: contentIds.size })
    if (!progress.accepted)
      throw new Error('target-crawl-mutation rejected an unvalidated production progress fact.')
    cancelled = progress.cancel_requested === true
    if (await checkpoint()) {
      await runner.cancelled(candidate, sequence++)
      terminalEmitted = true
      return cancelledResult([...contentIds])
    }

    if (candidate.snapshot.operation === 'repair_players') {
      if (!result.repairReceipt) {
        await runner.failed(candidate, sequence++, result.failureCode ?? 'receipt_missing')
        terminalEmitted = true
        throw new Error('target-crawl-mutation rejected an unvalidated repair receipt.')
      }
      const terminal = await runner.succeededRepair(candidate, sequence++, result.repairReceipt)
      if (!terminal.accepted)
        throw new Error('target-crawl-mutation rejected an unvalidated repair receipt.')
      terminalEmitted = true
      return {
        attempt: binding.attempt,
        contentIds: [],
        itemCount: 0,
        operation: production.operation,
        providerRunId: binding.providerRunId,
        runId: binding.runId,
        status: 'succeeded',
        template: production.template,
      }
    }

    if (result.availabilityObservation) {
      if (!candidate.contentId) {
        await runner.failed(candidate, sequence++, 'receipt_missing')
        terminalEmitted = true
        throw new Error('target-crawl-mutation rejected an empty availability receipt.')
      }
      const terminal = await runner.succeeded(candidate, sequence++, [candidate.contentId])
      if (!terminal.accepted)
        throw new Error('target-crawl-mutation rejected an unvalidated availability receipt.')
      terminalEmitted = true
      const observation = await runner.observeAvailability(candidate, sequence++, result.availabilityObservation)
      if (!observation.accepted)
        throw new Error('target-crawl-mutation rejected an unvalidated availability observation.')
      return {
        attempt: binding.attempt,
        contentIds: [candidate.contentId],
        itemCount: 1,
        operation: production.operation,
        providerRunId: binding.providerRunId,
        runId: binding.runId,
        status: 'succeeded',
        template: production.template,
      }
    }

    if (contentIds.size === 0) {
      await runner.failed(candidate, sequence++, 'receipt_missing')
      terminalEmitted = true
      throw new Error('target-crawl-mutation rejected an empty production receipt.')
    }
    const terminal = await runner.succeeded(candidate, sequence++, [...contentIds])
    if (!terminal.accepted)
      throw new Error('target-crawl-mutation rejected an unvalidated production receipt.')
    terminalEmitted = true
    return {
      attempt: binding.attempt,
      contentIds: [...contentIds],
      itemCount: contentIds.size,
      operation: production.operation,
      providerRunId: binding.providerRunId,
      runId: binding.runId,
      status: 'succeeded',
      template: production.template,
    }
  }
  catch (error) {
    console.error(`Production crawler diagnostic: ${productionErrorDiagnostic(error, environment)}`)
    if (!terminalEmitted) {
      try {
        await runner.progress(candidate, sequence++, { observed: contentIds.size })
        await runner.failed(candidate, sequence++, contentIds.size > 0 ? 'partial_ingest' : 'runner_failed')
        terminalEmitted = true
      }
      catch {
        // The Actions API owns the durable audit trail. Never expose crawler errors while reporting it.
      }
    }
    throw new Error('Production crawler operation failed.')
  }
}

async function runProductionCrawlerMutation(
  context: PreparedCrawlerContext,
  environment: NodeJS.ProcessEnv,
  production: { readonly operation: 'manga-production' | 'movie-production', readonly template: ProductionTemplate, readonly workflow: string },
  dependencies: TargetCrawlerMutationDependencies,
): Promise<ProductionCrawlerResult> {
  const binding = assertProductionBinding(context, environment, production)
  const client = dependencies.createActionsEventClient?.(environment) ?? createActionsEventClientFromEnvironment(environment)
  const runner = dependencies.createRunnerClient?.(environment)
    ?? (!dependencies.createActionsEventClient ? createRunnerClientFromEnvironment(environment) : undefined)
  if (runner)
    return runClaimedProductionCrawlerMutation(context, environment, production, dependencies, binding, client, runner)

  const started = await client.providerStarted(binding)
  if (!started.accepted)
    throw new Error('target-crawl-mutation rejected an unbound production provider.')
  // The control-plane dispatch claim consumes sequence 1 before the provider starts.
  let sequence = 2
  const contentIds = new Set<string>()
  const observeContentId = (value: string) => {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 128)
      throw new Error('target-crawl-mutation rejected an invalid content identifier.')
    contentIds.add(value.trim())
  }
  let cancelled = started.cancel_requested === true
  let terminalEmitted = false
  let heartbeatPromise: Promise<boolean> | undefined
  let heartbeatFailure: unknown
  const checkpoint = () => {
    if (cancelled)
      return Promise.resolve(true)
    if (!heartbeatPromise) {
      heartbeatPromise = client.heartbeat(sequence++)
        .then((heartbeat) => {
          if (!heartbeat.accepted)
            throw new Error('Production runner lease was rejected.')
          cancelled = heartbeat.cancel_requested === true
          return cancelled
        })
        .finally(() => {
          heartbeatPromise = undefined
        })
    }
    return heartbeatPromise
  }

  if (cancelled) {
    await client.cancelled(sequence++)
    return {
      attempt: binding.attempt,
      contentIds: [],
      itemCount: 0,
      operation: production.operation,
      providerRunId: binding.providerRunId,
      runId: binding.runId,
      status: 'cancelled',
      template: production.template,
    }
  }

  const config = createCrawlerConfig(context, environment)
  const adapter = production.template === 'movie'
    ? createMovieAdapter({ ...GITHUB_ACTIONS_CONFIG, ...config } as JavBusCrawlerConfig, dependencies.executeMovie)
    : createMangaAdapter(config, dependencies.executeManga)
  try {
    // Dispatch claim leaves the run in dispatching; heartbeat first to enter running before log/progress events.
    if (await checkpoint()) {
      await client.cancelled(sequence++)
      return {
        attempt: binding.attempt,
        contentIds: [],
        itemCount: 0,
        operation: production.operation,
        providerRunId: binding.providerRunId,
        runId: binding.runId,
        status: 'cancelled',
        template: production.template,
      }
    }
    await client.log(sequence++, 'production crawler started')
    const heartbeatTimer = setInterval(() => {
      void checkpoint().catch((error: unknown) => {
        heartbeatFailure ??= error
      })
    }, PRODUCTION_HEARTBEAT_INTERVAL_MS)
    let result: AdapterExecutionResult
    try {
      result = await adapter.execute({
        candidate: {
          attempt: binding.attempt,
          runId: binding.runId,
          sequence: 0,
          snapshot: {
            entrypoint: production.template === 'movie' ? 'movie-crawler' : 'manga-crawler',
            permissionResource: production.template === 'movie' ? 'movie' : 'comic',
            templateKey: production.template,
            templateVersion: 1,
          },
        },
        checkpoint,
        observe: observeContentId,
      })
    }
    finally {
      clearInterval(heartbeatTimer)
      if (heartbeatPromise) {
        try {
          await heartbeatPromise
        }
        catch (error: unknown) {
          heartbeatFailure ??= error
        }
      }
    }
    if (heartbeatFailure)
      throw heartbeatFailure
    for (const contentId of result.contentIds) observeContentId(contentId)
    await client.progress(sequence++, { observed: contentIds.size })
    if (await checkpoint()) {
      await client.cancelled(sequence++)
      return {
        attempt: binding.attempt,
        contentIds: [...contentIds],
        itemCount: contentIds.size,
        operation: production.operation,
        providerRunId: binding.providerRunId,
        runId: binding.runId,
        status: 'cancelled',
        template: production.template,
      }
    }
    if (contentIds.size === 0) {
      await client.failed(sequence++, 'receipt_missing')
      terminalEmitted = true
      throw new Error('target-crawl-mutation rejected an empty production receipt.')
    }
    const terminal = await client.succeeded(sequence++, [...contentIds], { createdCount: contentIds.size })
    if (!terminal.accepted)
      throw new Error('target-crawl-mutation rejected an unvalidated production receipt.')
    return {
      attempt: binding.attempt,
      contentIds: [...contentIds],
      itemCount: contentIds.size,
      operation: production.operation,
      providerRunId: binding.providerRunId,
      runId: binding.runId,
      status: 'succeeded',
      template: production.template,
    }
  }
  catch (error) {
    console.error(`Production crawler diagnostic: ${productionErrorDiagnostic(error, environment)}`)
    if (!terminalEmitted) {
      try {
        await client.progress(sequence++, { observed: contentIds.size })
        await client.failed(sequence++, contentIds.size > 0 ? 'partial_ingest' : 'crawler_failed')
      }
      catch {
        // The Actions API owns the durable audit trail. Never expose crawler errors while reporting it.
      }
    }
    throw new Error('Production crawler operation failed.')
  }
}

export async function runTargetCrawlerMutation(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: TargetCrawlerMutationDependencies = {},
): Promise<Awaited<ReturnType<typeof runDataChainFixture>> | ProductionCrawlerResult | void> {
  const contextPath = environment.STARYE_PREPARED_CONTEXT_PATH
  const entry = environment.STARYE_PREPARED_ENTRY
  const operation = environment.STARYE_PREPARED_OPERATION
  if (!contextPath || !entry?.startsWith('crawler-') || !operation) {
    throw new Error('target-crawl-mutation requires a registry-owned prepared context.')
  }
  if (!path.isAbsolute(contextPath) || !path.basename(contextPath).startsWith('prepared-context.')) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context path.')
  }
  const context = JSON.parse(await readFile(contextPath, 'utf8')) as unknown
  if (!isPreparedCrawlerContext(context, contextPath)) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  const production = productionOperation(entry, operation)
  if (production) {
    if (environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
      throw new Error('target-crawl-mutation rejected an invalid prepared context.')
    }
    return runProductionCrawlerMutation(context, environment, production, dependencies)
  }
  if (entry === 'crawler-actor' && operation === 'actor') {
    return runActorCrawlerMutation(context, environment, dependencies)
  }
  if (entry === 'crawler-backfill-covers' && operation === 'backfill-covers') {
    return runBackfillCoversMutation(context, environment, dependencies)
  }
  if (entry === 'crawler-check-config' && operation === 'check-config') {
    console.log(JSON.stringify(redactedDiagnostic(environment)))
    return
  }
  if (entry !== 'crawler-smoke-fixture' || operation !== 'smoke-fixture') {
    throw new Error('target-crawl-mutation requires the registry-owned smoke operation.')
  }
  if (environment.STARYE_PREPARED_SECRET_KEYS !== 'CRAWLER_SECRET' || !environment.CRAWLER_SECRET) {
    throw new Error('target-crawl-mutation rejected the declared smoke credential boundary.')
  }
  if (environment.STARYE_API_CONFIG_PATH !== context.apiConfigPath || environment.STARYE_GATEWAY_CONFIG_PATH !== context.gatewayConfigPath) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  if (typeof context.smokeItemCode !== 'string' || !context.smokeItemCode.trim()) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }
  if (context.smokeItemCode !== createDataChainFixture({ targetId: context.targetId, runId: context.runId }).code) {
    throw new Error('target-crawl-mutation rejected an invalid prepared context.')
  }

  const createApiClient = dependencies.createApiClient ?? (config => new ApiClient(config))
  return runDataChainFixture({
    targetId: context.targetId,
    runId: context.runId,
    apiClient: createApiClient({
      url: context.identity.apiUrl,
      token: environment.CRAWLER_SECRET,
      timeout: 60000,
    }),
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runTargetCrawlerMutation().then((result) => {
    if (result) {
      console.log(JSON.stringify(result))
    }
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
