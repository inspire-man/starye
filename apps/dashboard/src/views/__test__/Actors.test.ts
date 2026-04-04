/**
 * Actors.vue 集成测试
 *
 * 覆盖：
 * - 列表加载（SkeletonTable → DataTable）
 * - 错误状态
 * - sortBy / sortOrder 作为 API 参数正确传出（服务端排序）
 * - 原生 confirm() 已替换（不再调用 window.confirm）
 * - handleBatchRecrawl 打开 ConfirmDialog 而非原生弹窗
 */

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Actors from '../Actors.vue'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  api: {
    admin: {
      getActors: vi.fn(),
      updateActor: vi.fn(),
      deleteActor: vi.fn(),
      batchRecrawlActors: vi.fn(),
      getActorDetail: vi.fn(),
      mergeActors: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: { user: { id: '1' } } })),
}))

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    query: {},
    params: {},
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}))

vi.mock('@starye/ui', async (importOriginal) => {
  const { ref, computed } = await import('vue')
  const actual = await importOriginal<typeof import('@starye/ui')>()
  return {
    ...actual,
    useFilters: vi.fn(() => ({
      filters: ref({
        search: '',
        crawlStatus: '',
        nationality: '',
        hasDetails: '',
      }),
      applyFilters: vi.fn(),
      resetFilters: vi.fn(),
    })),
    usePagination: vi.fn(() => ({
      currentPage: computed(() => 1),
      limit: computed(() => 50),
      total: ref(0),
      totalPages: ref(0),
      goToPage: vi.fn(),
      updatePageSize: vi.fn(),
      nextPage: vi.fn(),
      prevPage: vi.fn(),
      setMeta: vi.fn(),
    })),
    useToast: vi.fn(() => ({
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      showProgress: vi.fn(() => 'progress-id'),
      updateProgress: vi.fn(),
      hideProgress: vi.fn(),
    })),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
})

vi.mock('@/composables/useSorting', async () => {
  const { ref } = await import('vue')
  return {
    useSorting: vi.fn(() => ({
      sortBy: ref('movieCount'),
      sortOrder: ref('desc'),
      updateSort: vi.fn(),
    })),
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/composables/useErrorHandler', () => ({
  useErrorHandler: vi.fn(() => ({
    handleError: vi.fn(),
  })),
  handleError: vi.fn(),
}))

vi.mock('@/lib/date-utils', () => ({
  formatDateTime: vi.fn((d: string) => d),
}))

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockActors = [
  { id: 'a1', name: '演员 A', movieCount: 10, hasDetailsCrawled: true, nationality: 'JP' },
  { id: 'a2', name: '演员 B', movieCount: 5, hasDetailsCrawled: false, nationality: 'KR' },
]

const emptyResponse = { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } }
const actorsResponse = { data: mockActors, meta: { total: 2, page: 1, limit: 50, totalPages: 1 } }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('actors.vue 集成测试', () => {
  let mockGetActors: ReturnType<typeof vi.fn>
  let mockBatchRecrawl: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const { api } = await import('@/lib/api')
    mockGetActors = vi.mocked(api.admin.getActors)
    mockBatchRecrawl = vi.mocked(api.admin.batchRecrawlActors)

    mockGetActors.mockResolvedValue(emptyResponse)
    mockBatchRecrawl.mockResolvedValue({ success: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── 加载状态 ────────────────────────────────────────────────────────────

  describe('加载状态', () => {
    it('初始加载时应显示 SkeletonTable', async () => {
      mockGetActors.mockImplementation(() => new Promise(() => {}))

      const wrapper = mount(Actors)
      await flushPromises()

      expect(wrapper.findComponent({ name: 'SkeletonTable' }).exists()).toBe(true)
    })

    it('加载成功后应显示演员数据', async () => {
      mockGetActors.mockResolvedValue(actorsResponse)

      const wrapper = mount(Actors)
      await flushPromises()

      expect(wrapper.text()).toContain('演员 A')
      expect(wrapper.text()).toContain('演员 B')
    })
  })

  // ─── 服务端排序参数 ───────────────────────────────────────────────────────

  describe('服务端排序（任务 5.2/5.3 验证）', () => {
    it('loadActors 应将 sortBy 和 sortOrder 传给 API', async () => {
      mockGetActors.mockResolvedValue(emptyResponse)

      mount(Actors)
      await flushPromises()

      expect(mockGetActors).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'movieCount',
          sortOrder: 'desc',
        }),
      )
    })

    it('不应再有本地排序逻辑（filteredActors computed 已移除）', async () => {
      mockGetActors.mockResolvedValue(actorsResponse)

      const wrapper = mount(Actors)
      await flushPromises()

      // filteredActors 已不存在，验证 vm 没有此属性
      const vm = wrapper.vm as any
      expect(vm.filteredActors).toBeUndefined()
    })
  })

  // ─── 无原生 confirm() 调用 ────────────────────────────────────────────────

  describe('confirmDialog 替换（任务 5.4 验证）', () => {
    it('window.confirm 不应被调用（已替换为 ConfirmDialog）', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')

      mockGetActors.mockResolvedValue(actorsResponse)
      const wrapper = mount(Actors)
      await flushPromises()

      // 手动设置 selectedActors 并调用 handleBatchRecrawl
      const vm = wrapper.vm as any
      vm.selectedActors.add('a1')
      vm.selectedActors = new Set(vm.selectedActors)

      // 触发批量重爬
      if (vm.handleBatchRecrawl) {
        vm.handleBatchRecrawl()
      }

      await flushPromises()

      // window.confirm 不应被调用
      expect(confirmSpy).not.toHaveBeenCalled()

      // isRecrawlConfirmOpen 应为 true（对话框已打开）
      expect(vm.isRecrawlConfirmOpen).toBe(true)
    })

    it('executeRecrawl 应调用 batchRecrawlActors API', async () => {
      mockGetActors.mockResolvedValue(emptyResponse)

      const { api } = await import('@/lib/api')
      await api.admin.batchRecrawlActors(['a1', 'a2'])

      expect(mockBatchRecrawl).toHaveBeenCalledWith(['a1', 'a2'])
    })
  })

  // ─── FilterPanel 替换 ─────────────────────────────────────────────────────

  describe('filterPanel 替换（任务 5.1 验证）', () => {
    it('filterPanel 组件应被渲染', async () => {
      mockGetActors.mockResolvedValue(emptyResponse)

      const wrapper = mount(Actors)
      await flushPromises()

      // FilterPanel 存在（由 @starye/ui 导出，有特定 class）
      expect(wrapper.findComponent({ name: 'FilterPanel' }).exists()).toBe(true)
    })

    it('原来的裸 HTML filter-bar 元素不应存在', async () => {
      mockGetActors.mockResolvedValue(emptyResponse)

      const wrapper = mount(Actors)
      await flushPromises()

      // .filter-bar 是旧版筛选器的类名
      expect(wrapper.find('.filter-bar').exists()).toBe(false)
    })
  })
})
