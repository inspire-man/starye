/**
 * Posts Service 测试
 */

import type { Database } from '@starye/db'
import { describe, expect, it, vi } from 'vitest'
import { createPost, deletePost, getPostById, getPostBySlug, getPosts, updatePost } from '../../services/post.service'

describe('posts Service', () => {
  describe('getPosts', () => {
    it('应该返回文章列表和分页信息', async () => {
      const mockPosts = [
        {
          id: '1',
          title: 'Test Post 1',
          slug: 'test-post-1',
          excerpt: 'Excerpt 1',
          coverImage: 'cover1.jpg',
          published: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          author: {
            name: 'Author 1',
            image: 'avatar1.jpg',
          },
        },
      ]

      const mockDb = {
        query: {
          posts: {
            findMany: vi.fn().mockResolvedValue(mockPosts),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((callback: any) => callback([{ value: 25 }])),
            }),
          }),
        }),
      } as unknown as Database

      const result = await getPosts({
        db: mockDb,
        page: 1,
        pageSize: 10,
      })

      expect(result.data).toHaveLength(1)
      expect(result.meta.total).toBe(25)
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(10)
      expect(mockDb.query.posts.findMany).toHaveBeenCalled()
    })

    it('应该默认过滤草稿', async () => {
      const mockDb = {
        query: {
          posts: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((callback: any) => callback([{ value: 0 }])),
            }),
          }),
        }),
      } as unknown as Database

      await getPosts({
        db: mockDb,
        showDrafts: false,
      })

      expect(mockDb.query.posts.findMany).toHaveBeenCalled()
      const callArgs = (mockDb.query.posts.findMany as any).mock.calls[0][0]
      expect(callArgs.where).toBeDefined()
    })
  })

  describe('getPostById', () => {
    it('应该返回文章详情', async () => {
      const mockPost = {
        id: '1',
        title: 'Test Post',
        slug: 'test-post',
        content: 'Test content',
        published: true,
      }

      const mockDb = {
        query: {
          posts: {
            findFirst: vi.fn().mockResolvedValue(mockPost),
          },
        },
      } as unknown as Database

      const result = await getPostById({
        db: mockDb,
        id: '1',
      })

      expect(result).toBeDefined()
      expect(result?.title).toBe('Test Post')
    })
  })

  describe('getPostBySlug', () => {
    it('应该通过 slug 查找文章', async () => {
      const mockPost = {
        id: '1',
        title: 'Test Post',
        slug: 'test-post',
        content: 'Test content',
      }

      const mockDb = {
        query: {
          posts: {
            findFirst: vi.fn().mockResolvedValue(mockPost),
          },
        },
      } as unknown as Database

      const result = await getPostBySlug({
        db: mockDb,
        slug: 'test-post',
      })

      expect(result).toBeDefined()
      expect(result?.slug).toBe('test-post')
    })

    it('应该在文章不存在时返回 null', async () => {
      const mockDb = {
        query: {
          posts: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as unknown as Database

      const result = await getPostBySlug({
        db: mockDb,
        slug: 'non-existent',
      })

      expect(result).toBeNull()
    })
  })

  describe('createPost', () => {
    it('应该创建新文章', async () => {
      const mockPost = {
        id: '1',
        title: 'New Post',
        slug: 'new-post',
      }

      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockPost]),
          }),
        }),
      } as unknown as Database

      const result = await createPost({
        db: mockDb,
        data: {
          title: 'New Post',
          slug: 'new-post',
          content: 'Test content',
          authorId: 'user1',
        },
      })

      expect(result).toBeDefined()
      expect(result.title).toBe('New Post')
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('updatePost', () => {
    it('应该更新文章', async () => {
      const mockPost = {
        id: '1',
        title: 'Updated Post',
        slug: 'updated-post',
      }

      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockPost]),
            }),
          }),
        }),
      } as unknown as Database

      const result = await updatePost({
        db: mockDb,
        id: '1',
        data: {
          title: 'Updated Post',
        },
      })

      expect(result).toBeDefined()
      expect(result.title).toBe('Updated Post')
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('deletePost', () => {
    it('应该删除文章', async () => {
      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as unknown as Database

      await deletePost({
        db: mockDb,
        id: '1',
      })

      expect(mockDb.delete).toHaveBeenCalled()
    })
  })
})
