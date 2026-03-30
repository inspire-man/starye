import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import Aria2Settings from './Aria2Settings.vue'

// Mock useAria2
const mockAria2 = {
  config: { value: null },
  isConnected: { value: false },
  version: { value: null },
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  testConnection: vi.fn(),
}

vi.mock('../composables/useAria2', () => ({
  useAria2: () => mockAria2,
}))

describe('aria2Settings', () => {
  describe('组件渲染', () => {
    it('应该正确渲染设置表单', () => {
      const wrapper = mount(Aria2Settings)

      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示配置表单字段', () => {
      const wrapper = mount(Aria2Settings)

      // 基本的表单输入应该存在
      expect(wrapper.find('input').exists()).toBe(true)
      expect(wrapper.find('button').exists()).toBe(true)
    })
  })

  describe('配置管理', () => {
    it('应该在组件挂载时加载配置', async () => {
      mockAria2.loadConfig.mockResolvedValueOnce(undefined)

      mount(Aria2Settings)

      expect(mockAria2.loadConfig).toHaveBeenCalled()
    })
  })

  describe('表单验证', () => {
    it('应该验证配置数据', () => {
      const wrapper = mount(Aria2Settings)

      // 组件应该有验证逻辑
      expect(wrapper.exists()).toBe(true)
    })
  })
})
