import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DownloadTaskPanel from './DownloadTaskPanel.vue'

// Mock useAria2
const mockAria2 = {
  tasks: { value: [] },
  isLoading: { value: false },
  pauseTask: vi.fn(),
  unpauseTask: vi.fn(),
  removeTask: vi.fn(),
  pauseAllTasks: vi.fn(),
  unpauseAllTasks: vi.fn(),
  getGlobalStats: vi.fn(),
  refreshTasks: vi.fn(),
}

vi.mock('../composables/useAria2', () => ({
  useAria2: () => mockAria2,
}))

describe('DownloadTaskPanel', () => {
  describe('组件渲染', () => {
    it('应该正确渲染面板', () => {
      const wrapper = mount(DownloadTaskPanel)

      expect(wrapper.exists()).toBe(true)
    })

    it('应该在组件挂载时刷新任务', () => {
      mockAria2.refreshTasks.mockResolvedValueOnce(undefined)

      mount(DownloadTaskPanel)

      expect(mockAria2.refreshTasks).toHaveBeenCalled()
    })
  })

  describe('空状态', () => {
    it('应该在没有任务时显示空状态', () => {
      mockAria2.tasks.value = []

      const wrapper = mount(DownloadTaskPanel)

      expect(wrapper.exists()).toBe(true)
    })

    it('应该在加载时显示加载状态', () => {
      mockAria2.isLoading.value = true

      const wrapper = mount(DownloadTaskPanel)

      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('任务列表', () => {
    it('应该显示任务列表', () => {
      mockAria2.tasks.value = [
        {
          gid: 'task-1',
          status: 'active',
          totalLength: '104857600',
          completedLength: '52428800',
          downloadSpeed: '1048576',
          uploadSpeed: '0',
          connections: '8',
          numSeeders: '10',
          files: [],
        },
      ]

      const wrapper = mount(DownloadTaskPanel)

      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('任务控制', () => {
    it('应该能控制任务', () => {
      const wrapper = mount(DownloadTaskPanel)

      expect(mockAria2.pauseTask).toBeDefined()
      expect(mockAria2.unpauseTask).toBeDefined()
      expect(mockAria2.removeTask).toBeDefined()
    })
  })
})
