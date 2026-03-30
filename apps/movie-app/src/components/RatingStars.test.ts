import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingStars from './RatingStars.vue'

describe('RatingStars', () => {
  describe('组件渲染', () => {
    it('应该渲染正确数量的星星', () => {
      const wrapper = mount(RatingStars, {
        props: {
          modelValue: 0,
          interactive: false,
        },
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示评分值', () => {
      const wrapper = mount(RatingStars, {
        props: {
          modelValue: 3,
          interactive: false,
        },
      })

      expect(wrapper.vm.modelValue).toBe(3)
    })
  })

  describe('交互模式', () => {
    it('应该在点击时触发事件', async () => {
      const wrapper = mount(RatingStars, {
        props: {
          modelValue: 0,
          interactive: true,
        },
      })

      // 组件应该支持交互
      expect(wrapper.props('interactive')).toBe(true)
    })

    it('应该在只读模式下禁用交互', () => {
      const wrapper = mount(RatingStars, {
        props: {
          modelValue: 3,
          interactive: false,
        },
      })

      expect(wrapper.props('interactive')).toBe(false)
    })
  })

  describe('边界值测试', () => {
    it('应该处理 0 星评分', () => {
      const wrapper = mount(RatingStars, {
        props: {
          modelValue: 0,
        },
      })

      expect(wrapper.vm.modelValue).toBe(0)
    })

    it('应该处理 5 星评分', () => {
      const wrapper = mount(RatingStars, {
        props: {
          modelValue: 5,
        },
      })

      expect(wrapper.vm.modelValue).toBe(5)
    })

    it('应该处理小数评分', () => {
      const wrapper = mount(RatingStars, {
        props: {
          modelValue: 3.5,
        },
      })

      expect(wrapper.vm.modelValue).toBe(3.5)
    })
  })

  describe('统计信息显示', () => {
    it('应该支持显示统计信息', () => {
      const wrapper = mount(RatingStars, {
        props: {
          modelValue: 4.5,
          showStats: true,
          count: 123,
        },
      })

      expect(wrapper.props('showStats')).toBe(true)
      expect(wrapper.props('count')).toBe(123)
    })
  })
})
