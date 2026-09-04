import type { QuantView } from '../lib/quant-view'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { parseQuantView, quantViewHash } from '../lib/quant-view'
import quantRouter, { quantViewFromRouteName } from '../router'

export const useQuantNavigationStore = defineStore('quant-navigation', () => {
  const activeView = ref<QuantView>('overview')
  const initialized = ref(false)
  let removeHashListeners: (() => void) | null = null
  let removeRouterListener: (() => void) | null = null

  function syncFromHash(): void {
    if (typeof window === 'undefined')
      return

    const view = parseQuantView(window.location.hash)
    activeView.value = view
    if (quantViewFromRouteName(quantRouter.currentRoute.value.name) !== view)
      void quantRouter.replace({ name: view })

    const normalizedHash = quantViewHash(view)
    if (window.location.hash !== normalizedHash)
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${normalizedHash}`)
  }

  async function initialize(): Promise<void> {
    if (initialized.value)
      return

    if (typeof window === 'undefined') {
      initialized.value = true
      return
    }

    const sync = () => syncFromHash()
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    removeHashListeners = () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
    removeRouterListener = quantRouter.afterEach((to) => {
      const view = quantViewFromRouteName(to.name)
      activeView.value = view
      if (window.location.hash !== quantViewHash(view))
        window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${quantViewHash(view)}`)
    })
    syncFromHash()
    initialized.value = true
    await quantRouter.isReady()
  }

  async function navigate(view: QuantView): Promise<void> {
    if (!initialized.value)
      await initialize()
    if (quantViewFromRouteName(quantRouter.currentRoute.value.name) === view && activeView.value === view)
      return
    await quantRouter.push({ name: view })
  }

  function dispose(): void {
    removeHashListeners?.()
    removeRouterListener?.()
    removeHashListeners = null
    removeRouterListener = null
    initialized.value = false
  }

  return {
    activeView,
    initialized,
    initialize,
    navigate,
    dispose,
  }
})
