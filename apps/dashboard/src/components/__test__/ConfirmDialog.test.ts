import { ConfirmDialog } from '@starye/ui'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

function clearDialogDom(): void {
  document.body.querySelectorAll('[data-confirm-dialog]').forEach(element => element.remove())
  document.body.style.overflow = ''
}

afterEach(() => {
  clearDialogDom()
})

describe('confirmDialog', () => {
  const baseProps = {
    open: true,
    title: '确认操作',
    message: '请确认继续执行。',
  }

  it('renders accessible labelled content, locks scrolling, and focuses the cancel action', async () => {
    const wrapper = mount(ConfirmDialog, { props: baseProps })
    await flushPromises()

    const dialog = document.querySelector<HTMLElement>('[data-confirm-dialog-panel]')
    const title = dialog?.querySelector('h2')
    const message = dialog?.querySelector('p')
    const footerButton = dialog?.querySelector<HTMLButtonElement>('footer button')

    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-labelledby')).toBe(title?.id)
    expect(dialog?.getAttribute('aria-describedby')).toBe(message?.parentElement?.id)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(footerButton)

    wrapper.unmount()
  })

  it('supports Escape, keyboard focus wrapping, and focus restoration', async () => {
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.textContent = '打开确认'
    document.body.append(trigger)
    trigger.focus()

    const wrapper = mount(ConfirmDialog, { props: { ...baseProps, open: false } })
    await wrapper.setProps({ open: true })
    await flushPromises()

    const panel = document.querySelector<HTMLElement>('[data-confirm-dialog-panel]')
    const buttons = panel?.querySelectorAll<HTMLButtonElement>('button')
    const lastButton = buttons?.[buttons.length - 1]
    lastButton?.focus()
    panel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(buttons?.[0])

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])

    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(document.activeElement).toBe(trigger)

    wrapper.unmount()
    trigger.remove()
  })

  it('does not close dangerous dialogs from the backdrop', async () => {
    const wrapper = mount(ConfirmDialog, { props: { ...baseProps, variant: 'danger' } })
    await flushPromises()

    document.querySelector<HTMLElement>('[data-confirm-dialog]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
  })

  it('renders slot content and requires the exact text before confirming', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { ...baseProps, requireTextConfirm: true, variant: 'danger' },
      slots: { default: '<div data-confirm-extra>合并目标</div>' },
    })
    await flushPromises()

    expect(document.querySelector('[data-confirm-extra]')?.textContent).toBe('合并目标')
    const confirmButton = document.querySelector<HTMLButtonElement>('[data-confirm-dialog-panel] footer button:last-child')
    expect(confirmButton?.disabled).toBe(true)

    const input = document.querySelector<HTMLInputElement>('[data-confirm-dialog-panel] input')
    if (!input || !confirmButton)
      throw new Error('确认输入控件未渲染')
    input.value = 'CONFIRM'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(confirmButton.disabled).toBe(false)

    confirmButton.click()
    await flushPromises()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])

    wrapper.unmount()
  })

  it('keeps the dialog open and disables both actions while an async confirm is loading', async () => {
    let wrapper: ReturnType<typeof mount>
    const onConfirm = vi.fn(() => {
      void wrapper.setProps({ loading: true })
    })
    wrapper = mount(ConfirmDialog, { props: { ...baseProps, onConfirm } })
    await flushPromises()

    const confirmButton = document.querySelector<HTMLButtonElement>('[data-confirm-dialog-panel] footer button:last-child')
    confirmButton?.click()
    await flushPromises()

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(confirmButton?.disabled).toBe(true)
    expect(confirmButton?.textContent).toContain('处理中')

    wrapper.unmount()
  })
})
