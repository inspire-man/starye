import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerView from '../Player.vue'

const {
  routeState,
  pushMock,
  backMock,
  getMovieDetailMock,
  getWatchingProgressMock,
  submitPlaybackEvidenceMock,
  trackViewMock,
  addMagnetTaskMock,
  resolveTrustedOriginsMock,
  xgPlayerCtor,
  playerInstances,
} = vi.hoisted(() => ({
  routeState: {
    params: { code: 'REBD-1024' },
    query: { streamUrl: 'http://127.0.0.1:8090/stream/video?link=magnet%3Aabc&index=0&play=' },
  },
  pushMock: vi.fn(),
  backMock: vi.fn(),
  getMovieDetailMock: vi.fn(),
  getWatchingProgressMock: vi.fn(),
  submitPlaybackEvidenceMock: vi.fn(),
  trackViewMock: vi.fn(),
  addMagnetTaskMock: vi.fn(),
  resolveTrustedOriginsMock: vi.fn(),
  xgPlayerCtor: vi.fn(),
  playerInstances: [] as Array<{
    handlers: Record<string, () => void>
    currentTime: number
    duration: number
    play: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
  },
  useRoute: () => routeState,
  useRouter: () => ({
    push: pushMock,
    back: backMock,
  }),
}))

vi.mock('xgplayer', () => ({
  default: function MockXgPlayer(this: any, options: unknown) {
    xgPlayerCtor(options)
    const handlers: Record<string, () => void> = {}
    this.handlers = handlers
    this.on = vi.fn((event: string, handler: () => void) => {
      handlers[event] = handler
    })
    this.destroy = vi.fn()
    this.play = vi.fn(() => Promise.resolve())
    this.currentTime = 0
    this.duration = 0
    playerInstances.push(this)
  },
}))

vi.mock('../../composables/useAria2', () => ({
  useAria2: () => ({
    isConnected: { value: false },
    addMagnetTask: addMagnetTaskMock,
  }),
}))

vi.mock('../../lib/api-client', () => ({
  movieApi: {
    getMovieDetail: getMovieDetailMock,
    submitPlaybackEvidence: submitPlaybackEvidenceMock,
    trackView: trackViewMock,
  },
  progressApi: {
    getWatchingProgress: getWatchingProgressMock,
  },
}))

vi.mock('../../stores/user', () => ({
  useUserStore: () => ({
    user: null,
  }),
}))

vi.mock('../../utils/playerSecurity', async () => {
  const actual = await vi.importActual<typeof import('../../utils/playerSecurity')>('../../utils/playerSecurity')
  return {
    ...actual,
    resolveTrustedTorrServerOrigins: resolveTrustedOriginsMock,
  }
})

