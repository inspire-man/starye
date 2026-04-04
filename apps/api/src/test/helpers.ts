import type { Database } from '@starye/db'
import type { Auth } from '../lib/auth'
import type { SessionUser } from '../types'
import { vi } from 'vitest'

/**
 * 创建类型安全的 Mock Database
 */
export function createMockDb(): Database {
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
      posts: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
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
      players: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  } as unknown as Database
}

/**
 * 创建类型安全的 Mock Auth
 */
export function createMockAuth(sessionData?: { user?: SessionUser } | null): Auth {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue(sessionData ?? null),
    },
  } as unknown as Auth
}

/**
 * 创建测试用的 Mock User
 */
export function createMockUser(overrides?: Partial<SessionUser>): SessionUser {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    emailVerified: true,
    name: 'Test User',
    image: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    role: 'user',
    isAdult: false,
    isR18Verified: false,
    ...overrides,
  }
}

/**
 * Post 完整类型定义（含 blog-enhance 新增字段）
 */
export interface MockPost {
  id: string
  createdAt: Date | null
  updatedAt: Date | null
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  coverImage: string | null
  published: boolean | null
  authorId: string | null
  contentFormat: string | null
  tags: string[] | null
  series: string | null
  seriesOrder: number | null
}

/**
 * 创建测试用的 Mock Post
 */
export function createMockPost(overrides?: Partial<MockPost>): MockPost {
  return {
    id: 'test-post-id',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    title: 'Test Post',
    slug: 'test-post',
    content: 'Test content',
    excerpt: 'Test excerpt',
    coverImage: null,
    published: true,
    authorId: 'test-author-id',
    contentFormat: 'html',
    tags: null,
    series: null,
    seriesOrder: null,
    ...overrides,
  }
}

/**
 * 创建测试用的 Mock Actor (完整版本用于 getActorDetail)
 */
export function createMockActor(overrides?: Record<string, any>): any {
  return {
    id: 'test-actor-id',
    name: 'Test Actor',
    slug: 'test-actor',
    source: 'javdb',
    cover: null,
    avatar: null,
    nationality: null,
    birthday: null,
    height: null,
    cup: null,
    bust: null,
    waist: null,
    hips: null,
    bloodType: null,
    hobby: null,
    description: null,
    movieCount: 0,
    isActive: true,
    hasDetailsCrawled: false,
    lastCrawledAt: null,
    lastModifiedAt: null,
    lastCrawlAttempt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    relatedMovies: [],
    ...overrides,
  }
}

/**
 * 创建测试用的 Mock Comic
 */
export function createMockComic(overrides?: Record<string, any>): any {
  return {
    id: 'test-comic-id',
    title: 'Test Comic',
    slug: 'test-comic',
    status: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    coverImage: null,
    author: null,
    description: null,
    isR18: false,
    rating: null,
    views: 0,
    favorites: 0,
    lastChapterTitle: null,
    lastChapterUpdatedAt: null,
    tags: [],
    categories: [],
    publisherSlug: null,
    sourceUrl: null,
    chapters: [],
    ...overrides,
  }
}

/**
 * 创建测试用的 Mock Movie (详细版本)
 */
export function createMockMovie(overrides?: Record<string, any>): any {
  return {
    id: 'test-movie-id',
    title: 'Test Movie',
    slug: 'test-movie',
    code: 'TEST-001',
    coverImage: null,
    releaseDate: new Date('2024-01-01'),
    duration: null,
    rating: null,
    description: null,
    isR18: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    actors: [],
    publishers: [],
    relatedMovies: [],
    ...overrides,
  }
}

/**
 * 创建测试用的 Mock Publisher
 */
export function createMockPublisher(overrides?: Record<string, any>): any {
  return {
    id: 'test-publisher-id',
    name: 'Test Publisher',
    slug: 'test-publisher',
    source: 'javdb',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    avatar: null,
    description: null,
    website: null,
    movieCount: 0,
    isActive: true,
    hasDetailsCrawled: false,
    lastCrawledAt: null,
    lastModifiedAt: null,
    lastCrawlAttempt: null,
    relatedMovies: [],
    ...overrides,
  }
}
