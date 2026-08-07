import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerView from '../Player.vue'

const {
  routeState,
  pushMock,
  backMock,
  getMovieDetailMock,
  getWatchingProgressMock,
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
  trackViewMock: vi.fn(),
  addMagnetTaskMock: vi.fn(),
  resolveTrustedOriginsMock: vi.fn(),
  xgPlayerCtor: vi.fn(),
  playerInstances: [] as Array<{
    handlers: Record<string, () => void>
    currentTime: number
    duration: number
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
})
