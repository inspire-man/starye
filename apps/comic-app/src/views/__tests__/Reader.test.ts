import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import Reader from '../Reader.vue'

const { mockRoute, mockRouter, mockComicApi, mockProgressApi, mockUserStore } = vi.hoisted(() => ({
  mockRoute: {
    params: {
      slug: 'comic-1',
      chapterId: 'chapter-1',
    },
  },
  mockRouter: {
    back: vi.fn(),
  },
  mockComicApi: {
    getChapterDetail: vi.fn(),
  },
  mockProgressApi: {
    getReadingProgress: vi.fn(),
    saveReadingProgress: vi.fn(),
  },
  mockUserStore: {
    user: {
      id: 'user-1',
      name: 'Tester',
      isR18Verified: true,
    },
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}))

vi.mock('../../lib/api-client', () => ({
  comicApi: mockComicApi,
  progressApi: mockProgressApi,
}))

vi.mock('../../stores/user', () => ({
  useUserStore: () => mockUserStore,
}))

function createChapterResponse(images: string[] = [
  'https://img.example.com/page-1.jpg',
  'https://img.example.com/page-2.jpg',
]) {
  return {
    success: true,
    data: {
      id: 'comic-1-chapter-1',
      title: 'Chapter 1',
      chapterNumber: 1,
      images,
    },
  }
}

function createReadingProgress(page: number, completed = false) {
  return {
    success: true,
    data: {
      id: 'progress-1',
      contentType: 'comic',
      contentId: 'comic-1-chapter-1',
      chapterId: 'comic-1-chapter-1',
      position: page,
      page,
      duration: null,
      completed,
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
  }
}

async function flushReader() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

async function mountReader() {
  const wrapper = mount(Reader, {
    attachTo: document.body,
  })

  await flushReader()
  await vi.advanceTimersByTimeAsync(150)
  await flushReader()

  return wrapper
}

function makeRect(top: number, bottom: number) {
  return {
    top,
    bottom,
    left: 0,
    right: 0,
    width: 600,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }
}

function setVisiblePage(wrapper: ReturnType<typeof mount>, visiblePage: number) {
  const pages = wrapper.findAll('[data-reader-page]')
  pages.forEach((pageWrapper, index) => {
    const pageNumber = index + 1
    Object.defineProperty(pageWrapper.element, 'getBoundingClientRect', {
      configurable: true,
      value: () => {
        if (pageNumber === visiblePage) {
          return makeRect(120, 720)
        }

        if (pageNumber < visiblePage) {
          return makeRect(-720, -120)
        }

        return makeRect(920, 1520)
      },
    })
  })
}

describe('reader.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    mockRoute.params.slug = 'comic-1'
    mockRoute.params.chapterId = 'chapter-1'
    mockUserStore.user = {
      id: 'user-1',
      name: 'Tester',
      isR18Verified: true,
    }

    mockComicApi.getChapterDetail.mockResolvedValue(createChapterResponse())
    mockProgressApi.getReadingProgress.mockResolvedValue({ success: true, data: null })
    mockProgressApi.saveReadingProgress.mockResolvedValue({ success: true })

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    })

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })

    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('章节接口失败时显示错误信息', async () => {
    mockComicApi.getChapterDetail.mockRejectedValueOnce(new Error('remote down'))

    const wrapper = await mountReader()

    expect(wrapper.text()).toContain('remote down')
    wrapper.unmount()
  })

  it('单图失败时显示失败卡片，并支持打开原图与单页重试', async () => {
    const wrapper = await mountReader()

    await wrapper.get('[data-page-image="1"]').trigger('error')
    await flushReader()

    expect(wrapper.get('[data-page-error="1"]').text()).toContain('第 1 页加载失败')

    await wrapper.get('[data-open-page="1"]').trigger('click')
    expect(window.open).toHaveBeenCalledWith(
      'https://img.example.com/page-1.jpg',
      '_blank',
      'noopener,noreferrer',
    )

    await wrapper.get('[data-retry-page="1"]').trigger('click')
    await flushReader()

    expect(wrapper.find('[data-page-error="1"]').exists()).toBe(false)
    expect(wrapper.find('[data-page-image="1"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('部分失败时显示汇总，并支持批量重试失败页', async () => {
    mockComicApi.getChapterDetail.mockResolvedValueOnce(createChapterResponse([
      'https://img.example.com/page-1.jpg',
      'https://img.example.com/page-2.jpg',
      'https://img.example.com/page-3.jpg',
    ]))

    const wrapper = await mountReader()

    await wrapper.get('[data-page-image="1"]').trigger('error')
    await wrapper.get('[data-page-image="2"]').trigger('load')
    await flushReader()

    expect(wrapper.get('[data-partial-failure]').text()).toContain('1 页加载失败')

    await wrapper.get('[data-retry-failed]').trigger('click')
    await flushReader()

    expect(wrapper.find('[data-page-error="1"]').exists()).toBe(false)
    expect(wrapper.find('[data-page-image="1"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('整章全失败时显示专用失败态，并允许重试本章', async () => {
    const wrapper = await mountReader()

    await wrapper.get('[data-page-image="1"]').trigger('error')
    await flushReader()
    await wrapper.get('[data-page-image="2"]').trigger('error')
    await flushReader()

    expect(wrapper.get('[data-chapter-failure]').text()).toContain('整章图片均加载失败')

    await wrapper.get('[data-retry-chapter]').trigger('click')
    await flushReader()

    expect(mockComicApi.getChapterDetail).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('接口返回空图片数组时显示空章节失败态，并避免 1 / 0', async () => {
    mockComicApi.getChapterDetail.mockResolvedValueOnce(createChapterResponse([]))

    const wrapper = await mountReader()

    expect(wrapper.get('[data-chapter-failure]').text()).toContain('接口返回了 0 张图片')
    expect(wrapper.get('[data-page-counter]').text()).toContain('0 / 0')
    expect(wrapper.get('[data-open-first-original]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('pagehide 会保存当前页，并在读到末页且有成功页时标记 completed=true', async () => {
    mockProgressApi.getReadingProgress.mockResolvedValueOnce(createReadingProgress(2, false))

    const wrapper = await mountReader()

    await wrapper.get('[data-page-image="1"]').trigger('load')
    await wrapper.get('[data-page-image="2"]').trigger('load')
    await flushReader()

    mockProgressApi.saveReadingProgress.mockClear()
    window.dispatchEvent(new Event('pagehide'))
    await flushReader()

    expect(mockProgressApi.saveReadingProgress).toHaveBeenCalledWith(
      'comic-1-chapter-1',
      2,
      true,
    )
    wrapper.unmount()
  })

  it('0 成功图片时即使滚到末页也不会保存 completed=true', async () => {
    const wrapper = await mountReader()

    await wrapper.get('[data-page-image="1"]').trigger('error')
    await flushReader()

    setVisiblePage(wrapper as any, 2)
    await wrapper.get('[data-scroll-container]').trigger('scroll')
    await flushReader()

    expect(wrapper.get('[data-page-counter]').text()).toContain('2 / 2')

    await wrapper.get('[data-page-image="2"]').trigger('error')
    await flushReader()

    mockProgressApi.saveReadingProgress.mockClear()
    window.dispatchEvent(new Event('pagehide'))
    await flushReader()

    expect(mockProgressApi.saveReadingProgress).toHaveBeenCalledWith(
      'comic-1-chapter-1',
      2,
      false,
    )
    expect(wrapper.get('[data-chapter-failure]').text()).toContain('整章图片均加载失败')
    wrapper.unmount()
  })
})
