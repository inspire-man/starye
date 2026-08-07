import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MovieDetail from '../MovieDetail.vue'

const { getMovieDetailMock, routeState, routerPushMock } = vi.hoisted(() => ({
  getMovieDetailMock: vi.fn(),
  routeState: { params: { code: 'TEST-001' } },
  routerPushMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : undefined"><slot /></a>',
  },
  useRoute: () => routeState,
  useRouter: () => ({ push: routerPushMock }),
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
    ['no_source', '查看修复意图', '播放未验证', 'no_eligible_source'],
    ['source_failed', '重试读取', '播放未验证', 'source_read_failed'],
    ['repairing', '刷新状态', '播放未验证', 'repair_requested'],
    ['ready', '播放', '播放已验证', null],
  ] as const)('renders %s and independent playback proof labels from DTO fields', async (disposition, action, playbackLabel, reasonCode) => {
    getMovieDetailMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: `movie-${disposition}`,
        primaryContentId: `movie-${disposition}`,
        code: `CODE-${disposition}`,
        title: 'Readiness state fixture',
        isR18: false,
        players: disposition === 'ready'
          ? [{ id: 'direct-ready', movieId: `movie-${disposition}`, sourceName: 'ready direct', sourceUrl: 'https://direct.example/ready', sortOrder: 1, isActive: true }]
          : disposition === 'repairing'
            ? [{ id: 'repairing-direct', movieId: `movie-${disposition}`, sourceName: 'repairing direct', sourceUrl: 'https://direct.example/repairing', sortOrder: 1, isActive: true }]
            : [],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: `movie-${disposition}`, observedAt: 100, persisted: true },
          playback: { status: disposition === 'ready' ? 'playback_verified' : 'unverified', evidence: disposition === 'ready' ? { currentTime: 12, observedAt: 101 } : undefined },
          receipt: { persisted: true, primaryContentId: `movie-${disposition}`, schemaVersion: 2 },
          source: {
            disposition,
            eligibleCount: disposition === 'ready' ? 1 : 0,
            observedAt: 100,
            reasonCode,
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
    if (reasonCode)
      expect(wrapper.get('[data-readiness-summary]').text()).toContain(reasonCode)
    if (disposition === 'repairing') {
      expect(wrapper.get('[data-readiness-action="refresh"]').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('[data-readiness-action="play"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-source-health-row]')).toHaveLength(1)
      expect(wrapper.find('[data-source-card]').exists()).toBe(false)
      expect(wrapper.get('[data-repairing-summary]').text()).toContain('server-owned source readback')
    }
    if (disposition === 'ready')
      expect(wrapper.get('[data-readiness-action="play"]').attributes('href')).toBe('/movie/CODE-ready/play?player=direct-ready')
  })

  it('renders bounded per-source health and hands repairable state to Dashboard with the same movie identity', async () => {
    getMovieDetailMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'movie-sun-064',
        primaryContentId: 'movie-sun-064',
        code: 'SUN-064',
        title: 'SUN-064',
        isR18: false,
        players: [
          { id: 'direct-1', movieId: 'movie-sun-064', sourceName: 'direct', sourceUrl: 'RAW_SOURCE_SENTINEL', sortOrder: 1, isActive: true },
          { id: 'magnet-1', movieId: 'movie-sun-064', sourceName: 'magnet', sourceUrl: 'magnet:RAW_SOURCE_SENTINEL', sortOrder: 2, isActive: true },
          { id: 'inactive-1', movieId: 'movie-sun-064', source: 'TorrServer', sourceName: 'TorrServer', sourceUrl: 'https://raw.example/SENTINEL', sortOrder: 3, isActive: false },
        ],
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
        rawRequest: 'RAW_REQUEST_SENTINEL',
        rawException: 'RAW_EXCEPTION_SENTINEL',
        signature: 'RAW_SIGNATURE_SENTINEL',
      },
    })

    const wrapper = mount(MovieDetail)
    await flushPromises()

    expect(wrapper.findAll('[data-source-health-row]')).toHaveLength(3)
    expect(wrapper.text()).toContain('direct')
    expect(wrapper.text()).toContain('magnet')
    expect(wrapper.text()).toContain('TorrServer')
    expect(wrapper.text()).toContain('unverified')
    expect(wrapper.text()).toContain('inactive')
    expect(wrapper.text()).toContain('最近观察：100')
    expect(wrapper.text()).not.toContain('RAW_SOURCE_SENTINEL')
    expect(wrapper.text()).not.toContain('RAW_REQUEST_SENTINEL')
    expect(wrapper.text()).not.toContain('RAW_EXCEPTION_SENTINEL')
    expect(wrapper.text()).not.toContain('RAW_SIGNATURE_SENTINEL')

    await wrapper.get('[data-readiness-action="repair"]').trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith('/dashboard/crawlers?movieId=movie-sun-064&reason=no_source')
  })

  it('groups mixed sources before score sorting and keeps controlled action boundaries', async () => {
    getMovieDetailMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'movie-mixed',
        primaryContentId: 'movie-mixed',
        code: 'MIXED-001',
        title: 'Mixed source fixture',
        isR18: false,
        players: [
          { id: 'magnet-high', movieId: 'movie-mixed', sourceName: 'magnet high', sourceUrl: 'magnet:RAW_MAGNET_HIGH', sortOrder: 9, isActive: true, quality: '4K', averageRating: 5, ratingCount: 20 },
          { id: 'inactive-best', movieId: 'movie-mixed', sourceName: 'inactive best', sourceUrl: 'RAW_INACTIVE_URL', sortOrder: 1, isActive: false, quality: '4K', averageRating: 5, ratingCount: 20 },
          { id: 'direct-low', movieId: 'movie-mixed', sourceName: 'direct low', sourceUrl: 'RAW_DIRECT_LOW', sortOrder: 8, isActive: true, quality: 'SD', averageRating: 1, ratingCount: 20 },
          { id: 'torrserver-ineligible', movieId: 'movie-mixed', source: 'TorrServer', sourceName: 'TorrServer source', sourceUrl: 'RAW_TORRSERVER_URL', sortOrder: 2, isActive: true, quality: '4K', averageRating: 5, ratingCount: 20 },
          { id: 'direct-high', movieId: 'movie-mixed', sourceName: 'direct high', sourceUrl: 'RAW_DIRECT_HIGH', sortOrder: 7, isActive: true, quality: '4K', averageRating: 5, ratingCount: 20 },
          { id: 'magnet-low', movieId: 'movie-mixed', sourceName: 'magnet low', sourceUrl: 'magnet:RAW_MAGNET_LOW', sortOrder: 6, isActive: true, quality: 'SD', averageRating: 1, ratingCount: 20 },
          { id: 'blank-active', movieId: 'movie-mixed', sourceName: 'blank active', sourceUrl: ' ', sortOrder: 3, isActive: true, averageRating: 5, ratingCount: 20 },
        ],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-mixed', observedAt: 900, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-mixed', schemaVersion: 2 },
          source: {
            disposition: 'ready',
            eligibleCount: 4,
            observedAt: 900,
            reasonCode: null,
            repairable: false,
            sourceRevision: 9,
          },
        },
        rawRequest: 'RAW_REQUEST_SENTINEL',
        rawException: 'RAW_EXCEPTION_SENTINEL',
        signature: 'RAW_SIGNATURE_SENTINEL',
      },
    })

    const wrapper = mount(MovieDetail)
    await flushPromises()

    expect(wrapper.findAll('[data-source-group]').map(group => group.attributes('data-source-group'))).toEqual([
      'eligible-direct',
      'eligible-magnet',
      'ineligible',
    ])
    expect(wrapper.findAll('[data-source-card]').map(card => card.attributes('data-source-card'))).toEqual([
      'direct-low',
      'direct-high',
      'magnet-high',
      'magnet-low',
      'inactive-best',
      'torrserver-ineligible',
      'blank-active',
    ])
    expect(wrapper.findAll('[data-source-health-player]').map(row => row.attributes('data-source-health-player'))).toEqual([
      'magnet-high',
      'inactive-best',
      'direct-low',
      'torrserver-ineligible',
      'direct-high',
      'magnet-low',
      'blank-active',
    ])
    expect(wrapper.get('[data-readiness-action="play"]').attributes('href')).toBe('/movie/MIXED-001/play?player=direct-low')
    expect(wrapper.get('[data-source-card="direct-low"] [data-source-action="play"]').attributes('href')).toBe('/movie/MIXED-001/play?player=direct-low')

    const magnetActions = wrapper.findAll('[data-source-card="magnet-high"] [data-source-action]').map(action => action.attributes('data-source-action'))
    expect(magnetActions.sort()).toEqual(['aria2', 'copy', 'qrcode', 'rating', 'report', 'torrserver'])
    expect(wrapper.findAll('[data-source-card="inactive-best"] [data-source-action]')).toHaveLength(0)
    expect(wrapper.findAll('[data-source-card="torrserver-ineligible"] [data-source-action]')).toHaveLength(0)
    expect(wrapper.findAll('[data-source-card="blank-active"] [data-source-action]')).toHaveLength(0)

    await wrapper.get('select').setValue('rating')
    expect(wrapper.findAll('[data-source-card]').map(card => card.attributes('data-source-card'))).toEqual([
      'direct-high',
      'direct-low',
      'magnet-high',
      'magnet-low',
      'inactive-best',
      'torrserver-ineligible',
      'blank-active',
    ])
    expect(wrapper.html()).not.toContain('RAW_DIRECT_LOW')
    expect(wrapper.html()).not.toContain('RAW_MAGNET_HIGH')
    expect(wrapper.html()).not.toContain('RAW_INACTIVE_URL')
    expect(wrapper.html()).not.toContain('RAW_TORRSERVER_URL')
    expect(wrapper.html()).not.toContain('RAW_REQUEST_SENTINEL')
    expect(wrapper.html()).not.toContain('RAW_EXCEPTION_SENTINEL')
    expect(wrapper.html()).not.toContain('RAW_SIGNATURE_SENTINEL')
  })
})
