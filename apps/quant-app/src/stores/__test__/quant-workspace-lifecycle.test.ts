import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { useQuantWorkspaceLifecycleStore } from '../quant-workspace-lifecycle'

describe('quant workspace lifecycle store', () => {
  it('coalesces concurrent workspace initialization', async () => {
    setActivePinia(createPinia())
    const store = useQuantWorkspaceLifecycleStore()
    let calls = 0
    let resolveLoader!: () => void
    const loader = () => {
      calls++
      return new Promise<void>((resolve) => {
        resolveLoader = resolve
      })
    }

    const first = store.run(loader)
    const second = store.run(loader)
    expect(calls).toBe(1)
    expect(store.loading).toBe(true)

    resolveLoader()
    await Promise.all([first, second])

    expect(store.initialized).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('leaves initialization retryable after a failed loader', async () => {
    setActivePinia(createPinia())
    const store = useQuantWorkspaceLifecycleStore()

    const failingLoader = async () => {
      throw new Error('load failed')
    }
    await expect(store.run(failingLoader)).rejects.toThrow('load failed')

    expect(store.initialized).toBe(false)
    expect(store.loading).toBe(false)
  })
})
