import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MovieDetail from '../MovieDetail.vue'

const { getMovieDetailMock, routeState } = vi.hoisted(() => ({
  getMovieDetailMock: vi.fn(),
  routeState: { params: { code: 'TEST-001' } },
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
  useRoute: () => routeState,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('qrcode.vue', () => ({
  default: { name: 'QrcodeVue', template: '<div />' },
}))

vi.mock('../../components/RatingStars.vue', () => ({
  default: { name: 'RatingStars', template: '<div />' },
}))

vi.mock('../../lib/api-client', () => ({
  movieApi: { getMovieDetail: getMovieDetailMock },
  ratingApi: { submitPlayerRating: vi.fn() },
}))

vi.mock('../../stores/user', () => ({
  useUserStore: () => ({ user: null, loading: false }),
}))

vi.mock('../../composables/useDownloadList', () => ({
  useDownloadList: () => ({ isInDownloadList: () => false, addToDownloadList: vi.fn() }),
}))

vi.mock('../../composables/useFavorites', () => ({
  useFavorites: () => ({
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
    checkIsFavorited: vi.fn(),
  }),
}))

vi.mock('../../composables/useRating', () => ({
  useRating: () => ({ getPlayerRating: vi.fn() }),
}))

vi.mock('../../composables/useAria2', () => ({
  useAria2: () => ({ isConnected: { value: false }, addMagnetTask: vi.fn() }),
}))

vi.mock('../../composables/useTorrServer', () => ({
  useTorrServer: () => ({
    isConnected: { value: false },
    streamMagnet: vi.fn(),
    buildStreamForFile: vi.fn(),
  }),
}))

vi.mock('../../composables/useAuthGuard', () => ({
  useAuthGuard: () => ({ requireLogin: () => true }),
}))

describe('movie detail DOM tuple contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMovieDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: 'movie-uuid-1',
        code: 'TEST-001',
        title: 'Tuple Contract Movie',
        isR18: false,
        players: [],
      },
    })
  })

  it('renders the loaded item tuple on the element that displays its code', async () => {
    const wrapper = mount(MovieDetail)
    await flushPromises()

    expect(getMovieDetailMock).toHaveBeenCalledWith('TEST-001')
    expect(routeState.params).toEqual({ code: 'TEST-001' })
    expect(wrapper.get('[data-phase13-item-code="TEST-001"][data-phase13-item-id="movie-uuid-1"]').text()).toBe('TEST-001')
  })

  it('does not manufacture an identity marker while loading or after a detail error', async () => {
    getMovieDetailMock.mockImplementation(() => new Promise(() => {}))
    const loadingWrapper = mount(MovieDetail)
    await flushPromises()

    expect(loadingWrapper.find('[data-phase13-item-code]').exists()).toBe(false)
    loadingWrapper.unmount()

    getMovieDetailMock.mockRejectedValueOnce(new Error('detail unavailable'))
    const errorWrapper = mount(MovieDetail)
    await flushPromises()

    expect(errorWrapper.find('[data-phase13-item-code]').exists()).toBe(false)
  })

  it('renders the server-owned no-source readiness summary and repair actions', async () => {
    getMovieDetailMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'movie-sun-064',
        primaryContentId: 'movie-sun-064',
        code: 'SUN-064',
        title: 'SUN-064',
        isR18: false,
        players: [],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-sun-064', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-sun-064', schemaVersion: 2 },
          source: {
            disposition: 'no_source',
            eligibleCount: 0,
            observedAt: 100,
            reasonCode: 'no_eligible_source',
            repairable: true,
            sourceRevision: 4,
          },
        },
      },
    })

    const wrapper = mount(MovieDetail)
    await flushPromises()
    const summary = wrapper.get('[data-readiness-summary]')

    expect(summary.text()).toContain('内容身份')
    expect(summary.text()).toContain('movie-sun-064')
    expect(summary.text()).toContain('Metadata persisted')
    expect(summary.text()).toContain('no_source')
    expect(summary.text()).toContain('暂无可用播放源')
    expect(summary.text()).toContain('eligible count：0')
    expect(summary.text()).toContain('可修复')
    expect(summary.text()).toContain('Playback proof')
    expect(summary.text()).toContain('播放未验证')
    expect(summary.text()).toContain('Receipt/source summary')
    expect(summary.text()).toContain('查看修复意图')
    expect(summary.text()).toContain('重试读取')
    expect(wrapper.text()).not.toContain('▶️ 播放')
  })

  it.each([
    ['source_failed', '重试读取', '播放未验证'],
    ['repairing', '刷新状态', '播放未验证'],
    ['ready', '查看影片', '播放已验证'],
  ] as const)('renders %s and independent playback proof labels from DTO fields', async (disposition, action, playbackLabel) => {
    getMovieDetailMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: `movie-${disposition}`,
        primaryContentId: `movie-${disposition}`,
        code: `CODE-${disposition}`,
        title: 'Readiness state fixture',
        isR18: false,
        players: [],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: `movie-${disposition}`, observedAt: 100, persisted: true },
          playback: { status: disposition === 'ready' ? 'playback_verified' : 'unverified', evidence: disposition === 'ready' ? { currentTime: 12, observedAt: 101 } : undefined },
          receipt: { persisted: true, primaryContentId: `movie-${disposition}`, schemaVersion: 2 },
          source: {
            disposition,
            eligibleCount: disposition === 'ready' ? 1 : 0,
            observedAt: 100,
            reasonCode: disposition === 'ready' ? null : disposition === 'repairing' ? 'repair_requested' : 'source_read_failed',
            repairable: disposition !== 'ready',
            sourceRevision: 5,
          },
        },
      },
    })

    const wrapper = mount(MovieDetail)
    await flushPromises()

    expect(wrapper.get('[data-readiness-summary]').text()).toContain(disposition)
    expect(wrapper.get('[data-readiness-summary]').text()).toContain(action)
    expect(wrapper.get('[data-readiness-summary]').text()).toContain(playbackLabel)
    if (disposition === 'repairing')
      expect(wrapper.get('[data-readiness-action="refresh"]').attributes('disabled')).toBeDefined()
  })
})
