import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Crawlers from '../Crawlers.vue'

const { api } = vi.hoisted(() => ({
  api: {
    admin: {
      getCrawlerStats: vi.fn(),
      getFailedTasks: vi.fn(),
      recoverCrawler: vi.fn(),
      clearFailedTasks: vi.fn(),
      listCrawlerTasks: vi.fn(),
      getCrawlerTask: vi.fn(),
      getCrawlerTaskLogs: vi.fn(),
      createCrawlerTask: vi.fn(),
      cancelCrawlerRun: vi.fn(),
      retryCrawlerRun: vi.fn(),
    },
  },
}))
const { canAccessCrawler } = vi.hoisted(() => ({ canAccessCrawler: vi.fn() }))

vi.mock('@/lib/api', () => ({ api }))
vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn(() => ({ value: { data: { user: { role: 'admin' } } } })) }))
vi.mock('@/composables/useResourceGuard', () => ({ useResourceGuard: vi.fn(() => ({ canAccessCrawler })) }))
vi.mock('@/composables/useErrorHandler', () => ({ handleError: vi.fn() }))
vi.mock('@starye/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@starye/ui')>()
  return { ...actual, info: vi.fn(), success: vi.fn() }
})

describe('crawlers local task panel', () => {
  const mountedWrappers: Array<{ unmount: () => void }> = []
  const mountCrawler = () => {
    const wrapper = mount(Crawlers)
    mountedWrappers.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    api.admin.getCrawlerStats.mockResolvedValue({ comics: {}, movies: {} })
    api.admin.getFailedTasks.mockResolvedValue({ comics: { total: 0 }, movies: { total: 0 } })
    api.admin.listCrawlerTasks.mockResolvedValue({ tasks: [] })
    api.admin.getCrawlerTask.mockResolvedValue({ task: null, runs: [] })
    api.admin.getCrawlerTaskLogs.mockResolvedValue({ logs: [], nextCursor: null })
    canAccessCrawler.mockReturnValue(true)
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders fixed template CTAs without executable inputs', async () => {
    const wrapper = mountCrawler()
    await flushPromises()
    expect(wrapper.text()).toContain('创建视频任务')
    expect(wrapper.text()).toContain('创建漫画任务')
    expect(wrapper.find('input[type="url"]').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('hides templates that the resource guard denies', async () => {
    canAccessCrawler.mockImplementation((resource: string) => resource === 'movie')
    const wrapper = mountCrawler()
    await flushPromises()
    expect(wrapper.text()).toContain('创建视频任务')
    expect(wrapper.text()).not.toContain('创建漫画任务')
  })

  it('posts the literal template and selects the returned run', async () => {
    api.admin.createCrawlerTask.mockResolvedValue({ kind: 'created', template: 'movie', run: { id: 'run-1', status: 'queued', attemptNumber: 1 } })
    api.admin.listCrawlerTasks.mockResolvedValue({ tasks: [{ id: 'task-1', template_key: 'movie', latest_run_id: 'run-1' }] })
    api.admin.getCrawlerTask.mockResolvedValue({ task: { id: 'task-1', template_key: 'movie', latest_run_id: 'run-1' }, runs: [{ id: 'run-1', status: 'queued', attemptNumber: 1, receipt: null }] })
    const wrapper = mountCrawler()
    await flushPromises()
    await wrapper.get('button.task-primary').trigger('click')
    await flushPromises()
    expect(api.admin.createCrawlerTask).toHaveBeenCalledWith('movie')
    expect(wrapper.text()).toContain('排队中 · 等待本地 runner')
  })

  it('polls only while visible and clears on unmount', async () => {
    const wrapper = mountCrawler()
    await flushPromises()
    const initial = api.admin.listCrawlerTasks.mock.calls.length
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(api.admin.listCrawlerTasks.mock.calls.length).toBeGreaterThan(initial)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    const hiddenCount = api.admin.listCrawlerTasks.mock.calls.length
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(api.admin.listCrawlerTasks.mock.calls.length).toBe(hiddenCount)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(api.admin.listCrawlerTasks.mock.calls.length).toBeGreaterThan(hiddenCount)
    wrapper.unmount()
    const afterUnmount = api.admin.listCrawlerTasks.mock.calls.length
    vi.advanceTimersByTime(10000)
    expect(api.admin.listCrawlerTasks.mock.calls.length).toBe(afterUnmount)
  })

  it('keeps server status until confirmed cancel and retry responses refresh it', async () => {
    const task = { id: 'task-1', template_key: 'movie', latest_run_id: 'run-1' }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({ tasks: template === 'movie' ? [task] : [] }))
    api.admin.getCrawlerTask.mockResolvedValue({ task, runs: [{ id: 'run-1', status: 'running', attemptNumber: 1, receipt: null }] })
    const wrapper = mountCrawler()
    await flushPromises()
    await wrapper.get('button.task-danger').trigger('click')
    await (wrapper.vm as any).confirmCancel()
    expect(api.admin.cancelCrawlerRun).toHaveBeenCalledWith('task-1', 'run-1')

    api.admin.getCrawlerTask.mockResolvedValue({ task, runs: [{ id: 'run-1', status: 'cancelled', attemptNumber: 1, receipt: null }] })
    await (wrapper.vm as any).loadTaskPanel()
    await flushPromises()
    await wrapper.get('button.task-secondary').trigger('click')
    await (wrapper.vm as any).confirmRetry()
    expect(api.admin.retryCrawlerRun).toHaveBeenCalledWith('task-1', 'run-1')
  })

  it('renders only validated succeeded receipts and appends older safe logs', async () => {
    const task = { id: 'task-1', template_key: 'movie', latest_run_id: 'run-1' }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({ tasks: template === 'movie' ? [task] : [] }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{
        id: 'run-1',
        status: 'succeeded',
        attemptNumber: 1,
        receipt: { templateKey: 'movie', primaryContentId: 'movie-1', createdCount: 1, updatedCount: 0 },
      }],
    })
    api.admin.getCrawlerTaskLogs
      .mockResolvedValueOnce({ logs: [{ sequence: 3, level: 'info', code: 'completed', safe_message: '完成', created_at: '2026-07-31T00:00:00Z' }], nextCursor: 3 })
      .mockResolvedValueOnce({ logs: [{ sequence: 2, level: 'info', code: 'started', safe_message: '开始', created_at: '2026-07-31T00:00:00Z' }], nextCursor: null })
    const wrapper = mountCrawler()
    await flushPromises()
    expect(wrapper.text()).toContain('管理电影内容')
    expect(wrapper.get('a').attributes('href')).toBe('/dashboard/movies?receipt=movie-1&sourceAttempt=1&sourceRun=run-1&sourceTask=task-1')
    await wrapper.get('button.load-more').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('完成')
    expect(wrapper.text()).toContain('开始')
  })

  it('renders complete template history, stable task cursor, attempts and safe provider summary', async () => {
    const firstTask = { id: 'task-1', template_key: 'movie', latest_run_id: 'run-2' }
    const secondTask = { id: 'task-2', template_key: 'movie', latest_run_id: 'run-3' }
    api.admin.listCrawlerTasks.mockImplementation(({ template, cursor }: { template: string, cursor?: string }) => Promise.resolve(
      template === 'movie'
        ? cursor
          ? { tasks: [secondTask], nextCursor: null }
          : { tasks: [firstTask], nextCursor: 'cursor-1' }
        : { tasks: [], nextCursor: null },
    ))
    api.admin.getCrawlerTask.mockImplementation((taskId: string) => Promise.resolve(taskId === 'task-1'
      ? {
          task: firstTask,
          runs: [
            { id: 'run-2', status: 'running', attemptNumber: 2, receipt: null, provider: { provider: 'github-actions', providerStatus: 'in_progress', providerRunAttempt: 1 } },
            { id: 'run-1', status: 'failed', attemptNumber: 1, failureCode: 'provider_lost', receipt: null },
          ],
        }
      : { task: secondTask, runs: [{ id: 'run-3', status: 'cancelled', attemptNumber: 1, receipt: null }] }))
    const wrapper = mountCrawler()
    await flushPromises()
    expect(wrapper.text()).toContain('任务历史')
    expect(wrapper.text()).toContain('Provider 摘要')
    expect(wrapper.text()).toContain('全部 attempt')
    await wrapper.get('button.load-more').trigger('click')
    await flushPromises()
    expect(api.admin.listCrawlerTasks).toHaveBeenCalledWith({ template: 'movie', cursor: 'cursor-1', limit: 20 })
    expect(wrapper.text()).toContain('task-2')
  })
})
