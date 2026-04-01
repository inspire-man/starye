import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { HTTPException } from 'hono/http-exception'
import { checkIsAdmin } from '../services/auth.service'
import { createPost, deletePost, getPostById, getPostBySlug, getPosts, updatePost } from '../services/post.service'

/**
 * GET /posts - 获取文章列表
 */
export async function getPostList(c: Context<AppEnv>) {
  const db = c.get('db')
  const user = c.get('user')
  const page = Number(c.req.query('page')) || 1
  const limit = Number(c.req.query('limit')) || 10
  const isDraft = c.req.query('draft') === 'true'

  const canSeeDrafts = isDraft && checkIsAdmin(user)

  const result = await getPosts({
    db,
    page,
    pageSize: limit,
    showDrafts: canSeeDrafts,
  })

  return c.json(result)
}

/**
 * GET /posts/:slug - 获取文章详情（公开访问）
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
 * GET /posts/admin/:id - 获取文章详情（管理员）
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
