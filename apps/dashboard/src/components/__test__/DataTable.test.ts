import { DataTable } from '@starye/ui'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

interface Row {
  id: string
  title: string
  actions: string
}

describe('dataTable', () => {
  const columns = [
    { key: 'title', label: '标题', minWidth: '240px' },
    { key: 'operation', label: '操作', sortable: true },
    { key: 'actions', label: '操作', width: '104px' },
  ]

  it('limits the scroll surface and keeps the action column sticky', () => {
    const wrapper = mount(DataTable<Row>, {
      props: {
        data: [{ id: 'row-1', title: '示例记录', actions: '' }],
        columns,
        maxHeight: '28rem',
      },
      slots: {
        'cell-actions': '<button type="button">查看</button>',
      },
    })

    expect(wrapper.find('.data-table-scroll').attributes('style')).toContain('max-height: 28rem')
    expect(wrapper.findAll('thead th.data-table-action-cell')).toHaveLength(1)
    expect(wrapper.findAll('tbody td.data-table-action-cell')).toHaveLength(1)
  })

  it('marks action cells in the loading skeleton as sticky too', () => {
    const wrapper = mount(DataTable<Row>, {
      props: {
        data: [],
        columns,
        loading: true,
      },
    })

    expect(wrapper.find('.data-table-loading .data-table-action-cell').exists()).toBe(true)
  })
})
