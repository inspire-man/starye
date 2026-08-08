import type {
  PlaybackEvidenceRequest,
  PlaybackEvidenceSummary,
} from '../apps/api/src/domain/playback-evidence/types'
import type { TargetResolution } from '../packages/config/src/deployment-target/target-resolver'
import type { Phase24ApiRequestContext, Phase24ApiResponse, Phase24BrowserContext, Phase24BrowserSession, Phase24Locator, Phase24Page, Phase24ProofDependencies, Phase24ProofInput } from './phase24-production-proof'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildPhase24EvidencePair } from './phase24-evidence'
import {

  Phase24ProofCheckpointError,
  runPhase24ProductionProof,
} from './phase24-production-proof'

type ViewerMode = 'accepted' | 'media-error' | 'delta-short'
type ResponseKind = 'accepted' | 'failed' | 'duplicate' | 'conflict' | 'stale' | 'late'

interface FakeEnvironmentOptions {
  readonly freshTaskId?: string
  readonly responseKind?: ResponseKind
  readonly viewerMode?: ViewerMode
  readonly visiblePlay?: boolean
}

interface FakeEnvironment {
  readonly freshTaskId: string
  readonly responseKind: ResponseKind
  readonly viewerMode: ViewerMode
  readonly visiblePlay: boolean
  dashboardFresh: boolean
  confirmOpen: boolean
  now: number
  postedRequest: PlaybackEvidenceRequest | null
  summary: PlaybackEvidenceSummary | null
}

const roots: string[] = []

const selectedTarget = {
  id: 'selected-target',
  profile: {},
} as unknown as TargetResolution

function createEnvironment(options: FakeEnvironmentOptions = {}): FakeEnvironment {
  return {
    confirmOpen: false,
    dashboardFresh: false,
    freshTaskId: options.freshTaskId ?? 'fresh-task',
    now: 0,
    postedRequest: null,
    responseKind: options.responseKind ?? 'accepted',
    summary: null,
    viewerMode: options.viewerMode ?? 'accepted',
    visiblePlay: options.visiblePlay ?? true,
  }
}

function focalText(environment: FakeEnvironment): string {
  const taskId = environment.dashboardFresh ? environment.freshTaskId : 'old-task'
  const runId = environment.dashboardFresh ? 'fresh-run' : 'old-run'
  const attempt = environment.dashboardFresh ? 2 : 1
  return `Movie 24\nmovie movie-24 · MOVIE-24\nrepair_players\ntask ${taskId}\nrun ${runId}\nattempt #${attempt}`
}

function taskDetail(environment: FakeEnvironment): Record<string, unknown> {
  const run = {
    attemptNumber: 2,
    id: 'fresh-run',
    provider: {
      provider: 'github-actions',
      providerConclusion: 'success',
      providerRunId: 'provider-run-24',
      providerStatus: 'completed',
    },
    receipt: { movieId: 'movie-24', sourceRevision: 4 },
    receiptValidation: { status: 'validated' },
    repair: { status: 'validated' },
    sourceReadback: { sourceRevision: 4 },
    sourceRevision: 4,
    status: 'succeeded',
  }
  return {
    ...(environment.summary
      ? { playbackEvidence: { current: { summary: environment.summary }, history: [] } }
      : {}),
    currentAttempt: run,
    runs: [run],
    task: {
      id: environment.freshTaskId,
      latestRunId: 'fresh-run',
      movie: { code: 'MOVIE-24', id: 'movie-24', title: 'Movie 24' },
      operation: 'repair_players',
      source: { disposition: 'ready', sourceRevision: 4 },
      sourceRevision: 4,
    },
  }
}

class FakeResponse implements Phase24ApiResponse {
  constructor(
    private readonly responseStatus: number,
    private readonly responseBody: unknown,
  ) {}

  readonly json = async <T = unknown>(): Promise<T> => this.responseBody as T

  readonly status = (): number => this.responseStatus
}

class FakeApi implements Phase24ApiRequestContext {
  constructor(private readonly environment: FakeEnvironment) {}

  readonly get = async (_url: string): Promise<Phase24ApiResponse> => new FakeResponse(200, taskDetail(this.environment))

