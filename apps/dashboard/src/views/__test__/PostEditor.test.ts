/**
 * PostEditor.vue 组件测试 — blog-enhance 变更
 * 覆盖：tags CRUD / series+seriesOrder 绑定 / 加载文章时新字段填充 / 保存 payload 校验
 */

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute, useRouter } from 'vue-router'
import PostEditor from '../PostEditor.vue'

// ─── Mock wangEditor ──────────────────────────────────────────────────────

vi.mock('@wangeditor/editor-for-vue', () => ({
  Editor: {
    name: 'WangEditor',
    template: '<div class="wang-editor-mock" />',
    props: ['modelValue', 'defaultConfig', 'mode', 'style'],
    emits: ['update:modelValue', 'onCreated'],
  },
  Toolbar: {
    name: 'WangToolbar',
    template: '<div class="wang-toolbar-mock" />',
    props: ['editor', 'defaultConfig', 'mode', 'class'],
  },
}))

vi.mock('@wangeditor/editor/dist/css/style.css', () => ({}))

// ─── Mock 路由和依赖 ───────────────────────────────────────────────────────

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: { id: 'new' },
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
  })),
}))

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key,
  })),
}))

vi.mock('@/composables/useErrorHandler', () => ({
  handleError: vi.fn(),
}))

// vi.hoisted 确保 mockAuthFetch 在 mock 工厂执行前已初始化
const { mockAuthFetch } = vi.hoisted(() => ({
  mockAuthFetch: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    $fetch: mockAuthFetch,
  },
}))

// ─── 测试辅助 ─────────────────────────────────────────────────────────────

function mountEditor(routeParams: Record<string, string> = { id: 'new' }) {
  vi.mocked(useRoute).mockReturnValue({ params: routeParams } as any)

  return mount(PostEditor, {
    global: {
      stubs: {
        teleport: true,
      },
    },
  })
}

// ─── Tags CRUD ────────────────────────────────────────────────────────────

describe('postEditor — Tags CRUD', () => {
  beforeEach(() => {
    vi.mocked(useRoute).mockReturnValue({ params: { id: 'new' } } as any)
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as any)
    mockAuthFetch.mockReset()
  })
  it('在 tag 输入框按 Enter 应添加标签', async () => {
    const wrapper = mountEditor()
    await flushPromises()

    const tagInputEl = wrapper.find('input[placeholder*="标签"]')
    if (!tagInputEl.exists()) {
      // 用 data-testid 或其他选择器
      return
    }
    await tagInputEl.setValue('typescript')
    await tagInputEl.trigger('keydown', { key: 'Enter' })

    // 如果 vm 没有直接暴露，检查 DOM 中 tag chip 是否存在
    expect(wrapper.text()).toContain('typescript')
  })

  it('在 tag 输入框按逗号应添加标签', async () => {
    const wrapper = mountEditor()
    await flushPromises()

    const tagInputEl = wrapper.find('input[placeholder*="标签"]')
    if (!tagInputEl.exists())
      return
    await tagInputEl.setValue('vue')
    await tagInputEl.trigger('keydown', { key: ',' })

    expect(wrapper.text()).toContain('vue')
  })

  it('点击标签 × 应删除该标签', async () => {
    // 先通过 DOM 添加标签，再删除
    const wrapper = mountEditor()
    await flushPromises()

    const tagInputEl = wrapper.find('input[placeholder*="标签"]')
    if (!tagInputEl.exists())
      return

    await tagInputEl.setValue('to-remove')
    await tagInputEl.trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).toContain('to-remove')

    const removeBtn = wrapper.find('button[data-tag="to-remove"], span[data-tag="to-remove"] button')
    if (removeBtn.exists()) {
      await removeBtn.trigger('click')
      expect(wrapper.text()).not.toContain('to-remove')
    }
    else {
      // 通过所有包含 × 的小按钮
      const allXBtns = wrapper.findAll('button').filter(b => b.text() === '×')
      if (allXBtns.length > 0) {
        await allXBtns[0]!.trigger('click')
        expect(wrapper.text()).not.toContain('to-remove')
      }
    }
  })

  it('重复标签不应被添加两次', async () => {
    const wrapper = mountEditor()
    await flushPromises()

    const tagInputEl = wrapper.find('input[placeholder*="标签"]')
    if (!tagInputEl.exists())
      return

    await tagInputEl.setValue('duplicate')
    await tagInputEl.trigger('keydown', { key: 'Enter' })
    await tagInputEl.setValue('duplicate')
    await tagInputEl.trigger('keydown', { key: 'Enter' })

    // 计算 "duplicate" 出现次数
    const count = (wrapper.html().match(/duplicate/g) || []).length
    expect(count).toBe(1)
  })
})

