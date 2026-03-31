import type { NavItem } from '../BottomNavigation.vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import BottomNavigation from '../BottomNavigation.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/actors', component: { template: '<div>Actors</div>' } },
    { path: '/profile', component: { template: '<div>Profile</div>' } },
  ],
})

describe('bottomNavigation 组件', () => {
  const items: NavItem[] = [
    { path: '/', icon: '🏠', label: '首页' },
    { path: '/actors', icon: '👥', label: '女优' },
    { path: '/profile', icon: '👤', label: '我的', badge: 3 },
  ]

  describe('基础渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(BottomNavigation, {
        props: { items },
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.bottom-navigation').exists()).toBe(true)
    })

    it('应该渲染所有导航项', () => {
      const wrapper = mount(BottomNavigation, {
        props: { items },
        global: {
          plugins: [router],
        },
      })

      const navItems = wrapper.findAll('.nav-item')
      expect(navItems).toHaveLength(3)
    })

    it('应该显示图标和标签', () => {
      const wrapper = mount(BottomNavigation, {
        props: { items },
        global: {
          plugins: [router],
        },
      })

      const html = wrapper.html()
      expect(html).toContain('🏠')
      expect(html).toContain('首页')
      expect(html).toContain('👥')
      expect(html).toContain('女优')
    })

    it('应该显示徽章', () => {
      const wrapper = mount(BottomNavigation, {
        props: { items },
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.html()).toContain('3')
    })
  })

  describe('props 配置', () => {
    it('应该接受 items prop', () => {
      const wrapper = mount(BottomNavigation, {
        props: { items },
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.props('items')).toEqual(items)
    })

    it('应该处理大于 99 的徽章数字', () => {
      const itemsWithLargeBadge: NavItem[] = [
        { path: '/', icon: '🏠', label: '首页', badge: 150 },
      ]

      const wrapper = mount(BottomNavigation, {
        props: { items: itemsWithLargeBadge },
        global: {
          plugins: [router],
        },
      })

      const badges = wrapper.findAll('.nav-badge')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('应该处理 badge 为 0 的情况', () => {
      const itemsWithZeroBadge: NavItem[] = [
        { path: '/', icon: '🏠', label: '首页', badge: 0 },
      ]

      const wrapper = mount(BottomNavigation, {
        props: { items: itemsWithZeroBadge },
        global: {
          plugins: [router],
        },
      })

      const badges = wrapper.findAll('.nav-badge')
      expect(badges.length).toBe(0)
    })
  })

  describe('路由集成', () => {
    it('应该包含 RouterLink 组件', () => {
      const wrapper = mount(BottomNavigation, {
        props: { items },
        global: {
          plugins: [router],
        },
      })

      const links = wrapper.findAllComponents({ name: 'RouterLink' })
      expect(links.length).toBe(3)
    })
  })

  describe('边界情况', () => {
    it('应该处理空的导航项数组', () => {
      const wrapper = mount(BottomNavigation, {
        props: { items: [] },
        global: {
          plugins: [router],
        },
      })

      const navItems = wrapper.findAll('.nav-item')
      expect(navItems).toHaveLength(0)
    })

    it('应该处理没有图标的导航项', () => {
      const itemsWithoutIcon: NavItem[] = [
        { path: '/', icon: '', label: '首页' },
      ]

      const wrapper = mount(BottomNavigation, {
        props: { items: itemsWithoutIcon },
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.exists()).toBe(true)
    })
  })
})