  readonly post = async (_url: string, options: { readonly data: unknown }): Promise<Phase24ApiResponse> => {
    this.environment.postedRequest = options.data as PlaybackEvidenceRequest
    if (this.environment.responseKind === 'accepted') {
      this.environment.summary = buildPhase24EvidencePair({
        ...this.environment.postedRequest,
        outcome: 'accepted',
      }).summary
    }
    return new FakeResponse(200, { kind: this.environment.responseKind })
  }
}

type FakeLocatorKind
  = | 'actual-playback'
    | 'card'
    | 'cards'
    | 'confirm'
    | 'container'
    | 'current-after'
    | 'current-before'
    | 'current-delta'
    | 'direct-group'
    | 'event'
    | 'focal'
    | 'panel'
    | 'player-play'
    | 'readiness'
    | 'repair-open'
    | 'source-attempt'
    | 'source-attempts'
    | 'source-card'
    | 'source-play'
    | 'status'
    | 'unknown'

class FakePageState {
  readonly environment: FakeEnvironment
  readonly api: FakeApi
  currentUrl = 'http://localhost:8080/dashboard/crawlers'
  sourcePlayClicked = false
  playerPlayClicked = false

  constructor(environment: FakeEnvironment) {
    this.environment = environment
    this.api = new FakeApi(environment)
  }
}

class FakeLocator implements Phase24Locator {
  constructor(
    private readonly page: FakePageState,
    private readonly kind: FakeLocatorKind,
    private readonly eventName?: string,
  ) {}

  readonly click = async (): Promise<void> => {
    if (this.kind === 'card')
      return
    if (this.kind === 'repair-open') {
      this.page.environment.confirmOpen = true
      return
    }
    if (this.kind === 'confirm') {
      this.page.environment.dashboardFresh = true
      return
    }
    if (this.kind === 'source-play') {
      this.page.sourcePlayClicked = true
      return
    }
    if (this.kind === 'player-play')
      this.page.playerPlayClicked = true
  }

  readonly count = async (): Promise<number> => {
    if (this.kind === 'cards' || this.kind === 'card' || this.kind === 'direct-group' || this.kind === 'source-card' || this.kind === 'source-attempts' || this.kind === 'source-attempt' || this.kind === 'event')
      return 1
    return 1
  }

  readonly filter = (_options: { readonly hasText?: string | RegExp }): Phase24Locator => this

  readonly first = (): Phase24Locator => this

  readonly getAttribute = async (name: string): Promise<string | null> => {
    if (this.kind === 'container' && name === 'data-autoplay')
      return 'false'
    if (this.kind === 'source-card') {
      const values: Record<string, string> = {
        'data-content-id': 'movie-24',
        'data-source-revision': '4',
        'data-source-type': 'direct',
      }
      return values[name] ?? null
    }
    if (this.kind === 'event' && name === 'data-observed')
      return this.eventObserved() ? 'true' : 'false'
    if (this.kind === 'current-before' && name === 'data-current-time-before')
      return this.page.environment.viewerMode === 'delta-short' ? '0' : '0'
    if (this.kind === 'current-after' && name === 'data-current-time-after') {
      if (this.page.environment.viewerMode === 'media-error')
        return 'pending'
      return this.page.environment.viewerMode === 'delta-short' ? '0.5' : '1.5'
    }
    if (this.kind === 'current-delta' && name === 'data-current-time-delta') {
      if (this.page.environment.viewerMode === 'media-error')
        return 'pending'
      return this.page.environment.viewerMode === 'delta-short' ? '0.5' : '1.5'
    }
    return null
  }

  readonly isVisible = async (): Promise<boolean> => {
    if (this.kind === 'confirm')
      return this.page.environment.confirmOpen
    if (this.kind === 'player-play')
      return this.page.environment.visiblePlay
    if (this.kind === 'actual-playback')
      return this.page.environment.summary !== null
    return true
  }

  readonly textContent = async (): Promise<string | null> => {
    if (this.kind === 'cards' || this.kind === 'card')
      return this.page.environment.dashboardFresh ? `${this.page.environment.freshTaskId}\nMovie 24` : 'old-task\nMovie 24'
    if (this.kind === 'focal')
      return focalText(this.page.environment)
    if (this.kind === 'event')
      return `${this.eventName} observed at 100ms`
    if (this.kind === 'source-attempt' || this.kind === 'source-attempts')
      return 'direct · attempt 2 · retry 0/1 · progressed'
    if (this.kind === 'status')
      return this.page.environment.viewerMode === 'media-error' ? '播放失败' : '播放已开始'
    if (this.kind === 'actual-playback')
      return this.page.environment.summary ? JSON.stringify(this.page.environment.summary) : null
    return ''
  }

