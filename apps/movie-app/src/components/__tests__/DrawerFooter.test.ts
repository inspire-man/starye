import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserStore } from '../../stores/user'
import DrawerFooter from '../DrawerFooter.vue'

describe('drawerFooter 组件', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('基础渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(DrawerFooter)
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('未登录状态', () => {
    it('应该显示登录按钮', () => {
      const userStore = useUserStore()
      userStore.user = null

      const wrapper = mount(DrawerFooter)

      expect(wrapper.html()).toContain('登录')
    })

    it('点击登录按钮应该调用 signIn', async () => {
      const userStore = useUserStore()
      userStore.user = null
      userStore.signIn = vi.fn()

      const wrapper = mount(DrawerFooter)

      const loginBtn = wrapper.find('button')
      await loginBtn.trigger('click')

      expect(userStore.signIn).toHaveBeenCalled()
    })
  })

  describe('已登录状态', () => {
    it('应该显示用户信息', () => {
      const userStore = useUserStore()
      userStore.user = {
        id: '1',
        name: '测试用户',
        email: 'test@example.com',
        isR18Verified: false,
      }

      const wrapper = mount(DrawerFooter)

      expect(wrapper.html()).toContain('测试用户')
      expect(wrapper.html()).toContain('test@example.com')
    })

    it('应该显示用户头像', () => {
      const userStore = useUserStore()
      userStore.user = {
        id: '1',
        name: '测试用户',
        email: 'test@example.com',
        image: 'https://example.com/avatar.jpg',
        isR18Verified: false,
      }

      const wrapper = mount(DrawerFooter)

      expect(wrapper.html()).toContain('https://example.com/avatar.jpg')
    })

    it('没有头像时应该显示名称首字母', () => {
      const userStore = useUserStore()
      userStore.user = {
        id: '1',
        name: '测试用户',
        email: 'test@example.com',
        isR18Verified: false,
      }

      const wrapper = mount(DrawerFooter)

      expect(wrapper.html()).toContain('测')
    })

    it('应该显示退出按钮', () => {
      const userStore = useUserStore()
      userStore.user = {
        id: '1',
        name: '测试用户',
        email: 'test@example.com',
        isR18Verified: false,
      }

      const wrapper = mount(DrawerFooter)

      expect(wrapper.html()).toContain('退出')
    })
  })

  describe('r18 状态显示', () => {
    it('未验证时应该显示 SFW 状态', () => {
      const userStore = useUserStore()
      userStore.user = {
        id: '1',
        name: '测试用户',
        email: 'test@example.com',
        isR18Verified: false,
      }

      const wrapper = mount(DrawerFooter)

      expect(wrapper.html()).toContain('SFW')
    })

    it('已验证时应该显示 R18 状态', () => {
      const userStore = useUserStore()
      userStore.user = {
        id: '1',
        name: '测试用户',
        email: 'test@example.com',
        isR18Verified: true,
      }

      const wrapper = mount(DrawerFooter)

      expect(wrapper.html()).toContain('R18')
    })
  })
})
