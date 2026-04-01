/**
 * SkeletonCard.vue 组件测试
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SkeletonCard from '../SkeletonCard.vue'

describe('SkeletonCard.vue', () => {
  describe('变体渲染', () => {
    it('应该渲染 stat 变体', () => {
      const wrapper = mount(SkeletonCard, {
        props: {
          variant: 'stat',
        },
      })

      // stat 变体包含图标、大号数字和描述占位
      const skeletons = wrapper.findAll('.skeleton-base')
      expect(skeletons.length).toBeGreaterThan(2)
    })

    it('应该渲染 content 变体', () => {
      const wrapper = mount(SkeletonCard, {
        props: {
          variant: 'content',
        },
      })

      // content 变体包含标题和多行内容占位
      const skeletons = wrapper.findAll('.skeleton-base')
      expect(skeletons.length).toBeGreaterThan(3)
    })

    it('应该渲染 image 变体', () => {
      const wrapper = mount(SkeletonCard, {
        props: {
          variant: 'image',
        },
      })

      // image 变体包含图片占位和文字占位
      const skeletons = wrapper.findAll('.skeleton-base')
      expect(skeletons.length).toBeGreaterThan(2)

      // 检查图片占位有视频比例
      expect(wrapper.html()).toContain('aspect-video')
    })

    it('默认应该渲染 content 变体', () => {
      const wrapper = mount(SkeletonCard)

      const skeletons = wrapper.findAll('.skeleton-base')
      expect(skeletons.length).toBeGreaterThan(3)
    })
  })

  describe('闪烁动画', () => {
    it('所有占位元素应该包含 skeleton-base 类', () => {
      const wrapper = mount(SkeletonCard, {
        props: {
          variant: 'stat',
        },
      })

      const skeletons = wrapper.findAll('.skeleton-base')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('卡片结构', () => {
    it('应该包含卡片容器', () => {
      const wrapper = mount(SkeletonCard)

      expect(wrapper.find('.border').exists()).toBe(true)
      expect(wrapper.find('.rounded-lg').exists()).toBe(true)
    })
  })

  describe('响应式设计', () => {
    it('应该支持 grid 布局', () => {
      const wrapper = mount(SkeletonCard)

      // 卡片本身应该适配 grid 布局
      expect(wrapper.classes()).toContain('rounded-lg')
    })
  })
})