  readonly locator = (selector: string): Phase24Locator => {
    if (this.kind === 'direct-group' && selector === '[data-source-card]')
      return new FakeLocator(this.page, 'source-card')
    if (this.kind === 'source-card' && selector === '[data-source-action="play"]')
      return new FakeLocator(this.page, 'source-play')
    return new FakeLocator(this.page, 'unknown')
  }

  readonly nth = (_index: number): Phase24Locator => this

  private eventObserved(): boolean {
    if (this.page.environment.viewerMode === 'media-error')
      return this.eventName === 'canplay' || this.eventName === 'error'
    return this.eventName === 'canplay' || this.eventName === 'playing'
  }
}

class FakePage implements Phase24Page {
  constructor(
    private readonly state: FakePageState,
    private readonly kind: 'dashboard' | 'viewer',
  ) {}

  readonly getByRole = (_role: 'button' | 'link', options: { readonly name: string | RegExp }): Phase24Locator => {
    if (String(options.name) === '确认恢复可播放源')
      return new FakeLocator(this.state, 'confirm')
    return new FakeLocator(this.state, 'unknown')
  }

  readonly goto = async (url: string): Promise<void> => {
    this.state.currentUrl = url
  }

  readonly locator = (selector: string): Phase24Locator => {
    const exact: Record<string, FakeLocatorKind> = {
      '#player-container': 'container',
      '.local-task-panel': 'panel',
      '.task-card': 'cards',
      '[data-current-attempt-focal]': 'focal',
      '[data-current-time-after]': 'current-after',
      '[data-current-time-before]': 'current-before',
      '[data-current-time-delta]': 'current-delta',
      '[data-evidence-block="actual-playback"]': 'actual-playback',
      '[data-player-action="play"]': 'player-play',
      '[data-playback-status]': 'status',
      '[data-readiness-summary]': 'readiness',
      '[data-repair-action="open"]': 'repair-open',
      '[data-source-attempt-row]': 'source-attempts',
      '[data-source-group="eligible-direct"]': 'direct-group',
    }
    if (selector.startsWith('[data-playback-event="')) {
      const eventName = selector.match(/data-playback-event="([^"]+)"/u)?.[1]
      return new FakeLocator(this.state, 'event', eventName)
    }
    if (selector === '[data-source-card]')
      return new FakeLocator(this.state, 'source-card')
    return new FakeLocator(this.state, exact[selector] ?? 'unknown')
  }

  readonly reload = async (): Promise<void> => undefined

  readonly url = (): string => this.state.currentUrl

  readonly waitForLoadState = async (): Promise<void> => undefined

  readonly waitForTimeout = async (timeout: number): Promise<void> => {
    this.state.environment.now += timeout
  }
}

function createSession(environment: FakeEnvironment): Phase24BrowserSession {
  const state = new FakePageState(environment)
  const context: Phase24BrowserContext = {
    newPage: async () => new FakePage(state, 'viewer'),
    request: state.api,
  }
  return {
    context,
    dashboardPage: new FakePage(state, 'dashboard'),
  }
}

function inputFor(root: string): Phase24ProofInput {
  return {
    cdpUrl: 'http://127.0.0.1:9222',
    evidenceRoot: root,
    movieCode: 'MOVIE-24',
    pollIntervalMs: 100,
    target: 'selected-target',
    timeoutMs: 100,
  }
}

