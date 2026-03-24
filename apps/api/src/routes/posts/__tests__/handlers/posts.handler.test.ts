/**
 * Posts Handlers 测试
 */

import type { AppEnv } from '../../../../types'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { createPostHandler, deletePostHandler, getPostDetailById, getPostDetailBySlug, getPostList, updatePostHandler } from '../../handlers/posts.handler'
import * as postService from '../../services/post.service'

describe('posts Handlers', () => {
  describe('getPostList', () => {
    it('应该返回文章列表', async () => {
      const mockGetPosts = vi.spyOn(postService, 'getPosts').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      })

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        await next()
      })
      app.get('/posts', getPostList)

      const req = new Request('http://localhost/posts?page=1&limit=10')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockGetPosts).toHaveBeenCalledWith({
        db: mockDb,
        page: 1,
        pageSize: 10,
        showDrafts: false,
      })

      mockGetPosts.mockRestore()
    })
  })

  describe('getPostDetailBySlug', () => {
    it('应该返回文章详情', async () => {
      const mockPost = {
        id: '1',
        title: 'Test Post',
        slug: 'test-post',
        published: true,
      }
      const mockGetPost = vi.spyOn(postService, 'getPostBySlug').mockResolvedValue(mockPost as any)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = { api: {} } as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/posts/:slug', getPostDetailBySlug)

      const req = new Request('http://localhost/posts/test-post')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.title).toBe('Test Post')

      mockGetPost.mockRestore()
    })

    it('应该在文章不存在时返回 404', async () => {
      vi.spyOn(postService, 'getPostBySlug').mockResolvedValue(null as any)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = { api: {} } as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        await next()
      })
      app.get('/posts/:slug', getPostDetailBySlug)

      const req = new Request('http://localhost/posts/non-existent')
      const res = await app.fetch(req)

      expect(res.status).toBe(404)
    })
  })

  describe('getPostDetailById', () => {
    it('应该返回文章详情', async () => {
      const mockPost = {
        id: '1',
        title: 'Test Post',
      }
      const mockGetPost = vi.spyOn(postService, 'getPostById').mockResolvedValue(mockPost as any)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = { api: {} } as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        c.set('user', { id: 'admin' } as any)
        await next()
      })
      app.get('/posts/admin/:id', getPostDetailById)

      const req = new Request('http://localhost/posts/admin/1')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)

      mockGetPost.mockRestore()
    })
  })

  describe('createPostHandler', () => {
    it('应该创建新文章', async () => {
      const mockPost = {
        id: '1',
        title: 'New Post',
        slug: 'new-post',
      }
      const mockCreatePost = vi.spyOn(postService, 'createPost').mockResolvedValue(mockPost as any)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = {
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: { id: 'user1', name: 'Test User' },
          }),
        },
      } as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        c.set('user', { id: 'admin' } as any)
        await next()
      })
      app.post('/posts', createPostHandler)

      const req = new Request('http://localhost/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Post',
          slug: 'new-post',
          content: 'Test content',
        }),
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(201)

      mockCreatePost.mockRestore()
    })
  })

  describe('updatePostHandler', () => {
    it('应该更新文章', async () => {
      const mockPost = {
        id: '1',
        title: 'Updated Post',
      }
      const mockGetPost = vi.spyOn(postService, 'getPostById').mockResolvedValue(mockPost as any)
      const mockUpdatePost = vi.spyOn(postService, 'updatePost').mockResolvedValue(mockPost as any)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = { api: {} } as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        c.set('user', { id: 'admin' } as any)
        await next()
      })
      app.patch('/posts/:id', updatePostHandler)

      const req = new Request('http://localhost/posts/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Post',
        }),
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)

      mockGetPost.mockRestore()
      mockUpdatePost.mockRestore()
    })
  })

  describe('deletePostHandler', () => {
    it('应该删除文章', async () => {
      const mockPost = {
        id: '1',
        title: 'Test Post',
      }
      const mockGetPost = vi.spyOn(postService, 'getPostById').mockResolvedValue(mockPost as any)
      const mockDeletePost = vi.spyOn(postService, 'deletePost').mockResolvedValue(undefined)

      const app = new Hono<AppEnv>()
      const mockDb = {} as any
      const mockAuth = { api: {} } as any
      app.use('*', async (c, next) => {
        c.set('db', mockDb)
        c.set('auth', mockAuth)
        c.set('user', { id: 'admin' } as any)
        await next()
      })
      app.delete('/posts/:id', deletePostHandler)

      const req = new Request('http://localhost/posts/1', {
        method: 'DELETE',
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)

      mockGetPost.mockRestore()
      mockDeletePost.mockRestore()
    })
  })
})
