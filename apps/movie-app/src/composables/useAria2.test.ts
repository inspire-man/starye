import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useAria2 } from './useAria2'

// Mock useToast
vi.mock('./useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

describe('useAria2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('状态管理', () => {
    it('应该提供必要的响应式状态', () => {
      const aria2 = useAria2()

      expect(aria2.config).toBeDefined()
      expect(aria2.tasks).toBeDefined()
      expect(aria2.isConnected).toBeDefined()
      expect(aria2.isLoading).toBeDefined()
      expect(aria2.version).toBeDefined()
    })

    it('应该初始化为未连接状态', () => {
      const { isConnected, config } = useAria2()

      expect(isConnected.value).toBe(false)
      expect(config.value).toBeNull()
    })

    it('应该初始化为空任务列表', () => {
      const { tasks } = useAria2()

      expect(tasks.value).toEqual([])
    })
  })

  describe('API 方法', () => {
    it('应该提供所有必要的方法', () => {
      const aria2 = useAria2()

      expect(typeof aria2.loadConfig).toBe('function')
      expect(typeof aria2.saveConfig).toBe('function')
      expect(typeof aria2.testConnection).toBe('function')
      expect(typeof aria2.addMagnetTask).toBe('function')
      expect(typeof aria2.addMagnetTasks).toBe('function')
      expect(typeof aria2.pauseTask).toBe('function')
      expect(typeof aria2.unpauseTask).toBe('function')
      expect(typeof aria2.removeTask).toBe('function')
      expect(typeof aria2.refreshTasks).toBe('function')
      expect(typeof aria2.pauseAllTasks).toBe('function')
      expect(typeof aria2.unpauseAllTasks).toBe('function')
      expect(typeof aria2.getGlobalStats).toBe('function')
    })
  })

  describe('错误处理', () => {
    it('应该在未配置时抛出错误', async () => {
      const { addMagnetTask, config } = useAria2()
      config.value = null

      await expect(
        addMagnetTask('magnet:?xt=urn:btih:test'),
      ).rejects.toThrow('未配置')
    })
  })
})
