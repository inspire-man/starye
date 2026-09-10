import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Home from '../Home.vue'

const { getMoviesMock, getRecommendedMock, replaceMock } = vi.hoisted(() => ({
  getMoviesMock: vi.fn(),
  getRecommendedMock: vi.fn(),
  replaceMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}))

vi.mock('../../lib/api-client', () => ({
  movieApi: {
    getMovies: getMoviesMock,
    getRecommended: getRecommendedMock,
  },
  genreApi: { getGenres: vi.fn().mockResolvedValue({ success: true, data: [] }) },
  progressApi: { getWatchingHistory: vi.fn().mockResolvedValue({ success: true, data: [] }) },
}))

vi.mock('../../stores/user', () => ({
  useUserStore: () => ({ user: null }),
}))

vi.mock('../../composables/useAuthGuard', () => ({
  useAuthGuard: () => ({ requireLogin: () => false }),
}))

vi.mock('@starye/ui', async () => {
  const actual = await vi.importActual<typeof import('@starye/ui')>('@starye/ui')
  const { ref } = await import('vue')
  return {
    ...actual,
    useListQuery: () => ({
      page: ref(1),
      limit: ref(20),
      total: ref(0),
      totalPages: ref(0),
      loading: ref(false),
      error: ref(''),
      execute: async (fn: (query: { page: number, limit: number }) => Promise<{ data: unknown[] }>) => (await fn({ page: 1, limit: 20 })).data,
      goToPage: vi.fn(),
      updatePageSize: vi.fn(),
    }),
  }
})

describe('movie home discovery', () => {
  beforeEach(() => {
    getMoviesMock.mockResolvedValue({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } })
    getRecommendedMock.mockResolvedValue({ success: true, data: [{ id: '1', code: 'HOT-001', title: 'Hot', isR18: false }], meta: { strategy: 'hot' } })
    replaceMock.mockResolvedValue(undefined)
  })

  it('exposes discovery entries and anonymous public recommendation strategy', async () => {
    const wrapper = mount(Home)
    await flushPromises()
    expect(wrapper.get('[data-discovery-entries]').text()).toContain('最近新增')
    expect(wrapper.get('[data-discovery-entries]').text()).toContain('播放验证通过')
    expect(wrapper.get('[data-recommendation-strategy]').text()).toContain('公开策略')
    expect(wrapper.get('[data-recommendation-strategy]').text()).not.toContain('猜你喜欢')
  })
})