async function runFixture(options: FakeEnvironmentOptions = {}): Promise<{ environment: FakeEnvironment, result: Awaited<ReturnType<typeof runPhase24ProductionProof>>, root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'phase24-production-proof-'))
  roots.push(root)
  const environment = createEnvironment(options)
  const dependencies: Phase24ProofDependencies = {
    browserFactory: async () => createSession(environment),
    now: () => environment.now,
    resolveTarget: () => selectedTarget,
    sleep: async (milliseconds) => {
      environment.now += milliseconds
    },
  }
  const result = await runPhase24ProductionProof(inputFor(root), dependencies)
  return { environment, result, root }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('phase24 production proof', () => {
  it.each([
    ['missing target', { target: '' }],
    ['missing evidence root', { evidenceRoot: 'relative-evidence-root' }],
  ])('%s remains a checkpoint', async (_label, override) => {
    const root = await mkdtemp(join(tmpdir(), 'phase24-production-precondition-'))
    roots.push(root)
    const input = { ...inputFor(root), ...override } as Phase24ProofInput
    const result = await runPhase24ProductionProof(input, { resolveTarget: () => selectedTarget })

    expect(result.outcome).toBe('checkpoint')
    expect(result.matrixPath).toBeUndefined()
  })

  it('treats a missing authenticated session as a checkpoint', async () => {
    const root = await mkdtemp(join(tmpdir(), 'phase24-production-session-'))
    roots.push(root)
    const result = await runPhase24ProductionProof(inputFor(root), {
      browserFactory: async () => {
        throw new Phase24ProofCheckpointError('authenticated browser context request boundary is unavailable')
      },
      resolveTarget: () => selectedTarget,
    })

    expect(result.outcome).toBe('checkpoint')
    expect(result.reason).toContain('authenticated browser context')
    expect(result.matrixPath).toBeDefined()
  })

  it('stops at checkpoint when the visible Player Play control is missing', async () => {
    const { result, environment } = await runFixture({ visiblePlay: false })

    expect(result.outcome).toBe('checkpoint')
    expect(result.reason).toContain('visible Play control')
    expect(environment.postedRequest).toBeNull()
  })

  it('records a media terminal error as failed evidence', async () => {
    const { result, environment } = await runFixture({ responseKind: 'failed', viewerMode: 'media-error' })

    expect(result.outcome).toBe('failed')
    expect(result.layers.playback).toBe('failed')
    expect(environment.postedRequest?.tuple.taskId).toBe('fresh-task')
    expect(result.artifactJsonPath).toBeDefined()
    const artifact = JSON.parse(await readFile(result.artifactJsonPath!, 'utf8')) as Record<string, unknown>
    expect(artifact.outcome).toBe('failed')
  })

  it('records a sub-second currentTime delta as failed evidence', async () => {
    const { result } = await runFixture({ responseKind: 'failed', viewerMode: 'delta-short' })

    expect(result.outcome).toBe('failed')
    expect(result.reason).toContain('failed')
    expect(result.layers.playback).toBe('failed')
  })

  it('passes one fresh tuple through artifact, D1, and Dashboard trace equality', async () => {
    const { result, environment } = await runFixture()

    expect(result.outcome).toBe('passed')
    expect(result.tuple).toEqual({ attemptNumber: 2, provider: 'github-actions', runId: 'fresh-run', taskId: 'fresh-task' })
    expect(result.layers).toEqual({ playback: 'passed', provider: 'passed', receipt: 'passed', repair: 'passed', source: 'passed' })
    expect(result.checks).toMatchObject({ artifact: 'passed', dashboardSession: 'passed', dashboardTrace: 'passed', d1: 'passed', evidenceRoot: 'passed', runAllocation: 'passed', selectedTarget: 'passed', viewer: 'passed' })
    expect(environment.postedRequest?.tuple).toEqual(result.tuple)
    expect(result.artifactJsonPath).toBeDefined()
    expect(result.artifactMarkdownPath).toBeDefined()
    expect(result.matrixPath).toBeDefined()
    expect(JSON.parse(await readFile(result.artifactJsonPath!, 'utf8'))).toMatchObject({ outcome: 'accepted', tuple: result.tuple })
    expect(await readFile(result.artifactMarkdownPath!, 'utf8')).toContain('currentTimeDelta')
  })

  it.each(['duplicate', 'conflict', 'stale', 'late'] as const)('keeps %s endpoint rejection as a checkpoint', async (responseKind) => {
    const { result, environment } = await runFixture({ responseKind })

    expect(result.outcome).toBe('checkpoint')
    expect(result.reason).toContain(responseKind)
    expect(result.artifactJsonPath).toBeDefined()
    expect(environment.postedRequest?.tuple.taskId).toBe('fresh-task')
  })

  it('excludes a Phase 13 carrier from the fresh tuple gate', async () => {
    const { result } = await runFixture({ freshTaskId: 'phase13-task' })

    expect(result.outcome).toBe('checkpoint')
    expect(result.reason).toContain('Phase 13')
    expect(result.artifactJsonPath).toBeNull()
  })
})
