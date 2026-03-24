import { vi } from 'vitest'

export function createMockDb() {
  const mockSelect = vi.fn().mockReturnThis()
  const mockFrom = vi.fn().mockReturnThis()
  const mockWhere = vi.fn().mockReturnThis()
  const mockThen = vi.fn()

  const selectChain = {
    from: mockFrom,
    where: mockWhere,
    then: mockThen,
  }

  Object.assign(mockSelect, selectChain)
  Object.assign(mockFrom, { where: mockWhere, then: mockThen })
  Object.assign(mockWhere, { then: mockThen })

  return {
    select: vi.fn(() => mockSelect),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: mockFrom,
    where: mockWhere,
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    query: {
      movies: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      actors: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      publishers: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      movieActors: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  } as any
}

export function createMockContext(overrides: Record<string, any> = {}) {
  const mockReq = {
    query: vi.fn(() => ({})),
    param: vi.fn(),
    json: vi.fn(),
    raw: {
      headers: new Headers(),
    },
  }

  const mockGet = vi.fn((key: string) => {
    if (key in overrides) {
      return overrides[key]
    }
    if (key === 'db') {
      return createMockDb()
    }
    if (key === 'auth') {
      return {
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      }
    }
    return undefined
  })

  return {
    get: mockGet,
    req: mockReq,
    json: vi.fn(data => ({ data })),
    text: vi.fn(text => ({ text })),
    notFound: vi.fn(() => ({ status: 404 })),
  } as any
}
