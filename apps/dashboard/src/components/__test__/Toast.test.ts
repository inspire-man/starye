/**
 * Toast.vue 组件测试
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ProgressToast, Toast as ToastType } from '@/composables/useToast'
import Toast from '../Toast.vue'

describe('Toast.vue', () => {
  describe('渲染', () => {
    it('应该渲染 success 类型的 Toast', () => {
      const toast: ToastType = {
        id: '1',
        type: 'success',
        message: '操作成功',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.text()).toContain('操作成功')
      expect(wrapper.find('[role="status"]').exists()).toBe(true)
      expect(wrapper.html()).toContain('bg-green-600')
    })

    it('应该渲染 error 类型的 Toast', () => {
      const toast: ToastType = {
        id: '2',
        type: 'error',
        message: '操作失败',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.text()).toContain('操作失败')
      expect(wrapper.html()).toContain('bg-red-600')
    })

    it('应该渲染 warning 类型的 Toast', () => {
      const toast: ToastType = {
        id: '3',
        type: 'warning',
        message: '警告提示',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.text()).toContain('警告提示')
      expect(wrapper.html()).toContain('bg-orange-500')
    })

    it('应该渲染 info 类型的 Toast', () => {
      const toast: ToastType = {
        id: '4',
        type: 'info',
        message: '信息提示',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.text()).toContain('信息提示')
      expect(wrapper.html()).toContain('bg-blue-600')
    })
  })

  describe('关闭按钮', () => {
    it('closable 为 true 时应该显示关闭按钮', () => {
      const toast: ToastType = {
        id: '1',
        type: 'success',
        message: '测试',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('closable 为 false 时不应该显示关闭按钮', () => {
      const toast: ToastType = {
        id: '1',
        type: 'success',
        message: '测试',
        closable: false,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.find('button').exists()).toBe(false)
    })

    it('点击关闭按钮应该触发 close 事件', async () => {
      const toast: ToastType = {
        id: '1',
        type: 'success',
        message: '测试',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      await wrapper.find('button').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close')?.[0]).toEqual(['1'])
    })
  })

  describe('Progress Toast', () => {
    it('应该显示进度条', () => {
      const toast: ProgressToast = {
        id: '1',
        type: 'info',
        message: '上传中...',
        closable: false,
        progress: 50,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.text()).toContain('50%')
      expect(wrapper.text()).toContain('进度')
    })

    it('进度条宽度应该根据 progress 变化', () => {
      const toast: ProgressToast = {
        id: '1',
        type: 'info',
        message: '上传中...',
        closable: false,
        progress: 75,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.html()).toContain('75%')
    })
  })

  describe('动画效果', () => {
    it('应该包含 transition 类', () => {
      const toast: ToastType = {
        id: '1',
        type: 'success',
        message: '测试',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.classes()).toContain('transition-all')
    })
  })

  describe('响应式设计', () => {
    it('应该包含响应式类', () => {
      const toast: ToastType = {
        id: '1',
        type: 'success',
        message: '测试',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.classes()).toContain('w-full')
      expect(wrapper.html()).toContain('sm:w-auto')
    })
  })

  describe('无障碍性', () => {
    it('应该包含正确的 ARIA 属性', () => {
      const toast: ToastType = {
        id: '1',
        type: 'success',
        message: '操作成功',
        closable: true,
      }

      const wrapper = mount(Toast, {
        props: { toast },
      })

      expect(wrapper.attributes('role')).toBe('status')
      expect(wrapper.attributes('aria-label')).toContain('success notification')
    })
  })
})
