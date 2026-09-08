import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ComicCard from '../../../../../packages/ui/src/components/ComicCard.vue'
import MovieCard from '../../../../../packages/ui/src/components/MovieCard.vue'

describe.each([MovieCard, ComicCard])('content card media states', (component) => {
  const render = (props = {}) => mount(component as any, {
    props: { title: 'Catalog fixture', href: '/fixture', code: 'TEST-001', labelMissingCover: '暂无封面', ...props },
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })

  it('never mounts an image for restricted content even when a URL exists', async () => {
    const wrapper = render({ cover: '/cover.webp', restricted: true, isR18: true })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('需要 R18 访问权限')
    await wrapper.setProps({ restricted: false })
    expect(wrapper.get('img').attributes('src')).toBe('/cover.webp')
  })

  it('distinguishes missing media from access restriction', () => {
    const wrapper = render({ isR18: true })
    expect(wrapper.text()).toContain('暂无封面')
    expect(wrapper.text()).not.toContain('需要 R18 访问权限')
  })

  it('shows failure and retries when the cover URL changes', async () => {
    const wrapper = render({ cover: '/first.webp', isR18: true })
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('图片加载失败')
    await wrapper.setProps({ cover: '/replacement.webp' })
    expect(wrapper.get('img').attributes('src')).toBe('/replacement.webp')
  })
})
