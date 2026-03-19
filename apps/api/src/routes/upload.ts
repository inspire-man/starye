/* eslint-disable no-console */
/**
 * 图片上传 API 路由
 *
 * 功能：
 * - 直接上传图片到 Cloudflare R2
 * - 身份验证（仅管理员）
 * - 文件格式和大小验证
 * - 生成唯一 key 并返回 CDN URL
 * - 记录元数据到数据库
 */

import type { AppEnv } from '../types'
import { media } from '@starye/db/schema'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { serviceAuth } from '../middleware/service-auth'

const upload = new Hono<AppEnv>()

// 支持的图片MIME类型
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

// 支持的文件扩展名
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

// 最大文件大小：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * POST /upload
 * 直接上传图片到 R2
 *
 * 权限：仅管理员角色
 */
upload.post(
  '/',
  serviceAuth(['admin', 'super_admin', 'comic_admin', 'movie_admin']),
  async (c) => {
    try {
      // 解析 multipart/form-data
      const body = await c.req.parseBody()
      const file = body.file

      // 验证文件是否存在
      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file uploaded' }, 400)
      }

      // 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        return c.json({
          error: `File size exceeds limit. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        }, 413)
      }

      // 验证 MIME 类型
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return c.json({
          error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        }, 400)
      }

      // 验证文件扩展名
      const filename = file.name
      const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]

      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        return c.json({
          error: `Unsupported file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        }, 400)
      }

      // 生成唯一 key：images/<timestamp>-<nanoid>.<ext>
      const timestamp = Date.now()
      const uniqueId = nanoid()
      const key = `images/${timestamp}-${uniqueId}${ext}`

      // 获取 R2 绑定
      const bucket = c.env.BUCKET
      if (!bucket) {
        console.error('[Upload] R2 bucket not configured')
        return c.json({ error: 'Storage not configured' }, 500)
      }

      // 上传文件到 R2
      try {
        await bucket.put(key, file.stream(), {
          httpMetadata: {
            contentType: file.type,
          },
        })

        console.log(`[Upload] ✓ Uploaded file to R2: ${key}`)
      }
      catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[Upload] ❌ R2 upload failed:', message)
        return c.json({ error: 'Failed to upload file to storage' }, 500)
      }

      // 构建 CDN URL
      const publicUrl = c.env.R2_PUBLIC_URL
      if (!publicUrl) {
        console.error('[Upload] R2_PUBLIC_URL not configured')
        return c.json({ error: 'CDN URL not configured' }, 500)
      }

      const url = `${publicUrl}/${key}`

      // 记录元数据到数据库
      const db = c.get('db')
      const mediaId = nanoid()

      try {
        await db.insert(media).values({
          id: mediaId,
          key,
          url,
          mimeType: file.type,
          size: file.size,
        })

        console.log(`[Upload] ✓ Media record created: ${mediaId}`)
      }
      catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[Upload] ❌ Database insert failed:', message)
        // 不回滚 R2 上传（接受最终一致性）
      }

      // 返回成功响应
      return c.json({
        id: mediaId,
        url,
        key,
        size: file.size,
        mimeType: file.type,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[Upload] ❌ Unexpected error:', message)
      return c.json({ error: 'Internal server error' }, 500)
    }
  },
)

export default upload