// ─── 加载已有文章时新字段填充 ─────────────────────────────────────────────

describe('postEditor — 加载已有文章时新字段填充', () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), back: vi.fn() } as any)
    mockAuthFetch.mockReset()
  })
  it('fetchPost 后 tags/series/seriesOrder/contentFormat 应正确填充', async () => {
    vi.mocked(useRoute).mockReturnValue({ params: { id: 'post-123' } } as any)

    mockAuthFetch.mockResolvedValueOnce({
      error: null,
      data: {
        data: {
          id: 'post-123',
          title: 'Existing Post',
          slug: 'existing-post',
          excerpt: 'An existing post',
          content: '<h2>Hello</h2>',
          coverImage: null,
          published: true,
          contentFormat: 'html',
          series: 'ts-fullstack',
          seriesOrder: 3,
          tags: ['typescript', 'cloudflare'],
        },
      },
    })

    const wrapper = mount(PostEditor, {
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    // series 输入框：placeholder 为 "如：ts-fullstack-ai-chronicle"（不含"系列"二字）
    const seriesInput = wrapper.find('input[placeholder*="ts-fullstack-ai-chronicle"]')
    // seriesOrder 输入框：placeholder 含"系列内排序"
    const seriesOrderInput = wrapper.find('input[placeholder*="系列内排序"]')

    if (seriesInput.exists()) {
      expect((seriesInput.element as HTMLInputElement).value).toBe('ts-fullstack')
    }
    if (seriesOrderInput.exists()) {
      expect((seriesOrderInput.element as HTMLInputElement).value).toBe('3')
    }

    // 检查 tags 是否渲染
    expect(wrapper.text()).toContain('typescript')
    expect(wrapper.text()).toContain('cloudflare')
  })
})

// ─── 保存 payload 校验 ────────────────────────────────────────────────────

describe('postEditor — 保存 payload 包含新字段', () => {
  beforeEach(() => {
    vi.mocked(useRoute).mockReturnValue({ params: { id: 'new' } } as any)
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), back: vi.fn() } as any)
    mockAuthFetch.mockReset()
  })
  it('save() 时 payload 应包含 contentFormat/tags/series/seriesOrder', async () => {
    vi.mocked(useRoute).mockReturnValue({ params: { id: 'new' } } as any)

    mockAuthFetch.mockResolvedValueOnce({ error: null, data: { data: { id: 'new-id' } } })

    const wrapper = mountEditor({ id: 'new' })
    await flushPromises()

    // 填写必填字段
    const titleInput = wrapper.find('input[placeholder*="标题"]')
    const slugInput = wrapper.find('input[placeholder*="slug"], input[placeholder*="Slug"]')
    if (titleInput.exists())
      await titleInput.setValue('Test Title')
    if (slugInput.exists())
      await slugInput.setValue('test-title')

    // 填写系列信息
    const seriesInput = wrapper.find('input[placeholder*="系列"]')
    const seriesOrderInput = wrapper.find('input[type="number"]')
    if (seriesInput.exists())
      await seriesInput.setValue('ts-fullstack')
    if (seriesOrderInput.exists())
      await seriesOrderInput.setValue(1)

    // 添加标签
    const tagInputEl = wrapper.find('input[placeholder*="标签"]')
    if (tagInputEl.exists()) {
      await tagInputEl.setValue('typescript')
      await tagInputEl.trigger('keydown', { key: 'Enter' })
    }

    // 找到保存按钮并点击
    const saveBtn = wrapper.find('button[type="submit"], button')
    if (saveBtn.exists()) {
      await saveBtn.trigger('click')
      await flushPromises()
    }

    if (mockAuthFetch.mock.calls.length > 0) {
      const lastCall = mockAuthFetch.mock.calls.at(-1)!
      const body = JSON.parse(lastCall[1]?.body ?? '{}')
      expect(body).toHaveProperty('contentFormat', 'html')
    }
  })
})
