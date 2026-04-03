import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { checkIsAdmin } from '../services/auth.service'
import { createPost, deletePost, getAdjacentPosts, getPostById, getPostBySlug, getPosts, updatePost } from '../services/post.service'

/**
 * GET /posts - 获取文章列表，支持 series/tag/q 过滤
 */
export async function getPostList(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')
  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 10
  const isDraft = c.req.query('draft') === 'true'
  const series = c.req.query('series')
  const tag = c.req.query('tag')
  const q = c.req.query('q')

  const canSeeDrafts = isDraft && checkIsAdmin(user)

  const result = await getPosts({
    db,
    page,
    pageSize: limit,
    showDrafts: canSeeDrafts,
    series: series || undefined,
    tag: tag || undefined,
    q: q || undefined,
  })

  return c.json(result)
}

/**
 * GET /posts/:slug - 获取文章详情（公开访问，含 TOC）
 */
export async function getPostDetailBySlug(c: Context<AppEnv>) {
  const db = c.get('db')
  const slug = c.req.param('slug')!

  const post = await getPostBySlug({ db, slug })

  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' })
  }

  // 非管理员不能访问草稿
  if (!post.published) {
    const user = c.get('user')
    const isAdmin = checkIsAdmin(user)
    if (!isAdmin) {
      throw new HTTPException(403, { message: 'This post is not published' })
    }
  }

  return c.json({ data: post })
}

/**
 * GET /posts/admin/:id - 获取文章详情（管理员，按 ID）
 */
export async function getPostDetailById(c: Context<AppEnv>) {
  const db = c.get('db')
  const id = c.req.param('id')!

  const post = await getPostById({ db, id })

  if (!post) {
    throw new HTTPException(404, { message: 'Post not found' })
  }

  return c.json({ data: post })
}

/**
 * GET /posts/:slug/adjacent - 获取上/下篇文章
 */
export async function getAdjacentPostsHandler(c: Context<AppEnv>) {
  const db = c.get('db')
  const slug = c.req.param('slug')!

  const adjacent = await getAdjacentPosts({ db, slug })

  return c.json({ data: adjacent })
}

/**
 * POST /posts - 创建文章
 */
export async function createPostHandler(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')
  const data = await c.req.json()

  if (!user?.id) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  const post = await createPost({
    db,
    data: {
      ...data,
      authorId: user.id,
    },
  })

  return c.json({ data: post }, 201)
}

/**
 * PATCH /posts/:id - 更新文章
 */
export async function updatePostHandler(c: Context<AppEnv>) {
  const db = c.get('db')
  const id = c.req.param('id')!
  const data = await c.req.json()

  const existing = await getPostById({ db, id })
  if (!existing) {
    throw new HTTPException(404, { message: 'Post not found' })
  }

  const post = await updatePost({ db, id, data })

  return c.json({ data: post })
}

/**
 * DELETE /posts/:id - 删除文章
 */
export async function deletePostHandler(c: Context<AppEnv>) {
  const db = c.get('db')
  const id = c.req.param('id')!

  const existing = await getPostById({ db, id })
  if (!existing) {
    throw new HTTPException(404, { message: 'Post not found' })
  }

  await deletePost({ db, id })

  return c.json({ success: true })
}
