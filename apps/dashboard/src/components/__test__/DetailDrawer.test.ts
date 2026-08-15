import { DetailDrawer } from '@starye/ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

describe('detailDrawer', () => {
  const mountedWrappers: Array<{ unmount: () => void }> = []

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
    document.body.querySelectorAll('[data-detail-drawer]').forEach(element => element.remove())
  })

  const mountDrawer = () => {
    const wrapper = mount(DetailDrawer, {
      props: {
        open: true,
        title: '任务执行详情',
        description: '当前任务的受控执行状态',
      },
      slots: {
        default: '<p data-drawer-content>可滚动详情</p>',
      },
    })
    mountedWrappers.push(wrapper)
    return wrapper
  }

  it('teleports content and focuses the close button when initially open', async () => {
    mountDrawer()
    await flushPromises()

    const drawer = document.body.querySelector('[data-detail-drawer]')
    const closeButton = document.body.querySelector<HTMLButtonElement>('[data-detail-drawer] button[aria-label="关闭详情"]')

    expect(drawer?.textContent).toContain('任务执行详情')
    expect(drawer?.textContent).toContain('可滚动详情')
    expect(closeButton).not.toBeNull()
    expect(document.activeElement).toBe(closeButton)
  })

  it('emits close events for Escape and the backdrop', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    const backdrop = document.body.querySelector<HTMLElement>('[data-detail-drawer]')
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('update:open')).toEqual([[false], [false]])
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
