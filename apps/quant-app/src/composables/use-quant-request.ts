import type { ComputedRef, Ref } from 'vue'
import { computed, ref, shallowRef } from 'vue'

export type QuantRequestStatus = 'idle' | 'loading' | 'success' | 'error' | 'cancelled'

export interface QuantRequestToken {
  readonly id: number
  readonly signal: AbortSignal
}

export interface QuantRequestState<T> {
  readonly data: Ref<T | null>
  readonly status: Ref<QuantRequestStatus>
  readonly error: Ref<unknown | null>
  readonly loading: ComputedRef<boolean>
  readonly hasData: ComputedRef<boolean>
  start: () => QuantRequestToken
  isCurrent: (token: QuantRequestToken) => boolean
  resolve: (token: QuantRequestToken, value: T) => boolean
  reject: (token: QuantRequestToken, error: unknown) => boolean
  cancel: () => void
  reset: () => void
  run: (loader: (signal: AbortSignal) => Promise<T>) => Promise<T | undefined>
}

export function isQuantAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function useQuantRequestState<T>(initialData: T | null = null): QuantRequestState<T> {
  const data = shallowRef<T | null>(initialData)
  const status = ref<QuantRequestStatus>('idle')
  const error = ref<unknown | null>(null)
  const loading = computed(() => status.value === 'loading')
  const hasData = computed(() => data.value !== null)

  let sequence = 0
  let activeId = 0
  let controller: AbortController | null = null

  function start(): QuantRequestToken {
    controller?.abort()
    const nextController = new AbortController()
    const id = ++sequence
    activeId = id
    controller = nextController
    status.value = 'loading'
    error.value = null
    return { id, signal: nextController.signal }
  }

  function isCurrent(token: QuantRequestToken): boolean {
    return token.id === activeId && !token.signal.aborted
  }

  function resolve(token: QuantRequestToken, value: T): boolean {
    if (!isCurrent(token))
      return false
    data.value = value
    status.value = 'success'
    controller = null
    return true
  }

  function reject(token: QuantRequestToken, reason: unknown): boolean {
    if (!isCurrent(token))
      return false
    error.value = reason
    status.value = 'error'
    controller = null
    return true
  }

  function cancel(): void {
    if (status.value !== 'loading')
      return
    controller?.abort()
    controller = null
    activeId = ++sequence
    status.value = 'cancelled'
  }

  function reset(): void {
    controller?.abort()
    controller = null
    activeId = ++sequence
    data.value = null
    error.value = null
    status.value = 'idle'
  }

  async function run(loader: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    const token = start()
    try {
      const value = await loader(token.signal)
      return resolve(token, value) ? value : undefined
    }
    catch (reason) {
      if (!isCurrent(token) || token.signal.aborted || isQuantAbortError(reason)) {
        if (token.id === activeId && token.signal.aborted)
          status.value = 'cancelled'
        return undefined
      }
      reject(token, reason)
      throw reason
    }
  }

  return {
    data,
    status,
    error,
    loading,
    hasData,
    start,
    isCurrent,
    resolve,
    reject,
    cancel,
    reset,
    run,
  }
}
