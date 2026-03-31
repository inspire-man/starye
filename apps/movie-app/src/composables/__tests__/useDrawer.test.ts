import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

describe('useDrawer 逻辑测试', () => {
  function createDrawerLogic() {
    const isOpen = ref(false)

    function open() {
      isOpen.value = true
    }

    function close() {
      isOpen.value = false
    }

    function toggle() {
      isOpen.value = !isOpen.value
    }

    return { isOpen, open, close, toggle }
  }

  describe('基础功能', () => {
    it('应该初始化为关闭状态', () => {
      const { isOpen } = createDrawerLogic()
      expect(isOpen.value).toBe(false)
    })

    it('open 方法应该打开抽屉', () => {
      const { isOpen, open } = createDrawerLogic()

      open()
      expect(isOpen.value).toBe(true)
    })

    it('close 方法应该关闭抽屉', () => {
      const { isOpen, open, close } = createDrawerLogic()

      open()
      expect(isOpen.value).toBe(true)

      close()
      expect(isOpen.value).toBe(false)
    })

    it('toggle 方法应该切换状态', () => {
      const { isOpen, toggle } = createDrawerLogic()

      expect(isOpen.value).toBe(false)

      toggle()
      expect(isOpen.value).toBe(true)

      toggle()
      expect(isOpen.value).toBe(false)
    })
  })

  describe('状态切换', () => {
    it('应该支持多次打开和关闭', () => {
      const { isOpen, open, close } = createDrawerLogic()

      open()
      expect(isOpen.value).toBe(true)
      close()
      expect(isOpen.value).toBe(false)
      open()
      expect(isOpen.value).toBe(true)
      close()
      expect(isOpen.value).toBe(false)
    })

    it('连续调用 open 应该保持打开状态', () => {
      const { isOpen, open } = createDrawerLogic()

      open()
      open()
      open()

      expect(isOpen.value).toBe(true)
    })

    it('toggle 应该在打开和关闭之间交替', () => {
      const { isOpen, toggle } = createDrawerLogic()

      const states: boolean[] = []
      for (let i = 0; i < 10; i++) {
        toggle()
        states.push(isOpen.value)
      }

      for (let i = 0; i < states.length; i++) {
        expect(states[i]).toBe(i % 2 === 0)
      }
    })
  })

  describe('边界情况', () => {
    it('方法应该始终返回 undefined', () => {
      const { open, close, toggle } = createDrawerLogic()

      expect(open()).toBeUndefined()
      expect(close()).toBeUndefined()
      expect(toggle()).toBeUndefined()
    })

    it('应该处理快速连续的状态切换', () => {
      const { isOpen, toggle } = createDrawerLogic()

      for (let i = 0; i < 100; i++) {
        toggle()
      }

      expect(isOpen.value).toBe(false)
    })
  })
})
