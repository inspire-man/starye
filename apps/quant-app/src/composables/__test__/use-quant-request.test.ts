import { describe, expect, it } from 'vitest'
import { useQuantRequestState } from '../use-quant-request'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('useQuantRequestState', () => {
  it('keeps the newest response and ignores stale completion', async () => {
    const request = useQuantRequestState<string>()
    const first = deferred<string>()
    const second = deferred<string>()

    const firstRun = request.run(() => first.promise)
    const secondRun = request.run(() => second.promise)
    second.resolve('new')
    await expect(secondRun).resolves.toBe('new')
    first.resolve('old')

    await expect(firstRun).resolves.toBeUndefined()
    expect(request.data.value).toBe('new')
    expect(request.status.value).toBe('success')
  })

  it('cancels the active request without exposing an abort error', async () => {
    const request = useQuantRequestState<string>()
    const run = request.run(signal => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))

    request.cancel()

    await expect(run).resolves.toBeUndefined()
    expect(request.status.value).toBe('cancelled')
    expect(request.loading.value).toBe(false)
    expect(request.error.value).toBeNull()
  })

  it('retains previous data while a refresh is pending and records active failures', async () => {
    const request = useQuantRequestState('cached')
    const next = deferred<string>()
    const run = request.run(() => next.promise)

    expect(request.data.value).toBe('cached')
    expect(request.status.value).toBe('loading')
    expect(request.loading.value).toBe(true)

    const failure = new Error('provider unavailable')
    next.reject(failure)
    await expect(run).rejects.toBe(failure)
    expect(request.data.value).toBe('cached')
    expect(request.status.value).toBe('error')
    expect(request.error.value).toBe(failure)
  })
})
