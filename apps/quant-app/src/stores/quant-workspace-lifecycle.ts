import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useQuantWorkspaceLifecycleStore = defineStore('quant-workspace-lifecycle', () => {
  const initialized = ref(false)
  const loading = ref(false)
  let inFlight: Promise<void> | null = null

  async function run(loader: () => Promise<void>): Promise<void> {
    if (inFlight)
      return inFlight

    const task = (async () => {
      loading.value = true
      try {
        await loader()
        initialized.value = true
      }
      finally {
        loading.value = false
        inFlight = null
      }
    })()
    inFlight = task
    return task
  }

  async function initialize(loader: () => Promise<void>): Promise<void> {
    if (initialized.value)
      return
    await run(loader)
  }

  function invalidate(): void {
    initialized.value = false
  }

  return {
    initialized,
    loading,
    run,
    initialize,
    invalidate,
  }
})
