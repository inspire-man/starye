import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MovieDetail from '../MovieDetail.vue'

const { getMovieDetailMock, routeState, routerPushMock, submitVideoAvailabilityCommandMock } = vi.hoisted(() => ({
  getMovieDetailMock: vi.fn(),
  routeState: { params: { code: 'TEST-001' } },
  routerPushMock: vi.fn(),
  submitVideoAvailabilityCommandMock: vi.fn(),
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
  movieApi: { getMovieDetail: getMovieDetailMock, submitVideoAvailabilityCommand: submitVideoAvailabilityCommandMock },
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
    submitVideoAvailabilityCommandMock.mockResolvedValue({
      binding: { movieId: 'movie-uuid-1', movieRevision: 1, policyVersion: 'video-source-probe/v1', sourceRevision: 0 },
      kind: 'created',
      run: { attemptNumber: 1, id: 'run-1', status: 'queued', taskId: 'task-1' },
    })
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

  it('renders the persisted cover and overview images', async () => {
    getMovieDetailMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'movie-images',
        code: 'IMAGES-001',
        title: 'Image contract fixture',
        isR18: false,
        coverImage: 'https://cdn.example/images-cover.webp',
        previewImages: [
          'https://cdn.example/images-preview-1.webp',
          'https://cdn.example/images-preview-2.webp',
        ],
        players: [],
        relatedMovies: [],
      },
    })

    const wrapper = mount(MovieDetail)
    await flushPromises()

    expect(wrapper.get('.movie-detail-cover img').attributes('src')).toBe('https://cdn.example/images-cover.webp')
    expect(wrapper.findAll('.movie-overview-image')).toHaveLength(2)
    expect(wrapper.findAll('.movie-overview-image').map(image => image.attributes('src'))).toEqual([
      'https://cdn.example/images-preview-1.webp',
      'https://cdn.example/images-preview-2.webp',
    ])
  })

  it('renders authoritative four-layer current and bounded old-revision history', async () => {
    getMovieDetailMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'movie-availability',
        code: 'AVAILABLE-001',
        title: 'Availability fixture',
        isR18: false,
        players: [],
        relatedMovies: [],
        primaryContentId: 'movie-availability',
        readiness: {
          metadata: { contentId: 'movie-availability', observedAt: null, persisted: false },
          playback: { status: 'unverified' },
          receipt: { persisted: false, primaryContentId: 'movie-availability', schemaVersion: null },
          source: { disposition: 'source_failed', eligibleCount: 0, observedAt: 300, reasonCode: 'source_read_failed', repairable: true, sourceRevision: 7 },
        },
        availability: {
          current: {
            metadata: { observedAt: null, persisted: false, sourceRevision: 7 },
            direct: { freshness: 'fresh', observedAt: 301, policyVersion: 'video-source-probe/v1', reasonCode: 'direct_transport_failed', sourceRevision: 7, status: 'degraded', summary: { counts: { available: 1, abnormal: 2 }, samples: [{ code: 'range_failed', count: 2 }] } },
            magnet: { freshness: 'fresh', observedAt: 302, policyVersion: 'video-source-probe/v1', reasonCode: 'provider_unconfigured', sourceRevision: 7, status: 'unknown', summary: { counts: { checked: 1 }, samples: [] } },
            playback: { status: 'unverified', tuple: null },
          },
          history: [{
            layer: 'direct',
            fact: {
              freshness: 'stale',
              observedAt: 200,
              policyVersion: 'video-source-probe/v1',
              reasonCode: 'available',
              sourceRevision: 6,
              status: 'available',
              summary: { counts: { available: 1 }, samples: [] },
            },
          }],
        },
        rawRequest: 'RAW_REQUEST_SENTINEL',
        token: 'TOKEN_SENTINEL',
      },
    })

    const wrapper = mount(MovieDetail)
    await flushPromises()
    expect(wrapper.findAll('[data-video-layer]').map(row => row.attributes('data-video-layer'))).toEqual(['metadata', 'direct', 'magnet', 'playback'])
    expect(wrapper.get('[data-video-layer="metadata"]').text()).toContain('未持久化')
    expect(wrapper.get('[data-readiness-summary]').text()).toContain('当前还不能确认可观看')
    expect(wrapper.get('[data-readiness-summary]').text()).toContain('磁力来源待确认')
    expect(wrapper.get('[data-video-layer="direct"]').text()).toContain('direct_transport_failed')
    expect(wrapper.get('[data-video-layer="direct"]').text()).toContain('available：1')
    expect(wrapper.get('[data-video-layer="direct"]').text()).toContain('重新检查')
    expect(wrapper.get('[data-video-layer="direct"] [data-video-history]').text()).toContain('revision 6')
    expect(wrapper.get('[data-video-layer="magnet"]').text()).toContain('配置 provider')
    expect(wrapper.get('[data-readiness-action="check-video-layer"]').text()).toContain('配置 provider')
    expect(wrapper.get('[data-video-layer="playback"]').text()).toContain('播放未验证')
    expect(wrapper.text()).not.toContain('RAW_REQUEST_SENTINEL')
    expect(wrapper.text()).not.toContain('TOKEN_SENTINEL')
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
    expect(summary.text()).toContain('影片信息保存状态')
    expect(summary.text()).toContain('no_source')
    expect(summary.text()).toContain('暂无可用播放源')
    expect(summary.text()).toContain('eligible count：0')
    expect(summary.text()).toContain('可修复')
    expect(summary.text()).toContain('实际播放验证')
    expect(summary.text()).toContain('播放未验证')
    expect(summary.text()).toContain('同步记录')
    expect(summary.text()).toContain('查看修复意图')
    expect(summary.text()).toContain('重试读取')
    expect(wrapper.get('[data-readiness-action="repair-primary"]').text()).toContain('查看修复建议')
    expect(wrapper.get('[data-readiness-action="refresh-primary"]').text()).toContain('重新检查')
    expect(wrapper.get('.movie-detail-technical-details').attributes('open')).toBeUndefined()
    expect(wrapper.text()).not.toContain('▶️ 播放')
  })

  it('explains when R18 playback sources are hidden by the current access mode', async () => {
    getMovieDetailMock.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'movie-r18-hidden',
        primaryContentId: 'movie-r18-hidden',
        code: 'R18-HIDDEN-001',
        title: 'R18 hidden source fixture',
        isR18: true,
        players: [],
        relatedMovies: [],
        readiness: {
          metadata: { contentId: 'movie-r18-hidden', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-r18-hidden', schemaVersion: 2 },
          source: {
            disposition: 'ready',
            eligibleCount: 1,
            observedAt: 100,
            reasonCode: null,
            repairable: false,
            sourceRevision: 2,
          },
        },
      },
    })

    const wrapper = mount(MovieDetail)
    await flushPromises()

    expect(wrapper.get('[data-r18-source-guard]').text()).toContain('播放源已隐藏')
    expect(wrapper.get('[data-r18-source-guard]').text()).toContain('SFW 模式')
    expect(wrapper.get('[data-movie-cover-status]').text()).toContain('完成 R18 验证后显示')
    expect(wrapper.get('[data-movie-cover-profile]').attributes('href')).toBe('/profile')
    expect(wrapper.get('[data-r18-overview-guard]').text()).toContain('影片概览图不会显示')
    expect(wrapper.get('[data-r18-source-profile]').attributes('href')).toBe('/profile')
    expect(wrapper.get('[data-readiness-action="r18-profile"]').attributes('href')).toBe('/profile')
    expect(wrapper.get('[data-r18-access-summary]').text()).toContain('来源检查记录和播放入口已隐藏')
    expect(wrapper.get('[data-r18-access-details-link]').attributes('href')).toBe('/profile')
    expect(wrapper.get('[data-readiness-summary]').text()).toContain('开启 R18 访问后再检查')
    expect(wrapper.find('[data-readiness-action="check-video-layer"]').exists()).toBe(false)
    expect(wrapper.find('[data-readiness-action="refresh-primary"]').exists()).toBe(false)
    expect(wrapper.find('.movie-detail-technical-details').exists()).toBe(false)
    expect(wrapper.find('[data-playback-sources]').exists()).toBe(false)
    expect(wrapper.get('[data-readiness-summary]').text()).not.toContain('eligible count')
    expect(wrapper.text()).not.toContain('该影片尚未添加播放源信息')
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
    if (disposition === 'ready') {
      expect(wrapper.get('[data-readiness-action="play"]').attributes('href')).toBe('/movie/CODE-ready/play?player=direct-ready&contentId=movie-ready&sourceRevision=5&sourceType=direct')
      expect(wrapper.get('[data-hero-action="play"]').text()).toContain('立即播放')
      expect(wrapper.get('[data-usage-guide]').text()).toContain('选择适合你的播放方式')
    }
  })

  it('renders bounded per-source health and submits a repair task with the same movie identity', async () => {
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
    const dialog = document.querySelector<HTMLElement>('[data-confirm-dialog-panel]')
    expect(dialog?.textContent).toContain('确认视频来源操作')
    expect(dialog?.textContent).toContain('SUN-064')
    dialog?.querySelector<HTMLButtonElement>('.confirm-dialog-confirm')?.click()
    await flushPromises()

    expect(submitVideoAvailabilityCommandMock).toHaveBeenCalledWith({
      idempotencyKey: 'movie-detail:video-availability:movie-sun-064:4:direct:no_source',
      movieId: 'movie-sun-064',
      reason: 'no_source',
      sourceKind: 'direct',
    })
    expect(routerPushMock).not.toHaveBeenCalled()
    expect(getMovieDetailMock).toHaveBeenCalledTimes(2)
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
    expect(wrapper.get('[data-readiness-action="play"]').attributes('href')).toBe('/movie/MIXED-001/play?player=direct-low&contentId=movie-mixed&sourceRevision=9&sourceType=direct')
    expect(wrapper.get('[data-source-card="direct-low"] [data-source-action="play"]').attributes('href')).toBe('/movie/MIXED-001/play?player=direct-low&contentId=movie-mixed&sourceRevision=9&sourceType=direct')
    expect(wrapper.get('[data-source-card="direct-low"]').attributes('data-playback-context')).toBe('movie-mixed@9/direct/direct-low')
    expect(wrapper.get('[data-hero-action="play"]').text()).toContain('立即播放')
    expect(wrapper.get('[data-usage-guide]').text()).toContain('TorrServer')

    const magnetActions = wrapper.findAll('[data-source-card="magnet-high"] [data-source-action]').map(action => action.attributes('data-source-action'))
    expect(magnetActions.sort()).toEqual(['aria2', 'copy', 'qrcode', 'rating', 'report', 'torrserver'])
    expect(wrapper.get('[data-source-card="magnet-high"] [data-source-action="torrserver"]').text()).toContain('在线播放')
    expect(wrapper.get('[data-source-card="magnet-high"] [data-source-action="aria2"]').text()).toContain('添加到 Aria2')
    expect(wrapper.get('[data-source-card="magnet-high"] .movie-source-more').text()).toContain('更多操作')
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
