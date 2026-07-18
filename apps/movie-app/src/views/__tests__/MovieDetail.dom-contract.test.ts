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

  it('renders the loaded item UUID on the element that displays its code', async () => {
    const wrapper = mount(MovieDetail)
    await flushPromises()

    expect(getMovieDetailMock).toHaveBeenCalledWith('TEST-001')
    expect(wrapper.get('[data-phase13-item-id="movie-uuid-1"]').text()).toBe('TEST-001')
  })
})
