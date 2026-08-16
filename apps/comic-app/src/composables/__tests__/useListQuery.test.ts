import { useListQuery } from '@starye/ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => {
  const route = { query: {} as Record<string, string | undefined> }
  const router = {
    replace: vi.fn(async ({ query }: { query: Record<string, string | undefined> }) => {
      route.query = query
    }),
  }
  return { route, router }
})

vi.mock('vue-router', () => ({
  useRoute: () => routerState.route,
  useRouter: () => routerState.router,
}))

describe('useListQuery', () => {
  beforeEach(() => {
    routerState.route.query = {}
    routerState.router.replace.mockClear()
  })

  it('reads page and limit from the URL and resets page when page size changes', async () => {
    routerState.route.query = { limit: '40', page: '3', sort: 'updatedAt' }
    const query = useListQuery(20)

    expect(query.page.value).toBe(3)
    expect(query.limit.value).toBe(40)

    await query.updatePageSize(80)

    expect(routerState.router.replace).toHaveBeenCalledWith({
      query: { limit: '80', page: undefined, sort: 'updatedAt' },
    })
  })

  it('ignores stale responses and exposes the latest response meta', async () => {
    const query = useListQuery()
    let resolveFirst!: (value: { data: string[], pagination: { page: number, limit: number, total: number, totalPages: number } }) => void
    let resolveSecond!: (value: { data: string[], pagination: { page: number, limit: number, total: number, totalPages: number } }) => void
    const first = new Promise<{ data: string[], pagination: { page: number, limit: number, total: number, totalPages: number } }>((resolve) => {
      resolveFirst = resolve
    })
    const second = new Promise<{ data: string[], pagination: { page: number, limit: number, total: number, totalPages: number } }>((resolve) => {
      resolveSecond = resolve
    })

    const firstRequest = query.execute(() => first)
    const secondRequest = query.execute(() => second)
    resolveSecond({ data: ['fresh'], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })
    await expect(secondRequest).resolves.toEqual(['fresh'])
    resolveFirst({ data: ['stale'], pagination: { page: 1, limit: 20, total: 99, totalPages: 5 } })
    await expect(firstRequest).resolves.toBeNull()

    expect(query.total.value).toBe(1)
    expect(query.totalPages.value).toBe(1)
    expect(query.loading.value).toBe(false)
  })

  it('turns loader errors into a retryable error state', async () => {
    const query = useListQuery()

    await expect(query.execute(async () => {
      throw new Error('network down')
    })).resolves.toBeNull()

    expect(query.error.value).toBe('network down')
    expect(query.loading.value).toBe(false)
  })
})
