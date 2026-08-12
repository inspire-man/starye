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
    const task = { id: 'task-poll', template_key: 'movie', latest_run_id: 'run-poll' }
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
    expect(api.admin.getCrawlerTask.mock.calls.length).toBeGreaterThan(initialDetails)
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
    expect(api.admin.getCrawlerTask.mock.calls.length).toBeGreaterThan(hiddenDetailCount)
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

  it('keeps lifecycle separate from execution and renders bounded availability, history and audit facts', async () => {
    const task = {
      id: 'task-availability',
      lifecycle: { changedAt: 100, status: 'active', version: 0 },
      latestRunId: 'run-availability',
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
    api.admin.getCrawlerTaskAudit.mockResolvedValue({
      audits: [{ action: 'UPDATE', actor: { email: 'admin@example.test', id: 'admin-1' }, createdAt: 220, id: 'audit-1', outcome: 'updated', reason: 'metadata_update', runId: 'run-availability' }],
      nextCursor: null,
    })
    const wrapper = mountCrawler()
    await flushPromises()

    expect(wrapper.find('[data-section="task-lifecycle"]').exists()).toBe(true)
    expect(wrapper.find('[data-evidence-section="availability"]').exists()).toBe(true)
    expect(wrapper.find('[data-availability-current]').text()).toContain('available')
    expect(wrapper.find('[data-availability-history]').text()).toContain('duplicate')
    expect(wrapper.findAll('[data-video-layer]').map(row => row.attributes('data-video-layer'))).toEqual(['metadata', 'direct', 'magnet', 'playback'])
    expect(wrapper.get('[data-video-layer="direct"]').text()).toContain('available：1')
    expect(wrapper.get('[data-video-layer="direct"]').text()).toContain('abnormal：2')
    expect(wrapper.get('[data-video-layer="direct"]').text()).toContain('direct_transport_failed')
    expect(wrapper.get('[data-video-layer="direct"]').text()).toContain('重新检查')
    expect(wrapper.get('[data-video-layer="direct"] [data-video-history]').text()).toContain('revision 2')
    expect(wrapper.get('[data-video-layer="magnet"]').text()).toContain('配置 provider')
    expect(wrapper.get('[data-video-layer="playback"]').text()).toContain('playback_unverified')
    expect(wrapper.get('[data-video-layer="playback"]').text()).toContain('重新检查')
    expect(wrapper.find('[data-evidence-section="audit"]').text()).toContain('metadata_update')
    expect(wrapper.find('[data-section="task-lifecycle"]').text()).toContain('active')
    expect(wrapper.text()).not.toContain('signed_url')
    expect(wrapper.text()).not.toContain('rawresponse')
  })

  it('posts allowlisted metadata and lifecycle actions, then reloads authoritative detail', async () => {
    const task = { id: 'task-actions', latestRunId: 'run-actions', templateKey: 'movie', lifecycle: { changedAt: 100, status: 'active', version: 0 } }
    api.admin.listCrawlerTasks.mockImplementation(({ template }: { template: string }) => Promise.resolve({ tasks: template === 'movie' ? [task] : [], nextCursor: null }))
    api.admin.getCrawlerTask.mockResolvedValue({ lifecycle: task.lifecycle, task, runs: [{ id: 'run-actions', status: 'succeeded', attemptNumber: 1, receipt: null }] })
    const wrapper = mountCrawler()
    await flushPromises()

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

  it('keeps the video availability command on the typed admin boundary', async () => {
    const command = { idempotencyKey: 'video:movie-1:7:stale', movieId: 'movie-1', movieRevision: 3, policyVersion: 'video-source-probe/v1', reason: 'stale' as const, sourceRevision: 7 }
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
    const rendered = wrapper.text()

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

    expect(wrapper.text()).toContain(label)
    expect(wrapper.text()).toContain(action)
    expect(wrapper.text()).toContain('受控原因')
    if (disposition === 'repairing')
      expect(wrapper.text()).not.toContain('查看修复意图')
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
    await wrapper.get('[data-repair-action="open"]').trigger('click')

    expect(api.admin.repairPlayers).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('movie-sun-064')
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
    expect(wrapper.text()).toContain('修复原因：no_source')
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

    expect(wrapper.get('a').attributes('href')).toBe('/movie/SUN-064')
    expect(wrapper.text()).toContain('打开影片')
    expect(wrapper.text()).toContain(`终态原因：${failureCode}`)
    expect(wrapper.text()).toContain('source revision：9')
    expect(wrapper.text()).toContain('允许创建新的修复任务')
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

    expect(wrapper.findAll('[data-source-row]')).toHaveLength(3)
    expect(wrapper.text()).toContain('direct')
    expect(wrapper.text()).toContain('magnet')
    expect(wrapper.text()).toContain('TorrServer')
    expect(wrapper.text()).toContain('unverified')
    expect(wrapper.text()).toContain('failed')
    expect(wrapper.text()).toContain('inactive')
    expect(wrapper.text()).toContain('200')
    expect(wrapper.text()).toContain('source_read_failed')
    expect(wrapper.text()).toContain('下一步：暂无下一步')
    expect(wrapper.get('a').attributes('href')).toBe('/movie/SUN-064')
    expect(wrapper.find('[data-source-row="TorrServer"] [data-source-action]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('RAW_RUNNER_SENTINEL')
    expect(wrapper.html()).not.toContain('RAW_SOURCE_SENTINEL')
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
    expect(wrapper.text()).toContain('Repair Movie')
    expect(wrapper.text()).toContain('当前电影已有活动修复任务')
    expect(wrapper.text()).toContain('Provider 运行中')
    expect(wrapper.text()).toContain('修复待校验')
    expect(wrapper.text()).toContain('receipt 待验证')
    expect(wrapper.text()).toContain('repairing · 修复进行中')
    expect(wrapper.text()).toContain('Authoritative source readback')
    expect(wrapper.text()).toContain('等待浏览器证据')
    expect(wrapper.text()).toContain('旧 attempt 历史（1）')
    expect(wrapper.text()).not.toContain('stale_event')

    await wrapper.get('.history-toggle').trigger('click')
    expect(wrapper.text()).toContain('stale_event')
    expect(wrapper.text()).toContain('Provider 已完成 · failure')
    expect(wrapper.get('a.provider-run-link').attributes('href')).toBe('https://github.com/inspire-man/starye/actions/runs/123')
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

    expect(wrapper.text()).toContain('run fresh-run-2')
    expect(wrapper.text()).toContain('content ID：movie-fresh')
    expect(wrapper.text()).toContain('target：selected-production')
    expect(wrapper.find('[data-evidence-block="provider"]').exists()).toBe(true)
    expect(wrapper.find('[data-evidence-block="repair-receipt"]').exists()).toBe(true)
    expect(wrapper.find('[data-evidence-block="source"]').exists()).toBe(true)
    expect(wrapper.find('[data-evidence-block="actual-playback"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('canplay：已观察 · 301')
    expect(wrapper.text()).toContain('playing：已观察 · 302')
    expect(wrapper.text()).toContain('waiting：未观察')
    expect(wrapper.text()).toContain('currentTimeBefore：1')
    expect(wrapper.text()).toContain('currentTimeAfter：2.5')
    expect(wrapper.text()).toContain('delta：1.5')
    expect(wrapper.text()).toContain('已写入脱敏 JSON/Markdown')
    expect(wrapper.text()).toContain('duplicate · content ID：movie-fresh')
    expect(wrapper.get('a.readiness-link').text()).toContain('打开影片')
    expect(wrapper.get('a.readiness-link').attributes('href')).toBe('/movie/SUN-064')
    expect(wrapper.text()).not.toContain('overall success')
    expect(wrapper.html()).not.toContain('source.example/raw')
    expect(wrapper.html()).not.toContain('TOKEN_SENTINEL')
    expect(wrapper.html()).not.toContain('COOKIE_SENTINEL')
    expect(wrapper.html()).not.toContain('RUNNER_SENTINEL')

    await wrapper.get('.history-toggle').trigger('click')
    expect(wrapper.text()).toContain('playback rejection：late')
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
    expect(wrapper.text()).toContain('run poll-run-1')
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(wrapper.text()).toContain('run poll-run-2')
    expect(wrapper.text()).toContain('旧 attempt 历史（1）')
    expect(wrapper.text()).toContain('Actual playback')
    expect(wrapper.text()).toContain('暂无来源观察')
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
    await wrapper.get('.task-card').trigger('click')
    expect(wrapper.text()).toContain('Pending Repair')
    expect(wrapper.text()).toContain('等待 attempt 上报')
    expect(wrapper.text()).toContain('等待 lease 对账')
  })

  it('locks the ordinary movie repair CTA when a same-movie active repair task is present', async () => {
    const movieTask = {
      id: 'movie-task',
      latest_run_id: 'movie-run',
      template_key: 'movie',
    }
    const repairTask = {
      allowedNextAction: 'wait_for_observation',
      id: 'repair-task',
      latest_run_id: 'repair-run',
      movie: { code: 'SUN-064', id: 'movie-1', title: 'Repair Movie' },
      operation: 'repair_players',
      sourceRevision: 5,
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
    const repairButton = wrapper.find('[data-repair-action="open"]')
    expect(repairButton.exists()).toBe(true)
    expect(repairButton.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('当前电影已有活动修复任务')
  })
})
