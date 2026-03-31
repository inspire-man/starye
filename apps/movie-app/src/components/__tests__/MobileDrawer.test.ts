import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MobileDrawer from '../MobileDrawer.vue'

describe('mobileDrawer 组件', () => {
  describe('基础渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: false,
          title: '测试抽屉',
        },
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('应该接受 modelValue prop', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
          title: '测试抽屉',
        },
      })

      expect(wrapper.props('modelValue')).toBe(true)
    })

    it('应该接受 title prop', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
          title: '测试标题',
        },
      })

      expect(wrapper.props('title')).toBe('测试标题')
    })
  })

  describe('props 配置', () => {
    it('应该接受 direction prop', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
          direction: 'rtl',
        },
      })

      expect(wrapper.props('direction')).toBe('rtl')
    })

    it('默认 direction 应该为 ltr', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
        },
      })

      expect(wrapper.props('direction')).toBe('ltr')
    })

    it('应该接受 size prop', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
          size: '300px',
        },
      })

      expect(wrapper.props('size')).toBe('300px')
    })

    it('默认 size 应该为 80vw', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
        },
      })

      expect(wrapper.props('size')).toBe('80vw')
    })

    it('应该接受 modal prop', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
          modal: true,
        },
      })

      expect(wrapper.props('modal')).toBe(true)
    })

    it('默认 modal 应该为 true', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
        },
      })

      expect(wrapper.props('modal')).toBe(true)
    })

    it('应该接受 closeOnClickModal prop', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
          closeOnClickModal: false,
        },
      })

      expect(wrapper.props('closeOnClickModal')).toBe(false)
    })

    it('默认 closeOnClickModal 应该为 true', () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
        },
      })

      expect(wrapper.props('closeOnClickModal')).toBe(true)
    })
  })

  describe('beforeClose 钩子', () => {
    it('应该接受 beforeClose 函数', () => {
      const beforeClose = vi.fn(() => true)
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: true,
          beforeClose,
        },
      })

      expect(wrapper.props('beforeClose')).toBe(beforeClose)
    })
  })

  describe('组件状态', () => {
    it('modelValue 变化应该触发更新', async () => {
      const wrapper = mount(MobileDrawer, {
        props: {
          modelValue: false,
        },
      })

      expect(wrapper.props('modelValue')).toBe(false)

      await wrapper.setProps({ modelValue: true })
      expect(wrapper.props('modelValue')).toBe(true)
    })
  })
})
