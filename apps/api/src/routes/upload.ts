import type { AppEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { generatePresignedUrl } from '../lib/r2'
import { serviceAuth } from '../middleware/service-auth'

const upload = new Hono<AppEnv>()

// Generate Presigned URL for Upload
// Protected by Admin Auth
upload.post(
  '/presign',
  serviceAuth(),
  zValidator('json', z.object({
    filename: z.string(),
    contentType: z.string(),
    folder: z.string().default('covers'), // covers, chapters, etc.
  })),
  async (c) => {
    const { filename, contentType, folder } = c.req.valid('json')
    const env = c.env

    // Generate unique key
    const uniqueId = crypto.randomUUID()
    const ext = filename.split('.').pop()
    const key = `${folder}/${uniqueId}.${ext}`

    try {
      const uploadUrl = await generatePresignedUrl(env, key, contentType)

      // Construct Public URL (CDN)
      // Assuming R2_PUBLIC_URL is configured (e.g. https://cdn.starye.org)
      const publicUrl = `${env.R2_PUBLIC_URL}/${key}`

      return c.json({
        uploadUrl,
        publicUrl,
        key,
      })
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      return c.json({ error: message }, 500)
    }
  },
)

export default upload
