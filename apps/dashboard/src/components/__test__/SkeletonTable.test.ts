/**
 * SkeletonTable.vue 组件测试
 */

import { SkeletonTable } from '@starye/ui'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

describe('skeletonTable.vue', () => {
  describe('props 配置', () => {
    it('应该渲染指定数量的行', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 5,
          columns: 3,
        },
      })

      const tbody = wrapper.find('tbody')
      const rows = tbody.findAll('tr')

      expect(rows).toHaveLength(5)
    })

    it('应该渲染指定数量的列', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 3,
          columns: 4,
        },
      })

      const headerCells = wrapper.find('thead').findAll('th')
      expect(headerCells).toHaveLength(4)

      const firstRowCells = wrapper.find('tbody tr').findAll('td')
      expect(firstRowCells).toHaveLength(4)
    })

    it('应该支持自定义列宽', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 1,
          columns: 3,
          widths: ['w-20', 'w-50', 'w-30'],
        },
      })

      const cells = wrapper.find('tbody tr').findAll('td')
      expect(cells.length).toBe(3)
    })

    it('selectable 为 true 时应该显示复选框列', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 2,
          columns: 3,
          selectable: true,
        },
      })

      const headerCells = wrapper.find('thead').findAll('th')
      expect(headerCells).toHaveLength(4) // 3 + 1 复选框列

      const firstRowCells = wrapper.find('tbody tr').findAll('td')
      expect(firstRowCells).toHaveLength(4)
    })
  })

  describe('闪烁动画', () => {
    it('应该包含 skeleton-shimmer 类', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 1,
          columns: 2,
        },
      })

      const skeletonElements = wrapper.findAll('.skeleton-shimmer')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })
  })

  describe('表格结构', () => {
    it('应该包含 table, thead, tbody 元素', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 2,
          columns: 3,
        },
      })

      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.find('thead').exists()).toBe(true)
      expect(wrapper.find('tbody').exists()).toBe(true)
    })

    it('应该使用独立的横向滚动容器', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 2,
          columns: 3,
        },
      })

      expect(wrapper.find('.data-table-skeleton-scroll').exists()).toBe(true)
      expect(wrapper.find('.data-table-skeleton-scroll table').exists()).toBe(true)
    })

    it('应该限制滚动高度并固定骨架操作列', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 2,
          columns: 3,
          maxHeight: '28rem',
          actionWidth: '100px',
        },
      })

      expect(wrapper.find('.data-table-skeleton-scroll').attributes('style')).toContain('max-height: 28rem')
      expect(wrapper.find('thead th.skeleton-table-action-cell').exists()).toBe(true)
      expect(wrapper.find('tbody td.skeleton-table-action-cell').exists()).toBe(true)
      expect(wrapper.find('thead th.skeleton-table-action-cell').attributes('style')).toContain('width: 100px')
      expect(wrapper.find('.skeleton-table-action-line').exists()).toBe(true)
    })
  })

  describe('单元格填充', () => {
    it('表头应该有填充', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 1,
          columns: 2,
        },
      })

      const headerCell = wrapper.find('thead th')
      expect(headerCell.classes()).toContain('skeleton-table-cell')
    })

    it('表格行应该有填充', () => {
      const wrapper = mount(SkeletonTable, {
        props: {
          rows: 1,
          columns: 2,
        },
      })

      const bodyCell = wrapper.find('tbody td')
      expect(bodyCell.classes()).toContain('skeleton-table-cell')
    })
  })
})