describe('player.vue security gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    playerInstances.length = 0
    routeState.params.code = 'REBD-1024'
    routeState.query = {
      streamUrl: 'http://127.0.0.1:8090/stream/video?link=magnet%3Aabc&index=0&play=',
    }
    resolveTrustedOriginsMock.mockResolvedValue(['http://127.0.0.1:8090'])
    getWatchingProgressMock.mockResolvedValue({ success: true, data: null })
    submitPlaybackEvidenceMock.mockResolvedValue({ kind: 'accepted' })
  })

  it('详情接口拒绝访问时，不应初始化播放器或上报 view', async () => {
    getMovieDetailMock.mockRejectedValue(new Error('需要 R18 访问权限'))

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(wrapper.text()).toContain('需要 R18 访问权限')
    expect(xgPlayerCtor).not.toHaveBeenCalled()
    expect(trackViewMock).not.toHaveBeenCalled()
  })

  it('streamUrl 不可信时，不应初始化播放器或上报 view', async () => {
    routeState.query = {
      streamUrl: 'http://evil.example.com/stream/video?link=magnet%3Aabc&index=0&play=',
    }
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: '测试影片',
        players: [],
        relatedMovies: [],
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(wrapper.text()).toContain('当前播放链接不受信任')
    expect(xgPlayerCtor).not.toHaveBeenCalled()
    expect(trackViewMock).not.toHaveBeenCalled()
  })

  it('streamUrl 合法且详情可访问时，才初始化播放器并上报 view', async () => {
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: '测试影片',
        players: [
          { sourceUrl: 'magnet:?xt=urn:btih:123' },
        ],
        relatedMovies: [],
      },
    })

    mount(PlayerView)
    await flushPromises()

    expect(xgPlayerCtor).toHaveBeenCalledOnce()
    expect(trackViewMock).toHaveBeenCalledWith('REBD-1024')
  })

  it('standard Player no-source guard runs before constructor and view tracking', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'SUN-064',
        players: [],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-sun-064', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-sun-064', schemaVersion: 2 },
          source: { disposition: 'no_source', eligibleCount: 0, observedAt: 100, reasonCode: 'no_eligible_source', repairable: true, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(wrapper.text()).toContain('暂无可用播放源')
    expect(wrapper.text()).toContain('返回影片详情')
    expect(xgPlayerCtor).not.toHaveBeenCalled()
    expect(trackViewMock).not.toHaveBeenCalled()
  })

  it('standard Player blocks all-inactive sources even when the readiness count is stale', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'Inactive source fixture',
        players: [{ id: 'inactive-1', sourceUrl: 'https://media.example/video.mp4', isActive: false }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-inactive', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-inactive', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(wrapper.text()).toContain('暂无可用播放源')
    expect(xgPlayerCtor).not.toHaveBeenCalled()
    expect(trackViewMock).not.toHaveBeenCalled()
  })

  it('standard Player blocks source readback failure before constructor and view tracking', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'Source failure fixture',
        players: [{ id: 'failed-1', sourceUrl: 'https://media.example/video.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-failed', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-failed', schemaVersion: 2 },
          source: { disposition: 'source_failed', eligibleCount: 0, observedAt: 100, reasonCode: 'source_read_failed', repairable: true, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(wrapper.text()).toContain('暂无可用播放源')
    expect(xgPlayerCtor).not.toHaveBeenCalled()
    expect(trackViewMock).not.toHaveBeenCalled()
  })

  it('standard Player ready gate permits constructor only with an eligible source', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'Ready source fixture',
        players: [{ id: 'ready-1', sourceUrl: 'https://media.example/video.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-ready', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-ready', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 4 },
        },
      },
    })

    mount(PlayerView)
    await flushPromises()

    expect(xgPlayerCtor).toHaveBeenCalledOnce()
    expect(trackViewMock).toHaveBeenCalledWith('REBD-1024')
  })

  it('standard Player selects the first eligible direct source in server order', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'Direct-first source fixture',
        players: [
          { id: 'magnet-high', sourceName: '高分磁力', sourceUrl: 'magnet:?xt=urn:btih:high', isActive: true, averageRating: 5 },
          { id: 'inactive-direct', sourceName: '失效直连', sourceUrl: 'https://inactive.example/video', isActive: false },
          { id: 'direct-first', sourceName: '服务端首个直连', sourceUrl: 'https://media.example/first.mp4', isActive: true },
          { id: 'direct-second', sourceName: '服务端第二个直连', sourceUrl: 'https://media.example/second.mp4', isActive: true },
        ],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-direct-first', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-direct-first', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 3, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(xgPlayerCtor).toHaveBeenCalledOnce()
    expect(xgPlayerCtor.mock.calls[0][0]).toMatchObject({ url: 'https://media.example/first.mp4' })
    expect(wrapper.text()).not.toContain('当前播放源不可直接播放')
    wrapper.unmount()
  })

  it('visible Play click gates playback proof on allowlisted events and one-second progress', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: 'movie-proof',
        primaryContentId: 'movie-proof',
        title: 'Visible Play fixture',
        players: [{ id: 'direct-proof', sourceName: '直连', sourceUrl: 'https://media.example/proof.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-proof', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-proof', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 8 },
        },
        availability: {
          current: {
            direct: null,
            magnet: null,
            metadata: { observedAt: 100, persisted: true, sourceRevision: 8 },
            playback: { status: 'unverified', tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-proof', taskId: 'task-proof' } },
          },
          history: [],
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(xgPlayerCtor.mock.calls[0][0]).toMatchObject({ autoplay: false })
    expect(wrapper.get('[data-player-action="play"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-playback-status]').text()).toContain('等待用户播放')

    playerInstances[0].handlers.canplay()
    await flushPromises()
    expect(wrapper.get('[data-playback-status]').text()).toContain('可开始播放')
    expect(wrapper.get('[data-playback-event="playing"]').attributes('data-observed')).toBe('false')

    await wrapper.get('[data-player-action="play"]').trigger('click')
    expect(playerInstances[0].play).toHaveBeenCalledOnce()
    playerInstances[0].handlers.playing()
    await flushPromises()
    playerInstances[0].currentTime = 0.25
    playerInstances[0].handlers.timeupdate()
    await flushPromises()
    expect(wrapper.get('[data-playback-status]').text()).toContain('播放已开始')

    playerInstances[0].currentTime = 1.25
    playerInstances[0].handlers.timeupdate()
    await flushPromises()

    expect(wrapper.get('[data-playback-status]').text()).toContain('播放已验证')
    expect(wrapper.get('[data-current-time-before]').attributes('data-current-time-before')).toBe('0')
    expect(wrapper.get('[data-current-time-after]').attributes('data-current-time-after')).toBe('1.25')
    expect(wrapper.get('[data-current-time-delta]').attributes('data-current-time-delta')).toBe('1.25')
    expect(wrapper.get('[data-playback-event="canplay"]').attributes('data-observed')).toBe('true')
    expect(wrapper.get('[data-playback-event="playing"]').attributes('data-observed')).toBe('true')
    expect(wrapper.get('[data-playback-event="waiting"]').attributes('data-observed')).toBe('false')
    expect(wrapper.get('[data-playback-event="stalled"]').attributes('data-observed')).toBe('false')
    expect(wrapper.get('[data-playback-event="error"]').attributes('data-observed')).toBe('false')
    expect(submitPlaybackEvidenceMock).toHaveBeenCalledTimes(1)
    const submittedPayload = submitPlaybackEvidenceMock.mock.calls[0][2]
    expect(submittedPayload).toMatchObject({
      events: [
        { event: 'canplay', observed: true },
        { event: 'playing', observed: true },
        { event: 'waiting', observed: false },
        { event: 'stalled', observed: false },
        { event: 'error', observed: false },
      ],
      provider: { provider: 'github-actions', status: 'succeeded' },
      repair: { sourceRevision: 8, status: 'succeeded' },
      source: { revision: 8, sourceType: 'direct', status: 'ready' },
      viewer: { path: '/movie/REBD-1024', targetLabel: 'movie-REBD-1024' },
    })
    expect(JSON.stringify(submittedPayload)).not.toMatch(/streamUrl|sourceUrl|token|cookie|endpoint|providerConfig/u)
    expect(submitPlaybackEvidenceMock).toHaveBeenCalledWith('task-proof', 'run-proof', expect.objectContaining({
      contentId: 'movie-proof',
      sourceRevision: 8,
      tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-proof', taskId: 'task-proof' },
      playback: expect.objectContaining({ status: 'playback_verified' }),
    }))
    playerInstances[0].currentTime = 2.5
    playerInstances[0].handlers.timeupdate()
    await flushPromises()
    expect(submitPlaybackEvidenceMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('#player-container').attributes('data-content-id')).toBe('movie-proof')
    expect(wrapper.get('#player-container').attributes('data-source-revision')).toBe('8')
    wrapper.unmount()
  })

  it('does not submit without a server-owned playback tuple or positive progress', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: 'movie-no-tuple',
        primaryContentId: 'movie-no-tuple',
        title: 'No tuple fixture',
        players: [{ id: 'direct-no-tuple', sourceName: '直连', sourceUrl: 'https://media.example/no-tuple.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-no-tuple', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-no-tuple', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 2 },
        },
        availability: {
          current: {
            direct: null,
            magnet: null,
            metadata: { observedAt: 100, persisted: true, sourceRevision: 2 },
            playback: { status: 'unverified', tuple: null },
          },
          history: [],
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()
    playerInstances[0].handlers.canplay()
    await wrapper.get('[data-player-action="play"]').trigger('click')
    playerInstances[0].handlers.playing()
    playerInstances[0].currentTime = 2
    playerInstances[0].handlers.timeupdate()
    await flushPromises()

    expect(wrapper.get('[data-playback-status]').text()).toContain('播放已验证')
    expect(submitPlaybackEvidenceMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('submits TorrServer as browser evidence without exposing its local stream URL', async () => {
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: 'movie-torr',
        primaryContentId: 'movie-torr',
        title: 'TorrServer fixture',
        players: [{ id: 'magnet-torr', sourceUrl: 'magnet:?xt=urn:btih:123', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-torr', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-torr', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 5 },
        },
        availability: {
          current: {
            direct: null,
            magnet: null,
            metadata: { observedAt: 100, persisted: true, sourceRevision: 5 },
            playback: { status: 'unverified', tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-torr', taskId: 'task-torr' } },
          },
          history: [],
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()
    playerInstances[0].handlers.canplay()
    await wrapper.get('[data-player-action="play"]').trigger('click')
    playerInstances[0].handlers.playing()
    playerInstances[0].currentTime = 1.5
    playerInstances[0].handlers.timeupdate()
    await flushPromises()

    const payload = submitPlaybackEvidenceMock.mock.calls[0][2]
    expect(payload.source).toEqual({ revision: 5, sourceType: 'TorrServer', status: 'ready' })
    expect(JSON.stringify(payload)).not.toContain('127.0.0.1')
    expect(JSON.stringify(payload)).not.toContain('magnet:')
    wrapper.unmount()
  })

  it('ignores late media events from the previous player instance after retry', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: 'movie-retry-evidence',
        primaryContentId: 'movie-retry-evidence',
        title: 'Retry evidence fixture',
        players: [{ id: 'direct-retry-evidence', sourceName: '直连', sourceUrl: 'https://media.example/retry-evidence.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-retry-evidence', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-retry-evidence', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 6 },
        },
        availability: {
          current: {
            direct: null,
            magnet: null,
            metadata: { observedAt: 100, persisted: true, sourceRevision: 6 },
            playback: { status: 'unverified', tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'run-retry-evidence', taskId: 'task-retry-evidence' } },
          },
          history: [],
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()
    const oldPlayer = playerInstances[0]
    oldPlayer.handlers.error()
    await flushPromises()
    await wrapper.get('button[title="重试当前播放源"]').trigger('click')
    await flushPromises()

    oldPlayer.handlers.canplay()
    oldPlayer.handlers.playing()
    oldPlayer.currentTime = 3
    oldPlayer.handlers.timeupdate()
    await flushPromises()
    expect(submitPlaybackEvidenceMock).not.toHaveBeenCalled()

    const currentPlayer = playerInstances[1]
    currentPlayer.handlers.canplay()
    await wrapper.get('[data-player-action="play"]').trigger('click')
    currentPlayer.handlers.playing()
    currentPlayer.currentTime = 1.25
    currentPlayer.handlers.timeupdate()
    await flushPromises()
    expect(submitPlaybackEvidenceMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('terminal media error remains failed and is visible in the event timeline', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: 'movie-error',
        primaryContentId: 'movie-error',
        title: 'Terminal error fixture',
        players: [{ id: 'direct-error', sourceName: '直连', sourceUrl: 'https://media.example/error.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-error', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-error', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 3 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()
    await wrapper.get('[data-player-action="play"]').trigger('click')
    playerInstances[0].handlers.error()
    await flushPromises()

    expect(wrapper.get('[data-playback-status]').text()).toContain('播放失败')
    expect(wrapper.get('[data-playback-failure]').exists()).toBe(true)
    expect(wrapper.get('[data-playback-event="error"]').attributes('data-observed')).toBe('true')
    expect(wrapper.get('[data-playback-event="waiting"]').attributes('data-observed')).toBe('false')
    expect(wrapper.get('[data-current-time-delta]').attributes('data-current-time-delta')).toBe('pending')
    wrapper.unmount()
  })

  it('current source exhausts two retries before switching to the next eligible direct source', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: 'movie-fallback',
        primaryContentId: 'movie-fallback',
        title: 'Fallback fixture',
        players: [
          { id: 'direct-first', sourceName: '首个直连', sourceUrl: 'https://media.example/first.mp4', isActive: true },
          { id: 'direct-next', sourceName: '下一个直连', sourceUrl: 'https://media.example/next.mp4', isActive: true },
        ],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-fallback', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-fallback', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 2, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 6 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    playerInstances[0].handlers.error()
    await flushPromises()
    await wrapper.get('button[title="重试当前播放源"]').trigger('click')
    await flushPromises()
    playerInstances[1].handlers.error()
    await flushPromises()
    await wrapper.get('button[title="重试当前播放源"]').trigger('click')
    await flushPromises()
    playerInstances[2].handlers.error()
    await flushPromises()

    expect(xgPlayerCtor).toHaveBeenCalledTimes(4)
    expect(xgPlayerCtor.mock.calls[3][0]).toMatchObject({ url: 'https://media.example/next.mp4', autoplay: false })
    expect(wrapper.get('[data-source-attempt-history]').text()).toContain('direct')
    expect(wrapper.get('#player-container').attributes('data-source-player-id')).toBe('direct-next')
    wrapper.unmount()
  })

  it('rejects a stale server-owned content or source revision route context before player construction', async () => {
    routeState.query = { player: 'direct-context', contentId: 'wrong-content', sourceRevision: '99', sourceType: 'direct' }
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: 'movie-context',
        primaryContentId: 'movie-context',
        title: 'Route context fixture',
        players: [{ id: 'direct-context', sourceName: '直连', sourceUrl: 'https://media.example/context.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-context', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-context', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(wrapper.text()).toContain('server-owned 影片身份不一致')
    expect(xgPlayerCtor).not.toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('/movie/REBD-1024')
    wrapper.unmount()
  })

  it('explicit magnet player query returns to the same MovieDetail without constructing xgplayer', async () => {
    routeState.query = { player: 'magnet-1' }
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'Magnet entry fixture',
        players: [
          { id: 'direct-1', sourceName: '直连', sourceUrl: 'https://media.example/video.mp4', isActive: true },
          { id: 'magnet-1', sourceName: '磁力', sourceUrl: 'magnet:?xt=urn:btih:magnet', isActive: true },
        ],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-magnet-entry', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-magnet-entry', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 2, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(wrapper.get('[data-source-state="source-invalid"]').text()).toContain('当前播放源不可直接播放')
    expect(pushMock).toHaveBeenCalledWith('/movie/REBD-1024')
    expect(xgPlayerCtor).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('magnet-only standard selection returns to MovieDetail instead of browser playback', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'Magnet-only fixture',
        players: [{ id: 'magnet-only', sourceName: '磁力', sourceUrl: 'magnet:?xt=urn:btih:only', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-magnet-only', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-magnet-only', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    expect(wrapper.get('[data-source-state="source-invalid"]').text()).toContain('磁力来源')
    expect(pushMock).toHaveBeenCalledWith('/movie/REBD-1024')
    expect(xgPlayerCtor).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('同一 source/session 最多重试两次，达到上限后只保留切换来源动作', async () => {
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'Retry cap fixture',
        players: [{ id: 'direct-retry', sourceName: '直连', sourceUrl: 'https://media.example/retry.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-retry-cap', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-retry-cap', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()

    playerInstances[0].handlers.error()
    await flushPromises()
    await wrapper.get('button[title="重试当前播放源"]').trigger('click')
    await flushPromises()
    expect(xgPlayerCtor).toHaveBeenCalledTimes(2)

    playerInstances[1].handlers.error()
    await flushPromises()
    await wrapper.get('button[title="重试当前播放源"]').trigger('click')
    await flushPromises()
    expect(xgPlayerCtor).toHaveBeenCalledTimes(3)

    playerInstances[2].handlers.error()
    await flushPromises()
    expect(wrapper.text()).toContain('已达到 2 次重试上限')
    expect(wrapper.find('button[title="重试当前播放源"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('切换来源')
    wrapper.unmount()
  })

  it('同一 loading cycle 的 waiting timeout 与 xgplayer error 只产生一次可重试失败', async () => {
    vi.useFakeTimers()
    routeState.query = {}
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'Waiting race fixture',
        players: [{ id: 'direct-race', sourceName: '直连', sourceUrl: 'https://media.example/race.mp4', isActive: true }],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-waiting-race', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-waiting-race', schemaVersion: 2 },
          source: { disposition: 'ready', eligibleCount: 1, observedAt: 100, reasonCode: null, repairable: false, sourceRevision: 4 },
        },
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()
    playerInstances[0].handlers.waiting()
    await vi.advanceTimersByTimeAsync(10000)
    playerInstances[0].handlers.error()
    await flushPromises()

    expect(wrapper.text()).toContain('缓冲超时')
    expect(wrapper.findAll('button[title="重试当前播放源"]').length).toBe(1)
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('cold start 的 TorrServer 缓冲不会被通用超时误判为失败', async () => {
    vi.useFakeTimers()
    routeState.query = {
      streamUrl: 'http://127.0.0.1:8090/stream/video?link=magnet%3Aabc&index=0&play=',
    }
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        title: 'TorrServer cold start fixture',
        players: [{ sourceUrl: 'magnet:?xt=urn:btih:cold-start', isActive: true }],
        relatedMovies: [],
      },
    })

    const wrapper = mount(PlayerView)
    await flushPromises()
    const currentPlayer = playerInstances[0]

    await wrapper.get('[data-player-action="play"]').trigger('click')
    currentPlayer.handlers.waiting()
    await vi.advanceTimersByTimeAsync(10000)
    await flushPromises()

    expect(wrapper.get('[data-playback-status]').text()).toContain('播放准备中')
    expect(wrapper.find('[data-playback-failure]').exists()).toBe(false)

    currentPlayer.handlers.canplay()
    currentPlayer.handlers.playing()
    currentPlayer.currentTime = 1.25
    currentPlayer.handlers.timeupdate()
    await flushPromises()

    expect(wrapper.get('[data-playback-status]').text()).toContain('播放已验证')
    wrapper.unmount()
    vi.useRealTimers()
  })
})
