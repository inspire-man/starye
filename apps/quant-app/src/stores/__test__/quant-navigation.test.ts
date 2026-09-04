// @vitest-environment happy-dom

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useQuantNavigationStore } from '../quant-navigation'

describe('quant navigation store', () => {
  let store: ReturnType<typeof useQuantNavigationStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    window.location.hash = '#overview'
    store = useQuantNavigationStore()
  })

  afterEach(() => {
    store.dispose()
  })

  it('hydrates the active view from the existing hash format', async () => {
    window.location.hash = '#candidates'
    await store.initialize()

    expect(store.activeView).toBe('candidates')
  })

  it('updates the route and hash when navigating', async () => {
    await store.initialize()
    await store.navigate('knowledge')

    expect(store.activeView).toBe('knowledge')
    expect(window.location.hash).toBe('#knowledge')
  })
})
