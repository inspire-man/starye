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
      getCrawlerTaskAudit: vi.fn(),
      createCrawlerTask: vi.fn(),
      repairPlayers: vi.fn(),
      cancelCrawlerRun: vi.fn(),
      retryCrawlerRun: vi.fn(),
      updateCrawlerTask: vi.fn(),
      archiveCrawlerTask: vi.fn(),
      supersedeCrawlerTask: vi.fn(),
      submitVideoAvailabilityCommand: vi.fn(),
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

  const openTaskDetails = async (wrapper: any, taskId?: string) => {
    const rows = wrapper.findAll('tbody tr')
    const row = taskId
      ? rows.find((candidate: any) => candidate.text().includes(taskId))
      : rows[0]
    expect(row).toBeDefined()
    await row.trigger('click')
    await flushPromises()
  }

  const bodyText = () => document.body.textContent ?? ''
  const bodyQuery = <T extends Element = Element>(selector: string) => document.body.querySelector<T>(selector)
  const bodyQueryAll = (selector: string) => Array.from(document.body.querySelectorAll(selector))
  const clickBody = async (selector: string) => {
    const element = bodyQuery<HTMLElement>(selector)
    expect(element).not.toBeNull()
    element!.click()
    await flushPromises()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    api.admin.getCrawlerStats.mockResolvedValue({ comics: {}, movies: {} })
    api.admin.getFailedTasks.mockResolvedValue({ comics: { total: 0 }, movies: { total: 0 } })
    api.admin.listCrawlerTasks.mockResolvedValue({ tasks: [] })
    api.admin.getCrawlerTask.mockResolvedValue({ task: null, runs: [] })
    api.admin.getCrawlerTaskLogs.mockResolvedValue({ logs: [], nextCursor: null })
    api.admin.getCrawlerTaskAudit.mockResolvedValue({ audits: [], nextCursor: null })
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
    await wrapper.get('button.task-tab:not(.task-tab-active)').trigger('click')
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
    const task = {
      id: 'task-poll',
      latest_run_id: 'run-poll',
      latestRun: { attemptNumber: 1, createdAt: 100, failureCode: null, id: 'run-poll', status: 'running', terminalAt: null, updatedAt: 100 },
      template_key: 'movie',
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{ id: 'run-poll', status: 'running', attemptNumber: 1, receipt: null }],
    })
    const wrapper = mountCrawler()
    await flushPromises()
    const initial = api.admin.listCrawlerTasks.mock.calls.length
    const initialDetails = api.admin.getCrawlerTask.mock.calls.length
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(api.admin.listCrawlerTasks.mock.calls.length).toBeGreaterThan(initial)
    expect(api.admin.getCrawlerTask.mock.calls.length).toBe(initialDetails)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    const hiddenCount = api.admin.listCrawlerTasks.mock.calls.length
    const hiddenDetailCount = api.admin.getCrawlerTask.mock.calls.length
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(api.admin.listCrawlerTasks.mock.calls.length).toBe(hiddenCount)
    expect(api.admin.getCrawlerTask.mock.calls.length).toBe(hiddenDetailCount)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(api.admin.listCrawlerTasks.mock.calls.length).toBeGreaterThan(hiddenCount)
    expect(api.admin.getCrawlerTask.mock.calls.length).toBe(hiddenDetailCount)
    wrapper.unmount()
    const afterUnmount = api.admin.listCrawlerTasks.mock.calls.length
    vi.advanceTimersByTime(10000)
    expect(api.admin.listCrawlerTasks.mock.calls.length).toBe(afterUnmount)
  })

  it('keeps server status until confirmed cancel and retry responses refresh it', async () => {
    let runStatus: 'running' | 'cancelled' = 'running'
    const task = { id: 'task-1', template_key: 'movie', latest_run_id: 'run-1' }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie'
        ? [{
            ...task,
            latestRun: { attemptNumber: 1, createdAt: 100, failureCode: null, id: 'run-1', status: runStatus, terminalAt: runStatus === 'cancelled' ? 200 : null, updatedAt: 100 },
          }]
        : [],
    }))
    api.admin.cancelCrawlerRun.mockImplementation(async () => {
      runStatus = 'cancelled'
    })
    const wrapper = mountCrawler()
    await flushPromises()
    await wrapper.get('button[title="取消任务"]').trigger('click')
    await (wrapper.vm as any).confirmCancel()
    expect(api.admin.cancelCrawlerRun).toHaveBeenCalledWith('task-1', 'run-1')

    await (wrapper.vm as any).loadTaskPanel()
    await flushPromises()
    await wrapper.get('button[title="重试任务"]').trigger('click')
    await (wrapper.vm as any).confirmRetry()
    expect(api.admin.retryCrawlerRun).toHaveBeenCalledWith('task-1', 'run-1')
  })

  it('keeps lifecycle separate from execution and renders bounded availability, history and audit facts', async () => {
    const task = {
      id: 'task-availability',
      lifecycle: { changedAt: 100, status: 'active', version: 0 },
      latestRunId: 'run-availability',
      movie: { id: 'movie-1', title: 'Availability fixture' },
      templateKey: 'movie',
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      lifecycle: task.lifecycle,
      availability: {
        current: {
          attemptNumber: 1,
          contentId: 'content-1',
          eventSequence: 2,
          freshness: 'fresh',
          nextAction: 'none',
          observationIdentity: 'availability-current',
          observedAt: 200,
          policyVersion: 'v1',
          projectionVersion: 2,
          provider: 'github-actions',
          reasonCode: 'available',
          runId: 'run-availability',
          sourceRevision: 3,
          status: 'available',
          summary: { counts: { ready: 1 }, samples: [{ code: 'transport_ok', count: 1 }] },
          target: { id: 'movie-1', kind: 'movie' },
          taskId: 'task-availability',
        },
        history: [
          { kind: 'duplicate', observation: null, reason: 'exact_replay' },
          { kind: 'late', observation: { observationIdentity: 'late-1', observedAt: 150, sourceRevision: 2, status: 'unknown', freshness: 'late' }, reason: 'run_is_late_or_cancelled' },
        ],
        layers: {
          metadata: { current: { layer: 'metadata', status: 'available', reason: null, freshness: 'fresh', observedAt: 200, policyVersion: 'video-source-probe/v1', sourceRevision: 3, summary: { counts: { persisted: 1 }, samples: [] } }, history: [] },
          direct: { current: { layer: 'direct', status: 'degraded', reason: 'direct_transport_failed', freshness: 'fresh', observedAt: 201, policyVersion: 'video-source-probe/v1', sourceRevision: 3, summary: { counts: { available: 1, abnormal: 2 }, samples: [{ code: 'range_failed', count: 2 }] } }, history: [{ layer: 'direct', status: 'available', reason: null, freshness: 'stale', observedAt: 150, policyVersion: 'video-source-probe/v1', sourceRevision: 2, summary: { counts: { available: 1 }, samples: [] } }] },
          magnet: { current: { layer: 'magnet', status: 'degraded', reason: 'provider_unconfigured', freshness: 'fresh', observedAt: 202, policyVersion: 'video-source-probe/v1', sourceRevision: 3, summary: { counts: { checked: 1 }, samples: [] } }, history: [] },
          playback: { current: { layer: 'playback', status: 'unknown', reason: 'playback_unverified', freshness: 'fresh', observedAt: 203, policyVersion: 'video-source-probe/v1', sourceRevision: 3, summary: { counts: { evidence: 1 }, samples: [] } }, history: [] },
        },
      },
      task,
      runs: [{ id: 'run-availability', status: 'succeeded', attemptNumber: 1, receipt: null }],
    })
    api.admin.submitVideoAvailabilityCommand.mockResolvedValue({
      kind: 'created',
      run: { attemptNumber: 1, id: 'video-run', status: 'queued', taskId: 'task-availability' },
    })
    api.admin.getCrawlerTaskAudit.mockResolvedValue({
      audits: [{ action: 'UPDATE', actor: { email: 'admin@example.test', id: 'admin-1' }, createdAt: 220, id: 'audit-1', outcome: 'updated', reason: 'metadata_update', runId: 'run-availability' }],
      nextCursor: null,
    })
    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)

    expect(bodyQuery('[data-section="task-lifecycle"]')).not.toBeNull()
    expect(bodyQuery('[data-evidence-section="availability"]')).not.toBeNull()
    expect(bodyQuery('[data-availability-current]')?.textContent).toContain('available')
    expect(bodyQuery('[data-availability-history]')?.textContent).toContain('duplicate')
    expect(bodyQueryAll('[data-video-layer]').map(row => row.getAttribute('data-video-layer'))).toEqual(['metadata', 'direct', 'magnet', 'playback'])
    expect(bodyQuery('[data-video-layer="direct"]')?.textContent).toContain('available：1')
    expect(bodyQuery('[data-video-layer="direct"]')?.textContent).toContain('abnormal：2')
    expect(bodyQuery('[data-video-layer="direct"]')?.textContent).toContain('direct_transport_failed')
    expect(bodyQuery('[data-video-layer="direct"]')?.textContent).toContain('重新检查')
    expect(bodyQuery('[data-video-layer="direct"] [data-video-history]')?.textContent).toContain('revision 2')
    expect(bodyQuery('[data-video-layer="magnet"]')?.textContent).toContain('配置 provider')
    expect(bodyQuery('[data-video-layer="playback"]')?.textContent).toContain('playback_unverified')
    expect(bodyQuery('[data-video-layer="playback"]')?.textContent).toContain('重新检查')
    expect(bodyQuery('[data-evidence-section="audit"]')?.textContent).toContain('metadata_update')
    expect(bodyQuery('[data-section="task-lifecycle"]')?.textContent).toContain('active')
    expect(bodyText()).not.toContain('signed_url')
    expect(bodyText()).not.toContain('rawresponse')

    await (wrapper.vm as any).askVideoAvailabilityAction((wrapper.vm as any).selectedRun.task, 'direct')
    await (wrapper.vm as any).confirmVideoAvailabilityAction()
    const firstKey = api.admin.submitVideoAvailabilityCommand.mock.calls[0]?.[0]?.idempotencyKey
    expect(firstKey).toMatch(/^dashboard:video-availability:[0-9a-f-]{36}$/u)

    await (wrapper.vm as any).askVideoAvailabilityAction((wrapper.vm as any).selectedRun.task, 'direct')
    await (wrapper.vm as any).confirmVideoAvailabilityAction()
    const secondKey = api.admin.submitVideoAvailabilityCommand.mock.calls[1]?.[0]?.idempotencyKey
    expect(secondKey).toMatch(/^dashboard:video-availability:[0-9a-f-]{36}$/u)
    expect(secondKey).not.toBe(firstKey)
  })

  it('posts allowlisted metadata and lifecycle actions, then reloads authoritative detail', async () => {
    const task = {
      id: 'task-actions',
      latestRunId: 'run-actions',
      latestRun: { attemptNumber: 1, createdAt: 100, failureCode: null, id: 'run-actions', status: 'succeeded', terminalAt: 200, updatedAt: 200 },
      templateKey: 'movie',
      lifecycle: { changedAt: 100, status: 'active', version: 0 },
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({ tasks: template === 'movie' ? [task] : [], nextCursor: null }))
    api.admin.getCrawlerTask.mockResolvedValue({ lifecycle: task.lifecycle, task, runs: [{ id: 'run-actions', status: 'succeeded', attemptNumber: 1, receipt: null }] })
    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)

    await (wrapper.vm as any).openMetadataEdit(task)
    await (wrapper.vm as any).saveMetadata()
    expect(api.admin.updateCrawlerTask).toHaveBeenCalledWith('task-actions', { intent: 'movie' })

    await (wrapper.vm as any).askArchive(task)
    await (wrapper.vm as any).confirmArchive()
    expect(api.admin.archiveCrawlerTask).toHaveBeenCalledWith('task-actions')

    await (wrapper.vm as any).askSupersede(task)
    await (wrapper.vm as any).confirmSupersede()
    expect(api.admin.supersedeCrawlerTask).toHaveBeenCalledWith('task-actions', expect.objectContaining({
      idempotencyKey: 'dashboard:supersede:task-actions',
      operation: 'movie',
      policyReference: 'dashboard/crawler-task-supersede',
      policyVersion: 'v1',
      target: { id: 'task-actions', kind: 'movie' },
    }))
    expect(api.admin.getCrawlerTask).toHaveBeenCalled()
  })

  it('shows an archive icon for terminal tasks and archives from the table action column', async () => {
    const task = {
      id: 'terminal-task',
      latestRunId: 'terminal-run',
      latestRun: { attemptNumber: 1, createdAt: 100, failureCode: null, id: 'terminal-run', status: 'succeeded', terminalAt: 200, updatedAt: 200 },
      templateKey: 'movie',
      lifecycle: { changedAt: 100, status: 'active', version: 0 },
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{ id: 'terminal-run', status: 'succeeded', attemptNumber: 1, receipt: null }],
    })

    const wrapper = mountCrawler()
    await flushPromises()

    const archiveButton = wrapper.get('button[title="删除任务（归档）"]')
    expect(archiveButton.find('svg').exists()).toBe(true)
    await archiveButton.trigger('click')
    await (wrapper.vm as any).confirmArchive()

    expect(api.admin.archiveCrawlerTask).toHaveBeenCalledWith('terminal-task')
  })

  it('keeps the video availability command on the typed admin boundary', async () => {
    const command = { idempotencyKey: 'video:movie-1:7:stale', movieId: 'movie-1', reason: 'stale' as const }
    api.admin.submitVideoAvailabilityCommand.mockResolvedValue({ kind: 'duplicate', run: { id: 'run-1' } })

    await api.admin.submitVideoAvailabilityCommand(command)

    expect(api.admin.submitVideoAvailabilityCommand).toHaveBeenCalledWith(command)
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
    await openTaskDetails(wrapper)
    expect(bodyText()).toContain('管理电影内容')
    expect(bodyQuery<HTMLAnchorElement>('a')?.getAttribute('href')).toBe('/dashboard/movies?receipt=movie-1&sourceAttempt=1&sourceRun=run-1&sourceTask=task-1')
    bodyQuery<HTMLButtonElement>('button.load-more')?.click()
    await flushPromises()
    expect(bodyText()).toContain('完成')
    expect(bodyText()).toContain('开始')
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
    await openTaskDetails(wrapper)
    expect(bodyText()).toContain('旧 attempt 历史')
    expect(bodyText()).toContain('Provider 摘要')
    expect(bodyText()).toContain('全部 attempt')
    await wrapper.get('button[aria-label="下一页"]').trigger('click')
    await flushPromises()
    expect(api.admin.listCrawlerTasks).toHaveBeenCalledWith({ template: 'movie', cursor: 'cursor-1', limit: 20 })
    expect(wrapper.text()).toContain('task-2')
  })

  it('renders the readiness focal point in identity, metadata, source, playback and receipt order', async () => {
    const task = { id: 'task-sun-064', template_key: 'movie', latest_run_id: 'run-sun-064' }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{
        id: 'run-sun-064',
        status: 'succeeded',
        attemptNumber: 1,
        receipt: {
          createdCount: 0,
          primaryContentId: 'movie-sun-064',
          receiptSchemaVersion: 2,
          templateKey: 'movie',
          updatedCount: 1,
        },
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
      }],
    })

    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)
    const rendered = bodyText()

    expect(rendered).toContain('内容身份')
    expect(rendered).toContain('movie-sun-064')
    expect(rendered).toContain('Metadata persisted')
    expect(rendered).toContain('Source readiness')
    expect(rendered).toContain('暂无可用播放源')
    expect(rendered).toContain('eligible count：0')
    expect(rendered).toContain('可修复')
    expect(rendered).toContain('Playback proof')
    expect(rendered).toContain('播放未验证')
    expect(rendered).toContain('Receipt/source summary')
    expect(rendered).toContain('source revision：4')
    expect(rendered.indexOf('内容身份')).toBeLessThan(rendered.indexOf('Metadata persisted'))
    expect(rendered.indexOf('Metadata persisted')).toBeLessThan(rendered.indexOf('Source readiness'))
    expect(rendered.indexOf('Source readiness')).toBeLessThan(rendered.indexOf('Playback proof'))
    expect(rendered.indexOf('Playback proof')).toBeLessThan(rendered.indexOf('Receipt/source summary'))
    expect(rendered).not.toContain('rawRunnerField')
    expect(rendered).not.toContain('https://source.example')
  })

  it('does not show video source readiness for a manga task', async () => {
    const task = { id: 'task-manga', latest_run_id: 'run-manga', template_key: 'manga' }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'manga' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{
        id: 'run-manga',
        receipt: { createdCount: 1, primaryContentId: '1012', templateKey: 'manga', updatedCount: 0 },
        status: 'succeeded',
      }],
    })

    const wrapper = mountCrawler()
    await flushPromises()
    await wrapper.get('button.task-tab:not(.task-tab-active)').trigger('click')
    await flushPromises()
    await openTaskDetails(wrapper)

    expect(bodyText()).toContain('1012')
    expect(bodyText()).not.toContain('Source readiness')
    expect(bodyText()).not.toContain('状态读取中')
  })

  it.each([
    ['source_failed', 'source_failed', '重试读取'],
    ['repairing', 'repairing', '刷新状态'],
  ] as const)('renders bounded %s state and its controlled action', async (label, disposition, action) => {
    const task = { id: `task-${label}`, template_key: 'movie', latest_run_id: `run-${label}` }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{
        id: `run-${label}`,
        status: 'succeeded',
        attemptNumber: 1,
        receipt: { createdCount: 1, primaryContentId: 'movie-1', templateKey: 'movie', updatedCount: 0 },
        readiness: {
          metadata: { contentId: 'movie-1', observedAt: 100, persisted: true },
          playback: { status: 'unverified' },
          receipt: { persisted: true, primaryContentId: 'movie-1', schemaVersion: 2 },
          source: {
            disposition,
            eligibleCount: disposition === 'repairing' ? 0 : 0,
            observedAt: 100,
            reasonCode: disposition === 'repairing' ? 'repair_requested' : 'source_read_failed',
            repairable: true,
            sourceRevision: 5,
          },
        },
      }],
    })

    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)

    expect(bodyText()).toContain(label)
    expect(bodyText()).toContain(action)
    expect(bodyText()).toContain('受控原因')
    if (disposition === 'repairing')
      expect(bodyText()).not.toContain('查看修复意图')
  })

  it('requires confirmation before posting the fixed repair command and refreshes the task readback', async () => {
    const task = { id: 'task-sun-064', template_key: 'movie', latest_run_id: 'run-sun-064' }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{
        id: 'run-sun-064',
        status: 'succeeded',
        attemptNumber: 1,
        receipt: { createdCount: 0, primaryContentId: 'movie-sun-064', templateKey: 'movie', updatedCount: 0 },
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
      }],
    })
    api.admin.repairPlayers.mockResolvedValue({
      kind: 'created',
      task: {
        id: 'repair-task-1',
        operation: 'repair_players',
        movie: { code: 'SUN-064', id: 'movie-sun-064', title: 'SUN-064' },
        reason: 'no_source',
        sourceRevision: 4,
        targetIntent: 'restore_playable_sources',
        allowedNextAction: 'wait_for_observation',
      },
      run: { id: 'repair-run-1', status: 'queued', attemptNumber: 1 },
    })
    api.admin.getCrawlerTask.mockImplementation((taskId: string) => Promise.resolve(taskId === 'repair-task-1'
      ? {
          task: {
            allowedNextAction: 'wait_for_observation',
            id: 'repair-task-1',
            latestRunId: 'repair-run-1',
            movie: { code: 'SUN-064', id: 'movie-sun-064', title: 'SUN-064' },
            operation: 'repair_players',
            reason: 'no_source',
            sourceRevision: 4,
            targetIntent: 'restore_playable_sources',
            templateKey: 'movie',
          },
          runs: [{ id: 'repair-run-1', status: 'queued', attemptNumber: 1, receipt: null }],
        }
      : {
          task,
          runs: [{
            id: 'run-sun-064',
            status: 'succeeded',
            attemptNumber: 1,
            receipt: { createdCount: 0, primaryContentId: 'movie-sun-064', templateKey: 'movie', updatedCount: 0 },
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
          }],
        }))

    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)
    await clickBody('[data-repair-action="open"]')

    expect(api.admin.repairPlayers).not.toHaveBeenCalled()
    expect(bodyText()).toContain('movie-sun-064')
    expect(document.body.textContent).toContain('恢复可播放源')

    await (wrapper.vm as any).confirmRepair()
    await flushPromises()

    expect(api.admin.repairPlayers).toHaveBeenCalledWith({
      confirmed: true,
      movieId: 'movie-sun-064',
      reason: 'no_source',
      targetIntent: 'restore_playable_sources',
    })
    expect(api.admin.listCrawlerTasks).toHaveBeenCalled()
    expect((wrapper.vm as any).selectedRun.task.id).toBe('repair-task-1')
    expect((wrapper.vm as any).selectedRun.run.id).toBe('repair-run-1')
    expect(bodyText()).toContain('修复原因：no_source')
  })

  it.each([
    ['failed', 'source_read_failed'],
    ['cancelled', 'cancelled'],
  ] as const)('renders a same-movie link and bounded next action for repair %s terminal state', async (status, failureCode) => {
    const task = {
      allowedNextAction: 'create_new_task',
      id: `repair-${status}`,
      latest_run_id: `run-${status}`,
      movie: { code: 'SUN-064', id: 'movie-sun-064', title: 'SUN-064' },
      operation: 'repair_players',
      reason: 'source_failed',
      sourceRevision: 9,
      template_key: 'movie',
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{ id: `run-${status}`, status, attemptNumber: 2, failureCode, receipt: null }],
    })

    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)

    expect(bodyQuery<HTMLAnchorElement>('a')?.getAttribute('href')).toBe('/movie/SUN-064')
    expect(bodyText()).toContain('打开影片')
    expect(bodyText()).toContain(`终态原因：${failureCode}`)
    expect(bodyText()).toContain('source revision：9')
    expect(bodyText()).toContain('允许创建新的修复任务')
  })

  it('renders bounded source health rows and excludes raw runner fields and inactive actions', async () => {
    const task = {
      allowedNextAction: 'none',
      id: 'repair-task-1',
      latest_run_id: 'repair-run-1',
      movie: { code: 'SUN-064', id: 'movie-1', title: 'Repair Movie' },
      operation: 'repair_players',
      reason: 'no_source',
      sourceRevision: 7,
      template_key: 'movie',
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{
        id: 'repair-run-1',
        status: 'succeeded',
        attemptNumber: 2,
        failureCode: 'RAW_RUNNER_SENTINEL',
        runnerRaw: 'RAW_RUNNER_SENTINEL',
        receipt: {
          operation: 'repair_players',
          movieId: 'movie-1',
          observedAt: 200,
          sourceRevision: 7,
          sourceSummary: [
            { sourceType: 'direct', health: 'unverified', eligible: true, observedAt: 200, reasonCode: 'source_unverified' },
            { sourceType: 'magnet', health: 'failed', eligible: false, observedAt: 200, reasonCode: 'source_read_failed' },
            { sourceType: 'TorrServer', health: 'inactive', eligible: false, observedAt: 200, reasonCode: 'source_inactive' },
          ],
          rawSource: 'RAW_SOURCE_SENTINEL',
        },
      }],
    })

    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)

    expect(bodyQueryAll('[data-source-row]')).toHaveLength(3)
    expect(bodyText()).toContain('direct')
    expect(bodyText()).toContain('magnet')
    expect(bodyText()).toContain('TorrServer')
    expect(bodyText()).toContain('unverified')
    expect(bodyText()).toContain('failed')
    expect(bodyText()).toContain('inactive')
    expect(bodyText()).toContain('200')
    expect(bodyText()).toContain('source_read_failed')
    expect(bodyText()).toContain('下一步：暂无下一步')
    expect(bodyQuery<HTMLAnchorElement>('a')?.getAttribute('href')).toBe('/movie/SUN-064')
    expect(bodyQuery('[data-source-row="TorrServer"] [data-source-action]')).toBeNull()
    expect(document.body.innerHTML).not.toContain('RAW_RUNNER_SENTINEL')
    expect(document.body.innerHTML).not.toContain('RAW_SOURCE_SENTINEL')
  })

  it('pins the current attempt, keeps older attempts collapsed, and separates provider, repair, receipt, source, and playback facts', async () => {
    const task = {
      activeDuplicateLock: { locked: true, message: '当前电影已有活动修复任务，页面聚焦当前 attempt。' },
      allowedNextAction: 'wait_for_observation',
      id: 'repair-task-1',
      latest_run_id: 'repair-run-2',
      movie: { code: 'SUN-064', id: 'movie-1', title: 'Repair Movie' },
      operation: 'repair_players',
      reason: 'no_source',
      source: {
        disposition: 'repairing',
        eligibleCount: 0,
        observedAt: 200,
        reasonCode: 'repair_requested',
        repairable: true,
        rows: [],
        sourceRevision: 8,
      },
      sourceReadback: {
        disposition: 'repairing',
        eligibleCount: 0,
        observedAt: 200,
        reasonCode: 'repair_requested',
        repairable: true,
        rows: [],
        movieId: 'movie-1',
        sourceCount: 0,
        sourceRevision: 8,
      },
      sourceRevision: 8,
      template_key: 'movie',
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [task] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockResolvedValue({
      task,
      runs: [{
        id: 'repair-run-2',
        status: 'running',
        attemptNumber: 2,
        provider: {
          provider: 'github-actions',
          providerRunId: '123',
          providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/123',
          providerStatus: 'in_progress',
        },
        lease: { outcome: 'renewed', lastHeartbeatAt: 190 },
        reconciliation: { outcome: 'pending', windowStatus: 'open' },
        repair: { status: 'pending' },
        receiptValidation: { status: 'pending' },
        sourceReadback: task.sourceReadback,
        receipt: null,
      }, {
        id: 'repair-run-1',
        status: 'failed',
        attemptNumber: 1,
        failureCode: 'provider_lost',
        outcome: { outcome: 'stale', code: 'stale_event' },
        provider: { provider: 'github-actions', providerStatus: 'completed', providerConclusion: 'failure' },
        lease: { outcome: 'expired' },
        reconciliation: { outcome: 'stale', windowStatus: 'expired' },
        repair: { status: 'failed', failureCode: 'provider_lost' },
        receiptValidation: { status: 'failed', failureCode: 'receipt_missing' },
        receipt: null,
      }],
    })

    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)
    expect(bodyText()).toContain('Repair Movie')
    expect(bodyText()).toContain('当前电影已有活动修复任务')
    expect(bodyText()).toContain('Provider 运行中')
    expect(bodyText()).toContain('修复待校验')
    expect(bodyText()).toContain('receipt 待验证')
    expect(bodyText()).toContain('repairing · 修复进行中')
    expect(bodyText()).toContain('Authoritative source readback')
    expect(bodyText()).toContain('等待浏览器证据')
    expect(bodyText()).toContain('旧 attempt 历史（1）')
    expect(bodyText()).not.toContain('stale_event')

    await clickBody('.history-toggle')
    expect(bodyText()).toContain('stale_event')
    expect(bodyText()).toContain('Provider 已完成 · failure')
    expect(bodyQuery<HTMLAnchorElement>('a.provider-run-link')?.getAttribute('href')).toBe('https://github.com/inspire-man/starye/actions/runs/123')
  })

  it('promotes the server-selected current attempt and renders tuple-bound playback evidence independently', async () => {
    const task = {
      activeDuplicateLock: { locked: true, message: '当前电影已有活动修复任务，页面聚焦当前 attempt。' },
      allowedNextAction: 'none',
      id: 'fresh-task-1',
      latestRunId: 'fresh-run-2',
      movie: { code: 'SUN-064', id: 'movie-fresh', title: 'Fresh Proof Movie' },
      operation: 'repair_players',
      sameMovieIdentity: true,
      source: {
        disposition: 'ready',
        eligibleCount: 1,
        observedAt: 300,
        reasonCode: null,
        repairable: false,
        rows: [{ sourceType: 'direct', health: 'unverified', eligible: true, observedAt: 300, reasonCode: 'source_unverified' }],
        sourceRevision: 12,
      },
      sourceRevision: 12,
      templateKey: 'movie',
    }
    const currentRun = {
      id: 'fresh-run-2',
      attemptNumber: 2,
      provider: {
        provider: 'github-actions',
        providerConclusion: 'success',
        providerRunId: '456',
        providerRunUrl: 'https://github.com/inspire-man/starye/actions/runs/456',
        providerStatus: 'completed',
      },
      receipt: {
        movieId: 'movie-fresh',
        observedAt: 300,
        operation: 'repair_players',
        sourceRevision: 12,
        sourceSummary: [],
        summary: { eligibleCount: 1, sourceCount: 1 },
      },
      receiptValidation: { identityMatch: true, readbackMatch: true, status: 'validated' },
      repair: { sourceRevision: 12, status: 'validated' },
      sourceReadback: { ...task.source, movieId: 'movie-fresh', sourceCount: 1 },
      status: 'succeeded',
    }
    const oldRun = { id: 'fresh-run-1', attemptNumber: 1, outcome: { code: 'late_event', outcome: 'late' }, receipt: null, status: 'failed' }
    const playbackSummary = {
      artifact: { hash: 'a'.repeat(64), reference: 'phase-24/fresh-proof.json', stem: 'fresh-proof' },
      contentId: 'movie-fresh',
      events: [
        { event: 'canplay', observed: true, observedAt: 301 },
        { event: 'playing', observed: true, observedAt: 302 },
        { event: 'waiting', observed: false, observedAt: null },
        { event: 'stalled', observed: false, observedAt: null },
        { event: 'error', observed: false, observedAt: null },
      ],
      observedAt: 303,
      outcome: 'accepted',
      playback: { canplay: true, error: false, playing: true, progress: { currentTimeAfter: 2.5, currentTimeBefore: 1, currentTimeDelta: 1.5 }, status: 'playback_verified' },
      provider: { provider: 'github-actions', status: 'succeeded' },
      repair: { sourceRevision: 12, status: 'validated' },
      schemaVersion: 1,
      source: { revision: 12, sourceType: 'direct', status: 'ready' },
      sourceRevision: 12,
      tuple: { attemptNumber: 2, provider: 'github-actions', runId: 'fresh-run-2', taskId: 'fresh-task-1' },
      viewer: { path: '/movie/SUN-064', targetLabel: 'selected-production' },
      rawUrl: 'https://source.example/raw',
      token: 'TOKEN_SENTINEL',
      cookie: 'COOKIE_SENTINEL',
      runnerPayload: 'RUNNER_SENTINEL',
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({ tasks: template === 'movie' ? [task] : [], nextCursor: null }))
    api.admin.getCrawlerTask.mockResolvedValue({
      currentAttempt: currentRun,
      history: [oldRun],
      playbackEvidence: {
        current: { runId: 'fresh-run-2', summary: playbackSummary, rejections: [{ contentId: 'movie-fresh', observedAt: 304, outcome: 'duplicate', sourceRevision: 12, tuple: playbackSummary.tuple }] },
        history: [{ runId: 'fresh-run-1', summary: null, rejections: [{ contentId: 'movie-fresh', observedAt: 305, outcome: 'late', sourceRevision: 11, tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'fresh-run-1', taskId: 'fresh-task-1' } }] }],
      },
      runs: [currentRun, oldRun],
      task,
    })

    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)

    expect(bodyText()).toContain('run fresh-run-2')
    expect(bodyText()).toContain('content ID：movie-fresh')
    expect(bodyText()).toContain('target：selected-production')
    expect(bodyQuery('[data-evidence-block="provider"]')).not.toBeNull()
    expect(bodyQuery('[data-evidence-block="repair-receipt"]')).not.toBeNull()
    expect(bodyQuery('[data-evidence-block="source"]')).not.toBeNull()
    expect(bodyQuery('[data-evidence-block="actual-playback"]')).not.toBeNull()
    expect(bodyText()).toContain('canplay：已观察 · 301')
    expect(bodyText()).toContain('playing：已观察 · 302')
    expect(bodyText()).toContain('waiting：未观察')
    expect(bodyText()).toContain('currentTimeBefore：1')
    expect(bodyText()).toContain('currentTimeAfter：2.5')
    expect(bodyText()).toContain('delta：1.5')
    expect(bodyText()).toContain('已写入脱敏 JSON/Markdown')
    expect(bodyText()).toContain('duplicate · content ID：movie-fresh')
    expect(bodyQuery<HTMLAnchorElement>('a.readiness-link')?.textContent).toContain('打开影片')
    expect(bodyQuery<HTMLAnchorElement>('a.readiness-link')?.getAttribute('href')).toBe('/movie/SUN-064')
    expect(bodyText()).not.toContain('overall success')
    expect(document.body.innerHTML).not.toContain('source.example/raw')
    expect(document.body.innerHTML).not.toContain('TOKEN_SENTINEL')
    expect(document.body.innerHTML).not.toContain('COOKIE_SENTINEL')
    expect(document.body.innerHTML).not.toContain('RUNNER_SENTINEL')

    await clickBody('.history-toggle')
    expect(bodyText()).toContain('playback rejection：late')
  })

  it('keeps the last evidence projection while polling and promotes a new current attempt', async () => {
    const task = { id: 'poll-evidence-task', latestRunId: 'poll-run-1', movie: { code: 'SUN-064', id: 'movie-poll', title: 'Polling Proof' }, operation: 'repair_players', sameMovieIdentity: true, sourceRevision: 2, templateKey: 'movie' }
    const firstRun = { id: 'poll-run-1', attemptNumber: 1, receipt: null, status: 'running' }
    const secondRun = { id: 'poll-run-2', attemptNumber: 2, receipt: null, status: 'running' }
    const summary = {
      artifact: { hash: 'b'.repeat(64), reference: 'phase-24/poll.json', stem: 'poll' },
      contentId: 'movie-poll',
      events: [
        { event: 'canplay', observed: true, observedAt: 401 },
        { event: 'playing', observed: false, observedAt: null },
        { event: 'waiting', observed: false, observedAt: null },
        { event: 'stalled', observed: false, observedAt: null },
        { event: 'error', observed: false, observedAt: null },
      ],
      observedAt: 402,
      outcome: 'checkpoint',
      playback: { canplay: true, error: false, playing: false, progress: { currentTimeAfter: 0, currentTimeBefore: 0, currentTimeDelta: 0 }, status: 'checkpoint' },
      provider: { provider: 'github-actions', status: 'pending' },
      repair: { sourceRevision: 2, status: 'pending' },
      schemaVersion: 1,
      source: { revision: 2, sourceType: 'direct', status: 'checkpoint' },
      sourceRevision: 2,
      tuple: { attemptNumber: 1, provider: 'github-actions', runId: 'poll-run-1', taskId: 'poll-evidence-task' },
      viewer: { path: '/movie/SUN-064', targetLabel: 'selected-production' },
    }
    let details = 0
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({ tasks: template === 'movie' ? [task] : [], nextCursor: null }))
    api.admin.getCrawlerTask.mockImplementation(() => {
      details += 1
      if (details === 1) {
        return Promise.resolve({ currentAttempt: firstRun, history: [], playbackEvidence: { current: { runId: 'poll-run-1', summary, rejections: [] }, history: [] }, runs: [firstRun], task })
      }
      return Promise.resolve({ currentAttempt: secondRun, history: [firstRun], playbackEvidence: { current: null, history: [{ runId: 'poll-run-1', summary, rejections: [] }] }, runs: [secondRun, firstRun], task: { ...task, latestRunId: 'poll-run-2' } })
    })

    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)
    expect(bodyText()).toContain('run poll-run-1')
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(bodyText()).toContain('run poll-run-2')
    expect(bodyText()).toContain('旧 attempt 历史（1）')
    expect(bodyText()).toContain('Actual playback')
    expect(bodyText()).toContain('暂无来源观察')
  })

  it('renders a pending identity when a task has no reported attempt', async () => {
    const task = {
      id: 'repair-pending',
      latest_run_id: null,
      movie: { code: 'SUN-064', id: 'movie-1', title: 'Pending Repair' },
      operation: 'repair_players',
      sourceRevision: 4,
      template_key: 'movie',
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({ tasks: template === 'movie' ? [task] : [], nextCursor: null }))
    api.admin.getCrawlerTask.mockResolvedValue({ task, runs: [] })
    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper)
    expect(bodyText()).toContain('Pending Repair')
    expect(bodyText()).toContain('等待 attempt 上报')
    expect(bodyText()).toContain('等待 lease 对账')
  })

  it('locks the ordinary movie repair CTA when a same-movie active repair task is present', async () => {
    const movieTask = {
      id: 'movie-task',
      latest_run_id: 'movie-run',
      latestRun: { attemptNumber: 1, createdAt: 100, failureCode: null, id: 'movie-run', status: 'succeeded', terminalAt: 200, updatedAt: 200 },
      template_key: 'movie',
    }
    const repairTask = {
      allowedNextAction: 'wait_for_observation',
      id: 'repair-task',
      latest_run_id: 'repair-run',
      latestRun: { attemptNumber: 1, createdAt: 100, failureCode: null, id: 'repair-run', status: 'running', terminalAt: null, updatedAt: 100 },
      movie: { code: 'SUN-064', id: 'movie-1', title: 'Repair Movie' },
      operation: 'repair_players',
      sourceRevision: 5,
      target: { id: 'movie-1', kind: 'movie' },
      template_key: 'movie',
    }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({
      tasks: template === 'movie' ? [movieTask, repairTask] : [],
      nextCursor: null,
    }))
    api.admin.getCrawlerTask.mockImplementation((taskId: string) => Promise.resolve(taskId === 'movie-task'
      ? {
          task: movieTask,
          runs: [{
            id: 'movie-run',
            status: 'succeeded',
            attemptNumber: 1,
            receipt: { createdCount: 0, primaryContentId: 'movie-1', templateKey: 'movie', updatedCount: 0 },
            readiness: {
              metadata: { contentId: 'movie-1', observedAt: 100, persisted: true },
              playback: { status: 'unverified' },
              receipt: { persisted: true, primaryContentId: 'movie-1', schemaVersion: 2 },
              source: { disposition: 'no_source', eligibleCount: 0, observedAt: 100, reasonCode: 'no_eligible_source', repairable: true, sourceRevision: 5 },
            },
          }],
        }
      : {
          task: repairTask,
          runs: [{ id: 'repair-run', status: 'running', attemptNumber: 1, receipt: null }],
        }))
    const wrapper = mountCrawler()
    await flushPromises()
    await openTaskDetails(wrapper, 'movie-task')
    const repairButton = bodyQuery<HTMLButtonElement>('[data-repair-action="open"]')
    expect(repairButton).not.toBeNull()
    expect(repairButton?.disabled).toBe(true)
    expect(bodyText()).toContain('当前电影已有活动修复任务')
  })
})
