import type { SelectOption } from '../Select.vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import Select from '../Select.vue'

describe('select 组件', () => {
  const options: SelectOption<string>[] = [
    { label: '选项1', value: 'option1', icon: '🔵' },
    { label: '选项2', value: 'option2', icon: '🟢' },
    { label: '选项3', value: 'option3', disabled: true },
  ]

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('基础渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          placeholder: '请选择',
        },
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.custom-select').exists()).toBe(true)
      expect(wrapper.find('.select-input').exists()).toBe(true)
    })

    it('应该显示选中的值', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
        },
      })

      const value = wrapper.find('.select-value')
      expect(value.text()).toContain('选项1')
    })

    it('应该显示 placeholder 当没有选中值时', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: undefined,
          options,
          placeholder: '请选择选项',
        },
      })

      const value = wrapper.find('.select-value')
      expect(value.text()).toBe('请选择选项')
    })

    it('应该显示图标', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
        },
      })

      expect(wrapper.find('.select-value-icon').text()).toBe('🔵')
    })
  })

  describe('清空功能', () => {
    it('当 clearable 为 true 且有值时应该显示清空按钮', async () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          clearable: true,
        },
      })

      const clearBtn = wrapper.find('.select-clear')
      expect(clearBtn.exists()).toBe(true)
    })

    it('点击清空按钮应该触发 update 事件', async () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          clearable: true,
        },
      })

      await wrapper.find('.select-clear').trigger('click')

      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([undefined])
      expect(wrapper.emitted('clear')).toBeTruthy()
    })

    it('没有值时不应该显示清空按钮', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: undefined,
          options,
          clearable: true,
        },
      })

      const clearBtn = wrapper.find('.select-clear')
      expect(clearBtn.exists()).toBe(false)
    })
  })

  describe('尺寸和状态', () => {
    it('应该支持不同的尺寸', () => {
      const wrapperSmall = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          size: 'small',
        },
      })

      const wrapperLarge = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          size: 'large',
        },
      })

      expect(wrapperSmall.find('.custom-select').classes()).toContain('custom-select--small')
      expect(wrapperLarge.find('.custom-select').classes()).toContain('custom-select--large')
    })

    it('应该支持禁用状态', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          disabled: true,
        },
      })

      expect(wrapper.find('.custom-select').classes()).toContain('is-disabled')
    })

    it('应该支持加载状态', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          loading: true,
        },
      })

      expect(wrapper.find('.select-loading').exists()).toBe(true)
    })

    it('禁用状态下点击不应该改变 visible 状态', async () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          disabled: true,
        },
      })

      await wrapper.find('.custom-select').trigger('click')
      expect(wrapper.vm.visible).toBe(false)
    })

    it('加载状态下点击不应该改变 visible 状态', async () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          loading: true,
        },
      })

      await wrapper.find('.custom-select').trigger('click')
      expect(wrapper.vm.visible).toBe(false)
    })
  })

  describe('props 配置', () => {
    it('应该接受 placeholder prop', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: undefined,
          options,
          placeholder: '自定义占位符',
        },
      })

      expect(wrapper.find('.select-value').text()).toBe('自定义占位符')
    })

    it('应该接受 error prop', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options,
          error: true,
        },
      })

      expect(wrapper.find('.custom-select').classes()).toContain('is-error')
    })
  })

  describe('边界情况', () => {
    it('应该处理空的选项数组', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: undefined,
          options: [],
        },
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('应该处理没有图标的选项', () => {
      const optionsWithoutIcon: SelectOption<string>[] = [
        { label: '选项1', value: 'option1' },
      ]

      const wrapper = mount(Select, {
        props: {
          modelValue: 'option1',
          options: optionsWithoutIcon,
        },
      })

      expect(wrapper.find('.select-value-icon').exists()).toBe(false)
    })

    it('应该处理未找到的 modelValue', () => {
      const wrapper = mount(Select, {
        props: {
          modelValue: 'non-existent' as any,
          options,
        },
      })

      // 当 modelValue 无效时，没有 placeholder 就显示空
      const text = wrapper.find('.select-value').text()
      expect(text === '' || text === '请选择').toBe(true)
    })
  })
})
