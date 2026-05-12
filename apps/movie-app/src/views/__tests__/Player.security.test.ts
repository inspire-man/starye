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
    this.on = vi.fn()
    this.destroy = vi.fn()
    this.currentTime = 0
    this.duration = 0
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
})
