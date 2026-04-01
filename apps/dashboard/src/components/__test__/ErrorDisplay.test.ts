/**
 * ErrorDisplay.vue 组件测试
 */

import type { ParsedError } from '@/composables/useErrorHandler'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ErrorDisplay from '../ErrorDisplay.vue'

describe('errorDisplay.vue', () => {
  const mockError: ParsedError = {
    type: 'network',
    message: '网络连接失败',
    originalError: new Error('网络连接失败'),
  }

  describe('展示模式', () => {
    it('应该渲染 inline 模式', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: mockError,
          mode: 'inline',
        },
      })

      expect(wrapper.html()).toContain('border-l-4')
      expect(wrapper.html()).toContain('border-red-500')
      expect(wrapper.attributes('role')).toBe('alert')
    })

    it('应该渲染 banner 模式', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: mockError,
          mode: 'banner',
        },
      })

      expect(wrapper.html()).toContain('border-red-500')
      expect(wrapper.html()).toContain('bg-red-50')
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('应该渲染 modal 模式', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: mockError,
          mode: 'modal',
        },
      })

      expect(wrapper.find('.fixed.inset-0').exists()).toBe(true)
      expect(wrapper.find('.bg-black\\/50').exists()).toBe(true)
    })

    it('默认应该使用 inline 模式', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: mockError,
        },
      })

      expect(wrapper.html()).toContain('border-l-4')
    })
  })

  describe('操作按钮', () => {
    it('网络错误应该显示重试按钮', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: { type: 'network', message: '网络错误' },
          mode: 'banner',
        },
      })

      expect(wrapper.text()).toContain('重试')
    })

    it('权限错误应该显示返回登录按钮', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: { type: 'permission', message: '权限不足' },
          mode: 'modal',
        },
      })

      expect(wrapper.text()).toContain('返回登录')
    })

    it('服务器错误应该显示联系支持按钮', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: { type: 'server', message: '服务器错误' },
          mode: 'modal',
        },
      })

      expect(wrapper.text()).toContain('联系支持')
    })

    it('点击重试按钮应该触发 retry 事件', async () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: { type: 'network', message: '网络错误' },
          mode: 'banner',
        },
      })

      const retryButton = wrapper.findAll('button').find(btn => btn.text().includes('重试'))
      await retryButton?.trigger('click')

      expect(wrapper.emitted('retry')).toBeTruthy()
    })

    it('点击关闭按钮应该触发 close 事件', async () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: mockError,
          mode: 'banner',
        },
      })

      const closeButton = wrapper.findAll('button').find(btn => btn.text().includes('关闭'))
      await closeButton?.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('aRIA 属性', () => {
    it('应该包含 role="alert"', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: mockError,
          mode: 'inline',
        },
      })

      expect(wrapper.attributes('role')).toBe('alert')
    })
  })

  describe('消息显示', () => {
    it('应该显示错误消息', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: { type: 'network', message: '自定义错误消息' },
          mode: 'banner',
        },
      })

      expect(wrapper.text()).toContain('自定义错误消息')
    })
  })

  describe('modal 模式交互', () => {
    it('modal 遮罩应该是半透明黑色', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: mockError,
          mode: 'modal',
        },
      })

      const overlay = wrapper.find('.fixed.inset-0.bg-black\\/50')
      expect(overlay.exists()).toBe(true)
    })

    it('modal 内容应该居中显示', () => {
      const wrapper = mount(ErrorDisplay, {
        props: {
          error: mockError,
          mode: 'modal',
        },
      })

      expect(wrapper.find('.flex.items-center.justify-center').exists()).toBe(true)
    })
  })
})
